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
    private byte[] queryExportBytes;
    private volatile String queryExportState="idle",queryExportError="";
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web=new WebView(this); LocalWeb.setup(web,this); web.addJavascriptInterface(new Bridge(),"FgoAndroid");
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(selectedFiles!=null)selectedFiles.onReceiveValue(null);
                selectedFiles=callback;
                Intent choose=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                choose.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
                choose.putExtra(android.provider.DocumentsContract.EXTRA_INITIAL_URI,Uri.parse("content://com.android.externalstorage.documents/document/primary:Download"));
                try{startActivityForResult(choose,30);}catch(ActivityNotFoundException e){selectedFiles.onReceiveValue(null);selectedFiles=null;}
                return true;
            }
        });
        setContentView(web);
        web.loadUrl(LocalWeb.ROOT+(getIntent().getBooleanExtra("tasks",false)?"native/tasks.html":"index.html"));
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},10);
        boolean auto=getSharedPreferences("settings",0).getBoolean("auto",true);
        DataWorker.schedule(this,auto);
        if(!getIntent().getBooleanExtra("tasks",false))SoftwareUpdate.launchCheck(this);
        if(auto && !getIntent().getBooleanExtra("tasks",false))DataWorker.start(this,false,false);
    }
    private final class Bridge {
        @JavascriptInterface public boolean exportQueryFile(String name,String encoded) {
            if("choosing".equals(queryExportState)||"saving".equals(queryExportState))return false;
            try {
                if(!name.matches("FGO-query-results-\\d{4}-\\d{2}-\\d{2}\\.jsonl(\\.gz)?")||encoded.length()>45*1024*1024)throw new IllegalArgumentException("备份文件名无效或文件过大");
                queryExportBytes=android.util.Base64.decode(encoded,android.util.Base64.DEFAULT);
                queryExportState="choosing";queryExportError="";
                runOnUiThread(()->{
                    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType(name.endsWith(".gz")?"application/gzip":"application/x-ndjson").putExtra(Intent.EXTRA_TITLE,name);
                    try{startActivityForResult(intent,31);}catch(Exception e){queryExportBytes=null;queryExportError=e.getMessage();queryExportState="error";}
                });
            }catch(Exception e){queryExportBytes=null;queryExportError=e.getMessage();queryExportState="error";}
            return true;
        }
        @JavascriptInterface public String queryExportStatus() {
            try{return new JSONObject().put("state",queryExportState).put("error",queryExportError).toString();}catch(Exception e){return "{}";}
        }
        @JavascriptInterface public String softwareStatus(){return SoftwareUpdate.status(MainActivity.this).toString();}
        @JavascriptInterface public void softwareCommand(String action){if("install".equals(action))SoftwareUpdate.install(MainActivity.this);else SoftwareUpdate.start(MainActivity.this,action);}
        @JavascriptInterface public void softwareAuto(boolean value){SoftwareUpdate.schedule(MainActivity.this,value);}
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
        if(request==30 && selectedFiles!=null){
            Uri[] uris=null;
            if(result==RESULT_OK&&data!=null){
                if(data.getClipData()!=null){int n=data.getClipData().getItemCount();uris=new Uri[n];for(int i=0;i<n;i++)uris[i]=data.getClipData().getItemAt(i).getUri();}
                else if(data.getData()!=null)uris=new Uri[]{data.getData()};
            }
            selectedFiles.onReceiveValue(uris);selectedFiles=null;
        }
        if(request==31){
            byte[] bytes=queryExportBytes;queryExportBytes=null;
            if(result!=RESULT_OK||data==null||data.getData()==null){queryExportState="canceled";return;}
            Uri target=data.getData();queryExportState="saving";
            new Thread(()->{try{try(java.io.OutputStream out=getContentResolver().openOutputStream(target)){
                if(out==null||bytes==null)throw new java.io.IOException("文件保存目标不可用");out.write(bytes);}
                queryExportState="done";
            }catch(Exception e){queryExportError=e.getMessage();queryExportState="error";}},"query-export").start();
        }
    }
    @Override public void onBackPressed() {if(getIntent().getBooleanExtra("tasks",false)){super.onBackPressed();return;}if(web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onResume(){super.onResume();SoftwareUpdate.resume(this);}
    @Override protected void onDestroy(){if(selectedFiles!=null){selectedFiles.onReceiveValue(null);selectedFiles=null;}web.removeJavascriptInterface("FgoAndroid");web.destroy();super.onDestroy();}
}
