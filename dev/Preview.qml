import QtQuick
import ".." as GS

// Shows the screensaver scene in an ordinary window, outside omarchy-shell:
//   /usr/lib/qt6/bin/qml dev/Preview.qml
// Close the window to quit.
Window {
  width: 1280
  height: 800
  visible: true
  title: "GS Circuit Screensaver preview"
  color: "black"

  GS.CircuitScene {
    anchors.fill: parent
  }
}
