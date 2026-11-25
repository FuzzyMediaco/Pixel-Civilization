import {createHash} from "node:crypto";
import {writeFile,mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {STORE_PRODUCTS} from "../../src/game/storeCatalog.mjs";

const out=fileURLToPath(new URL("./generated/",import.meta.url));
await mkdir(out,{recursive:true});
const uuid=name=>createHash("sha256").update("pixel-civ/"+name).digest("hex").slice(0,32).replace(/(.{8})(.{4})(.{4})(.{4})(.*)/,"$1-$2-$3-$4-$5");
const group=uuid("pix");
const localize=p=>[{
  displayName:p.label,locale:"en_US",
  description:p.kind==="subscription"?`Up to ${p.messages.toLocaleString("en-US")} Pix messages per month, subject to the displayed usage budget.`:
    p.kind==="era"?`Unlock the ${p.label} appearance for your islands.`:`Unlock ${p.label} on your account.`
}];
const testProduct=p=>({displayPrice:(p.usdCents/100).toFixed(2),internalID:uuid(p.id),localizations:localize(p),productID:p.id,referenceName:p.label});
const subscriptions=STORE_PRODUCTS.filter(p=>p.kind==="subscription");
const fixture={identifier:uuid("storekit-configuration"),products:STORE_PRODUCTS.filter(p=>p.kind!=="subscription").map(p=>({
  ...testProduct(p),type:"NonConsumable",familyShareable:false
})),nonRenewingSubscriptions:[],settings:{_locale:"en_US",_storefront:"USA",_failTransactionsEnabled:false},
subscriptionGroups:[{id:group,name:"Pix",localizations:[],subscriptions:subscriptions.map((p,i)=>({
  ...testProduct(p),adHocOffers:[],codeOffers:[],familyShareable:false,groupNumber:subscriptions.length-i,
  introductoryOffer:null,recurringSubscriptionPeriod:"P1M",subscriptionGroupID:group,type:"RecurringSubscription"
}))}],version:{major:3,minor:0}};
await writeFile(out+"/PixelCivilization.storekit",JSON.stringify(fixture,null,2)+"\n");
const products=STORE_PRODUCTS.map(p=>({id:p.id,name:p.label,priceUSD:(p.usdCents/100).toFixed(2),
  appleType:p.kind==="subscription"?"AUTO_RENEWABLE_SUBSCRIPTION":"NON_CONSUMABLE",
  playType:p.kind==="subscription"?"SUBS":"INAPP",
  ...(p.kind==="subscription"?{period:"P1M",appleGroup:"Pix",playBasePlan:"monthly",maxMessages:p.messages,includes:p.includes}:{}),
  description:localize(p)[0].description}));
await writeFile(out+"/store-products.json",JSON.stringify(products,null,2)+"\n");
console.log(`Prepared ${products.length} products for App Store Connect, Play Console and local StoreKit testing.`);
