// Browser regressions: portal handles, interrupted sorting, native scroll and stacking.
const q = (selector) => document.querySelector(selector);
const item = (id) => q(`[data-item="${id}"]`);
const panel = (id) =>
  q(`.floating-tools[data-owner="${id}"]:not([data-exiting])`);
const order = (list) =>
  [...q(`[data-list-container="${list}"]`).children].map(
    (node) => node.dataset.item,
  );
const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise(requestAnimationFrame);
const assert = (ok, message) => {
  if (!ok) throw Error(message);
};
function pointer(node, type, x, y, buttons = 0) {
  node.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: y,
      buttons,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    }),
  );
}
async function begin(id) {
  const node = item(id);
  document.activeElement?.blur();
  pointer(q(".editor-topbar"), "pointermove", 400, 20);
  if (node.dataset.list === "menu") window.scrollTo(0, 0);
  else window.scrollTo(0, scrollY + node.getBoundingClientRect().top - 280);
  await wait(100);
  const r = node.getBoundingClientRect();
  pointer(node, "pointermove", r.left + 3, r.top + 3);
  await wait();
  const handle = panel(id)?.querySelector(".drag-handle");
  assert(handle, `Missing handle for ${id}`);
  const h = handle.getBoundingClientRect();
  const start = { x: h.left + h.width / 2, y: h.top + h.height / 2 };
  pointer(handle, "pointerdown", start.x, start.y, 1);
  pointer(document, "pointermove", start.x + 10, start.y, 1);
  await wait(80);
  assert(
    document.body.dataset.editorMode === "dragging",
    "Drag did not activate",
  );
  return start;
}
async function finish(point, cancel = false) {
  if (cancel)
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        key: "Escape",
        code: "Escape",
      }),
    );
  pointer(document, "pointerup", point.x, point.y);
  await wait();
  assert(!q(".drag-preview"), "Drag overlay leaked");
}
async function sampleMove(point, node) {
  const before = node.getBoundingClientRect();
  pointer(document, "pointermove", point.x, point.y, 1);
  const samples = [];
  for (let i = 0; i < 18; i++) {
    await frame();
    const r = node.getBoundingClientRect();
    samples.push({ x: r.left, y: r.top });
  }
  const end = samples.at(-1);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  assert(distance(before, end) > 20, "The sibling did not move");
  const intermediate = samples.filter(
    (s) => distance(s, before) > 1 && distance(s, end) > 1,
  );
  assert(intermediate.length >= 2, "A sibling jumped instead of animating");
  return intermediate.length;
}

export async function runDragScrollChecks() {
  await document.fonts.ready;
  const results = [];
  const initialMenu = order("menu");
  let start = await begin(initialMenu[0]);
  let slot = item(initialMenu[3]).getBoundingClientRect();
  let end = { x: slot.left + slot.width / 2, y: start.y };
  assert(
    start.y > q(".menu-list").getBoundingClientRect().bottom,
    "Test must start from the external menu handle",
  );
  pointer(document, "pointermove", end.x, end.y, 1);
  await wait();
  assert(
    q(".drop-target")?.dataset.item === initialMenu[3],
    "External grip missed its slot",
  );
  await finish(end);
  assert(
    order("menu")[3] === initialMenu[0],
    "Menu did not reorder horizontally",
  );
  start = await begin(initialMenu[0]);
  slot = item(initialMenu[1]).getBoundingClientRect();
  end = { x: slot.left + slot.width / 2, y: slot.top + slot.height / 2 };
  pointer(document, "pointermove", end.x, end.y, 1);
  await wait();
  await finish(end);
  assert(
    JSON.stringify(order("menu")) === JSON.stringify(initialMenu),
    "Menu reverse failed",
  );
  results.push(
    "Menu sorts along the external handle and by dropping directly on a label",
  );

  for (const cancel of [true, false]) {
    start = await begin(initialMenu[0]);
    end = { x: innerWidth - 10, y: 350 };
    pointer(document, "pointermove", end.x, end.y, 1);
    await wait(100);
    await finish(end, cancel);
    assert(
      JSON.stringify(order("menu")) === JSON.stringify(initialMenu),
      "Cancelled menu changed",
    );
  }
  results.push("Escape and leaving the menu cancel the reorder");

  const menu = q(".menu-list");
  const oldWidth = menu.style.width;
  menu.style.width = "300px";
  try {
    start = await begin(initialMenu[0]);
    const source = item(initialMenu[0]).getBoundingClientRect();
    slot = item(initialMenu[3]).getBoundingClientRect();
    assert(
      slot.top > source.bottom,
      "The wrap fixture must have multiple rows",
    );
    end = {
      x: slot.left + slot.width / 2,
      y:
        slot.top + slot.height / 2 + start.y - (source.top + source.height / 2),
    };
    pointer(document, "pointermove", end.x, end.y, 1);
    await wait();
    await finish(end);
    assert(
      order("menu")[3] === initialMenu[0],
      "Wrapped menu did not reorder across rows",
    );
    results.push("External menu handle also sorts across wrapped rows");
  } finally {
    menu.style.width = oldWidth;
  }

  const works = order("works");
  await begin(works[0]);
  const slots = works.map((id) => item(id).getBoundingClientRect());
  const center = (r) => ({ x: r.left + r.width / 2, y: r.top + 110 });
  const intermediateFrames = [];
  // First entry into each new slot used to set transition-duration: 0.
  intermediateFrames.push(await sampleMove(center(slots[1]), item(works[1])));
  intermediateFrames.push(await sampleMove(center(slots[2]), item(works[2])));
  intermediateFrames.push(await sampleMove(center(slots[1]), item(works[2])));
  await finish(center(slots[1]), true);
  assert(
    JSON.stringify(order("works")) === JSON.stringify(works),
    "Cancel committed the preview",
  );
  results.push({
    check: "First displacement, next slot and reversal all animate",
    intermediateFrames,
  });

  // Read geometry in the same JS turn as scroll, before a scroll handler or
  // React commit can catch up. A document-anchored panel already moved with it.
  const image = q('[data-editor-target="study-1.image"]');
  window.scrollTo(0, scrollY + image.getBoundingClientRect().top - 300);
  await wait();
  image.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  await wait();
  const tools = panel("study-1.image");
  const baseline =
    tools.getBoundingClientRect().top - image.getBoundingClientRect().top;
  let maxError = 0;
  for (const delta of [8, 12, 16, 20, -20, -16, -12, -8]) {
    await frame();
    window.scrollBy(0, delta);
    const error = Math.abs(
      tools.getBoundingClientRect().top -
        image.getBoundingClientRect().top -
        baseline,
    );
    maxError = Math.max(maxError, error);
    assert(error < 0.5, `Tools lagged behind content by ${error}px`);
  }
  results.push({
    check: "Tools follow scrolling without waiting for an update",
    maxError,
  });

  window.scrollTo(0, 0);
  await wait();
  q('[data-section="menu"]').dispatchEvent(
    new FocusEvent("focusin", { bubbles: true }),
  );
  await wait();
  const plus = q('[data-section="menu"] .section-divider-end button');
  const r = plus.getBoundingClientRect();
  // The lower half used to sit behind the hero photograph.
  assert(
    plus.contains(
      document.elementFromPoint(r.left + r.width / 2, r.bottom - 4),
    ),
    "The neighbouring section covers the add button",
  );
  results.push(
    "The complete boundary add button is above neighbouring content",
  );
  return { viewport: { width: innerWidth, height: innerHeight }, results };
}
