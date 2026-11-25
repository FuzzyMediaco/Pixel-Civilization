// Run against a local development server. No Stripe account, real payment or cloud save is used.
import assert from "node:assert/strict";
import { chromium } from "./ui-lib.mjs";
const origin=process.env.PERIOD_TEST_ORIGIN ?? "http://127.0.0.1:5393";
if(!["localhost","127.0.0.1","[::1]"].includes(new URL(origin).hostname))throw Error("Use the local development game.");
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:["--enable-unsafe-swiftshader"]});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},userAgent:"PixelCivilizationOffline/1"});
  const page=await context.newPage();
  const user={id:"e006f61d-0b51-44fd-a85c-f969361616e0",email:"island-store-test@example.test"};
  let attempts=0, acceptReceipt=false, funded=false, billing;
  const tiers=Object.fromEntries(["starter","builder","studio","complete"].map((name,i)=>[
    "pix_"+name,{available:i<2,reason:i<2?"available":"wallet_capacity"}
  ]));
  const state=()=>({accountId:user.id,owned:acceptReceipt?["era_rome"]:[],plan:billing?.state==="active"?"pix_starter":null,pixBilling:billing,providers:funded?["gemini","openai","anthropic"]:[],readyStores:["stripe"],webSubscriptionsReady:funded,pixAdmission:funded?{native:false,tiers}:undefined,usage:{messages:0,spendMicros:0,limit:0,budgetMicros:0,periodEnd:0},validUntil:Date.now()+3600000});
  await context.route("**/api/account/**",route=>route.fulfill({json:{user,saves:[],items:[]}}));
  await context.route("**/api/commerce/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith("/pix/cancel-renewal")) {
      assert.equal(route.request().method(),"POST");billing={...billing,renews:false};
    }
    if(path.endsWith("/checkout/complete"))attempts++;
    if(path.endsWith("/checkout/complete") && !acceptReceipt)return route.fulfill({status:409,json:{code:"checkout_pending",error:"Waiting for payment confirmation."}});
    if(path.endsWith("/checkout"))return route.fulfill({json:{url:"https://buy.stripe.com/game-test-link?client_reference_id=example"}});
    return route.fulfill({json:state()});
  });
  await page.goto(origin+"/");
  await page.waitForFunction(()=>Boolean(window.__pixelWorld?.gameState));
  await page.evaluate(async user=>{
    const store=await import("/src/game/deviceSaves.ts");
    await store.openDeviceSaves();await store.rememberPlayer(user);
  },user);
  await page.goto(origin+"/?purchase=complete&session_id=cs_test_game_receipt");
  const shop=page.getByRole("dialog",{name:"Island Store"});
  await shop.getByText("Waiting for Stripe to confirm your payment.",{exact:false}).waitFor();
  assert.ok(page.url().includes("session_id="));acceptReceipt=true;
  await shop.getByText("Your purchase has been checked.",{exact:false}).waitFor();
  assert.ok(!page.url().includes("session_id="));assert.ok(attempts>=2);
  assert.equal(await shop.evaluate(e=>getComputedStyle(e).backgroundColor),"rgb(250, 249, 241)");
  await shop.getByRole("button",{name:"Unlock Ancient Egypt",exact:true}).click();
  const next=shop.getByRole("link",{name:/Continue to Stripe/});await next.waitFor();
  assert.match(await next.getAttribute("href"),/^https:\/\/buy\.stripe\.com\//);
  await shop.getByRole("button",{name:"Pix plans",exact:true}).click();
  assert.equal(await shop.getByRole("button",{name:"Purchases opening soon"}).count(),4);
  funded=true;
  await page.goto(origin+"/?purchase=cancelled");
  await shop.getByRole("button",{name:"Pix plans",exact:true}).click();
  const atCapacity=shop.getByRole("button",{name:"At capacity"});
  await atCapacity.first().waitFor();
  assert.equal(await atCapacity.count(),2);
  billing={state:"invoice_open",invoiceUrl:"https://invoice.stripe.com/i/fixture",renews:true,paidThrough:null};
  await page.goto(origin+"/?purchase=complete&session_id=cs_test_funded_setup");
  const invoice=shop.getByRole("link",{name:/Review and pay first invoice/});
  await invoice.waitFor();
  assert.equal(await invoice.getAttribute("href"),billing.invoiceUrl);
  await shop.getByRole("button",{name:"Checkout in progress"}).first().waitFor();
  billing={...billing,invoiceUrl:"https://outside.example.test/invoice"};
  await shop.getByRole("button",{name:"Check payment status"}).click();
  await invoice.waitFor({state:"detached"});
  billing={state:"active",renews:true,paidThrough:Date.now()+28*86400000};
  await shop.getByRole("button",{name:"Check payment status"}).click();
  await shop.getByRole("button",{name:"Stop Pix renewal"}).click();
  await shop.getByRole("button",{name:"Keep renewal"}).click();
  await shop.getByRole("button",{name:"Stop Pix renewal"}).click();
  await shop.getByRole("button",{name:"Confirm stop"}).click();
  await shop.getByText("Monthly renewal is off.",{exact:false}).waitFor();
  assert.equal(billing.renews,false);
  assert.ok(!page.url().includes("session_id="));
  console.log("Checked delayed receipts, portable checkout, tier capacity, first invoice, untrusted URL rejection and renewal cancellation.");
}catch(error){
  const page=browser.contexts()[0]?.pages()[0];
  if(page)console.error(page.url(),(await page.locator("body").innerText()).slice(-1800));
  throw error;
}finally{await browser.close();}
