import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

// Lazy init for build safety
const getGroq = () => {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("receipt") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const groq = getGroq();
    if (!groq) {
      return NextResponse.json({ error: "Scanner service unavailable." }, { status: 500 });
    }

    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
            {
              type: "text",
              text: `You are a receipt parsing assistant. Analyze this receipt image carefully.

If this is NOT a clear receipt or bill (e.g. blurry, wrong document, unreadable), respond with ONLY this JSON:
{"error": "Could not read receipt. Please upload a clear, well-lit photo of a receipt or bill."}

If this IS a readable receipt, extract ALL line items and return ONLY this JSON format (no extra text):
{
  "restaurant": "Restaurant name or Unknown",
  "total": 0.00,
  "currency": "USD",
  "items": [
    {"name": "Item name", "price": 0.00, "quantity": 1}
  ]
}

Rules:
- Only include actual food/drink line items (skip taxes, tips, subtotals as items)
- If an item has quantity like "x2" or "2x", multiply: list the total price
- Round prices to 2 decimal places
- If you cannot read prices clearly, skip that item
- Return ONLY the JSON, nothing else`,
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });

    const rawText = completion.choices[0]?.message?.content?.trim() || "";

    // Parse the JSON response
    let parsed: any;
    try {
      // Extract JSON even if there's stray text
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: "Could not read receipt. Please upload a clear, well-lit photo of a receipt or bill." },
        { status: 422 }
      );
    }

    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 422 });
    }

    if (!parsed.items || parsed.items.length === 0) {
      return NextResponse.json(
        { error: "No items found on this receipt. Please upload a clearer photo." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      restaurant: parsed.restaurant || "Unknown",
      total: parsed.total || 0,
      currency: parsed.currency || "USD",
      items: parsed.items,
    });
  } catch (err: any) {
    console.error("[Receipt Scanner Error]", err);
    return NextResponse.json(
      { error: "Receipt scanning failed. Please try again." },
      { status: 500 }
    );
  }
}
