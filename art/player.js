/* global Phaser, COIN_DASH, COIN_DASH_ART */
// Player look. Texture key: 'player'. The hitbox stays 24x24 regardless of texture size.
// The physics image is hidden and a separate "skin" (shell + face) follows it, so squash,
// stretch and tilt never touch the body (Arcade resizes a body when its sprite is scaled).
const PLAYER_OUTLINE = 0x0b3b3c;
const PLAYER_SHADE = 0x3fb8a0;
const PLAYER_SHINE = 0xd4fff4;
const PLAYER_VISOR = 0x0d2033;
const PLAYER_EYE = 0xeafffb;
const PLAYER_HURT = 0xff8fa0;
const PLAYER_SIZE = 32; // 28px visible incl. outline, centred on the 24px hitbox

// Rounded teal body with an outline, a darker underside and a glossy highlight.
function drawPlayerShell(g) {
  g.fillStyle(PLAYER_OUTLINE, 1).fillRoundedRect(2, 2, 28, 28, 8);
  g.fillStyle(COIN_DASH.colors.player, 1).fillRoundedRect(4, 4, 24, 24, 6);
  g.fillStyle(PLAYER_SHADE, 1).fillRoundedRect(4, 19, 24, 9, { tl: 0, tr: 0, bl: 6, br: 6 });
  g.fillStyle(PLAYER_SHINE, 0.85).fillRoundedRect(7, 6, 9, 2.5, 1.2);
  g.fillStyle(PLAYER_SHINE, 0.85).fillCircle(19, 7.2, 1.2);
}

// Dark visor with eyes; mood is 'open', 'blink', 'happy' or 'hurt'.
function drawPlayerFace(g, mood) {
  g.fillStyle(PLAYER_VISOR, 1).fillRoundedRect(7, 10, 18, 9, 4.5);
  g.fillStyle(0xffffff, 0.18).fillRect(10, 11, 12, 1);
  if (mood === 'open') {
    g.fillStyle(PLAYER_EYE, 1).fillRoundedRect(11, 12, 3, 5, 1.5).fillRoundedRect(18, 12, 3, 5, 1.5);
  } else if (mood === 'blink') {
    g.fillStyle(PLAYER_EYE, 1).fillRect(11, 14.5, 3, 1.5).fillRect(18, 14.5, 3, 1.5);
  } else if (mood === 'happy') {
    g.lineStyle(1.6, PLAYER_EYE, 1);
    [12.5, 19.5].forEach(x => {
      g.beginPath().moveTo(x - 2, 16).lineTo(x, 13.2).lineTo(x + 2, 16).strokePath();
    });
  } else {
    g.lineStyle(1.6, PLAYER_HURT, 1);
    [12.5, 19.5].forEach(x => {
      g.lineBetween(x - 1.8, 12.7, x + 1.8, 16.3).lineBetween(x - 1.8, 16.3, x + 1.8, 12.7);
    });
  }
}

COIN_DASH_ART.texture(scene => {
  const g = scene.make.graphics({ add: false });
  const S = PLAYER_SIZE;
  // Full character, used by the (hidden) physics image and anywhere else 'player' shows up.
  drawPlayerShell(g);
  drawPlayerFace(g, 'open');
  g.generateTexture('player', S, S);
  g.clear();
  drawPlayerShell(g);
  g.generateTexture('player-shell', S, S);
  ['open', 'blink', 'happy', 'hurt'].forEach(mood => {
    g.clear();
    drawPlayerFace(g, mood);
    g.generateTexture('player-face-' + mood, S, S);
  });
  // Soft ground shadow and a small dot for trail/burst particles.
  g.clear();
  g.fillStyle(0x000000, 0.32).fillEllipse(12, 4, 24, 8);
  g.generateTexture('player-shadow', 24, 8);
  g.clear();
  g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
  g.generateTexture('player-spark', 8, 8);
  g.destroy();
});

