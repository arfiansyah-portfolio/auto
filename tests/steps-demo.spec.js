import { test, expect } from "@automate/playwright";

test("PXX-50: 10 Steps Demo Validation", async ({ page, step, snap }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-50" });

    await step('Step 1: Initialize', async () => {
        await page.goto('https://playwright.dev');
        console.log('Test started');
    });

    await snap('Step 2: Homepage Snapshot', async () => {
        await expect(page).toHaveTitle(/Playwright/);
    });

    await step('Step 3: Check Title', async () => {
        await expect(page).toHaveTitle(/Playwright/);
    });

    await snap('Step 4: Get Started Button', async () => {
        await expect(page.getByRole('link', { name: 'Get started' })).toBeVisible();
    });

    await step('Step 5: Navigate to Docs', async () => {
        await page.getByRole('link', { name: 'Get started' }).click();
    });

    await snap('Step 6: Docs Page', async () => {
        await expect(page).toHaveURL(/.*intro/);
    });

    await step('Step 7: Search Interaction', async () => {
        await expect(page.getByLabel('Search')).toBeVisible();
    });

    await snap('Step 8: Search Modal (Check)', async () => {
        await page.getByLabel('Search').click();
        await expect(page.locator('.DocSearch-Modal')).toBeVisible();
    });

    await step('Step 9: Close Search', async () => {
        await page.keyboard.press('Escape');
    });

    await snap('Step 10: Final State', async () => {
        console.log('Test completed');
    });
});
