.pragma library
.import "Config.js" as Config

// The circuit-growth generator: traces walk a grid in eight directions from the
// rim of the logo, turn, fork, and drop resistor, capacitor, transistor and
// chip symbols; new component "towns" appear in empty regions.
//
// The scene does not draw itself: each step returns the new drawing operations
// (ops), each with its bounding box, and drawOp() paints one onto a canvas.
// That lets the screen be split into small canvas tiles of which only the
// touched ones repaint.

var DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]

function randInt(n) {
  return Math.floor(Math.random() * n)
}

// A scene for a canvas of width x height logical pixels. The logo is centred at
// (centerX, centerY); no trace enters the circle of protectRadius around it.
function Scene(width, height, centerX, centerY, protectRadius) {
  this.width = width
  this.height = height
  this.centerX = centerX
  this.centerY = centerY
  this.protectRadius = protectRadius
  this.cell = Math.max(Config.CELL_MIN, Math.round(Math.min(width, height) / Config.CELL_DIVISOR))
  this.cols = Math.ceil(width / this.cell) + 1
  this.rows = Math.ceil(height / this.cell) + 1
  this.occ = new Uint8Array(this.cols * this.rows)
  this.occupied = 0
  this.growers = []
  this.ops = []
  this.nextTownAt = 0
}

Scene.prototype.reset = function(now) {
  this.occ.fill(0)
  this.occupied = 0
  this.growers = []
  this.markProtectedZone()
  this.seedFromLogo()
  this.scheduleTown(now)
}

Scene.prototype.full = function() {
  return this.occupied / this.occ.length > Config.FULL_RATIO
}

Scene.prototype.inBounds = function(gx, gy) {
  return gx >= 0 && gy >= 0 && gx < this.cols && gy < this.rows
}

Scene.prototype.isFree = function(gx, gy) {
  return this.inBounds(gx, gy) && this.occ[gy * this.cols + gx] === 0
}

Scene.prototype.occupy = function(gx, gy) {
  if (!this.isFree(gx, gy)) return
  this.occ[gy * this.cols + gx] = 1
  this.occupied++
}

Scene.prototype.markProtectedZone = function() {
  var r = Math.round(this.protectRadius / this.cell)
  var cgx = Math.round(this.centerX / this.cell)
  var cgy = Math.round(this.centerY / this.cell)
  for (var y = -r; y <= r; y++)
    for (var x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) this.occupy(cgx + x, cgy + y)
}

Scene.prototype.makeGrower = function(gx, gy, dir, opts) {
  return {
    gx: gx,
    gy: gy,
    dir: dir,
    stepsInDir: 0,
    maxSteps: 4 + randInt(9),
    alive: true,
    color: opts.color || (Math.random() < Config.WHITE_SHARE ? Config.WHITE : Config.BLUE),
    life: 0,
    maxLife: opts.maxLife || 60 + randInt(140),
    generation: opts.generation || 0
  }
}

// Ten traces start just outside the logo zone, each heading away from the logo.
Scene.prototype.seedFromLogo = function() {
  var startR = this.protectRadius / this.cell
  for (var i = 0; i < Config.SEED_COUNT; i++) {
    var ang = (i / Config.SEED_COUNT) * Math.PI * 2 + Math.random() * 0.2
    var gx = Math.round(this.centerX / this.cell + Math.cos(ang) * startR)
    var gy = Math.round(this.centerY / this.cell + Math.sin(ang) * startR)
    var dir = 0, best = -2
    for (var d = 0; d < 8; d++) {
      var dot = Math.cos(ang) * DIRS[d][0] + Math.sin(ang) * DIRS[d][1]
      if (dot > best) { best = dot; dir = d }
    }
    // The rim cell lies inside the (already occupied) zone; the grower only
    // needs a free cell ahead of it.
    if (this.inBounds(gx, gy)) this.growers.push(this.makeGrower(gx, gy, dir, {}))
  }
}

Scene.prototype.scheduleTown = function(now) {
  this.nextTownAt = now + Config.TOWN_INTERVAL_MS + Math.random() * Config.TOWN_JITTER_MS
}


// One growth step for every live trace. Returns the ops to draw.
Scene.prototype.step = function(now) {
  this.ops = []
  var growers = this.growers
  for (var i = 0; i < growers.length; i++) this.stepGrower(growers[i])
  this.growers = this.growers.filter(function(g) { return g.alive })

  if (this.growers.length < Config.TOWN_BELOW && now >= this.nextTownAt) {
    this.spawnTown()
    this.scheduleTown(now)
  }
  return this.ops
}

// The first free direction, trying straight on, then ever sharper turns.
Scene.prototype.freeDirection = function(gx, gy, dir) {
  var offsets = [0, -1, 1, -2, 2, -3, 3, 4]
  for (var i = 0; i < offsets.length; i++) {
    var d = (dir + offsets[i] + 8) % 8
    if (this.isFree(gx + DIRS[d][0], gy + DIRS[d][1])) return d
  }
  return -1
}

