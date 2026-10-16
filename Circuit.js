.pragma library
.import "Config.js" as Config
.import "Symbols.js" as Symbols
.import "Modules.js" as Modules

// The circuit generator, in the spirit of the old Windows "Pipes" screensaver:
// at most a few traces at a time, each one continuous path that wanders across
// the screen on a grid, in straight runs joined by 45° and 90° turns. Schematic
// symbols sit in the straight runs, now and then a small circuit (a module:
// rectifier, amplifier, clock, ...) where the grid has room, vias mark some
// turns, and every trace ends in a via, ground, supply, test point or pin
// header, or in a module such as a speaker crossover.
// When a trace is blocked or long enough it ends, and a new one starts
// somewhere else, so the screen never fills the same way twice.
//
// The scene does not draw itself: each step returns the new drawing operations
// (ops), each with its bounding box, and drawOp() paints one onto a canvas.
// That lets the screen be split into small canvas tiles of which only the
// touched ones repaint.

var DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
var TURNS = [-2, -1, 1, 2]

function randInt(n) {
  return Math.floor(Math.random() * n)
}

function randRange(min, max) {
  return min + randInt(max - min + 1)
}

function shuffled(list) {
  var out = list.slice()
  for (var i = out.length - 1; i > 0; i--) {
    var j = randInt(i + 1)
    var t = out[i]; out[i] = out[j]; out[j] = t
  }
  return out
}

// A random key of weights (name -> weight), other than avoid.
function pickWeighted(weights, avoid) {
  var total = 0
  for (var name in weights) if (name !== avoid) total += weights[name]
  var r = Math.random() * total
  var picked = ""
  for (var key in weights) {
    if (key === avoid) continue
    picked = key
    r -= weights[key]
    if (r < 0) break
  }
  return picked
}

function isDiagonal(dir) {
  return dir % 2 === 1
}

// A scene for a canvas of width x height logical pixels. The logo is centred at
// (centerX, centerY); no trace enters the circle of protectRadius around it.
function Scene(width, height, centerX, centerY, protectRadius) {
  this.centerX = centerX
  this.centerY = centerY
  this.protectRadius = protectRadius
  this.cell = Math.max(Config.CELL_MIN, Math.round(Math.min(width, height) / Config.CELL_DIVISOR))
  this.cols = Math.ceil(width / this.cell) + 1
  this.rows = Math.ceil(height / this.cell) + 1
  this.occ = new Uint8Array(this.cols * this.rows)
  this.occupied = 0
  this.traces = []
  this.ops = []
  this.nextStartAt = 0
  this.exhausted = false
}

// The module the screens place next, and the one placed last. Kept across
// scenes and screens, so the sequence varies, and a large module that needs a
// lot of free room still gets its turn instead of losing out to small ones.
var nextModule = ""
var lastModule = ""
var moduleTries = 0

Scene.prototype.reset = function(now) {
  this.occ.fill(0)
  this.occupied = 0
  this.traces = []
  this.exhausted = false
  this.markProtectedZone()
  this.nextStartAt = now
}

