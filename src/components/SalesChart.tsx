"use client";
import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, DollarSign } from "lucide-react";

interface SalesDay {
    date: string;
    revenue: number;
    orders: number;
}

interface SalesChartProps {
    data: SalesDay[];
    total30d: number;
}

export const SalesChart = ({ data, total30d }: SalesChartProps) => {
    if (!data || data.length === 0) {
        return (
            <div className="glass-card" style={{ gridColumn: "1 / -1", padding: "40px", textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)" }}>No sales data available yet. Data will populate after Shopify syncs.</p>
            </div>
        );
    }

    const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
    const chartWidth = 900;
    const chartHeight = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const innerW = chartWidth - padding.left - padding.right;
    const innerH = chartHeight - padding.top - padding.bottom;

    // Generate SVG path for the area chart
    const points = data.map((d, i) => ({
        x: padding.left + (i / Math.max(data.length - 1, 1)) * innerW,
        y: padding.top + innerH - (d.revenue / maxRevenue) * innerH,
    }));

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerH} L ${points[0].x} ${padding.top + innerH} Z`;

    // Y-axis labels
    const yLabels = [0, Math.round(maxRevenue / 2), Math.round(maxRevenue)];

    // X-axis labels (show every 5th day)
    const xLabels = data
        .filter((_, i) => i % 5 === 0 || i === data.length - 1)
        .map((d, _, arr) => {
            const idx = data.indexOf(d);
            return {
                label: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                x: padding.left + (idx / Math.max(data.length - 1, 1)) * innerW,
            };
        });

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card"
            style={{ gridColumn: "1 / -1" }}
        >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <div>
                    <h3 style={{ fontSize: "18px", fontWeight: 700 }}>30-Day Revenue</h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>Daily sales performance</p>
                </div>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    borderRadius: "12px",
                    background: "rgba(0, 255, 148, 0.08)",
                    border: "1px solid rgba(0, 255, 148, 0.15)",
                }}>
                    <DollarSign size={16} color="var(--accent-emerald)" />
                    <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent-emerald)" }}>
                        {total30d.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase" }}>30d total</span>
                </div>
            </div>

            {/* Chart */}
            <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                style={{ width: "100%", height: "auto" }}
                preserveAspectRatio="xMidYMid meet"
            >
                {/* Gradient */}
                <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-emerald)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="var(--accent-emerald)" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--accent-cyan)" />
                        <stop offset="100%" stopColor="var(--accent-emerald)" />
                    </linearGradient>
                </defs>

                {/* Grid lines */}
                {yLabels.map((val, i) => {
                    const y = padding.top + innerH - (val / maxRevenue) * innerH;
                    return (
                        <g key={i}>
                            <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y}
                                stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />
                            <text x={padding.left - 8} y={y + 4} textAnchor="end"
                                fill="rgba(255,255,255,0.3)" fontSize="10" fontFamily="JetBrains Mono, monospace">
                                ${val}
                            </text>
                        </g>
                    );
                })}

                {/* X-axis labels */}
                {xLabels.map((l, i) => (
                    <text key={i} x={l.x} y={chartHeight - 5} textAnchor="middle"
                        fill="rgba(255,255,255,0.3)" fontSize="10" fontFamily="JetBrains Mono, monospace">
                        {l.label}
                    </text>
                ))}

                {/* Area fill */}
                <motion.path
                    d={areaPath}
                    fill="url(#salesGradient)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1 }}
                />

                {/* Line */}
                <motion.path
                    d={linePath}
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                />

                {/* Data points */}
                {points.map((p, i) => (
                    <motion.circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r="3"
                        fill="var(--bg-deep)"
                        stroke="var(--accent-emerald)"
                        strokeWidth="1.5"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.05 * i, duration: 0.3 }}
                    >
                        <title>{`${data[i].date}: $${data[i].revenue.toFixed(2)} (${data[i].orders} orders)`}</title>
                    </motion.circle>
                ))}
            </svg>
        </motion.div>
    );
};
