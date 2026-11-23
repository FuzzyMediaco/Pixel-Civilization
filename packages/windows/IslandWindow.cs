using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PixelCivilization {
    internal sealed class IslandWindow : Form {
        private readonly WebView2 game=new WebView2{Dock=DockStyle.Fill};
        private OfflineEdition edition;
        private readonly string profile=Path.Combine(Environment.GetEnvironmentVariable("LOCALAPPDATA") ?? Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Pixel Civilization");
        private static readonly Dictionary<string,string> types=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase){
            {"html","text/html"},{"js","text/javascript"},{"mjs","text/javascript"},{"css","text/css"},{"json","application/json"},
            {"webmanifest","application/manifest+json"},{"woff2","font/woff2"},{"woff","font/woff"},{"wasm","application/wasm"},
            {"png","image/png"},{"jpg","image/jpeg"},{"jpeg","image/jpeg"},{"webp","image/webp"},{"svg","image/svg+xml"},{"ico","image/x-icon"}
        };
        private static bool SameOrigin(Uri uri) {
            return uri.Scheme=="https" && uri.Host=="pixelcivilization.app" && uri.IsDefaultPort;
        }
        private void Respond(object sender, CoreWebView2WebResourceRequestedEventArgs e) {
            var uri=new Uri(e.Request.Uri);
            if(!SameOrigin(uri) || uri.AbsolutePath=="/api" || uri.AbsolutePath.StartsWith("/api/"))return;
            string name=Uri.UnescapeDataString(uri.AbsolutePath.Substring(1));
            if(name.Length==0)name="index.html";
            Stream data=null;
            if(e.Request.Method=="GET") {
                try{data=edition.Open(name);}catch(IOException){}
            }
            if(data==null) {
                e.Response=game.CoreWebView2.Environment.CreateWebResourceResponse(new MemoryStream(),404,"Not Found","Content-Type: text/plain");
                return;
            }
            string mime;
            string extension=Path.GetExtension(name).TrimStart('.');
            if(!types.TryGetValue(extension.Length==0 ? "html" : extension,out mime))mime="application/octet-stream";
            e.Response=game.CoreWebView2.Environment.CreateWebResourceResponse(data,200,"OK",
                "Content-Type: "+mime+"\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff");
        }
        private static void OpenExternal(string address) {
            Uri uri;
            if(Uri.TryCreate(address,UriKind.Absolute,out uri) && uri.Scheme=="https")
                Process.Start(new ProcessStartInfo(uri.AbsoluteUri){UseShellExecute=true});
        }
        public IslandWindow(){
            Text="Pixel Civilization";Size=new Size(1250,850);MinimumSize=new Size(410,430);
            StartPosition=FormStartPosition.CenterScreen;
            Controls.Add(game);
            Shown+=Start;
        }
        private async void Start(object sender,EventArgs e) {
            try{
                string web=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"web");
                edition=new OfflineEdition(web,profile);
                var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(profile,"Browser"));
                await game.EnsureCoreWebView2Async(env);
                var core=game.CoreWebView2;
                core.Settings.UserAgent+=" PixelCivilizationOffline/1";
                core.AddWebResourceRequestedFilter(OfflineEdition.Origin+"/*",CoreWebView2WebResourceContext.All);
                core.WebResourceRequested+=Respond;
                core.NavigationStarting+=(s,args)=>{
                    Uri uri;
                    if(!Uri.TryCreate(args.Uri,UriKind.Absolute,out uri)||!SameOrigin(uri)){
                        args.Cancel=true;if(args.IsUserInitiated)OpenExternal(args.Uri);
                    }
                };
                core.NewWindowRequested+=(s,args)=>{
                    args.Handled=true;Uri uri;
                    if(!args.IsUserInitiated || !Uri.TryCreate(args.Uri,UriKind.Absolute,out uri))return;
                    if(SameOrigin(uri))core.Navigate(uri.AbsoluteUri);else OpenExternal(uri.AbsoluteUri);
                };
                core.Navigate(OfflineEdition.Origin+"/");
            }catch(Exception ex){
                MessageBox.Show(this,"The offline game could not start. Extract the complete ZIP and use Windows 10 or 11 with Microsoft Edge WebView2 Runtime installed.\n\n"+ex.Message,"Pixel Civilization");
                Close();return;
            }
            try{
                if(await edition.CheckForUpdate() && !IsDisposed)Text="Pixel Civilization · Update ready on next launch";
            }catch(Exception ex){Trace.WriteLine("Update deferred: "+ex.Message);}
        }
        [STAThread] static void Main(){
            bool first;
            using(var guard=new Mutex(true,"Local\\PixelCivilizationOffline",out first)){
                if(!first){MessageBox.Show("Pixel Civilization is already open.","Pixel Civilization");return;}
                ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;
                Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new IslandWindow());
            }
        }
    }
}
