import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../src/lib/supabaseAdmin";

// Scan-to-fill: read what is printed on a cover and a copyright page, and
// nothing else. No web search, no valuation, no edition verdict -- the route
// returns a transcription and src/utils/scanFill.js decides what the number
// line means, in code, where the answer can be tested.
//
// That narrow job is why a small model is enough, and the small model is why
// this can be the main way in while app/api/identify-book stays capped at two a
// day. gpt-4.1-nano at roughly $0.10 / $0.40 per million tokens puts a two-photo
// scan near a twentieth of a cent. Tunable without a deploy.
const MODEL = process.env.OPENAI_SCAN_MODEL || "gpt-4.1-nano";
const REASONING_MODEL = /^(gpt-5|o\d)/.test(MODEL);

// A cover and a copyright page are the usual pair; a third allows for a spine
// or a title page. Each photo is most of the cost of a call, so cap it.
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

const COOLDOWN_MS = 2000;
// Generous on purpose: this cap is not what keeps the feature affordable, the
// model choice is. It is here so a script looping on the endpoint can't run up
// a bill. Enforced in Postgres (supabase/scan-daily-limit.sql).
const DAILY_LIMIT = Number(process.env.SCAN_DAILY_LIMIT) || 25;
const callLog = new Map();

// In process memory, like identify-book's: it exists to stop a double-tap or a
// stuck retry loop, which land on the same instance anyway.
function checkCooldown(userId) {
  const entry = callLog.get(userId);
  if (entry && Date.now() - entry.last < COOLDOWN_MS) {
    return "You're going a little fast — give it a second and try again.";
  }
  return null;
}

function atLimitMessage(limit) {
  if (limit <= 0) return "Scanning is switched off right now.";
  return `You've used today's ${limit} scans. The count resets at midnight UTC — Quick Add still works by hand.`;
}

function fallbackClaim(userId) {
  const now = Date.now();
  const today = new Date(now).toDateString();
  const entry = callLog.get(userId) || { last: 0, day: today, count: 0 };

  if (entry.day !== today) {
    entry.day = today;
    entry.count = 0;
  }
  if (entry.count >= DAILY_LIMIT) return { error: atLimitMessage(DAILY_LIMIT) };

  entry.last = now;
  entry.count += 1;
  callLog.set(userId, entry);
  return { error: null, remaining: Math.max(0, DAILY_LIMIT - entry.count), limit: DAILY_LIMIT };
}

// Fails open to the in-process counter for the same reason identify-book
// does: the realistic cause of an error is that this code is deployed before
// supabase/scan-daily-limit.sql has been run, and taking scanning down for
// that window is worse than a per-instance cap of the same size.
async function claimDailyCall(supabaseAdmin, userId) {
  const { data, error } = await supabaseAdmin.rpc("claim_scan_call", { p_user_id: userId, p_limit: DAILY_LIMIT });

  if (error) {
    console.error("Scan daily-cap check failed, falling back to the in-process counter. Has supabase/scan-daily-limit.sql been run?", error.message);
    return fallbackClaim(userId);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const limit = Number.isInteger(row?.day_limit) ? row.day_limit : DAILY_LIMIT;
  if (!row?.allowed) return { error: atLimitMessage(limit) };

  const entry = callLog.get(userId) || { last: 0, day: new Date().toDateString(), count: 0 };
  entry.last = Date.now();
  callLog.set(userId, entry);
  return { error: null, remaining: Math.max(0, limit - row.used), limit };
}

const SCAN_SCHEMA = {
  name: "printed_details",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      // Worded around what to reject rather than what to accept: asked whether
      // a bare copyright page was "a printed collectible", gpt-4.1-nano said
      // no and returned every field empty.
      isPrintedItem: { type: "boolean", description: "False only if the photos show no printed matter at all -- a person, a room, a pet. A cover, spine, title page, or copyright page on its own is printed matter: true." },
      category: { type: "string", enum: ["Book", "Comic", "Magazine & periodical", "Trading card", "Sports memorabilia", "Record", "Art", "Posters & ephemera", "Toy", "Other"] },
      title: { type: "string", description: "The title exactly as printed. Empty string if not legible." },
      author: { type: "string", description: "The author as printed, for a book or comic; otherwise the person or group credited. Empty string if none is printed." },
      publisher: { type: "string", description: "The publisher or maker as printed, usually on the spine, title page, or copyright page. Empty string if none is printed." },
      publicationYear: { type: "string", description: "The year of publication or copyright as printed, e.g. '1987'. Empty string if none is printed." },
      editionStatement: { type: "string", description: "Any statement about the edition, copied exactly, e.g. 'First Edition', 'FIRST AMERICAN EDITION', 'Book Club Edition'. Empty string if none is printed." },
      printingStatement: { type: "string", description: "Any printing stated in words, copied exactly, e.g. 'Second printing, May 1962'. Empty string if none is printed." },
      numberLine: { type: "string", description: "The row of numbers on the copyright page, copied digit for digit in the order printed, including any letters or year codes on the same line, e.g. '10 9 8 7 6 5 4 3'. Empty string if there is none." },
      isbn: { type: "string", description: "The ISBN as printed, digits and X only. Empty string if none is visible." }
    },
    required: ["isPrintedItem", "category", "title", "author", "publisher", "publicationYear", "editionStatement", "printingStatement", "numberLine", "isbn"]
  }
};

