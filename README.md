# Josh E. Deus — Personal Portfolio

A clean, minimal personal portfolio built with vanilla HTML, CSS, and JavaScript — no frameworks, no build tools, no dependencies.

**Live site →** [josh12004.github.io](https://josh12004.github.io)

---

## Project Structure

```
├── index.html          # Layout, panels, and semantic markup
├── style.css           # Styling — layout, themes, animations, custom properties
├── script.js           # Interactivity — panels, cursor, grain, particles, theme
├── Logo2.png           # Favicon and OG image
└── Deus_Resume.pdf     # Downloadable resume linked in the portfolio
```

---

## Features

### Interface
- **Intro overlay** — Splash screen dismissed by click or any keypress
- **Slide-in panels** — Projects, Info, and Contact sections open as overlay panels
- **Dark / Light mode** — Toggles with a wipe animation; preference persisted via `localStorage`; respects OS setting on first visit
- **Custom cursor** — Replaces the default pointer on capable devices; expands on interactive elements
- **Mouse-reactive blob** — Soft radial gradient that gently lerps toward the cursor
- **Grain texture** — Canvas-drawn noise overlay for visual depth

### Behaviour
- **Mouse-trail particles** — Grain-burst effect that follows cursor movement
- **Keyboard shortcuts** — `P` / `I` / `C` to open panels; `Esc` to close
- **Hash-based routing** — Panels are deep-linkable via URL hash (e.g. `#contact`, `#projects`)
- **No-JS fallback** — Contact details and resume remain accessible when JavaScript is disabled

### Accessibility
- ARIA roles, `aria-modal`, and `aria-hidden` throughout
- `aria-live` regions for theme changes and clipboard feedback
- Focus management on panel open/close
- Screen-reader-only labels for icon-only controls

### Performance
- Grain resolution, particle count, and frame rate scale down automatically based on `deviceMemory`, `hardwareConcurrency`, and `navigator.connection.saveData`
- All animations respect `prefers-reduced-motion`
- Google Fonts loaded with `rel="preload"` and a `<noscript>` fallback to avoid render-blocking

---

## Tech Stack

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Markup     | HTML5 (semantic)                              |
| Styling    | CSS3 (custom properties, grid, animations)    |
| Scripting  | Vanilla JavaScript (ES6+)                     |
| Fonts      | Google Fonts — DM Serif Display, DM Sans      |
| Graphics   | Canvas API (grain texture + particle trail)   |

**No frameworks. No build tools. No dependencies.**

---

## Running Locally

No server or build step required. Just open `index.html` in any modern browser:

```bash
git clone https://github.com/JOsh12004/JOsh12004.github.io.git
cd JOsh12004.github.io
open index.html        # macOS
# or just double-click index.html on Windows / Linux
```

---

## Deployment

Hosted on **GitHub Pages**. Any push to the main branch deploys automatically — no CI/CD configuration needed.
