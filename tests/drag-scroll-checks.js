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
function pointer(node, type, x, y, buttons = 0, pointerType = "mouse") {
  node.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: y,
      buttons,
      button: 0,
      pointerId: 1,
      pointerType,
      isPrimary: true,
    }),
  );
}
async function begin(id, inputMode = "mouse") {
  const node = item(id);
  document.activeElement?.blur();
  pointer(q(".editor-topbar"), "pointermove", 400, 20);
  // Previous sorting/cancellation may still be animating. Use the settled
  // layout before scrolling to and hovering the next grip.
  for (let attempt = 0; attempt < 40; attempt++) {
    await frame();
    const value = getComputedStyle(node).transform;
    const matrix = new DOMMatrix(value === "none" ? undefined : value);
    if (Math.abs(matrix.e) < 0.5 && Math.abs(matrix.f) < 0.5) break;
  }
  if (node.dataset.list === "menu") window.scrollTo(0, 0);
  else
    window.scrollTo(
      0,
      scrollY +
        node.parentElement.getBoundingClientRect().top +
        node.offsetTop -
        280,
    );
  await wait(100);
  const r = node.getBoundingClientRect();
  if (inputMode === "touch") {
    pointer(node, "pointerdown", r.left + 3, r.top + 3, 1, inputMode);
    pointer(node, "pointerup", r.left + 3, r.top + 3, 0, inputMode);
  } else pointer(node, "pointermove", r.left + 3, r.top + 3);
  await wait();
  // An exiting/re-entering portal can exist before its geometry is ready.
  // A real user can only grab the visible, positioned control.
  for (let attempt = 0; attempt < 30; attempt++) {
    const tools = panel(id);
    if (
      tools?.dataset.positioned === "true" &&
      tools.style.visibility === "visible" &&
      !tools.inert
    )
      break;
    await wait(50);
  }
  assert(
    panel(id)?.dataset.positioned === "true" &&
      panel(id)?.style.visibility === "visible" &&
      !panel(id)?.inert,
    `Handle is not visible for ${id}`,
  );
  const handle = panel(id)?.querySelector(".drag-handle");
  assert(handle, `Missing handle for ${id}`);
  const h = handle.getBoundingClientRect();
  const start = { x: h.left + h.width / 2, y: h.top + h.height / 2 };
  pointer(handle, "pointerdown", start.x, start.y, 1, inputMode);
  pointer(document, "pointermove", start.x + 10, start.y, 1, inputMode);
  await wait(80);
  assert(
    document.body.dataset.editorMode === "dragging",
    "Drag did not activate",
  );
  return start;
}
async function finish(point, cancel = false, inputMode = "mouse") {
  if (cancel)
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        key: "Escape",
        code: "Escape",
      }),
    );
  pointer(document, "pointerup", point.x, point.y, 0, inputMode);
  await wait();
  assert(!q(".drag-preview"), "Drag overlay leaked");
  assert(!q(".sort-insertion-marker"), "Insertion marker leaked");
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

