/* global COIN_DASH, COIN_DASH_ART */
// Wall (obstacle) look. Texture keys 'obstacle-0', 'obstacle-1', ... one per COIN_DASH.obstacleSizes
// entry. Each texture has a GLOW margin around the wall; game.js sizes the body to the wall alone.
// Neon look: dark glass block, violet edge, faint hazard hatching.
(() => {
  const GLOW = 8;
  const FILL = 0x0b1022, HATCH = 0x2a2a5a, CORE = 0xe4e0ff;

  COIN_DASH_ART.texture(scene => {
    const g = scene.make.graphics({ add: false });
    const col = COIN_DASH.colors.obstacle;
    COIN_DASH.obstacleSizes.forEach(([w, h], i) => {
      g.clear();
      const x = GLOW, y = GLOW;
      // Outer glow: faint strokes that brighten toward the edge.
      for (let s = GLOW; s > 0; s -= 2) {
        g.lineStyle(2, col, 0.05 + 0.1 * (1 - s / GLOW))
          .strokeRect(x - s + 1, y - s + 1, w + s * 2 - 2, h + s * 2 - 2);
      }
      g.fillStyle(FILL, 0.96).fillRect(x, y, w, h);
      // Diagonal hatching, clipped by hand to the block (Graphics has no clip).
      g.lineStyle(2, HATCH, 1);
      for (let d = 6; d < w + h; d += 10) {
        g.lineBetween(x + Math.min(d, w), y + Math.max(0, d - w), x + Math.max(0, d - h), y + Math.min(d, h));
      }
      g.lineStyle(2, col, 1).strokeRect(x + 1, y + 1, w - 2, h - 2);
      g.lineStyle(1, CORE, 0.6).strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
      g.generateTexture(`obstacle-${i}`, w + GLOW * 2, h + GLOW * 2);
    });
    g.destroy();
  });

  // Telegraph each new wall: an outline closes in on the spot while the block drops in and settles.
  // Scaling the image is safe: static bodies ignore it, so the hitbox is solid at full size at once.
  COIN_DASH_ART.on('obstacle', (scene, { obstacle }) => {
    const col = COIN_DASH.colors.obstacle;
    const { width: w, height: h } = obstacle.body;
    obstacle.setDepth(-2).setAlpha(0).setScale(1.35);
    scene.tweens.add({ targets: obstacle, alpha: 1, scale: 1, duration: 320, ease: 'Back.easeOut' });
    const outline = scene.add.rectangle(obstacle.x, obstacle.y, w, h).setStrokeStyle(2, col, 1)
      .setDepth(-2).setScale(2.2).setAlpha(0);
    scene.tweens.add({
      targets: outline, scale: 1, alpha: 1, duration: 260, ease: 'Quad.easeIn',
      onComplete: () => scene.tweens.add({ targets: outline, alpha: 0, scale: 1.3, duration: 300,
        onComplete: () => outline.destroy() })
    });
  });

  // Walls dim with the rest of the arena when the round ends.
  COIN_DASH_ART.on('finish', scene => {
    if (scene.obstacles) scene.tweens.add({ targets: scene.obstacles.getChildren(), alpha: 0.6, duration: 400 });
  });
})();
