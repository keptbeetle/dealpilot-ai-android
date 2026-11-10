package dev.pocket.agent;

import static org.junit.Assert.*;
import org.junit.Test;

/** Pure threshold and /proc parser checks; never launches the process-kill guard. */
public final class RuntimeMemoryGuardDeviceTest {
    @Test public void parsesOnlyValidResidentMemoryLines() {
        assertEquals(235000L, RuntimeMemoryGuard.parseVmRssKb("VmRSS:\t 235000 kB"));
        assertEquals(-1L, RuntimeMemoryGuard.parseVmRssKb("VmSize:\t1234 kB"));
        assertEquals(-1L, RuntimeMemoryGuard.parseVmRssKb("VmRSS: abc kB"));
        assertEquals(-1L, RuntimeMemoryGuard.parseVmRssKb("VmRSS: -2 kB"));
        assertEquals(-1L, RuntimeMemoryGuard.parseVmRssKb("VmRSS: 300 MB"));
    }

    @Test public void compactsOnlySustainedSoftPressureWithCooldown() {
        assertFalse(RuntimeMemoryGuard.shouldRequestCompaction(350L*1024,4,30_000));
        assertFalse(RuntimeMemoryGuard.shouldRequestCompaction(RuntimeMemoryGuard.SOFT_PRESSURE_KB,1,30_000));
        assertFalse(RuntimeMemoryGuard.shouldRequestCompaction(RuntimeMemoryGuard.SOFT_PRESSURE_KB,2,1_000));
        assertTrue(RuntimeMemoryGuard.shouldRequestCompaction(RuntimeMemoryGuard.SOFT_PRESSURE_KB,2,RuntimeMemoryGuard.COMPACTION_COOLDOWN_MS));
        assertTrue(RuntimeMemoryGuard.shouldRequestCompaction(610L*1024,3,60_000));
    }

    @Test public void allowsNormalWorkAndRejectsSustainedUnsafeRss() {
        assertFalse(RuntimeMemoryGuard.mustStop(250L * 1024, 0));
        assertFalse(RuntimeMemoryGuard.mustStop(RuntimeMemoryGuard.WARNING_KB, 1));
        assertTrue(RuntimeMemoryGuard.mustStop(RuntimeMemoryGuard.WARNING_KB, 2));
        assertTrue(RuntimeMemoryGuard.mustStop(RuntimeMemoryGuard.EMERGENCY_KB, 1));
    }
}
