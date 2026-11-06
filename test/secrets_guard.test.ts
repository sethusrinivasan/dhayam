import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");

test("security guard: no OAuth secrets, private keys, or credentials committed in tracked files", () => {
  // Get all files tracked by git
  const trackedFilesOutput = execSync("git ls-files", { cwd: ROOT_DIR, encoding: "utf-8" });
  const trackedFiles = trackedFilesOutput.split("\n").filter(Boolean);

  const secretPatterns = [
    { name: "Google OAuth Client Secret", regex: /GOCSPX-[a-zA-Z0-9_-]{20,}/i },
    { name: "GitHub Personal Access Token or Secret", regex: /gh[pousr]_[a-zA-Z0-9]{36,}/ },
    { name: "Cloudflare Global API Key or Token", regex: /(?:CLOUDFLARE_API_TOKEN|CLOUDFLARE_API_KEY)\s*[:=]\s*["'][a-zA-Z0-9_-]{20,}["']/i },
    { name: "Private Key Header", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
    { name: "Hardcoded Client Secret assignment", regex: /(?:GOOGLE_CLIENT_SECRET|GITHUB_CLIENT_SECRET)\s*[:=]\s*["'][a-zA-Z0-9_-]{10,}["']/i },
    { name: "Hardcoded JWT HMAC Secret assignment", regex: /AUTH_JWT_SECRET\s*[:=]\s*["'][a-zA-Z0-9_-]{16,}["']/i }
  ];

  const violations: string[] = [];

  for (const file of trackedFiles) {
    const fullPath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(fullPath)) continue;
    // Skip binary files or images
    if (file.match(/\.(png|jpg|jpeg|gif|ico|svg|wasm)$/i)) continue;

    const content = fs.readFileSync(fullPath, "utf-8");
    for (const pattern of secretPatterns) {
      if (pattern.regex.test(content)) {
        violations.push(`Violation in tracked file ${file}: Found pattern matching ${pattern.name}`);
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Found sensitive secrets tracked in git:\n${violations.join("\n")}`
  );
});

test("security guard: sensitive environment files are properly gitignored", () => {
  const gitignorePath = path.join(ROOT_DIR, ".gitignore");
  assert.ok(fs.existsSync(gitignorePath), ".gitignore must exist");
  const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");

  const requiredIgnored = [".dev.vars", ".env"];
  for (const item of requiredIgnored) {
    assert.ok(
      gitignoreContent.includes(item),
      `.gitignore must include '${item}' to guard against accidental secret commits`
    );
  }
});
