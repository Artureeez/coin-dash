/* global Phaser, COIN_DASH, COIN_DASH_ART */
// Player look. Texture key: 'player'. The hitbox stays 24x24 regardless of texture size.
// The physics image is hidden and a separate "skin" (shell + face) follows it, so squash,
// stretch and tilt never touch the body (Arcade resizes a body when its sprite is scaled).
// Handles every sprite in scene.players; each keeps its own art state on `player.art`.
const PLAYER_SHINE = 0xd4fff4;
const PLAYER_VISOR = 0x0d2033;
const PLAYER_EYE = 0xeafffb;
const PLAYER_HURT = 0xff8fa0;
const PLAYER_OUT = 0x6b7486;
const PLAYER_SIZE = 32; // 28px visible incl. outline, centred on the 24px hitbox
// One palette per player index: teal for P1, violet for P2, so they never get mixed up.
const PLAYER_VARIANTS = [
  { shell: 'player-shell', body: () => COIN_DASH.colors.player, shade: 0x3fb8a0, outline: 0x0b3b3c },
  { shell: 'player2-shell', body: () => COIN_DASH.colors.player2, shade: 0x8f63d9, outline: 0x2a1450 }
];

// Rounded body with an outline, a darker underside and a glossy highlight.
function drawPlayerShell(g, v) {
  g.fillStyle(v.outline, 1).fillRoundedRect(2, 2, 28, 28, 8);
  g.fillStyle(v.body(), 1).fillRoundedRect(4, 4, 24, 24, 6);
  g.fillStyle(v.shade, 1).fillRoundedRect(4, 19, 24, 9, { tl: 0, tr: 0, bl: 6, br: 6 });
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
  drawPlayerShell(g, PLAYER_VARIANTS[0]);
  drawPlayerFace(g, 'open');
  g.generateTexture('player', S, S);
  PLAYER_VARIANTS.forEach(v => {
    g.clear();
    drawPlayerShell(g, v);
    g.generateTexture(v.shell, S, S);
  });
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

function playerArtCreate(scene, p, labelled) {
  p.setVisible(false);
  const v = PLAYER_VARIANTS[p.index] || PLAYER_VARIANTS[0];
  const color = v.body();
  // Created in back-to-front order: trail, shadow, skin, burst.
  const trail = scene.add.particles(0, 0, 'player-spark', {
    emitting: false, lifespan: 320, speed: { min: 4, max: 18 },
    scale: { start: 0.9, end: 0 }, alpha: { start: 0.45, end: 0 }, tint: color, blendMode: 'ADD'
  });
  const shadow = scene.add.image(p.x, p.y + 15, 'player-shadow');
  const shell = scene.add.image(0, 0, v.shell);
  const face = scene.add.image(0, 0, 'player-face-open');
  const skin = scene.add.container(p.x, p.y, [shell, face]);
  // With two players on screen, a small "P1"/"P2" tag removes any doubt about who is who.
  const tag = labelled ? scene.add.text(p.x, p.y - 26, 'P' + (p.index + 1), {
    fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: '#' + color.toString(16).padStart(6, '0'),
    stroke: '#03060d', strokeThickness: 3, resolution: 2
  }).setOrigin(0.5) : null;
  const burst = scene.add.particles(0, 0, 'player-spark', {
    emitting: false, lifespan: { min: 350, max: 650 }, speed: { min: 60, max: 190 },
    scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 },
    tint: [color, PLAYER_SHINE, COIN_DASH.colors.drone], blendMode: 'ADD'
  });
  p.art = {
    skin, shell, face, shadow, trail, burst, tag, color,
    pop: 0, hop: 0, nextTrail: 0, blinkAt: scene.time.now + 2500 + p.index * 700,
    happyUntil: 0, hurtUntil: 0, done: false
  };
}

COIN_DASH_ART.on('create', scene => {
  const players = scene.players || [scene.player];
  players.forEach(p => playerArtCreate(scene, p, players.length > 1));
  // Follow the bodies after physics has moved them this frame, so skins never lag behind.
  const follow = () => players.forEach(p => {
    const st = p.art;
    st.skin.setPosition(p.x, p.y + st.hop);
    st.shadow.setPosition(p.x, p.y + 15);
    if (st.tag) st.tag.setPosition(p.x, p.y - 26 + st.hop);
  });
  scene.events.on('postupdate', follow);
  scene.events.once('shutdown', () => scene.events.off('postupdate', follow));
});

