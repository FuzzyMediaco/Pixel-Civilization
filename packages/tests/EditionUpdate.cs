using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace PixelCivilization {
    internal static class EditionUpdateTest {
        static readonly byte[] First=Encoding.UTF8.GetBytes("original island"), Next=Encoding.UTF8.GetBytes("new island");
        static string Hash(byte[] a){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(a)).Replace("-","").ToLowerInvariant();}
        static byte[] Index(byte[] data,long n){return Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(new {format=1,generation=n,release=Hash(data),files=new[]{new{path="index.html",sha256=Hash(data),size=data.Length}}}));}
        static string Text(OfflineEdition e){using(var r=new StreamReader(e.Open("index.html")))return r.ReadToEnd();}
        static void Check(bool ok,string s){if(!ok)throw new Exception(s);}
        static async Task Verify(string root){
            Check(OfflineEdition.UpdateUrl("index.html","abc").AbsolutePath=="/","Wrong entry point update URL");
            Check(OfflineEdition.UpdateUrl("handbook.html","abc").AbsolutePath=="/handbook","Handbook update would redirect");
            string web=Path.Combine(root,"web"), profile=Path.Combine(root,"profile");
            Directory.CreateDirectory(web);File.WriteAllBytes(Path.Combine(web,"index.html"),First);File.WriteAllBytes(Path.Combine(web,"offline-index.json"),Index(First,1000));
            var current=new OfflineEdition(web,profile);
            Check(Text(current)=="original island","Offline boot failed");
            bool rejected=false;
            try {await current.CheckForUpdate((p,r,l)=>Task.FromResult(p=="offline-index.json"?Index(Next,2000):new byte[Next.Length]));}catch(InvalidDataException){rejected=true;}
            Check(rejected && Text(new OfflineEdition(web,profile))=="original island","Failed update replaced the playable edition");
            Check(await current.CheckForUpdate((p,r,l)=>Task.FromResult(p=="offline-index.json"?Index(Next,2000):Next)),"New edition was not staged");
            Check(Text(current)=="original island","Update disrupted the current session");
            var reopened=new OfflineEdition(web,profile);
            Check(Text(reopened)=="new island","Restart failed to activate the completed edition");
            Check(!await reopened.CheckForUpdate((p,r,l)=>Task.FromResult(Index(First,1000))),"Older edition replaced newer content");
            File.Delete(Path.Combine(profile,"Editions",Hash(Next)));
            Check(Text(new OfflineEdition(web,profile))=="original island","Missing update files broke the bundled fallback");
        }
        static int Main(){
            string root=Path.Combine(Path.GetTempPath(),"PixelUpdateTest-"+Guid.NewGuid().ToString("N"));
            try{
                Verify(root).GetAwaiter().GetResult();
                // The final content hashes fit under MAX_PATH here, but appending a GUID to each hash does not.
                string deepProfile=Path.Combine(root,new string('p',Math.Max(1,150-root.Length-1)));
                Verify(deepProfile).GetAwaiter().GetResult();
                Console.WriteLine("Offline install, corrupt download, atomic upgrade, restart, downgrade and fallback passed in ordinary and long profiles.");return 0;
            }
            finally{if(Directory.Exists(root))Directory.Delete(root,true);}
        }
    }
}
