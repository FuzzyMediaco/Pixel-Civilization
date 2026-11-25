export const PIX_BILLING_CONSENT_VERSION = "pix-web-monthly-v1";

export function pixBillingConsentText(plan) {
  const price = "US$" + (plan.usdCents / 100).toFixed(2);
  return (
    "I authorize SLF Media Group to save my card for " + plan.label + ". " +
    "I will review and pay the first invoice separately. After that, SLF Media Group may charge my saved card " +
    price + " plus applicable tax once per month for " + plan.label + " when the next month’s allowance is funded. " +
    "I can stop future renewals in the Island Store before the next term begins and keep access through my paid term."
  );
}

