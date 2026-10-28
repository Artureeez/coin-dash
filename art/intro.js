/* global Phaser, COIN_DASH, COIN_DASH_ART */
// Intro cutscene: a short back story that plays once per page load, then hands over to the
// game with the round already started. SPACE, ENTER or a click skips it at any point.
(() => {
  const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';
  const BAR = 56;  // letterbox bar height
  const INK = 0x070d1a;

  // Beat start times (ms) and captions; the last beat is the title card.
  const STORY = [
    { at: 300, text: 'Year 2087. Deep under Neon City lies the Vault,\nhome of the last gold coins.' },
    { at: 4300, text: 'One night, the security drones glitched...\nand the coins spilled everywhere.' },
    { at: 8800, text: 'Only DASH, a tiny maintenance bot,\nis brave enough to roll in.' },
    { at: 12800, text: null }
  ];

  const hex = n => '#' + n.toString(16).padStart(6, '0');

  class CoinDashIntro extends Phaser.Scene {
    constructor() { super('CoinDashIntro'); }

    create() {
      const c = COIN_DASH;
      COIN_DASH_ART.buildTextures(this);
      this.W = c.width;
      this.H = c.height;
      this.cx = c.width / 2;
      this.cy = 44 + (c.height - 44) / 2;
      this.done = false;
      this.drones = [];
      this.orbit = { a: 0 };
      COIN_DASH_ART.world.floor(this);
      this.buildVault();
      this.buildLetterbox();
      this.beats = STORY.map((b, i) => this.time.delayedCall(b.at, () => this.beat(i)));
      const go = () => this.startGame();
      this.input.keyboard.on('keydown-SPACE', go);
      this.input.keyboard.on('keydown-ENTER', go);
      this.input.on('pointerdown', go);
      this.cameras.main.fadeIn(700, 0, 0, 0);
    }

    // Vault door with a spinning dial, ringed by stacks of coins.
    buildVault() {
      const { cx, cy } = this;
      const teal = COIN_DASH.colors.player, gold = COIN_DASH.colors.coin;
      const door = this.add.graphics();
      door.fillStyle(0x000000, 0.35).fillCircle(cx + 4, cy + 6, 80);
      door.fillStyle(0x0b1526, 1).fillCircle(cx, cy, 78);
      door.lineStyle(4, teal, 0.6).strokeCircle(cx, cy, 78);
      door.lineStyle(2, teal, 0.25).strokeCircle(cx, cy, 60);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        door.fillStyle(gold, 0.85).fillCircle(cx + Math.cos(a) * 69, cy + Math.sin(a) * 69, 3);
      }
      this.dial = this.add.graphics({ x: cx, y: cy });
      this.dial.lineStyle(3, teal, 0.75).strokeCircle(0, 0, 22);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        this.dial.lineBetween(Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a) * 36, Math.sin(a) * 36);
      }
      this.dialTween = this.tweens.add({ targets: this.dial, angle: 360, duration: 9000, repeat: -1 });

      this.coins = [];
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        const r = 106 + (i % 2) * 16;
        const x = this.cx + Math.cos(a) * r, y = this.cy + Math.sin(a) * r * 0.78;
        const glow = this.add.image(x, y, 'coin-glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setScale(0.7);
        const coin = this.add.image(x, y, 'coin');
        this.tweens.add({ targets: [coin, glow], y: y - 3, duration: 800 + i * 37,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.coins.push({ coin, glow });
      }
    }

    buildLetterbox() {
      const { W, H } = this;
      this.add.rectangle(W / 2, BAR / 2, W, BAR, 0x000000, 1).setDepth(30);
      this.add.rectangle(W / 2, H - BAR / 2, W, BAR, 0x000000, 1).setDepth(30);
      this.caption = this.add.text(W / 2, H - BAR / 2, '', {
        fontFamily: MONO, fontSize: '16px', color: '#e9fffa', align: 'center', lineSpacing: 4, resolution: 2
      }).setOrigin(0.5).setDepth(31);
      this.skipHint = this.add.text(W - 16, BAR / 2, 'SPACE  skip ▸', {
        fontFamily: MONO, fontSize: '12px', color: hex(COIN_DASH.colors.player), resolution: 2
      }).setOrigin(1, 0.5).setAlpha(0.55).setDepth(31);
    }

    // Typewriter caption.
    say(text) {
      if (this.typer) this.typer.remove();
      let n = 0;
      this.caption.setText('').setAlpha(1);
      this.typer = this.time.addEvent({
        delay: 30, repeat: text.length - 1, callback: () => this.caption.setText(text.slice(0, ++n))
      });
    }

    beat(i) {
      if (this.done) return;
      if (STORY[i].text) this.say(STORY[i].text);
      [this.beatVault, this.beatGlitch, this.beatDash, this.beatTitle][i].call(this);
    }

    // 1: the vault at peace; coins twinkle.
    beatVault() {
      this.coins.forEach(({ coin }, i) => this.time.delayedCall(400 + i * 180, () => {
        this.tweens.add({ targets: coin, scaleX: 0.2, duration: 160, yoyo: true, ease: 'Sine.easeInOut' });
      }));
    }

    // 2: drones patrol in, glitch, and the coins burst across the floor.
    beatGlitch() {
      for (let k = 0; k < 3; k++) {
        const glow = this.add.image(0, 0, 'drone-glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        const drone = this.add.image(0, 0, 'drone').setAlpha(0);
        drone.glow = glow;
        this.tweens.add({ targets: [drone, glow], alpha: 1, duration: 600 });
        this.drones.push(drone);
      }
      this.orbitTween = this.tweens.add({ targets: this.orbit, a: Math.PI * 2, duration: 6500, repeat: -1 });

      this.time.delayedCall(1700, () => {
        const cam = this.cameras.main;
        cam.shake(450, 0.012);
        cam.flash(250, 255, 60, 80);
        this.orbitTween.timeScale = 2.4;
        this.dialTween.timeScale = 6;
        let flicks = 0;
        this.time.addEvent({ delay: 80, repeat: 9, callback: () => {
          const on = ++flicks % 2;
          this.drones.forEach(d => (on ? d.setTintFill(0xffffff) : d.clearTint()));
        } });
        this.coins.forEach(({ coin, glow }) => {
          this.tweens.killTweensOf([coin, glow]);
          coin.setScale(1);
          const x = Phaser.Math.Between(40, this.W - 40);
          const y = Phaser.Math.Between(BAR + 30, this.H - BAR - 30);
          this.tweens.add({ targets: [coin, glow], x, y, duration: 650 + Math.random() * 300, ease: 'Cubic.easeOut' });
          this.tweens.add({ targets: coin, angle: Phaser.Math.Between(-540, 540), duration: 800, ease: 'Cubic.easeOut' });
        });
      });
    }

    // 3: Dash rolls in, looks around, and decides to go for it.
    beatDash() {
      const y = this.H - BAR - 46;
      this.dashShadow = this.add.image(-40, y + 19, 'player-shadow');
      this.dashGlow = this.add.image(-40, y, 'player-glow').setBlendMode(Phaser.BlendModes.ADD);
      this.dashFace = this.add.image(0, 0, 'player-face-open');
      this.dash = this.add.container(-40, y, [this.add.image(0, 0, 'player-shell'), this.dashFace]);
      const parts = [this.dash, this.dashGlow, this.dashShadow];
      this.tweens.add({ targets: parts, x: 170, duration: 1500, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: this.dash, y: y - 4, duration: 120, yoyo: true, repeat: 5 });
      const face = (key, x) => () => this.dashFace.setTexture('player-face-' + key).setX(x);
      this.time.delayedCall(1700, face('open', -2.5));
      this.time.delayedCall(2200, face('open', 2.5));
      this.time.delayedCall(2700, face('blink', 0));
      this.time.delayedCall(2850, face('happy', 0));
      this.time.delayedCall(2850, () => {
        const bang = this.add.text(this.dash.x, y - 30, '!', {
          fontFamily: MONO, fontSize: '22px', fontStyle: 'bold', color: hex(COIN_DASH.colors.coin), resolution: 2
        }).setOrigin(0.5).setScale(0);
        this.tweens.add({ targets: bang, scale: 1, duration: 220, ease: 'Back.easeOut' });
        this.tweens.add({ targets: this.dash, y: y - 10, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
      });
    }

    // 4: title card; the next key press starts the game.
    beatTitle() {
      const { W, cx } = this;
      const teal = COIN_DASH.colors.player, gold = COIN_DASH.colors.coin;
      if (this.typer) this.typer.remove();
      this.skipHint.setVisible(false);
      const dim = this.add.rectangle(cx, this.H / 2, W, this.H, INK, 1).setAlpha(0).setDepth(20);
      this.tweens.add({ targets: dim, alpha: 0.6, duration: 400 });
      const glowOf = col => ({ shadow: { offsetX: 0, offsetY: 0, color: col, blur: 14, fill: true },
        padding: { x: 12, y: 8 } });
      const title = { fontFamily: MONO, fontSize: '58px', fontStyle: 'bold', resolution: 2 };
      const coin = this.add.text(cx - 8, 186, 'COIN', Object.assign({ color: '#e9fffa' }, title, glowOf(hex(teal))))
        .setOrigin(1, 0.5);
      const dash = this.add.text(cx + 8, 186, 'DASH', Object.assign({ color: hex(gold) }, title, glowOf(hex(gold))))
        .setOrigin(0, 0.5);
      const sub = this.add.text(cx, 250, 'Grab the coins. Dodge the drones.\n3 lives. 45 seconds. Go!', {
        fontFamily: MONO, fontSize: '16px', color: '#c9d6e8', align: 'center', lineSpacing: 6, resolution: 2
      }).setOrigin(0.5);
      [coin, dash, sub].forEach((t, i) => {
        t.setDepth(21).setAlpha(0).setScale(0.85);
        this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 380, delay: i * 140, ease: 'Back.easeOut' });
      });
      this.caption.setText('Press SPACE to start  ·  P to pause');
      this.tweens.add({ targets: this.caption, alpha: { from: 1, to: 0.4 },
        duration: 800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    }

    startGame() {
      if (this.done) return;
      this.done = true;
      const cam = this.cameras.main;
      cam.fadeOut(350, 0, 0, 0);
      cam.once('camerafadeoutcomplete', () => this.scene.start('CoinDash', { skipStart: true }));
    }

    update(time) {
      const frame = ['drone', 'drone-1', 'drone-2'][Math.floor(time / 45) % 3];
      this.drones.forEach((d, k) => {
        const a = this.orbit.a + k * Math.PI * 2 / 3;
        const x = this.cx + Math.cos(a) * 200, y = this.cy + Math.sin(a) * 120;
        if (d.x || d.y) d.rotation = Math.atan2(y - d.y, x - d.x);
        d.setTexture(frame).setPosition(x, y);
        d.glow.setPosition(x, y);
      });
      if (this.dash) {
        this.dashGlow.setPosition(this.dash.x, this.dash.y);
        this.dashShadow.setX(this.dash.x);
      }
    }
  }

  window.CoinDashIntro = CoinDashIntro;
})();
