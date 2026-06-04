"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Play, Lock, Star, ChevronRight, X,
  Shield, Activity, Award, Zap, Heart, BarChart2,
} from "lucide-react";

// ── Brand tokens ───────────────────────────────────────────────────────────────
const C = {
  orange:     "#FCA248",
  orangeDeep: "#E88828",
  orangeWash: "#FFF4E6",
  charcoal:   "#2B2B2B",
  graphite:   "#4A4A4A",
  slate:      "#6E6E6E",
  cream:      "#FAF6F0",
  paper:      "#FFFFFF",
  line:       "#E6E2DA",
} as const;

const FD = "'Montserrat','Helvetica Neue',Arial,sans-serif";
const FB = "system-ui,Arial,sans-serif";
const CDN = "https://leapsandrebounds.com/cdn/shop";

// ── Types ──────────────────────────────────────────────────────────────────────
interface VideoEntry {
  id: string; title: string; desc: string;
  poster: string; src: string; duration: string;
}
export type Tier = "free" | "pro";
export type Goal = "fundamentals"|"cardio"|"hiit"|"strength"|"balance"|"lymph"|"seniors";
interface Workout {
  id: string; title: string; duration: number; level: string;
  tier: Tier; goal: Goal; inst: string; palette: string; desc: string;
}
interface Program {
  id: string; title: string; weeks: number; sessions: number;
  level: string; tier: Tier; desc: string; inst: string; palette: string;
}

// ── Real L&R CDN content (sourced from leapsandrebounds.com/pages/academy) ────
const HERO_VIDEO: VideoEntry = {
  id:       "hero",
  title:    "Welcome to Leaps & Rebounds",
  desc:     "Everything you need to feel confident, safe, and supported on your rebounder.",
  poster:   `${CDN}/files/preview_images/Leaps_Intro_Video_Thumbnail_small.webp?v=1772051635`,
  src:      `${CDN}/videos/c/vp/dd5f6f572e9246479b2918e1deb3978a/dd5f6f572e9246479b2918e1deb3978a.HD-1080p-7.2Mbps-74800907.mp4?v=0`,
  duration: "",
};

const ASSEMBLY_VIDEOS: VideoEntry[] = [
  {
    id: "assemble", title: "How to Assemble your Rebounder",
    desc: "Box to ready-to-bounce. Complete step-by-step assembly walkthrough.",
    poster: `${CDN}/files/Assembly_Video_Thumbnail.webp?crop=center&height=480&v=1771452994&width=640`,
    src: `${CDN}/videos/c/vp/a921f7bca95b475e99743f46175621dc/a921f7bca95b475e99743f46175621dc.HD-1080p-7.2Mbps-57688319.mp4?v=0`,
    duration: "7 min",
  },
  {
    id: "warranty", title: "About our Warranty",
    desc: "What's covered for life under the Lifetime Warranty and what isn't.",
    poster: `${CDN}/files/Academy_Warranty.webp?crop=center&height=480&v=1772491229&width=640`,
    src: `${CDN}/videos/c/vp/d80b7d94a8ae4d5b98a083a0fdce33f4/d80b7d94a8ae4d5b98a083a0fdce33f4.HD-1080p-3.3Mbps-76596227.mp4?v=0`,
    duration: "3 min",
  },
  {
    id: "bungees", title: "Attaching your Bungees",
    desc: "Follow along with Marc to attach your bungees safely and correctly.",
    poster: `${CDN}/files/mpv-shot0001.jpg?crop=center&height=480&v=1769549726&width=640`,
    src: `${CDN}/videos/c/vp/74606e00968b4a2b8a1d208b071c6a10/74606e00968b4a2b8a1d208b071c6a10.HD-1080p-7.2Mbps-68174533.mp4?v=0`,
    duration: "4 min",
  },
  {
    id: "stability-bar-setup", title: "Using the Stability Bar",
    desc: "Attach, adjust, and bounce with confidence using your stability bar.",
    poster: `${CDN}/files/mpv-shot0003.jpg?crop=center&height=480&v=1769549703&width=640`,
    src: `${CDN}/videos/c/vp/27dfac7b40c842f9927b3939936bd637/27dfac7b40c842f9927b3939936bd637.HD-1080p-7.2Mbps-68180248.mp4?v=0`,
    duration: "5 min",
  },
];

const STARTER_EXERCISES: VideoEntry[] = [
  {
    id: "walk-jog-run", title: "Walk, Jog, and Run",
    desc: "Simple, foundational movements to start your rebounding journey confidently.",
    poster: `${CDN}/files/preview_images/Leaps_Intro_Video_Thumbnail_small.webp?v=1772051635`,
    src: `${CDN}/videos/c/vp/1bcf5004aae342d8b1eaa64e37ff881f/1bcf5004aae342d8b1eaa64e37ff881f.HD-1080p-2.5Mbps-74832955.mp4?v=0`,
    duration: "5 min",
  },
  {
    id: "movements-to-know", title: "Movements to Know",
    desc: "Gliding Reverse Lunge, Single Leg Hop, and Jumping Squat explained clearly.",
    poster: `${CDN}/files/Assembly_Video_Thumbnail.webp?crop=center&height=480&v=1771452994&width=640`,
    src: `${CDN}/videos/c/vp/d46b10b425634ef2bb08fa8f1fc84f8f/d46b10b425634ef2bb08fa8f1fc84f8f.HD-1080p-7.2Mbps-74834604.mp4?v=0`,
    duration: "8 min",
  },
  {
    id: "resistance-bands", title: "Resistance Bar & Bands",
    desc: "Learn to combine resistance bands and bar work with your daily bounce.",
    poster: `${CDN}/files/mpv-shot0001.jpg?crop=center&height=480&v=1769549726&width=640`,
    src: `${CDN}/videos/c/vp/9ae91e16ca1b4d4a94189b1a2a46a9fb/9ae91e16ca1b4d4a94189b1a2a46a9fb.HD-1080p-4.8Mbps-74835563.mp4?v=0`,
    duration: "10 min",
  },
];

