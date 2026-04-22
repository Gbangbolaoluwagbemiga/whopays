import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are PayBot, WhoPays's friendly AI assistant for group payment management on the Celo blockchain. You are helpful, witty, and concise. You help friends:
1. Split bills fairly at restaurants and events
2. Decide who pays using on-chain fairness data
3. Manage long-term group expenses (Group Tabs)
4. Settle disputes and bets between friends

Keep responses short and friendly (2-4 sentences max). Use emojis naturally. When discussing bets, be creative and fun. When discussing bills, be practical. Never make up specific wallet addresses or on-chain data you weren't given.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [], context = {} } = body;

    if (!message) {
      return NextResponse.json({ error: "No message" }, { status: 400 });
    }

    // Build conversation history for context
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add session context if available
    if (context.participants || context.amount || context.sessionId) {
      messages.push({
        role: "system",
        content: `Current session context: ${context.participants ? `${context.participants} participants` : ""} ${context.amount ? `splitting ${context.amount} CELO` : ""} ${context.sessionId ? `Session #${context.sessionId}` : ""}`.trim(),
      });
    }

    // Add conversation history (last 10 messages for context)
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === "bot" ? "assistant" : "user",
        content: msg.text,
      });
    }

    // Add current message
    messages.push({ role: "user", content: message });

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages,
      temperature: 0.8,
      max_tokens: 300,
    });

    const response = completion.choices[0]?.message?.content || "PayBot is thinking... 🤔";

    return NextResponse.json({ success: true, response });
  } catch (err: any) {
    console.error("[PayBot Chat Error]", err);
    return NextResponse.json(
      { error: "PayBot is temporarily offline.", response: "⚠️ PayBot is momentarily unavailable. Try again in a second!" },
      { status: 500 }
    );
  }
}
