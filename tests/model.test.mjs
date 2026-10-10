import { test } from "node:test";
import assert from "node:assert/strict";
import {
  duplicateItem,
  removeItem,
  reorderItems,
  initialLists,
} from "../src/data.js";
test("copy current content, adjacent placement and independent editing", () => {
  const source = structuredClone(initialLists.works);
  source[0].title = "Изменённый текст";
  const result = duplicateItem(source, "work-1", "copy-1");
  assert.equal(result.length, 7);
  assert.equal(result[1].id, "copy-1");
  assert.equal(result[1].title, "Изменённый текст");
  result[1].title = "Другой текст";
  assert.equal(source[0].title, "Изменённый текст");
  assert.equal(source.length, 6);
});
test("deletion never removes the final item, including repeated requests", () => {
  let items = structuredClone(initialLists.works);
  for (const item of initialLists.works) items = removeItem(items, item.id);
  assert.equal(items.length, 1);
  assert.equal(removeItem(items, items[0].id).length, 1);
});
test("reordering works across rows and ignores unknown or foreign identities", () => {
  const items = initialLists.works;
  const reordered = reorderItems(items, "work-1", "work-5");
  assert.deepEqual(
    reordered.map((i) => i.id),
    ["work-2", "work-3", "work-4", "work-5", "work-1", "work-6"],
  );
  assert.deepEqual(reorderItems(reordered, "work-1", "work-2"), items);
  assert.equal(reorderItems(items, "work-1", "event-1"), items);
  assert.equal(items[0].id, "work-1");
});
