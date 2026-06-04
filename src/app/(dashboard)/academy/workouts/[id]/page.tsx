"use client";
/**
 * /academy/workouts/[id] — Workout Show Page
 *
 * IDs match the live Shopify blog slugs at:
 * leapsandrebounds.com/blogs/mini-trampoline-workouts/[id]
 *
 * Metadata (title, description, OG) is handled by the sibling layout.tsx
 * server component so this file can stay "use client" for Framer Motion.
 *
 * Styling: page.module.css — no inline styles except the 5 documented
 * dynamic exceptions (palette colours, JS-toggled states).
 */
import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, ChevronRight, Clock, Zap, Target, BarChart2,
  Facebook, Link2, CheckCircle, ArrowRight,
  Package, Droplets,
} from "lucide-react";
import styles from "./page.module.css";

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

// Per-workout SVG illustration colours — set as CSS vars on the container
// so the SVG can reference them. Dynamic by nature, legitimate inline use.
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

const CDN = "https://leapsandrebounds.com/cdn/shop";

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
// Dynamic exception: --palette-bg and --palette-accent are per-workout values
// from JS, so they're passed as inline CSS custom properties on the wrapper.
function ThumbPlaceholder({ palette, ratio = "16/9" }: { palette: string; ratio?: string }) {
  const p = PALETTES[palette] ?? PALETTES.peach;
  return (
    <div
      className={styles.thumbPlaceholder}
      style={{ aspectRatio: ratio, "--palette-bg": p.bg } as React.CSSProperties}
    >
      <svg className={styles.thumbPlaceholderSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M10 70 Q30 40 50 70" stroke={p.accent} strokeOpacity="0.25" strokeWidth="0.8" strokeDasharray="2 2" fill="none"/>
        <path d="M50 70 Q70 40 90 70" stroke={p.accent} strokeOpacity="0.25" strokeWidth="0.8" strokeDasharray="2 2" fill="none"/>
        <ellipse cx="50" cy="83" rx="24" ry="5" fill={p.accent} opacity="0.35"/>
        <circle cx="50" cy="30" r="7" fill="#2B2B2B" opacity="0.65"/>
        <rect x="46" y="37" width="8" height="20" rx="3" fill="#2B2B2B" opacity="0.65"/>
        <rect x="38" y="40" width="6" height="14" rx="3" fill="#2B2B2B" opacity="0.65" transform="rotate(-15 41 47)"/>
        <rect x="56" y="40" width="6" height="14" rx="3" fill="#2B2B2B" opacity="0.65" transform="rotate(15 59 47)"/>
        <rect x="43" y="55" width="6" height="14" rx="3" fill="#2B2B2B" opacity="0.65"/>
        <rect x="51" y="55" width="6" height="14" rx="3" fill="#2B2B2B" opacity="0.65"/>
      </svg>
    </div>
  );
}

// ── Related card ───────────────────────────────────────────────────────────────
function RelatedCard({ w, index }: { w: Workout; index: number }) {
  return (
    <motion.a
      href={`/academy/workouts/${w.id}`}
      className={styles.relatedCard}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      whileHover={{ y: -3 }}
    >
      <div className={styles.relatedThumb}>
        {w.videoThumb
          ? <img src={w.videoThumb} alt={w.title} />
          : <ThumbPlaceholder palette={w.palette} ratio="16/10" />
        }
        <motion.div
          className={styles.relatedPlayBtn}
          whileHover={{ scale: 1.08 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        >
          <Play size={22} fill="#fff" color="#fff" />
        </motion.div>
        <span className={styles.relatedDuration}>{w.duration} min</span>
      </div>
      <div className={styles.relatedInfo}>
        <span className={styles.relatedLevel}>{w.level} · {w.goal}</span>
        <span className={styles.relatedName}>{w.title}</span>
        <span className={styles.relatedDesc}>{w.desc}</span>
      </div>
    </motion.a>
  );
}

// ── Not found ──────────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <motion.div
      className={styles.notFound}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className={styles.notFoundIcon}>
        <Play size={32} color="#E88828" />
      </div>
      <h1 className={styles.notFoundTitle}>Workout Not Found</h1>
      <p className={styles.notFoundBody}>
        We couldn&apos;t find that workout. Head back to the Academy to browse all available sessions.
      </p>
      <Link href="/academy" className={styles.notFoundBtn}>
        Back to Academy <ChevronRight size={14} />
      </Link>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WorkoutShowPage() {
  const params  = useParams();
  const id      = typeof params.id === "string" ? params.id : "";
  const workout = WORKOUTS.find(w => w.id === id);

  const [commentForm, setCommentForm] = useState({ name: "", email: "", msg: "" });
  const [submitted,   setSubmitted]   = useState(false);
  const [linkCopied,  setLinkCopied]  = useState(false);

  if (!workout) return <NotFound />;

  const related = getRelated(workout, WORKOUTS);
  const ytUrl   = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${workout.inst} ${workout.title} rebounder`)}`;
  const fbUrl   = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://leapsandrebounds.com/blogs/mini-trampoline-workouts/${workout.id}`)}`;

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className={styles.page}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <motion.div
        className={styles.heroWrapper}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/academy" className={styles.breadcrumbLink}>Academy</Link>
          <span className={styles.breadcrumbSep} aria-hidden="true">›</span>
          <Link href="/academy" className={styles.breadcrumbLink}>Mini Trampoline Workouts</Link>
          <span className={styles.breadcrumbSep} aria-hidden="true">›</span>
          <span className={styles.breadcrumbCurrent} aria-current="page">{workout.title}</span>
        </nav>

        <div className={styles.videoHero}>
          {workout.videoThumb
            ? <img src={workout.videoThumb} alt={`${workout.title} workout thumbnail`} />
            : <ThumbPlaceholder palette={workout.palette} ratio="16/9" />
          }
          <div className={styles.videoGradient} />
          <span className={styles.videoBadgeEdition}>Rebounder Edition</span>
          <span className={styles.videoDuration}>
            <Clock size={13} /> {workout.duration}:00
          </span>
          <motion.a
            href={ytUrl}
            target="_blank"
            rel="noreferrer"
            className={styles.playBtn}
            aria-label={`Play ${workout.title} on YouTube`}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
          >
            <Play size={32} fill="#fff" color="#fff" style={{ marginLeft: 4 }} />
          </motion.a>
        </div>
      </motion.div>

      {/* ── Workout head ──────────────────────────────────────────────────── */}
      <div className={styles.container}>
        <motion.div
          className={styles.head}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.3 }}
        >
          <div className={styles.eyebrow}>Mini Trampoline Workout</div>
          <h1 className={styles.title}>{workout.title}</h1>

          <div className={styles.metaRow}>
            <div className={styles.chips}>
              {[workout.level, `${workout.duration} Minutes`].map(chip => (
                <span key={chip} className={styles.chip}>{chip}</span>
              ))}
            </div>
            <div className={styles.shareRow}>
              <span className={styles.shareLabel}>Share</span>
              <motion.a
                href={fbUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.shareBtn}
                aria-label="Share on Facebook"
                whileTap={{ scale: 0.95 }}
              >
                <Facebook size={15} />
              </motion.a>
              {/* Dynamic exception: color toggles between leaf and charcoal on linkCopied state */}
              <motion.button
                className={styles.shareBtn}
                aria-label="Copy link"
                onClick={handleCopyLink}
                whileTap={{ scale: 0.95 }}
                style={{ color: linkCopied ? "#6BA368" : undefined }}
              >
                {linkCopied ? <CheckCircle size={15} /> : <Link2 size={15} />}
              </motion.button>
            </div>
          </div>

          <p className={styles.lede}>{workout.lede}</p>
        </motion.div>

        {/* ── Two-column layout ────────────────────────────────────────────── */}
        <motion.div
          className={styles.layout}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          {/* Article body */}
          <div>
            <article className={styles.articleBody}>
              <h2>The Workout</h2>
              <p>
                This {workout.duration}-minute, low-impact session is designed around the rebounder — your joints
                stay happy, your heart rate climbs, and you walk away having actually enjoyed every second of it.
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
                <strong>{workout.inst}</strong> brings high-energy, beginner-friendly workouts to the rebounder.
                With years of hands-on fitness experience, they make every session something you actually look
                forward to.
              </p>
            </article>
          </div>

          {/* Sidebar */}
          <aside className={styles.sidebar} aria-label="Workout details">

            {/* Quick facts */}
            <div className={styles.factGrid}>
              <div className={styles.factCells}>
                {[
                  { k: "Duration", v: `${workout.duration} min`, icon: <Clock size={16} /> },
                  { k: "Level",    v: workout.level,              icon: <BarChart2 size={16} /> },
                  { k: "Burn",     v: workout.burn ?? "~varies",  icon: <Zap size={16} /> },
                  { k: "Goal",     v: workout.goalLabel ?? workout.goal, icon: <Target size={16} /> },
                ].map(f => (
                  <div key={f.k} className={styles.factCell}>
                    <span className={styles.factLabel}>{f.k}</span>
                    <span className={styles.factValue}>{f.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment */}
            <div className={styles.equipmentCard}>
              <h3>What you&apos;ll need</h3>
              <div className={styles.equipmentList}>
                {[
                  { icon: <Package size={18} />,  name: "40″ or 48″ Rebounder",  note: "your bounce HQ",              req: true  },
                  { icon: <ArrowRight size={18} />, name: "Stability Bar",          note: "steady hands for balance",    req: false },
                  { icon: <Droplets size={18} />,  name: "Water + Grip Socks",     note: "stay grounded, stay hydrated",req: false },
                ].map(e => (
                  <div key={e.name} className={styles.equipmentItem}>
                    <span className={styles.equipmentIcon}>{e.icon}</span>
                    <div>
                      <div className={styles.equipmentName}>{e.name}</div>
                      <div className={styles.equipmentNote}>
                        <span className={e.req ? styles.equipmentRequired : styles.equipmentOptional}>
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
            <div className={styles.ctaCard}>
              <div className={styles.ctaThumb}>
                <ThumbPlaceholder palette="peach" ratio="16/10" />
              </div>
              <div className={styles.ctaBody}>
                <div className={styles.ctaEyebrow}>Bounce on the real thing</div>
                <div className={styles.ctaProductName}>The 40&Prime; Rebounder</div>
                <p className={styles.ctaDesc}>
                  Whisper-quiet bungee cords — not springs — for 70% less joint impact. Ships 95% assembled.
                </p>
                <div className={styles.ctaPrice}>
                  $229 <small className={styles.ctaPriceSmall}>+ free shipping</small>
                </div>
                <motion.a
                  href="https://leapsandrebounds.com/products/bungee-rebounders-mini-trampoline"
                  target="_blank"
                  rel="noreferrer"
                  className={styles.ctaBtn}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Shop the Rebounder <ArrowRight size={16} />
                </motion.a>
              </div>
            </div>

            {/* Trust marks */}
            <div className={styles.trustList}>
              {[
                "30-day jump trial — bounce risk-free",
                "Free shipping, both ways",
                "Lifetime warranty on the frame",
              ].map(t => (
                <div key={t} className={styles.trustItem}>
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
          className={styles.relatedSection}
          aria-label="Related workouts"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className={styles.relatedInner}>
            <div className={styles.relatedHeader}>
              <h2 className={styles.relatedTitle}>Keep Bouncing</h2>
              <Link href="/academy" className={styles.relatedBrowseLink}>
                Browse the library →
              </Link>
            </div>
            <div className={styles.relatedGrid}>
              {related.map((w, i) => <RelatedCard key={w.id} w={w} index={i} />)}
            </div>
          </div>
        </motion.section>
      )}

      {/* ── Comments ──────────────────────────────────────────────────────────── */}
      <section className={styles.commentsSection} aria-label="Comments">
        <div className={styles.commentsInner}>
          <h2 className={styles.commentsTitle}>Leave a comment</h2>
          <p className={styles.commentsSub}>
            Did this one work for you? Tell the community how the bounce went.
          </p>
          <AnimatePresence>
            {!submitted ? (
              <motion.form
                key="form"
                className={styles.commentForm}
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={e => { e.preventDefault(); setSubmitted(true); }}
              >
                {[
                  { id: "cname", label: "Name",  type: "text",  placeholder: "Your name",      key: "name"  as const },
                  { id: "cmail", label: "Email", type: "email", placeholder: "you@email.com",   key: "email" as const },
                ].map(f => (
                  <div key={f.id}>
                    <label htmlFor={f.id} className={styles.commentLabel}>{f.label}</label>
                    <input
                      id={f.id}
                      type={f.type}
                      placeholder={f.placeholder}
                      value={commentForm[f.key]}
                      onChange={e => setCommentForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className={styles.commentInput}
                    />
                  </div>
                ))}
                <div className={styles.commentFullWidth}>
                  <label htmlFor="cmsg" className={styles.commentLabel}>Comment</label>
                  <textarea
                    id="cmsg"
                    placeholder="Share how the workout felt…"
                    value={commentForm.msg}
                    onChange={e => setCommentForm(prev => ({ ...prev, msg: e.target.value }))}
                    className={styles.commentTextarea}
                  />
                </div>
                <div className={styles.commentFullWidth}>
                  <motion.button
                    type="submit"
                    className={styles.commentSubmit}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Post comment
                  </motion.button>
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="thanks"
                className={styles.commentThanks}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <CheckCircle size={20} color="#6BA368" />
                Thanks for sharing! Your comment is awaiting moderation.
              </motion.div>
            )}
          </AnimatePresence>
          <div className={styles.commentsCount}>0 comments</div>
          <div className={styles.commentsEmpty}>No comments yet — be the first to bounce in.</div>
        </div>
      </section>

      {/* ── Risk-free banner ──────────────────────────────────────────────────── */}
      <motion.section
        className={styles.banner}
        aria-label="Risk-free guarantee"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className={styles.bannerPattern} />
        <div className={styles.bannerInner}>
          <div>
            <div className={styles.bannerEyebrow}>100% money-back guarantee</div>
            <h2 className={styles.bannerTitle}>
              Try our rebounder{" "}
              <em className={styles.bannerAccent}>risk-free</em>
            </h2>
            <p className={styles.bannerDesc}>
              Bounce on it for 30 days. If you don&apos;t absolutely love how you feel, send it back
              and we&apos;ll refund every penny — return shipping on us.
            </p>
            <div className={styles.bannerActions}>
              <motion.a
                href="https://leapsandrebounds.com/collections/mini-trampolines"
                target="_blank"
                rel="noreferrer"
                className={styles.bannerBtnPrimary}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                Shop Rebounders <ArrowRight size={16} />
              </motion.a>
              <motion.a
                href="https://leapsandrebounds.com/collections/mini-trampolines"
                target="_blank"
                rel="noreferrer"
                className={styles.bannerBtnSecondary}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                Compare Models
              </motion.a>
            </div>
          </div>
          <div className={styles.bannerSeal}>
            <motion.div
              className={styles.sealCircle}
              animate={{ rotate: [0, 2, -2, 0] }}
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
            >
              <span className={styles.sealNumber}>30</span>
              <span className={styles.sealLabel}>Day Jump Trial</span>
            </motion.div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
