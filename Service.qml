pragma ComponentBehavior: Bound

import QtQuick
import Quickshell
import Quickshell.Io

// Shows the circuit-growth screensaver on every monitor when Omarchy's idle
// service reaches its screensaver timeout, and hides it on input or lock.
//
// No idle timer of its own: the screensaver follows the idle service's cycle
// (omarchy.idle), which already respects idle inhibitors, stay-awake and the
// configured timeouts, cancels the cycle on activity and resets it when it
// locks the session.
//
// One screensaver at a time: the idle service always runs Omarchy's terminal
// screensaver launcher, which does nothing while `omarchy toggle screensaver`
// has it switched off. This plugin takes over only in that case and otherwise
// stays passive, so the two never run on top of each other.
Item {
  id: root

  // Injected by omarchy-shell.
  property var shell: null

  readonly property var idleService: serviceFor("omarchy.idle")
  // The lock screen may be a personal clone of omarchy.lock; resolve to
  // whichever one is enabled.
  readonly property var lockService: serviceFor("omarchy.lock")

  readonly property bool idleCycleReached: !!idleService
    && idleService.idledThisCycle === true
    && idleService.screensaverStartedThisCycle === true
  readonly property bool locked: !!lockService && lockService.locked === true

  // Omarchy's terminal screensaver is toggled off for this idle cycle.
  property bool omarchyScreensaverOff: false
  property bool previewing: false
  // Input ended this idle cycle's screensaver early.
  property bool dismissed: false

  readonly property bool showing: !locked && !dismissed
    && (previewing || (idleCycleReached && omarchyScreensaverOff))

  function serviceFor(pluginId) {
    if (!shell || !shell.pluginRegistry) return null
    return shell.serviceFor(shell.pluginRegistry.resolveEnabledId(pluginId))
  }

  function log(message) {
    console.log("circuit-screensaver: " + message)
  }

  function dismiss(reason) {
    if (!showing) return
    log("dismissed (" + reason + ")")
    // Defer: the request can come from an input handler of the very window
    // that this destroys.
    Qt.callLater(function() {
      root.previewing = false
      if (root.idleCycleReached) root.dismissed = true
    })
  }

  function statusJson() {
    return JSON.stringify({
      showing: root.showing,
      previewing: root.previewing,
      dismissed: root.dismissed,
      idleCycleReached: root.idleCycleReached,
      omarchyScreensaverOff: root.omarchyScreensaverOff,
      locked: root.locked,
      idleService: !!root.idleService,
      lockService: !!root.lockService
    })
  }

  onIdleCycleReachedChanged: {
    root.dismissed = false
    root.omarchyScreensaverOff = false
    if (idleCycleReached) toggleProbe.running = true
  }

  onLockedChanged: if (locked) previewing = false

  onShowingChanged: log(showing ? "showing" + (previewing ? " (preview)" : "") : "hidden")

  Process {
    id: toggleProbe
    command: ["bash", "-lc", "omarchy-toggle-enabled screensaver-off"]
    onExited: function(exitCode) {
      if (!root.idleCycleReached) return
      root.omarchyScreensaverOff = exitCode === 0
      if (!root.omarchyScreensaverOff)
        root.log("Omarchy's terminal screensaver is on; staying passive (see README)")
    }
  }

  // One window per monitor, created only while showing: hidden or locked,
  // nothing is left to render.
  Variants {
    model: root.showing ? Quickshell.screens : []

    ScreensaverWindow {
      onDismissRequested: function(reason) { root.dismiss(reason) }
    }
  }

  IpcHandler {
    target: "circuit-screensaver"

    // Show it now, without waiting for idle. Input dismisses it as usual.
    function preview(): string {
      if (root.locked) return "locked"
      root.dismissed = false
      root.previewing = true
      return "ok"
    }

    function stop(): string {
      root.dismiss("ipc")
      return "ok"
    }

    function status(): string {
      return root.statusJson()
    }
  }
}
