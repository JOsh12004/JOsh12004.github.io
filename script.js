/* ══════════════════════════════
   CUSTOM CURSOR
══════════════════════════════ */
(function () {
  const cursor = document.getElementById('cursor');
  const canUseCustomCursor = window.matchMedia('(pointer: fine) and (hover: hover)').matches;

  if (!cursor || !canUseCustomCursor) {
    if (cursor) cursor.remove();
    return;
  }

  const hoverSelector = 'a, button, .toggle-track, .project-item:not(.project-item-static), .contact-item';

  window.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top  = e.clientY + 'px';
  });

  // Use event delegation so dynamically shown panels are covered
  document.addEventListener('mouseover', e => {
    if (e.target.closest(hoverSelector)) cursor.classList.add('hover');
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(hoverSelector)) cursor.classList.remove('hover');
  });
})();

const PERF = {
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  saveData: !!(navigator.connection && navigator.connection.saveData),
  lowPower:
    !!(navigator.connection && navigator.connection.saveData) ||
    (navigator.deviceMemory || 4) <= 4 ||
    (navigator.hardwareConcurrency || 4) <= 4,
};

/* ══════════════════════════════
   MOUSE-REACTIVE BLOB
   Gently lerps a soft offset toward cursor position.
   Disabled for reduced-motion users.
══════════════════════════════ */
(function () {
  const blob = document.querySelector('.blob');
  if (!blob || PERF.reducedMotion) return;

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let frame = null;
  let maxOffsetX = 0;
  let maxOffsetY = 0;
  const lerp = PERF.lowPower ? 0.14 : 0.09;

  function computeBounds() {
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    maxOffsetX = Math.min(72, vw * (PERF.lowPower ? 0.028 : 0.042));
    maxOffsetY = Math.min(64, vh * (PERF.lowPower ? 0.024 : 0.036));
  }

  function applyOffset() {
    blob.style.setProperty('--blob-offset-x', `${currentX.toFixed(2)}px`);
    blob.style.setProperty('--blob-offset-y', `${currentY.toFixed(2)}px`);
  }

  function step() {
    currentX += (targetX - currentX) * lerp;
    currentY += (targetY - currentY) * lerp;
    applyOffset();

    const isMoving = Math.abs(targetX - currentX) > 0.08 || Math.abs(targetY - currentY) > 0.08;
    if (isMoving) {
      frame = requestAnimationFrame(step);
      return;
    }

    currentX = targetX;
    currentY = targetY;
    applyOffset();
    frame = null;
  }

  function queueStep() {
    if (frame !== null || document.hidden) return;
    frame = requestAnimationFrame(step);
  }

  function onMouseMove(e) {
    const nx = (e.clientX / window.innerWidth) - 0.5;
    const ny = (e.clientY / window.innerHeight) - 0.5;
    targetX = nx * maxOffsetX * 2;
    targetY = ny * maxOffsetY * 2;
    queueStep();
  }

  function recenter() {
    targetX = 0;
    targetY = 0;
    queueStep();
  }

  computeBounds();
  applyOffset();

  window.addEventListener('resize', computeBounds);
  window.addEventListener('mousemove', onMouseMove, { passive: true });
  document.addEventListener('mouseout', e => {
    if (e.relatedTarget) return;
    recenter();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    queueStep();
  });
})();

/* ══════════════════════════════
   GRAIN TEXTURE
   Drawn once at a fixed resolution and never redrawn.
   CSS stretches the canvas to fill the viewport — imperceptible
   on noise, but avoids an O(w×h) pixel loop on every resize.
══════════════════════════════ */
(function () {
  const canvas = document.getElementById('grain');
  const ctx = canvas.getContext('2d');

  // Adaptive internal resolution keeps effect quality while reducing
  // startup cost on low-end devices or data-saving mode.
  const W = PERF.lowPower ? 900 : 1280;
  const H = PERF.lowPower ? 560 : 800;
  canvas.width  = W;
  canvas.height = H;

  function drawGrain() {
    const imageData = ctx.createImageData(W, H);
    const buf = imageData.data;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);

    for (let i = 0; i < buf.length; i += 4) {
      const px = (i / 4) % W;
      const py = Math.floor((i / 4) / W);
      const dist   = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) / maxR;
      const weight = Math.max(0, 1 - dist * 1.3);
      const v = Math.random() < weight * 0.6 ? Math.floor(Math.random() * 60) : 255;
      buf[i] = buf[i + 1] = buf[i + 2] = v;
      buf[i + 3] = Math.floor(weight * 180 * Math.random());
    }
    ctx.putImageData(imageData, 0, 0);
  }

  // Defer so grain never blocks the first paint
  (window.requestIdleCallback || window.requestAnimationFrame)(() => drawGrain());
  // No resize listener needed — CSS handles stretching the canvas.
})();

