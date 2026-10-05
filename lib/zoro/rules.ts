// ZORO — moteur de règles déterministe : points de vigilance calculés
// localement à partir des inputs (sans IA). L'IA vient en complément.

import { fmtDate, t } from "./i18n";
import type { AdviceItem, Lang, Reservation, Settings, WeatherDay } from "./types";
import { bedCapacity, stayDates, totalPax } from "./types";

function toMin(hhmm: string): number | null {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function slotFor(hhmm: string): "morning" | "afternoon" | "evening" | null {
  const m = toMin(hhmm);
  if (m == null) return null;
  const h = m / 60;
  if (h >= 7 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  if (h >= 18) return "evening";
  return null;
}

const LANG_NAMES: Record<string, Record<Lang, string>> = {
  en: { fr: "anglais", en: "English", ar: "الإنجليزية" },
  es: { fr: "espagnol", en: "Spanish", ar: "الإسبانية" },
  de: { fr: "allemand", en: "German", ar: "الألمانية" },
  it: { fr: "italien", en: "Italian", ar: "الإيطالية" },
  ar: { fr: "arabe", en: "Arabic", ar: "العربية" },
  nl: { fr: "néerlandais", en: "Dutch", ar: "الهولندية" },
  pt: { fr: "portugais", en: "Portuguese", ar: "البرتغالية" },
  zh: { fr: "chinois", en: "Chinese", ar: "الصينية" },
  ru: { fr: "russe", en: "Russian", ar: "الروسية" },
  ja: { fr: "japonais", en: "Japanese", ar: "اليابانية" },
};

export function computeRules(r: Reservation, s: Settings, lang: Lang): AdviceItem[] {
  const out: AdviceItem[] = [];
  const push = (level: AdviceItem["level"], key: string, params: Record<string, string | number> | undefined, title: string) =>
    out.push({ level, title, detail: t(lang, key, params) });
  const pax = totalPax(r);
  const dates = stayDates(r);
  const fmt = (iso: string) => (iso ? fmtDate(lang, iso) : "—");

  // Statut
  if (r.stay.status === "cancelled") push("high", "rule.cancelled", undefined, t(lang, "status"));
  else if (r.stay.status === "option") push("high", "rule.option", undefined, t(lang, "status"));

  // Couchage
  if (r.rooms.length === 0) push("high", "rule.noRooms", undefined, t(lang, "rooms"));
  else {
    const cap = bedCapacity(r);
    if (cap < pax) push("high", "rule.capacity", { cap, pax }, t(lang, "rooms"));
    const cots = r.rooms.reduce((a, rm) => a + (rm.babyCots || 0), 0);
    if (r.group.babies > 0 && cots < r.group.babies) push("medium", "rule.babyCots", undefined, t(lang, "rooms"));
  }

  // Groupe
  if (r.group.babies > 0) push("medium", "rule.babies", { n: r.group.babies }, t(lang, "group"));
  if (r.group.children > 0) push("medium", "rule.children", { n: r.group.children }, t(lang, "group"));
  if (r.group.allergies.trim()) push("high", "rule.allergies", { txt: r.group.allergies.trim() }, t(lang, "kitchen"));
  if (r.group.dietary.trim()) push("medium", "rule.dietary", { txt: r.group.dietary.trim() }, t(lang, "kitchen"));
  if (r.group.mobility.trim()) push("medium", "rule.mobility", { txt: r.group.mobility.trim() }, t(lang, "group"));
  if (pax >= 10) push("medium", "rule.bigGroup", { pax }, t(lang, "group"));
  if (r.client.vip) push("medium", "rule.vip", undefined, t(lang, "client"));
  if (r.client.occasion.trim()) push("medium", "rule.occasion", { txt: r.client.occasion.trim() }, t(lang, "client"));
  if (!r.client.phone.trim()) push("low", "rule.noPhone", undefined, t(lang, "client"));
  const cl = r.client.language.trim().toLowerCase();
  if (cl && cl !== "fr" && cl !== "français" && cl !== "francais") {
    const name = LANG_NAMES[cl]?.[lang] ?? r.client.language;
    push("low", "rule.language", { lang: name }, t(lang, "client"));
  }
  if (!r.stay.pjTime.trim()) push("low", "rule.pjMissing", undefined, t(lang, "stay"));

  // Horaires d'arrivée / départ
  const arrivals = r.flights.filter((f) => f.kind === "arrival");
  const departures = r.flights.filter((f) => f.kind === "departure");
  const arrTime = arrivals[0]?.time || r.stay.checkInTime;
  const am = toMin(arrTime);
  if (am != null && am >= 21 * 60) push("medium", "rule.lateArrival", { time: arrTime }, t(lang, "checkIn"));
  if (am != null && am < 7 * 60) push("medium", "rule.earlyArrival", { time: arrTime }, t(lang, "checkIn"));
  const depTime = departures[0]?.time || r.stay.checkOutTime;
  const dm = toMin(depTime);
  if (dm != null && dm < 8 * 60) push("medium", "rule.earlyDeparture", { time: depTime }, t(lang, "checkOut"));

  // Vols <-> transferts
  for (const f of arrivals) {
    if (f.date && r.stay.checkIn && f.date !== r.stay.checkIn) push("medium", "rule.flightDateMismatch", { fd: fmt(f.date), ci: fmt(r.stay.checkIn) }, t(lang, "flights"));
    const same = r.transfers.filter((tr) => tr.date === f.date);
    if (f.date && same.length === 0) push("medium", "rule.noTransfer", { date: fmt(f.date) }, t(lang, "transport"));
    const land = toMin(f.time);
    for (const tr of same) {
      const pick = toMin(tr.time);
      if (land != null && pick != null && pick - land < 60) push("high", "rule.transferTooEarly", { date: fmt(tr.date), t: tr.time, land: f.time }, t(lang, "transport"));
    }
  }
  for (const tr of r.transfers) {
    const p = tr.pax || pax;
    if (tr.vehicles > 0 && p / tr.vehicles > 6) push("medium", "rule.transferPax", { date: fmt(tr.date), v: tr.vehicles, pax: p }, t(lang, "transport"));
  }

  // Programme & repas
  if (r.program.length === 0) push("low", "rule.noProgram", undefined, t(lang, "program"));
  for (const p of r.program) {
    if (p.date && dates.length && !dates.includes(p.date)) push("low", "rule.programOutsideStay", { what: p.title || t(lang, "activity"), date: fmt(p.date) }, t(lang, "program"));
  }
  for (const d of dates.slice(0, -1)) {
    if (!r.meals.some((m) => m.date === d)) push("low", "rule.mealsMissing", { date: fmt(d) }, t(lang, "meals"));
  }

  // Extras
  const pending = r.extras.filter((e) => e.status === "requested").length;
  if (pending > 0) push("medium", "rule.extrasPending", { n: pending }, t(lang, "extras"));

  // Météo
  const w = r.weather;
  const hasOutdoor = r.program.some((p) => p.setting !== "indoor") || r.meals.some((m) => m.setting !== "indoor");
  if (!w || !w.days.some((d) => d.available)) {
    if (hasOutdoor) push("medium", "rule.noWeather", undefined, t(lang, "weather"));
  } else {
    const byDate = new Map<string, WeatherDay>(w.days.map((d) => [d.date, d]));
    const outdoorThings: { date: string; time: string; what: string; flex: boolean }[] = [
      ...r.program.filter((p) => p.setting !== "indoor").map((p) => ({ date: p.date, time: p.start, what: p.title || t(lang, "activity"), flex: p.setting === "flex" })),
      ...r.meals.filter((m) => m.setting !== "indoor").map((m) => ({ date: m.date, time: m.time, what: t(lang, `meal.${m.type}`), flex: m.setting === "flex" })),
    ];
    for (const o of outdoorThings) {
      const d = byDate.get(o.date);
      if (!d || !d.available) continue;
      const slot = slotFor(o.time);
      const sw = slot ? d.slots[slot] : null;
      const v = sw && sw.verdict !== "unknown" ? sw.verdict : d.verdict;
      const wind = sw?.wind ?? d.windMax ?? "?";
      const gust = sw?.gust ?? d.gustMax ?? "?";
      // Un élément « flexible » a déjà un repli intérieur : on baisse d'un niveau.
      if (v === "no") push(o.flex ? "medium" : "high", "rule.outdoorNo", { what: o.what, date: fmt(o.date), wind, gust }, t(lang, "wind"));
      else if (v === "warn") push(o.flex ? "low" : "medium", "rule.outdoorWarn", { what: o.what, date: fmt(o.date), wind }, t(lang, "wind"));
    }
    const seen = new Set<string>();
    for (const d of w.days) {
      if (!d.available || seen.has(d.date)) continue;
      seen.add(d.date);
      if (d.rainProb != null && d.rainProb >= s.rainWarn && hasOutdoor) push("medium", "rule.rain", { date: fmt(d.date), p: d.rainProb }, t(lang, "weather"));
      if (d.tMax != null && d.tMax >= 38) push("medium", "rule.heat", { date: fmt(d.date), t: Math.round(d.tMax) }, t(lang, "weather"));
      if (d.tMin != null && d.tMin <= 8) push("low", "rule.cold", { date: fmt(d.date), t: Math.round(d.tMin) }, t(lang, "weather"));
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/** Résumé texte des règles pour l'IA (toujours en anglais côté prompt). */
export function rulesSummaryForAI(r: Reservation, s: Settings): string {
  return computeRules(r, s, "en").map((x) => `[${x.level}] ${x.title}: ${x.detail}`).join("\n");
}
