// Turning a piece of in-app feedback into a GitHub issue: masking personal
// details, quoting the report safely, and composing the issue body.
//
// No model is involved. The issue is the user's report, verbatim, and the
// maintainer triages it on GitHub like any other issue.

// Row states, mirroring supabase/feedback-triage.sql.
export const FEEDBACK_STATUS = {
  NEW: "new",
  PUBLISHED: "published",
  ERROR: "error"
};

// Redaction ---------------------------------------------------------------
//
// Feedback is a free-text box, and people paste things into free-text boxes:
// their email, the address on a receipt, an order number, occasionally a card
// number. The issue this becomes is public and permanently indexed, so those
// patterns get masked before a human ever clicks publish.
//
// This is a safety net, not a guarantee -- it catches shapes, not meaning, and
// it cannot know that "the copy I bought from my neighbor Dave Whitfield" is
// identifying. That is exactly why a person still reads every one of these
// before it goes out.

const REDACTIONS = [
  // Email addresses.
  [/\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g, "[email removed]"],
  // Phone numbers, loose enough to catch "(415) 555-0134" and "415.555.0134".
  [/(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, "[phone removed]"],
  // Runs of 14+ digits: account numbers and order ids far more often than
  // anything a maintainer needs. The threshold sits at 14 rather than lower
  // because ISBN-13s are exactly 13 digits and are genuinely useful in a report
  // about a book app -- masking those would remove the single most identifying
  // detail a user can give about which item broke.
  [/\b\d{14,}\b/g, "[long number removed]"],
  // Card numbers in the usual even four-digit grouping. Requiring the groups to
  // be four digits each is what keeps this off a hyphenated ISBN, whose groups
  // are uneven (978-0-7432-7356-5).
  [/\b\d{4}(?:[ -]\d{4}){2,4}\b/g, "[long number removed]"],
  // Street addresses -- a house number followed by a street type.
  [/\b\d{1,6}\s+[\w.'-]+(?:\s+[\w.'-]+){0,3}\s+(?:st|street|ave|avenue|rd|road|blvd|boulevard|ln|lane|dr|drive|ct|court|way|pl|place|ter|terrace|cir|circle|hwy|highway)\b\.?/gi, "[address removed]"]
];

// Returns the masked text plus what was masked, so the review UI can show the
// reviewer that redaction happened rather than silently altering their words.
export function redactPersonalInfo(text) {
  if (!text) return { text: "", redactions: [] };

  let output = String(text);
  const redactions = [];

  for (const [pattern, replacement] of REDACTIONS) {
    output = output.replace(pattern, (match) => {
      redactions.push({ removed: match, replacement });
      return replacement;
    });
  }

  return { text: output, redactions };
}

// Quoting -----------------------------------------------------------------

// Renders user text as a Markdown blockquote. Two things matter here:
//
//  1. Every line needs its own "> ", or a multi-line report collapses into one
//     paragraph and loses the reproduction steps.
//  2. The text is a stranger's, and it lands in a public issue -- so anything
//     that would let it escape the quote and act as page structure is defused:
//     "@" mentions (which notify real people), "#123" (which cross-links to
//     other issues), and code fences.
export function quoteUserText(text) {
  // Whitespace-only counts as empty -- otherwise it renders as a few blank
  // quote lines, which reads as a broken issue rather than an empty one.
  if (!text || !String(text).trim()) return "> _(no description)_";

  return String(text)
    .replace(/```/g, "``​`")
    .replace(/(^|[^\w`])@(\w)/g, "$1`@`$2")
    .replace(/(^|\s)#(\d)/g, "$1`#`$2")
    .split("\n")
    .map((line) => `> ${line}`.trimEnd())
    .join("\n");
}

// Title -------------------------------------------------------------------

// GitHub needs a title, and the user only gave us a body. The first non-empty
// line is what a person would have typed as the subject anyway, so use that --
// trimmed at a word boundary so a long opening sentence doesn't become a title
// that's cut off mid-word.
const MAX_TITLE_CHARS = 80;

export function deriveIssueTitle(description) {
  const { text: redacted } = redactPersonalInfo(description || "");
  const firstLine = redacted
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) return "Feedback from the in-app form";

  const collapsed = firstLine.replace(/\s+/g, " ");
  if (collapsed.length <= MAX_TITLE_CHARS) return collapsed;

  const cut = collapsed.slice(0, MAX_TITLE_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + "\u2026";
}

// Issue body --------------------------------------------------------------

// The issue is the report and nothing else. No summary, no suggested approach,
// no severity -- those are the maintainer's job, done on GitHub.
export function composeIssueBody({ feedbackId, submittedAt, description, photoCount = 0 }) {
  const { text: redacted } = redactPersonalInfo(description);
  const sections = [quoteUserText(redacted)];

  const footnotes = [
    `Filed automatically from in-app feedback \`${feedbackId}\`${submittedAt ? `, submitted ${submittedAt}` : ""}. Nobody has read or reproduced this yet.`
  ];

  if (photoCount > 0) {
    footnotes.push(
      `${photoCount} screenshot${photoCount === 1 ? "" : "s"} came with this report. They are not attached here \u2014 they stay in private storage, since users are not expecting their screenshots to be published.`
    );
  }

  sections.push("---\n\n" + footnotes.map((line) => `<sub>${line}</sub>`).join("\n\n"));

  return sections.join("\n\n");
}
