package cc.fgobond.app;
import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;
import android.webkit.*;
import androidx.annotation.NonNull;
import androidx.work.*;
import org.json.*;
import java.util.concurrent.*;
public final class DataWorker extends Worker {
    private static final String MANUAL="fgo-data-manual", PERIODIC="fgo-data-periodic", CHANNEL="fgo-data";
    private static final Object CONTROL_LOCK=new Object();
    private final Handler ui=new Handler(Looper.getMainLooper());
    private final CountDownLatch finished=new CountDownLatch(1);
    private volatile boolean success=false;
    private WebView web;
    private long lastNotification=0;
    private long controlGeneration=-1;
    private boolean live=false;
    public DataWorker(@NonNull Context context,@NonNull WorkerParameters parameters){super(context,parameters);}
    public static void start(Context c,boolean force,boolean offline){
        long generation;
        synchronized(CONTROL_LOCK){var p=c.getSharedPreferences("task-control",0);generation=p.getLong("generation",0);p.edit().putBoolean("paused",false).commit();}
        WorkManager.getInstance(c).enqueueUniqueWork(MANUAL,ExistingWorkPolicy.KEEP,new OneTimeWorkRequest.Builder(DataWorker.class).setInputData(new Data.Builder().putBoolean("force",force).putBoolean("offline",offline).putLong("generation",generation).build()).build());
    }
    public static void pause(Context c){
        synchronized(CONTROL_LOCK){var p=c.getSharedPreferences("task-control",0);p.edit().putLong("generation",p.getLong("generation",0)+1).putBoolean("paused",true).commit();writeSystemStatus(c,"paused","系统中断或用户暂停，已完成步骤可继续");}
        WorkManager w=WorkManager.getInstance(c);w.cancelUniqueWork(MANUAL);w.cancelUniqueWork(PERIODIC);
    }
    public static void schedule(Context c,boolean enabled){
        WorkManager w=WorkManager.getInstance(c);
        if(enabled){synchronized(CONTROL_LOCK){c.getSharedPreferences("task-control",0).edit().putBoolean("paused",false).commit();}w.enqueueUniquePeriodicWork(PERIODIC,ExistingPeriodicWorkPolicy.KEEP,new PeriodicWorkRequest.Builder(DataWorker.class,6,TimeUnit.HOURS).setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).setRequiresBatteryNotLow(true).build()).build());}
        else w.cancelUniqueWork(PERIODIC);
    }
    private ForegroundInfo foreground(String text,int done,int total){
        Context c=getApplicationContext();NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL,"数据更新与预计算",NotificationManager.IMPORTANCE_LOW));
        PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class).putExtra("tasks",true),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification n=new Notification.Builder(c,CHANNEL).setContentTitle("通关羁绊 · 后台任务").setContentText(text).setSmallIcon(android.R.drawable.stat_sys_download).setContentIntent(open).setOngoing(true).setProgress(Math.max(total,1),done,total==0).addAction(new Notification.Action.Builder(null,"暂停",WorkManager.getInstance(c).createCancelPendingIntent(getId())).build()).build();
        return Build.VERSION.SDK_INT>=29?new ForegroundInfo(41,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC):new ForegroundInfo(41,n);
    }
    @NonNull @Override public Result doWork(){
        // Periodic and manually requested jobs share one IndexedDB generation.
        synchronized(DataWorker.class){
            synchronized(CONTROL_LOCK){var p=getApplicationContext().getSharedPreferences("task-control",0);controlGeneration=getInputData().getLong("generation",p.getLong("generation",0));if(isStopped()||p.getBoolean("paused",false)||controlGeneration!=p.getLong("generation",0))return Result.failure();live=true;}
            try{
                setForegroundAsync(foreground("准备更新和本地预计算",0,0)).get(20,TimeUnit.SECONDS);
                synchronized(CONTROL_LOCK){if(!active()){saveSystemStatus("paused","系统中断或用户暂停，已完成步骤可继续");return Result.failure();}getApplicationContext().getSharedPreferences("task-test",0).edit().putString("state","running").apply();}
                ui.post(()->{
                    if(!active()){finished.countDown();return;}
                    web=new WebView(getApplicationContext());LocalWeb.setup(web,getApplicationContext());web.addJavascriptInterface(new TaskBridge(),"FgoAndroid");
                    web.setWebChromeClient(new WebChromeClient(){@Override public boolean onConsoleMessage(ConsoleMessage m){android.util.Log.d("FGOBond",m.message());return true;}});
                    String url=LocalWeb.ROOT+"native/host.html"+(getInputData().getBoolean("offline",false)?"#offline":"");
                    web.loadUrl(url);
                });
                // Large local precomputations can legitimately run for hours.
                // Completion and explicit/system cancellation release this latch.
                finished.await();
                return success?Result.success():Result.failure();
            }catch(Exception e){if(!active()){saveSystemStatus("paused","系统中断或用户暂停，已完成步骤可继续");return Result.failure();}saveSystemStatus("error","系统未能完成后台任务："+e.getClass().getSimpleName());android.util.Log.e("FGOBond","Background task failed",e);return Result.failure();}
            finally{synchronized(CONTROL_LOCK){live=false;}ui.post(()->{if(web!=null){web.removeJavascriptInterface("FgoAndroid");web.destroy();web=null;}});}
        }
    }
    private final class TaskBridge {
        @JavascriptInterface public String options(){return "{\"offline\":"+getInputData().getBoolean("offline",false)+",\"force\":"+getInputData().getBoolean("force",false)+"}";}
        @JavascriptInterface public void report(String text){
            synchronized(CONTROL_LOCK){if(!active())return;
            try{
                JSONObject s=new JSONObject(text);String state=s.optString("state");
                getApplicationContext().getSharedPreferences("task-test",0).edit().putString("state",state).putString("report",text).apply();
                if(System.currentTimeMillis()-lastNotification>1000){lastNotification=System.currentTimeMillis();setForegroundAsync(foreground(s.optString("phase"),s.optInt("done"),s.optInt("total")));}
                if("done".equals(state)||"error".equals(state)||"paused".equals(state)){success="done".equals(state);finished.countDown();}
            }catch(Exception ignored){}}
        }
    }
    private void saveSystemStatus(String state,String phase){
        synchronized(CONTROL_LOCK){if(currentControl())writeSystemStatus(getApplicationContext(),state,phase);}
    }
    private boolean currentControl(){var p=getApplicationContext().getSharedPreferences("task-control",0);return live&&!p.getBoolean("paused",false)&&controlGeneration==p.getLong("generation",0);}
    private boolean active(){synchronized(CONTROL_LOCK){return currentControl()&&!isStopped();}}
    private static void writeSystemStatus(Context c,String state,String phase){try{JSONObject report=new JSONObject();report.put("state",state);report.put("phase",phase);report.put("updatedAt",System.currentTimeMillis());c.getSharedPreferences("task-test",0).edit().putString("state",state).putString("report",report.toString()).commit();}catch(Exception ignored){}}
    @Override public void onStopped(){
        saveSystemStatus("paused","系统中断或用户暂停，已完成步骤可继续");
        ui.post(()->{if(web!=null)web.evaluateJavascript("window.nativeTaskCommand && window.nativeTaskCommand({action:'pause'})",null);});
        ui.postDelayed(finished::countDown,400);
    }
}
