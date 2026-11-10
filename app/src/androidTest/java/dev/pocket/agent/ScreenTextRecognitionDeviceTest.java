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
 @Test public void repeatedScreenshotOcrReusesOneRecognizerAndReleasesIt() throws Exception {
  Bitmap b=Bitmap.createBitmap(500,200,Bitmap.Config.ARGB_8888);
  Canvas c=new Canvas(b);c.drawColor(Color.WHITE);Paint p=new Paint();p.setColor(Color.BLACK);p.setTextSize(48);p.setAntiAlias(true);c.drawText("Price INR 899",20,120,p);
  ByteArrayOutputStream bytes=new ByteArrayOutputStream();b.compress(Bitmap.CompressFormat.PNG,100,bytes);b.recycle();
  java.lang.reflect.Field field=ScreenTextRecognition.class.getDeclaredField("recognizer");field.setAccessible(true);
  ScreenTextRecognition.shutdown();
  long baselinePssKb=android.os.Debug.getPss();
  Object cached=null;
  try{
   for(int i=0;i<12;i++){
    JSONObject result=ScreenTextRecognition.recognize(bytes.toByteArray(),"repeat-"+i,123+i);
    assertTrue(result.toString(),result.toString().contains("899"));
    Object current=field.get(null);assertNotNull(current);
    if(i==0)cached=current;
    else assertSame("Every OCR capture should share the same native ML Kit client",cached,current);
   }
  }finally{ScreenTextRecognition.shutdown();}
  assertNull("Tool shutdown must release the native recognizer",field.get(null));
  assertTrue("Repeated OCR must not retain hundreds of MB per snapshot: before="+baselinePssKb+" after="+android.os.Debug.getPss(),android.os.Debug.getPss()-baselinePssKb<250000);
 }
 @Test public void repeatedTypicalStoreSizeScreenshotsKeepRecognitionAndBoundPss() throws Exception {
  Bitmap bitmap=Bitmap.createBitmap(720,1280,Bitmap.Config.ARGB_8888);
  Canvas canvas=new Canvas(bitmap);canvas.drawColor(Color.WHITE);
  Paint paint=new Paint();paint.setColor(Color.BLACK);paint.setTextSize(43);paint.setAntiAlias(true);
  canvas.drawText("Sony WH-CH520 Black",24,220,paint);
  canvas.drawText("Price INR 3590",24,460,paint);
  ByteArrayOutputStream encoded=new ByteArrayOutputStream();bitmap.compress(Bitmap.CompressFormat.JPEG,80,encoded);bitmap.recycle();
  ScreenTextRecognition.shutdown();
  long before=android.os.Debug.getPss(),peak=before;
  try{
   for(int i=0;i<6;i++){
    JSONObject result=ScreenTextRecognition.recognize(encoded.toByteArray(),"store-"+i,400+i);
    assertTrue(result.toString(),result.toString().contains("3590"));
    peak=Math.max(peak,android.os.Debug.getPss());
   }
  }finally{ScreenTextRecognition.shutdown();}
  assertTrue("Repeated store-sized images must remain within 250 MB additional PSS; baseline="+before+" peak="+peak,peak-before<250000);
 }
 @Test public void ocrRecognizerClosesAfterInactivityAndReuseExtendsItsLease() throws Exception {
  Bitmap bitmap=Bitmap.createBitmap(480,180,Bitmap.Config.ARGB_8888);
  Canvas canvas=new Canvas(bitmap);canvas.drawColor(Color.WHITE);
  Paint paint=new Paint();paint.setColor(Color.BLACK);paint.setTextSize(46);paint.setAntiAlias(true);
  canvas.drawText("Price INR 899",15,115,paint);
  ByteArrayOutputStream bytes=new ByteArrayOutputStream();bitmap.compress(Bitmap.CompressFormat.PNG,100,bytes);bitmap.recycle();
  java.lang.reflect.Field field=ScreenTextRecognition.class.getDeclaredField("recognizer");
  field.setAccessible(true);
  ScreenTextRecognition.shutdown();
  try {
   ScreenTextRecognition.recognize(bytes.toByteArray(),"idle-1",100);
   Object first=field.get(null);assertNotNull(first);
   Thread.sleep(1500);
   ScreenTextRecognition.recognize(bytes.toByteArray(),"idle-2",200);
   long activePssKb=android.os.Debug.getPss();
   assertSame("Active consecutive OCR captures reuse the same model",first,field.get(null));
   Thread.sleep(2500);
   assertSame("The old timer must not close an active recognizer",first,field.get(null));
   Thread.sleep(2100);
   assertNull("Idle OCR must release the native recognition model",field.get(null));
   android.util.Log.i("PocketOcrMemoryTest","PSS_KB active="+activePssKb+" afterIdle="+android.os.Debug.getPss());
  }finally{ScreenTextRecognition.shutdown();}
 }
 @Test public void archivedRealDigitWheelScreenshotIsRecognisedAsPixels() throws Exception {
  File folder=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getFilesDir(),"ocr-test"),file=new File(folder,"flipkart.png");Assume.assumeTrue("Optional private same-visit screenshot supplied by USB audit",file.isFile());
  File source=new File(folder,"flipkart-anchors.json");Assume.assumeTrue(source.isFile());JSONObject meta=new JSONObject(new String(Files.readAllBytes(source.toPath()),java.nio.charset.StandardCharsets.UTF_8));
  JSONObject r=ScreenTextRecognition.recognize(Files.readAllBytes(file.toPath()),"archived-flipkart",1793990057023L,meta.getJSONArray("anchors"),meta.getInt("width"),meta.getInt("height"));
  Files.write(new File(folder,"flipkart-result.json").toPath(),r.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
  boolean exact=false;for(int i=0;i<r.getJSONArray("currencyRegions").length();i++){JSONObject region=r.getJSONArray("currencyRegions").getJSONObject(i);if("INR".equals(region.getString("currency"))&&"899".equals(region.getString("amountText")))exact=true;}assertTrue(r.toString(),exact);
 }
}
