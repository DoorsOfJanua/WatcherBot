import assert from "node:assert/strict";
import test from "node:test";
import contextMenuModule from "./context-menu.cjs";

const { textContextMenuTemplate } = contextMenuModule;

test("selected transcript text receives a native Copy command", () => {
  assert.deepEqual(textContextMenuTemplate({ selectionText: "selected words", isEditable: false }), [
    { role: "copy" },
  ]);
});

test("empty transcript space does not open an inert menu", () => {
  assert.deepEqual(textContextMenuTemplate({ selectionText: "", isEditable: false }), []);
});

test("editable fields receive the standard editing menu", () => {
  assert.deepEqual(
    textContextMenuTemplate({ selectionText: "", isEditable: true }).map((entry) => entry.role ?? entry.type),
    ["undo", "redo", "separator", "cut", "copy", "paste", "separator", "selectAll"],
  );
});
