import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "..", "js", "config.js");

const url = process.env.CLOUDNIVO_URL || "/api";
const projectId = process.env.CLOUDNIVO_PROJECT_ID || "";
const apiKey = process.env.CLOUDNIVO_API_KEY || "";

if (!projectId || !apiKey) {
  console.error("Missing Vercel env vars: CLOUDNIVO_PROJECT_ID and CLOUDNIVO_API_KEY are required.");
  process.exit(1);
}

const content = `// Generated at build time — do not edit.
window.CONFIG = {
  API_BASE: ${JSON.stringify(url)},
  PROJECT_ID: ${JSON.stringify(projectId)},
  API_KEY: ${JSON.stringify(apiKey)},
};
`;

writeFileSync(out, content);
console.log("Wrote js/config.js from build environment.");
