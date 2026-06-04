/**
 * Server component layout for /academy/workouts/[id]
 *
 * Title, description, OG, and Twitter tags are sourced verbatim from the live
 * Shopify blog posts at leapsandrebounds.com/blogs/mini-trampoline-workouts/[id].
 * Scraped 2026-06-04 — re-scrape if Shopify SEO fields are updated in admin.
 *
 * Canonical points back to the live Shopify URL (source of SEO truth).
 * robots: noindex — the dashboard is auth-gated, no crawlers should index it.
 */
import type { Metadata } from "next";

const SITE_URL = "https://leapsandrebounds.com";

/** Verbatim from Shopify blog post meta fields — do not hand-edit */
const WORKOUT_META: Record<string, {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
}> = {
  "rebounding-journey-basics-know-your-stance": {
    title: "Rebounding Journey Basics | KNOW YOUR STANCE | Leaps & Rebounds",
    description: "Start your rebounding Journey today with this quick and easy basics of rebounding beginners workout!",
    ogTitle: "Rebounding Journey Basics | KNOW YOUR STANCE",
    ogDescription: "It's super crucial to know your stance when beginning your mini trampoline fitness journey. It's also crucial to keep it in mind as your progress onwards and complete harder workouts. This stance allows you to bounce without injury and ensure you're getting the most out of your workouts 🔥 Let's master it together!!",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Screenshot_2025-07-15_11.19.11_PM_1024x1024.png?v=1758227538",
  },
  "how-to-use-a-stability-bar-on-your-mini-trampoline": {
    title: "How to Use a Stability Bar on Your Mini Trampoline | Leaps & Rebounds",
    description: "Stay active, steady, and confident with this 25-minute mini trampoline workout designed for beginners and seniors!",
    ogTitle: "How to Use a Stability Bar on Your Mini Trampoline",
    ogDescription: "This is a workout meant for beginners, seniors, or rehabilitation. Warm up with hip stretches, then move through left/rights, knee raises, side raises, hamstring curls, and knee lift extensions on the rebounder with a stability bar.",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Health_Bounce__5_0db18289-3494-4745-8d3d-e92aa74bdc86_1024x1024.jpg?v=1758227688",
  },
  "fun-and-energizing-cardio-routine": {
    title: "Fun and Energizing Cardio Routine | Leaps & Rebounds",
    description: "Warm-up Pulse: Bounce and land with side of your hips and legs rotated to one side. Jump and alternate sides. Single Shoulder Roll: As you march in place, roll your shoulders forward with each step.",
    ogTitle: "Fun and Energizing Cardio Routine",
    ogDescription: "Get ready for a fun and energizing 15-minute rebounder workout with Jump&Jacked! This quick cardio routine is designed to boost your heart rate and lift your spirits while keeping the workout enjoyable and effective. 🎯 Level: Intermediate ⏳ Length: 15 Minutes 🌀 Equipment: Rebounder",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Capture_39e8b8fd-aae3-4317-9062-b66d53d99def_1024x1024.png?v=1762981305",
  },
  "get-your-heart-pumping-with-this-20-minute-cardio-rebounder-routine": {
    title: "Get Your Heart Pumping with this 20-Minute Cardio Rebounder Routine | Leaps & Rebounds",
    description: "Get your heart pumping with this 20-minute cardio rebounder workout! Boost endurance, burn calories, and enjoy a fun, full-body trampoline routine at home.",
    ogTitle: "Get Your Heart Pumping with this 20-Minute Cardio Rebounder Routine",
    ogDescription: "Are you tired of doing the same old cardio workouts? Spice up your routine with this exhilarating 20-minute cardio rebounder workout! Rebounding is not only fun but also highly effective at strengthening your heart and lungs. It improves circulation, boosts your metabolism and lymphatic system, and torches calories.",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Screenshot_2024-01-10_2.10.21_PM_1024x1024.png?v=1760395620",
  },
  "tabata-rebounding-quick-intense-rebounder-workout": {
    title: "TABATA REBOUNDING | Quick & Intense Rebounder Workout | Leaps & Rebounds",
    description: "Workout Basic Bounce: With your hands on your hips, lift the heels of your feet off the rebounder and press the balls of your feet into the mat to begin. Keep your back straight and your core engaged.",
    ogTitle: "TABATA REBOUNDING | Quick & Intense Rebounder Workout",
    ogDescription: "This rebounding workout is a quick and intense 4 to 8 minute fat burning tabata style workout on the mini trampoline. There is a 1 minute recovery between the two 4 minute sets. You will BURN FAT ALL DAY LONG and speed up your metabolism. 2 Moves 4X through (20s of work, 10s of active recovery).",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Capture_2232e835-83f4-4eb3-82eb-f659562b7887_1024x1024.png?v=1758651289",
  },
  "6-min-everyday-rebounder-workout": {
    title: "6 Min Everyday Rebounder Workout | Leaps & Rebounds",
    description: "Try our 6-minute everyday rebounder workout! Boost cardio, flexibility, and fun with hip twists, basic bounces, and full-body trampoline moves.",
    ogTitle: "6 Min Everyday Rebounder Workout",
    ogDescription: "6-Min Everyday Rebounder Workout | Boost Lymphatic Health & Full-Body Warm-Up. Get ready to supercharge your day with this quick and effective 6-minute rebounder workout! Designed to warm up your entire body, get your blood flowing, and improve your posture, this routine is perfect for daily lymphatic health.",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Capture_11b367b5-c416-4bc4-8e92-900158c90129_1024x1024.png?v=1760526085",
  },
  "rebounder-resistance-beginners": {
    title: "Rebounder & Resistance Bands Beginner | Leaps & Rebounds",
    description: "Get your heart pumping with this 20-minute cardio rebounder workout! Boost endurance, burn calories, and enjoy a fun, full-body trampoline routine at home.",
    ogTitle: "Rebounder & Resistance Bands Beginner",
    ogDescription: "Are you ready for a total body transformation? This beginner-friendly workout combines the rebounder and resistance bands to deliver a powerful, low-impact routine that's perfect for all fitness levels. 8 minutes of alternating cardio and strength training targeting arms, legs, and posture.",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Capture_a2cda97b-d032-461d-9672-ce6d1f6c2962_1024x1024.png?v=1760395726",
  },
  "no-jumping-rebounder-workout-for-absolute-beginners": {
    title: "No Jumping Rebounder Workout for Absolute Beginners | Leaps & Rebounds",
    description: "Start your fitness journey with this no-jumping rebounder workout! Perfect for beginners, it builds balance, strength, and confidence with gentle, low-impact moves.",
    ogTitle: "No Jumping Rebounder Workout for Absolute Beginners",
    ogDescription: "Welcome to this beginner-friendly rebounder workout! 🌟 We'll cover the right footwear, how to set up your rebounder, and tips for stability. Then a 5-minute no-jumping routine with 5 different low-impact moves. Senior-friendly, safe for older adults, and perfect for anyone new to rebounder fitness.",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Capture_e273181e-357a-4762-a141-7fe1cc886355_1024x1024.png?v=1760743855",
  },
  "5-000-steps-mini-trampoline-workout": {
    title: "5,000 Steps Mini Trampoline Workout | Leaps & Rebounds",
    description: "Warm-up March: In a wide stance march in place. March W/ Breath: Continue marching in place, now taking a deep and slow breath. As you take this breath, slowly raise your arms above your head.",
    ogTitle: "5,000 Steps Mini Trampoline Workout",
    ogDescription: "Get your steps in with this fun 5,000 steps mini trampoline workout! Perfect for low-impact cardio, this session will help you achieve your step goal while providing a full-body workout. Whether you're looking for an alternative to traditional cardio or want to add some fun to your fitness routine, this workout is designed for all fitness levels.",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Capture_1521905e-b920-4ff7-b2b1-026a7a2dba8f_1024x1024.png?v=1728685354",
  },
  "rebounding-arms-medium-resistance-bands": {
    title: "Rebounding Arms & Medium Resistance Bands | Leaps & Rebounds",
    description: "Workout Items needed: Resistance band. Attach the band by looping it around the front leg of the rebounder and hold on to both ends. Lunge Triceps Pulls and more.",
    ogTitle: "Rebounding Arms & Medium Resistance Bands",
    ogDescription: "Today's video adds Resistance bands so that you can try something different to always using dumbbells. The band is attached around the leg centrally. A light to medium strength band is used. If you don't have bands, please use dumbbells as normal.",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Capture_ba8c8de9-b375-4047-97bd-1cb96d19478e_1024x1024.png?v=1743723938",
  },
  "10-minute-leaps-rebounds-mini-trampoline-rebounder-workout-130-138bpm": {
    title: "10 Minute Leaps & Rebounds Mini Trampoline Rebounder Workout 130-138bpm | Leaps & Rebounds",
    description: "This 10 minute rebounder workout will really get your heart pumping! Over 130bpm to be precise! Join us for this intense 10 minutes and get heart healthy!",
    ogTitle: "10 Minute Leaps & Rebounds Mini Trampoline Rebounder Workout 130-138bpm",
    ogDescription: "Hope you enjoy this 10 minute rebounder speed challenge workout!",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/LR_1024x1024.png?v=1757532337",
  },
  "rebounder-mini-trampoline-tabata-style-level-intermediate": {
    title: "Rebounder (Mini Trampoline) TABATA STYLE | Level: Intermediate | Leaps & Rebounds",
    description: "Try this intermediate Tabata-style rebounder workout with forward/backward jumps, full-body warm-ups, and short 10-second rests.",
    ogTitle: "Rebounder (Mini Trampoline) TABATA STYLE 🎉 | Level: Intermediate",
    ogDescription: "Hey Bouncers!! 👋🏻 Have you ever mixed Tabata and Rebounding? Give it a try today, it's seriously so much fun!!",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Screenshot_2025-07-14_10.57.18_PM_1024x1024.png?v=1760654697",
  },
  "rebounding-abdominal-core-workout-10-min": {
    title: "Rebounding Abdominal Core Workout 10 Min | Leaps & Rebounds",
    description: "Tone your abs in 10 minutes with this rebounder workout, including flutter kicks, twists, and planks for a strong, sculpted core.",
    ogTitle: "Rebounding Abdominal Core Workout 10 Min",
    ogDescription: "A quick, and fun ab workout by Naomi Joy using our 48-inch Red Rebounder.",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Capture_fd423c4c-9bbd-4e29-bcb3-c7072bce65e6_1024x1024.png?v=1760656945",
  },
  "rebounder-workout-10-min-kickboxing-style": {
    title: "REBOUNDER WORKOUT 10 MIN KICKBOXING STYLE | Leaps & Rebounds",
    description: "Try this 10-minute kickboxing-style rebounder workout! Fun, high-energy trampoline moves that boost cardio, strength, and calorie burn fast.",
    ogTitle: "REBOUNDER WORKOUT 10 MIN KICKBOXING STYLE",
    ogDescription: "Today, I am going to take you through a quick 10 minute rebounder workout — a mini trampoline workout that is kickboxing based. Turn on some music and let's get started. Renee is using our 48-inch Pink rebounder with matching Pink bungees!",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Capture_ebea04be-554f-4d11-a6ef-fd21caf619d8_1024x1024.png?v=1760303102",
  },
  "beginner-rebounding-workout-with-stability-bar": {
    title: "Beginner Rebounding Workout with Stability Bar | Leaps & Rebounds",
    description: "Beginner rebounding workout with a stability bar to boost balance, strength, and coordination. Perfect low-impact cardio for beginners to get moving safely!",
    ogTitle: "Beginner Rebounding Workout with Stability Bar",
    ogDescription: "Today's workout is full cardio using the Leaps and Rebounds rebounder and stability bar. No stability bar? No problem! Arm movements are provided for each move. Equipment needed: Rebounder, water, towel, heart rate monitor.",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Screen_Shot_2021-11-04_at_3.50.50_PM_1024x1024.png?v=1760825742",
  },
  "tiktok-dance-party-15-minute-full-body-workout": {
    title: "One Direction Dance Party 15 Minute Full Body Workout | Leaps & Rebounds",
    description: "Get moving with this 15-minute TikTok Dance Party full-body workout! Enjoy fun rebounder moves that boost energy, burn calories, and make fitness feel like dancing.",
    ogTitle: "One Direction Dance Party 15 Minute full body workout",
    ogDescription: "This rebounding workout is all about having a dance party to One Direction. Trampoline fitness is the workout for you if you're ready to find joy in movement and see results that will last a lifetime.",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Screen_Shot_2023-04-07_at_1.55.06_PM_1024x1024.png?v=1760745663",
  },
  "bounce-to-beethoven-20-minute-cardio": {
    title: "Bounce To Beethoven: 20 Minute Cardio | Leaps & Rebounds",
    description: "Get your heart pumping with this 20-minute Bounce to Beethoven cardio workout, combining warm-up bounces, step touches, and full-body moves.",
    ogTitle: "Bounce To Beethoven: 20 Minute Cardio",
    ogDescription: "20-Minute Bounce To Beethoven workout offers a time-efficient, enjoyable, and effective way to improve fitness levels and overall well-being. By embracing the art of rebounding and pairing it with the timeless compositions of Ludwig van Beethoven, this workout brings the joy of movement and music to your exercise routine.",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Capture_491ef191-b2d3-4738-bf21-09c2461fcc2a_1024x1024.png?v=1760654611",
  },
  "ultimate-rebounder-workout-on-and-off-rebounder-full-body": {
    title: "Ultimate Rebounder Workout | On and Off Rebounder | Full Body | Leaps & Rebounds",
    description: "Shape and tone your body with this ultimate rebounder workout! Combine on and off trampoline moves to build strength, improve endurance, and sculpt muscles.",
    ogTitle: "Ultimate Rebounder Workout | On and Off Rebounder | Full Body",
    ogDescription: "Ready to shape your body and enhance muscle definition? This rebound-focused workout combining on and off rebounder exercises incorporates resistance movements and bodyweight exercises that target specific muscle groups. Ignite your metabolism, build strength, and achieve a toned physique.",
    ogImage: "https://leapsandrebounds.com/cdn/shop/articles/Screenshot_2024-04-17_10.52.42_AM_1024x1024.png?v=1760745871",
  },
};

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const m = WORKOUT_META[id];
  const canonicalUrl = `${SITE_URL}/blogs/mini-trampoline-workouts/${id}`;

  if (!m) {
    return {
      title: "Workout Not Found | Leaps & Rebounds",
      description: "This workout could not be found. Browse all mini trampoline workouts in the Academy.",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: m.title,
    description: m.description,
    openGraph: {
      title: m.ogTitle,
      description: m.ogDescription,
      url: canonicalUrl,
      siteName: "Leaps and Rebounds",
      type: "article",
      images: [{ url: m.ogImage, width: 1024, height: 1024, alt: m.ogTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: m.ogTitle,
      description: m.ogDescription,
      images: [m.ogImage],
    },
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      // Dashboard is auth-gated — prevent indexing internal copies
      index: false,
      follow: false,
    },
  };
}

export default function WorkoutShowLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
