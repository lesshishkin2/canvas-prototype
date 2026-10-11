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
  let position = "absolute";
  if (section) {
    top = Math.max(ceiling, anchor.top);
    if (anchor.top <= ceiling) position = "fixed";
    if (top + size.height > anchor.bottom) return null;
  } else if (above) {
    top = anchor.top - size.height - 7;
    if (top < ceiling + 6) top = anchor.bottom + 7;
  } else if (target.kind === "image") {
    top = anchor.top + (anchor.height - size.height) / 2;
  } else {
    top = Math.max(ceiling + 6, anchor.top + TOOL_INSET);
    if (anchor.top + TOOL_INSET <= ceiling + 6) position = "fixed";
  }
  if (!section)
    left = Math.max(bounds.left + 8, Math.min(left, bounds.right - width - 12));
  const minY = section ? ceiling : ceiling + 4;
  const maxY = bounds.bottom - size.height - 8;
  if (top <= minY || top >= maxY) position = "fixed";
  top = Math.max(minY, Math.min(top, maxY));
  const rect = () => ({
    left,
    top,
    width,
    height: size.height,
    right: left + width,
    bottom: top + size.height,
    position,
  });
  const originalTop = top;
  const originalPosition = position;
  for (const ancestor of ancestors) {
    if (intersects(rect(), ancestor)) {
      top = ancestor.bottom + TOOL_GAP;
      position = ancestor.position ?? "absolute";
    }
  }
  if (above && top < anchor.bottom && top + size.height > anchor.top) {
    // Stacking below a section must not place tools across a menu/button label.
    top = anchor.bottom + 7;
    position = "absolute";
    for (const ancestor of ancestors) {
      if (intersects(rect(), ancestor)) {
        top = ancestor.bottom + TOOL_GAP;
        position = ancestor.position ?? "absolute";
      }
    }
  }
  if (top + size.height > bounds.bottom - 8) {
    // At the bottom edge keep the parent fixed and use free space to its left.
    top = Math.min(originalTop, bounds.bottom - size.height - 8);
    position = originalPosition;
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
    ? anchor.top
    : outside
      ? anchor.top - height - 7
      : target.kind === "image"
        ? anchor.top + (anchor.height - height) / 2
        : anchor.top + TOOL_INSET;
  const row = (top, position = "absolute") => ({ top, position });
  const clampRow = (candidate) =>
    row(
      clampY(candidate.top),
      candidate.top <= minY || candidate.top >= maxY
        ? "fixed"
        : candidate.position,
    );
  const rect = (x, candidate) => ({
    left: x,
    top: candidate.top,
    width,
    height,
    right: x + width,
    bottom: candidate.top + height,
    position: candidate.position,
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
  // Search relative to this object, not from the top of the ancestor chain.
  // A pinned section toolbar must not steal the image's local collision fallback.
  const candidates = [
    ...ancestors.flatMap((a) => [
      row(a.bottom + TOOL_GAP, a.position),
      row(a.top - height - TOOL_GAP, a.position),
    ]),
    row(anchor.bottom + 7),
    row(anchor.top - height - 7),
    row(minY, "fixed"),
    row(maxY, "fixed"),
  ];
  const rows = [
    section ? clampRow(row(top)) : row(top),
    ...(!outside ? [clampRow(row(top))] : []),
    ...candidates.filter((r) => r.top >= top).sort((a, b) => a.top - b.top),
    ...candidates.filter((r) => r.top < top).sort((a, b) => b.top - a.top),
  ];
  for (const candidate of rows) {
    const r = rect(left, candidate);
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
    for (const candidate of rows) {
      const r = rect(x, candidate);
      if (valid(r)) return { ...r, sectionWidth: section ? width : undefined };
    }
  return null;
}
