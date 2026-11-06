package dev.pocket.agent;

import android.app.UiAutomation;
import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/** Explicit opt-in native app inspection. No orders, cart additions or payment. */
@RunWith(AndroidJUnit4.class)
public class StoreAppNavigationDeviceTest {
    @Test public void inspectInstalledStoreAppsOnPrivateDisplays() throws Exception {
        assumeTrue("Explicit native-store audit required", "yes".equals(InstrumentationRegistry.getArguments().getString("liveStoreApps")));
        InstrumentationRegistry.getInstrumentation().getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES);
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        File folder=new File(context.getFilesDir(),"store-app-audit");assertTrue(folder.isDirectory()||folder.mkdirs());
        try(NativeTools tools=new NativeTools(context)) {
            String owner="native-store-inspection";
            JSONObject caps=tools.execute("phone_capabilities",new JSONObject(),owner);
            for(int attempt=0;attempt<30&&!caps.optBoolean("accessibility_connected");attempt++) {
                Thread.sleep(500);caps=tools.execute("phone_capabilities",new JSONObject(),owner);
            }
            assertTrue("Existing accessibility approval required",caps.optBoolean("accessibility_connected"));
            JSONObject lease=tools.execute("phone_screen",new JSONObject().put("action","acquire"),owner);
            assertFalse(lease.toString(),lease.optBoolean("isError"));
            String[] packages={"in.amazon.mShop.android.shopping","com.flipkart.android"};
            for(int i=0;i<packages.length;i++) {
                JSONObject opened=tools.execute("phone_open_app",new JSONObject().put("package_name",packages[i]).put("operation_id",caps.getString("operation_prefix")+"_storeprobe_"+System.nanoTime()),owner);
                Files.write(new File(folder,"store-"+i+"-launch.json").toPath(),opened.toString(2).getBytes(StandardCharsets.UTF_8));
                assertFalse(opened.toString(),opened.optBoolean("isError"));
                JSONObject observed=null;
                for(int attempt=0;attempt<18;attempt++) {
                    Thread.sleep(600);observed=tools.execute("phone_observe",new JSONObject().put("include_image",false).put("max_nodes",350),owner);
                    if(packages[i].equals(observed.optString("package_name"))&&observed.optJSONArray("nodes")!=null&&observed.getJSONArray("nodes").length()>25)break;
                }
                Files.write(new File(folder,"store-"+i+"-home.json").toPath(),observed.toString(2).getBytes(StandardCharsets.UTF_8));
                String frame=AgentDisplayCoordinator.shared(context).preview(opened.getInt("display_id")).getString("image");
                if(frame.contains(","))frame=frame.substring(frame.indexOf(',')+1);
                Files.write(new File(folder,"store-"+i+"-home.jpg").toPath(),android.util.Base64.decode(frame,android.util.Base64.DEFAULT));
                assertEquals(observed.toString(),packages[i],observed.optString("package_name"));
            }
        }
    }
}
