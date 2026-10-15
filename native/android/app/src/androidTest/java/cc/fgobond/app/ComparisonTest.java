package cc.fgobond.app;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import android.content.*;
import android.webkit.WebView;
import org.junit.*;
import org.junit.runner.RunWith;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class ComparisonTest {
    private String evaluate(WebView web,String script) throws Exception {
        var instrumentation=InstrumentationRegistry.getInstrumentation();var value=new AtomicReference<String>();
        instrumentation.runOnMainSync(()->web.evaluateJavascript(script,value::set));
        long end=System.currentTimeMillis()+10000;while(value.get()==null&&System.currentTimeMillis()<end)Thread.sleep(50);
        assertNotNull("JavaScript callback did not arrive",value.get());return value.get();
    }
    @Test public void threeOriginsRenderSolveReuseAndExportRecords() throws Exception {
        var instrumentation=InstrumentationRegistry.getInstrumentation();Context context=instrumentation.getTargetContext();
        assertEquals("cc.fgobond.compare",context.getPackageName());
        int total=-1;
        for(String version:new String[]{"200","208","209"}){
            MainActivity activity=(MainActivity)instrumentation.startActivitySync(new Intent(context,MainActivity.class).putExtra("compareVersion",version).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            var field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);WebView web=(WebView)field.get(activity);
            try{
                long end=System.currentTimeMillis()+60000;String ready="";
                while(System.currentTimeMillis()<end){ready=evaluate(web,"Boolean(document.querySelector('#accountFile')&&window.fgoBenchmarkStart)");if("true".equals(ready))break;Thread.sleep(250);}
                assertEquals("UI did not load for "+version,"true",ready);
                assertEquals("\"v"+version+".appassets.androidplatform.net\"",evaluate(web,"location.hostname"));
                assertEquals("null",evaluate(web,"localStorage.getItem('comparison-isolation')"));
                evaluate(web,"localStorage.setItem('comparison-isolation','"+version+"')");
                String test="(async()=>{try{const version='"+version+"';"
                  +"const {isPlayableServant,ceHasBondGain}=await import('./src/game-data.js');"
                  +"const [s,c]=await Promise.all(['servants','ces'].map(async n=>(await fetch('./src/data/'+n+'.json')).json()));"
                  +"const opts={servants:s.filter(isPlayableServant).slice(0,30),ces:c.filter(ceHasBondGain).slice(0,36),base:800,costLimit:95,mode:'free',useInventoryCurveSolver:true};"
                  +"const transport=version==='200'?null:await import('./src/worker-transport.js');"
                  +"const w=transport?transport.createBoundedWorker(new URL('./src/recommend-worker.js',location.href),{type:'module'}):new Worker(new URL('./src/recommend-worker.js',location.href),{type:'module'});"
                  +"const sender=version==='209'?(await import('./src/worker-catalog.js')).postRecommendRequest:transport?.postWorkerMessage;"
                  +"const query=id=>new Promise((resolve,reject)=>{w.onmessage=({data})=>{if(data.id!==id||data.type==='progress')return;if(!data.ok)reject(Error(data.error));else resolve(data.result.value)};w.onerror=e=>reject(Error(e.message));const msg={id,opts};if(sender)sender(w,msg).catch(reject);else w.postMessage(msg)});"
                  +"const first=await query(1);if(!first.ok)throw Error(first.error||'no first result');"
                  +"if(version!=='200'){const {recoverArchivedCandidates}=await import('./src/ui/query-recovery.js');const saved=await recoverArchivedCandidates({action:'save',name:first.localResult.name});if(!saved.ok||!saved.exact)throw Error('manual save failed: '+JSON.stringify(saved))}"
                  +"const repeat=await query(2);if(!repeat.ok||repeat.total!==first.total)throw Error('result parity');if(!(repeat.localResult?.hit||repeat.queryStats?.cacheHit))throw Error('repeat missed cache');"
                  +"w.terminate();window.__comparisonTest={ok:true,total:first.total,records:JSON.parse(localStorage.getItem('comparison-records')||'[]').length};"
                  +"}catch(e){window.__comparisonTest={ok:false,error:String(e.stack||e)}}})()";
                evaluate(web,test);String result="null";end=System.currentTimeMillis()+120000;
                while(System.currentTimeMillis()<end){result=evaluate(web,"window.__comparisonTest||null");if(!"null".equals(result))break;Thread.sleep(250);}
                assertNotEquals("test timeout for "+version,"null",result);
                var parsed=new org.json.JSONObject(result);assertTrue(version+": "+result,parsed.getBoolean("ok"));assertEquals(2,parsed.getInt("records"));
                if(total==-1)total=parsed.getInt("total");else assertEquals("version score differs",total,parsed.getInt("total"));
            }finally{instrumentation.runOnMainSync(activity::finish);}
        }
        org.json.JSONObject report=ComparisonStore.report(context,"instrumentation");
        assertEquals(6,report.getJSONArray("records").length());
        assertFalse(report.toString().contains("rawServants"));
        MainActivity reopened=(MainActivity)instrumentation.startActivitySync(new Intent(context,MainActivity.class).putExtra("compareVersion","200").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        try{
            var field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);WebView web=(WebView)field.get(reopened);
            long end=System.currentTimeMillis()+30000;String stored="null";
            while(System.currentTimeMillis()<end){stored=evaluate(web,"localStorage.getItem('comparison-isolation')");if("\"200\"".equals(stored))break;Thread.sleep(200);}
            assertEquals("version storage did not persist","\"200\"",stored);
        }finally{instrumentation.runOnMainSync(reopened::finish);}
    }
}
