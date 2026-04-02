"use client";
/**
 * SectionChat — thin wrapper around ChatBox (inline mode)
 * ─────────────────────────────────────────────────────────
 * Renders as a collapsible panel at the bottom of a section page.
 * Does NOT affect parent page layout — expands/collapses cleanly.
 */
import React from "react";
import ChatBox, { type ChatContextPrimer } from "./ChatBox";

interface SectionChatProps {
  sectionId: string;
  sectionName: string;
  agentId: string;
  agentName: string;
  agentEmoji?: string;
  agentColor?: string;
  metrics?: ChatContextPrimer["metrics"];
  insights?: ChatContextPrimer["insights"];
  inlineHeight?: number;
}

export default function SectionChat({
  sectionId, sectionName, agentId, agentName,
  agentEmoji = "🤖", agentColor = "#38bdf8",
  metrics = [], insights = [],
  inlineHeight = 420,
}: SectionChatProps) {
  const context: ChatContextPrimer = {
    sectionId, sectionName, metrics, insights,
  };

  return (
    <ChatBox
      agentId={agentId}
      agentName={agentName}
      agentEmoji={agentEmoji}
      agentColor={agentColor}
      mode="inline"
      inlineHeight={inlineHeight}
      context={context}
      conversationKey={sectionId}
    />
  );
}
