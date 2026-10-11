import { controlsOverlap } from "./toolbar-geometry.js";
import { getViewportBounds } from "../src/viewport.js";

const wait = (ms = 100) => new Promise((r) => setTimeout(r, ms));
const assert = (value, message) => {
  if (!value) throw Error(message);
};
const target = (id) => document.querySelector(`[data-editor-target="${id}"]`);
const field = (id) => document.querySelector(`[data-field="${id}"]`);
const panels = () =>
  [
    ...document.querySelectorAll('.floating-tools:not([data-exiting="true"])'),
  ].filter((n) => n.style.visibility === "visible");
const panel = (id) => panels().find((n) => n.dataset.owner === id);
const order = (list) =>
  [
    ...document.querySelectorAll(
      `[data-list-container="${list}"] > [data-item]`,
    ),
  ].map((n) => n.dataset.item);
function pointer(node, type, x, y, id = 1) {
  node.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: id,
      pointerType: "touch",
      isPrimary: id === 1,
      button: 0,
      buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  );
}
async function tap(node, { x, y, click = false } = {}) {
  const r = node.getBoundingClientRect();
  x ??= r.left + Math.min(20, r.width / 2);
  y ??= r.top + r.height / 2;
  // Hit-test the actual canvas: a panel covering this point is a real failure.
  const hit = document.elementFromPoint(x, y);
  assert(
    hit && (node.contains(hit) || hit.contains(node)),
    `Tap obstructed: ${node.dataset.editorTarget || node.getAttribute("aria-label")}`,
  );
  pointer(hit, "pointerdown", x, y);
  pointer(hit, "pointerup", x, y);
  if (click) hit.closest("button")?.click();
  await wait();
}
async function show(id) {
  document.activeElement?.blur();
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  const node = target(id);
  node.scrollIntoView({ block: "center" });
  await wait();
  await tap(node);
  return node;
}
function checkTools() {
  const visible = panels(),
    v = getViewportBounds();
  for (let i = 0; i < visible.length; i++) {
    const r = visible[i].getBoundingClientRect();
    assert(
      r.left >= v.left &&
        r.right <= v.right + 0.5 &&
        r.top >= v.top &&
        r.bottom <= v.bottom,
      "Tools outside visual viewport",
    );
    for (const button of visible[i].querySelectorAll(".tool-button"))
      assert(
        button.getBoundingClientRect().height === 32 &&
          (button.classList.contains("section-edit-button") ||
            button.getBoundingClientRect().width === 32),
        "Canvas control must be 32 × 32",
      );
    for (let j = i + 1; j < visible.length; j++)
      assert(!controlsOverlap(visible[i], visible[j]), "Touch panels overlap");
  }
}
export async function runMobileChecks() {
  await document.fonts.ready;
  const results = [];
  assert(
    document.documentElement.scrollWidth <= innerWidth,
    "Horizontal page overflow",
  );
  if (innerWidth < 768)
    assert(
      document.querySelector(".editor-topbar").offsetHeight === 57,
      "Mobile bar height",
    );
  let n = await show("hero.title");
  assert(
    document.body.dataset.editorMode === "selected" && !n.isContentEditable,
    "First tap starts input",
  );
  checkTools();
  await tap(n);
  assert(
    document.body.dataset.editorMode === "editing" &&
      document.activeElement === n &&
      n.isContentEditable,
    "Second tap does not edit",
  );
  assert(!panels().length, "Input leaves toolbars visible");
  assert(
    document.querySelector(".save-button").textContent === "Done",
    "Missing Done",
  );
  await tap(document.querySelector(".save-button"), { click: true });
  assert(
    !document.activeElement?.isContentEditable &&
      document.body.dataset.editorMode === "idle",
    "Done did not finish input",
  );
  results.push("select, second-tap editing and Done");

  for (const id of [
    "menu-1",
    "work-1",
    "study-1.image",
    "edge-narrow.image",
    "edge-tiny.image",
    "edge-adjacent.image",
    "edge-adjacent.image2",
    "edge-links.cta",
    "edge-links.cta3",
    "edge-empty.cta",
    "edge-compact",
    "edge-compact.cta",
  ]) {
    // Studies may use different data IDs; resolve its first actual image below.
    const actual =
      id === "study-1.image"
        ? document.querySelector(".study-image").dataset.editorTarget
        : id;
    await show(actual);
    checkTools();
    const owner =
      panel(actual) || (actual === "menu-1" ? panel("menu-1") : null);
    assert(owner, `No touch tools: ${actual}`);
  }
  results.push(
    "nested panels, tiny images, adjacent targets, links, compact row",
  );

  await show("edge-tiny.image");
  const selected = target("edge-tiny.image");
  const position = scrollY;
  window.scrollBy(0, 100);
  await wait();
  assert(panel("edge-tiny.image"), "Scrolling lost selection");
  window.scrollBy(0, innerHeight);
  await wait();
  assert(
    !panels().length,
    "Offscreen selection leaves ancestor panels visible",
  );
  window.scrollTo(0, position);
  await wait();
  assert(panel("edge-tiny.image"), "Selection did not return");
  const label = target("edge-tiny.caption"),
    r = label.getBoundingClientRect();
  pointer(label, "pointerdown", r.left + 10, r.top + 5);
  pointer(label, "pointermove", r.left + 10, r.top + 60);
  pointer(label, "pointerup", r.left + 10, r.top + 60);
  await wait();
  assert(
    panel("edge-tiny.image") && !label.isContentEditable,
    "Swipe selected or edited text",
  );
  pointer(selected, "pointerdown", r.left, r.top);
  pointer(selected, "pointercancel", r.left, r.top);
  await wait();
  assert(panel("edge-tiny.image"), "Cancelled touch changed selection");
  results.push(
    "scroll retention, offscreen hiding, swipe and pointer cancellation",
  );

  const section = panel("edges");
  assert(
    !section.querySelector('[aria-haspopup="menu"]') &&
      section.querySelectorAll("button").length === 4,
    "Block actions must be visible without an overflow menu",
  );
  await tap(section.querySelector('[aria-label="Block visibility · demo"]'), {
    click: true,
  });
  assert(panel("edge-tiny.image"), "Block demo action changed selection");
  if (innerWidth < 768) {
    const more = document.querySelector(
      '.editor-topbar [aria-haspopup="menu"]',
    );
    await tap(more, { click: true });
    assert(
      [...document.querySelectorAll(".editor-menu button")]
        .map((n) => n.textContent)
        .join("|") === "Settings|Change theme|Preview",
      "Topbar menu mismatch",
    );
    await tap(document.querySelector(".editor-menu button"), { click: true });
  }
  results.push("visible section actions and topbar menu");

  n = await show("edge-empty.cta");
  await tap(n);
  const empty = field("edge-empty.cta");
  document.execCommand("insertText", false, "Привет, мир");
  empty.blur();
  await wait();
  assert(empty.innerText === "Привет, мир", "Cyrillic input failed");
  await show("edge-empty");
  await tap(
    [...panel("edge-empty").querySelectorAll("button")].find(
      (n) => n.getAttribute("aria-label") === "Duplicate item",
    ),
    { click: true },
  );
  await wait(350);
  const ids = order("edgeSamples"),
    copy = ids[ids.indexOf("edge-empty") + 1];
  assert(
    ids.length === 8 && field(copy + ".cta").textContent === "Привет, мир",
    "Copy lost current text",
  );
  assert(!panels().length, "Copy leaves hot actions");
  n = await show(copy + ".cta");
  await tap(n);
  document.execCommand("selectAll");
  document.execCommand("insertText", false, "Копия");
  field(copy + ".cta").blur();
  await wait();
  assert(empty.textContent === "Привет, мир", "Copy is not independent");
  await show(copy);
  await tap(
    [...panel(copy).querySelectorAll("button")].find(
      (n) => n.getAttribute("aria-label") === "Delete item",
    ),
    { click: true },
  );
  await wait(200);
  assert(
    order("edgeSamples").length === 7 && !panels().length,
    "Deletion or suppression failed",
  );
  results.push("text editing, independent copy, deletion and suppression");
  return { width: innerWidth, results };
}

