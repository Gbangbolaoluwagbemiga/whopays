import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const getGroq = () => {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[AI Judge] Received request body:", JSON.stringify(body, null, 2));
    const { title, description, parties, isUniversal } = body;

    if (!title || !parties || !Array.isArray(parties)) {
      console.error("[AI Judge] Invalid request: missing title or parties array");
      return NextResponse.json({ error: "Missing bet context or invalid parties list" }, { status: 400 });
    }

    const prompt = `You are a definitive AI Arbiter for WhoPays. Resolve this escrow challenge IMMEDIATELY based on verified facts.

BET: "${title}"
DESCRIPTION: "${description || "No description provided"}"

PARTICIPANTS & CLAIMS:
${parties.map((p: any) => `- ${p.address}: "${p.claim}"`).join("\n")}

INSTRUCTIONS:
1. You are a UNIVERSAL JUDGE. Search your internal world knowledge for the definitive outcome of the event described.
2. If the event occurred, you MUST identify the winner by their wallet address.
3. Your "explanation" MUST include the specific score or result (e.g., "Bayern Munich won 1-0 in the UCL final").
4. If a participant's claim matches the real-world outcome, set that address as the "outcome".
5. Be decisive. If you find the result, resolve it.

REQUIRED JSON FORMAT:
{
  "resolved": true,
  "outcome": "0x... (THE WALLET ADDRESS OF THE WINNER)",
  "confidence": "high",
  "explanation": "State the exact result found (e.g. 'Bayern won 2-1') and name the winning address.",
  "canDeclareWinner": true
}`;

    const groq = getGroq();
    if (!groq) {
      console.error("[AI Judge] GROQ_API_KEY is missing in environment variables!");
      return NextResponse.json({ error: "Arbiter service unavailable." }, { status: 500 });
    }

    console.log("[AI Judge] Sending prompt to Groq for bet:", title);
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: "You are a factual, decisive AI escrow arbiter. Always provide a clear explanation and identify the winner's wallet address." }, { role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 800,
    });

    const rawText = completion.choices[0]?.message?.content?.trim() || "";
    console.log("[AI Judge] Received response from Groq. Raw length:", rawText.length);
    console.log("[AI Judge Raw Output]:", rawText);
    
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({
        resolved: false,
        outcome: null,
        confidence: "low",
        explanation: "The AI was unable to find a definitive result. The event might still be in progress.",
        canDeclareWinner: false,
      });
    }

    try {
      const result = JSON.parse(jsonMatch[0]);
      return NextResponse.json(result);
    } catch (parseErr) {
      console.error("[AI Judge] JSON Parse Error:", parseErr, "Raw Content:", rawText);
      return NextResponse.json({
        resolved: false,
        outcome: null,
        confidence: "low",
        explanation: "The AI judge provided an invalid response format. Please try again.",
        canDeclareWinner: false,
      });
    }
  } catch (err: any) {
    console.error("[Bet Resolver Error]", err);
    return NextResponse.json({ 
      error: `AI Arbiter Error: ${err.message || "Internal Failure"}`,
      details: err.stack
    }, { status: 500 });
  }
}
