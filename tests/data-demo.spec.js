import { test, expect } from "@automate/playwright";

test("PXX-200: Test with JSON Data @data", async ({ step, snap }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-200" });

    // Scenario: Attaching test data at the start
    await snap("Input Configuration", {
        userType: "Admin",
        environment: "Staging",
        features: ["auth", "billing"]
    });

    await step("Step 1: Perform Action", async () => {
        console.log("Action performed using config");
    });

    // Scenario: API Response during test
    await step("Step 2: API Call", async () => {
        await snap("API Response Payload", {
            id: 123,
            status: "SUCCESS",
            timestamp: new Date().toISOString()
        });
    });
});
