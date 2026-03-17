#!/usr/bin/env bash
set -euo pipefail

SEMVER_REGEX='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-(([0-9]+|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*)(\.[0-9]+|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*)*))?(\\+([0-9a-zA-Z-]+(\\.[0-9a-zA-Z-]+)*))?$'
POLL_INTERVAL=30
POLL_TIMEOUT=3600  # 1 hour

# --- Parse arguments ---

version=""
release_type=""
branch="main"

usage() {
  echo "Usage: $0 --version <semver> --type <ga|rc|beta|alpha> [--branch <source-branch>]"
  echo ""
  echo "Initiate a release of nexus-rpc-gen."
  echo ""
  echo "Arguments:"
  echo "  --version   Target version (e.g. 1.2.0, 1.2.0-rc.1, 1.2.0-beta.1, 1.2.0-alpha.1)"
  echo "  --type      Release type: ga, rc, beta, or alpha"
  echo "  --branch    Source branch to release from (default: main)"
  echo ""
  echo "Steps performed:"
  echo "  1. Validates inputs (semver format, release type consistency, branch state, version ordering)"
  echo "  2. Creates a release branch and bumps package versions"
  echo "  3. Opens a version-bump PR and waits for it to be merged"
  echo "  4. Triggers the prepare-release GitHub Actions workflow"
  echo ""
  echo "Prerequisites:"
  echo "  - gh CLI authenticated"
  echo "  - git working copy clean"
  echo "  - pnpm installed"
  echo "  - Source branch up to date with remote"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)  version="$2"; shift 2 ;;
    --type)     release_type="$2"; shift 2 ;;
    --branch)   branch="$2"; shift 2 ;;
    --help|-h)  usage ;;
    *)          echo "Unknown argument: $1"; usage ;;
  esac
done

if [[ -z "$version" || -z "$release_type" ]]; then
  echo "Error: --version and --type are required."
  usage
fi

# --- Validation ---

echo "Validating inputs..."

# 1. Semver format
if ! echo "$version" | grep -qE "$SEMVER_REGEX"; then
  echo "Error: '$version' is not a valid semver version."
  exit 1
fi

# 2. Release type consistency
case "$release_type" in
  ga)
    if echo "$version" | grep -qE -- '-'; then
      echo "Error: ga release type requires a non-prerelease version (got '$version')."
      exit 1
    fi
    ;;
  rc)
    if ! echo "$version" | grep -qE -- '-rc\.[0-9]+$'; then
      echo "Error: rc release type requires a version with -rc.N prerelease segment (got '$version')."
      exit 1
    fi
    ;;
  beta)
    if ! echo "$version" | grep -qE -- '-beta\.[0-9]+$'; then
      echo "Error: beta release type requires a version with -beta.N prerelease segment (got '$version')."
      exit 1
    fi
    ;;
  alpha)
    if ! echo "$version" | grep -qE -- '-alpha\.[0-9]+$'; then
      echo "Error: alpha release type requires a version with -alpha.N prerelease segment (got '$version')."
      exit 1
    fi
    ;;
  *)
    echo "Error: --type must be one of: ga, rc, beta, alpha (got '$release_type')."
    exit 1
    ;;
esac

# 3. Working copy is clean
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: Working copy is not clean. Commit or stash your changes first."
  exit 1
fi

# 4. Source branch exists and is up to date with remote
git fetch origin "$branch" 2>/dev/null || {
  echo "Error: Branch '$branch' does not exist on remote."
  exit 1
}

git checkout "$branch" 2>/dev/null || {
  echo "Error: Branch '$branch' does not exist locally."
  exit 1
}
git pull --ff-only origin "$branch"

local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse "origin/$branch")

if [[ "$local_sha" != "$remote_sha" ]]; then
  echo "Error: Local '$branch' is not synced with origin after pull."
  exit 1
fi

# 5. Version is greater than current version
current_version=$(pnpm list -rC src --json --depth -1 | jq -r '.[] | select(.name == "nexus-rpc-gen") | .version')

