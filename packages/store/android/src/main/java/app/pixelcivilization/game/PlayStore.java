package app.pixelcivilization.game;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.webkit.JavaScriptReplyProxy;
import com.android.billingclient.api.*;
import org.json.*;
import java.util.*;
import java.util.function.Consumer;

final class PlayStore implements PurchasesUpdatedListener {
    private final Activity activity;
    private final BillingClient client;
    private final Runnable changed;
    private final Map<String,Offer> offers = new HashMap<>();
    private final List<Runnable> waiting = new ArrayList<>();
    private boolean connecting;
    private Reply buying;
    private String requestedSku;

    PlayStore(Activity activity, Runnable changed) {
        this.activity = activity;
        this.changed = changed;
        client = BillingClient.newBuilder(activity).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
    }
    static JSONObject json(Object... pairs) {
        JSONObject obj = new JSONObject();
        try { for (int i=0;i<pairs.length;i+=2) obj.put((String)pairs[i],pairs[i+1]); }
        catch(JSONException invalid) { throw new IllegalArgumentException(invalid); }
        return obj;
    }
    final class Reply {
        final String id;
        final JavaScriptReplyProxy target;
        boolean sent;
        Reply(String id, JavaScriptReplyProxy target) {this.id=id;this.target=target;}
        void send(String key,Object value) {
            activity.runOnUiThread(()-> {
                if (!sent && !activity.isDestroyed()) {
                    sent=true;
                    target.postMessage(json("id",id,key,value).toString());
                }
            });
        }
        void ok(Object value) { send("value",value); }
        void fail(String message) { send("error",message); }
    }
    private boolean ok(BillingResult result) { return result.getResponseCode()==BillingClient.BillingResponseCode.OK; }
    private String error(BillingResult result) {
        return switch(result.getResponseCode()) {
            case BillingClient.BillingResponseCode.USER_CANCELED -> "Purchase canceled.";
            case BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> "Already owned. Use Restore Purchases.";
            case BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> "This product is unavailable in your store.";
            default -> "Google Play could not complete this request. Please try again.";
        };
    }
    void handle(String raw, JavaScriptReplyProxy target) {
        try {
            JSONObject request=new JSONObject(raw);
            Reply reply=new Reply(request.getString("id"),target);
            String action=request.getString("action");
            JSONArray args=request.getJSONArray("args");
            if (action.equals("manage")) {
                try { activity.startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://play.google.com/store/account/subscriptions"))); reply.ok(true); }
                catch (Exception e) { reply.fail("Open Subscriptions in Google Play to manage your plan."); }
                return;
            }
            Runnable perform=()-> {
                if (!client.isReady()) { reply.fail("Google Play Billing is unavailable on this device.");return; }
                try {
                    switch(action) {
                        case "products" -> products(args.getJSONArray(0),reply);
                        case "purchase" -> purchase(args.getString(0),UUID.fromString(args.getString(1)).toString(),reply);
                        case "restore","pending" -> owned(all -> { JSONArray rows=new JSONArray(); for(Purchase p:all) for(String id:p.getProducts()) rows.put(receipt(p,id)); reply.ok(rows); }, reply);
                        // The verification service acknowledges only after durably granting access.
                        case "finish" -> reply.ok(true);
                        default -> reply.fail("Unknown store command.");
                    }
                } catch (Exception invalid) { reply.fail("Invalid store request."); }
            };
            if (client.isReady()) { perform.run(); return; }
            waiting.add(perform);
            if (connecting) return;
            connecting=true;
            client.startConnection(new BillingClientStateListener(){
                public void onBillingServiceDisconnected() {}
                public void onBillingSetupFinished(BillingResult result) {
                    activity.runOnUiThread(()->{connecting=false;List<Runnable> jobs=new ArrayList<>(waiting);waiting.clear();jobs.forEach(Runnable::run);});
                }
            });
        } catch (JSONException ignored) { }
    }
    private static boolean sub(String sku) {return sku.startsWith("pix_");}
    private record Offer(ProductDetails item,String token,String price,String currency){}
    private Offer offer(ProductDetails p) {
        if (BillingClient.ProductType.SUBS.equals(p.getProductType())) {
            List<ProductDetails.SubscriptionOfferDetails> plans=p.getSubscriptionOfferDetails();
            if (plans==null) return null;
            for (var plan : plans) {
                if (plan.getOfferId()!=null) continue;
                var phases=plan.getPricingPhases().getPricingPhaseList();
                if (phases.size()!=1 || !"P1M".equals(phases.get(0).getBillingPeriod())) continue;
                var price=phases.get(0);
                return new Offer(p,plan.getOfferToken(),price.getFormattedPrice(),price.getPriceCurrencyCode());
            }
        } else {
            var prices=p.getOneTimePurchaseOfferDetailsList();
            if ((prices==null || prices.isEmpty()) && p.getOneTimePurchaseOfferDetails()!=null) prices = Collections.singletonList(p.getOneTimePurchaseOfferDetails());
            if (prices!=null) for (var price:prices) if(price.getOfferId()==null && price.getRentalDetails()==null)
                return new Offer(p,price.getOfferToken(),price.getFormattedPrice(),price.getPriceCurrencyCode());
        }
        return null;
    }
    private void products(JSONArray ids,Reply reply) throws JSONException {
        Map<String,List<QueryProductDetailsParams.Product>> groups=new LinkedHashMap<>();
        for (int i=0;i<ids.length();i++) {
            String id=ids.getString(i);
            if (!id.matches("(era|mode|pix)_[a-z0-9]+")) continue;
            offers.remove(id);
            String type=sub(id)?BillingClient.ProductType.SUBS:BillingClient.ProductType.INAPP;
            groups.computeIfAbsent(type,k->new ArrayList<>()).add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(type).build());
        }
        JSONArray available=new JSONArray();
        if(groups.isEmpty()) {reply.ok(available);return;}
        int[] remaining={groups.size()};
        for(var group:groups.values()) client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(group).build(),
            (result,details)->activity.runOnUiThread(()->{
                if(!ok(result)) {reply.fail(error(result));return;}
                for(ProductDetails p:details.getProductDetailsList()) {
                    Offer chosen=offer(p);
                    if(chosen==null) continue;
                    offers.put(p.getProductId(),chosen);
                    available.put(json("id",p.getProductId(),"price",chosen.price(),"currency",chosen.currency(),"type",p.getProductType()));
                }
                if (--remaining[0]==0) reply.ok(available);
            }));
    }
    private void owned(Consumer<List<Purchase>> done,Reply reply) {
        List<Purchase> all=new ArrayList<>();int[] remaining={2};
        for(String type : Arrays.asList(BillingClient.ProductType.INAPP,BillingClient.ProductType.SUBS)) {
            client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(type).build(),(result,purchases)->activity.runOnUiThread(()->{
                if(!ok(result)) {reply.fail(error(result));return;}
                for(Purchase p:purchases) if(p.getPurchaseState()==Purchase.PurchaseState.PURCHASED) all.add(p);
                if(--remaining[0]==0) done.accept(all);
            }));
        }
    }
    private JSONObject receipt(Purchase p,String sku) {
        return json("platform","google","productId",sku,"purchaseToken",p.getPurchaseToken(),"transactionId",p.getOrderId());
    }
    private void purchase(String sku,String account,Reply reply) {
        Offer offer=offers.get(sku);
        if (offer==null) {reply.fail("Refresh the store to check this item's price and availability.");return;}
        if (buying!=null) {reply.fail("Finish the current store purchase first.");return;}
        var product=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(offer.item());
        if(offer.token()!=null && !offer.token().isEmpty()) product.setOfferToken(offer.token());
        var flow=BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(product.build())).setObfuscatedAccountId(account);
        owned(purchases->{
            if (buying!=null) {reply.fail("Finish the current purchase first.");return;}
            for(Purchase p:purchases) for(String old:p.getProducts()) {
                if (old.equals(sku)) {reply.ok(receipt(p,sku));return;}
                if (sub(sku) && sub(old)) {
                    var owner=p.getAccountIdentifiers();
                    if (owner==null || !account.equals(owner.getObfuscatedAccountId())) {reply.fail("Sign into the game account that owns your current Pix plan.");return;}
                    flow.setSubscriptionUpdateParams(BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                        .setOldPurchaseToken(p.getPurchaseToken())
                        .setSubscriptionReplacementMode(BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.WITH_TIME_PRORATION).build());
                }
            }
            buying=reply;requestedSku=sku;
            BillingResult result=client.launchBillingFlow(activity,flow.build());
            if(!ok(result)){buying=null;reply.fail(error(result));}
        },reply);
    }
    @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> purchases) {
        activity.runOnUiThread(()->{
            Reply reply=buying;buying=null;
            if(reply!=null) {
                if(!ok(result)) reply.fail(error(result));
                else {
                    boolean found=false;
                    if(purchases!=null) for(Purchase p:purchases) if(p.getProducts().contains(requestedSku)) {
                        found=true;
                        if(p.getPurchaseState()==Purchase.PurchaseState.PURCHASED) reply.ok(receipt(p,requestedSku));
                        else reply.fail("Your purchase is pending. Restore it after Google Play confirms payment.");
                        break;
                    }
                    if(!found)reply.fail("Use Restore Purchases to retrieve this order.");
                }
            }
            if(ok(result)) changed.run();
        });
    }
    void close() { client.endConnection(); }
}
