"use client";
import React from "react";

export default function IdeasPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 12, opacity: 0.5 }}>
      <span style={{ fontSize: 56 }}>💡</span>
      <p className="has-text-grey has-text-weight-bold is-uppercase" style={{ fontSize: 13, letterSpacing: "0.1em" }}>Ideas — Coming Soon</p>
      <p className="has-text-grey" style={{ fontSize: 12 }}>Agent-generated ideation pipeline — in development.</p>
    </div>
  );
}
