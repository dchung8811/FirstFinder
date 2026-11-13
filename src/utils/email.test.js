import { describe, expect, it } from "vitest";
import {
  categoryNoun,
  classifySendError,
  escapeHtml,
  firstItemEmail,
  greetingName,
  maskEmail,
  parseSenderName,
  readEmailConfig,
  renderEmailLayout
} from "./email";

describe("readEmailConfig", () => {
  it("is not configured when either Gmail variable is missing", () => {
    expect(readEmailConfig({}).configured).toBe(false);
    expect(readEmailConfig({ GMAIL_USER: "a@gmail.com" }).configured).toBe(false);
    expect(readEmailConfig({ GMAIL_APP_PASSWORD: "abcdefghijklmnop" }).configured).toBe(false);
  });

  it("treats a blank or whitespace-only value as missing", () => {
    expect(readEmailConfig({ GMAIL_USER: "  ", GMAIL_APP_PASSWORD: "abcd" }).configured).toBe(false);
    expect(readEmailConfig({ GMAIL_USER: "a@gmail.com", GMAIL_APP_PASSWORD: "  \n" }).configured).toBe(false);
  });

  it("strips the spaces Google shows inside an app password", () => {
    const config = readEmailConfig({ GMAIL_USER: " a@gmail.com ", GMAIL_APP_PASSWORD: "abcd efgh\tijkl mnop\n" });
    expect(config.configured).toBe(true);
    expect(config.user).toBe("a@gmail.com");
    expect(config.password).toBe("abcdefghijklmnop");
  });

  it("sends from the Gmail account under the FirstFinder name by default", () => {
    const config = readEmailConfig({ GMAIL_USER: "a@gmail.com", GMAIL_APP_PASSWORD: "x" });
    expect(config.from).toEqual({ name: "FirstFinder", address: "a@gmail.com" });
  });

  it("uses EMAIL_FROM as the display name only", () => {
    const config = readEmailConfig({ GMAIL_USER: "a@gmail.com", GMAIL_APP_PASSWORD: "x", EMAIL_FROM: "Dana's Shelf" });
    expect(config.from).toEqual({ name: "Dana's Shelf", address: "a@gmail.com" });
  });
});

describe("parseSenderName", () => {
  it("defaults to FirstFinder", () => {
    expect(parseSenderName(undefined)).toBe("FirstFinder");
    expect(parseSenderName("")).toBe("FirstFinder");
    expect(parseSenderName("   ")).toBe("FirstFinder");
  });

  it("keeps the name and drops an address someone pasted with it", () => {
    expect(parseSenderName("FirstFinder <someone@example.com>")).toBe("FirstFinder");
    expect(parseSenderName('"First Finder" <someone@example.com>')).toBe("First Finder");
  });

  it("falls back to the default when only an address was given", () => {
    expect(parseSenderName("<someone@example.com>")).toBe("FirstFinder");
  });

  it("strips characters that could inject a header", () => {
    expect(parseSenderName("Evil\r\nBcc: x@example.com")).toBe("Evil Bcc: x@example.com");
    expect(parseSenderName('a"b')).toBe("a b");
  });
});

describe("classifySendError", () => {
  it.each(["EAUTH", "ENOAUTH", "ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ETLS"])(
    "treats %s as Gmail refusing the account",
    (code) => {
      expect(classifySendError({ code })).toBe("blocked");
    }
  );

  it.each([421, 454, 535, "535"])("treats SMTP %s as blocked", (responseCode) => {
    expect(classifySendError({ code: "EMESSAGE", responseCode })).toBe("blocked");
  });

  it("treats Gmail's daily quota and sending-limit responses as blocked", () => {
    expect(classifySendError({ responseCode: 550, response: "550 5.4.5 Daily user sending limit exceeded." })).toBe("blocked");
    expect(classifySendError({ message: "Sending limit reached" })).toBe("blocked");
    expect(classifySendError({ response: "452 4.5.3 Your message exceeded Google's quota" })).toBe("blocked");
  });

  it("treats a single bad recipient as a plain failure", () => {
    expect(classifySendError({ code: "EENVELOPE", responseCode: 550, response: "550 5.1.1 The email account that you tried to reach does not exist." })).toBe("failed");
    expect(classifySendError({ code: "EENVELOPE", message: "No recipients defined" })).toBe("failed");
  });

  it("treats an unknown or missing error as a failure, not a block", () => {
    expect(classifySendError(new Error("something odd"))).toBe("failed");
    expect(classifySendError(undefined)).toBe("failed");
  });
});

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("dana@example.com")).toBe("d***@example.com");
  });

  it("does not echo something that isn't an address", () => {
    expect(maskEmail("not-an-address")).toBe("***");
    expect(maskEmail("@example.com")).toBe("***");
    expect(maskEmail("")).toBe("(none)");
    expect(maskEmail(null)).toBe("(none)");
  });
});

