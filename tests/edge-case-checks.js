import { controlsOverlap } from "./toolbar-geometry.js";

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise(requestAnimationFrame);
const q = (s) => document.querySelector(s);
const panels = () => [
  ...document.querySelectorAll('.floating-tools:not([data-exiting="true"])'),
];
const panel = (id) => panels().find((p) => p.dataset.owner === id);
const assert = (ok, message) => {
  if (!ok) throw Error(message);
};
const target = (id) => q(`[data-editor-target="${id}"]`);
const order = () =>
  [
    ...document.querySelectorAll('[data-list-container="edges"] > [data-item]'),
  ].map((n) => n.dataset.item);
function pointer(node, type, x, y, buttons = 0) {
  node.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons,
    }),
  );
}
function at(x, y) {
  const hit = document.elementFromPoint(x, y);
  assert(hit, "Pointer outside viewport");
  pointer(hit, "pointermove", x, y);
}
function hover(id) {
  const r = target(id).getBoundingClientRect();
  at(r.left + Math.min(30, r.width / 2), r.top + Math.min(80, r.height / 2));
}
function noOverlap() {
  const visible = panels().filter((p) => p.style.visibility === "visible");
  for (let i = 0; i < visible.length; i++) {
    const a = visible[i].getBoundingClientRect();
    assert(
      a.left >= 0 &&
        a.right <= innerWidth &&
        a.top >= 66 &&
        a.bottom <= innerHeight,
      "Tools leave the viewport",
    );
    for (let j = i + 1; j < visible.length; j++)
      assert(!controlsOverlap(visible[i], visible[j]), "Tools overlap");
  }
}
function action(id, label) {
  const b = [...panel(id).querySelectorAll("button")].find(
    (n) => n.getAttribute("aria-label") === label,
  );
  assert(b, `Missing ${label}`);
  b.click();
}

export async function runSectionCollisionChecks() {
  await document.fonts.ready;
  const results = [];
  async function checkFrames(id, top, check) {
    target(id).focus({ preventScroll: true });
    window.scrollBy(0, target(id).getBoundingClientRect().top - top);
    let visibleFrames = 0;
    for (let i = 0; i < 12; i++) {
      await frame();
      const tools = panel(id);
      if (!tools || tools.style.visibility !== "visible") continue;
      check(tools.getBoundingClientRect());
      noOverlap();
      visibleFrames++;
    }
    assert(visibleFrames > 0, `${id} did not show tools`);
    return visibleFrames;
  }
  const free = (r) =>
    assert(
      Math.abs(r.top - 72) < 1,
      "Empty space between section groups displaced the card tools",
    );
  results.push({
    id: "free-section-space-first-frame",
    frames: await checkFrames("work-1", 40, free),
  });
  const firstTop = target("work-1").getBoundingClientRect().top;
  const rightmost = [...document.querySelectorAll('[data-list="works"]')]
    .filter((node) => Math.abs(node.getBoundingClientRect().top - firstTop) < 1)
    .at(-1);
  results.push({
    id: "right-section-buttons-remain-protected",
    frames: await checkFrames(rightmost.dataset.item, 40, (r) => {
      const right = panel("collection")
        .querySelector(".section-tools-end")
        .getBoundingClientRect();
      assert(
        Math.abs(r.top - right.bottom - 6) < 1,
        "The card overlaps section buttons or reserves unused strip padding",
      );
    }),
  });
  results.push({
    id: "return-to-free-space-moves-tools-back-up",
    frames: await checkFrames("work-1", 40, free),
  });
  // At narrower widths the logo tools meet Edit block; at 1920 they fit beside it.
  results.push({
    id: "logo-respects-actual-edit-block-bounds",
    frames: await checkFrames("menu.logo", 86, (r) => {
      const edit = panel("menu")
        .querySelector(".section-edit-button")
        .getBoundingClientRect();
      const image = target("menu.logo").getBoundingClientRect();
      const expected =
        r.left < edit.right && r.right > edit.left
          ? edit.bottom + 6
          : image.top + (image.height - r.height) / 2;
      assert(
        Math.abs(r.top - expected) < 1,
        "Image tools overlap Edit block or shift in its empty neighbouring space",
      );
    }),
  });
  return { viewport: { width: innerWidth, height: innerHeight }, results };
}

