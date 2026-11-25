import { useEffect, useState, useSyncExternalStore } from "react";
import { GameDialog } from "./GameDialog";
import { PlayerAccount } from "./PlayerAccount";
import { STORE_PRODUCTS, canUseProduct, productById, type StoreProduct } from "../game/storeCatalog.mjs";
import { cachedStoreAccess, confirmStorePurchase, fetchStoreAccess, finishWebCheckout, openBillingPortal, startWebCheckout, stopPixRenewal, subscribeStoreAccess, type StoreReceipt } from "../game/storeAccess";
import { pixBillingConsentText } from "../game/pixBillingConsent.mjs";
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
function stripeUrl(value: string | undefined, hosts: string[]) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && hosts.includes(url.hostname) && !url.username && !url.password && !url.port) return url.href;
  } catch { /* Wait for a refreshed billing snapshot. */ }
}
function checkoutReturn(address: string) {
  let url: URL;
  try { url = new URL(address); } catch { return; }
  const canonical = url.origin === "https://pixelcivilization.app" || url.origin === location.origin;
  const session = url.searchParams.get("session_id");
  if (canonical && !url.username && !url.password && url.pathname === "/" &&
      url.searchParams.getAll("purchase").length === 1 && url.searchParams.get("purchase") === "complete" &&
      url.searchParams.getAll("session_id").length === 1 && /^cs_[A-Za-z0-9_]{8,220}$/.test(session ?? "")) {
    const result = new URL("/",location.origin);
    result.search = new URLSearchParams({purchase:"complete",session_id:session!}).toString();
    return result.href;
  }
}
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
  const [confirmStop, setConfirmStop] = useState<"setup" | "renewal" | null>(null);
  const [selection, setSelection] = useState<{productId:string;account:string;accepted:boolean}>();
  useEffect(() => {setSelection(undefined);setConfirmStop(null);setExternalBilling(undefined);},[access.accountId]);

  const billing = access.pixBilling;
  const invoice = stripeUrl(billing?.invoiceUrl,["invoice.stripe.com","pay.stripe.com"]);
  const setup = billing?.state === "setup_open" && Number(billing.setupExpires) > Date.now()
    ? stripeUrl(billing.setupUrl,["checkout.stripe.com"]) : undefined;
  const preparing = billing?.state === "setup_open" || billing?.state === "invoice_open" || billing?.state === "processing";
  const planName = productById(billing?.productId ?? "")?.label ?? "Pix";

  const paidThrough = billing?.paidThrough ? new Date(billing.paidThrough).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}) : "";
  const [externalBilling,setExternalBilling]=useState<{href:string;label:string}>();
  function openWebBilling(address:string,label:string) {
    const receipt = checkoutReturn(address);
    if (receipt) { location.assign(receipt); return; }
    const href = stripeUrl(address,["checkout.stripe.com","buy.stripe.com","billing.stripe.com","invoice.stripe.com","pay.stripe.com"]);
    if(!href) throw Error("The billing link could not be verified.");
    if(navigator.userAgent.includes("PixelCivilizationOffline")) setExternalBilling({href,label});
    else location.assign(href);
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
      if (outcome === "complete") { history.replaceState(history.state,"",url.pathname); return; }
      url.searchParams.delete("purchase");
      url.searchParams.delete("session_id");
      history.replaceState(history.state,"",url);
    };
    if(outcome!=="complete"){
      if(outcome==="manage") setKind("subscription");
      finishReturn();return;
    }
    const cleanReturn = checkoutReturn(url.href);
    if (!cleanReturn) {
      setMessage("This receipt link is invalid. Refresh the Island Store to check your purchases.");
      history.replaceState(history.state,"",url.pathname);
      return;
    }
    if (url.href !== cleanReturn) history.replaceState(history.state,"",cleanReturn);
    const session=new URL(cleanReturn).searchParams.get("session_id")!;

    if (!access.accountId || access.accountId !== currentPlayer()?.id) {
      setAccountForm(true);
      setMessage("Sign in to the game account that opened checkout to check this receipt.");
      return;
    }
    let stopped=false;
    let retryTimer:number|undefined;
    let checks=0;
    async function check() {
      try {
        const checked = await finishWebCheckout(session!);
        if(stopped)return;
        setReceiptPending(false);
        const state = checked.pixBilling?.state;
        if (state && ["setup_open","invoice_open","processing","revoked"].includes(state)) {
          setKind("subscription");setMessage("");
        } else setMessage("Your purchase has been checked. Your library is up to date.");
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
  useEffect(() => {
    if (!access.accountId || (!preparing && !billing?.cancelPending)) return;
    const refresh = () => { if (document.visibilityState === "visible") void fetchStoreAccess(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [access.accountId, preparing, billing?.cancelPending]);
  const purchase=(p:StoreProduct)=>handle(async()=>{
    if(!access.accountId){setAccountForm(true);return;}
    const monthly = p.kind === "subscription" && !storeEdition;
    if(monthly && (selection?.productId !== p.id || selection?.account !== access.accountId)) {
      setSelection({productId:p.id,account:access.accountId,accepted:false}); return;
    }
    if(monthly && !selection?.accepted) return;
    if(!saveNow()){throw Error("Save your island before opening checkout.");}
    if(native){
      const receipt=await native.purchase(p.id,access.accountId);await deliver([receipt]);setMessage(p.label+" is in your library.");return;
    }
    if(storeEdition)throw Error("Update the app to connect to your device store.");
    openWebBilling(await startWebCheckout(p.id,monthly),"Continue to Stripe checkout");
    setSelection(undefined);
  });
  return <GameDialog label="Island Store" className="pc-shop" onDismiss={onClose}>
    <header><div><h1>Island Store</h1><p>Original, Real, Idle and Manager are free. Explore every time period in the Atlas and sample islands.</p></div>
      <button className="ui-btn" onClick={onClose} aria-label="Close store">Close</button></header>
    <nav aria-label="Store categories">{(Object.keys(kindNames) as StoreProduct["kind"][]).map(k=><button key={k} type="button" className="ui-btn" aria-pressed={k===kind} onClick={()=>{setKind(k);setSelection(undefined);}}>{kindNames[k]}</button>)}</nav>
    {accountForm && !access.accountId && <PlayerAccount saveNow={saveNow}/>}
    {kind==="subscription" && <>
      <p>Each plan includes game access and a monthly Pix allowance. Paid messages pause when you reach either limit.</p>
      {storeEdition ? <p>Monthly Pix purchases are coming to this store.</p> :
        <details className="pc-shop-terms">
          <summary>How billing and renewal work</summary>
          <p>Set up your payment method, then review your first Stripe invoice, including applicable tax. Your plan starts when you pay. It renews monthly while the next month’s AI allowance is funded. You can stop renewal here and keep the rest of your paid month.</p>
        </details>}
    </>}
    {billing && billing.state !== "ended" && !storeEdition && <section className="pc-shop-billing" aria-label="Your Pix billing">
      {billing.state === "setup_open" && <>
        <h2>Finish setting up {planName}</h2>
        <p>Resume card setup on Stripe. You’ll see the first invoice before paying.</p>
        {!setup && !billing.cancelPending && <p>Check payment status to refresh the card setup link.</p>}
        {setup && !billing.cancelPending && <button className="ui-btn" type="button" disabled={busy} onClick={()=>void handle(async()=>{
          if(!saveNow()) throw Error("Save your island before opening checkout.");
          openWebBilling(setup,"Resume card setup on Stripe");
        })}>Resume card setup</button>}
      </>}
      {billing.state === "revoked" && <>
        <h2>Pix access ended</h2>
        <p>A payment was refunded or disputed. You can review your Stripe billing history.</p>
      </>}
      {billing.state === "invoice_open" && <>
        <h2>Your first Pix invoice</h2>
        <p>Review the total on Stripe. Your plan starts after payment is confirmed.</p>
        {!invoice && !billing.cancelPending && <p>Check payment status to refresh the invoice link.</p>}
        {invoice && !billing.cancelPending && <a className="ui-btn" href={invoice} target="_blank" rel="noopener noreferrer">Review and pay first invoice ↗</a>}
      </>}
      {billing.state === "processing" && !billing.cancelPending && <p role="status">Stripe is confirming your Pix billing status.</p>}
      {billing.cancelPending && <p role="status">Your cancellation was requested. Stripe is confirming it.</p>}
      {(preparing || billing.cancelPending) && <button type="button" className="ui-btn" disabled={busy} onClick={()=>void handle(async()=>{await fetchStoreAccess();})}>Check payment status</button>}
      {billing.state === "active" && <p>{billing.renews ? "Monthly renewal is on." : "Monthly renewal is off."} {paidThrough && `Your current access runs through ${paidThrough}.`}</p>}
      {preparing && billing.renews && !billing.cancelPending && (confirmStop === "setup" ? <>
        <p>Cancel this checkout? Any unpaid Pix invoice will be closed. A payment Stripe has already confirmed keeps its paid term.</p>
        <button className="ui-btn" type="button" disabled={busy} onClick={()=>void handle(async()=>{
          const updated=await stopPixRenewal();setConfirmStop(null);
          setMessage(updated.pixBilling?.cancelPending ? "Your cancellation was requested." : updated.plan ? "Renewals are off. Your current paid term stays available." : "Checkout canceled. You can choose a plan again.");
        })}>Confirm cancellation</button>
        <button className="ui-btn" type="button" disabled={busy} onClick={()=>setConfirmStop(null)}>Keep checkout</button>
      </> : <button className="ui-btn" type="button" disabled={busy} onClick={()=>setConfirmStop("setup")}>{billing.state === "invoice_open" ? "Cancel unpaid invoice" : "Cancel checkout"}</button>)}
      {billing.state === "active" && billing.renews && (confirmStop === "renewal" ? <>
        <p>Stop future Pix renewals? You keep access through this paid period.</p>
        <button type="button" className="ui-btn" disabled={busy} onClick={()=>void handle(async()=>{
          const updated=await stopPixRenewal();setConfirmStop(null);
          setMessage(updated.pixBilling?.cancelPending ? "Your cancellation was requested." : "Monthly renewal has been stopped.");
        })}>Confirm stop</button>
        <button type="button" className="ui-btn" disabled={busy} onClick={()=>setConfirmStop(null)}>Keep renewal</button>
      </> : <button type="button" className="ui-btn" disabled={busy} onClick={()=>setConfirmStop("renewal")}>Stop Pix renewal</button>)}
    </section>}
    {access.plan && <p role="status">{productById(access.plan)?.label} · {access.usage.messages} of {access.usage.limit} messages · {dollars(access.usage.spendMicros/10000)} of {dollars(access.usage.budgetMicros/10000)} AI usage this period.</p>}
    {externalBilling && <p role="status" className="pc-shop-status"><a className="ui-btn" href={externalBilling.href}>{externalBilling.label} ↗</a></p>}
    {receiptPending && <button className="ui-btn" type="button" onClick={()=>retryReceipt(n=>n+1)}>Check purchase again</button>}
    {message && <p role="status" className="pc-shop-status">{message}</p>}
    <section className="pc-shop-grid" data-kind={kind} aria-label={kindNames[kind]}>{STORE_PRODUCTS.filter(p=>p.kind===kind).map(p=>{
      const listing=listings.find(l=>l.id===p.id), owned=canUseProduct(access,p.id);
      const admission = access.pixAdmission?.tiers[p.id];
      const isPlan = p.kind === "subscription";
      const checkoutPending = isPlan && preparing;
      const tierReady = !isPlan || (!checkoutPending && !storeEdition && admission?.available === true && access.providers.length >= 3 && access.webSubscriptionsReady === true);
      const available = tierReady && (!storeEdition || Boolean(native)) && access.readyStores.includes(native?.platform ?? "stripe") && (!native || Boolean(listing));
      const unavailableLabel = checkoutPending ? "Checkout in progress" : isPlan && !storeEdition && admission?.reason === "wallet_capacity" ? "At capacity" : "Purchases opening soon";
      const price=listing?.price??dollars(p.usdCents);
      const reviewing = isPlan && available && !owned && selection?.account === access.accountId && selection?.productId === p.id;
      return <article key={p.id} data-featured={p.id===initial} data-reviewing={reviewing || undefined}>
        {p.era && <img alt="" src={tourImage(p.era,"skyline")} loading="lazy"/>}
        <h2>{p.label}</h2><strong>{price}{p.kind==="subscription"?" / month":" once"}</strong>
        {p.era && <a href={"./#world="+tourId(p.era,"starter")+"&era="+p.era} target="_blank" rel="noreferrer">Explore free island ↗</a>}
        {p.kind==="mode" && <p>{p.mode==="god"?"Sculpt terrain, control time and build without limits on your own islands.":"Balance growth, upkeep and emergencies on your own islands."}</p>}
        {p.kind==="subscription" && <p>{p.messages?.toLocaleString()} messages · {dollars((p.budgetMicros??0)/10000)} AI usage. {p.id==="pix_complete"?"Includes both modes and all ten time periods.":"Includes "+p.includes.map(id=>productById(id)?.label).join(", ")+"."}</p>}
        {reviewing ? <fieldset className="pc-shop-consent">
          <legend>Monthly card authorization</legend>
          <label><input type="checkbox" autoFocus checked={selection.accepted} onChange={e=>setSelection({...selection,accepted:e.target.checked})}/><span>{pixBillingConsentText(p)}</span></label>
          <button className="ui-btn" type="button" disabled={busy||!selection.accepted} onClick={()=>void purchase(p)}>Continue to card setup</button>
          <button className="ui-btn" type="button" disabled={busy} onClick={()=>setSelection(undefined)}>Back</button>
        </fieldset> : <button className="ui-btn" disabled={busy||owned||!available} onClick={()=>void purchase(p)}>
          {owned?"In your library":!available?unavailableLabel:!access.accountId?"Sign in to purchase":isPlan?"Subscribe":"Unlock "+p.label}</button>}
      </article>;
    })}</section>
    <footer>{native && <button className="ui-btn" disabled={busy} onClick={()=>void handle(async()=>{if(!access.accountId){setAccountForm(true);return;}const receipts=await native.restore();await deliver(receipts);await fetchStoreAccess();setMessage("Your purchases have been checked.");})}>Restore purchases</button>}
      {(native||(!storeEdition&&(access.plan || billing?.state === "revoked"))) && <button className="ui-btn" disabled={busy} onClick={()=>void handle(async()=>{if(native)await native.manage();else openWebBilling(await openBillingPortal(),"Manage billing in your browser");})}>Manage subscription</button>}
      <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy</a><a href="/support.html" target="_blank" rel="noreferrer">Support</a>{native?.platform==="apple" && <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noreferrer">Apple terms of use</a>}
    </footer>
  </GameDialog>;
}
