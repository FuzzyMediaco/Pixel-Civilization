package app.pixelcivilization.game;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import org.json.*;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import android.content.res.AssetManager;

/** A release's index is installed only after its files have been downloaded and verified. */
final class OfflineEdition {
    static final String ORIGIN = "https://pixelcivilization.app";
    private final AssetManager assets;
    private final File folder;
    private final SharedPreferences prefs;
    private final Index bundled, active;

    static final class Entry {
        final String path, hash;
        final int size;
        Entry(JSONObject item) throws Exception {
            path = item.getString("path");
            hash = item.getString("sha256");
            size = item.getInt("size");
            List<String> segments=Arrays.asList(path.split("/", -1));
            if (!path.matches("[A-Za-z0-9._ /@+~-]+") || segments.contains("") || segments.contains(".") ||
                segments.contains("..") || !hash.matches("[a-f0-9]{64}") ||
                size < 0 || size > 64 * 1024 * 1024) throw new IOException("Invalid offline asset");
        }
    }
    static final class Index {
        final String release;
        final long generation;
        final Map<String,Entry> paths = new LinkedHashMap<>();
        Index(byte[] bytes) throws Exception {
            JSONObject json = new JSONObject(new String(bytes,"UTF-8"));
            release = json.getString("release");
            generation = json.getLong("generation");
            JSONArray arr = json.getJSONArray("files");
            if (json.getInt("format") != 1 || generation<1 || !release.matches("[a-f0-9]{64}") || arr.length() > 10000) throw new IOException("Unsupported edition");
            long total = 0;
            for (int i = 0; i < arr.length(); i++) {
                Entry e = new Entry(arr.getJSONObject(i));
                if (paths.put(e.path,e) != null) throw new IOException("Duplicate asset");
                total += e.size;
            }
            if (!paths.containsKey("index.html") || total > 512L * 1024 * 1024) throw new IOException("Incomplete edition");
        }
    }
    OfflineEdition(Context ctx) throws Exception {
        assets = ctx.getAssets();
        folder = new File(ctx.getFilesDir(),"editions");
        if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("Cannot open editions");
        prefs = ctx.getSharedPreferences("edition", Context.MODE_PRIVATE);
        try (InputStream s = bundledFile("offline-index.json")) { bundled = new Index(read(s, 2*1024*1024)); }
        Index selected = bundled;
        String saved = prefs.getString("release","");
        // A new APK's own verified assets supersede a cached edition from the previous APK.
        if (bundled.release.equals(prefs.getString("base","")) && saved.matches("[a-f0-9]{64}")) {
            try (InputStream s = new FileInputStream(new File(folder,"index-"+saved))) {
                Index candidate = new Index(read(s,2*1024*1024));
                if (candidate.release.equals(saved) && candidate.generation>=bundled.generation && available(candidate)) selected = candidate;
            } catch (Exception ex) { Log.w("PixelCivilization","Using bundled edition"); }
        }
        active = selected;
    }
    private boolean bundled(Entry e) {
        Entry built = bundled.paths.get(e.path);
        return built != null && e.hash.equals(built.hash);
    }
    private boolean available(Index index) {
        for (Entry e : index.paths.values()) {
            File f = new File(folder,e.hash);
            if (!bundled(e) && (!f.isFile() || f.length()!=e.size)) return false;
        }
        return true;
    }
    private InputStream bundledFile(String path) throws IOException {
        return assets.open("web/"+path);
    }
    InputStream file(String path) throws IOException {
        Entry e = active.paths.get(path);
        if (e == null && !path.contains(".")) e = active.paths.get(path+".html");
        if (e == null) return null;
        return bundled(e) ? bundledFile(e.path) : new FileInputStream(new File(folder,e.hash));
    }
    static byte[] read(InputStream stream,int limit) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        byte[] buf = new byte[32768];
        int n;
        while ((n=stream.read(buf))!=-1) {
            if (bytes.size()+n > limit) throw new IOException("Response too large");
            bytes.write(buf,0,n);
        }
        return bytes.toByteArray();
    }
    private static byte[] download(String path,String revision,int limit) throws Exception {
        String route=path.equals("index.html") ? "" : (path.endsWith(".html") ? path.substring(0,path.length()-5) : path);
        URI uri = new URI("https","pixelcivilization.app","/"+route,revision.isEmpty()?null:"edition="+revision,null);
        HttpURLConnection conn=(HttpURLConnection)uri.toURL().openConnection();
        conn.setConnectTimeout(6000); conn.setReadTimeout(15000); conn.setUseCaches(false); conn.setInstanceFollowRedirects(false);
        try {
            if (conn.getResponseCode()!=200) throw new IOException("Edition unavailable");
            try (InputStream stream=conn.getInputStream()) { return read(stream,limit); }
        } finally { conn.disconnect(); }
    }
    private static String digest(byte[] bytes) throws Exception {
        StringBuilder hex=new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(bytes)) {
            hex.append(Character.forDigit((b&255)>>>4,16)); hex.append(Character.forDigit(b&15,16));
        }
        return hex.toString();
    }
    private void put(File target,byte[] bytes) throws IOException {
        File temp=File.createTempFile("pending-",".tmp",folder);
        try {
            try(FileOutputStream out=new FileOutputStream(temp)){out.write(bytes);out.getFD().sync();}
            java.nio.file.Files.move(temp.toPath(),target.toPath(),java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } finally { temp.delete(); }
    }
    boolean update() throws Exception {
        byte[] bytes=download("offline-index.json","",2*1024*1024);
        Index next=new Index(bytes);
        if (next.release.equals(active.release) || next.generation<=active.generation) { clean(active); return false; }
        for(Entry e:next.paths.values()) {
            if (bundled(e)) continue;
            File to=new File(folder,e.hash);
            if (to.isFile() && to.length()==e.size) continue;
            byte[] asset=download(e.path,next.release,e.size);
            if (asset.length!=e.size || !digest(asset).equals(e.hash)) throw new IOException("Changed or incomplete asset");
            put(to,asset);
        }
        put(new File(folder,"index-"+next.release),bytes);
        if (!prefs.edit().putString("base",bundled.release).putString("release",next.release).commit()) throw new IOException("Cannot activate edition");
        clean(active,next);
        return true;
    }
    private void clean(Index... keep) {
        Set<String> names=new HashSet<>();
        for(Index i:keep) {
            names.add("index-"+i.release);
            for(Entry e:i.paths.values()) if(!bundled(e)) names.add(e.hash);
        }
        File[] files=folder.listFiles();
        if(files!=null) for(File f:files) if(!names.contains(f.getName()) && (f.getName().matches("(index-)?[a-f0-9]{64}") || f.getName().startsWith("pending-"))) f.delete();
    }
}
