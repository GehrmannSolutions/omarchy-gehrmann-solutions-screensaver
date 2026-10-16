.pragma library

// Schematic symbols in the screensaver's line style. Each function adds its
// shape to the current path of ctx, in units of s (one grid cell), centred on
// the origin with the trace running along the x axis.
//
// Inline symbols sit in a straight run: inline() returns the half length of the
// body, and the caller draws the leads from there out to the trace. Bodies stay
// within |x| <= 0.8 and |y| <= 0.8.
//
// End symbols cap a trace: the trace arrives at the origin from -x, and the
// symbol reaches at most 0.7 forward and 0.5 to either side.

function line(ctx, s, x1, y1, x2, y2) {
  ctx.moveTo(x1 * s, y1 * s)
  ctx.lineTo(x2 * s, y2 * s)
}

function polyline(ctx, s, points, close) {
  ctx.moveTo(points[0][0] * s, points[0][1] * s)
  for (var i = 1; i < points.length; i++) ctx.lineTo(points[i][0] * s, points[i][1] * s)
  if (close) ctx.closePath()
}

function circle(ctx, s, x, y, r) {
  ctx.moveTo((x + r) * s, y * s)
  ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2)
}

function rect(ctx, s, x, y, w, h) {
  ctx.rect(x * s, y * s, w * s, h * s)
}

// A line from (x1, y1) to (x2, y2) with an arrowhead at (x2, y2).
function arrow(ctx, s, x1, y1, x2, y2) {
  line(ctx, s, x1, y1, x2, y2)
  var a = Math.atan2(y2 - y1, x2 - x1)
  var head = 0.14
  line(ctx, s, x2, y2, x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45))
  line(ctx, s, x2, y2, x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45))
}

function diodeBody(ctx, s) {
  polyline(ctx, s, [[-0.35, -0.4], [-0.35, 0.4], [0.35, 0]], true)
}

// Bipolar transistor with collector and emitter on the trace, base out the top.
function bipolar(ctx, s, pnp) {
  circle(ctx, s, 0, -0.12, 0.6)
  line(ctx, s, -0.3, -0.32, 0.3, -0.32)    // base bar
  line(ctx, s, 0, -0.32, 0, -0.8)          // base lead
  line(ctx, s, -0.14, -0.32, -0.45, 0)     // collector
  if (pnp) arrow(ctx, s, 0.45, 0, 0.16, -0.3)
  else arrow(ctx, s, 0.14, -0.32, 0.45, 0) // emitter
}

