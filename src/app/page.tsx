"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "https://gravity-claw-production-fb9e.up.railway.app";

type Activity = {
  id: number;
  action: string;
  details: string;
  status: string;
  created_at: string;
};

type CostLog = {
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
};

type ShopifyData = {
  todayRevenue: string;
  orderCount: number;
  aov: string;
  topProducts: string;
  lowStock: string;
};

export default function CommandCenter() {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [totalCost, setTotalCost] = useState(0);
