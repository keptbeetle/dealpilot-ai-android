package dev.pocket.agent;

import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class NativeStorePolicyDeviceTest {
    @Test public void compactAppObservationsKeepSearchControlsInsideTheBoundedPayload() throws Exception {
        java.util.List<dev.pocket.control.ControlBackend.Node> nodes=new java.util.ArrayList<>();
        for(int i=0;i<300;i++)nodes.add(new dev.pocket.control.ControlBackend.Node(i,"layout_"+i,"","","android.view.View",0,0,720,1280,true,false,false,false,false,false));
        nodes.add(new dev.pocket.control.ControlBackend.Node(300,"search_box","Search Amazon.in","","android.widget.EditText",0,0,720,100,true,false,true,true,false,false));
        org.json.JSONObject compact=NativeTools.boundedObservationNodes(nodes,3000,true);
        assertEquals(1,compact.getJSONArray("nodes").length());
        assertEquals("search_box",compact.getJSONArray("nodes").getJSONObject(0).getString("resource_id"));
        assertTrue(compact.getJSONArray("nodes").getJSONObject(0).getBoolean("editable"));
        assertFalse(compact.getBoolean("nodes_truncated"));
        assertTrue(NativeTools.boundedObservationNodes(nodes,3000,false).getBoolean("nodes_truncated"));
    }
    @Test public void merchantUrlsStayInsideMatchingNativePackages() {
        assertEquals("amazon",NativeStoreNavigation.store(Uri.parse("https://www.amazon.in/dp/EXAMPLE")));
        assertEquals("flipkart",NativeStoreNavigation.store(Uri.parse("https://www.flipkart.com/example/p/EXAMPLE")));
        assertNull(NativeStoreNavigation.store(Uri.parse("https://amazon.in.evil.example/product")));
        assertEquals("in.amazon.mShop.android.shopping",NativeStoreNavigation.intent(Uri.parse("https://www.amazon.in/s?k=headphones"),"in.amazon.mShop.android.shopping").getPackage());
        for(String url:new String[]{"http://www.amazon.in/product","https://secret@www.amazon.in/product","https://www.amazon.in:1234/product","https://evil.example/product"}){
            try{NativeStoreNavigation.intent(Uri.parse(url),"in.amazon.mShop.android.shopping");fail(url);}catch(IllegalArgumentException expected){}
        }
        try{NativeStoreNavigation.intent(Uri.parse("https://www.amazon.in/product"),"com.android.chrome");fail("Wrong package");}catch(IllegalArgumentException expected){}
    }
    @Test public void retailerSingletonsCannotReusePersonalOrOtherWorkerSessions() {
        String pkg="in.amazon.mShop.android.shopping";
        DisplayTaskSnapshot personal=DisplayTaskSnapshot.stacks("RootTask id=210 displayId=0 userId=0\n  taskId=210: "+pkg+"/.MainActivity visible=false\n");
        assertFalse(NativeStoreNavigation.privateSessionAllowed(pkg,15,personal));
        DisplayTaskSnapshot own=DisplayTaskSnapshot.stacks("RootTask id=210 displayId=15 userId=0\n  taskId=210: "+pkg+"/.MainActivity visible=true\n");
        assertTrue(NativeStoreNavigation.privateSessionAllowed(pkg,15,own));
        assertFalse(NativeStoreNavigation.privateSessionAllowed(pkg,16,own));
        assertFalse(NativeStoreNavigation.privateSessionAllowed(pkg,15,DisplayTaskSnapshot.stacks("Display #15\n")));
    }
    @Test public void manualAppHandoffNeedsAnExactUserGestureTarget() {
        assertTrue(PocketWebUi.isUserStoreNavigation(Uri.parse("pocket-store://amazon"),true,true));
        assertTrue(PocketWebUi.isUserStoreNavigation(Uri.parse("pocket-store://flipkart"),true,true));
        assertFalse(PocketWebUi.isUserStoreNavigation(Uri.parse("pocket-store://amazon"),false,true));
        for(String uri:new String[]{"pocket-store:amazon","pocket-store://evil","pocket-store://amazon?pay=1","pocket-store://amazon/checkout","pocket-store://secret@amazon"})assertFalse(PocketWebUi.isUserStoreNavigation(Uri.parse(uri),true,true));
    }
}
