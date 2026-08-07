import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../src/lib/supabaseAdmin";

// Configurable so a model rename or an upgrade is an env change, not a deploy.
const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

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
// Tunable without a deploy, so the ceiling can be matched to whatever the real
// per-call cost turns out to be on the account's actual model and image size.
const DAILY_LIMIT = Number(process.env.IDENTIFY_DAILY_LIMIT) || 20;
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

const IDENTIFICATION_SCHEMA = {
  name: "book_identification",
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
      condition: { type: "string", enum: ["Near Fine/Fine", "Very Good/Good", "Fair", "Poor", ""] },
      estimatedValue: { type: "number", description: "Best estimate in USD for this copy as pictured, in the condition visible. 0 if it cannot be estimated." },
      firstEditionFirstPrintingValue: { type: "number", description: "Estimated USD value if this title were a true first edition, first printing in comparable condition. 0 if unknown." },
      summary: { type: "string", description: "2-4 sentences on the book and what drives its value." },
      conditionNotes: { type: "string", description: "What it would be worth in better or worse condition, and why." },
      confidence: { type: "string", enum: ["high", "medium", "low"] }
    },
    required: [
      "isBook", "title", "author", "category", "genre", "edition", "printing",
      "condition", "estimatedValue", "firstEditionFirstPrintingValue",
      "summary", "conditionNotes", "confidence"
    ]
  }
};

const SYSTEM_PROMPT = `You identify collectible books and printed collectibles from a photograph for a cataloguing app.

You may be given several photographs of the SAME item -- typically a cover, and often a copyright page, number line, ISBN barcode, spine, or signature page. Treat them together as evidence about one object, not as separate items. Later photos usually carry the decisive evidence about edition and printing, so weight them accordingly.

Be conservative and honest:
- Only state an edition or printing you can actually see evidence for. If you are shown a cover but no copyright page or number line, you cannot confirm a printing -- return "" for printing and say so in the summary.
- When a copyright page or number line IS visible, read it and say in the summary what it shows and what that establishes.
- Judge condition only from what is visible. If the jacket or spine is not shown, say the grade is provisional in the summary.
- Values are rough market estimates in USD for a private collector, not appraisals. If you cannot form a defensible estimate, return 0 rather than guessing wildly.
- Set confidence to "low" whenever the title is unclear, the edition is unverifiable, or the value could plausibly vary by more than an order of magnitude.
- If the image is not a book or printed collectible, set isBook to false and leave the other fields empty or 0.

Never invent a signature, inscription, or provenance you cannot see.`;

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
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: images.length === 1
                  ? "Identify this item and estimate its value."
                  : `Here are ${images.length} photographs of the same item. Use all of them together to identify it and estimate its value.`
              },
              ...images.map((image) => ({ type: "image_url", image_url: { url: image } }))
            ]
          }
        ],
        response_format: { type: "json_schema", json_schema: IDENTIFICATION_SCHEMA }
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
    const content = payload?.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "The identification service returned an empty response." }, { status: 502 });
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch (error) {
      console.error("Identify parse error:", content.slice(0, 500));
      return NextResponse.json({ error: "Couldn't read the identification result. Please try again." }, { status: 502 });
    }

    if (result.isBook === false) {
      return NextResponse.json({ error: "That doesn't look like a book or printed collectible. Try a photo of the cover." }, { status: 422 });
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Identify request error:", error.message);
    return NextResponse.json({ error: "Couldn't reach the identification service. Please try again." }, { status: 502 });
  }
}
