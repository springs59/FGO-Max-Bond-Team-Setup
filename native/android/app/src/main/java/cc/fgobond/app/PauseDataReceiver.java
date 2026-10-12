package cc.fgobond.app;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public final class PauseDataReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){DataWorker.pause(context);}
}
