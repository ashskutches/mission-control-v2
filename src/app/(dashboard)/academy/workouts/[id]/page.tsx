"use client";
/**
 * /academy/workouts/[id] — Workout Show Page
 *
 * IDs match the live Shopify blog slugs at:
 * leapsandrebounds.com/blogs/mini-trampoline-workouts/[id]
 *
 * Title + meta tags handled by generateMetadata in layout.tsx (server component).
 * This file is "use client" for Framer Motion and interactive state.
 */
import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, ChevronRight, Clock, Zap, Target, BarChart2,
  Facebook, Link2, CheckCircle, ArrowRight,
  ShieldCheck, Package, Droplets,
} from "lucide-react";

// ── Brand tokens ───────────────────────────────────────────────────────────────
const C = {
  orange:     "#FCA248",
  orangeDeep: "#E88828",
  orangeSoft: "#FFE2C2",
  orangeWash: "#FFF4E6",
  charcoal:   "#2B2B2B",
  graphite:   "#4A4A4A",
  slate:      "#6E6E6E",
  mist:       "#B3B3B3",
  cream:      "#FAF6F0",
  paper:      "#FFFFFF",
  line:       "#E6E2DA",
  leaf:       "#6BA368",
} as const;

const FD = "'Montserrat','Helvetica Neue',Arial,sans-serif";
const FB = "system-ui,Arial,'Helvetica Neue',sans-serif";
const CDN = "https://leapsandrebounds.com/cdn/shop";

// ── Types ──────────────────────────────────────────────────────────────────────
type Tier = "free" | "pro";
type Goal = "fundamentals" | "cardio" | "hiit" | "strength" | "balance" | "lymph" | "seniors";

export interface Workout {
  /** Matches the live Shopify blog slug for SEO consistency */
  id: string;
  title: string;
  duration: number;
  level: string;
  tier: Tier;
  goal: Goal;
  inst: string;
  palette: string;
  desc: string;
  lede: string;
  burn?: string;
  goalLabel?: string;
  videoThumb?: string;
}

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

/**
 * IDs are the exact Shopify blog slugs from:
 * leapsandrebounds.com/blogs/mini-trampoline-workouts/[id]
 */
