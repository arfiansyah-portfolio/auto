import fs from "fs";
import path from "path";
import { test, expect, xrayStep } from "../features/index.js";

// Ensure output dir exists for evidence creation
if (!fs.existsSync("test-results")) {
    fs.mkdirSync("test-results", { recursive: true });
}

test("PXX-10: Multiple evidences demo", async ({ page }, testInfo) => {
    await xrayStep(
        testInfo,
        "Step 1: Login and capture logs",
        async () => {
            // await page.goto("https://example.com/login");
            console.log("Executing Step 1 with extra log evidence...");

            // Create log file
            const logPath = path.join("test-results", "login-log.txt");
            fs.writeFileSync(logPath, "Login attempt: " + new Date());

            // await page.fill("#email", "test@example.com");
        },
        page,
        {
            captureScreenshot: true,
            additionalEvidences: [
                path.join("test-results", "login-log.txt")
            ]
        }
    );

    await xrayStep(testInfo, "Step 2: Regular step", async () => {
        console.log("Just a normal step.");
    }, page);
});

test("PXX-11: Auto-skip failure demo", async ({ page }, testInfo) => {
    // Steps 1-2: PASS ✅
    await xrayStep(testInfo, "Step 1: Initial Setup", async () => {
        console.log("Step 1 passing...");
    }, page);

    await xrayStep(testInfo, "Step 2: Navigation", async () => {
        console.log("Step 2 passing...");
    }, page);

    // Step 3: FAIL ❌
    await xrayStep(testInfo, "Step 3: Will fail to demonstrate skip", async () => {
        console.log("Step 3 failing now!");
        // Force a failure
        expect(true).toBe(false);
        // OR: await expect(page.locator("#invalid")).toBeVisible();
    }, page);

    // Steps 4-5: AUTO-SKIPPED ⏭️
    await xrayStep(testInfo, "Step 4: Should be skipped", async () => {
        console.log("❌ This should NOT print!");
        throw new Error("This step should have been skipped!");
    }, page);

    await xrayStep(testInfo, "Step 5: Also skipped", async () => {
        console.log("❌ This should NOT print!");
    }, page);
});