// ── Static workout & program data ──────────────────────────────────────────────
const PALETTES: Record<string, { bg: string; accent: string }> = {
  peach:  { bg: "#FFD8B8", accent: "#FCA248" },
  cream:  { bg: "#FAF0E0", accent: "#E88828" },
  sage:   { bg: "#D8E2C8", accent: "#6BA368" },
  rust:   { bg: "#F2A77E", accent: "#C04A4A" },
  sand:   { bg: "#ECDFC4", accent: "#B89464" },
  mist:   { bg: "#D8DFD7", accent: "#6E6E6E" },
  butter: { bg: "#F8E3A1", accent: "#E88828" },
  rose:   { bg: "#F2C6C6", accent: "#C04A4A" },
  sky:    { bg: "#C8DEE8", accent: "#6FB6D9" },
};

const WORKOUTS: Workout[] = [
  { id:"know-stance",    title:"Know Your Stance",            duration:10, level:"Beginner",     tier:"free", goal:"fundamentals", inst:"Bounce N' Burn",             palette:"cream",  desc:"The foundational stance that makes every bounce safer and more effective." },
  { id:"stability-bar",  title:"How to Use a Stability Bar",  duration:25, level:"Beginner",     tier:"free", goal:"fundamentals", inst:"Leaps & Rebounds",            palette:"sage",   desc:"The official L&R primer. Perfect for first-timers and seniors." },
  { id:"fun-cardio",     title:"Fun & Energizing Cardio",     duration:15, level:"Intermediate", tier:"free", goal:"cardio",        inst:"Jump&Jacked",                 palette:"peach",  desc:"Upbeat 15 minutes that lifts your spirits while it lifts your heart rate." },
  { id:"20-min-cardio",  title:"Cardio Rebounder Routine",    duration:20, level:"Intermediate", tier:"free", goal:"cardio",        inst:"Kate's Home Fitness",         palette:"peach",  desc:"A heart-pumping routine that proves rebounding beats the treadmill." },
  { id:"tabata-quick",   title:"Tabata Rebounding",           duration:10, level:"Intermediate", tier:"free", goal:"hiit",          inst:"Renee Lynne",                 palette:"rust",   desc:"Eight rounds of 20-on, 10-off. Fire up your metabolism in under ten." },
  { id:"6-min-lymph",    title:"6-Min Everyday Lymph Flow",   duration:6,  level:"All levels",   tier:"free", goal:"lymph",         inst:"Lindsay · Pilates On Demand", palette:"sky",    desc:"Six minutes, six moves, full-body lymphatic flow. Daily-able." },
  { id:"beginner-bands", title:"Bands for Beginners",         duration:10, level:"Beginner",     tier:"free", goal:"fundamentals",  inst:"Lindsay · Pilates On Demand", palette:"mist",   desc:"Gentle intro to combining resistance bands with bouncing." },
  { id:"no-jump",        title:"No-Jumping for Beginners",    duration:10, level:"Beginner",     tier:"free", goal:"seniors",       inst:"Lindsay · Pilates On Demand", palette:"butter", desc:"Senior-friendly bouncing — no jumps, all benefits." },
  { id:"5k-steps",       title:"5,000 Steps Workout",         duration:40, level:"All levels",   tier:"pro",  goal:"cardio",        inst:"Jump&Jacked",                 palette:"butter", desc:"Hit your daily step goal without leaving the rebounder." },
  { id:"arms-bands",     title:"Rebounding Arms + Bands",     duration:21, level:"Intermediate", tier:"pro",  goal:"strength",      inst:"SanFran Fitness",             palette:"mist",   desc:"Trade dumbbells for bands and sculpt arms while you bounce." },
  { id:"130bpm",         title:"130-138 BPM Cardio",          duration:10, level:"Intermediate", tier:"pro",  goal:"cardio",        inst:"Earth & Owl",                 palette:"peach",  desc:"A music-matched bounce session at exactly the BPM your heart loves." },
  { id:"tabata-int",     title:"Tabata Style - Intermediate", duration:30, level:"Intermediate", tier:"pro",  goal:"hiit",          inst:"Bounce N' Burn",              palette:"rust",   desc:"Tabata format on the trampoline. Sweat seriously, recover gently." },
  { id:"core-10",        title:"Abdominal Core Workout",      duration:10, level:"All levels",   tier:"pro",  goal:"strength",      inst:"Naomi Joy Fitness",           palette:"sand",   desc:"Standing core work that feels nothing like a sit-up." },
  { id:"kickbox",        title:"Kickboxing-Style Rebounder",  duration:10, level:"Intermediate", tier:"pro",  goal:"cardio",        inst:"Renee Lynne",                 palette:"rust",   desc:"Channel your inner fighter — jabs, crosses, and bounces." },
  { id:"balance-fit",    title:"15 Min to Fit - Balance",     duration:15, level:"Beginner",     tier:"pro",  goal:"balance",       inst:"AngieFitnessTV",              palette:"cream",  desc:"Cardio plus balance work. Builds confidence on the mat." },
  { id:"dance-party",    title:"Pop Dance Party",             duration:15, level:"All levels",   tier:"pro",  goal:"cardio",        inst:"Jump&Jacked",                 palette:"rose",   desc:"Choreographed bounce to today's biggest pop hits." },
  { id:"beethoven",      title:"Bounce to Beethoven",         duration:20, level:"Intermediate", tier:"pro",  goal:"cardio",        inst:"Kate's Home Fitness",         palette:"sand",   desc:"Classical music meets rebounding. Surprisingly motivating." },
  { id:"intervals-50",   title:"50-Min Intervals",            duration:50, level:"Advanced",     tier:"pro",  goal:"hiit",          inst:"Michelle Briehler",           palette:"rust",   desc:"On-and-off the trampoline with weights. Earns its name." },
];

