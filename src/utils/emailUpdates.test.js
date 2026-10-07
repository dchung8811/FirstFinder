import { describe, expect, it } from "vitest";
import {
  emailUpdatesMetadata,
  isPendingEmailUpdatesValid,
  isSubscribedToEmailUpdates,
  serializePendingEmailUpdates
} from "./emailUpdates";

describe("isSubscribedToEmailUpdates", () => {
  it("is true only for an explicit opt-in", () => {
    expect(isSubscribedToEmailUpdates({ user_metadata: { email_updates: true } })).toBe(true);
  });

  it("treats accounts that never answered as not subscribed", () => {
    expect(isSubscribedToEmailUpdates({ user_metadata: {} })).toBe(false);
    expect(isSubscribedToEmailUpdates({})).toBe(false);
    expect(isSubscribedToEmailUpdates(null)).toBe(false);
  });

  it("does not read truthy look-alikes as consent", () => {
    expect(isSubscribedToEmailUpdates({ user_metadata: { email_updates: "true" } })).toBe(false);
    expect(isSubscribedToEmailUpdates({ user_metadata: { email_updates: 1 } })).toBe(false);
  });
});

describe("emailUpdatesMetadata", () => {
  const now = new Date("2026-10-06T12:00:00Z");

  it("records the choice with when it was made", () => {
    expect(emailUpdatesMetadata(true, now)).toEqual({
      email_updates: true,
      email_updates_changed_at: "2026-10-06T12:00:00.000Z"
    });
  });

  it("records an opt-out the same way", () => {
    expect(emailUpdatesMetadata(false, now).email_updates).toBe(false);
  });

  it("coerces anything but true to false", () => {
    expect(emailUpdatesMetadata(undefined, now).email_updates).toBe(false);
    expect(emailUpdatesMetadata("yes", now).email_updates).toBe(false);
  });
});

describe("pending email updates across an OAuth redirect", () => {
  const clicked = new Date("2026-10-06T12:00:00Z");
  const minutesLater = (m) => new Date(clicked.getTime() + m * 60 * 1000);
  const raw = serializePendingEmailUpdates(clicked);

  it("accepts an opt-in made moments before the redirect", () => {
    expect(isPendingEmailUpdatesValid(raw, minutesLater(2))).toBe(true);
  });

  it("drops a flag left behind by a sign-in that never finished", () => {
    expect(isPendingEmailUpdatesValid(raw, minutesLater(16))).toBe(false);
  });

  it("rejects a timestamp from the future", () => {
    expect(isPendingEmailUpdatesValid(raw, minutesLater(-1))).toBe(false);
  });

  it("treats missing or corrupt storage as no answer", () => {
    expect(isPendingEmailUpdatesValid(null, clicked)).toBe(false);
    expect(isPendingEmailUpdatesValid("{not json", clicked)).toBe(false);
    expect(isPendingEmailUpdatesValid(JSON.stringify({ subscribed: "yes", at: clicked.getTime() }), clicked)).toBe(false);
  });
});
