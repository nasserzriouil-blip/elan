"use client";

import { useEffect, useRef, useState } from "react";
import { PERSONAS, PERSONA_ORDER, type PersonaId } from "@/lib/personas";
import { motDuJour, alimentDuJour } from "@/lib/daily";
import {
  type Msg,
  type Convos,
  type Insight,
  dateKey,
  computeStreak,
  computeWeek,
  buildUserContext,
  hasSignal,
} from "@/lib/context";

type Tab = "home" | PersonaId;

const COLORS: Record<PersonaId, { ink: string; soft: string }> = {
  guide: { ink: "var(--guide)", soft: "var(--guide-soft)" },
  ami: { ink: "var(--ami)", soft: "var(--ami-soft)" },
  coach: { ink: "var(--coach)", soft: "var(--coach-soft)" },
  confident: { ink: "var(--confident)", soft: "var(--confident-soft)" },
};

const emptyConvos: Convos = { guide: [], ami: [], coach: [], confident: [] };

const PROGRAM = [
  "Bouger ton corps, même 10 minutes",
  "Un verre d'eau de plus que d'habitude",
  "Un moment rien que pour toi",
];

function fallbackTitle(t: string): string {
  const w = t.trim().split(/\s+/).slice(0, 6).join(" ");
  return w.length > 48 ? w.slice(0, 48) + "…" : w;
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [convos, setConvos] = useState<Convos>(emptyConvos);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [amiName, setAmiName] = useState(PERSONAS.ami.name);
  const [program, setProgram] = useState<Record<string, boolean[]>>({});
  const [insights, setInsights] = useState<Insight[]>([]);
  const [dailyPhrase, setDailyPhrase] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const phraseTried = useRef(false);

  useEffect(() => {
    try {
      const c = localStorage.getItem("elan-convos");
      if (c) setConvos({ ...emptyConvos, ...JSON.parse(c) });
      const n = localStorage.getItem("elan-aminame");
      if (n) setAmiName(n);
      const p = localStorage.getItem("elan-program");
      if (p) setProgram(JSON.parse(p));
      const ins = localStorage.getItem("elan-insights");
      if (ins) {
        const parsed = JSON.parse(ins);
        if (Array.isArray(parsed)) {
          setInsights(
            parsed.map((x: unknown) =>
              typeof x === "string"
                ? { id: newId(), title: fallbackTitle(x), text: x }
                : {
                    id: (x as Insight).id ?? newId(),
                    title: (x as Insight).title ?? fallbackTitle((x as Insight).text ?? ""),
                    text: (x as Insight).text ?? "",
                  },
            ),
          );
        }
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("elan-convos", JSON.stringify(convos));
    } catch {
      /* ignore */
    }
  }, [convos]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [convos, tab, streaming]);

  // Mot du jour personnalisé : 1 appel/jour max, mis en cache. Si pas assez de
  // matière, on garde la phrase statique.
  useEffect(() => {
    if (!loaded || phraseTried.current) return;
    phraseTried.current = true;
    const today = dateKey();
    const cacheKey = `elan-phrase-${today}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setDailyPhrase(cached);
        return;
      }
    } catch {
      /* ignore */
    }
    if (!hasSignal(convos, insights, program)) return;
    const ctx = buildUserContext(convos, insights, program);
    fetch("/api/daily-phrase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: ctx }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.phrase) {
          setDailyPhrase(d.phrase);
          try {
            localStorage.setItem(cacheKey, d.phrase);
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {});
  }, [loaded, convos, insights, program]);

  function displayName(id: PersonaId): string {
    return id === "ami" ? amiName : PERSONAS[id].name;
  }

  function saveAmiName(name: string) {
    const clean = name.trim() || PERSONAS.ami.name;
    setAmiName(clean);
    try {
      localStorage.setItem("elan-aminame", clean);
    } catch {
      /* ignore */
    }
  }

  function toggleProgram(i: number) {
    const k = dateKey();
    setProgram((prev) => {
      const day = prev[k] ? [...prev[k]] : PROGRAM.map(() => false);
      day[i] = !day[i];
      const next = { ...prev, [k]: day };
      try {
        localStorage.setItem("elan-program", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function persistInsights(list: Insight[]) {
    setInsights(list);
    try {
      localStorage.setItem("elan-insights", JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }

  async function addInsight(text: string) {
    const t = text.trim();
    if (!t) return;
    const id = newId();
    persistInsights([{ id, title: fallbackTitle(t), text: t }, ...insights].slice(0, 50));
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (res.ok) {
        const { title } = await res.json();
        if (title) {
          setInsights((prev) => {
            const next = prev.map((x) => (x.id === id ? { ...x, title } : x));
            try {
              localStorage.setItem("elan-insights", JSON.stringify(next));
            } catch {
              /* ignore */
            }
            return next;
          });
        }
      }
    } catch {
      /* on garde le titre de secours */
    }
  }

  function removeInsight(id: string) {
    persistInsights(insights.filter((x) => x.id !== id));
  }

  async function send(persona: PersonaId, text: string) {
    const content = text.trim();
    if (!content || streaming) return;

    const history = [...convos[persona], { role: "user", content } as Msg];
    setConvos((c) => ({ ...c, [persona]: history }));
    setInput("");
    setStreaming(true);
    setConvos((c) => ({
      ...c,
      [persona]: [...c[persona], { role: "assistant", content: "" }],
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: persona,
          messages: history,
          context: buildUserContext(convos, insights, program, persona),
          amiName: persona === "ami" ? amiName : undefined,
        }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setConvos((c) => {
          const arr = [...c[persona]];
          arr[arr.length - 1] = { role: "assistant", content: acc };
          return { ...c, [persona]: arr };
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur réseau.";
      setConvos((c) => {
        const arr = [...c[persona]];
        arr[arr.length - 1] = {
          role: "assistant",
          content: `[Impossible de répondre : ${msg}]`,
        };
        return { ...c, [persona]: arr };
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="shell">
      <div className="phone">
        {tab === "home" ? (
          <Home
            phrase={dailyPhrase ?? motDuJour()}
            program={program[dateKey()] ?? PROGRAM.map(() => false)}
            streak={computeStreak(program)}
            weekCount={computeWeek(program)}
            achievements={computeAchievements(program)}
            insights={insights}
            onToggle={toggleProgram}
            onAddInsight={addInsight}
            onRemoveInsight={removeInsight}
          />
        ) : (
          <Chat
            persona={tab}
            name={displayName(tab)}
            canRename={tab === "ami"}
            onRename={saveAmiName}
            messages={convos[tab]}
            streaming={streaming}
            threadRef={threadRef}
            input={input}
            setInput={setInput}
            onSend={(t) => send(tab, t)}
          />
        )}

        <nav className="tabbar">
          {(["home", ...PERSONA_ORDER] as Tab[]).map((t) => (
            <button
              key={t}
              className={`tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              <span
                className="dot"
                style={
                  t !== "home" && tab === t
                    ? { background: COLORS[t as PersonaId].soft, color: COLORS[t as PersonaId].ink }
                    : undefined
                }
              >
                {t === "home" ? "○" : displayName(t as PersonaId)[0]}
              </span>
              {t === "home" ? "Aujourd'hui" : displayName(t as PersonaId)}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

interface Achievement {
  label: string;
  desc: string;
}

function computeAchievements(map: Record<string, boolean[]>): Achievement[] {
  const days = Object.values(map);
  const totalDays = days.filter((d) => d.some(Boolean)).length;
  const fullDays = days.filter((d) => d.length >= PROGRAM.length && d.every(Boolean)).length;

  const keys = Object.keys(map)
    .filter((k) => (map[k] ?? []).some(Boolean))
    .sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const k of keys) {
    const t = new Date(k + "T00:00:00").getTime() / 86400000;
    run = prev !== null && Math.round(t - prev) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }

  const all = [
    { label: "Premier geste", desc: "Tu as commencé. C'est le plus dur.", earned: totalDays >= 1 },
    { label: "Trois jours d'affilée", desc: "La régularité douce s'installe.", earned: best >= 3 },
    { label: "Semaine vivante", desc: "5 jours à prendre soin de toi cette semaine.", earned: computeWeek(map) >= 5 },
    { label: "Journée complète", desc: "Un jour où tu as tout coché.", earned: fullDays >= 1 },
    { label: "Dix jours pour toi", desc: "Ce n'est plus un essai, c'est une habitude.", earned: totalDays >= 10 },
  ];
  return all.filter((a) => a.earned).map(({ label, desc }) => ({ label, desc }));
}

function Home({
  phrase,
  program,
  streak,
  weekCount,
  achievements,
  insights,
  onToggle,
  onAddInsight,
  onRemoveInsight,
}: {
  phrase: string;
  program: boolean[];
  streak: number;
  weekCount: number;
  achievements: Achievement[];
  insights: Insight[];
  onToggle: (i: number) => void;
  onAddInsight: (text: string) => void;
  onRemoveInsight: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const aliment = alimentDuJour();

  return (
    <div className="screen">
      <div className="home-pad">
        <div className="home-hello">Bonjour Nasser</div>
        <div className="home-title">Aujourd&apos;hui</div>

        <div className="mot">
          <div className="k">Le mot du jour</div>
          <div className="p">{phrase}</div>
        </div>

        <div className="metrics">
          <div className="metric">
            <div className="n">{streak}</div>
            <div className="l">
              {streak <= 1 ? "jour aligné" : "jours alignés"} d&apos;affilée
            </div>
          </div>
          <div className="metric">
            <div className="n">{weekCount}/7</div>
            <div className="l">jours où tu as pris soin de toi</div>
          </div>
        </div>

        <div className="card">
          <div className="card-label" style={{ color: "var(--coach)" }}>
            Ton programme du jour
          </div>
          {PROGRAM.map((item, i) => {
            const done = program[i];
            return (
              <button
                key={item}
                className={`prog-item${done ? " done" : ""}`}
                onClick={() => onToggle(i)}
              >
                <span className={`check${done ? " on" : ""}`}>{done ? "✓" : ""}</span>
                <span className="t">{item}</span>
              </button>
            );
          })}
          <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 10, lineHeight: 1.4 }}>
            Rien d&apos;obligatoire. Coche ce qui s&apos;est fait — on célèbre les
            gestes, pas les chiffres.
          </div>
        </div>

        <div className="section-h">Tes victoires</div>
        {achievements.length === 0 ? (
          <div className="card">
            <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.5 }}>
              Tes premières victoires apparaîtront ici dès que tu cocheras une
              action. Pas de performance — juste des preuves que tu avances.
            </div>
          </div>
        ) : (
          achievements.map((a) => (
            <div className="achv" key={a.label}>
              <span className="badge">★</span>
              <div>
                <div className="achv-t">{a.label}</div>
                <div className="achv-d">{a.desc}</div>
              </div>
            </div>
          ))
        )}

        <div className="section-h">L&apos;aliment du jour</div>
        <div className="card" style={{ background: "var(--coach-soft)", border: "none" }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--coach)" }}>{aliment.nom}</div>
          <div style={{ fontSize: 14, color: "#0f6e56", lineHeight: 1.5, margin: "4px 0 12px" }}>
            {aliment.benefice}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--coach)", marginBottom: 6 }}>
            Recette protéinée — {aliment.recette}
          </div>
          <ol className="recipe">
            {aliment.etapes.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ol>
        </div>

        <div className="section-h">Ce que j&apos;ai compris</div>
        <div className="card">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="insight-in"
              value={draft}
              placeholder="Une prise de conscience, une leçon…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onAddInsight(draft);
                  setDraft("");
                }
              }}
            />
            <button
              className="add-btn"
              onClick={() => {
                onAddInsight(draft);
                setDraft("");
              }}
            >
              +
            </button>
          </div>
          {insights.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: 10, lineHeight: 1.4 }}>
              Note ici ce que tu réalises au fil du chemin. Élan en fait des
              titres courts, et s&apos;en sert pour mieux te comprendre.
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {insights.map((it) => (
                <div className="insight" key={it.id}>
                  <button
                    className="insight-title"
                    onClick={() => setOpen(open === it.id ? null : it.id)}
                  >
                    {open === it.id ? it.text : it.title}
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Supprimer"
                    onClick={() => onRemoveInsight(it.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chat({
  persona,
  name,
  canRename,
  onRename,
  messages,
  streaming,
  threadRef,
  input,
  setInput,
  onSend,
}: {
  persona: PersonaId;
  name: string;
  canRename: boolean;
  onRename: (name: string) => void;
  messages: Msg[];
  streaming: boolean;
  threadRef: React.RefObject<HTMLDivElement | null>;
  input: string;
  setInput: (v: string) => void;
  onSend: (text: string) => void;
}) {
  const p = PERSONAS[persona];
  const col = COLORS[persona];
  const greeting = p.greeting.replace("{name}", name);
  const showChips = messages.length === 0;
  const lastEmpty =
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content === "";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const [voiceOk, setVoiceOk] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<unknown>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setVoiceOk(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function toggleVoice() {
    const w = window as unknown as {
      SpeechRecognition?: new () => any;
      webkitSpeechRecognition?: new () => any;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;

    if (recording) {
      const r = recRef.current as { _manualStop?: () => void; stop?: () => void } | null;
      if (r?._manualStop) r._manualStop();
      else r?.stop?.();
      return;
    }

    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = true;
    const base = input ? input.trim() + " " : "";
    let manualStop = false;
    rec.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput(base + t);
    };
    rec.onend = () => {
      if (manualStop) {
        setRecording(false);
      } else {
        try {
          rec.start();
        } catch {
          setRecording(false);
        }
      }
    };
    rec.onerror = () => setRecording(false);
    (recRef.current as { _manualStop?: () => void })._manualStop = () => {
      manualStop = true;
      rec.stop();
    };
    setRecording(true);
    rec.start();
  }

  return (
    <>
      <div className="topbar">
        <span className="avatar" style={{ background: col.soft, color: col.ink }}>
          {name[0]}
        </span>
        <div style={{ flex: 1 }}>
          {editing ? (
            <div className="name-edit">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onRename(draft);
                    setEditing(false);
                  }
                }}
              />
              <button
                className="icon-btn"
                onClick={() => {
                  onRename(draft);
                  setEditing(false);
                }}
              >
                ✓
              </button>
            </div>
          ) : (
            <h1>
              {name}
              {canRename && (
                <button
                  className="icon-btn"
                  aria-label="Renommer"
                  onClick={() => {
                    setDraft(name);
                    setEditing(true);
                  }}
                >
                  ✎
                </button>
              )}
            </h1>
          )}
          <p>{p.tagline}</p>
        </div>
      </div>

      <div className="screen" ref={threadRef}>
        <div className="thread">
          <div className="bubble them" style={{ background: col.soft, color: "#2b2b2b" }}>
            {greeting}
          </div>
          {messages.map((m, i) =>
            m.role === "assistant" && m.content === "" ? null : (
              <div
                key={i}
                className={`bubble ${m.role === "user" ? "me" : "them"}`}
                style={m.role === "user" ? undefined : { background: col.soft, color: "#2b2b2b" }}
              >
                {m.content}
              </div>
            ),
          )}
          {lastEmpty && <div className="typing">{name} écrit…</div>}
        </div>

        {showChips && (
          <div className="chips">
            {p.prompts.map((pr) => (
              <button
                key={pr.label}
                className="chip"
                style={{ background: col.soft, color: col.ink }}
                onClick={() => onSend(pr.text)}
              >
                {pr.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="composer">
        {voiceOk && (
          <button
            className={`mic${recording ? " rec" : ""}`}
            aria-label="Dictée vocale"
            onClick={toggleVoice}
          >
            {recording ? "■" : "🎤"}
          </button>
        )}
        <textarea
          rows={1}
          value={input}
          placeholder={`Écris à ${name}…`}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend(input);
            }
          }}
        />
        <button
          className="send"
          style={{ background: col.ink }}
          disabled={streaming || !input.trim()}
          onClick={() => onSend(input)}
        >
          ↑
        </button>
      </div>
    </>
  );
}
