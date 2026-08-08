import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../src/lib/supabaseAdmin";

// Search-grounded valuation needs a model OpenAI actually pairs with the
// web_search tool -- their own docs recommend gpt-5.5 for new web_search
// integrations, and support for that tool on the mini tier isn't confirmed.
// This costs meaningfully more per call than a plain vision request (a
// reasoning model plus one or more search round-trips), which matters
// directly for a self-funded app -- see IDENTIFY_DAILY_LIMIT below.
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

// Photos arrive already compressed by the browser (~200-400KB). This is a
// backstop against someone posting a huge payload straight at the endpoint,
// since every call costs real money on a self-funded app.
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

// More photos means better evidence (a copyright page settles an edition that a
// cover shot never could), but each one adds cost to the same call, so cap it.
const MAX_IMAGES = 4;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;

// Best-effort throttle. This lives in process memory, so on serverless it is
// per-instance and a determined caller can get around it by landing on cold
// instances. It is enough to stop an accidental loop or a stuck retry, which
// is the realistic failure. A hard per-user cap needs a persisted counter --
// see the note in README.
const COOLDOWN_MS = 3000;
// Tunable without a deploy. Lower than the previous default (20) because a
// search-grounded call costs more than the old vision-only one -- start
// conservative and raise it once real per-call cost is known.
const DAILY_LIMIT = Number(process.env.IDENTIFY_DAILY_LIMIT) || 10;
const callLog = new Map();

function checkThrottle(userId) {
  const now = Date.now();
  const entry = callLog.get(userId) || { last: 0, day: new Date(now).toDateString(), count: 0 };

  const today = new Date(now).toDateString();
  if (entry.day !== today) {
    entry.day = today;
    entry.count = 0;
  }

  if (now - entry.last < COOLDOWN_MS) {
    return "You're going a little fast — give it a few seconds and try again.";
  }
  if (entry.count >= DAILY_LIMIT) {
    return `You've hit the daily limit of ${DAILY_LIMIT} photo identifications. It resets tomorrow.`;
  }

  entry.last = now;
  entry.count += 1;
  callLog.set(userId, entry);
  return null;
}

// Every comparable the model uses must say where it came from and whether it
// was an actual sale or just an asking price -- that distinction is the whole
// point of grounding this in search instead of the model's own memory.
const COMPARABLE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    source: { type: "string", description: "Site or auction house, e.g. 'eBay', 'Heritage Auctions', 'AbeBooks'." },
    url: { type: "string", description: "Direct URL to the listing or result." },
    price: { type: "number", description: "Sale or asking price in USD." },
    saleType: { type: "string", enum: ["sold", "auction_result", "active_listing", "unknown"] },
    date: { type: "string", description: "Sale or listing date if known, otherwise empty string." },
    editionMatch: { type: "string", description: "How closely this comp's edition/printing/condition matches the item being valued, e.g. 'exact match', 'same edition, later printing', 'different edition -- used for context only'." }
  },
  required: ["source", "url", "price", "saleType", "date", "editionMatch"]
};

