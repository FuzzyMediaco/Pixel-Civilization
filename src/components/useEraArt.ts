import { useEffect, useState } from "react";
import { isEraArtReady, loadEraArt } from "../game/eraArtLoader";
import type { EraKey } from "../game/eraStyles";

export function useEraArt(era: EraKey) {
  const [attempt,setAttempt] = useState(0);
  const [result,setResult] = useState<{era: EraKey; failed: boolean}>();
  useEffect(() => {
    if (isEraArtReady(era)) return;
    let live = true;
    void loadEraArt(era).then(
      () => { if (live) setResult({era,failed:false}); },
      () => { if (live) setResult({era,failed:true}); },
    );
    return () => { live = false; };
  },[era,attempt]);
  return {ready:isEraArtReady(era), failed:result?.era === era && result.failed,
    retry:() => {setResult(undefined);setAttempt(n => n + 1);}};
}
