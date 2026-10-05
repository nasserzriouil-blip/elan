"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Fiche from "./Fiche";
import { LANG_LABEL } from "@/lib/zoro/i18n";
import { computeRules } from "@/lib/zoro/rules";
import {
  DEFAULT_SETTINGS,
  addDays,
  emptyExtra,
  emptyFlight,
  emptyMeal,
  emptyProgramItem,
  emptyReservation,
  emptyRoom,
  emptyTransfer,
  freeTexts,
  LANGS,
  newId,
  nightsBetween,
  normalizeReservation,
  stayDates,
  totalPax,
  bedCapacity,
  type Advice,
  type Lang,
  type Reservation,
  type Settings,
} from "@/lib/zoro/types";
import { fetchWeather, geocode, type GeoResult } from "@/lib/zoro/weather";

const LS_RESAS = "zoro-reservations";
const LS_SETTINGS = "zoro-settings";
const LS_CURRENT = "zoro-current";

type Mode = "edit" | "sheet" | "settings";
type ListKey = "flights" | "transfers" | "rooms" | "program" | "meals" | "extras";

/* ---------- petits composants de formulaire ---------- */

function Txt({ label, value, onChange, type = "text", placeholder, className, list }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string; list?: string }) {
  const id = useId();
  return (
    <div className={`z-field ${className ?? ""}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} placeholder={placeholder} list={list} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Num({ label, value, onChange, min = 0, className }: { label: string; value: number; onChange: (v: number) => void; min?: number; className?: string }) {
  const id = useId();
  return (
    <div className={`z-field ${className ?? ""}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="numeric" min={min} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Math.max(min, parseInt(e.target.value || "0", 10) || 0))} />
    </div>
  );
}

