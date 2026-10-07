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
    private final Handler ui=new Handler(Looper.getMainLooper());
    private final CountDownLatch finished=new CountDownLatch(1);
    private volatile boolean success=false;
    private WebView web;
    private long lastNotification=0;
    public DataWorker(@NonNull Context context,@NonNull WorkerParameters parameters){super(context,parameters);}
    public static void start(Context c,boolean force,boolean offline){
        WorkManager.getInstance(c).enqueueUniqueWork(MANUAL,ExistingWorkPolicy.KEEP,new OneTimeWorkRequest.Builder(DataWorker.class).setInputData(new Data.Builder().putBoolean("force",force).putBoolean("offline",offline).build()).build());
    }
    public static void pause(Context c){WorkManager w=WorkManager.getInstance(c);w.cancelUniqueWork(MANUAL);w.cancelUniqueWork(PERIODIC);}
    public static void schedule(Context c,boolean enabled){
        WorkManager w=WorkManager.getInstance(c);
        if(enabled)w.enqueueUniquePeriodicWork(PERIODIC,ExistingPeriodicWorkPolicy.KEEP,new PeriodicWorkRequest.Builder(DataWorker.class,6,TimeUnit.HOURS).setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).setRequiresBatteryNotLow(true).build()).build());
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
            if(isStopped())return Result.failure();
            try{
                setForegroundAsync(foreground("准备更新和本地预计算",0,0)).get(20,TimeUnit.SECONDS);
                getApplicationContext().getSharedPreferences("task-test",0).edit().putString("state","running").apply();
                ui.post(()->{
                    if(isStopped()){finished.countDown();return;}
                    web=new WebView(getApplicationContext());LocalWeb.setup(web,getApplicationContext());web.addJavascriptInterface(new TaskBridge(),"FgoAndroid");
                    web.setWebChromeClient(new WebChromeClient(){@Override public boolean onConsoleMessage(ConsoleMessage m){android.util.Log.d("FGOBond",m.message());return true;}});
                    String url=LocalWeb.ROOT+"native/host.html"+(getInputData().getBoolean("offline",false)?"#offline":"");
                    web.loadUrl(url);
                });
                boolean ended=finished.await(30,TimeUnit.MINUTES);
                if(!ended)saveSystemStatus("error","后台任务超时，保留已完成步骤，请继续重试");
                return ended&&success?Result.success():Result.failure();
            }catch(Exception e){saveSystemStatus("error","系统未能完成后台任务："+e.getClass().getSimpleName());android.util.Log.e("FGOBond","Background task failed",e);return Result.failure();}
            finally{ui.post(()->{if(web!=null){web.removeJavascriptInterface("FgoAndroid");web.destroy();web=null;}});}
        }
    }
    private final class TaskBridge {
        @JavascriptInterface public String options(){return "{\"offline\":"+getInputData().getBoolean("offline",false)+",\"force\":"+getInputData().getBoolean("force",false)+"}";}
        @JavascriptInterface public void report(String text){
            try{
                JSONObject s=new JSONObject(text);String state=s.optString("state");
                getApplicationContext().getSharedPreferences("task-test",0).edit().putString("state",state).putString("report",text).apply();
                if(System.currentTimeMillis()-lastNotification>1000){lastNotification=System.currentTimeMillis();setForegroundAsync(foreground(s.optString("phase"),s.optInt("done"),s.optInt("total")));}
                if("done".equals(state)||"error".equals(state)||"paused".equals(state)){success="done".equals(state);finished.countDown();}
            }catch(Exception ignored){}
        }
    }
    private void saveSystemStatus(String state,String phase){
        try{JSONObject report=new JSONObject();report.put("state",state);report.put("phase",phase);report.put("updatedAt",System.currentTimeMillis());getApplicationContext().getSharedPreferences("task-test",0).edit().putString("state",state).putString("report",report.toString()).apply();}catch(Exception ignored){}
    }
    @Override public void onStopped(){
        saveSystemStatus("paused","系统中断或用户暂停，已完成步骤可继续");
        ui.post(()->{if(web!=null)web.evaluateJavascript("window.nativeTaskCommand && window.nativeTaskCommand({action:'pause'})",null);});
        ui.postDelayed(finished::countDown,400);
    }
}
