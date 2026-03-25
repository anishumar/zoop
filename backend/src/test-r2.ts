
import dotenv from "dotenv";
import path from "path";

// Load .env BEFORE importing StorageService
const envPath = path.join(__dirname, "../.env");
console.log("Loading .env from:", envPath);
dotenv.config({ path: envPath });

import { StorageService } from "./services/storage.service";

async function testR2() {
  console.log("Testing Cloudflare R2 Configuration...");
  console.log("Bucket:", process.env.R2_BUCKET || "(missing)");
  console.log("Account ID:", process.env.R2_ACCOUNT_ID || "(missing)");
  console.log("Access Key ID:", process.env.R2_ACCESS_KEY ? "***" : "(missing)");
  console.log("Secret Access Key:", process.env.R2_SECRET_KEY ? "***" : "(missing)");
  console.log("Public URL:", process.env.R2_PUBLIC_URL || "(missing)");
  console.log("---");

  try {
    const userId = "test-user-123";
    const result = await StorageService.createPresign({
      userId,
      mimeType: "image/png",
      size: 1024,
      entity: "avatar"
    });

    console.log("✅ Presigned URL generated successfully!");
    console.log("Upload URL:", result.uploadUrl);
    console.log("Public URL:", result.publicUrl);
    console.log("Key:", result.key);
    console.log("Headers:", JSON.stringify(result.headers, null, 2));
    
    console.log("\n--- TEST COMMAND ---");
    console.log("To test the actual upload, run this curl command:");
    console.log(`curl -X PUT -H "Content-Type: image/png" --data-binary "test-data" "${result.uploadUrl}"`);
    console.log("\nThen check if it's accessible at:");
    console.log(result.publicUrl);

  } catch (error) {
    console.error("❌ Test failed!");
    console.error(error);
  }
}

testR2();
