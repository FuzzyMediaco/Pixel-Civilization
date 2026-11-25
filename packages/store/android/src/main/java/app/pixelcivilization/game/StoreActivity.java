package app.pixelcivilization.game;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.widget.FrameLayout;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;

public final class StoreActivity extends Activity {
    static final String ORIGIN = "https://pixelcivilization.app";
    private WebView web;
    private PlayStore store;
    private static boolean trusted(Uri uri) {
        return "https".equals(uri.getScheme()) && "pixelcivilization.app".equals(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443);
    }
    private static boolean api(String path) { return path != null && path.startsWith("/api/"); }
    private static WebResourceResponse empty(int code) {
        return new WebResourceResponse("text/plain", "UTF-8",code, "Unavailable",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
    }
    private WebResourceResponse bundled(WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!trusted(uri)) return empty(403);
        String path = uri.getPath();
        if (api(path)) return request.isForMainFrame() ? empty(403) : null;
        if (!"GET".equals(request.getMethod()) || path == null || path.contains("..") || path.contains("\\")) return empty(404);
        String file = path.equals("/") ? "index.html" : path.substring(1);
        if (!file.substring(file.lastIndexOf('/') + 1).contains(".")) file += ".html";
        String ext = file.substring(file.lastIndexOf('.') + 1);
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        if (ext.equals("js") || ext.equals("mjs")) mime = "text/javascript";
        if (ext.equals("wasm")) mime = "application/wasm";
        if (ext.equals("woff2")) mime = "font/woff2";
        try {
            InputStream data = getAssets().open(file);
            return new WebResourceResponse(mime == null ? "application/octet-stream" : mime,null,200,"OK",
                Collections.singletonMap("X-Content-Type-Options","nosniff"),data);
        } catch (IOException missing) { return empty(404); }
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xff26453a);
        root.setOnApplyWindowInsetsListener((v,insets)->{
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout());
                v.setPadding(safe.left,safe.top,safe.right,safe.bottom);
            } else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        web = new WebView(this);
        root.addView(web);
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " PixelCivilizationOffline/1 PixelCivilizationStore/Google");
        CookieManager.getInstance().setAcceptCookie(true);
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView w, WebResourceRequest r) { return bundled(r); }
            @Override public boolean shouldOverrideUrlLoading(WebView w, WebResourceRequest r) {
                if (trusted(r.getUrl())) return api(r.getUrl().getPath());
                if (r.isForMainFrame() && r.hasGesture() && "https".equals(r.getUrl().getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW,r.getUrl())); } catch (android.content.ActivityNotFoundException ignored) {}
                }
                return true;
            }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            store = new PlayStore(this, () -> web.evaluateJavascript("dispatchEvent(new Event('pixel-store-purchases-updated'))",null));
            WebViewCompat.addWebMessageListener(web, "PixelBilling", Collections.singleton(ORIGIN),
                (view,message,origin,isMainFrame,reply)-> {
                    if (isMainFrame && trusted(origin) && message.getData() != null) store.handle(message.getData(),reply);
                });
        }
        Uri requested = getIntent().getData();
        boolean tour = requested != null && trusted(requested) && requested.getQuery() == null
            && ("/".equals(requested.getPath()) || "/handbook.html".equals(requested.getPath()) || "/field-guide.html".equals(requested.getPath()));
        web.loadUrl(tour ? requested.toString() : ORIGIN + "/");
    }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override public void onDestroy() { if (store != null) store.close(); if (web != null) web.destroy(); super.onDestroy(); }
}
