import { test, expect } from "../fixture/index";
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