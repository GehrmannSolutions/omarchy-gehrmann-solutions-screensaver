pragma ComponentBehavior: Bound

import QtQuick
import "Config.js" as Config
import "Circuit.js" as Circuit

// One screen of the screensaver: a navy gradient, the circuit traces growing
// out of the logo zone, and the GS logo with a breathing glow on top.
//
// HiDPI: Canvas and Image render at the window's device pixel ratio, so all
// geometry here stays in logical pixels and is sharp at any Hyprland scale.
//
// Everything that moves is driven by one timer, every TICK_MS: growth, the
// glow's breathing and the fade. The window therefore redraws ~18 times a
// second instead of at the display's refresh rate. The service destroys the
// whole scene when the screensaver hides, so nothing runs in the background.
Item {
  id: root

  readonly property real logoHeight: Math.min(width, height) * Config.LOGO_HEIGHT
  readonly property real logoBox: logoHeight / Config.LOGO_BOX_SHARE
  readonly property real protectRadius: logoHeight * Config.PROTECT_RADIUS

  readonly property double startedAt: Date.now()
  // When the current fade began, 0 while growing.
  property double fadeStartedAt: 0

  function tick(now) {
    var phase = (now - startedAt) / Config.BREATH_MS
    glow.opacity = Config.GLOW_LOW + (Config.GLOW_HIGH - Config.GLOW_LOW) * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase))

    if (fadeStartedAt > 0) {
      // The whole trace layer fades out over the background and logo, then it
      // is cleared and growth starts over. (The HTML version repainted the
      // background at a growing alpha every frame, which compounded and cut
      // the fade short.)
      var progress = (now - fadeStartedAt) / Config.FADE_MS
      traces.opacity = Math.max(0, 1 - progress)
      if (progress >= 1) {
        fadeStartedAt = 0
        traces.restart()
      }
      return
    }

    if (!traces.scene || traces.clearsPending > 0) return
    traces.draw(traces.scene.step(now))
    if (traces.scene.full()) fadeStartedAt = now
  }

  Canvas {
    anchors.fill: parent

    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()
    onPaint: {
      var ctx = getContext("2d")
      var gradient = ctx.createRadialGradient(width / 2, height / 2, root.protectRadius * 0.2,
                                              width / 2, height / 2, Math.max(width, height) * 0.75)
      gradient.addColorStop(0, Config.NAVY)
      gradient.addColorStop(1, Config.NAVY_DEEP)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
    }
  }

  // The traces: a grid of small transparent canvases that keep their content,
  // so a tick paints only the new ops, and only into the tiles they touch (one
  // canvas the size of the screen would be copied and uploaded whole on every
  // tick).
  Item {
    id: traces
    anchors.fill: parent

    readonly property int tileCols: Math.ceil(width / Config.TILE_SIZE)
    readonly property int tileRows: Math.ceil(height / Config.TILE_SIZE)
    property var scene: null
    // Tiles still to clear before a faded-out layer may show again.
    property int clearsPending: 0

    function restart() {
      if (width <= 0 || height <= 0) return
      scene = new Circuit.Scene(width, height, width / 2, height / 2, root.protectRadius)
      scene.reset(Date.now())
      clearsPending = tiles.count
      for (var i = 0; i < tiles.count; i++) tiles.itemAt(i).clear()
    }

    function tileCleared() {
      clearsPending--
      if (clearsPending === 0) opacity = 1
    }

    // Hands each op to every tile its bounding box overlaps.
    function draw(ops) {
      var dirty = ({})
      for (var i = 0; i < ops.length; i++) {
        var op = ops[i]
        var tx0 = Math.max(0, Math.floor(op.left / Config.TILE_SIZE))
        var ty0 = Math.max(0, Math.floor(op.top / Config.TILE_SIZE))
        var tx1 = Math.min(tileCols - 1, Math.floor(op.right / Config.TILE_SIZE))
        var ty1 = Math.min(tileRows - 1, Math.floor(op.bottom / Config.TILE_SIZE))
        for (var ty = ty0; ty <= ty1; ty++) {
          for (var tx = tx0; tx <= tx1; tx++) {
            var index = ty * tileCols + tx
            var tile = tiles.itemAt(index)
            if (!tile) continue
            tile.pending.push(op)
            dirty[index] = tile
          }
        }
      }
      for (var key in dirty) dirty[key].requestPaint()
    }

    onWidthChanged: Qt.callLater(restart)
    onHeightChanged: Qt.callLater(restart)

    Repeater {
      id: tiles
      model: traces.tileCols * traces.tileRows

      Canvas {
        required property int index

        // Ops waiting for the next paint.
        property var pending: []
        property bool clearPending: false

        function clear() {
          pending = []
          clearPending = true
          requestPaint()
        }

        x: (index % traces.tileCols) * Config.TILE_SIZE
        y: Math.floor(index / traces.tileCols) * Config.TILE_SIZE
        width: Config.TILE_SIZE
        height: Config.TILE_SIZE

        onPaint: {
          var ctx = getContext("2d")
          if (clearPending) {
            ctx.clearRect(0, 0, width, height)
            clearPending = false
            traces.tileCleared()
          }
          if (pending.length === 0 || !traces.scene) return
          var glowWidth = traces.scene.cell * Config.GLOW_WIDTH
          ctx.save()
          ctx.translate(-x, -y)
          for (var i = 0; i < pending.length; i++) Circuit.drawOp(ctx, pending[i], glowWidth)
          ctx.restore()
          pending = []
        }
      }
    }
  }

  // The logo layers are the same square box; see Config.js for how the logo
  // sits in it. Images appear as soon as they are decoded.
  Item {
    width: root.logoBox
    height: root.logoBox
    x: (root.width - width) / 2
    y: root.height / 2 - height * Config.LOGO_CENTER_Y

    Image {
      id: glow
      anchors.fill: parent
      source: "assets/logo-glow.png"
      smooth: true
      mipmap: true
      opacity: Config.GLOW_LOW
    }

    Image {
      anchors.fill: parent
      source: "assets/logo-shapes.png"
      smooth: true
      mipmap: true
    }
  }

  Timer {
    interval: Config.TICK_MS
    repeat: true
    running: true
    onTriggered: root.tick(Date.now())
  }
}