Scene.prototype.stepGrower = function(g) {
  if (!g.alive) return
  g.life++
  if (g.life > g.maxLife) { this.killGrower(g); return }

  // A wanted turn still goes straight on when that cell is free (as in the
  // original); it only starts a new run, which may place a component.
  var nx = g.gx + DIRS[g.dir][0], ny = g.gy + DIRS[g.dir][1]
  var wantTurn = g.stepsInDir >= g.maxSteps && Math.random() < Config.TURN_CHANCE
  if (!this.isFree(nx, ny) || wantTurn) {
    var nd = this.freeDirection(g.gx, g.gy, g.dir)
    if (nd === -1) { this.killGrower(g); return }
    g.dir = nd
    g.stepsInDir = 0
    g.maxSteps = 3 + randInt(8)
    nx = g.gx + DIRS[nd][0]
    ny = g.gy + DIRS[nd][1]
  }

  this.addTrace(g.gx, g.gy, nx, ny, g.color)
  this.occupy(nx, ny)
  g.gx = nx
  g.gy = ny
  g.stepsInDir++

  if (Math.random() < Config.VIA_CHANCE) this.addVia(nx, ny, 0.22, g.color)

  if (g.stepsInDir === 1 && g.generation < Config.MAX_GENERATION && Math.random() < Config.COMPONENT_CHANCE)
    this.addComponent(nx, ny, g.dir, g.color)

  if (g.generation < Config.MAX_GENERATION && this.growers.length < Config.MAX_GROWERS
      && Math.random() < Config.BRANCH_CHANCE) {
    var side = Math.random() < 0.5 ? 2 : -2
    var bd = this.freeDirection(g.gx, g.gy, (g.dir + side + 8) % 8)
    if (bd !== -1) {
      var bx = g.gx + DIRS[bd][0], by = g.gy + DIRS[bd][1]
      this.occupy(bx, by)
      this.growers.push(this.makeGrower(bx, by, bd, {
        generation: g.generation + 1,
        maxLife: 30 + Math.random() * 90
      }))
    }
  }
}

// A trace that stops ends in a component or a via.
Scene.prototype.killGrower = function(g) {
  g.alive = false
  if (Math.random() < Config.END_COMPONENT_CHANCE) this.addComponent(g.gx, g.gy, g.dir, g.color)
  else this.addVia(g.gx, g.gy, 0.26, g.color)
}

// A component with three to five traces leaving it, somewhere away from the
// logo where a 5x5 block of cells is still free.
Scene.prototype.spawnTown = function() {
  for (var attempt = 0; attempt < 40; attempt++) {
    var gx = 3 + randInt(this.cols - 6)
    var gy = 3 + randInt(this.rows - 6)
    var dx = gx * this.cell - this.centerX, dy = gy * this.cell - this.centerY
    if (Math.sqrt(dx * dx + dy * dy) < this.protectRadius + this.cell * 6) continue
    var clear = true
    for (var oy = -2; oy <= 2 && clear; oy++)
      for (var ox = -2; ox <= 2 && clear; ox++)
        if (!this.isFree(gx + ox, gy + oy)) clear = false
    if (!clear) continue

    var color = Math.random() < 0.7 ? Config.BLUE : Config.BLUE_LIGHT
    this.occupy(gx, gy)
    this.addComponent(gx, gy, randInt(8), color)
    var n = 3 + randInt(3)
    for (var i = 0; i < n; i++) {
      this.growers.push(this.makeGrower(gx, gy, randInt(8), {
        generation: 1,
        maxLife: 50 + Math.random() * 120,
        color: color
      }))
    }
    return
  }
}

// ---------------------------------------------------------------------- ops
//
// Coordinates are in logical pixels. left/top/right/bottom is the area an op
// paints, glow included.

Scene.prototype.addOp = function(op, cx0, cy0, cx1, cy1, reach) {
  var pad = this.cell * (reach + Config.GLOW_WIDTH) + 2
  op.left = Math.min(cx0, cx1) - pad
  op.top = Math.min(cy0, cy1) - pad
  op.right = Math.max(cx0, cx1) + pad
  op.bottom = Math.max(cy0, cy1) + pad
  this.ops.push(op)
}

Scene.prototype.addTrace = function(gx1, gy1, gx2, gy2, color) {
  var c = this.cell
  this.addOp({ kind: "trace", x1: gx1 * c, y1: gy1 * c, x2: gx2 * c, y2: gy2 * c, color: color,
               width: Math.max(1.5, c * 0.11) },
             gx1 * c, gy1 * c, gx2 * c, gy2 * c, 0.1)
}

