/* global COIN_DASH, COIN_DASH_ART */
// Player look. Texture key: 'player'. The hitbox stays 24x24 regardless of texture size.
COIN_DASH_ART.texture(scene => {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(COIN_DASH.colors.player, 1).fillRect(0, 0, 24, 24);
  g.generateTexture('player', 24, 24);
  g.destroy();
});
