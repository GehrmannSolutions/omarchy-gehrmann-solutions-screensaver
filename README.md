# GS Circuit Screensaver

A generative screensaver for the [Omarchy](https://omarchy.org) shell, in the spirit
of the old Windows "Pipes" screensaver, drawn as a circuit board around the Gehrmann
Solutions logo. At most three neon traces grow at a time, each one continuous path
that wanders across the screen in straight runs joined by 45° and 90° turns.
Schematic symbols sit in the runs (resistors, capacitors, diodes, LEDs, transistors,
chips and more), and now and then a trace runs through a small circuit: a bridge
rectifier, a transformer, an amplifier stage, a 555 clock. Traces end in a via, a
ground, a supply rail, a test point or a pin header; then a new one starts somewhere
else, so the board never fills the same way twice. Once it is about half full, the
traces fade back to the logo and it starts over. The logo's glow breathes slowly,
like the theme's boot screen.

It runs inside `omarchy-shell` as a plugin: one fullscreen layer per monitor, drawn
with QML `Canvas`, sharp at any display scale. No browser, no extra process.

## How it starts and stops

- **Start:** when Omarchy's idle service (`omarchy.idle`) reaches its screensaver
  timeout (`idle.screensaver` in `~/.config/omarchy/shell.json`). The plugin has no
  timer of its own, so idle inhibitors (video calls, media), *stay awake* and the
  configured timeouts apply exactly as they do to Omarchy's own screensaver.
- **Stop:** on any key, click, scroll or pointer movement; when the idle service ends
  its idle cycle; and when the session locks. The lock still comes at the configured
  lock timeout.
- While hidden or locked, its windows do not exist, so nothing is drawn.

## Omarchy's own screensaver

Omarchy's idle service always starts Omarchy's terminal screensaver
(`omarchy-launch-screensaver`), unless it is switched off with
`omarchy toggle screensaver`. Two screensavers on top of each other would need two
dismissals and keep both drawing, so **this plugin only takes over while Omarchy's
terminal screensaver is switched off**. While it is on, the plugin stays passive
(the shell log says so) and only the preview below works.

So, to use this screensaver: enable the plugin, then switch the terminal one off once:

```bash
omarchy toggle screensaver     # notification says "Screensaver disabled": the terminal one is off
```

Run the same command again to go back to the terminal screensaver. The plugin
reads the toggle at every idle cycle; no restart is needed. Nothing in Omarchy
itself is changed.

## Install

```bash
omarchy plugin add https://github.com/GehrmannSolutions/omarchy-gehrmann-solutions-screensaver.git --enable
omarchy toggle screensaver
```

`omarchy plugin add` without `--enable` installs it disabled, so you can read the
code first; `omarchy plugin enable solutions.gehrmann.circuit-screensaver` enables it
later.

By hand: copy this folder to `~/.config/omarchy/plugins/solutions.gehrmann.circuit-screensaver/`,
then `omarchy-shell shell rescanPlugins` and
`omarchy plugin enable solutions.gehrmann.circuit-screensaver`.

Installing, enabling or editing any plugin reloads all shell plugins, the lock
screen included. Do it from an unlocked session.

## Preview

Show it now, without waiting for idle (any input dismisses it):

```bash
omarchy-shell circuit-screensaver preview   # "locked" while the session is locked
omarchy-shell circuit-screensaver stop
omarchy-shell circuit-screensaver status    # JSON: showing, idle cycle, toggle, lock state
```

Outside the shell, in an ordinary window (handy while tuning; needs Qt's `qml` tool
from `qt6-declarative`):

```bash
/usr/lib/qt6/bin/qml dev/Preview.qml   # the screensaver
/usr/lib/qt6/bin/qml dev/Sheet.qml     # every symbol, trace end and module once
```

## Remove

```bash
omarchy plugin remove solutions.gehrmann.circuit-screensaver
omarchy toggle screensaver     # only if you switched the terminal screensaver off for it
```

## Tuning

All constants live in [`Config.js`](Config.js); saving the file reloads the plugin.

| Constant | Default | What it does |
|---|---|---|
| `TICK_MS`, `TICKS_PER_CELL` | 55, 2 | Redraw interval (about 18 per second) and ticks per grid cell: a trace grows about 9 cells a second, drawn in half-cell steps |
| `FADE_MS` | 5000 | Length of the fade back to the logo |
| `FULL_RATIO` | 0.5 | Share of the grid (logo zone included) that counts as full and starts the fade |
| `CELL_DIVISOR`, `CELL_MIN` | 68, 20 | Grid cell size: shorter screen side / divisor, at least the minimum (logical px) |
| `MAX_TRACES` | 3 | Traces growing at the same time |
| `START_GAP_MS`, `RESTART_MS` | 1500, 600 | Time between two new traces, and the pause after one ends |
| `LOGO_START_SHARE` | 0.35 | Share of traces that start at the logo's edge; the rest start anywhere |
| `TRACE_MIN_CELLS`, `TRACE_MAX_CELLS` | 60, 180 | Length of a trace, unless it is boxed in first |
| `RUN_MIN`, `RUN_MAX` | 3, 12 | Straight cells between two turns |
| `WHITE_SHARE` | 0.35 | Share of white traces; the rest are brand blue |
| `VIA_AT_TURN` | 0.3 | Chance of a via at a turn |
| `COMPONENT_CELLS`, `COMPONENT_CHANCE` | 4, 0.3 | Cells a symbol takes in a run, and the chance per cell to place one |
| `INLINE_SYMBOLS` | see below | Symbols in the runs, with their weights |
| `END_SYMBOLS` | see below | How traces end, with their weights |
| `MODULE_CHANCE`, `MODULE_TRIES` | 0.08, 25 | Chance per cell to place a module where its block of the grid is free, and how often a module that found no room is tried before another is picked |
| `MODULES` | see below | The circuits, with their weights |
| `MODULE_PART_SCALE` | 0.8 | Size of the parts inside a module |
| `SYMBOL_SCALE`, `SYMBOL_GLOW` | 1.5, 0.5 | Size of a lone symbol (in cells) and its halo relative to the traces' |
| `GLOW_WIDTH`, `GLOW_ALPHA_OUTER`, `GLOW_ALPHA_INNER` | 0.45, 0.08, 0.18 | The traces' neon halo |
| `LOGO_HEIGHT`, `PROTECT_RADIUS` | 0.34, 0.62 | Logo size (share of the shorter screen side) and the keep-out zone around it |
| `BREATH_MS`, `GLOW_LOW`, `GLOW_HIGH` | 2400, 0.35, 1.0 | The logo glow's breathing |
| `MOVE_THRESHOLD` | 6 | Pointer travel (logical px) that dismisses it |
| `TILE_SIZE` | 128 | Size of the canvas tiles the traces are drawn on |
| colours | theme palette | Navy `#192031` / `#12172a` / `#0c0f1c`, blue `#2e3eff`, white `#e8ecff` |

A weight of 0 switches a symbol or module off. Symbols, end symbols and modules are
never the same twice in a row on one trace (modules: anywhere).

**Symbols in the runs** (`INLINE_SYMBOLS`, weight): resistor, IEC box (3) · resistor,
US zigzag (2) · potentiometer (1) · capacitor (3) · electrolytic capacitor (2) ·
inductor (2) · diode (2) · LED (2) · Zener diode (1) · NPN transistor (2) · PNP
transistor (1) · MOSFET (2) · DIP chip (2) · crystal (1) · fuse (1) · switch (1) ·
push button (1) · battery (1).

**Trace ends** (`END_SYMBOLS`): via (4) · ground (2) · supply rail (2) · test point (1)
· pin header (1).

**Modules** (`MODULES`): RC low-pass (2) · voltage divider (2) · LED chain with series
resistor (2) · bridge rectifier with smoothing capacitor (2) · transformer (2) · two-way
speaker crossover, which ends the trace (1) · common-emitter amplifier stage (2) ·
inverting op-amp amplifier (2) · 555 astable clock (2) · Pierce crystal oscillator (1)
· 7805 regulator with capacitors (2). Their shapes are in [`Modules.js`](Modules.js),
the symbols' in [`Symbols.js`](Symbols.js).

## How it works

| File | What |
|---|---|
| `manifest.json` | Plugin manifest (`kind: service`, kept loaded) |
| `Service.qml` | Follows the idle and lock services, shows one window per monitor, IPC target `circuit-screensaver` |
| `ScreensaverWindow.qml` | The overlay layer for one monitor; hides the cursor, turns input into a dismissal |
| `CircuitScene.qml` | Background, trace tiles and logo of one screen; one timer drives growth, breathing and fade |
| `Circuit.js` | The generator: grid, traces, turns, where symbols and modules go, and how each piece is drawn |
| `Symbols.js` | The schematic symbols |
| `Modules.js` | The circuits (modules) |
| `Config.js` | Tuning constants |
| `assets/` | The logo's outline and glow layers (1280 px, from the Gehrmann Solutions theme's boot screen) |
| `dev/Preview.qml` | The scene in a plain window, outside the shell |
| `dev/Sheet.qml` | All symbols, trace ends and modules on one page |

