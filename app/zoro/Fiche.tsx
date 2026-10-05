"use client";

import { fmtDate, fmtDateLong, isRTL, t as T } from "@/lib/zoro/i18n";
import type { AdviceItem, Lang, Reservation, Settings, WeatherDay } from "@/lib/zoro/types";
import { bedCapacity, nightsBetween, stayDates, totalPax } from "@/lib/zoro/types";
import { beaufort, weatherEmoji, windDirLabel } from "@/lib/zoro/weather";

interface Props {
  r: Reservation;
  settings: Settings;
  lang: Lang;
  rules: AdviceItem[];
}

export default function Fiche({ r, settings, lang, rules }: Props) {
  const t = (k: string, p?: Record<string, string | number>) => T(lang, k, p);
  const cache = lang === "fr" ? undefined : r.translations?.[lang];
  const tr = (s: string) => {
    const v = (s ?? "").trim();
    if (!v) return "—";
    return cache?.[v] ?? v;
  };
  const dash = (s: string | number | null | undefined) => (s === null || s === undefined || s === "" ? "—" : String(s));
  const sortKey = (x: { date: string; start?: string; time?: string }) => x.date + (x.start ?? x.time ?? "");
  const byDate = <X extends { date: string; start?: string; time?: string }>(xs: X[]) => [...xs].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const pax = totalPax(r);
  const nights = nightsBetween(r.stay.checkIn, r.stay.checkOut);
  const dates = stayDates(r);
  const wx = r.weather;
  const wxByDate = new Map<string, WeatherDay>((wx?.days ?? []).map((d) => [d.date, d]));
  const advice = r.advice?.[lang];
  const verdictLabel: Record<WeatherDay["verdict"], string> = { ok: t("outdoorOk"), warn: t("outdoorWarn"), no: t("outdoorNo"), unknown: t("outdoorUnknown") };

  const renderDayRows = <X extends { id: string; date: string; start?: string; time?: string }>(xs: X[], cols: number, row: (x: X) => React.ReactNode) => {
    const out: React.ReactNode[] = [];
    let last = "";
    for (const x of byDate(xs)) {
      if (x.date !== last) {
        last = x.date;
        out.push(
          <tr key={"d" + x.date + x.id} className="z-dayhead">
            <td colSpan={cols}>{x.date ? fmtDateLong(lang, x.date) : t("none")}</td>
          </tr>,
        );
      }
      out.push(<tr key={x.id}>{row(x)}</tr>);
    }
    return out;
  };

  return (
    <article className="z-sheet" dir={isRTL(lang) ? "rtl" : "ltr"} lang={lang}>
      <header className="z-sheet-head">
        <div>
          <div className="z-brand">ZORO · {settings.siteName}</div>
          <h1>{t("sheetTitle")} — {r.client.name || r.ref}</h1>
          <div className="z-meta">{t("preparedFor")}</div>
        </div>
        <div className="z-meta" style={{ textAlign: isRTL(lang) ? "left" : "right" }}>
          <div><b>{t("ref")}</b> : {r.ref}</div>
          <div><span className="z-badge status">{t(`status.${r.stay.status}`)}</span></div>
          <div>{t("generated")} {fmtDate(lang, new Date().toISOString().slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}</div>
        </div>
      </header>

      <div className="z-kpis">
        <div className="z-kpi"><b>{pax}</b><span>{t("total")}</span></div>
        <div className="z-kpi"><b>{r.group.adults} / {r.group.children} / {r.group.babies}</b><span>{t("adults")} / {t("children")} / {t("babies")}</span></div>
        <div className="z-kpi"><b>{nights}</b><span>{t("nights")}</span></div>
        <div className="z-kpi"><b>{fmtDate(lang, r.stay.checkIn)} → {fmtDate(lang, r.stay.checkOut)}</b><span>{t("checkIn")} → {t("checkOut")}</span></div>
        <div className="z-kpi"><b>{r.rooms.length}</b><span>{t("room")}</span></div>
        {r.client.vip && <div className="z-kpi"><b>★</b><span>VIP</span></div>}
      </div>

      <section className="z-sec">
        <h2>{t("client")} & {t("group")}</h2>
        <div className="z-kv">
          <div><span>{t("client")}</span><span>{dash(r.client.name)}</span></div>
          <div><span>{t("company")}</span><span>{tr(r.client.company)}</span></div>
          <div><span>{t("phone")}</span><span>{dash(r.client.phone)}</span></div>
          <div><span>{t("email")}</span><span>{dash(r.client.email)}</span></div>
          <div><span>{t("language")}</span><span>{dash(r.client.language)}</span></div>
          <div><span>{t("vip")}</span><span>{r.client.vip ? t("yes") : t("no")}</span></div>
          <div><span>{t("occasion")}</span><span>{tr(r.client.occasion)}</span></div>
          <div><span>{t("nationalities")}</span><span>{tr(r.group.nationalities)}</span></div>
          <div><span>{t("allergies")}</span><span style={{ color: r.group.allergies ? "var(--z-no)" : undefined }}>{tr(r.group.allergies)}</span></div>
          <div><span>{t("dietary")}</span><span>{tr(r.group.dietary)}</span></div>
          <div><span>{t("mobility")}</span><span>{tr(r.group.mobility)}</span></div>
          {(r.client.notes || r.group.notes) && (
            <div className="wide"><span>{t("notes")}</span><span>{[r.client.notes, r.group.notes].filter(Boolean).map(tr).join(" · ")}</span></div>
          )}
        </div>
      </section>

      <section className="z-sec">
        <h2>{t("stay")}</h2>
        <div className="z-kv">
          <div><span>{t("checkIn")}</span><span>{fmtDateLong(lang, r.stay.checkIn)} · {dash(r.stay.checkInTime)}</span></div>
          <div><span>{t("checkOut")}</span><span>{fmtDateLong(lang, r.stay.checkOut)} · {dash(r.stay.checkOutTime)}</span></div>
          <div><span>{t("pjTime")}</span><span>{dash(r.stay.pjTime)}</span></div>
          <div><span>{t("source")}</span><span>{tr(r.stay.source)}</span></div>
          {r.stay.notes && <div className="wide"><span>{t("notes")}</span><span>{tr(r.stay.notes)}</span></div>}
        </div>
      </section>

      <section className="z-sec">
        <h2>{t("flights")}</h2>
        {r.flights.length === 0 ? <div className="z-muted">{t("none")}</div> : (
          <table className="z-tbl">
            <thead><tr><th>{t("flightArrival")}/{t("flightDeparture")}</th><th>{t("date")}</th><th>{t("time")}</th><th>{t("flightNumber")}</th><th>{t("airport")}</th><th>{t("fromTo")}</th><th>{t("terminal")}</th><th className="num">{t("pax")}</th><th>{t("notes")}</th></tr></thead>
            <tbody>
              {byDate(r.flights).map((f) => (
                <tr key={f.id}>
                  <td><b>{f.kind === "arrival" ? t("flightArrival") : t("flightDeparture")}</b></td>
                  <td className="nowrap">{fmtDate(lang, f.date)}</td>
                  <td className="nowrap"><b>{dash(f.time)}</b></td>
                  <td className="nowrap">{dash(f.number)}</td>
                  <td>{tr(f.airport)}</td>
                  <td>{tr(f.from)} → {tr(f.to)}</td>
                  <td>{dash(f.terminal)}</td>
                  <td className="num">{f.pax || pax}</td>
                  <td>{tr(f.notes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="z-sec">
        <h2>{t("transport")}</h2>
        {r.transfers.length === 0 ? <div className="z-muted">{t("none")}</div> : (
          <table className="z-tbl">
            <thead><tr><th>{t("date")}</th><th>{t("transferTime")}</th><th>{t("transferType")}</th><th>{t("fromTo")}</th><th className="num">{t("pax")}</th><th className="num">{t("vehicles")}</th><th>{t("driver")}</th><th>{t("phone")}</th><th>{t("notes")}</th></tr></thead>
            <tbody>
              {byDate(r.transfers).map((x) => (
                <tr key={x.id}>
                  <td className="nowrap">{fmtDate(lang, x.date)}</td>
                  <td className="nowrap"><b>{dash(x.time)}</b></td>
                  <td>{t(`transfer.${x.type}`)}</td>
                  <td>{tr(x.from)} → {tr(x.to)}</td>
                  <td className="num">{x.pax || pax}</td>
                  <td className="num">{x.vehicles}</td>
                  <td>{dash(x.driver)}</td>
                  <td className="nowrap">{dash(x.phone)}</td>
                  <td>{tr(x.notes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="z-sec">
        <h2>{t("rooms")}</h2>
        {r.rooms.length === 0 ? <div className="z-muted">{t("none")}</div> : (
          <>
            <table className="z-tbl">
              <thead><tr><th>{t("room")}</th><th>{t("bedType")}</th><th className="num">{t("singles")}</th><th className="num">{t("doubles")}</th><th className="num">{t("babyCots")}</th><th>{t("occupants")}</th><th>{t("notes")}</th></tr></thead>
              <tbody>
                {r.rooms.map((x) => (
                  <tr key={x.id}>
                    <td><b>{tr(x.name)}</b></td>
                    <td>{t(`bed.${x.bedType}`)}</td>
                    <td className="num">{x.singles}</td>
                    <td className="num">{x.doubles}</td>
                    <td className="num">{x.babyCots}</td>
                    <td>{tr(x.occupants)}</td>
                    <td>{tr(x.notes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="z-muted" style={{ marginTop: 6 }}>
              {t("capacity")} : <b style={{ color: bedCapacity(r) < pax ? "var(--z-no)" : "var(--z-ok)" }}>{bedCapacity(r)}</b> / {pax} · {t("babyCots")} : {r.rooms.reduce((a, x) => a + x.babyCots, 0)} / {r.group.babies}
            </div>
          </>
        )}
      </section>

      <section className="z-sec">
        <h2>{t("program")}</h2>
        {r.program.length === 0 ? <div className="z-muted">{t("none")}</div> : (
          <table className="z-tbl">
            <thead><tr><th>{t("start")}</th><th>{t("end")}</th><th>{t("activity")}</th><th>{t("place")}</th><th>{t("setting")}</th><th>{t("responsible")}</th><th>{t("notes")}</th></tr></thead>
            <tbody>
              {renderDayRows(r.program, 7, (p) => {
                const d = wxByDate.get(p.date);
                const v = p.setting !== "indoor" && d?.available ? d.verdict : null;
                return (
                  <>
                    <td className="nowrap"><b>{dash(p.start)}</b></td>
                    <td className="nowrap">{dash(p.end)}</td>
                    <td><b>{tr(p.title)}</b></td>
                    <td>{tr(p.place)}</td>
                    <td>{t(`setting.${p.setting}`)} {v && v !== "ok" && <span className={`z-badge ${v}`}>{verdictLabel[v]}</span>}</td>
                    <td>{tr(p.responsible)}</td>
                    <td>{tr(p.notes)}</td>
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="z-sec">
        <h2>{t("meals")}</h2>
        {r.meals.length === 0 ? <div className="z-muted">{t("none")}</div> : (
          <table className="z-tbl">
            <thead><tr><th>{t("time")}</th><th>{t("mealType")}</th><th>{t("place")}</th><th>{t("setting")}</th><th className="num">{t("pax")}</th><th>{t("menu")}</th><th>{t("notes")}</th></tr></thead>
            <tbody>
              {renderDayRows(r.meals, 7, (m) => {
                const d = wxByDate.get(m.date);
                const v = m.setting !== "indoor" && d?.available ? d.verdict : null;
                return (
                  <>
                    <td className="nowrap"><b>{dash(m.time)}</b></td>
                    <td><b>{t(`meal.${m.type}`)}</b></td>
                    <td>{tr(m.place)}</td>
                    <td>{t(`setting.${m.setting}`)} {v && v !== "ok" && <span className={`z-badge ${v}`}>{verdictLabel[v]}</span>}</td>
                    <td className="num">{m.pax || pax}</td>
                    <td style={{ whiteSpace: "pre-line" }}>{tr(m.menu)}</td>
                    <td>{tr(m.notes)}</td>
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="z-sec">
        <h2>{t("extras")}</h2>
        {r.extras.length === 0 ? <div className="z-muted">{t("none")}</div> : (
          <table className="z-tbl">
            <thead><tr><th>{t("extra")}</th><th>{t("date")}</th><th>{t("time")}</th><th className="num">{t("qty")}</th><th>{t("provider")}</th><th>{t("status")}</th><th className="num">{t("price")}</th><th>{t("notes")}</th></tr></thead>
            <tbody>
              {byDate(r.extras).map((e) => (
                <tr key={e.id}>
                  <td><b>{tr(e.name)}</b></td>
                  <td className="nowrap">{fmtDate(lang, e.date)}</td>
                  <td className="nowrap">{dash(e.time)}</td>
                  <td className="num">{e.qty}</td>
                  <td>{tr(e.provider)}</td>
                  <td><span className={`z-badge ${e.status === "requested" ? "warn" : e.status === "cancelled" ? "no" : "ok"}`}>{t(`extra.${e.status}`)}</span></td>
                  <td className="num">{dash(e.price)}</td>
                  <td>{tr(e.notes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="z-sec">
        <h2>{t("weather")}{settings.placeName ? ` — ${settings.placeName}` : ""}</h2>
        {!wx ? <div className="z-muted">{t("weatherNotFetched")}</div> : (
          <>
            <div className="z-wx">
              {dates.map((date) => {
                const d = wxByDate.get(date);
                if (!d || !d.available) {
                  return (
                    <div key={date} className="z-wx-day unknown">
                      <div className="d"><span>{fmtDate(lang, date)}</span></div>
                      <div className="t">{t("weatherUnavailable")}</div>
                    </div>
                  );
                }
                const bf = beaufort(d.windMax);
                return (
                  <div key={date} className={`z-wx-day ${d.verdict}`}>
                    <div className="d"><span>{fmtDate(lang, date)}</span><span>{weatherEmoji(d.code)}</span></div>
                    <div className="t">{t("tMax")} <b>{d.tMax != null ? Math.round(d.tMax) : "?"}°</b> · {t("tMin")} <b>{d.tMin != null ? Math.round(d.tMin) : "?"}°</b> · {t("rain")} <b>{d.rainProb ?? "?"}%</b></div>
                    <div className="t">{t("wind")} <b>{d.windMax != null ? Math.round(d.windMax) : "?"}</b> km/h {windDirLabel(d.windDir)}{bf != null ? ` (Bf ${bf})` : ""} · {t("gusts")} <b>{d.gustMax != null ? Math.round(d.gustMax) : "?"}</b></div>
                    <div><span className={`z-badge ${d.verdict}`}>{verdictLabel[d.verdict]}</span></div>
                    <div className="slots">
                      {(["morning", "afternoon", "evening"] as const).map((s) => (
                        <div key={s} className={`slot ${d.slots[s].verdict}`}>{t(s)}<b>{d.slots[s].wind ?? "?"} / {d.slots[s].gust ?? "?"}</b></div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="z-ai-note">{t("weatherNote")} · {wx.fetchedAt.slice(0, 16).replace("T", " ")}</div>
          </>
        )}
      </section>

      <section className="z-sec">
        <h2>{t("vigilance")}</h2>
        {rules.length === 0 && !advice?.vigilance?.length ? <div className="z-muted">{t("none")}</div> : (
          <ul className="z-vig">
            {rules.map((x, i) => (
              <li key={"r" + i}><span className={`z-badge ${x.level}`}>{t(x.level)}</span><div><b>{x.title}</b><p>{x.detail}</p></div></li>
            ))}
            {advice?.vigilance?.map((x, i) => (
              <li key={"a" + i}><span className={`z-badge ${x.level}`}>{t(x.level)}</span><div><b>{x.title}</b><p>{x.detail}</p></div></li>
            ))}
          </ul>
        )}
      </section>

      {advice && (
        <>
          <section className="z-sec">
            <h2>{t("aiHeadline")}</h2>
            <p className="z-headline">{advice.headline}</p>
          </section>
          <section className="z-sec">
            <h2>{t("roadmap")}</h2>
            <table className="z-tbl">
              <thead><tr><th>{t("when")}</th><th>{t("task")}</th><th>{t("owner")}</th><th>{t("priority")}</th></tr></thead>
              <tbody>
                {advice.roadmap.map((x, i) => (
                  <tr key={i}><td className="nowrap"><b>{x.when}</b></td><td>{x.task}</td><td>{x.owner}</td><td><span className={`z-badge ${x.priority}`}>{t(x.priority)}</span></td></tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="z-sec">
            <h2>{t("checklist")}</h2>
            <div className="z-check-cols">
              {(["reception", "kitchen", "housekeeping", "transport", "activities"] as const).map((team) =>
                advice.checklist[team]?.length ? (
                  <div key={team}>
                    <h3>{t(team === "transport" ? "transportTeam" : team)}</h3>
                    <ul>{advice.checklist[team].map((x, i) => <li key={i}>{x}</li>)}</ul>
                  </div>
                ) : null,
              )}
            </div>
          </section>
          {advice.questionsToClient?.length > 0 && (
            <section className="z-sec">
              <h2>{t("questions")}</h2>
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>{advice.questionsToClient.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </section>
          )}
          <div className="z-ai-note">IA · {advice.generatedAt.slice(0, 16).replace("T", " ")}</div>
        </>
      )}

      <section className="z-sec">
        <h2>{t("contacts")} & {t("generalNotes")}</h2>
        <div className="z-kv">
          <div><span>{t("internalLead")}</span><span>{dash(r.contacts.internalLead)} {r.contacts.internalPhone && `· ${r.contacts.internalPhone}`}</span></div>
          <div className="wide"><span>{t("externalPartners")}</span><span style={{ whiteSpace: "pre-line" }}>{tr(r.contacts.externalPartners)}</span></div>
          {r.contacts.notes && <div className="wide"><span>{t("notes")}</span><span style={{ whiteSpace: "pre-line" }}>{tr(r.contacts.notes)}</span></div>}
          {r.notes && <div className="wide"><span>{t("generalNotes")}</span><span style={{ whiteSpace: "pre-line" }}>{tr(r.notes)}</span></div>}
        </div>
      </section>

      <footer className="z-sheet-foot">
        <span>ZORO · {settings.siteName} · {r.ref}</span>
        <span>{t("generated")} {new Date().toISOString().slice(0, 10)}</span>
      </footer>
    </article>
  );
}
