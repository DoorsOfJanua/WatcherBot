import assert from "node:assert/strict";
import test from "node:test";
import permissions from "./cua-macos-permissions.cjs";

const { readMacOSPermissionStatus } = permissions;

test("checks Accessibility without asking macOS to display a prompt", () => {
  const calls = [];
  const status = readMacOSPermissionStatus({
    isTrustedAccessibilityClient(prompt) {
      calls.push(prompt);
      return true;
    },
    getMediaAccessStatus(kind) {
      calls.push(kind);
      return "granted";
    },
  });

  assert.deepEqual(status, { accessibility: true, screenRecording: true });
  assert.deepEqual(calls, [false, "screen"]);
});

test("reports missing permissions without invoking a request API", () => {
  const status = readMacOSPermissionStatus({
    isTrustedAccessibilityClient: () => false,
    getMediaAccessStatus: () => "denied",
  });

  assert.deepEqual(status, { accessibility: false, screenRecording: false });
});

