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
const PLAYER_ANTENNA = 0xffd166; // glowing antenna tip, picks up the coin gold
const PLAYER_CHEEK = 0xff9fb0;
const PLAYER_SIZE = 40; // ~32px visible incl. antenna and outline, centred on the 24px hitbox
// One palette per player index: teal for P1, blue for P2 (violet belongs to the walls).
const PLAYER_VARIANTS = [
  { shell: 'player-shell', glow: 'player-glow', body: () => COIN_DASH.colors.player, shade: 0x3fb8a0, outline: 0x0b3b3c },
  { shell: 'player2-shell', glow: 'player2-glow', body: () => COIN_DASH.colors.player2, shade: 0x3a7bd5, outline: 0x0f2650 }
];

// Rounded body with an antenna, outline, darker underside, glossy highlight and feet.
function drawPlayerShell(g, v) {
  g.lineStyle(2, v.outline, 1).lineBetween(20, 7, 20, 3);
  g.fillStyle(PLAYER_ANTENNA, 1).fillCircle(20, 2.6, 2.4);
  g.fillStyle(0xffffff, 0.9).fillCircle(19.3, 1.9, 0.8);
  g.fillStyle(v.outline, 1).fillRoundedRect(10, 32, 7, 4, 1.5).fillRoundedRect(23, 32, 7, 4, 1.5);
  g.fillStyle(v.outline, 1).fillRoundedRect(4, 6, 32, 29, 9);
  g.fillStyle(v.body(), 1).fillRoundedRect(6, 8, 28, 25, 7);
  g.fillStyle(v.shade, 1).fillRoundedRect(6, 25, 28, 8, { tl: 0, tr: 0, bl: 7, br: 7 });
  g.fillStyle(PLAYER_SHINE, 0.85).fillRoundedRect(9, 10, 10, 2.5, 1.2);
  g.fillStyle(PLAYER_SHINE, 0.85).fillCircle(23, 11.2, 1.2);
}