COIN_DASH_ART.on('update', (scene, { time, delta }) => {
  const now = scene.time.now;
  const ease = 1 - Math.exp(-delta / 70);
  (scene.players || [scene.player]).forEach(p => {
    const st = p.art;
    if (!st || st.done) return;
    const dx = p.dx || 0, dy = p.dy || 0;
    const moving = dx !== 0 || dy !== 0;
    // Stretch along the movement axis, squash across it; breathe gently when idle.
    const breathe = moving ? 0 : Math.sin(time / 260 + p.index) * 0.035;
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
    if (now < st.hurtUntil) mood = 'hurt';
    else if (now < st.happyUntil) mood = 'happy';
    else if (now > st.blinkAt + 120) st.blinkAt = now + Phaser.Math.Between(2200, 4800);
    else if (now > st.blinkAt) mood = 'blink';
    st.face.setTexture('player-face-' + mood);

    if (moving && now >= st.nextTrail) {
      st.trail.emitParticleAt(skin.x - dx * 8, skin.y - dy * 8 + 4, 1);
      st.nextTrail = now + 35;
    }
  });
});

COIN_DASH_ART.on('coin', (scene, { player }) => {
  const st = (player || scene.player).art;
  if (!st) return;
  st.happyUntil = scene.time.now + 450;
  st.pop = 1;
  scene.tweens.add({ targets: st, pop: 0, duration: 260, ease: 'Quad.easeOut' });
  // Expanding ring in the collector's colour.
  const ring = scene.add.circle(st.skin.x, st.skin.y, 14).setStrokeStyle(2, st.color, 0.9);
  scene.tweens.add({
    targets: ring, scale: 2.2, alpha: 0, duration: 380, ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy()
  });
});

COIN_DASH_ART.on('hit', (scene, { player, fatal, roundOver, invulnerableMs }) => {
  const st = (player || scene.player).art;
  if (!st) return;
  st.shell.setTintFill(0xffffff);
  scene.time.delayedCall(90, () => { if (!st.out) st.shell.clearTint(); });
  st.burst.explode(fatal ? 22 : 12, st.skin.x, st.skin.y);
  if (!fatal) {
    // Lost a life: wince, then blink while invulnerable.
    st.hurtUntil = scene.time.now + 500;
    scene.tweens.add({
      targets: [st.skin, st.shadow], alpha: 0.25, duration: 125, yoyo: true,
      repeat: Math.max(0, Math.round(invulnerableMs / 250) - 1),
      onComplete: () => { st.skin.setAlpha(1); st.shadow.setAlpha(1); }
    });
    return;
  }
  st.done = true;
  scene.tweens.killTweensOf([st.skin, st.shadow]);
  st.skin.setAlpha(1);
  st.face.setTexture('player-face-hurt').setPosition(0, 0);
  scene.tweens.add({ targets: st.skin, scaleX: 1, scaleY: 1, angle: -12, duration: 160, ease: 'Back.easeOut' });
  if (roundOver === false) {
    // Out while a teammate/rival plays on: grey out and fade so it clearly no longer counts.
    st.out = true;
    scene.time.delayedCall(90, () => st.shell.setTint(PLAYER_OUT));
    scene.tweens.add({ targets: [st.skin, st.shadow, st.tag].filter(Boolean), alpha: 0.3, duration: 500, delay: 200 });
  }
});

COIN_DASH_ART.on('finish', (scene, { winner } = {}) => {
  (scene.players || [scene.player]).forEach(p => {
    const st = p.art;
    // 'hit' fires before 'finish' and sets done, so reaching here means this player survived.
    if (!st || st.done) return;
    // Round survived: settle upright, smile and hop (a versus winner hops higher).
    st.done = true;
    st.face.setTexture('player-face-happy').setPosition(0, 0);
    scene.tweens.add({ targets: st.skin, scaleX: 1, scaleY: 1, angle: 0, duration: 200 });
    scene.tweens.add({ targets: st, hop: winner === p ? -14 : -8, duration: 160, ease: 'Quad.easeOut', yoyo: true, repeat: 1 });
  });
});
