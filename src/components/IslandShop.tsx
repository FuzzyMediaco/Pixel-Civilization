import { useEffect, useState, useSyncExternalStore } from "react";
import { GameDialog } from "./GameDialog";
import { PlayerAccount } from "./PlayerAccount";
import { STORE_PRODUCTS, canUseProduct, productById, type StoreProduct } from "../game/storeCatalog.mjs";
import { cachedStoreAccess, confirmStorePurchase, fetchStoreAccess, finishWebCheckout, openBillingPortal, startWebCheckout, subscribeStoreAccess, type StoreReceipt } from "../game/storeAccess";
import { currentPlayer } from "../game/deviceSaves";
import { tourId, tourImage } from "../game/periodTours";
import "./islandShop.css";

type Listing = {id:string;price:string;type:"inapp"|"subs"};
interface NativeStore {
  platform:"apple"|"google";
  products(ids:string[]):Promise<Listing[]>; purchase(id:string,account:string):Promise<StoreReceipt>;
  pending():Promise<StoreReceipt[]>; restore():Promise<StoreReceipt[]>; finish(receipt:StoreReceipt):Promise<unknown>; manage():Promise<unknown>;
}
export function nativeShop() {return (window as Window & {pixelStore?:NativeStore}).pixelStore;}
export const useStoreAccess = () => useSyncExternalStore(subscribeStoreAccess,cachedStoreAccess);
const dollars=(cents:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
const kindNames={era:"Time periods",mode:"Modes",subscription:"Pix plans"} as const;

export function IslandShop({initial,onClose,saveNow}:{initial?:string;onClose:()=>void;saveNow:()=>boolean}) {
  const access=useStoreAccess(), native=nativeShop();
  const storeEdition=Boolean(native)||navigator.userAgent.includes("PixelCivilizationStore/");
  const [kind,setKind]=useState<StoreProduct["kind"]>(productById(initial??"")?.kind??"era");
  const [listings,setListings]=useState<Listing[]>([]);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [accountForm,setAccountForm]=useState(false);
  const [receiptAttempt,retryReceipt]=useState(0);
  const [receiptPending,setReceiptPending]=useState(false);
  const [externalBilling,setExternalBilling]=useState<{href:string;label:string}>();
  function openWebBilling(address:string,label:string) {
    const url=new URL(address);
    if(url.protocol!=="https:" || !["checkout.stripe.com","buy.stripe.com","billing.stripe.com"].includes(url.hostname)) throw Error("The billing link could not be verified.");
    if(navigator.userAgent.includes("PixelCivilizationOffline")) setExternalBilling({href:url.href,label});
    else location.assign(url.href);
  }
  async function handle(task:()=>Promise<void>) {
    if(busy)return;setBusy(true);setMessage("");setExternalBilling(undefined);
    try {await task();}catch(error){setMessage(error instanceof Error?error.message:"The purchase could not be completed.");}
    finally {setBusy(false);}
  }
  async function deliver(receipts:StoreReceipt[]) {
    if(!native)return;
    for(const receipt of receipts){await confirmStorePurchase(receipt);await native.finish(receipt);}
  }
  useEffect(()=>{
    void fetchStoreAccess();
    if(!native)return;
    let active=true;
    native.products(STORE_PRODUCTS.map(p=>p.id)).then(items=>{if(active)setListings(items);}).catch(()=>{if(active)setMessage("Store prices are unavailable on this device.");});
    return ()=>{active=false;};
  },[native]);
  useEffect(()=>{
    if(!native || !access.accountId)return;
    const pending=()=>{void native.pending().then(deliver).catch(err=>setMessage(String(err?.message??err)));};
    pending();window.addEventListener("pixel-store-purchases-updated",pending);
    return ()=>window.removeEventListener("pixel-store-purchases-updated",pending);
  },[native,access.accountId]);
  useEffect(()=>{
    const url=new URL(location.href);
    const outcome=url.searchParams.get("purchase");
    if(!outcome)return;
    const finishReturn=()=>{
      url.searchParams.delete("purchase");
      url.searchParams.delete("session_id");
      history.replaceState(history.state,"",url);
    };
    if(outcome!=="complete"){finishReturn();return;}
    const session=url.searchParams.get("session_id");
    if(!session){setMessage("The receipt link is missing its checkout number.");return;}
    if(!access.accountId || access.accountId!==currentPlayer()?.id)return;
    let stopped=false;
    let retryTimer:number|undefined;
    let checks=0;
    async function check() {
      try {
        await finishWebCheckout(session!);
        if(stopped)return;
        setReceiptPending(false);
        setMessage("Your purchase has been checked. Your library is up to date.");
        finishReturn();
      } catch(error) {
        if(stopped)return;
        setReceiptPending(true);
        if((error as {code?:string}).code==="checkout_pending") {
          setMessage("Waiting for Stripe to confirm your payment. You can keep playing.");
          if(++checks<6)retryTimer=window.setTimeout(check,Math.min(1000*2**checks,15000));
        } else setMessage(error instanceof Error?error.message:"Try checking your receipt again.");
      }
    }
    void check();
    return ()=>{stopped=true;window.clearTimeout(retryTimer);};
  },[access.accountId,receiptAttempt]);
  const purchase=(p:StoreProduct)=>handle(async()=>{
    if(!access.accountId){setAccountForm(true);return;}
    if(!saveNow()){throw Error("Save your island before opening checkout.");}
    if(native){
      const receipt=await native.purchase(p.id,access.accountId);await deliver([receipt]);setMessage(p.label+" is in your library.");return;
    }
    if(storeEdition)throw Error("Update the app to connect to your device store.");
    openWebBilling(await startWebCheckout(p.id),"Continue to Stripe checkout");
  });
  return <GameDialog label="Island Store" className="pc-shop" onDismiss={onClose}>
    <header><div><h1>Island Store</h1><p>Original, Real, Idle and Manager are free. Explore every time period in the Atlas and sample islands.</p></div>
      <button className="ui-btn" onClick={onClose} aria-label="Close store">Close</button></header>
    <nav aria-label="Store categories">{(Object.keys(kindNames) as StoreProduct["kind"][]).map(k=><button key={k} type="button" className="ui-btn" aria-pressed={k===kind} onClick={()=>setKind(k)}>{kindNames[k]}</button>)}</nav>
    {accountForm && !access.accountId && <PlayerAccount saveNow={saveNow}/>}
    {kind==="subscription" && <p>Pix plans renew monthly. Each includes a message allowance and an AI usage budget. The first limit reached pauses paid messages until renewal. Includes are available while subscribed.</p>}
    {access.plan && <p role="status">{productById(access.plan)?.label} · {access.usage.messages} of {access.usage.limit} messages · {dollars(access.usage.spendMicros/10000)} of {dollars(access.usage.budgetMicros/10000)} AI usage this period.</p>}
    {externalBilling && <p role="status" className="pc-shop-status"><a className="ui-btn" href={externalBilling.href}>{externalBilling.label} ↗</a></p>}
    {receiptPending && <button className="ui-btn" type="button" onClick={()=>retryReceipt(n=>n+1)}>Check purchase again</button>}
    {message && <p role="status" className="pc-shop-status">{message}</p>}
    <section className="pc-shop-grid" aria-label={kindNames[kind]}>{STORE_PRODUCTS.filter(p=>p.kind===kind).map(p=>{
      const listing=listings.find(l=>l.id===p.id), owned=canUseProduct(access,p.id);
      const available=(!storeEdition||Boolean(native)) && access.readyStores.includes(native?.platform??"stripe") && (!native||Boolean(listing)) && (p.kind!=="subscription"||(access.providers.length>=3 && (native || access.webSubscriptionsReady!==false)));
      const price=listing?.price??dollars(p.usdCents);
      return <article key={p.id} data-featured={p.id===initial}>
        {p.era && <img alt="" src={tourImage(p.era,"skyline")} loading="lazy"/>}
        <h2>{p.label}</h2><strong>{price}{p.kind==="subscription"?" / month":" once"}</strong>
        {p.era && <a href={"./#world="+tourId(p.era,"starter")+"&era="+p.era} target="_blank" rel="noreferrer">Explore free island ↗</a>}
        {p.kind==="mode" && <p>{p.mode==="god"?"Sculpt terrain, control time and build without limits on your own islands.":"Balance growth, upkeep and emergencies on your own islands."}</p>}
        {p.kind==="subscription" && <p>{p.messages?.toLocaleString()} messages · {dollars((p.budgetMicros??0)/10000)} AI usage. {p.id==="pix_complete"?"Includes both modes and all ten time periods.":"Includes "+p.includes.map(id=>productById(id)?.label).join(", ")+"."}</p>}
        <button className="ui-btn" disabled={busy||owned||(!available&&Boolean(access.accountId))} onClick={()=>void purchase(p)}>
          {owned?"In your library":!access.accountId?"Sign in to purchase":!available?"Purchases opening soon":p.kind==="subscription"?"Subscribe":"Unlock "+p.label}</button>
      </article>;
    })}</section>
    <footer>{native && <button className="ui-btn" disabled={busy} onClick={()=>void handle(async()=>{if(!access.accountId){setAccountForm(true);return;}const receipts=await native.restore();await deliver(receipts);await fetchStoreAccess();setMessage("Your purchases have been checked.");})}>Restore purchases</button>}
      {(native||(!storeEdition&&access.plan)) && <button className="ui-btn" disabled={busy} onClick={()=>void handle(async()=>{if(native)await native.manage();else openWebBilling(await openBillingPortal(),"Manage billing in your browser");})}>Manage subscription</button>}
      <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy</a><a href="/support.html" target="_blank" rel="noreferrer">Support</a>{native?.platform==="apple" && <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noreferrer">Apple terms of use</a>}
    </footer>
  </GameDialog>;
}
