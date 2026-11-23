using System;
using System.IO;
using System.Net;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace PixelCivilization {
    internal sealed class OfflineEdition {
        public const string Origin="https://pixelcivilization.app";
        public sealed class Entry { public string path {get;set;} public string sha256 {get;set;} public int size {get;set;} }
        public sealed class Index { public int format {get;set;} public string release {get;set;} public long generation {get;set;} public Entry[] files {get;set;} }
        private readonly string packaged, store;
        private readonly Index bundled, active;
        private readonly Dictionary<string,Entry> bundledFiles, activeFiles;
        private const int IndexLimit = 2097152;
        private static bool IsHash(string value) {return value!=null && Regex.IsMatch(value,@"\A[a-f0-9]{64}\z");}

        public OfflineEdition(string web,string local) {
            packaged=web;store=Path.Combine(local,"Editions");Directory.CreateDirectory(store);
            bundled=ReadIndex(File.ReadAllBytes(Path.Combine(web,"offline-index.json")));
            bundledFiles=ByPath(bundled);
            active=bundled;
            try {
                string[] pointer=File.ReadAllLines(Path.Combine(store,"current"));
                if(pointer.Length==2 && pointer[0]==bundled.release && IsHash(pointer[1])) {
                    Index previous=ReadIndex(File.ReadAllBytes(Path.Combine(store,"index-"+pointer[1])));
                    if(previous.release==pointer[1] && previous.generation>=bundled.generation && Available(previous)) active=previous;
                }
            } catch(IOException) {} catch(InvalidDataException) {} catch(ArgumentException) {}
            activeFiles=ByPath(active);
        }
        private static Index ReadIndex(byte[] bytes) {
            if(bytes.Length>IndexLimit)throw new InvalidDataException("Update index too large");
            Index i=new JavaScriptSerializer{MaxJsonLength=IndexLimit}.Deserialize<Index>(Encoding.UTF8.GetString(bytes));
            if(i==null || i.format!=1 || i.generation<1 || !IsHash(i.release) || i.files==null || i.files.Length>10000)
                throw new InvalidDataException("Unsupported offline edition");
            var names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            long total=0;
            foreach(Entry e in i.files) {
                if(e==null || e.path==null || !Regex.IsMatch(e.path,@"\A[A-Za-z0-9._ /@+~-]+\z") ||
                   e.path.StartsWith("/") || Array.Exists(e.path.Split('/'),part=>part==".."||part=="."||part.Length==0) ||
                   !names.Add(e.path) || !IsHash(e.sha256) || e.size<0 || e.size>67108864)
                    throw new InvalidDataException("Invalid offline asset");
                total+=e.size;
            }
            if(!names.Contains("index.html") || total>536870912L)throw new InvalidDataException("Incomplete edition");
            return i;
        }
        private static Dictionary<string,Entry> ByPath(Index i) {
            var result=new Dictionary<string,Entry>(StringComparer.Ordinal);
            foreach(Entry e in i.files) result.Add(e.path,e);
            return result;
        }
        private bool Bundled(Entry e) {
            Entry built;
            return bundledFiles.TryGetValue(e.path,out built) && built.sha256==e.sha256;
        }
        private bool Available(Index i) {
            foreach(Entry e in i.files) if(!Bundled(e)) {
                var f=new FileInfo(Path.Combine(store,e.sha256));
                if(!f.Exists || f.Length!=e.size) return false;
            }
            return true;
        }
        public Stream Open(string name) {
            Entry entry;
            if(!activeFiles.TryGetValue(name,out entry) && (name.Contains(".") || !activeFiles.TryGetValue(name+".html",out entry)))return null;
            return File.OpenRead(Bundled(entry)?Path.Combine(packaged,entry.path.Replace('/','\\')):Path.Combine(store,entry.sha256));
        }
        internal static Uri UpdateUrl(string path,string revision) {
            string route=path=="index.html" ? "" : (path.EndsWith(".html",StringComparison.Ordinal)?path.Substring(0,path.Length-5):path);
            return new UriBuilder(Origin){Path="/"+route,Query=revision.Length==0?"":"edition="+revision}.Uri;
        }
        private static async Task<byte[]> ReadRemote(string path,string revision,int limit) {
            Uri uri=UpdateUrl(path,revision);
            var req=(HttpWebRequest)WebRequest.Create(uri);
            req.AllowAutoRedirect=false;
            req.Timeout=15000;req.ReadWriteTimeout=15000;req.UserAgent="PixelCivilizationOffline/1";
            using(var timer=new System.Threading.CancellationTokenSource(20000))
            using(timer.Token.Register(req.Abort))
            using(var res=(HttpWebResponse)await req.GetResponseAsync().ConfigureAwait(false)) {
                if(res.StatusCode!=HttpStatusCode.OK || res.ContentLength>limit)throw new IOException("Update unavailable");
                using(Stream input=res.GetResponseStream())
                using(var output=new MemoryStream()) {
                    byte[] buffer=new byte[32768];int n;
                    while((n=await input.ReadAsync(buffer,0,buffer.Length).ConfigureAwait(false))>0) {
                        if(output.Length+n>limit)throw new InvalidDataException("Asset exceeds declared length");
                        output.Write(buffer,0,n);
                    }
                    return output.ToArray();
                }
            }
        }
        private static void Atomic(string target,byte[] bytes) {
            string temp=Path.Combine(Path.GetDirectoryName(target),Guid.NewGuid().ToString("N")+".tmp");
            try {
                using(var f=new FileStream(temp,FileMode.CreateNew,FileAccess.Write,FileShare.None)){f.Write(bytes,0,bytes.Length);f.Flush(true);}
                if(File.Exists(target))File.Replace(temp,target,null); else File.Move(temp,target);
            } finally { if(File.Exists(temp))File.Delete(temp); }
        }
        public Task<bool> CheckForUpdate() { return CheckForUpdate(ReadRemote); }
        internal async Task<bool> CheckForUpdate(Func<string,string,int,Task<byte[]>> fetch) {
            byte[] bytes=await fetch("offline-index.json","",IndexLimit).ConfigureAwait(false);
            Index next=ReadIndex(bytes);
            if(next.release==active.release || next.generation<=active.generation){Clean(active);return false;}
            foreach(Entry e in next.files) {
                if(Bundled(e))continue;
                string target=Path.Combine(store,e.sha256);
                var fd=new FileInfo(target);if(fd.Exists && fd.Length==e.size)continue;
                byte[] downloaded=await fetch(e.path,next.release,e.size).ConfigureAwait(false);
                string hash;
                using(var sha=SHA256.Create())hash=BitConverter.ToString(sha.ComputeHash(downloaded)).Replace("-","").ToLowerInvariant();
                if(downloaded.Length!=e.size || hash!=e.sha256)throw new InvalidDataException("Incomplete or changed download");
                Atomic(target,downloaded);
            }
            Atomic(Path.Combine(store,"index-"+next.release),bytes);
            Atomic(Path.Combine(store,"current"),Encoding.UTF8.GetBytes(bundled.release+"\n"+next.release));
            Clean(active,next);return true;
        }
        private void Clean(params Index[] keep) {
            var names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach(Index i in keep){names.Add("index-"+i.release);foreach(Entry e in i.files)if(!Bundled(e))names.Add(e.sha256);}
            foreach(string file in Directory.EnumerateFiles(store)) {
                string name=Path.GetFileName(file);
                if(!names.Contains(name) && (IsHash(name) || (name.StartsWith("index-") && IsHash(name.Substring(6))) || name.EndsWith(".tmp"))) {
                    try{File.Delete(file);}catch(IOException){}
                }
            }
        }
    }
}
