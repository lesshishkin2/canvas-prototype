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

test("use the underlying element's full height: exactly 50% stays, above 50% moves", () => {
  assert.equal(measureToolbarClearance([button], [rect(110, 128, 20, 32)]), 0);
  assert.equal(measureToolbarClearance([button], [rect(110, 127, 20, 32)]), 23);
  assert.equal(measureToolbarClearance([button], [rect(110, 108, 20, 12)]), 42);
});

test("a whole 36px button over a large image or a 72px thumbnail does not trigger clearance", () => {
  assert.equal(
    measureToolbarClearance([button], [rect(100, 100, 200, 300)]),
    0,
  );
  assert.equal(measureToolbarClearance([button], [rect(100, 100, 180, 72)]), 0);
  assert.equal(
    measureToolbarClearance([button], [rect(100, 100, 180, 70)]),
    50,
  );
});

test("union covered height across wrapped rows without double-counting adjacent buttons or gaps", () => {
  const image = rect(100, 100, 180, 100);
  assert.equal(
    measureToolbarClearance([button, rect(136, 108, 36, 36)], [image]),
    0,
  );
  assert.equal(
    measureToolbarClearance([button, rect(100, 152, 36, 20)], [image]),
    78,
  );
  assert.equal(
    measureToolbarClearance([button, rect(100, 152, 36, 14)], [image]),
    0,
  );
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
      [rect(100, 120, 36, 40), rect(150, 110, 36, 60)],
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
    measureToolbarClearance([rect(8, 63, 36, 36)], [rect(0, 75, 390, 32)], 57),
    30,
  );
});
