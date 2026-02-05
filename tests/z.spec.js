import { test, expect } from "../fixture/index";
// PXX-32: Failure in Step 1 (Step 2 should be skipped)
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