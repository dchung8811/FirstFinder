// Where FirstFinder lives as an open-source project. Kept in one place because
// both the client (the Contribute page's links) and the server (the route that
// reads open issues) need to agree on it, and because a fork should only have
// to change it here.
export const GITHUB_OWNER = "dchung8811";
export const GITHUB_REPO = "FirstFinder";

export const GITHUB_SLUG = `${GITHUB_OWNER}/${GITHUB_REPO}`;
export const REPO_URL = `https://github.com/${GITHUB_SLUG}`;

export const CONTRIBUTING_URL = `${REPO_URL}/blob/main/CONTRIBUTING.md`;
export const CODE_OF_CONDUCT_URL = `${REPO_URL}/blob/main/CODE_OF_CONDUCT.md`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const SECURITY_URL = `${REPO_URL}/blob/main/SECURITY.md`;
export const NEW_ISSUE_URL = `${REPO_URL}/issues/new/choose`;
export const BUG_REPORT_URL = `${REPO_URL}/issues/new?template=bug_report.yml`;
export const FEATURE_REQUEST_URL = `${REPO_URL}/issues/new?template=feature_request.yml`;

// The two labels the Contribute page groups issues under. GOOD_FIRST_ISSUE is
// GitHub's own default label name, so it also lights up their "good first
// issue" discovery surfaces -- don't rename it to something tidier.
export const GOOD_FIRST_ISSUE_LABEL = "good first issue";
export const HELP_WANTED_LABEL = "help wanted";

export function labelSearchUrl(label) {
  return `${REPO_URL}/issues?q=${encodeURIComponent(`is:issue is:open label:"${label}"`)}`;
}

export const DONATE_URL = "https://buymeacoffee.com/firstfinder";
