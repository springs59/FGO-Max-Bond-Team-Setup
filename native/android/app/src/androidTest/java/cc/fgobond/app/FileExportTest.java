package cc.fgobond.app;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.WebView;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class FileExportTest {
    private String js(android.app.Instrumentation instrumentation,WebView web,String script)throws Exception{
        AtomicReference<String> answer=new AtomicReference<>();instrumentation.runOnMainSync(()->web.evaluateJavascript(script,answer::set));
        long end=System.currentTimeMillis()+10000;while(answer.get()==null&&System.currentTimeMillis()<end)Thread.sleep(30);
        assertNotNull("WebView response missing",answer.get());return answer.get();
    }
    private JSONObject result(android.app.Instrumentation instrumentation,WebView web)throws Exception{
        long end=System.currentTimeMillis()+20000;
        while(System.currentTimeMillis()<end){String raw=js(instrumentation,web,"JSON.stringify(window.fileSaveResult||{})");JSONObject value=new JSONObject(new JSONArray("["+raw+"]").getString(0));if(value.has("saved")||value.has("error"))return value;Thread.sleep(80);}
        fail("Native file save did not finish; page="+js(instrumentation,web,"location.href")+"; result="+js(instrumentation,web,"JSON.stringify(window.fileSaveResult)"));return null;
    }
    private IntentFilter pickerFilter()throws IntentFilter.MalformedMimeTypeException{
        IntentFilter filter=new IntentFilter(Intent.ACTION_CREATE_DOCUMENT);filter.addCategory(Intent.CATEGORY_OPENABLE);filter.addDataType("*/*");return filter;
    }
    @Test public void realWebViewSavesSelectedDocumentsAndCancelsWithoutWriting()throws Exception{
        var instrumentation=InstrumentationRegistry.getInstrumentation();Context c=instrumentation.getTargetContext();
        instrumentation.getUiAutomation().grantRuntimePermission(c.getPackageName(),android.Manifest.permission.POST_NOTIFICATIONS);
        c.getSharedPreferences("settings",0).edit().putBoolean("auto",false).commit();SoftwareUpdate.schedule(c,false);
        MainActivity activity=(MainActivity)instrumentation.startActivitySync(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        var field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);WebView web=(WebView)field.get(activity);
        long end=System.currentTimeMillis()+30000;
        while(!"true".equals(js(instrumentation,web,"typeof window.FgoFileExport?.postMessage==='function'"))&&System.currentTimeMillis()<end)Thread.sleep(100);
        assertEquals("true",js(instrumentation,web,"typeof window.FgoFileExport?.postMessage==='function'"));
        for(String extension:new String[]{"json","html","png","pdf","docx","jsonl"}){
            String name="FGO-teams-native-test-"+System.currentTimeMillis()+"."+extension;
            ContentValues values=new ContentValues();values.put(MediaStore.Downloads.DISPLAY_NAME,name);values.put(MediaStore.Downloads.MIME_TYPE,FileExport.mime(name));values.put(MediaStore.Downloads.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS);
            Uri uri=c.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);assertNotNull(uri);
            assertTrue("Picker Intent must match the monitor",pickerFilter().match(c.getContentResolver(),new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(FileExport.mime(name)),true,"FileExportTest")>=0);
            var monitor=instrumentation.addMonitor(pickerFilter(),new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(uri)),true);
            try{
                String call="window.fileSaveResult=null;import('"+LocalWeb.ROOT+"native/shared/file-save.js').then(m=>m.saveBlob(new Blob([Uint8Array.from({length:200001},(_,i)=>i*31%256)]),"+JSONObject.quote(name)+")).then(r=>window.fileSaveResult=r).catch(e=>window.fileSaveResult={error:e.message})";
                js(instrumentation,web,call);JSONObject value=result(instrumentation,web);assertTrue(value.toString(),value.optBoolean("saved"));assertEquals(1,monitor.getHits());
                try(var in=c.getContentResolver().openInputStream(uri)){assertNotNull(in);byte[] saved=in.readAllBytes(),expected=new byte[200001];for(int i=0;i<expected.length;i++)expected[i]=(byte)(i*31%256);assertArrayEquals(expected,saved);}
            }finally{instrumentation.removeMonitor(monitor);c.getContentResolver().delete(uri,null,null);}
        }
        var cancel=instrumentation.addMonitor(pickerFilter(),new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null),true);
        try{js(instrumentation,web,"window.fileSaveResult=null;import('"+LocalWeb.ROOT+"native/shared/file-save.js').then(m=>m.saveBlob(new Blob(['cancelled']),'FGO-teams-cancel.json')).then(r=>window.fileSaveResult=r).catch(e=>window.fileSaveResult={error:e.message})");JSONObject value=result(instrumentation,web);assertTrue(value.toString(),value.optBoolean("cancelled"));assertFalse(value.optBoolean("saved"));}
        finally{instrumentation.removeMonitor(cancel);instrumentation.runOnMainSync(activity::finish);}
    }
    @Test public void onlyExportBasenamesAndKnownFormatsAreAccepted(){
        for(String name:new String[]{"../account.json","/data/private.json","FGO-x.exe","FGO-x/evil.pdf"})try{FileExport.mime(name);fail(name);}catch(IllegalArgumentException expected){}
        assertEquals("application/pdf",FileExport.mime("FGO-teams-test.pdf"));
    }
}
