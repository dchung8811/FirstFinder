import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const { messages = [], books = [], rarity = "All" } = await request.json();

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions: [
        "You are FirstFinder, a rare book collecting assistant.",
        "Help users find collectible books, verify edition points, and compare condition, price, scarcity, and confidence.",
        "Never claim live inventory unless inventory/listings are provided.",
        "If information is uncertain, say what is uncertain and what the user should check next.",
        "Keep answers concise, practical, and collector-focused."
      ].join(" "),
      input: [
        {
          role: "user",
          content: JSON.stringify({
            conversation: messages,
            availableListings: books,
            selectedRarityFilter: rarity,
          }),
        },
      ],
    });

    return Response.json({
      reply: response.output_text,
    });
  } catch (error) {
    console.error("Chat route error:", error);

    return Response.json(
      {
        error: "Chat request failed",
        reply: "I had trouble connecting to the book assistant. Try again in a moment, or add title, author, publisher, year, and condition details so I can narrow it down locally.",
      },
      { status: 500 }
    );
  }
}
