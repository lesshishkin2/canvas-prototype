import { TOOL_GAP } from "./toolbar-layout.js";

// Count actual button rectangles, not the transparent space between groups.
// The threshold is half the FULL height of the underlying image/link.
export function measureToolbarClearance(
  buttons,
  content,
  viewportTop = -Infinity,
) {
  let clearance = 0;
  for (const target of content) {
    if (target.top < viewportTop || target.height <= 0) continue;
    const overlapping = buttons.filter(
      (button) =>
        button.left < target.right &&
        button.right > target.left &&
        button.top < target.bottom &&
        button.bottom > target.top,
    );
    const intervals = overlapping
      .map((button) => [
        Math.max(button.top, target.top),
        Math.min(button.bottom, target.bottom),
      ])
      .sort((a, b) => a[0] - b[0]);
    // Multiple buttons on one row cover the same height only once. Wrapped
    // rows can jointly cover >50%; their transparent vertical gap is excluded.
    let covered = 0,
      end = -Infinity;
    for (const [top, bottom] of intervals) {
      covered += Math.max(0, bottom - Math.max(top, end));
      end = Math.max(end, bottom);
    }
    if (covered > target.height / 2)
      clearance = Math.max(
        clearance,
        ...overlapping.map((button) => button.bottom + TOOL_GAP - target.top),
      );
  }
  return Math.ceil(clearance);
}

// UI-only padding, independent of content and React/DnD transforms. An owner is
// measured once per activation, including zero: removing the collision must
// never remove the very space that resolved it, or grow it again on scroll.
export function createToolbarClearance() {
  const owners = new Map();
  let retained = new Set();
  const restore = (node, entry) => {
    if (entry.padding)
      node.style.setProperty("padding-top", entry.padding, entry.priority);
    else node.style.removeProperty("padding-top");
    delete node.dataset.toolbarClearance;
  };
  return {
    retain(node) {
      retained = new Set(
        [
          node?.closest('[data-kind="section"]'),
          node?.closest('[data-kind="item"]'),
        ].filter(Boolean),
      );
      for (const [owner, entry] of owners) {
        if (!retained.has(owner) || !owner.isConnected) {
          if (entry.amount) restore(owner, entry);
          owners.delete(owner);
        }
      }
    },
    reserve(target, panel, viewport) {
      const node = target.node;
      if (!retained.has(node) || owners.has(node)) return false;
      const entry = {
        padding: node.style.getPropertyValue("padding-top"),
        priority: node.style.getPropertyPriority("padding-top"),
        amount: 0,
      };
      owners.set(node, entry);
      const protectedNodes = new Set(
        [
          ...node.querySelectorAll(
            '[data-kind="image"], [data-kind="link"], .menu-label[data-field]',
          ),
        ].map((child) => child.closest(".canvas-link") || child),
      );
      entry.amount = measureToolbarClearance(
        [...panel.querySelectorAll(".tool-button")].map((button) =>
          button.getBoundingClientRect(),
        ),
        [...protectedNodes].map((child) => child.getBoundingClientRect()),
        viewport.top,
      );
      if (!entry.amount) return false;
      const padding = parseFloat(getComputedStyle(node).paddingTop) || 0;
      node.style.setProperty("padding-top", `${padding + entry.amount}px`);
      node.dataset.toolbarClearance = String(entry.amount);
      return true;
    },
    reset() {
      for (const [node, entry] of owners)
        if (entry.amount) restore(node, entry);
      owners.clear();
      retained.clear();
    },
  };
}
