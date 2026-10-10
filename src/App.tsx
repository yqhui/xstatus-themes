import { useEffect, useState, type ReactNode } from "react";
import { bytes, finite, freshRows, linePaths, number, percent, targets, visibleModules } from "./data";
import { useNodes, useResource } from "./hooks";
import { SketchBar, SketchBox, SketchProvider } from "./sketch/Sketch";
import type { MetricPoint, Node, QualityRow, Series, Service, ServiceState, Site } from "./types";
declare const __THEME__: string;
const retro = __THEME__ === "win2000";
const labels: Record<ServiceState, string> = { normal: "正常", partial: "部分故障", down: "全部故障", unknown: "未知" };
const ranges = [["1h", "最近 1 小时"], ["24h", "最近 24 小时"], ["7d", "最近 7 天"], ["30d", "最近 30 天"]];
const spans: Record<string, number> = { "1h": 3600, "24h": 86400, "7d": 604800, "30d": 2592000 };
const colors = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];
function readMode() { try { return localStorage.getItem(`xstatus-${__THEME__}-mode`) || ""; } catch { return ""; } }
function Panel({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return retro ? <div className={`win native-panel ${className}`}>{children}</div> : <SketchBox className={`native-panel ${className}`} seedKey={id}>{children}</SketchBox>;
}
function Heading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <div className={retro ? "title-bar native-heading" : "native-heading hand"}><h2>{children}</h2>{aside}</div>;
}
function Notice({ error, loading, empty }: { error?: string; loading?: boolean; empty?: boolean }) {
  if (error) return <p className="native-notice error" role="alert">{error}，稍后自动重试。</p>;
  if (loading) return <p className="native-notice" role="status">正在读取数据…</p>;
  if (empty) return <p className="native-notice">暂无公开数据。</p>;
  return null;
}
function Meter({ label, value, id }: { label: string; value: number | null; id: string }) {
  const safe = finite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return <div className="native-meter"><span>{label}</span><div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined} aria-valuetext={value == null ? "暂无数据" : number(value, 1, "%")}>
    {retro ? <div className="progress"><i className={`progress-fill ${safe > 85 ? "hot" : ""}`} style={{ width: `${safe}%` }} /></div> : <SketchBar value={safe / 100} color={safe > 85 ? "var(--warn)" : "var(--accent)"} seedKey={id} />}
  </div><strong>{number(value, 1, "%")}</strong></div>;
}
function QualityBars({ hours, name }: { hours: Node["quality"]; name: string }) {
  return <div className="native-hour-bars" aria-label={`${name}最近24小时`}>
    {Array.from({ length: 24 }, (_, i) => {
      const sample = hours?.[i];
      const label = sample ? `${new Date(sample.ts * 1000).toLocaleString()} · ${number(sample.latency, 1, " ms")} · ${number(sample.loss, 1, "%")}` : "暂无数据";
      return <span key={i} title={label} className={!sample || sample.loss == null ? "unknown" : sample.loss >= 5 ? "down" : sample.loss > 0 ? "partial" : "normal"} />;
    })}
  </div>;
}
function NodeCard({ node }: { node: Node }) {
  const rates = node.online;
  return <article className={`native-node ${node.online ? "" : "offline"}`} data-node={node.id}>
    <Panel id={node.id}>
      <Heading aside={<span className={`native-badge ${node.online ? "normal" : "unknown"}`}>{node.online ? "在线" : "离线"}</span>}>
        <a href={`/nodes/${encodeURIComponent(node.id)}`} className="native-node-link">{node.name}</a>
      </Heading>
      <div className="native-card-body">
        <div className="native-meta"><span>{node.location_cc || "—"} · {node.stack_label || "—"}</span><span>{node.cpu.cores || "—"} 核 · {bytes(node.mem.total)}</span></div>
        <div className="native-meta"><span>{node.platform || "未知系统"} {node.platform_version}</span><span>{node.online_days} 天在线</span></div>
        <Meter label="CPU" value={rates ? node.cpu.usage : null} id={node.id + "cpu"} />
        <Meter label="内存" value={rates ? percent(node.mem.used, node.mem.total) : null} id={node.id + "mem"} />
        <Meter label="磁盘" value={rates ? percent(node.disk.used, node.disk.total) : null} id={node.id + "disk"} />
        <div className="native-readings"><div><small>下载 / 上传</small><b>{rates ? bytes(node.net.in_rate) : "—"}/s</b><b>{rates ? bytes(node.net.out_rate) : "—"}/s</b></div><div><small>累计流量</small><b>↓ {bytes(node.net.in_total)}</b><b>↑ {bytes(node.net.out_total)}</b></div><div><small>本期流量</small><b>{bytes(node.traffic.used)}</b><span>{node.traffic.cap == null ? "不限流量" : `/ ${bytes(node.traffic.cap)}`}</span></div></div>
        <div className="native-probes">{targets(node).map(t => <div className="native-probe" key={t.id}><span title={t.name}>{t.name}</span><strong>{number(t.latency_ms, 1, " ms")}</strong><strong>{number(t.loss_pct, 1, "%")}</strong><QualityBars hours={t.hours} name={t.name} /></div>)}</div>
        <div className="native-meta native-card-foot"><span>负载 {rates ? node.cpu.load.map(v => number(v, 2)).join(" / ") : "—"}</span><span>{node.expiry_label || "未设到期"}</span></div>
        {node.systemd_failed > 0 && <p className="error">异常服务 {node.systemd_failed} 项</p>}
      </div>
    </Panel>
  </article>;
}
interface Curve { name: string; points: { t: number; value: number | null | undefined }[]; step?: number }
function Trend({ curves, start, end, unit, ceiling }: { curves: Curve[]; start: number; end: number; unit: string; ceiling?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ceiling ?? Math.max(1, ...curves.flatMap(c => c.points.map(p => finite(p.value) ? p.value : 0))) * 1.15);
  const date = (t: number) => new Date(t * 1000).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const valid = curves.some(c => c.points.some(p => finite(p.value)));
  return <div className="native-trend">
    {!valid ? <p className="native-notice">此时间段暂无有效样本。</p> : <>
      <svg viewBox="0 0 980 210" className="native-chart" role="img" aria-label={`${curves.map(c => c.name).join("、")}趋势，单位${unit}`} onPointerMove={e => {
        const box = e.currentTarget.getBoundingClientRect();
        setHover(start + Math.max(0, Math.min(1, ((e.clientX - box.left) / box.width * 980 - 45) / 900)) * (end - start));
      }} onPointerLeave={() => setHover(null)}>
        {[0, 0.5, 1].map(f => <g key={f}><line x1="45" x2="945" y1={170 - f * 145} y2={170 - f * 145} className="native-grid-line" /><text x="38" y={174 - f * 145} textAnchor="end">{number(max * f, max > 1000 ? 0 : 1)}</text></g>)}
        {curves.map((curve, i) => <g key={curve.name}>{linePaths(curve.points, start, end, max, curve.step).map((d, j) => <path key={j} d={d} stroke={colors[i % colors.length]} strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />)}{curve.points.filter(p => finite(p.value)).length <= 3 && curve.points.filter(p => finite(p.value)).map(p => <circle key={p.t} cx={45 + (p.t - start) / (end - start) * 900} cy={170 - Math.min(1, Math.max(0, p.value! / max)) * 145} r="3" fill={colors[i % colors.length]} />)}</g>)}
        <text x="45" y="199">{date(start)}</text><text x="945" y="199" textAnchor="end">{date(end)}</text>
        {hover != null && <line x1={45 + (hover - start) / (end - start) * 900} x2={45 + (hover - start) / (end - start) * 900} y1="20" y2="170" className="native-hover-line" />}
      </svg>
      <div className="native-legend">{curves.map((curve, i) => {
        const p = hover == null ? null : curve.points.reduce<typeof curve.points[number] | null>((best, p) => !best || Math.abs(p.t - hover) < Math.abs(best.t - hover) ? p : best, null);
        return <span key={curve.name}><i style={{ background: colors[i % colors.length] }} />{curve.name}{p ? ` · ${date(p.t)} · ${number(p.value, 1, ` ${unit}`)}` : ""}</span>;
      })}<small>{unit}</small></div>
      <details className="native-data-table"><summary>查看样本数据</summary><div className="native-table-scroll"><table><thead><tr><th>序列</th><th>时间</th><th>{unit}</th></tr></thead><tbody>{curves.flatMap(c => c.points.map(p => <tr key={`${c.name}:${p.t}`}><td>{c.name}</td><td>{date(p.t)}</td><td>{number(p.value, 2)}</td></tr>))}</tbody></table></div></details>
    </>}
  </div>;
}
function RangeControl({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="native-ranges" aria-label="时间范围">{ranges.map(([v, text]) => <button type="button" key={v} className={`native-button ${v === value ? "selected" : ""}`} aria-pressed={v === value} onClick={() => onChange(v)}>{text}</button>)}</div>;
}
function NetworkPage() {
  const query = new URLSearchParams(location.search);
  const initial = query.get("range") || "24h";
  const [range, setRange] = useState(spans[initial] ? initial : "24h");
  const [search, setSearch] = useState("");
  const [metric, setMetric] = useState<"lat" | "loss">("lat");
  const rows = useResource<QualityRow[]>(`/api/network-quality?range=${range}`, 15000);
  const series = useResource<Series[]>(`/api/network-quality/series?range=${range}`);
  const fresh = freshRows(rows.data || []);
  const ids = [...new Set(fresh.map(row => row.node_id))].filter(id => fresh.find(r => r.node_id === id)!.node.toLowerCase().includes(search.toLowerCase()));
  function changeRange(v: string) { setRange(v); const url = new URL(location.href); url.searchParams.set("range", v); history.replaceState(null, "", url); }
  return <main className="native-main">
    <div className="native-page-head"><h1 className="hand">网络质量</h1><button className="native-button" onClick={() => { rows.reload(); series.reload(); }}>刷新</button></div>
    <div className="native-controls"><RangeControl value={range} onChange={changeRange} /><label>搜索节点 <input aria-label="搜索节点" value={search} onChange={e => setSearch(e.target.value)} placeholder="节点名称" /></label><div className="native-ranges"><button className={`native-button ${metric === "lat" ? "selected" : ""}`} aria-pressed={metric === "lat"} onClick={() => setMetric("lat")}>延迟</button><button className={`native-button ${metric === "loss" ? "selected" : ""}`} aria-pressed={metric === "loss"} onClick={() => setMetric("loss")}>丢包率</button></div></div>
    <Notice error={rows.error || series.error} loading={!rows.data && !rows.error} empty={!!rows.data && !ids.length} />
    <div className="native-quality-grid">{ids.map(id => {
      const items = fresh.filter(r => r.node_id === id);
      const curves = items.map(row => {
        const source = series.data?.find(s => s.node_id === id && s.target_id === row.target_id);
        return { name: row.target, step: source?.step, points: (source?.points || []).map(p => ({ t: p.t, value: p[metric] })) };
      });
      const source = series.data?.find(s => s.node_id === id);
      const end = source?.window_end || Math.floor(Date.now() / 1000);
      const start = source?.window_start || end - spans[range];
      return <Panel key={id} id={id + "quality"} className="native-quality-card"><Heading aside={<span className="native-badge normal">在线</span>}>{items[0].node}</Heading><div className="native-card-body">
        <div className="native-quality-values">{items.map(row => <div key={row.target_id}><span>{row.target}</span><b>{number(row.latency, 1, " ms")}</b><small>{number(row.loss, 1, "%")} 丢包</small><small title={`最新采样 ${new Date(row.ts * 1000).toLocaleString()}`}>窗口统计</small></div>)}</div>
        <Notice error={series.error} loading={!series.data && !series.error} />
        {series.data && <Trend curves={curves} start={start} end={end} unit={metric === "lat" ? "ms" : "%"} ceiling={metric === "loss" ? 100 : undefined} />}
      </div></Panel>;
    })}</div>
  </main>;
}
function ServicesPage() {
  const state = useResource<{ services: Service[]; generated_at: number }>("/api/services");
  return <main className="native-main"><div className="native-page-head"><h1 className="hand">服务监控</h1><button className="native-button" onClick={state.reload}>刷新</button></div>
    <Notice error={state.error} loading={!state.data && !state.error} empty={!!state.data && !state.data.services.length} />
    <div className="native-service-grid">{state.data?.services.map(s => <Panel key={`${s.kind}:${s.id}`} id={s.id + "service"} className="native-service-card">
      <Heading aside={<span className={`native-badge ${s.state}`}>{labels[s.state]}</span>}>{s.name}</Heading>
      <div className="native-card-body"><p className="native-description">{s.desc}</p><div className="native-service-stats"><div><b>{s.uptime_pct === 100 ? "100%" : number(s.uptime_pct, 2, "%")}</b><small>近 30 天可用率</small></div><div><b>{number(s.latency_ms, 0, " ms")}</b><small>平均响应</small></div><div><b>{s.running_since > 0 ? `${Math.max(1, Math.floor((Date.now() / 1000 - s.running_since) / 86400))} 天` : "—"}</b><small>已运行</small></div></div>
        <div className="native-service-days" role="group" aria-label={`${s.name}近30天可用性`}>{s.days.map(day => {
          const text = `${new Date(day.d * 1000).toISOString().slice(0, 10)} · ${labels[day.s]} · ${number(day.p, 2, "%")}`;
          return <button key={day.d} type="button" aria-label={text} title={text} className={day.s} onClick={e => e.currentTarget.focus()}><span role="tooltip" className="native-day-tooltip">{text}</span></button>;
        })}</div>
        <div className="native-meta"><span>30 天中 {s.days.filter(d => d.s === "normal").length} 天全部正常</span><span>未知时段不计入可用率</span></div>
      </div>
    </Panel>)}</div><p className="native-footnote">正常 · 部分故障 · 全部故障 · 未知；每 60 秒更新。{state.data && ` 数据时间 ${new Date(state.data.generated_at * 1000).toLocaleTimeString()}`}</p>
  </main>;
}
function NodeDetail({ id, nodes }: { id: string; nodes: Node[] | undefined }) {
  const node = nodes?.find(n => n.id === id);
  const [range, setRange] = useState("1h");
  const metric = useResource<{ points: MetricPoint[]; step: number }>(node ? `/api/public/node-metrics/${encodeURIComponent(id)}?hours=${spans[range] / 3600}&points=180` : null);
  const points = metric.data?.points || [];
  const end = Math.floor(Date.now() / 1000 / 60) * 60;
  const curve = (key: keyof MetricPoint, name: string, divisor = 1): Curve => ({ name, step: metric.data?.step, points: points.map(p => ({ t: p.t, value: finite(p[key]) ? p[key]! / divisor : null })) });
  return <main className="native-main"><div className="native-page-head"><h1>{node?.name || "节点详情"}</h1><a className="native-button" href="/">返回节点</a></div>
    {!node ? <Notice loading={!nodes} empty={!!nodes} /> : <>
      <div className="native-detail-summary"><NodeCard node={node} /><Panel id={id + "info"}><Heading>系统信息</Heading><dl className="native-info"><dt>处理器</dt><dd>{node.cpu.model || "—"}</dd><dt>系统</dt><dd>{node.platform} {node.platform_version}</dd><dt>内存</dt><dd>{bytes(node.mem.used)} / {bytes(node.mem.total)}</dd><dt>交换空间</dt><dd>{bytes(node.mem.swap_used)} / {bytes(node.mem.swap_total)}</dd><dt>磁盘</dt><dd>{bytes(node.disk.used)} / {bytes(node.disk.total)}</dd><dt>到期</dt><dd>{node.expiry_label || "未设到期"}</dd></dl></Panel></div>
      <RangeControl value={range} onChange={setRange} /><Notice error={metric.error} loading={!metric.data && !metric.error} />
      {metric.data && <div className="native-quality-grid">{[
        { title: "CPU 使用率", curves: [curve("cpu", "CPU")], unit: "%", ceiling: 100 },
        { title: "内存使用量", curves: [curve("mem_used", "内存", 1024 ** 3)], unit: "GiB" },
        { title: "网络速率", curves: [curve("net_in", "下载", 1024 ** 2), curve("net_out", "上传", 1024 ** 2)], unit: "MiB/s" },
        { title: "系统负载", curves: [curve("load1", "1 分钟"), curve("load5", "5 分钟"), curve("load15", "15 分钟")], unit: "" },
      ].map(item => <Panel key={item.title} id={id + item.title}><Heading>{item.title}</Heading><div className="native-card-body"><Trend {...item} start={end - spans[range]} end={end} /></div></Panel>)}</div>}
    </>}
  </main>;
}
export function App() {
  const site = useResource<Site>("/api/site");
  const config = useResource<Record<string, unknown>>(`/api/public/theme-config/${__THEME__}`);
  const [mode, setMode] = useState(readMode);
  const [systemDark, setSystemDark] = useState(matchMedia("(prefers-color-scheme: dark)").matches);
  const modules = site.data ? visibleModules(site.data) : [];
  const nodes = useNodes(modules.includes("node_list"));
  const values = config.data || {};
  const title = typeof values.title === "string" && values.title.trim() ? values.title : site.data?.site_name || "XStatus";
  const resolvedMode = mode || site.data?.theme_default || "system";
  const dark = resolvedMode === "dark" || (resolvedMode === "system" && systemDark);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const changed = () => setSystemDark(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    document.title = title;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.body.className = `${retro ? "native-retro" : "native-sketch"} ${dark ? "dark" : "light"}`;
    document.body.dataset.paper = typeof values.paper === "string" ? values.paper : "grid";
    document.body.dataset.skin = typeof values.skin === "string" ? values.skin : "win2000";
  }, [title, dark, values.paper, values.skin]);
  const page = location.pathname;
  const activeModule = page === "/network-quality" ? "network_quality" : page === "/services" ? "service_status" : "node_list";
  const knownPage = page === "/" || page === "/network-quality" || page === "/services" || /^\/nodes\/[^/]+$/.test(page);
  let nodeID = "";
  try { nodeID = decodeURIComponent(page.split("/")[2] || ""); } catch { /* Invalid route is handled as missing. */ }
  return <SketchProvider wobble={finite(values.wobble) ? values.wobble : 2}>
    <div className={retro ? "desktop" : "native-paper"}>
      <div className={retro ? "win app-window native-app" : "native-app"}>
        <header className={retro ? "title-bar native-header" : "native-header"}><a href="/" className="native-brand hand">{retro ? "▣ " : ""}{title}<small>{retro ? "Windows 2000" : "SketchProbe"}</small></a><button className="native-button" onClick={() => {
          const value = dark ? "light" : "dark"; setMode(value);
          try { localStorage.setItem(`xstatus-${__THEME__}-mode`, value); } catch { /* Browser storage may be disabled. */ }
        }}>{dark ? "浅色模式" : "深色模式"}</button><a className="native-button" href="/admin/themes">后台</a></header>
        <nav className="native-nav" aria-label="页面导航">{[["node_list", "/", "节点监控"], ["network_quality", "/network-quality", "网络质量"], ["service_status", "/services", "服务监控"]].filter(([key]) => modules.includes(key)).map(([key, url, name]) => <a key={key} href={url} aria-current={activeModule === key ? "page" : undefined} className={`native-button ${activeModule === key ? "selected" : ""}`}>{name}</a>)}</nav>
        <Notice error={site.error} loading={!site.data && !site.error} />
        {site.data && (!knownPage ? <p className="native-notice">页面不存在。<a href="/">返回首页</a></p> : !modules.includes(activeModule) ? <p className="native-notice">此公开模块尚未启用。{modules[0] && <a href={modules[0] === "network_quality" ? "/network-quality" : modules[0] === "service_status" ? "/services" : "/"}>打开已启用页面</a>}</p> :
          page === "/network-quality" ? <NetworkPage /> : page === "/services" ? <ServicesPage /> : page.startsWith("/nodes/") ? <NodeDetail id={nodeID} nodes={nodes.data} /> : <main className="native-main native-nodes-main"><Notice error={nodes.error} loading={!nodes.data && !nodes.error} empty={!!nodes.data && !nodes.data.length} /><section className="native-nodes" aria-label="节点卡片">{nodes.data?.map(node => <NodeCard key={node.id} node={node} />)}</section></main>)}
        <footer className={retro ? "status-bar native-footer" : "native-footer"}><span className={retro ? "status-field grow" : ""}>XStatus · {retro ? "Win2000" : "SketchProbe"} · 原生主题</span>{activeModule === "node_list" && <span className={retro ? "status-field" : ""}>{nodes.connected ? "实时连接" : "定时刷新"}</span>}<span className={retro ? "status-field" : ""}>主题 v1.0.0</span></footer>
      </div>
    </div>
  </SketchProvider>;
}