// Unequal slots must move content without stretching text, images or borders.
export async function runSortSizeChecks({
  inputMode = "mouse",
  lists = ["menu", "edges", "duets"],
} = {}) {
  await document.fonts.ready;
  const results = [];
  for (const list of lists) {
    for (const cancel of [true, false]) {
      const ids = order(list);
      const from = ids[0],
        to = ids[1];
      const start = await begin(from, inputMode);
      const source = item(from).getBoundingClientRect();
      const slot = item(to).getBoundingClientRect();
      const offset = {
        x:
          start.x < source.left || start.x > source.right
            ? source.left + source.width / 2 - start.x
            : 0,
        y:
          start.y < source.top || start.y > source.bottom
            ? source.top + source.height / 2 - start.y
            : 0,
      };
      const end = {
        x: Math.max(
          8,
          Math.min(innerWidth - 8, slot.left + slot.width / 2 - offset.x),
        ),
        y: slot.top + Math.min(70, slot.height / 2) - offset.y,
      };
      const nodes = ids.map(item);
      const dimensions = nodes.map((node) => node.getBoundingClientRect());
      const preview = q(".drag-preview");
      const previewSize = preview.getBoundingClientRect();
      let maxSizeError = 0;
      try {
        pointer(document, "pointermove", end.x, end.y, 1, inputMode);
        for (let i = 0; i < 20; i++) {
          await frame();
          [...nodes, preview].forEach((node, index) => {
            const before = dimensions[index] || previewSize;
            const rect = node.getBoundingClientRect();
            const error = Math.max(
              Math.abs(rect.width - before.width),
              Math.abs(rect.height - before.height),
            );
            maxSizeError = Math.max(maxSizeError, error);
            assert(
              error < 0.5,
              `${list}: ${node.dataset.item || "preview"} stretched by ${error.toFixed(2)}px during drag`,
            );
          });
        }
        assert(
          q(".drop-target")?.dataset.item === to,
          `${list}: missed the intended slot`,
        );
        await finish(end, cancel, inputMode);
        const expected = cancel ? ids : [ids[1], ids[0], ...ids.slice(2)];
        assert(
          JSON.stringify(order(list)) === JSON.stringify(expected),
          `${list}: incorrect order after ${cancel ? "cancel" : "drop"}`,
        );
        assert(!q(".drag-preview"), `${list}: preview remains after drop`);
        nodes.forEach((node) => {
          const value = getComputedStyle(node).transform;
          const matrix = new DOMMatrix(value === "none" ? undefined : value);
          assert(
            Math.abs(matrix.a - 1) < 0.001 && Math.abs(matrix.d - 1) < 0.001,
            `${list}: scale remains after drop`,
          );
        });
        results.push({ list, cancel, maxSizeError });
      } finally {
        if (document.body.dataset.editorMode === "dragging")
          await finish(end, true, inputMode);
      }
    }
  }
  return { viewport: { width: innerWidth, height: innerHeight }, results };
}

// Every edge-case card shares a drop range, including the old lower subgroup.
export async function runUnifiedEdgeSortChecks(inputMode = "mouse") {
  await document.fonts.ready;
  const containers = q('[data-section="edges"]').querySelectorAll(
    "[data-list-container]",
  );
  assert(
    containers.length === 1 && order("edges").length === 10,
    "Edge cases are still split into separate lists",
  );
  const results = [];
  for (const [from, to, cancel] of [
    ["edge-narrow", "edge-tiny", true],
    ["edge-narrow", "edge-tiny", false],
    ["edge-compact", "edge-wide", false],
    ["edge-wide", "edge-long", false],
    ["edge-tiny", "study-1", false],
  ]) {
    const before = order("edges"),
      sourceNode = item(from);
    const fields = [...sourceNode.querySelectorAll("[data-field]")].map(
      (n) => n.textContent,
    );
    const start = await begin(from, inputMode),
      source = sourceNode.getBoundingClientRect();
    const offset = {
      x:
        start.x < source.left || start.x > source.right
          ? source.left + source.width / 2 - start.x
          : 0,
      y:
        start.y < source.top || start.y > source.bottom
          ? source.top + source.height / 2 - start.y
          : 0,
    };
    const destination = item(to),
      parent = destination.parentElement;
    scrollTo(
      0,
      scrollY +
        parent.getBoundingClientRect().top +
        destination.offsetTop -
        260,
    );
    await wait(100);
    const bounds = parent.getBoundingClientRect();
    const end = {
      x: Math.max(
        8,
        Math.min(
          innerWidth - 8,
          bounds.left +
            destination.offsetLeft +
            destination.offsetWidth / 2 -
            offset.x,
        ),
      ),
      y:
        bounds.top +
        destination.offsetTop +
        Math.min(70, destination.offsetHeight / 2) -
        offset.y,
    };
    try {
      pointer(document, "pointermove", end.x, end.y, 1, inputMode);
      await wait();
      if (before.includes(to))
        assert(
          q(".drop-target")?.dataset.item === to,
          `Missed ${to} across rows (over: ${q(".drop-target")?.dataset.item})`,
        );
      await finish(end, cancel, inputMode);
      const expected = [...before];
      if (!cancel && before.includes(to))
        expected.splice(
          before.indexOf(to),
          0,
          expected.splice(before.indexOf(from), 1)[0],
        );
      assert(
        order("edges").join() === expected.join(),
        `Incorrect result for ${from} → ${to}`,
      );
      assert(item(from) === sourceNode, "Reorder remounted the card");
      assert(
        JSON.stringify(
          [...sourceNode.querySelectorAll("[data-field]")].map(
            (n) => n.textContent,
          ),
        ) === JSON.stringify(fields),
        "Reorder changed editable content",
      );
      assert(
        Math.abs(item("edge-narrow").getBoundingClientRect().width - 180) < 0.5,
        "Narrow card lost its width",
      );
      assert(
        Math.abs(
          q('[data-editor-target="edge-tiny.image"]').getBoundingClientRect()
            .width - 32,
        ) < 0.5,
        "Tiny image lost its width",
      );
      results.push({ from, to, cancel, passed: true });
    } finally {
      if (document.body.dataset.editorMode === "dragging")
        await finish(end, true, inputMode);
    }
  }
  return { inputMode, width: innerWidth, results };
}

