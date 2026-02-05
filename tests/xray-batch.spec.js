import { test, expect } from "@automate/playwright";

// PXX-31: Multiple Evidence (Screenshot + Text in one step)
test("PXX-31: Multiple Evidence", async ({ page, step, snap }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-31" });

    await step("Step 1: Open Home", async () => {
        await page.goto("https://playwright.dev/");

        // Example: Snap ONLY the "Get started" button
        const getStartedBtn = page.getByRole('link', { name: 'Get started' });
        await snap("get-started-button", getStartedBtn);

        await snap("pxx31-log", "Visited homepage");
        await snap("pxx31-extra-screen", page);
    });

    await step("Step 2: Check Title", async () => {
        await expect(page).toHaveTitle(/Playwright/);
    });
});

// PXX-32: Failure in Step 1 (Step 2 should be skipped)
test("PXX-32: Force Fail Step 1", async ({ page, step }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-32" });

    await step("Step 1: Fail Here", async () => {
        await page.goto("https://playwright.dev/");
        console.log("❌ Failing Step 1 intentionally");
        expect(true).toBe(false);
    });

    await step("Step 2: Should Be Skipped", async () => {
        console.log("This should not run");
        await page.getByRole("link", { name: "Get started" }).click();
    });
});

// PXX-33: Failure in Step 2 (Step 1 Passes)
test("PXX-33: Force Fail Step 2", async ({ page, step }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-33" });

    await step("Step 1: Pass Here", async () => {
        await page.goto("https://playwright.dev/");
    });

    await step("Step 2: Fail Here", async () => {
        console.log("❌ Failing Step 2 intentionally");
        // Looking for non-existent element
        await expect(page.getByRole("button", { name: "NonExistent" })).toBeVisible({ timeout: 1000 });
    });
});

// PXX-34: All Snap Types (JSON, Text, Screenshot)
test("PXX-34: JSON, Text, and Screenshot Snaps", async ({ page, step, snap }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-34" });

    await step("Step 1: Snap Everything", async () => {
        await page.goto("https://playwright.dev/");

        // 1. Text
        await snap("pxx34-text", "Capturing rich evidence...");

        // 2. JSON
        const apiResponse = { status: 200, body: { id: 99, name: "Tester" } };
        await snap("pxx34-json", apiResponse);

        // 3. Screenshot
        await snap("pxx34-screen", page);
    });

    await step("Step 2: Finish", async () => {
        await expect(page).toHaveTitle(/Playwright/);
    });
});

// PXX-35: No Explicit Evidence (Default Auto-Screenshots only)
test("PXX-35: Default Behavior", async ({ page, step }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-35" });

    await step("Step 1: Action", async () => {
        await page.goto("https://playwright.dev/");
    });

    await step("Step 2: Assert", async () => {
        await expect(page).toHaveTitle(/Playwright/);
    });
});

// PXX-36: Disable Auto-Screenshot
test("PXX-36: No Auto-Screenshot", async ({ page, step, snap }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-36" });

    await step("Step 1: Log Only", async () => {
        await page.goto("https://playwright.dev/");
        await snap("pxx36-manual-only", "Auto-screenshot is disabled for this step.");
    }, { captureScreenshot: false });

    await step("Step 2: Normal Step", async () => {
        // This will still have auto-screenshot
        await expect(page).toHaveTitle(/Playwright/);
    });
});

// PXX-37: Manual Screenshot Only (Disable Auto)
test("PXX-37: Manual Snap Only", async ({ page, step, snap }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-37" });

    await step("Step 1: Custom Screenshot", async () => {
        await page.goto("https://playwright.dev/");
        // Disable auto 'success' screenshot, but take a manual one with a specific name
        await snap("pxx37-custom-name", page);
    }, { captureScreenshot: false });

    await step("Step 2: Verify", async () => {
        await expect(page).toHaveTitle(/Playwright/);
    });
});

// PXX-38: JSON Only
test("PXX-38: JSON Data Only", async ({ page, step, snap }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-38" });

    await step("Step 1: API Simulation", async () => {
        const config = { env: "staging", attempts: 3, verified: true };
        await snap("pxx38-config", config);
    }, { captureScreenshot: false });

    await step("Step 2: UI Check", async () => {
        await page.goto("https://playwright.dev/");
    });
});

// PXX-39: Single Step Pass
test("PXX-39: Single Step", async ({ page, step }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-39" });

    await step("Step 1: One and Done", async () => {
        await page.goto("https://playwright.dev/");
        await expect(page).toHaveTitle(/Playwright/);
    });
});

// PXX-40: Mixed Success
test("PXX-40: Mixed Features", async ({ page, step, snap }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-40" });

    await step("Step 1: Text Snap", async () => {
        await page.goto("https://playwright.dev/");
        await snap("pxx40-audit", "Audit complete.");
    });

    await step("Step 2: JSON Snap", async () => {
        await snap("pxx40-metrics", { loadTime: "120ms", status: "OK" });
    });
});
