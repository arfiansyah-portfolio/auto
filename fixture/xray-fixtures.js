import { expect, test } from '@playwright/test';
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

// Helper to strip ANSI and special chars (Moved to top level)
const stripAnsi = (str) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

/**
 * Snap fixture: Captures evidence (Screenshot, JSON, Text)
 */
export async function snap(testInfo, name, contentOrPage, page = null) {
    const outputDir = testInfo.outputDir;
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    let filePath;
    const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    if (typeof contentOrPage === 'string') {
        // Text Log
        filePath = path.join(outputDir, `${safeName}.txt`);
        fs.writeFileSync(filePath, contentOrPage);
        console.log(`📝 Snapped log: ${name}`);
        await testInfo.attach(name, { path: filePath, contentType: 'text/plain' });

    } else if (contentOrPage && typeof contentOrPage.screenshot === 'function') {
        // Screenshot - Attach as raw PNG for custom reporter to handle
        const buffer = await contentOrPage.screenshot();
        console.log(`📸 Snapped screenshot: ${name}`);
        await test.info().attach(name, { body: buffer, contentType: 'image/png' });

    } else if (typeof contentOrPage === 'object') {
        // JSON Object
        filePath = path.join(outputDir, `${safeName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(contentOrPage, null, 2));
        console.log(`📦 Snapped JSON: ${name}`);
        await testInfo.attach(name, { path: filePath, contentType: 'application/json' });

    } else if (typeof contentOrPage === 'function') {
        // Function Step - Execute then Screenshot
        await contentOrPage(); // Run the passed function (expectations, actions)

        if (page) {
            const buffer = await page.screenshot();
            console.log(`📸 Snapped screenshot (auto): ${name}`);
            await test.info().attach(name, { body: buffer, contentType: 'image/png' });
        } else {
            console.warn(`⚠️ Snap: "${name}" provided a function but 'page' was not available to screenshot.`);
        }
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
    // Wrap entire execution in Playwright's test.step for reporting
    await test.step(stepName, async () => {
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

                    // Attach as raw PNG
                    await test.info().attach(`step-${testInfo.steps.length + 1}-success-after`, {
                        body: screenshotBuffer,
                        contentType: 'image/png'
                    });

                } catch (e) {
                    console.warn('   ⚠️ Failed to capture success screenshot:', e.message);
                }
            }
        } catch (error) {
            console.log(`❌ Step failed: "${stepName}"`);
            stepResult.status = "FAILED";
            // Applying stripAnsi here for Clean Actual Result
            stepResult.actualResult = `${stepName} - FAILED: ${stripAnsi(error.message)}`;

            if (page) {
                try {
                    const screenshotBuffer = await page.screenshot({ ...screenshotOptions, fullPage: true });
                    stepResult.evidences.push({
                        data: screenshotBuffer.toString('base64'),
                        filename: `step-${testInfo.steps.length + 1}-failure.png`,
                        contentType: 'image/png'
                    });

                    // Attach as raw PNG
                    await test.info().attach(`step-${testInfo.steps.length + 1}-failure`, {
                        body: screenshotBuffer,
                        contentType: 'image/png'
                    });

                } catch (e) {
                    console.warn('   ⚠️ Failed to capture failure screenshot:', e.message);
                }
            }
            // Push the FAILED result before throwing
            // Also attach any evidences collected so far
            currentStepContext.extractedEvidences.forEach(evPath => {
                try {
                    const content = fs.readFileSync(evPath);
                    const isJson = evPath.endsWith('.json');
                    stepResult.evidences.push({
                        data: content.toString('base64'),
                        filename: path.basename(evPath),
                        contentType: isJson ? 'application/json' : 'text/plain'
                    });
                } catch (ignore) { }
            });

            const allFilePaths = [...additionalEvidences, ...currentStepContext.extractedEvidences];
            const uniquePaths = [...new Set(allFilePaths)];

            uniquePaths.forEach(filePath => {
                if (!currentStepContext.extractedEvidences.includes(filePath)) { // Avoid doubles
                    try {
                        const content = fs.readFileSync(filePath);
                        stepResult.evidences.push({
                            data: content.toString('base64'),
                            filename: path.basename(filePath),
                            contentType: 'application/octet-stream'
                        });
                    } catch (e) { }
                }
            });

            testInfo.steps.push(stepResult);
            delete testInfo.activeXrayStep;

            throw error; // Re-throw to fail the Playwright test
        }

        // Attach specialized evidences (snapshots) - Success Path
        currentStepContext.extractedEvidences.forEach(evPath => {
            try {
                const content = fs.readFileSync(evPath);
                // Simple heuristic for content type
                const isJson = evPath.endsWith('.json');
                stepResult.evidences.push({
                    data: content.toString('base64'),
                    filename: path.basename(evPath),
                    contentType: isJson ? 'application/json' : 'text/plain'
                });
            } catch (ignore) { }
        });

        const allFilePaths = [...additionalEvidences, ...currentStepContext.extractedEvidences];
        const uniquePaths = [...new Set(allFilePaths)];

        uniquePaths.forEach(filePath => {
            if (!currentStepContext.extractedEvidences.includes(filePath)) {
                try {
                    const content = fs.readFileSync(filePath);
                    stepResult.evidences.push({
                        data: content.toString('base64'),
                        filename: path.basename(filePath),
                        contentType: 'application/octet-stream'
                    });
                } catch (e) { }
            }
        });

        testInfo.steps.push(stepResult);
        delete testInfo.activeXrayStep;
    });
}

/**
 * Upload function to be called in global teardown
 */
/**
 * Upload function to be called in global teardown
 */
export async function uploadToXray() {
    let testResults = [];
    let grouped = {};

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

    if (testResults.length > 0) {
        console.log(`📦 Generating manual import files for ${testResults.length} results...`);

        // Ensure manual-reports directory exists
        const MANUAL_DIR = path.resolve('manual-reports');
        if (!fs.existsSync(MANUAL_DIR)) {
            fs.mkdirSync(MANUAL_DIR);
        }

        // Create Timestamp Folder (ddmmyyyyHHmmss)
        const date = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const day = pad(date.getDate());
        const month = pad(date.getMonth() + 1); // Months are 0-indexed
        const year = date.getFullYear();
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());

        const timestamp = `${day}${month}${year}${hours}${minutes}${seconds}`;
        const REPORT_DIR = path.join(MANUAL_DIR, timestamp);
        fs.mkdirSync(REPORT_DIR);

        // Group by spec file
        grouped = {};
        testResults.forEach(r => {
            const specName = r._specFile || 'consolidated.json';
            const cleanName = specName.replace(/\.(spec\.)?js$/, '') + '.json';
            if (!grouped[cleanName]) grouped[cleanName] = [];

            // Create a clean copy without internal fields for the report
            const cleanResult = { ...r };
            delete cleanResult._specFile;
            grouped[cleanName].push(cleanResult);
        });

        // Save individual files
        for (const [filename, results] of Object.entries(grouped)) {
            const manualReport = {
                info: {
                    summary: `Manual Test Export - ${date.toISOString()}`,
                    description: `Generated by Playwright for Manual Xray Import (${filename})`,
                    project: process.env.XRAY_PROJECT_KEY,
                    testPlanKey: process.env.XRAY_TEST_PLAN_KEY
                },
                tests: results
            };

            // Clean undefined info fields
            if (!manualReport.info.project) delete manualReport.info.project;
            if (!manualReport.info.testPlanKey) delete manualReport.info.testPlanKey;

            const reportPath = path.join(REPORT_DIR, filename);
            fs.writeFileSync(reportPath, JSON.stringify(manualReport, null, 2));
            console.log(`✅ Manual report generated: ${reportPath} (${results.length} tests)`);
        }

        // Moving Custom HTML Report (if exists)
        const htmlReportSource = path.join(process.cwd(), 'custom-report', 'index.html');
        if (fs.existsSync(htmlReportSource)) {
            const htmlReportDest = path.join(REPORT_DIR, 'report.html');
            try {
                // MOVE (Rename) instead of Copy
                fs.renameSync(htmlReportSource, htmlReportDest);
                console.log(`✅ HTML Report moved to: ${htmlReportDest}`);

                // Cleanup: Remove the source directory if empty
                const sourceDir = path.dirname(htmlReportSource);
                if (fs.readdirSync(sourceDir).length === 0) {
                    fs.rmdirSync(sourceDir);
                }
            } catch (e) {
                console.error(`⚠️ Failed to move HTML report: ${e.message}`);
            }
        }

        console.log(`👉 You can upload these files to Xray via "Import Execution Results"`);
    }

    // ... (Manual Report Generation Logic above remains) ... 

    if (process.env.UPLOAD_JIRA !== 'ON') {
        console.log('ℹ️  Skipping Xray upload (UPLOAD_JIRA is not "on")');
        // Clean up fragments
        if (fs.existsSync(RESULTS_DIR)) {
            fs.rmSync(RESULTS_DIR, { recursive: true, force: true });
        }
        global.xrayTestResults = [];
        return;
    }

    console.log(`🚀 Starting Auto-Upload for ${Object.keys(grouped).length} spec files...`);

    // 1. Parse Execution Keys from Env (e.g., "PXX-1,PXX-5" or JSON array)
    let executionKeys = [];
    const rawKeys = process.env.XRAY_TEST_EXECUTION_KEY;
    if (rawKeys) {
        if (rawKeys.startsWith('[') && rawKeys.endsWith(']')) {
            try {
                executionKeys = JSON.parse(rawKeys);
            } catch (e) {
                executionKeys = rawKeys.replace(/[\[\]]/g, '').split(',').map(k => k.trim());
            }
            try {
                executionKeys = JSON.parse(rawKeys);
            } catch (e) {
                executionKeys = rawKeys.replace(/[\[\]]/g, '').split(',').map(k => k.trim().replace(/^["']|["']$/g, ''));
            }
        } else {
            // Handle "Key1","Key2" format
            executionKeys = rawKeys.split(',').map(k => k.trim().replace(/^["']|["']$/g, ''));
        }
    }

    // 2. Parse Test Summary Mapping from Env (new feature)
    let summaryKeys = [];
    const rawSummaries = process.env.XRAY_TEST_SUMMARY;
    if (rawSummaries) {
        if (rawSummaries.startsWith('[') && rawSummaries.endsWith(']')) {
            try {
                summaryKeys = JSON.parse(rawSummaries);
            } catch (e) {
                summaryKeys = rawSummaries.replace(/[\[\]]/g, '').split(',').map(k => k.trim().replace(/^["']|["']$/g, ''));
            }
        } else {
            // Handle "Summary 1","Summary 2" format
            summaryKeys = rawSummaries.split(',').map(k => k.trim().replace(/^["']|["']$/g, ''));
        }
    }

    // 3. Sort Spec Files Alphabetically for Deterministic Mapping
    const sortedSpecs = Object.keys(grouped).sort();

    // Counter for New Executions (to map Summaries sequentially)
    let newExecutionCounter = 0;

    // Iterate over sorted specs
    for (let index = 0; index < sortedSpecs.length; index++) {
        const filename = sortedSpecs[index];
        const groupResults = grouped[filename];

        console.log(`\n📄 Processing Spec [${index + 1}]: ${filename} (${groupResults.length} tests)`);

        // Clean internal fields
        const cleanResults = groupResults.map(r => {
            const c = { ...r };
            delete c._specFile;
            delete c._targetExecutionKey;
            return c;
        });

        const BATCH_SIZE = 20;

        // 4. Map Spec Index to Execution Key
        let currentExecutionKey = null;
        let currentSummary = null;

        if (index < executionKeys.length) {
            currentExecutionKey = executionKeys[index];
        }

        if (currentExecutionKey) {
            console.log(`   🎯 Mapped to Existing Execution: ${currentExecutionKey}`);
            // Existing execution: Do not assign a custom summary (it already has one)
        } else {
            console.log(`   ✨ No mapping found. Creating NEW Execution.`);
            // New Execution: Consume the next available Custom Summary
            if (newExecutionCounter < summaryKeys.length) {
                currentSummary = summaryKeys[newExecutionCounter];
                newExecutionCounter++; // Move to next summary for the next new execution
                console.log(`      📝 Using Custom Summary: "${currentSummary}"`);
            }
        }

        for (let i = 0; i < cleanResults.length; i += BATCH_SIZE) {
            const chunk = cleanResults.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(cleanResults.length / BATCH_SIZE);

            console.log(`   🔄 Uploading Batch ${batchNum}/${totalBatches}...`);

            xrayHelper.testExecutionKey = currentExecutionKey;

            // Apply Custom Summary (only affects NEW executions)
            if (currentSummary) {
                xrayHelper.customSummary = currentSummary;
            } else {
                delete xrayHelper.customSummary;
            }

            // Critical: If overriding with an existing key, we MUST NOT send project/plan info 
            // to avoid overwriting the existing execution's summary or causing link errors.
            // XrayHelper logic needs to know this. 
            // We'll manage it by setting/unsetting properties on the helper instance.

            if (currentExecutionKey) {
                // Existing: Clear creation info
                if (xrayHelper.testPlanKey) delete xrayHelper.testPlanKey;
                if (xrayHelper.projectKey) delete xrayHelper.projectKey;
            } else {
                // New: Restore creation info
                xrayHelper.projectKey = process.env.XRAY_PROJECT_KEY;
                xrayHelper.testPlanKey = process.env.XRAY_TEST_PLAN_KEY;
            }

            try {
                const response = await xrayHelper.uploadResults(chunk);
                if (response && response.key && !currentExecutionKey) {
                    currentExecutionKey = response.key;
                    console.log(`   ⚓️ Secured Test Execution Key: ${currentExecutionKey}`);
                }
            } catch (err) {
                console.error(`   ❌ Failed to upload batch.`);
            }
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



            // Check for Custom Execution Key Annotation
            const executionAnnotation = testInfo.annotations.find(a => a.type === 'xray_execution');
            const targetExecutionKey = executionAnnotation ? executionAnnotation.description : null;

            const testResult = {
                testKey: xrayTestKey,
                start: testInfo.testStartTime.toISOString(),
                finish: endTime.toISOString(),
                status: status,
                comment: testInfo.error
                    ? `${stripAnsi(testInfo.error.message)}\n\n⏱️ Duration: ${minutes}m ${seconds}s`
                    : `Test completed successfully\n⏱️ Duration: ${minutes}m ${seconds}s`,
                steps: testInfo.steps || [],
                _specFile: path.basename(testInfo.file), // Internal use for grouping
                _targetExecutionKey: targetExecutionKey // Internal: User specific target
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

        snap: async ({ page }, use, testInfo) => {
            await use(async (name, content) => {
                return await test.step(`Snap: ${name}`, async () => {
                    return await snap(testInfo, name, content, page);
                });
            });
        }
    });

    return { ...globals, test: newTest };
};
