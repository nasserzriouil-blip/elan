// ZORO — modèle de données d'une réservation Zed Zéro.
// Tout est volontairement plat et sérialisable (localStorage + export JSON).

export type Lang = "fr" | "en" | "ar";
export const LANGS: Lang[] = ["fr", "en", "ar"];

export type ResaStatus = "option" | "confirmed" | "deposit" | "paid" | "cancelled";
export type BedType = "single" | "double" | "twin" | "family" | "suite" | "tent" | "other";
export type IndoorOutdoor = "indoor" | "outdoor" | "flex";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "cocktail";
export type ExtraStatus = "requested" | "confirmed" | "paid" | "cancelled";
export type TransferType = "shuttle" | "4x4" | "taxi" | "private" | "bus" | "camel" | "other";

export interface Flight {
  id: string;
  kind: "arrival" | "departure";
  number: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (heure locale d'atterrissage / décollage)
  airport: string;
  from: string;
  to: string;
  terminal: string;
  pax: number;
  notes: string;
}

export interface Transfer {
  id: string;
  date: string;
  time: string; // heure de prise en charge
  type: TransferType;
  from: string;
  to: string;
  pax: number;
  vehicles: number;
  driver: string;
  phone: string;
  notes: string;
}

export interface Room {
  id: string;
  name: string;
  bedType: BedType;
  singles: number; // nombre de lits simples
  doubles: number; // nombre de lits doubles
  babyCots: number;
  occupants: string;
  notes: string;
}

export interface ProgramItem {
  id: string;
  date: string;
  start: string;
  end: string;
  title: string;
  place: string;
  setting: IndoorOutdoor;
  responsible: string;
  notes: string;
}

export interface Meal {
  id: string;
  date: string;
  type: MealType;
  time: string;
  place: string;
  setting: IndoorOutdoor;
  menu: string;
  pax: number;
  notes: string;
}

export interface Extra {
  id: string;
  name: string;
  date: string;
  time: string;
  qty: number;
  provider: string;
  status: ExtraStatus;
  price: string;
  notes: string;
}

export interface DaySlotWind {
  wind: number | null; // km/h moyen max sur le créneau
  gust: number | null; // rafale max sur le créneau
  verdict: "ok" | "warn" | "no" | "unknown";
}

export interface WeatherDay {
  date: string;
  available: boolean; // false = hors horizon de prévision
  code: number | null;
  tMax: number | null;
  tMin: number | null;
  rainProb: number | null;
  rainMm: number | null;
  windMax: number | null;
  gustMax: number | null;
  windDir: number | null;
  slots: { morning: DaySlotWind; afternoon: DaySlotWind; evening: DaySlotWind };
  verdict: "ok" | "warn" | "no" | "unknown";
}

export interface WeatherCache {
  fetchedAt: string;
  lat: number;
  lon: number;
  days: WeatherDay[];
}

export interface AdviceItem {
  level: "high" | "medium" | "low";
  title: string;
  detail: string;
}

export interface RoadmapItem {
  when: string;
  task: string;
  owner: string;
  priority: "high" | "medium" | "low";
}

export interface Advice {
  lang: Lang;
  generatedAt: string;
  headline: string;
  roadmap: RoadmapItem[];
  vigilance: AdviceItem[];
  checklist: {
    reception: string[];
    kitchen: string[];
    housekeeping: string[];
    transport: string[];
    activities: string[];
  };
  questionsToClient: string[];
}

export interface Reservation {
  id: string;
  ref: string;
  createdAt: string;
  updatedAt: string;
  client: {
    name: string;
    company: string;
    phone: string;
    email: string;
    language: string;
    vip: boolean;
    occasion: string;
    notes: string;
  };
  group: {
    adults: number;
    children: number;
    babies: number;
    nationalities: string;
    dietary: string;
    allergies: string;
    mobility: string;
    notes: string;
  };
  stay: {
    checkIn: string;
    checkOut: string;
    checkInTime: string;
    checkOutTime: string;
    pjTime: string; // « heure PJ »
    status: ResaStatus;
    source: string;
    notes: string;
  };
  flights: Flight[];
  transfers: Transfer[];
  rooms: Room[];
  program: ProgramItem[];
  meals: Meal[];
  extras: Extra[];
  contacts: {
    internalLead: string;
    internalPhone: string;
    externalPartners: string;
    notes: string;
  };
  notes: string;
  weather?: WeatherCache;
  advice?: Partial<Record<Lang, Advice>>;
  // Cache de traduction des textes libres : lang -> { texte original -> traduit }
  translations?: Partial<Record<Lang, Record<string, string>>>;
}

export interface Settings {
  siteName: string;
  placeName: string;
  lat: number | null;
  lon: number | null;
  description: string; // contexte du lieu pour l'IA (type de lieu, espaces extérieurs, contraintes)
  windWarn: number; // km/h vent moyen -> vigilance
  windStop: number; // km/h vent moyen -> extérieur déconseillé
  gustStop: number; // km/h rafales -> extérieur déconseillé
  rainWarn: number; // % probabilité de pluie -> vigilance
}

export const DEFAULT_SETTINGS: Settings = {
  siteName: "Zed Zéro",
  placeName: "",
  lat: null,
  lon: null,
  description: "",
  windWarn: 25,
  windStop: 38,
  gustStop: 55,
  rainWarn: 50,
};

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function nightsBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  const ms = new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export function stayDates(r: Reservation): string[] {
  const out: string[] = [];
  if (!r.stay.checkIn) return out;
  const n = r.stay.checkOut ? nightsBetween(r.stay.checkIn, r.stay.checkOut) : 0;
  for (let i = 0; i <= n; i++) out.push(addDays(r.stay.checkIn, i));
  return out;
}

export function totalPax(r: Reservation): number {
  return (r.group.adults || 0) + (r.group.children || 0) + (r.group.babies || 0);
}

export function bedCapacity(r: Reservation): number {
  return r.rooms.reduce((s, rm) => s + (rm.singles || 0) + 2 * (rm.doubles || 0), 0);
}

export function makeRef(): string {
  const d = new Date();
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const rnd = Math.floor(Math.random() * 900 + 100);
  return `ZZ-${y}${m}-${rnd}`;
}

export function emptyReservation(): Reservation {
  const now = new Date().toISOString();
  const ci = todayISO();
  return {
    id: newId(),
    ref: makeRef(),
    createdAt: now,
    updatedAt: now,
    client: { name: "", company: "", phone: "", email: "", language: "fr", vip: false, occasion: "", notes: "" },
    group: { adults: 2, children: 0, babies: 0, nationalities: "", dietary: "", allergies: "", mobility: "", notes: "" },
    stay: { checkIn: ci, checkOut: addDays(ci, 2), checkInTime: "15:00", checkOutTime: "11:00", pjTime: "", status: "option", source: "", notes: "" },
    flights: [],
    transfers: [],
    rooms: [],
    program: [],
    meals: [],
    extras: [],
    contacts: { internalLead: "", internalPhone: "", externalPartners: "", notes: "" },
    notes: "",
  };
}

export const emptyFlight = (): Flight => ({ id: newId(), kind: "arrival", number: "", date: "", time: "", airport: "", from: "", to: "", terminal: "", pax: 0, notes: "" });
export const emptyTransfer = (): Transfer => ({ id: newId(), date: "", time: "", type: "shuttle", from: "", to: "", pax: 0, vehicles: 1, driver: "", phone: "", notes: "" });
export const emptyRoom = (): Room => ({ id: newId(), name: "", bedType: "double", singles: 0, doubles: 1, babyCots: 0, occupants: "", notes: "" });
export const emptyProgramItem = (): ProgramItem => ({ id: newId(), date: "", start: "", end: "", title: "", place: "", setting: "outdoor", responsible: "", notes: "" });
export const emptyMeal = (): Meal => ({ id: newId(), date: "", type: "dinner", time: "20:00", place: "", setting: "flex", menu: "", pax: 0, notes: "" });
export const emptyExtra = (): Extra => ({ id: newId(), name: "", date: "", time: "", qty: 1, provider: "", status: "requested", price: "", notes: "" });

/** Normalise une réservation importée (champs manquants -> valeurs par défaut). */
export function normalizeReservation(input: unknown): Reservation | null {
  if (!input || typeof input !== "object") return null;
  const base = emptyReservation();
  const r = input as Partial<Reservation>;
  if (!r.id) return null;
  return {
    ...base,
    ...r,
    client: { ...base.client, ...(r.client ?? {}) },
    group: { ...base.group, ...(r.group ?? {}) },
    stay: { ...base.stay, ...(r.stay ?? {}) },
    contacts: { ...base.contacts, ...(r.contacts ?? {}) },
    flights: Array.isArray(r.flights) ? r.flights : [],
    transfers: Array.isArray(r.transfers) ? r.transfers : [],
    rooms: Array.isArray(r.rooms) ? r.rooms : [],
    program: Array.isArray(r.program) ? r.program : [],
    meals: Array.isArray(r.meals) ? r.meals : [],
    extras: Array.isArray(r.extras) ? r.extras : [],
  };
}

/** Récupère tous les textes libres (pour la traduction). */
export function freeTexts(r: Reservation): string[] {
  const out = new Set<string>();
  const add = (s?: string) => {
    const t = (s ?? "").trim();
    if (t && !/^[\d\s:./-]+$/.test(t)) out.add(t);
  };
  add(r.client.occasion); add(r.client.notes); add(r.client.company);
  add(r.group.nationalities); add(r.group.dietary); add(r.group.allergies); add(r.group.mobility); add(r.group.notes);
  add(r.stay.source); add(r.stay.notes);
  r.flights.forEach((f) => { add(f.airport); add(f.from); add(f.to); add(f.notes); });
  r.transfers.forEach((t) => { add(t.from); add(t.to); add(t.notes); });
  r.rooms.forEach((rm) => { add(rm.name); add(rm.occupants); add(rm.notes); });
  r.program.forEach((p) => { add(p.title); add(p.place); add(p.responsible); add(p.notes); });
  r.meals.forEach((m) => { add(m.place); add(m.menu); add(m.notes); });
  r.extras.forEach((e) => { add(e.name); add(e.provider); add(e.notes); });
  add(r.contacts.externalPartners); add(r.contacts.notes);
  add(r.notes);
  return Array.from(out);
}
