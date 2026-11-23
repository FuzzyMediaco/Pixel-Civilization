// Node's development server uses the same account and revision code as the hosted Worker.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { accountRequest } from "../../worker/accounts.mjs";

export function openAccountDatabase(filename) {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000");
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    if (!sqlite.prepare("PRAGMA user_version").get().user_version) {
      sqlite.exec(readFileSync(new URL("../../migrations/0001_game_accounts.sql", import.meta.url), "utf8"));
      sqlite.exec("PRAGMA user_version=1");
    }
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    sqlite.close();
    throw error;
  }
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { bind(...args) {
        return {
          all: () => ({ results: statement.all(...args) }),
          first: () => statement.get(...args),
          run: () => statement.run(...args),
        };
      } };
    },
    batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const result = statements.map(s => s.all());
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { sqlite, db };
}

export function createLocalAccounts(filename) {
  const { sqlite, db } = openAccountDatabase(filename);
  return {
    close: () => sqlite.close(),
    async handle(req, res) {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) for (const item of value) headers.append(key, item);
        else if (value !== undefined) headers.set(key, value);
      }
      headers.set("CF-Connecting-IP", req.socket.remoteAddress ?? "localhost");
      const protocol = req.socket.encrypted || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const request = new Request(protocol + "://" + req.headers.host + req.url, {
        method: req.method, headers,
        ...(["GET", "HEAD"].includes(req.method) ? {} : { body: Readable.toWeb(req), duplex: "half" }),
      });
      const response = await accountRequest(request, { GAME_ACCOUNTS: db });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    },
  };
}
