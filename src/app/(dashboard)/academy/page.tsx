"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Play, Lock, Star, ChevronRight } from "lucide-react";

// ── Brand tokens (mirrors CSS .lr-brand vars) ──────────────────────────────
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
  berry:      "#C04A4A",
} as const;

const FONT_DISPLAY = "'Montserrat', 'Helvetica Neue', Arial, sans-serif";
const FONT_BODY    = "system-ui, Arial, sans-serif";

// ── Palette map for thumbnail backgrounds ──────────────────────────────────
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

// ── Real workout data (from leapsandrebounds.com blog) ─────────────────────
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
interface IntroVideo { id: string; title: string; desc: string; minutes: number; palette: string; }

const WORKOUTS: Workout[] = [
  { id:"know-stance",    title:"Know Your Stance",            duration:10, level:"Beginner",     tier:"free", goal:"fundamentals", inst:"Bounce N' Burn",          palette:"cream",  desc:"The foundational stance that makes every bounce safer and more effective." },
  { id:"stability-bar",  title:"How to Use a Stability Bar",  duration:25, level:"Beginner",     tier:"free", goal:"fundamentals", inst:"Leaps & Rebounds",        palette:"sage",   desc:"The official L&R primer. Perfect for first-timers and seniors." },
  { id:"fun-cardio",     title:"Fun & Energizing Cardio",     duration:15, level:"Intermediate", tier:"free", goal:"cardio",       inst:"Jump&Jacked",             palette:"peach",  desc:"Upbeat 15 minutes that lifts your spirits while it lifts your heart rate." },
  { id:"20-min-cardio",  title:"Cardio Rebounder Routine",    duration:20, level:"Intermediate", tier:"free", goal:"cardio",       inst:"Kate's Home Fitness",     palette:"peach",  desc:"A heart-pumping routine that proves rebounding beats the treadmill." },
  { id:"tabata-quick",   title:"Tabata Rebounding",           duration:10, level:"Intermediate", tier:"free", goal:"hiit",         inst:"Renee Lynne",             palette:"rust",   desc:"Eight rounds of 20-on, 10-off. Fire up your metabolism in under ten." },
  { id:"6-min-lymph",    title:"6-Min Everyday Lymph Flow",   duration:6,  level:"All levels",   tier:"free", goal:"lymph",        inst:"Lindsay · Pilates On Demand", palette:"sky", desc:"Six minutes, six moves, full-body lymphatic flow. Daily-able." },
  { id:"beginner-bands", title:"Bands for Beginners",         duration:10, level:"Beginner",     tier:"free", goal:"fundamentals", inst:"Lindsay · Pilates On Demand", palette:"mist", desc:"Gentle intro to combining resistance bands with bouncing." },
  { id:"no-jump",        title:"No-Jumping for Beginners",    duration:10, level:"Beginner",     tier:"free", goal:"seniors",      inst:"Lindsay · Pilates On Demand", palette:"butter", desc:"Senior-friendly bouncing — no jumps, all benefits." },
  { id:"5k-steps",       title:"5,000 Steps Workout",         duration:40, level:"All levels",   tier:"pro",  goal:"cardio",       inst:"Jump&Jacked",             palette:"butter", desc:"Hit your daily step goal without leaving the rebounder." },
  { id:"arms-bands",     title:"Rebounding Arms + Bands",     duration:21, level:"Intermediate", tier:"pro",  goal:"strength",     inst:"SanFran Fitness",         palette:"mist",   desc:"Trade dumbbells for bands and sculpt arms while you bounce." },
  { id:"130bpm",         title:"130–138 BPM Cardio",          duration:10, level:"Intermediate", tier:"pro",  goal:"cardio",       inst:"Earth & Owl",             palette:"peach",  desc:"A music-matched bounce session at exactly the BPM your heart loves." },
  { id:"tabata-int",     title:"Tabata Style · Intermediate", duration:30, level:"Intermediate", tier:"pro",  goal:"hiit",         inst:"Bounce N' Burn",          palette:"rust",   desc:"Tabata format on the trampoline. Sweat seriously, recover gently." },
  { id:"core-10",        title:"Abdominal Core Workout",      duration:10, level:"All levels",   tier:"pro",  goal:"strength",     inst:"Naomi Joy Fitness",       palette:"sand",   desc:"Standing core work that feels nothing like a sit-up." },
  { id:"kickbox",        title:"Kickboxing-Style Rebounder",  duration:10, level:"Intermediate", tier:"pro",  goal:"cardio",       inst:"Renee Lynne",             palette:"rust",   desc:"Channel your inner fighter — jabs, crosses, and bounces." },
  { id:"balance-fit",    title:"15 Min to Fit · Balance",     duration:15, level:"Beginner",     tier:"pro",  goal:"balance",      inst:"AngieFitnessTV",          palette:"cream",  desc:"Cardio plus balance work. Builds confidence on the mat." },
  { id:"dance-party",    title:"Pop Dance Party",             duration:15, level:"All levels",   tier:"pro",  goal:"cardio",       inst:"Jump&Jacked",             palette:"rose",   desc:"Choreographed bounce to today's biggest pop hits." },
  { id:"beethoven",      title:"Bounce to Beethoven",         duration:20, level:"Intermediate", tier:"pro",  goal:"cardio",       inst:"Kate's Home Fitness",     palette:"sand",   desc:"Classical music meets rebounding. Surprisingly motivating." },
  { id:"intervals-50",   title:"50-Min Intervals",            duration:50, level:"Advanced",     tier:"pro",  goal:"hiit",         inst:"Michelle Briehler",       palette:"rust",   desc:"On-and-off the trampoline with weights. Earns its name." },
];

