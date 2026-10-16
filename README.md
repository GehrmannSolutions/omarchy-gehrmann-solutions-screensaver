# GS Circuit Screensaver

A generative screensaver for the [Omarchy](https://omarchy.org) shell. Neon circuit
traces grow out of the Gehrmann Solutions logo, turn, fork and drop resistor,
capacitor, transistor and chip symbols; new component "towns" appear in empty
regions. Once the screen is about two-thirds full, the traces fade back to the logo
and growth starts over. The logo's glow breathes slowly, like the theme's boot screen.

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
/usr/lib/qt6/bin/qml dev/Preview.qml
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
| `TICK_MS` | 55 | One growth step per tick; also the redraw rate (about 18 per second) |
| `FADE_MS` | 5000 | Length of the fade back to the logo |
| `FULL_RATIO` | 0.62 | Share of the grid that counts as full and starts the fade |
| `CELL_DIVISOR`, `CELL_MIN` | 68, 20 | Grid cell size: shorter screen side / divisor, at least the minimum (logical px) |
| `SEED_COUNT` | 10 | Traces that start at the logo |
| `WHITE_SHARE` | 0.22 | Share of white traces; the rest are brand blue |
| `TURN_CHANCE`, `VIA_CHANCE`, `COMPONENT_CHANCE`, `END_COMPONENT_CHANCE`, `BRANCH_CHANCE` | 0.55, 0.05, 0.18, 0.6, 0.02 | Growth behaviour per step |
| `MAX_GENERATION`, `MAX_GROWERS` | 3, 140 | Limits for forks |
| `TOWN_BELOW`, `TOWN_INTERVAL_MS`, `TOWN_JITTER_MS` | 16, 2600, 3200 | When new component towns appear |
| `GLOW_WIDTH`, `GLOW_ALPHA_OUTER`, `GLOW_ALPHA_INNER` | 0.45, 0.08, 0.18 | The traces' neon halo |
| `LOGO_HEIGHT`, `PROTECT_RADIUS` | 0.34, 0.62 | Logo size (share of the shorter screen side) and the keep-out zone around it |
| `BREATH_MS`, `GLOW_LOW`, `GLOW_HIGH` | 2400, 0.35, 1.0 | The logo glow's breathing |
| `MOVE_THRESHOLD` | 6 | Pointer travel (logical px) that dismisses it |
| `TILE_SIZE` | 128 | Size of the canvas tiles the traces are drawn on |
| colours | theme palette | Navy `#192031` / `#12172a` / `#0c0f1c`, blue `#2e3eff`, light blue `#5865ff`, white `#e8ecff` |

## How it works

| File | What |
|---|---|
| `manifest.json` | Plugin manifest (`kind: service`, kept loaded) |
| `Service.qml` | Follows the idle and lock services, shows one window per monitor, IPC target `circuit-screensaver` |
| `ScreensaverWindow.qml` | The overlay layer for one monitor; hides the cursor, turns input into a dismissal |
| `CircuitScene.qml` | Background, trace tiles and logo of one screen; one timer drives growth, breathing and fade |
| `Circuit.js` | The generator: grid, random walk, components, towns, and how each piece is drawn |
| `Config.js` | Tuning constants |
| `assets/` | The logo's outline and glow layers (1280 px, from the Gehrmann Solutions theme's boot screen) |
| `dev/Preview.qml` | The scene in a plain window, outside the shell |

Some choices worth knowing:

- **A layer surface, not a window.** Hyprland counts mapping or focusing a *window* as
  activity for idle monitors, which would end the idle cycle (and its lock timer)
  right after the screensaver appears. Mapping a layer surface with exclusive
  keyboard focus does not. The exclusive focus also keeps the key that wakes the
  screen from reaching the focused application.
- **Drawn incrementally on tiles.** The traces canvas keeps its content, so each tick
  only draws the new pieces. The screen is split into 128 px canvas tiles and only the
  touched ones repaint, because a repainted canvas is copied and uploaded whole.
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
