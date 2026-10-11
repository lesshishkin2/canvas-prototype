// Run in the local prototype tab: (await import('/tests/browser-checks.js')).runChecks()
// Exercises rendered DOM and native editing / pointer event handlers, not React internals.
const wait = (ms = 70) => new Promise((resolve) => setTimeout(resolve, ms));
const query = (selector) => document.querySelector(selector);
const all = (selector) => [...document.querySelectorAll(selector)];
const order = (list) =>
  all(`[data-list-container="${list}"]>[data-item]`).map(
    (el) => el.dataset.item,
  );
const field = (id) => query(`[data-field="${id}"]`);
const toolbar = () => all('.floating-tools:not([data-exiting="true"])').at(-1);
const labels = () =>
  [...(toolbar()?.querySelectorAll("button") || [])].map((el) =>
    el.getAttribute("aria-label"),
  );
const assert = (condition, message) => {
  if (!condition) throw Error(message);
};
function layoutRect(el) {
  const rect = el.getBoundingClientRect();
  const transform = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return DOMRect.fromRect({
    x: rect.x - transform.m41,
    y: rect.y - transform.m42,
    width: rect.width,
    height: rect.height,
  });
}
function pointer(target, type, x, y, buttons = 0) {
  target.dispatchEvent(
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
async function hover(el, scroll = true) {
  pointer(query(".editor-topbar"), "pointermove", 400, 20);
  if (scroll) {
    el.scrollIntoView({ block: "center" });
  }
  // Let a preceding explicit scroll finish before starting hover dwell.
  await wait();
  const r = el.getBoundingClientRect();
  pointer(
    el,
    "pointermove",
    r.x + Math.min(r.width / 2, 35),
    r.y + Math.min(r.height / 2, 40),
  );
  await wait(220);
}
async function edit(id, text) {
  const el = field(id);
  el.focus();
  const selection = getSelection(),
    range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand("insertText", false, text);
  await wait();
  el.blur();
  await wait();
}
async function action(label) {
  const button = [...(toolbar()?.querySelectorAll("button") || [])].find(
    (el) => el.getAttribute("aria-label") === label,
  );
  assert(button, `Missing action ${label}`);
  button.click();
  await wait();
}
async function drag(
  list,
  from,
  to,
  { cancel = false, outside = false, short = false } = {},
) {
  const item = query(`[data-item="${from}"]`);
  await hover(item);
  const handle = query('[data-toolbar-kind="item"] .drag-handle');
  assert(handle, "Missing drag handle");
  const h = handle.getBoundingClientRect(),
    x = h.x + h.width / 2,
    y = h.y + h.height / 2;
  pointer(handle, "pointerdown", x, y, 1);
  pointer(document, "pointermove", x + (short ? 3 : 10), y, 1);
  await wait();
  if (short) {
    pointer(document, "pointerup", x + 3, y);
    await wait();
    return;
  }
  assert(
    document.body.dataset.editorMode === "dragging",
    "Drag did not activate",
  );
  assert(query(".drag-preview"), "Missing drag preview");
  let target = query(`[data-item="${to}"]`),
    r = target && layoutRect(target);
  if (target && !(r.y > 70 && r.bottom < innerHeight)) {
    // Aim at the layout slot; sortable siblings animate away from it.
    window.scrollBy(0, r.y + r.height / 2 - innerHeight / 2);
    await wait();
    r = layoutRect(target);
  }
  const end = outside
    ? { x: 2, y: 130 }
    : { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  pointer(document, "pointermove", end.x, end.y, 1);
  await wait(110);
  const indicated = query(".drop-target")?.dataset.item;
  if (cancel)
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        bubbles: true,
      }),
    );
  else pointer(document, "pointerup", end.x, end.y);
  await wait(160);
  assert(!query(".drag-preview"), "Drag preview not cleaned up");
  return indicated;
}
export async function checkInsetToolbarBridge() {
  const card = query('[data-item="study-1"]');
  card.scrollIntoView({ block: "center" });
  await wait();
  const r = card.getBoundingClientRect();
  const parentTools = () =>
    query('.floating-tools[data-owner="study-1"]:not([data-exiting="true"])');
  const move = async (x, y, settle = true) => {
    const hit = document.elementFromPoint(x, y);
    assert(hit, "Pointer path left the viewport");
    pointer(hit, "pointermove", x, y);
    await wait(settle ? 220 : 25);
  };
  for (const direction of ["top", "right", "diagonal"]) {
    await move(r.left + r.width / 2, r.top + 80);
    assert(
      toolbar()?.dataset.owner === "study-1.image",
      "Direct image hover was blocked",
    );
    await move(r.right - 3, r.top + 3);
    assert(!!parentTools(), "Card edge did not open its tools");
    const p = parentTools().getBoundingClientRect();
    const start =
      direction === "top"
        ? { x: p.left + 13, y: r.top + 3 }
        : direction === "right"
          ? { x: r.right - 3, y: p.top + 13 }
          : { x: r.right - 3, y: r.top + 3 };
    const end =
      direction === "top"
        ? { x: p.left + 13, y: p.top + 13 }
        : { x: p.right - 13, y: p.top + 13 };
    await move(start.x, start.y);
    for (let step = 1; step <= 12; step++) {
      await move(
        start.x + ((end.x - start.x) * step) / 12,
        start.y + ((end.y - start.y) * step) / 12,
        false,
      );
      assert(
        !!parentTools(),
        `${direction} approach switched to nested image tools`,
      );
    }
    await wait(220);
    assert(!!parentTools(), "Panel protection expired on a timer");
    await move(p.left + 13, p.bottom + 4);
    assert(
      toolbar()?.dataset.owner === "study-1.image",
      "Leaving the protected gap did not reveal the image after hover dwell",
    );
  }
  // Reach a real button through the narrow top gap, then exercise the action.
  await move(r.right - 3, r.top + 3);
  const p = parentTools().getBoundingClientRect();
  await move(p.left + 13, p.top - 1);
  await wait(220);
  assert(
    !!parentTools(),
    "Slow movement in the image-covered gap lost the panel",
  );
  await move(p.left + 13, p.top + 13);
  const count = order("studies").length;
  document
    .elementFromPoint(p.left + 13, p.top + 13)
    .closest("button")
    .click();
  await wait();
  assert(
    order("studies").length === count + 1,
    "Copy button was unreachable through the gap",
  );
  const copy = order("studies")[order("studies").indexOf("study-1") + 1];
  await hover(query(`[data-item="${copy}"]`));
  await action("Delete item");
  await hover(field("study-1.cta"));
  assert(
    toolbar()?.dataset.owner === "study-1.cta" && labels().length === 1,
    "Card protection swallowed nested button tools",
  );
  field("study-1.title").focus();
  await wait();
  assert(!toolbar(), "Focus could not enter text editing");
  field("study-1.title").blur();
}

