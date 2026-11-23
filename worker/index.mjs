import pix from "./pix-runtime.mjs";
import { accountRequest } from "./accounts.mjs";

export { PixBudget } from "./pix-runtime.mjs";

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname.startsWith("/api/account/")) {
      return accountRequest(request, env);
    }
    return pix.fetch(request, env, ctx);
  },
};
