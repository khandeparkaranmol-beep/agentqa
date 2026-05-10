import type { TraceEvent, MessageEvent, PropertyResult } from "./types";

declare global {
  interface Window {
    __AGENTQA_DATA__: import("./types").TraceData;
  }
}

export function getAppData() {
  if (window.__AGENTQA_DATA__) return window.__AGENTQA_DATA__;
  // Dev fallback — sample data so `npm run dev` renders something useful
  return SAMPLE_DATA;
}

export function buildMessageEvents(events: TraceEvent[], results: PropertyResult[]): MessageEvent[] {
  // Index fault events by turn+target
  const faults = new Map<string, { action: string }>();
  for (const e of events) {
    if (e.type === "fault_injected") {
      faults.set(`${e.turn}:${e.agent}`, { action: e.data.action as string });
    }
  }

  // Property violations: which turns triggered a failure
  const violationsByTurn = new Map<number, string[]>();
  for (const r of results) {
    if (!r.passed && r.turn !== undefined) {
      const existing = violationsByTurn.get(r.turn) ?? [];
      existing.push(r.property_name);
      violationsByTurn.set(r.turn, existing);
    }
  }

  // Milestone hits by turn
  const milestonesByTurn = new Map<number, string[]>();
  for (const e of events) {
    if (e.type === "property_check" && e.data.is_milestone && e.data.passed) {
      const turn = e.turn;
      const name = (e.data.property_name as string).replace("milestone:", "");
      const existing = milestonesByTurn.get(turn) ?? [];
      existing.push(name);
      milestonesByTurn.set(turn, existing);
    }
  }

  return events
    .filter((e) => e.type === "message")
    .map((e) => {
      const sender = (e.data.sender as string) ?? e.agent ?? "?";
      const faultKey = `${e.turn}:${sender}`;
      const fault = faults.get(faultKey);
      return {
        turn: e.turn,
        sender,
        receiver: (e.data.receiver as string) ?? "?",
        content: (e.data.content as string) ?? "",
        metadata: (e.data.metadata as Record<string, unknown>) ?? {},
        hasFault: !!fault,
        faultType: fault?.action,
        violatedProperties: violationsByTurn.get(e.turn) ?? [],
        milestoneHits: milestonesByTurn.get(e.turn) ?? [],
        input_tokens: e.input_tokens,
        output_tokens: e.output_tokens,
        cost_usd: e.cost_usd,
      };
    });
}

export function getAgents(events: TraceEvent[]): string[] {
  const agents = new Set<string>();
  for (const e of events) {
    if (e.type === "message") {
      const sender = e.data.sender as string;
      const receiver = e.data.receiver as string;
      if (sender) agents.add(sender);
      if (receiver && !receiver.startsWith("__")) agents.add(receiver);
    }
  }
  return Array.from(agents);
}

// ── Sample data for `npm run dev` ─────────────────────────────────────────────

const SAMPLE_DATA: import("./types").TraceData = {
  mode: "trace",
  title: "task_delegation — Run 1 (sample)",
  topology: "star",
  agentqa_version: "0.5.0",
  results: [
    { property_name: "no_information_leak", passed: true, details: "No private data leaked." },
    { property_name: "ensures_information_flow", passed: true, details: "All flows observed." },
    { property_name: "no_premature_termination", passed: false, details: "Milestone 'report_sent' not reached before done.", turn: 6 },
  ],
  events: [
    { type: "message", turn: 0, agent: "coordinator", data: { sender: "coordinator", receiver: "executor", content: "Task PROJ-101: run the analysis pipeline and produce a summary report." }, timestamp: 0, input_tokens: 120, output_tokens: 40, cost_usd: 0.001 },
    { type: "message", turn: 1, agent: "executor", data: { sender: "executor", receiver: "reviewer", content: "Acknowledged PROJ-101. Loading dataset and initialising analysis pipeline." }, timestamp: 1, input_tokens: 80, output_tokens: 35, cost_usd: 0.0008 },
    { type: "fault_injected", turn: 2, agent: "reviewer", data: { action: "corrupt", target: "reviewer" }, timestamp: 2, input_tokens: 0, output_tokens: 0, cost_usd: 0 },
    { type: "message", turn: 2, agent: "reviewer", data: { sender: "reviewer", receiver: "coordinator", content: "[CORRUPTED MESSAGE]" }, timestamp: 2, input_tokens: 0, output_tokens: 0, cost_usd: 0 },
    { type: "message", turn: 3, agent: "coordinator", data: { sender: "coordinator", receiver: "executor", content: "Please continue with PROJ-101. Reviewer had a communication issue." }, timestamp: 3, input_tokens: 90, output_tokens: 30, cost_usd: 0.0007 },
    { type: "message", turn: 4, agent: "executor", data: { sender: "executor", receiver: "reviewer", content: "Analysis complete. Findings: 3 anomalies detected. Summary report prepared for PROJ-101." }, timestamp: 4, input_tokens: 110, output_tokens: 55, cost_usd: 0.0012 },
    { type: "message", turn: 5, agent: "reviewer", data: { sender: "reviewer", receiver: "coordinator", content: "Reviewed. Findings confirmed. PROJ-101 analysis is sound." }, timestamp: 5, input_tokens: 75, output_tokens: 28, cost_usd: 0.0006 },
    { type: "message", turn: 6, agent: "coordinator", data: { sender: "coordinator", receiver: "executor", content: "Task complete. Well done." }, timestamp: 6, input_tokens: 60, output_tokens: 15, cost_usd: 0.0004 },
    { type: "property_check", turn: -1, agent: null, data: { property_name: "no_information_leak", passed: true, details: "No private data leaked.", is_milestone: false }, timestamp: 7, input_tokens: 0, output_tokens: 0, cost_usd: 0 },
    { type: "property_check", turn: 6, agent: null, data: { property_name: "no_premature_termination", passed: false, details: "Milestone 'report_sent' not reached before done.", is_milestone: false }, timestamp: 7, input_tokens: 0, output_tokens: 0, cost_usd: 0 },
  ],
};
