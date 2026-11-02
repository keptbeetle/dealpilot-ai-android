package dev.pocket.agent;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/** Receives a browser return reference. Payment status is checked by the server. */
public final class PayPalReturnActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        Uri uri=getIntent().getData();
        if(uri!=null&&"pocketagent".equals(uri.getScheme())&&"paypal".equals(uri.getHost())&&uri.getUserInfo()==null&&uri.getPort()==-1&&("/return".equals(uri.getPath())||"/cancel".equals(uri.getPath()))){
            String token=uri.getQueryParameter("token");
            if(token!=null&&token.matches("[A-Z0-9]{6,40}")){
                startActivity(new Intent(this,MainActivity.class)
                    .setAction("dev.pocket.agent.PAYPAL_RETURN")
                    .putExtra("paypalOrder",token)
                    .putExtra("paypalOutcome",uri.getPath().substring(1))
                    .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP));
            }
        }
        finish();
    }
}
