.pragma library

// Tuning constants for the circuit-growth screensaver. Sizes are in logical
// pixels; Qt renders every layer at the screen's device pixel ratio.

// Colours of the Gehrmann Solutions theme.
var NAVY = "#192031"        // centre of the background gradient
var NAVY_DARK = "#12172a"   // fill inside vias
var NAVY_DEEP = "#0c0f1c"   // edge of the background gradient
var BLUE = "#2e3eff"        // brand blue, most traces
var BLUE_LIGHT = "#5865ff"  // component "towns"
var WHITE = "#e8ecff"       // the remaining traces

// The traces are drawn on square canvas tiles of this size; a tick repaints
// (and uploads to the GPU) only the tiles it touched.
var TILE_SIZE = 128

// Pacing: one growth step every TICK_MS, which is also how often the screen
// redraws (breathing and fade included); the fade back to the logo lasts FADE_MS.
var TICK_MS = 55
var FADE_MS = 5000

// The scene fades and restarts once this share of grid cells is taken.
var FULL_RATIO = 0.62

// Grid: cell size is the shorter screen side / CELL_DIVISOR, at least CELL_MIN.
var CELL_DIVISOR = 68
var CELL_MIN = 20

// Growth.
var SEED_COUNT = 10           // traces that start at the rim of the logo zone
var WHITE_SHARE = 0.22        // share of seed traces drawn in WHITE instead of BLUE
var TURN_CHANCE = 0.55        // chance to turn once a straight run is long enough
var VIA_CHANCE = 0.05         // chance of a via on any step
var COMPONENT_CHANCE = 0.18   // chance of a component right after a turn
var END_COMPONENT_CHANCE = 0.6 // a dying trace ends in a component, else in a via
var BRANCH_CHANCE = 0.02      // chance to fork per step
var MAX_GENERATION = 3        // forks of forks stop here
var MAX_GROWERS = 140

// Towns: clusters of traces around a component in an empty region. A new town
// is tried when fewer than TOWN_BELOW growers are alive, every
// TOWN_INTERVAL_MS plus up to TOWN_JITTER_MS.
var TOWN_BELOW = 16
var TOWN_INTERVAL_MS = 2600
var TOWN_JITTER_MS = 3200

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
