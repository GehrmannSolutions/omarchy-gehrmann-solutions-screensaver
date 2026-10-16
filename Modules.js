.pragma library
.import "Symbols.js" as Symbols

// Small circuits ("modules") a trace can run through or end in, drawn in the
// same line style as the symbols. Coordinates are in grid cells, centred on the
// module, with the trace arriving at (-cells / 2, 0) and, unless the module
// ends the trace, leaving at (cells / 2, 0). y grows downwards, so grounds point
// down. Every module stays within |y| <= half; the scene reserves those cells,
// so other traces route around it.
//
// Each draw function gets a kit of drawing helpers (see kit() below).

// Drawing helpers for one module on ctx; s is the cell size in pixels and
// partScale the size of the parts relative to a lone symbol.
function kit(ctx, s, partScale) {
  var k = {}
  k.wire = function(points) {
    ctx.moveTo(points[0][0] * s, points[0][1] * s)
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i][0] * s, points[i][1] * s)
  }
  // A schematic symbol (Symbols.INLINE) from (x1, y1) to (x2, y2), leads included.
  k.part = function(name, x1, y1, x2, y2) {
    var half = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) / 2 * s
    ctx.save()
    ctx.translate((x1 + x2) / 2 * s, (y1 + y2) / 2 * s)
    ctx.rotate(Math.atan2(y2 - y1, x2 - x1))
    var body = Symbols.INLINE[name](ctx, s * partScale) * s * partScale
    ctx.moveTo(-half, 0); ctx.lineTo(-body, 0)
    ctx.moveTo(body, 0); ctx.lineTo(half, 0)
    ctx.restore()
  }
  // An end symbol (Symbols.END) at (x, y), pointing at angle a (0 = right, down = PI / 2).
  k.cap = function(name, x, y, a) {
    ctx.save()
    ctx.translate(x * s, y * s)
    ctx.rotate(a)
    Symbols.END[name](ctx, s * partScale)
    ctx.restore()
  }
  k.ground = function(x, y) { k.cap("ground", x, y, Math.PI / 2) }
  k.supply = function(x, y) { k.cap("vcc", x, y, -Math.PI / 2) }
  // A junction.
  k.dot = function(x, y) {
    ctx.moveTo((x + 0.09) * s, y * s)
    ctx.arc(x * s, y * s, 0.09 * s, 0, Math.PI * 2)
  }
  k.circle = function(x, y, r) {
    ctx.moveTo((x + r) * s, y * s)
    ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2)
  }
  // An arc around (x, y) from angle a0 to a1 (clockwise on screen unless
  // anticlockwise), starting a new piece of path at its first point.
  k.arc = function(x, y, r, a0, a1, anticlockwise) {
    ctx.moveTo((x + r * Math.cos(a0)) * s, (y + r * Math.sin(a0)) * s)
    ctx.arc(x * s, y * s, r * s, a0, a1, anticlockwise)
  }
  k.arrow = function(x1, y1, x2, y2) {
    Symbols.arrow(ctx, s, x1, y1, x2, y2)
  }
  k.box = function(x, y, w, h) {
    ctx.rect(x * s, y * s, w * s, h * s)
  }
  k.closed = function(points) {
    k.wire(points)
    ctx.closePath()
  }
  return k
}

