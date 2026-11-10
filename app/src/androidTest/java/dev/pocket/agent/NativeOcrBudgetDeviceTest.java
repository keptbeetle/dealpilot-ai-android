package dev.pocket.agent;

import static org.junit.Assert.assertEquals;
import org.json.JSONObject;
import org.junit.Test;

public final class NativeOcrBudgetDeviceTest {
    @Test public void modelCannotRequestAnOversizedOcrFrame() throws Exception {
        assertEquals(1280, NativeTools.boundedScreenshotDimension(
            new JSONObject().put("include_ocr",true).put("max_image_dimension",1800)));
        assertEquals(1280, NativeTools.boundedScreenshotDimension(
            new JSONObject().put("include_ocr",true).put("max_image_dimension",4096)));
        assertEquals(960, NativeTools.boundedScreenshotDimension(
            new JSONObject().put("include_ocr",true).put("max_image_dimension",960)));
        assertEquals(1280, NativeTools.boundedScreenshotDimension(
            new JSONObject().put("include_ocr",true)));
    }

    @Test public void ordinaryScreenshotsKeepTheirExistingDimension() throws Exception {
        assertEquals(1600,NativeTools.boundedScreenshotDimension(
            new JSONObject().put("include_ocr",false).put("max_image_dimension",1600)));
        assertEquals(1280,NativeTools.boundedScreenshotDimension(new JSONObject()));
    }
}