COIN_DASH_ART.on('create', scene => {
  const p = scene.player;
  p.setVisible(false);
  const teal = COIN_DASH.colors.player;
  // Created in back-to-front order: trail, shadow, skin, burst.
  const trail = scene.add.particles(0, 0, 'player-spark', {
    emitting: false, lifespan: 320, speed: { min: 4, max: 18 },
    scale: { start: 0.9, end: 0 }, alpha: { start: 0.45, end: 0 }, tint: teal, blendMode: 'ADD'
  });
  const shadow = scene.add.image(p.x, p.y + 15, 'player-shadow');
  const shell = scene.add.image(0, 0, 'player-shell');
  const face = scene.add.image(0, 0, 'player-face-open');
  const skin = scene.add.container(p.x, p.y, [shell, face]);
  const burst = scene.add.particles(0, 0, 'player-spark', {
    emitting: false, lifespan: { min: 350, max: 650 }, speed: { min: 60, max: 190 },
    scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 },
    tint: [teal, PLAYER_SHINE, COIN_DASH.colors.drone], blendMode: 'ADD'
  });
  const st = scene.playerArt = {
    skin, shell, face, shadow, trail, burst,
    pop: 0, hop: 0, nextTrail: 0, blinkAt: scene.time.now + 2500, happyUntil: 0, done: false
  };
  // Follow the body after physics has moved it this frame, so the skin never lags behind.
  const follow = () => {
    skin.setPosition(p.x, p.y + st.hop);
    shadow.setPosition(p.x, p.y + 15);
  };
  scene.events.on('postupdate', follow);
  scene.events.once('shutdown', () => scene.events.off('postupdate', follow));
});

COIN_DASH_ART.on('update', (scene, { time, delta, dx, dy }) => {
  const st = scene.playerArt;
  if (!st || st.done) return;
  const now = scene.time.now;
  const ease = 1 - Math.exp(-delta / 70);
  const moving = dx !== 0 || dy !== 0;
  // Stretch along the movement axis, squash across it; breathe gently when idle.
  const breathe = moving ? 0 : Math.sin(time / 260) * 0.035;
  const pop = 1 + st.pop * 0.28;
  const sx = (1 + 0.1 * Math.abs(dx) - 0.07 * Math.abs(dy) - breathe) * pop;
  const sy = (1 + 0.1 * Math.abs(dy) - 0.07 * Math.abs(dx) + breathe) * pop;
  const skin = st.skin;
  skin.setScale(Phaser.Math.Linear(skin.scaleX, sx, ease), Phaser.Math.Linear(skin.scaleY, sy, ease));
  skin.setAngle(Phaser.Math.Linear(skin.angle, dx * 9, ease));
  // The visor glances in the direction of travel.
  st.face.setPosition(Phaser.Math.Linear(st.face.x, dx * 2.5, ease),
    Phaser.Math.Linear(st.face.y, dy * 2, ease));
  st.shadow.setScale(Phaser.Math.Linear(st.shadow.scaleX, moving ? 0.85 : 1, ease), 1);

  let mood = 'open';
  if (now < st.happyUntil) mood = 'happy';
  else if (now > st.blinkAt + 120) st.blinkAt = now + Phaser.Math.Between(2200, 4800);
  else if (now > st.blinkAt) mood = 'blink';
  st.face.setTexture('player-face-' + mood);

  if (moving && now >= st.nextTrail) {
    st.trail.emitParticleAt(skin.x - dx * 8, skin.y - dy * 8 + 4, 1);
    st.nextTrail = now + 35;
  }
});

COIN_DASH_ART.on('coin', scene => {
  const st = scene.playerArt;
  if (!st) return;
  st.happyUntil = scene.time.now + 450;
  st.pop = 1;
  scene.tweens.add({ targets: st, pop: 0, duration: 260, ease: 'Quad.easeOut' });
  // Expanding teal ring around the player.
  const ring = scene.add.circle(st.skin.x, st.skin.y, 14).setStrokeStyle(2, COIN_DASH.colors.player, 0.9);
  scene.tweens.add({
    targets: ring, scale: 2.2, alpha: 0, duration: 380, ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy()
  });
});

COIN_DASH_ART.on('hit', scene => {
  const st = scene.playerArt;
  if (!st) return;
  st.done = true;
  st.face.setTexture('player-face-hurt').setPosition(0, 0);
  st.shell.setTintFill(0xffffff);
  scene.time.delayedCall(90, () => st.shell.clearTint());
  st.burst.explode(22, st.skin.x, st.skin.y);
  scene.tweens.add({ targets: st.skin, scaleX: 1, scaleY: 1, angle: -12, duration: 160, ease: 'Back.easeOut' });
});

COIN_DASH_ART.on('finish', scene => {
  const st = scene.playerArt;
  // 'hit' fires before 'finish' and sets done, so reaching here means the timer ran out.
  if (!st || st.done) return;
  // Round survived: settle upright, smile and do a little hop.
  st.done = true;
  st.face.setTexture('player-face-happy').setPosition(0, 0);
  scene.tweens.add({ targets: st.skin, scaleX: 1, scaleY: 1, angle: 0, duration: 200 });
  scene.tweens.add({ targets: st, hop: -8, duration: 160, ease: 'Quad.easeOut', yoyo: true, repeat: 1 });
});
