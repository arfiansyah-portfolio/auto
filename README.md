# Playwright x Xray Integration

This project implements a seamless integration between Playwright and Xray Cloud (Jira). It automatically collects results, captures screenshots, and uploads data, while also providing robust options for manual export.

## 🎯 Key Features

-   **Dual Mode Export**:
    -   **Auto-Upload**: Results are uploaded to Xray via API.
    -   **Manual Export**: A timestamped JSON file is *always* generated as a backup.
-   **Smart Evidence**:
    -   **Auto Screenshots**: Captures screenshots automatically before/after every step.
    -   **Rich Attachments**: Support for logs, JSON data, and custom text via `snap` fixture.
-   **Bundled Reporting**:
    -   Generates a beautiful **Single File HTML Report**.
    -   Automatically bundles the report with the manual JSON files in `manual-reports/timestamp/`.
-   **Advanced Mapping**:
    -   Control Test Execution Keys via `.env` lists.
    -   Define smart custom summaries for auto-created executions.

## 🚀 Quick Start

### 1. Configure Environment (`.env`)
Create a `.env` file in your root directory:

```properties
# --- Xray Integration ---
# ON = Auto Upload to Jira
# OFF = Skip Upload (Only Generate Manual JSON)
UPLOAD_JIRA=ON

# Xray API Credentials
XRAY_CLIENT_ID=your_client_id
XRAY_CLIENT_SECRET=your_client_secret

# Default Project Info
XRAY_PROJECT_KEY=PXX
XRAY_TEST_PLAN_KEY=PXX-10

# --- Advanced Mapping (Optional) ---
# Map specific spec files to existing executions (Alphabetical Order of Spec Files)
XRAY_TEST_EXECUTION_KEY=PXX-79,PXX-80,PXX-81

# Smart Custom Summary for NEW Executions
# This list is consumed sequentially ONLY by specs that are NOT mapped to an existing execution above.
XRAY_TEST_SUMMARY="Automated Login Tests","Payment Gateway Checks"

# --- Jira Attachment Upload (Optional) ---
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_USERNAME=your_email@example.com
JIRA_API_TOKEN=your_jira_api_token
```

### 2. Run Tests
```bash
npx playwright test
```

## 🛠️ Writing Tests

Use the custom fixtures provided by `registerXray`: `step`, `snap`, and standard `page`.

```javascript
import { test, expect } from '../fixture/index';

// PXX-31: Multiple Evidence (Screenshot + Text in one step)
test("PXX-31: Multiple Evidence", async ({ page, step, snap }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-31" });

    await step("Step 1: Open Home", async () => {
        await page.goto("https://playwright.dev/");
        
        // Manual Snap: Capture specific element
        const btn = page.getByRole('link', { name: 'Get started' });
        await snap("get-started-button", btn);

        // Manual Snap: Capture Log
        await snap("pxx31-log", "Visited homepage");
    });

    await step("Step 2: Check Title", async () => {
        await expect(page).toHaveTitle(/Playwright/);
    });
});

// PXX-32: Force Fail Example
test("PXX-32: Force Fail Step 1", async ({ page, step }) => {
    test.info().annotations.push({ type: "test_key", description: "PXX-32" });

    await step("Step 1: Fail Here", async () => {
        await page.goto("https://playwright.dev/");
        console.log("❌ Failing Step 1 intentionally");
        expect(true).toBe(false); // Xray will mark this step as FAILED
    });

    await step("Step 2: Should Be Skipped", async () => {
        // This step will not run, mirroring Xray behavior
        await page.getByRole("link", { name: "Get started" }).click();
    });
});
```

## 📂 Output Artifacts

After a run, check the `manual-reports/` directory.

### Manual Reports (Bundled)
Located in `manual-reports/ddmmyyyyHHmmss/`.
Everything you need for a specific run is in one folder:

```
manual-reports/
└── 04022026092945/
    ├── report.html        <-- Rich HTML Dashboard
    ├── xray-batch.json    <-- Batch Results (Manual Import)
    └── steps-demo.json    <-- Demo Results (Manual Import)
```

## 🧩 Project Structure

| File | Purpose |
| :--- | :--- |
| `fixture/xray-fixtures.js` | Core logic. Defines `step`, `snap` fixtures and result collection. |
| `utils/xray-helper.js` | API Client. Handles Authentication and Upload logic. |
| `single-html-reporter.js` | Custom Reporter. Generates the self-contained HTML report. |
| `config/global-teardown.js` | Lifecycle Hook. Triggers the export/upload process at the end of the run. |
