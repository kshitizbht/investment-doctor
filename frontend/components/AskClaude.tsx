"use client";

import { useState, useRef } from "react";
import type { InsightsResponse } from "@/lib/api";

const PRESETS = [
  "How can I reduce my tax bill this year?",
  "Should I harvest any losses now?",
  "What if I wait to sell NVDA until LTCG?",
  "Am I at risk of wash-sale disallowance?",
  "How does my state tax bracket affect strategy?",
];

export default function AskClaude({ snapshot }: { snapshot: InsightsResponse | null }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function submit(q: string) {
    if (!snapshot || !q.trim() || streaming) return;
    setQuestion(q);
    setResponse("");
    setError(null);
    setStreaming(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("http://localhost:8000/api/ask-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot, question: q }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") { setStreaming(false); return; }
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) { setError(parsed.error); setStreaming(false); return; }
            if (parsed.text) setResponse((prev) => prev + parsed.text);
          } catch { /* ignore malformed chunk */ }
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
        style={{ background: "transparent" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">✦</span>
          <span
            className="text-xs font-semibold uppercase tracking-widest font-display"
            style={{ color: "var(--accent)" }}
          >
            Ask Claude
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-mono"
            style={{ background: "rgba(245,166,35,0.1)", color: "rgba(245,166,35,0.7)" }}
          >
            AI Tax Advisor
          </span>
        </div>
        <span
          className="text-sm transition-transform duration-200"
          style={{
            color: "rgba(245,166,35,0.5)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            display: "inline-block",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>
          {/* Preset chips */}
          <div className="pt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => submit(p)}
                disabled={streaming || !snapshot}
                className="rounded-full px-3 py-1 text-[11px] font-body transition-colors duration-150 disabled:opacity-40"
                style={{
                  background: "rgba(245,166,35,0.07)",
                  border: "1px solid rgba(245,166,35,0.2)",
                  color: "var(--text-secondary)",
                }}
                onMouseEnter={(e) => {
                  if (!streaming && snapshot)
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,166,35,0.14)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,166,35,0.07)";
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Custom question input */}
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(question); }
              }}
              placeholder="Ask a custom question about your tax situation…"
              disabled={streaming || !snapshot}
              className="flex-1 resize-none rounded-lg px-3 py-2 text-sm font-body outline-none border"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.08)",
                color: "var(--text-primary)",
              }}
            />
            <button
              onClick={() => submit(question)}
              disabled={streaming || !snapshot || !question.trim()}
              className="self-end rounded-lg px-4 py-2 text-xs font-semibold font-display uppercase tracking-wider transition-colors duration-150 disabled:opacity-40"
              style={{
                background: "rgba(245,166,35,0.1)",
                border: "1px solid rgba(245,166,35,0.25)",
                color: "var(--accent)",
              }}
            >
              {streaming ? "…" : "Ask"}
            </button>
          </div>

          {!snapshot && (
            <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
              Waiting for simulation results…
            </p>
          )}

          {/* Streaming response */}
          {(response || streaming) && (
            <div
              className="rounded-lg px-4 py-3 text-sm font-body leading-relaxed whitespace-pre-wrap"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "var(--text-secondary)",
                minHeight: "60px",
              }}
            >
              {response}
              {streaming && (
                <span
                  className="inline-block w-2 h-4 ml-0.5 animate-pulse"
                  style={{ background: "var(--accent)", opacity: 0.7, verticalAlign: "text-bottom" }}
                />
              )}
            </div>
          )}

          {error && (
            <div
              className="rounded-lg px-4 py-3 text-sm font-body"
              style={{
                background: "rgba(255,68,85,0.06)",
                border: "1px solid rgba(255,68,85,0.2)",
                color: "var(--negative)",
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