// Dark visor with eyes and cheeks; mood is 'open', 'blink', 'happy' or 'hurt'.
function drawPlayerFace(g, mood) {
  g.fillStyle(PLAYER_VISOR, 1).fillRoundedRect(9, 13, 22, 11, 5.5);
  g.fillStyle(0xffffff, 0.18).fillRect(12, 14, 16, 1);
  g.fillStyle(PLAYER_CHEEK, mood === 'hurt' ? 0.2 : 0.55).fillCircle(10.5, 27, 1.8).fillCircle(29.5, 27, 1.8);
  if (mood === 'open') {
    g.fillStyle(PLAYER_EYE, 1).fillRoundedRect(13.5, 15.5, 4, 6.5, 2).fillRoundedRect(22.5, 15.5, 4, 6.5, 2);
    g.fillStyle(PLAYER_VISOR, 1).fillCircle(16.4, 17, 0.8).fillCircle(25.4, 17, 0.8);
  } else if (mood === 'blink') {
    g.fillStyle(PLAYER_EYE, 1).fillRect(13.5, 18.5, 4, 1.8).fillRect(22.5, 18.5, 4, 1.8);
  } else if (mood === 'happy') {
    g.lineStyle(1.8, PLAYER_EYE, 1);
    [15.5, 24.5].forEach(x => {
      g.beginPath().moveTo(x - 2.4, 20.5).lineTo(x, 17).lineTo(x + 2.4, 20.5).strokePath();
    });
  } else {
    g.lineStyle(1.8, PLAYER_HURT, 1);
    [15.5, 24.5].forEach(x => {
      g.lineBetween(x - 2, 16.5, x + 2, 21).lineBetween(x - 2, 21, x + 2, 16.5);
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
  // Per-player shell and halo in that player's colour.
  PLAYER_VARIANTS.forEach(v => {
    g.clear();
    drawPlayerShell(g, v);
    g.generateTexture(v.shell, S, S);
    g.clear();
    for (let r = 26; r > 6; r -= 4) g.fillStyle(v.body(), 0.06).fillCircle(26, 26, r);
    g.generateTexture(v.glow, 52, 52);
  });
  ['open', 'blink', 'happy', 'hurt'].forEach(mood => {
    g.clear();
    drawPlayerFace(g, mood);
    g.generateTexture('player-face-' + mood, S, S);
  });
  // Soft ground shadow and a small dot for trail/burst particles.
  g.clear();
  g.fillStyle(0x000000, 0.32).fillEllipse(14, 4, 28, 8);
  g.generateTexture('player-shadow', 28, 8);
  g.clear();
  g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
  g.generateTexture('player-spark', 8, 8);
  g.destroy();
});

function playerArtCreate(scene, p, labelled) {
  p.setVisible(false);
  const v = PLAYER_VARIANTS[p.index] || PLAYER_VARIANTS[0];
  const color = v.body();
  // Created in back-to-front order: trail, glow, shadow, skin, tag, burst.
  const trail = scene.add.particles(0, 0, 'player-spark', {
    emitting: false, lifespan: 320, speed: { min: 4, max: 18 },
    scale: { start: 0.9, end: 0 }, alpha: { start: 0.45, end: 0 }, tint: color, blendMode: 'ADD'
  });
  const glow = scene.add.image(p.x, p.y, v.glow).setBlendMode(Phaser.BlendModes.ADD);
  const shadow = scene.add.image(p.x, p.y + 19, 'player-shadow');
  const shell = scene.add.image(0, 0, v.shell);
  const face = scene.add.image(0, 0, 'player-face-open');
  const skin = scene.add.container(p.x, p.y, [shell, face]);
  // With two players on screen, a small "P1"/"P2" tag removes any doubt about who is who.
  const tag = labelled ? scene.add.text(p.x, p.y - 30, 'P' + (p.index + 1), {
    fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: '#' + color.toString(16).padStart(6, '0'),
    stroke: '#03060d', strokeThickness: 3, resolution: 2
  }).setOrigin(0.5) : null;
  const burst = scene.add.particles(0, 0, 'player-spark', {
    emitting: false, lifespan: { min: 350, max: 650 }, speed: { min: 60, max: 190 },
    scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 },
    tint: [color, PLAYER_SHINE, COIN_DASH.colors.drone], blendMode: 'ADD'
  });
  p.art = {
    skin, shell, face, shadow, glow, trail, burst, tag, color,
    pop: 0, hop: 0, nextTrail: 0, blinkAt: scene.time.now + 2500 + p.index * 700,
    happyUntil: 0, hurtUntil: 0, done: false
  };

  // Beam-in entrance: the skin starts tiny and 'update' eases it up to full size.
  skin.setScale(0.05);
  burst.explode(16, p.x, p.y);
  const ring = scene.add.circle(p.x, p.y, 18).setStrokeStyle(3, color, 1);
  scene.tweens.add({
    targets: ring, scale: 2.6, alpha: 0, duration: 520, ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy()
  });
}

COIN_DASH_ART.on('create', scene => {
  const players = scene.players || [scene.player];
  players.forEach(p => playerArtCreate(scene, p, players.length > 1));
  // Follow the bodies after physics has moved them this frame, so skins never lag behind.
  const follow = () => players.forEach(p => {
    const st = p.art;
    st.skin.setPosition(p.x, p.y + st.hop);
    st.shadow.setPosition(p.x, p.y + 19);
    st.glow.setPosition(p.x, p.y + st.hop);
    if (st.tag) st.tag.setPosition(p.x, p.y - 30 + st.hop);
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
    st.glow.setScale(1 + Math.sin(time / 380 + p.index) * 0.06 + st.pop * 0.35);

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
  const parts = [st.skin, st.shadow, st.glow];
  st.shell.setTintFill(0xffffff);
  scene.time.delayedCall(90, () => { if (!st.out) st.shell.clearTint(); });
  st.burst.explode(fatal ? 22 : 12, st.skin.x, st.skin.y);
  if (!fatal) {
    // Lost a life: wince, then blink while invulnerable.
    st.hurtUntil = scene.time.now + 500;
    scene.tweens.add({
      targets: parts, alpha: 0.25, duration: 125, yoyo: true,
      repeat: Math.max(0, Math.round(invulnerableMs / 250) - 1),
      onComplete: () => parts.forEach(o => o.setAlpha(1))
    });
    return;
  }
  st.done = true;
  scene.tweens.killTweensOf(parts);
  parts.forEach(o => o.setAlpha(1));
  st.face.setTexture('player-face-hurt').setPosition(0, 0);
  scene.tweens.add({ targets: st.skin, scaleX: 1, scaleY: 1, angle: -12, duration: 160, ease: 'Back.easeOut' });
  if (roundOver === false) {
    // Out while a teammate/rival plays on: grey out and fade so it clearly no longer counts.
    st.out = true;
    scene.time.delayedCall(90, () => st.shell.setTint(PLAYER_OUT));
    scene.tweens.add({ targets: parts.concat(st.tag || []), alpha: 0.3, duration: 500, delay: 200 });
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
