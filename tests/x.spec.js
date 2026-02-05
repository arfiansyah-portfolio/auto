import { test, expect } from "../fixture/index";

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