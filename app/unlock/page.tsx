"use client";

import { useState } from "react";

export default function Unlock() {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw.trim() || busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        window.location.href = "/";
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#15171c",
        padding: 24,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 320,
          textAlign: "center",
          color: "#fff",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "#534ab7",
            margin: "0 auto 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
          }}
        >
          ✦
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Élan</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 22 }}>
          Entre ton code d&apos;accès
        </div>
        <input
          type="password"
          value={pw}
          autoFocus
          onChange={(e) => setPw(e.target.value)}
          placeholder="Code d'accès"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: error
              ? "1px solid #e24b4a"
              : "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            textAlign: "center",
            outline: "none",
          }}
        />
        {error && (
          <div style={{ color: "#f09595", fontSize: 13, marginTop: 8 }}>
            Code incorrect
          </div>
        )}
        <button
          type="submit"
          disabled={busy || !pw.trim()}
          style={{
            width: "100%",
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: "none",
            background: "#534ab7",
            color: "#fff",
            fontSize: 15,
            opacity: busy || !pw.trim() ? 0.5 : 1,
          }}
        >
          Entrer
        </button>
      </form>
    </div>
  );
}
