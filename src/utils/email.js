// The pure half of FirstFinder's email: reading the Gmail settings, sorting
// send errors, and building the messages. The half that opens connections is
// src/lib/email.js, which imports "server-only" -- kept apart so these can be
// tested in plain Node without it.

export const DEFAULT_SENDER_NAME = "FirstFinder";
export const APP_URL = "https://firstfinder.app";

// The app's own palette (see app/globals.css and the buttons in
// app/InventoryApp.jsx), spelled out because email clients ignore stylesheets.
export const EMAIL_COLORS = {
  page: "#f6efe3",
  card: "#fffdf8",
  border: "#d8c7ad",
  heading: "#123f38",
  text: "#665746",
  muted: "#8a7a64",
  buttonText: "#fff7ea"
};

// Fraunces is the app's heading face. Mail clients that can't load web fonts
// fall through to Georgia, which is close enough to keep the feel.
const SERIF = "Fraunces, Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

// EMAIL_FROM is the display name only. Gmail rewrites the From address to the
// signed-in account no matter what we put there, so letting this carry an
// address would only make the header lie. If someone pastes a full
// "Name <address>" anyway, the name is kept and the address dropped. Quotes,
// angle brackets and line breaks are stripped: they are what a header
// injection is made of, and nodemailer encodes the rest.
export function parseSenderName(raw) {
  let name = String(raw ?? "");
  const withAddress = name.match(/^(.*?)<[^>]*>\s*$/);
  if (withAddress) name = withAddress[1];
  name = name.replace(/["<>\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64);
  return name || DEFAULT_SENDER_NAME;
}

// Google shows an app password as "abcd efgh ijkl mnop". Pasted like that it
// fails authentication with an error that says nothing about the spaces, so
// every kind of whitespace is removed rather than just the ends trimmed.
export function readEmailConfig(env = {}) {
  const user = String(env.GMAIL_USER ?? "").trim();
  const password = String(env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");
  const senderName = parseSenderName(env.EMAIL_FROM);
  return {
    configured: Boolean(user && password),
    user,
    password,
    senderName,
    from: { name: senderName, address: user }
  };
}

// Errors that mean Gmail is refusing this account or can't be reached at all,
// as opposed to refusing one recipient. Once one of these comes back, every
// later send in the same batch would fail the same way -- and keep hammering
// an account Google may already be rate limiting -- so the mailer stops.
const BLOCKED_ERROR_CODES = new Set(["EAUTH", "ENOAUTH", "ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ETLS"]);
// 421 service unavailable, 454 temporary auth failure, 535 bad credentials.
const BLOCKED_RESPONSE_CODES = new Set([421, 454, 535]);
// 5.4.5 is Gmail's "daily sending quota exceeded".
const BLOCKED_RESPONSE_TEXT = /5\.4\.5|sending limit|quota/i;

export function classifySendError(error) {
  if (!error) return "failed";
  if (BLOCKED_ERROR_CODES.has(error.code)) return "blocked";
  if (BLOCKED_RESPONSE_CODES.has(Number(error.responseCode))) return "blocked";
  const text = `${error.response ?? ""} ${error.message ?? ""}`;
  if (BLOCKED_RESPONSE_TEXT.test(text)) return "blocked";
  return "failed";
}

// Server logs are kept by Vercel, so a log line names the recipient without
// spelling out their address: enough to match a complaint, not a mailing list.
export function maskEmail(address) {
  const value = String(address ?? "");
  const at = value.lastIndexOf("@");
  if (at < 1) return value ? "***" : "(none)";
  return `${value[0]}***${value.slice(at)}`;
}

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

// What one of the thing they just added is called in a sentence. Keyed on the
// categories in src/utils/constants.js; anything else, including a category
// from an older row or a CSV, is just an item.
const CATEGORY_NOUNS = {
  Book: "book",
  "Sports memorabilia": "piece of sports memorabilia",
  "Trading card": "trading card",
  Comic: "comic",
  "Magazine & periodical": "magazine",
  Record: "record",
  Art: "piece of art",
  "Posters & ephemera": "piece of ephemera",
  Toy: "toy"
};

export function categoryNoun(category) {
  return CATEGORY_NOUNS[category] || "item";
}

// The first word of the account's display name, for "Hi Dana". Google
// sign-ups have one; email sign-ups usually don't, and then the greeting is
// left out rather than addressed to nobody.
export function greetingName(fullName) {
  const first = String(fullName ?? "").trim().split(/\s+/)[0] || "";
  return first.slice(0, 40);
}

function truncate(value, max) {
  const text = String(value ?? "").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// The shared frame for every FirstFinder email, including the Supabase Auth
// templates (supabase/email-templates/), so they all look like one app.
// Tables and inline styles because that is what Outlook and Gmail render
// reliably. Every argument is trusted HTML: callers escape what users wrote.
export function renderEmailLayout({ heading, paragraphs, button, footer }) {
  const c = EMAIL_COLORS;
  const body = paragraphs
    .map((html) => `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.55;color:${c.text};">${html}</p>`)
    .join("\n          ");
  const buttonHtml = button
    ? `<p style="margin:24px 0 8px;"><a href="${button.href}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:${c.heading};color:${c.buttonText};font-family:${SANS};font-size:16px;font-weight:600;text-decoration:none;">${button.label}</a></p>`
    : "";
  const footerHtml = footer
    ? `<p style="margin:24px 0 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${c.muted};">${footer}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${heading}</title>
  </head>
  <body style="margin:0;padding:0;background:${c.page};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.page};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${c.card};border:1px solid ${c.border};border-radius:16px;">
            <tr>
              <td style="padding:32px 28px;">
          <p style="margin:0 0 20px;font-family:${SERIF};font-size:18px;font-weight:600;color:${c.heading};">FirstFinder</p>
          <h1 style="margin:0 0 16px;font-family:${SERIF};font-size:26px;line-height:1.25;font-weight:600;color:${c.heading};">${heading}</h1>
          ${body}
          ${buttonHtml}
          ${footerHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// "You added your first book!" -- sent once per account, the first time they
// add anything to their collection (see app/api/first-item-email). The item's
// name is the one thing from the collection that goes into the email; nothing
// about value, price or where it came from does.
export function firstItemEmail({ itemName, category, fullName, appUrl = APP_URL }) {
  const noun = categoryNoun(category);
  const name = truncate(itemName, 120);
  const greeting = greetingName(fullName);
  const subject = `You added your first ${noun} to FirstFinder`;
  const heading = `You added your first ${noun}!`;

  const opening = name
    ? `${escapeHtml(name)} is the first entry in your FirstFinder collection.`
    : `Your FirstFinder collection has its first entry.`;
  const paragraphs = [
    ...(greeting ? [`Hi ${escapeHtml(greeting)},`] : []),
    opening,
    "A few things worth adding while it's in your hands: photos of the front, the copyright or details page, and anything that shows condition. A receipt photo and what you paid help later, when you want to know what the collection is worth.",
    "Everything stays private unless you choose to share a collection."
  ];

  const html = renderEmailLayout({
    heading: escapeHtml(heading),
    paragraphs,
    button: { href: escapeHtml(appUrl), label: "Open your collection" },
    footer: "You're getting this once, because you just started your collection. We won't send another one like it."
  });

  const text = [
    ...(greeting ? [`Hi ${greeting},`, ""] : []),
    name ? `${name} is the first entry in your FirstFinder collection.` : "Your FirstFinder collection has its first entry.",
    "",
    "A few things worth adding while it's in your hands: photos of the front, the copyright or details page, and anything that shows condition. A receipt photo and what you paid help later, when you want to know what the collection is worth.",
    "",
    "Everything stays private unless you choose to share a collection.",
    "",
    `Open your collection: ${appUrl}`,
    "",
    "You're getting this once, because you just started your collection. We won't send another one like it."
  ].join("\n");

  return { subject, html, text };
}
