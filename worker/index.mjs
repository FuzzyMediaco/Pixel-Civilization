import pix from "./pix-runtime.mjs";
import { accountRequest } from "./accounts.mjs";

import { sharedRequest } from "./shared-api.mjs";
export { SharedIsland } from "./shared-island.mjs";

export { PixBudget } from "./pix-runtime.mjs";

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/shared/")) return sharedRequest(request, env);
    if (path.startsWith("/api/account/")) {
      return accountRequest(request, env);
    }
    return pix.fetch(request, env, ctx);
  },
};
