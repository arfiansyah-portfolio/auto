import fs from 'fs';
import path from 'path';

// Helper to strip ANSI codes (colors)
function stripAnsi(str) {
    if (!str) return '';
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

class SingleHtmlReporter {
    constructor(options) {
        this.outputFile = options.outputFile || 'custom-report/index.html';
    }

    onBegin(config, suite) {
        this.config = config;
        this.suite = suite;
        this.results = [];
        this.startTime = Date.now();
    }

    onTestEnd(test, result) {
        // Collect test data
        const testData = {
            title: test.title,
            file: path.relative(process.cwd(), test.location.file),
            status: result.status, // Reverted line
            duration: result.duration,
            errors: result.errors,
            steps: [],
            attachments: []
        };

        // 1. Pre-Process All Attachments
        const processedAttachments = result.attachments.map(attachment => {
            let content = null;
            let type = attachment.contentType;

            if (attachment.path) {
                try {
                    if (fs.existsSync(attachment.path)) {
                        const buffer = fs.readFileSync(attachment.path);
                        if (type.startsWith('image/')) {
                            content = `data:${type};base64,${buffer.toString('base64')}`;
                        } else {
                            content = buffer.toString('utf-8');
                        }
                    }
                } catch (e) {
                    console.error(`Failed to read attachment: ${attachment.path}`);
                }
            } else if (attachment.body) {
                if (type.startsWith('image/')) {
                    content = `data:${type};base64,${attachment.body.toString('base64')}`;
                } else {
                    content = attachment.body.toString('utf-8');
                }
            }

            return {
                name: attachment.name,
                contentType: type,
                content: content
            };
        });

        // Mutable copy for consumption
        const unconsumedAttachments = [...processedAttachments];

        // 2. Process Steps & Link Attachments
        const processStep = (step) => {
            // Filter out system hooks if requested
            if (step.title.includes('Before Hooks') || step.title.includes('After Hooks')) {
                return null;
            }

            const stepData = {
                title: step.title,
                status: step.error ? 'failed' : 'passed',
                duration: step.duration,
                error: step.error,
                // Recurse first
                steps: (step.steps || []).map(processStep).filter(Boolean),
                attachment: null
            };

            // Match Attachments
            // 1. Strict Regex: Attach "NAME"
            const attachMatch = step.title.match(/Attach "([^"]+)"/);
            if (attachMatch) {
                const attName = attachMatch[1];
                const attIndex = unconsumedAttachments.findIndex(a => a.name === attName);
                if (attIndex !== -1) {
                    stepData.attachment = unconsumedAttachments[attIndex];
                    unconsumedAttachments.splice(attIndex, 1);
                }
            }
            // 2. Fuzzy Match: Step title contains attachment name (e.g., "Snap: my-img" matches "my-img")
            else {
                const bestMatchIndex = unconsumedAttachments.findIndex(a => {
                    // specific enough? avoid matching "log" in "dialog"
                    // Assume attachment names are deliberate.
                    return step.title.includes(a.name);
                });

                if (bestMatchIndex !== -1) {
                    stepData.attachment = unconsumedAttachments[bestMatchIndex];
                    unconsumedAttachments.splice(bestMatchIndex, 1);
                }
            }

            // Special Handling (Flattening) for "Snap: ..." Steps
            if (stepData.title.startsWith("Snap: ")) {
                const interestingLogs = [];

                // Deep search for interesting info in children before we delete them
                const extractInfo = (children) => {
                    for (const child of children) {
                        const t = child.title;
                        // IGNORE: "Screenshot" (the internal step), "Attach" (the attachment step)
                        // KEEP: "Navigate", "expect", "locator", "click", "fill", "press"
                        const isNoisy = t === "Screenshot" || t.startsWith("Attach");

                        if (!isNoisy && (t.includes("Screenshot") || t.includes("expect") || t.includes("locator") || t.includes("Navigate") || t.includes("click") || t.includes("fill") || t.includes("press") || t.includes("type"))) {
                            interestingLogs.push(t);
                        }
                        if (child.steps && child.steps.length) {
                            extractInfo(child.steps);
                        }
                    }
                };

                if (step.steps) extractInfo(step.steps);

                if (interestingLogs.length > 0) {
                    // dedupe and join
                    stepData.metaInfo = [...new Set(interestingLogs)].join(" | ");
                }

                // RECOVER ATTACHMENT: If we didn't find one via name match, check if a child has one
                if (!stepData.attachment && stepData.steps && stepData.steps.length > 0) {
                    // Try to find a child that has an attachment
                    const childWithAttachment = stepData.steps.find(child => child.attachment);
                    if (childWithAttachment) {
                        stepData.attachment = childWithAttachment.attachment;
                    }
                }

                // FLATTEN: Remove children, but keep the attachment we (hopefully) claimed via title match
                stepData.steps = [];
            }

            return stepData;
        };

        testData.steps = result.steps.map(processStep).filter(Boolean);

        // 3. Remaining attachments go to global list
        testData.attachments = unconsumedAttachments;

        this.results.push(testData);
    }

    onEnd(result) {
        const duration = Date.now() - this.startTime;
        const passed = this.results.filter(r => r.status === 'passed').length;
        const failed = this.results.filter(r => r.status === 'failed').length;
        const skipped = this.results.filter(r => r.status === 'skipped').length;

        // Environment Data
        const environment = {
            runDate: new Date().toISOString(),
            duration: duration,
            system: {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                playwrightVersion: '1.x' // Hard to get exact version at runtime without package.json, assume 1.x
            },
            config: {
                workers: this.config.workers,
                timeout: this.config.timeout,
                retries: this.config.projects[0]?.retries || 0, // Simplified
                baseURL: this.config.projects[0]?.use?.baseURL || 'N/A'
            },
            custom: {
                TEST_ENV: process.env.TEST_ENV || 'local',
                BROWSER: this.config.projects[0]?.name || 'default'
            }
        };

        // Sanitize Errors (Strip ANSI) before generating report
        this.results.forEach(test => {
            if (test.errors) {
                test.errors = test.errors.map(e => {
                    if (typeof e === 'string') return stripAnsi(e).trim();
                    if (e.message) e.message = stripAnsi(e.message).trim();
                    if (e.value) e.value = stripAnsi(e.value).trim();
                    return e;
                });
            }
            // Helper to recurse steps
            const cleanSteps = (steps) => {
                steps.forEach(step => {
                    if (step.error) {
                        if (step.error.message) step.error.message = stripAnsi(step.error.message).trim();
                        else if (typeof step.error === 'string') step.error = stripAnsi(step.error).trim();
                    }
                    if (step.steps) cleanSteps(step.steps);
                });
            };
            if (test.steps) cleanSteps(test.steps);
        });

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
      background: #f5f5f5; 
      color: #333; 
      overflow: hidden;
    }
    
    /* Header */
    .header { 
      background: #fff; 
      padding: 15px 20px; 
      border-bottom: 1px solid #e0e0e0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .header h1 { 
      font-size: 20px; 
      color: #2c3e50; 
      margin-bottom: 8px;
    }
    .summary { 
      font-size: 13px; 
      color: #666;
    }
    .badge { 
      display: inline-block;
      padding: 4px 10px; 
      border-radius: 4px; 
      color: #fff; 
      font-weight: 600; 
      margin-right: 8px; 
      font-size: 12px;
    }
    .badge.passed { background: #28a745; }
    .badge.failed { background: #dc3545; }
    .badge.skipped { background: #ffc107; color: #333; }
    
    .badge.skipped { background: #ffc107; color: #333; }
    
    /* Two Column Layout (Allure-like) */
    .container {
      display: flex;
      height: calc(100vh - 70px);
      overflow: hidden;
    }
    
    /* Left Panel - Test Cases List */
    .left-panel {
      width: 400px;
      min-width: 300px;
      background: #fff;
      border-right: 1px solid #e0e0e0;
      /* overflow-y: auto;  Moved to .test-list-container */
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
    }

    .sidebar-header-controls {
      padding: 15px;
      border-bottom: 1px solid #e0e0e0;
      background: #fff;
      z-index: 20;
    }

    .test-list-container {
        flex: 1;
        overflow-y: auto;
    }

    .search-input {
      width: 100%;
      padding: 8px 12px;
      margin-bottom: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
    }

    .filter-group {
      display: flex;
      gap: 5px;
      margin-bottom: 5px;
    }

    .filter-btn {
      flex: 1;
      padding: 6px 0;
      font-size: 11px;
      border: 1px solid #ddd;
      background: #f8f9fa;
      border-radius: 3px;
      cursor: pointer;
      color: #555;
      text-align: center;
      transition: all 0.2s;
    }

    .filter-btn:hover { background: #e9ecef; }
    .filter-btn.active { 
       background: #007bff; 
       color: #fff; 
       border-color: #007bff; 
       font-weight: bold;
    }
    
    .filter-btn[data-status="passed"].active { background: #28a745; border-color: #28a745; }
    .filter-btn[data-status="failed"].active { background: #dc3545; border-color: #dc3545; }
    .filter-btn[data-status="skipped"].active { background: #ffc107; border-color: #ffc107; color: #333;}
    
    .clear-filters-btn {
        width: 100%;
        margin-top: 5px;
        padding: 4px;
        background: none;
        border: none;
        color: #666;
        font-size: 11px;
        cursor: pointer;
        text-decoration: underline;
    }
    .clear-filters-btn:hover { color: #333; }
    
    .test-item {
      padding: 12px 15px;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
      transition: background 0.2s;
      border-left: 4px solid transparent;
    }
    
    .test-item:hover {
      background: #f0f0f0;
    }

    /* Tags */
    .tag {
      display: inline-block;
      padding: 2px 5px;
      font-size: 10px;
      border-radius: 3px;
      margin-right: 4px;
      margin-top: 3px;
      font-weight: 600;
      color: #fff;
      cursor: pointer;
      opacity: 0.9;
    }
    .tag:hover { opacity: 1; filter: brightness(1.1); }
    
    .test-tags-sidebar { display: flex; flex-wrap: wrap; margin-left: 0; }
    .test-tags-detail { margin-top: 5px; margin-bottom: 5px; }
    .test-tags-detail .tag { padding: 3px 8px; font-size: 11px; }

    .test-tags-detail .tag { padding: 3px 8px; font-size: 11px; }

    /* Environment Info */
    .env-toggle {
        font-size: 11px;
        color: #666;
        cursor: pointer;
        text-decoration: underline;
        margin-top: 10px;
        display: inline-block;
        padding: 5px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #fff;
    }
    .env-toggle:hover { background: #f0f0f0; }

    .env-container {
        display: none;
        background: #fff;
        border: 1px solid #e9ecef;
        padding: 15px;
        margin-top: 10px;
        border-radius: 6px;
        font-size: 12px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }
    .env-container.active { display: block; animation: fadeIn 0.3s; }
    
    .env-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
    }
    .env-group h5 { margin: 0 0 10px 0; color: #2c3e50; border-bottom: 2px solid #f0f0f0; padding-bottom: 5px; font-weight: 600;}
    .env-row { display: flex; justify-content: space-between; margin-bottom: 6px; border-bottom: 1px dashed #f5f5f5; padding-bottom: 2px;}
    .env-label { color: #888; }
    .env-val { font-family: Consolas, monospace; color: #333; font-weight: 500;}

    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }

    /* Suite Header - Distinct Style */
    .suite-header {
      padding: 12px 15px;
      background: #e9ecef;
      color: #2c3e50;
      font-weight: 700;
      font-size: 12px;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      margin-bottom: 8px;
      margin-top: 10px;
      margin-inline: 20px; /* Requested Spacing */
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .suite-header:hover {
      background: #dee2e6;
    }

    .suite-header .chevron {
      transition: transform 0.2s;
      font-size: 10px;
    }

    .suite-header.collapsed .chevron {
      transform: rotate(-90deg);
    }

    .suite-content {
      display: block;
      margin-inline: 20px; /* Requested Spacing */
    }

    .suite-content.hidden {
      display: none;
    }
    
    /* Test Item - Card Style Match Step Header */
    .test-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border: 1px solid #e0e0e0;
      border-radius: 6px; /* Requested */
      background: #fff;
      margin-bottom: 6px;
      cursor: pointer;
      transition: all 0.2s;
      border-left: 4px solid transparent; /* Prepare for status colors */
    }
    
    .test-item:hover {
      background: #f8f9fa;
      border-color: #d6d8db;
    }

    /* Status Colors for Sidebar Items */
    .test-item.passed {
      border-left-color: #28a745;
      background: #f8fff9;
    }
    
    .test-item.failed {
      border-left-color: #dc3545;
      background: #fff5f5;
    }

    .test-item.skipped {
      border-left-color: #ffc107;
      background: #fffbf0;
    }

    .test-item.skipped {
      border-left-color: #ffc107;
      background: #fffbf0;
    }
    


    /* Active State - Blue Glow but keep status border color if possible, or override? 
       User request implies status colors are key. 
       Let's keep the status border and add a blue outline/shadow for active. */
    .test-item.active {
      background: #e3f2fd; /* Light blue active bg overrides status bg */
      box-shadow: 0 0 0 1px #2196f3;
      border-color: #2196f3;
      /* If item is passed, border-left is green. If active, maybe we keep it green? 
         Or force blue? "border left if passed green" suggests green is permanent. 
         But 'active' usually highlights selection. 
         Let's try respecting status border even when active, but active bg takes precedence. */
    }
    
    .test-item-left {
        display: flex;
        align-items: center;
        gap: 10px;
        overflow: hidden;
        flex: 1;
    }
    
    /* Status Icons - Match step-status-icon */
    .test-status-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      flex-shrink: 0;
      font-size: 11px;
      font-weight: bold;
      color: white;
    }
    .test-status-icon.passed { background: #28a745; }
    .test-status-icon.passed::before { content: '✓'; }
    .test-status-icon.failed { background: #dc3545; }
    .test-status-icon.failed::before { content: '✕'; }
    .test-status-icon.skipped { background: #ffc107; color: #333; }
    .test-status-icon.skipped::before { content: '-'; }

    .test-item-title {
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #333;
    }
    
    .test-item-duration {
      font-size: 11px;
      color: #888;
      margin-left: 10px;
      flex-shrink: 0;
      font-family: monospace;
    }
    
    /* Right Panel - Test Details */
    .right-panel {
      flex: 1;
      background: #fff;
      overflow-y: auto;
      padding: 20px;
    }
    
    .test-detail-header {
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .test-detail-title {
      font-size: 24px;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 10px;
    }
    
    .test-detail-meta {
      display: flex;
      gap: 20px;
      font-size: 13px;
      color: #666;
    }
    
    .test-detail-meta span {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    /* Steps Section */
    .steps-section {
      margin-bottom: 25px;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .step {
      margin-bottom: 8px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      overflow: hidden;
      background: #fafafa;
    }
    
    /* Step status color coding */
    .step.step-passed {
      border-left: 3px solid #28a745;
      background: #f8fff9;
    }
    
    .step.step-failed {
      border-left: 3px solid #dc3545;
      background: #fff5f5;
    }
    
    .step-header {
      padding: 10px 15px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fff;
      transition: background 0.2s;
    }
    
    .step-header:hover {
      background: #f8f9fa;
    }
    
    .step-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
    }
    
    /* Professional Expand/Collapse Icon */
    /* Professional Expand/Collapse Icon */
    .step-expand-icon {
      font-size: 10px;
      color: #666;
      transition: transform 0.2s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px; /* Larger hit area */
      height: 20px;
      border-radius: 4px;
      background: transparent; /* Cleaner look */
      position: relative;
      flex-shrink: 0;
      cursor: pointer;
    }
    
    .step-expand-icon:hover {
        background: #eee;
    }
    
    .step-expand-icon::before {
      content: '▶'; /* Triangle Right */
      color: #777;
    }
    
    .step.expanded > .step-header .step-expand-icon {
       transform: rotate(90deg); /* Rotate for open state */
    }
    
    .step.expanded > .step-header .step-expand-icon::before {
       /* content remains triangle, rotation handles direction */
    }
    
    .step-expand-icon.hidden {
      visibility: hidden;
    }
    
    /* Step Status Icon */
    .step-status-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      flex-shrink: 0;
      font-size: 11px;
      font-weight: bold;
    }
    
    .step-status-icon.passed {
      background: #28a745;
      color: white;
    }
    
    .step-status-icon.passed::before {
      content: '✓';
    }
    
    .step-status-icon.failed {
      background: #dc3545;
      color: white;
    }
    
    .step-status-icon.failed::before {
      content: '✕';
    }
    
    .step-title {
      font-size: 13px;
      font-family: 'Consolas', 'Monaco', monospace;
      color: #333;
      flex: 1;
    }
    

    
    .step-duration {
      font-size: 11px;
      color: #888;
      margin-left: auto;
    }
    
    .step-body {
      display: none !important;
      padding: 8px 12px;
      margin-left: 10px; /* Reduced from default/nested accumulation */
      background: #fff;
    }
    
    .step.expanded > .step-body {
      display: block !important;
    }
    
    /* Nested steps */
    .step .step {
      margin-left: 20px;
      margin-top: 8px;
    }
    
    /* Error Messages - Highlight where error occurred */
    .error-section {
      margin-bottom: 25px;
    }
    
    .error-msg { 
      background: #fff5f5; 
      border: 1px solid #ffcdd2;
      border-left: 4px solid #dc3545;
      color: #c62828; 
      padding: 8px 12px; 
      border-radius: 6px; 
      margin-bottom: 8px;
      font-family: 'Consolas', 'Monaco', monospace; 
      font-size: 12px;
      line-height: 1.4;
    }
    
    .error-msg-title {
      font-weight: bold;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #d32f2f;
    }
    
    .error-location {
      background: #ffebee;
      border: 1px solid #ef9a9a;
      padding: 6px 10px;
      border-radius: 4px;
      margin-top: 6px;
      font-size: 11px;
      color: #c62828;
    }
    
    .error-location strong {
      color: #b71c1c;
    }
    
    /* Step Error Indicator */
    .step-error-inline {
      background: #ffebee;
      border: 1px solid #ef9a9a;
      border-radius: 4px;
      padding: 8px 12px;
      margin-left: 20px;
      margin-top: 10px;
      font-size: 12px;
      color: #c62828;
      font-family: 'Consolas', 'Monaco', monospace;
    }
    
    .step-error-inline strong {
      display: block;
      margin-bottom: 4px;
      color: #b71c1c;
    }
    
    /* Attachments */
    .attachments-section {
      margin-bottom: 25px;
    }
    
    .attachments-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 15px;
    }
    
    .attachment {
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      overflow: hidden;
      background: #fff;
      transition: box-shadow 0.2s;
    }
    
    .attachment:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    
    .attachment-label {
      font-size: 11px;
      font-weight: 600;
      color: #666;
      padding: 8px 10px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .attachment-content {
      padding: 10px;
    }
    
    .attachment img { 
      width: 100%;
      height: auto;
      max-height: 150px;
      object-fit: contain;
      cursor: pointer;
      transition: transform 0.2s;
      border-radius: 4px;
    }
    
    .attachment img:hover {
      transform: scale(1.05);
    }
    
    .attachment pre { 
      background: #f8f9fa; 
      padding: 10px; 
      border-radius: 4px; 
      overflow-x: auto; 
      font-size: 11px; 
      cursor: pointer;
      font-family: 'Consolas', 'Monaco', monospace;
      max-height: 150px;
      overflow-y: auto;
    }
    
    .attachment pre:hover {
      background: #fff;
    }
    
    /* Modals */
    .modal { 
      display: none; 
      position: fixed; 
      z-index: 9999; 
      left: 0; 
      top: 0; 
      width: 100%; 
      height: 100%; 
      overflow: auto; 
      background-color: rgba(0,0,0,0.9); 
    }
    
    .modal.active {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .modal-content { 
      margin: auto; 
      display: block; 
      max-width: 90%; 
      max-height: 90%;
      border-radius: 8px;
    }
    
    .close { 
      position: absolute; 
      top: 20px; 
      right: 35px; 
      color: #fff; 
      font-size: 50px; 
      font-weight: bold; 
      cursor: pointer;
      transition: color 0.2s;
      z-index: 10000;
    }
    
    .close:hover,
    .close:focus {
      color: #ccc;
    }
    
    .modal-text-content {
      margin: auto;
      display: block;
      width: 80%;
      max-width: 900px;
      background: #fff;
      padding: 25px;
      border-radius: 8px;
      max-height: 85vh;
      overflow: auto;
      white-space: pre-wrap;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
    }
    
    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #999;
    }
    
    .empty-state-icon {
      font-size: 64px;
      margin-bottom: 15px;
      opacity: 0.3;
    }
    
    /* Scrollbar Styling */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: #f1f1f1;
    }
    
    ::-webkit-scrollbar-thumb {
      background: #ccc;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: #aaa;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎭 Test Execution Report</h1>
    <div class="summary">
      <span class="badge passed">${passed} Passed</span>
      <span class="badge failed">${failed} Failed</span>
      <span class="badge skipped">${skipped} Skipped</span>
      <span style="color: #666; margin-left: 10px;">⏱️ Duration: ${(duration / 1000).toFixed(2)}s</span>
      <span style="color: #666; margin-left: 10px;">📊 Total: ${this.results.length}</span>
    </div>
      
      <div class="env-section-wrapper">
         <span class="env-toggle" onclick="toggleEnv()">🔧 View Environment Info</span>
         <div id="env-container" class="env-container">
             <!-- Env info loaded by JS -->
         </div>
      </div>
    </div>
  </div>

  <div class="container">
    <!-- Left Panel: Test Cases -->
    <div class="left-panel">
        <div class="sidebar-header-controls">
            <input type="text" id="searchInput" placeholder="Search tests..." class="search-input">
            <div class="filter-group" id="statusFilters">
                <button class="filter-btn active" data-status="all">All</button>
                <button class="filter-btn" data-status="passed">Passed</button>
                <button class="filter-btn" data-status="failed">Failed</button>
                <button class="filter-btn" data-status="skipped">Skipped</button>
            </div>
            <button id="clearFiltersBtn" class="clear-filters-btn" style="display: none;">Clear active filters</button>
        </div>
        <div id="testList" class="test-list-container">
            <!-- Test items will be rendered here by JavaScript -->
        </div>
    </div>

    <!-- Right Panel: Test Details -->
    <div class="right-panel" id="rightPanel">
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div>Select a test to view details</div>
      </div>
    </div>
  </div>

  <!-- Modal for Image Preview -->
  <div id="imgModal" class="modal">
    <span class="close" onclick="closeModal()">&times;</span>
    <img class="modal-content" id="img01">
  </div>

  <!-- Modal for Text Preview -->
  <div id="textModal" class="modal">
    <span class="close" onclick="closeTextModal()">&times;</span>
    <pre class="modal-text-content" id="text01"></pre>
  </div>

  <script>
    const tests = ${JSON.stringify(this.results)};
    const envData = ${JSON.stringify(environment)};
    let currentTestIndex = -1;

    function selectTest(index) {
      currentTestIndex = index;
      
      // Update active state
      document.querySelectorAll('.test-item').forEach(item => item.classList.remove('active'));
      document.getElementById('test-item-' + index).classList.add('active');
      
      // Render test details
      const test = tests[index];
      const rightPanel = document.getElementById('rightPanel');
      
      // Find which step failed
      const failedStep = findFailedStep(test.steps);
      const failedStepPath = failedStep ? getStepPath(test.steps, failedStep) : null;
      
      rightPanel.innerHTML = \`
        <div class="test-detail-header">
          <div class="test-detail-title">\${test.title}</div>
          <div class="test-tags-detail">
             \${(test.tags || []).map(tag => \`<span class="tag" style="background:\${getTagColor(tag)}" onclick="filterByTag('\${tag}')">\${tag}</span>\`).join('')}
          </div>
          <div class="test-detail-meta">
            <span>
              <span class="test-item-status \${test.status}"></span>
              Status: \${test.status.toUpperCase()}
            </span>
            <span>⏱️ Duration: \${test.duration}ms</span>
          </div>
        </div>

        \${test.errors && test.errors.length > 0 ? \`
          <div class="error-section">
            <div class="section-title">❌ Errors</div>
            \${test.errors.map(e => \`
              <div class="error-msg">
                <div class="error-msg-title">
                  <span style="font-size: 16px;">⚠️</span>
                  Error Message
                </div>
                <div>\${escapeHtml(e.message || e.value)}</div>
                \${failedStepPath ? \`
                  <div class="error-location">
                    <strong>📍 Error occurred at:</strong><br/>
                    \${failedStepPath}
                  </div>
                \` : ''}
              </div>
            \`).join('')}
          </div>
        \` : ''}



        \${test.steps && test.steps.length > 0 ? \`
          <div class="steps-section">
            <div class="section-title">📝 Execution Steps</div>
            \${test.steps.map((step, idx) => renderStep(step, 0, index, idx)).join('')}
          </div>
        \` : ''}

        \${test.attachments && test.attachments.length > 0 ? \`
          <div class="attachments-section">
            <div class="section-title">📎 Global Attachments</div>
            <div class="attachments-grid">
              \${test.attachments.map((att, idx) => renderAttachment(att, \`global-\${index}-\${idx}\`)).join('')}
            </div>
          </div>
        \` : ''}
      \`;
      
      // Auto-expand failed steps
      if (test.status === 'failed') {
        setTimeout(() => {
          document.querySelectorAll('.step.step-failed').forEach(step => {
            step.classList.add('expanded');
          });
        }, 100);
      }
    }

    function findFailedStep(steps, path = []) {
      for (let step of steps) {
        if (step.status === 'failed' && step.error) {
          return step;
        }
        if (step.steps && step.steps.length > 0) {
          const found = findFailedStep(step.steps, [...path, step.title]);
          if (found) return found;
        }
      }
      return null;
    }

    function getStepPath(steps, targetStep, path = []) {
      for (let step of steps) {
        const currentPath = [...path, step.title];
        if (step === targetStep) {
          return currentPath.join(' → ');
        }
        if (step.steps && step.steps.length > 0) {
          const found = getStepPath(step.steps, targetStep, currentPath);
          if (found) return found;
        }
      }
      return null;
    }

    function renderStep(step, level, testIndex, stepIndex) {
      const uniqueId = \`step-\${testIndex}-\${stepIndex}-\${level}-\${Math.random().toString(36).substr(2, 9)}\`;
      const hasChildren = step.steps && step.steps.length > 0;
      const hasAttachment = step.attachment && step.attachment.content;
      const hasError = step.error;
      const hasContent = hasChildren || hasAttachment || hasError;
      
      return \`
        <div class="step step-\${step.status}" id="\${uniqueId}">
          <div class="step-header" onclick="toggleStep('\${uniqueId}')">
            <div class="step-header-left">
              \${hasContent ? '<span class="step-expand-icon"></span>' : '<span class="step-expand-icon hidden"></span>'}
              <span class="step-status-icon \${step.status}"></span>
              <span class="step-title">\${formatStepTitle(step.title)}</span>
            </div>
            <span class="step-duration">\${step.duration}ms</span>
          </div>
          
          \${hasContent ? \`
            <div class="step-body">
              \${hasError ? \`
                <div class="step-error-inline">
                  <strong>⚠️ Error in this step:</strong>
                  \${escapeHtml(step.error.message || step.error.toString())}
                </div>
              \` : ''}

              \${step.metaInfo ? \`
                 <div style="font-family: Consolas, monospace; color: #666; font-size: 11px; margin: 5px 0 10px 0; background: #f8f9fa; padding: 6px; border-radius: 4px; border: 1px solid #e9ecef;">
                    <strong style="color: #444;">Info:</strong> \${escapeHtml(step.metaInfo)}
                 </div>
              \` : ''}
              
              \${hasAttachment ? \`
                <div style="margin-bottom: 10px; margin-top: 10px;">
                  \${renderAttachment(step.attachment, \`step-\${uniqueId}\`)}
                </div>
              \` : ''}
              
              \${hasChildren ? step.steps.map((childStep, idx) => renderStep(childStep, level + 1, testIndex, \`\${stepIndex}-\${idx}\`)).join('') : ''}
            </div>
          \` : ''}
        </div>
      \`;
    }

    function renderAttachment(att, uniqueId) {
      if (!att || !att.content) return '';

      if (att.contentType.startsWith('image/')) {
        return \`
          <div class="attachment">
            <div class="attachment-label">📸 \${escapeHtml(att.name)}</div>
            <div class="attachment-content">
              <img src="\${att.content}" alt="\${escapeHtml(att.name)}" onclick="showImage(this, event)" />
            </div>
          </div>
        \`;
      } else if (att.contentType.includes('text') || att.contentType.includes('json')) {
        return \`
          <div class="attachment">
            <div class="attachment-label">📝 \${escapeHtml(att.name)}</div>
            <div class="attachment-content">
              <pre onclick="showText(this, event)">\${escapeHtml(att.content.substring(0, 200))}\${att.content.length > 200 ? '...' : ''}</pre>
            </div>
          </div>
        \`;
      } else {
        return \`
          <div class="attachment">
            <div class="attachment-label">📎 \${escapeHtml(att.name)}</div>
            <div class="attachment-content">
              <a href="\${att.content}" download="\${att.name}">Download</a>
            </div>
          </div>
        \`;
      }
    }

    function toggleStep(stepId) {
      const step = document.getElementById(stepId);
      if (step) {
        step.classList.toggle('expanded');
      }
    }

    function showImage(img, event) {
      if (event) event.stopPropagation();
      const modal = document.getElementById("imgModal");
      const modalImg = document.getElementById("img01");
      
      modal.classList.add('active');
      modal.style.display = "flex";
      modalImg.src = img.src;
    }

    function showText(el, event) {
      if (event) event.stopPropagation();
      const modal = document.getElementById("textModal");
      const modalText = document.getElementById("text01");
      modal.classList.add('active');
      modal.style.display = "flex";
      modalText.textContent = el.textContent;
    }

    function closeModal() {
      const modal = document.getElementById("imgModal");
      modal.classList.remove('active');
      modal.style.display = "none";
    }

    function closeTextModal() {
      const modal = document.getElementById("textModal");
      modal.classList.remove('active');
      modal.style.display = "none";
    }

    function getTagColor(tag) {
        let hash = 0;
        for (let i = 0; i < tag.length; i++) {
            hash = tag.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return \`hsl(\${hue}, 70%, 45%)\`;
    }



    function filterByTag(tag) {
        // Simple implementation: Put tag in search
        const searchInput = document.getElementById('searchInput');
        searchInput.value = tag;
        searchInput.dispatchEvent(new Event('input'));
    }

    function formatStepTitle(title) {
      const escaped = escapeHtml(title);
      
      // 1. Navigate to "URL"
      const navMatch = title.match(/^Navigate to "([^"]+)"/);
      if (navMatch) {
         const url = navMatch[1];
         return \`Navigate to <a href="\${url}" target="_blank" onclick="event.stopPropagation()" style="color:#0366d6; text-decoration:underline;">"\${url}"</a>\`;
      }
      
      // 2. Expect "something"
      const expectMatch = title.match(/^Expect "([^"]+)"/);
      if (expectMatch) {
         return \`Expect <span style="color:#6f42c1; font-weight:bold;">"\${expectMatch[1]}"</span>\`;
      }

      // 3. Screenshot "name"
      const screenMatch = title.match(/^Screenshot "([^"]+)"/);
      if (screenMatch) {
         return \`Screenshot <span style="font-family:monospace; background:#eee; padding:2px 4px; border-radius:3px;">"\${screenMatch[1]}"</span>\`;
      }

      return escaped;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Close modal on outside click
    window.onclick = function(event) {
      const imgModal = document.getElementById("imgModal");
      const textModal = document.getElementById("textModal");
      if (event.target === imgModal) {
        closeModal();
      }
      if (event.target === textModal) {
        closeTextModal();
      }
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeModal();
        closeTextModal();
      }
      if (e.key === 'ArrowDown' && currentTestIndex < tests.length - 1) {
        selectTest(currentTestIndex + 1);
      }
      if (e.key === 'ArrowUp' && currentTestIndex > 0) {
        selectTest(currentTestIndex - 1);
      }
    });

    // State management
    const state = {
        filters: {
            search: '',
            status: 'all'
        },
        tests: tests // source of truth
    };

    window.addEventListener('load', function() {
      // Pre-process Tags
      tests.forEach(t => {
         t.tags = (t.title.match(/@[\w-]+/g) || []);
      });

      renderEnv();
      renderTestList();
      setupFilters();

      const firstFailed = tests.findIndex(t => t.status === 'failed');
      selectTest(firstFailed >= 0 ? firstFailed : 0);
    });

    function toggleEnv() {
        document.getElementById('env-container').classList.toggle('active');
    }

    function renderEnv() {
       const c = document.getElementById('env-container');
       if (!c) return;
       
       c.innerHTML = \`
         <div class="env-grid">
            <div class="env-group">
                <h5>Test Run</h5>
                <div class="env-row"><span class="env-label">Date</span> <span class="env-val">\${new Date(envData.runDate).toLocaleString()}</span></div>
                <div class="env-row"><span class="env-label">Duration</span> <span class="env-val">\${(envData.duration/1000).toFixed(1)}s</span></div>
            </div>
            <div class="env-group">
                <h5>System</h5>
                <div class="env-row"><span class="env-label">Platform</span> <span class="env-val">\${envData.system.platform}</span></div>
                <div class="env-row"><span class="env-label">Node</span> <span class="env-val">\${envData.system.nodeVersion}</span></div>
                <div class="env-row"><span class="env-label">Arch</span> <span class="env-val">\${envData.system.arch}</span></div>
            </div>
            <div class="env-group">
                <h5>Config</h5>
                <div class="env-row"><span class="env-label">Workers</span> <span class="env-val">\${envData.config.workers}</span></div>
                <div class="env-row"><span class="env-label">Retries</span> <span class="env-val">\${envData.config.retries}</span></div>
                <div class="env-row"><span class="env-label">Timeout</span> <span class="env-val">\${envData.config.timeout}ms</span></div>
            </div>
             <div class="env-group">
                <h5>Environment</h5>
                <div class="env-row"><span class="env-label">Env</span> <span class="env-val">\${envData.custom.TEST_ENV}</span></div>
                <div class="env-row"><span class="env-label">Base URL</span> <span class="env-val">\${envData.config.baseURL}</span></div>
            </div>
         </div>
       \`;
    }

    function filterByStatus(status) {
        const btn = document.querySelector(\`.filter-btn[data-status="\${status}"]\`);
        if (btn) btn.click();
    }

    function setupFilters() {
        const searchInput = document.getElementById('searchInput');
        const buttons = document.querySelectorAll('.filter-btn');
        const clearBtn = document.getElementById('clearFiltersBtn');

        // Search debounce
        let timeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                state.filters.search = e.target.value.toLowerCase();
                renderTestList();
                updateClearButton();
            }, 300);
        });

        // Status buttons
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all
                buttons.forEach(b => b.classList.remove('active'));
                // Add to clicked
                btn.classList.add('active');
                state.filters.status = btn.getAttribute('data-status');
                renderTestList();
                updateClearButton();
            });
        });

        clearBtn.onclick = () => {
            state.filters.search = '';
            state.filters.status = 'all';
            searchInput.value = '';
            buttons.forEach(b => b.classList.remove('active'));
            document.querySelector('[data-status="all"]').classList.add('active');
            renderTestList();
            updateClearButton();
        };
    }

    function updateClearButton() {
        const btn = document.getElementById('clearFiltersBtn');
        const hasSearch = state.filters.search.length > 0;
        const hasStatus = state.filters.status !== 'all';
        btn.style.display = (hasSearch || hasStatus) ? 'block' : 'none';
    }

    function renderTestList() {
      const list = document.getElementById('testList');
      list.innerHTML = '';

      // Filter Logic
      const filteredTests = state.tests.filter(t => {
          // Status Filter
          if (state.filters.status !== 'all' && t.status !== state.filters.status) return false;

          // Search Filter (Title or File)
          if (state.filters.search) {
              const term = state.filters.search;
              const titleMatch = t.title.toLowerCase().includes(term);
              const fileMatch = (t.file || '').toLowerCase().includes(term);
              // Optimistic: Check error message if exists
              const errorMatch = t.error && (t.error.message || t.error.toString()).toLowerCase().includes(term);
              
              if (!titleMatch && !fileMatch && !errorMatch) return false;
          }
          return true;
      });

      if (filteredTests.length === 0) {
          list.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No tests found</div>';
          return;
      }

      // Group by File
      const groups = {};
      filteredTests.forEach((t) => {
        // Find original index to maintain selection consistency
        const originalIndex = tests.indexOf(t);
        const file = t.file || 'Unknown File';
        if (!groups[file]) groups[file] = [];
        groups[file].push({ ...t, originalIndex: originalIndex });
      });

      for (const file in groups) {
          // Unique ID for the group
          const groupId = 'group-' + file.replace(/[^a-zA-Z0-9]/g, '-');
          
          const header = document.createElement('div');
          header.className = 'suite-header';
          header.innerHTML = \`<span>\${escapeHtml(file)}</span><span class="chevron">▼</span>\`;
          header.onclick = () => toggleGroup(groupId, header);
          list.appendChild(header);

          const content = document.createElement('div');
          content.id = groupId;
          content.className = 'suite-content';

          groups[file].forEach(test => {
            const item = document.createElement('div');
            item.id = 'test-item-' + test.originalIndex;
            item.className = \`test-item \${test.status} \${test.originalIndex === currentTestIndex ? 'active' : ''}\`;
            item.onclick = (e) => {
                 e.stopPropagation();
                 selectTest(test.originalIndex);
            };
            
            item.innerHTML = \`
              <div class="test-item-left">
                  <span class="test-status-icon \${test.status}"></span>
                  <div>
                      <div class="test-item-title">\${escapeHtml(test.title)}</div>
                      <div class="test-tags-sidebar">
                        \${test.tags.map(tag => \`<span class="tag" style="background:\${getTagColor(tag)}" onclick="filterByTag('\${tag}')">\${tag}</span>\`).join('')}
                      </div>
                  </div>
              </div>
              <div class="test-item-duration">\${test.duration}ms</div>
            \`;
            
            content.appendChild(item);
          });
          
          list.appendChild(content);
      }
    }

    function toggleGroup(groupId, headerEl) {
        const content = document.getElementById(groupId);
        if (content) {
            content.classList.toggle('hidden');
            headerEl.classList.toggle('collapsed');
        }
    }
  </script>
</body>
</html>
    `;

        // Ensure directory exists
        const dir = path.dirname(this.outputFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(this.outputFile, html);
        console.log(`✅ Report generated: ${this.outputFile}`);
    }
}

export default SingleHtmlReporter;