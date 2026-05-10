import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const getGroq = () => {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

export async function POST(req: NextRequest) {
  try {
    const { title, description, parties, isUniversal } = await req.json();

    if (!title || !parties) {
      return NextResponse.json({ error: "Missing bet context" }, { status: 400 });
    }

    const prompt = `You are an elite AI referee for WhoPays, a decentralized escrow platform.
Your job is to resolve a bet based on real-world facts and the participants' claims.

BET CONTEXT:
- Title: "${title}"
- Description: "${description || "No description"}"
- Type: ${isUniversal ? "UNIVERSAL (Public event - you MUST verify online)" : "LOCAL (Personal event)"}

PARTICIPANTS & THEIR CLAIMS:
${parties.map((p: any) => `- Address: ${p.address}\n  Claim: "${p.claim}"`).join("\n")}

SECURITY PROTOCOL:
1. Browse your knowledge base for the actual result of the event described in the title/description.
2. Compare the real-world result against each participant's "Claim".
3. Identify which participant's claim matches the outcome.
4. If it is a UNIVERSAL bet and the event has occurred, set "resolved": true.
5. If the event has NOT occurred yet, set "resolved": false.
6. The "outcome" field MUST be the Celo Wallet Address of the winner.

Respond in this exact JSON format:
{
  "resolved": true/false,
  "outcome": "0x... (Winner's Celo Address)",
  "confidence": "high/medium/low",
  "explanation": "Briefly state the result found online and why this address won (2 sentences).",
  "canDeclareWinner": true/false
}`;

    const groq = getGroq();
    if (!groq) {
      return NextResponse.json({ error: "Arbiter service unavailable." }, { status: 500 });
    }

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 600,
    });

    const rawText = completion.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({
        resolved: false,
        outcome: null,
        confidence: "low",
        explanation: "AI could not reach a definitive verdict. The event may not have happened yet.",
        canDeclareWinner: false,
      });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[Bet Resolver Error]", err);
    return NextResponse.json({ error: "Bet resolver failed" }, { status: 500 });
  }
}
