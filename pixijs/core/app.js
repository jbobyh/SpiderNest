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

  await app.init({
    width:        VW,
    height:       VH,
    background:   0x0a0a1a,
    antialias:    false,
    preference:   'webgl',
    autoDensity:  true,
    resolution:   window.devicePixelRatio || 1,
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

  // Fullscreen button
  const fsBtn = document.getElementById('fullscreen-btn');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        container.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });
  }

  const _onFsChange = () => {
    const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (inFs) {
      container.style.width  = '';
      container.style.height = '';
    } else {
      container.style.width  = VW + 'px';
      container.style.height = VH + 'px';
    }
    requestAnimationFrame(() => {
      _fitCanvas(container, VW, VH);
      if (fsBtn) {
        fsBtn.textContent = inFs ? '🗗' : '⛶';
        fsBtn.title       = inFs ? 'Выйти из полного экрана' : 'Полный экран';
      }
    });
  };
  document.addEventListener('fullscreenchange',       _onFsChange);
  document.addEventListener('webkitfullscreenchange', _onFsChange);

  return app;
}

/**
 * Scale the canvas CSS size to fit the container while preserving aspect ratio.
 * The renderer resolution handles HiDPI — we only adjust CSS display size.
 */
function _fitCanvas(container, logicalW, logicalH) {
  const dpr    = window.devicePixelRatio || 1;
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
 * Request fullscreen on #canvas-container (no-op if already fullscreen).
 */
export function enterFullscreen() {
  const container = document.getElementById('canvas-container');
  if (!document.fullscreenElement && container) {
    container.requestFullscreen?.();
  }
}
