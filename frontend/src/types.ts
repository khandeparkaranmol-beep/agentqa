export type EventType = "message" | "state_change" | "fault_injected" | "property_check";

export interface TraceEvent {
  type: EventType;
  turn: number;
  agent: string | null;
  data: Record<string, unknown>;
  timestamp: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface PropertyResult {
  property_name: string;
  passed: boolean;
  details: string;
  evidence?: TraceEvent[];
  turn?: number;
}

export interface CostSummary {
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  per_agent: Record<string, { input_tokens: number; output_tokens: number; cost_usd: number; turns: number }>;
}

/** Per-property aggregate stats across multiple runs. */
export interface PropertyStats {
  passes: number;
  failures: number;
  pass_rate: number;
  ci_lower?: number;
  ci_upper?: number;
}

/** Multi-run summary embedded alongside traces. */
export interface RunSummary {
  total_runs: number;
  properties: Record<string, PropertyStats>;
  milestones?: Record<string, PropertyStats>;
}

/** One run's trace data within a multi-run set. */
export interface RunTrace {
  events: TraceEvent[];
  results: PropertyResult[];
}

export interface TraceData {
  mode: "trace" | "diff" | "dashboard";
  title: string;
  events: TraceEvent[];
  results: PropertyResult[];
  topology?: string;
  agentqa_version?: string;
  /** Optional agent metadata: { "alice": "Procurement negotiator", ... } */
  agent_roles?: Record<string, string>;
  /** Multi-run summary when this trace was part of a larger run. */
  run_summary?: RunSummary;
  /** All runs' trace data — enables run switching in the viewer. */
  all_runs?: RunTrace[];
  // diff mode
  trace_b?: TraceEvent[];
  results_b?: PropertyResult[];
  title_b?: string;
  // dashboard mode
  scenarios?: ScenarioSummary[];
}

export interface ScenarioSummary {
  name: string;
  total_runs: number;
  topology?: string;
  properties: Record<string, { passes: number; failures: number; pass_rate: number }>;
  milestones: Record<string, { passes: number; failures: number; pass_rate: number }>;
}

export interface MessageEvent {
  turn: number;
  sender: string;
  receiver: string;
  content: string;
  metadata: Record<string, unknown>;
  hasFault: boolean;
  faultType?: string;
  violatedProperties: string[];
  milestoneHits: string[];
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}