// Full: enough of the grid is taken, or no new trace finds room any more.
Scene.prototype.full = function() {
  return this.exhausted || this.occupied / this.occ.length > Config.FULL_RATIO
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

// Whether a trace at (gx, gy) can move one cell in direction dir. A diagonal
// move may not squeeze between two taken cells: that would cross another trace.
Scene.prototype.canMove = function(gx, gy, dir) {
  var dx = DIRS[dir][0], dy = DIRS[dir][1]
  if (!this.isFree(gx + dx, gy + dy)) return false
  if (isDiagonal(dir) && !this.isFree(gx + dx, gy) && !this.isFree(gx, gy + dy)) return false
  return true
}

Scene.prototype.markProtectedZone = function() {
  var r = Math.round(this.protectRadius / this.cell)
  var cgx = Math.round(this.centerX / this.cell)
  var cgy = Math.round(this.centerY / this.cell)
  for (var y = -r; y <= r; y++)
    for (var x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) this.occupy(cgx + x, cgy + y)
}

// One step for every live trace; starts new ones while fewer than MAX_TRACES
// are alive. Returns the ops to draw.
Scene.prototype.step = function(now) {
  this.ops = []
  for (var i = 0; i < this.traces.length; i++) {
    if (!this.stepTrace(this.traces[i])) this.nextStartAt = now + Config.RESTART_MS
  }
  this.traces = this.traces.filter(function(t) { return t.alive })

  if (this.traces.length < Config.MAX_TRACES && now >= this.nextStartAt) {
    if (this.startTrace()) this.nextStartAt = now + Config.START_GAP_MS
    else if (this.traces.length === 0) this.exhausted = true
  }
  return this.ops
}

// ------------------------------------------------------------------ traces

// A new trace, either at the rim of the logo zone heading outwards (at a random
// angle) or at a random free point heading in a random free direction.
Scene.prototype.startTrace = function() {
  for (var attempt = 0; attempt < 60; attempt++) {
    var gx, gy, dirs
    if (Math.random() < Config.LOGO_START_SHARE) {
      var ang = Math.random() * Math.PI * 2
      var r = this.protectRadius / this.cell + 0.5
      gx = Math.round(this.centerX / this.cell + Math.cos(ang) * r)
      gy = Math.round(this.centerY / this.cell + Math.sin(ang) * r)
      // The direction closest to the outward angle (unit vectors, so the
      // diagonals are not favoured).
      var best = 0, bestDot = -2
      for (var d = 0; d < 8; d++) {
        var len = isDiagonal(d) ? Math.SQRT2 : 1
        var dot = (Math.cos(ang) * DIRS[d][0] + Math.sin(ang) * DIRS[d][1]) / len
        if (dot > bestDot) { bestDot = dot; best = d }
      }
      dirs = [best]
    } else {
      gx = randInt(this.cols)
      gy = randInt(this.rows)
      dirs = shuffled([0, 1, 2, 3, 4, 5, 6, 7])
    }
    if (!this.isFree(gx, gy)) continue
    for (var i = 0; i < dirs.length; i++) {
      if (!this.hasRoom(gx, gy, dirs[i], Config.RUN_MIN)) continue
      this.occupy(gx, gy)
      var trace = {
        gx: gx, gy: gy,
        dir: dirs[i],
        alive: true,
        color: Math.random() < Config.WHITE_SHARE ? Config.WHITE : Config.BLUE,
        runLeft: randRange(Config.RUN_MIN, Config.RUN_MAX),
        cells: 0,
        maxCells: randRange(Config.TRACE_MIN_CELLS, Config.TRACE_MAX_CELLS),
        // The cell being moved to, and how far along (in ticks) the move is.
        tx: gx, ty: gy, progress: 0,
        // Ticks to wait while a symbol takes the place of a few cells.
        wait: 0,
        lastSymbol: "",
        // Ended in a module, so it needs no end symbol.
        capped: false
      }
      this.addVia(gx, gy, 0.26, trace.color)
      this.traces.push(trace)
      return true
    }
  }
  return false
}

// Whether n free cells lie straight ahead.
Scene.prototype.hasRoom = function(gx, gy, dir, n) {
  for (var i = 0; i < n; i++) {
    if (!this.canMove(gx, gy, dir)) return false
    gx += DIRS[dir][0]
    gy += DIRS[dir][1]
  }
  return true
}

// Advances a trace by one tick. Returns false when the trace ends.
Scene.prototype.stepTrace = function(t) {
  if (t.wait > 0) {
    t.wait--
    return true
  }
  if (t.progress === 0 && !this.chooseNext(t)) {
    t.alive = false
    if (t.capped) return false
    var cap = pickWeighted(Config.END_SYMBOLS, "")
    if (cap === "via") this.addVia(t.gx, t.gy, 0.26, t.color)
    else this.addEnd(t.gx, t.gy, t.dir, cap, t.color)
    return false
  }
  if (t.progress === 0) return true // a component took this move

  // A cell takes TICKS_PER_CELL ticks; each tick draws its share of the line.
  var from = (t.progress - 1) / Config.TICKS_PER_CELL
  var to = t.progress / Config.TICKS_PER_CELL
  var dx = t.tx - t.gx, dy = t.ty - t.gy
  this.addTrace(t.gx + dx * from, t.gy + dy * from, t.gx + dx * to, t.gy + dy * to, t.color)
  if (t.progress === Config.TICKS_PER_CELL) {
    t.gx = t.tx
    t.gy = t.ty
    t.progress = 0
  } else {
    t.progress++
  }
  return true
}

// Picks the next cell of a trace at a grid point: straight on until the run is
// over or blocked, then a turn 45° or 90° to the left or right, each equally
// likely among those that are free. Returns false when the trace must end.
Scene.prototype.chooseNext = function(t) {
  if (t.cells >= t.maxCells) return false

  if (t.runLeft > 0 && this.canMove(t.gx, t.gy, t.dir)) {
    if (this.tryModule(t) || this.tryComponent(t)) return true
    this.moveTo(t, t.dir)
    t.runLeft--
    return true
  }

  // Prefer turns with room for a whole short run; a trace with no room for
  // even two cells in any direction ends, instead of curling up into a spiral.
  var turns = shuffled(TURNS)
  for (var need = Config.RUN_MIN; need >= 2; need--) {
    for (var i = 0; i < turns.length; i++) {
      var dir = (t.dir + turns[i] + 8) % 8
      if (!this.hasRoom(t.gx, t.gy, dir, need)) continue
      if (Math.random() < Config.VIA_AT_TURN) this.addVia(t.gx, t.gy, 0.2, t.color)
      t.dir = dir
      t.runLeft = randRange(Config.RUN_MIN, Config.RUN_MAX) - 1
      this.moveTo(t, dir)
      return true
    }
  }

  // No turn has room: keep going straight while that is still open.
  if (this.hasRoom(t.gx, t.gy, t.dir, 2)) {
    this.moveTo(t, t.dir)
    return true
  }
  return false
}

Scene.prototype.moveTo = function(t, dir) {
  t.tx = t.gx + DIRS[dir][0]
  t.ty = t.gy + DIRS[dir][1]
  this.occupy(t.tx, t.ty)
  t.cells++
  t.progress = 1
}

// Now and then a schematic symbol takes the next COMPONENT_CELLS cells of a
// straight, horizontal or vertical run. The cells beside it are reserved too,
// so no other trace runs through the symbol.
Scene.prototype.tryComponent = function(t) {
  var span = Config.COMPONENT_CELLS
  if (isDiagonal(t.dir) || t.runLeft < span || Math.random() >= Config.COMPONENT_CHANCE) return false
  if (!this.hasRoom(t.gx, t.gy, t.dir, span)) return false
  var dx = DIRS[t.dir][0], dy = DIRS[t.dir][1]
  var i
  for (i = 1; i < span; i++) {
    var cx = t.gx + i * dx, cy = t.gy + i * dy
    if (!this.isFree(cx + dy, cy + dx) || !this.isFree(cx - dy, cy - dx)) return false
  }
  for (i = 1; i <= span; i++) {
    var x = t.gx + i * dx, y = t.gy + i * dy
    this.occupy(x, y)
    if (i < span) {
      this.occupy(x + dy, y + dx)
      this.occupy(x - dy, y - dx)
    }
  }
  t.lastSymbol = pickWeighted(Config.INLINE_SYMBOLS, t.lastSymbol)
  this.addComponent(t.gx + dx * span / 2, t.gy + dy * span / 2, t.dir, span / 2, t.lastSymbol, t.color)
  t.gx += span * dx
  t.gy += span * dy
  t.cells += span
  t.runLeft -= span
  t.wait = span * Config.TICKS_PER_CELL - 1
  return true
}

// Rarely, a module takes a free block of cells ahead of a horizontal or
// vertical trace; the trace leaves it on the far side or ends in it.
Scene.prototype.tryModule = function(t) {
  if (isDiagonal(t.dir) || Math.random() >= Config.MODULE_CHANCE) return false
  if (nextModule === "" || moduleTries >= Config.MODULE_TRIES) {
    nextModule = pickWeighted(Config.MODULES, lastModule)
    moduleTries = 0
  }
  moduleTries++
  var name = nextModule
  var module = Modules.MODULES[name]
  var dx = DIRS[t.dir][0], dy = DIRS[t.dir][1]
  var across = Math.ceil(module.half)
  var i, j
  for (i = 1; i <= module.cells; i++)
    for (j = -across; j <= across; j++)
      if (!this.isFree(t.gx + i * dx + j * dy, t.gy + i * dy + j * dx)) return false
  for (i = 1; i <= module.cells; i++)
    for (j = -across; j <= across; j++)
      this.occupy(t.gx + i * dx + j * dy, t.gy + i * dy + j * dx)

  lastModule = name
  nextModule = ""
  this.addModule(t.gx + dx * module.cells / 2, t.gy + dy * module.cells / 2, t.dir, name, t.color)
  t.wait = module.cells * Config.TICKS_PER_CELL - 1
  if (module.end) {
    t.capped = true
    t.cells = t.maxCells
    return true
  }
  t.gx += module.cells * dx
  t.gy += module.cells * dy
  t.cells += module.cells
  t.runLeft = randRange(1, 3)
  return true
}

// ---------------------------------------------------------------------- ops
//
// Coordinates are in logical pixels. left/top/right/bottom is the area an op
// paints, glow included.

Scene.prototype.addOp = function(op, ax, ay, bx, by, reach) {
  var pad = this.cell * (reach + Config.GLOW_WIDTH) + 2
  op.left = Math.min(ax, bx) - pad
  op.top = Math.min(ay, by) - pad
  op.right = Math.max(ax, bx) + pad
  op.bottom = Math.max(ay, by) + pad
  this.ops.push(op)
}

// A piece of trace between two grid positions (fractions allowed).
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

// An inline symbol centred on (gx, gy), its leads along direction dir reaching
// half cells to either side. The symbol is picked here so every tile draws the
// same one.
Scene.prototype.addComponent = function(gx, gy, dir, half, symbol, color) {
  var c = this.cell
  this.addOp({ kind: "component", x: gx * c, y: gy * c, size: c * Config.SYMBOL_SCALE, half: half * c, symbol: symbol,
               angle: Math.atan2(DIRS[dir][1], DIRS[dir][0]), color: color, width: Math.max(1.2, c * 0.08) },
             gx * c, gy * c, gx * c, gy * c, Math.max(half, 0.8 * Config.SYMBOL_SCALE))
}

// An end symbol at (gx, gy) for a trace that arrived heading in direction dir.
Scene.prototype.addEnd = function(gx, gy, dir, symbol, color) {
  var c = this.cell
  this.addOp({ kind: "end", x: gx * c, y: gy * c, size: c * Config.SYMBOL_SCALE, symbol: symbol,
               angle: Math.atan2(DIRS[dir][1], DIRS[dir][0]), color: color, width: Math.max(1.2, c * 0.08) },
             gx * c, gy * c, gx * c, gy * c, 0.7 * Config.SYMBOL_SCALE)
}

// A module centred on (gx, gy) for a trace heading in direction dir. A trace
// heading left gets the module mirrored rather than turned upside down, so
// its grounds still point down.
Scene.prototype.addModule = function(gx, gy, dir, name, color) {
  var c = this.cell
  var module = Modules.MODULES[name]
  this.addOp({ kind: "module", x: gx * c, y: gy * c, size: c, name: name,
               angle: dir === 4 ? 0 : Math.atan2(DIRS[dir][1], DIRS[dir][0]), mirror: dir === 4,
               color: color, width: Math.max(1.2, c * 0.08) },
             gx * c, gy * c, gx * c, gy * c, Math.max(module.cells / 2, module.half) + 0.3)
}

// ------------------------------------------------------------------ drawing

// Paints one op onto ctx. glowWidth is the halo width per side.
function drawOp(ctx, op, glowWidth) {
  ctx.beginPath()
  switch (op.kind) {
  case "trace":
    ctx.moveTo(op.x1, op.y1)
    ctx.lineTo(op.x2, op.y2)
    glowStroke(ctx, op.color, op.width, glowWidth, "butt")
    break
  case "via":
    ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2)
    ctx.fillStyle = Config.NAVY_DARK
    ctx.globalAlpha = 1
    ctx.fill()
    glowStroke(ctx, op.color, op.width, glowWidth * Config.SYMBOL_GLOW, "round")
    break
  case "component":
    ctx.save()
    ctx.translate(op.x, op.y)
    ctx.rotate(op.angle)
    var body = Symbols.INLINE[op.symbol](ctx, op.size) * op.size
    ctx.moveTo(-op.half, 0)
    ctx.lineTo(-body, 0)
    ctx.moveTo(body, 0)
    ctx.lineTo(op.half, 0)
    glowStroke(ctx, op.color, op.width, glowWidth * Config.SYMBOL_GLOW, "round")
    ctx.restore()
    break
  case "module":
    drawModule(ctx, op, glowWidth * Config.SYMBOL_GLOW)
    break
  case "end":
    ctx.save()
    ctx.translate(op.x, op.y)
    ctx.rotate(op.angle)
    Symbols.END[op.symbol](ctx, op.size)
    glowStroke(ctx, op.color, op.width, glowWidth * Config.SYMBOL_GLOW, "round")
    ctx.restore()
    break
  }
}

