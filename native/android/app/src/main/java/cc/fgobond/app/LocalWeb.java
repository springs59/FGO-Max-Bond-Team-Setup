package cc.fgobond.app;
import android.content.Context;
import android.net.Uri;
import android.webkit.*;
import androidx.webkit.*;
public final class LocalWeb {
    public static final String ROOT = "https://appassets.androidplatform.net/assets/site/";
    public static String compareRoot(String version) {
        if(!java.util.Arrays.asList("200","208","209").contains(version))throw new IllegalArgumentException("Unknown version");
        return "https://v"+version+".appassets.androidplatform.net/assets/site/versions/"+version+"/";
    }
    public interface RendererExit {void handle(WebView view,RenderProcessGoneDetail detail);}
    public static void setup(WebView web, Context context,RendererExit exit) {
        setup(web,context,exit,ROOT);
    }
    public static void setup(WebView web, Context context,RendererExit exit,String root) {
        String domain=Uri.parse(root).getHost();
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder().setDomain(domain).addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(context)).build();
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(true);
        web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){
                android.util.Log.e("FGOBond","WebView renderer exited; didCrash="+detail.didCrash());
                if(view.getParent() instanceof android.view.ViewGroup)((android.view.ViewGroup)view.getParent()).removeView(view);
                view.destroy();exit.handle(view,detail);return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) { return intercept(loader,request.getUrl()); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return !request.getUrl().toString().startsWith(root); }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new ServiceWorkerClientCompat() {
                @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {return intercept(loader,request.getUrl());}
            });
        }
    }
    private static WebResourceResponse intercept(WebViewAssetLoader loader, Uri uri) {
        if(uri.getHost()==null || !("appassets.androidplatform.net".equals(uri.getHost()) || uri.getHost().matches("v(200|208|209)\\.appassets\\.androidplatform\\.net")))return null;
        WebResourceResponse response=loader.shouldInterceptRequest(uri);
        if(response!=null && uri.getPath()!=null && uri.getPath().endsWith(".js"))response.setMimeType("application/javascript");
        if(response!=null && uri.getPath()!=null && uri.getPath().endsWith(".html")){
            java.util.Map<String,String> headers=new java.util.HashMap<>();
            headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://springs59.github.io https://raw.githubusercontent.com; frame-src 'self'; object-src 'none'");
            response.setResponseHeaders(headers);
        }
        return response;
    }
}