const PROGRAMS: Program[] = [
  { id:"p1", title:"Beginner Bounce", weeks:4, sessions:16, level:"Beginner",     tier:"free", desc:"Your first month. Build the habit, build the technique.",                    inst:"Bounce N' Burn",              palette:"peach"  },
  { id:"p2", title:"Stronger Joints", weeks:6, sessions:18, level:"All levels",   tier:"pro",  desc:"A PT-informed plan to take pressure off knees, hips, and ankles.",           inst:"Lindsay - Pilates On Demand",  palette:"rose"   },
  { id:"p3", title:"Active 60+",      weeks:8, sessions:24, level:"Beginner",     tier:"pro",  desc:"Steady, joyful sessions designed with older adults in mind.",                inst:"Laura London",                 palette:"butter" },
  { id:"p4", title:"Lean & Bright",   weeks:6, sessions:24, level:"Intermediate", tier:"pro",  desc:"Calorie-burning bounce plus mobility, four times a week.",                   inst:"Renee Lynne",                  palette:"rust"   },
];

const GOALS: { id: Goal; label: string }[] = [
  { id:"fundamentals", label:"Fundamentals" },
  { id:"cardio",       label:"Cardio"       },
  { id:"hiit",         label:"HIIT"         },
  { id:"strength",     label:"Strength"     },
  { id:"balance",      label:"Balance"      },
  { id:"lymph",        label:"Lymphatic"    },
  { id:"seniors",      label:"Seniors"      },
];

const BENEFITS = [
  { Icon: Shield,    label: "Boosts",   bold: "Immunity",    color: "#6BA368" },
  { Icon: Activity,  label: "Lymphatic",bold: "Drainage",    color: "#6FB6D9" },
  { Icon: Award,     label: "Boosts",   bold: "Confidence",  color: "#FCA248" },
  { Icon: Zap,       label: "Burns",    bold: "Calories",    color: "#E88828" },
  { Icon: Heart,     label: "Easy on",  bold: "your Joints", color: "#C04A4A" },
  { Icon: BarChart2, label: "Improves", bold: "Balance",     color: "#a78bfa" },
];

const MAX_WORKOUTS = 6;