if [[ "$current_version" == "$version" ]]; then
  # Allow re-run if no tag exists
  if git rev-parse "v${version}" >/dev/null 2>&1; then
    echo "Error: Version '$version' matches current version and tag v${version} already exists."
    exit 1
  fi
  echo "  Version '$version' matches current version and no tag exists yet."
  echo ""
  echo "  To re-run the release workflow manually:"
  echo "    gh workflow run prepare-release.yml --ref $branch -f version=$version -f ref=\$(git rev-parse origin/$branch)"
  exit 0
else
  is_greater=$(node -e "
    const a = '$version'.split(/[-+]/)[0].split('.').map(Number);
    const b = '$current_version'.split(/[-+]/)[0].split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if (a[i] > b[i]) { console.log('yes'); process.exit(0); }
      if (a[i] < b[i]) { console.log('no'); process.exit(0); }
    }
    // Major.minor.patch are equal; release > prerelease
    const aPre = '$version'.includes('-');
    const bPre = '$current_version'.includes('-');
    if (!aPre && bPre) { console.log('yes'); process.exit(0); }
    if (aPre && !bPre) { console.log('no'); process.exit(0); }
    console.log('maybe');
  ")

  if [[ "$is_greater" == "no" ]]; then
    echo "Error: Version '$version' is not greater than current version '$current_version'."
    exit 1
  fi
fi

echo "  Version: $version ($release_type)"
echo "  Branch:  $branch"
echo "  Current: $current_version"
echo "Validation passed."

# --- Create release branch and bump versions ---

release_branch="releases/v${version}"
echo ""
echo "Creating branch '$release_branch' from '$branch'..."
git checkout -b "$release_branch" "$branch"

echo "Bumping versions to $version..."
(cd src && pnpm -r exec npm version "${version}" --no-git-tag-version)

git add src/package.json src/packages/*/package.json
git commit -m "release: bump version to v${version}"
git push -u origin "$release_branch"

# --- Open PR ---

echo ""
echo "Opening version-bump PR..."
pr_url=$(gh pr create \
  --base "$branch" \
  --title "release: v${version}" \
  --body "$(cat <<EOF
## Release v${version}

Bumps package versions to \`${version}\`.
EOF
)")

pr_number=$(echo "$pr_url" | grep -oE '[0-9]+$')
echo "PR created: $pr_url (#$pr_number)"

# --- Poll for merge ---
echo ""
echo "Waiting for PR #$pr_number to be merged..."
echo "(Polling every ${POLL_INTERVAL}s, timeout after ${POLL_TIMEOUT}s)"

elapsed=0
while true; do
  state=$(gh pr view "$pr_number" --json state -q .state)
  case "$state" in
    MERGED)
      echo "PR #$pr_number has been merged."
      break
      ;;
    CLOSED)
      echo "Error: PR #$pr_number was closed without merging. Aborting."
      exit 1
      ;;
    *)
      # OPEN — keep waiting
      ;;
  esac

  if (( elapsed >= POLL_TIMEOUT )); then
    echo "Error: Timed out waiting for PR #$pr_number to be merged."
    exit 1
  fi

  sleep "$POLL_INTERVAL"
  elapsed=$((elapsed + POLL_INTERVAL))
done

# --- Trigger prepare-release workflow ---

merge_commit=$(gh pr view "$pr_number" --json mergeCommit -q .mergeCommit.oid)
echo ""
echo "Triggering prepare-release workflow..."
echo "  Version: $version"
echo "  Ref:     $merge_commit"

gh workflow run prepare-release.yml \
  --ref "$branch" \
  -f "version=${version}" \
  -f "ref=${merge_commit}"

echo ""
echo "The prepare-release workflow has been triggered."
echo "Monitor progress at: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions"
echo ""
echo "Next steps:"
echo "  1. Wait for the workflow to complete"
echo "  2. Review and edit the draft release on GitHub"
echo "  3. Publish the release (this creates the tag and triggers npm publish)"
