import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const client = new Anthropic();

// Génère LE mot du jour personnalisé à partir de la compréhension de
// l'utilisateur. Le client le met en cache une fois par jour (1 appel/jour max).
export async function POST(req: Request) {
  let context = "";
  try {
    ({ context } = await req.json());
  } catch {
    return Response.json({ phrase: "" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ phrase: "" }, { status: 500 });
  }

  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 80,
      output_config: { effort: "low" },
      system:
        "Tu écris LE mot du jour d'une app santé & bien-être nommée Élan, pour un homme qui veut sortir du yoyo de poids en retrouvant du plaisir, pas de la discipline-punition. " +
        "Règles inviolables : jamais par la peur, jamais le poids comme mesure, zéro pression de résultat, la rechute n'est pas un échec, remplacer plutôt que priver. " +
        "À partir de la compréhension de l'utilisateur fournie, écris UNE seule phrase courte (max 18 mots), chaleureuse, ancrée dans l'identité et le plaisir, qui lui parle vraiment aujourd'hui. " +
        "Pas de guillemets, pas de préambule, pas d'emoji. Réponds uniquement par la phrase.",
      messages: [
        {
          role: "user",
          content: `Compréhension de l'utilisateur :\n${context.slice(0, 2000) || "(peu d'éléments pour l'instant)"}\n\nÉcris le mot du jour.`,
        },
      ],
    });
    const phrase = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim()
      .replace(/^["«»]+|["«»]+$/g, "")
      .slice(0, 160);
    return Response.json({ phrase });
  } catch {
    return Response.json({ phrase: "" }, { status: 500 });
  }
}
