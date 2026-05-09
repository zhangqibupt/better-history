import test from "node:test";
import assert from "node:assert/strict";

import {
  NO_SELECTION,
  clampSelectionIndex,
  getDefaultSelectionIndex,
  moveSelectionIndex
} from "../src/search-page/services/selectionService.js";

test("getDefaultSelectionIndex selects the first result when items exist", () => {
  assert.equal(getDefaultSelectionIndex(3), 0);
  assert.equal(getDefaultSelectionIndex(0), NO_SELECTION);
});

test("moveSelectionIndex moves up and down while respecting list boundaries", () => {
  assert.equal(moveSelectionIndex(0, 4, 1), 1);
  assert.equal(moveSelectionIndex(2, 4, -1), 1);
  assert.equal(moveSelectionIndex(0, 4, -1), 0);
  assert.equal(moveSelectionIndex(3, 4, 1), 3);
});

test("clampSelectionIndex clears invalid selection when there are no results", () => {
  assert.equal(clampSelectionIndex(2, 0), NO_SELECTION);
  assert.equal(clampSelectionIndex(-3, 5), 0);
  assert.equal(clampSelectionIndex(99, 5), 4);
});
