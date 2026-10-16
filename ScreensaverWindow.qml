import QtQuick
import Quickshell
import Quickshell.Wayland
import "Config.js" as Config

// The screensaver on one monitor: a fullscreen overlay layer surface that
// hides the cursor and asks to be dismissed on any key, click, scroll or
// pointer movement.
PanelWindow {
  id: window

  required property var modelData

  signal dismissRequested(string reason)

  screen: modelData
  anchors { top: true; bottom: true; left: true; right: true }
  exclusionMode: ExclusionMode.Ignore
  color: Config.NAVY_DEEP

  WlrLayershell.namespace: "gs-circuit-screensaver"
  WlrLayershell.layer: WlrLayer.Overlay
  // Takes the keyboard so the key that wakes the screen does not also reach
  // the focused application.
  WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive

  CircuitScene {
    anchors.fill: parent
  }

  MouseArea {
    id: pointer
    anchors.fill: parent
    hoverEnabled: true
    acceptedButtons: Qt.AllButtons
    cursorShape: Qt.BlankCursor

    // The first position after the surface maps is where the pointer already
    // was; only movement away from it counts.
    property bool hasOrigin: false
    property real originX: 0
    property real originY: 0

    onPressed: window.dismissRequested("click")
    onWheel: window.dismissRequested("scroll")
    onPositionChanged: function(mouse) {
      if (!hasOrigin) {
        originX = mouse.x
        originY = mouse.y
        hasOrigin = true
        return
      }
      if (Math.abs(mouse.x - originX) + Math.abs(mouse.y - originY) > Config.MOVE_THRESHOLD)
        window.dismissRequested("pointer")
    }
  }

  Item {
    anchors.fill: parent
    focus: true
    Keys.onPressed: function(event) {
      event.accepted = true
      window.dismissRequested("key")
    }
  }
}
