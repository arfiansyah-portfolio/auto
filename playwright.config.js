import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: "./tests",
    fullyParallel: false, // Important: keep false for stability with global array if strict ordering needed, but Xray API batching doesn't require sequential tests. 
    // However, prompts said "Batch upload all results in a single API call", which usually implies waiting for all parallel implementations.
    // global.xrayTestResults array *might* have race conditions in parallel mode if not handled carefully, 
    // but Array.push is generally atomic enough in JS event loop. 
    // BUT the prompt explicitly asked for "fullyParallel: false" in specs.

    globalTeardown: "./config/global-teardown.js", // ⭐ CRITICAL
    // ... (bagian atas tetap sama)
    reporter: [
        ['list'],
        ['./single-html-reporter.js', { outputFile: 'custom-report/index.html' }]
    ],
    use: {
        screenshot: "on",
        video: "off", // User requested to exclude video
    },
});
