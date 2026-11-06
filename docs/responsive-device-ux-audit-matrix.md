# Responsive Multi-Device UX Audit & Layout Matrix

**Tracking issue:** [#15 — Solo Mode vs Computer UX Audit & Multi-Device Responsive Layout Verification](https://github.com/sethusrinivasan/dhayam/issues/15)

This document defines the comprehensive UX audit procedures, viewport matrix, layout rules, and verification checklist for Dhayam—specifically targeting **Solo Mode vs Computer** across smartphones, tablets, foldables, laptops, and large desktop screens.

---

## 1. Audit Objectives

1. **Flawless Viewport Fit**: The complete 7x7 board, brass dice rolling tray, action buttons, score cards, and turn status bar must fit inside the viewport without requiring vertical scrolling during active play.
2. **Touch Target Ergonomics**: All interactive elements (board cells, tokens, roll button, pass button, settings icons) must adhere to WCAG 2.2 AAA minimum target size (min **48x48px** touch target with **8px** clearance).
3. **Contrast & Readability**: Board grid lines, castle markings (safe sanctuaries), coin tokens, player labels, and dice numbers must meet WCAG AAA contrast (minimum **4.5:1** for regular text, **3:1** for UI components).
4. **Orientation Agility**: Fluid handling of dynamic orientation changes (Portrait ⇄ Landscape) without losing game state, clipping modals, or detaching dice physics.
5. **Reduced Motion & Accessibility**: Full compliance with `prefers-reduced-motion: reduce`, ARIA live turn announcements, and keyboard navigability.

---

## 2. Target Device Matrix

| Category | Representative Devices | Viewport Dimensions | Density (DPR) | Critical UX Focus Areas |
|---|---|---|---|---|
| **Compact Mobile (Portrait)** | iPhone SE, Galaxy A-series | `360 x 640` to `375 x 667` | 2.0 - 3.0x | Board sizing, compact score bar, tap target overlap prevention. |
| **Standard Mobile (Portrait)** | iPhone 15/16 Pro, Galaxy S24, Pixel 9 | `390 x 844` to `412 x 915` | 3.0x | Safe area insets (dynamic island, home bar), floating action ergonomics. |
| **Mobile (Landscape)** | Mobile phones turned sideways | `640 x 360` to `915 x 412` | 2.0 - 3.0x | Split layout: Board on left, controls and scorecards on right. |
| **Foldables** | Galaxy Z Fold (Cover / Unfolded) | `280 x 653` (folded) / `884 x 1104` (open) | 2.5 - 3.0x | Narrow column layout on cover screen; dual-pane expanded layout unfolded. |
| **Tablets (Portrait)** | iPad 10th Gen, iPad Air, Galaxy Tab | `768 x 1024` to `820 x 1180` | 2.0x | Centered board with spacious side margins and enlarged 3D brass dice. |
| **Tablets (Landscape)** | iPad Pro 11"/12.9", Pixel Tablet | `1024 x 768` to `1366 x 1024` | 2.0x | Two-column balanced layout with persistent audit log drawer. |
| **Laptops / Ultrabooks** | 13" - 15" Laptops, Chromebooks | `1366 x 768`, `1440 x 900` | 1.0 - 2.0x | Compact vertical height; header and controls cannot push board below fold. |
| **Desktop Displays** | 24" - 27" 1080p / 1440p / 4K | `1920 x 1080`, `2560 x 1440` | 1.0 - 1.5x | Max container width constraint (`1200px`), preventing excessive eye travel. |
| **Ultrawide Monitors** | 34" - 49" Displays | `3440 x 1440`, `5120 x 1440` | 1.0x | Main game surface remains anchored centrally with atmospheric Indian textile borders. |

---

## 3. Solo Mode vs Computer Layout Specifications

### Mobile Portrait Layout (`< 600px` width)
```
+-----------------------------------+
|  [Logo / Title]    [🔊] [⚙️] [❓] |
+-----------------------------------+
|  [Turn Status: Your Turn / Roll]  |
+-----------------------------------+
|      [7x7 SYMMETRIC BOARD]        |
|      (aspect-ratio: 1 / 1)        |
|      (max-width: 92vw)            |
+-----------------------------------+
|  [3D Brass Dice Rolling Tray]     |
|  [ROLL DICE / PASS BUTTON]        |
+-----------------------------------+
|  Player Card (You) | Computer (AI)|
+-----------------------------------+
```

### Mobile Landscape & Tablet Split Layout (`landscape` and `height < 600px`)
```
+--------------------------+-----------------------------------+
|                          |  [Turn Status: Computer Thinking] |
|                          |  [Opponent Card: Kavitha (AI)]    |
|   [7x7 SYMMETRIC BOARD]  +-----------------------------------+
|   (aspect-ratio: 1 / 1)  |  [3D Brass Dice Tray]             |
|   (height: 88vh)         |  [Primary Action Button]          |
|                          +-----------------------------------+
|                          |  [Player Card: You (Aarav)]       |
|                          |  [Controls: 🔊 ⚙️ ❓]             |
+--------------------------+-----------------------------------+
```

---

## 4. Audit Checklist & Verification Procedure

### Visual & Layout Checks:
- [ ] **No Page Scrolling during Play**: `window.innerHeight` accommodates board + dice + controls without scrolling.
- [ ] **Zero Horizontal Overflow**: `document.documentElement.scrollWidth === window.innerWidth`.
- [ ] **Safe Area Inset Padding**: `padding: env(safe-area-inset-top)` prevents notch / camera cutout collisions.
- [ ] **Modal Center Alignment**: Help ("How to Play"), Settings, and Victory modals are vertically and horizontally centered with scrollable body if viewport is restricted.

### Interaction & Tap Ergonomics:
- [ ] **Coin Selection**: Tapping a coin on the board or reserve square activates hover/glow and displays legal movement paths.
- [ ] **Dice Roll Hitbox**: Roll button spans comfortable thumb zone on mobile.
- [ ] **Keyboard Interactivity**: Space/R triggers roll, 1–4 selects pieces, M triggers move, Esc dismisses dialogs.
- [ ] **Voice / Gestures**: Camera preview (when gesture tracking enabled) docks in bottom-right corner without obscuring player coins.

### Solo Game Loop Responsiveness:
- [ ] Computer turn delay is paced realistically (between 600ms and 1200ms) with visible "Thinking..." status.
- [ ] Computer coin movement animates square-by-square so human player easily follows tactical moves.
- [ ] Explicit capture feedback flashes subtle red/gold capture splash with avatar notification.

---

## 5. Automated Headless Verification Suite

Integrate automated multi-resolution snapshot and layout tests into `test/frontend_integrity.test.ts`:
- Emulate viewports: `360x640`, `390x844`, `640x360`, `768x1024`, `1024x768`, `1366x768`, `1920x1080`.
- Verify zero console errors, zero layout overflows, and elements within viewable bounding boxes.
