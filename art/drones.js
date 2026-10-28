/* global COIN_DASH, COIN_DASH_ART */
// Drone (enemy) look. Texture key: 'drone'. The hitbox stays 26x26 regardless of texture size.
COIN_DASH_ART.texture(scene => {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(COIN_DASH.colors.drone, 1).fillRect(0, 0, 26, 26);
  g.generateTexture('drone', 26, 26);
  g.destroy();
});