export async function checkHoverDwell() {
  const card = query('[data-item="study-1"]');
  document.activeElement?.blur();
  card.scrollIntoView({ block: "center" });
  await wait(220);
  const r = card.getBoundingClientRect();
  const at = (x, y) => {
    const hit = document.elementFromPoint(x, y);
    assert(hit, "Hover test point is outside the viewport");
    pointer(hit, "pointermove", x, y);
  };
  const imagePoint = () => at(r.left + r.width / 2, r.top + 80);
  const cardPoint = () => at(r.left + 3, r.top + 3);
  const center = (node) => {
    const b = node.getBoundingClientRect();
    at(b.left + b.width / 2, b.top + b.height / 2);
  };
  pointer(query(".editor-topbar"), "pointermove", 400, 20);
  await wait(360);
  imagePoint();
  await wait(55);
  assert(!toolbar(), "Initial tools appeared during a passing hover");
  // Movement inside the same image must not keep postponing its tools.
  for (let i = 0; i < 5; i++) {
    at(r.left + r.width / 2 + i * 2, r.top + 80);
    await wait(35);
  }
  assert(
    toolbar()?.dataset.owner === "study-1.image",
    "Movement within one target restarted the dwell timer",
  );
  for (const move of [
    cardPoint,
    () => at(r.left - 12, r.top + 80),
    () => center(field("study-1.title")),
    () => center(field("study-1.cta")),
    imagePoint,
  ]) {
    move();
    await wait(35);
    assert(
      toolbar()?.dataset.owner === "study-1.image",
      "A fast sweep flashed intermediate tools",
    );
  }
  await wait(190);
  assert(
    toolbar()?.dataset.owner === "study-1.image",
    "Returning to the current target did not cancel a pending switch",
  );
  cardPoint();
  await wait(55);
  assert(
    toolbar()?.dataset.owner === "study-1.image",
    "Old tools disappeared before the new target settled",
  );
  await wait(140);
  assert(
    toolbar()?.dataset.owner === "study-1",
    "Settled card hover did not switch tools",
  );
  // Let the child finish exiting; returning during its fade intentionally reverses immediately.
  await wait(150);
  imagePoint();
  await wait(55);
  const p = toolbar().getBoundingClientRect();
  at(p.left + 13, p.top - 1);
  await wait(200);
  assert(
    toolbar()?.dataset.owner === "study-1",
    "Protective gap did not cancel the queued image toolbar",
  );
  imagePoint();
  await wait(55);
  at(p.left + 13, p.top + 13);
  await wait(200);
  assert(
    toolbar()?.dataset.owner === "study-1",
    "Entering the actual toolbar did not cancel a queued switch",
  );

  imagePoint();
  await wait(55);
  card.focus();
  await wait(20);
  assert(toolbar()?.dataset.owner === "study-1", "Keyboard focus was delayed");
  await wait(190);
  assert(
    toolbar()?.dataset.owner === "study-1",
    "A stale hover overrode keyboard focus",
  );
  card.blur();
  imagePoint();
  await wait(55);
  field("study-1.title").focus();
  await wait(20);
  assert(!toolbar(), "Text editing did not hide tools immediately");
  await wait(190);
  assert(!toolbar(), "Pending tools appeared during editing");
  field("study-1.title").blur();
  imagePoint();
  await wait(55);
  window.dispatchEvent(new Event("scroll"));
  await wait(80);
  assert(!toolbar(), "Scrolling did not restart hover dwell");
  await wait(200);
  assert(
    toolbar()?.dataset.owner === "study-1.image",
    "Stationary hover did not settle after scrolling",
  );
  pointer(query(".editor-topbar"), "pointermove", 400, 20);
  await wait(350);
  imagePoint();
  await wait(55);
  document.documentElement.dispatchEvent(new PointerEvent("pointerleave"));
  await wait(220);
  assert(!toolbar(), "Pending tools appeared after leaving the window");

  await hover(card);
  imagePoint();
  await wait(55);
  const handle = query('[data-toolbar-kind="item"] .drag-handle'),
    h = handle.getBoundingClientRect();
  pointer(handle, "pointerdown", h.x + 10, h.y + 13, 1);
  pointer(document, "pointermove", h.x + 20, h.y + 13, 1);
  await wait(220);
  assert(
    document.body.dataset.editorMode === "dragging" &&
      toolbar()?.style.visibility === "hidden",
    "Pending hover interfered with dragging",
  );
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
    }),
  );
  await wait(220);
  assert(!toolbar(), "Pending tools reappeared after drag cancellation");

  await hover(card);
  imagePoint();
  await wait(55);
  await action("Duplicate item");
  await wait(190);
  assert(!toolbar(), "Pending tools reappeared after a structural action");
  const copy = order("studies")[order("studies").indexOf("study-1") + 1];
  await hover(query(`[data-item="${copy}"]`));
  await action("Delete item");
}

