import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env");
const requiredKeys = [
  "VITE_CLERK_PUBLISHABLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
];

if (!fs.existsSync(envPath)) {
  console.error("Missing .env file at project root.");
  console.error("Create one from .env.example first.");
  process.exit(1);
}

const content = fs.readFileSync(envPath, "utf8");
const lines = content.split(/\r?\n/);

const values = new Map();
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx <= 0) continue;
  const key = trimmed.slice(0, idx).trim();
  const value = trimmed.slice(idx + 1).trim();
  values.set(key, value);
}

let hasMissing = false;
for (const key of requiredKeys) {
  const v = values.get(key);
  if (!v) {
    console.log(`MISSING: ${key}`);
    hasMissing = true;
  } else {
    console.log(`OK: ${key}`);
  }
}

if (hasMissing) {
  process.exit(1);
}
