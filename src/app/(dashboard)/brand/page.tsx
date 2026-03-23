"use client";
import React from "react";
import { BusinessContextEditor } from "@/components/BusinessContextEditor";

export default function BrandPage() {
  return (
    <div className="px-4 pb-6 pt-4">
      <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Brand Guide</h3>
      <p className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold mb-5" style={{ letterSpacing: "0.08em" }}>
        Business context, voice, and brand identity
      </p>
      <BusinessContextEditor />
    </div>
  );
}
