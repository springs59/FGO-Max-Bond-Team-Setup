package cc.fgobond.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import android.webkit.WebView;
import androidx.webkit.*;
import org.json.JSONObject;
import java.io.OutputStream;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Save only a user-selected document; never expose application file paths. */
final class FileExport {
    static final int PICK_FILE=31;
    private final Activity activity;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private volatile Session active;
    private volatile boolean closed;
    private static final class Session {
        String id; long expected,written; OutputStream out; JavaScriptReplyProxy reply;
    }
    FileExport(Activity activity){this.activity=activity;}
    void attach(WebView web){
        if(!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))return;
        WebViewCompat.addWebMessageListener(web,"FgoFileExport",Collections.singleton("https://appassets.androidplatform.net"),(view,message,origin,main,reply)->{
            if(closed||!main||!"https".equals(origin.getScheme())||!"appassets.androidplatform.net".equals(origin.getHost())||origin.getPort()!=-1&&origin.getPort()!=443)return;
            if(message.getType()!=WebMessageCompat.TYPE_STRING)return;
            String body=message.getData();if(body==null||body.length()>70000)return;
            io.execute(()->handle(body,reply));
        });
    }
    static String mime(String name){
        if(name==null||!name.matches("FGO-[A-Za-z0-9._-]{1,150}\\.(jsonl|json|html|png|pdf|docx)(\\.gz)?"))throw new IllegalArgumentException("导出文件名无效");
        if(name.endsWith(".gz"))return "application/gzip";
        if(name.endsWith(".docx"))return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if(name.endsWith(".jsonl"))return "application/x-ndjson";
        if(name.endsWith(".json"))return "application/json";
        if(name.endsWith(".html"))return "text/html";
        if(name.endsWith(".png"))return "image/png";
        return "application/pdf";
    }
    private void reply(JavaScriptReplyProxy proxy,String id,String key,Object value){
        try{String data=new JSONObject().put("id",id).put(key,value).toString();activity.runOnUiThread(()->{if(!activity.isDestroyed())try{proxy.postMessage(data);}catch(RuntimeException ignored){}});}catch(Exception ignored){}
    }
    private void close(Session session){if(session!=null&&session.out!=null)try{session.out.close();}catch(Exception ignored){}if(active==session)active=null;}
    private void handle(String body,JavaScriptReplyProxy proxy){
        if(closed)return;
        String id="";Session session=null;
        try{
            JSONObject message=new JSONObject(body);id=message.getString("id");if(!id.matches("[A-Za-z0-9-]{1,80}"))throw new IllegalArgumentException("保存请求无效");
            String action=message.getString("action");
            if("begin".equals(action)){
                String name=message.getString("name"),type=mime(name);long size=message.getLong("size");
                if(size< -1||size>9007199254740991L)throw new IllegalArgumentException("导出大小无效");
                if(active!=null)throw new IllegalStateException("另一个文件正在保存，请先完成或取消");
                session=new Session();session.id=id;session.expected=size;session.reply=proxy;active=session;
                final Session selected=session;
                activity.runOnUiThread(()->{
                    if(active!=selected)return;
                    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(type).putExtra(Intent.EXTRA_TITLE,name);
                    intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI,Uri.parse("content://com.android.externalstorage.documents/document/primary:Download"));
                    try{activity.startActivityForResult(intent,PICK_FILE);}catch(Exception error){io.execute(()->{close(selected);reply(proxy,selected.id,"error","无法打开系统保存窗口");});}
                });return;
            }
            session=active;if(session==null||!session.id.equals(id))throw new IllegalStateException("保存请求已失效");
            if("abort".equals(action)){close(session);reply(proxy,id,"cancelled",true);return;}
            if(session.out==null)throw new IllegalStateException("请先选择保存位置");
            if("chunk".equals(action)){
                String encoded=message.getString("data");if(encoded.length()>65536)throw new IllegalArgumentException("保存数据块过大");
                byte[] bytes=Base64.decode(encoded,Base64.NO_WRAP);
                if(bytes.length>49152||session.expected>=0&&session.written+bytes.length>session.expected)throw new IllegalArgumentException("保存长度不匹配");
                session.out.write(bytes);session.written+=bytes.length;reply(proxy,id,"written",session.written);return;
            }
            if(!"finish".equals(action))throw new IllegalArgumentException("保存操作无效");
            if(session.expected>=0&&session.written!=session.expected)throw new IllegalStateException("文件内容尚未保存完整");
            session.out.flush();session.out.close();session.out=null;active=null;reply(proxy,id,"saved",true);
        }catch(Exception error){
            if(session!=null&&session.id.equals(id))close(session);
            reply(proxy,id,"error",error.getMessage()==null?"文件保存失败":error.getMessage());
        }
    }
    void selected(Uri uri){if(closed)return;io.execute(()->{
        Session session=active;if(session==null)return;
        if(uri==null){close(session);reply(session.reply,session.id,"cancelled",true);return;}
        try{session.out=activity.getContentResolver().openOutputStream(uri,"wt");if(session.out==null)throw new IllegalStateException("无法写入所选位置");reply(session.reply,session.id,"ready",true);}
        catch(Exception error){close(session);reply(session.reply,session.id,"error","无法写入所选保存位置");}
    });}
    void abortAll(){if(closed)return;io.execute(()->{Session s=active;close(s);if(s!=null)reply(s.reply,s.id,"error","保存界面已关闭");});}
    void destroy(){closed=true;io.execute(()->close(active));io.shutdown();}
}