const VALUATION_SCHEMA = {
  name: "book_valuation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      isBook: { type: "boolean", description: "False if the photo does not show a book or printed collectible." },
      title: { type: "string", description: "Title as printed. Empty string if not legible." },
      author: { type: "string", description: "Author, maker, or publisher. Empty string if unknown." },
      category: { type: "string", enum: ["Book", "Comic", "Trading card", "Sports memorabilia", "Record", "Art", "Toy", "Other"] },
      genre: { type: "string", description: "Genre for books. Empty string if not applicable." },
      edition: { type: "string", enum: ["First", "Second", "Third", "Fourth", "Fifth", "Other", ""] },
      printing: { type: "string", enum: ["First", "Second", "Third", "Fourth", "Fifth", "Other", ""] },
      editionRationale: { type: "string", description: "The specific evidence for the edition/printing conclusion -- what the copyright page or number line actually shows. Empty string if edition/printing could not be confirmed from the photos." },
      condition: { type: "string", enum: ["Near Fine/Fine", "Very Good/Good", "Fair", "Poor", ""] },
      estimatedValueLow: { type: "number", description: "Low end of a defensible USD range for this copy as pictured, based on comparable sales found via search. 0 if no usable comparables were found." },
      estimatedValueHigh: { type: "number", description: "High end of that range. 0 if no usable comparables were found." },
      firstEditionFirstPrintingValueLow: { type: "number", description: "Low end of the USD range if this title were a true first edition, first printing in comparable condition, based on comparable sales. 0 if unknown or not applicable." },
      firstEditionFirstPrintingValueHigh: { type: "number", description: "High end of that range. 0 if unknown or not applicable." },
      summary: { type: "string", description: "2-4 sentences on the book and what drives its value." },
      conditionNotes: { type: "string", description: "What it would be worth in better or worse condition, and why." },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      comparables: {
        type: "array",
        description: "Every comparable sale or listing actually used to form the value range. Empty array if search found nothing usable -- do not fabricate comparables.",
        items: COMPARABLE_SCHEMA
      }
    },
    required: [
      "isBook", "title", "author", "category", "genre", "edition", "printing", "editionRationale",
      "condition", "estimatedValueLow", "estimatedValueHigh",
      "firstEditionFirstPrintingValueLow", "firstEditionFirstPrintingValueHigh",
      "summary", "conditionNotes", "confidence", "comparables"
    ]
  }
};

const INSTRUCTIONS = `You identify collectible books and printed collectibles from photographs and estimate a defensible market value using live web search, for a cataloguing app collectors use for insurance and estate records. Getting this wrong has real consequences for the people relying on it.

You may be given several photographs of the SAME item -- typically a cover, and often a copyright page, number line, ISBN barcode, spine, or signature page. Treat them together as evidence about one object, not as separate items. Later photos usually carry the decisive evidence about edition and printing.

Work in this order:
1. Identify the exact title, author/publisher, and -- from visible evidence only (copyright page, number line, stated edition, ISBN) -- the specific edition and printing. If you cannot see evidence for the edition or printing, leave those fields empty rather than guessing, and say so in editionRationale.
2. Use web search to find comparable copies of THIS SPECIFIC edition and printing: completed/sold eBay listings, auction house results (Heritage, PBA Galleries, etc.), and current dealer listings (AbeBooks, Biblio, etc.).
3. Prioritize actual sold prices and auction hammer prices over active asking prices. An asking price is what a seller hopes for, not evidence of what something is worth.
4. For every comparable, state plainly in saleType whether it is a sold/auction result or an active listing.
5. Only use comparables of the same edition and printing as the item. If no exact comps exist and you must widen to a related edition for context, say so explicitly in editionMatch for that comparable and lower your confidence accordingly.
6. Account for what's visible: dust jacket presence, jacket condition, book condition, signatures, inscriptions, and any other condition or provenance markers.
7. Never state a value based only on your own training knowledge when web search is available to you. If search turns up nothing usable, say so in the summary, return an empty comparables array, and set confidence to "low" rather than inventing a figure.
8. Return a value RANGE (low/high) for estimatedValue and, if applicable, for the first-edition-first-printing comparison. Never collapse to a single falsely precise number. A wide range at low confidence is more honest than a narrow range you cannot support.
9. Set confidence "high" only with multiple matching sold/auction comps for this exact edition and printing. Set it "low" whenever the edition is unconfirmed, comps are scarce, or comps had to be widened to a different edition.
10. Populate comparables with every source you actually used, including its URL, so the collector can check your work.

Never invent a signature, inscription, or provenance you cannot see. If the image is not a book or printed collectible, set isBook to false and leave the other fields empty, 0, or an empty array.`;

function extractCitations(contentPart) {
  const annotations = Array.isArray(contentPart?.annotations) ? contentPart.annotations : [];
  const seen = new Map();
  annotations
    .filter((annotation) => annotation.type === "url_citation" && annotation.url)
    .forEach((annotation) => {
      if (!seen.has(annotation.url)) seen.set(annotation.url, { url: annotation.url, title: annotation.title || annotation.url });
    });
  return Array.from(seen.values());
}

