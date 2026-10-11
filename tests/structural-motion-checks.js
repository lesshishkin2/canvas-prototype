// Run in Chrome: (await import('/tests/structural-motion-checks.js')).runStructuralMotionChecks()
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise(requestAnimationFrame);
const q = (selector) => document.querySelector(selector);
const item = (id) => q(`[data-item="${id}"]`);
const items = (list) => [
  ...document.querySelectorAll(`[data-list-container="${list}"] > [data-item]`),
];
const assert = (condition, message) => {
  if (!condition) throw Error(message);
};
const rect = (node) => {
  const r = node.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
async function action(id, label, detail = 1) {
  document.activeElement?.blur();
  item(id).focus({ preventScroll: true });
  await frame();
  const button = q(`[data-owner="${id}"] [aria-label="${label}"]`);
  assert(button, `Missing action ${label} on ${id}`);
  button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
}
export async function runStructuralMotionChecks() {
  await document.fonts.ready;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const results = [];
  for (const list of ["studies", "works", "exhibitions", "menu", "edges"]) {
    const initial = items(list);
    const source = initial[0],
      sibling = initial[1];
    source.scrollIntoView({ block: "center" });
    await wait(120);
    const before = rect(sibling);
    const initialIds = initial.map((n) => n.dataset.item);
    const beforeScroll = scrollY;
    await action(source.dataset.item, "Duplicate item");
    const copy = items(list).find((n) => !initialIds.includes(n.dataset.item));
    assert(
      copy && items(list)[1] === copy,
      `${list}: copy inserted after source`,
    );
    const first = rect(sibling);
    assert(
      reduced || distance(first, before) < 2,
      `${list}: sibling jumps at first frame (${distance(first, before)})`,
    );
    const active = document
      .getAnimations()
      .filter((a) => a.effect.target.dataset.layoutAnimating);
    assert(
      active.some((a) => a.effect.target === copy),
      `${list}: missing entrance`,
    );
    if (reduced)
      assert(
        active.every((a) =>
          a.effect
            .getKeyframes()
            .every((k) => !k.transform || k.transform === "none"),
        ),
        "Reduced motion moves an element",
      );
    await wait(100);
    const middle = rect(sibling);
    assert(
      !reduced || distance(middle, first) < 1,
      `${list}: reduced motion did not settle immediately`,
    );
    assert(
      Number(getComputedStyle(copy).opacity) > 0 &&
        Number(getComputedStyle(copy).opacity) < 1,
      `${list}: entrance has no intermediate opacity`,
    );
    await wait(220);
    const final = rect(sibling);
    assert(
      reduced || distance(final, before) > 2,
      `${list}: sibling did not move`,
    );
    assert(
      Math.abs(scrollY - beforeScroll) < 1,
      `${list}: scroll anchoring jumped`,
    );
    assert(
      !q("[data-layout-animating]"),
      `${list}: animation was not cleaned up`,
    );
    const id = copy.dataset.item;
    await action(id, "Delete item");
    const ghost = q(".item-exit-ghost");
    assert(
      !item(id) && ghost?.inert && ghost.getAttribute("aria-hidden") === "true",
      `${list}: deletion must update data immediately and leave only an inert ghost`,
    );
    assert(
      !ghost.querySelector(
        "[data-editor-target], [data-item], [contenteditable], [tabindex]",
      ),
      `${list}: exit ghost keeps interactive targets`,
    );
    await wait(300);
    assert(
      !q(".item-exit-ghost") && !q("[data-layout-animating]"),
      `${list}: deletion leaks visual state`,
    );
    assert(
      items(list)
        .map((n) => n.dataset.item)
        .join() === initialIds.join(),
      `${list}: deletion changed unrelated items`,
    );
    results.push({
      list,
      firstFrameJump: distance(first, before),
      motion: distance(final, before),
      passed: true,
    });
  }
  // Interrupt before the 240 ms reflow ends, including the copy's own entrance.
  const original = items("studies")[0];
  original.scrollIntoView({ block: "center" });
  await wait(100);
  const initialIds = items("studies").map((n) => n.dataset.item);
  await action(original.dataset.item, "Duplicate item");
  await wait(80);
  const copy = items("studies")[1],
    sibling = items("studies")[2];
  document.activeElement?.blur();
  copy.focus({ preventScroll: true });
  await frame();
  const beforeInterrupt = rect(sibling);
  q(
    `[data-owner="${copy.dataset.item}"] [aria-label="Delete item"]`,
  ).dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  assert(
    reduced || distance(beforeInterrupt, rect(sibling)) < 2,
    "Interrupted transition jumped",
  );
  await wait(320);
  assert(
    items("studies")
      .map((n) => n.dataset.item)
      .join() === initialIds.join(),
    "Interrupted changes lost data",
  );
  assert(
    !q(".item-exit-ghost") && !q("[data-layout-animating]"),
    "Interrupted animation leaked",
  );
  results.push({ scenario: "rapid copy → delete", passed: true });
  await action(original.dataset.item, "Duplicate item", 0);
  assert(!q("[data-layout-animating]"), "Keyboard action should be immediate");
  const copyId = items("studies")[1].dataset.item;
  await action(copyId, "Delete item", 0);
  assert(!q(".item-exit-ghost"), "Keyboard delete leaves ghost");
  results.push({ scenario: "keyboard", passed: true });
  return { width: innerWidth, reduced, results };
}
