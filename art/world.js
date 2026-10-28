/* global COIN_DASH, COIN_DASH_ART */
// Arena background, HUD style and end-of-round panel.
COIN_DASH_ART.world = {
  background(scene) {
    const c = COIN_DASH;
    scene.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
  },

  hudStyle: { font: '18px monospace', color: '#ffffff' },

  finishPanel(scene, message) {
    const c = COIN_DASH;
    scene.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95);
    scene.add.text(c.width / 2, c.height / 2, message,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
};
