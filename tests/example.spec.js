// tests/example.spec.js
import { test, expect, xrayStep } from "../features/index.js";

test("PXX-5: User can login successfully", async ({ page }, testInfo) => {

    await xrayStep(testInfo, "Step 1: Navigate to login page", async () => {
        // In a real app we'd go to a real URL. For demo, we use a dummy page
        // await page.goto("https://example.com/login");
        console.log("Navigating...");
    }, page);

    await xrayStep(testInfo, "Step 2: Enter credentials", async () => {
        // await page.fill("#email", "test@example.com");
        // await page.fill("#password", "password123");
        console.log("Entering credentials...");
    }, page);

    await xrayStep(testInfo, "Step 3: Submit form", async () => {
        // await page.click("#login-button");
        console.log("Submitting...");
    }, page);

    // Example of a failing check in a regular step or verification
    await xrayStep(testInfo, "Step 4: Verify dashboard", async () => {
        // await expect(page.locator(".dashboard")).toBeVisible();
        console.log("Verifying...");
        // Pass explicitly for this demo
        expect(true).toBe(true);
    }, page);
});
