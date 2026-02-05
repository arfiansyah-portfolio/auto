// import { test as base, expect } from '@playwright/test'; // Not needed anymore
import { expect } from '@playwright/test';
import { XrayHelper } from '@automate/utils';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const RESULTS_DIR = path.resolve('.xray-results');

if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

global.xrayTestResults = global.xrayTestResults || [];

const xrayHelper = new XrayHelper({
    clientId: process.env.XRAY_CLIENT_ID,
    clientSecret: process.env.XRAY_CLIENT_SECRET,
    testExecutionKey: process.env.XRAY_TEST_EXECUTION_KEY,
    testPlanKey: process.env.XRAY_TEST_PLAN_KEY,
    projectKey: process.env.XRAY_PROJECT_KEY
});

function extractXrayKey(title) {
    const match = title.match(/^([A-Z]+-\d+):/);
    return match ? match[1] : null;
}

/**
 * Helper to snap evidence (screenshot or text log)
 */
export async function snap(testInfo, name, contentOrPage) {
    const outputDir = "test-results";
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const safeName = name.replace(/[^a-z0-9.-]/gi, '_');

    let filePath;

    if (typeof contentOrPage === 'string') {
        // Text Log
        filePath = path.join(outputDir, `${safeName}.txt`);
        fs.writeFileSync(filePath, contentOrPage);
        console.log(`📝 Snapped log: ${name}`);
    } else if (contentOrPage && typeof contentOrPage.screenshot === 'function') {
        // Screenshot
        filePath = path.join(outputDir, `${safeName}.png`);
        await contentOrPage.screenshot({ path: filePath });
        console.log(`📸 Snapped screenshot: ${name}`);
    } else if (typeof contentOrPage === 'object') {
        // JSON Object
        filePath = path.join(outputDir, `${safeName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(contentOrPage, null, 2));
        console.log(`📦 Snapped JSON: ${name}`);
    }

    if (filePath && testInfo.activeXrayStep) {
        testInfo.activeXrayStep.extractedEvidences.push(filePath);
    }

    return filePath;
}

/**
 * Internal logic for executing a step (Decoupled from fixture for clarity)
 */
async function executeXrayStep(testInfo, stepName, stepFunction, page, options = {}) {
    const { captureScreenshot = true, additionalEvidences = [], screenshotOptions = {} } = options;

    if (!testInfo.steps) testInfo.steps = [];

    if (testInfo.steps.some(s => s.status === 'FAILED')) {
        console.log(`⏭️  Skipping step: "${stepName}" (previous step failed)`);
        testInfo.steps.push({ status: "TODO", actualResult: `${stepName} (Skipped)`, evidences: [] });
        return;
    }

    console.log(`📍 ${stepName}`);

    const currentStepContext = { extractedEvidences: [] };
    testInfo.activeXrayStep = currentStepContext;

    const stepResult = { status: "PASSED", actualResult: stepName, evidences: [] };

    try {
        await stepFunction();

        if (captureScreenshot && page) {
            try {
                const screenshotBuffer = await page.screenshot(screenshotOptions);
                stepResult.evidences.push({
                    data: screenshotBuffer.toString('base64'),
                    filename: `step-${testInfo.steps.length + 1}-success.png`,
                    contentType: 'image/png'
                });
            } catch (e) {
                console.warn('   ⚠️ Failed to capture success screenshot:', e.message);
            }
        }
    } catch (error) {
        console.log(`❌ Step failed: "${stepName}"`);
        stepResult.status = "FAILED";
        stepResult.actualResult = `${stepName} - FAILED: ${error.message}`;

        if (page) {
            try {
                const screenshotBuffer = await page.screenshot({ ...screenshotOptions, fullPage: true });
                stepResult.evidences.push({
                    data: screenshotBuffer.toString('base64'),
                    filename: `step-${testInfo.steps.length + 1}-failure.png`,
                    contentType: 'image/png'
                });
            } catch (e) {
                console.warn('   ⚠️ Failed to capture failure screenshot:', e.message);
            }
        }
        testInfo.activeXrayStep = null;
        testInfo.steps.push(stepResult);
        throw error;
    }

    testInfo.activeXrayStep = null;

    const allFilePaths = [...additionalEvidences, ...currentStepContext.extractedEvidences];
    const uniquePaths = [...new Set(allFilePaths)];

    if (uniquePaths.length > 0) {
        for (const filePath of uniquePaths) {
            const evidence = await xrayHelper.createEvidence(filePath);
            if (evidence) stepResult.evidences.push(evidence);
        }
    }

    testInfo.steps.push(stepResult);
}

/**
 * Upload function to be called in global teardown
 */
/**
 * Upload function to be called in global teardown
 */
export async function uploadToXray() {
    let testResults = [];

    if (fs.existsSync(RESULTS_DIR)) {
        const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const content = fs.readFileSync(path.join(RESULTS_DIR, file), 'utf8');
                testResults.push(JSON.parse(content));
            } catch (e) {
                console.error(`Error reading result file ${file}:`, e);
            }
        }
    }

    if (testResults.length === 0 && global.xrayTestResults && global.xrayTestResults.length > 0) {
        testResults = global.xrayTestResults;
    }

    if (testResults.length === 0) {
        console.log('ℹ️ No Xray test results to upload.');
        return;
    }

    // Chunking Logic for Large Scale Tests
    // Reduced to 20 to handle tests with many steps/screenshots safely
    const BATCH_SIZE = 20;
    let currentExecutionKey = xrayHelper.testExecutionKey;

    console.log(`📦 Processing ${testResults.length} results in chunks of ${BATCH_SIZE}...`);

    for (let i = 0; i < testResults.length; i += BATCH_SIZE) {
        const chunk = testResults.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(testResults.length / BATCH_SIZE);

        console.log(`   🔄 Uploading Batch ${batchNum}/${totalBatches} (${chunk.length} tests)...`);

        // If we captured a key from a previous batch (or had one in Env), use it to APPEND
        if (currentExecutionKey) {
            xrayHelper.testExecutionKey = currentExecutionKey;
            // Also clear creation-only fields to avoid "Linking loop" or errors
            if (xrayHelper.testPlanKey) delete xrayHelper.testPlanKey;
            if (xrayHelper.projectKey) delete xrayHelper.projectKey;
        }

        try {
            const response = await xrayHelper.uploadResults(chunk);

            // Capture the Key from the first batch if we didn't start with one
            if (response && response.key && !currentExecutionKey) {
                currentExecutionKey = response.key;
                console.log(`   ⚓️ Secured Test Execution Key: ${currentExecutionKey}`);
                console.log(`   ℹ️  Subsequent batches will be appended to this execution.`);
            }
        } catch (err) {
            console.error(`   ❌ Failed to upload Batch ${batchNum}. Continuing to next...`);
        }
    }

    if (fs.existsSync(RESULTS_DIR)) {
        fs.rmSync(RESULTS_DIR, { recursive: true, force: true });
    }
    global.xrayTestResults = [];
}

/**
 * Extended test fixture
 */
/**
 * Registers Xray fixtures to the global test object
 * @param {Object} globals - Contains test, selectors, expect
 */
export const registerXray = (globals) => {
    const { test } = globals;

    const newTest = test.extend({
        autoTestContext: [async ({ }, use, testInfo) => {
            testInfo.steps = [];
            testInfo.testStartTime = new Date();
            await use();

            // Result Collection Logic
            const xrayTestKey = extractXrayKey(testInfo.title);
            if (!xrayTestKey) return;

            const endTime = new Date();
            const durationMs = endTime - testInfo.testStartTime;
            const minutes = Math.floor(durationMs / 60000);
            const seconds = Math.floor((durationMs % 60000) / 1000);
            const status = testInfo.status === "passed" ? "PASSED" : "FAILED";

            const testResult = {
                testKey: xrayTestKey,
                start: testInfo.testStartTime.toISOString(),
                finish: endTime.toISOString(),
                status: status,
                comment: testInfo.error
                    ? `${testInfo.error.message}\n\n⏱️ Duration: ${minutes}m ${seconds}s`
                    : `Test completed successfully\n⏱️ Duration: ${minutes}m ${seconds}s`,
                steps: testInfo.steps || []
            };

            console.log(`✅ Test result collected: ${xrayTestKey} - ${status} (${minutes}m ${seconds}s)`);

            const safeKey = xrayTestKey.replace(/[^a-z0-9]/gi, '_');
            const filename = path.join(RESULTS_DIR, `result-${safeKey}-${Date.now()}.json`);
            fs.writeFileSync(filename, JSON.stringify(testResult, null, 2));

            global.xrayTestResults.push(testResult);
        }, { auto: true }],

        xrayStep: async ({ page }, use, testInfo) => {
            await use(async (name, fn, options) => {
                await executeXrayStep(testInfo, name, fn, page, options);
            });
        },

        step: async ({ page }, use, testInfo) => {
            await use(async (name, fn, options) => {
                await executeXrayStep(testInfo, name, fn, page, options);
            });
        },

        snap: async ({ }, use, testInfo) => {
            await use(async (name, content) => {
                return await snap(testInfo, name, content);
            });
        }
    });

    return { ...globals, test: newTest };
};
