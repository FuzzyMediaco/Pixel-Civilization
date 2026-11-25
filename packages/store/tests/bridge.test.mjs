import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source=await readFile(new URL("../bridge.js",import.meta.url),"utf8");
function load(receiver,main=true) {
  const window={...receiver};
  window.top=main ? window : {};
  vm.runInNewContext(source,{window,setTimeout,clearTimeout,Promise,Map,JSON,Object,Error,String,URL,Event});
  return window.pixelStore;
}
test("browser and embedded third-party frames have no purchase bridge",()=>{
  assert.equal(load({}),undefined);
  assert.equal(load({PixelBilling:{}},false),undefined);
});
test("Google replies resolve their own request and cancellation grants nothing",async()=>{
  const messages=[];
  const native={postMessage(raw){messages.push(JSON.parse(raw));}};
  const store=load({PixelBilling:native});
  assert.equal(store.platform,"google");
  const prices=store.products(["era_rome"]);
  const restores=store.restore();
  native.onmessage({data:JSON.stringify({id:messages[1].id,value:[{productId:"era_rome",purchaseToken:"test-token"}]})});
  native.onmessage({data:JSON.stringify({id:messages[0].id,value:[{id:"era_rome",price:"€0,99"}]})});
  assert.equal((await prices)[0].price,"€0,99");
  assert.equal((await restores)[0].purchaseToken,"test-token");
  const purchase=store.purchase("era_china","b40a2812-a0a2-41f7-b2bc-ac9e18b3ab88");
  native.onmessage({data:JSON.stringify({id:messages[2].id,error:"Purchase canceled."})});
  await assert.rejects(purchase,/canceled/);
});
test("Apple receives the account token and explicitly finishes verified receipts",async()=>{
  const calls=[];
  const item={platform:"apple",productId:"era_rome",transactionId:"42"};
  const store=load({webkit:{messageHandlers:{pixelBilling:{postMessage:async msg=>{
    calls.push(msg);
    if(msg.action==="purchase") return item;
    if(msg.action==="pending") return [item];
    return true;
  }}}}});
  assert.equal(store.platform,"apple");
  assert.deepEqual(await store.purchase("era_rome","account-uuid"),item);
  assert.deepEqual(Array.from(calls[0].args),["era_rome","account-uuid"]);
  assert.equal((await store.pending())[0].transactionId,"42");
  assert.deepEqual(calls.map(c=>c.action),["purchase","pending"]);
  await store.finish(item);
  await store.manage();
  assert.deepEqual(calls.map(c=>c.action),["purchase","pending","finish","manage"]);
});

test("local sample links close the store and open within the app window",()=>{
  let click;
  const opened=[];
  let dismissed=0;
  const location={origin:"https://pixelcivilization.app",href:"https://pixelcivilization.app/",assign:href=>opened.push(href)};
  load({PixelBilling:{},document:{addEventListener:(type,handler)=>{if(type==="click")click=handler;}},location});
  function tap(href){
    let captured=false;
    const link={href,closest:()=>({requestClose:()=>dismissed++})};
    click({target:{closest:()=>link},button:0,preventDefault:()=>{captured=true;}});
    return captured;
  }
  assert.equal(tap("https://apps.apple.com/account/subscriptions"),false);
  assert.equal(tap("./#world=ancient-china-starter"),true);
  assert.deepEqual(opened,["https://pixelcivilization.app/#world=ancient-china-starter"]);
  assert.equal(dismissed,1);
});

test("native stores offer one-time items and keep all four monthly plans closed",async()=>{
  const calls=[];
  const store=load({webkit:{messageHandlers:{pixelBilling:{postMessage:async message=>{calls.push(message);return [];}}}}});
  const plans=["pix_starter","pix_builder","pix_studio","pix_complete"];
  await store.products(["era_rome","mode_god",...plans]);
  assert.deepEqual(Array.from(calls[0].args[0]),["era_rome","mode_god"]);
  for (const sku of plans) await assert.rejects(store.purchase(sku,"test-account"),/currently closed/);
  assert.equal(calls.length,1);
  await store.restore();
  assert.equal(calls[1].action,"restore");
});
