// Run in the local browser; exercises actual grips, nested lists and rendered order.
const wait = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, message) => {
  if (!value) throw Error(message);
};
const section = (id) => document.querySelector(`[data-section="${id}"]`);
const order = () =>
  [...document.querySelectorAll("[data-section-list] > [data-section]")].map(
    (n) => n.dataset.section,
  );
const panel = (id) =>
  document.querySelector(
    `.floating-tools[data-owner="${id}"]:not([data-exiting])`,
  );
const mode = () => document.body.dataset.editorMode;
function pointer(node, type, x, y, pointerType, id = 1) {
  node.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: id,
      pointerType,
      isPrimary: id === 1,
      button: 0,
      buttons: ["pointerup", "pointercancel"].includes(type) ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  );
}
export async function runSectionDragChecks(pointerType = "touch") {
  await document.fonts.ready;
  const results = [];
  const initial = order().join();
  async function show(id) {
    document.activeElement?.blur();
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        bubbles: true,
      }),
    );
    const n = section(id);
    window.scrollTo(0, n.offsetTop - 100);
    await wait();
    const rect = n.getBoundingClientRect();
    const x = rect.left + 4,
      y = Math.max(100, rect.top) + 4;
    const hit = document.elementFromPoint(x, y);
    assert(
      hit?.closest("[data-section]") === n,
      "Cannot reach section background",
    );
    if (pointerType === "touch") {
      pointer(hit, "pointerdown", x, y, pointerType);
      pointer(hit, "pointerup", x, y, pointerType);
    } else pointer(hit, "pointermove", x, y, pointerType);
    await wait(190);
    const h = panel(id)?.querySelector(".section-drag-handle");
    assert(
      h && getComputedStyle(h).touchAction === "none",
      "Section grip unavailable",
    );
    return h;
  }
  async function drag(from, to, cancel) {
    const h = await show(from),
      rect = h.getBoundingClientRect();
    const x = rect.left + 16,
      y = rect.top + 16;
    const before = order().join();
    const texts = [...section(from).querySelectorAll("[data-field]")]
      .map((n) => n.textContent)
      .join("|");
    pointer(h, "pointerdown", x, y, pointerType);
    pointer(document, "pointermove", x - 4, y, pointerType);
    await wait(30);
    assert(mode() !== "dragging", "Drag starts below 6px");
    pointer(document, "pointermove", x - 10, y, pointerType);
    await wait();
    assert(
      mode() === "dragging" && document.querySelector(".section-drag-preview"),
      "Section drag failed to start",
    );
    const ghost = document.querySelector(".section-drag-preview");
    assert(
      !ghost.querySelector(
        "[data-editor-target], [data-item], [data-section], [contenteditable], [tabindex]",
      ),
      "Preview exposes editor targets",
    );
    const n = section(to);
    window.scrollTo(0, n.offsetTop - 200);
    await wait();
    const destX = innerWidth / 2,
      destY = n.offsetTop - scrollY + Math.min(100, n.offsetHeight / 2);
    pointer(document, "pointermove", destX, destY, pointerType);
    await wait(60);
    assert(
      document.querySelector(".section-drop-target"),
      "Missing insertion marker",
    );
    if (cancel === "escape")
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
        }),
      );
    else if (cancel === "pointercancel")
      pointer(document, "pointercancel", destX, destY, pointerType);
    else if (cancel === "second") {
      pointer(document.body, "pointerdown", destX, 300, pointerType, 2);
      pointer(document.body, "pointerup", destX, 300, pointerType, 2);
    }
    const dropY = cancel === "outside" ? 20 : destY;
    pointer(document, "pointerup", destX, dropY, pointerType);
    await wait(300);
    assert(
      mode() !== "dragging" && !document.querySelector(".section-drag-preview"),
      "Section drag did not finish",
    );
    if (cancel)
      assert(order().join() === before, `${cancel} changed section order`);
    else {
      assert(order().join() !== before, "Section order unchanged");
      if (pointerType === "touch") {
        window.scrollTo(0, section(from).offsetTop - 150);
        await wait();
        assert(
          panel(from)?.style.visibility === "visible",
          "Moved section lost touch selection",
        );
      }
    }
    assert(
      [...section(from).querySelectorAll("[data-field]")]
        .map((n) => n.textContent)
        .join("|") === texts,
      "Reorder lost text",
    );
  }
  const title = document.querySelector('[data-field="hero.title"]');
  title.scrollIntoView({ block: "center" });
  await wait();
  if (pointerType === "touch") {
    const r = title.getBoundingClientRect();
    for (let tap = 0; tap < 2; tap++) {
      pointer(title, "pointerdown", r.left + 20, r.top + 20, pointerType);
      pointer(title, "pointerup", r.left + 20, r.top + 20, pointerType);
      await wait();
    }
  } else title.focus();
  assert(title.isContentEditable, "Cannot edit before moving section");
  document.execCommand("selectAll");
  document.execCommand("insertText", false, "Проверка переноса");
  title.blur();
  await drag("menu", "hero");
  await drag("menu", "hero");
  assert(order().join() === initial, "Round trip did not restore order");
  await drag("collection", "studies");
  await drag("collection", "studies");
  assert(order().join() === initial, "Tall-section round trip changed order");
  assert(title.textContent === "Проверка переноса", "Reorder lost edited text");
  results.push(
    "small/large/tall section swaps both directions; edited text preserved; handle threshold; inert preview",
  );
  for (const cancel of [
    "escape",
    "outside",
    "pointercancel",
    ...(pointerType === "touch" ? ["second"] : []),
  ])
    await drag("hero", "menu", cancel);
  results.push(
    "Escape, outside drop, pointercancel and second-pointer cancellation",
  );
  // A drag from a nested menu handle must not reorder its section.
  section("menu").scrollIntoView();
  await wait();
  const nested = await import("./mobile-checks.js");
  if (pointerType === "touch") await nested.runMobileDragChecks();
  assert(order().join() === initial, "Nested element drag reordered blocks");
  results.push("nested repeater isolation");
  return { width: innerWidth, pointerType, results };
}
