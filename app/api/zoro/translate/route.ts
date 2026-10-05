import Anthropic from "@anthropic-ai/sdk";
import type { Lang } from "@/lib/zoro/types";
import { LANG_NAME_FOR_AI } from "@/lib/zoro/i18n";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic();

interface Body {
  lang: Lang;
  texts: string[];
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Requête invalide" }, { status: 400 });
  }
  const { lang, texts } = body;
  if (!["fr", "en", "ar"].includes(lang)) return Response.json({ error: "Langue inconnue" }, { status: 400 });
  if (!Array.isArray(texts) || texts.length === 0) return Response.json({ translations: [] });
  if (texts.length > 400) return Response.json({ error: "Trop de textes (max 400)." }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Clé API manquante (ANTHROPIC_API_KEY)." }, { status: 500 });
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["translations"],
    properties: { translations: { type: "array", items: { type: "string" } } },
  };

  try {
    const stream = client.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system:
        `You translate short operational hospitality texts (reservation sheet fields: menus, places, activities, notes) into ${LANG_NAME_FOR_AI[lang]}. ` +
        `Return exactly one translation per input, in the same order, same count. Keep proper nouns, flight numbers, phone numbers, times and quantities unchanged. ` +
        `If an input is already in the target language, return it unchanged. Be brief and natural, as staff would say it.`,
      messages: [{ role: "user", content: JSON.stringify({ texts }) }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") return Response.json({ error: "Traduction refusée." }, { status: 502 });
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const parsed = JSON.parse(text) as { translations: string[] };
    if (!Array.isArray(parsed.translations) || parsed.translations.length !== texts.length) {
      return Response.json({ error: "Traduction incomplète, réessaie." }, { status: 502 });
    }
    return Response.json({ translations: parsed.translations });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "Trop de requêtes, réessaie dans une minute." }, { status: 429 });
    if (err instanceof Anthropic.APIError) return Response.json({ error: `Erreur API (${err.status}) : ${err.message}` }, { status: 502 });
    const m = err instanceof Error ? err.message : "Erreur inattendue";
    return Response.json({ error: m }, { status: 500 });
  }
}
