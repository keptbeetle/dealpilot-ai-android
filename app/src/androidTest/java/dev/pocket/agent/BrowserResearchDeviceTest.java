package dev.pocket.agent;

import android.app.UiAutomation;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/** Opt-in read-only source audit. No model, merchant cart or payment requests. */
@RunWith(AndroidJUnit4.class)
public class BrowserResearchDeviceTest {
    @Test public void sourceLinksRequireAnExplicitGestureAndOrdinaryHttpsAddress() {
        Uri link=Uri.parse("https://shop.example/products/headphones");
        assertTrue(PocketWebUi.isUserExternalNavigation(link,true,true));
        assertFalse(PocketWebUi.isUserExternalNavigation(link,false,true));
        assertFalse(PocketWebUi.isUserExternalNavigation(link,true,false));
        for(String invalid:new String[]{"javascript:alert(1)","http://shop.example/product","https://secret@shop.example/product","https://pocket.local/index.html"})
            assertFalse(PocketWebUi.isUserExternalNavigation(Uri.parse(invalid),true,true));
    }
    @Test public void actualChromePagesKeepTheirBrowserAndSourceIdentity() throws Exception {
        assumeTrue("Explicit source-audit opt-in required", "yes".equals(
            InstrumentationRegistry.getArguments().getString("liveBrowserAudit")));
        InstrumentationRegistry.getInstrumentation().getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES);
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        String[] urls=InstrumentationRegistry.getArguments().getString("liveBrowserUrls",
            "https://arkelectron.com/product/ark-flow/|https://shop.linqs.in/product/nfc-ntag203-white-sticker-40-mm-diameter").split("\\|");
        File folder=new File(context.getFilesDir(),"browser-audit");assertTrue(folder.isDirectory()||folder.mkdirs());
        try(NativeTools tools=new NativeTools(context)) {
            String owner="live-browser-audit";
            JSONObject capabilities=tools.execute("phone_capabilities",new JSONObject(),owner);
            for(int attempt=0;attempt<30&&!capabilities.optBoolean("accessibility_connected");attempt++) {
                Thread.sleep(500);capabilities=tools.execute("phone_capabilities",new JSONObject(),owner);
            }
            assertTrue("Shizuku must already be authorized",capabilities.getJSONObject("virtual_displays").getBoolean("shizuku_authorized"));
            assertTrue("Accessibility must already be connected",capabilities.getBoolean("accessibility_connected"));
            JSONObject lease=tools.execute("phone_screen",new JSONObject().put("action","acquire"),owner);
            assertFalse(lease.toString(),lease.optBoolean("isError"));
            String prefix=capabilities.getString("operation_prefix");
            for(int i=0;i<urls.length;i++) {
                Uri uri=Uri.parse(urls[i]);assertEquals("https",uri.getScheme());assertNull(uri.getUserInfo());
                Intent intent=ShellDisplayService.chromeBrowserIntent(context.getPackageManager(),uri);
                assertNotNull("Chrome launcher must be available",intent);
                assertEquals("com.android.chrome",intent.getComponent().getPackageName());
                assertEquals(Intent.ACTION_VIEW,intent.getAction());assertEquals(uri,intent.getData());
                JSONObject opened=tools.execute("phone_open_url",new JSONObject().put("url",urls[i]).put("browser","chrome")
                    .put("operation_id",prefix+"_audit_"+System.nanoTime()),owner);
                Files.write(new File(folder,"case-"+i+"-launch.json").toPath(),opened.toString(2).getBytes(StandardCharsets.UTF_8));
                assertFalse(opened.toString(),opened.optBoolean("isError"));
                JSONObject observed=null;
                for(int attempt=0;attempt<12;attempt++) {
                    Thread.sleep(600);
                    observed=tools.execute("phone_observe",new JSONObject().put("include_image",false).put("max_nodes",180),owner);
                    if(!observed.optBoolean("isError")&&"com.android.chrome".equals(observed.optString("package_name"))&&observed.optJSONArray("nodes")!=null&&observed.getJSONArray("nodes").length()>45&&observed.getJSONArray("nodes").toString().contains(uri.getHost()))break;
                }
                Files.write(new File(folder,"case-"+i+"-observation.json").toPath(),observed.toString(2).getBytes(StandardCharsets.UTF_8));
                String frame=AgentDisplayCoordinator.shared(context).preview(opened.getInt("display_id")).getString("image");
                if(frame.contains(","))frame=frame.substring(frame.indexOf(',')+1);
                Files.write(new File(folder,"case-"+i+".jpg").toPath(),android.util.Base64.decode(frame,android.util.Base64.DEFAULT));
                assertEquals(observed.toString(),"com.android.chrome",observed.optString("package_name"));
                JSONArray nodes=observed.getJSONArray("nodes");boolean source=false;
                for(int n=0;n<nodes.length();n++) {
                    JSONObject node=nodes.getJSONObject(n);
                    if(node.optString("resource_id").contains("url_bar")&&node.optString("text").contains(uri.getHost()))source=true;
                }
                assertTrue("Requested host must be observed in Chrome's own address bar",source);
            }
        }
    }
}