export async function runMobileDragChecks() {
  const results = [];
  async function drag(from, to, { cancel, secondFinger, outside } = {}) {
    await show(from);
    const h = panel(from).querySelector(".drag-handle"),
      r = h.getBoundingClientRect(),
      before = order(target(from).dataset.list);
    assert(
      getComputedStyle(h).touchAction === "none",
      "Handle scroll is not disabled",
    );
    pointer(h, "pointerdown", r.left + 20, r.top + 20);
    pointer(document, "pointermove", r.left + 28, r.top + 20);
    await wait();
    assert(
      document.body.dataset.editorMode === "dragging",
      "Touch drag did not start",
    );
    assert(
      !panels().length ||
        panels().every((p) => p.getAttribute("aria-hidden") === "true"),
      "Drag leaves active toolbars",
    );
    if (secondFinger) {
      pointer(document.elementFromPoint(200, 200), "pointerdown", 200, 200, 2);
      await wait();
      assert(
        document.body.dataset.editorMode !== "dragging",
        "Second finger did not cancel immediately",
      );
      pointer(document, "pointerup", 200, 200, 2);
    }
    if (cancel) pointer(document, "pointercancel", r.left + 28, r.top + 20);
    if (!cancel && !secondFinger) {
      const node = target(to);
      node.scrollIntoView({ block: "center" });
      await wait();
      const parent = node.parentElement.getBoundingClientRect(),
        t = {
          left: parent.left + node.offsetLeft,
          top: parent.top + node.offsetTop,
          width: node.offsetWidth,
          height: node.offsetHeight,
        },
        x = outside ? 5 : t.left + t.width / 2,
        y = t.top + Math.min(60, t.height / 2);
      pointer(document, "pointermove", x, y);
      await wait(180);
      pointer(document, "pointerup", x, y);
    } else pointer(document, "pointerup", r.left + 28, r.top + 20);
    await wait(200);
    const after = order(target(from).dataset.list);
    assert(
      document.body.dataset.editorMode !== "dragging" &&
        !document.querySelector(".drag-preview"),
      "Drag did not finish",
    );
    if (cancel || secondFinger || outside)
      assert(before.join() === after.join(), "Cancelled drag changed order");
    else {
      assert(before.join() !== after.join(), "Drag did not reorder");
      assert(panel(from), "Moved item lost selection");
    }
  }
  await drag("menu-1", "menu-3");
  results.push("wrapped menu drag");
  await drag("edge-short", "edge-long");
  results.push("unequal-height cards");
  await drag("edge-compact", "edge-short");
  results.push("compact external handle");
  await drag("menu-2", "menu-4", { cancel: true });
  await drag("menu-2", "menu-4", { secondFinger: true });
  await drag("menu-2", "menu-4", { outside: true });
  results.push("pointercancel, second finger and outside drop");
  return { width: innerWidth, results };
}

