Josh E. Deus — Personal Portfolio
A clean, minimal personal portfolio website built with vanilla HTML, CSS, and JavaScript. Features an animated intro overlay, slide-in content panels, dark/light mode, a custom cursor, and a mouse-trail particle effect.

Project Structure
├── index.html        # Main HTML — layout, panels, and semantic markup
├── style.css         # All styling — layout, themes, animations
├── script.js         # All interactivity — panels, cursor, grain, particles, theme
├── Logo2.png         # Favicon and OG image
└── Deus_Resume.pdf   # Downloadable resume linked in the portfolio

Features
Intro overlay — Splash screen dismissed by click or any keypress
Slide-in panels — Projects, Info, and Contact sections open as overlay panels
Dark / Light mode — Toggle with persistence via localStorage; respects OS preference on first visit
Custom cursor — Replaced on pointer-capable devices; expands on hover
Grain texture — Canvas-drawn radial noise overlay for visual depth
Mouse-trail particles — Grain-burst particle effect that follows the cursor
Keyboard shortcuts — P / I / C to open panels; Esc to close
Hash-based routing — Deep-linkable panels via URL hash (e.g. #contact)
Accessibility — ARIA roles, aria-modal, aria-live, focus management, and screen-reader-only labels
Performance-aware — Adapts grain resolution, particle count, and frame rate based on device memory, CPU cores, and prefers-reduced-motion

Tech Stack
Layer  Technology
MarkupHTML5 (semantic)
StylingCSS3 (custom properties, grid)
ScriptingVanilla JavaScript (ES6+)
FontsGoogle Fonts — DM Serif Display, DM Sans
Graphics  Canvas API (grain + particles)

No frameworks. No build tools. No dependencies.

Deployment
Hosted on GitHub Pages at https://josh12004.github.io.
To run locally, just open index.html in any modern browser — no server or build step needed.
