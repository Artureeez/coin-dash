/* global COIN_DASH, COIN_DASH_ART */
// Coin look. Texture key: 'coin'. The hitbox stays a radius-9 circle regardless of texture size.
COIN_DASH_ART.texture(scene => {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(COIN_DASH.colors.coin, 1).fillCircle(9, 9, 9);
  g.generateTexture('coin', 18, 18);
  g.destroy();
});
