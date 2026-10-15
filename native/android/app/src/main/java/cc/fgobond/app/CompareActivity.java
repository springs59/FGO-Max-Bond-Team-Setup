package cc.fgobond.app;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.widget.*;
public final class CompareActivity extends Activity {
    private EditText tester;
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setPadding(24,24,24,24);
        TextView title=new TextView(this);title.setText("羁绊三版本对比 · 测试版");title.setTextSize(23);panel.addView(title);
        TextView help=new TextView(this);help.setText("同一数据快照，三个版本分别保存账号、方案库和缓存。请在各版本导入同一个账号，设置相同条件。\n\n建议每版先算一次，再重复 5 次，并另测修改条件。2.0.8 / 2.0.9 如需测永久缓存，请先主动保存结果。\n\n每次结果显示请求至结果耗时（含传输，不含界面渲染及手动保存）。测试包与正式版可共存，固定数据，无自动更新。\n");panel.addView(help);
        for(String version:new String[]{"200","208","209"}){
            Button button=new Button(this);button.setText(version.equals("209")?"2.0.9 · 通信与缓存优化测试":"2.0."+version.charAt(2)+" · 发布版基线");
            button.setOnClickListener(v->startActivity(new Intent(this,MainActivity.class).putExtra("compareVersion",version)));panel.addView(button);
        }
        tester=new EditText(this);tester.setHint("测试者代号（可选，勿填账号密码）");tester.setSingleLine(true);panel.addView(tester);
        Button export=new Button(this);export.setText("导出三版本测试记录");export.setOnClickListener(v->startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,"FGO-three-version-test.json"),50));panel.addView(export);
        TextView note=new TextView(this);note.setText("仅记录最近 300 次计算的版本、条件摘要、分数及耗时；记录保存在本机，导出后由你自行发送。完整账号抓包不会写入测试报告。");panel.addView(note);
        ScrollView scroll=new ScrollView(this);scroll.addView(panel);setContentView(scroll);
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==50&&result==RESULT_OK&&data!=null&&data.getData()!=null){
            try(java.io.OutputStream out=getContentResolver().openOutputStream(data.getData())){
                if(out==null)throw new java.io.IOException("保存目标不可用");
                out.write(ComparisonStore.report(this,tester.getText().toString()).toString(2).getBytes(java.nio.charset.StandardCharsets.UTF_8));
                Toast.makeText(this,"测试记录已导出",Toast.LENGTH_SHORT).show();
            }catch(Exception e){Toast.makeText(this,"导出失败："+e.getMessage(),Toast.LENGTH_LONG).show();}
        }
    }
}
