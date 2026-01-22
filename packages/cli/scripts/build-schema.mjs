import fs from "fs";
import path from "path";
import YAML from "yaml";
import { spawnSync } from 'node:child_process';
import { platform } from "node:os";
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../../..");
const input = path.resolve(workspaceRoot, "schemas/nexus-rpc-gen.yml");
const output = path.resolve(workspaceRoot, "schemas/nexus-rpc-gen.json");
const outputLoose = path.resolve(workspaceRoot, "schemas/nexus-rpc-gen.loose.json");

// Just load YAML and convert to data
const yamlText = fs.readFileSync(input, "utf8");
const data = YAML.parse(yamlText);

// Pretty-print with 2 spaces and trailing newline
fs.writeFileSync(output, JSON.stringify(data, null, 2) + "\n");

// Adjust DataType for a looser form that doesn't bring in all of JSON schema
data['$defs'].DataType = { type: "object", additionalProperties: true }
fs.writeFileSync(outputLoose, JSON.stringify(data, null, 2) + "\n");

// Generate quicktype code
const tsFilePath = path.resolve(workspaceRoot, "packages/core/src/definition-schema.ts");
const cmd = path.resolve(workspaceRoot,"node_modules/.bin/quicktype" + (platform() === "win32" ? ".cmd" : ""));
const args = [
  "--src-lang", "schema",
  "--lang", "typescript",
  "--just-types",
  "--out", tsFilePath,
  path.resolve(workspaceRoot, "schemas/nexus-rpc-gen.loose.json")
];
console.log(`Running '${cmd}' with args: ${args.join(" ")}`);
const result = spawnSync(cmd, args, { stdio: "inherit", shell: true });
if (result.error) {
  console.error("Failed to spawn quicktype:", result.error);
  process.exit(1);
} else if (result.status !== 0) {
  console.error(`quicktype failed with exit code ${result.status}`);
  process.exit(result.status);
}
// Prepend generated notice
fs.writeFileSync(
  tsFilePath,
  `/* eslint-disable */\n// ⚠️ This file is generated. Do not edit manually.\n\n${fs.readFileSync(tsFilePath, 'utf8')}`,
  'utf8');

console.log(`Converted ${input} to ${output} and generated code`);