/* ══════════════════════════════
   INTRO GRAIN DUST
   70 particles drift across the intro overlay. Colors adapt to
   the current theme so they're always visible. Fades out over
   ~600ms on dismiss, then the canvas removes itself.
   Skipped under prefers-reduced-motion.
══════════════════════════════ */
(function () {
  if (PERF.reducedMotion) return;

  const COUNT = PERF.lowPower ? 45 : 120;

  // Light mode: dark-ish muted tones against #f0ede8
  // Dark mode:  warm off-whites against #0e0d0c
  const PALETTE_LIGHT = [
    [100, 95,  88],
    [120, 115, 108],
    [80,  76,  70],
    [140, 133, 124],
    [90,  86,  80],
    [110, 105, 98],
  ];
  const PALETTE_DARK = [
    [230, 225, 215],
    [210, 205, 195],
    [190, 185, 175],
    [245, 240, 230],
    [200, 196, 188],
    [255, 250, 240],
  ];

  const isDark = () => document.documentElement.dataset.theme === 'dark';

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  // z-index 101 — one above the intro overlay (z-index 100)
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:101;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function makeParticle(spreadY) {
    const palette = isDark() ? PALETTE_DARK : PALETTE_LIGHT;
    const col = palette[Math.floor(Math.random() * palette.length)];
    return {
      x:      Math.random() * W,
      y:      spreadY ? Math.random() * H : -4,
      vy:     (0.12 + Math.random() * 0.10) * 0.67,
      wobAmp: (0.3  + Math.random() * 0.7) * (Math.random() < 0.5 ? 1 : -1),
      wobSpd: 0.008 + Math.random() * 0.012,
      wobT:   Math.random() * Math.PI * 2,
      twkSpd: PERF.lowPower ? 0 : (0.012 + Math.random() * 0.018),
      twkT:   Math.random() * Math.PI * 2,
      r:      0.4 + Math.random() * 1.0,
      alpha:  0.18 + Math.random() * 0.55,
      col,
    };
  }

  const particles = Array.from({ length: COUNT }, () => makeParticle(true));

  let fadingOut = false;
  let fadeStart = 0;
  const FADE_MS = 600;

  function tick(ts) {
    ctx.clearRect(0, 0, W, H);

    let globalFade = 1;
    if (fadingOut) {
      globalFade = Math.max(0, 1 - (ts - fadeStart) / FADE_MS);
      if (globalFade <= 0) {
        canvas.remove();
        return;
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      p.wobT += p.wobSpd;
      p.twkT += p.twkSpd;
      p.x    += Math.sin(p.wobT) * p.wobAmp * 0.4;
      p.y    += p.vy;

      if (p.y > H + 4) { particles[i] = makeParticle(false); continue; }
      if (p.x < -4)      p.x = W + 4;
      if (p.x > W + 4)   p.x = -4;

      const twinkle = p.twkSpd > 0 ? Math.sin(p.twkT) * 0.08 : 0;
      const a       = Math.max(0, (p.alpha + twinkle) * globalFade);

      ctx.globalAlpha = a;
      ctx.fillStyle   = `rgb(${p.col[0]},${p.col[1]},${p.col[2]})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  document.addEventListener('intro-dismissed', () => {
    fadingOut = true;
    fadeStart = performance.now();
  }, { once: true });
})();

/* ══════════════════════════════
  MOUSE TRAIL — GRAIN DUST
  Tiny warm-toned particles spawn along cursor movement,
  then drift and gently scatter before fading out.
══════════════════════════════ */
(function () {
  if (PERF.reducedMotion) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.tabIndex = -1;

  const isDarkFn = () => document.documentElement.dataset.theme === 'dark';
  canvas.style.cssText = `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;mix-blend-mode:${isDarkFn() ? 'screen' : 'multiply'};`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const observer = new MutationObserver(() => {
    canvas.style.mixBlendMode = isDarkFn() ? 'screen' : 'multiply';
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const particles = [];
  let loopRunning = false;
  const LOW_POWER = PERF.lowPower || PERF.saveData;
  const FRAME_MS = LOW_POWER ? 33 : 16;
  const MAX_PARTICLES = LOW_POWER ? 140 : 280;
  const SPAWN_DIST = LOW_POWER ? 8 : 5;
  const SPAWN_DIST_SQ = SPAWN_DIST * SPAWN_DIST;
  const SPAWN_INTERVAL = LOW_POWER ? 30 : 14;

  let lastFrameTime = 0;
  let lastSpawnTime = 0;
  let lastSpawnX = -999;
  let lastSpawnY = -999;

  function spawnDust(x, y, timestamp) {
    if (document.hidden) return;

    const dx = x - lastSpawnX;
    const dy = y - lastSpawnY;
    const movedEnough = dx * dx + dy * dy >= SPAWN_DIST_SQ;
    const waitedEnough = (timestamp - lastSpawnTime) >= SPAWN_INTERVAL;
    if (!movedEnough || !waitedEnough) return;

    lastSpawnX = x;
    lastSpawnY = y;
    lastSpawnTime = timestamp;

    const count = LOW_POWER ? 4 : 7;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (LOW_POWER ? 0.7 : 1.15) + 0.16;
      const maxLife = Math.random() * (LOW_POWER ? 30 : 42) + (LOW_POWER ? 26 : 34);

      // Rich amber-gold palette with slight copper variation.
      const r = Math.floor(Math.random() * 48 + 198);
      const g = Math.floor(Math.random() * 56 + 146);
      const b = Math.floor(Math.random() * 34 + 68);

      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        driftX: (Math.random() - 0.5) * (LOW_POWER ? 0.06 : 0.1),
        driftY: (Math.random() - 0.5) * (LOW_POWER ? 0.05 : 0.08),
        size: Math.random() * (LOW_POWER ? 0.75 : 1.1) + 0.45,
        life: maxLife,
        maxLife,
        r,
        g,
        b,
      });
    }

    if (particles.length > MAX_PARTICLES) {
      particles.splice(0, particles.length - MAX_PARTICLES);
    }

    if (!loopRunning) {
      loopRunning = true;
      requestAnimationFrame(loop);
    }
  }

  function loop(timestamp) {
    if (document.hidden) {
      loopRunning = false;
      return;
    }

    if (timestamp - lastFrameTime < FRAME_MS) {
      requestAnimationFrame(loop);
      return;
    }
    lastFrameTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= 1;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      // Drift + soft scatter so dust feels alive but subtle.
      p.vx += p.driftX * 0.04;
      p.vy += p.driftY * 0.04;
      p.vx *= 0.978;
      p.vy *= 0.982;
      p.x += p.vx + (Math.random() - 0.5) * 0.08;
      p.y += p.vy + (Math.random() - 0.5) * 0.08;

      const lifeRatio = p.life / p.maxLife;
      const alpha = lifeRatio * (LOW_POWER ? 0.58 : 0.7);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
      ctx.fill();
    }

    if (particles.length > 0) {
      requestAnimationFrame(loop);
    } else {
      loopRunning = false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    particles.length = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    loopRunning = false;
  });

  window.addEventListener('mousemove', e => {
    spawnDust(e.clientX, e.clientY, performance.now());
  }, { passive: true });
})();

/* ══════════════════════════════
   INTRO OVERLAY
   Waits for an explicit interaction (click anywhere or any
   non-modifier keypress) before fading out and removing itself.
   Under prefers-reduced-motion the transition is shortened in CSS,
   but the interaction requirement is the same.
══════════════════════════════ */
(function () {
  const overlay = document.getElementById('introOverlay');
  if (!overlay) return; // Guard: overlay not found, exit gracefully

  const introLockTargets = [
    document.querySelector('.sidebar'),
    document.querySelector('.main'),
  ].filter(Boolean);
  const introLockState = new Map();

  function setIntroBackgroundLocked(locked) {
    introLockTargets.forEach(el => {
      if (locked) {
        if (!introLockState.has(el)) {
          introLockState.set(el, {
            inert: el.hasAttribute('inert'),
            ariaHidden: el.getAttribute('aria-hidden'),
          });
        }
        el.setAttribute('inert', '');
        el.setAttribute('aria-hidden', 'true');
        return;
      }

      const prev = introLockState.get(el);
      if (!prev) return;
      if (!prev.inert) el.removeAttribute('inert');
      if (prev.ariaHidden === null) {
        el.removeAttribute('aria-hidden');
      } else {
        el.setAttribute('aria-hidden', prev.ariaHidden);
      }
      introLockState.delete(el);
    });
  }

  setIntroBackgroundLocked(true);
  overlay.focus();
  
  let dismissed = false;

  function removeOverlay() {
    if (!overlay.parentNode) return;
    setIntroBackgroundLocked(false);
    overlay.remove();
    document.dispatchEvent(new CustomEvent('intro-dismissed'));
  }

  function dismiss() {
    if (dismissed) return;
    dismissed = true;

    // Reduced-motion: skip transition, remove immediately
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      removeOverlay();
      return;
    }

    overlay.classList.add('dismissed');
    // Use setTimeout fallback in case transitionend doesn't fire
    const transitionHandler = () => removeOverlay();
    overlay.addEventListener('transitionend', transitionHandler, { once: true });
    setTimeout(() => {
      removeOverlay();
    }, 650); // slightly longer than transition duration (0.6s + margin)
  }

  overlay.addEventListener('click', dismiss);

  // Any meaningful key dismisses — ignore bare modifier keys
  const IGNORE_KEYS = new Set(['Shift','Control','Alt','Meta','CapsLock','Dead']);
  document.addEventListener('keydown', function onKey(e) {
    if (!overlay.parentNode) {
      document.removeEventListener('keydown', onKey);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      overlay.focus();
    }

    if (IGNORE_KEYS.has(e.key)) return;
    document.removeEventListener('keydown', onKey);
    dismiss();
  });
})();

/* ══════════════════════════════
   PROJECT CARD REVEAL ON SCROLL
   Cards reveal as they enter the viewport of the projects panel.
══════════════════════════════ */
(function () {
  const projectsPanel = document.getElementById('panel-projects');
  const projectItems = Array.from(document.querySelectorAll('#panel-projects .project-item'));
  if (!projectsPanel || projectItems.length === 0) return;

  projectItems.forEach((item, index) => {
    item.classList.add('reveal-ready');
    item.style.setProperty('--reveal-delay', `${Math.min(index * 36, 180)}ms`);
  });

  if (PERF.reducedMotion || typeof IntersectionObserver === 'undefined') {
    projectItems.forEach(item => item.classList.add('revealed'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('revealed');
      observer.unobserve(entry.target);
    });
  }, {
    root: projectsPanel,
    threshold: 0.2,
    rootMargin: '0px 0px -10% 0px',
  });

  projectItems.forEach(item => observer.observe(item));
})();

/* ══════════════════════════════
   MAGNETIC BUTTONS
   Subtle attraction effect for interactive controls.
══════════════════════════════ */
(function () {
  const canHover = window.matchMedia('(pointer: fine) and (hover: hover)').matches;
  if (!canHover || PERF.reducedMotion) return;

  const magneticTargets = document.querySelectorAll(
    '.nav-link, .panel-close, .toggle-track, .bio-cta, .copy-email-btn, .panel-back-to-top'
  );
  if (!magneticTargets.length) return;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  magneticTargets.forEach(target => {
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let frame = null;
    target.classList.add('magnetic-target');

    function applyTranslate() {
      target.style.setProperty('--magnetic-x', `${currentX.toFixed(2)}px`);
      target.style.setProperty('--magnetic-y', `${currentY.toFixed(2)}px`);
    }

    function animate() {
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      applyTranslate();

      const moving = Math.abs(targetX - currentX) > 0.08 || Math.abs(targetY - currentY) > 0.08;
      if (!moving) {
        currentX = targetX;
        currentY = targetY;
        applyTranslate();
        frame = null;
        return;
      }

      frame = requestAnimationFrame(animate);
    }

    function queueAnimate() {
      if (frame !== null || document.hidden) return;
      frame = requestAnimationFrame(animate);
    }

    function reset() {
      targetX = 0;
      targetY = 0;
      queueAnimate();
    }

    target.addEventListener('pointermove', e => {
      const rect = target.getBoundingClientRect();
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);

      targetX = clamp(relX * 0.22, -10, 10);
      targetY = clamp(relY * 0.22, -10, 10);
      queueAnimate();
    });

    target.addEventListener('pointerleave', reset);
    target.addEventListener('pointercancel', reset);
    target.addEventListener('blur', reset);
  });
})();

/* ══════════════════════════════
   THEME TOGGLE
══════════════════════════════ */
const html  = document.documentElement;
const track = document.getElementById('toggleTrack');
const label = document.getElementById('themeLabel');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const themeWipe = document.getElementById('themeWipe');
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
const THEME_WIPE_DURATION_MS = 760;
const THEME_WIPE_SWITCH_MS = 300;
let themeWipeSwitchTimer = null;
let themeWipeCleanupTimer = null;

function hasStoredThemePreference() {
  return localStorage.getItem('theme') !== null;
}

// Sync label AND aria-checked with whatever theme is currently active
// (may have been set by saved preference OR prefers-color-scheme fallback)
function syncToggleState() {
  const isDark = html.dataset.theme === 'dark';
  label.textContent = isDark ? 'Dark' : 'Light';
  track.setAttribute('aria-checked', isDark ? 'true' : 'false');
}

function syncThemeColorMeta() {
  if (!themeColorMeta) return;
  themeColorMeta.setAttribute('content', html.dataset.theme === 'dark' ? '#0e0d0c' : '#f0ede8');
}

syncToggleState();
syncThemeColorMeta();

// After all intro animations finish, freeze animated elements so
// they don't replay when the theme attribute changes
window.addEventListener('load', () => {
  setTimeout(() => {
    document.querySelectorAll(
      '.sidebar-name, .sidebar-subtitle, .sidebar-divider, .sidebar-bottom, .nav-link, .bio'
    ).forEach(el => {
      el.style.animation = 'none';
      el.style.opacity   = '1';
      el.style.transform = 'none';
    });
  }, 1200); // slightly after longest animation delay (0.78s + 0.8s duration)
});

function applyThemeState(dark) {
  const theme = dark ? 'dark' : 'light';
  html.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  // aria-live on the label will announce the change to screen readers
  label.textContent = dark ? 'Dark' : 'Light';
  // Keep aria-checked in sync so switch semantics are correct
  track.setAttribute('aria-checked', dark ? 'true' : 'false');
  syncThemeColorMeta();
}

function setTheme(dark, options = {}) {
  const { animated = false } = options;
  const targetTheme = dark ? 'dark' : 'light';

  if (html.dataset.theme === targetTheme && !(themeWipe && themeWipe.classList.contains('active'))) {
    applyThemeState(dark);
    return;
  }

  if (!animated || !themeWipe || PERF.reducedMotion) {
    applyThemeState(dark);
    return;
  }

  if (themeWipeSwitchTimer) {
    clearTimeout(themeWipeSwitchTimer);
    themeWipeSwitchTimer = null;
  }
  if (themeWipeCleanupTimer) {
    clearTimeout(themeWipeCleanupTimer);
    themeWipeCleanupTimer = null;
  }

  themeWipe.style.setProperty('--wipe-color', dark ? '#0e0d0c' : '#f0ede8');
  themeWipe.classList.remove('active');
  void themeWipe.offsetWidth;
  themeWipe.classList.add('active');

  themeWipeSwitchTimer = setTimeout(() => {
    applyThemeState(dark);
    themeWipeSwitchTimer = null;
  }, THEME_WIPE_SWITCH_MS);

  themeWipeCleanupTimer = setTimeout(() => {
    themeWipe.classList.remove('active');
    themeWipeCleanupTimer = null;
  }, THEME_WIPE_DURATION_MS);
}

// The toggle is now a <button role="switch"> so click, Enter, and
// Space all fire the click event natively — no extra key handling needed
track.addEventListener('click', () => setTheme(html.dataset.theme !== 'dark', { animated: true }));

function syncThemeFromSystem(event) {
  if (hasStoredThemePreference()) {
    syncToggleState();
    syncThemeColorMeta();
    return;
  }

  html.setAttribute('data-theme', event.matches ? 'dark' : 'light');
  syncToggleState();
  syncThemeColorMeta();
}

if (typeof systemThemeQuery.addEventListener === 'function') {
  systemThemeQuery.addEventListener('change', syncThemeFromSystem);
} else if (typeof systemThemeQuery.addListener === 'function') {
  systemThemeQuery.addListener(syncThemeFromSystem);
}

/* ══════════════════════════════
   PANEL SYSTEM
   — Buttons replace anchors, so no href="#" history pollution.
   — aria-expanded on the trigger reflects open/closed state.
   — aria-hidden on the panel hides it from the accessibility tree
     when closed, so inactive panel content is never reachable by
     keyboard or screen reader.
   — Focus trap keeps Tab/Shift-Tab inside the open panel.
   — Focus is restored to the trigger button when the panel closes.
══════════════════════════════ */
const panels = {
  projects: document.getElementById('panel-projects'),
  info:     document.getElementById('panel-info'),
  contact:  document.getElementById('panel-contact'),
};

const navLinks = {
  projects: document.getElementById('link-projects'),
  info:     document.getElementById('link-info'),
  contact:  document.getElementById('link-contact'),
};
const panelEntries = Object.values(panels);
const PANEL_HASH = {
  projects: '#projects',
  info: '#info',
  contact: '#contact',
};
const HASH_TO_PANEL = {
  projects: 'projects',
  info: 'info',
  contact: 'contact',
  'panel-projects': 'projects',
  'panel-info': 'info',
  'panel-contact': 'contact',
};
const PANEL_TITLES = {
  projects: 'Projects',
  info: 'Info',
  contact: 'Contact',
};
const BASE_DOCUMENT_TITLE = document.title;
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isFocusableVisible(el) {
  if (!el) return false;
  if (el.hidden) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
}

function getPanelFocusableElements(panel) {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isFocusableVisible);
}

// Keep closed panels fully out of keyboard navigation.
panelEntries.forEach(panel => {
  panel.setAttribute('inert', '');
  panel.setAttribute('aria-hidden', 'true');
  panel.tabIndex = -1;
});

const backgroundRegions = [
  // Keep sidebar interactive so users can switch panels directly.
  document.querySelector('.main'),
];

let current = null;
let pendingPanelFromHash = null;
const panelBackToTop = document.getElementById('panelBackToTop');

function syncDocumentTitle(name) {
  if (!name || !PANEL_TITLES[name]) {
    document.title = BASE_DOCUMENT_TITLE;
    return;
  }
  document.title = `${PANEL_TITLES[name]} | Josh E. Deus`;
}

function updateBackToTopVisibility() {
  if (!panelBackToTop) return;

  const activePanel = current ? panels[current] : null;
  const visible = !!(activePanel && activePanel.scrollTop > 200);

  if (!visible && document.activeElement === panelBackToTop) {
    panelBackToTop.blur();
  }

  panelBackToTop.classList.toggle('visible', visible);
  panelBackToTop.tabIndex = visible ? 0 : -1;
}

function isIntroActive() {
  return !!document.getElementById('introOverlay');
}

function updatePanelScrollHint(panel) {
  if (!panel) return;
  const overflowAmount = panel.scrollHeight - panel.clientHeight;
  const hasOverflow = overflowAmount > 72;
  const nearBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 4;
  panel.classList.toggle('panel-scroll-hint', hasOverflow && !nearBottom);
}

function setPanelHash(name) {
  const baseUrl = `${window.location.pathname}${window.location.search}`;
  if (!name) {
    if (window.location.hash) history.replaceState(null, '', baseUrl);
    return;
  }

  const hash = PANEL_HASH[name];
  if (hash && window.location.hash !== hash) {
    history.replaceState(null, '', `${baseUrl}${hash}`);
  }
}

function getPanelFromHash(hash = window.location.hash) {
  const key = hash.replace(/^#/, '').toLowerCase();
  return HASH_TO_PANEL[key] || null;
}

function setBackgroundInert(disabled) {
  // Non-modal drawer behavior: keep background content interactive.
  if (disabled) return;
  backgroundRegions.forEach(region => {
    if (!region) return;
    region.removeAttribute('inert');
    region.removeAttribute('aria-hidden');
    region.classList.remove('panel-lock');
  });
}

function setNavCurrent(name) {
  Object.keys(navLinks).forEach(key => {
    if (key === name) {
      navLinks[key].setAttribute('aria-current', 'page');
      return;
    }
    navLinks[key].removeAttribute('aria-current');
  });
}

function openPanel(name, options = {}) {
  const { syncHash = true, forceOpen = false } = options;

  // Close currently open panel if switching to a different one
  if (current && current !== name) {
    panels[current].classList.remove('active');
    panels[current].classList.remove('panel-scroll-hint');
    panels[current].setAttribute('aria-hidden', 'true');
    panels[current].setAttribute('inert', '');
    navLinks[current].classList.remove('active');
    navLinks[current].setAttribute('aria-expanded', 'false');
  }

  // Toggle the same panel closed
  if (current === name && !forceOpen) {
    panels[name].classList.remove('active');
    panels[name].classList.remove('panel-scroll-hint');
    panels[name].setAttribute('aria-hidden', 'true');
    panels[name].setAttribute('inert', '');
    navLinks[name].classList.remove('active');
    navLinks[name].setAttribute('aria-expanded', 'false');
    setNavCurrent(null);
    setBackgroundInert(false);
    current = null;
    syncDocumentTitle(null);
    updateBackToTopVisibility();
    if (syncHash) setPanelHash(null);
    return;
  }

  // Open new panel
  panels[name].classList.add('active');
  panels[name].setAttribute('aria-hidden', 'false');
  panels[name].removeAttribute('inert');
  navLinks[name].classList.add('active');
  navLinks[name].setAttribute('aria-expanded', 'true');
  setNavCurrent(name);
  current = name;
  setBackgroundInert(true);
  syncDocumentTitle(name);

  requestAnimationFrame(() => {
    updatePanelScrollHint(panels[name]);
    updateBackToTopVisibility();

    // Move keyboard focus into the panel when it opens.
    if (!panels[name].contains(document.activeElement)) {
      const focusables = getPanelFocusableElements(panels[name]);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panels[name].focus();
      }
    }

    // Recheck after the open transition settles to avoid stale dimensions.
    setTimeout(() => {
      updatePanelScrollHint(panels[name]);
      updateBackToTopVisibility();
    }, 220);
  });
  if (syncHash) setPanelHash(name);
}

function closeAll(options = {}) {
  const { syncHash = true, restoreFocus = true } = options;
  const returning = current ? navLinks[current] : null;

  Object.keys(panels).forEach(k => {
    panels[k].classList.remove('active');
    panels[k].classList.remove('panel-scroll-hint');
    panels[k].setAttribute('aria-hidden', 'true');
    panels[k].setAttribute('inert', '');
    navLinks[k].classList.remove('active');
    navLinks[k].setAttribute('aria-expanded', 'false');
    navLinks[k].removeAttribute('aria-current');
  });

  setBackgroundInert(false);
  current = null;
  syncDocumentTitle(null);
  updateBackToTopVisibility();
  if (syncHash) setPanelHash(null);

  // Return focus to whichever nav button opened the panel
  if (restoreFocus && returning) returning.focus();
}

// Mobile gestures: swipe down (from top) or swipe left to close panel.
(function () {
  const mobilePanelQuery = window.matchMedia('(max-width: 920px)');
  let activeGesture = null;

  function resetGesture() {
    activeGesture = null;
  }

  function onTouchStart(panel, event) {
    if (!mobilePanelQuery.matches || !current || panels[current] !== panel) return;
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    activeGesture = {
      panel,
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: performance.now(),
      startScrollTop: panel.scrollTop,
    };
  }

  function onTouchEnd(panel, event) {
    if (!activeGesture || activeGesture.panel !== panel) return;
    if (!mobilePanelQuery.matches || !current || panels[current] !== panel) {
      resetGesture();
      return;
    }
    if (event.changedTouches.length === 0) {
      resetGesture();
      return;
    }

    const touch = event.changedTouches[0];
    const dx = touch.clientX - activeGesture.startX;
    const dy = touch.clientY - activeGesture.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const elapsed = performance.now() - activeGesture.startTime;

    const startedAtTop = activeGesture.startScrollTop <= 2;
    const stillAtTop = panel.scrollTop <= 2;
    const swipeDown = startedAtTop && stillAtTop && dy > 90 && absY > absX * 1.2;
    const flickDown = startedAtTop && stillAtTop && dy > 52 && elapsed < 260 && absY > absX;
    const swipeLeft = dx < -90 && absX > absY * 1.2;
    const flickLeft = dx < -52 && elapsed < 260 && absX > absY;

    resetGesture();
    if (swipeDown || flickDown || swipeLeft || flickLeft) {
      closeAll();
    }
  }

  panelEntries.forEach(panel => {
    panel.addEventListener('touchstart', e => onTouchStart(panel, e), { passive: true });
    panel.addEventListener('touchend', e => onTouchEnd(panel, e), { passive: true });
    panel.addEventListener('touchcancel', resetGesture, { passive: true });
  });
})();

function syncPanelWithHash() {
  const panelFromHash = getPanelFromHash();
  if (!panelFromHash) {
    pendingPanelFromHash = null;
    if (current) closeAll({ syncHash: false, restoreFocus: false });
    return;
  }

  if (isIntroActive()) {
    pendingPanelFromHash = panelFromHash;
    return;
  }

  if (current !== panelFromHash) {
    pendingPanelFromHash = null;
    openPanel(panelFromHash, { syncHash: false, forceOpen: true });
  }
}

// Nav button click handlers (buttons — no e.preventDefault() needed)
Object.keys(navLinks).forEach(name => {
  navLinks[name].addEventListener('click', () => openPanel(name));
});

const bio = document.querySelector('.bio');
document.querySelectorAll('.bio-cta[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const targetPanel = getPanelFromHash(link.getAttribute('href') || '');
    if (!targetPanel) return;

    e.preventDefault();
    if (isIntroActive()) {
      setPanelHash(targetPanel);
      return;
    }

    if (bio) bio.classList.add('panel-intent');
    setTimeout(() => {
      if (bio) bio.classList.remove('panel-intent');
      openPanel(targetPanel, { forceOpen: true });
    }, 110);
  });
});

// Resume CTA feedback: show a brief opening state while the new tab starts loading.
(function () {
  const resumeCta = document.getElementById('resumeCta');
  if (!resumeCta) return;

  let resetTimer = null;
  const defaultLabel = resumeCta.textContent;

  resumeCta.addEventListener('click', () => {
    resumeCta.classList.add('is-opening');
    resumeCta.setAttribute('aria-busy', 'true');
    resumeCta.textContent = 'Opening...';

    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      resumeCta.classList.remove('is-opening');
      resumeCta.setAttribute('aria-busy', 'false');
      resumeCta.textContent = defaultLabel;
      resetTimer = null;
    }, 2200);
  });
})();

panelEntries.forEach(panel => {
  panel.addEventListener('scroll', () => {
    updatePanelScrollHint(panel);
    updateBackToTopVisibility();
  }, { passive: true });
});

window.addEventListener('resize', () => {
  panelEntries.forEach(updatePanelScrollHint);
  updateBackToTopVisibility();
});

window.addEventListener('hashchange', syncPanelWithHash);

document.addEventListener('intro-dismissed', () => {
  if (!pendingPanelFromHash) {
    syncPanelWithHash();
    return;
  }
  openPanel(pendingPanelFromHash, { syncHash: false, forceOpen: true });
  pendingPanelFromHash = null;
});

// Close button handlers
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', closeAll);
});

if (panelBackToTop) {
  panelBackToTop.addEventListener('click', () => {
    if (!current) return;
    const panel = panels[current];
    if (!panel) return;
    panel.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ESC key to close panels
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && current) closeAll();
});

// Focus trap: keep Tab/Shift+Tab inside the active panel.
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || !current) return;

  const panel = panels[current];
  if (!panel || panel.getAttribute('aria-hidden') === 'true') return;

  const focusables = getPanelFocusableElements(panel);
  if (focusables.length === 0) {
    e.preventDefault();
    panel.focus();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  const activeInsidePanel = panel.contains(active);

  if (e.shiftKey) {
    if (!activeInsidePanel || active === first) {
      e.preventDefault();
      last.focus();
    }
    return;
  }

  if (!activeInsidePanel || active === last) {
    e.preventDefault();
    first.focus();
  }
});

// Keyboard shortcuts: P = Projects, I = Info, C = Contact.
document.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.repeat) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const key = e.key.toLowerCase();
  const keyToPanel = {
    p: 'projects',
    i: 'info',
    c: 'contact',
  };
  const panel = keyToPanel[key];
  if (!panel) return;

  const active = document.activeElement;
  const tag = active ? active.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (active && active.isContentEditable)) return;
  if (document.getElementById('introOverlay')) return;

  openPanel(panel, { forceOpen: true });
});

syncPanelWithHash();

/* ══════════════════════════════
   CONTACT: COPY EMAIL
══════════════════════════════ */
(function () {
  const copyEmailBtn = document.getElementById('copyEmailBtn');
  const copyPhoneBtn = document.getElementById('copyPhoneBtn');
  const emailLink = document.getElementById('emailLink');
  const status = document.getElementById('copyContactStatus');
  let toast = document.getElementById('copyToast');
  if (!copyEmailBtn && !copyPhoneBtn) return;

  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.id = 'copyToast';
    toast.setAttribute('aria-hidden', 'true');
    document.body.appendChild(toast);
  }

  let toastTimer = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 1400);
  }

  async function copyText(value) {
    if (!value) return false;

    if (!(navigator.clipboard && window.isSecureContext)) return false;

    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  function getEmailAddress() {
    const user = (emailLink && emailLink.dataset.user) || (copyEmailBtn && copyEmailBtn.dataset.user) || '';
    const domain = (emailLink && emailLink.dataset.domain) || (copyEmailBtn && copyEmailBtn.dataset.domain) || '';
    if (!user || !domain) return '';
    return `${user}@${domain}`;
  }

  function applyEmailLink() {
    const email = getEmailAddress();
    if (!email) return;

    if (emailLink) {
      emailLink.textContent = email;
      emailLink.setAttribute('href', `mailto:${email}`);
    }
    if (copyEmailBtn) {
      copyEmailBtn.dataset.email = email;
    }
  }

  applyEmailLink();

  if (emailLink) {
    let emailLinkObserver = null;

    const maybeDisconnectEmailObserver = () => {
      if (!emailLinkObserver) return;
      const href = emailLink.getAttribute('href') || '';
      if (href.startsWith('mailto:')) {
        emailLinkObserver.disconnect();
        emailLinkObserver = null;
      }
    };

    const href = emailLink.getAttribute('href') || '';
    if (!href.startsWith('mailto:')) {
      emailLinkObserver = new MutationObserver(() => {
        const nextHref = emailLink.getAttribute('href') || '';
        if (nextHref.includes('/cdn-cgi/l/email-protection')) applyEmailLink();
        maybeDisconnectEmailObserver();
      });
      emailLinkObserver.observe(emailLink, { attributes: true, attributeFilter: ['href'] });
      maybeDisconnectEmailObserver();
    }
  }

  function bindCopyButton(button, valueAttr, label) {
    if (!button) return;
    button.addEventListener('click', async () => {
      const value = button.dataset[valueAttr] || '';
      const success = await copyText(value);
      const clipboardSupported = !!(navigator.clipboard && window.isSecureContext);
      button.textContent = success ? 'Copied' : (clipboardSupported ? 'Failed' : 'Manual');
      button.classList.toggle('copied', success);
      if (status) {
        status.textContent = success
          ? `${label} copied to clipboard.`
          : (clipboardSupported
            ? `Unable to copy ${label.toLowerCase()}.`
            : `Clipboard API unavailable. Copy ${label.toLowerCase()} manually.`);
      }
      showToast(success ? `${label} copied` : (clipboardSupported ? 'Copy failed' : 'Copy manually'));

      setTimeout(() => {
        button.textContent = 'Copy';
        button.classList.remove('copied');
        if (status) status.textContent = '';
      }, 1400);
    });
  }

  bindCopyButton(copyEmailBtn, 'email', 'Email');
  bindCopyButton(copyPhoneBtn, 'phone', 'Phone number');
})();