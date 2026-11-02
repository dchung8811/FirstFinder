// What /api/v1/client-config tells installed apps.
//
// Its one job today is an escape hatch. If the server ever has to change in a
// way old app builds can't survive, setting IOS_MINIMUM_VERSION makes every
// build older than that show the message and a link to the App Store instead
// of failing in some stranger way. It needs no deploy beyond the env change,
// and it has to exist in the very first release: a build that doesn't ask can
// never be told.
//
// Versions are App Store marketing versions: "1", "1.2" or "1.2.3", compared
// numerically part by part, with a missing part counting as 0.

const VERSION = /^\d+(\.\d+){0,2}$/;

export const DEFAULT_UPDATE_MESSAGE =
  "This version of FirstFinder is too old to keep working. Update it from the App Store to carry on — your collection is safe and waiting.";

export function isVersion(value) {
  return typeof value === "string" && VERSION.test(value.trim());
}

export function compareVersions(a, b) {
  const left = a.trim().split(".").map(Number);
  const right = b.trim().split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

// The app's own check, written here so it is tested once and ported to Swift
// as is. No minimum, or an unreadable one, never locks anyone out.
export function needsUpdate(appVersion, minimumVersion) {
  if (!isVersion(minimumVersion) || !isVersion(appVersion)) return false;
  return compareVersions(appVersion, minimumVersion) < 0;
}

// A malformed IOS_MINIMUM_VERSION is ignored rather than trusted: a typo there
// must not tell every installed app it is out of date.
export function iosClientConfig(env = {}) {
  const minimum = (env.IOS_MINIMUM_VERSION || "").trim();
  const message = (env.IOS_UPDATE_MESSAGE || "").trim();
  return {
    minimumVersion: isVersion(minimum) ? minimum : null,
    updateMessage: message || DEFAULT_UPDATE_MESSAGE
  };
}
