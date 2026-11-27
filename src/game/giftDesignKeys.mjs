const prefix = "pixel_civ_gift_design_";
export const giftDesignKey = id => prefix + id;
export const isGiftDesignKey = key => /^pixel_civ_gift_design_[a-f0-9]{32}$/.test(key);
export const giftDesignId = key => key.slice(prefix.length);
