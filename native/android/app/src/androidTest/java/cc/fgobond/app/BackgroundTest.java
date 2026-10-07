package cc.fgobond.app;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import android.content.*;
import android.webkit.WebView;
import android.app.Activity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.os.SystemClock;
import android.Manifest;
import androidx.core.content.FileProvider;
import java.io.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class BackgroundTest {
    @Test public void chosenAccountFileCanBeReadLocally() throws Exception {
        var instrumentation=InstrumentationRegistry.getInstrumentation();
        Context c=instrumentation.getTargetContext();
        instrumentation.getUiAutomation().grantRuntimePermission(c.getPackageName(),Manifest.permission.POST_NOTIFICATIONS);
        c.getSharedPreferences("settings",0).edit().putBoolean("auto",false).commit();
        MainActivity activity=(MainActivity)instrumentation.startActivitySync(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        var field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);
        WebView view=(WebView)field.get(activity);
        AtomicReference<String> ready=new AtomicReference<>("");
        long deadline=System.currentTimeMillis()+30000;
        while(System.currentTimeMillis()<deadline){instrumentation.runOnMainSync(()->view.evaluateJavascript("document.readyState",ready::set));Thread.sleep(300);if("\"complete\"".equals(ready.get()))break;}
        instrumentation.runOnMainSync(()->view.evaluateJavascript("var f=document.createElement('input');f.type='file';f.style.cssText='position:fixed;top:0;left:0;width:200px;height:100px;z-index:99999';f.onchange=function(){var r=new FileReader();r.onload=function(){window.chosenFileText=r.result};r.readAsText(f.files[0])};document.body.append(f)",null));
        Thread.sleep(500);
        instrumentation.runOnMainSync(()->{long t=SystemClock.uptimeMillis();view.dispatchTouchEvent(MotionEvent.obtain(t,t,MotionEvent.ACTION_DOWN,50,50,0));view.dispatchTouchEvent(MotionEvent.obtain(t,t+80,MotionEvent.ACTION_UP,50,50,0));});
        var pending=MainActivity.class.getDeclaredField("selectedFiles");pending.setAccessible(true);
        deadline=System.currentTimeMillis()+10000;
        while(System.currentTimeMillis()<deadline&&pending.get(activity)==null)Thread.sleep(200);
        assertNotNull("system picker callback missing",pending.get(activity));
        File source=new File(c.getCacheDir(),"account-test.json");try(FileWriter writer=new FileWriter(source)){writer.write("account-file-local-test");}
        var uri=FileProvider.getUriForFile(c,"cc.fgobond.app.testfiles",source);
        instrumentation.runOnMainSync(()->activity.onActivityResult(30,Activity.RESULT_OK,new Intent().setData(uri)));
        AtomicReference<String> text=new AtomicReference<>("");deadline=System.currentTimeMillis()+10000;
        while(System.currentTimeMillis()<deadline){instrumentation.runOnMainSync(()->view.evaluateJavascript("window.chosenFileText",text::set));Thread.sleep(200);if("\"account-file-local-test\"".equals(text.get()))break;}
        assertEquals("\"account-file-local-test\"",text.get());
        instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
        instrumentation.runOnMainSync(activity::finish);
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
