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
  const bounds = {
    left: viewport.left ?? 0,
    top: viewport.top ?? TOP,
    right: viewport.right ?? viewport.width,
    bottom: viewport.bottom ?? viewport.height,
  };
  if (viewport.touch)
    return placeTouchToolbar(target, anchor, size, bounds, ancestors);
  const ceiling = bounds.top;
  const section = target.kind === "section";
  const above = target.kind === "link" || target.placement === "above";
  if (anchor.bottom < ceiling + 4 || anchor.top > bounds.bottom) return null;
  const width = section ? anchor.width : size.width;
  let left = section
    ? anchor.left
    : target.kind === "image"
      ? anchor.left + (anchor.width - width) / 2
      : anchor.right - width - (above ? 0 : TOOL_INSET);
  let top;
  if (section) {
    top = Math.max(ceiling, anchor.top);
    if (top + size.height > anchor.bottom) return null;
  } else if (above) {
    top = anchor.top - size.height - 7;
    if (top < ceiling + 6) top = anchor.bottom + 7;
  } else if (target.kind === "image") {
    top = anchor.top + (anchor.height - size.height) / 2;
  } else top = Math.max(ceiling + 6, anchor.top + TOOL_INSET);
  if (!section)
    left = Math.max(bounds.left + 8, Math.min(left, bounds.right - width - 12));
  top = Math.max(
    section ? ceiling : ceiling + 4,
    Math.min(top, bounds.bottom - size.height - 8),
  );
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
  if (above && top < anchor.bottom && top + size.height > anchor.top) {
    // Stacking below a section must not place tools across a menu/button label.
    top = anchor.bottom + 7;
    for (const ancestor of ancestors) {
      if (intersects(rect(), ancestor)) top = ancestor.bottom + TOOL_GAP;
    }
  }
  if (top + size.height > bounds.bottom - 8) {
    // At the bottom edge keep the parent fixed and use free space to its left.
    top = Math.min(originalTop, bounds.bottom - size.height - 8);
    for (const ancestor of [...ancestors].reverse()) {
      if (intersects(rect(), ancestor)) left = ancestor.left - width - TOOL_GAP;
    }
    if (left < bounds.left + 8) return null;
  }
  // A clipped card must not pin its actions below its own bottom edge.
  if (target.kind === "item" && !above && top + size.height > anchor.bottom)
    return null;
  return { ...rect(), sectionWidth: section ? width : undefined };
}

function placeTouchToolbar(target, anchor, size, bounds, ancestors) {
  const section = target.kind === "section";
  const compact =
    target.kind === "item" && anchor.height < size.height + TOOL_INSET * 2;
  const outside =
    target.kind === "link" || target.placement === "above" || compact;
  const width = section
    ? Math.min(anchor.width, bounds.right - bounds.left)
    : size.width;
  const height = size.height;
  const minX = bounds.left + (section ? 0 : 8),
    maxX = bounds.right - width - (section ? 0 : 8);
  const minY = bounds.top + (section ? 0 : 4),
    maxY = bounds.bottom - height - 8;
  if (maxX < minX || maxY < minY) return null;
  const clampX = (x) => Math.max(minX, Math.min(x, maxX));
  const clampY = (y) => Math.max(minY, Math.min(y, maxY));
  const left = clampX(
    section
      ? anchor.left
      : target.kind === "image"
        ? anchor.left + (anchor.width - width) / 2
        : anchor.right - width - (outside ? 0 : TOOL_INSET),
  );
  const top = section
    ? clampY(anchor.top)
    : outside
      ? anchor.top - height - 7
      : target.kind === "image"
        ? anchor.top + (anchor.height - height) / 2
        : anchor.top + TOOL_INSET;
  const rect = (x, y) => ({
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
  });
  const valid = (r) =>
    r.top >= minY &&
    r.bottom <= bounds.bottom - 8 &&
    r.left >= minX &&
    r.right <= bounds.right - (section ? 0 : 8) &&
    !ancestors.some((a) => intersects(r, a)) &&
    !(
      outside &&
      r.left < anchor.right &&
      r.right > anchor.left &&
      r.top < anchor.bottom &&
      r.bottom > anchor.top
    );
  // Prefer the natural anchor, then below occupied rows, above, and finally sides.
  const rows = [
    top,
    ...(outside ? [anchor.bottom + 7] : [clampY(top)]),
    ...ancestors.map((a) => a.bottom + TOOL_GAP).sort((a, b) => a - b),
    anchor.bottom + 7,
    ...ancestors.map((a) => a.top - height - TOOL_GAP).sort((a, b) => b - a),
    anchor.top - height - 7,
    minY,
    maxY,
  ];
  for (const y of rows) {
    const r = rect(left, y);
    if (valid(r)) return { ...r, sectionWidth: section ? width : undefined };
  }
  const columns = [
    ...ancestors.flatMap((a) => [
      a.left - width - TOOL_GAP,
      a.right + TOOL_GAP,
    ]),
    minX,
    maxX,
  ];
  for (const x of columns)
    for (const y of rows) {
      const r = rect(x, y);
      if (valid(r)) return { ...r, sectionWidth: section ? width : undefined };
    }
  return null;
}