Some choices worth knowing:

- **A layer surface, not a window.** Hyprland counts mapping or focusing a *window* as
  activity for idle monitors, which would end the idle cycle (and its lock timer)
  right after the screensaver appears. Mapping a layer surface with exclusive
  keyboard focus does not. The exclusive focus also keeps the key that wakes the
  screen from reaching the focused application.
- **Drawn incrementally on tiles.** The traces canvas keeps its content, so each tick
  only draws the new pieces. The screen is split into 128 px canvas tiles and only the
  touched ones repaint, because a repainted canvas is copied and uploaded whole.
- **Room is reserved.** A symbol or module claims its cells on the grid (a module a
  whole block), so other traces route around it.
- **Glow without `shadowBlur`.** Qt computes canvas shadows on the CPU for every draw
  call; the neon halo is two wide translucent strokes under each line instead.
- **HiDPI for free.** Qt renders `Canvas` and `Image` at the screen's device pixel
  ratio; all geometry is in logical pixels.

Compared with the earlier HTML/Chromium version: the fade now really lasts `FADE_MS`
(the old one repainted the background at a growing alpha every frame, so it was over
after about a second), the logo shows from the first cycle on (it used to be drawn
before the image had loaded), it is sharp at scale 2, it uses the theme's neon logo
(rendered from its SVG) instead of the old `logo.png`, it stops on mouse movement and
when the session locks, and it needs neither Chromium nor a polling script.

## Licence

See [LICENSE](LICENSE): the code is MIT; the Gehrmann Solutions name and logo
(`assets/`) are not.
