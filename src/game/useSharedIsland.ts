import { useEffect, useRef, useState } from "react";
import type { SharedCommand } from "./sharedIsland";
import { SHARED_PROTOCOL, type SharedMessage, type SharedRoom, type SharedSnapshot } from "./sharedProtocol";
import { sharedError, sharedRequest, sharedRoute } from "./sharedClient";

export type CursorPoint = { gx: number; gz: number; at: number };

export function useSharedIsland(id: string, token: string | null, profile: string) {
  const [room, setRoom] = useState<SharedRoom>();
  const [snapshot, setSnapshot] = useState<SharedSnapshot>();
  const [online, setOnline] = useState<string[]>([]);
  const [status, setStatus] = useState<"joining" | "live" | "reconnecting" | "closed">("joining");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const cursors = useRef(new Map<string, CursorPoint>());
  const socket = useRef<WebSocket | null>(null);
  const revision = useRef(0);
  const outstanding = useRef<{ request: string; base: number; command: SharedCommand } | null>(null);
  const cursorAt = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    let reconnect: number | undefined;
    let attempts = 0;
    let stopped = false;
    let established = false;
    const apply = (data: SharedSnapshot) => {
      revision.current = data.revision;
      setSnapshot(data);
    };
    const connect = () => {
      const scheme = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(scheme + "//" + location.host + "/api/shared/rooms/" + id + "/socket");
      socket.current = ws;
      ws.onmessage = ({ data }) => {
        if (stopped || socket.current !== ws) return;
        const value: SharedMessage = JSON.parse(data);
        if (value.type === "welcome") {
          if (value.protocol !== SHARED_PROTOCOL) {
            stopped = true;
            setStatus("closed");
            setNotice("Refresh Pixel Civilization to use the latest multiplayer version.");
            ws.close();
            return;
          }
          attempts = 0;
          established = true;
          setStatus("live");
          setNotice("");
          setRoom(value.room);
          apply(value);
          if (outstanding.current) ws.send(JSON.stringify({ type: "edit", ...outstanding.current }));
        } else if (value.type === "snapshot") apply(value);
        else if (value.type === "room") setRoom(value.room);
        else if (value.type === "presence") {
          setOnline(value.ids);
          for (const user of cursors.current.keys()) if (!value.ids.includes(user)) cursors.current.delete(user);
        } else if (value.type === "cursor") {
          cursors.current.set(value.user, { gx: value.gx, gz: value.gz, at: Date.now() });
        } else {
          if (value.request === outstanding.current?.request) {
            outstanding.current = null;
            setPending(false);
          }
          setNotice(value.type === "error" ? value.message : value.label);
        }
      };
      ws.onclose = event => {
        if (stopped || controller.signal.aborted) return;
        if (event.code === 1008 || (!established && attempts >= 3)) {
          setStatus("closed");
          setNotice(event.reason || "Could not open this island. Check your access and sign in again.");
          return;
        }
        setStatus("reconnecting");
        reconnect = window.setTimeout(connect, Math.min(10000, 700 * 2 ** attempts++));
      };
    };
    const begin = async () => {
      try {
        const { room } = await sharedRequest<{ room: SharedRoom }>("rooms/" + id + (token ? "/join" : "/room"),
          token ? { token, profile } : undefined, controller.signal);
        if (stopped) return;
        if (token) history.replaceState(null, "", sharedRoute(id));
        setRoom(room);
        connect();
      } catch (err) {
        if (stopped) return;
        setStatus("closed");
        setNotice(sharedError(err));
      }
    };
    void begin();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(reconnect);
      socket.current?.close();
      socket.current = null;
    };
  }, [id, token, profile]);

  function edit(command: SharedCommand) {
    const ws = socket.current;
    if (status !== "live" || ws?.readyState !== WebSocket.OPEN || outstanding.current) return;
    const request = { request: crypto.randomUUID(), base: revision.current, command };
    outstanding.current = request;
    setPending(true);
    ws.send(JSON.stringify({ type: "edit", ...request }));
  }

  function cursor(gx: number, gz: number) {
    const now = performance.now();
    if (now - cursorAt.current < 180 || socket.current?.readyState !== WebSocket.OPEN) return;
    cursorAt.current = now;
    socket.current.send(JSON.stringify({ type: "cursor", gx, gz }));
  }

  return { room, snapshot, online, status, notice, pending, cursors, edit, cursor };
}
