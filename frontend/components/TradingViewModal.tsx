"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ── Symbol resolver ────────────────────────────────────────────────────────────

const CRYPTO_TICKERS = new Set([
  "BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOT", "AVAX",
  "MATIC", "LINK", "DOGE", "SHIB", "LTC", "BCH", "ATOM",
]);

function resolveSymbol(ticker: string, assetType: string) {
  const t = ticker.trim().toUpperCase();
  if (assetType === "crypto" || CRYPTO_TICKERS.has(t)) {
    return {
      embedSymbol: `BINANCE:${t}USDT`,
      chartUrl: `https://www.tradingview.com/symbols/BINANCE:${t}USDT/`,
    };
  }
  return {
    embedSymbol: t,
    chartUrl: `https://www.tradingview.com/symbols/${t}/`,
  };
}

// ── TradingView chart embed ────────────────────────────────────────────────────

function TradingViewEmbed({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container";
    wrapper.style.width = "100%";
    wrapper.style.height = "100%";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.width = "100%";
    widgetDiv.style.height = "100%";
    wrapper.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(7,11,18,1)",
      gridColor: "rgba(255,255,255,0.05)",
      enable_publishing: false,
      allow_symbol_change: true,
      hide_top_toolbar: false,
      hide_legend: false,
      calendar: false,
    });
    wrapper.appendChild(script);
    el.appendChild(wrapper);

    return () => {
      el.innerHTML = "";
    };
  }, [symbol]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

// ── Modal ──────────────────────────────────────────────────────────────────────

interface Props {
  ticker: string;
  assetType?: string;
  onClose: () => void;
}

export default function TradingViewModal({ ticker, assetType = "stock", onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const { embedSymbol, chartUrl } = resolveSymbol(ticker, assetType);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col rounded-2xl border overflow-hidden"
        style={{
          background: "#070B12",
          borderColor: "rgba(255,255,255,0.1)",
          width: "min(960px, 100%)",
          height: "min(640px, 90vh)",
          boxShadow:
            "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,166,35,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.025)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="text-lg font-bold font-mono"
              style={{ color: "var(--accent)" }}
            >
              {ticker.toUpperCase()}
            </span>
            <span
              className="rounded-full px-2 py-0.5 font-mono uppercase"
              style={{
                fontSize: "10px",
                background: "rgba(245,166,35,0.1)",
                color: "rgba(245,166,35,0.6)",
              }}
            >
              {assetType}
            </span>
            <span
              className="font-mono"
              style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}
            >
              {embedSymbol}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={chartUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-display font-semibold uppercase tracking-wider transition-colors duration-150"
              style={{
                fontSize: "11px",
                background: "rgba(245,166,35,0.08)",
                border: "1px solid rgba(245,166,35,0.22)",
                color: "var(--accent)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background =
                  "rgba(245,166,35,0.16)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background =
                  "rgba(245,166,35,0.08)";
              }}
            >
              Open on TradingView
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path
                  d="M2 2h7m0 0v7m0-7L2 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>

            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.45)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.1)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "rgba(255,255,255,0.8)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.05)";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "rgba(255,255,255,0.45)";
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Chart area */}
        <div className="flex-1 min-h-0">
          <TradingViewEmbed symbol={embedSymbol} />
        </div>
      </div>
    </div>,
    document.body
  );
}
