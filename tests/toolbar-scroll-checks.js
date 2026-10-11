import { getViewportBounds } from "../src/viewport.js";
import { controlsOverlap } from "./toolbar-geometry.js";

const frame = () => new Promise(requestAnimationFrame);
const wait = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
const target = (id) => document.querySelector(`[data-editor-target="${id}"]`);
const panel = (id) =>
  document.querySelector(
    `.floating-tools[data-owner="${id}"]:not([data-exiting="true"])`,
  );
const assert = (ok, message) => {
  if (!ok) throw Error(message);
};
async function placeAt(node, top) {
  window.scrollTo(0, scrollY + node.getBoundingClientRect().top - top);
  await wait();
}
async function select(id, inputMode) {
  document.activeElement?.blur();
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  const node = target(id);
  await placeAt(node, 300);
  if (inputMode === "touch") {
    const r = node.getBoundingClientRect();
    for (const type of ["pointerdown", "pointerup"])
      node.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: type === "pointerdown" ? 1 : 0,
          clientX: r.left + Math.min(3, r.width / 2),
          clientY: r.top + Math.min(3, r.height / 2),
        }),
      );
  } else {
    node.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerType: "mouse",
        buttons: 0,
      }),
    );
    // Focus keeps the owner stable while testing geometry separately from hover.
    node.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  }
  await wait(180);
  assert(panel(id)?.style.visibility === "visible", `Missing tools for ${id}`);
  return node;
}

// The immediate read is intentional: checking only after rAF misses the native
// scroll displacement followed by JS correction that caused visible wobble.
async function checkScroll(id, position, deltas = [10, 20, -20, -10]) {
  const node = target(id),
    tools = panel(id);
  const baseline =
    tools.getBoundingClientRect().top -
    (position === "absolute" ? node.getBoundingClientRect().top : 0);
  let maxError = 0;
  const check = (phase) => {
    assert(
      tools.isConnected && tools.style.visibility === "visible",
      `${id} disappeared`,
    );
    assert(
      tools.style.position === position,
      `${id}: expected ${position}, got ${tools.style.position}`,
    );
    const value =
      tools.getBoundingClientRect().top -
      (position === "absolute" ? node.getBoundingClientRect().top : 0);
    const error = Math.abs(value - baseline);
    maxError = Math.max(maxError, error);
    assert(error < 0.5, `${id} shifted ${error}px ${phase}`);
  };
  check("before scrolling");
  for (const delta of deltas) {
    window.scrollBy(0, delta);
    check("before the scroll handler");
    await frame();
    await frame();
    check("after layout");
  }
  return { id, position, maxError };
}

export async function runToolbarScrollChecks({ inputMode = "mouse" } = {}) {
  await document.fonts.ready;
  const results = [];
  const image = await select("study-1.image", inputMode);
  await placeAt(image, 300);
  results.push(await checkScroll("study-1.image", "absolute"));

  const card = await select("study-1", inputMode);
  await placeAt(card, -30);
  results.push(await checkScroll("study-1", "fixed"));
  await placeAt(card, 260);
  results.push(await checkScroll("study-1", "absolute"));

  for (const id of ["edge-narrow.image", "edge-link.cta"]) {
    const node = await select(id, inputMode);
    await placeAt(node, getViewportBounds().top - 20);
    results.push(await checkScroll(id, "fixed", [2, 3, -3, -2]));
    const parentId = node.closest('[data-kind="item"]').dataset.editorTarget;
    assert(
      !controlsOverlap(panel(id), panel(parentId)),
      `${id} overlaps its parent's tools`,
    );
  }

  const standalone = await select("about.image", inputMode);
  await placeAt(standalone, getViewportBounds().bottom - 70);
  results.push(await checkScroll("about.image", "fixed", [-5, -5, 5, 5]));
  await placeAt(standalone, 260);
  results.push(await checkScroll("about.image", "absolute"));

  if (inputMode === "touch") {
    await placeAt(standalone, -standalone.getBoundingClientRect().height - 30);
    assert(
      [...document.querySelectorAll(".floating-tools")].every(
        (n) => n.style.visibility !== "visible",
      ),
      "Offscreen touch selection left tools visible",
    );
    await placeAt(standalone, 260);
    assert(
      panel("about.image")?.style.visibility === "visible",
      "Touch selection was lost on scroll",
    );
    results.push({ check: "Offscreen selection hides and restores its tools" });
  }
  return { inputMode, width: innerWidth, results };
}
