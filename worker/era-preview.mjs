export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/api/health") return Response.json({ok:true, app:"Pixel Civilization", channel:"Time period preview", sourceCommit:env.SOURCE_COMMIT});
    if (path === "/api/account/me") return Response.json({user:null});
    if (path === "/api/pix/status") return Response.json({ok:true,configured:false});
    if (path.startsWith("/api/")) return Response.json({error:"This review island saves on this browser. Accounts and Pix are available in the main game."}, {status:503});
    return env.ASSETS.fetch(request);
  }
};
