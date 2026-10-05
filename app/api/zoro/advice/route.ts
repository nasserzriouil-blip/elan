import Anthropic from "@anthropic-ai/sdk";
import type { Advice, Lang, Reservation, Settings } from "@/lib/zoro/types";
import { LANG_NAME_FOR_AI } from "@/lib/zoro/i18n";
import { weatherSummaryForAI } from "@/lib/zoro/weather";
import { rulesSummaryForAI } from "@/lib/zoro/rules";
import { DEFAULT_SETTINGS } from "@/lib/zoro/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic();

const ADVICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "roadmap", "vigilance", "checklist", "questionsToClient"],
  properties: {
    headline: { type: "string", description: "2-3 sentences: what this booking is, what makes it particular, the one thing not to miss." },
    roadmap: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["when", "task", "owner", "priority"],
        properties: {
          when: { type: "string", description: "e.g. 'J-7', 'J-2', 'Veille', 'Jour J 10:00'" },
          task: { type: "string" },
          owner: { type: "string", description: "team or role" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    vigilance: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["level", "title", "detail"],
        properties: {
          level: { type: "string", enum: ["high", "medium", "low"] },
          title: { type: "string" },
          detail: { type: "string" },
        },
      },
    },
    checklist: {
      type: "object",
      additionalProperties: false,
      required: ["reception", "kitchen", "housekeeping", "transport", "activities"],
      properties: {
        reception: { type: "array", items: { type: "string" } },
        kitchen: { type: "array", items: { type: "string" } },
        housekeeping: { type: "array", items: { type: "string" } },
        transport: { type: "array", items: { type: "string" } },
        activities: { type: "array", items: { type: "string" } },
      },
    },
    questionsToClient: { type: "array", items: { type: "string" } },
  },
} as const;

interface Body {
  reservation: Reservation;
  settings?: Partial<Settings>;
  lang: Lang;
}

function stripForPrompt(r: Reservation) {
  // On retire les caches (météo brute, conseils, traductions) pour ne pas
  // polluer le prompt ; la météo est injectée sous forme résumée.
  const { weather: _w, advice: _a, translations: _t, ...rest } = r;
  void _w; void _a; void _t;
  return rest;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Requête invalide" }, { status: 400 });
  }
  const { reservation, lang } = body;
  if (!reservation || !reservation.id) return Response.json({ error: "Réservation manquante" }, { status: 400 });
  if (!["fr", "en", "ar"].includes(lang)) return Response.json({ error: "Langue inconnue" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Clé API manquante (ANTHROPIC_API_KEY)." }, { status: 500 });
  }
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(body.settings ?? {}) };

  const system =
    `You are ZORO, the operations brain of "${settings.siteName}", a hospitality venue. ` +
    `You turn a reservation into a concrete preparation plan for the internal teams (reception, kitchen, housekeeping, transport, activities) and external partners.\n` +
    (settings.description.trim() ? `About the venue (written by the manager): ${settings.description.trim()}\n` : "") +
    `Rules:\n` +
    `- Be concrete and operational: times, quantities, names of things, who does what. No generic hospitality advice.\n` +
    `- Everything must derive from the booking data, the weather forecast and the automatic checks provided. Never invent facts; if data is missing, turn it into a question for the client or a task.\n` +
    `- Wind matters a lot here: outdoor spaces are only usable when the wind allows. Thresholds used: caution from ${settings.windWarn} km/h mean wind, outdoor not advised from ${settings.windStop} km/h mean or ${settings.gustStop} km/h gusts.\n` +
    `- Roadmap: ordered by time, from booking day to departure (J-7, J-3, J-1, Jour J with hours, during the stay, departure). 8 to 16 items.\n` +
    `- Vigilance: the specific risks of THIS booking, sorted by level. Include the automatic checks only if you add something to them; do not simply repeat them.\n` +
    `- Checklists: short imperative lines, max 8 per team, empty array if a team is not concerned.\n` +
    `- Questions to client: only what really blocks preparation.\n` +
    `- Write ALL text fields in ${LANG_NAME_FOR_AI[lang]}. Keep dates as YYYY-MM-DD or day names, times as HH:MM.`;

  const user =
    `RESERVATION (JSON):\n${JSON.stringify(stripForPrompt(reservation), null, 1)}\n\n` +
    `WEATHER FORECAST FOR THE STAY:\n${weatherSummaryForAI(reservation.weather)}\n\n` +
    `AUTOMATIC CHECKS ALREADY SHOWN TO THE TEAM:\n${rulesSummaryForAI(reservation, settings) || "(none)"}\n\n` +
    `Produce the preparation plan.`;

  try {
    const stream = client.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: ADVICE_SCHEMA } },
      system,
      messages: [{ role: "user", content: user }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") {
      return Response.json({ error: "Le modèle a refusé la demande." }, { status: 502 });
    }
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const parsed = JSON.parse(text) as Omit<Advice, "lang" | "generatedAt">;
    const advice: Advice = { ...parsed, lang, generatedAt: new Date().toISOString() };
    return Response.json({ advice });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return Response.json({ error: "Clé API invalide." }, { status: 500 });
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "Trop de requêtes, réessaie dans une minute." }, { status: 429 });
    if (err instanceof Anthropic.APIError) return Response.json({ error: `Erreur API (${err.status}) : ${err.message}` }, { status: 502 });
    const m = err instanceof Error ? err.message : "Erreur inattendue";
    return Response.json({ error: m }, { status: 500 });
  }
}
