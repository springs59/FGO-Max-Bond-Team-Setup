package cc.fgobond.app;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.core.content.FileProvider;
import android.content.*;
import org.json.*;
import java.io.*;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class SoftwareUpdateTest {
    private JSONObject manifest(String v,int code,long size,String sha)throws Exception{
        JSONObject assets=new JSONObject();for(String p:new String[]{"windows","android"}){String name="FGO-Bond-"+(p.equals("android")?"Android":"Windows")+"-"+v+(p.equals("android")?".apk":".exe");assets.put(p,new JSONObject().put("name",name).put("url",SoftwareUpdate.REPO+"/releases/download/native-v"+v+"/"+name).put("sha256",sha).put("size",size));}
        return new JSONObject().put("format",1).put("prerelease",false).put("version",v).put("tag","native-v"+v).put("releaseUrl",SoftwareUpdate.REPO+"/releases/tag/native-v"+v).put("androidCode",code).put("assets",assets);
    }
    @Before public void disableNetworkUpdates(){Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();SoftwareUpdate.schedule(c,false);}
    @Test public void updatePolicyAndPrivateFileProvider()throws Exception{
        Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue(SoftwareUpdate.compare("0.1.10","0.1.9")>0);
        JSONObject m=manifest("0.1.10",11,100,"0".repeat(64));SoftwareUpdate.validate(m);
        m.put("prerelease",true);try{SoftwareUpdate.validate(m);fail("prerelease accepted");}catch(IOException expected){}
        m.put("prerelease",false);m.getJSONObject("assets").getJSONObject("android").put("url","https://example.com/app.apk");try{SoftwareUpdate.validate(m);fail("wrong source accepted");}catch(IOException expected){}
        assertFalse(SoftwareUpdate.allowed(new java.net.URL("https://evil.example/app.apk")));
        File privateAccount=new File(c.getFilesDir(),"account-sentinel.json");try(FileOutputStream out=new FileOutputStream(privateAccount)){out.write("preserved".getBytes());}
        try{FileProvider.getUriForFile(c,c.getPackageName()+".updates",privateAccount);fail("account files exposed by provider");}catch(IllegalArgumentException expected){}
        assertEquals("content",FileProvider.getUriForFile(c,c.getPackageName()+".updates",new File(SoftwareUpdate.dir(c),"test.apk")).getScheme());
        assertTrue(privateAccount.exists());privateAccount.delete();
    }
    @Test public void realApkSignatureVersionAndIntegrityValidation()throws Exception{
        Context c=InstrumentationRegistry.getInstrumentation().getTargetContext(),test=InstrumentationRegistry.getInstrumentation().getContext();
        File target=new File(SoftwareUpdate.dir(c),"fixture.apk");try(InputStream in=test.getAssets().open("upgrade-fixture.apk");OutputStream out=new FileOutputStream(target)){byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);}
        try{
            android.content.pm.PackageInfo p=c.getPackageManager().getPackageArchiveInfo(target.getAbsolutePath(),android.content.pm.PackageManager.GET_SIGNATURES);assertNotNull(p);
            JSONObject m=manifest(p.versionName,(int)SoftwareUpdate.code(p),target.length(),SoftwareUpdate.hash(target));SoftwareUpdate.verify(c,m,target);
            m.put("androidCode",SoftwareUpdate.code(p)+1);try{SoftwareUpdate.verify(c,m,target);fail("mismatched code accepted");}catch(IOException expected){}
            m.put("androidCode",SoftwareUpdate.code(p));m.getJSONObject("assets").getJSONObject("android").put("sha256","0".repeat(64));try{SoftwareUpdate.verify(c,m,target);fail("corrupt APK accepted");}catch(IOException expected){}
            JSONObject same=manifest(SoftwareUpdate.installed(c).versionName,(int)SoftwareUpdate.code(SoftwareUpdate.installed(c)),target.length(),SoftwareUpdate.hash(target));try{SoftwareUpdate.verify(c,same,target);fail("version mismatch accepted");}catch(IOException expected){}
        }finally{target.delete();}
    }
}
