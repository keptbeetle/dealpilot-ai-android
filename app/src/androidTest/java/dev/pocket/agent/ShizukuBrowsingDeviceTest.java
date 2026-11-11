package dev.pocket.agent;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Read-only on-device Shizuku integration check, run explicitly via instrumentation. */
@RunWith(AndroidJUnit4.class)
public final class ShizukuBrowsingDeviceTest {
 @Test public void shizukuCanOpenChromeOnItsOwnAndroidDisplay() throws Exception {
  Context app=InstrumentationRegistry.getInstrumentation().getTargetContext();
  assertEquals("idle",ShizukuDisplayClient.prerequisites());
  try(ShizukuDisplayClient client=new ShizukuDisplayClient(app,()->{})) {
   assertTrue("Shizuku UserService should bind",client.awaitReady(18000));
   JSONObject context=client.terminal(new JSONObject().put("action","context"),"shizuku-smoke",-1);
   assertTrue("Shell-backed service must expose a working directory",context.has("working_directory"));
   int display=client.createDisplay();
   assertTrue("A private display ID is required",display>0);
   try {
    client.openBrowserUrl(display,"https://www.walmart.com/ip/5212541979");
    String frame="";
    for(int attempt=0;attempt<8;attempt++){
      Thread.sleep(750);
      frame=client.preview(display);
      if(frame.length()>200)break;
    }
    assertTrue("The privileged display should have a real rendered frame",frame.length()>200);
    java.nio.file.Files.write(new java.io.File(app.getExternalFilesDir(null),"shizuku-browser-preview.jpg").toPath(),android.util.Base64.decode(frame,android.util.Base64.DEFAULT));
    android.util.Log.i("DealPilotShizukuTest","Private Chrome display opened. image bytes="+frame.length());
   } finally {assertTrue("Release isolated shopping display",client.removeDisplay(display));}
  }
 }
}