// A via of radius r cells.
Scene.prototype.addVia = function(gx, gy, r, color) {
  var c = this.cell
  this.addOp({ kind: "via", x: gx * c, y: gy * c, r: r * c, color: color, width: Math.max(1.2, c * 0.09) },
             gx * c, gy * c, gx * c, gy * c, r + 0.1)
}

// A component symbol at a grid point, its leads along direction dir. The
// symbol is picked here so every tile draws the same one.
Scene.prototype.addComponent = function(gx, gy, dir, color) {
  var c = this.cell
  this.addOp({ kind: "component", x: gx * c, y: gy * c, size: c, shape: randInt(4),
               angle: Math.atan2(DIRS[dir][1], DIRS[dir][0]), color: color, width: Math.max(1.3, c * 0.1) },
             gx * c, gy * c, gx * c, gy * c, 1.45)
}

// ------------------------------------------------------------------ drawing

// Paints one op onto ctx. glowWidth is the halo width per side.
function drawOp(ctx, op, glowWidth) {
  ctx.beginPath()
  switch (op.kind) {
  case "trace":
    ctx.moveTo(op.x1, op.y1)
    ctx.lineTo(op.x2, op.y2)
    glowStroke(ctx, op.color, op.width, glowWidth)
    break
  case "via":
    ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2)
    ctx.fillStyle = Config.NAVY_DARK
    ctx.globalAlpha = 1
    ctx.fill()
    glowStroke(ctx, op.color, op.width, glowWidth)
    break
  case "component":
    ctx.save()
    ctx.translate(op.x, op.y)
    ctx.rotate(op.angle)
    componentPath(ctx, op.shape, op.size)
    glowStroke(ctx, op.color, op.width, glowWidth)
    ctx.restore()
    break
  }
}

// Strokes the current path as a neon line: two translucent halo passes, then
// the line itself. The halos use flat caps so the segments of a straight run
// butt together instead of stacking up into bright beads at every grid point.
function glowStroke(ctx, color, width, glowWidth) {
  ctx.strokeStyle = color
  ctx.lineJoin = "round"
  ctx.lineCap = "butt"
  ctx.globalAlpha = Config.GLOW_ALPHA_OUTER
  ctx.lineWidth = width + glowWidth * 2
  ctx.stroke()
  ctx.globalAlpha = Config.GLOW_ALPHA_INNER
  ctx.lineWidth = width + glowWidth
  ctx.stroke()
  ctx.lineCap = "round"
  ctx.globalAlpha = 1
  ctx.lineWidth = width
  ctx.stroke()
}

// The path of a component symbol of grid size s, centred on the origin with its
// leads along the x axis.
function componentPath(ctx, shape, s) {
  switch (shape) {
  case 0: // resistor: zigzag between two leads
    ctx.moveTo(-s * 1.1, 0)
    ctx.lineTo(-s * 0.6, 0)
    ctx.lineTo(-s * 0.4, -s * 0.35)
    ctx.lineTo(-s * 0.1, s * 0.35)
    ctx.lineTo(s * 0.2, -s * 0.35)
    ctx.lineTo(s * 0.5, s * 0.35)
    ctx.lineTo(s * 0.6, 0)
    ctx.lineTo(s * 1.1, 0)
    break
  case 1: // capacitor: two plates
    ctx.moveTo(-s * 1.1, 0); ctx.lineTo(-s * 0.18, 0)
    ctx.moveTo(s * 0.18, 0); ctx.lineTo(s * 1.1, 0)
    ctx.moveTo(-s * 0.18, -s * 0.55); ctx.lineTo(-s * 0.18, s * 0.55)
    ctx.moveTo(s * 0.18, -s * 0.55); ctx.lineTo(s * 0.18, s * 0.55)
    break
  case 2: // transistor: a circle with three leads (the base lead runs on through it)
    ctx.moveTo(-s * 1.1, 0); ctx.lineTo(-s * 0.4, 0)
    ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2)
    ctx.moveTo(s * 0.3, -s * 0.3); ctx.lineTo(s * 1.1, -s * 0.7)
    ctx.moveTo(s * 0.3, s * 0.3); ctx.lineTo(s * 1.1, s * 0.7)
    break
  default: // chip: a block with pins, echoing the logo's [GS] brackets
    ctx.moveTo(-s * 1.2, 0); ctx.lineTo(-s * 0.55, 0)
    ctx.moveTo(s * 0.55, 0); ctx.lineTo(s * 1.2, 0)
    ctx.rect(-s * 0.55, -s * 0.5, s * 1.1, s * 1.0)
    for (var p = -1; p <= 1; p++) {
      ctx.moveTo(s * 0.3 * p, -s * 0.5)
      ctx.lineTo(s * 0.3 * p, -s * 0.65)
    }
    break
  }
}
