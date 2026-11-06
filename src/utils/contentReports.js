// Pure rules behind reporting and blocking a shared collection. The routes and
// src/lib/sharedCollection.js do the reading and writing.

import { isValidShareSlug } from "./publicCollection";

export const REPORT_REASONS = [
  { value: "spam", label: "Spam or advertising" },
  { value: "offensive", label: "Offensive or sexual content" },
  { value: "harassment", label: "Harassment or hate" },
  { value: "private_info", label: "Someone's private information" },
  { value: "illegal", label: "Something illegal, or stolen goods" },
  { value: "other", label: "Something else" }
];

// Not offered as a choice: filed by the block itself.
export const BLOCK_REASON = "blocked";

export const REPORT_DETAILS_MAX = 1000;

// One account's reports in a rolling day. Generous for a person, low enough to
// stop one account filling the queue a single maintainer has to read.
export const REPORT_DAILY_LIMIT = 20;

// Separate accounts reporting one page before it comes down on its own, pending
// review. One maintainer can't promise to be awake when something bad appears,
// so this is what acts in the meantime. More than one so a single grudge can't
// take a page down, and always reversible from /admin.
export const AUTO_HIDE_REPORTERS = 3;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID.test(value);
}

export function validateReport(body) {
  if (!isValidShareSlug(body?.slug)) return { ok: false, error: "That page couldn't be found." };
  if (!REPORT_REASONS.some((reason) => reason.value === body.reason)) {
    return { ok: false, error: "Choose a reason for the report." };
  }
  if (body.itemId != null && !isUuid(body.itemId)) return { ok: false, error: "That item couldn't be found." };
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (details.length > REPORT_DETAILS_MAX) {
    return { ok: false, error: `Please keep the details under ${REPORT_DETAILS_MAX} characters.` };
  }
  return { ok: true, value: { slug: body.slug, itemId: body.itemId ?? null, reason: body.reason, details } };
}

// Counts people, not reports, and leaves blocks out: blocking can be a personal
// preference, and it shouldn't take a page down for everyone else.
export function shouldAutoHide(reports) {
  const reporters = new Set(
    (reports || [])
      .filter((report) => report.reason !== BLOCK_REASON && report.reporter_id)
      .map((report) => report.reporter_id)
  );
  return reporters.size >= AUTO_HIDE_REPORTERS;
}

// What a blocker sees, and what the app hides for them. A slug is only returned
// if it is public anyway or the one they already had. Someone who resets an
// unlisted link is usually cutting a person off, and handing that person the new
// link through their block list would undo it.
export function buildBlockList(blocks, shares) {
  const shareByOwner = new Map((shares || []).map((share) => [share.user_id, share]));
  return (blocks || []).map((block) => {
    const share = shareByOwner.get(block.owner_id);
    const known = share
      && share.visibility !== "off"
      && (share.visibility === "listed" || share.slug === block.slug_at_block);
    return {
      id: block.id,
      slug: known ? share.slug : null,
      title: known && share.title?.trim() ? share.title.trim() : "A collector"
    };
  });
}

// The admin queue: newest first, one card per page, so three reports of one page
// read as one decision.
export function groupReportsByOwner(reports, shares) {
  const shareByOwner = new Map((shares || []).map((share) => [share.user_id, share]));
  const groups = new Map();
  for (const report of reports || []) {
    if (!groups.has(report.owner_id)) {
      const share = shareByOwner.get(report.owner_id);
      groups.set(report.owner_id, {
        ownerId: report.owner_id,
        slug: share?.slug || report.slug,
        title: share?.title?.trim() || "Untitled collection",
        reports: []
      });
    }
    groups.get(report.owner_id).reports.push({
      id: report.id,
      reason: report.reason,
      details: report.details,
      itemId: report.item_id,
      createdAt: report.created_at
    });
  }
  return [...groups.values()];
}
