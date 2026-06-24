import { Graphics } from 'pixi.js';
import { getAllBodies } from '../world/physics.js';

let _debugGraphics = null;

export function initDebugRenderer(layer) {
  _debugGraphics = new Graphics();
  layer.addChild(_debugGraphics);
}

export function syncDebugColliders(isBattle = false) {
  if (!_debugGraphics) return;

  _debugGraphics.clear();

  if (!CONFIG.DEBUG_COLLISIONS) return;

  const bodies = getAllBodies();
  const BS = isBattle ? (CONFIG.BATTLE_SCALE || 1) : 1;

  for (const body of bodies) {
    if (body.isSensor) continue;

    // Set color based on label/category
    let color = 0x0000FF; // Wall (Blue)
    if (body.label === 'player') {
      color = 0x00FF00; // Player (Green)
    } else if (body.label === 'enemy' || body.label.startsWith('boss')) {
      color = 0xFF0000; // Enemy (Red)
    }

    _debugGraphics.setStrokeStyle({ width: 1, color: color, alpha: 0.8 });

    if (body.circleRadius) {
      // Circle
      _debugGraphics.drawCircle(body.position.x, body.position.y, body.circleRadius);
    } else {
      // Polygon (Box for walls)
      const vertices = body.vertices;
      if (vertices.length > 0) {
        _debugGraphics.moveTo(vertices[0].x, vertices[0].y);
        for (let i = 1; i < vertices.length; i++) {
          _debugGraphics.lineTo(vertices[i].x, vertices[i].y);
        }
        _debugGraphics.lineTo(vertices[0].x, vertices[0].y);
      }
    }
    _debugGraphics.stroke();
  }
}

export function clearDebugRenderer() {
  if (_debugGraphics) {
    _debugGraphics.clear();
  }
}