const INSTRUCTIONS = `You transcribe printed details from photographs of a collectible -- usually a book's cover and its copyright page -- so a cataloguing app can fill in a form for the owner to check.

The photos all show the SAME item. Combine what they show.

Copy only what is printed and legible. Do not identify, research, value, or interpret anything, and do not fill a field from what you know about the title: if the publisher isn't printed in these photos, return an empty string for it even if you know who published the book.

The number line matters most and is the easiest to get wrong. Copy it exactly, every number in the order printed, and do not drop, add, or reorder any. If you can't read it with confidence, return an empty string rather than a guess.`;

export async function POST(request) {
  const accessToken = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    console.error("Scan setup error:", error.message);
    return NextResponse.json({ error: "Scanning isn't configured on the server yet." }, { status: 500 });
  }

  // Verify the caller before spending anything.
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Could not verify your session. Please log in again." }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Scanning isn't configured on the server yet." }, { status: 500 });
  }

  const cooldownError = checkCooldown(userData.user.id);
  if (cooldownError) {
    return NextResponse.json({ error: cooldownError }, { status: 429 });
  }

  let images;
  try {
    const body = await request.json();
    images = Array.isArray(body?.images) ? body.images : [];
  } catch (error) {
    return NextResponse.json({ error: "Could not read the uploaded photos." }, { status: 400 });
  }

  if (images.length === 0) {
    return NextResponse.json({ error: "No photo was included." }, { status: 400 });
  }
  if (images.length > MAX_IMAGES) {
    return NextResponse.json({ error: `Please scan at most ${MAX_IMAGES} photos at a time.` }, { status: 400 });
  }
  if (images.some((image) => typeof image !== "string" || !image.startsWith("data:image/"))) {
    return NextResponse.json({ error: "One of those files doesn't look like an image." }, { status: 400 });
  }
  if (images.some((image) => image.length > MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "One of those photos is too large. Try a smaller one." }, { status: 413 });
  }
  if (images.reduce((total, image) => total + image.length, 0) > MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: "Those photos are too large together. Try fewer, or smaller ones." }, { status: 413 });
  }

  // Claimed after every free check, immediately before the paid call.
  const claim = await claimDailyCall(supabaseAdmin, userData.user.id);
  if (claim.error) {
    return NextResponse.json({ error: claim.error }, { status: 429 });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        instructions: INSTRUCTIONS,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: images.length === 1 ? "Transcribe the printed details in this photo." : `Transcribe the printed details across these ${images.length} photos of one item.` },
              // "high" because a number line is small print at the bottom of a
              // page; at low detail the model sees it as a smudge. It costs
              // more tokens per photo, and on this model that is still a
              // fraction of a cent.
              ...images.map((image) => ({ type: "input_image", image_url: image, detail: "high" }))
            ]
          }
        ],
        // Transcription has one right answer, so: no sampling variety on the
        // 4.1 family, and no reasoning on the GPT-5 family -- which rejects
        // `temperature` outright, so switching OPENAI_SCAN_MODEL to, say,
        // gpt-5.4-nano would otherwise fail every call.
        ...(REASONING_MODEL ? { reasoning: { effort: "none" } } : { temperature: 0 }),
        max_output_tokens: 600,
        text: { format: { type: "json_schema", name: SCAN_SCHEMA.name, strict: SCAN_SCHEMA.strict, schema: SCAN_SCHEMA.schema } }
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("OpenAI scan error:", response.status, detail.slice(0, 500));
      if (response.status === 429) {
        const outOfCredit = /insufficient_quota|exceeded your current quota|billing/i.test(detail);
        return NextResponse.json({
          error: outOfCredit ? "Scanning has used up its budget for now. Quick Add still works by hand." : "Scanning is busy right now. Try again in a moment."
        }, { status: 429 });
      }
      return NextResponse.json({ error: "Couldn't read those photos right now. Please try again." }, { status: 502 });
    }

    const payload = await response.json();

    // Logged so the real cost per scan can be read off Vercel's logs rather
    // than estimated from a price list.
    if (payload.usage) {
      console.info("Scan usage:", JSON.stringify({ model: payload.model, images: images.length, input: payload.usage.input_tokens, output: payload.usage.output_tokens }));
    }

    if (payload.status === "incomplete" || payload.status === "failed") {
      console.error("Scan incomplete:", JSON.stringify(payload.incomplete_details || payload.error || {}));
      return NextResponse.json({ error: "Couldn't finish reading those photos. Please try again." }, { status: 502 });
    }

    const contentPart = (payload.output || []).find((item) => item.type === "message")?.content?.[0];
    if (!contentPart) {
      return NextResponse.json({ error: "The scan came back empty. Please try again." }, { status: 502 });
    }
    if (contentPart.type === "refusal") {
      return NextResponse.json({ error: contentPart.refusal || "The scanner declined to read that photo." }, { status: 502 });
    }

    let result;
    try {
      result = JSON.parse(contentPart.text);
    } catch (error) {
      console.error("Scan parse error:", String(contentPart.text).slice(0, 500));
      return NextResponse.json({ error: "Couldn't read the scan result. Please try again." }, { status: 502 });
    }

    // Rejected only when the model also read nothing. If it transcribed a
    // title or a number line, that is worth handing back whatever it thought
    // of the photo as a whole.
    const readSomething = ["title", "author", "publisher", "editionStatement", "printingStatement", "numberLine", "isbn"].some((key) => String(result[key] || "").trim());
    if (result.isPrintedItem === false && !readSomething) {
      return NextResponse.json({ error: "That doesn't look like a book or printed collectible. Try the cover or the copyright page." }, { status: 422 });
    }

    return NextResponse.json({ result, remaining: claim.remaining, dailyLimit: claim.limit });
  } catch (error) {
    console.error("Scan request error:", error.message);
    return NextResponse.json({ error: "Couldn't reach the scanner. Please try again." }, { status: 502 });
  }
}
