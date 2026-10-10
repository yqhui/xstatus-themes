import { useEffect, useState } from "react";
import { get } from "./data";
import type { Node } from "./types";
export function useResource<T>(path: string | null, interval = 60000) {
  const [state, setState] = useState<{ path: string | null; data?: T; error?: string }>({ path });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!path) return;
    let active = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const data = await get<T>(path!, controller.signal);
        if (active) setState({ path, data });
      } catch (e) {
        if (active) setState(prev => ({ path, data: prev.path === path ? prev.data : undefined, error: String(e) }));
      } finally {
        if (active) timer = setTimeout(load, interval);
      }
    }
    void load();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [path, interval, refresh]);
  return { ...(state.path === path ? state : { path }), reload: () => setRefresh(n => n + 1) };
}
export function useNodes(enabled: boolean) {
  const state = useResource<Node[]>(enabled ? "/api/nodes" : null, 15000);
  const [live, setLive] = useState<Node[]>();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true, socket: WebSocket, timer: ReturnType<typeof setTimeout>;
    function connect() {
      socket = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/stream`);
      socket.onopen = () => active && setConnected(true);
      socket.onmessage = event => {
        try {
          const value = JSON.parse(event.data);
          if (active && value.t === "snapshot" && Array.isArray(value.data?.nodes)) setLive(value.data.nodes);
        } catch { /* Keep the last valid snapshot; HTTP polling remains available. */ }
      };
      socket.onclose = () => { if (active) { setConnected(false); timer = setTimeout(connect, 3000); } };
      socket.onerror = () => socket.close();
    }
    connect();
    return () => { active = false; clearTimeout(timer); socket.close(); setLive(undefined); setConnected(false); };
  }, [enabled]);
  // Polling becomes authoritative after a disconnect.
  return { ...state, data: connected && live ? live : state.data, connected };
}
