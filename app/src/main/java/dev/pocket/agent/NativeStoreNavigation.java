package dev.pocket.agent;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import java.util.Locale;

/** Package-bound retailer links; no implicit browser fallback. */
final class NativeStoreNavigation {
    static String store(Uri uri) {
        String host=uri.getHost();if(host==null)return null;host=host.toLowerCase(Locale.ROOT);
        if(host.equals("amazon.in")||host.endsWith(".amazon.in")||host.equals("amazon.com")||host.endsWith(".amazon.com"))return "amazon";
        if(host.equals("flipkart.com")||host.endsWith(".flipkart.com"))return "flipkart";
        return null;
    }
    static boolean matches(String store,String pkg) {
        return "amazon".equals(store)?("in.amazon.mShop.android.shopping".equals(pkg)||"com.amazon.mShop.android.shopping".equals(pkg)):"flipkart".equals(store)&&"com.flipkart.android".equals(pkg);
    }
    static boolean packageKnown(String pkg) {return matches("amazon",pkg)||matches("flipkart",pkg);}
    static boolean privateSessionAllowed(String pkg,int displayId,DisplayTaskSnapshot snapshot) {
        return snapshot.hasPackageRecords()&&!snapshot.packageOutside(pkg,displayId);
    }
    static Intent intent(Uri uri,String pkg) {
        if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getUserInfo()!=null||(uri.getPort()!=-1&&uri.getPort()!=443)||!matches(store(uri),pkg)||uri.toString().length()>2048)
            throw new IllegalArgumentException("Store URL must be HTTPS and belong to its selected native package");
        return new Intent(Intent.ACTION_VIEW,uri).setPackage(pkg);
    }
    static String installedPackage(Context context,String store) {
        String[] packages="amazon".equals(store)?new String[]{"in.amazon.mShop.android.shopping","com.amazon.mShop.android.shopping"}:"flipkart".equals(store)?new String[]{"com.flipkart.android"}:new String[0];
        for(String pkg:packages)if(context.getPackageManager().getLaunchIntentForPackage(pkg)!=null)return pkg;
        return null;
    }
}
