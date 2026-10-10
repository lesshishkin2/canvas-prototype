export const TOOL_INSET = 8;
export const TOOL_GAP = 6;
export const TOP = 66;

const intersects = (a, b) =>
  a.left < b.right &&
  a.right > b.left &&
  a.top < b.bottom + TOOL_GAP &&
  a.bottom + TOOL_GAP > b.top;

// Place ancestors first. Descendants yield space without moving the parent.
export function placeToolbar(target, anchor, size, viewport, ancestors = []) {
  const section = target.kind === "section";
  if (anchor.bottom < TOP + 4 || anchor.top > viewport.height) return null;
  const width = section ? anchor.width : size.width;
  let left = section
    ? anchor.left
    : target.kind === "image"
      ? anchor.left + (anchor.width - width) / 2
      : anchor.right - width - TOOL_INSET;
  let top;
  if (section) {
    top = Math.max(TOP, anchor.top);
    if (top + size.height > anchor.bottom) return null;
  } else if (target.kind === "link" || target.placement === "above") {
    top = anchor.top - size.height - 7;
    if (top < TOP + 6) top = anchor.bottom + 7;
  } else top = Math.max(TOP + 6, anchor.top + TOOL_INSET);
  if (!section) left = Math.max(8, Math.min(left, viewport.width - width - 12));
  top = Math.max(TOP + 4, Math.min(top, viewport.height - size.height - 8));
  const rect = () => ({
    left,
    top,
    width,
    height: size.height,
    right: left + width,
    bottom: top + size.height,
  });
  const originalTop = top;
  for (const ancestor of ancestors) {
    if (intersects(rect(), ancestor)) top = ancestor.bottom + TOOL_GAP;
  }
  if (
    (target.kind === "link" || target.placement === "above") &&
    top < anchor.bottom &&
    top + size.height > anchor.top
  ) {
    // Stacking below a section must not place tools across a menu/button label.
    top = anchor.bottom + 7;
    for (const ancestor of ancestors) {
      if (intersects(rect(), ancestor)) top = ancestor.bottom + TOOL_GAP;
    }
  }
  if (top + size.height > viewport.height - 8) {
    // At the bottom edge keep the parent fixed and use free space to its left.
    top = Math.min(originalTop, viewport.height - size.height - 8);
    for (const ancestor of [...ancestors].reverse()) {
      if (intersects(rect(), ancestor)) left = ancestor.left - width - TOOL_GAP;
    }
    if (left < 8) return null;
  }
  return { ...rect(), sectionWidth: section ? width : undefined };
}
