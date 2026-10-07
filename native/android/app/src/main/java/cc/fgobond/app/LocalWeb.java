package cc.fgobond.app;
import android.content.Context;
import android.net.Uri;
import android.webkit.*;
import androidx.webkit.*;
public final class LocalWeb {
    public static final String ROOT = "https://appassets.androidplatform.net/assets/site/";
    public static void setup(WebView web, Context context) {
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder().addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(context)).build();
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) { return intercept(loader,request.getUrl()); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return !request.getUrl().toString().startsWith(ROOT); }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new ServiceWorkerClientCompat() {
                @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {return intercept(loader,request.getUrl());}
            });
        }
    }
    private static WebResourceResponse intercept(WebViewAssetLoader loader, Uri uri) {
        if(!"appassets.androidplatform.net".equals(uri.getHost()))return null;
        WebResourceResponse response=loader.shouldInterceptRequest(uri);
        if(response!=null && uri.getPath()!=null && uri.getPath().endsWith(".js"))response.setMimeType("application/javascript");
        return response;
    }
}
