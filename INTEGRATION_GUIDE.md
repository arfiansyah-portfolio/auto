# Playwright x Xray Integration Guide

This guide details how to integrate the **Xray Cloud Auto-Upload**, **Manual Export**, and **Custom HTML Reporter** into a real Playwright project.

## 1. Install Dependencies
You need the following packages for API requests and environment variables:

```bash
npm install dotenv axios form-data --save-dev
```

## 2. Copy Core Files
Copy the following files from this solution into your project. Maintain the folder structure for organization.

| Source | Destination Path | Purpose |
| :--- | :--- | :--- |
| `utils/xray-helper.js` | `utils/xray-helper.js` | Handles Xray API auth, upload, and attachments. |
| `fixture/xray-fixtures.js` | `fixture/xray-fixtures.js` | Custom fixtures (`snap`, `step`, `autoTestContext`) and Logic for collecting/exporting results. |
| `config/global-teardown.js` | `config/global-teardown.js` | Triggers the upload/export process after all tests finish. |
| `single-html-reporter.js` | `single-html-reporter.js` | Generates the beautiful Single File HTML Report. |

> **Note:** If you change the paths, ensure you update the `import` paths inside `xray-fixtures.js` and `global-teardown.js`.

## 3. Configure `playwright.config.js`
Update your config to register the reporter and global teardown.

```javascript
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  testDir: './tests',
  
  // 1. Register Global Teardown (CRITICAL for Export/Upload)
  globalTeardown: './config/global-teardown.js',

  // 2. Register Custom Reporter
  reporter: [
    ['list'],
    ['./single-html-reporter.js', { outputFile: 'custom-report/index.html' }]
  ],

  use: {
    screenshot: 'on', // Required for snapshots
    trace: 'retain-on-failure',
  },
});
```

## 4. Setup Environment Variables (`.env`)
Create a `.env` file in your root directory.

```properties
# --- Xray Integration ---
# ON = Auto Upload to Jira
# OFF = Skip Upload (Only Generate Manual JSON)
UPLOAD_JIRA=OFF

# Xray API Credentials (from Xray Settings > API Keys)
XRAY_CLIENT_ID=your_client_id
XRAY_CLIENT_SECRET=your_client_secret

# Target Execution Info (Optional - if blank, creates new)
XRAY_PROJECT_KEY=PXX
XRAY_TEST_PLAN_KEY=PXX-10

# --- Jira Attachment Upload (Optional) ---
# Required if you want screenshots attached to the execution in Jira
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_USERNAME=your_email@example.com
JIRA_API_TOKEN=your_jira_api_token
```

## 5. Register Fixtures
In your test files (or a central `fixture/index.js`), integrate the `xray-fixtures`.

**Option A: Central Fixture (Recommended)**
Create `fixture/index.js`:
```javascript
import { test as base } from '@playwright/test';
import { registerXray } from './xray-fixtures';

// Extend the base test with Xray capabilities
export const test = registerXray({ test: base });
export { expect } from '@playwright/test';
```

**Option B: Direct Usage in Spec**
```javascript
import { test as base, expect } from '@playwright/test';
import { registerXray } from '../fixture/xray-fixtures';

const test = registerXray({ test: base });
```

## 6. Writing Tests
Now write tests using the **Test Key** in the title (e.g., `PXX-31`) and use the `snap` and `step` fixtures.

```javascript
import { test, expect } from '../fixture/index';

test('PXX-31: Verify Login Page', async ({ page, step, snap }) => {
    
    await step('Step 1: Open Website', async () => {
        await page.goto('https://example.com');
    });

    await snap('Homepage Screenshot', async () => {
        await expect(page).toHaveTitle(/Example/);
    });

    // Manual Log Evidence
    await snap('Log Entry', 'Custom log message or API response data');
});
```

## 7. Execution & Results
Run your tests as usual:
```bash
npx playwright test
```

### What Happens Next?
1.  **Manual Reports**: 
    -   A folder `manual-reports/ddmmyyyyHHmmss/` is created.
    -   Inside, JSON files (e.g., `login.json`) are generated for manual import.
2.  **Auto Upload** (if `UPLOAD_JIRA=ON`):
    -   Results are automatically pushed to Xray.
    -   A new Test Execution is created (or appended to).
3.  **Custom Report**:
    -   Open `custom-report/index.html` to see the rich HTML report.
