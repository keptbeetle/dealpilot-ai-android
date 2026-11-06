package dev.pocket.agent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.file.Files;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.Assume;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class ScreenTextRecognitionDeviceTest {
 @Test public void actualBundledRecognizerTranscribesACompletePriceAndBindsItsImage() throws Exception {
  Bitmap b=Bitmap.createBitmap(1100,400,Bitmap.Config.ARGB_8888);Canvas c=new Canvas(b);c.drawColor(Color.WHITE);Paint p=new Paint();p.setColor(Color.BLACK);p.setTextSize(72);p.setAntiAlias(true);c.drawText("Sony X100 headphones",25,120,p);c.drawText("Price INR 899",25,250,p);ByteArrayOutputStream bytes=new ByteArrayOutputStream();b.compress(Bitmap.CompressFormat.PNG,100,bytes);b.recycle();
  JSONObject r=ScreenTextRecognition.recognize(bytes.toByteArray(),"ocr-test",123);assertEquals("ocr-test",r.getString("snapshotId"));assertEquals(123,r.getLong("capturedAt"));assertEquals(64,r.getString("imageSha256").length());assertTrue(r.toString(),r.toString().contains("899"));assertTrue(r.getBoolean("onDevice"));
 }
 @Test public void archivedRealDigitWheelScreenshotIsRecognisedAsPixels() throws Exception {
  File folder=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getFilesDir(),"ocr-test"),file=new File(folder,"flipkart.png");Assume.assumeTrue("Optional private same-visit screenshot supplied by USB audit",file.isFile());
  File source=new File(folder,"flipkart-anchors.json");Assume.assumeTrue(source.isFile());JSONObject meta=new JSONObject(new String(Files.readAllBytes(source.toPath()),java.nio.charset.StandardCharsets.UTF_8));
  JSONObject r=ScreenTextRecognition.recognize(Files.readAllBytes(file.toPath()),"archived-flipkart",1793990057023L,meta.getJSONArray("anchors"),meta.getInt("width"),meta.getInt("height"));
  Files.write(new File(folder,"flipkart-result.json").toPath(),r.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
  boolean exact=false;for(int i=0;i<r.getJSONArray("currencyRegions").length();i++){JSONObject region=r.getJSONArray("currencyRegions").getJSONObject(i);if("INR".equals(region.getString("currency"))&&"899".equals(region.getString("amountText")))exact=true;}assertTrue(r.toString(),exact);
 }
}
