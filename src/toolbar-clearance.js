import { TOOL_GAP } from "./toolbar-layout.js";

// Count actual button rectangles, not the transparent space between groups.
// Exactly half a button is intentionally below the activation threshold.
export function measureToolbarClearance(
  buttons,
  content,
  viewportTop = -Infinity,
) {
  let clearance = 0;
  for (const button of buttons) {
    for (const target of content) {
      if (target.top < viewportTop) continue;
      const overlap =
        Math.min(button.bottom, target.bottom) -
        Math.max(button.top, target.top);
      if (
        button.left < target.right &&
        button.right > target.left &&
        overlap > button.height / 2
      ) {
        clearance = Math.max(clearance, button.bottom + TOOL_GAP - target.top);
      }
    }
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
