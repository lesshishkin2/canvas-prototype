const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise(requestAnimationFrame);
const query = (s) => document.querySelector(s);
const tools = () => [
  ...document.querySelectorAll('.floating-tools:not([data-exiting="true"])'),
];
const tool = (id) => tools().find((p) => p.dataset.owner === id);
const assert = (ok, message) => {
  if (!ok) throw Error(message);
};
const card = () => query('[data-item="study-1"]');
const ids = () =>
  [
    ...document.querySelectorAll(
      '[data-list-container="studies"] > [data-item]',
    ),
  ].map((n) => n.dataset.item);
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
function at(x, y) {
  const hit = document.elementFromPoint(x, y);
  assert(hit, "Pointer outside viewport");
  pointer(hit, "pointermove", x, y);
}
function imagePoint(node = card()) {
  const r = node.querySelector("figure").getBoundingClientRect();
  at(r.left + 40, r.top + 80);
}
function noOverlaps() {
  const panels = tools().filter((p) => p.style.visibility === "visible");
  for (let i = 0; i < panels.length; i++) {
    const a = panels[i].getBoundingClientRect();
    assert(
      a.top >= 66 &&
        a.bottom <= innerHeight &&
        a.left >= 0 &&
        a.right <= innerWidth,
      "Panel escaped the viewport",
    );
    for (let j = i + 1; j < panels.length; j++) {
      const b = panels[j].getBoundingClientRect();
      assert(
        !(
          a.left < b.right &&
          a.right > b.left &&
          a.top < b.bottom &&
          a.bottom > b.top
        ),
        "Parent and child panels overlap",
      );
    }
  }
}
function button(panel, label) {
  return [...panel.querySelectorAll("button")].find(
    (b) => b.getAttribute("aria-label") === label,
  );
}

