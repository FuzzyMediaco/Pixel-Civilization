import React from "react";

export interface TabItem<T extends string> { id: T; label: string; badge?: number }

/** Segmented control: at most four tabs on one row. */
export function Tabs<T extends string>({label, items, value, onChange}: {label: string; items: TabItem<T>[]; value: T; onChange: (id: T) => void}) {
  return <div className="ui-tabs" role="tablist" aria-label={label}>
    {items.map(item => <button key={item.id} type="button" role="tab" aria-selected={item.id === value} onClick={() => onChange(item.id)}>
      {item.label}{item.badge ? <span className="ui-tab-badge">{item.badge}</span> : null}
    </button>)}
  </div>;
}