export async function runMobileEdgeChecks() {
  const checked = [];
  for (const id of [
    "edge-wide.image",
    "edge-narrow.image",
    "edge-link.cta",
    "edge-tiny.image",
    "edge-adjacent.image",
    "edge-adjacent.image2",
    "edge-links.cta",
    "edge-links.cta3",
    "edge-empty.cta",
    "edge-compact.cta",
  ]) {
    const n = await show(id);
    for (const edge of ["top", "bottom"]) {
      const r = n.getBoundingClientRect(),
        b = getViewportBounds();
      window.scrollBy(
        0,
        edge === "top"
          ? r.top - b.top + Math.min(r.height / 2, 20)
          : r.top - b.bottom + 20,
      );
      await wait();
      assert(panel(id), `Lost tools at ${edge}: ${id}`);
      checkTools();
    }
    checked.push(id);
  }
  const image = await show("edge-wide.image");
  await tap(image);
  assert(!panels().length, "Repeated image tap does not deselect");
  const text = await show("edge-short.title");
  const r = text.getBoundingClientRect();
  pointer(text, "pointerdown", r.left + 10, r.top + 10);
  await wait(350);
  pointer(text, "pointerup", r.left + 10, r.top + 10);
  await wait();
  assert(!text.isContentEditable, "Long contact opened text input");
  await tap(text);
  assert(
    text.isContentEditable,
    "Second separate tap failed after long contact",
  );
  const next = target("edge-short.description");
  await tap(next);
  assert(
    !text.isContentEditable && !next.isContentEditable,
    "Outside tap started another input",
  );
  await tap(next);
  assert(
    next.isContentEditable && document.activeElement === next,
    "Second tap on next field failed",
  );
  next.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  assert(
    !document.activeElement.isContentEditable,
    "Escape left editing active",
  );
  return {
    width: innerWidth,
    checked,
    gestures: "toggle image, long contact, switching editable fields, Escape",
  };
}

export async function runMobileAutoscrollCheck() {
  await show("work-1");
  const h = panel("work-1").querySelector(".drag-handle"),
    r = h.getBoundingClientRect();
  pointer(h, "pointerdown", r.left + 20, r.top + 20);
  pointer(document, "pointermove", r.left + 28, r.top + 20);
  await wait();
  const before = scrollY,
    bounds = getViewportBounds();
  pointer(document, "pointermove", innerWidth / 2, bounds.bottom - 12);
  await wait(350);
  assert(scrollY > before + 40, "Touch edge did not autoscroll");
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
    }),
  );
  pointer(document, "pointerup", innerWidth / 2, bounds.bottom - 12);
  await wait();
  const stopped = scrollY;
  await wait(180);
  assert(
    scrollY === stopped && order("works")[0] === "work-1",
    "Autoscroll or order persisted after Escape",
  );
  return { width: innerWidth, scrollDistance: stopped - before };
}
