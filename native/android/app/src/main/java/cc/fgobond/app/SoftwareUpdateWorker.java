package cc.fgobond.app;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.work.*;
import org.json.*;
import java.io.*;
import java.net.HttpURLConnection;
import java.util.concurrent.TimeUnit;

public final class SoftwareUpdateWorker extends Worker {
    public SoftwareUpdateWorker(@NonNull Context c,@NonNull WorkerParameters p){super(c,p);}
    private ForegroundInfo foreground(long done,long total){
        Context c=getApplicationContext();NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);String channel="fgo-software";
        nm.createNotificationChannel(new NotificationChannel(channel,"软件版本更新",NotificationManager.IMPORTANCE_LOW));
        PendingIntent open=PendingIntent.getActivity(c,43,new Intent(c,MainActivity.class).putExtra("tasks",true),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification n=new Notification.Builder(c,channel).setContentTitle("通关羁绊 · 软件更新").setContentText("正在下载新版本").setSmallIcon(android.R.drawable.stat_sys_download).setOngoing(true).setContentIntent(open).setProgress(100,total>0?(int)(done*100/total):0,total==0).addAction(new Notification.Action.Builder(null,"暂停",WorkManager.getInstance(c).createCancelPendingIntent(getId())).build()).build();
        return Build.VERSION.SDK_INT>=29?new ForegroundInfo(43,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC):new ForegroundInfo(43,n);
    }
    @NonNull @Override public Result doWork(){
        synchronized(SoftwareUpdateWorker.class){
            Context c=getApplicationContext();if(isStopped())return Result.failure();
            try{
                if("download".equals(getInputData().getString("action")))download(c);else check(c);
                return Result.success();
            }catch(Exception e){SoftwareUpdate.state(c,isStopped()?"paused":"error",isStopped()?"":e.getMessage(),SoftwareUpdate.status(c).optLong("done"),SoftwareUpdate.status(c).optLong("total"));return Result.failure();}
        }
    }
    private void check(Context c)throws Exception{
        JSONObject old=SoftwareUpdate.status(c);
        if("ready".equals(old.optString("state"))||"permission".equals(old.optString("state"))){
            try{JSONObject m=SoftwareUpdate.candidate(c);if(SoftwareUpdate.compare(m.getString("version"),SoftwareUpdate.installed(c).versionName)>0){SoftwareUpdate.verify(c,m,SoftwareUpdate.file(c,m));return;}}catch(Exception ignored){}
        }
        SoftwareUpdate.state(c,"checking","",0,0);HttpURLConnection r=SoftwareUpdate.open(SoftwareUpdate.FEED,0);String text;
        try(InputStream in=r.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){if(out.size()+n>65536)throw new IOException("发布信息过大");out.write(buffer,0,n);}text=out.toString("UTF-8");
        }finally{r.disconnect();}
        JSONObject m=SoftwareUpdate.validate(new JSONObject(text));
        String previous="";try{previous=SoftwareUpdate.candidate(c).getString("version");}catch(Exception ignored){}
        if(!previous.equals(m.getString("version")))SoftwareUpdate.cleanup(c);
        SoftwareUpdate.found(c,m);
        if(SoftwareUpdate.compare(m.getString("version"),SoftwareUpdate.installed(c).versionName)<=0||m.getLong("androidCode")<=SoftwareUpdate.code(SoftwareUpdate.installed(c))){SoftwareUpdate.cleanup(c);SoftwareUpdate.state(c,"current","",0,0);return;}
        try{SoftwareUpdate.verify(c,m,SoftwareUpdate.file(c,m));SoftwareUpdate.state(c,"ready","",SoftwareUpdate.asset(m).getLong("size"),SoftwareUpdate.asset(m).getLong("size"));}
        catch(Exception ignored){SoftwareUpdate.state(c,"available","",0,SoftwareUpdate.asset(m).getLong("size"));}
    }
    private void download(Context c)throws Exception{
        JSONObject m=SoftwareUpdate.candidate(c),a=SoftwareUpdate.asset(m);File target=SoftwareUpdate.file(c,m),partial=new File(target.getAbsolutePath()+".part");long total=a.getLong("size");
        if(SoftwareUpdate.compare(m.getString("version"),SoftwareUpdate.installed(c).versionName)<=0)throw new IOException("已安装此版本或更新版本");
        try{SoftwareUpdate.verify(c,m,target);SoftwareUpdate.state(c,"ready","",total,total);return;}catch(Exception ignored){}
        long done=partial.length();if(done>total){partial.delete();done=0;}
        SoftwareUpdate.state(c,"downloading","",done,total);setForegroundAsync(foreground(done,total)).get(20,TimeUnit.SECONDS);
        if(done<total){
            HttpURLConnection r=SoftwareUpdate.open(a.getString("url"),done);
            try{
                if(r.getResponseCode()==206){String range=r.getHeaderField("Content-Range");if(range==null||!range.startsWith("bytes "+done+"-")||!range.endsWith("/"+total))throw new IOException("下载续传范围无效");}else done=0;
                try(InputStream in=r.getInputStream();FileOutputStream out=new FileOutputStream(partial,done>0)){
                    byte[] buffer=new byte[65536];int n;long last=0;while((n=in.read(buffer))!=-1){if(isStopped())throw new IOException("已暂停");done+=n;if(done>total)throw new IOException("安装包大小不匹配");out.write(buffer,0,n);if(System.currentTimeMillis()-last>1000){last=System.currentTimeMillis();SoftwareUpdate.state(c,"downloading","",done,total);setForegroundAsync(foreground(done,total));}}out.getFD().sync();
                }
            }finally{r.disconnect();}
        }
        if(isStopped())throw new IOException("已暂停");SoftwareUpdate.state(c,"verifying","",done,total);
        try{SoftwareUpdate.verify(c,m,partial);}catch(Exception e){partial.delete();throw e;}
        if(!partial.renameTo(target))throw new IOException("无法保存安装包");SoftwareUpdate.state(c,"ready","",total,total);
    }
    @Override public void onStopped(){Context c=getApplicationContext();JSONObject s=SoftwareUpdate.status(c);SoftwareUpdate.state(c,"paused","",s.optLong("done"),s.optLong("total"));}
}
