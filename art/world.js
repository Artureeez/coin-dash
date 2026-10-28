/* global Phaser, COIN_DASH, COIN_DASH_ART */
// Arena background, HUD style and end-of-round panel, plus world-level effects
// (hit shake, coin glint, low-time warning, ambient motes). Neon-arcade look on the
// settings.js palette. Everything here is a scene object, rebuilt on every restart.
(() => {
  const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';
  const HUD_H = 44;
  const INK = 0x070d1a;     // darkest navy, for the HUD bar and panel
  const TOP = 0x0c1729;     // arena gradient, top
  const BOTTOM = 0x15243f;  // arena gradient, bottom

  const hex = n => '#' + n.toString(16).padStart(6, '0');

  function lerpColor(a, b, t) {
    const ch = (s) => {
      const x = (a >> s) & 255, y = (b >> s) & 255;
      return Math.round(x + (y - x) * t) << s;
    };
    return ch(16) | ch(8) | ch(0);
  }

  // Concentric 1-step strokes that fade from the edge inward: a cheap soft edge.
  function edgeFade(g, color, maxAlpha, steps, step, x, y, w, h) {
    for (let i = 0; i < steps; i++) {
      const a = maxAlpha * Math.pow(1 - i / steps, 2);
      g.lineStyle(step, color, a);
      g.strokeRect(x + i * step + step / 2, y + i * step + step / 2,
        w - i * step * 2 - step, h - i * step * 2 - step);
    }
  }

  COIN_DASH_ART.world = {
    background(scene) {
      const c = COIN_DASH;
      const teal = c.colors.player, gold = c.colors.coin, red = c.colors.drone;
      const W = c.width, H = c.height, PH = H - HUD_H;

      // --- Arena floor: vertical gradient, soft centre glow, fine grid. ---
      const floor = scene.add.graphics().setDepth(-10);
      for (let y = HUD_H; y < H; y += 4) {
        floor.fillStyle(lerpColor(TOP, BOTTOM, (y - HUD_H) / PH), 1);
        floor.fillRect(0, y, W, 4);
      }
      for (let r = 300; r > 60; r -= 40) {
        floor.fillStyle(teal, 0.012);
        floor.fillEllipse(W / 2, HUD_H + PH / 2, r * 2.2, r * 1.3);
      }
      for (let x = 0; x <= W; x += 40) {
        floor.lineStyle(1, teal, x % 160 === 0 ? 0.09 : 0.045);
        floor.lineBetween(x + 0.5, HUD_H, x + 0.5, H);
      }
      for (let y = HUD_H; y <= H; y += 40) {
        floor.lineStyle(1, teal, (y - HUD_H) % 160 === 0 ? 0.09 : 0.045);
        floor.lineBetween(0, y + 0.5, W, y + 0.5);
      }
      floor.fillStyle(teal, 0.22);
      for (let x = 160; x < W; x += 160) {
        for (let y = HUD_H + 160; y < H; y += 160) floor.fillCircle(x + 0.5, y + 0.5, 1.5);
      }

      // Dark vignette so the edges recede and the centre reads as the stage.
      const shade = scene.add.graphics().setDepth(-6);
      edgeFade(shade, 0x03060d, 0.55, 22, 4, 0, HUD_H, W, PH);

      // --- Arena frame: thin neon line, breathing glow, corner brackets. ---
      const glow = scene.add.graphics().setDepth(-4);
      glow.lineStyle(8, teal, 0.06).strokeRect(4, HUD_H + 4, W - 8, PH - 8);
      glow.lineStyle(4, teal, 0.12).strokeRect(2, HUD_H + 2, W - 4, PH - 4);
      scene.tweens.add({ targets: glow, alpha: { from: 0.45, to: 1 },
        duration: 2600, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

      const frame = scene.add.graphics().setDepth(-3);
      frame.lineStyle(1, teal, 0.35).strokeRect(0.5, HUD_H + 0.5, W - 1, PH - 1);
      frame.lineStyle(2, teal, 0.9);
      const L = 22, x0 = 1, y0 = HUD_H + 1, x1 = W - 1, y1 = H - 1;
      [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([x, y, sx, sy]) => {
        frame.lineBetween(x, y, x + L * sx, y);
        frame.lineBetween(x, y, x, y + L * sy);
      });

      // --- Ambient motes: a few faint specks drifting slowly upward. ---
      for (let i = 0; i < 18; i++) {
        const x = Phaser.Math.Between(20, W - 20);
        const y = Phaser.Math.Between(HUD_H + 30, H - 10);
        const mote = scene.add.circle(x, y, Phaser.Math.FloatBetween(0.8, 1.8),
          i % 4 === 0 ? gold : teal, 1).setAlpha(0).setDepth(-5);
        scene.tweens.add({
          targets: mote,
          y: y - Phaser.Math.Between(25, 60),
          alpha: { from: 0, to: Phaser.Math.FloatBetween(0.15, 0.35) },
          duration: Phaser.Math.Between(4000, 8000),
          delay: Phaser.Math.Between(0, 4000),
          ease: 'Sine.easeInOut', yoyo: true, repeat: -1
        });
      }

      // --- HUD bar: dark glass strip with a glowing teal underline. ---
      const bar = scene.add.graphics().setDepth(-1);
      for (let y = 0; y < HUD_H; y += 2) {
        bar.fillStyle(lerpColor(INK, 0x0d1830, y / HUD_H), 1);
        bar.fillRect(0, y, W, 2);
      }
      bar.fillStyle(teal, 0.05).fillRect(0, HUD_H - 10, W, 10);
      bar.fillStyle(teal, 0.18).fillRect(0, HUD_H - 3, W, 2);
      bar.lineStyle(1, teal, 0.85).lineBetween(0, HUD_H - 0.5, W, HUD_H - 0.5);
      bar.fillStyle(teal, 1).fillRect(10, 14, 2, 16); // small accent tick left of the HUD text

      // Gold glint on the underline, flashed on each coin.
      const glint = scene.add.rectangle(W / 2, HUD_H - 1, W, 3, gold, 1).setAlpha(0).setDepth(-1);

      // Red low-time vignette; alpha driven from 'update'. Below the HUD text (10).
      const warn = scene.add.graphics().setDepth(6).setAlpha(0);
      edgeFade(warn, red, 0.45, 16, 3, 0, HUD_H, W, PH);

      // Per-round references; overwritten every create, so nothing survives a restart.
      scene.worldFx = { glint, warn, lowTime: false };
    },

    hudStyle: {
      fontFamily: MONO, fontSize: '18px', fontStyle: 'bold', color: '#e9fffa',
      shadow: { offsetX: 0, offsetY: 0, color: '#71e8ce', blur: 6, fill: true },
      padding: { x: 4, y: 1 }, resolution: 2
    },

    finishPanel(scene, message) {
      const c = COIN_DASH;
      const W = c.width, H = c.height;
      const lines = String(message).split('\n');
      const reason = lines[0] || '';
      const accent = /drone|caught|hit/i.test(reason) ? c.colors.drone : c.colors.coin;
      const teal = c.colors.player;

      // Dim the whole arena.
      const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x03060d, 1).setDepth(20).setAlpha(0);
      scene.tweens.add({ targets: dim, alpha: 0.62, duration: 250 });

      const panel = scene.add.container(W / 2, H / 2).setDepth(21);
      const PW = 440, PHt = 260;
      const g = scene.add.graphics();
      g.fillStyle(INK, 0.97).fillRoundedRect(-PW / 2, -PHt / 2, PW, PHt, 14);
      g.lineStyle(10, accent, 0.07).strokeRoundedRect(-PW / 2 - 4, -PHt / 2 - 4, PW + 8, PHt + 8, 18);
      g.lineStyle(5, accent, 0.16).strokeRoundedRect(-PW / 2 - 1, -PHt / 2 - 1, PW + 2, PHt + 2, 15);
      g.lineStyle(2, accent, 1).strokeRoundedRect(-PW / 2, -PHt / 2, PW, PHt, 14);
      g.lineStyle(1, teal, 0.25).lineBetween(-PW / 2 + 40, 62, PW / 2 - 40, 62);
      panel.add(g);

      const text = (y, str, size, color, extra) => {
        const t = scene.add.text(0, y, str, Object.assign({
          fontFamily: MONO, fontSize: size, fontStyle: 'bold', color, align: 'center',
          resolution: 2
        }, extra)).setOrigin(0.5);
        panel.add(t);
        return t;
      };
      const glowOf = col => ({ shadow: { offsetX: 0, offsetY: 0, color: col, blur: 10, fill: true },
        padding: { x: 10, y: 6 } });

      text(-84, 'ROUND OVER', '12px', hex(teal), { letterSpacing: 5 }).setAlpha(0.75);
      text(-54, reason, '26px', hex(accent), glowOf(hex(accent)));

      const scoreMatch = /^(\d+)\s+(.*)$/.exec(lines[1] || '');
      if (scoreMatch) {
        text(2, scoreMatch[1], '46px', hex(c.colors.coin), glowOf(hex(c.colors.coin)));
        text(40, scoreMatch[2].toUpperCase(), '13px', '#c9d6e8', { letterSpacing: 3 });
      } else if (lines[1]) {
        text(14, lines[1], '22px', hex(c.colors.coin));
      }

      if (lines[2]) {
        const prompt = text(94, lines.slice(2).join('\n'), '15px', hex(teal), glowOf(hex(teal)));
        scene.tweens.add({ targets: prompt, alpha: { from: 1, to: 0.45 },
          duration: 800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1, delay: 400 });
      }

      panel.setAlpha(0).setScale(0.9);
      scene.tweens.add({ targets: panel, alpha: 1, scale: 1, duration: 280, ease: 'Back.easeOut' });
    },

    // Start and pause screens. The first line is the title, the rest are prompts.
    // Returns the objects so game.js can destroy them when the overlay closes.
    overlay(scene, message) {
      const c = COIN_DASH;
      const W = c.width, H = c.height, teal = c.colors.player;
      const lines = String(message).split('\n');
      const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x03060d, 1).setDepth(20).setAlpha(0.55);
      const panel = scene.add.container(W / 2, H / 2).setDepth(21);
      const PW = 420, PHt = 170;
      const g = scene.add.graphics();
      g.fillStyle(INK, 0.97).fillRoundedRect(-PW / 2, -PHt / 2, PW, PHt, 14);
      g.lineStyle(5, teal, 0.16).strokeRoundedRect(-PW / 2 - 1, -PHt / 2 - 1, PW + 2, PHt + 2, 15);
      g.lineStyle(2, teal, 1).strokeRoundedRect(-PW / 2, -PHt / 2, PW, PHt, 14);
      panel.add(g);
      const glow = { shadow: { offsetX: 0, offsetY: 0, color: hex(teal), blur: 10, fill: true },
        padding: { x: 10, y: 6 } };
      panel.add(scene.add.text(0, -30, lines[0] || '', Object.assign({
        fontFamily: MONO, fontSize: '30px', fontStyle: 'bold', color: hex(teal),
        letterSpacing: 3, resolution: 2
      }, glow)).setOrigin(0.5));
      const prompt = scene.add.text(0, 30, lines.slice(1).join('\n'), {
        fontFamily: MONO, fontSize: '15px', fontStyle: 'bold', color: '#c9d6e8',
        align: 'center', lineSpacing: 6, resolution: 2
      }).setOrigin(0.5);
      panel.add(prompt);
      scene.tweens.add({ targets: prompt, alpha: { from: 1, to: 0.5 },
        duration: 800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
      return [dim, panel];
    }
  };

  // ---- World-level effects ----

  COIN_DASH_ART.on('hit', scene => {
    const cam = scene.cameras.main;
    cam.shake(220, 0.01);
    cam.flash(180, 255, 101, 122);
  });

  COIN_DASH_ART.on('coin', scene => {
    const fx = scene.worldFx;
    if (!fx || !fx.glint.active) return;
    scene.tweens.killTweensOf(fx.glint);
    fx.glint.setAlpha(0.9);
    scene.tweens.add({ targets: fx.glint, alpha: 0, duration: 450, ease: 'Quad.easeOut' });
  });

  COIN_DASH_ART.on('update', (scene, { time, seconds }) => {
    const fx = scene.worldFx;
    if (!fx || !fx.warn.active) return;
    const low = seconds <= 10 && seconds > 0;
    if (low) {
      // Pulse faster in the last five seconds.
      const speed = seconds <= 5 ? 110 : 180;
      fx.warn.setAlpha(0.55 + 0.45 * Math.sin(time / speed));
    }
    if (low !== fx.lowTime) {
      fx.lowTime = low;
      if (!low) fx.warn.setAlpha(0);
      if (scene.hud && scene.hud.active) {
        scene.hud.setColor(low ? '#ffd9de' : '#e9fffa');
        scene.hud.setShadowColor(low ? hex(COIN_DASH.colors.drone) : hex(COIN_DASH.colors.player));
      }
    }
  });

  COIN_DASH_ART.on('finish', scene => {
    const fx = scene.worldFx;
    if (!fx || !fx.warn.active) return;
    scene.tweens.add({ targets: fx.warn, alpha: 0, duration: 400 });
  });
})();