export async function runHierarchicalToolsChecks() {
  document.activeElement?.blur();
  await document.fonts.ready;
  at(400, 20);
  await wait();
  const zeroPadding = document.createElement("style");
  zeroPadding.textContent =
    ".study-card { padding-top: 0 !important; padding-left: 0 !important; padding-right: 0 !important; }";
  document.head.append(zeroPadding);
  const checks = [];
  try {
    card().scrollIntoView({ block: "center" });
    await wait(120);
    const anchor = card().getBoundingClientRect();
    assert(
      card().querySelector("figure").getBoundingClientRect().top === anchor.top,
      "Zero-padding scenario not applied",
    );
    imagePoint();
    let firstFrame;
    const start = performance.now();
    while (performance.now() - start < 600) {
      await frame();
      noOverlaps();
      const child = tool("study-1.image");
      if (child && Number(getComputedStyle(child).opacity) > 0) {
        const p = tool("study-1").getBoundingClientRect(),
          c = child.getBoundingClientRect();
        assert(
          Math.abs(c.top - p.bottom - 6) < 1 && Math.abs(c.right - p.right) < 1,
          "First visible frame is not stacked/right-aligned at zero padding",
        );
        firstFrame ||= {
          parentTop: p.top,
          childTop: c.top,
          gap: c.top - p.bottom,
        };
      }
    }
    assert(firstFrame, "Image tools never appeared");
    assert(
      tools()
        .map((p) => p.dataset.owner)
        .join() === "studies,study-1,study-1.image",
      "Missing hierarchy level",
    );
    checks.push({
      name: "Zero padding: first visible frame has three accessible levels",
      result: "passed",
      firstFrame,
    });

    const parent = tool("study-1"),
      section = tool("studies"),
      fixed = parent.getBoundingClientRect();
    for (const field of ["study-1.title", "study-1.cta", "study-1.image"]) {
      const n = query(`[data-editor-target="${field}"]`),
        r = n.getBoundingClientRect();
      at(r.left + 20, r.top + Math.min(20, r.height / 2));
      await wait();
      assert(
        tool("study-1") === parent && tool("studies") === section,
        "Ancestor panel remounted during nested hover",
      );
      const p = parent.getBoundingClientRect();
      assert(
        p.top === fixed.top &&
          p.right === fixed.right &&
          getComputedStyle(parent).opacity === "1",
        "Parent moved or faded during nested hover",
      );
      noOverlaps();
    }
    checks.push({
      name: "Parent identity, position and opacity survive image/text/button transitions",
      result: "passed",
    });

    // Reach the parent through the space between rows, then copy while image tools remain open.
    const p = parent.getBoundingClientRect(),
      c = tool("study-1.image").getBoundingClientRect();
    at(c.left + 13, (p.bottom + c.top) / 2);
    await wait();
    assert(
      tool("study-1") === parent && tool("study-1.image"),
      "Crossing the inter-panel gap lost tools",
    );
    const copy = button(parent, "Копировать элемент"),
      r = copy.getBoundingClientRect();
    at(r.left + r.width / 2, r.top + r.height / 2);
    await wait(220);
    const count = ids().length;
    document
      .elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      .closest("button")
      .click();
    await wait(100);
    assert(
      ids().length === count + 1 && !tools().length,
      "Parent copy failed or tools stayed actionable",
    );
    const copiedId = ids()[ids().indexOf("study-1") + 1];
    const copiedCard = query(`[data-item="${copiedId}"]`);
    copiedCard.scrollIntoView({ block: "center" });
    await wait(100);
    imagePoint(copiedCard);
    await wait();
    button(tool(copiedId), "Удалить элемент").click();
    await wait(100);
    assert(
      ids().length === count && !tools().length,
      "Parent delete failed or left hot tools",
    );
    checks.push({
      name: "Crossing the stack, copying and deleting from parent tools while hovering an image",
      result: "passed",
    });

    card().scrollIntoView({ block: "center" });
    await wait(100);
    imagePoint();
    await wait();
    const handle = tool("study-1").querySelector(".drag-handle"),
      h = handle.getBoundingClientRect();
    pointer(handle, "pointerdown", h.left + 10, h.top + 13, 1);
    pointer(document, "pointermove", h.left + 20, h.top + 13, 1);
    await wait(120);
    assert(
      document.body.dataset.editorMode === "dragging" &&
        tools().every((p) => p.inert && p.style.visibility === "hidden"),
      "Drag did not hide all hierarchy levels",
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        bubbles: true,
      }),
    );
    await wait(100);
    assert(
      !tools().length && !query(".drag-preview"),
      "Drag cancellation left tools or a preview",
    );
    checks.push({
      name: "Parent drag handle works over the image and hides all levels",
      result: "passed",
    });

    imagePoint();
    await wait();
    window.scrollBy(0, card().getBoundingClientRect().top - 74);
    await wait(150);
    noOverlaps();
    const rects = ["studies", "study-1", "study-1.image"].map((id) =>
      tool(id).getBoundingClientRect(),
    );
    assert(
      Math.abs(rects[1].top - rects[0].bottom - 6) < 1 &&
        Math.abs(rects[2].top - rects[1].bottom - 6) < 1,
      "Three levels did not stack under the editor bar on scroll",
    );
    checks.push({
      name: "Scroll recomputes a three-level stack below the fixed topbar",
      result: "passed",
    });

    const next = query('[data-item="study-2"]');
    imagePoint(next);
    await wait();
    assert(
      tool("studies") &&
        tool("study-2") &&
        tool("study-2.image") &&
        !tool("study-1"),
      "Sibling hover retained another card's tools",
    );
    noOverlaps();
    checks.push({
      name: "Sibling hover updates ownership without duplicate parent panels",
      result: "passed",
    });

    query('[data-field="study-2.title"]').focus();
    await frame();
    assert(
      !query(".floating-tools"),
      "Editing did not remove all hierarchy levels immediately",
    );
    document.activeElement.blur();
    checks.push({
      name: "Editing immediately removes every panel",
      result: "passed",
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      padding: 0,
      checks,
    };
  } finally {
    zeroPadding.remove();
    document.activeElement?.blur();
  }
}