var INLINE = {
  // IEC resistor: a box
  resistor: function(ctx, s) {
    rect(ctx, s, -0.7, -0.28, 1.4, 0.56)
    return 0.7
  },
  // US resistor: a zigzag
  resistorZigzag: function(ctx, s) {
    polyline(ctx, s, [[-0.7, 0], [-0.58, -0.3], [-0.35, 0.3], [-0.12, -0.3], [0.12, 0.3],
                      [0.35, -0.3], [0.58, 0.3], [0.7, 0]])
    return 0.7
  },
  potentiometer: function(ctx, s) {
    rect(ctx, s, -0.7, -0.28, 1.4, 0.56)
    arrow(ctx, s, 0, -0.8, 0, -0.32)
    return 0.7
  },
  capacitor: function(ctx, s) {
    line(ctx, s, -0.15, -0.5, -0.15, 0.5)
    line(ctx, s, 0.15, -0.5, 0.15, 0.5)
    return 0.15
  },
  // Polarised capacitor: one curved plate and a plus sign
  electrolytic: function(ctx, s) {
    line(ctx, s, -0.15, -0.5, -0.15, 0.5)
    ctx.moveTo((0.65 + 0.5 * Math.cos(2.4)) * s, 0.5 * Math.sin(2.4) * s)
    ctx.arc(0.65 * s, 0, 0.5 * s, 2.4, 3.88)
    line(ctx, s, -0.55, -0.45, -0.35, -0.45)
    line(ctx, s, -0.45, -0.55, -0.45, -0.35)
    return 0.15
  },
  // Inductor: four coil turns
  inductor: function(ctx, s) {
    for (var i = 0; i < 4; i++) {
      var cx = -0.6 + i * 0.4
      ctx.moveTo((cx - 0.2) * s, 0)
      ctx.arc(cx * s, 0, 0.2 * s, Math.PI, Math.PI * 2)
    }
    return 0.8
  },
  diode: function(ctx, s) {
    diodeBody(ctx, s)
    line(ctx, s, 0.35, -0.4, 0.35, 0.4)
    return 0.35
  },
  led: function(ctx, s) {
    diodeBody(ctx, s)
    line(ctx, s, 0.35, -0.4, 0.35, 0.4)
    arrow(ctx, s, -0.1, -0.45, 0.15, -0.75)
    arrow(ctx, s, 0.15, -0.45, 0.4, -0.75)
    return 0.35
  },
  zener: function(ctx, s) {
    diodeBody(ctx, s)
    polyline(ctx, s, [[0.2, -0.5], [0.35, -0.4], [0.35, 0.4], [0.5, 0.5]])
    return 0.35
  },
  npn: function(ctx, s) {
    bipolar(ctx, s, false)
    return 0.45
  },
  pnp: function(ctx, s) {
    bipolar(ctx, s, true)
    return 0.45
  },
  // MOSFET with drain and source on the trace, gate out the top
  mosfet: function(ctx, s) {
    line(ctx, s, -0.35, -0.3, -0.18, -0.3)  // channel, in three pieces
    line(ctx, s, -0.08, -0.3, 0.08, -0.3)
    line(ctx, s, 0.18, -0.3, 0.35, -0.3)
    line(ctx, s, -0.27, -0.3, -0.27, 0)     // drain
    line(ctx, s, 0.27, -0.3, 0.27, 0)       // source
    arrow(ctx, s, 0.27, -0.12, 0, -0.27)    // body diode direction
    line(ctx, s, -0.3, -0.48, 0.3, -0.48)   // gate plate
    line(ctx, s, 0, -0.48, 0, -0.8)         // gate lead
    return 0.27
  },
  // DIP chip: a block with a notch and pins on both long sides
  chip: function(ctx, s) {
    rect(ctx, s, -0.8, -0.45, 1.6, 0.9)
    ctx.moveTo(-0.8 * s, -0.12 * s)
    ctx.arc(-0.8 * s, 0, 0.12 * s, -Math.PI / 2, Math.PI / 2)
    for (var i = 0; i < 4; i++) {
      var x = -0.5 + i * 0.333
      line(ctx, s, x, -0.45, x, -0.68)
      line(ctx, s, x, 0.45, x, 0.68)
    }
    return 0.8
  },
  // Quartz crystal: a slab between two plates
  crystal: function(ctx, s) {
    line(ctx, s, -0.35, -0.42, -0.35, 0.42)
    line(ctx, s, 0.35, -0.42, 0.35, 0.42)
    rect(ctx, s, -0.2, -0.5, 0.4, 1.0)
    return 0.35
  },
  // Fuse: the trace runs through a box
  fuse: function(ctx, s) {
    rect(ctx, s, -0.6, -0.22, 1.2, 0.44)
    line(ctx, s, -0.6, 0, 0.6, 0)
    return 0.6
  },
  // Switch: an open lever between two contacts
  switch: function(ctx, s) {
    circle(ctx, s, -0.4, 0, 0.08)
    circle(ctx, s, 0.4, 0, 0.08)
    line(ctx, s, -0.34, -0.05, 0.38, -0.42)
    return 0.4
  },
  // Push button: a bridge held above two contacts
  button: function(ctx, s) {
    circle(ctx, s, -0.4, 0, 0.08)
    circle(ctx, s, 0.4, 0, 0.08)
    line(ctx, s, -0.5, -0.28, 0.5, -0.28)
    line(ctx, s, 0, -0.28, 0, -0.62)
    line(ctx, s, -0.22, -0.62, 0.22, -0.62)
    return 0.4
  },
  // Battery: two cells, long plate positive
  battery: function(ctx, s) {
    line(ctx, s, -0.3, -0.5, -0.3, 0.5)
    line(ctx, s, -0.1, -0.25, -0.1, 0.25)
    line(ctx, s, 0.1, -0.5, 0.1, 0.5)
    line(ctx, s, 0.3, -0.25, 0.3, 0.25)
    line(ctx, s, -0.6, -0.5, -0.42, -0.5)
    line(ctx, s, -0.51, -0.59, -0.51, -0.41)
    return 0.3
  }
}

var END = {
  ground: function(ctx, s) {
    line(ctx, s, 0, 0, 0.25, 0)
    line(ctx, s, 0.25, -0.45, 0.25, 0.45)
    line(ctx, s, 0.42, -0.3, 0.42, 0.3)
    line(ctx, s, 0.59, -0.13, 0.59, 0.13)
  },
  vcc: function(ctx, s) {
    line(ctx, s, 0, 0, 0.45, 0)
    line(ctx, s, 0.45, -0.38, 0.45, 0.38)
  },
  testPoint: function(ctx, s) {
    line(ctx, s, 0, 0, 0.17, 0)
    circle(ctx, s, 0.42, 0, 0.25)
    circle(ctx, s, 0.42, 0, 0.07)
  },
  // Pin header: three square pads across the trace, the middle one connected
  header: function(ctx, s) {
    line(ctx, s, 0, 0, 0.2, 0)
    for (var i = -1; i <= 1; i++) rect(ctx, s, 0.2, i * 0.34 - 0.14, 0.28, 0.28)
  }
}
