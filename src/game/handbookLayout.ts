export const handbookLayout = { cell: 192, gap: 3, left: 120, top: 94, footer: 5 } as const;
const { cell, gap, left, top, footer } = handbookLayout;
export const sheetSize = { width: left + (cell + gap) * 5, height: top + (cell + gap) * 4 + footer };

/** Percentage-based sprite coordinates scale to any size without decoding twenty individual images. */
export function getHandbookFrame(level: number, variant: number) {
  const x = left + (level - 1) * (cell + gap),
    y = top + variant * (cell + gap);
  return {
    backgroundSize: (sheetSize.width / cell) * 100 + "% " + (sheetSize.height / cell) * 100 + "%",
    backgroundPosition: (x / (sheetSize.width - cell)) * 100 + "% " + (y / (sheetSize.height - cell)) * 100 + "%",
  };
}
