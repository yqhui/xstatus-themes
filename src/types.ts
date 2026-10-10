export interface Site {
  site_name: string; theme_default: string; public_site_enabled: string;
  public_modules: string; has_public_services: boolean; authed: boolean;
}
export interface Sample { ts: number; latency: number | null; loss: number | null }
export interface Target { id: string; name: string; latency_ms: number | null; loss_pct: number | null; hours?: Sample[] }
export interface Node {
  id: string; name: string; stack_label: string; platform: string; platform_version: string;
  online: boolean; location_cc: string;
  cpu: { usage: number; cores: number; model: string; load: number[]; temp: number | null };
  mem: { used: number; total: number; available: number; swap_used: number; swap_total: number };
  disk: { used: number; total: number; available: number };
  net: { in_rate: number; out_rate: number; in_total: number; out_total: number };
  traffic: { used: number; cap: number | null; ratio: number; next_reset_at: number };
  latency_ms: number | null; loss_pct: number | null; quality?: Sample[]; targets?: Target[];
  expiry_label: string; expiry_days: number | null; online_days: number; systemd_failed: number;
}
export interface QualityRow { node_id: string; node: string; target_id: string; target: string; latency: number | null; loss: number | null; ts: number }
export interface Point { t: number; lat: number | null; loss: number | null }
export interface Series { node_id: string; target_id: string; points: Point[]; window_start: number; window_end: number; step: number }
export interface MetricPoint { t: number; cpu?: number; mem_used?: number; load1?: number; load5?: number; load15?: number; net_in?: number; net_out?: number }
export type ServiceState = "normal" | "partial" | "down" | "unknown";
export interface Service {
  kind: string; id: string; name: string; desc: string; state: ServiceState;
  running_since: number; state_since: number; uptime_pct: number | null; latency_ms: number | null;
  days: { d: number; s: ServiceState; p: number | null }[];
}
