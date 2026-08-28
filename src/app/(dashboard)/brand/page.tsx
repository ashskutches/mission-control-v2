"use client";
import React from "react";
import { AgentBrandGuide } from "@/components/AgentBrandGuide";
import { BusinessContextEditor } from "@/components/BusinessContextEditor";
import FacebookPageMonitor from "@/components/FacebookPageMonitor";
import SectionOwner from "@/components/SectionOwner";

export default function BrandPage() {
  return (
    <div className="px-4 pb-6 pt-4">
      <h3 className="title is-size-4 has-text-weight-black is-uppercase mb-1">Brand Guide</h3>
      <p
        className="subtitle is-size-7 has-text-grey-light is-uppercase has-text-weight-bold mb-5"
        style={{ letterSpacing: "0.08em" }}
      >
        Business context, voice, and brand identity
      </p>

      {/* Whose department this is. Brand has no SectionAgentPanel, so the owner
          strip is mounted directly. */}
      <SectionOwner sectionId="brand" sectionName="Brand" accentColor="#e98d20" />

      {/* The paste-ready guide — what people actually come here to copy */}
      <AgentBrandGuide />

      {/* Business context & brand voice */}
      <BusinessContextEditor />

      {/* Facebook Page engagement monitor */}
      <div
        className="box mt-6"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(244,114,182,0.15)",
          borderRadius: 12,
        }}
      >
        <FacebookPageMonitor />
      </div>
    </div>
  );
}
