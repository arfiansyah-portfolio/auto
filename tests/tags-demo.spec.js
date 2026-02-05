import { test, expect } from "@automate/playwright";

test("PXX-101: Login Success @smoke @critical", async ({ page, step }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-101" });
    await step("Open Login Page", async () => {
        await page.goto("https://playwright.dev");
    });
    await step("Login", async () => {
        // Mock login
        console.log("Logged in successfully");
    });
});

test("PXX-102: User Registration @regression @auth", async ({ page, step }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-102" });
    // Intentionally fail to test 'Failed' filter
    await step("Register", async () => {
        throw new Error("Registration API timeout");
    });
});

test("PXX-103: API Health Check @api @smoke", async ({ step }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-103" });
    await step("Check Health", async () => {
        console.log("Health OK");
    });
});

test("PXX-104: UI Layout Check @ui @regression", async ({ page, step }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-104" });
    await step("Verify Layout", async () => {
        await page.goto("https://playwright.dev");
        await expect(page).toHaveTitle(/Playwright/);
    });
});
