import { describe, expect, it } from "vitest";
import {
  BANNER_MESSAGE_MAX,
  bannerDestination,
  fromDbBanner,
  shouldShowBanner,
  validateBanner
} from "./siteBanner";

const good = { enabled: true, message: "See what's new.", linkLabel: "See features", linkView: "features" };

describe("validateBanner", () => {
  it("accepts a message with a link and trims it for writing", () => {
    const result = validateBanner({ ...good, message: "  See what's new.  " });
    expect(result).toEqual({
      ok: true,
      row: { enabled: true, message: "See what's new.", link_label: "See features", link_view: "features" }
    });
  });

  it("accepts a message with no link, stored as nulls", () => {
    const result = validateBanner({ enabled: true, message: "Maintenance tonight." });
    expect(result.ok).toBe(true);
    expect(result.row.link_label).toBeNull();
    expect(result.row.link_view).toBeNull();
  });

  it("refuses to turn on an empty banner, but lets an empty one be saved off", () => {
    expect(validateBanner({ enabled: true, message: "   " }).ok).toBe(false);
    expect(validateBanner({ enabled: false, message: "" }).ok).toBe(true);
  });

  it("refuses a message over the limit", () => {
    expect(validateBanner({ ...good, message: "x".repeat(BANNER_MESSAGE_MAX + 1) }).ok).toBe(false);
  });

  it("refuses a destination that isn't on the list, including URLs", () => {
    expect(validateBanner({ ...good, linkView: "https://example.test" }).ok).toBe(false);
    expect(validateBanner({ ...good, linkView: "admin" }).ok).toBe(false);
  });

  it("needs both halves of a link or neither", () => {
    expect(validateBanner({ ...good, linkView: "" }).ok).toBe(false);
    expect(validateBanner({ ...good, linkLabel: "" }).ok).toBe(false);
  });

  it("only treats an explicit true as on", () => {
    expect(validateBanner({ ...good, enabled: "true" }).row.enabled).toBe(false);
  });
});

describe("bannerDestination", () => {
  it("knows the Features page", () => {
    expect(bannerDestination("features")).toMatchObject({ view: "features" });
    expect(bannerDestination("nowhere")).toBeNull();
  });
});

describe("fromDbBanner", () => {
  it("maps a row and survives a missing one", () => {
    expect(fromDbBanner({ enabled: true, message: "Hi", link_label: null, link_view: null, updated_at: "t1" })).toEqual({
      enabled: true, message: "Hi", linkLabel: "", linkView: "", updatedAt: "t1"
    });
    expect(fromDbBanner(null).enabled).toBe(false);
  });
});

describe("shouldShowBanner", () => {
  const banner = { enabled: true, message: "Hi", updatedAt: "2026-10-06T12:00:00Z" };

  it("shows an enabled banner nobody has dismissed", () => {
    expect(shouldShowBanner(banner, "")).toBe(true);
  });

  it("stays hidden once this version is dismissed", () => {
    expect(shouldShowBanner(banner, "2026-10-06T12:00:00Z")).toBe(false);
  });

  it("comes back when the banner is edited", () => {
    expect(shouldShowBanner({ ...banner, updatedAt: "2026-10-07T09:00:00Z" }, "2026-10-06T12:00:00Z")).toBe(true);
  });

  it("never shows a disabled or empty banner", () => {
    expect(shouldShowBanner({ ...banner, enabled: false }, "")).toBe(false);
    expect(shouldShowBanner({ ...banner, message: "" }, "")).toBe(false);
    expect(shouldShowBanner(null, "")).toBe(false);
  });
});
