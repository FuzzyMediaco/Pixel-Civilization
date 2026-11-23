package app.pixelcivilization.game;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.view.View;
import android.widget.*;
import java.io.*;
import java.util.*;

public final class IslandActivity extends Activity {
    private WebView game;
    private OfflineEdition edition;
    private static final Object updateLock = new Object();
    private static String type(String path) {
        String ext = path.substring(path.lastIndexOf('.')+1).toLowerCase(Locale.ROOT);
        switch(ext) {
            case "html": return "text/html";
            case "js": case "mjs": return "text/javascript";
            case "css": return "text/css";
            case "json": return "application/json";
            case "webmanifest": return "application/manifest+json";
            case "woff2": return "font/woff2";
            case "wasm": return "application/wasm";
            case "svg": return "image/svg+xml";
            default: String mime=MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
                return mime==null?"application/octet-stream":mime;
        }
    }
    private static boolean origin(Uri uri) {
        return "https".equals(uri.getScheme()) && "pixelcivilization.app".equals(uri.getHost()) && (uri.getPort()==-1 || uri.getPort()==443);
    }
    private WebResourceResponse local(WebResourceRequest req) {
        Uri uri=req.getUrl();
        String path=uri.getPath();
        if(!origin(uri) || path==null || path.equals("/api") || path.startsWith("/api/")) return null;
        String file=path.equals("/")?"index.html":path.substring(1);
        try {
            InputStream stream = "GET".equals(req.getMethod())?edition.file(file):null;
            if(stream!=null) {
                Map<String,String> headers = new HashMap<>();
                headers.put("Cache-Control","no-store"); headers.put("X-Content-Type-Options","nosniff");
                return new WebResourceResponse(type(file.contains(".") ? file : file+".html"),null,200,"OK",headers,stream);
            }
        } catch(IOException ignored) {}
        return new WebResourceResponse("text/plain","utf-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try { edition=new OfflineEdition(this); }
        catch(Exception failed){ android.util.Log.e("PixelCivilization","Cannot open bundled edition",failed);TextView msg=new TextView(this);msg.setText("The bundled game could not be read. Reinstall Pixel Civilization to restore its game files."); setContentView(msg);return; }
        game=new WebView(this);
        FrameLayout island=new FrameLayout(this);
        island.setBackgroundColor(0xff26453a);
        island.setOnApplyWindowInsetsListener((view,insets)->{
            if(android.os.Build.VERSION.SDK_INT>=30){
                android.graphics.Insets safe=insets.getInsets(android.view.WindowInsets.Type.systemBars()|android.view.WindowInsets.Type.displayCutout());
                view.setPadding(safe.left,safe.top,safe.right,safe.bottom);
            }else{
                view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        island.addView(game);
        WebSettings settings=game.getSettings();
        settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString()+" PixelCivilizationOffline/1");
        CookieManager.getInstance().setAcceptCookie(true);
        game.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req){return local(req);}
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req){
                if(origin(req.getUrl()))return false;
                if(req.isForMainFrame() && req.hasGesture() && "https".equals(req.getUrl().getScheme())){
                    try{startActivity(new Intent(Intent.ACTION_VIEW,req.getUrl()));}catch(android.content.ActivityNotFoundException ignored){}
                }
                return true;
            }
        });
        setContentView(island);
        game.loadUrl(OfflineEdition.ORIGIN+"/");
        new Thread(()->{
            boolean updated;
            synchronized(updateLock){try{updated=edition.update();}catch(Exception unavailable){return;}}
            if(updated)runOnUiThread(()->{if(!isFinishing()&&!isDestroyed())Toast.makeText(this,"An island update is ready for your next launch.",Toast.LENGTH_LONG).show();});
        },"island-updates").start();
    }
    @Override public void onBackPressed(){
        if(game!=null && game.canGoBack())game.goBack(); else super.onBackPressed();
    }
    @Override protected void onPause(){
        if(game!=null){game.evaluateJavascript("window.dispatchEvent(new Event('pagehide'))",null);game.onPause();}
        CookieManager.getInstance().flush();super.onPause();
    }
    @Override protected void onResume(){super.onResume();if(game!=null)game.onResume();}
    @Override protected void onDestroy(){
        if(game!=null){game.destroy();game=null;}
        super.onDestroy();
    }
}