function drawModule(ctx, op, glowWidth) {
  var module = Modules.MODULES[op.name]
  ctx.save()
  ctx.translate(op.x, op.y)
  ctx.rotate(op.angle)
  if (op.mirror) ctx.scale(-1, 1)
  module.draw(Modules.kit(ctx, op.size, Config.MODULE_PART_SCALE))
  glowStroke(ctx, op.color, op.width, glowWidth, "round")
  ctx.restore()
  if (!module.label) return

  // Labels stay upright whichever way the module runs.
  var lx = module.label.x * op.size * (op.mirror ? -1 : 1), ly = module.label.y * op.size
  var cos = Math.cos(op.angle), sin = Math.sin(op.angle)
  ctx.font = "bold " + Math.round(op.size * 0.42) + "px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle = op.color
  ctx.globalAlpha = 1
  ctx.fillText(module.label.text, op.x + cos * lx - sin * ly, op.y + sin * lx + cos * ly)
}

// Strokes the current path as a neon line: two translucent halo passes, then
// the line itself. Traces give their halos flat caps (haloCap "butt") so the
// pieces of a straight run butt together instead of stacking up into bright
// beads; symbols use round ones.
function glowStroke(ctx, color, width, glowWidth, haloCap) {
  ctx.strokeStyle = color
  ctx.lineJoin = "round"
  ctx.lineCap = haloCap
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
