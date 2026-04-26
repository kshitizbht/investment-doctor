"use client";

import { useState, useRef, useEffect } from "react";
import type { InsightsResponse } from "@/lib/api";

type Message = { role: "user" | "assistant"; content: string };

const PRESETS = [
  "How can I reduce my tax bill this year?",
  "Should I harvest any losses now?",
  "What if I wait to sell NVDA until LTCG?",
  "Am I at risk of wash-sale disallowance?",
  "How does my state tax bracket affect strategy?",
];

// --- Inline markdown: **bold**, `code` ---
function renderInline(text: string): React.ReactNode {
  const segments: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  let plain = "";

  const flush = () => { if (plain) { segments.push(plain); plain = ""; } };

  while (i < text.length) {
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        flush();
        segments.push(<strong key={k++} style={{ color: "var(--text-primary)", fontWeight: 600 }}>{text.slice(i + 2, end)}</strong>);
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        flush();
        segments.push(
          <code key={k++} className="rounded px-1 font-mono text-xs" style={{ background: "rgba(255,255,255,0.08)", color: "var(--accent)" }}>
            {text.slice(i + 1, end)}
          </code>
        );
        i = end + 1;
        continue;
      }
    }
    plain += text[i++];
  }
  flush();
  return segments.length === 1 ? segments[0] : <>{segments}</>;
}

