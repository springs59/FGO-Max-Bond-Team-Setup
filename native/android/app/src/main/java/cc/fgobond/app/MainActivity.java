package cc.fgobond.app;
import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.Manifest;
import android.net.Uri;
import android.webkit.*;
import androidx.work.*;
import org.json.JSONObject;
public final class MainActivity extends Activity {
    private WebView web;
    private ValueCallback<Uri[]> selectedFiles;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web=new WebView(this); LocalWeb.setup(web,this); web.addJavascriptInterface(new Bridge(),"FgoAndroid");
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(selectedFiles!=null)selectedFiles.onReceiveValue(null);
                selectedFiles=callback;
                Intent choose=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try{startActivityForResult(choose,30);}catch(ActivityNotFoundException e){selectedFiles.onReceiveValue(null);selectedFiles=null;}
                return true;
            }
        });
        setContentView(web);
        web.loadUrl(LocalWeb.ROOT+(getIntent().getBooleanExtra("tasks",false)?"native/tasks.html":"index.html"));
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},10);
        boolean auto=getSharedPreferences("settings",0).getBoolean("auto",true);
        DataWorker.schedule(this,auto);
        if(auto && !getIntent().getBooleanExtra("tasks",false))DataWorker.start(this,false,false);
    }
    private final class Bridge {
        @JavascriptInterface public String nativeStatus(){return getSharedPreferences("task-test",0).getString("report","{}");}
        @JavascriptInterface public void command(String json) {
            try { JSONObject c=new JSONObject(json);if("pause".equals(c.optString("action")))DataWorker.pause(MainActivity.this);else DataWorker.start(MainActivity.this,c.optBoolean("force"),false); } catch(Exception ignored){}
        }
        @JavascriptInterface public void openTasks() { runOnUiThread(()->startActivity(new Intent(MainActivity.this,MainActivity.class).putExtra("tasks",true))); }
        @JavascriptInterface public void auto(boolean value) {getSharedPreferences("settings",0).edit().putBoolean("auto",value).apply();DataWorker.schedule(MainActivity.this,value);}
        @JavascriptInterface public void apply() {runOnUiThread(()->{if(getIntent().getBooleanExtra("tasks",false)){startActivity(new Intent(MainActivity.this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP));finish();}else web.reload();});}
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==30 && selectedFiles!=null){selectedFiles.onReceiveValue(result==RESULT_OK && data!=null && data.getData()!=null?new Uri[]{data.getData()}:null);selectedFiles=null;}
    }
    @Override public void onBackPressed() {if(getIntent().getBooleanExtra("tasks",false)){super.onBackPressed();return;}if(web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onDestroy(){if(selectedFiles!=null){selectedFiles.onReceiveValue(null);selectedFiles=null;}web.removeJavascriptInterface("FgoAndroid");web.destroy();super.onDestroy();}
}
