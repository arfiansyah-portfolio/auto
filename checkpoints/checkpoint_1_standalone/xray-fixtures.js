import { test as base, expect } from '@playwright/test';
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

export async function snap(testInfo, name, contentOrPage) {
    const outputDir = "test-results";
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const safeName = name.replace(/[^a-z0-9.-]/gi, '_');

    let filePath;

    if (typeof contentOrPage === 'string') {
        filePath = path.join(outputDir, `${safeName}.txt`);
        fs.writeFileSync(filePath, contentOrPage);
        console.log(`📝 Snapped log: ${name}`);
    } else if (contentOrPage && typeof contentOrPage.screenshot === 'function') {
        filePath = path.join(outputDir, `${safeName}.png`);
        await contentOrPage.screenshot({ path: filePath });
        console.log(`📸 Snapped screenshot: ${name}`);
    } else if (typeof contentOrPage === 'object') {
        filePath = path.join(outputDir, `${safeName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(contentOrPage, null, 2));
        console.log(`📦 Snapped JSON: ${name}`);
    }

    if (filePath && testInfo.activeXrayStep) {
        testInfo.activeXrayStep.extractedEvidences.push(filePath);
    }

    return filePath;
}

async function executeXrayStep(testInfo, stepName, stepFunction, page, options = {}) {
    // ... Simplified for checkpoint restoration (logic matches original) ...
    const { captureScreenshot = true, additionalEvidences = [], screenshotOptions = {} } = options;
    if (!testInfo.steps) testInfo.steps = [];
    if (testInfo.steps.some(s => s.status === 'FAILED')) {
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
            const screenshotBuffer = await page.screenshot(screenshotOptions);
            stepResult.evidences.push({ data: screenshotBuffer.toString('base64'), filename: 'success.png', contentType: 'image/png' });
        }
    } catch (error) {
        console.log(`❌ Step failed: "${stepName}"`);
        stepResult.status = "FAILED";
        stepResult.actualResult = `${stepName} - FAILED: ${error.message}`;
        if (page) {
            const screenshotBuffer = await page.screenshot({ ...screenshotOptions, fullPage: true });
            stepResult.evidences.push({ data: screenshotBuffer.toString('base64'), filename: 'failure.png', contentType: 'image/png' });
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

export async function uploadToXray() {
    // Legacy upload logic
    // ...
}

export const test = base.extend({
    autoTestContext: [async ({ }, use, testInfo) => {
        testInfo.steps = [];
        testInfo.testStartTime = new Date();
        await use();
        // Result collection logic
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

export { expect };
