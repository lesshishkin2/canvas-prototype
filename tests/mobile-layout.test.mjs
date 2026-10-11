import { test } from "node:test";
import assert from "node:assert/strict";
import { placeToolbar } from "../src/toolbar-layout.js";

const rect = (left, top, width, height) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const view = { left: 0, top: 57, right: 390, bottom: 844, touch: true };
const overlap = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
test("touch tools can be wider and taller than their image", () => {
  const image = rect(20, 160, 32, 32);
  const tools = placeToolbar(
    { kind: "image" },
    image,
    rect(0, 0, 87, 44),
    view,
  );
  assert.ok(tools && tools.left >= 8);
  assert.equal(tools.top + 22, image.top + 16);
});
test("compact rows use external tools; links avoid both ancestors and labels", () => {
  const row = rect(20, 180, 350, 40);
  const parent = placeToolbar({ kind: "item" }, row, rect(0, 0, 139, 44), view);
  assert.equal(parent.bottom, row.top - 7);
  const link = rect(230, 188, 80, 24);
  const tools = placeToolbar({ kind: "link" }, link, rect(0, 0, 44, 44), view, [
    parent,
  ]);
  assert.ok(tools && !overlap(tools, parent) && !overlap(tools, link));
});
test("bottom collisions find room above instead of losing image actions", () => {
  const image = rect(230, 785, 100, 59),
    parent = rect(190, 768, 180, 44);
  const tools = placeToolbar(
    { kind: "image" },
    image,
    rect(0, 0, 87, 44),
    view,
    [parent],
  );
  assert.ok(tools && tools.bottom <= 836 && !overlap(tools, parent));
});
test("visual viewport offsets and keyboard bounds apply to every candidate", () => {
  const bounds = { left: 20, top: 130, right: 340, bottom: 400, touch: true };
  const tools = placeToolbar(
    { kind: "link" },
    rect(300, 380, 30, 20),
    rect(0, 0, 44, 44),
    bounds,
    [rect(200, 320, 132, 44)],
  );
  assert.ok(
    tools &&
      tools.left >= 28 &&
      tools.right <= 332 &&
      tools.top >= 134 &&
      tools.bottom <= 392,
  );
});
test("desktop placement retains the clipped-card guard and measured header edge", () => {
  const bounds = { left: 0, top: 57, right: 390, bottom: 844 };
  const section = placeToolbar(
    { kind: "section" },
    rect(0, 0, 390, 500),
    rect(0, 0, 390, 46),
    bounds,
  );
  assert.equal(section.top, 57);
  assert.equal(
    placeToolbar(
      { kind: "item" },
      rect(0, 0, 100, 70),
      rect(0, 0, 91, 28),
      bounds,
    ),
    null,
  );
});