// cells: length along the trace; half: reach to either side, in cells;
// end: the trace ends here; label: text drawn upright in the module.
var MODULES = {
  // RC low-pass: series resistor, capacitor to ground
  rcLowPass: {
    cells: 6, half: 2,
    draw: function(k) {
      k.part("resistor", -3, 0, 0, 0)
      k.wire([[0, 0], [3, 0]])
      k.dot(0, 0)
      k.part("capacitor", 0, 0, 0, 1.3)
      k.ground(0, 1.3)
    }
  },

  // Voltage divider: the trace feeds two resistors to ground, the tap goes on
  voltageDivider: {
    cells: 6, half: 2.5,
    draw: function(k) {
      k.wire([[-3, 0], [-3, -1.8], [-1, -1.8]])
      k.part("resistor", -1, -1.8, -1, 0)
      k.part("resistor", -1, 0, -1, 1.8)
      k.ground(-1, 1.8)
      k.dot(-1, 0)
      k.wire([[-1, 0], [3, 0]])
    }
  },

  // LED chain: series resistor and three LEDs
  ledChain: {
    cells: 8, half: 1,
    draw: function(k) {
      k.part("resistor", -4, 0, -2, 0)
      k.part("led", -2, 0, 0, 0)
      k.part("led", 0, 0, 2, 0)
      k.part("led", 2, 0, 4, 0)
    }
  },

  // Bridge rectifier with smoothing capacitor: AC in on the left corner (the
  // other AC terminal on the right corner), DC+ at the top, DC- at the bottom.
  bridgeRectifier: {
    cells: 8, half: 2.5,
    draw: function(k) {
      k.wire([[-4, 0], [-3, 0]])
      k.part("diode", -3, 0, -1.5, -1.5)   // left corner -> DC+
      k.part("diode", 0, 0, -1.5, -1.5)    // right corner -> DC+
      k.part("diode", -1.5, 1.5, -3, 0)    // DC- -> left corner
      k.part("diode", -1.5, 1.5, 0, 0)     // DC- -> right corner
      k.wire([[0, 0], [0.45, 0]])
      k.circle(0.65, 0, 0.2)               // second AC terminal
      k.wire([[-1.5, -1.5], [2.5, -1.5]])
      k.wire([[-1.5, 1.5], [2.5, 1.5]])
      k.part("electrolytic", 2.5, -1.5, 2.5, 1.5)
      k.ground(1, 1.5)
      k.wire([[2.5, -1.5], [3.3, -1.5], [3.3, 0], [4, 0]])
      k.dot(2.5, -1.5)
      k.dot(2.5, 1.5)
    }
  },

  // Transformer: two coils on a core, both returns to ground
  transformer: {
    cells: 6, half: 2.3,
    draw: function(k) {
      k.wire([[-3, 0], [-2, 0], [-2, -1.2], [-0.6, -1.2]])
      k.wire([[-0.6, 1.2], [-2, 1.2]])
      k.ground(-2, 1.2)
      for (var i = 0; i < 4; i++) {
        var cy = -0.9 + i * 0.6
        k.arc(-0.6, cy, 0.3, -Math.PI / 2, Math.PI / 2, false)
        k.arc(0.6, cy, 0.3, -Math.PI / 2, Math.PI / 2, true)
      }
      k.wire([[-0.12, -1.3], [-0.12, 1.3]])
      k.wire([[0.12, -1.3], [0.12, 1.3]])
      k.wire([[0.6, -1.2], [2, -1.2], [2, 0], [3, 0]])
      k.wire([[0.6, 1.2], [2, 1.2]])
      k.ground(2, 1.2)
    }
  },

  // Two-way speaker crossover: coil to the woofer, capacitor to the tweeter.
  // The trace ends here.
  crossover: {
    cells: 7, half: 2.6, end: true,
    draw: function(k) {
      k.wire([[-3.5, 0], [-2.5, 0]])
      k.dot(-2.5, 0)
      k.wire([[-2.5, -1.6], [-2.5, 1.6]])
      k.part("inductor", -2.5, -1.6, 0.8, -1.6)
      k.part("capacitor", -2.5, 1.6, 0.8, 1.6)
      speaker(k, 0.8, -1.6, 1.0)
      speaker(k, 0.8, 1.6, 0.7)
    }
  },

  // Common-emitter amplifier: coupling capacitors, base divider, collector and
  // emitter resistors
  ampStage: {
    cells: 8, half: 3,
    draw: function(k) {
      k.part("capacitor", -4, 0, -2, 0)
      k.wire([[-2, 0], [-0.1, 0]])
      k.dot(-1.2, 0)
      k.part("resistor", -1.2, -2.4, -1.2, 0)
      k.part("resistor", -1.2, 0, -1.2, 2.4)
      k.ground(-1.2, 2.4)
      k.wire([[-1.2, -2.4], [0.5, -2.4]])
      k.supply(-0.35, -2.4)
      // the transistor, base on the left
      k.circle(0.25, 0, 0.7)
      k.wire([[-0.1, -0.4], [-0.1, 0.4]])
      k.wire([[-0.1, -0.2], [0.5, -0.55], [0.5, -0.9]])
      k.arrow(-0.1, 0.2, 0.5, 0.55)
      k.wire([[0.5, 0.55], [0.5, 0.9]])
      k.part("resistor", 0.5, -2.4, 0.5, -0.9)
      k.part("resistor", 0.5, 0.9, 0.5, 2.4)
      k.ground(0.5, 2.4)
      k.dot(0.5, -0.9)
      k.wire([[0.5, -0.9], [1.6, -0.9], [1.6, 0]])
      k.part("capacitor", 1.6, 0, 4, 0)
    }
  },

  // Inverting op-amp amplifier
  opAmp: {
    cells: 8, half: 2.5,
    draw: function(k) {
      k.wire([[-4, 0], [-3.6, 0], [-3.6, -0.6]])
      k.part("resistor", -3.6, -0.6, -1.6, -0.6)
      k.wire([[-1.6, -0.6], [-1, -0.6]])
      k.dot(-1.6, -0.6)
      k.wire([[-1.6, -0.6], [-1.6, -2]])
      k.part("resistor", -1.6, -2, 1.8, -2)
      k.wire([[1.8, -2], [1.8, 0]])
      k.closed([[-1, -1.2], [-1, 1.2], [1.2, 0]])
      k.wire([[-0.85, -0.6], [-0.55, -0.6]])                      // minus
      k.wire([[-0.85, 0.6], [-0.55, 0.6]])                        // plus
      k.wire([[-0.7, 0.45], [-0.7, 0.75]])
      k.wire([[-1, 0.6], [-1.6, 0.6], [-1.6, 1.3]])
      k.ground(-1.6, 1.3)
      k.wire([[1.2, 0], [4, 0]])
      k.dot(1.8, 0)
    }
  },

  // 555 timer as an astable clock: R1, R2 and C set the frequency
  timer555: {
    cells: 8, half: 3, label: { x: 0, y: 0, text: "555" },
    draw: function(k) {
      k.box(-0.9, -1.5, 1.8, 3)
      k.wire([[-4, 0], [-3, 0], [-3, -2.2], [0, -2.2], [0, -1.5]])  // supply to pin 8
      k.dot(-2.2, -2.2)
      k.part("resistor", -2.2, -2.2, -2.2, -0.6)                   // R1
      k.part("resistor", -2.2, -0.6, -2.2, 0.9)                    // R2
      k.part("capacitor", -2.2, 0.9, -2.2, 2.2)                    // C
      k.ground(-2.2, 2.2)
      k.wire([[-2.2, -0.6], [-0.9, -0.6]])                         // discharge
      k.wire([[-2.2, 0.9], [-0.9, 0.9]])                           // trigger
      k.wire([[-1.4, 0.9], [-1.4, 0.3], [-0.9, 0.3]])              // threshold
      k.dot(-2.2, -0.6)
      k.dot(-2.2, 0.9)
      k.dot(-1.4, 0.9)
      k.wire([[0, 1.5], [0, 2.2]])
      k.ground(0, 2.2)
      k.wire([[0.9, 0], [4, 0]])                                   // output
    }
  },

  // Pierce crystal oscillator: inverter, crystal, two load capacitors
  crystalOscillator: {
    cells: 8, half: 2.7,
    draw: function(k) {
      k.wire([[-4, 0], [-2, 0]])
      k.wire([[-2, -1.2], [-2, 0.6]])
      k.wire([[-2, -1.2], [-0.6, -1.2]])
      k.closed([[-0.6, -1.7], [-0.6, -0.7], [0.4, -1.2]])
      k.circle(0.55, -1.2, 0.15)
      k.wire([[0.7, -1.2], [2, -1.2], [2, 0.6]])
      k.part("crystal", -2, 0.6, 2, 0.6)
      k.part("capacitor", -2, 0.6, -2, 2)
      k.part("capacitor", 2, 0.6, 2, 2)
      k.ground(-2, 2)
      k.ground(2, 2)
      k.wire([[2, 0], [4, 0]])
      k.dot(-2, 0)
      k.dot(2, 0)
      k.dot(-2, 0.6)
      k.dot(2, 0.6)
    }
  },

  // 78xx voltage regulator with input and output capacitors
  regulator: {
    cells: 8, half: 2.3, label: { x: 0, y: 0, text: "7805" },
    draw: function(k) {
      k.box(-0.9, -0.6, 1.8, 1.2)
      k.wire([[-4, 0], [-0.9, 0]])
      k.wire([[0.9, 0], [4, 0]])
      k.wire([[0, 0.6], [0, 1.6]])
      k.ground(0, 1.6)
      k.part("capacitor", -2.4, 0, -2.4, 1.6)
      k.ground(-2.4, 1.6)
      k.part("electrolytic", 2.4, 0, 2.4, 1.6)
      k.ground(2.4, 1.6)
      k.dot(-2.4, 0)
      k.dot(2.4, 0)
    }
  }
}

// A speaker on a wire arriving from the left at (x, y): magnet box and cone.
function speaker(k, x, y, size) {
  var h = 0.3 * size
  k.box(x, y - h, 0.35 * size, 2 * h)
  k.closed([[x + 0.35 * size, y - h], [x + 0.9 * size, y - 2 * h], [x + 0.9 * size, y + 2 * h],
            [x + 0.35 * size, y + h]])
}