export async function runEdgeCaseChecks() {
  document.activeElement?.blur();
  await document.fonts.ready;
  window.scrollTo(0, q('[data-section="edges"]').offsetTop - 90);
  await wait(120);
  at(400, 20);
  await wait();
  const results = [];
  for (const [id, parentId] of [
    ["edge-wide.image", "edge-wide"],
    ["edge-narrow.image", "edge-narrow"],
    ["edge-link.cta", "edge-link"],
  ]) {
    hover(id);
    const start = performance.now();
    let firstFrame,
      samples = 0;
    while (performance.now() - start < 550) {
      await frame();
      noOverlap();
      const node = panel(id);
      if (!node || Number(getComputedStyle(node).opacity) === 0) continue;
      const p = node.getBoundingClientRect(),
        a = target(id).getBoundingClientRect(),
        parent = panel(parentId).getBoundingClientRect();
      if (id.endsWith("image")) {
        assert(
          Math.abs(p.left + p.width / 2 - (a.left + a.width / 2)) < 1,
          "Image panel lost horizontal centering",
        );
        if (id === "edge-wide.image")
          assert(
            Math.abs(p.top + p.height / 2 - (a.top + a.height / 2)) < 1,
            "Wide image shifts without a collision",
          );
        else
          assert(
            Math.abs(p.top - parent.bottom - 6) < 1,
            "Narrow image is not below parent tools with a 6px gap",
          );
      } else {
        assert(
          p.top >= parent.bottom + 6 &&
            p.top >= a.bottom + 7 &&
            Math.abs(p.right - a.right) < 1,
          "Link collision is unresolved or covers its label",
        );
      }
      firstFrame ||= {
        left: p.left,
        top: p.top,
        parentBottom: parent.bottom,
        anchorTop: a.top,
      };
      samples++;
    }
    assert(samples > 0, `${id} never appeared`);
    results.push({ id, samples, firstFrame, result: "passed" });
  }

  const href = location.href,
    link = target("edge-link.cta").getBoundingClientRect(),
    tools = panel("edge-link.cta").getBoundingClientRect();
  at(tools.left + 13, (link.bottom + tools.top) / 2);
  await wait(220);
  assert(
    panel("edge-link.cta") && panel("edge-link"),
    "Gap to displaced link tools loses ownership",
  );
  at(tools.left + 13, tools.top + 13);
  await wait(220);
  document
    .elementFromPoint(tools.left + 13, tools.top + 13)
    .closest("button")
    .click();
  assert(location.href === href, "Link demo navigates");
  results.push({ id: "displaced-link-access", result: "passed" });

  // Empty space in the section strip must not become a third obstacle.
  hover("edge-narrow.image");
  await wait();
  // Pin ownership with keyboard focus while this case tests layout during scroll.
  target("edge-narrow.image").focus();
  window.scrollBy(0, target("edge-narrow").getBoundingClientRect().top - 74);
  await wait(160);
  noOverlap();
  let a = panel("edges").getBoundingClientRect(),
    b = panel("edge-narrow").getBoundingClientRect(),
    c = panel("edge-narrow.image").getBoundingClientRect();
  assert(
    Math.abs(a.top - q(".editor-topbar").getBoundingClientRect().bottom) < 1 &&
      Math.abs(b.top - target("edge-narrow").getBoundingClientRect().top - 8) <
        1 &&
      Math.abs(c.top - b.bottom - 6) < 1,
    "Transparent section gap displaced the card, or image lost its 6px gap",
  );
  hover("edge-link.cta");
  await wait();
  noOverlap();
  a = panel("edge-link").getBoundingClientRect();
  b = panel("edge-link.cta").getBoundingClientRect();
  assert(b.top >= a.bottom + 6, "Link tools collide with parent under topbar");
  results.push({ id: "image-and-link-under-topbar", result: "passed" });

  window.scrollTo(0, q('[data-section="edges"]').offsetTop - 90);
  await wait(120);
  hover("edge-narrow.image");
  await wait();
  const count = order().length;
  action("edge-narrow", "Duplicate item");
  await wait(100);
  const copy = order()[order().indexOf("edge-narrow") + 1];
  assert(
    order().length === count + 1 && copy !== "edge-narrow",
    "Edge copy failed",
  );
  assert(
    target(copy).classList.contains("edge-narrow") && target(`${copy}.image`),
    "Copy lost its layout or independent image ID",
  );
  target(copy).scrollIntoView({ block: "center" });
  await wait(120);
  hover(`${copy}.image`);
  await wait();
  action(copy, "Delete item");
  await wait(100);
  assert(
    order().length === count && !panels().length,
    "Delete failed or kept hot tools",
  );
  results.push({ id: "independent-copy-and-delete", result: "passed" });

  target("edge-narrow").scrollIntoView({ block: "center" });
  await wait(120);
  hover("edge-narrow.image");
  await wait();
  const slot = target("edge-wide").getBoundingClientRect(),
    handle = panel("edge-narrow").querySelector(".drag-handle"),
    h = handle.getBoundingClientRect();
  pointer(handle, "pointerdown", h.left + 10, h.top + 13, 1);
  pointer(document, "pointermove", h.left + 20, h.top + 13, 1);
  await wait(100);
  pointer(
    document,
    "pointermove",
    slot.left + slot.width / 2,
    slot.top + 80,
    1,
  );
  await wait(120);
  pointer(document, "pointerup", slot.left + slot.width / 2, slot.top + 80);
  await wait(160);
  assert(
    order()[0] === "edge-narrow" && !q(".drag-preview"),
    "Mixed-width demo cards did not reorder",
  );
  results.push({ id: "mixed-width-sort", result: "passed" });
  return { viewport: { width: innerWidth, height: innerHeight }, results };
}
