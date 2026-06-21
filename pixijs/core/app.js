import { Application, Text as PixiText } from 'pixi.js';

export const app = new Application();

// Oversample all Text instances so they stay sharp when the stage is CSS-scaled.
// In PixiJS v8, set defaultResolution on the Text class directly.
// null = auto (matches devicePixelRatio); explicit number = overrides.
PixiText.defaultResolution = (window.devicePixelRatio || 1) * 2;
PixiText.defaultAutoResolution = false;

/**
 * Initialise the PixiJS Application and mount the canvas into #canvas-container.
 * Must be awaited before accessing app.canvas, app.stage, or app.renderer.
 */
export async function initApp() {
  const container = document.getElementById('canvas-container');
  const VW = CONFIG.VIEW_W;   // 1024
  const VH = CONFIG.VIEW_H;   // 576
  const dpr = window.devicePixelRatio || 1;

  await app.init({
    width:        VW,
    height:       VH,
    background:   0x0a0a1a,
    antialias:    true,
    preference:   'webgl',
    autoDensity:  true,
    resolution:   Math.max(dpr, 2),
  });

  // Insert canvas before any overlays so z-order stays correct
  container.insertBefore(app.canvas, container.firstChild);
  app.canvas.style.position = 'absolute';
  app.canvas.style.top = '0';
  app.canvas.style.left = '0';

  // Give the container an explicit size so clientWidth/Height are non-zero
  // and _fitCanvas can compute the correct CSS scale on first call.
  container.style.width  = VW + 'px';
  container.style.height = VH + 'px';
  container.style.maxWidth  = '100%';

  _fitCanvas(container, VW, VH);
  window.addEventListener('resize', () => _fitCanvas(container, VW, VH));

  // Fullscreen button - request fullscreen on canvas only
  const fsBtn = document.getElementById('fullscreen-btn');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        app.canvas.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });
  }

  const _onFsChange = () => {
    const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (inFs) {
      // Resize renderer to native screen pixels for sharpness.
      // Scale app.stage so game logic stays in 1024x576 logical space.
      const sw = window.screen.width;
      const sh = window.screen.height;
      app.renderer.resize(sw, sh);
      _applyStageScale(sw, sh, VW, VH);
      app.canvas.style.width  = '100%';
      app.canvas.style.height = '100%';
      app.canvas.style.left   = '0';
      app.canvas.style.top    = '0';
    } else {
      _fitCanvas(container, VW, VH);
    }
    if (fsBtn) {
      fsBtn.textContent = inFs ? '🗗' : '⛶';
      fsBtn.title       = inFs ? 'Выйти из полного экрана' : 'Полный экран';
    }
  };
  document.addEventListener('fullscreenchange',       _onFsChange);
  document.addEventListener('webkitfullscreenchange', _onFsChange);

  return app;
}

/**
 * Scale app.stage uniformly to map logical VW×VH onto a physical pw×ph canvas.
 * Centers the stage with letterboxing if aspect ratios differ.
 */
function _applyStageScale(pw, ph, logicalW, logicalH) {
  const scale = Math.min(pw / logicalW, ph / logicalH);
  app.stage.scale.set(scale);
  app.stage.position.set(
    Math.round((pw - logicalW * scale) / 2),
    Math.round((ph - logicalH * scale) / 2),
  );
}

/**
 * Resize the renderer to exact display pixels and scale app.stage to fit.
 * Physical canvas pixels == CSS pixels × dpr — no CSS stretching, text stays sharp.
 */
function _fitCanvas(container, logicalW, logicalH) {
  const availW = container.clientWidth;
  const availH = container.clientHeight;

  if (availW === 0 || availH === 0) return;

  const cssScale = Math.min(availW / logicalW, availH / logicalH);
  const cssW    = Math.round(logicalW * cssScale);
  const cssH    = Math.round(logicalH * cssScale);

  // Resize using CSS pixels, autoDensity/resolution handles the rest
  app.renderer.resize(cssW, cssH);
  _applyStageScale(cssW, cssH, logicalW, logicalH);

  app.canvas.style.width  = cssW + 'px';
  app.canvas.style.height = cssH + 'px';
  app.canvas.style.left   = Math.round((availW - cssW) / 2) + 'px';
  app.canvas.style.top    = Math.round((availH - cssH) / 2) + 'px';
}

/**
 * Request fullscreen on canvas (no-op if already fullscreen).
 */
export function enterFullscreen() {
  if (!document.fullscreenElement && app.canvas) {
    app.canvas.requestFullscreen?.();
  }
}
