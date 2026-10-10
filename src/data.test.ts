import { describe, expect, it } from "vitest";
import { bytes, freshRows, linePaths, number, percent, targets, visibleModules } from "./data";
import type { Node, Site } from "./types";
describe("native XStatus protocol", () => {
  it("does not invent values for null or nonfinite data", () => {
    expect(number(null)).toBe("—"); expect(number(NaN)).toBe("—");
    expect(number(0, 1, "%")).toBe("0.0%"); expect(bytes(1024)).toBe("1.0 KiB");
    expect(percent(100, 0)).toBeNull(); expect(percent(200, 100)).toBe(100);
  });
  it("preserves ordered card selections, including single-target fallback", () => {
    const node = { latency_ms: 12, loss_pct: 0, quality: [], targets: [{ id: "b" }, { id: "a" }] } as unknown as Node;
    expect(targets(node).map(t => t.id)).toEqual(["b", "a"]);
    expect(targets({ ...node, targets: undefined })[0].latency_ms).toBe(12);
  });
  it("breaks chart paths at gaps and respects server window", () => {
    expect(linePaths([{ t: 1, value: 0 }, { t: 2, value: null }, { t: 3, value: 10 }], 0, 4, 10)).toEqual(["M270.00,170.00", "M720.00,25.00"]);
  });
  it("breaks sparse historical series at missing time buckets", () => {
    expect(linePaths([{ t: 0, value: 1 }, { t: 60, value: 2 }, { t: 300, value: 3 }], 0, 360, 10, 60)).toHaveLength(2);
  });
  it("excludes stale rows and keeps zero latency/loss samples", () => {
    const rows = [{ ts: 821, latency: 0, loss: 0 }, { ts: 820 }, { ts: 0 }] as Parameters<typeof freshRows>[0];
    expect(freshRows(rows, 1000)).toHaveLength(1);
  });
  it("follows public module gates and service existence", () => {
    const site = { public_site_enabled: "on", public_modules: "node_list,network_quality,service_status", authed: false, has_public_services: false } as Site;
    expect(visibleModules(site)).toEqual(["node_list", "network_quality"]);
    expect(visibleModules({ ...site, public_site_enabled: "off" })).toEqual([]);
    expect(visibleModules({ ...site, has_public_services: true })).toContain("service_status");
  });
});
