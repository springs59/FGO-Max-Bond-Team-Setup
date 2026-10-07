package cc.fgobond.app;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import android.content.*;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class BackgroundTest {
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
