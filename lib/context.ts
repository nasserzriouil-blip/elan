// Couche de compréhension de l'utilisateur : tout ce qu'il met dans l'app
// (notes, activité, discussions avec les compagnons) est agrégé ici en une
// synthèse compacte. Cette synthèse nourrit chaque compagnon ET la génération
// des mots du jour personnalisés. C'est la "mémoire" partagée d'Élan.

import { PERSONAS, PERSONA_ORDER, type PersonaId } from "@/lib/personas";

export type Msg = { role: "user" | "assistant"; content: string };
export type Convos = Record<PersonaId, Msg[]>;
export interface Insight {
  id: string;
  title: string;
  text: string;
}

export function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function computeStreak(map: Record<string, boolean[]>): number {
  const active = (d: Date) => (map[dateKey(d)] ?? []).some(Boolean);
  const cur = new Date();
  if (!active(cur)) cur.setDate(cur.getDate() - 1);
  let n = 0;
  while (active(cur)) {
    n++;
    cur.setDate(cur.getDate() - 1);
  }
  return n;
}

export function computeWeek(map: Record<string, boolean[]>): number {
  let n = 0;
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    if ((map[dateKey(d)] ?? []).some(Boolean)) n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// Y a-t-il assez de matière pour personnaliser quoi que ce soit ?
export function hasSignal(
  convos: Convos,
  insights: Insight[],
  program: Record<string, boolean[]>,
): boolean {
  if (insights.length > 0) return true;
  if (Object.values(program).some((d) => d.some(Boolean))) return true;
  return PERSONA_ORDER.some((id) => (convos[id]?.length ?? 0) > 0);
}

// Synthèse injectée dans les compagnons et dans la génération des mots du jour.
// `excludeId` : on n'inclut pas la conversation en cours (déjà dans messages).
export function buildUserContext(
  convos: Convos,
  insights: Insight[],
  program: Record<string, boolean[]>,
  excludeId?: PersonaId,
): string {
  const parts: string[] = [];

  if (insights.length) {
    parts.push(
      "Ses repères (ce qu'il a compris, dans ses mots) :\n" +
        insights
          .slice(0, 10)
          .map((i) => `- ${i.text}`)
          .join("\n"),
    );
  }

  const streak = computeStreak(program);
  const week = computeWeek(program);
  parts.push(`Activité : série de ${streak} jour(s) d'affilée, ${week}/7 cette semaine.`);

  const bribes: string[] = [];
  for (const id of PERSONA_ORDER) {
    if (id === excludeId) continue;
    const msgs = (convos[id] ?? []).filter((m) => m.role === "user").slice(-2);
    if (msgs.length) {
      bribes.push(`[avec ${PERSONAS[id].name}] ` + msgs.map((m) => m.content).join(" / "));
    }
  }
  if (bribes.length) {
    parts.push("Bribes de ses échanges récents avec les autres compagnons :\n" + bribes.join("\n"));
  }

  return parts.join("\n\n");
}
