"use strict";

/**
 * Native editing affordances for the frameless renderer. Electron does not
 * create a context menu by default, so selected conversation text otherwise
 * has no Copy command even though Chromium can select it.
 */
function textContextMenuTemplate(params) {
  if (params?.isEditable) {
    return [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      { role: "selectAll" },
    ];
  }

  if (params?.selectionText) return [{ role: "copy" }];
  return [];
}

module.exports = { textContextMenuTemplate };