export async function runChecks() {
  const results = [];
  async function test(name, fn) {
    try {
      await fn();
      results.push({ name, result: "passed" });
    } catch (error) {
      results.push({ name, result: "FAILED", reason: error.message });
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
        }),
      );
      document.activeElement?.blur();
    }
  }
  await test("Local assets, nine sections, no horizontal overflow", async () => {
    await document.fonts.ready;
    assert(all("[data-section]").length === 9, "Incorrect section count");
    assert(
      document.documentElement.scrollWidth <= innerWidth,
      "Horizontal overflow",
    );
    assert(
      all("img").every((img) => img.complete && img.naturalWidth > 0),
      "Missing image",
    );
    assert(
      performance
        .getEntriesByType("resource")
        .every((entry) => new URL(entry.name).origin === location.origin),
      "External asset request",
    );
  });
  await test("Menu is first; label hover exposes all item actions", async () => {
    assert(
      query("[data-section]").dataset.section === "menu",
      "Menu is not first",
    );
    assert(order("menu").length === 5, "Incorrect initial menu size");
    window.scrollTo(0, 0);
    await hover(field("menu-1.title"), false);
    assert(
      toolbar()?.dataset.owner === "menu-1",
      "Label has a separate toolbar",
    );
    assert(
      labels().join("|") ===
        "Edit item link|Duplicate item|Delete item|Drag item",
      "Incorrect menu actions",
    );
    const item = query('[data-item="menu-1"]').getBoundingClientRect(),
      panel = toolbar().getBoundingClientRect();
    assert(
      panel.top >= 66 &&
        (panel.bottom <= item.top || panel.top >= item.bottom) &&
        Math.abs(panel.right - item.right) < 1,
      "Menu toolbar covers the label or topbar",
    );
    pointer(
      query('[data-section="menu"]'),
      "pointermove",
      panel.x + 10,
      (panel.bottom + item.top) / 2,
    );
    await wait(220);
    assert(toolbar()?.dataset.owner === "menu-1", "Menu toolbar lost over gap");
    const href = location.href;
    await action("Edit item link");
    assert(
      location.href === href && order("menu").length === 5,
      "Link placeholder changed page",
    );
    await edit("menu-1.title", "Коллекция 2026");
    const el = field("menu-1.title");
    el.focus();
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    await wait();
    assert(
      document.activeElement !== el && el.innerText === "Коллекция 2026",
      "Menu Enter did not finish editing",
    );
  });
  await test("Menu copies independently and reorders horizontally with cancellation", async () => {
    const before = order("menu");
    await hover(field("menu-1.title"));
    await action("Duplicate item");
    const copy = order("menu")[1];
    assert(
      !before.includes(copy) &&
        field(`${copy}.title`).innerText === "Коллекция 2026",
      "Menu copy failed",
    );
    await edit(`${copy}.title`, "Новая ссылка");
    assert(
      field("menu-1.title").innerText === "Коллекция 2026",
      "Menu copy shares text",
    );
    await hover(query(`[data-item="${copy}"]`));
    await action("Delete item");
    assert(!toolbar(), "Menu delete leaves an active toolbar");
    await drag("menu", "menu-1", "menu-3");
    assert(order("menu")[2] === "menu-1", "Horizontal menu reorder failed");
    await drag("menu", "menu-1", "menu-2");
    assert(
      order("menu").join() === before.join(),
      "Reverse menu reorder failed",
    );
    await drag("menu", "menu-1", "menu-3", { cancel: true });
    await drag("menu", "menu-1", "menu-3", { outside: true });
    await drag("menu", "menu-1", "work-1");
    assert(
      order("menu").join() === before.join() && order("works").length === 6,
      "Menu cancelled or cross-list move committed",
    );
  });
  await test("Menu wraps and sorts across rows; final item cannot be deleted", async () => {
    for (let i = 0; i < 10; i++) {
      await hover(query('[data-item="menu-5"]'));
      await action("Duplicate item");
    }
    const before = order("menu"),
      last = before.at(-1);
    assert(
      query(`[data-item="${last}"]`).getBoundingClientRect().top >
        query('[data-item="menu-1"]').getBoundingClientRect().top,
      "Menu did not wrap",
    );
    const indicated = await drag("menu", "menu-1", last);
    assert(
      indicated &&
        order("menu").indexOf("menu-1") === before.indexOf(indicated) &&
        order("menu").indexOf("menu-1") > 4,
      "Wrapped menu reorder failed",
    );
    await edit("menu-1.title", "Очень длинная ссылка ".repeat(12));
    assert(
      document.documentElement.scrollWidth <= innerWidth,
      "Menu text overflow",
    );
    while (order("menu").length > 1) {
      await hover(query(`[data-item="${order("menu")[0]}"]`));
      await action("Delete item");
    }
    await hover(query(`[data-item="${order("menu")[0]}"]`));
    const disabled = all('.floating-tools [aria-disabled="true"]');
    assert(
      disabled.length === 2 && labels().includes("Cannot delete the last item"),
      "Menu final item is not protected",
    );
    disabled.forEach((button) => button.click());
    assert(order("menu").length === 1, "Last menu item removed");
  });
  await test("Ordered card actions and closest target hover", async () => {
    await hover(query('[data-item="work-1"]'));
    assert(
      labels().join("|") ===
        "Replace image|Edit image|Edit item link|Duplicate item|Delete item|Drag item",
      "Wrong action order",
    );
    await hover(field("work-1.title"), false);
    assert(
      toolbar()?.dataset.owner === "work-1",
      "Text hover lost parent tools",
    );
    await hover(field("work-1.cta"), false);
    assert(
      labels().length === 1 && labels()[0] === "Edit link",
      "Nested link target failed",
    );
  });
  await test("Safe bridge, toolbar interaction, and 180ms closing delay", async () => {
    await hover(field("work-1.cta"));
    let a = field("work-1.cta").closest(".canvas-link").getBoundingClientRect(),
      b = toolbar().getBoundingClientRect();
    const y =
      b.bottom < a.top ? (b.bottom + a.top) / 2 : (a.bottom + b.top) / 2;
    pointer(query('[data-item="work-1"]'), "pointermove", b.x + 10, y);
    await wait(90);
    assert(
      toolbar()?.dataset.owner === "work-1.cta",
      "Panel vanished over gap",
    );
    pointer(toolbar(), "pointermove", b.x + 10, b.y + 10);
    await wait(220);
    assert(toolbar(), "Panel vanished while hovering it");
    pointer(query(".editor-topbar"), "pointermove", 400, 20);
    await wait(60);
    assert(toolbar(), "Panel closed too early");
    await wait(160);
    assert(!toolbar(), "Panel did not close");
  });
  await test("Native text editing retains caret and Enter/Escape behavior", async () => {
    const el = field("work-1.title");
    el.focus();
    const selection = getSelection(),
      range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("insertText", false, "Кириллица");
    await wait();
    assert(
      document.body.dataset.editorMode === "editing" && !toolbar(),
      "Editor panels visible during input",
    );
    document.execCommand("insertText", false, " + текст");
    await wait();
    assert(el.innerText === "Кириллица + текст", "Caret jumped");
    document.execCommand("insertLineBreak");
    document.execCommand("insertText", false, "Новая строка");
    await wait();
    assert(el.innerText.includes("\n"), "Line break lost");
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    await wait();
    assert(document.activeElement !== el, "Escape did not blur");
  });
  await test("Empty content is still editable; rich input becomes plain text", async () => {
    await edit("work-1.title", "");
    const el = field("work-1.title");
    assert(
      el.dataset.empty === "true" && el.getBoundingClientRect().height > 10,
      "Empty target collapsed",
    );
    el.focus();
    document.execCommand("insertHTML", false, "<b>Без форматирования</b>");
    await wait();
    el.blur();
    await wait();
    assert(
      el.textContent === "Без форматирования" && !el.querySelector("b"),
      "Formatting was retained",
    );
  });
  await test("Button input commits on Enter and never navigates", async () => {
    const href = location.href;
    await edit("work-1.cta", "Новая кнопка");
    const el = field("work-1.cta");
    el.focus();
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    await wait();
    assert(
      document.activeElement !== el && location.href === href,
      "Enter navigated or did not finish",
    );
  });
  await test("Copy latest content next to original; new copy edits independently", async () => {
    const before = order("works");
    await hover(query('[data-item="work-1"]'));
    await action("Duplicate item");
    const after = order("works"),
      copy = after[after.indexOf("work-1") + 1];
    assert(
      after.length === before.length + 1 && !before.includes(copy),
      "Copy order/identity failed",
    );
    assert(
      field(`${copy}.title`).innerText === "Без форматирования" &&
        field(`${copy}.cta`).innerText === "Новая кнопка",
      "Latest values not copied",
    );
    await edit(`${copy}.title`, "Независимая копия");
    assert(
      field("work-1.title").innerText === "Без форматирования",
      "Copy shares editable content",
    );
    await hover(query(`[data-item="${copy}"]`));
    await action("Delete item");
    assert(!toolbar(), "Delete left a hot toolbar under the pointer");
  });
  await test("Drag threshold and grid reorder in both directions across rows", async () => {
    const before = order("works");
    await drag("works", "work-1", "work-2", { short: true });
    assert(
      order("works").join() === before.join(),
      "Moved below 6px threshold",
    );
    const indicated = await drag("works", "work-1", "work-5");
    assert(
      indicated &&
        order("works").indexOf("work-1") === before.indexOf(indicated) &&
        order("works").indexOf("work-1") >= 3,
      `Drop did not match the indicated grid slot: indicated=${indicated}, before=${before.join()}, after=${order("works").join()}`,
    );
    await drag(
      "works",
      "work-1",
      before[0] === "work-1" ? before[1] : before[0],
    );
    assert(order("works")[0] === "work-1", "Reverse drag failed");
  });
  await test("Immediate pointer release still resolves a directly hit sibling", async () => {
    const before = order("works");
    await hover(query('[data-item="work-1"]'));
    const handle = query('[data-toolbar-kind="item"] .drag-handle'),
      h = handle.getBoundingClientRect(),
      target = query('[data-item="work-2"]').getBoundingClientRect(),
      x = target.x + target.width / 2,
      y = target.y + target.height / 2;
    pointer(handle, "pointerdown", h.x + 13, h.y + 13, 1);
    pointer(document, "pointermove", x, y, 1);
    await wait(0);
    pointer(document, "pointermove", x, y, 1);
    pointer(document, "pointerup", x, y);
    await wait();
    assert(order("works")[1] === "work-1", "Quick drop was lost");
    await drag("works", "work-1", "work-2");
    assert(
      order("works").join() === before.join(),
      "Quick-drop cleanup failed",
    );
  });
  await test("Escape, outside drop, and foreign container cancel reorder", async () => {
    const before = order("works").join();
    await drag("works", "work-1", "work-3", { cancel: true });
    assert(order("works").join() === before, "Escape committed reorder");
    await drag("works", "work-1", "work-3", { outside: true });
    assert(order("works").join() === before, "Outside drop committed");
    await drag("works", "work-1", "event-1");
    assert(
      order("works").join() === before && order("exhibitions").length === 3,
      "Cross-container drop committed",
    );
    await hover(query('[data-item="work-1"]'));
    const handle = query('[data-toolbar-kind="item"] .drag-handle'),
      h = handle.getBoundingClientRect();
    pointer(handle, "pointerdown", h.x + 13, h.y + 13, 1);
    pointer(document, "pointermove", h.x + 23, h.y + 13, 1);
    await wait();
    query('[data-item="work-5"]').scrollIntoView({ block: "center" });
    await wait();
    pointer(document, "pointermove", innerWidth / 2, 30, 1);
    await wait();
    pointer(document, "pointerup", innerWidth / 2, 30);
    await wait();
    assert(order("works").join() === before, "Fixed topbar drop committed");
  });
  await test("Separate image actions and link placement below the topbar", async () => {
    await hover(query(".about-visual"));
    assert(
      labels().length === 2 && toolbar().dataset.toolbarKind === "image",
      "Image actions missing",
    );
    const el = field("about.link").closest(".canvas-link");
    el.scrollIntoView({ block: "start" });
    window.scrollBy(0, -72);
    await wait();
    await hover(field("about.link"), false);
    const r = toolbar().getBoundingClientRect(),
      a = el.getBoundingClientRect();
    assert(
      r.top >= a.bottom &&
        r.left >= 0 &&
        r.right <= innerWidth &&
        Math.abs(r.right - a.right) < 1,
      "Link toolbar not right-aligned/flipped/clamped",
    );
  });
  await test("Keyboard focus reveals item tools without editing text", async () => {
    const el = query('[data-item="event-1"]');
    el.scrollIntoView({ block: "center" });
    el.focus();
    await wait();
    assert(
      toolbar()?.dataset.owner === "event-1",
      "Focus did not reveal tools",
    );
    el.blur();
  });
  await test("Exhibition reorder, last-item protection, and disabled handle", async () => {
    const initial = order("exhibitions"),
      indicated = await drag("exhibitions", "event-1", "event-3");
    assert(
      indicated &&
        order("exhibitions").indexOf("event-1") ===
          initial.indexOf(indicated) &&
        order("exhibitions")[0] !== "event-1",
      "List drop did not match highlighted slot",
    );
    while (order("exhibitions").length > 1) {
      await hover(query(`[data-item="${order("exhibitions")[0]}"]`));
      await action("Delete item");
    }
    await hover(query(`[data-item="${order("exhibitions")[0]}"]`));
    assert(
      labels().includes("Cannot delete the last item"),
      "Missing last-item protection",
    );
    const disabled = all('.floating-tools [aria-disabled="true"]');
    assert(disabled.length === 2, "Delete/drag should be disabled");
    disabled.forEach((button) => button.click());
    await wait();
    assert(order("exhibitions").length === 1, "Last item removed");
  });
  await test("Inline images and their repeatable parents have separate tools", async () => {
    const card = query('[data-item="study-1"]'),
      visual = card.querySelector(".study-image"),
      img = visual.querySelector("img"),
      href = location.href;
    assert(
      getComputedStyle(img).position === "static" &&
        getComputedStyle(card).backgroundImage === "none" &&
        visual.getBoundingClientRect().bottom <=
          field("study-1.title").getBoundingClientRect().top,
      "Image is not a separate element in the document flow",
    );
    await hover(card);
    assert(
      toolbar()?.dataset.owner === "study-1" &&
        labels().join("|") === "Duplicate item|Delete item|Drag item",
      "Parent should only have duplicate, delete and drag",
    );
    await hover(visual);
    assert(
      toolbar()?.dataset.owner === "study-1.image" &&
        labels().join("|") === "Replace image|Edit image",
      "Nested image should own only the two image actions",
    );
    const before = img.src;
    await action("Replace image");
    await action("Edit image");
    assert(
      img.src === before && location.href === href && !query(".drag-preview"),
      "Image demos changed data or started dragging",
    );
    await hover(field("study-1.title"));
    assert(
      toolbar()?.dataset.owner === "study-1",
      "Text hover lost parent tools or retained image tools",
    );
    visual.focus();
    await wait();
    assert(
      toolbar()?.dataset.owner === "study-1.image",
      "Keyboard image focus has no tools",
    );
    visual.blur();
    await edit("study-1.title", "Новый взгляд на цвет");
    await hover(card);
    assert(labels().length === 3, "Parent panel did not return after editing");
  });
  await test(
    "Slow top, side and diagonal paths retain the active card toolbar",
    checkInsetToolbarBridge,
  );
  await test(
    "Hover dwell filters fast sweeps and cancels stale candidates",
    checkHoverDwell,
  );
  await test("Inline-image group copies independently, sorts, cancels and protects its last item", async () => {
    const foreign = order("works").join();
    await hover(query('[data-item="study-1"]'));
    await action("Duplicate item");
    const copy = order("studies")[1];
    assert(
      copy !== "study-1" &&
        field(`${copy}.title`).innerText === "Новый взгляд на цвет",
      "Latest text was not copied next to original",
    );
    const image = query(`[data-editor-target="${copy}.image"] img`);
    assert(
      image?.src === query('[data-editor-target="study-1.image"] img').src,
      "Image missing from copy",
    );
    await edit(`${copy}.title`, "Независимая копия");
    assert(
      field("study-1.title").innerText === "Новый взгляд на цвет",
      "Copy shares text state",
    );
    const before = order("studies"),
      indicated = await drag("studies", "study-1", "study-3");
    assert(
      indicated &&
        order("studies").indexOf("study-1") === before.indexOf(indicated) &&
        order("studies")[0] !== "study-1",
      "Image group did not reorder between rows",
    );
    const reordered = order("studies").join();
    await drag("studies", "study-1", "study-2", { cancel: true });
    await drag("studies", "study-1", "study-2", { outside: true });
    await drag("studies", "study-1", "work-1");
    assert(
      order("studies").join() === reordered &&
        order("works").join() === foreign,
      "Cancelled or foreign drop changed a list",
    );
    while (order("studies").length > 1) {
      await hover(query(`[data-item="${order("studies")[0]}"]`));
      await action("Delete item");
      assert(!toolbar(), "Deleted item left a toolbar visible");
    }
    await hover(query(`[data-item="${order("studies")[0]}"]`));
    assert(
      labels().includes("Cannot delete the last item") &&
        all('.floating-tools [aria-disabled="true"]').length === 2,
      "Last inline-image item lacks delete/drag guards",
    );
    await action("Cannot delete the last item");
    assert(order("studies").length === 1, "Last inline-image item was deleted");
  });
  await test("Long text expands without horizontal overflow", async () => {
    await edit("work-2.title", "Очень длинный заголовок ".repeat(12));
    await edit("work-2.cta", "Очень длинная подпись кнопки ".repeat(5));
    assert(
      document.documentElement.scrollWidth <= innerWidth,
      "Long text overflows viewport",
    );
    const card = query('[data-item="work-2"]').getBoundingClientRect(),
      title = field("work-2.title").getBoundingClientRect();
    assert(
      title.bottom < card.bottom && title.right <= card.right,
      "Text escapes card",
    );
  });
  document.activeElement?.blur();
  return {
    viewport: { width: innerWidth, height: innerHeight },
    results,
    passed: results.filter((r) => r.result === "passed").length,
    total: results.length,
  };
}
