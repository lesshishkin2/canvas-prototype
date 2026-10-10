// Scroll without pointermove: tools must follow the content under the stationary pointer.
const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));
const q = (selector) => document.querySelector(selector);
const target = (id) => q(`[data-editor-target="${id}"]`);
const tool = (id) =>
  q(`.floating-tools[data-owner="${id}"]:not([data-exiting="true"])`);
const visibleTools = () =>
  [
    ...document.querySelectorAll('.floating-tools:not([data-exiting="true"])'),
  ].filter((node) => node.style.visibility === "visible" && !node.inert);
const assert = (ok, message) => {
  if (!ok) throw Error(message);
};
const underneath = ({ x, y }) =>
  document
    .elementsFromPoint(x, y)
    .find((node) => !node.closest(".floating-tools"));
function move(point) {
  document.elementFromPoint(point.x, point.y).dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      clientX: point.x,
      clientY: point.y,
      pointerType: "mouse",
      buttons: 0,
    }),
  );
}
function expectPointerOwner(point) {
  const source = underneath(point)?.closest("[data-editor-target]");
  const expected = [
    source?.closest('[data-kind="section"]'),
    source?.closest('[data-kind="item"]'),
    ["image", "link"].includes(source?.dataset.kind) ? source : null,
  ]
    .filter(Boolean)
    .map((node) => node.dataset.editorTarget)
    .sort();
  const actual = visibleTools()
    .map((node) => node.dataset.owner)
    .sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `Stationary pointer: ${actual} instead of ${expected}`,
  );
  return actual;
}
async function begin(id) {
  document.activeElement?.blur();
  move({ x: 400, y: 20 });
  window.scrollTo(0, scrollY + target(id).getBoundingClientRect().top - 180);
  await wait();
  const r = target(id).getBoundingClientRect();
  const point = { x: r.left + 35, y: r.top + 60 };
  move(point);
  await wait();
  return point;
}

export async function runScrollHoverChecks() {
  await document.fonts.ready;
  const results = [];
  let point = await begin("study-1.image");
  const parent = tool("study-1"),
    image = tool("study-1.image");
  window.scrollBy(0, 15);
  await wait();
  assert(
    tool("study-1") === parent && tool("study-1.image") === image,
    "Small scroll remounted tools inside the same image",
  );
  expectPointerOwner(point);
  results.push("Small scroll preserves the same image and parent panels");

  window.scrollBy(
    0,
    target("study-1.title").getBoundingClientRect().top + 10 - point.y,
  );
  await wait(70);
  assert(
    !tool("study-1.image") && tool("study-1") === parent,
    "Image tools survive scrolling onto text, or the parent remounts",
  );
  await wait();
  expectPointerOwner(point);
  results.push(
    "Image tools disappear immediately over text; parent remains stable",
  );

  window.scrollBy(
    0,
    target("study-1").getBoundingClientRect().bottom + 50 - point.y,
  );
  await wait(70);
  assert(
    !tool("study-1"),
    "Departed card keeps its tools while the new hover settles",
  );
  await wait();
  expectPointerOwner(point);
  results.push(
    "Leaving a card for section whitespace clears its actions without pointer movement",
  );

  point = await begin("work-1");
  const first = target("work-1").getBoundingClientRect();
  const nextRow = [
    ...document.querySelectorAll('[data-list-container="works"] > [data-item]'),
  ].find(
    (node) =>
      node.getBoundingClientRect().top > first.top + 20 &&
      Math.abs(node.getBoundingClientRect().left - first.left) < 1,
  );
  assert(nextRow, "Missing second grid row");
  window.scrollBy(0, nextRow.getBoundingClientRect().top + 60 - point.y);
  await wait(70);
  assert(
    !tool("work-1") && !tool(nextRow.dataset.item),
    "Scroll retains the old card or skips hover dwell",
  );
  await wait();
  expectPointerOwner(point);
  assert(tool(nextRow.dataset.item), "Second grid row did not activate");
  results.push("Stationary pointer selects the next grid row after dwell");

  point = await begin("study-1.image");
  const controls = tool("study-1").getBoundingClientRect();
  point = { x: controls.left + 13, y: controls.top + 13 };
  move(point);
  window.scrollBy(
    0,
    target("study-1").getBoundingClientRect().bottom + 80 - point.y,
  );
  await wait();
  assert(!tool("study-1"), "Portal tools captured their own stale hover");
  expectPointerOwner(point);
  results.push(
    "Scrolling from a toolbar does not let the portal retain its departed owner",
  );

  point = await begin("study-1.image");
  target("study-1.image").focus();
  await wait(30);
  window.scrollBy(0, 25);
  await wait();
  assert(tool("study-1.image"), "Scrolling stole keyboard focus ownership");
  target("study-1").focus();
  await wait(30);
  window.scrollBy(0, target("study-1").getBoundingClientRect().bottom - 95);
  await wait();
  assert(
    !visibleTools().some((node) => node.dataset.owner === "study-1"),
    "Clipped card actions escaped below the card",
  );
  results.push(
    "Keyboard ownership survives scroll; clipped card actions stay hidden",
  );

  await begin("study-1.image");
  target("study-1.title").focus();
  window.scrollBy(0, 100);
  await wait();
  assert(
    document.activeElement === target("study-1.title") &&
      !visibleTools().length,
    "Scroll reopened tools while editing",
  );
  results.push("Editing remains focused without scroll hover tools");

  await begin("study-1.image");
  document.documentElement.dispatchEvent(new PointerEvent("pointerleave"));
  await wait();
  window.scrollBy(0, 30);
  await wait();
  assert(
    !visibleTools().length,
    "Scroll resurrected hover after the pointer left the window",
  );
  results.push("Window exit invalidates the stored pointer position");

  await begin("study-1.image");
  tool("study-1").querySelector('[aria-label="Копировать элемент"]').click();
  await wait(40);
  window.scrollBy(0, 20);
  await wait();
  assert(
    !visibleTools().length,
    "Scroll bypassed suppression after a structural action",
  );
  results.push(
    "Structural action suppression remains until new pointer movement",
  );
  return { viewport: { width: innerWidth, height: innerHeight }, results };
}