const PROGRAMS: Program[] = [
  { id:"p1", title:"Beginner Bounce", weeks:4, sessions:16, level:"Beginner",     tier:"free", desc:"Your first month. Build the habit, build the technique.",                    inst:"Bounce N' Burn",          palette:"peach"  },
  { id:"p2", title:"Stronger Joints", weeks:6, sessions:18, level:"All levels",   tier:"pro",  desc:"A PT-informed plan to take pressure off knees, hips, and ankles.",           inst:"Lindsay · Pilates On Demand", palette:"rose" },
  { id:"p3", title:"Active 60+",      weeks:8, sessions:24, level:"Beginner",     tier:"pro",  desc:"Steady, joyful sessions designed with older adults in mind.",                inst:"Laura London",             palette:"butter" },
  { id:"p4", title:"Lean & Bright",   weeks:6, sessions:24, level:"Intermediate", tier:"pro",  desc:"Calorie-burning bounce plus mobility, four times a week.",                   inst:"Renee Lynne",             palette:"rust"   },
];

const INTRO_VIDEOS: IntroVideo[] = [
  { id:"v1", title:"Assemble your Rebounder", desc:"Box to ready-to-bounce in seven minutes.", minutes:7,  palette:"sage"   },
  { id:"v2", title:"About our Warranty",      desc:"What's covered for life, what isn't.",     minutes:3,  palette:"cream"  },
  { id:"v3", title:"Attaching your Bungees",  desc:"Follow along step by step.",               minutes:4,  palette:"peach"  },
  { id:"v4", title:"Using the Stability Bar", desc:"Attach, adjust, and bounce with confidence.", minutes:5, palette:"butter"},
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

// ── Tiny shared components ─────────────────────────────────────────────────

function Thumb({ palette, ratio = "4/3" }: { palette: string; ratio?: string }) {
  const p = PALETTES[palette] ?? PALETTES.peach;
  return (
    <div style={{ background: p.bg, aspectRatio: ratio, position: "relative", overflow: "hidden" }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}>
        <path d="M10 70 Q30 40 50 70" stroke={p.accent} strokeOpacity="0.25" strokeWidth="0.8" strokeDasharray="2 2" fill="none"/>
        <path d="M50 70 Q70 40 90 70" stroke={p.accent} strokeOpacity="0.25" strokeWidth="0.8" strokeDasharray="2 2" fill="none"/>
        <ellipse cx="50" cy="83" rx="24" ry="5" fill={p.accent} opacity="0.35"/>
        {/* simple figure silhouette */}
        <circle cx="50" cy="30" r="7" fill={C.charcoal} opacity="0.7"/>
        <rect x="46" y="37" width="8" height="20" rx="3" fill={C.charcoal} opacity="0.7"/>
        <rect x="38" y="40" width="6" height="14" rx="3" fill={C.charcoal} opacity="0.7" transform="rotate(-15 41 47)"/>
        <rect x="56" y="40" width="6" height="14" rx="3" fill={C.charcoal} opacity="0.7" transform="rotate(15 59 47)"/>
        <rect x="43" y="55" width="6" height="14" rx="3" fill={C.charcoal} opacity="0.7"/>
        <rect x="51" y="55" width="6" height="14" rx="3" fill={C.charcoal} opacity="0.7"/>
      </svg>
    </div>
  );
}

function TierBadge({ tier }: { tier: Tier }) {
  return tier === "free"
    ? <span style={{ background: C.orange, color:"#fff", fontSize:9, fontWeight:900, letterSpacing:"0.14em", padding:"3px 8px", borderRadius:999, textTransform:"uppercase" }}>FREE</span>
    : <span style={{ background: C.charcoal, color:"#fff", fontSize:9, fontWeight:900, letterSpacing:"0.14em", padding:"3px 8px", borderRadius:999, textTransform:"uppercase" }}>PRO</span>;
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AcademyPage() {
  const [activeGoal, setActiveGoal] = useState<Goal | "all">("all");
  const [activeDur,  setActiveDur]  = useState<string>("any");
  const memberTier: Tier = "free"; // TODO: wire to session/API

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

  return (
    <div className="lr-brand" style={{ background: C.cream, minHeight: "100vh", color: C.charcoal, fontFamily: FONT_BODY }}>

      {/* ── Page header ── */}
      <PageHeader freeCount={freeCount} proCount={proCount} />

      {/* ── Intro & Assembly ── */}
      <IntroSection />

      {/* ── Programs Rail ── */}
      <ProgramsSection programs={PROGRAMS} memberTier={memberTier} />

      {/* ── Workout Library ── */}
      <LibrarySection
        workouts={filtered}
        allCount={WORKOUTS.length}
        activeGoal={activeGoal}
        activeDur={activeDur}
        memberTier={memberTier}
        onGoal={setActiveGoal}
        onDur={setActiveDur}
      />

      {/* ── Pro upgrade strip ── */}
      {memberTier === "free" && <ProStrip />}

      {/* ── Quick actions ── */}
      <QuickActions />

    </div>
  );
}

// ── Section: Page Header ───────────────────────────────────────────────────

function PageHeader({ freeCount, proCount }: { freeCount: number; proCount: number }) {
  const stats = [
    { label: "Total Workouts", value: String(WORKOUTS.length) },
    { label: "Free",           value: String(freeCount)      },
    { label: "Pro",            value: String(proCount)       },
    { label: "Programs",       value: String(PROGRAMS.length) },
    { label: "Instructors",    value: "12"                   },
  ];
  return (
    <div style={{ background: C.orangeWash, borderBottom: `1px solid ${C.line}`, padding: "40px 40px 32px" }}>
      {/* Eyebrow */}
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight:700, fontSize:12, letterSpacing:"0.18em", textTransform:"uppercase", color: C.orangeDeep, marginBottom:10 }}>
        L&R · Bounce Club Dashboard
      </div>
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:24, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:52, height:52, borderRadius:14, background: C.orange, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 8px 24px rgba(252,162,72,0.35)` }}>
            <GraduationCap size={26} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight:900, fontSize:32, letterSpacing:"-0.01em", textTransform:"uppercase", margin:0, color: C.charcoal, lineHeight:1 }}>
              The Academy
            </h1>
            <p style={{ fontSize:14, color: C.slate, margin:"4px 0 0", fontFamily: FONT_BODY }}>
              Workout library · Programs · Intro videos
            </p>
          </div>
        </div>
        <a href="https://leapsandrebounds.com/pages/academy" target="_blank" rel="noreferrer"
          style={{ display:"inline-flex", alignItems:"center", gap:6, fontFamily: FONT_DISPLAY, fontWeight:800, fontSize:12, letterSpacing:"0.1em", textTransform:"uppercase", color: C.charcoal, borderBottom:`2px solid ${C.orange}`, paddingBottom:3, textDecoration:"none" }}>
          View live page <ChevronRight size={12} />
        </a>
      </div>
      {/* KPI strip */}
      <div style={{ display:"flex", gap:16, marginTop:28, flexWrap:"wrap" }}>
        {stats.map(s => (
          <motion.div key={s.label}
            initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            style={{ background: C.paper, border:`1px solid ${C.line}`, borderRadius:12, padding:"14px 20px", minWidth:100, boxShadow:"0 2px 8px rgba(43,43,43,0.06)" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight:900, fontSize:28, letterSpacing:"-0.02em", color: C.charcoal, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight:700, fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color: C.slate, marginTop:4 }}>{s.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Intro & Assembly ──────────────────────────────────────────────

function IntroSection() {
  return (
    <div style={{ padding:"48px 40px 40px", background: C.paper, borderBottom:`1px solid ${C.line}` }}>
      <SectionHeader eyebrow="Brand new? Start here" title="Introduction & Assembly" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:18, marginTop:28 }}>
        {INTRO_VIDEOS.map((v, i) => (
          <motion.div key={v.id}
            initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.06 }}
            whileHover={{ y:-3, boxShadow:"0 12px 32px rgba(43,43,43,0.12)" }}
            style={{ background: C.paper, border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden", cursor:"pointer", boxShadow:"0 2px 8px rgba(43,43,43,0.06)" }}>
            <div style={{ position:"relative" }}>
              <Thumb palette={v.palette} ratio="16/9" />
              <button aria-label={`Play ${v.title}`} style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", width:44, height:44, borderRadius:"50%", background: C.orange, border:"3px solid #fff", display:"inline-flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 4px 14px rgba(252,162,72,0.45)" }}>
                <Play size={14} fill="#fff" color="#fff" />
              </button>
              <span style={{ position:"absolute", top:10, right:10, background:"rgba(43,43,43,0.82)", color:"#fff", fontSize:10, fontWeight:800, letterSpacing:"0.1em", padding:"3px 8px", borderRadius:99 }}>{v.minutes} MIN</span>
            </div>
            <div style={{ padding:"14px 16px 18px" }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight:800, fontSize:14, letterSpacing:"0.005em", textTransform:"uppercase", color: C.charcoal, lineHeight:1.2 }}>{v.title}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize:12, color: C.graphite, marginTop:6, lineHeight:1.45 }}>{v.desc}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Programs ──────────────────────────────────────────────────────

function ProgramsSection({ programs, memberTier }: { programs: Program[]; memberTier: Tier }) {
  return (
    <div style={{ padding:"48px 40px 40px", background: C.cream, borderBottom:`1px solid ${C.line}` }}>
      <SectionHeader eyebrow="Multi-week programs" title="Build a habit" sub="Pick a journey and follow it for a few weeks. Same time, same trainer, real progress." cta="All programs →" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:20, marginTop:32 }}>
        {programs.map((p, i) => {
          const locked = p.tier === "pro" && memberTier === "free";
          return (
            <motion.div key={p.id}
              initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.07 }}
              whileHover={{ y:-3, boxShadow:"0 12px 32px rgba(43,43,43,0.12)" }}
              style={{ background: C.paper, border:`1px solid ${C.line}`, borderRadius:14, overflow:"hidden", display:"flex", flexDirection:"column", cursor:"pointer", boxShadow:"0 2px 8px rgba(43,43,43,0.06)" }}>
              <div style={{ position:"relative" }}>
                <Thumb palette={p.palette} ratio="3/4" />
                <div style={{ position:"absolute", top:12, left:12 }}><TierBadge tier={p.tier} /></div>
                <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(to top, rgba(43,43,43,0.7), transparent)", color:"#fff", padding:"32px 14px 12px", fontFamily: FONT_DISPLAY, fontWeight:700, fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase" }}>
                  {p.weeks} weeks · {p.sessions} sessions
                </div>
                {locked && (
                  <div style={{ position:"absolute", inset:0, background:"rgba(43,43,43,0.28)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ width:42, height:42, borderRadius:"50%", background:"rgba(255,255,255,0.95)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <Lock size={18} color={C.charcoal} />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding:"16px 18px 20px", display:"flex", flexDirection:"column", flex:1 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight:800, fontSize:16, letterSpacing:"0.005em", textTransform:"uppercase", color: C.charcoal }}>{p.title}</div>
                <div style={{ fontFamily: FONT_BODY, fontSize:12, color: C.graphite, marginTop:8, lineHeight:1.5, flex:1 }}>{p.desc}</div>
                <div style={{ marginTop:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontFamily: FONT_BODY, fontSize:11, color: C.slate }}>{p.inst}</span>
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight:800, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color: C.orangeDeep }}>{locked ? "Unlock" : "Start →"}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section: Workout Library ───────────────────────────────────────────────

interface LibraryProps {
  workouts: Workout[]; allCount: number;
  activeGoal: Goal|"all"; activeDur: string;
  memberTier: Tier;
  onGoal: (g: Goal|"all") => void;
  onDur:  (d: string) => void;
}

function LibrarySection({ workouts, allCount, activeGoal, activeDur, memberTier, onGoal, onDur }: LibraryProps) {
  const durations = [
    { key:"any", label:"Any" },
    { key:"0-10",  label:"≤10 min" },
    { key:"10-20", label:"10–20"   },
    { key:"20-30", label:"20–30"   },
    { key:"30+",   label:"30+"     },
  ];

  return (
    <div style={{ padding:"48px 40px 64px", background: C.paper }}>
      {/* Header */}
      <SectionHeader eyebrow="Or pick by what you need" title="Browse the library" />

      {/* Goal filter chips */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginTop:24 }}>
        <FilterChip label="All" count={allCount} active={activeGoal === "all"} onClick={() => onGoal("all")} />
        {GOALS.map(g => (
          <FilterChip key={g.id} label={g.label} count={WORKOUTS.filter(w => w.goal === g.id).length} active={activeGoal === g.id} onClick={() => onGoal(g.id)} />
        ))}
      </div>

      {/* Duration filter */}
      <div style={{ display:"flex", alignItems:"center", gap:20, marginTop:18, fontFamily: FONT_DISPLAY, fontSize:12, color: C.slate }}>
        <span style={{ fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>Duration:</span>
        {durations.map(d => (
          <button key={d.key} onClick={() => onDur(d.key)} style={{ background:"none", border:"none", cursor:"pointer", fontFamily: FONT_DISPLAY, fontWeight:700, fontSize:12, letterSpacing:"0.08em", textTransform:"uppercase", color: activeDur === d.key ? C.charcoal : C.slate, borderBottom: activeDur === d.key ? `2px solid ${C.orange}` : "2px solid transparent", paddingBottom:3, transition:"all 0.15s" }}>
            {d.label}
          </button>
        ))}
        <span style={{ marginLeft:"auto", color: C.graphite }}>
          Showing <strong style={{ color: C.charcoal }}>{workouts.length}</strong> workouts
        </span>
      </div>

      {/* Grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24, marginTop:28 }}>
        {workouts.map((w, i) => (
          <WorkoutCard key={w.id} w={w} i={i} memberTier={memberTier} />
        ))}
      </div>
    </div>
  );
}

function WorkoutCard({ w, i, memberTier }: { w: Workout; i: number; memberTier: Tier }) {
  const locked = w.tier === "pro" && memberTier === "free";
  return (
    <motion.div
      initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.04 }}
      whileHover={{ y:-3, boxShadow:"0 14px 36px rgba(43,43,43,0.12)" }}
      style={{ background: C.paper, border:`1px solid ${C.line}`, borderRadius:14, overflow:"hidden", display:"flex", flexDirection:"column", cursor:"pointer", boxShadow:"0 2px 8px rgba(43,43,43,0.06)" }}>
      <div style={{ position:"relative" }}>
        <Thumb palette={w.palette} ratio="4/3" />
        <div style={{ position:"absolute", top:12, left:12 }}><TierBadge tier={w.tier} /></div>
        <div style={{ position:"absolute", top:12, right:12, background:"rgba(43,43,43,0.82)", color:"#fff", fontSize:10, fontWeight:800, letterSpacing:"0.08em", padding:"4px 10px", borderRadius:99 }}>{w.duration} MIN</div>
        {locked && (
          <div style={{ position:"absolute", inset:0, background:"rgba(43,43,43,0.32)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:48, height:48, borderRadius:"50%", background:"rgba(255,255,255,0.95)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px rgba(0,0,0,0.25)" }}>
              <Lock size={20} color={C.charcoal} />
            </div>
          </div>
        )}
      </div>
      <div style={{ padding:"16px 18px 20px" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight:700, fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase", color: C.orangeDeep }}>{w.level} · {w.goal.replace("-"," ")}</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight:800, fontSize:17, letterSpacing:"0.005em", textTransform:"uppercase", color: C.charcoal, marginTop:6 }}>{w.title}</div>
        <div style={{ fontFamily: FONT_BODY, fontSize:12, color: C.graphite, marginTop:8, lineHeight:1.45 }}>{w.desc}</div>
        <div style={{ marginTop:12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontFamily: FONT_BODY, fontSize:11, color: C.slate }}>{w.inst}</span>
          <span style={{ display:"inline-flex", gap:1, color: C.orange }}>
            {[0,1,2,3,4].map(k => <Star key={k} size={10} fill={C.orange} color={C.orange} />)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Section: Pro Upgrade Strip ─────────────────────────────────────────────

function ProStrip() {
  const bullets = ["30+ on-demand workouts","4 multi-week programs","Live monthly sessions","Joint care & active aging","Lymphatic flow library","New every Tuesday"];
  return (
    <div style={{ padding:"0 40px 80px", background: C.paper }}>
      <div style={{ background: C.charcoal, borderRadius:24, padding:"56px 56px", display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:56, alignItems:"center", position:"relative", overflow:"hidden" }}>
        {/* Decorative bounce SVG */}
        <svg style={{ position:"absolute", right:-60, bottom:-60, width:320, height:320, opacity:0.14 }} viewBox="0 0 100 100">
          <path d="M10 60 Q30 20 50 60" stroke="#FCA248" strokeWidth="1.5" strokeDasharray="2 3" fill="none"/>
          <path d="M50 60 Q70 20 90 60" stroke="#FCA248" strokeWidth="1.5" strokeDasharray="2 3" fill="none"/>
          <circle cx="90" cy="60" r="3.5" fill="#FCA248"/>
        </svg>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight:700, fontSize:12, letterSpacing:"0.16em", textTransform:"uppercase", color: C.orange }}>Academy Pro</div>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight:900, fontSize:48, lineHeight:1.0, letterSpacing:"-0.01em", textTransform:"uppercase", margin:"14px 0 18px", color:"#fff" }}>
            $9.99 / month.<br/><span style={{ color: C.orange }}>30+</span> workouts. 1 jump trial.
          </h2>
          <p style={{ fontFamily: FONT_BODY, fontSize:16, color:"#E6E2DA", maxWidth:460, margin:0 }}>
            Unlock every program, every level, every instructor. New classes weekly. Cancel anytime — keep what you've learned.
          </p>
          <div style={{ display:"flex", gap:14, marginTop:28 }}>
            <button style={{ background: C.orange, color:"#fff", border:"none", padding:"16px 28px", borderRadius:999, fontFamily: FONT_DISPLAY, fontWeight:800, fontSize:13, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", boxShadow:"0 8px 24px rgba(252,162,72,0.4)" }}>
              Start 14-day free trial →
            </button>
            <button style={{ background:"transparent", color:"#fff", border:"1.5px solid rgba(255,255,255,0.35)", padding:"16px 28px", borderRadius:999, fontFamily: FONT_DISPLAY, fontWeight:800, fontSize:13, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>
              $79.99 / year — save 33%
            </button>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          {bullets.map(b => (
            <div key={b} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
              <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:22, height:22, borderRadius:"50%", background: C.orange, flexShrink:0, marginTop:1 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span style={{ fontFamily: FONT_BODY, fontSize:13, color:"#fff", lineHeight:1.4 }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title, sub, cta }: { eyebrow: string; title: string; sub?: string; cta?: string }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:32 }}>
      <div style={{ maxWidth:640 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight:700, fontSize:12, letterSpacing:"0.18em", textTransform:"uppercase", color: C.orangeDeep, marginBottom:10 }}>{eyebrow}</div>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight:900, fontSize:36, lineHeight:0.98, letterSpacing:"-0.01em", textTransform:"uppercase", margin:0, color: C.charcoal }}>{title}</h2>
        {sub && <p style={{ fontFamily: FONT_BODY, fontSize:15, color: C.graphite, marginTop:12, marginBottom:0 }}>{sub}</p>}
      </div>
      {cta && (
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight:800, fontSize:12, letterSpacing:"0.1em", textTransform:"uppercase", color: C.charcoal, cursor:"pointer", borderBottom:`2px solid ${C.orange}`, paddingBottom:4, whiteSpace:"nowrap" }}>{cta}</span>
      )}
    </div>
  );
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"10px 18px", borderRadius:999, background: active ? C.charcoal : C.paper, color: active ? "#fff" : C.charcoal, border:`1px solid ${active ? C.charcoal : C.line}`, fontFamily: FONT_DISPLAY, fontWeight:700, fontSize:12, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", transition:"all 0.15s" }}>
      {label}
      <span style={{ fontSize:10, opacity:0.65 }}>{count}</span>
    </motion.button>
  );
}

// ── Section: Quick Actions ─────────────────────────────────────────────────

const QUICK_LINKS = [
  { href:"/website/snippets", label:"Section Builder",        sub:"Generate Shopify snippets",    color:"#a78bfa" },
  { href:"/website/sections", label:"Personalization",        sub:"UCB1 section ranking",          color:"#38bdf8" },
  { href:"/content",          label:"Content Hub",            sub:"Videos, assets & copy",         color:"#f59e0b" },
  { href:"https://leapsandrebounds.com/pages/academy", label:"Live Academy", sub:"View on leapsandrebounds.com", color:"#FCA248", external:true },
] as const;

function QuickActions() {
  return (
    <div style={{ background: C.cream, borderTop:`1px solid ${C.line}`, padding:"48px 40px 56px" }}>
      <SectionHeader eyebrow="Ops tools" title="Quick actions" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginTop:28 }}>
        {QUICK_LINKS.map((l, i) => (
          <motion.a
            key={l.href} href={l.href}
            target={"external" in l && l.external ? "_blank" : undefined}
            rel={"external" in l && l.external ? "noreferrer" : undefined}
            initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.06 }}
            whileHover={{ y:-3, boxShadow:`0 12px 32px rgba(43,43,43,0.10)` }}
            style={{ background: C.paper, border:`1.5px solid ${C.line}`, borderRadius:14, padding:"20px 22px", textDecoration:"none", display:"flex", flexDirection:"column", gap:8, cursor:"pointer", boxShadow:"0 2px 8px rgba(43,43,43,0.05)", position:"relative", overflow:"hidden" }}>
            {/* accent top line */}
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:l.color, borderRadius:"14px 14px 0 0" }} />
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight:800, fontSize:14, letterSpacing:"0.005em", textTransform:"uppercase", color: C.charcoal, marginTop:4 }}>{l.label}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize:12, color: C.slate }}>{l.sub}</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight:800, fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:l.color, marginTop:4 }}>Open →</div>
          </motion.a>
        ))}
      </div>
    </div>
  );
}

