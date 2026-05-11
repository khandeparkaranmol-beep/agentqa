/**
 * Human-readable labels for property checkers, fault types, and topologies.
 * Shared across VerdictBanner, SwimlaneDiagram, MessagePanel, etc.
 */

export interface PropertyMeta {
  label: string;
  failedLabel: string;
  passedLabel: string;
  /** Very short label for swimlane badges (max ~12 chars) */
  badgeLabel: string;
}

export const PROPERTY_LABELS: Record<string, PropertyMeta> = {
  no_information_leak: {
    label: "Data Privacy",
    failedLabel: "Private data was exposed",
    passedLabel: "No private data leaked",
    badgeLabel: "Data Leaked",
  },
  ensures_information_flow: {
    label: "Information Sharing",
    failedLabel: "Required information wasn't shared",
    passedLabel: "Information shared correctly",
    badgeLabel: "Info Missing",
  },
  no_deadlock: {
    label: "No Deadlocks",
    failedLabel: "Agents got stuck waiting for each other",
    passedLabel: "No deadlocks detected",
    badgeLabel: "Stuck",
  },
  converges_within: {
    label: "Reached Agreement",
    failedLabel: "Agents couldn't reach agreement in time",
    passedLabel: "Agreement reached in time",
    badgeLabel: "No Agreement",
  },
  role_boundary: {
    label: "Role Compliance",
    failedLabel: "An agent acted outside its assigned role",
    passedLabel: "All agents stayed in role",
    badgeLabel: "Off Role",
  },
  no_premature_termination: {
    label: "Task Completion",
    failedLabel: "Task ended before it was actually finished",
    passedLabel: "Task completed fully",
    badgeLabel: "Ended Early",
  },
  step_repetition: {
    label: "Repetition Loop",
    failedLabel: "An agent got stuck repeating itself",
    passedLabel: "No repetitive behavior",
    badgeLabel: "Repeating",
  },
  communication_quality: {
    label: "Communication Quality",
    failedLabel: "Messages were too short or unclear",
    passedLabel: "Communication quality is good",
    badgeLabel: "Unclear Msg",
  },
  task_specification_compliance: {
    label: "Followed Instructions",
    failedLabel: "Didn't follow the task requirements",
    passedLabel: "Task requirements followed",
    badgeLabel: "Off Script",
  },
  reasoning_action_consistency: {
    label: "Consistent Reasoning",
    failedLabel: "Agent said one thing but did another",
    passedLabel: "Actions matched stated reasoning",
    badgeLabel: "Inconsistent",
  },
  stays_on_task: {
    label: "Stayed on Task",
    failedLabel: "Agent drifted off topic",
    passedLabel: "All agents stayed focused",
    badgeLabel: "Off Topic",
  },
  respects_peer_input: {
    label: "Listens to Others",
    failedLabel: "An agent ignored input from other agents",
    passedLabel: "Agents respected each other's input",
    badgeLabel: "Ignored Input",
  },
  asks_for_clarification: {
    label: "Asks When Unclear",
    failedLabel: "Agent didn't ask for help when confused",
    passedLabel: "Agent asked for clarification when needed",
    badgeLabel: "Didn't Ask",
  },
  no_conversation_reset: {
    label: "Memory Intact",
    failedLabel: "Agent lost track of the conversation",
    passedLabel: "Conversation context maintained",
    badgeLabel: "Lost Context",
  },
  state_continuity: {
    label: "State Consistency",
    failedLabel: "Agent's internal state became inconsistent",
    passedLabel: "Agent state stayed consistent",
    badgeLabel: "State Broke",
  },
  output_schema: {
    label: "Output Format",
    failedLabel: "Agent's output didn't match the expected format",
    passedLabel: "Output format is correct",
    badgeLabel: "Bad Format",
  },
};

export const FAULT_LABELS: Record<string, { label: string; badgeLabel: string }> = {
  corrupt: { label: "Message Corrupted", badgeLabel: "Corrupted" },
  latency: { label: "Delayed Message", badgeLabel: "Delayed" },
  drop: { label: "Message Dropped", badgeLabel: "Dropped" },
  timeout: { label: "Agent Timed Out", badgeLabel: "Timed Out" },
  partial: { label: "Partial Response", badgeLabel: "Partial" },
};

export const TOPOLOGY_LABELS: Record<string, string> = {
  mesh: "All agents talk to each other",
  star: "One central agent coordinates",
  chain: "Agents pass messages sequentially",
  tree: "Hierarchical delegation",
};

export function getPropertyMeta(name: string): PropertyMeta {
  return PROPERTY_LABELS[name] ?? {
    label: name.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase()),
    failedLabel: "Check failed",
    passedLabel: "Check passed",
    badgeLabel: name.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase()).slice(0, 12),
  };
}

export function getFaultLabel(type: string | undefined): { label: string; badgeLabel: string } {
  if (!type) return { label: "Injected Fault", badgeLabel: "Fault" };
  return FAULT_LABELS[type] ?? {
    label: type.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase()),
    badgeLabel: type.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase()).slice(0, 12),
  };
}

/** Shared agent color palette — single source of truth */
export const AGENT_COLORS: string[] = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899",
];

export function agentColor(agents: string[], name: string): string {
  const idx = agents.indexOf(name);
  return AGENT_COLORS[idx >= 0 ? idx % AGENT_COLORS.length : 0];
}

export function formatTitle(raw: string): string {
  return raw.replace(/^[^—–]+/, (prefix) =>
    prefix
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
