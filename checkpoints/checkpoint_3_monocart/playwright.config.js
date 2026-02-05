import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: "./tests",
    fullyParallel: false, // Important: keep false for stability with global array if strict ordering needed, but Xray API batching doesn't require sequential tests. 
    // However, prompts said "Batch upload all results in a single API call", which usually implies waiting for all parallel implementations.
    // global.xrayTestResults array *might* have race conditions in parallel mode if not handled carefully, 
    // but Array.push is generally atomic enough in JS event loop. 
    // BUT the prompt explicitly asked for "fullyParallel: false" in specs.

    globalTeardown: "./config/global-teardown.js", // ⭐ CRITICAL
    reporter: [
        ['list'],
        ['monocart-reporter', {
            name: "Automated Test Report",
            outputFile: "test-results/report.html",
            visitor: (data, metadata) => {
                // Filter out "Before Hooks" and "After Hooks"
                // if (data.type === 'case' && data.steps) {
                //     data.steps = data.steps.filter(step => {
                //         const title = (step.title || "").toString();
                //         // console.log("Checking step:", title); // Debugging
                //         return title !== "Before Hooks" && title !== "After Hooks";
                //     });
                // }
                if (data.category === 'hook') {
                    return false; // Menginstruksikan reporter untuk mengabaikan node ini
                }

                // 2. Jika kamu ingin menghilangkan step internal Playwright lainnya (seperti fixture)
                if (data.type === 'step' && data.title && data.title.includes('fixture:')) {
                    return false;
                }
            }
        }]
    ],
    use: {
        screenshot: "on",
        video: "off", // User requested to exclude video
    },
});
