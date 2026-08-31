function readMacOSPermissionStatus(systemPreferences) {
  return {
    // `false` is important: this is a preflight check, never a request to
    // enqueue macOS's Accessibility dialog.
    accessibility: systemPreferences.isTrustedAccessibilityClient(false),
    screenRecording:
      systemPreferences.getMediaAccessStatus?.("screen") === "granted",
  };
}

module.exports = { readMacOSPermissionStatus };

