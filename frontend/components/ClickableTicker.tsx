"use client";

import { useState } from "react";
import TradingViewModal from "./TradingViewModal";

interface Props {
  ticker: string;
  assetType?: string;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}

export default function ClickableTicker({
  ticker,
  assetType = "stock",
  style,
  className,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={className}
        title={`View ${ticker.toUpperCase()} chart on TradingView`}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          font: "inherit",
          cursor: "pointer",
          textDecoration: "underline",
          textDecorationStyle: "dotted",
          textUnderlineOffset: "3px",
          transition: "color 0.15s ease, text-decoration-color 0.15s ease",
          ...style,
          color: hovered ? "var(--accent)" : (style?.color as string | undefined),
          textDecorationColor: hovered
            ? "rgba(245,166,35,0.75)"
            : "rgba(245,166,35,0.3)",
        }}
      >
        {children ?? ticker.toUpperCase()}
      </button>

      {open && (
        <TradingViewModal
          ticker={ticker}
          assetType={assetType}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
