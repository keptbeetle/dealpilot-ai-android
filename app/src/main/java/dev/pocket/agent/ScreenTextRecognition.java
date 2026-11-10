package dev.pocket.agent;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.security.MessageDigest;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import org.json.JSONArray;
import org.json.JSONObject;

/** On-device transcription only; an OCR claim is not a verified offer or action target. */
final class ScreenTextRecognition {
    // Reuse one serialized native recognizer across a burst of screenshots,
    // then close it after a brief idle period so successive conversations do
    // not retain the prior model while allocating a fresh runtime workload.
    private static TextRecognizer recognizer;
    private static final long IDLE_RELEASE_MS = 3500;
    private static final ScheduledExecutorService idleReleaser = Executors.newSingleThreadScheduledExecutor(job->{
        Thread thread=new Thread(job,"PocketOcrIdleRelease");thread.setDaemon(true);return thread;
    });
    private static ScheduledFuture<?> pendingRelease;
    private static long releaseVersion;
    private static TextRecognizer reusableRecognizer() {
        if(recognizer==null)recognizer=TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        return recognizer;
    }
    private static void closeRecognizer() {
        if(recognizer!=null){recognizer.close();recognizer=null;}
    }
    private static void releaseWhenIdle() {
        if(pendingRelease!=null)pendingRelease.cancel(false);
        long version=++releaseVersion;
        pendingRelease=idleReleaser.schedule(()->{
            synchronized(ScreenTextRecognition.class){
                if(version!=releaseVersion)return;
                pendingRelease=null;
                closeRecognizer();
            }
        },IDLE_RELEASE_MS,TimeUnit.MILLISECONDS);
    }
    static synchronized void shutdown() {
        releaseVersion++;
        if(pendingRelease!=null){pendingRelease.cancel(false);pendingRelease=null;}
        closeRecognizer();
    }
    static JSONObject recognize(byte[] image,String snapshotId,long capturedAt) throws Exception {
        return recognize(image,snapshotId,capturedAt,new JSONArray(),0,0);
    }
    static synchronized JSONObject recognize(byte[] image,String snapshotId,long capturedAt,JSONArray anchors,int coordinateWidth,int coordinateHeight) throws Exception {
        if(image==null||image.length>8_000_000)throw new IllegalArgumentException("A bounded screenshot is required");
        Bitmap bitmap=BitmapFactory.decodeByteArray(image,0,image.length);
        if(bitmap==null)throw new IllegalArgumentException("Screenshot decode failed");
        try {
            TextRecognizer recognizer=reusableRecognizer();
            Text text=Tasks.await(recognizer.process(InputImage.fromBitmap(bitmap,0)),12,TimeUnit.SECONDS);
            JSONArray lines=new JSONArray();int chars=0;boolean truncated=false;
            for(Text.TextBlock block:text.getTextBlocks())for(Text.Line line:block.getLines()) {
                String value=line.getText();Rect box=line.getBoundingBox();
                if(box==null||value.isBlank())continue;
                if(lines.length()>=48||chars+value.length()>6000){truncated=true;continue;}
                chars+=value.length();lines.put(Json.obj("text",value,"bounds",Json.obj("left",box.left,"top",box.top,"right",box.right,"bottom",box.bottom)));
            }
            JSONArray regions=new JSONArray();
            if(coordinateWidth>0&&coordinateHeight>0)for(int i=0;i<Math.min(anchors.length(),4);i++) {
                JSONObject anchor=anchors.getJSONObject(i),b=anchor.getJSONObject("bounds");
                double sx=(double)bitmap.getWidth()/coordinateWidth,sy=(double)bitmap.getHeight()/coordinateHeight;
                int left=(int)Math.ceil(b.getInt("right")*sx),top=Math.max(0,(int)(b.getInt("top")*sy)-4),height=(int)((b.getInt("bottom")-b.getInt("top"))*sy)+8;
                int width=Math.min(bitmap.getWidth()-left,Math.max(120,height*8));height=Math.min(height,bitmap.getHeight()-top);
                if(left<0||width<20||height<8||height>bitmap.getHeight()/8)continue;
                Bitmap crop=Bitmap.createBitmap(bitmap,left,top,width,height);
                try {
                    String value=Tasks.await(recognizer.process(InputImage.fromBitmap(crop,0)),8,TimeUnit.SECONDS).getText().trim();
                    if(value.matches("[0-9][0-9,]*(\\.[0-9]{1,2})?"))regions.put(Json.obj("currency",anchor.getString("currency"),"amountText",value,"bounds",Json.obj("left",left,"top",top,"right",left+width,"bottom",top+height),"currencyBounds",b));
                }finally{crop.recycle();}
            }
            StringBuilder hash=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(image))hash.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
            return Json.obj("engine","mlkit-latin","snapshotId",snapshotId,"capturedAt",capturedAt,"imageSha256",hash.toString(),"width",bitmap.getWidth(),"height",bitmap.getHeight(),"lines",lines,"currencyRegions",regions,"truncated",truncated,"onDevice",true);
        }finally{bitmap.recycle();releaseWhenIdle();}
    }
}
