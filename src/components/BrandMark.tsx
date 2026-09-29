/**
 * The L&R mark and lockup, drawn rather than bitmapped.
 *
 * The sidebar used to show `lrb-wordmark.png` — a 1024×1024 square with the logo in
 * a band across the middle — squeezed to 240px wide inside a bordered box, so the
 * artwork rendered at about a third of the space it took and the text in it was
 * soft. The mark is now an SVG (a rebounder seen from above: frame, bungee loops,
 * mat) and the wordmark is live Montserrat, so both stay sharp at any size.
 */
import React from "react";

const LOOPS = 16;

export function BrandMark({ size = 32 }: { size?: number }) {
  // useId keeps the gradient ids unique when the mark renders twice on one page.
  const uid = React.useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={`mat${uid}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffc46b" />
          <stop offset="55%" stopColor="#e98d20" />
          <stop offset="100%" stopColor="#b86a12" />
        </radialGradient>
        <linearGradient id={`rim${uid}`} x1="4" y1="4" x2="28" y2="28">
          <stop offset="0%" stopColor="#f5a840" />
          <stop offset="100%" stopColor="#c97818" />
        </linearGradient>
      </defs>
      {/* frame */}
      <circle cx="16" cy="16" r="14.25" stroke={`url(#rim${uid})`} strokeWidth="1.5" />
      {/* bungee loops */}
      {Array.from({ length: LOOPS }, (_, i) => {
        const a = (i / LOOPS) * Math.PI * 2;
        const x1 = 16 + Math.cos(a) * 9.6, y1 = 16 + Math.sin(a) * 9.6;
        const x2 = 16 + Math.cos(a) * 12.6, y2 = 16 + Math.sin(a) * 12.6;
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(255,255,255,0.42)" strokeWidth="1.1" strokeLinecap="round" />
        );
      })}
      {/* mat */}
      <circle cx="16" cy="16" r="8.4" fill={`url(#mat${uid})`} />
      <ellipse cx="13.6" cy="12.9" rx="3" ry="1.6" fill="rgba(255,255,255,0.28)" transform="rotate(-28 13.6 12.9)" />
    </svg>
  );
}

export function BrandLockup({ size = 34, subtitle = "Mission Control" }: { size?: number; subtitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <div style={{
        width: size + 10, height: size + 10, borderRadius: 12, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(circle at 50% 40%, rgba(233,141,32,0.16), rgba(233,141,32,0.02) 70%)",
        border: "1px solid rgba(233,141,32,0.22)",
        boxShadow: "0 0 24px rgba(233,141,32,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}>
        <BrandMark size={size} />
      </div>
      <div style={{ minWidth: 0, lineHeight: 1 }}>
        <div style={{
          fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 15,
          letterSpacing: "-0.01em", color: "#f4f4f5", whiteSpace: "nowrap",
        }}>
          Leaps <span style={{ color: "var(--accent-orange)" }}>&amp;</span> Rebounds
        </div>
        <div style={{
          marginTop: 5, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 9,
          letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(233,141,32,0.75)",
        }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}
