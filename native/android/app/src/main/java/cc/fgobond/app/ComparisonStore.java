package cc.fgobond.app;
import android.content.Context;
import org.json.*;
public final class ComparisonStore {
    public static synchronized JSONArray records(Context c) {
        try{return new JSONArray(c.getSharedPreferences("comparison",0).getString("records","[]"));}catch(Exception e){return new JSONArray();}
    }
    public static synchronized void append(Context c,String json) {
        try {
            if(json.length()>16384)return;
            JSONObject record=new JSONObject(json);
            if(!java.util.Arrays.asList("2.0.0","2.0.8","2.0.9").contains(record.optString("version")))return;
            JSONArray old=records(c),next=new JSONArray();
            for(int i=Math.max(0,old.length()-299);i<old.length();i++)next.put(old.get(i));
            next.put(record);c.getSharedPreferences("comparison",0).edit().putString("records",next.toString()).commit();
        }catch(Exception ignored){}
    }
    public static JSONObject report(Context c,String tester) throws JSONException {
        return new JSONObject().put("format","fgo-three-version-comparison").put("build","2.0.9-compare.1")
          .put("tester",tester).put("exportedAt",System.currentTimeMillis()).put("manufacturer",android.os.Build.MANUFACTURER)
          .put("model",android.os.Build.MODEL).put("android",android.os.Build.VERSION.RELEASE)
          .put("webview",android.webkit.WebView.getCurrentWebViewPackage()==null?"unknown":android.webkit.WebView.getCurrentWebViewPackage().versionName)
          .put("timing","request through complete decoded result; excludes UI rendering and manual archive save")
          .put("records",records(c));
    }
}
