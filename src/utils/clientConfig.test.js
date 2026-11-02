import { describe, it, expect } from "vitest";
import { DEFAULT_UPDATE_MESSAGE, compareVersions, iosClientConfig, isVersion, needsUpdate } from "./clientConfig";

describe("isVersion", () => {
  it("accepts App Store marketing versions", () => {
    expect(isVersion("1")).toBe(true);
    expect(isVersion("1.2")).toBe(true);
    expect(isVersion("1.2.3")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isVersion("")).toBe(false);
    expect(isVersion("v1.2")).toBe(false);
    expect(isVersion("1.2.3.4")).toBe(false);
    expect(isVersion("1.2-beta")).toBe(false);
    expect(isVersion(undefined)).toBe(false);
  });
});

describe("compareVersions", () => {
  it("compares numerically, not as text", () => {
    expect(compareVersions("1.10", "1.9")).toBe(1);
    expect(compareVersions("1.2.3", "1.2.10")).toBe(-1);
  });

  it("treats a missing part as zero", () => {
    expect(compareVersions("1", "1.0.0")).toBe(0);
    expect(compareVersions("1.1", "1.0.9")).toBe(1);
  });
});

describe("needsUpdate", () => {
  it("asks only builds older than the minimum to update", () => {
    expect(needsUpdate("1.0.9", "1.1")).toBe(true);
    expect(needsUpdate("1.1", "1.1")).toBe(false);
    expect(needsUpdate("2.0", "1.1")).toBe(false);
  });

  it("never locks anyone out over a missing or unreadable version", () => {
    expect(needsUpdate("1.0", null)).toBe(false);
    expect(needsUpdate("1.0", "soon")).toBe(false);
    expect(needsUpdate("", "1.1")).toBe(false);
  });
});

describe("iosClientConfig", () => {
  it("has no minimum and a default message when nothing is set", () => {
    expect(iosClientConfig({})).toEqual({ minimumVersion: null, updateMessage: DEFAULT_UPDATE_MESSAGE });
  });

  it("reads the minimum and message from the environment", () => {
    expect(iosClientConfig({ IOS_MINIMUM_VERSION: " 1.2 ", IOS_UPDATE_MESSAGE: "Please update." })).toEqual({
      minimumVersion: "1.2",
      updateMessage: "Please update."
    });
  });

  // A typo must not tell every installed app it is out of date.
  it("ignores a malformed minimum", () => {
    expect(iosClientConfig({ IOS_MINIMUM_VERSION: "1.2b" }).minimumVersion).toBeNull();
  });
});
