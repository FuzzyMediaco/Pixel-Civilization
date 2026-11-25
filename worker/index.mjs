import { commerceRequest, maintainCommerce } from "./commerce.mjs";
import pix from "./pix-runtime.mjs";
import { accountRequest } from "./accounts.mjs";

export { PixBudget } from "./pix-runtime.mjs";

export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(maintainCommerce(env)); },
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname.startsWith("/api/commerce/")) return commerceRequest(request, env);
    if (new URL(request.url).pathname.startsWith("/api/account/")) {
      return accountRequest(request, env);
    }
    return pix.fetch(request, env, ctx);
  },
};
