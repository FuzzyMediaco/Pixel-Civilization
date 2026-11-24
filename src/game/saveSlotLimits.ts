export const INITIAL_SAVE_SLOTS = 3;
export const MAX_SAVE_SLOTS = 10;
export const isSaveSlotIndex = (index: number) =>
  Number.isInteger(index) && index >= 0 && index < MAX_SAVE_SLOTS;