export const WORKOUTS: Workout[] = [
  {
    id: "rebounding-journey-basics-know-your-stance",
    title: "Know Your Stance",
    duration: 10, level: "Beginner", tier: "free", goal: "fundamentals",
    inst: "Bounce N' Burn", palette: "cream",
    desc: "The foundational stance that makes every bounce safer and more effective.",
    lede: "Before you bounce into anything else, nail the stance that keeps every move safe, efficient, and effective on the mat.",
    burn: "~80 cal", goalLabel: "Foundations",
  },
  {
    id: "how-to-use-a-stability-bar-on-your-mini-trampoline",
    title: "How to Use a Stability Bar",
    duration: 25, level: "Beginner", tier: "free", goal: "fundamentals",
    inst: "Leaps & Rebounds", palette: "sage",
    desc: "The official L&R primer. Perfect for first-timers and seniors.",
    lede: "Your official L&R primer. Whether you just unboxed your rebounder or want to feel more confident, this walkthrough covers everything.",
    burn: "~160 cal", goalLabel: "Foundations",
  },
  {
    id: "fun-and-energizing-cardio-routine",
    title: "Fun & Energizing Cardio",
    duration: 15, level: "Intermediate", tier: "free", goal: "cardio",
    inst: "Jump&Jacked", palette: "peach",
    desc: "Upbeat 15 minutes that lifts your spirits while it lifts your heart rate.",
    lede: "Upbeat, dance-to-the-beat cardio that lifts your mood while it lifts your heart rate. Fifteen minutes and you'll feel the difference.",
    burn: "~120 cal", goalLabel: "Cardio",
    videoThumb: `${CDN}/files/preview_images/Leaps_Intro_Video_Thumbnail_small.webp?v=1772051635`,
  },
  {
    id: "get-your-heart-pumping-with-this-20-minute-cardio-rebounder-routine",
    title: "Cardio Rebounder Routine",
    duration: 20, level: "Intermediate", tier: "free", goal: "cardio",
    inst: "Kate's Home Fitness", palette: "peach",
    desc: "A heart-pumping routine that proves rebounding beats the treadmill.",
    lede: "A heart-pumping 20-minute session that proves the rebounder beats the treadmill — more fun, less impact, same result.",
    burn: "~180 cal", goalLabel: "Cardio",
  },
  {
    id: "tabata-rebounding-quick-intense-rebounder-workout",
    title: "Tabata Rebounding",
    duration: 10, level: "Intermediate", tier: "free", goal: "hiit",
    inst: "Renee Lynne", palette: "rust",
    desc: "Eight rounds of 20-on, 10-off. Fire up your metabolism in under ten.",
    lede: "Eight rounds of 20-on, 10-off on the trampoline. Fire up your metabolism and you're done in under ten.",
    burn: "~110 cal", goalLabel: "HIIT",
  },
  {
    id: "6-min-everyday-rebounder-workout",
    title: "6-Min Everyday Lymph Flow",
    duration: 6, level: "All levels", tier: "free", goal: "lymph",
    inst: "Lindsay · Pilates On Demand", palette: "sky",
    desc: "Six minutes, six moves, full-body lymphatic flow. Daily-able.",
    lede: "Six minutes, six moves. Daily lymphatic drainage you'll actually do — gentle, effective, and totally stackable into your morning.",
    burn: "~40 cal", goalLabel: "Lymphatic",
  },
  {
    id: "rebounder-resistance-beginners",
    title: "Bands for Beginners",
    duration: 10, level: "Beginner", tier: "free", goal: "fundamentals",
    inst: "Lindsay · Pilates On Demand", palette: "mist",
    desc: "Gentle intro to combining resistance bands with bouncing.",
    lede: "A gentle introduction to adding resistance bands to your bounce. More muscle, same low impact — perfect for beginners.",
    burn: "~70 cal", goalLabel: "Foundations",
  },
  {
    id: "no-jumping-rebounder-workout-for-absolute-beginners",
    title: "No-Jumping for Beginners",
    duration: 10, level: "Beginner", tier: "free", goal: "seniors",
    inst: "Lindsay · Pilates On Demand", palette: "butter",
    desc: "Senior-friendly bouncing — no jumps, all benefits.",
    lede: "Senior-friendly rebounding with zero jumps and all the benefits. Gentle on joints, easy on knees, and surprisingly effective.",
    burn: "~60 cal", goalLabel: "Seniors",
  },
  {
    id: "5-000-steps-mini-trampoline-workout",
    title: "5,000 Steps Workout",
    duration: 40, level: "All levels", tier: "pro", goal: "cardio",
    inst: "Jump&Jacked", palette: "butter",
    desc: "Hit your daily step goal without leaving the rebounder.",
    lede: "Hit your daily step goal without leaving the rebounder. Forty fun minutes of low-impact cardio that's gentle on your joints and works your whole body.",
    burn: "~320 cal", goalLabel: "5,000 Steps",
    videoThumb: `${CDN}/files/preview_images/Leaps_Intro_Video_Thumbnail_small.webp?v=1772051635`,
  },
  {
    id: "rebounding-arms-medium-resistance-bands",
    title: "Rebounding Arms + Bands",
    duration: 21, level: "Intermediate", tier: "pro", goal: "strength",
    inst: "SanFran Fitness", palette: "mist",
    desc: "Trade dumbbells for bands and sculpt arms while you bounce.",
    lede: "Swap the dumbbells for bands and sculpt your upper body while you bounce. More challenge, less impact, better music.",
    burn: "~160 cal", goalLabel: "Strength",
  },
  {
    id: "10-minute-leaps-rebounds-mini-trampoline-rebounder-workout-130-138bpm",
    title: "130-138 BPM Cardio",
    duration: 10, level: "Intermediate", tier: "pro", goal: "cardio",
    inst: "Earth & Owl", palette: "peach",
    desc: "A music-matched bounce session at exactly the BPM your heart loves.",
    lede: "A music-matched bounce session calibrated to exactly the BPM your cardiovascular system loves. Ten minutes that feel like a DJ set.",
    burn: "~90 cal", goalLabel: "Cardio",
  },
  {
    id: "rebounder-mini-trampoline-tabata-style-level-intermediate",
    title: "Tabata Style - Intermediate",
    duration: 30, level: "Intermediate", tier: "pro", goal: "hiit",
    inst: "Bounce N' Burn", palette: "rust",
    desc: "Tabata format on the trampoline. Sweat seriously, recover gently.",
    lede: "Tabata format on the trampoline. You'll sweat seriously and recover gently — the best possible version of interval training.",
    burn: "~260 cal", goalLabel: "HIIT",
  },
  {
    id: "rebounding-abdominal-core-workout-10-min",
    title: "Abdominal Core Workout",
    duration: 10, level: "All levels", tier: "pro", goal: "strength",
    inst: "Naomi Joy Fitness", palette: "sand",
    desc: "Standing core work that feels nothing like a sit-up.",
    lede: "Standing core work that feels nothing like a sit-up. Your abs will know it happened — no mat required.",
    burn: "~75 cal", goalLabel: "Strength",
  },
  {
    id: "rebounder-workout-10-min-kickboxing-style",
    title: "Kickboxing-Style Rebounder",
    duration: 10, level: "Intermediate", tier: "pro", goal: "cardio",
    inst: "Renee Lynne", palette: "rust",
    desc: "Channel your inner fighter — jabs, crosses, and bounces.",
    lede: "Channel your inner fighter on the trampoline. Jabs, crosses, and bounces — it's cardio with an attitude.",
    burn: "~95 cal", goalLabel: "Cardio",
  },
  {
    id: "beginner-rebounding-workout-with-stability-bar",
    title: "15 Min to Fit - Balance",
    duration: 15, level: "Beginner", tier: "pro", goal: "balance",
    inst: "AngieFitnessTV", palette: "cream",
    desc: "Cardio plus balance work. Builds confidence on the mat.",
    lede: "Cardio meets balance training. Each move builds confidence on the mat and makes every future bounce feel steadier.",
    burn: "~100 cal", goalLabel: "Balance",
  },
  {
    id: "tiktok-dance-party-15-minute-full-body-workout",
    title: "Pop Dance Party",
    duration: 15, level: "All levels", tier: "pro", goal: "cardio",
    inst: "Jump&Jacked", palette: "rose",
    desc: "Choreographed bounce to today's biggest pop hits.",
    lede: "Choreographed bounce to today's biggest pop hits. It counts as cardio if you're smiling the whole time.",
    burn: "~125 cal", goalLabel: "Cardio",
  },
  {
    id: "bounce-to-beethoven-20-minute-cardio",
    title: "Bounce to Beethoven",
    duration: 20, level: "Intermediate", tier: "pro", goal: "cardio",
    inst: "Kate's Home Fitness", palette: "sand",
    desc: "Classical music meets rebounding. Surprisingly motivating.",
    lede: "Classical music meets rebounding. Surprisingly, absurdly motivating. Your neighbours will think you're having a very elegant meltdown.",
    burn: "~155 cal", goalLabel: "Cardio",
  },
  {
    id: "ultimate-rebounder-workout-on-and-off-rebounder-full-body",
    title: "50-Min Intervals",
    duration: 50, level: "Advanced", tier: "pro", goal: "hiit",
    inst: "Michelle Briehler", palette: "rust",
    desc: "On-and-off the trampoline with weights. Earns its name.",
    lede: "On and off the trampoline with weights. Fifty minutes of intervals that earn their name — this one's not playing around.",
    burn: "~420 cal", goalLabel: "HIIT",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function getRelated(current: Workout, all: Workout[]): Workout[] {
  return all.filter(w => w.id !== current.id && w.goal === current.goal).slice(0, 3);
}

// ── Thumb placeholder ──────────────────────────────────────────────────────────
function ThumbPlaceholder({ palette, ratio = "16/9" }: { palette: string; ratio?: string }) {
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

// ── Related card ───────────────────────────────────────────────────────────────
function RelatedCard({ w, index }: { w: Workout; index: number }) {
  const [hovered, setHovered] = useState(false);
  const pal = PALETTES[w.palette] ?? PALETTES.peach;
  return (
    <motion.a
      href={`/academy/workouts/${w.id}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      whileHover={{ y: -3 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        background: C.paper, borderRadius: 14, overflow: "hidden",
        border: `1px solid ${C.line}`, textDecoration: "none", color: "inherit",
        display: "flex", flexDirection: "column",
        boxShadow: hovered ? "0 12px 32px rgba(43,43,43,0.10)" : "0 2px 8px rgba(43,43,43,0.06)",
        transition: "box-shadow 0.22s ease",
      }}
    >
      <div style={{ position: "relative", aspectRatio: "16/10", background: pal.bg, overflow: "hidden" }}>
        {w.videoThumb
          ? <img src={w.videoThumb} alt={w.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <ThumbPlaceholder palette={w.palette} ratio="16/10" />
        }
        <motion.div
          animate={{ scale: hovered ? 1.08 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: 52, height: 52, borderRadius: "50%", background: C.orange,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(43,43,43,0.10)",
          }}
        >
          <Play size={22} fill="#fff" color="#fff" style={{ marginLeft: 2 }} />
        </motion.div>
        <span style={{
          position: "absolute", right: 10, bottom: 10,
          background: "rgba(43,43,43,0.8)", color: "#fff",
          fontFamily: FD, fontWeight: 700, fontSize: 11, padding: "4px 9px", borderRadius: 999,
        }}>{w.duration} min</span>
      </div>
      <div style={{ padding: "16px 16px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: FD, fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.orangeDeep }}>
          {w.level} · {w.goal}
        </span>
        <span style={{ fontFamily: FD, fontWeight: 800, textTransform: "uppercase", fontSize: 15, lineHeight: 1.1, color: C.charcoal }}>
          {w.title}
        </span>
        <span style={{ fontFamily: FB, fontSize: 13, color: C.slate, lineHeight: 1.5 }}>
          {w.desc}
        </span>
      </div>
    </motion.a>
  );
}

// ── Not Found ─────────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", minHeight: 480, gap: 24,
        padding: "80px 40px", textAlign: "center",
      }}
    >
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: C.orangeWash, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Play size={32} color={C.orangeDeep} />
      </div>
      <h1 style={{ fontFamily: FD, fontWeight: 900, fontSize: 28, color: C.charcoal, margin: 0, textTransform: "uppercase" }}>
        Workout Not Found
      </h1>
      <p style={{ fontFamily: FB, fontSize: 16, color: C.slate, maxWidth: 360, margin: 0, lineHeight: 1.6 }}>
        We couldn&apos;t find that workout. Head back to the Academy to browse all available sessions.
      </p>
      <Link href="/academy" style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        background: C.orange, color: "#fff",
        fontFamily: FD, fontWeight: 800, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase",
        padding: "13px 24px", borderRadius: 999, textDecoration: "none",
        boxShadow: "0 4px 12px rgba(252,162,72,0.35)",
      }}>
        Back to Academy <ChevronRight size={14} />
      </Link>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WorkoutShowPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const workout = WORKOUTS.find(w => w.id === id);

  const [commentForm, setCommentForm] = useState({ name: "", email: "", msg: "" });
  const [submitted, setSubmitted] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  if (!workout) return <NotFound />;

  const pal = PALETTES[workout.palette] ?? PALETTES.peach;
  const related = getRelated(workout, WORKOUTS);
  const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${workout.inst} ${workout.title} rebounder`)}`;

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const fullBleed: React.CSSProperties = { margin: "0 -40px" };
  const wrap: React.CSSProperties = { maxWidth: 1200, margin: "0 auto", padding: "0 40px" };

  return (
    <div style={{ background: C.paper, minHeight: "100vh", fontFamily: FB, color: C.charcoal }}>

      {/* ── Hero video ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ ...fullBleed, padding: "0 40px" }}
      >
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 0 6px", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", fontFamily: FB, fontSize: 13, color: C.slate }}>
          <Link href="/academy" style={{ color: C.orangeDeep, textDecoration: "none", fontWeight: 600 }}>Academy</Link>
          <span style={{ color: C.mist }} aria-hidden="true">›</span>
          <Link href="/academy" style={{ color: C.orangeDeep, textDecoration: "none", fontWeight: 600 }}>Mini Trampoline Workouts</Link>
          <span style={{ color: C.mist }} aria-hidden="true">›</span>
          <span style={{ color: C.graphite }} aria-current="page">{workout.title}</span>
        </nav>

        {/* Video hero */}
        <div style={{ maxWidth: 880, margin: "20px auto 0", position: "relative", borderRadius: 14, overflow: "hidden", background: C.charcoal, aspectRatio: "16/9", boxShadow: "0 4px 12px rgba(43,43,43,0.08), 0 2px 4px rgba(43,43,43,0.04)" }}>
          {workout.videoThumb
            ? <img src={workout.videoThumb} alt={`${workout.title} workout thumbnail`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <ThumbPlaceholder palette={workout.palette} ratio="16/9" />
          }
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(180deg, rgba(43,43,43,0) 55%, rgba(43,43,43,0.45) 100%)" }} />
          <span style={{ position: "absolute", left: 16, top: 16, zIndex: 3, background: "rgba(255,255,255,0.92)", color: C.charcoal, fontFamily: FD, fontWeight: 800, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "7px 13px", borderRadius: 999 }}>
            Rebounder Edition
          </span>
          <span style={{ position: "absolute", right: 16, bottom: 16, zIndex: 3, background: "rgba(43,43,43,0.78)", backdropFilter: "blur(4px)", color: "#fff", fontFamily: FD, fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", padding: "6px 12px", borderRadius: 999, display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={13} /> {workout.duration}:00
          </span>
          <motion.a
            href={ytUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Play ${workout.title} on YouTube`}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 72, height: 72, borderRadius: "50%", border: "none", background: C.orange, color: "#fff", boxShadow: "0 8px 24px rgba(252,162,72,0.35)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
          >
            <Play size={32} fill="#fff" color="#fff" style={{ marginLeft: 4 }} />
          </motion.a>
        </div>
      </motion.div>

      {/* ── Workout head ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px" }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.3 }}
          style={{ padding: "28px 0 8px" }}
        >
          <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: C.orangeDeep, marginBottom: 12 }}>
            Mini Trampoline Workout
          </div>
          <h1 style={{ fontFamily: FD, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 1.04, margin: 0, fontSize: "clamp(30px, 4.2vw, 46px)", color: C.charcoal }}>
            {workout.title}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px 18px", marginTop: 18 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[workout.level, `${workout.duration} Minutes`].map(chip => (
                <span key={chip} style={{ fontFamily: FD, fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: C.charcoal, background: C.orangeSoft, borderRadius: 999, padding: "7px 14px" }}>
                  {chip}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
              <span style={{ fontSize: 12, color: C.slate, fontFamily: FB }}>Share</span>
              <motion.a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://leapsandrebounds.com/blogs/mini-trampoline-workouts/${workout.id}`)}`}
                target="_blank" rel="noreferrer"
                aria-label="Share on Facebook"
                whileHover={{ y: -2, borderColor: C.orange, color: C.orangeDeep }}
                whileTap={{ scale: 0.95 }}
                style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${C.line}`, background: "#fff", color: C.charcoal, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all 0.22s ease" }}
              >
                <Facebook size={15} />
              </motion.a>
              <motion.button
                aria-label="Copy link"
                onClick={handleCopyLink}
                whileHover={{ y: -2, borderColor: C.orange, color: C.orangeDeep }}
                whileTap={{ scale: 0.95 }}
                style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${C.line}`, background: "#fff", color: linkCopied ? "#6BA368" : C.charcoal, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all 0.22s ease" }}
              >
                {linkCopied ? <CheckCircle size={15} /> : <Link2 size={15} />}
              </motion.button>
            </div>
          </div>
          <p style={{ fontFamily: FB, fontSize: 18, lineHeight: 1.6, color: C.graphite, maxWidth: "62ch", margin: "22px 0 0" }}>
            {workout.lede}
          </p>
        </motion.div>

        {/* ── Two-column layout ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 56, alignItems: "start", padding: "36px 0 8px" }}
        >
          {/* ── Article body (backend-rendered rich text) ─────────────────── */}
          <div>
            <article className="article-body" style={{ color: C.graphite, fontFamily: FB, fontSize: 16.5, lineHeight: 1.72 }}>
              <style>{`
                .article-body > *:first-child { margin-top: 0; }
                .article-body > *:last-child { margin-bottom: 0; }
                .article-body h2 {
                  font-family: 'Montserrat','Helvetica Neue',Arial,sans-serif;
                  font-weight: 900; text-transform: uppercase;
                  letter-spacing: -0.005em; line-height: 1.08; color: #2B2B2B;
                  font-size: clamp(24px, 3vw, 30px); margin: 44px 0 16px;
                }
                .article-body h3 {
                  font-family: 'Montserrat','Helvetica Neue',Arial,sans-serif;
                  font-weight: 800; text-transform: uppercase;
                  letter-spacing: 0.02em; line-height: 1.15; color: #2B2B2B;
                  font-size: 19px; margin: 34px 0 12px; padding-top: 16px;
                  border-top: 1px solid #E6E2DA;
                }
                .article-body h4 {
                  font-family: 'Montserrat','Helvetica Neue',Arial,sans-serif;
                  font-weight: 700; text-transform: uppercase;
                  letter-spacing: 0.04em; font-size: 15px; color: #E88828; margin: 26px 0 8px;
                }
                .article-body p { margin: 0 0 16px; }
                .article-body a { color: #E88828; text-decoration: underline; text-underline-offset: 2px; }
                .article-body a:hover { color: #2B2B2B; }
                .article-body strong, .article-body b { color: #2B2B2B; font-weight: 700; }
                .article-body em, .article-body i { font-style: italic; }
                .article-body hr { border: none; border-top: 1px solid #E6E2DA; margin: 32px 0; }
                .article-body ul, .article-body ol { margin: 0 0 18px; padding: 0; list-style: none; }
                .article-body li { position: relative; padding-left: 30px; margin: 0 0 12px; }
                .article-body ul > li::before {
                  content: ""; position: absolute; left: 4px; top: 9px;
                  width: 9px; height: 9px; border-radius: 999px;
                  background: #FFE2C2; border: 2px solid #FCA248; box-sizing: border-box;
                }
                .article-body ol { counter-reset: ab; }
                .article-body ol > li { counter-increment: ab; padding-left: 38px; }
                .article-body ol > li::before {
                  content: counter(ab); position: absolute; left: 0; top: 1px;
                  width: 24px; height: 24px; border-radius: 999px;
                  background: #FCA248; color: #fff;
                  font-family: 'Montserrat',sans-serif; font-weight: 800; font-size: 12px;
                  display: flex; align-items: center; justify-content: center;
                }
                .article-body blockquote {
                  margin: 24px 0; padding: 4px 0 4px 22px; border-left: 4px solid #FCA248;
                  font-family: 'Montserrat','Helvetica Neue',Arial,sans-serif;
                  font-weight: 500; text-transform: uppercase;
                  letter-spacing: 0.01em; line-height: 1.25; font-size: 22px; color: #2B2B2B;
                }
                .article-body blockquote p { margin: 0; }
                .article-body img { border-radius: 14px; margin: 22px 0; max-width: 100%; }
                .article-body iframe { width: 100%; aspect-ratio: 16/9; border: none; border-radius: 14px; margin: 22px 0; }
              `}</style>

              <h2>The Workout</h2>
              <p>
                This {workout.duration}-minute, low-impact session is designed around the rebounder — your joints stay happy,
                your heart rate climbs, and you walk away having actually enjoyed every second of it.
                Follow along with {workout.inst} and keep your core engaged throughout.
              </p>

              <h3>Warm-Up</h3>
              <p>Ease in for the first few minutes to wake the legs up and loosen the shoulders.</p>
              <ul>
                <li><strong>March</strong> — bounce gently in a wide stance, marching in place.</li>
                <li><strong>March with breath</strong> — keep marching, take a slow deep breath, and float your arms overhead. Lower them as you exhale.</li>
                <li><strong>Single shoulder rolls</strong> — march in place and roll your shoulders forward, then backward, with each step.</li>
                <li><strong>Double shoulder rolls</strong> — roll both shoulders forward together, then reverse.</li>
              </ul>

              <h3>Main Bounce</h3>
              <p>This is the bulk of your session. Pick up the pace and settle into a rhythm you can hold.</p>
              <ul>
                <li><strong>Fast march</strong> — wide stance, quick small steps to lift your pace.</li>
                <li><strong>Front &amp; back march</strong> — step to the front of the mat, then to the back, holding the wide stance.</li>
                <li><strong>Side step</strong> — one foot to the center of the rebounder, the other to the mat&apos;s edge. Alternate sides.</li>
                <li><strong>Side step with arms</strong> — keep side-stepping and raise your arms in front. Open them wide, then bring your hands together.</li>
                <li><strong>Steady bounce</strong> — settle into a smooth, even bounce, eyes forward and core engaged.</li>
              </ul>

              <h3>Cool-Down</h3>
              <p>Bring it back down gently over the last few minutes.</p>
              <ul>
                <li><strong>Slow march</strong> — ease the pace right down and let your heart rate come back to earth.</li>
                <li><strong>March with breath</strong> — finish where you started: slow march, deep breath, arms float up and down.</li>
              </ul>

              <blockquote>Five fun minutes on a trampoline ≈ one mile of running.</blockquote>

              <h2>Your Coach</h2>
              <p>
                <strong>{workout.inst}</strong> brings high-energy, beginner-friendly workouts to the rebounder. With years of
                hands-on fitness experience, they make every session something you actually look forward to.
              </p>
            </article>
          </div>

          {/* ── Sticky sidebar ────────────────────────────────────────────── */}
          <aside aria-label="Workout details" style={{ position: "sticky", top: 96, display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Quick facts */}
            <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                {[
                  { k: "Duration", v: `${workout.duration} min`, icon: <Clock size={16} /> },
                  { k: "Level",    v: workout.level,             icon: <BarChart2 size={16} /> },
                  { k: "Burn",     v: workout.burn ?? "~varies", icon: <Zap size={16} /> },
                  { k: "Goal",     v: workout.goalLabel ?? workout.goal, icon: <Target size={16} /> },
                ].map((f, i) => (
                  <div key={f.k} style={{ padding: "14px 12px", display: "flex", flexDirection: "column", gap: 7, borderBottom: i < 2 ? `1px solid ${C.line}` : undefined, borderRight: i % 2 === 0 ? `1px solid ${C.line}` : undefined }}>
                    <span style={{ fontFamily: FB, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.slate }}>{f.k}</span>
                    <span style={{ fontFamily: FD, fontWeight: 800, fontSize: 19, color: C.charcoal, textTransform: "uppercase" }}>{f.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment */}
            <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 22 }}>
              <h3 style={{ fontFamily: FD, fontWeight: 800, textTransform: "uppercase", fontSize: 15, letterSpacing: "0.06em", color: C.charcoal, margin: "0 0 14px" }}>
                What you&apos;ll need
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { icon: <Package size={18} />, name: "40″ or 48″ Rebounder", note: "your bounce HQ", req: true },
                  { icon: <ArrowRight size={18} />, name: "Stability Bar", note: "steady hands for balance", req: false },
                  { icon: <Droplets size={18} />, name: "Water + Grip Socks", note: "stay grounded, stay hydrated", req: false },
                ].map(e => (
                  <div key={e.name} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: C.orangeWash, color: C.orangeDeep, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {e.icon}
                    </span>
                    <div>
                      <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.03em", color: C.charcoal }}>{e.name}</div>
                      <div style={{ fontFamily: FB, fontSize: 13, color: C.slate }}>
                        <span style={{ fontFamily: FD, fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: e.req ? "#6BA368" : C.slate }}>
                          {e.req ? "Required" : "Optional"}
                        </span>
                        {" · "}{e.note}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Product CTA */}
            <div style={{ background: C.charcoal, color: "#fff", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ aspectRatio: "16/10", background: C.orangeWash, overflow: "hidden" }}>
                <ThumbPlaceholder palette="peach" ratio="16/10" />
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.orange }}>
                  Bounce on the real thing
                </div>
                <div style={{ fontFamily: FD, fontWeight: 900, fontSize: 24, textTransform: "uppercase", margin: "6px 0 8px", lineHeight: 1.05 }}>
                  The 40&Prime; Rebounder
                </div>
                <p style={{ fontFamily: FB, fontSize: 13, color: "#D8D5CF", lineHeight: 1.55, margin: "0 0 16px" }}>
                  Whisper-quiet bungee cords — not springs — for 70% less joint impact. Ships 95% assembled.
                </p>
                <div style={{ fontFamily: FD, fontWeight: 900, fontSize: 26, marginBottom: 16 }}>
                  $229 <small style={{ fontSize: 13, fontWeight: 700, color: "#B3B3B3" }}>+ free shipping</small>
                </div>
                <motion.a
                  href="https://leapsandrebounds.com/products/bungee-rebounders-mini-trampoline"
                  target="_blank" rel="noreferrer"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "15px 28px", borderRadius: 999, background: C.orange, color: "#fff", textDecoration: "none", fontFamily: FD, fontWeight: 800, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", boxShadow: "0 4px 12px rgba(43,43,43,0.10)" }}
                >
                  Shop the Rebounder <ArrowRight size={16} />
                </motion.a>
              </div>
            </div>

            {/* Trust marks */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "4px 2px" }}>
              {["30-day jump trial — bounce risk-free", "Free shipping, both ways", "Lifetime warranty on the frame"].map(t => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: FB, fontSize: 13, color: C.graphite }}>
                  <CheckCircle size={18} color="#6BA368" style={{ flexShrink: 0 }} />
                  {t}
                </div>
              ))}
            </div>
          </aside>
        </motion.div>
      </div>

      {/* ── Related workouts ──────────────────────────────────────────────────── */}
      {related.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          aria-label="Related workouts"
          style={{ ...fullBleed, background: C.cream, padding: "56px 40px", marginTop: 32 }}
        >
          <div style={wrap}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 26 }}>
              <h2 style={{ fontFamily: FD, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.01em", fontSize: "clamp(28px, 3.4vw, 40px)", margin: 0, color: C.charcoal }}>
                Keep Bouncing
              </h2>
              <Link href="/academy" style={{ fontFamily: FD, fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: C.orangeDeep, textDecoration: "none", whiteSpace: "nowrap" }}>
                Browse the library →
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
              {related.map((w, i) => <RelatedCard key={w.id} w={w} index={i} />)}
            </div>
          </div>
        </motion.section>
      )}

      {/* ── Comments ──────────────────────────────────────────────────────────── */}
      <section aria-label="Comments" style={{ padding: "56px 40px" }}>
        <div style={{ maxWidth: 820 }}>
          <h2 style={{ fontFamily: FD, fontWeight: 900, textTransform: "uppercase", fontSize: 24, color: C.charcoal, margin: "0 0 8px" }}>
            Leave a comment
          </h2>
          <p style={{ fontFamily: FB, color: C.slate, margin: "0 0 22px" }}>
            Did this one work for you? Tell the community how the bounce went.
          </p>
          <AnimatePresence>
            {!submitted ? (
              <motion.form
                key="form"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={e => { e.preventDefault(); setSubmitted(true); }}
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}
              >
                {[
                  { id: "cname", label: "Name", type: "text", placeholder: "Your name", key: "name" as const },
                  { id: "cmail", label: "Email", type: "email", placeholder: "you@email.com", key: "email" as const },
                ].map(f => (
                  <div key={f.id}>
                    <label htmlFor={f.id} style={{ display: "block", fontFamily: FD, fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: C.graphite, marginBottom: 7 }}>{f.label}</label>
                    <input id={f.id} type={f.type} placeholder={f.placeholder} value={commentForm[f.key]} onChange={e => setCommentForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ width: "100%", fontFamily: FB, fontSize: 15, color: C.charcoal, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px", outline: "none", boxSizing: "border-box" }} />
                  </div>
                ))}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="cmsg" style={{ display: "block", fontFamily: FD, fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: C.graphite, marginBottom: 7 }}>Comment</label>
                  <textarea id="cmsg" placeholder="Share how the workout felt…" value={commentForm.msg} onChange={e => setCommentForm(prev => ({ ...prev, msg: e.target.value }))}
                    style={{ width: "100%", fontFamily: FB, fontSize: 15, color: C.charcoal, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px", outline: "none", resize: "vertical", minHeight: 110, boxSizing: "border-box" }} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <motion.button type="submit" whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
                    style={{ fontFamily: FD, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", background: C.orange, color: "#fff", border: "none", borderRadius: 999, padding: "12px 22px", fontSize: 13, cursor: "pointer", boxShadow: "0 4px 12px rgba(43,43,43,0.10)" }}>
                    Post comment
                  </motion.button>
                </div>
              </motion.form>
            ) : (
              <motion.div key="thanks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderRadius: 14, background: C.orangeWash, border: `1px solid ${C.line}`, marginBottom: 16 }}>
                <CheckCircle size={20} color="#6BA368" />
                <span style={{ fontFamily: FB, fontSize: 15, color: C.graphite }}>Thanks for sharing! Your comment is awaiting moderation.</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div style={{ fontFamily: FD, fontWeight: 800, textTransform: "uppercase", fontSize: 14, color: C.charcoal, margin: "26px 0 6px" }}>0 comments</div>
          <div style={{ fontFamily: FB, fontSize: 14, color: C.slate }}>No comments yet — be the first to bounce in.</div>
        </div>
      </section>

      {/* ── Risk-free banner ──────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        aria-label="Risk-free guarantee"
        style={{ ...fullBleed, background: C.charcoal, color: "#fff", padding: "64px 40px", position: "relative", overflow: "hidden" }}
      >
        <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5 35 Q20 5 35 35' stroke='%23FCA248' stroke-width='1.2' fill='none'/%3E%3C/svg%3E")`, backgroundSize: "80px" }} />
        <div style={{ ...wrap, position: "relative", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: C.orange, marginBottom: 14 }}>100% money-back guarantee</div>
            <h2 style={{ fontFamily: FD, fontWeight: 900, textTransform: "uppercase", lineHeight: 1.02, fontSize: "clamp(30px, 4vw, 52px)", margin: "0 0 16px" }}>
              Try our rebounder <em style={{ fontStyle: "normal", color: C.orange }}>risk-free</em>
            </h2>
            <p style={{ fontFamily: FB, fontSize: 16, lineHeight: 1.6, color: "#D8D5CF", maxWidth: "48ch", margin: "0 0 24px" }}>
              Bounce on it for 30 days. If you don&apos;t absolutely love how you feel, send it back and we&apos;ll refund every penny — return shipping on us.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
              <motion.a href="https://leapsandrebounds.com/collections/mini-trampolines" target="_blank" rel="noreferrer" whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.orange, color: "#fff", textDecoration: "none", fontFamily: FD, fontWeight: 800, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", padding: "15px 28px", borderRadius: 999, boxShadow: "0 8px 24px rgba(252,162,72,0.35)" }}>
                Shop Rebounders <ArrowRight size={16} />
              </motion.a>
              <motion.a href="https://leapsandrebounds.com/collections/mini-trampolines" target="_blank" rel="noreferrer" whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: C.charcoal, textDecoration: "none", fontFamily: FD, fontWeight: 800, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", padding: "15px 28px", borderRadius: 999 }}>
                Compare Models
              </motion.a>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div
              animate={{ rotate: [0, 2, -2, 0] }}
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
              style={{ width: 150, height: 150, borderRadius: "50%", border: `2px dashed ${C.orange}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}
            >
              <span style={{ fontFamily: FD, fontWeight: 900, fontSize: 48, lineHeight: 1, color: C.orange }}>30</span>
              <span style={{ fontFamily: FD, fontWeight: 800, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6 }}>Day Jump Trial</span>
            </motion.div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
