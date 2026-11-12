package dev.pocket.agent;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import java.util.concurrent.TimeUnit;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import okhttp3.*;
import org.json.JSONObject;

/** Paired loopback development host. Buyer bearer never enters model credentials. */
final class ShoppingConnection {
    private static final String ALIAS="pocket-shopping-host-v1";
    private static SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(store.containsAlias(ALIAS))return (SecretKey)store.getKey(ALIAS,null);
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());return generator.generateKey();
    }
    private static JSONObject saved(Context c,String slot) throws Exception {
        String envelope=c.getSharedPreferences("shopping-host",0).getString(slot,null);
        if(envelope==null)throw new IllegalStateException(slot.equals("remote")?"Set up your PayPal checkout connection first.":"Pair the Windows shopping host first.");
        JSONObject e=new JSONObject(envelope);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(e.getString("iv"),Base64.NO_WRAP)));
        return new JSONObject(new String(cipher.doFinal(Base64.decode(e.getString("data"),Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8));
    }
    private static void save(Context c,JSONObject value,String slot) throws Exception {
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
        JSONObject envelope=new JSONObject().put("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).put("data",Base64.encodeToString(cipher.doFinal(value.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)),Base64.NO_WRAP));
        if(!c.getSharedPreferences("shopping-host",0).edit().putString(slot,envelope.toString()).commit())throw new IllegalStateException("Could not save paired host.");
    }
    static void handle(Context context,String action,JSONObject body,PocketWebUi.Reply reply){
        if(!java.util.Set.of("pair","state","chat","action","new","history").contains(action)){reply.complete(null,"Unknown shopping action");return;}
        new Thread(()->{
            try {
                JSONObject connection=action.equals("pair")?new JSONObject().put("port",body.getInt("port")):saved(context,"connection");
                int port=connection.getInt("port");if(port<1024||port>65535)throw new IllegalArgumentException("Invalid local host port");
                String kind=action.equals("pair")?"connect":action;
                JSONObject payload=action.equals("pair")?new JSONObject().put("native",true).put("code",body.optString("code")):body;
                // Research/model turns can exceed OkHttp's default ten-second read timeout.
                // Retain a bounded call while allowing the host's ninety-second turn to finish.
                OkHttpClient client=new OkHttpClient.Builder().followRedirects(false).followSslRedirects(false).connectTimeout(10,TimeUnit.SECONDS).readTimeout(95,TimeUnit.SECONDS).callTimeout(95,TimeUnit.SECONDS).build();
                Request.Builder request=new Request.Builder().url("http://127.0.0.1:"+port+"/api/shop/"+kind).header("x-pocket-request","1").post(RequestBody.create(payload.toString(),MediaType.get("application/json")));
                if(!action.equals("pair"))request.header("Authorization","Bearer "+connection.getString("bearer"));
                try(Response response=client.newCall(request.build()).execute()){
                    if(response.body()==null)throw new IllegalStateException("Host returned no response");
                    try(java.io.InputStream input=response.body().byteStream();java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream()){
                        byte[] chunk=new byte[8192];int n;while((n=input.read(chunk))!=-1){if(output.size()+n>512000)throw new IllegalStateException("Host response too large");output.write(chunk,0,n);}
                        JSONObject result=new JSONObject(output.toString("UTF-8"));
                        if(!response.isSuccessful())throw new IllegalStateException(result.optString("error","Host request failed"));
                        if(action.equals("pair")){String bearer=result.getString("bearer");if(!bearer.matches("[A-Za-z0-9_-]{43}"))throw new IllegalStateException("Invalid pairing response");connection.put("bearer",bearer);save(context,connection,"connection");result.remove("bearer");}
                        reply.complete(result,null);
                    }
                }
            }catch(Exception failure){reply.complete(null,failure instanceof IllegalStateException||failure instanceof IllegalArgumentException?failure.getMessage():"Shopping host unavailable. Restore status before retrying payment.");}
        },"pocket-shopping-host").start();
    }
    static void openPayPal(Context context,String raw){
        Uri uri=Uri.parse(raw);
        if(!"https".equals(uri.getScheme())||!"www.sandbox.paypal.com".equalsIgnoreCase(uri.getHost())||uri.getUserInfo()!=null||uri.getPort()!=-1)throw new IllegalArgumentException("Only the verified PayPal Sandbox checkout page can be opened.");
        context.startActivity(new Intent(Intent.ACTION_VIEW,uri));
    }
}
