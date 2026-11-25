import { normalizeEra } from "./eraStyles";
import { prepareOfflineShell } from "../offlineShell";

type RomeArt = typeof import("./designs/romePilot");
let art: RomeArt | undefined;
let pending: Promise<void> | undefined;

export const currentRomeArt = () => art;
export const eraArtRevision = () => art ? 1 : 0;
export const isEraArtReady = (era: unknown) => normalizeEra(era) === "original" || Boolean(art);

export async function loadEraArt(era: unknown): Promise<void> {
  if (isEraArtReady(era)) return;
  pending ??= prepareOfflineShell().then(() => import("./designs/romePilot"))
    .then(module => { art = module; }).finally(() => { pending = undefined; });
  await pending;
}
