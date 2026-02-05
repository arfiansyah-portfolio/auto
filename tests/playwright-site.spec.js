import { test, expect } from "@automate/playwright";

// TEST 1: PXX-5 (Step 1 FAIL)
test("PXX-5: Test Sesuai Skenario Jira (Fail Step 1)", async ({ page, xrayStep }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-5" });

    // --- STEP 1 (FAIL) ---
    await xrayStep("Step 1: Go To Playwright Page", async () => {
        await page.goto("https://playwright.dev/");
        console.log("❌ Forcing failure in Step 1...");
        expect(true).toBe(false); // Force fail
    });

    // --- STEP 2 (SKIPPED) ---
    await xrayStep("Step 2: Go To Installation Guide Line", async () => {
        await page.getByRole("link", { name: "Get started" }).click();
        await expect(page.getByRole("heading", { name: "Installation" })).toBeVisible();
    });
});

// TEST 2: PXX-2 (Step 1 PASS, Step 2 FAIL)
test("PXX-2: Test Step 2 Failure", async ({ page, xrayStep, snap }, testInfo) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-2" });

    // --- STEP 1 (PASS) ---
    await xrayStep("Step 1: Go To Playwright Page", async () => {
        await page.goto("https://playwright.dev/");
    });

    // --- STEP 2 (FAIL) ---
    const preSnap = await snap("pxx2-step2-pre", page);

    await xrayStep("Step 2: Verify Invalid Element", async () => {
        await page.getByRole("link", { name: "Get started" }).click();

        console.log("❌ Forcing failure in Step 2...");
        await expect(page.getByRole("heading", { name: "This Does Not Exist" })).toBeVisible({ timeout: 2000 });
    }, { additionalEvidences: [preSnap] });
});

// TEST 3: PXX-6 (2 Evidence Each Step)
test("PXX-6: Multi-Evidence Test", async ({ page, xrayStep, snap }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-6" });

    // --- STEP 1 ---
    await xrayStep("Step 1: Go To Playwright Page", async () => {
        await page.goto("https://playwright.dev/");
        await snap("pxx6-step1-log", "Step 1 visited: " + new Date().toISOString());
    });

    // --- STEP 2 ---
    await xrayStep("Step 2: Go To Get Started", async () => {
        await snap("pxx6-step2-pre", page);
        await page.getByRole("link", { name: "Get started" }).click();
        await expect(page.getByRole("heading", { name: "Installation" })).toBeVisible();
    });
});


// TEST 4: PXX-23 (Optional Page Argument)
test("PXX-23: Optional Page Argument", async ({ page, step, snap }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-23" });

    // Step without Page (Log only, no auto-screenshot)
    await step("Step 1: Log Info (No Screenshot)", async () => {
        console.log("Processing data...");
        await snap("pxx23-process-log", "Data processed successfully.");
    }, { captureScreenshot: false });

    // Step with Page (Standard)
    await step("Step 2: Visit Page", async () => {
        await page.goto("https://playwright.dev/");
    });
});

// TEST 5: PXX-26 (Snap Usages Demo)
test("PXX-26: Snap Usage Demo (Text, JSON, Screenshot)", async ({ page, xrayStep, snap }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-26" });

    await xrayStep("Step 1: Capture Multiple Types", async () => {
        await page.goto("https://playwright.dev/");
        await snap("demo-text", "This is a simple text log.");

        const data = { id: 123, status: "active", details: { checked: true } };
        await snap("demo-data", data);

        await snap("demo-screenshot", page);
    });
});
