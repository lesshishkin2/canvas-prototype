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

test("image tools stay below their card instead of jumping to a distant section toolbar", () => {
  const image = rect(20, 255, 180, 72);
  const sectionLeft = rect(8, 63, 78, 32);
  const sectionRight = rect(279, 63, 103, 32);
  const cardTools = rect(89, 263, 103, 32);
  const tools = placeToolbar(
    { kind: "image" },
    image,
    rect(0, 0, 63, 32),
    view,
    [sectionLeft, sectionRight, cardTools],
  );
  assert.equal(tools.top, cardTools.bottom + 6);
  assert.equal(tools.left + tools.width / 2, image.left + image.width / 2);
});

test("link tools also resolve a local collision before a distant section row", () => {
  const link = rect(90, 325, 100, 40);
  const sectionTools = rect(8, 63, 78, 32);
  const cardTools = rect(89, 263, 103, 32);
  const tools = placeToolbar({ kind: "link" }, link, rect(0, 0, 32, 32), view, [
    sectionTools,
    cardTools,
  ]);
  assert.equal(tools.top, link.bottom + 7);
  assert.equal(tools.right, link.right);
});

test("bottom-edge image tools stay near their card when falling back above", () => {
  const image = rect(20, 785, 180, 59);
  const sectionTools = rect(8, 63, 78, 32);
  const cardTools = rect(89, 768, 103, 32);
  const tools = placeToolbar(
    { kind: "image" },
    image,
    rect(0, 0, 63, 32),
    view,
    [sectionTools, cardTools],
  );
  assert.equal(tools.bottom, cardTools.top - 6);
  assert.equal(tools.left + tools.width / 2, image.left + image.width / 2);
});
