package dev.pocket.agent;

import android.content.Context;
import android.os.Process;
import android.util.Log;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Last-resort resident-memory protection independent of the Node owner thread.
 * If native V8 allocations wedge that thread, JavaScript cancellation cannot run.
 * The runtime checkpoints on every meaningful state transition; Android can then
 * safely reclaim this isolated process rather than losing the entire device.
 */
final class RuntimeMemoryGuard implements AutoCloseable {
    static final long WARNING_KB = 700L * 1024;
    static final long EMERGENCY_KB = 1000L * 1024;
    static final long SAMPLE_DELAY_MS = 500;
    private final Context context;
    private final AtomicBoolean closed = new AtomicBoolean();
    private final Thread watcher;
    private int consecutiveWarnings;

    RuntimeMemoryGuard(Context context) {
        this.context = context.getApplicationContext();
        watcher = new Thread(this::run, "PocketMemoryGuard");
        watcher.setDaemon(true);
        watcher.start();
    }

    static long parseVmRssKb(String line) {
        if (line == null || !line.startsWith("VmRSS:")) return -1;
        String[] words = line.substring(6).trim().split("\\s+");
        if (words.length != 2 || !words[1].equals("kB")) return -1;
        try {
            long value = Long.parseLong(words[0]);
            return value >= 0 ? value : -1;
        } catch (NumberFormatException invalid) {
            return -1;
        }
    }

    static boolean mustStop(long rssKb, int consecutiveHighReadings) {
        return rssKb >= EMERGENCY_KB
            || (rssKb >= WARNING_KB && consecutiveHighReadings >= 2);
    }

    private static long readRssKb() {
        try (BufferedReader reader = new BufferedReader(new FileReader("/proc/self/status"))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("VmRSS:")) return parseVmRssKb(line);
            }
        } catch (IOException ignored) { }
        return -1;
    }

    private void run() {
        while (!closed.get()) {
            long rssKb = readRssKb();
            if (rssKb >= WARNING_KB) consecutiveWarnings++;
            else consecutiveWarnings = 0;
            if (mustStop(rssKb, consecutiveWarnings)) {
                Log.e("PocketMemoryGuard", "Resident memory safety limit exceeded: " + rssKb + " KB");
                try {
                    context.getSharedPreferences("memory-guard", Context.MODE_PRIVATE).edit()
                        .putLong("lastIncidentAt", System.currentTimeMillis())
                        .putLong("lastRssKb", rssKb).commit();
                } catch (RuntimeException failure) {
                    Log.e("PocketMemoryGuard", "Could not persist memory warning", failure);
                }
                // Do not wait for the potentially wedged Javet/Node/UI event loop.
                Process.killProcess(Process.myPid());
                return;
            }
            try { Thread.sleep(SAMPLE_DELAY_MS); }
            catch (InterruptedException interrupted) { Thread.currentThread().interrupt();return; }
        }
    }

    @Override public void close() {
        closed.set(true);
        watcher.interrupt();
    }
}
