import { Application } from 'pixi.js';

export const app = new Application();

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
    antialias:    false,
    preference:   'webgl',
    autoDensity:  false,
    resolution:   1,
  });

  // Insert canvas before any overlays so z-order stays correct
  container.insertBefore(app.canvas, container.firstChild);
  app.canvas.style.position = 'absolute';
  app.canvas.style.top = '0';
  app.canvas.style.left = '0';

  // Set container size to prevent collapse when canvas is absolute
  container.style.width = VW + 'px';
  container.style.height = VH + 'px';

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
      const pw = Math.round(window.screen.width  * dpr);
      const ph = Math.round(window.screen.height * dpr);
      app.renderer.resize(pw, ph);
      _applyStageScale(pw, ph, VW, VH);
      app.canvas.style.width  = '100%';
      app.canvas.style.height = '100%';
      app.canvas.style.left   = '0';
      app.canvas.style.top    = '0';
    } else {
      // Restore original renderer size and stage scale.
      app.renderer.resize(VW, VH);
      app.stage.scale.set(1);
      app.stage.position.set(0, 0);
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
 * Scale the canvas CSS size to fit the container while preserving aspect ratio.
 */
function _fitCanvas(container, logicalW, logicalH) {
  const availW = container.clientWidth;
  const availH = container.clientHeight;

  if (availW === 0 || availH === 0) return;

  const scale  = Math.min(availW / logicalW, availH / logicalH);
  const cssW   = Math.round(logicalW * scale);
  const cssH   = Math.round(logicalH * scale);

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
