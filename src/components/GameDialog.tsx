import React, { useLayoutEffect, useRef } from "react";

type Props = {label:string; className:string; onDismiss?:()=>void; children:React.ReactNode};
const controls='button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]';

/** Native modal focus, Escape and background isolation also work in the offline game. */
export function GameDialog({label,className,onDismiss,children}:Props) {
  const ref=useRef<HTMLDialogElement>(null);
  useLayoutEffect(()=>{
    const dialog=ref.current!;
    const trigger=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    (dialog.querySelector<HTMLElement>("[data-dialog-focus]") ?? dialog.querySelector<HTMLElement>(controls))?.focus({preventScroll:true});
    return ()=>{
      dialog.close();
      if(trigger?.isConnected) trigger.focus({preventScroll:true});
      else document.querySelector<HTMLButtonElement>('[data-panel-toggle="more"]')?.focus({preventScroll:true});
    };
  },[]);
  return <dialog ref={ref} aria-label={label} aria-modal="true" className={"game-dialog "+className}
    onCancel={event=>{event.preventDefault();onDismiss?.();}}>{children}</dialog>;
}
