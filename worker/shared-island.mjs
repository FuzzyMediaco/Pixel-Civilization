import { DurableObject } from "cloudflare:workers";
import { applySharedCommand, sharedWorld } from "../src/game/sharedIsland.ts";
import { stepSimulation } from "../src/game/simulation.ts";
import { withinMap } from "../src/game/mapBounds.ts";
import { json, readJson } from "./account-http.mjs";
import { SHARED_PROTOCOL } from "../src/game/sharedProtocol.ts";

const MAX_WORLD = 4 * 1024 * 1024;
const TICK_MS = 2500;
const SAVE_MS = 10000;
const INVITE_MS = 48 * 60 * 60 * 1000;
const AWAY_MS = 5 * 60 * 1000;
const COLORS = ["#1f6b55", "#285cb6", "#a45220", "#963793"];
const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
const randomInvite = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), v => v.toString(16).padStart(2, "0")).join("");
const inviteHash = async value => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), v => v.toString(16).padStart(2, "0")).join("");
const portalError = (message, status) => json({ error: message }, status);

export class SharedIsland extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.lastSave = 0;
    this.lastStep = Date.now();
    this.queue = Promise.resolve();
    ctx.blockConcurrencyWhile(async () => {
      this.room = await ctx.storage.get("room");
      const saved = await ctx.storage.get("state");
      this.world = saved?.world;
      this.revision = saved?.revision ?? 0;
      this.history = saved?.history ?? [];
      this.receipts = saved?.receipts ?? [];
    });
  }

  serialize(action) {
    const result = this.queue.then(action);
    this.queue = result.catch(() => {});
    return result;
  }

  roomFor(user) {
    const me = this.room.members[user];
    return { id: this.room.id, name: this.room.name, mode: this.world.mode, role: me.role, self: user,
      away: this.room.away, members: Object.values(this.room.members) };
  }

  async index(user) {
    const member = this.room.members[user];
    await this.env.GAME_ACCOUNTS.prepare(`INSERT INTO game_shared_islands(room_id,user_id,name,mode,role,joined_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(room_id,user_id) DO UPDATE SET role=excluded.role`)
      .bind(this.room.id, user, this.room.name, this.world.mode, member.role, Date.now()).run();
  }

  fetch(request) {
    return this.serialize(async () => {
      const action = new URL(request.url).pathname.slice(1);
      const user = request.headers.get("x-player-id");
      const name = request.headers.get("x-player-name");
      const id = request.headers.get("x-island-id");
      if (!user || !id) return portalError("Sign in to join this island.", 401);
      if (action === "create") {
        if (this.room && this.room.owner !== user) return portalError("Island unavailable.", 404);
        if (!this.room) {
          const input = await readJson(request, MAX_WORLD);
          let world;
          try { world = sharedWorld(input.mode, input.world); }
          catch (error) { return portalError(error.message ?? "Could not copy that world.", 400); }
          const room = { id, name: typeof input.name === "string" ? input.name.trim().slice(0, 36) || "Shared island" : "Shared island",
            owner: user, away: false, members: { [user]: { id: user, name, role: "owner", color: COLORS[0] } }, invites: {} };
          const saved = { world, revision: 0, history: [], receipts: [] };
          if (size(saved) > MAX_WORLD) return portalError("That world is too large to share.", 413);
          await this.ctx.storage.put({ room, state: saved });
          this.room = room;
          this.world = world;
        }
        await this.index(user);
        return json({ room: this.roomFor(user) }, 201);
      }
      if (!this.room || !this.world) return portalError("Island unavailable.", 404);
      let member = this.room.members[user];
      if (action === "join") {
        const { token } = await readJson(request, 4096);
        if (!member) {
          if (typeof token !== "string" || !/^[a-f0-9]{48}$/.test(token)) return portalError("Ask the owner for a new invite.", 403);
          const hash = await inviteHash(token);
          const invited = this.room.invites[hash];
          if (!invited || invited.expires < Date.now()) return portalError("This invite expired or was already used.", 403);
          if (Object.keys(this.room.members).length >= 4) return portalError("This island already has four members.", 409);
          const used = new Set(Object.values(this.room.members).map(m => m.color));
          const next = structuredClone(this.room);
          next.members[user] = { id: user, name, role: invited.role, color: COLORS.find(c => !used.has(c)) };
          delete next.invites[hash];
          await this.ctx.storage.put("room", next);
          this.room = next;
          member = next.members[user];
        }
        await this.index(user);
        this.broadcastRooms();
        return json({ room: this.roomFor(user) });
      }
      if (!member) return portalError("You need an invite to enter this island.", 403);

      if (action === "room") return json({ room: this.roomFor(user) });
      if (action === "export") return json({ format: "pixel_civ_world_v1", name: this.room.name, state: this.publicWorld(), customElements: [] });
      if (action === "socket") {
        if (this.ctx.getWebSockets().filter(ws => ws.readyState === 1).length >= 12) return portalError("Too many tabs are connected.", 429);
        const [client, server] = Object.values(new WebSocketPair());
        if (!this.activeSockets().length) this.lastStep = Date.now();
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({
          user, session: request.headers.get("x-player-session"), expires: Number(request.headers.get("x-player-expiry")),
          lastCursor: 0, lastEdit: 0,
        });
        this.send(server, { type:"welcome", protocol: SHARED_PROTOCOL, room: this.roomFor(user), ...this.snapshot() });
        this.broadcastPresence();
        await this.schedule();
        return new Response(null, { status: 101, webSocket: client });
      }
      if (member.role !== "owner") return portalError("Only the owner can change invitations or roles.", 403);
      const body = await readJson(request, 4096);
      if (action === "invite") {
        if (body.role !== "builder" && body.role !== "visitor") return portalError("Choose Builder or Visitor.", 400);
        const token = randomInvite(), now = Date.now(), expires = now + INVITE_MS;
        const next = structuredClone(this.room);
        next.invites = Object.fromEntries(Object.entries(next.invites).filter(([,v]) => v.expires > now && v.role !== body.role));
        next.invites[await inviteHash(token)] = { role: body.role, expires };
        await this.ctx.storage.put("room", next);
        this.room = next;
        return json({ token, expires }, 201);
      }
      if (action === "member") {
        const next = structuredClone(this.room);
        if (typeof body.away === "boolean") {
          next.away = body.away;
          if (!next.away) delete next.awayUntil;
        } else {
          const target = typeof body.user === "string" && Object.hasOwn(next.members, body.user) && next.members[body.user];
          if (!target || target.role === "owner" || !["builder", "visitor", "remove"].includes(body.role)) return portalError("Choose a guest and a valid role.", 400);
          if (body.role === "remove") delete next.members[body.user];
          else target.role = body.role;
        }
        await this.ctx.storage.put("room", next);
        this.room = next;
        if (body.role === "remove") {
          for (const ws of this.ctx.getWebSockets()) if (ws.deserializeAttachment()?.user === body.user) ws.close(1008, "Access removed");
          await this.env.GAME_ACCOUNTS.prepare("DELETE FROM game_shared_islands WHERE room_id=? AND user_id=?").bind(id, body.user).run();
          this.broadcastPresence();
        } else if (typeof body.away !== "boolean") await this.index(body.user);
        this.broadcastRooms();
        return json({ room: this.roomFor(user) });
      }
      return portalError("Shared island action unavailable.", 404);
    });
  }

  publicWorld() {
    const { constructionHistory, ...world } = this.world;
    return world;
  }

  snapshot() {
    return { revision: this.revision, world: this.publicWorld(), history: this.history,
      undoActor: this.history.at(-1)?.undoable ? this.history.at(-1).actor : null };
  }

  send(ws, data) {
    if (ws.readyState !== 1) return;
    try { ws.send(typeof data === "string" ? data : JSON.stringify(data)); } catch { /* Reconnect recovers the latest snapshot. */ }
  }

  broadcast(data, except) {
    const message = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      const player = ws.deserializeAttachment();
      if (ws !== except && this.room.members[player?.user]) this.send(ws, message);
    }
  }

  broadcastRooms() {
    for (const ws of this.ctx.getWebSockets()) {
      const user = ws.deserializeAttachment()?.user;
      if (this.room.members[user]) this.send(ws, { type: "room", room: this.roomFor(user) });
    }
  }

  activeSockets() {
    return this.ctx.getWebSockets().filter(ws => ws.readyState === 1 && this.room.members[ws.deserializeAttachment()?.user]);
  }

  broadcastPresence(except) {
    this.broadcast({ type: "presence", ids: [...new Set(this.activeSockets().filter(ws => ws !== except).map(ws => ws.deserializeAttachment().user))] }, except);
  }

  async schedule() {
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
  }

  async saveTick() {
    await this.ctx.storage.put("state", { world:this.world, revision:this.revision, history:this.history, receipts:this.receipts });
    this.lastSave = Date.now();
  }

  webSocketMessage(ws, raw) {
    return this.serialize(async () => {
      if (typeof raw !== "string" || raw.length > 20_000) return ws.close(1009, "Message too large");
      let data;
      try { data = JSON.parse(raw); } catch { return this.send(ws, { type:"error", message:"Invalid island message." }); }
      const player = ws.deserializeAttachment();
      const member = this.room.members[player?.user];
      const now = Date.now();
      if (!member || player.expires < now) return ws.close(1008, "Sign in again");
      if (data?.type === "cursor") {
        if (now - player.lastCursor < 160 || !Number.isInteger(data.gx) || !Number.isInteger(data.gz) || !withinMap(data.gx, data.gz)) return;
        player.lastCursor = now;
        ws.serializeAttachment(player);
        this.broadcast({ type:"cursor", user:player.user, gx:data.gx, gz:data.gz }, ws);
        return;
      }
      if (data?.type !== "edit" || typeof data.request !== "string" || !/^[a-f0-9-]{36}$/.test(data.request)) return;
      const reply = message => this.send(ws, { type:"error", request:data.request, message });
      if (member.role === "visitor") return reply("You have view-only access.");
      if (now - player.lastEdit < 120) return reply("Give the island a moment before editing again.");
      player.lastEdit = now;
      ws.serializeAttachment(player);
      const session = await this.env.GAME_ACCOUNTS.prepare("SELECT 1 FROM game_sessions WHERE token_hash=? AND user_id=? AND expires_at>?")
        .bind(player.session, player.user, now).first();
      if (!session) return ws.close(1008, "Sign in again");
      const receipt = this.receipts.find(r => r.user === player.user && r.request === data.request);
      if (receipt) return this.send(ws, { type:"ack", request:data.request, label:receipt.label });
      if (data.command?.kind === "speed" && member.role !== "owner") return reply("Only the owner controls the simulation speed.");
      if (data.command?.kind !== "place" && data.base !== this.revision) return reply("The island changed while you were editing. Try again on the updated map.");
      const last = this.history.at(-1);
      if (data.command?.kind === "undo" && (!last?.undoable || last.actor !== player.user)) return reply("Undo is available for your latest edit if nobody has changed the island since.");
      let result;
      try { result = applySharedCommand(this.world, data.command); }
      catch (error) { return reply(error?.message?.slice(0, 180) || "The island could not apply that edit."); }
      const history = [...this.history.slice(-23), { label:result.label, actor:player.user, by:member.name, at:now, undoable:result.undoable }];
      const receipts = [...this.receipts.slice(-63), { user:player.user, request:data.request, label:result.label }];
      const revision = this.revision + 1;
      const persisted = { world:result.state, revision, history, receipts };
      if (size(persisted) > MAX_WORLD) return reply("The island has reached its shared save size limit.");
      try { await this.ctx.storage.put("state", persisted); }
      catch { return reply("The edit could not be saved. Please try again."); }
      this.history = history;
      this.receipts = receipts;
      this.revision = revision;
      this.world = result.state;
      this.lastSave = now;
      this.send(ws, { type:"ack", request:data.request, label:result.label });
      this.broadcast({ type:"snapshot", ...this.snapshot() });
      await this.schedule();
    });
  }

  webSocketClose(ws) {
    return this.serialize(async () => {
      this.broadcastPresence(ws);
      if (!this.activeSockets().some(other => other !== ws)) {
        await this.saveTick();
        if (this.room.away && (this.world.playSpeed ?? 1) > 0) {
          this.room.awayUntil = Date.now() + AWAY_MS;
          await this.ctx.storage.put("room", this.room);
          await this.schedule();
        } else await this.ctx.storage.deleteAlarm();
      }
    });
  }

  webSocketError(ws) { return this.webSocketClose(ws); }

  alarm() {
    return this.serialize(async () => {
      const now = Date.now();
      if (!this.world) return;
      for (const ws of this.activeSockets()) if (ws.deserializeAttachment()?.expires < now) ws.close(1008, "Sign in again");
      const connected = this.activeSockets().length > 0;
      if (!connected && (!this.room.away || (this.room.awayUntil ?? 0) < now)) {
        await this.saveTick();
        return;
      }
      const elapsed = Math.max(0, Math.min((now - this.lastStep) / 1000, 4));
      this.lastStep = now;
      const speed = this.world.playSpeed ?? 1;
      if (speed > 0 && !this.world.gameOver) {
        const next = structuredClone(this.world);
        for (let left = elapsed * speed; left > 0; left -= 0.5) stepSimulation(next, Math.min(left, 0.5), true);
        const saved = { world:next, revision:this.revision, history:this.history, receipts:this.receipts };
        if (size(saved) <= MAX_WORLD) this.world = next;
        else this.world.playSpeed = 0;
        if (now - this.lastSave >= SAVE_MS) await this.saveTick();
        if (connected) this.broadcast({ type:"snapshot", ...this.snapshot() });
      }
      await this.ctx.storage.setAlarm(now + (speed > 0 ? TICK_MS : 15000));
    });
  }
}
