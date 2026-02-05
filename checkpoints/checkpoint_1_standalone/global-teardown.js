import { uploadToXray } from "../features/index.js";

export default async function globalTeardown() {
    console.log("\n🚀 Uploading results to Xray...");
    await uploadToXray();
    console.log("✅ Upload complete");
}