// --- Block markdown renderer ---
function MarkdownContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      nodes.push(
        <h2 key={k++} className="text-sm font-semibold mt-3 mb-1" style={{ color: "var(--text-primary)" }}>
          {renderInline(line.slice(3))}
        </h2>
      );
      i++; continue;
    }

    if (line.startsWith("### ")) {
      nodes.push(
        <h3 key={k++} className="text-xs font-semibold mt-2 mb-0.5 uppercase tracking-wider" style={{ color: "var(--accent)" }}>
          {renderInline(line.slice(4))}
        </h3>
      );
      i++; continue;
    }

    if (/^---+$/.test(line)) {
      nodes.push(<hr key={k++} className="my-2" style={{ borderColor: "rgba(255,255,255,0.08)" }} />);
      i++; continue;
    }

    // Bullet list — collect consecutive items
    if (/^[-•*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-•*] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-•*] /, ""));
        i++;
      }
      nodes.push(
        <ul key={k++} className="space-y-0.5 my-1 ml-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-1.5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}>•</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list — collect consecutive items
    if (/^\d+\. /.test(line)) {
      const items: { num: string; text: string }[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const m = lines[i].match(/^(\d+)\. (.*)/);
        if (m) items.push({ num: m[1], text: m[2] });
        i++;
      }
      nodes.push(
        <ol key={k++} className="space-y-0.5 my-1 ml-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-1.5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--accent)", flexShrink: 0, minWidth: "1.25rem" }}>{item.num}.</span>
              <span>{renderInline(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.trim() === "") {
      nodes.push(<div key={k++} className="h-1" />);
      i++; continue;
    }

    nodes.push(
      <p key={k++} className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return (
    <>
      {nodes}
      {streaming && (
        <span
          className="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse"
          style={{ background: "var(--accent)", opacity: 0.7, verticalAlign: "text-bottom" }}
        />
      )}
    </>
  );
}

// --- Main component ---
export default function AskClaude({ snapshot }: { snapshot: InsightsResponse | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, open]);

  async function submit(q: string) {
    if (!snapshot || !q.trim() || streaming) return;

    const historyBeforeThis = messages;
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInputText("");
    setStreamingContent("");
    setError(null);
    setStreaming(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("http://localhost:8000/api/ask-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshot,
          question: q,
          conversation_history: historyBeforeThis,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            setMessages((prev) => [...prev, { role: "assistant", content: fullContent }]);
            setStreamingContent("");
            setStreaming(false);
            return;
          }
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) { setError(parsed.error); setStreaming(false); return; }
            if (parsed.text) { fullContent += parsed.text; setStreamingContent(fullContent); }
          } catch { /* ignore malformed chunk */ }
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setStreaming(false);
    }
  }

  const hasMessages = messages.length > 0 || streaming;
  const replyCount = messages.filter((m) => m.role === "assistant").length;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
        style={{ background: "transparent" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">✦</span>
          <span className="text-xs font-semibold uppercase tracking-widest font-display" style={{ color: "var(--accent)" }}>
            Ask Claude
          </span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-mono" style={{ background: "rgba(245,166,35,0.1)", color: "rgba(245,166,35,0.7)" }}>
            AI Tax Advisor
          </span>
          {replyCount > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-mono" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasMessages && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                abortRef.current?.abort();
                setMessages([]);
                setStreamingContent("");
                setError(null);
                setStreaming(false);
              }}
              className="text-[10px] font-mono px-2 py-0.5 rounded transition-colors"
              style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              new chat
            </button>
          )}
          <span
            className="text-sm transition-transform duration-200"
            style={{ color: "rgba(245,166,35,0.5)", transform: open ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block" }}
          >
            ▾
          </span>
        </div>
      </button>

      {open && (
        <div className="flex flex-col" style={{ borderTop: "1px solid var(--border)" }}>
          {/* Preset chips — shown above chat when no messages yet */}
          {!hasMessages && (
            <div className="px-5 pt-3 pb-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => submit(p)}
                  disabled={streaming || !snapshot}
                  className="rounded-full px-3 py-1 text-[11px] font-body transition-colors duration-150 disabled:opacity-40"
                  style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.2)", color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => { if (!streaming && snapshot) (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,166,35,0.14)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,166,35,0.07)"; }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Chat thread */}
          {hasMessages && (
            <div
              className="px-4 py-3 space-y-3 overflow-y-auto"
              style={{ maxHeight: "440px", scrollbarWidth: "thin" }}
            >
              {messages.map((msg, idx) =>
                msg.role === "user" ? (
                  <div key={idx} className="flex justify-end">
                    <div
                      className="rounded-xl rounded-tr-sm px-3.5 py-2 text-sm font-body max-w-[85%]"
                      style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.18)", color: "var(--text-primary)" }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div key={idx} className="flex justify-start">
                    <div
                      className="rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[95%]"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <MarkdownContent text={msg.content} />
                    </div>
                  </div>
                )
              )}

              {/* Streaming assistant message */}
              {streaming && streamingContent && (
                <div className="flex justify-start">
                  <div
                    className="rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[95%]"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <MarkdownContent text={streamingContent} streaming />
                  </div>
                </div>
              )}

              {/* Thinking indicator */}
              {streaming && !streamingContent && (
                <div className="flex justify-start">
                  <div className="rounded-xl rounded-tl-sm px-4 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex gap-1.5 items-center">
                      <span className="animate-pulse text-xs" style={{ color: "var(--accent)" }}>✦</span>
                      <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>thinking…</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}

          {/* Input area */}
          <div className="px-4 pb-4 pt-2 space-y-2" style={{ borderTop: hasMessages ? "1px solid rgba(255,255,255,0.05)" : undefined }}>
            {!snapshot && (
              <p className="text-xs font-body pt-1" style={{ color: "var(--text-muted)" }}>
                Waiting for simulation results…
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <textarea
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(inputText); }
                }}
                placeholder={hasMessages ? "Follow up…" : "Ask a custom question about your tax situation…"}
                disabled={streaming || !snapshot}
                className="flex-1 resize-none rounded-lg px-3 py-2 text-sm font-body outline-none border"
                style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "var(--text-primary)" }}
              />
              <button
                onClick={() => submit(inputText)}
                disabled={streaming || !snapshot || !inputText.trim()}
                className="self-end rounded-lg px-4 py-2 text-xs font-semibold font-display uppercase tracking-wider transition-colors duration-150 disabled:opacity-40"
                style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)", color: "var(--accent)" }}
              >
                {streaming ? "…" : "Ask"}
              </button>
            </div>

            {/* Quick-follow presets after first reply */}
            {hasMessages && !streaming && (
              <div className="flex flex-wrap gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => submit(p)}
                    disabled={!snapshot}
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-body transition-colors duration-150 disabled:opacity-40"
                    style={{ background: "rgba(245,166,35,0.05)", border: "1px solid rgba(245,166,35,0.15)", color: "var(--text-muted)" }}
                    onMouseEnter={(e) => { if (snapshot) (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,166,35,0.1)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,166,35,0.05)"; }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div
              className="mx-4 mb-4 rounded-lg px-4 py-3 text-sm font-body"
              style={{ background: "rgba(255,68,85,0.06)", border: "1px solid rgba(255,68,85,0.2)", color: "var(--negative)" }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
