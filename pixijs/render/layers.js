// ============================================================
// LAYERS — scene-graph layer stack
//
// Hierarchy:
//   app.stage
//     └── camera.container   (world-space, moves/scales with camera)
//           ├── bg           — parallax background
//           ├── tiles        — floor / outer-wall / corner / partition sprites
//           ├── shadows      — drop-shadow graphics under entities
//           ├── entities     — player, enemies, collectibles, bullets
//           └── particles    — particle container
//     └── hud                — screen-space UI (fixed, no camera transform)
//
// Call initLayers(camera) once after Camera is created.
// ============================================================

import { Container } from 'pixi.js';
import { app }       from '../core/app.js';

// Exported layer containers — populated by initLayers().
export const layers = {
  bg:            null,
  tiles:         null,
  shadows:       null,
  collectibles:  null,
  entities:      null,
  particles:     null,
  debug:         null,
  damageNumbers: null,
  hud:           null,
};

/**
 * Create and attach all layer Containers.
 * @param {import('./camera.js').Camera} camera
 */
export function initLayers(camera) {
  layers.bg            = new Container({ label: 'bg' });
  layers.tiles         = new Container({ label: 'tiles' });
  layers.shadows       = new Container({ label: 'shadows' });
  layers.collectibles  = new Container({ label: 'collectibles' });
  layers.entities      = new Container({ label: 'entities' });
  layers.particles     = new Container({ label: 'particles' });
  layers.debug         = new Container({ label: 'debug' });
  layers.damageNumbers = new Container({ label: 'damageNumbers' });
  layers.hud           = new Container({ label: 'hud' });

  camera.container.addChild(
    layers.bg,
    layers.tiles,
    layers.shadows,
    layers.collectibles,
    layers.entities,
    layers.particles,
    layers.debug,
  );

  app.stage.addChild(camera.container, layers.damageNumbers, layers.hud);
}

/**
 * Remove and destroy all layer children (call between levels or on cleanup).
 */
export function clearWorldLayers() {
  for (const name of ['bg', 'tiles', 'shadows', 'collectibles', 'entities', 'particles', 'debug', 'damageNumbers']) {
    const layer = layers[name];
    if (layer) layer.removeChildren().forEach(c => c.destroy({ children: true }));
  }
}
