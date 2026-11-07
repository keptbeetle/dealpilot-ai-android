package dev.pocket.agent;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/** Finite, opt-in USB-only test transport. Excluded from the application APK. */
@RunWith(AndroidJUnit4.class)
public class NativeStoreDriverDeviceTest {
    @Test public void runAuthorizedNativeNavigationChecks() throws Exception {
        assumeTrue("Explicit native-store driver opt-in required", "yes".equals(InstrumentationRegistry.getArguments().getString("liveStoreDriver")));
        // Exercise the installed accessibility service. Reserving UiAutomation
        // here would prevent inspecting Settings while restoring that service.
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        File folder=new File(context.getFilesDir(),"native-store-driver");assertTrue(folder.isDirectory()||folder.mkdirs());
        File request=new File(folder,"request.json"),response=new File(folder,"response.json");
        Files.deleteIfExists(request.toPath());Files.deleteIfExists(response.toPath());
        Set<String> allowed=Set.of("phone_capabilities","phone_apps","phone_open_app","phone_open_url","phone_observe","phone_act","phone_operation","phone_screen","audit_capture","finish");
        Map<String,Integer> displays=new HashMap<>();long last=-1,deadline=System.currentTimeMillis()+900000;
        try(NativeTools tools=new NativeTools(context)) {
            Files.write(new File(folder,"ready.json").toPath(),new JSONObject().put("ready",true).toString().getBytes(StandardCharsets.UTF_8));
            while(System.currentTimeMillis()<deadline) {
                if(!request.isFile()){Thread.sleep(80);continue;}
                JSONObject next;
                try{next=new JSONObject(new String(Files.readAllBytes(request.toPath()),StandardCharsets.UTF_8));}catch(Exception incomplete){Thread.sleep(80);continue;}
                long id=next.optLong("id",-1);if(id<=last){Thread.sleep(80);continue;}last=id;
                JSONObject result;
                try {
                    String name=next.getString("name"),owner=next.optString("owner","native-store-test");
                    if(!allowed.contains(name)||!owner.matches("native-store-[a-zA-Z0-9-]{1,80}"))throw new IllegalArgumentException("Unsupported test request");
                    JSONObject args=next.optJSONObject("args");if(args==null)args=new JSONObject();
                    if(name.equals("finish")){Files.write(response.toPath(),new JSONObject().put("id",id).put("result",new JSONObject().put("finished",true)).toString().getBytes(StandardCharsets.UTF_8));return;}
                    if(name.equals("phone_open_app")&&!Set.of("in.amazon.mShop.android.shopping","com.amazon.mShop.android.shopping","com.flipkart.android").contains(args.optString("package_name")))throw new IllegalArgumentException("Only the requested store apps may launch");
                    if(name.equals("phone_act")&&args.toString().matches("(?is).*(add to (cart|bag)|buy now|place order|pay now|checkout).*"))throw new IllegalArgumentException("Purchase controls are excluded from the research audit");
                    if(Set.of("phone_open_app","phone_open_url","phone_observe","phone_act","audit_capture").contains(name)&&!"physical".equals(args.optString("display_target"))) {
                        JSONObject lease=tools.execute("phone_screen",new JSONObject().put("action","acquire"),owner);
                        if(lease.optBoolean("isError"))throw new IllegalStateException(lease.toString());
                        displays.put(owner,lease.getInt("display_id"));
                    }
                    result=name.equals("audit_capture")?AgentDisplayCoordinator.shared(context).preview(displays.get(owner)):tools.execute(name,args,owner);
                }catch(Exception failure){result=new JSONObject().put("isError",true).put("message",String.valueOf(failure.getMessage()));}
                Files.write(response.toPath(),new JSONObject().put("id",id).put("result",result).toString().getBytes(StandardCharsets.UTF_8));
            }
            fail("Native research driver exceeded its finite test window");
        }
    }
}
