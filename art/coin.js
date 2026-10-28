/* global Phaser, COIN_DASH, COIN_DASH_ART */
// Coin look. Texture key: 'coin'. The hitbox stays a radius-9 circle regardless of texture size.
//
// The physics image (scene.coin) is hidden and never scaled: in Arcade Physics, scaling a
// game object also rescales its body. Instead a separate display image follows scene.coin
// every frame and carries all of the spin, bob and pop-in animation.

const COIN_RIM_SHADOW = 0x7a4a10;  // dark outline, separates the coin from the navy floor
const COIN_RIM = 0xe0a030;         // bevelled rim
const COIN_RIM_DARK = 0xc7861f;    // recessed ring / embossed shadow
const COIN_LIGHT = 0xffe7a3;       // rim catch-light, embossed star
const COIN_SHINE = 0xfffbe8;       // specular highlight and sparkles

const COIN_SIZE = 24;              // texture size; game.js centres the radius-9 body in it
const COIN_SPIN_EVERY = 2600;      // ms between idle spins
const COIN_SPIN_TIME = 650;        // ms for one full flip

COIN_DASH_ART.texture(scene => {
  const g = scene.make.graphics({ add: false });
  const c = COIN_SIZE / 2;

  // Embossed five-point star, centred at (cx, cy).
  const star = (cx, cy, outer, inner) => {
    const points = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? inner : outer;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return points;
  };

  // Coin face: outline, rim, catch-light, recessed face, embossed star, specular highlight.
  g.fillStyle(COIN_RIM_SHADOW, 1).fillCircle(c, c, 11.5);
  g.fillStyle(COIN_RIM, 1).fillCircle(c, c, 10.5);
  g.lineStyle(1.5, COIN_LIGHT, 0.9);
  g.beginPath();
  g.arc(c, c, 9.4, Math.PI * 0.95, Math.PI * 1.8, false);
  g.strokePath();
  g.fillStyle(COIN_RIM_DARK, 1).fillCircle(c, c, 8);
  g.fillStyle(COIN_DASH.colors.coin, 1).fillCircle(c - 0.4, c - 0.4, 7.4);
  g.fillStyle(COIN_RIM_DARK, 1).fillPoints(star(c + 0.7, c + 0.9, 4.8, 2.1), true);
  g.fillStyle(COIN_LIGHT, 1).fillPoints(star(c, c + 0.2, 4.8, 2.1), true);
  g.fillStyle(COIN_SHINE, 0.85).fillCircle(c - 4.2, c - 4.6, 1.9);
  g.fillStyle(COIN_SHINE, 0.6).fillCircle(c - 5.6, c - 2.2, 0.9);
  g.generateTexture('coin', COIN_SIZE, COIN_SIZE);

  // Coin seen edge-on, shown for the middle of a spin.
  g.clear();
  g.fillStyle(COIN_RIM_SHADOW, 1).fillRoundedRect(c - 3, 0.5, 6, COIN_SIZE - 1, 2);
  g.fillStyle(COIN_RIM, 1).fillRect(c - 2, 1.5, 4, COIN_SIZE - 3);
  g.fillStyle(COIN_LIGHT, 1).fillRect(c - 1, 2.5, 1, COIN_SIZE - 5);
  g.generateTexture('coin-edge', COIN_SIZE, COIN_SIZE);

  // Soft glow halo (drawn with ADD blending under the coin).
  g.clear();
  for (let i = 0; i < 12; i++) {
    g.fillStyle(COIN_DASH.colors.coin, 0.05).fillCircle(24, 24, 24 - i * 1.7);
  }
  g.generateTexture('coin-glow', 48, 48);

  // Round particle; white so it can be tinted.
  g.clear();
  g.fillStyle(0xffffff, 0.5).fillCircle(3, 3, 3);
  g.fillStyle(0xffffff, 1).fillCircle(3, 3, 1.8);
  g.generateTexture('coin-dot', 6, 6);

  // Four-point twinkle.
  g.clear();
  g.fillStyle(COIN_SHINE, 1).fillPoints([
    { x: 5.5, y: 0 }, { x: 6.5, y: 4.5 }, { x: 11, y: 5.5 }, { x: 6.5, y: 6.5 },
    { x: 5.5, y: 11 }, { x: 4.5, y: 6.5 }, { x: 0, y: 5.5 }, { x: 4.5, y: 4.5 }
  ], true);
  g.generateTexture('coin-twinkle', 11, 11);

  // Shockwave ring for the collect burst.
  g.clear();
  g.lineStyle(2.5, COIN_LIGHT, 1).strokeCircle(20, 20, 17);
  g.generateTexture('coin-ring', 40, 40);

  g.destroy();
});

