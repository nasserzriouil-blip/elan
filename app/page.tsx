"use client";

import { useEffect, useRef, useState } from "react";
import {
  PERSONAS,
  PERSONA_ORDER,
  type PersonaId,
} from "@/lib/personas";

type Tab = "home" | PersonaId;
type Msg = { role: "user" | "assistant"; content: string };
type Convos = Record<PersonaId, Msg[]>;

const COLORS: Record<PersonaId, { ink: string; soft: string }> = {
  guide: { ink: "var(--guide)", soft: "var(--guide-soft)" },
  ami: { ink: "var(--ami)", soft: "var(--ami-soft)" },
  coach: { ink: "var(--coach)", soft: "var(--coach-soft)" },
  confident: { ink: "var(--confident)", soft: "var(--confident-soft)" },
};

const TAB_LABEL: Record<Tab, string> = {
  home: "Aujourd'hui",
  guide: "Guide",
  ami: "Sam",
  coach: "Coach",
  confident: "Confident",
};

const emptyConvos: Convos = { guide: [], ami: [], coach: [], confident: [] };

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [convos, setConvos] = useState<Convos>(emptyConvos);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // Persistance locale (beta : pas de compte, tout reste sur l'appareil).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("elan-convos");
      if (raw) setConvos({ ...emptyConvos, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
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

  // Le Confident nourrit les autres : on extrait ses derniers échanges comme
  // contexte partagé pour que les compagnons restent cohérents.
  function journal(): string {
    const c = convos.confident;
    if (!c.length) return "";
    return c
      .slice(-6)
      .map((m) => `${m.role === "user" ? "Lui" : "Confident"} : ${m.content}`)
      .join("\n");
  }

  async function send(persona: PersonaId, text: string) {
    const content = text.trim();
    if (!content || streaming) return;

    const history = [...convos[persona], { role: "user", content } as Msg];
    setConvos((c) => ({ ...c, [persona]: history }));
    setInput("");
    setStreaming(true);

    // Bulle assistant vide qu'on remplit au fil du stream.
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
          journal: persona === "confident" ? undefined : journal(),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(await res.text());
      }

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
          <Home onOpen={setTab} />
        ) : (
          <Chat
            persona={tab}
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
                {t === "home" ? "○" : PERSONAS[t as PersonaId].name[0]}
              </span>
              {TAB_LABEL[t]}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function Home({ onOpen }: { onOpen: (t: Tab) => void }) {
  return (
    <div className="screen">
      <div className="home-pad">
        <div className="home-hello">Bonjour Nasser</div>
        <div className="home-title">Aujourd&apos;hui</div>

        <div className="card" style={{ background: "var(--coach-soft)", border: "none" }}>
          <div className="card-label" style={{ color: "var(--coach)" }}>
            Tes actions, pas la balance
          </div>
          <div className="actions">
            {[
              { ico: "🚶", lbl: "Bougé" },
              { ico: "💧", lbl: "Hydraté" },
              { ico: "🌙", lbl: "Reposé" },
            ].map((a) => (
              <div className="action" key={a.lbl}>
                <div className="ico">{a.ico}</div>
                <div className="lbl" style={{ color: "var(--coach)" }}>
                  {a.lbl}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ background: "var(--guide-soft)", border: "none" }}>
          <div className="card-label" style={{ color: "var(--guide)" }}>
            Le mot du Guide
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: "#26215c" }}>
            Pas d&apos;objectif chiffré aujourd&apos;hui. Juste : qu&apos;est-ce
            qui te ferait du bien, là, maintenant ?
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--ink-faint)", margin: "16px 0 8px" }}>
          Tes compagnons
        </div>
        {PERSONA_ORDER.map((id) => (
          <button key={id} className="companion-row" onClick={() => onOpen(id)}>
            <span
              className="avatar"
              style={{ background: COLORS[id].soft, color: COLORS[id].ink }}
            >
              {PERSONAS[id].name[0]}
            </span>
            <span className="meta">
              <div className="n">{PERSONAS[id].name}</div>
              <div className="t">{PERSONAS[id].tagline}</div>
            </span>
            <span className="chev">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Chat({
  persona,
  messages,
  streaming,
  threadRef,
  input,
  setInput,
  onSend,
}: {
  persona: PersonaId;
  messages: Msg[];
  streaming: boolean;
  threadRef: React.RefObject<HTMLDivElement | null>;
  input: string;
  setInput: (v: string) => void;
  onSend: (text: string) => void;
}) {
  const p = PERSONAS[persona];
  const col = COLORS[persona];
  const showChips = messages.length === 0;
  const lastEmpty =
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content === "";

  return (
    <>
      <div className="topbar">
        <span className="avatar" style={{ background: col.soft, color: col.ink }}>
          {p.name[0]}
        </span>
        <div>
          <h1>{p.name}</h1>
          <p>{p.tagline}</p>
        </div>
      </div>

      <div className="screen" ref={threadRef}>
        <div className="thread">
          <div className="bubble them" style={{ background: col.soft, color: "#2b2b2b" }}>
            {p.greeting}
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
          {lastEmpty && <div className="typing">{p.name} écrit…</div>}
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
        <textarea
          rows={1}
          value={input}
          placeholder={`Écris à ${p.name}…`}
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
