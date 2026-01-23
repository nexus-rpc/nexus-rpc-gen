import * as fs from "node:fs";
import * as path from "node:path";
import * as YAML from "yaml";
import { fileURLToPath } from 'node:url';
import * as quicktype from "quicktype";

// Quicktype doesn't like absolute paths on Windows (https://github.com/glideapps/quicktype/issues/1113),
// so we need to provide relative paths. But this is a bit tricky because the relative paths are
// relative to the current working directory, which depends on where the script is being run from.
// To work around this, we use the absolute path to this file, and use it to compute the absolute
// path to the workspace root, then change this process's working directory to the workspace root.
// Then, all paths can be specified as relative to the workspace root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../../../..");
process.chdir(workspaceRoot);

const input = "schemas/nexus-rpc-gen.yml";
const output = "schemas/nexus-rpc-gen.json";
const outputLoose = "schemas/nexus-rpc-gen.loose.json";

// Just load YAML and convert to data
const yamlText = fs.readFileSync(input, "utf8");
const data = YAML.parse(yamlText);

// Pretty-print with 2 spaces and trailing newline
fs.writeFileSync(output, JSON.stringify(data, null, 2) + "\n");

// Adjust DataType for a looser form that doesn't bring in all of JSON schema
data['$defs'].DataType = { type: "object", additionalProperties: true }
fs.writeFileSync(outputLoose, JSON.stringify(data, null, 2) + "\n");

// Generate quicktype code
const tsFilePath = "src/packages/nexus-rpc-gen-core/src/definition-schema.ts";
const schemaPath = "schemas/nexus-rpc-gen.loose.json";

const args = [
  "--src-lang", "schema",
  "--lang", "typescript",
  "--just-types",
  "--out", tsFilePath,
  schemaPath
];

try {
  console.log(`Running quicktype with args: ${args.join(" ")}`);
  await quicktype.main(args)
} catch (error) {
  console.error("Failed to run quicktype:", error);
  process.exit(1);
}

// Prepend generated notice
fs.writeFileSync(
  tsFilePath,
  `/* eslint-disable */\n// ⚠️ This file is generated. Do not edit manually.\n\n${fs.readFileSync(tsFilePath, 'utf8')}`,
  'utf8');

// Copy generated schema to the core package
fs.copyFileSync(output, path.resolve(workspaceRoot, "src/packages/nexus-rpc-gen-core/schemas/nexus-rpc-gen.json"));

console.log(`Converted ${input} to ${output} and generated code`);