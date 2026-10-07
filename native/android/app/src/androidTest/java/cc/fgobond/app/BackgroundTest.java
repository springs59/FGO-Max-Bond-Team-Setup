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
        while(System.currentTimeMillis()<deadline){instrumentation.runOnMainSync(()->view.evaluateJavascript("Boolean(document.querySelector('#accountFile'))",ready::set));Thread.sleep(300);if("true".equals(ready.get()))break;}
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
        assertEquals("local application body did not load","true",ready.get());
        instrumentation.runOnMainSync(()->view.evaluateJavascript("localStorage.removeItem('fgo_bond_account_v1');localStorage.removeItem('fgo_bond_account_v1:CN');document.querySelector('#accountFile').closest('label').scrollIntoView({block:'center'})",null));
        instrumentation.waitForIdleSync();Thread.sleep(500);
        AtomicReference<String> bounds=new AtomicReference<>("");
        instrumentation.runOnMainSync(()->view.evaluateJavascript("JSON.stringify((function(){var f=document.querySelector('#accountFile');f.addEventListener('change',function(){window.selectedPhpName=f.files[0]?.name});var r=f.closest('label').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height}})())",bounds::set));
        deadline=System.currentTimeMillis()+5000;
        while(bounds.get().isEmpty()&&System.currentTimeMillis()<deadline)Thread.sleep(50);
        String rawBounds=new org.json.JSONArray("["+bounds.get()+"]").getString(0);
        var rect=new org.json.JSONObject(rawBounds);
        assertTrue("Import input has no visible bounds: "+rect,rect.getDouble("width")>0&&rect.getDouble("height")>0);
        int[] point=new int[2];
        instrumentation.runOnMainSync(()->{view.requestFocus();view.getLocationOnScreen(point);point[0]+=(int)(rect.optDouble("x")*view.getScale());point[1]+=(int)(rect.optDouble("y")*view.getScale());});
        UiDevice device=UiDevice.getInstance(instrumentation);
        assertTrue("Could not click actual import input: "+rect,device.click(point[0],point[1]));
        var pending=MainActivity.class.getDeclaredField("selectedFiles");pending.setAccessible(true);
        deadline=System.currentTimeMillis()+10000;
        while(System.currentTimeMillis()<deadline&&pending.get(activity)==null)Thread.sleep(200);
        assertNotNull("system picker callback missing; input bounds="+rect+"; pixels="+point[0]+","+point[1],pending.get(activity));
        UiObject2 item=device.wait(Until.findObject(By.text(filename)),15000);
        assertNotNull("PHP file is not shown in the actual system picker",item);
        assertTrue("PHP file is disabled in the system picker",item.isEnabled());
        item.click();
        AtomicReference<String> text=new AtomicReference<>("");deadline=System.currentTimeMillis()+10000;
        while(System.currentTimeMillis()<deadline){instrumentation.runOnMainSync(()->view.evaluateJavascript("JSON.stringify({name:window.selectedPhpName,account:JSON.parse(localStorage.getItem(\"fgo_bond_account_v1\")),page:document.querySelector(\".case\")?.innerText})",text::set));Thread.sleep(200);if(text.get().contains("100100"))break;}
        String parsed=new org.json.JSONArray("["+text.get()+"]").getString(0);
        var result=new org.json.JSONObject(parsed);
        assertEquals(filename,result.getString("name"));
        assertFalse("Actual import failed: "+result,result.isNull("account"));
        var account=result.getJSONObject("account").getJSONObject("account");
        assertTrue(account.toString(),account.getBoolean("ok"));
        var servant=account.getJSONArray("servants").getJSONObject(0);
        assertEquals(100100,servant.getInt("id"));
        assertEquals(12,servant.getInt("bondLv"));
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
