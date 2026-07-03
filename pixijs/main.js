import { initApp, app, enterFullscreen } from './core/app.js';
import { loadAssets }      from './core/assets.js';
import { resumeAudioContext } from './core/sound.js';
import {
  startGameLoop, restartLevel, nextLevel,
} from './game-loop.js';
import { loadGame, hasSave, deleteSave } from './game/state.js';

// ============================================================
// BOOT SEQUENCE
// ============================================================
async function boot() {
  const loadingScreen = document.getElementById('loading-screen');
  const loadingFill   = document.getElementById('loading-bar-fill');
  const overlay       = document.getElementById('overlay');

  // Show loading, hide start overlay
  loadingScreen.classList.remove('hidden');
  overlay.style.display = 'none';

  // 1. Init PixiJS renderer
  await initApp();

  // 1b. Ensure custom font is loaded before any canvas text rendering
  try {
    await document.fonts.load('1em BoldPixels');
    await document.fonts.ready;
  } catch (e) { /* font load failed — fallback will be used */ }

  // 2. Load all textures + sfx with progress bar
  await loadAssets((progress) => {
    loadingFill.style.width = Math.round(progress * 100) + '%';
  });

  // 3. Assets ready — hide loading screen
  loadingScreen.classList.add('hidden');

  // 4. Show start overlay
  overlay.style.display = '';

  // 5. Wire start / continue buttons
  const startBtn    = document.getElementById('start-btn');
  const continueBtn = document.getElementById('continue-btn');

  if (continueBtn) {
    continueBtn.style.display = hasSave() ? '' : 'none';
    continueBtn.addEventListener('click', () => {
      enterFullscreen();
      resumeAudioContext();
      document.getElementById('overlay').style.display = 'none';
      const save = loadGame();
      if (save) {
        startGameLoop({
          level:          save.currentLevel,
          playerProgress: save.playerProgress,
          savedState:     save.state,
        });
      } else {
        startGameLoop({ level: 1 });
      }
    });
  }

  startBtn.addEventListener('click', () => {
    enterFullscreen();
    resumeAudioContext();
    document.getElementById('overlay').style.display = 'none';
    deleteSave();
    startGameLoop({ level: 1 });
  });
}


// ──────────────────────────────────────────────────────────
boot().catch((err) => {
  console.error('[SpiderNest] Boot failed:', err);
  const ls = document.getElementById('loading-screen');
  if (ls) ls.innerHTML = `<span style="color:#ff4444">Ошибка загрузки: ${err.message}</span>`;
});
