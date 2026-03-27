#!/usr/bin/env node

// Runs `nexus-rpc-gen --help`, extracts the Synopsis, Description, and
// common Options sections, and replaces the generated help block in
// README.md so it stays in sync.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Run --help and capture output
const helpText = execFileSync(
  "pnpm",
  ["tsx", "packages/nexus-rpc-gen/src/index.ts", "--help"],
  { cwd: resolve(root, "src"), encoding: "utf-8", shell: process.platform === 'win32' },
).replace(/\r\n/g, "\n");

// Extract everything from start through the common Options section,
// stopping before "Options for <lang>".
const lines = helpText.split("\n");
const extracted = [];
for (const line of lines) {
  if (/^Options for /.test(line.trim())) {
    break;
  }
  extracted.push(line);
}

while (extracted.length > 0 && extracted[0].trim() === "") {
    extracted.shift()
}

while (extracted.length > 0 && extracted.at(-1).trim() === "") {
  extracted.pop();
}

const helpBlock = extracted.join("\n");

// Replace in README between markers
const readmePath = resolve(root, "README.md");
const readme = readFileSync(readmePath, "utf-8").replace(/\r\n/g, "\n");

const startMarker = "<!-- BEGIN GENERATED HELP -->";
const endMarker = "<!-- END GENERATED HELP -->";

const startIdx = readme.indexOf(startMarker);
const endIdx = readme.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  console.error(
    `Could not find help markers in README.md. Expected "${startMarker}" and "${endMarker}".`,
  );
  process.exit(1);
}

const before = readme.slice(0, startIdx + startMarker.length);
const after = readme.slice(endIdx);

const updated = before + `
\`\`\`
${helpBlock}
\`\`\`

Some languages have additional options. Run \`nexus-rpc-gen --help\` for the full list.
` + after;

if (updated !== readme) {
  if (process.env.CI) {
      console.log("README.md contains uncommited checks during CI. Updated README.md:");
      console.log(updated)
      console.log("Failing Build.")
      process.exit(1);
  } else {
    writeFileSync(readmePath, updated);
    console.log("README.md CLI help updated.");
  }
}

