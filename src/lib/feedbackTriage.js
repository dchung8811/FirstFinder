// Shared vocabulary and text handling for turning in-app feedback into public
// GitHub issues. Imported by the server route that does the work and by the
// review UI that renders it, so it must stay free of both Node and React.

// Pipeline states, mirroring supabase/feedback-triage.sql.
export const TRIAGE_STATUS = {
  NEW: "new",
  TRIAGED: "triaged",
  PUBLISHED: "published",
  DISMISSED: "dismissed",
  ERROR: "error"
};

// The labels the triage model is allowed to choose from. This is an allowlist,
// not a suggestion: the model's output is untrusted (it is summarizing text a
// stranger wrote), and GitHub will happily create any label you name, so an
// injected "label" could otherwise invent taxonomy in the repo. Anything not on
// this list is dropped. Must match the labels that actually exist in the repo.
export const ALLOWED_LABELS = [
  "bug",
  "enhancement",
  "documentation",
  "question",
  "good first issue",
  "help wanted"
];

// What kind of report this is. `not_actionable` is the important one -- most
// feedback forms collect a certain amount of "hi", test submissions, and praise,
// and none of that should become an issue.
export const TRIAGE_TYPES = ["bug", "enhancement", "documentation", "question", "not_actionable"];

export const TRIAGE_SEVERITIES = ["blocker", "high", "medium", "low"];

// Mirrors the "Which part of the app?" dropdown in the bug report template, so
// an auto-filed issue is bucketed the same way a hand-filed one would be.
export const TRIAGE_AREAS = [
  "Adding items (Quick Add or guided flow)",
  "AI photo identification",
  "My Collection (browsing, search, filters, inline edit)",
  "Dashboard or valuation",
  "CSV import, bulk edit, or export",
  "Insurance report / printing",
  "Accounts, sign-in, or My Account",
  "Something else"
];

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
  if (!text) return "> _(no description)_";

  return String(text)
    .replace(/```/g, "``​`")
    .replace(/(^|[^\w`])@(\w)/g, "$1`@`$2")
    .replace(/(^|\s)#(\d)/g, "$1`#`$2")
    .split("\n")
    .map((line) => `> ${line}`.trimEnd())
    .join("\n");
}

// Issue body --------------------------------------------------------------

function bulletList(items) {
  const list = (items || []).filter(Boolean);
  if (list.length === 0) return null;
  return list.map((entry) => `- ${entry}`).join("\n");
}

// Composes the issue body. The reviewer can edit the result before it is filed,
// so this is a starting draft rather than the final word.
//
// The ordering is deliberate: the user's own words come first and are clearly
// marked as theirs, and everything machine-generated sits below a heading that
// says so. Someone finding this issue in six months needs to be able to tell
// which sentences a human actually reported from which ones a model inferred.
export function composeIssueBody({ feedbackId, submittedAt, description, triage, photoCount = 0, reviewed = false }) {
  const { text: redacted } = redactPersonalInfo(description);
  const sections = [];

  sections.push("### What the user reported\n\n" + quoteUserText(redacted));

  const facts = [];
  if (triage?.type) facts.push(`**Type:** ${triage.type}`);
  if (triage?.severity) facts.push(`**Severity:** ${triage.severity}`);
  if (triage?.area) facts.push(`**Area:** ${triage.area}`);

  const analysis = [];
  if (facts.length > 0) analysis.push(facts.join(" · "));
  if (triage?.summary) analysis.push(triage.summary);
  if (analysis.length > 0) {
    sections.push("### Triage\n\n" + analysis.join("\n\n"));
  }

  if (triage?.approach) {
    sections.push("### Suggested approach\n\n" + triage.approach);
  }

  const questions = bulletList(triage?.openQuestions);
  if (questions) {
    sections.push("### Open questions\n\n" + questions);
  }

  const duplicates = bulletList(
    (triage?.possibleDuplicates || []).map((entry) =>
      entry?.number ? `#${entry.number}${entry.why ? ` — ${entry.why}` : ""}` : null
    )
  );
  if (duplicates) {
    sections.push("### Possibly already reported\n\n" + duplicates);
  }

  // The provenance footer. Anyone reading the issue -- including an outside
  // contributor who might pick it up -- should know the analysis above was not
  // written by a maintainer who had reproduced the problem.
  const footnotes = [
    `Filed from in-app feedback \`${feedbackId}\`${submittedAt ? `, submitted ${submittedAt}` : ""}.`,
    // Says which of the two paths filed this, and never claims a human read it
    // when none did -- most of these are filed automatically, and someone
    // deciding how much weight to give the analysis needs to know that.
    reviewed
      ? "The quoted report is a user's own words, automatically scanned for personal details and read by a maintainer before filing. Everything below it was generated by a model and has not been reproduced or verified."
      : "The quoted report is a user's own words, automatically scanned for personal details and filed without a human in the loop. Everything below it was generated by a model and has not been reproduced or verified."
  ];
  if (photoCount > 0) {
    footnotes.push(
      `${photoCount} screenshot${photoCount === 1 ? "" : "s"} came with this report. They are not attached here — they stay in private storage, since users are not expecting their screenshots to be published. Ask a maintainer if you need them.`
    );
  }

  sections.push("---\n\n" + footnotes.map((line) => `<sub>${line}</sub>`).join("\n\n"));

  return sections.join("\n\n");
}
