import { describe, it, expect } from "vitest";
import { APP_SHEET_SNOOZE_MS, isIPhoneBrowser, shouldShowAppSheet } from "./iosApp";

const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const CHROME_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1";
const FIREFOX_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15";
// What the FirstFinder app's own WebPage view sends: WKWebView's default.
const WKWEBVIEW =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.0";
const IPAD_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

describe("isIPhoneBrowser", () => {
  it("matches the browsers people open on an iPhone", () => {
    expect(isIPhoneBrowser(SAFARI)).toBe(true);
    expect(isIPhoneBrowser(CHROME_IOS)).toBe(true);
    expect(isIPhoneBrowser(FIREFOX_IOS)).toBe(true);
  });

  it("leaves out web views inside apps, our own included", () => {
    expect(isIPhoneBrowser(WKWEBVIEW)).toBe(false);
    expect(isIPhoneBrowser(INSTAGRAM)).toBe(false);
  });

  it("leaves out everything that isn't an iPhone", () => {
    expect(isIPhoneBrowser(IPAD_DESKTOP_MODE)).toBe(false);
    expect(isIPhoneBrowser(ANDROID_CHROME)).toBe(false);
    expect(isIPhoneBrowser("")).toBe(false);
    expect(isIPhoneBrowser(undefined)).toBe(false);
  });
});

describe("shouldShowAppSheet", () => {
  const now = Date.UTC(2026, 10, 28);

  it("shows on a first iPhone visit", () => {
    expect(shouldShowAppSheet(SAFARI, 0, now)).toBe(true);
  });

  it("never shows off an iPhone browser", () => {
    expect(shouldShowAppSheet(WKWEBVIEW, 0, now)).toBe(false);
    expect(shouldShowAppSheet(ANDROID_CHROME, 0, now)).toBe(false);
  });

  it("stays closed for the snooze, then comes back", () => {
    expect(shouldShowAppSheet(SAFARI, now - 1000, now)).toBe(false);
    expect(shouldShowAppSheet(SAFARI, now - APP_SHEET_SNOOZE_MS + 1, now)).toBe(false);
    expect(shouldShowAppSheet(SAFARI, now - APP_SHEET_SNOOZE_MS, now)).toBe(true);
  });

  it("ignores a stamp from the future or one that isn't a number", () => {
    expect(shouldShowAppSheet(SAFARI, now + 1000, now)).toBe(true);
    expect(shouldShowAppSheet(SAFARI, "garbage", now)).toBe(true);
  });
});
