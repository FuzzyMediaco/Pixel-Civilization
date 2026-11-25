import process from "node:process";

// Run with an operator's D1 write-scoped API token. This utility has no HTTP route in the game.
const [user, mode] = process.argv.slice(2);
if (
  !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(user ?? "") ||
  !["god", "survival"].includes(mode)
) {
  throw new Error("Usage: node scripts/store/grant-existing-mode.mjs GAME_ACCOUNT_UUID god|survival");
}
const {
  CLOUDFLARE_ACCOUNT_ID: account,
  CLOUDFLARE_D1_DATABASE_ID: database,
  CLOUDFLARE_API_TOKEN: token,
} = process.env;
if (!account || !database || !token)
  throw new Error("Set the Cloudflare account ID, database ID and D1 write-scoped API token.");
const product = "mode_" + mode;
const response = await fetch(
  "https://api.cloudflare.com/client/v4/accounts/" +
    encodeURIComponent(account) +
    "/d1/database/" +
    encodeURIComponent(database) +
    "/query",
  {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      sql: `INSERT INTO game_purchases(store,receipt_key,user_id,product_id,active,period_start,expires_at,checked_at,refresh_at,source)
         SELECT 'operator',?,id,?,1,?,NULL,?,0,'verified pre-store mode' FROM game_users WHERE id=?
         ON CONFLICT(store,receipt_key) DO UPDATE SET active=1 RETURNING product_id`,
      params: [user + ":" + product, product, Date.now(), Date.now(), user],
    }),
    signal: AbortSignal.timeout(20000),
  },
);
const result = await response.json();
if (!response.ok || !result.success)
  throw new Error("The D1 operator grant failed. Check the scoped token and database.");
if (result.result?.[0]?.results?.[0]?.product_id !== product)
  throw new Error("No active game account matched that UUID.");
console.log("Lifetime " + mode + " access recorded for the specified existing account.");