// A drop target must not look like a second focused/selected item.
export async function runDragFeedbackChecks(inputMode = "mouse") {
  await document.fonts.ready;
  const results = [];
  for (const list of ["menu", "works", "edges", "exhibitions"]) {
    const ids = order(list);
    for (const after of [true, false]) {
      const from = ids[after ? 0 : 1],
        to = ids[after ? 1 : 0];
      const start = await begin(from, inputMode);
      const source = item(from).getBoundingClientRect();
      if (list !== "menu") {
        const destination = item(to);
        scrollTo(
          0,
          scrollY +
            destination.parentElement.getBoundingClientRect().top +
            destination.offsetTop -
            280,
        );
        await wait(100);
      }
      const destination = item(to),
        parent = destination.parentElement.getBoundingClientRect();
      const target = {
        left: parent.left + destination.offsetLeft,
        top: parent.top + destination.offsetTop,
        width: destination.offsetWidth,
        height: destination.offsetHeight,
      };
      const end = {
        x: Math.max(
          8,
          Math.min(
            innerWidth - 8,
            target.left +
              target.width / 2 +
              (start.x < source.left || start.x > source.right
                ? start.x - (source.left + source.width / 2)
                : 0),
          ),
        ),
        y:
          target.top +
          Math.min(100, target.height / 2) +
          (start.y < source.top || start.y > source.bottom
            ? start.y - (source.top + source.height / 2)
            : 0),
      };
      try {
        pointer(document, "pointermove", end.x, end.y, 1, inputMode);
        await wait();
        assert(
          q(".drop-target") === item(to),
          `${list} ${after ? "forward" : "backward"}: missed target (${q(".drop-target")?.dataset.item})`,
        );
        const marker = q(".sort-insertion-marker");
        assert(marker, `${list}: missing insertion indicator`);
        assert(
          getComputedStyle(marker).pointerEvents === "none",
          "Marker intercepts input",
        );
        for (const id of ids) {
          const style = getComputedStyle(item(id));
          assert(
            style.outlineStyle === "none" ||
              parseFloat(style.outlineWidth) === 0,
            `${list}: ${id} has an extra selection outline`,
          );
        }
        assert(
          getComputedStyle(q(".drag-preview")).outlineStyle === "solid",
          "Dragged copy lost its own outline",
        );
        const r = item(to).getBoundingClientRect(),
          m = marker.getBoundingClientRect();
        const vertical =
          list === "exhibitions" || (innerWidth <= 767 && list !== "menu");
        const expected = vertical
          ? after
            ? r.bottom + 3
            : r.top - 6
          : after
            ? r.right + 3
            : r.left - 6;
        assert(
          Math.abs((vertical ? m.top : m.left) - expected) < 0.5,
          `${list}: insertion boundary does not follow its displaced neighbour`,
        );
        const outside = { x: 2, y: 20 };
        pointer(document, "pointermove", outside.x, outside.y, 1, inputMode);
        await wait();
        assert(
          !q(".sort-insertion-marker"),
          `${list}: marker persists outside the list`,
        );
        results.push({ list, after, passed: true });
      } finally {
        await finish(end, true, inputMode);
      }
      assert(
        order(list).join() === ids.join(),
        `${list}: cancel changed order`,
      );
    }
  }
  // Do not remove native keyboard focus styling to fix a drag-only affordance.
  const node = item(order("menu")[0]);
  node.focus({ preventScroll: true });
  assert(
    node.matches(":focus-visible") &&
      getComputedStyle(node).outlineStyle === "solid",
    "Keyboard focus outline is missing after drag",
  );
  node.blur();
  return { inputMode, width: innerWidth, results };
}
