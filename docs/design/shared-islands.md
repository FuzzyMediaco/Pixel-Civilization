# Shared Islands

Find Shared Islands in **More** or **Saves**. Create a fresh God, Real, or Survival island, or copy a compatible current island or named save. Invite up to three other accounts. Builders can construct, sculpt, create transit services and edit elements. Visitors can move their camera and inspect the city. The owner can change roles, revoke access and control simulation speed.

The city runs as one shared simulation. Players have their own cameras and editing tools. Edits are persisted before acknowledgement. Reconnecting recovers the latest committed snapshot and retries an unacknowledged edit using its original request ID. Placement checks use the current city. Other edits require the player's last observed edit revision. Undo uses the existing guarded construction journal and is available for the actor's latest undoable build edit when it is still the most recent shared edit.

Invites are single-use, expire after 48 hours, and can be replaced by creating a new link of the same role. Only the owner can generate links or manage access. A signed-in account keeps membership across reloads and can find its island from the Shared Islands list. Cursor markers are transient. The server pauses when the last player leaves unless the owner enables the five-minute continuation window.

## Preview scope

This implements private co-op on a shared island. Personal saves stay independent. Shared tools support the existing catalog, local selection, building, contiguous road strokes, voxel sculpting, bridges, maintenance and route creation. The present editor does not expose every solo tool. Pix custom elements cannot be imported into the same room; a compatible copy uses only the standard catalog. Idle and Manager remain solo while their planning and multiplayer ownership rules are designed.

Neighboring islands are the next multiplayer expansion. Give each owner a separate city room, with a region service holding shared bridge endpoints, route contracts and trade deliveries. Add a region map for discovering the crew's connected cities. Use explicit approvals when a crossing joins a second owner's land. Connect two islands with a ferry first, then rail and bridges. Treat trade as a matched transfer with a stable delivery ID so a reconnect cannot duplicate resources. Keep city budgets, rules and saves separate while agreeing on a region schedule for inter-island departures. Prototype with two cities, two ports, and one commodity before adding public regions or competitive scoring.

## Deployment after approval

The preview environment uses a separate Worker and D1 database. A production rollout requires applying `0002_shared_islands.sql` to the existing account database and deploying `wrangler.jsonc` with the `v2` SQLite Durable Object migration. Preserve the existing account and Pix bindings. When using the API directly, retain the v1 object and pass a v1-to-v2 migration creating `SharedIsland`. Use the prior UI version and a worker compatible with the v2 namespace if a rollback is needed. Do not roll back the SQLite namespace or drop shared-island data during a UI rollback.

Verify the production health endpoint, sign in with test accounts on two devices, join a shared island, place and route from both devices, reconnect, and check that a visitor remains view-only. Then confirm regular saves, Pix, the handbook, and the offline build still boot.
