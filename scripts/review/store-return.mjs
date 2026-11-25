// Run against a local development server. No Stripe account, real payment or cloud save is used.
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import { PIX_BILLING_CONSENT_VERSION, pixBillingConsentText } from "../../src/game/pixBillingConsent.mjs";
import { productById } from "../../src/game/storeCatalog.mjs";
import { chromium } from "./ui-lib.mjs";
const origin=process.env.PERIOD_TEST_ORIGIN ?? "http://127.0.0.1:5393";
if(!["localhost","127.0.0.1","[::1]"].includes(new URL(origin).hostname))throw Error("Use the local development game.");
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:["--enable-unsafe-swiftshader"]});
try{
  for (const desktop of [false,true]) {
  const context=await browser.newContext(desktop ? {viewport:{width:1280,height:900}} :
    {viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:"PixelCivilizationOffline/1"});
  const page=await context.newPage();
  const capture=async name=>{
    const dir=process.env.PERIOD_BILLING_ARTIFACTS;
    if (!dir) return;
    await mkdir(dir,{recursive:true});
    await page.screenshot({path:join(dir,(desktop?"desktop":"phone")+"-"+name+".jpg"),type:"jpeg",quality:85});
  };
  const user={id:"e006f61d-0b51-44fd-a85c-f969361616e0",email:"island-store-test@example.test"};
  let attempts=0, acceptReceipt=false, funded=false, billing;
  const orders=[];
  let holdNextRead, delayedRead;
  let checkoutUrl="https://buy.stripe.com/game-test-link?client_reference_id=example",cancelCount=0;
  await context.route(/^https:\/\/(?:checkout|buy|billing|invoice|pay)\.stripe\.com\//,route=>route.fulfill({contentType:"text/html",body:"<title>Local checkout fixture</title>"}));
  const tiers=Object.fromEntries(["starter","builder","studio","complete"].map((name,i)=>[
    "pix_"+name,{available:i<2,reason:i<2?"available":"wallet_capacity"}
  ]));
  const state=()=>({accountId:user.id,owned:acceptReceipt?["era_rome"]:[],plan:billing?.state==="active"?"pix_starter":null,pixBilling:billing,providers:funded?["gemini","openai","anthropic"]:[],readyStores:["stripe"],webSubscriptionsReady:funded,pixAdmission:funded?{native:false,tiers}:undefined,usage:{messages:0,spendMicros:0,limit:0,budgetMicros:0,periodEnd:0},validUntil:Date.now()+3600000});
  await context.route("**/api/account/**",route=>route.fulfill({json:{user,saves:[],items:[]}}));
  await context.route("**/api/commerce/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if (path.endsWith("/access") && holdNextRead) {
      const saved=state();
      const held=holdNextRead;holdNextRead=undefined;
      delayedRead=()=>route.fulfill({json:saved});
      held();
      return;
    }
    if(path.endsWith("/pix/cancel-renewal")) {
      assert.equal(route.request().method(),"POST");cancelCount++;
      billing = billing.state === "active" ? {...billing,renews:false} : {state:"ended",renews:false,paidThrough:null};
    }
    if(path.endsWith("/checkout/complete"))attempts++;
    if(path.endsWith("/checkout/complete") && !acceptReceipt)return route.fulfill({status:409,json:{code:"checkout_pending",error:"Waiting for payment confirmation."}});
    if(path.endsWith("/checkout")){orders.push(route.request().postDataJSON());return route.fulfill({json:{url:checkoutUrl}});}
    if(path.endsWith("/portal"))return route.fulfill({json:{url:"https://billing.stripe.com/p/session/fixture"}});
    return route.fulfill({json:state()});
  });
  await page.goto(origin+"/");
  await page.waitForFunction(()=>Boolean(window.__pixelWorld?.gameState));
  await page.evaluate(async user=>{
    const store=await import("/src/game/deviceSaves.ts");
    await store.openDeviceSaves();await store.rememberPlayer(user);
  },user);
  await page.goto(origin+"/?purchase=complete&session_id=cs_test_game_receipt&extra=drop");
  const shop=page.getByRole("dialog",{name:"Island Store"});
  await shop.getByText("Waiting for Stripe to confirm your payment.",{exact:false}).waitFor();
  assert.ok(page.url().includes("session_id="));assert.ok(!page.url().includes("extra="));acceptReceipt=true;
  await shop.getByText("Your purchase has been checked.",{exact:false}).waitFor();
  assert.ok(!page.url().includes("session_id="));assert.ok(attempts>=2);
  assert.equal(await shop.evaluate(e=>getComputedStyle(e).backgroundColor),"rgb(250, 249, 241)");
  await shop.getByRole("button",{name:"Unlock Ancient Egypt",exact:true}).click();
  if (desktop) {
    await page.waitForURL("https://buy.stripe.com/**");
    await page.goto(origin+"/?purchase=manage");
  } else {
    const next=shop.getByRole("link",{name:/Continue to Stripe/});await next.waitFor();
    assert.match(await next.getAttribute("href"),/^https:\/\/buy\.stripe\.com\//);
  }
  assert.deepEqual(orders.shift(),{productId:"era_egypt"});
  await shop.getByRole("button",{name:"Pix plans",exact:true}).click();
  assert.equal(await shop.getByRole("button",{name:"Purchases opening soon"}).count(),4);
  funded=true;
  await page.goto(origin+"/?purchase=cancelled");
  await shop.getByRole("button",{name:"Pix plans",exact:true}).click();
  const atCapacity=shop.getByRole("button",{name:"At capacity"});
  await atCapacity.first().waitFor();
  assert.equal(await atCapacity.count(),2);
  const starter=shop.getByRole("article").filter({has:page.getByRole("heading",{name:"Pix Starter",exact:true})});
  const builder=shop.getByRole("article").filter({has:page.getByRole("heading",{name:"Pix Builder",exact:true})});
  await starter.getByRole("button",{name:"Subscribe",exact:true}).click();
  const consent=starter.getByRole("checkbox",{name:pixBillingConsentText(productById("pix_starter")),exact:true});
  assert.equal(await consent.isChecked(),false);
  const submit=starter.getByRole("button",{name:"Continue to card setup"});
  assert.equal(await submit.isDisabled(),true);
  await consent.scrollIntoViewIfNeeded();
  await capture("consent");
  await consent.check();
  await builder.getByRole("button",{name:"Subscribe",exact:true}).click();
  const builderConsent=builder.getByRole("checkbox",{name:pixBillingConsentText(productById("pix_builder")),exact:true});
  assert.equal(await builderConsent.isChecked(),false);
  assert.deepEqual(orders,[]);
  await builder.getByRole("button",{name:"Back",exact:true}).click();
  await starter.getByRole("button",{name:"Subscribe",exact:true}).click();
  assert.equal(await consent.isChecked(),false);
  await consent.check();
  // A session resuming on the canonical web origin must finish in this installed game's own origin.
  checkoutUrl="https://pixelcivilization.app/?unexpected=remove&purchase=complete&session_id=cs_test_canonical_fixture#outside";
  billing={state:"setup_open",setupUrl:"https://checkout.stripe.com/c/pay/resume",setupExpires:Date.now()+600000,productId:"pix_starter",renews:true,paidThrough:null};
  const receipt=page.waitForRequest(request=>new URL(request.url()).searchParams.get("session_id")==="cs_test_canonical_fixture");
  await submit.click();
  const normalized=new URL((await receipt).url());
  assert.equal(normalized.origin,origin);
  assert.deepEqual([...normalized.searchParams.keys()].sort(),["purchase","session_id"]);
  assert.equal(normalized.hash,"");
  assert.deepEqual(orders.shift(),{productId:"pix_starter",billingConsent:{accepted:true,version:PIX_BILLING_CONSENT_VERSION}});
  const resume=shop.getByRole("button",{name:"Resume card setup",exact:true});
  await resume.waitFor();
  await resume.scrollIntoViewIfNeeded();
  await capture("resume");
  await shop.getByRole("button",{name:"Checkout in progress"}).first().waitFor();
  assert.equal(await shop.getByRole("button",{name:"Checkout in progress"}).count(),4);
  await resume.click();
  if(desktop){
    await page.waitForURL("https://checkout.stripe.com/c/pay/resume");
    await page.goto(origin+"/?purchase=manage");
  }else{
    const link=shop.getByRole("link",{name:"Resume card setup on Stripe"});await link.waitFor();
    assert.equal(await link.getAttribute("href"),billing.setupUrl);
    assert.equal(await shop.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  }
  billing={...billing,setupUrl:"https://checkout.stripe.com@outside.example.test/session"};
  await shop.getByRole("button",{name:"Check payment status"}).click();
  await resume.waitFor({state:"detached"});
  await shop.getByRole("button",{name:"Cancel checkout",exact:true}).click();
  await shop.getByRole("button",{name:"Keep checkout",exact:true}).click();
  assert.equal(cancelCount,0);
  await shop.getByRole("button",{name:"Cancel checkout",exact:true}).click();
  await shop.getByRole("button",{name:"Confirm cancellation"}).click();
  await shop.getByText("Checkout canceled.",{exact:false}).waitFor();
  assert.equal(cancelCount,1);
  billing={state:"invoice_open",invoiceUrl:"https://invoice.stripe.com/i/fixture",renews:true,paidThrough:null};
  await page.goto(origin+"/?purchase=complete&session_id=cs_test_funded_setup");
  const invoice=shop.getByRole("link",{name:/Review and pay first invoice/});
  await invoice.waitFor();
  await invoice.scrollIntoViewIfNeeded();
  await capture("invoice");
  assert.equal(await invoice.getAttribute("href"),billing.invoiceUrl);
  await shop.getByRole("button",{name:"Checkout in progress"}).first().waitFor();
  billing={...billing,invoiceUrl:"https://outside.example.test/invoice"};
  await shop.getByRole("button",{name:"Check payment status"}).click();
  await invoice.waitFor({state:"detached"});
  const observed = new Promise(resolve=>{holdNextRead=resolve;});
  await page.evaluate(async()=>{
    const api=await import("/src/game/storeAccess.ts");
    window.delayedBillingRead=api.fetchStoreAccess();
  });
  await observed;
  await shop.getByRole("button",{name:"Cancel unpaid invoice"}).click();
  await shop.getByRole("button",{name:"Confirm cancellation"}).click();
  await shop.getByText("Checkout canceled.",{exact:false}).waitFor();
  assert.equal(cancelCount,2);
  await delayedRead();
  await page.evaluate(()=>window.delayedBillingRead);
  assert.equal(await shop.getByRole("button",{name:"Cancel unpaid invoice"}).count(),0);
  billing={state:"active",renews:true,paidThrough:Date.now()+28*86400000};
  await page.goto(origin+"/?purchase=manage");
  await shop.getByRole("button",{name:"Stop Pix renewal"}).click();
  await shop.getByRole("button",{name:"Keep renewal"}).click();
  await shop.getByRole("button",{name:"Stop Pix renewal"}).click();
  await shop.getByRole("button",{name:"Confirm stop"}).click();
  await shop.getByText("Monthly renewal is off.",{exact:false}).waitFor();
  assert.equal(billing.renews,false);
  assert.ok(!page.url().includes("session_id="));
  billing={state:"revoked",renews:false,paidThrough:null};
  await page.goto(origin+"/?purchase=manage");
  await shop.getByRole("heading",{name:"Pix access ended"}).waitFor();
  await shop.getByRole("button",{name:"Manage subscription"}).waitFor();
  assert.equal(await shop.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  console.log((desktop?"Desktop":"Mobile portable")+": verified consent, recovery, unpaid cancellation, trusted returns, refund and renewal controls.");
  await context.close();
  }
}catch(error){
  const page=browser.contexts()[0]?.pages()[0];
  if(page)console.error("Failed on",new URL(page.url()).pathname,(await page.locator("body").innerText()).slice(-1800));
  throw error;
}finally{await browser.close();}
