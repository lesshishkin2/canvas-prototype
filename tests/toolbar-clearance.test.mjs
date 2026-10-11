import { test } from "node:test";
import assert from "node:assert/strict";
import { measureToolbarClearance } from "../src/toolbar-clearance.js";

const rect = (left, top, width, height) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const button = rect(100, 108, 36, 36);

test("reserve space only above 50% of the button height, not the image height", () => {
  assert.equal(measureToolbarClearance([button], [rect(110, 126, 20, 32)]), 0);
  assert.equal(measureToolbarClearance([button], [rect(110, 125, 20, 32)]), 25);
  assert.equal(measureToolbarClearance([button], [rect(110, 108, 20, 12)]), 0);
});

test("a gap between actual buttons and horizontal near misses do not activate padding", () => {
  assert.equal(measureToolbarClearance([button], [rect(137, 108, 20, 36)]), 0);
  assert.equal(
    measureToolbarClearance(
      [rect(0, 108, 70, 36), rect(300, 108, 70, 36)],
      [rect(100, 108, 70, 36)],
    ),
    0,
  );
});

test("reserve the maximum missing space once, including a 6px gap", () => {
  assert.equal(
    measureToolbarClearance(
      [button, rect(150, 108, 36, 36)],
      [rect(100, 120, 36, 50), rect(150, 110, 36, 70)],
    ),
    40,
  );
});

test("a large image already clipped by the topbar must not generate a huge spacer", () => {
  assert.equal(
    measureToolbarClearance(
      [rect(8, 63, 36, 36)],
      [rect(0, -500, 390, 900)],
      57,
    ),
    0,
  );
  assert.equal(
    measureToolbarClearance([rect(8, 63, 36, 36)], [rect(0, 75, 390, 72)], 57),
    30,
  );
});
