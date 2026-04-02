"use client";
/**
 * AgentDetailChat — thin wrapper around ChatBox (fill mode)
 * ──────────────────────────────────────────────────────────
 * Takes 100% of its container. Parent (agent detail page) controls
 * height via: position: sticky + height: calc(100vh - 200px).
 */
import React from "react";
import ChatBox from "./ChatBox";

interface Props {
  agentId: string;
  agentName: string;
  agentEmoji?: string;
  agentColor?: string;
}

export function AgentDetailChat({ agentId, agentName, agentEmoji = "🤖", agentColor = "#22c55e" }: Props) {
  return (
    <ChatBox
      agentId={agentId}
      agentName={agentName}
      agentEmoji={agentEmoji}
      agentColor={agentColor}
      mode="fill"
      showHeader
      showHint
      showChatLink
    />
  );
}
