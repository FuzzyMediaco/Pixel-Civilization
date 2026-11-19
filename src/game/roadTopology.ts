/** Axis of a through deck at a separated crossing. 0 is north–south, 1 is east–west. */
export function separatedDeckAxis(mask: number): number {
  const arms = mask & 15;
  const ramps = (mask >> 8) & arms;
  if (ramps === 5 && (arms & 10)) return 1;
  if (ramps === 10 && (arms & 5)) return 0;
  return -1;
}
