import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const client = new Anthropic();

// Résume une note ("prise de conscience") en un titre court, pour que la liste
// ne soit pas une suite de pavés.
export async function POST(req: Request) {
  let text = "";
  try {
    ({ text } = await req.json());
  } catch {
    return Response.json({ title: "" }, { status: 400 });
  }
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ title: "" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ title: "" }, { status: 500 });
  }

  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 30,
      system:
        "Tu résumes une note personnelle en un titre très court (3 à 6 mots), en français, fidèle au sens, sans guillemets ni ponctuation finale. Réponds UNIQUEMENT par le titre, rien d'autre.",
      messages: [{ role: "user", content: text.slice(0, 1000) }],
    });
    const title = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim()
      .replace(/^["«»]+|["«».]+$/g, "")
      .slice(0, 60);
    return Response.json({ title });
  } catch {
    return Response.json({ title: "" }, { status: 500 });
  }
}
