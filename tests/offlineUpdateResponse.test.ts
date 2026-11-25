import test from "node:test";
import assert from "node:assert/strict";
import { serveGameAsset } from "../worker/installer-assets.mjs";

test("installers receive the published HTML bytes and normal navigation receives a web page",async()=>{
  const markup="<html><head><title>Time periods</title></head></html>";
  const env={ASSETS:{fetch:async(request:Request)=>new Response(request.method==="HEAD"?null:markup,{headers:{"Content-Type":"text/html; charset=utf-8"}})}};
  const base="https://pixelcivilization.app/eras";
  const normal=await serveGameAsset(new Request(base),env.ASSETS);
  assert.match(normal.headers.get("content-type")??"",/^text\/html/);
  const update=base+"?edition="+"a".repeat(64);
  const installation=await serveGameAsset(new Request(update),env.ASSETS);
  assert.equal(installation.headers.get("content-type"),"application/octet-stream");
  assert.equal(installation.headers.get("cache-control"),"no-store, no-transform");
  assert.equal(await installation.text(),markup);
  const head=await serveGameAsset(new Request(update,{method:"HEAD"}),env.ASSETS);
  assert.equal(await head.text(),"");
});
