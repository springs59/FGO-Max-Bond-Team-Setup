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
    private FileExport fileExports;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        fileExports=new FileExport(this);
        openBrowser();
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},10);
        boolean auto=getSharedPreferences("settings",0).getBoolean("auto",true);
        DataWorker.schedule(this,auto);
        if(!getIntent().getBooleanExtra("tasks",false))SoftwareUpdate.launchCheck(this);
        if(auto && !getIntent().getBooleanExtra("tasks",false))DataWorker.startAutomatically(this,false,false,false);
    }
    private void openBrowser(){
        web=new WebView(this); LocalWeb.setup(web,this,this::rendererExited); web.addJavascriptInterface(new Bridge(),"FgoAndroid");
        fileExports.attach(web);
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(selectedFiles!=null)selectedFiles.onReceiveValue(null);
                selectedFiles=callback;
                Intent choose=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                choose.putExtra(android.provider.DocumentsContract.EXTRA_INITIAL_URI,Uri.parse("content://com.android.externalstorage.documents/document/primary:Download"));
                try{startActivityForResult(choose,30);}catch(ActivityNotFoundException e){selectedFiles.onReceiveValue(null);selectedFiles=null;}
                return true;
            }
        });
        setContentView(web);
        web.loadUrl(LocalWeb.ROOT+(getIntent().getBooleanExtra("tasks",false)?"native/tasks.html":"index.html"));
    }
    private void rendererExited(WebView view,RenderProcessGoneDetail detail){
        fileExports.abortAll();
        if(web!=view)return;web=null;selectedFiles=null;
        if(isFinishing()||isDestroyed())return;
        android.widget.LinearLayout recovery=new android.widget.LinearLayout(this);recovery.setOrientation(android.widget.LinearLayout.VERTICAL);recovery.setPadding(24,24,24,24);
        android.widget.TextView message=new android.widget.TextView(this);message.setText("计算界面已退出。账号与已保存的计算结果仍在本机，重新打开后可复用。");recovery.addView(message);
        android.widget.Button retry=new android.widget.Button(this);retry.setText("重新打开");retry.setOnClickListener(v->openBrowser());recovery.addView(retry);setContentView(recovery);
    }
    private final class Bridge {
        @JavascriptInterface public String softwareStatus(){return SoftwareUpdate.status(MainActivity.this).toString();}
        @JavascriptInterface public void softwareCommand(String action){if("install".equals(action))SoftwareUpdate.install(MainActivity.this);else SoftwareUpdate.start(MainActivity.this,action);}
        @JavascriptInterface public void softwareAuto(boolean value){SoftwareUpdate.schedule(MainActivity.this,value);}
        @JavascriptInterface public String nativeStatus(){return getSharedPreferences("task-test",0).getString("report","{}");}
        @JavascriptInterface public void command(String json) {
            try { JSONObject c=new JSONObject(json);if("pause".equals(c.optString("action")))DataWorker.pause(MainActivity.this);else if(c.optBoolean("accountOnly"))DataWorker.startAutomatically(MainActivity.this,c.optBoolean("force"),false,true);else DataWorker.start(MainActivity.this,c.optBoolean("force"),false); } catch(Exception ignored){}
        }
        @JavascriptInterface public void openTasks() { runOnUiThread(()->startActivity(new Intent(MainActivity.this,MainActivity.class).putExtra("tasks",true))); }
        @JavascriptInterface public void auto(boolean value) {getSharedPreferences("settings",0).edit().putBoolean("auto",value).apply();DataWorker.schedule(MainActivity.this,value);}
        @JavascriptInterface public void apply() {runOnUiThread(()->{if(getIntent().getBooleanExtra("tasks",false)){startActivity(new Intent(MainActivity.this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP));finish();}else web.reload();});}
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==30 && selectedFiles!=null){selectedFiles.onReceiveValue(result==RESULT_OK && data!=null && data.getData()!=null?new Uri[]{data.getData()}:null);selectedFiles=null;}
        if(request==FileExport.PICK_FILE)fileExports.selected(result==RESULT_OK&&data!=null?data.getData():null);
    }
    @Override public void onBackPressed() {if(getIntent().getBooleanExtra("tasks",false)){super.onBackPressed();return;}if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onResume(){super.onResume();SoftwareUpdate.resume(this);}
    @Override protected void onDestroy(){fileExports.destroy();if(selectedFiles!=null){selectedFiles.onReceiveValue(null);selectedFiles=null;}if(web!=null){web.removeJavascriptInterface("FgoAndroid");web.destroy();web=null;}super.onDestroy();}
}
