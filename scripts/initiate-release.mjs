#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { setTimeout } from "node:timers/promises";
import semver from "semver";
import simpleGit from "simple-git";

const POLL_INTERVAL_MS = 30_000;
const POLL_TIMEOUT_MS = 3_600_000;

const git = simpleGit();

// --- Parse arguments ---

const usage = `
Usage: scripts/initiate-release.mjs --version <semver> --type <ga|rc|beta|alpha> [--branch <source-branch>]

Initiate a release of nexus-rpc-gen.

Arguments:
  --version   Target version (e.g. 1.2.0, 1.2.0-rc.1, 1.2.0-beta.1, 1.2.0-alpha.1)
  --type      Release type: ga, rc, beta, or alpha
  --branch    Source branch to release from (default: main)

Steps performed:
  1. Validates inputs (semver format, release type consistency, branch state, version ordering)
  2. Creates a release branch and bumps package versions
  3. Opens a version-bump PR and waits for it to be merged
  4. Triggers the prepare-release GitHub Actions workflow

Prerequisites:
  - gh CLI installed and authenticated
  - git working copy clean
  - pnpm installed
  - Source branch up to date with remote`;

let parsed;
try {
  parsed = parseArgs({
    options: {
      version: { type: "string" },
      type: { type: "string" },
      branch: { type: "string", default: "main" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });
} catch {
  console.log(usage);
  process.exit(1);
}

if (parsed.values.help) {
  console.log(usage);
  process.exit(0);
}

const version = parsed.values.version;
const releaseType = parsed.values.type;
const branch = parsed.values.branch;

if (!version || !releaseType) {
  logFatal("--version and --type are required.\n\n" + usage);
}

// --- Validation ---

console.log("Validating inputs...");

// 1. Semver format
if (!semver.valid(version)) {
  logFatal(`'${version}' is not a valid semver version.`);
}

// 2. Release type consistency
const pre = semver.prerelease(version);
const typeChecks = {
  ga: { test: () => !pre, msg: "ga release type requires a non-prerelease version" },
  rc: { test: () => pre?.[0] === "rc", msg: "rc release type requires a -rc.N prerelease segment" },
  beta: { test: () => pre?.[0] === "beta", msg: "beta release type requires a -beta.N prerelease segment" },
  alpha: { test: () => pre?.[0] === "alpha", msg: "alpha release type requires a -alpha.N prerelease segment" },
};

if (!typeChecks[releaseType]) {
  logFatal(`--type must be one of: ga, rc, beta, alpha (got '${releaseType}').`);
}
if (!typeChecks[releaseType].test()) {
  logFatal(`${typeChecks[releaseType].msg} (got '${version}').`);
}

// 3. Working copy is clean
const status = await git.status();
if (!status.isClean()) {
  logFatal("Working copy is not clean. Commit or stash your changes first.");
}

// 4. Source branch exists and is up to date with remote
try {
  await git.fetch("origin", branch);
} catch {
  logFatal(`Branch '${branch}' does not exist on remote.`);
}

try {
  await git.checkout(branch);
} catch {
  logFatal(`Branch '${branch}' does not exist locally.`);
}
await git.pull("origin", branch, { "--ff-only": null });

const localSha = (await git.revparse(["HEAD"])).trim();
const remoteSha = (await git.revparse([`origin/${branch}`])).trim();

if (localSha !== remoteSha) {
  logFatal(`Local '${branch}' is not synced with origin after pull.`);
}

// 5. Version is greater than current version
const pkg = JSON.parse(readFileSync("src/packages/nexus-rpc-gen/package.json", "utf-8"));
const currentVersion = pkg.version;

if (currentVersion === version) {
  const tags = await git.tags();
  if (tags.all.includes(`v${version}`)) {
    logFatal(`Version '${version}' matches current version and tag v${version} already exists.`);
  }

  console.log(`  Version '${version}' matches current version and no tag exists yet.`);
  console.log("");
  console.log("  To run the release workflow manually:");
  console.log(`    gh workflow run prepare-release.yml --ref ${branch} -f version=${version} -f ref=$(git rev-parse origin/${branch})`);
  process.exit(0);
}

if (!semver.valid(currentVersion)) {
  logFatal(`Current version '${currentVersion}' in package.json is not valid semver.`);
}
if (!semver.gt(version, currentVersion)) {
  logFatal(`Version '${version}' is not greater than current version '${currentVersion}'.`);
}

console.log(`  Version: ${version} (${releaseType})`);
console.log(`  Branch:  ${branch}`);
console.log(`  Current: ${currentVersion}`);
console.log("Validation passed.");

// --- Create release branch and bump versions ---

const releaseBranch = `releases/v${version}`;
console.log("");
console.log(`Creating branch '${releaseBranch}' from '${branch}'...`);
await git.checkoutBranch(releaseBranch, branch);

console.log(`Bumping version from ${currentVersion} to ${version}...`);
execFileSync("pnpm", ["-r", "exec", "npm", "version", version, "--no-git-tag-version"], {
  encoding: "utf-8",
  cwd: "src",
});

await git.add("src/packages/*/package.json");
await git.commit(`release: bump version to v${version}`);
await git.push(["-u", "origin", releaseBranch]);

// --- Open PR ---

console.log("");
console.log("Opening version-bump PR...");
const prUrl = gh(
  "pr", "create",
  "--base", branch,
  "--title", `release: v${version}`,
  "--body", `## Release v${version}\n\nBumps package versions to \`${version}\`.`,
);

const prNumber = prUrl.match(/(\d+)$/)?.[1];
if (!prNumber) logFatal("Could not parse PR number from: " + prUrl);
console.log(`PR created: ${prUrl} (#${prNumber})`);

// --- Poll for merge ---

console.log("");
console.log(`Waiting for PR #${prNumber} to be merged...`);
console.log(`(Polling every ${POLL_INTERVAL_MS / 1000}s, timeout after ${POLL_TIMEOUT_MS / 1000}s)`);

const pollStart = Date.now();
while (true) {
  const state = gh("pr", "view", prNumber, "--json", "state", "-q", ".state");

  if (state === "MERGED") {
    console.log(`PR #${prNumber} has been merged.`);
    break;
  }
  if (state === "CLOSED") {
    logFatal(`PR #${prNumber} was closed without merging. Aborting.`);
  }

  if (Date.now() - pollStart >= POLL_TIMEOUT_MS) {
    logFatal(`Timed out waiting for PR #${prNumber} to be merged.`);
  }

  await setTimeout(POLL_INTERVAL_MS);
}

// --- Trigger prepare-release workflow ---

const mergeCommit = gh("pr", "view", prNumber, "--json", "mergeCommit", "-q", ".mergeCommit.oid");
console.log("");
console.log("Triggering prepare-release workflow...");
console.log(`  Version: ${version}`);
console.log(`  Ref:     ${mergeCommit}`);

gh(
    "workflow",
    "run",
    "prepare-release.yml",
    "--ref",
    branch,
    "-f",
    `version=${version}`,
    "-f",
    `ref=${mergeCommit}`
);

const repoName = gh("repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner");
console.log("");
console.log("The prepare-release workflow has been triggered.");
console.log(`Monitor progress at: https://github.com/${repoName}/actions`);
console.log("");
console.log("Next steps:");
console.log("  1. Wait for the workflow to complete");
console.log("  2. Review and edit the draft release on GitHub");
console.log("  3. Publish the release (this creates the tag and triggers npm publish)");


// --- Helpers ---

function gh(...args) {
  return execFileSync("gh", args, { encoding: "utf-8" }).trim();
}

function logFatal(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}