describe("escapeHtml", () => {
  it("escapes every character that matters in HTML text and attributes", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;");
  });

  it("turns missing values into an empty string", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("categoryNoun", () => {
  it("names the thing in the collector's own category", () => {
    expect(categoryNoun("Book")).toBe("book");
    expect(categoryNoun("Comic")).toBe("comic");
    expect(categoryNoun("Trading card")).toBe("trading card");
  });

  it("calls anything unknown an item", () => {
    expect(categoryNoun("Other")).toBe("item");
    expect(categoryNoun("Wine")).toBe("item");
    expect(categoryNoun(undefined)).toBe("item");
  });
});

describe("greetingName", () => {
  it("uses the first word of the display name", () => {
    expect(greetingName("Dana Q. Reader")).toBe("Dana");
    expect(greetingName("  Dana  ")).toBe("Dana");
  });

  it("is empty when there is no name", () => {
    expect(greetingName("")).toBe("");
    expect(greetingName(undefined)).toBe("");
  });
});

describe("firstItemEmail", () => {
  it("says book for a book", () => {
    const email = firstItemEmail({ itemName: "The Hobbit", category: "Book", fullName: "Dana Reader" });
    expect(email.subject).toBe("You added your first book to FirstFinder");
    expect(email.html).toContain("You added your first book!");
    expect(email.html).toContain("Hi Dana,");
    expect(email.html).toContain("The Hobbit is the first entry");
    expect(email.text).toContain("The Hobbit is the first entry");
    expect(email.text).toContain("https://firstfinder.app");
  });

  it("follows the category for other collections", () => {
    expect(firstItemEmail({ itemName: "X-Men #1", category: "Comic" }).subject).toBe("You added your first comic to FirstFinder");
    expect(firstItemEmail({ itemName: "Thing", category: "Other" }).subject).toBe("You added your first item to FirstFinder");
  });

  it("escapes the item name and the person's name in the HTML", () => {
    const email = firstItemEmail({ itemName: "<img src=x onerror=alert(1)>", category: "Book", fullName: "<b>Dana</b>" });
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(email.html).not.toContain("<b>Dana");
  });

  it("leaves the greeting out when there is no name", () => {
    const email = firstItemEmail({ itemName: "The Hobbit", category: "Book" });
    expect(email.html).not.toContain("Hi ");
    expect(email.text.startsWith("The Hobbit")).toBe(true);
  });

  it("still reads when the item has no name", () => {
    const email = firstItemEmail({ itemName: "  ", category: "Book" });
    expect(email.text).toContain("Your FirstFinder collection has its first entry.");
  });

  it("shortens a very long item name", () => {
    const email = firstItemEmail({ itemName: "A".repeat(500), category: "Book" });
    expect(email.text).not.toContain("A".repeat(121));
    expect(email.text).toContain("…");
  });

  it("puts nothing about money into the email", () => {
    const email = firstItemEmail({ itemName: "The Hobbit", category: "Book" });
    expect(email.text).not.toMatch(/\$\d/);
  });
});

describe("renderEmailLayout", () => {
  it("caps the width at 520px and uses the app's colors", () => {
    const html = renderEmailLayout({ heading: "Hi", paragraphs: ["One"], button: { href: "https://firstfinder.app", label: "Go" } });
    expect(html).toContain("max-width:520px");
    expect(html).toContain("#123f38");
    expect(html).toContain("#f6efe3");
    expect(html).toContain('href="https://firstfinder.app"');
  });

  it("can leave out the button and footer", () => {
    const html = renderEmailLayout({ heading: "Hi", paragraphs: ["One"] });
    expect(html).not.toContain("<a ");
  });
});
