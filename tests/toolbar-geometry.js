// A transparent section wrapper may overlap a child. Its buttons may not.
export function controlsOverlap(first, second) {
  const rects = (panel) =>
    panel.matches(".section-tools")
      ? [...panel.querySelectorAll(".tool-button")].map((node) =>
          node.getBoundingClientRect(),
        )
      : [panel.getBoundingClientRect()];
  return rects(first).some((a) =>
    rects(second).some(
      (b) =>
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top,
    ),
  );
}
