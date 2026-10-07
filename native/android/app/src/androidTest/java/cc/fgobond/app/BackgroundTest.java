package cc.fgobond.app;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import android.content.*;
import android.webkit.WebView;
import android.app.Activity;
import android.Manifest;
import androidx.test.uiautomator.*;
import android.provider.MediaStore;
import android.os.Environment;
import java.io.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class BackgroundTest {
    @Test public void phpAccountCanBeSelectedAndParsedThroughSystemPicker() throws Exception {
        var instrumentation=InstrumentationRegistry.getInstrumentation();
        Context c=instrumentation.getTargetContext();
        instrumentation.getUiAutomation().grantRuntimePermission(c.getPackageName(),Manifest.permission.POST_NOTIFICATIONS);
        c.getSharedPreferences("settings",0).edit().putBoolean("auto",false).commit();
        MainActivity activity=(MainActivity)instrumentation.startActivitySync(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        var field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);
        WebView view=(WebView)field.get(activity);
        AtomicReference<String> ready=new AtomicReference<>("");
        long deadline=System.currentTimeMillis()+30000;
        while(System.currentTimeMillis()<deadline){instrumentation.runOnMainSync(()->view.evaluateJavascript("Boolean(document.body && document.querySelector('#app'))",ready::set));Thread.sleep(300);if("true".equals(ready.get()))break;}
        String filename="FGO-import-"+System.currentTimeMillis()+".php";
        ContentValues values=new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME,filename);
        values.put(MediaStore.Downloads.MIME_TYPE,"application/octet-stream");
        values.put(MediaStore.Downloads.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS);
        var uri=c.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);
        assertNotNull(uri);
        try(var stream=c.getContentResolver().openOutputStream(uri)){
            stream.write("<?php return array('cache'=>array('replaced'=>array('userSvtCollection'=>array(array('svtId'=>100100,'status'=>2,'friendshipRank'=>12)))));".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        try {
        instrumentation.runOnMainSync(()->view.evaluateJavascript("var f=document.createElement('input');f.type='file';f.style.cssText='position:fixed;top:100px;left:20px;width:200px;height:100px;z-index:99999';f.onchange=async function(){try{var m=await import('./src/account.js');var p=await m.parseAccountFile(new Uint8Array(await f.files[0].arrayBuffer()));window.phpImportResult=JSON.stringify({name:f.files[0].name,ok:p.ok,id:p.servants[0]?.id,bond:p.servants[0]?.bondLv})}catch(e){window.phpImportResult=String(e)}};document.body.append(f)",null));
        assertEquals("local application body did not load","true",ready.get());
        instrumentation.waitForIdleSync();Thread.sleep(1000);
        int[] point=new int[2];
        instrumentation.runOnMainSync(()->{view.requestFocus();view.getLocationOnScreen(point);point[0]+=(int)(60*view.getScale());point[1]+=(int)(140*view.getScale());});
        UiDevice device=UiDevice.getInstance(instrumentation);
        device.click(point[0],point[1]);
        var pending=MainActivity.class.getDeclaredField("selectedFiles");pending.setAccessible(true);
        deadline=System.currentTimeMillis()+10000;
        while(System.currentTimeMillis()<deadline&&pending.get(activity)==null)Thread.sleep(200);
        assertNotNull("system picker callback missing",pending.get(activity));
        UiObject2 item=device.wait(Until.findObject(By.text(filename)),15000);
        assertNotNull("PHP file is not shown in the actual system picker",item);
        assertTrue("PHP file is disabled in the system picker",item.isEnabled());
        item.click();
        AtomicReference<String> text=new AtomicReference<>("");deadline=System.currentTimeMillis()+10000;
        while(System.currentTimeMillis()<deadline){instrumentation.runOnMainSync(()->view.evaluateJavascript("window.phpImportResult",text::set));Thread.sleep(200);if(text.get().contains("100100"))break;}
        String parsed=new org.json.JSONArray("["+text.get()+"]").getString(0);
        var result=new org.json.JSONObject(parsed);
        assertEquals(filename,result.getString("name"));
        assertTrue(result.toString(),result.getBoolean("ok"));
        assertEquals(100100,result.getInt("id"));
        assertEquals(12,result.getInt("bond"));
        } finally {
        c.getContentResolver().delete(uri,null,null);
        instrumentation.runOnMainSync(activity::finish);
        }
    }
    @Test public void packagedCatalogPrecomputesInBackground() throws Exception {
        Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
        c.getSharedPreferences("settings",0).edit().putBoolean("auto",false).commit();
        c.startActivity(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        DataWorker.start(c,true,true);
        long deadline=System.currentTimeMillis()+150000;
        String state="";
        while(System.currentTimeMillis()<deadline){state=c.getSharedPreferences("task-test",0).getString("state","");if("done".equals(state)||"error".equals(state))break;Thread.sleep(500);}
        assertEquals(c.getSharedPreferences("task-test",0).getString("report","No background callback; inspect WebView startup"),"done",state);
        String report=c.getSharedPreferences("task-test",0).getString("report","");
        assertTrue(report.contains("预计算完成"));
    }
}
