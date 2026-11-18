package cc.fgobond.app;

import android.app.Activity;
import android.content.*;
import android.content.pm.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import androidx.work.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;

/** Native-only updater: WebView supplies an action, never a URL or file path. */
public final class SoftwareUpdate {
    static final String REPO="https://github.com/springs59/FGO-Max-Bond-Team-Setup";
    static final String FEED=REPO+"/releases/latest/download/native-update.json";
    static final String MANUAL="fgo-software-manual", PERIODIC="fgo-software-periodic";
    private static final ExecutorService INSTALL=Executors.newSingleThreadExecutor();
    private static SharedPreferences prefs(Context c){return c.getSharedPreferences("software-update",0);}
    static File dir(Context c){File d=new File(c.getFilesDir(),"software-updates");d.mkdirs();return d;}
    static PackageInfo installed(Context c)throws Exception{return c.getPackageManager().getPackageInfo(c.getPackageName(),PackageManager.GET_SIGNATURES);}
    static long code(PackageInfo p){return Build.VERSION.SDK_INT>=28?p.getLongVersionCode():p.versionCode;}
    static int compare(String a,String b)throws Exception{
        if(!a.matches("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)")||!b.matches("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)"))throw new IOException("软件版本无效");
        String[] x=a.split("\\."),y=b.split("\\.");for(int i=0;i<3;i++){int result=Long.compare(Long.parseLong(x[i]),Long.parseLong(y[i]));if(result!=0)return result;}return 0;
    }
    static JSONObject validate(JSONObject m)throws Exception{
        String v=m.getString("version"),tag="native-v"+v;compare(v,v);
        if(m.getInt("format")!=1||m.getBoolean("prerelease")||!tag.equals(m.getString("tag"))||!(REPO+"/releases/tag/"+tag).equals(m.getString("releaseUrl")))throw new IOException("发布来源无效");
        long versionCode=m.getLong("androidCode");if(versionCode<1||versionCode>2100000000L)throw new IOException("安卓版本序号无效");
        for(String p:new String[]{"windows","android"}){
            JSONObject a=m.getJSONObject("assets").getJSONObject(p);String name="FGO-Bond-"+(p.equals("android")?"Android":"Windows")+"-"+v+(p.equals("android")?".apk":".exe");
            if(!name.equals(a.getString("name"))||!(REPO+"/releases/download/"+tag+"/"+name).equals(a.getString("url"))||!a.getString("sha256").matches("[a-f0-9]{64}")||a.getLong("size")<1||a.getLong("size")>1073741824L)throw new IOException("安装包信息或校验值无效");
        }
        return m;
    }
    static JSONObject candidate(Context c)throws Exception{return validate(new JSONObject(prefs(c).getString("candidate","{}")));}
    static JSONObject asset(JSONObject m)throws Exception{return m.getJSONObject("assets").getJSONObject("android");}
    static File file(Context c,JSONObject m)throws Exception{return new File(dir(c),asset(m).getString("name"));}
    public static JSONObject status(Context c){
        try{JSONObject s=new JSONObject(prefs(c).getString("status","{}"));s.put("currentVersion",installed(c).versionName);s.put("auto",prefs(c).getBoolean("auto",true));s.put("supported",true);if(!s.has("state"))s.put("state","idle");return s;}catch(Exception e){return new JSONObject();}
    }
    static synchronized void state(Context c,String state,String error,long done,long total){
        try{JSONObject s=status(c);s.put("state",state);s.put("error",error);s.put("done",done);s.put("total",total);prefs(c).edit().putString("status",s.toString()).commit();}catch(Exception ignored){}
    }
    static void found(Context c,JSONObject m)throws Exception{
        JSONObject s=status(c);s.put("latestVersion",m.getString("version"));s.put("notes",m.optString("notes","").substring(0,Math.min(12000,m.optString("notes","").length())));s.put("checkedAt",System.currentTimeMillis());
        prefs(c).edit().putString("candidate",m.toString()).putString("status",s.toString()).commit();
    }
    public static void schedule(Context c,boolean enabled){
        prefs(c).edit().putBoolean("auto",enabled).apply();WorkManager w=WorkManager.getInstance(c);
        if(enabled)w.enqueueUniquePeriodicWork(PERIODIC,ExistingPeriodicWorkPolicy.KEEP,new PeriodicWorkRequest.Builder(SoftwareUpdateWorker.class,6,TimeUnit.HOURS).setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build());else w.cancelUniqueWork(PERIODIC);
    }
    public static void start(Context c,String action){
        if("pause".equals(action)){WorkManager.getInstance(c).cancelUniqueWork(MANUAL);return;}
        if(!"check".equals(action)&&!"download".equals(action))return;
        WorkManager.getInstance(c).enqueueUniqueWork(MANUAL,ExistingWorkPolicy.KEEP,new OneTimeWorkRequest.Builder(SoftwareUpdateWorker.class).setInputData(new Data.Builder().putString("action",action).build()).build());
    }
    public static void launchCheck(Context c){
        boolean auto=prefs(c).getBoolean("auto",true);schedule(c,auto);if(auto)start(c,"check");
    }
    static boolean allowed(URL u){
        String host=u.getHost();return "https".equals(u.getProtocol())&&u.getUserInfo()==null&&u.getPort()==-1&&(("github.com".equals(host)&&u.getPath().startsWith("/springs59/FGO-Max-Bond-Team-Setup/releases/"))||Arrays.asList("release-assets.githubusercontent.com","objects.githubusercontent.com","github-releases.githubusercontent.com").contains(host));
    }
    static HttpURLConnection open(String url,long offset)throws Exception{
        for(int i=0;i<6;i++){
            URL u=new URL(url);if(!allowed(u))throw new IOException("拒绝非仓库下载来源");
            HttpURLConnection r=(HttpURLConnection)u.openConnection();r.setInstanceFollowRedirects(false);r.setConnectTimeout(20000);r.setReadTimeout(30000);r.setRequestProperty("User-Agent","FGO-Bond-Updater");r.setRequestProperty("Cache-Control","no-cache");r.setRequestProperty("Accept-Encoding","identity");if(offset>0)r.setRequestProperty("Range","bytes="+offset+"-");
            int result=r.getResponseCode();if(result==301||result==302||result==303||result==307||result==308){url=new URL(u,r.getHeaderField("Location")).toString();r.disconnect();continue;}
            if(result!=200&&result!=206){r.disconnect();throw new IOException("更新服务 HTTP "+result);}return r;
        }throw new IOException("下载跳转次数过多");
    }
    static String hash(File f)throws Exception{
        MessageDigest h=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(f)){byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1)h.update(buffer,0,n);}StringBuilder result=new StringBuilder();for(byte b:h.digest())result.append(String.format(Locale.ROOT,"%02x",b&255));return result.toString();
    }
    static void verify(Context c,JSONObject m,File f)throws Exception{
        JSONObject a=asset(m);if(f.length()!=a.getLong("size")||!hash(f).equals(a.getString("sha256")))throw new IOException("安装包校验失败，请重新下载");
        PackageInfo target=c.getPackageManager().getPackageArchiveInfo(f.getAbsolutePath(),PackageManager.GET_SIGNATURES), current=installed(c);
        if(target==null||!c.getPackageName().equals(target.packageName)||!m.getString("version").equals(target.versionName)||code(target)!=m.getLong("androidCode")||code(target)<=code(current)||compare(target.versionName,current.versionName)<=0)throw new IOException("安装包应用身份或版本不匹配");
        if(target.signatures==null||current.signatures==null||!Arrays.equals(target.signatures,current.signatures))throw new IOException("签名不匹配，不能覆盖升级");
    }
    static void cleanup(Context c){File[] files=dir(c).listFiles();if(files!=null)for(File f:files)if(f.getName().endsWith(".apk")||f.getName().endsWith(".part"))f.delete();}
    public static void install(Activity activity){
        Context c=activity.getApplicationContext();INSTALL.execute(()->{
            try{JSONObject m=candidate(c);File f=file(c,m);verify(c,m,f);
                activity.runOnUiThread(()->{
                    if(activity.isFinishing()||activity.isDestroyed())return;
                    try{
                        if(!activity.getPackageManager().canRequestPackageInstalls()){
                            prefs(c).edit().putBoolean("permissionPending",true).apply();state(c,"permission","",f.length(),f.length());activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+c.getPackageName())));return;
                        }
                        Uri uri=FileProvider.getUriForFile(c,c.getPackageName()+".updates",f);
                        Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        intent.setClipData(ClipData.newRawUri("软件更新",uri));activity.startActivity(intent);state(c,"ready","",f.length(),f.length());
                    }catch(Exception e){state(c,"error","系统无法打开安装界面："+e.getMessage(),0,0);}
                });
            }catch(Exception e){state(c,"error",e.getMessage(),0,0);}
        });
    }
    public static void resume(Activity a){
        Context c=a.getApplicationContext();if(prefs(c).getBoolean("permissionPending",false)){
            prefs(c).edit().putBoolean("permissionPending",false).apply();if(a.getPackageManager().canRequestPackageInstalls())install(a);else state(c,"ready","尚未允许安装，可再次点击升级",0,0);
        }
    }
}