function Sel<V extends string>({ label, value, onChange, options, className }: { label: string; value: V; onChange: (v: V) => void; options: { v: V; l: string }[]; className?: string }) {
  const id = useId();
  return (
    <div className={`z-field ${className ?? ""}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as V)}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function Area({ label, value, onChange, placeholder, className }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const id = useId();
  return (
    <div className={`z-field ${className ?? "wide"}`}>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ---------- page ---------- */

export default function ZoroPage() {
  const [resas, setResas] = useState<Reservation[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<Mode>("edit");
  const [lang, setLang] = useState<Lang>("fr");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<"" | "weather" | "translate" | "advice">("");
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [geoQuery, setGeoQuery] = useState("");
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Chargement
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_RESAS);
      const list = raw ? (JSON.parse(raw) as unknown[]).map(normalizeReservation).filter((x): x is Reservation => !!x) : [];
      const s = localStorage.getItem(LS_SETTINGS);
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(s) as Partial<Settings>) });
      const cur = localStorage.getItem(LS_CURRENT);
      if (list.length === 0) {
        const r = emptyReservation();
        setResas([r]);
        setCurrentId(r.id);
      } else {
        setResas(list);
        setCurrentId(cur && list.some((x) => x.id === cur) ? cur : list[0].id);
      }
    } catch {
      const r = emptyReservation();
      setResas([r]);
      setCurrentId(r.id);
    }
    setLoaded(true);
  }, []);

  // Persistance
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(LS_RESAS, JSON.stringify(resas));
      localStorage.setItem(LS_CURRENT, currentId);
    } catch { /* quota */ }
  }, [resas, currentId, loaded]);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); } catch { /* noop */ }
  }, [settings, loaded]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const r = useMemo(() => resas.find((x) => x.id === currentId), [resas, currentId]);

  const update = useCallback((fn: (x: Reservation) => Reservation) => {
    setResas((list) => list.map((x) => (x.id === currentId ? { ...fn(x), updatedAt: new Date().toISOString() } : x)));
  }, [currentId]);

  const set = <K extends keyof Reservation>(key: K, value: Reservation[K]) => update((x) => ({ ...x, [key]: value }));
  const setSub = <K extends "client" | "group" | "stay" | "contacts">(key: K, patch: Partial<Reservation[K]>) =>
    update((x) => ({ ...x, [key]: { ...x[key], ...patch } }));
  const patchItem = <K extends ListKey>(key: K, id: string, patch: Partial<Reservation[K][number]>) =>
    update((x) => ({ ...x, [key]: (x[key] as Reservation[K][number][]).map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  const addItem = <K extends ListKey>(key: K, item: Reservation[K][number]) => update((x) => ({ ...x, [key]: [...(x[key] as Reservation[K][number][]), item] }));
  const delItem = (key: ListKey, id: string) => update((x) => ({ ...x, [key]: (x[key] as { id: string }[]).filter((it) => it.id !== id) as never }));

  /* ---------- actions réservation ---------- */
  const createResa = () => {
    const n = emptyReservation();
    setResas((l) => [n, ...l]);
    setCurrentId(n.id);
    setMode("edit");
  };
  const duplicateResa = () => {
    if (!r) return;
    const n: Reservation = { ...structuredClone(r), id: newId(), ref: r.ref + "-copie", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), advice: undefined };
    setResas((l) => [n, ...l]);
    setCurrentId(n.id);
    setMode("edit");
  };
  const deleteResa = () => {
    if (!r) return;
    if (!confirm(`Supprimer la réservation ${r.ref} (${r.client.name || "sans nom"}) ?`)) return;
    const rest = resas.filter((x) => x.id !== r.id);
    if (rest.length === 0) {
      const n = emptyReservation();
      setResas([n]);
      setCurrentId(n.id);
    } else {
      setResas(rest);
      setCurrentId(rest[0].id);
    }
  };
  const exportJSON = () => {
    if (!r) return;
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ZORO-${r.ref}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJSON = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as unknown;
      const items = (Array.isArray(data) ? data : [data]).map(normalizeReservation).filter((x): x is Reservation => !!x);
      if (items.length === 0) throw new Error("Fichier non reconnu");
      setResas((l) => [...items, ...l.filter((x) => !items.some((i) => i.id === x.id))]);
      setCurrentId(items[0].id);
      setToast({ msg: `${items.length} réservation(s) importée(s)` });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Import impossible", err: true });
    }
  };

  /* ---------- météo ---------- */
  const refreshWeather = useCallback(async (silent = false) => {
    if (!r) return;
    if (settings.lat == null || settings.lon == null) {
      if (!silent) setToast({ msg: "Renseigne le lieu dans les réglages pour la météo.", err: true });
      return;
    }
    setBusy("weather");
    try {
      const w = await fetchWeather(stayDates(r), settings);
      update((x) => ({ ...x, weather: w }));
      if (!silent) setToast({ msg: "Météo mise à jour" });
    } catch (e) {
      if (!silent) setToast({ msg: e instanceof Error ? e.message : "Météo indisponible", err: true });
    } finally {
      setBusy("");
    }
  }, [r, settings, update]);

  // Rafraîchissement auto à l'ouverture de la fiche si la météo est absente ou vieille de > 6 h
  useEffect(() => {
    if (mode !== "sheet" || !r || settings.lat == null) return;
    const dates = stayDates(r);
    const w = r.weather;
    const stale = !w || Date.now() - new Date(w.fetchedAt).getTime() > 6 * 3600 * 1000 || w.days.length !== dates.length || w.days.some((d, i) => d.date !== dates[i]) || w.lat !== settings.lat || w.lon !== settings.lon;
    if (stale) void refreshWeather(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentId]);

  /* ---------- IA ---------- */
  const translateSheet = async () => {
    if (!r || lang === "fr") return;
    const cache = r.translations?.[lang] ?? {};
    const missing = freeTexts(r).filter((s) => !cache[s]);
    if (missing.length === 0) { setToast({ msg: "Tout est déjà traduit" }); return; }
    setBusy("translate");
    try {
      const res = await fetch("/api/zoro/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang, texts: missing }) });
      const data = (await res.json()) as { translations?: string[]; error?: string };
      if (!res.ok || !data.translations) throw new Error(data.error ?? "Erreur de traduction");
      const merged = { ...cache };
      missing.forEach((s, i) => { merged[s] = data.translations![i]; });
      update((x) => ({ ...x, translations: { ...(x.translations ?? {}), [lang]: merged } }));
      setToast({ msg: `${missing.length} texte(s) traduit(s)` });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Traduction impossible", err: true });
    } finally {
      setBusy("");
    }
  };

  const generateAdvice = async () => {
    if (!r) return;
    setBusy("advice");
    try {
      const res = await fetch("/api/zoro/advice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reservation: r, settings, lang }) });
      const data = (await res.json()) as { advice?: Advice; error?: string };
      if (!res.ok || !data.advice) throw new Error(data.error ?? "Erreur IA");
      update((x) => ({ ...x, advice: { ...(x.advice ?? {}), [lang]: data.advice } }));
      setToast({ msg: "Conseils générés" });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "IA indisponible", err: true });
    } finally {
      setBusy("");
    }
  };

  /* ---------- raccourcis de saisie ---------- */
  const generateMeals = () => {
    if (!r) return;
    const dates = stayDates(r);
    const items = [] as Reservation["meals"];
    dates.forEach((d, i) => {
      const first = i === 0;
      const last = i === dates.length - 1;
      if (!first) items.push({ ...emptyMeal(), date: d, type: "breakfast", time: "08:30" });
      if (!first && !last) items.push({ ...emptyMeal(), date: d, type: "lunch", time: "13:00" });
      if (!last) items.push({ ...emptyMeal(), date: d, type: "dinner", time: "20:00" });
    });
    const existing = new Set(r.meals.map((m) => m.date + m.type));
    const fresh = items.filter((m) => !existing.has(m.date + m.type));
    update((x) => ({ ...x, meals: [...x.meals, ...fresh] }));
    setToast({ msg: `${fresh.length} repas ajouté(s)` });
  };

  const runGeocode = async () => {
    if (!geoQuery.trim()) return;
    try {
      setGeoResults(await geocode(geoQuery.trim()));
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Géocodage impossible", err: true });
    }
  };

  const rules = useMemo(() => (r ? computeRules(r, settings, lang) : []), [r, settings, lang]);

  if (!loaded || !r) return <div className="z-main">Chargement…</div>;

  const pax = totalPax(r);
  const dates = stayDates(r);
  const dateOptions = dates.map((d) => ({ v: d, l: d }));
  const dateList = "zoro-dates";

  return (
    <>
      <datalist id={dateList}>{dates.map((d) => <option key={d} value={d} />)}</datalist>

      <header className="z-top no-print">
        <div className="z-logo">ZORO<small>Réservations {settings.siteName}</small></div>
        <select value={currentId} onChange={(e) => setCurrentId(e.target.value)} title="Réservation en cours">
          {resas.map((x) => <option key={x.id} value={x.id}>{x.ref} · {x.client.name || "sans nom"} · {x.stay.checkIn}</option>)}
        </select>
        <button onClick={createResa}>+ Nouvelle</button>
        <div className="z-grow" />
        <button className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>Saisie</button>
        <button className={mode === "sheet" ? "active" : ""} onClick={() => setMode("sheet")}>Fiche & PDF</button>
        <button className={mode === "settings" ? "active" : ""} onClick={() => setMode("settings")} title="Réglages">⚙︎</button>
      </header>

      <main className="z-main">
        {toast && <div className={`z-toast no-print ${toast.err ? "err" : ""}`}>{toast.msg}</div>}

        {mode === "settings" && (
          <>
            <div className="z-card">
              <h2>Lieu & météo</h2>
              <div className="z-grid">
                <Txt label="Nom du lieu" value={settings.siteName} onChange={(v) => setSettings({ ...settings, siteName: v })} />
                <Txt label="Localité affichée" value={settings.placeName} onChange={(v) => setSettings({ ...settings, placeName: v })} placeholder="ex. Merzouga" />
                <div className="z-field"><label htmlFor="z-lat">Latitude</label><input id="z-lat" type="number" step="0.0001" value={settings.lat ?? ""} onChange={(e) => setSettings({ ...settings, lat: e.target.value === "" ? null : parseFloat(e.target.value) })} /></div>
                <div className="z-field"><label htmlFor="z-lon">Longitude</label><input id="z-lon" type="number" step="0.0001" value={settings.lon ?? ""} onChange={(e) => setSettings({ ...settings, lon: e.target.value === "" ? null : parseFloat(e.target.value) })} /></div>
              </div>
              <div className="z-geo" style={{ marginTop: 10 }}>
                <Txt label="Rechercher la localité (pour remplir lat/lon)" value={geoQuery} onChange={setGeoQuery} placeholder="ex. Merzouga, Maroc" />
                <button className="z-btn" onClick={runGeocode}>Chercher</button>
              </div>
              {geoResults.length > 0 && (
                <div className="z-geo-results">
                  {geoResults.map((g, i) => (
                    <button key={i} onClick={() => { setSettings({ ...settings, placeName: g.name, lat: g.latitude, lon: g.longitude }); setGeoResults([]); setToast({ msg: `Lieu : ${g.name}` }); }}>
                      {g.name}{g.admin1 ? `, ${g.admin1}` : ""} ({g.country}) — {g.latitude.toFixed(3)}, {g.longitude.toFixed(3)}
                    </button>
                  ))}
                </div>
              )}
              <p className="z-muted">Prévisions Open-Meteo (gratuit, 16 jours). L&apos;extérieur est jugé selon le vent moyen et les rafales, en km/h.</p>
              <div className="z-grid">
                <Num label="Vigilance dès (vent moyen km/h)" value={settings.windWarn} onChange={(v) => setSettings({ ...settings, windWarn: v })} />
                <Num label="Déconseillé dès (vent moyen km/h)" value={settings.windStop} onChange={(v) => setSettings({ ...settings, windStop: v })} />
                <Num label="Déconseillé dès (rafales km/h)" value={settings.gustStop} onChange={(v) => setSettings({ ...settings, gustStop: v })} />
                <Num label="Vigilance pluie dès (%)" value={settings.rainWarn} onChange={(v) => setSettings({ ...settings, rainWarn: v })} />
              </div>
            </div>
            <div className="z-card">
              <h2>Contexte pour l&apos;IA</h2>
              <Area label="Décris le lieu : type d'hébergement, espaces extérieurs (terrasse, jardin, dunes…), cuisine, contraintes, équipes" value={settings.description} onChange={(v) => setSettings({ ...settings, description: v })} placeholder="ex. Camp de 12 tentes dans les dunes, dîners sur la terrasse face aux dunes quand le vent le permet, cuisine marocaine, 4x4 depuis l'aéroport d'Errachidia (2h)…" />
              <p className="z-muted">Plus ce contexte est précis, plus la roadmap et les points de vigilance générés seront justes.</p>
            </div>
            <div className="z-card">
              <h2>Données</h2>
              <div className="z-actions">
                <button className="z-btn" onClick={exportJSON}>Exporter la réservation (JSON)</button>
                <button className="z-btn" onClick={() => fileRef.current?.click()}>Importer un JSON</button>
                <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJSON(f); e.target.value = ""; }} />
                <button className="z-btn" onClick={() => { const blob = new Blob([JSON.stringify(resas, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `ZORO-toutes-${new Date().toISOString().slice(0, 10)}.json`; a.click(); }}>Tout exporter</button>
              </div>
              <p className="z-muted">Les réservations sont stockées dans ce navigateur. Exporte un JSON pour les partager ou les sauvegarder.</p>
            </div>
          </>
        )}

        {mode === "sheet" && (
          <>
            <div className="z-sheetbar no-print">
              <div className="z-langs">
                {LANGS.map((l) => <button key={l} className={lang === l ? "active" : ""} onClick={() => setLang(l)}>{LANG_LABEL[l]}</button>)}
              </div>
              <button className="z-btn" disabled={busy !== ""} onClick={() => refreshWeather()}>{busy === "weather" ? "Météo…" : "↻ Météo"}</button>
              {lang !== "fr" && <button className="z-btn" disabled={busy !== ""} onClick={translateSheet}>{busy === "translate" ? "Traduction…" : "Traduire les textes (IA)"}</button>}
              <button className="z-btn" disabled={busy !== ""} onClick={generateAdvice}>{busy === "advice" ? "Analyse en cours…" : r.advice?.[lang] ? "↻ Conseils IA" : "✦ Conseils IA"}</button>
              <div className="z-grow" />
              <button className="z-btn primary" onClick={() => window.print()}>Imprimer / PDF</button>
            </div>
            <Fiche r={r} settings={settings} lang={lang} rules={rules} />
            <p className="z-muted no-print" style={{ marginTop: 10 }}>
              PDF : « Imprimer » puis « Enregistrer au format PDF ». En anglais / darija, les libellés sont traduits automatiquement ; « Traduire les textes » traduit aussi les menus, lieux et notes saisis.
            </p>
          </>
        )}

        {mode === "edit" && (
          <>
            <div className="z-card">
              <h2>Réservation <span className="z-hint">{pax} pers. · {nightsBetween(r.stay.checkIn, r.stay.checkOut)} nuit(s) · couchage {bedCapacity(r)}</span><span className="z-grow" />
                <button className="z-btn small ghost" onClick={duplicateResa}>Dupliquer</button>
                <button className="z-btn small ghost" style={{ color: "var(--z-no)" }} onClick={deleteResa}>Supprimer</button>
              </h2>
              <div className="z-grid">
                <Txt label="Référence" value={r.ref} onChange={(v) => set("ref", v)} />
                <Sel label="Statut" value={r.stay.status} onChange={(v) => setSub("stay", { status: v })} options={[{ v: "option", l: "Option" }, { v: "confirmed", l: "Confirmée" }, { v: "deposit", l: "Acompte reçu" }, { v: "paid", l: "Payée" }, { v: "cancelled", l: "Annulée" }]} />
                <Txt label="Source / canal" value={r.stay.source} onChange={(v) => setSub("stay", { source: v })} placeholder="Agence, direct, Booking…" />
                <Txt label="Arrivée" type="date" value={r.stay.checkIn} onChange={(v) => setSub("stay", { checkIn: v, checkOut: r.stay.checkOut && r.stay.checkOut >= v ? r.stay.checkOut : addDays(v, 1) })} />
                <Txt label="Heure d'arrivée prévue" type="time" value={r.stay.checkInTime} onChange={(v) => setSub("stay", { checkInTime: v })} />
                <Txt label="Départ" type="date" value={r.stay.checkOut} onChange={(v) => setSub("stay", { checkOut: v })} />
                <Txt label="Heure de départ prévue" type="time" value={r.stay.checkOutTime} onChange={(v) => setSub("stay", { checkOutTime: v })} />
                <Txt label="Heure PJ" type="time" value={r.stay.pjTime} onChange={(v) => setSub("stay", { pjTime: v })} />
                <Area label="Notes séjour" value={r.stay.notes} onChange={(v) => setSub("stay", { notes: v })} />
              </div>
            </div>

            <div className="z-card">
              <h2>Client</h2>
              <div className="z-grid">
                <Txt label="Nom du client / groupe" value={r.client.name} onChange={(v) => setSub("client", { name: v })} className="w2" />
                <Txt label="Société / agence" value={r.client.company} onChange={(v) => setSub("client", { company: v })} />
                <Txt label="Téléphone" type="tel" value={r.client.phone} onChange={(v) => setSub("client", { phone: v })} />
                <Txt label="E-mail" type="email" value={r.client.email} onChange={(v) => setSub("client", { email: v })} />
                <Sel label="Langue du client" value={r.client.language} onChange={(v) => setSub("client", { language: v })} options={[{ v: "fr", l: "Français" }, { v: "en", l: "Anglais" }, { v: "ar", l: "Arabe" }, { v: "es", l: "Espagnol" }, { v: "de", l: "Allemand" }, { v: "it", l: "Italien" }, { v: "nl", l: "Néerlandais" }, { v: "pt", l: "Portugais" }, { v: "zh", l: "Chinois" }, { v: "ru", l: "Russe" }, { v: "ja", l: "Japonais" }, { v: "autre", l: "Autre" }]} />
                <Txt label="Occasion (anniversaire, lune de miel, séminaire…)" value={r.client.occasion} onChange={(v) => setSub("client", { occasion: v })} />
                <div className="z-field z-check"><input id="vip" type="checkbox" checked={r.client.vip} onChange={(e) => setSub("client", { vip: e.target.checked })} /><label htmlFor="vip">Client VIP</label></div>
                <Area label="Notes client" value={r.client.notes} onChange={(v) => setSub("client", { notes: v })} />
              </div>
            </div>

            <div className="z-card">
              <h2>Groupe <span className="z-hint">{pax} personne(s)</span></h2>
              <div className="z-grid">
                <Num label="Adultes" value={r.group.adults} onChange={(v) => setSub("group", { adults: v })} />
                <Num label="Enfants (2-12 ans)" value={r.group.children} onChange={(v) => setSub("group", { children: v })} />
                <Num label="Bébés (< 2 ans)" value={r.group.babies} onChange={(v) => setSub("group", { babies: v })} />
                <Txt label="Nationalités" value={r.group.nationalities} onChange={(v) => setSub("group", { nationalities: v })} />
                <Txt label="Allergies" value={r.group.allergies} onChange={(v) => setSub("group", { allergies: v })} placeholder="arachide, gluten…" className="w2" />
                <Txt label="Régimes alimentaires" value={r.group.dietary} onChange={(v) => setSub("group", { dietary: v })} placeholder="végétarien, halal, sans porc…" className="w2" />
                <Txt label="Mobilité / besoins particuliers" value={r.group.mobility} onChange={(v) => setSub("group", { mobility: v })} className="w2" />
                <Area label="Notes groupe" value={r.group.notes} onChange={(v) => setSub("group", { notes: v })} />
              </div>
            </div>

            <div className="z-card">
              <h2>Vols</h2>
              {r.flights.length === 0 && <div className="z-empty">Aucun vol. Ajoute l&apos;arrivée et le départ pour caler les transferts.</div>}
              {r.flights.map((f) => (
                <div className="z-row" key={f.id}>
                  <Sel label="Sens" value={f.kind} onChange={(v) => patchItem("flights", f.id, { kind: v })} options={[{ v: "arrival", l: "Arrivée" }, { v: "departure", l: "Départ" }]} />
                  <Txt label="Date" type="date" value={f.date} onChange={(v) => patchItem("flights", f.id, { date: v })} />
                  <Txt label={f.kind === "arrival" ? "Atterrissage" : "Décollage"} type="time" value={f.time} onChange={(v) => patchItem("flights", f.id, { time: v })} />
                  <Txt label="N° vol" value={f.number} onChange={(v) => patchItem("flights", f.id, { number: v.toUpperCase() })} placeholder="AT 123" />
                  <Txt label="Aéroport" value={f.airport} onChange={(v) => patchItem("flights", f.id, { airport: v })} />
                  <Txt label="De" value={f.from} onChange={(v) => patchItem("flights", f.id, { from: v })} />
                  <Txt label="Vers" value={f.to} onChange={(v) => patchItem("flights", f.id, { to: v })} />
                  <Txt label="Terminal" value={f.terminal} onChange={(v) => patchItem("flights", f.id, { terminal: v })} />
                  <Num label="Pers." value={f.pax} onChange={(v) => patchItem("flights", f.id, { pax: v })} />
                  <Txt label="Notes" value={f.notes} onChange={(v) => patchItem("flights", f.id, { notes: v })} />
                  <button className="z-del" onClick={() => delItem("flights", f.id)}>✕</button>
                </div>
              ))}
              <div className="z-actions">
                <button className="z-add" onClick={() => addItem("flights", { ...emptyFlight(), kind: "arrival", date: r.stay.checkIn, pax })}>+ Vol d&apos;arrivée</button>
                <button className="z-add" onClick={() => addItem("flights", { ...emptyFlight(), kind: "departure", date: r.stay.checkOut, pax })}>+ Vol de départ</button>
              </div>
            </div>

            <div className="z-card">
              <h2>Transport <span className="z-hint">horaires de prise en charge</span></h2>
              {r.transfers.length === 0 && <div className="z-empty">Aucun transfert.</div>}
              {r.transfers.map((x) => (
                <div className="z-row" key={x.id}>
                  <Txt label="Date" type="date" value={x.date} onChange={(v) => patchItem("transfers", x.id, { date: v })} />
                  <Txt label="Prise en charge" type="time" value={x.time} onChange={(v) => patchItem("transfers", x.id, { time: v })} />
                  <Sel label="Type" value={x.type} onChange={(v) => patchItem("transfers", x.id, { type: v })} options={[{ v: "shuttle", l: "Navette" }, { v: "4x4", l: "4x4" }, { v: "taxi", l: "Taxi" }, { v: "private", l: "Voiture privée" }, { v: "bus", l: "Bus / minibus" }, { v: "camel", l: "Dromadaire" }, { v: "other", l: "Autre" }]} />
                  <Txt label="De" value={x.from} onChange={(v) => patchItem("transfers", x.id, { from: v })} />
                  <Txt label="Vers" value={x.to} onChange={(v) => patchItem("transfers", x.id, { to: v })} />
                  <Num label="Pers." value={x.pax} onChange={(v) => patchItem("transfers", x.id, { pax: v })} />
                  <Num label="Véhicules" value={x.vehicles} min={1} onChange={(v) => patchItem("transfers", x.id, { vehicles: v })} />
                  <Txt label="Chauffeur" value={x.driver} onChange={(v) => patchItem("transfers", x.id, { driver: v })} />
                  <Txt label="Tél. chauffeur" type="tel" value={x.phone} onChange={(v) => patchItem("transfers", x.id, { phone: v })} />
                  <Txt label="Notes" value={x.notes} onChange={(v) => patchItem("transfers", x.id, { notes: v })} />
                  <button className="z-del" onClick={() => delItem("transfers", x.id)}>✕</button>
                </div>
              ))}
              <div className="z-actions">
                <button className="z-add" onClick={() => addItem("transfers", { ...emptyTransfer(), date: r.stay.checkIn, pax, to: settings.siteName })}>+ Transfert arrivée</button>
                <button className="z-add" onClick={() => addItem("transfers", { ...emptyTransfer(), date: r.stay.checkOut, pax, from: settings.siteName })}>+ Transfert départ</button>
              </div>
            </div>

            <div className="z-card">
              <h2>Hébergement & lits <span className="z-hint" style={{ color: bedCapacity(r) < pax ? "var(--z-no)" : undefined }}>couchage {bedCapacity(r)} / {pax}</span></h2>
              {r.rooms.length === 0 && <div className="z-empty">Aucune chambre affectée.</div>}
              {r.rooms.map((x) => (
                <div className="z-row" key={x.id}>
                  <Txt label="Chambre / unité" value={x.name} onChange={(v) => patchItem("rooms", x.id, { name: v })} placeholder="Tente 3, Suite dunes…" />
                  <Sel label="Type" value={x.bedType} onChange={(v) => patchItem("rooms", x.id, { bedType: v })} options={[{ v: "single", l: "Simple" }, { v: "double", l: "Double" }, { v: "twin", l: "Twin" }, { v: "family", l: "Familiale" }, { v: "suite", l: "Suite" }, { v: "tent", l: "Tente" }, { v: "other", l: "Autre" }]} />
                  <Num label="Lits simples" value={x.singles} onChange={(v) => patchItem("rooms", x.id, { singles: v })} />
                  <Num label="Lits doubles" value={x.doubles} onChange={(v) => patchItem("rooms", x.id, { doubles: v })} />
                  <Num label="Lits bébé" value={x.babyCots} onChange={(v) => patchItem("rooms", x.id, { babyCots: v })} />
                  <Txt label="Occupants" value={x.occupants} onChange={(v) => patchItem("rooms", x.id, { occupants: v })} placeholder="M. et Mme X" />
                  <Txt label="Notes" value={x.notes} onChange={(v) => patchItem("rooms", x.id, { notes: v })} />
                  <button className="z-del" onClick={() => delItem("rooms", x.id)}>✕</button>
                </div>
              ))}
              <div className="z-actions">
                <button className="z-add" onClick={() => addItem("rooms", emptyRoom())}>+ Chambre</button>
              </div>
            </div>

            <div className="z-card">
              <h2>Programme</h2>
              {r.program.length === 0 && <div className="z-empty">Aucune activité planifiée.</div>}
              {[...r.program].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).map((p) => (
                <div className="z-row" key={p.id}>
                  <Sel label="Jour" value={p.date} onChange={(v) => patchItem("program", p.id, { date: v })} options={dates.includes(p.date) ? dateOptions : [{ v: p.date, l: p.date || "—" }, ...dateOptions]} />
                  <Txt label="Début" type="time" value={p.start} onChange={(v) => patchItem("program", p.id, { start: v })} />
                  <Txt label="Fin" type="time" value={p.end} onChange={(v) => patchItem("program", p.id, { end: v })} />
                  <Txt label="Activité" value={p.title} onChange={(v) => patchItem("program", p.id, { title: v })} placeholder="Balade dromadaire, coucher de soleil…" />
                  <Txt label="Lieu" value={p.place} onChange={(v) => patchItem("program", p.id, { place: v })} />
                  <Sel label="Int./Ext." value={p.setting} onChange={(v) => patchItem("program", p.id, { setting: v })} options={[{ v: "outdoor", l: "Extérieur" }, { v: "indoor", l: "Intérieur" }, { v: "flex", l: "Flexible" }]} />
                  <Txt label="Responsable" value={p.responsible} onChange={(v) => patchItem("program", p.id, { responsible: v })} />
                  <Txt label="Notes" value={p.notes} onChange={(v) => patchItem("program", p.id, { notes: v })} />
                  <button className="z-del" onClick={() => delItem("program", p.id)}>✕</button>
                </div>
              ))}
              <div className="z-actions">
                {dates.map((d) => <button key={d} className="z-add" onClick={() => addItem("program", { ...emptyProgramItem(), date: d })}>+ {d.slice(5)}</button>)}
              </div>
            </div>

            <div className="z-card">
              <h2>Repas & menus</h2>
              {r.meals.length === 0 && <div className="z-empty">Aucun repas. « Générer les repas du séjour » crée le squelette (dîner d&apos;arrivée, journées complètes, petit-déjeuner de départ).</div>}
              {[...r.meals].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map((m) => (
                <div className="z-row" key={m.id}>
                  <Sel label="Jour" value={m.date} onChange={(v) => patchItem("meals", m.id, { date: v })} options={dates.includes(m.date) ? dateOptions : [{ v: m.date, l: m.date || "—" }, ...dateOptions]} />
                  <Sel label="Repas" value={m.type} onChange={(v) => patchItem("meals", m.id, { type: v })} options={[{ v: "breakfast", l: "Petit-déjeuner" }, { v: "lunch", l: "Déjeuner" }, { v: "dinner", l: "Dîner" }, { v: "snack", l: "Collation" }, { v: "cocktail", l: "Cocktail / apéritif" }]} />
                  <Txt label="Heure" type="time" value={m.time} onChange={(v) => patchItem("meals", m.id, { time: v })} />
                  <Txt label="Lieu" value={m.place} onChange={(v) => patchItem("meals", m.id, { place: v })} placeholder="Terrasse, salle, dunes…" />
                  <Sel label="Int./Ext." value={m.setting} onChange={(v) => patchItem("meals", m.id, { setting: v })} options={[{ v: "flex", l: "Flexible" }, { v: "outdoor", l: "Extérieur" }, { v: "indoor", l: "Intérieur" }]} />
                  <Num label="Pers." value={m.pax} onChange={(v) => patchItem("meals", m.id, { pax: v })} />
                  <Area label="Menu" className="w2" value={m.menu} onChange={(v) => patchItem("meals", m.id, { menu: v })} placeholder="Entrée / plat / dessert, boissons…" />
                  <Txt label="Notes" value={m.notes} onChange={(v) => patchItem("meals", m.id, { notes: v })} />
                  <button className="z-del" onClick={() => delItem("meals", m.id)}>✕</button>
                </div>
              ))}
              <div className="z-actions">
                <button className="z-add" onClick={generateMeals}>✦ Générer les repas du séjour</button>
                <button className="z-add" onClick={() => addItem("meals", { ...emptyMeal(), date: r.stay.checkIn, pax })}>+ Repas</button>
              </div>
            </div>

            <div className="z-card">
              <h2>Prestations extra réservées</h2>
              {r.extras.length === 0 && <div className="z-empty">Aucune prestation extra.</div>}
              {r.extras.map((e) => (
                <div className="z-row" key={e.id}>
                  <Txt label="Prestation" value={e.name} onChange={(v) => patchItem("extras", e.id, { name: v })} placeholder="Massage, quad, musiciens…" />
                  <Txt label="Date" type="date" value={e.date} list={dateList} onChange={(v) => patchItem("extras", e.id, { date: v })} />
                  <Txt label="Heure" type="time" value={e.time} onChange={(v) => patchItem("extras", e.id, { time: v })} />
                  <Num label="Qté" value={e.qty} min={1} onChange={(v) => patchItem("extras", e.id, { qty: v })} />
                  <Txt label="Prestataire" value={e.provider} onChange={(v) => patchItem("extras", e.id, { provider: v })} />
                  <Sel label="Statut" value={e.status} onChange={(v) => patchItem("extras", e.id, { status: v })} options={[{ v: "requested", l: "Demandée" }, { v: "confirmed", l: "Confirmée" }, { v: "paid", l: "Payée" }, { v: "cancelled", l: "Annulée" }]} />
                  <Txt label="Prix" value={e.price} onChange={(v) => patchItem("extras", e.id, { price: v })} />
                  <Txt label="Notes" value={e.notes} onChange={(v) => patchItem("extras", e.id, { notes: v })} />
                  <button className="z-del" onClick={() => delItem("extras", e.id)}>✕</button>
                </div>
              ))}
              <div className="z-actions">
                <button className="z-add" onClick={() => addItem("extras", { ...emptyExtra(), date: r.stay.checkIn })}>+ Prestation</button>
              </div>
            </div>

            <div className="z-card">
              <h2>Contacts & notes</h2>
              <div className="z-grid">
                <Txt label="Référent interne" value={r.contacts.internalLead} onChange={(v) => setSub("contacts", { internalLead: v })} />
                <Txt label="Tél. référent" type="tel" value={r.contacts.internalPhone} onChange={(v) => setSub("contacts", { internalPhone: v })} />
                <Area label="Partenaires externes (nom, rôle, téléphone)" value={r.contacts.externalPartners} onChange={(v) => setSub("contacts", { externalPartners: v })} />
                <Area label="Notes générales (tout ce que les équipes doivent savoir)" value={r.notes} onChange={(v) => set("notes", v)} />
              </div>
            </div>

            <div className="z-card">
              <h2>Points de vigilance détectés <span className="z-hint">{rules.length} — calculés automatiquement à partir de la saisie</span></h2>
              {rules.length === 0 ? <div className="z-empty">Rien à signaler pour l&apos;instant.</div> : (
                <ul className="z-vig">
                  {rules.map((x, i) => <li key={i}><span className={`z-badge ${x.level}`}>{x.level === "high" ? "Haute" : x.level === "medium" ? "Moyenne" : "Basse"}</span><div><b>{x.title}</b><p>{x.detail}</p></div></li>)}
                </ul>
              )}
              <div className="z-actions">
                <button className="z-btn primary" onClick={() => setMode("sheet")}>Voir la fiche, la météo et les conseils IA →</button>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
