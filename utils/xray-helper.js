import axios from 'axios';
import fs from 'fs';
import path from 'path';

export default class XrayHelper {
    constructor({ clientId, clientSecret, testExecutionKey, testPlanKey, projectKey, jiraBaseUrl, jiraUsername, jiraApiToken }) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.testExecutionKey = testExecutionKey;
        this.testPlanKey = testPlanKey;
        this.projectKey = projectKey;

        // Jira Credentials for Attachments
        this.jiraBaseUrl = jiraBaseUrl;
        this.jiraUsername = jiraUsername;
        this.jiraApiToken = jiraApiToken;

        this.baseUrl = 'https://xray.cloud.getxray.app/api/v2';
        this.token = null;
        this.tokenExpiry = null;
    }

    /**
     * Uploads a file attachment to a Jira Issue (e.g., Test Execution)
     * Requires generic Jira API credentials (Xray token is not sufficient)
     */
    async addAttachment(issueKey, filePath) {
        if (!this.jiraBaseUrl || !this.jiraUsername || !this.jiraApiToken) {
            console.warn('⚠️  Skipping attachment upload: Missing Jira Credentials (JIRA_BASE_URL, JIRA_USERNAME, JIRA_API_TOKEN)');
            return;
        }

        try {
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️  Attachment file not found: ${filePath}`);
                return;
            }

            const stats = fs.statSync(filePath);
            const fileSizeInBytes = stats.size;
            // Create a ReadStream
            const fileStream = fs.createReadStream(filePath);

            console.log(`📎 Uploading attachment ${path.basename(filePath)} to ${issueKey}...`);

            // Use axios for multipart/form-data upload
            // We need to use 'form-data' library or valid replacement if passing stream
            // But since we are in node, typically we just import FormData
            // However, native fetch or axios with FormData is safer. 
            // Let's use simple axios with 'form-data' package if available or dynamically import it.
            // Since we didn't check for 'form-data' package, let's assume we might need to add it or use a simpler approach.
            // Simpler approach compatible with axios in Node:
            // We can treat it as binary buffer if small, but streams are better.

            // Standard Jira implementation needs "X-Atlassian-Token: no-check"

            // Let's check dependencies for 'form-data'. If not present, we should probably add it.
            // But let's look at existing files. We saw axios. 
            // We will attempt to use form-data logic.

            const FormData = (await import('form-data')).default;
            const form = new FormData();
            form.append('file', fileStream);

            const authString = Buffer.from(`${this.jiraUsername}:${this.jiraApiToken}`).toString('base64');

            await axios.post(
                `${this.jiraBaseUrl}/rest/api/3/issue/${issueKey}/attachments`,
                form,
                {
                    headers: {
                        'Authorization': `Basic ${authString}`,
                        'X-Atlassian-Token': 'no-check',
                        ...form.getHeaders()
                    }
                }
            );

            console.log('✅ Attachment uploaded successfully!');

        } catch (error) {
            console.error('❌ Failed to upload attachment to Jira');
            if (error.response) {
                console.error(`   Status: ${error.response.status}`);
                console.error(`   Data: ${JSON.stringify(error.response.data)}`);
            } else {
                console.error(`   Error: ${error.message}`);
            }
        }
    }

    async authenticate() {
        // Return cached token if still valid (buffer of 5 mins)
        if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
            return this.token;
        }

        try {
            const response = await axios.post(`${this.baseUrl}/authenticate`, {
                client_id: this.clientId,
                client_secret: this.clientSecret
            });

            this.token = response.data;
            // Token valid for 60 mins, set expiry to 55 mins to be safe
            this.tokenExpiry = new Date(new Date().getTime() + 55 * 60000);
            return this.token;
        } catch (error) {
            console.error('❌ Xray Authentication Failed:', error.message);
            throw error;
        }
    }

    async fileToBase64(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️ Warning: Evidence file not found at ${filePath}`);
                return null;
            }
            return fs.readFileSync(filePath, { encoding: 'base64' });
        } catch (error) {
            console.error(`❌ Error reading file ${filePath}:`, error.message);
            return null;
        }
    }

    getMimeType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.json': 'application/json',
            '.csv': 'text/csv'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    async createEvidence(filePath) {
        const data = await this.fileToBase64(filePath);
        if (!data) return null;

        const filename = path.basename(filePath);
        return {
            data: data,
            filename: filename,
            contentType: this.getMimeType(filename)
        };
    }

    async uploadResults(testResults) {
        try {
            const token = await this.authenticate();

            const payload = {
                tests: testResults
            };

            // Only add testExecutionKey if it exists
            if (this.testExecutionKey) {
                payload.testExecutionKey = this.testExecutionKey;
            } else {
                console.log(`ℹ️  Creating NEW Test Execution`);
                // If creating a NEW execution, allow Plan Link and Project Key
                payload.info = {
                    summary: this.customSummary || `Automated Test Execution - ${new Date().toISOString()}`,
                    description: "Imported via Playwright Xray Integration"
                };

                if (this.testPlanKey) {
                    console.log(`   🔗 Linking to Test Plan: ${this.testPlanKey}`);
                    payload.info.testPlanKey = this.testPlanKey;
                }

                if (this.projectKey) {
                    console.log(`   📂 Project: ${this.projectKey}`);
                    payload.info.project = this.projectKey;
                }
            }

            console.log(`🚀 Uploading ${testResults.length} test results to Xray...`);

            const response = await axios.post(
                `${this.baseUrl}/import/execution`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('✅ Successfully uploaded to Xray!');
            if (response.data && response.data.key) {
                console.log(`   Test Execution Key: ${response.data.key}`);
                console.log(`   id: ${response.data.id}`);
            }
            return response.data;

        } catch (error) {
            console.error('❌ Failed to upload results to Xray');
            if (error.response) {
                console.error(`   Status: ${error.response.status}`);
                console.error(`   Data: ${JSON.stringify(error.response.data)}`);
            } else {
                console.error(`   Error: ${error.message}`);
            }

            // Save debug info
            const debugFile = 'xray-results-debug.json';
            fs.writeFileSync(debugFile, JSON.stringify(testResults, null, 2));
            console.log(`💾 Saved failed upload payload to ${debugFile}`);

            // We don't throw here to ensure global teardown completes gracefully
            // but we log heavily
        }
    }
}
