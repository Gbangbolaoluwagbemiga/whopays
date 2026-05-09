import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

// Lazy init for build safety
const getGroq = () => {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

export async function POST(req: NextRequest) {
  try {
    const { betTitle, betDescription, query, context, chatHistory, betType, partiesCount } = await req.json();

    if (!betTitle || !query) {
      return NextResponse.json({ error: "Missing bet context" }, { status: 400 });
    }

    // Logic for Threshold
    const threshold = partiesCount >= 7 ? 0.75 : 1.0;
    const isUniversal = betType === "universal";

    const prompt = `You are an elite AI referee for WhoPays, a decentralized escrow platform. 

BET CONTEXT:
- Title: "${betTitle}"
- Description: "${betDescription || "No description"}"
- Type: ${isUniversal ? "UNIVERSAL (Public event - you can verify online)" : "LOCAL (Personal event - consensus required)"}
- Participants: ${partiesCount}
- Required Consensus: ${threshold * 100}% agreement

CHAT HISTORY & VOTES:
${(chatHistory || []).map((m: any) => `${m.role.toUpperCase()}: ${m.text}`).join("\n")}

SECURITY PROTOCOL:
1. IF UNIVERSAL: You can resolve based on your knowledge (sports, facts, crypto prices). If the event happened, set "resolved": true.
2. IF LOCAL: You MUST see at least ${threshold * 100}% of participants voting for the SAME winner in the chat history (messages starting with [VOTE]).
3. If the threshold is NOT met and it's a LOCAL bet, set "resolved": false and explain who still needs to vote.
4. If a dispute exists (parties voting for different people), do not resolve. Ask them to talk it out.

Respond in this exact JSON format:
{
  "resolved": true/false,
  "outcome": "Clear winner name or description",
  "confidence": "high/medium/low",
  "explanation": "Friendly expert commentary (2-3 sentences)",
  "canDeclareWinner": true/false
}`;

    const groq = getGroq();
    if (!groq) {
      return NextResponse.json({ error: "Arbiter service unavailable." }, { status: 500 });
    }

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
    });

    const rawText = completion.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({
        resolved: false,
        outcome: "Awaiting consensus.",
        confidence: "low",
        explanation: "I'm monitoring the chat for agreement. Make sure everyone casts their vote! 🗳️",
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