// Positions, spins and scales the display coin. Called every frame from 'update'.
function coinArtRender(scene, time) {
  const art = scene.coinArt;
  if (!art || !scene.coin) return;
  const x = scene.coin.x;
  const y = scene.coin.y + Math.sin(time / 320) * 1.5;
  const pop = art.pop.s;

  // Idle spin: one quick flip every few seconds, otherwise facing the camera.
  const t = (time + art.spinOffset) % COIN_SPIN_EVERY;
  const sx = t < COIN_SPIN_TIME ? Math.abs(Math.cos(t / COIN_SPIN_TIME * Math.PI * 2)) : 1;
  const edgeOn = sx < 0.22;
  const key = edgeOn ? 'coin-edge' : 'coin';
  if (art.face.texture.key !== key) art.face.setTexture(key);
  art.face.setPosition(x, y).setScale((edgeOn ? 1 : sx) * pop, pop);

  const pulse = Math.sin(time / 420);
  art.glow.setPosition(x, y).setScale((1 + pulse * 0.08) * pop).setAlpha(0.45 + pulse * 0.15);

  // Occasional twinkle on the coin's face.
  if (time >= art.nextSparkle) {
    art.nextSparkle = time + Phaser.Math.Between(900, 1900);
    if (pop > 0.9) coinArtTwinkle(scene, x, y);
  }
}

function coinArtTwinkle(scene, x, y) {
  const a = Math.random() * Math.PI * 2;
  const r = Math.random() * 7;
  const s = scene.add.image(x + Math.cos(a) * r, y + Math.sin(a) * r, 'coin-twinkle')
    .setScale(0).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: s, scale: 1, angle: 90, duration: 220, yoyo: true, ease: 'Sine.easeInOut',
    onComplete: () => s.destroy()
  });
}

function coinArtPopIn(scene) {
  const art = scene.coinArt;
  if (art.popTween) art.popTween.stop();
  art.pop.s = 0;
  art.popTween = scene.tweens.add({
    targets: art.pop, s: 1, delay: 80, duration: 340, ease: 'Back.easeOut',
    onComplete: () => { art.pop.s = 1; art.popTween = null; }
  });
}

COIN_DASH_ART.on('create', scene => {
  // Hide the physics image (visibility does not affect its body) and draw our own on top.
  scene.coin.setVisible(false);
  const glow = scene.add.image(scene.coin.x, scene.coin.y, 'coin-glow')
    .setBlendMode(Phaser.BlendModes.ADD);
  const face = scene.add.image(scene.coin.x, scene.coin.y, 'coin');
  // Keep the coin at the physics image's place in the draw order (under the drones).
  scene.children.moveAbove(glow, scene.coin);
  scene.children.moveAbove(face, glow);
  // Fresh state each round; the old objects were destroyed with the previous scene run.
  scene.coinArt = {
    glow, face, pop: { s: 0 }, popTween: null,
    spinOffset: Phaser.Math.Between(0, COIN_SPIN_EVERY),
    nextSparkle: scene.time.now + 600
  };
  coinArtPopIn(scene);
  coinArtRender(scene, scene.time.now);
});

COIN_DASH_ART.on('update', (scene, { time }) => coinArtRender(scene, time));

COIN_DASH_ART.on('coin', (scene, { x, y, score }) => {
  const big = score % 10 === 0;

  // Gold burst plus a few spinning twinkles.
  const dots = scene.add.particles(x, y, 'coin-dot', {
    speed: { min: 70, max: big ? 230 : 170 },
    lifespan: { min: 380, max: 560 },
    scale: { start: 1.1, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [COIN_DASH.colors.coin, COIN_LIGHT, COIN_SHINE],
    blendMode: 'ADD',
    emitting: false
  });
  dots.explode(big ? 26 : 14);
  const twinkles = scene.add.particles(x, y, 'coin-twinkle', {
    speed: { min: 25, max: 90 },
    lifespan: 520,
    scale: { start: 1, end: 0 },
    rotate: { start: 0, end: 180 },
    blendMode: 'ADD',
    emitting: false
  });
  twinkles.explode(big ? 8 : 4);
  scene.time.delayedCall(700, () => { dots.destroy(); twinkles.destroy(); });

  // Expanding ring.
  const ring = scene.add.image(x, y, 'coin-ring').setScale(0.4).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: ring, scale: big ? 2.2 : 1.6, alpha: 0, duration: 340, ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy()
  });

  // Floating "+1".
  const label = scene.add.text(x, y - 12, '+1', {
    font: `bold ${big ? 22 : 16}px monospace`, color: '#ffe7a3',
    stroke: '#5a3608', strokeThickness: 4
  }).setOrigin(0.5);
  scene.tweens.add({
    targets: label, y: y - 44, alpha: 0, duration: 750, ease: 'Cubic.easeOut',
    onComplete: () => label.destroy()
  });

  // The coin is teleported right after this event; pop it in at its new spot.
  if (scene.coinArt) coinArtPopIn(scene);
});

COIN_DASH_ART.on('finish', scene => {
  const art = scene.coinArt;
  if (!art) return;
  // 'update' stops firing after the round ends, so settle the coin in a final, steady pose.
  if (art.popTween) art.popTween.stop();
  art.popTween = null;
  art.pop.s = 1;
  art.spinOffset = 0;
  art.nextSparkle = Infinity;
  coinArtRender(scene, COIN_SPIN_TIME);
});
