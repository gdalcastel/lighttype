/** Clamp floating popovers inside the preview viewport (web + mobile). */
export function clampPopoverBox(
  anchor: { x: number; y: number } | null,
  containerSize: { width: number; height: number },
  popoverW: number,
  preferredTopGap = 48,
) {
  const margin = 12;
  const maxHeight = Math.max(220, containerSize.height - margin * 2);
  const width = Math.min(popoverW, Math.max(200, containerSize.width - margin * 2));

  let left = containerSize.width - width - margin;
  let top = margin + preferredTopGap;

  if (anchor) {
    left = anchor.x + 16;
    top = anchor.y - 24;

    if (left + width > containerSize.width - margin) {
      left = anchor.x - width - 16;
    }
    if (left < margin) left = margin;

    if (top + Math.min(maxHeight, 360) > containerSize.height - margin) {
      top = Math.max(margin, containerSize.height - maxHeight - margin);
    }
    if (top < margin) top = margin;
  } else if (containerSize.width < 720) {
    left = Math.max(margin, (containerSize.width - width) / 2);
    top = margin + 8;
  }

  const available = Math.max(180, containerSize.height - top - margin);

  return {
    left,
    top,
    width,
    maxHeight: Math.min(maxHeight, available),
  };
}
