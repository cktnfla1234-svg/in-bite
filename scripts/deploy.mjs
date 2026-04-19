/**
 * Production deploy: verify build, commit any changes, push (triggers Vercel on main).
 * Usage: npm run deploy -- "fix: short description"
 * Or:    DEPLOY_MSG="fix: short" npm run deploy
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

function sh(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", encoding: "utf8", ...opts });
}

function shOut(cmd) {
  return execSync(cmd, { encoding: "utf8", cwd: root }).trim();
}

const fromEnv = process.env.DEPLOY_MSG?.trim();
const fromArgv = process.argv.slice(2).join(" ").trim();
const message =
  fromEnv ||
  fromArgv ||
  `chore: deploy ${new Date().toISOString().slice(0, 19)}Z`;

console.log("Running production build…");
sh("npm run build", { cwd: root });

const dirty = shOut("git status --porcelain");
if (dirty) {
  sh("git add -A");
  sh(`git commit -m ${JSON.stringify(message)}`);
} else {
  console.log("No local changes to commit.");
}

console.log("Pushing to origin…");
sh("git push");
