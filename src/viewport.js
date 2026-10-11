// All coordinates are CSS pixels in the layout viewport, like DOMRect/clientX.
export function getViewportBounds() {
  const visual = window.visualViewport;
  const left = visual?.offsetLeft || 0;
  const visualTop = visual?.offsetTop || 0;
  const width = visual?.width || document.documentElement.clientWidth;
  const height = visual?.height || innerHeight;
  const header = document.querySelector(".editor-topbar");
  const safeBottom =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--safe-bottom",
      ),
    ) || 0;
  return {
    left,
    top: Math.max(visualTop, header?.getBoundingClientRect().bottom || 0),
    right: left + width,
    bottom: visualTop + height - safeBottom,
    width,
    height,
  };
}

export function intersectsViewport(rect, bounds) {
  return (
    rect.bottom > bounds.top &&
    rect.top < bounds.bottom &&
    rect.right > bounds.left &&
    rect.left < bounds.right
  );
}

export function syncViewport() {
  const root = document.documentElement;
  root.style.setProperty(
    "--visual-top",
    `${window.visualViewport?.offsetTop || 0}px`,
  );
  const header = document.querySelector(".editor-topbar");
  if (header)
    root.style.setProperty("--editor-bar-height", `${header.offsetHeight}px`);
}

export function revealCaret() {
  const field = document.activeElement;
  if (!field?.isContentEditable) return;
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const caret = range?.getBoundingClientRect();
  const rect = caret?.height ? caret : field.getBoundingClientRect();
  const bounds = getViewportBounds();
  if (rect.bottom > bounds.bottom - 16)
    window.scrollBy(0, rect.bottom - bounds.bottom + 16);
  else if (rect.top < bounds.top + 16)
    window.scrollBy(0, rect.top - bounds.top - 16);
}
