import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../src/lib/supabaseAdmin";

// Configurable so a model rename or an upgrade is an env change, not a deploy.
const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

// Photos arrive already compressed by the browser (~200-400KB). This is a
// backstop against someone posting a huge payload straight at the endpoint,
// since every call costs real money on a self-funded app.
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

// Best-effort throttle. This lives in process memory, so on serverless it is
// per-instance and a determined caller can get around it by landing on cold
// instances. It is enough to stop an accidental loop or a stuck retry, which
// is the realistic failure. A hard per-user cap needs a persisted counter --
// see the note in README.
const COOLDOWN_MS = 3000;
const DAILY_LIMIT = 50;
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

Be conservative and honest:
- Only state an edition or printing you can actually see evidence for. If the photo shows a cover but no copyright page, you cannot confirm a first printing -- return "" for printing and say so in the summary.
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

  let imageDataUrl;
  try {
    const body = await request.json();
    imageDataUrl = body?.image;
  } catch (error) {
    return NextResponse.json({ error: "Could not read the uploaded photo." }, { status: 400 });
  }

  if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "That doesn't look like an image." }, { status: 400 });
  }
  if (imageDataUrl.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "That photo is too large. Try a smaller one." }, { status: 413 });
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
              { type: "text", text: "Identify this item and estimate its value." },
              { type: "image_url", image_url: { url: imageDataUrl } }
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
        return NextResponse.json({ error: "The identification service is rate limited right now. Try again shortly." }, { status: 429 });
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