export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    console.error("Identify setup error:", error.message);
    return NextResponse.json({ error: "Photo identification isn't configured on the server yet." }, { status: 500 });
  }

  // Verify the caller before spending anything. This endpoint costs money per
  // call, so it must never be reachable anonymously.
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Could not verify your session. Please log in again." }, { status: 401 });
  }

  // Checked only after the caller is verified, so an unauthenticated probe
  // can't learn whether this deployment has identification configured.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Photo identification isn't configured on the server yet." }, { status: 500 });
  }

  const throttleError = checkThrottle(userData.user.id);
  if (throttleError) {
    return NextResponse.json({ error: throttleError }, { status: 429 });
  }

  let images;
  try {
    const body = await request.json();
    // Accepts a list, and still accepts a lone `image` so an older client
    // doesn't break mid-deploy.
    images = Array.isArray(body?.images) ? body.images : body?.image ? [body.image] : [];
  } catch (error) {
    return NextResponse.json({ error: "Could not read the uploaded photos." }, { status: 400 });
  }

  if (images.length === 0) {
    return NextResponse.json({ error: "No photo was included." }, { status: 400 });
  }
  if (images.length > MAX_IMAGES) {
    return NextResponse.json({ error: `Please use at most ${MAX_IMAGES} photos at a time.` }, { status: 400 });
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
              {
                type: "input_text",
                text: images.length === 1
                  ? "Identify this item and research its value."
                  : `Here are ${images.length} photographs of the same item. Use all of them together to identify it, then research its value.`
              },
              ...images.map((image) => ({ type: "input_image", image_url: image }))
            ]
          }
        ],
        tools: [{ type: "web_search" }],
        text: { format: { type: "json_schema", name: VALUATION_SCHEMA.name, strict: VALUATION_SCHEMA.strict, schema: VALUATION_SCHEMA.schema } }
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("OpenAI error:", response.status, detail.slice(0, 500));
      if (response.status === 401) {
        return NextResponse.json({ error: "The photo identification service rejected our credentials." }, { status: 502 });
      }
      if (response.status === 429) {
        // Running out of prepaid credit also comes back as 429, but "try again
        // shortly" is wrong advice for it -- it won't resolve on its own.
        const outOfCredit = /insufficient_quota|exceeded your current quota|billing/i.test(detail);
        return NextResponse.json({
          error: outOfCredit
            ? "Photo identification has used up its budget for now. It'll work again once the account is topped up."
            : "The identification service is busy right now. Try again in a moment."
        }, { status: 429 });
      }
      return NextResponse.json({ error: "Couldn't identify that photo right now. Please try again." }, { status: 502 });
    }

    const payload = await response.json();

    // Web search runs as a tool-call loop before the final answer, so the
    // response can come back "incomplete" (ran out of budget mid-research)
    // even with a 200 status. Treat that as a failure rather than trying to
    // parse whatever partial content exists.
    if (payload.status === "incomplete" || payload.status === "failed") {
      console.error("Identify incomplete:", JSON.stringify(payload.incomplete_details || payload.error || {}));
      return NextResponse.json({ error: "Couldn't finish researching that item in time. Try again, or with fewer photos." }, { status: 502 });
    }

    const messageItem = (payload.output || []).find((item) => item.type === "message");
    const contentPart = messageItem?.content?.[0];

    if (!contentPart) {
      return NextResponse.json({ error: "The identification service returned an empty response." }, { status: 502 });
    }
    if (contentPart.type === "refusal") {
      return NextResponse.json({ error: contentPart.refusal || "The identification service declined to analyze that photo." }, { status: 502 });
    }

    let result;
    try {
      result = JSON.parse(contentPart.text);
    } catch (error) {
      console.error("Identify parse error:", String(contentPart.text).slice(0, 500));
      return NextResponse.json({ error: "Couldn't read the identification result. Please try again." }, { status: 502 });
    }

    if (result.isBook === false) {
      return NextResponse.json({ error: "That doesn't look like a book or printed collectible. Try a photo of the cover." }, { status: 422 });
    }

    // The model's own comparables list is the primary evidence trail. These
    // citations are a supplementary signal that it actually browsed live
    // pages, surfaced separately in case they don't fully overlap.
    result.citations = extractCitations(contentPart);

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Identify request error:", error.message);
    return NextResponse.json({ error: "Couldn't reach the identification service. Please try again." }, { status: 502 });
  }
}
