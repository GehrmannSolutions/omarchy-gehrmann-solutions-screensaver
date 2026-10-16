.pragma library

// Tuning constants for the circuit screensaver. Sizes are in logical pixels;
// Qt renders every layer at the screen's device pixel ratio.

// Colours of the Gehrmann Solutions theme.
var NAVY = "#192031"        // centre of the background gradient
var NAVY_DARK = "#12172a"   // fill inside vias
var NAVY_DEEP = "#0c0f1c"   // edge of the background gradient
var BLUE = "#2e3eff"        // brand blue
var WHITE = "#e8ecff"

// The traces are drawn on square canvas tiles of this size; a tick repaints
// (and uploads to the GPU) only the tiles it touched.
var TILE_SIZE = 128

// Pacing: the screen redraws every TICK_MS (growth, breathing and fade); a
// trace takes TICKS_PER_CELL ticks per grid cell, drawn piece by piece. The
// fade back to the logo lasts FADE_MS.
var TICK_MS = 55
var TICKS_PER_CELL = 2
var FADE_MS = 5000

// The scene fades and restarts once this share of grid cells is taken (the
// logo zone counts), or when no new trace finds room.
var FULL_RATIO = 0.5

// Grid: cell size is the shorter screen side / CELL_DIVISOR, at least CELL_MIN.
var CELL_DIVISOR = 68
var CELL_MIN = 20

// Traces.
var MAX_TRACES = 3            // traces growing at the same time
var START_GAP_MS = 1500       // at least this long between two new traces
var RESTART_MS = 600          // pause after a trace ends before the next starts
var LOGO_START_SHARE = 0.35   // share of traces that start at the logo, the rest anywhere
var TRACE_MIN_CELLS = 60      // a trace ends after a random length in this range,
var TRACE_MAX_CELLS = 180     // or earlier when it is boxed in
var RUN_MIN = 3               // straight cells between two turns, at least
var RUN_MAX = 12              // and at most
var WHITE_SHARE = 0.35        // share of white traces; the rest are blue
var VIA_AT_TURN = 0.3         // chance of a via at a turn

// Schematic symbols. In a horizontal or vertical run with room, a symbol takes
// the next COMPONENT_CELLS cells with this chance per cell; which one is drawn
// is random by weight (never the same twice in a row on one trace). Every trace
// ends in one of the end symbols, also by weight. Shapes: Symbols.js.
var COMPONENT_CELLS = 4
var COMPONENT_CHANCE = 0.3
var INLINE_SYMBOLS = {
  resistor: 3,        // IEC box
  resistorZigzag: 2,  // US zigzag
  potentiometer: 1,
  capacitor: 3,
  electrolytic: 2,    // polarised
  inductor: 2,
  diode: 2,
  led: 2,
  zener: 1,
  npn: 2,
  pnp: 1,
  mosfet: 2,
  chip: 2,            // DIP IC
  crystal: 1,
  fuse: 1,
  switch: 1,
  button: 1,          // push button
  battery: 1
}
var END_SYMBOLS = {
  via: 4,             // a plain pad
  ground: 2,
  vcc: 2,             // supply rail
  testPoint: 1,
  header: 1           // pin header
}
// Modules: small circuits a horizontal or vertical trace runs through (or ends
// in) where a block of the grid is free, with this chance per cell; which one
// is random by weight, never the same twice in a row. A module that finds no
// room is tried again at the next MODULE_TRIES chances before another is
// picked. Shapes: Modules.js.
var MODULE_CHANCE = 0.08
var MODULE_TRIES = 25
var MODULES = {
  rcLowPass: 2,
  voltageDivider: 2,
  ledChain: 2,          // series resistor and three LEDs
  bridgeRectifier: 2,   // four diodes and a smoothing capacitor
  transformer: 2,
  crossover: 1,         // two-way speaker crossover; the trace ends in it
  ampStage: 2,          // common-emitter transistor amplifier
  opAmp: 2,             // inverting op-amp amplifier
  timer555: 2,          // 555 astable clock
  crystalOscillator: 1, // Pierce oscillator
  regulator: 2          // 7805 with input and output capacitors
}
// Size of the parts inside a module, relative to the grid cell.
var MODULE_PART_SCALE = 0.8

// Symbols are drawn this many times the grid cell, so their details stay
// readable; they keep to the cells reserved for them.
var SYMBOL_SCALE = 1.5
// Halo width of symbols and vias, relative to the traces' (fine details stay readable).
var SYMBOL_GLOW = 0.5

// Glow: wide translucent strokes under each line instead of canvas shadowBlur,
// which Qt computes on the CPU for every draw call.
var GLOW_WIDTH = 0.45         // halo width per side, in cells
var GLOW_ALPHA_OUTER = 0.08
var GLOW_ALPHA_INNER = 0.18

// Logo. The layer PNGs are square boxes; the logo's bounding box is ~65 % of
// the box height and its centre sits at LOGO_CENTER_Y of the box height.
var LOGO_HEIGHT = 0.34        // logo height as a share of the shorter screen side
var LOGO_BOX_SHARE = 0.645    // logo height / box height in the PNGs
var LOGO_CENTER_Y = 0.461     // logo centre / box height in the PNGs
var PROTECT_RADIUS = 0.62     // keep-out radius around the logo, in logo heights

// The logo's glow breathes between these opacities, once per BREATH_MS.
var BREATH_MS = 2400
var GLOW_LOW = 0.35
var GLOW_HIGH = 1.0

// Pointer travel (logical pixels) that counts as "the mouse moved".
var MOVE_THRESHOLD = 6
