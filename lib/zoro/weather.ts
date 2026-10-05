// ZORO — prévisions météo via Open-Meteo (gratuit, sans clé, CORS ouvert)
// et verdict « extérieur exploitable ? » basé sur le vent.

import type { DaySlotWind, Settings, WeatherCache, WeatherDay } from "./types";

type Verdict = DaySlotWind["verdict"];

export function windVerdict(wind: number | null, gust: number | null, s: Settings): Verdict {
  if (wind == null && gust == null) return "unknown";
  const w = wind ?? 0;
  const g = gust ?? 0;
  if (w >= s.windStop || g >= s.gustStop) return "no";
  if (w >= s.windWarn || g >= s.windStop) return "warn";
  return "ok";
}

export function worstVerdict(...vs: Verdict[]): Verdict {
  const order: Verdict[] = ["unknown", "ok", "warn", "no"];
  return vs.reduce((acc, v) => (order.indexOf(v) > order.indexOf(acc) ? v : acc), "unknown" as Verdict);
}

export function beaufort(kmh: number | null): number | null {
  if (kmh == null) return null;
  const limits = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
  let b = 0;
  while (b < limits.length && kmh >= limits[b]) b++;
  return b;
}

export function weatherEmoji(code: number | null): string {
  if (code == null) return "·";
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

export function windDirLabel(deg: number | null): string {
  if (deg == null) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(deg / 45) % 8];
}

export interface GeoResult {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

export async function geocode(query: string): Promise<GeoResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=fr&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Géocodage indisponible");
  const data = (await res.json()) as { results?: GeoResult[] };
  return data.results ?? [];
}

function emptyDay(date: string, available: boolean): WeatherDay {
  const u: DaySlotWind = { wind: null, gust: null, verdict: "unknown" };
  return {
    date,
    available,
    code: null,
    tMax: null,
    tMin: null,
    rainProb: null,
    rainMm: null,
    windMax: null,
    gustMax: null,
    windDir: null,
    slots: { morning: { ...u }, afternoon: { ...u }, evening: { ...u } },
    verdict: "unknown",
  };
}

interface OMResponse {
  daily?: {
    time: string[];
    weather_code: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_probability_max: (number | null)[];
    precipitation_sum: (number | null)[];
    wind_speed_10m_max: (number | null)[];
    wind_gusts_10m_max: (number | null)[];
    wind_direction_10m_dominant: (number | null)[];
  };
  hourly?: {
    time: string[];
    wind_speed_10m: (number | null)[];
    wind_gusts_10m: (number | null)[];
  };
}

/**
 * Charge les prévisions pour une liste de dates (YYYY-MM-DD). Les dates hors
 * de l'horizon Open-Meteo (16 jours) sont renvoyées avec available=false.
 */
export async function fetchWeather(dates: string[], s: Settings): Promise<WeatherCache> {
  if (s.lat == null || s.lon == null) throw new Error("Lieu non configuré");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 15);
  const toISO = (d: Date) => d.toISOString().slice(0, 10);

  const inRange = dates.filter((d) => {
    const x = new Date(d + "T00:00:00");
    return x >= today && x <= horizon;
  });

  const days: WeatherDay[] = dates.map((d) => emptyDay(d, inRange.includes(d)));
  if (inRange.length === 0) {
    return { fetchedAt: new Date().toISOString(), lat: s.lat, lon: s.lon, days };
  }

  const start = inRange[0];
  const end = inRange[inRange.length - 1];
  const params = new URLSearchParams({
    latitude: String(s.lat),
    longitude: String(s.lon),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant",
    hourly: "wind_speed_10m,wind_gusts_10m",
    wind_speed_unit: "kmh",
    timezone: "auto",
    start_date: start,
    end_date: end,
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) throw new Error(`Open-Meteo : ${res.status}`);
  const data = (await res.json()) as OMResponse;

  const byDate = new Map(days.map((d) => [d.date, d]));
  const daily = data.daily;
  if (daily) {
    daily.time.forEach((date, i) => {
      const d = byDate.get(date);
      if (!d) return;
      d.code = daily.weather_code[i];
      d.tMax = daily.temperature_2m_max[i];
      d.tMin = daily.temperature_2m_min[i];
      d.rainProb = daily.precipitation_probability_max[i];
      d.rainMm = daily.precipitation_sum[i];
      d.windMax = daily.wind_speed_10m_max[i];
      d.gustMax = daily.wind_gusts_10m_max[i];
      d.windDir = daily.wind_direction_10m_dominant[i];
    });
  }
  const hourly = data.hourly;
  if (hourly) {
    const acc = new Map<string, { m: number[]; mg: number[]; a: number[]; ag: number[]; e: number[]; eg: number[] }>();
    hourly.time.forEach((ts, i) => {
      const [date, hm] = ts.split("T");
      const h = parseInt(hm.slice(0, 2), 10);
      const w = hourly.wind_speed_10m[i];
      const g = hourly.wind_gusts_10m[i];
      if (!acc.has(date)) acc.set(date, { m: [], mg: [], a: [], ag: [], e: [], eg: [] });
      const a = acc.get(date)!;
      if (h >= 7 && h < 12) { if (w != null) a.m.push(w); if (g != null) a.mg.push(g); }
      else if (h >= 12 && h < 18) { if (w != null) a.a.push(w); if (g != null) a.ag.push(g); }
      else if (h >= 18 && h < 24) { if (w != null) a.e.push(w); if (g != null) a.eg.push(g); }
    });
    const mx = (xs: number[]) => (xs.length ? Math.round(Math.max(...xs)) : null);
    for (const [date, a] of acc) {
      const d = byDate.get(date);
      if (!d) continue;
      const mk = (w: number[], g: number[]): DaySlotWind => ({ wind: mx(w), gust: mx(g), verdict: windVerdict(mx(w), mx(g), s) });
      d.slots = { morning: mk(a.m, a.mg), afternoon: mk(a.a, a.ag), evening: mk(a.e, a.eg) };
    }
  }
  for (const d of days) {
    if (!d.available) continue;
    const dayV = windVerdict(d.windMax, d.gustMax, s);
    d.verdict = worstVerdict(dayV, d.slots.morning.verdict, d.slots.afternoon.verdict, d.slots.evening.verdict);
  }
  return { fetchedAt: new Date().toISOString(), lat: s.lat, lon: s.lon, days };
}

/** Résumé texte compact de la météo pour l'IA. */
export function weatherSummaryForAI(w: WeatherCache | undefined): string {
  if (!w) return "No weather forecast available.";
  return w.days
    .map((d) => {
      if (!d.available) return `${d.date}: beyond forecast horizon`;
      const sl = (x: DaySlotWind) => `${x.wind ?? "?"}/${x.gust ?? "?"} km/h (${x.verdict})`;
      return `${d.date}: Tmax ${d.tMax ?? "?"}°C Tmin ${d.tMin ?? "?"}°C, rain ${d.rainProb ?? "?"}% (${d.rainMm ?? "?"} mm), wind max ${d.windMax ?? "?"} km/h gusts ${d.gustMax ?? "?"} km/h dir ${windDirLabel(d.windDir)}; morning ${sl(d.slots.morning)}, afternoon ${sl(d.slots.afternoon)}, evening ${sl(d.slots.evening)}; outdoor verdict: ${d.verdict}`;
    })
    .join("\n");
}