// ── Video Lightbox ─────────────────────────────────────────────────────────────
function VideoLightbox({ video, onClose }: { video: VideoEntry; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { videoRef.current?.pause(); onClose(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onClick={(e) => { if (e.target === e.currentTarget) { videoRef.current?.pause(); onClose(); } }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 20 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.88, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        style={{
          position: "relative", width: "100%", maxWidth: 900,
          borderRadius: 18, overflow: "hidden",
          boxShadow: "0 48px 120px rgba(0,0,0,0.75)",
          background: C.charcoal,
        }}
      >
        <video
          ref={videoRef}
          autoPlay controls playsInline
          preload="auto"
          poster={video.poster}
          style={{ width: "100%", display: "block", background: "#111", maxHeight: "72vh" }}
        >
          <source src={video.src} type="video/mp4" />
        </video>
        <div style={{ padding: "16px 56px 18px 20px" }}>
          <p style={{ fontFamily: FD, fontWeight: 800, fontSize: 14, color: "#fff", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {video.title}
          </p>
          <p style={{ fontFamily: FB, fontSize: 12, color: "#999", margin: "5px 0 0" }}>
            {video.desc}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={() => { videoRef.current?.pause(); onClose(); }}
          aria-label="Close video"
          style={{
            position: "absolute", top: 12, right: 12,
            width: 38, height: 38, borderRadius: "50%",
            background: "rgba(0,0,0,0.75)",
            border: "1.5px solid rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <X size={15} color="#fff" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ── VideoCard — real thumbnail + click-to-play ─────────────────────────────────
function VideoCard({
  video, index, onClick, large = false,
}: {
  video: VideoEntry; index: number; onClick: () => void; large?: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  const pal = PALETTES.peach;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      whileHover={{ y: -4, boxShadow: "0 20px 56px rgba(43,43,43,0.16)" }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      aria-label={`Play ${video.title}`}
      style={{
        background: C.paper, border: `1px solid ${C.line}`,
        borderRadius: 14, overflow: "hidden", cursor: "pointer",
        boxShadow: "0 2px 12px rgba(43,43,43,0.07)",
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden", background: pal.bg, flexShrink: 0 }}>
        {imgOk && video.poster ? (
          <img
            src={video.poster}
            alt={video.title}
            loading="lazy"
            width={640} height={360}
            onError={() => setImgOk(false)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${pal.bg}, ${pal.accent}44)` }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.18)" }} />
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%,-50%)",
          width: large ? 64 : 52, height: large ? 64 : 52,
          borderRadius: "50%", background: C.orange,
          border: "3px solid rgba(255,255,255,0.95)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 6px 28px rgba(252,162,72,0.6)",
        }}>
          <Play size={large ? 22 : 17} fill="#fff" color="#fff" style={{ marginLeft: 2 }} />
        </div>
        {video.duration && (
          <span style={{
            position: "absolute", top: 10, right: 10,
            background: "rgba(20,20,20,0.85)", color: "#fff",
            fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
            padding: "3px 9px", borderRadius: 99, fontFamily: FD,
          }}>{video.duration}</span>
        )}
      </div>
      <div style={{ padding: large ? "18px 20px 22px" : "14px 16px 18px" }}>
        <p style={{
          fontFamily: FD, fontWeight: 800, fontSize: large ? 15 : 13,
          letterSpacing: "0.02em", textTransform: "uppercase",
          color: C.charcoal, margin: 0, lineHeight: 1.25,
        }}>{video.title}</p>
        <p style={{ fontFamily: FB, fontSize: 12, color: C.graphite, margin: "7px 0 0", lineHeight: 1.5 }}>
          {video.desc}
        </p>
      </div>
    </motion.div>
  );
}

// ── SVG Thumb placeholder for workout/program cards ───────────────────────────
function Thumb({ palette, ratio = "4/3" }: { palette: string; ratio?: string }) {
  const p = PALETTES[palette] ?? PALETTES.peach;
  return (
    <div style={{ background: p.bg, aspectRatio: ratio, position: "relative", overflow: "hidden" }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <path d="M10 70 Q30 40 50 70" stroke={p.accent} strokeOpacity="0.25" strokeWidth="0.8" strokeDasharray="2 2" fill="none"/>
        <path d="M50 70 Q70 40 90 70" stroke={p.accent} strokeOpacity="0.25" strokeWidth="0.8" strokeDasharray="2 2" fill="none"/>
        <ellipse cx="50" cy="83" rx="24" ry="5" fill={p.accent} opacity="0.35"/>
        <circle cx="50" cy="30" r="7" fill={C.charcoal} opacity="0.65"/>
        <rect x="46" y="37" width="8" height="20" rx="3" fill={C.charcoal} opacity="0.65"/>
        <rect x="38" y="40" width="6" height="14" rx="3" fill={C.charcoal} opacity="0.65" transform="rotate(-15 41 47)"/>
        <rect x="56" y="40" width="6" height="14" rx="3" fill={C.charcoal} opacity="0.65" transform="rotate(15 59 47)"/>
        <rect x="43" y="55" width="6" height="14" rx="3" fill={C.charcoal} opacity="0.65"/>
        <rect x="51" y="55" width="6" height="14" rx="3" fill={C.charcoal} opacity="0.65"/>
      </svg>
    </div>
  );
}

function TierBadge({ tier }: { tier: Tier }) {
  return tier === "free"
    ? <span style={{ background: C.orange, color: "#fff", fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", padding: "3px 8px", borderRadius: 999, textTransform: "uppercase" }}>FREE</span>
    : <span style={{ background: C.charcoal, color: "#fff", fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", padding: "3px 8px", borderRadius: 999, textTransform: "uppercase" }}>PRO</span>;
}

function SectionHeader({
  eyebrow, title, sub, cta,
}: {
  eyebrow: string; title: string; sub?: string; cta?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 32, flexWrap: "wrap" }}>
      <div style={{ maxWidth: 620 }}>
        <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: C.orangeDeep, marginBottom: 10 }}>
          {eyebrow}
        </div>
        <h2 style={{ fontFamily: FD, fontWeight: 900, fontSize: 34, lineHeight: 1.0, letterSpacing: "-0.01em", textTransform: "uppercase", margin: 0, color: C.charcoal }}>
          {title}
        </h2>
        {sub && <p style={{ fontFamily: FB, fontSize: 15, color: C.graphite, marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>{sub}</p>}
      </div>
      {cta && <div>{cta}</div>}
    </div>
  );
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "9px 18px", borderRadius: 999,
        background: active ? C.charcoal : C.paper,
        color: active ? "#fff" : C.charcoal,
        border: `1px solid ${active ? C.charcoal : C.line}`,
        fontFamily: FD, fontWeight: 700, fontSize: 11,
        letterSpacing: "0.08em", textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {label}
      <span style={{ fontSize: 10, opacity: 0.6 }}>{count}</span>
    </motion.button>
  );
}

// ── Page Header (KPI strip) ────────────────────────────────────────────────────
function PageHeader({ freeCount, proCount }: { freeCount: number; proCount: number }) {
  const stats = [
    { label: "Total Workouts", value: String(WORKOUTS.length) },
    { label: "Free",           value: String(freeCount)       },
    { label: "Pro",            value: String(proCount)        },
    { label: "Programs",       value: String(PROGRAMS.length) },
    { label: "Instructors",    value: "12"                    },
  ];
  return (
    <div style={{ background: C.orangeWash, borderBottom: `1px solid ${C.line}`, padding: "28px 40px 24px" }}>
      <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.orangeDeep, marginBottom: 10 }}>
        L&R · Bounce Club Dashboard
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: C.orange, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(252,162,72,0.35)" }}>
            <GraduationCap size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontFamily: FD, fontWeight: 900, fontSize: 28, letterSpacing: "-0.01em", textTransform: "uppercase", margin: 0, color: C.charcoal, lineHeight: 1 }}>
              The Academy
            </h1>
            <p style={{ fontSize: 13, color: C.slate, margin: "3px 0 0", fontFamily: FB }}>
              Workout library · Programs · Assembly videos
            </p>
          </div>
        </div>
        <a href="https://leapsandrebounds.com/pages/academy" target="_blank" rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FD, fontWeight: 800, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.charcoal, borderBottom: `2px solid ${C.orange}`, paddingBottom: 3, textDecoration: "none" }}>
          View live page <ChevronRight size={11} />
        </a>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
        {stats.map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, padding: "11px 18px", minWidth: 88, boxShadow: "0 2px 8px rgba(43,43,43,0.05)" }}>
            <div style={{ fontFamily: FD, fontWeight: 900, fontSize: 24, letterSpacing: "-0.02em", color: C.charcoal, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.slate, marginTop: 3 }}>{s.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Hero Section ───────────────────────────────────────────────────────────────
// ── Workout of the Day card (used in hero) ────────────────────────────────────
const WOTD = WORKOUTS[2]; // Fun & Energizing Cardio

function WOTDCard({ onPlay }: { onPlay: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: 1 }}
      animate={{ opacity: 1, y: 0,  rotate: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 24, delay: 0.15 }}
      style={{
        background: C.paper, borderRadius: 20,
        boxShadow: "0 24px 72px rgba(43,43,43,0.18), 0 2px 8px rgba(43,43,43,0.06)",
        overflow: "hidden", width: 320, flexShrink: 0,
      }}
    >
      {/* Thumbnail area */}
      <div style={{ position: "relative", background: PALETTES.peach.bg, padding: "32px 24px 0", display: "flex", justifyContent: "center" }}>
        {/* Badges */}
        <div style={{ position: "absolute", top: 14, left: 14, background: C.charcoal, color: "#fff", fontFamily: FD, fontWeight: 800, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 99 }}>
          Workout of the Day
        </div>
        <div style={{ position: "absolute", top: 14, right: 14, background: C.orange, color: "#fff", fontFamily: FD, fontWeight: 900, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 99 }}>
          Free
        </div>
        {/* SVG rebounder illustration */}
        <div style={{ position: "relative", width: 160, height: 160 }}>
          <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            {/* Rebounder frame */}
            <ellipse cx="80" cy="128" rx="54" ry="10" fill={PALETTES.peach.accent} opacity="0.35"/>
            <rect x="32" y="120" width="8" height="22" rx="4" fill={C.charcoal} opacity="0.7" transform="rotate(-8 36 131)"/>
            <rect x="120" y="120" width="8" height="22" rx="4" fill={C.charcoal} opacity="0.7" transform="rotate(8 124 131)"/>
            <ellipse cx="80" cy="120" rx="48" ry="9" fill={C.charcoal} opacity="0.12"/>
            <ellipse cx="80" cy="118" rx="42" ry="7" fill={PALETTES.peach.accent} opacity="0.7"/>
            {/* Body */}
            <circle cx="80" cy="52" r="13" fill={C.charcoal} opacity="0.75"/>
            <rect x="72" y="65" width="16" height="28" rx="7" fill={C.charcoal} opacity="0.75"/>
            {/* Arms up */}
            <rect x="48" y="62" width="8" height="20" rx="4" fill={C.charcoal} opacity="0.75" transform="rotate(-35 52 72)"/>
            <rect x="104" y="62" width="8" height="20" rx="4" fill={C.charcoal} opacity="0.75" transform="rotate(35 108 72)"/>
            {/* Legs */}
            <rect x="70" y="91" width="8" height="22" rx="4" fill={C.charcoal} opacity="0.75" transform="rotate(-8 74 102)"/>
            <rect x="82" y="91" width="8" height="22" rx="4" fill={C.charcoal} opacity="0.75" transform="rotate(8 86 102)"/>
            {/* Bounce arcs */}
            <path d="M38 100 Q60 80 80 100" stroke={PALETTES.peach.accent} strokeWidth="1.5" strokeDasharray="3 3" fill="none" opacity="0.5"/>
            <path d="M80 100 Q100 80 122 100" stroke={PALETTES.peach.accent} strokeWidth="1.5" strokeDasharray="3 3" fill="none" opacity="0.5"/>
          </svg>
          {/* Play button */}
          <motion.button
            onClick={onPlay}
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            aria-label="Play workout"
            style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 52, height: 52, borderRadius: "50%", background: C.orange, border: "3px solid rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 24px rgba(252,162,72,0.55)" }}
          >
            <Play size={18} fill="#fff" color="#fff" style={{ marginLeft: 2 }} />
          </motion.button>
        </div>
      </div>
      {/* Card info */}
      <div style={{ padding: "18px 20px 22px" }}>
        <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.orangeDeep, marginBottom: 6 }}>
          {WOTD.level} &middot; {WOTD.duration} Min &middot; {WOTD.goal}
        </div>
        <div style={{ fontFamily: FD, fontWeight: 900, fontSize: 18, textTransform: "uppercase", letterSpacing: "0.01em", color: C.charcoal, lineHeight: 1.1, marginBottom: 8 }}>
          {WOTD.title}
        </div>
        <div style={{ fontFamily: FB, fontSize: 12, color: C.graphite, lineHeight: 1.5, marginBottom: 14 }}>
          {WOTD.desc}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.orange, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontWeight: 900, fontSize: 10, color: "#fff" }}>
              {WOTD.inst.slice(0, 2).toUpperCase()}
            </div>
            <span style={{ fontFamily: FB, fontSize: 12, color: C.graphite, fontWeight: 600 }}>{WOTD.inst}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-flex", gap: 1 }}>{[0,1,2,3,4].map(k => <Star key={k} size={10} fill={C.orange} color={C.orange} />)}</span>
            <span style={{ fontFamily: FB, fontSize: 11, color: C.slate }}>(412)</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function HeroSection({ onPlayHero }: { onPlayHero: () => void }) {
  return (
    <section style={{ background: `linear-gradient(150deg, ${C.orangeWash} 0%, #FFF8EE 60%, #FAF0DC 100%)`, borderBottom: `1px solid ${C.line}`, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 40, alignItems: "center", padding: "64px 48px 64px 56px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Left: copy */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Eyebrow */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: C.orangeDeep }}>
              The L&R Academy
            </div>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.orangeDeep, display: "inline-block" }} />
            <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: C.orangeDeep }}>
              Free Preview
            </div>
          </div>

          {/* Headline */}
          <h2 style={{ fontFamily: FD, fontWeight: 900, fontSize: 72, lineHeight: 0.95, letterSpacing: "-0.02em", textTransform: "uppercase", margin: "0 0 28px", color: C.charcoal }}>
            Bounce.<br />
            Learn.<br />
            <span style={{ color: C.orangeDeep }}>Repeat.</span>
          </h2>

          {/* Subtext */}
          <p style={{ fontFamily: FB, fontSize: 16, color: C.graphite, lineHeight: 1.65, maxWidth: 420, margin: "0 0 36px" }}>
            18 workouts. 4 multi-week programs. One trampoline.<br />
            Built for the way your body actually feels — not the way a gym ad says it should.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.orange, color: "#fff", fontFamily: FD, fontWeight: 800, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", padding: "16px 28px", borderRadius: 999, border: "none", cursor: "pointer", boxShadow: "0 8px 28px rgba(252,162,72,0.45)" }}
            >
              Start Free with Basic Bounce <ChevronRight size={13} />
            </motion.button>
            <motion.button
              onClick={onPlayHero}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", color: C.charcoal, fontFamily: FD, fontWeight: 800, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", padding: "16px 28px", borderRadius: 999, border: `1.5px solid ${C.charcoal}`, cursor: "pointer" }}
            >
              See What&apos;s in Pro
            </motion.button>
          </div>

          {/* Trust bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: FD, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.slate }}>
            <span>14-Day Pro Trial</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Cancel Anytime</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>5,200+ Members</span>
          </div>
        </div>

        {/* Right: Workout of the Day card */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingRight: 8 }}>
          <WOTDCard onPlay={onPlayHero} />
        </div>

      </div>
    </section>
  );
}

// ── Assembly Section ───────────────────────────────────────────────────────────
function AssemblySection({ onPlay }: { onPlay: (v: VideoEntry) => void }) {
  return (
    <section style={{ padding: "56px 40px 48px", background: C.paper, borderBottom: `1px solid ${C.line}` }}>
      <SectionHeader
        eyebrow="Brand new? Start here"
        title="Introduction & Assembly"
        sub="These quick videos will help you feel steady, confident, and ready to move — even if you're brand new to rebounding."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginTop: 32 }}>
        {ASSEMBLY_VIDEOS.map((v, i) => (
          <VideoCard key={v.id} video={v} index={i} onClick={() => onPlay(v)} />
        ))}
      </div>
    </section>
  );
}

// ── Starter Exercises Section ──────────────────────────────────────────────────
function StarterSection({ onPlay }: { onPlay: (v: VideoEntry) => void }) {
  return (
    <section style={{ padding: "56px 40px 48px", background: C.cream, borderBottom: `1px solid ${C.line}` }}>
      <SectionHeader
        eyebrow="Exercises to get you started"
        title="Beginner Moves"
        sub="Master these foundations first. Simple movements taught clearly — no experience needed."
        cta={
          <motion.a
            href="https://leapsandrebounds.com/blogs/mini-trampoline-workouts"
            target="_blank" rel="noreferrer"
            whileHover={{ scale: 1.03 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FD, fontWeight: 800, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.charcoal, textDecoration: "none", borderBottom: `2px solid ${C.orange}`, paddingBottom: 3 }}
          >
            All Workouts <ChevronRight size={11} />
          </motion.a>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28, marginTop: 32 }}>
        {STARTER_EXERCISES.map((v, i) => (
          <VideoCard key={v.id} video={v} index={i} onClick={() => onPlay(v)} large />
        ))}
      </div>
    </section>
  );
}

// ── Benefits Strip ─────────────────────────────────────────────────────────────
function BenefitsStrip() {
  return (
    <section style={{ background: C.charcoal, padding: "56px 40px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: C.orange, marginBottom: 12 }}>
          Why Rebound?
        </div>
        <h2 style={{ fontFamily: FD, fontWeight: 900, fontSize: 32, letterSpacing: "-0.01em", textTransform: "uppercase", color: "#fff", margin: 0 }}>
          World-Class Trainers.{" "}
          <span style={{ color: C.orange }}>World-Class Results.</span>
        </h2>
        <p style={{ fontFamily: FB, fontSize: 15, color: "#999", marginTop: 12, maxWidth: 500, margin: "12px auto 0", lineHeight: 1.6 }}>
          No payment plan, no gimmicks — just <strong style={{ color: "#fff" }}>free workouts</strong> and real benefits.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, maxWidth: 1100, margin: "0 auto" }}>
        {BENEFITS.map(({ Icon, label, bold, color }, i) => (
          <motion.div key={bold}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "28px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16 }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 14, background: `${color}1A`, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={24} color={color} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: FB, fontSize: 12, color: "#888", margin: 0, lineHeight: 1.3 }}>{label}</p>
              <p style={{ fontFamily: FD, fontWeight: 800, fontSize: 12, color: "#fff", margin: "3px 0 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{bold}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ── Programs Section ───────────────────────────────────────────────────────────
function ProgramsSection({ programs, memberTier }: { programs: Program[]; memberTier: Tier }) {
  return (
    <section style={{ padding: "56px 40px 48px", background: C.paper, borderBottom: `1px solid ${C.line}` }}>
      <SectionHeader
        eyebrow="Multi-week programs"
        title="Build a Habit"
        sub="Pick a journey and follow it for a few weeks. Same time, same trainer, real progress."
        cta={<span style={{ fontFamily: FD, fontWeight: 800, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.charcoal, cursor: "pointer", borderBottom: `2px solid ${C.orange}`, paddingBottom: 3 }}>All programs &rarr;</span>}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginTop: 32 }}>
        {programs.map((p, i) => {
          const locked = p.tier === "pro" && memberTier === "free";
          return (
            <motion.div key={p.id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              whileHover={{ y: -4, boxShadow: "0 16px 48px rgba(43,43,43,0.14)" }}
              style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer", boxShadow: "0 2px 8px rgba(43,43,43,0.06)" }}
            >
              <div style={{ position: "relative" }}>
                <Thumb palette={p.palette} ratio="3/4" />
                <div style={{ position: "absolute", top: 12, left: 12 }}><TierBadge tier={p.tier} /></div>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(43,43,43,0.72), transparent)", color: "#fff", padding: "32px 14px 12px", fontFamily: FD, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  {p.weeks} weeks &middot; {p.sessions} sessions
                </div>
                {locked && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(43,43,43,0.28)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Lock size={18} color={C.charcoal} />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
                <p style={{ fontFamily: FD, fontWeight: 800, fontSize: 15, letterSpacing: "0.005em", textTransform: "uppercase", color: C.charcoal, margin: 0 }}>{p.title}</p>
                <p style={{ fontFamily: FB, fontSize: 12, color: C.graphite, marginTop: 8, lineHeight: 1.5, flex: 1 }}>{p.desc}</p>
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: FB, fontSize: 11, color: C.slate }}>{p.inst}</span>
                  <span style={{ fontFamily: FD, fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.orangeDeep }}>{locked ? "Unlock" : "Start"} &rarr;</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

// ── Workout Card ───────────────────────────────────────────────────────────────
function WorkoutCard({ w, i, memberTier }: { w: Workout; i: number; memberTier: Tier }) {
  const locked = w.tier === "pro" && memberTier === "free";
  const showUrl = `/academy/workouts/${w.id}`;
  return (
    <motion.div
      onClick={() => { if (!locked) window.location.href = showUrl; }}
      role={locked ? undefined : "link"}
      tabIndex={locked ? undefined : 0}
      onKeyDown={(e) => { if (!locked && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); window.location.href = showUrl; } }}
      aria-label={locked ? undefined : `View ${w.title} workout`}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
      whileHover={{ y: -3, boxShadow: "0 14px 40px rgba(43,43,43,0.13)" }}
      style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", cursor: locked ? "default" : "pointer", boxShadow: "0 2px 8px rgba(43,43,43,0.06)" }}
    >
      <div style={{ position: "relative" }}>
        <Thumb palette={w.palette} ratio="4/3" />
        <div style={{ position: "absolute", top: 12, left: 12 }}><TierBadge tier={w.tier} /></div>
        <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(43,43,43,0.82)", color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", padding: "4px 10px", borderRadius: 99, fontFamily: FD }}>
          {w.duration} MIN
        </div>
        {locked && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(43,43,43,0.32)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}>
              <Lock size={20} color={C.charcoal} />
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: "14px 16px 18px" }}>
        <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.orangeDeep }}>
          {w.level} &middot; {w.goal.replace("-", " ")}
        </div>
        <div style={{ fontFamily: FD, fontWeight: 800, fontSize: 16, letterSpacing: "0.005em", textTransform: "uppercase", color: C.charcoal, marginTop: 5 }}>{w.title}</div>
        <div style={{ fontFamily: FB, fontSize: 12, color: C.graphite, marginTop: 7, lineHeight: 1.45 }}>{w.desc}</div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: FB, fontSize: 11, color: C.slate }}>{w.inst}</span>
          {locked
            ? <span style={{ fontFamily: FD, fontWeight: 800, fontSize: 10, color: C.orangeDeep, letterSpacing: "0.08em", textTransform: "uppercase" }}>Unlock</span>
            : <span style={{ display: "inline-flex", gap: 1 }}>{[0,1,2,3,4].map(k => <Star key={k} size={10} fill={C.orange} color={C.orange} />)}</span>
          }
        </div>
      </div>
    </motion.div>
  );
}

// ── Library Section ────────────────────────────────────────────────────────────
interface LibraryProps {
  workouts: Workout[]; allCount: number; filteredCount: number;
  activeGoal: Goal | "all"; activeDur: string;
  memberTier: Tier; showAll: boolean; hasMore: boolean;
  onGoal: (g: Goal | "all") => void;
  onDur:  (d: string)       => void;
  onToggleAll: ()            => void;
}
function LibrarySection({ workouts, allCount, filteredCount, activeGoal, activeDur, memberTier, showAll, hasMore, onGoal, onDur, onToggleAll }: LibraryProps) {
  const durations = [
    { key: "any",   label: "Any"     },
    { key: "0-10",  label: "10 min or less" },
    { key: "10-20", label: "10-20 min"  },
    { key: "20-30", label: "20-30 min"  },
    { key: "30+",   label: "30+ min"    },
  ];
  return (
    <section style={{ padding: "56px 40px 72px", background: C.paper }}>
      <SectionHeader eyebrow="Or pick by what you need" title="Browse the Library" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28 }}>
        <FilterChip label="All" count={allCount} active={activeGoal === "all"} onClick={() => onGoal("all")} />
        {GOALS.map(g => (
          <FilterChip key={g.id} label={g.label}
            count={WORKOUTS.filter(w => w.goal === g.id).length}
            active={activeGoal === g.id}
            onClick={() => onGoal(g.id)}
          />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 18, fontFamily: FD, fontSize: 11, color: C.slate }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Duration:</span>
        {durations.map(d => (
          <button key={d.key} onClick={() => onDur(d.key)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FD, fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: activeDur === d.key ? C.charcoal : C.slate, borderBottom: activeDur === d.key ? `2px solid ${C.orange}` : "2px solid transparent", paddingBottom: 3, transition: "all 0.15s" }}>
            {d.label}
          </button>
        ))}
        <span style={{ marginLeft: "auto", color: C.graphite, fontFamily: FB, fontSize: 12 }}>
          Showing <strong style={{ color: C.charcoal }}>{workouts.length}</strong> of {filteredCount} workouts
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginTop: 28 }}>
        {workouts.map((w, i) => <WorkoutCard key={w.id} w={w} i={i} memberTier={memberTier} />)}
      </div>
      {hasMore && (
        <div style={{ marginTop: 40, textAlign: "center" }}>
          <motion.button
            onClick={onToggleAll}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "13px 36px", borderRadius: 999,
              background: showAll ? C.paper : C.charcoal,
              color: showAll ? C.charcoal : "#fff",
              border: showAll ? `1.5px solid ${C.line}` : `1.5px solid ${C.charcoal}`,
              fontFamily: FD, fontWeight: 800, fontSize: 11,
              letterSpacing: "0.1em", textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: showAll ? "none" : "0 8px 28px rgba(43,43,43,0.2)",
            }}
          >
            {showAll ? "Show less" : `Show all ${filteredCount} workouts`}
          </motion.button>
        </div>
      )}
    </section>
  );
}

// ── Pro Upgrade Strip ──────────────────────────────────────────────────────────
function ProStrip() {
  const bullets = ["30+ on-demand workouts","4 multi-week programs","Live monthly sessions","Joint care & active aging","Lymphatic flow library","New every Tuesday"];
  return (
    <section style={{ padding: "0 40px 80px", background: C.paper }}>
      <div style={{ background: C.charcoal, borderRadius: 24, padding: "56px 56px", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 56, alignItems: "center", position: "relative", overflow: "hidden" }}>
        <svg style={{ position: "absolute", right: -60, bottom: -60, width: 320, height: 320, opacity: 0.1 }} viewBox="0 0 100 100">
          <path d="M10 60 Q30 20 50 60" stroke="#FCA248" strokeWidth="1.5" strokeDasharray="2 3" fill="none"/>
          <path d="M50 60 Q70 20 90 60" stroke="#FCA248" strokeWidth="1.5" strokeDasharray="2 3" fill="none"/>
          <circle cx="90" cy="60" r="3.5" fill="#FCA248"/>
        </svg>
        <div>
          <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: C.orange }}>Academy Pro</div>
          <h2 style={{ fontFamily: FD, fontWeight: 900, fontSize: 44, lineHeight: 1.0, letterSpacing: "-0.01em", textTransform: "uppercase", margin: "14px 0 18px", color: "#fff" }}>
            $9.99 / month.
          </h2>
          <p style={{ fontFamily: FB, fontSize: 15, color: "#E6E2DA", maxWidth: 440, margin: 0, lineHeight: 1.6 }}>
            Unlock every program, every level, every instructor. New classes weekly. Cancel anytime.
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ background: C.orange, color: "#fff", border: "none", padding: "15px 28px", borderRadius: 999, fontFamily: FD, fontWeight: 800, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", boxShadow: "0 8px 24px rgba(252,162,72,0.4)" }}>
              Start 14-day free trial
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)", padding: "15px 28px", borderRadius: 999, fontFamily: FD, fontWeight: 800, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
              $79.99 / year - save 33%
            </motion.button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {bullets.map(b => (
            <div key={b} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: C.orange, flexShrink: 0, marginTop: 1 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span style={{ fontFamily: FB, fontSize: 13, color: "#fff", lineHeight: 1.4 }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Quick Actions ──────────────────────────────────────────────────────────────
const QUICK_LINKS = [
  { href: "/website/snippets", label: "Section Builder", sub: "Generate Shopify snippets",    color: "#a78bfa" },
  { href: "/website/sections", label: "Personalization", sub: "UCB1 section ranking",          color: "#38bdf8" },
  { href: "/content",          label: "Content Hub",     sub: "Videos, assets & copy",         color: "#f59e0b" },
  { href: "https://leapsandrebounds.com/pages/academy", label: "Live Academy", sub: "View on leapsandrebounds.com", color: "#FCA248", external: true },
] as const;

function QuickActions() {
  return (
    <section style={{ background: C.cream, borderTop: `1px solid ${C.line}`, padding: "48px 40px 56px" }}>
      <SectionHeader eyebrow="Ops tools" title="Quick Actions" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 28 }}>
        {QUICK_LINKS.map((l, i) => (
          <motion.a key={l.href} href={l.href}
            target={"external" in l && l.external ? "_blank" : undefined}
            rel={"external" in l && l.external ? "noreferrer" : undefined}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            whileHover={{ y: -3, boxShadow: "0 12px 32px rgba(43,43,43,0.10)" }}
            style={{ background: C.paper, border: `1.5px solid ${C.line}`, borderRadius: 14, padding: "20px 22px", textDecoration: "none", display: "flex", flexDirection: "column", gap: 8, cursor: "pointer", boxShadow: "0 2px 8px rgba(43,43,43,0.05)", position: "relative", overflow: "hidden" }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: l.color, borderRadius: "14px 14px 0 0" }} />
            <div style={{ fontFamily: FD, fontWeight: 800, fontSize: 13, letterSpacing: "0.005em", textTransform: "uppercase", color: C.charcoal, marginTop: 4 }}>{l.label}</div>
            <div style={{ fontFamily: FB, fontSize: 12, color: C.slate }}>{l.sub}</div>
            <div style={{ fontFamily: FD, fontWeight: 800, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: l.color, marginTop: 4 }}>Open</div>
          </motion.a>
        ))}
      </div>
    </section>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AcademyPage() {
  const [activeGoal, setActiveGoal]   = useState<Goal | "all">("all");
  const [activeDur,  setActiveDur]    = useState<string>("any");
  const [showAll,    setShowAll]      = useState(false);
  const [activeVideo, setActiveVideo] = useState<VideoEntry | null>(null);
  const memberTier: Tier = "free";

  const freeCount = WORKOUTS.filter(w => w.tier === "free").length;
  const proCount  = WORKOUTS.filter(w => w.tier === "pro").length;

  const filtered = WORKOUTS.filter(w => {
    const goalOk = activeGoal === "all" || w.goal === activeGoal;
    const durOk  = activeDur === "any"
      || (activeDur === "0-10"  && w.duration <= 10)
      || (activeDur === "10-20" && w.duration > 10 && w.duration <= 20)
      || (activeDur === "20-30" && w.duration > 20 && w.duration <= 30)
      || (activeDur === "30+"   && w.duration > 30);
    return goalOk && durOk;
  });

  const displayed = showAll ? filtered : filtered.slice(0, MAX_WORKOUTS);
  const hasMore   = filtered.length > MAX_WORKOUTS;

  const handlePlay  = useCallback((v: VideoEntry) => setActiveVideo(v), []);
  const handleClose = useCallback(() => setActiveVideo(null), []);

  return (
    <div className="lr-brand" style={{ background: C.cream, minHeight: "100vh", color: C.charcoal, fontFamily: FB }}>

      <AnimatePresence>
        {activeVideo && (
          <VideoLightbox key={activeVideo.id} video={activeVideo} onClose={handleClose} />
        )}
      </AnimatePresence>

      <PageHeader freeCount={freeCount} proCount={proCount} />
      <HeroSection onPlayHero={() => handlePlay(HERO_VIDEO)} />
      <AssemblySection onPlay={handlePlay} />
      <StarterSection onPlay={handlePlay} />
      <BenefitsStrip />
      <ProgramsSection programs={PROGRAMS} memberTier={memberTier} />

      <LibrarySection
        workouts={displayed}
        allCount={WORKOUTS.length}
        filteredCount={filtered.length}
        activeGoal={activeGoal}
        activeDur={activeDur}
        memberTier={memberTier}
        showAll={showAll}
        hasMore={hasMore}
        onGoal={(g) => { setActiveGoal(g); setShowAll(false); }}
        onDur={(d)  => { setActiveDur(d);  setShowAll(false); }}
        onToggleAll={() => setShowAll(v => !v)}
      />

      {memberTier === "free" && <ProStrip />}
      <QuickActions />
    </div>
  );
}
