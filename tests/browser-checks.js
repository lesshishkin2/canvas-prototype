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
const toolbar = () => query(".floating-tools");
const labels = () =>
  all(".floating-tools button").map((el) => el.getAttribute("aria-label"));
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
    await wait();
  }
  const r = el.getBoundingClientRect();
  pointer(
    el,
    "pointermove",
    r.x + Math.min(r.width / 2, 35),
    r.y + Math.min(r.height / 2, 40),
  );
  await wait();
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
  const button = all(".floating-tools button").find(
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
  const handle = query(".drag-handle");
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
  await test("Local assets, six sections, no horizontal overflow", async () => {
    await document.fonts.ready;
    assert(all("[data-section]").length === 6, "Incorrect section count");
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
        "Редактировать ссылку элемента · демо|Копировать элемент|Удалить элемент|Перетащить элемент",
      "Incorrect menu actions",
    );
    const item = query('[data-item="menu-1"]').getBoundingClientRect(),
      panel = toolbar().getBoundingClientRect();
    assert(
      panel.top >= 66 && panel.bottom <= item.top,
      "Menu toolbar covers label or topbar",
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
    await action("Редактировать ссылку элемента · демо");
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
    await action("Копировать элемент");
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
    await action("Удалить элемент");
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
      await action("Копировать элемент");
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
      await action("Удалить элемент");
    }
    await hover(query(`[data-item="${order("menu")[0]}"]`));
    const disabled = all('.floating-tools [aria-disabled="true"]');
    assert(
      disabled.length === 2 &&
        labels().includes("Последний элемент нельзя удалить"),
      "Menu final item is not protected",
    );
    disabled.forEach((button) => button.click());
    assert(order("menu").length === 1, "Last menu item removed");
  });
  await test("Ordered card actions and closest target hover", async () => {
    await hover(query('[data-item="work-1"]'));
    assert(
      labels().join("|") ===
        "Заменить изображение · демо|Редактировать изображение · демо|Редактировать ссылку элемента · демо|Копировать элемент|Удалить элемент|Перетащить элемент",
      "Wrong action order",
    );
    await hover(field("work-1.title"), false);
    assert(!toolbar(), "Card toolbar covers text");
    await hover(field("work-1.cta"), false);
    assert(
      labels().length === 1 && labels()[0] === "Редактировать ссылку · демо",
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
    await action("Копировать элемент");
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
    await action("Удалить элемент");
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
    const handle = query(".drag-handle"),
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
    const handle = query(".drag-handle"),
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
      r.top >= a.bottom && r.left >= 0 && r.right <= innerWidth,
      "Link toolbar not flipped/clamped",
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
      await action("Удалить элемент");
    }
    await hover(query(`[data-item="${order("exhibitions")[0]}"]`));
    assert(
      labels().includes("Последний элемент нельзя удалить"),
      "Missing last-item protection",
    );
    const disabled = all('.floating-tools [aria-disabled="true"]');
    assert(disabled.length === 2, "Delete/drag should be disabled");
    disabled.forEach((button) => button.click());
    await wait();
    assert(order("exhibitions").length === 1, "Last item removed");
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
