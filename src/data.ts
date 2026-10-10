import type { Node, QualityRow, Site, Target } from "./types";
export async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", signal });
  if (!response.ok) throw new Error(`请求失败 (${response.status})`);
  return response.json();
}
export const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
export const number = (value: unknown, digits = 1, unit = "") => finite(value) ? `${value.toFixed(digits)}${unit}` : "—";
export function bytes(value: unknown): string {
  if (!finite(value)) return "—";
  let v = Math.max(0, value), i = 0;
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 1 : 0)} ${units[i]}`;
}
export const percent = (used: number, total: number) => finite(used) && finite(total) && total > 0 ? Math.min(100, Math.max(0, used / total * 100)) : null;
export function targets(node: Node): Target[] {
  return node.targets?.length ? node.targets : [{ id: "aggregate", name: "延迟", latency_ms: node.latency_ms, loss_pct: node.loss_pct, hours: node.quality }];
}
export function visibleModules(site: Site) {
  if (site.public_site_enabled !== "on" && !site.authed) return [];
  return ["node_list", "network_quality", "service_status"].filter(key =>
    (site.authed || site.public_modules.split(",").map(s => s.trim()).includes(key)) &&
    (key !== "service_status" || site.has_public_services));
}
export function freshRows(rows: QualityRow[], now = Date.now() / 1000) {
  return rows.filter(row => row.ts > 0 && now - row.ts < 180);
}
// null deliberately breaks the path. Missing samples must never appear as 0 or
// connect across an unobserved period.
export function linePaths(points: { t: number; value: number | null | undefined }[], start: number, end: number, ceiling: number, step?: number) {
  const paths: string[] = [];
  let current = "";
  let previous: number | undefined;
  for (const p of points) {
    if (previous != null && step && p.t - previous > step * 1.5) {
      if (current) paths.push(current);
      current = "";
    }
    previous = p.t;
    if (!finite(p.value) || !finite(p.t) || end <= start) {
      if (current) paths.push(current);
      current = ""; continue;
    }
    const x = 45 + (p.t - start) / (end - start) * 900;
    const y = 170 - Math.min(1, Math.max(0, p.value / ceiling)) * 145;
    current += `${current ? " L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  if (current) paths.push(current);
  return paths;
}
