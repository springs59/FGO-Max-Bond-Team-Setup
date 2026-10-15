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
        SoftwareUpdate.schedule(c,false);
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
        instrumentation.runOnMainSync(()->view.evaluateJavascript("JSON.stringify((function(){var f=document.querySelector('#accountFile');document.addEventListener('change',function(e){if(e.target.id==='accountFile')window.selectedPhpName=e.target.files[0]?.name},true);var r=f.closest('label').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height}})())",bounds::set));
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
    @Test public void localQueryBackupExportsThroughNativeDocumentContract() throws Exception {
        var instrumentation=InstrumentationRegistry.getInstrumentation();
        Context c=instrumentation.getTargetContext();
        SoftwareUpdate.schedule(c,false);
        instrumentation.getUiAutomation().grantRuntimePermission(c.getPackageName(),Manifest.permission.POST_NOTIFICATIONS);
        c.getSharedPreferences("settings",0).edit().putBoolean("auto",false).commit();
        MainActivity activity=(MainActivity)instrumentation.startActivitySync(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        var field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);
        WebView view=(WebView)field.get(activity);
        ContentValues values=new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME,"FGO-query-test-"+System.currentTimeMillis()+".jsonl");
        values.put(MediaStore.Downloads.MIME_TYPE,"application/x-ndjson");
        values.put(MediaStore.Downloads.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS);
        var uri=c.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);
        assertNotNull(uri);
        IntentFilter documentFilter=new IntentFilter(Intent.ACTION_CREATE_DOCUMENT);
        documentFilter.addCategory(Intent.CATEGORY_OPENABLE);documentFilter.addDataType("*/*");
        var monitor=instrumentation.addMonitor(documentFilter,
            new android.app.Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(uri)),true);
        try {
            AtomicReference<String> ready=new AtomicReference<>("");long deadline=System.currentTimeMillis()+30000;
            while(System.currentTimeMillis()<deadline){instrumentation.runOnMainSync(()->view.evaluateJavascript("Boolean(document.querySelector('#queryLibraryOpen'))",ready::set));Thread.sleep(200);if("true".equals(ready.get()))break;}
            assertEquals("library entry missing","true",ready.get());
            String script="(async()=>{try{const q=await import('"+LocalWeb.ROOT+"src/solver/query-library.js');const d=await q.describeQuery('equipment',{nativeExportTest:1},'native-export-fixture');const saved=await q.saveQuery(d,{ok:true,nativeExportTest:true});if(!saved.saved)throw Error(saved.error);const t=await import('"+LocalWeb.ROOT+"src/worker-transport.js');const w=t.createBoundedWorker('"+LocalWeb.ROOT+"src/recommend-worker.js',{type:'module'});const computed=await new Promise((resolve,reject)=>{w.onmessage=({data})=>{if(data.type==='progress')return;data.ok?resolve(data.result.value):reject(Error(data.error))};w.onerror=e=>reject(Error(e.message));t.postWorkerMessage(w,{id:1,opts:{servants:Array.from({length:6},(_,i)=>({id:990001+i,collectionNo:990001+i,name:'journal-native-fixture',className:'saber',rarity:3,cost:1,traitIds:[]})),ces:[],base:1017,costLimit:20,useInventoryCurveSolver:true}}).catch(reject)});w.terminate();if(!computed.ok)throw Error('native computation failed');if(!computed.localResult?.hit){if(computed.localResult?.saved||!computed.localResult?.temporary)throw Error('native result bypassed the explicit save choice');const recovery=await import('"+LocalWeb.ROOT+"src/ui/query-recovery.js');const pending=await recovery.recoverArchivedCandidates();if(!pending.ok||!pending.entries.some(entry=>entry.name===computed.localResult.name))throw Error('native temporary journal unavailable');const saved=await recovery.recoverArchivedCandidates({action:'save',name:computed.localResult.name});if(!saved.ok||!saved.exact||!saved.records)throw Error(saved.error||'native explicit save failed');}const a=await q.exportQueryStream();if(!a.name.endsWith('.jsonl')||a.count!==(await q.listQueries()).length)throw Error('not a complete plain file');if(!FgoAndroid.beginQueryExport(a.name))throw Error('begin rejected');while(JSON.parse(FgoAndroid.queryExportStatus()).state==='choosing'||JSON.parse(FgoAndroid.queryExportStatus()).state==='saving')await new Promise(r=>setTimeout(r,100));if(JSON.parse(FgoAndroid.queryExportStatus()).state!=='ready')throw Error(FgoAndroid.queryExportStatus());const reader=a.stream.getReader();let chunks=0;while(true){const n=await reader.read();if(n.done)break;for(let i=0;i<n.value.length;i+=17){if(!FgoAndroid.appendQueryExport(btoa(String.fromCharCode(...n.value.subarray(i,i+17)))))throw Error('append rejected');chunks++}}if(!FgoAndroid.finishQueryExport(false))throw Error('finish rejected');window.queryBackupTest='saved chunks '+chunks}catch(e){window.queryBackupTest=String(e)}})()";
            instrumentation.runOnMainSync(()->view.evaluateJavascript(script,null));
            AtomicReference<String> status=new AtomicReference<>("");deadline=System.currentTimeMillis()+30000;
            while(System.currentTimeMillis()<deadline){instrumentation.runOnMainSync(()->view.evaluateJavascript("JSON.stringify({js:window.queryBackupTest,native:JSON.parse(FgoAndroid.queryExportStatus())})",status::set));Thread.sleep(200);if(!status.get().isEmpty()){String json=new org.json.JSONArray("["+status.get()+"]").getString(0);String phase=new org.json.JSONObject(json).getJSONObject("native").getString("state");if("done".equals(phase)||"error".equals(phase))break;}}
            assertEquals("document save contract was not requested: "+status.get(),1,monitor.getHits());
            String parsed=new org.json.JSONArray("["+status.get()+"]").getString(0);
            assertEquals(parsed,"done",new org.json.JSONObject(parsed).getJSONObject("native").getString("state"));
            try(InputStream raw=c.getContentResolver().openInputStream(uri)){
                String archive=new String(raw.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);
                assertTrue(archive,archive.contains("fgo-local-query-results"));
                assertTrue(archive,archive.contains("native-export-fixture"));
                assertTrue(archive,archive.contains("nativeExportTest"));
            }
        } finally {instrumentation.removeMonitor(monitor);c.getContentResolver().delete(uri,null,null);instrumentation.runOnMainSync(activity::finish);}
    }
    @Test public void backgroundCancellationPreservesPausedStatus() throws Exception {
        var instrumentation=InstrumentationRegistry.getInstrumentation();
        Context c=instrumentation.getTargetContext();
        SoftwareUpdate.schedule(c,false);DataWorker.pause(c);
        c.getSharedPreferences("settings",0).edit().putBoolean("auto",false).commit();
        MainActivity activity=(MainActivity)instrumentation.startActivitySync(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        try {
            var field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);
            WebView view=(WebView)field.get(activity);
            AtomicReference<String> ready=new AtomicReference<>("");long deadline=System.currentTimeMillis()+30000;
            while(System.currentTimeMillis()<deadline){instrumentation.runOnMainSync(()->view.evaluateJavascript("Boolean(document.querySelector('#queryLibraryOpen'))",ready::set));Thread.sleep(200);if("true".equals(ready.get()))break;}
            assertEquals("foreground app missing","true",ready.get());
            c.getSharedPreferences("task-test",0).edit().putString("state","awaiting-cancel-test").remove("report").commit();
            DataWorker.start(c,true,true);deadline=System.currentTimeMillis()+15000;
            while(System.currentTimeMillis()<deadline&&!"running".equals(c.getSharedPreferences("task-test",0).getString("state","")))Thread.sleep(100);
            assertEquals("background worker did not start","running",c.getSharedPreferences("task-test",0).getString("state",""));
            android.app.PendingIntent notificationPause=null;deadline=System.currentTimeMillis()+10000;
            var notifications=(android.app.NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
            while(System.currentTimeMillis()<deadline&&notificationPause==null){for(var item:notifications.getActiveNotifications()){var actions=item.getNotification().actions;if(item.getId()==41&&actions!=null&&actions.length>0)notificationPause=actions[0].actionIntent;}if(notificationPause==null)Thread.sleep(100);}
            assertNotNull("foreground notification pause action missing",notificationPause);notificationPause.send();deadline=System.currentTimeMillis()+10000;
            while(System.currentTimeMillis()<deadline&&!"paused".equals(c.getSharedPreferences("task-test",0).getString("state","")))Thread.sleep(100);
            assertEquals("paused",c.getSharedPreferences("task-test",0).getString("state",""));
            instrumentation.runOnMainSync(()->view.evaluateJavascript("FgoAndroid.command('{\"action\":\"start\",\"accountOnly\":true}')",null));
            Thread.sleep(700); // Automatic account sync must respect an explicit pause.
            assertEquals("cancellation was overwritten by error/completion","paused",c.getSharedPreferences("task-test",0).getString("state",""));
            assertTrue("automatic sync cleared the user pause",c.getSharedPreferences("task-control",0).getBoolean("paused",false));
            DataWorker.start(c,true,true);deadline=System.currentTimeMillis()+15000;
            while(System.currentTimeMillis()<deadline&&!"running".equals(c.getSharedPreferences("task-test",0).getString("state","")))Thread.sleep(100);
            assertEquals("explicit resume did not start work","running",c.getSharedPreferences("task-test",0).getString("state",""));
        } finally {DataWorker.pause(c);instrumentation.runOnMainSync(activity::finish);}
    }
    @Test public void rendererTerminationPreservesApplicationAndLocalResults() throws Exception {
        var instrumentation=InstrumentationRegistry.getInstrumentation();Context c=instrumentation.getTargetContext();
        SoftwareUpdate.schedule(c,false);DataWorker.pause(c);c.getSharedPreferences("settings",0).edit().putBoolean("auto",false).commit();
        instrumentation.getUiAutomation().grantRuntimePermission(c.getPackageName(),Manifest.permission.POST_NOTIFICATIONS);
        MainActivity activity=(MainActivity)instrumentation.startActivitySync(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        try {
            var field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);WebView view=(WebView)field.get(activity);
            AtomicReference<String> result=new AtomicReference<>("");long deadline=System.currentTimeMillis()+30000;
            while(System.currentTimeMillis()<deadline){instrumentation.runOnMainSync(()->view.evaluateJavascript("Boolean(document.querySelector('#queryLibraryOpen'))",result::set));Thread.sleep(200);if("true".equals(result.get()))break;}
            assertEquals("foreground view unavailable","true",result.get());
            String save="(async()=>{try{const q=await import('"+LocalWeb.ROOT+"src/solver/query-library.js');const d=await q.describeQuery('equipment',{rendererExitTest:1},'renderer recovery fixture');const saved=await q.saveQuery(d,{ok:true,marker:'preserved-after-renderer-exit'});window.rendererSavedTest=saved.saved}catch(e){window.rendererSavedTest=String(e)}})()";
            instrumentation.runOnMainSync(()->view.evaluateJavascript(save,null));deadline=System.currentTimeMillis()+30000;result.set("");
            while(System.currentTimeMillis()<deadline){instrumentation.runOnMainSync(()->view.evaluateJavascript("window.rendererSavedTest",result::set));Thread.sleep(200);if("true".equals(result.get()))break;}
            assertEquals("local fixture not saved","true",result.get());
            c.getSharedPreferences("task-test",0).edit().putString("state","awaiting-renderer-test").remove("report").commit();DataWorker.start(c,true,true);
            deadline=System.currentTimeMillis()+15000;
            while(System.currentTimeMillis()<deadline&&!"running".equals(c.getSharedPreferences("task-test",0).getString("state","")))Thread.sleep(100);
            assertEquals("background work missing","running",c.getSharedPreferences("task-test",0).getString("state",""));
            var terminated=new java.util.concurrent.atomic.AtomicBoolean(false);int pid=android.os.Process.myPid();
            instrumentation.runOnMainSync(()->{var process=view.getWebViewRenderProcess();if(process!=null)terminated.set(process.terminate());});
            assertTrue("renderer did not terminate",terminated.get());deadline=System.currentTimeMillis()+10000;
            var cleared=new java.util.concurrent.atomic.AtomicBoolean(false);
            while(System.currentTimeMillis()<deadline){instrumentation.runOnMainSync(()->{try{cleared.set(field.get(activity)==null);}catch(Exception e){throw new RuntimeException(e);}});if(cleared.get())break;Thread.sleep(100);}
            assertTrue("dead foreground view was not cleared",cleared.get());assertEquals("application process changed",pid,android.os.Process.myPid());
            deadline=System.currentTimeMillis()+150000;
            while(System.currentTimeMillis()<deadline){String state=c.getSharedPreferences("task-test",0).getString("state","");if("done".equals(state)||"error".equals(state))break;Thread.sleep(200);}
            assertEquals(c.getSharedPreferences("task-test",0).getString("report","missing report"),"done",c.getSharedPreferences("task-test",0).getString("state",""));
            var reopen=MainActivity.class.getDeclaredMethod("openBrowser");reopen.setAccessible(true);
            instrumentation.runOnMainSync(()->{try{reopen.invoke(activity);}catch(Exception e){throw new RuntimeException(e);}});
            WebView fresh=(WebView)field.get(activity);
            String read="(async()=>{try{const q=await import('"+LocalWeb.ROOT+"src/solver/query-library.js');const d=await q.describeQuery('equipment',{rendererExitTest:1},'renderer recovery fixture');window.rendererRestoredTest=(await q.readQuery(d))?.marker}catch(e){window.rendererRestoredTest=String(e)}})()";
            instrumentation.runOnMainSync(()->fresh.evaluateJavascript(read,null));deadline=System.currentTimeMillis()+30000;result.set("");
            while(System.currentTimeMillis()<deadline){instrumentation.runOnMainSync(()->fresh.evaluateJavascript("window.rendererRestoredTest",result::set));Thread.sleep(200);if(result.get().contains("preserved-after-renderer-exit"))break;}
            assertTrue("saved result did not survive renderer termination: "+result.get(),result.get().contains("preserved-after-renderer-exit"));
        } finally {DataWorker.pause(c);instrumentation.runOnMainSync(activity::finish);}
    }
    @Test public void packagedCatalogPrecomputesInBackground() throws Exception {
        var instrumentation=InstrumentationRegistry.getInstrumentation();
        Context c=instrumentation.getTargetContext();
        SoftwareUpdate.schedule(c,false);
        c.getSharedPreferences("settings",0).edit().putBoolean("auto",false).commit();
        MainActivity activity=(MainActivity)instrumentation.startActivitySync(new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        try {
        var field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);
        WebView view=(WebView)field.get(activity);
        AtomicReference<String> ready=new AtomicReference<>("");long startupDeadline=System.currentTimeMillis()+30000;
        while(System.currentTimeMillis()<startupDeadline){instrumentation.runOnMainSync(()->view.evaluateJavascript("Boolean(document.querySelector('#queryLibraryOpen'))",ready::set));Thread.sleep(200);if("true".equals(ready.get()))break;}
        assertEquals("foreground app must be ready before requesting foreground work","true",ready.get());
        // An earlier test/upgrade seed must not satisfy this fresh computation.
        c.getSharedPreferences("task-test",0).edit().putString("state","awaiting-test-run").remove("report").commit();
        DataWorker.start(c,true,true);
        long deadline=System.currentTimeMillis()+150000;
        String state="";
        while(System.currentTimeMillis()<deadline){state=c.getSharedPreferences("task-test",0).getString("state","");if("done".equals(state)||"error".equals(state))break;Thread.sleep(500);}
        assertEquals(c.getSharedPreferences("task-test",0).getString("report","No background callback; inspect WebView startup"),"done",state);
        String report=c.getSharedPreferences("task-test",0).getString("report","");
        assertTrue(report.contains("预计算完成"));
        } finally {instrumentation.runOnMainSync(activity::finish);}
    }
}
