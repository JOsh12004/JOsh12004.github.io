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
   MOUSE TRAIL — GRAIN PARTICLE BURST
   Skipped entirely under prefers-reduced-motion: the canvas is
   never created, so there is zero runtime cost for those users.
══════════════════════════════ */
(function () {
  // Bail out before creating any DOM or listeners if the user
  // has requested reduced motion at the OS/browser level.
  if (PERF.reducedMotion) return;
  const canvas = document.createElement('canvas');
  const isDarkFn = () => document.documentElement.dataset.theme === 'dark';
  canvas.style.cssText = `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;mix-blend-mode:${isDarkFn() ? 'screen' : 'multiply'};`;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const observer = new MutationObserver(() => {
    canvas.style.mixBlendMode = isDarkFn() ? 'screen' : 'multiply';
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const particles = [];
  let loopRunning = false;
  const LOW_POWER = PERF.lowPower || PERF.saveData;
  const FRAME_MS = LOW_POWER ? 33 : 16;
  let lastFrameTime = 0;

  // Distance gate — only spawn when the cursor has moved at least
  // SPAWN_DIST pixels since the last spawn. This avoids flooding the
  // particle array during slow/hover micro-movements.
  const SPAWN_DIST = LOW_POWER ? 9 : 5;
  const SPAWN_DIST_SQ = SPAWN_DIST * SPAWN_DIST; // compare squared, no sqrt needed
  let lastSpawnX = -999, lastSpawnY = -999;

  function spawnParticles(x, y) {
    if (document.hidden) return;

    const dx = x - lastSpawnX, dy = y - lastSpawnY;
    if (dx * dx + dy * dy < SPAWN_DIST_SQ) return; // cursor barely moved, skip
    lastSpawnX = x; lastSpawnY = y;

    const isDark = isDarkFn();
    const count = LOW_POWER ? 6 : 10;
    for (let i = 0; i < count; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const speed  = Math.random() * (LOW_POWER ? 1.4 : 2.5) + 0.5;
      const size   = Math.random() * (LOW_POWER ? 1.5 : 2.5) + 0.5;
      const life   = Math.random() * (LOW_POWER ? 18 : 30) + (LOW_POWER ? 12 : 20);
      const brightness = isDark
        ? Math.floor(Math.random() * 80 + 140)
        : Math.floor(Math.random() * 60);
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size, life, maxLife: life, brightness });
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
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life--;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      const alpha = (p.life / p.maxLife) * 0.7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.brightness},${p.brightness},${p.brightness},${alpha})`;
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

  window.addEventListener('mousemove', e => spawnParticles(e.clientX, e.clientY));
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
  
  let dismissed = false;

  function removeOverlay() {
    if (!overlay.parentNode) return;
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
  const IGNORE_KEYS = new Set(['Shift','Control','Alt','Meta','CapsLock','Tab','Dead']);
  document.addEventListener('keydown', function onKey(e) {
    if (IGNORE_KEYS.has(e.key)) return;
    document.removeEventListener('keydown', onKey);
    dismiss();
  });
})();

/* ══════════════════════════════
   THEME TOGGLE
══════════════════════════════ */
const html  = document.documentElement;
const track = document.getElementById('toggleTrack');
const label = document.getElementById('themeLabel');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

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

function setTheme(dark) {
  const theme = dark ? 'dark' : 'light';
  html.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  // aria-live on the label will announce the change to screen readers
  label.textContent = dark ? 'Dark' : 'Light';
  // Keep aria-checked in sync so switch semantics are correct
  track.setAttribute('aria-checked', dark ? 'true' : 'false');
  syncThemeColorMeta();
}

// The toggle is now a <button role="switch"> so click, Enter, and
// Space all fire the click event natively — no extra key handling needed
track.addEventListener('click', () => setTheme(html.dataset.theme !== 'dark'));

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

// Keep closed panels fully out of keyboard navigation.
panelEntries.forEach(panel => {
  panel.setAttribute('inert', '');
  panel.setAttribute('aria-hidden', 'true');
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

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // Fall through to legacy copy path below.
    }

    const ta = document.createElement('textarea');
  ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();

    let ok = false;
    try {
      ok = document.execCommand('copy');
    } finally {
      ta.remove();
    }
    return ok;
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
    const emailLinkObserver = new MutationObserver(() => {
      const href = emailLink.getAttribute('href') || '';
      if (href.includes('/cdn-cgi/l/email-protection')) applyEmailLink();
    });
    emailLinkObserver.observe(emailLink, { attributes: true, attributeFilter: ['href'] });
  }

  function bindCopyButton(button, valueAttr, label) {
    if (!button) return;
    button.addEventListener('click', async () => {
      const value = button.dataset[valueAttr] || '';
      const success = await copyText(value);
      button.textContent = success ? 'Copied' : 'Failed';
      button.classList.toggle('copied', success);
      if (status) {
        status.textContent = success
          ? `${label} copied to clipboard.`
          : `Unable to copy ${label.toLowerCase()}.`;
      }
      showToast(success ? `${label} copied` : 'Copy failed');

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