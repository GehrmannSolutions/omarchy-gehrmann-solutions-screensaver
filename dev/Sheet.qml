import QtQuick
import "../Circuit.js" as Circuit
import "../Config.js" as Config

// Every symbol, trace end and module once, for checking their shapes:
//   /usr/lib/qt6/bin/qml dev/Sheet.qml
Window {
  width: 1400
  height: 900
  visible: true
  title: "GS Circuit Screensaver symbols"
  color: Config.NAVY

  Canvas {
    anchors.fill: parent

    onPaint: {
      var ctx = getContext("2d")
      var cell = 20
      var glow = cell * Config.GLOW_WIDTH
      var lineWidth = Math.max(1.2, cell * 0.08)
      var symbols = Object.keys(Config.INLINE_SYMBOLS)
      var ends = Object.keys(Config.END_SYMBOLS)
      var modules = Object.keys(Config.MODULES)
      var i, x, y

      // Symbols and trace ends: a grid of short traces.
      for (i = 0; i < symbols.length + ends.length; i++) {
        x = 70 + (i % 12) * 110
        y = 50 + Math.floor(i / 12) * 90
        var color = i % 2 ? Config.WHITE : Config.BLUE
        if (i < symbols.length) {
          Circuit.drawOp(ctx, { kind: "component", x: x, y: y, size: cell * Config.SYMBOL_SCALE, half: 2 * cell,
                                symbol: symbols[i], angle: 0, color: color, width: lineWidth }, glow)
          continue
        }
        var end = ends[i - symbols.length]
        Circuit.drawOp(ctx, { kind: "trace", x1: x - 40, y1: y, x2: x, y2: y, color: color,
                              width: Math.max(1.5, cell * 0.11) }, glow)
        if (end === "via")
          Circuit.drawOp(ctx, { kind: "via", x: x, y: y, r: cell * 0.26, color: color, width: lineWidth }, glow)
        else
          Circuit.drawOp(ctx, { kind: "end", x: x, y: y, size: cell * Config.SYMBOL_SCALE, symbol: end,
                                angle: 0, color: color, width: lineWidth }, glow)
      }

      // Modules.
      for (i = 0; i < modules.length; i++) {
        x = 140 + (i % 5) * 270
        y = 330 + Math.floor(i / 5) * 190
        Circuit.drawOp(ctx, { kind: "module", x: x, y: y, size: cell, name: modules[i], angle: 0, mirror: false,
                              color: i % 2 ? Config.WHITE : Config.BLUE, width: lineWidth }, glow)
      }
    }
  }
}
