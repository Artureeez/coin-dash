/* global Phaser, COIN_DASH */
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create(data) {
    const c = COIN_DASH;
    this.score = 0;
    this.best = this.loadBest();
    this.finished = false;
    this.started = false;
    this.paused = false;
    this.level = 1;
    this.droneSpeed = c.droneSpeed;
    this.lives = c.lives;
    this.invulnerableUntil = 0;
    // Drop the previous round's destroyed group so placeCoin() skips the drone check until new drones exist.
    this.drones = null;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.levelText = this.add.text(c.width - 150, 12, 'Level 1', { font: '18px monospace', color: '#ffffff' })
      .setOrigin(1, 0);
    this.livesText = this.add.text(c.width - 18, 12, '', { font: '18px monospace', color: '#ff657a' })
      .setOrigin(1, 0);
    this.updateLives();
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.pulseCoin();
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      this.coinBurst(this.coin.x, this.coin.y);
      if (this.score % c.coinsPerLevel === 0) this.levelUp();
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => this.hitByDrone());
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart({ skipStart: true }));
    this.input.keyboard.on('keydown-SPACE', () => this.startRound());
    this.input.keyboard.on('keydown-ENTER', () => this.startRound());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    // First load waits on a start screen; R restarts straight into play.
    if (data && data.skipStart) this.startRound();
    else {
      this.physics.pause();
      this.showOverlay('COIN DASH\nPress SPACE or ENTER to start\nP pauses');
    }
  }

  startRound() {
    if (this.started) return;
    this.started = true;
    this.deadline = this.time.now + COIN_DASH.roundSeconds * 1000;
    this.hideOverlay();
    this.physics.resume();
  }

  togglePause() {
    if (!this.started || this.finished) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.pausedAt = this.time.now;
      this.physics.pause();
      this.showOverlay('Paused\nPress P to resume');
    } else {
      // Shift the deadline so time spent paused is not lost.
      this.deadline += this.time.now - this.pausedAt;
      this.hideOverlay();
      this.physics.resume();
    }
  }

  showOverlay(message) {
    const c = COIN_DASH;
    this.hideOverlay();
    this.overlay = [
      this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95),
      this.add.text(c.width / 2, c.height / 2, message,
        { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }).setOrigin(0.5)
    ];
  }

  hideOverlay() {
    if (this.overlay) this.overlay.forEach((item) => item.destroy());
    this.overlay = null;
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath the player.
    let x, y, attempts = 0;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while ((Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60
      || this.nearDrone(x, y, 40)) && ++attempts < 50);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  loadBest() {
    // Storage can be blocked (private mode, file:// policies), so fall back to 0.
    try {
      return Number(window.localStorage.getItem(COIN_DASH.highScoreKey)) || 0;
    } catch (e) {
      return 0;
    }
  }

  saveBest(value) {
    try {
      window.localStorage.setItem(COIN_DASH.highScoreKey, String(value));
    } catch (e) { /* storage unavailable; keep the in-memory best only */ }
  }

  nearDrone(x, y, radius) {
    // Drones don't exist yet when the first coin is placed in create().
    if (!this.drones) return false;
    return this.drones.getChildren().some(d => Phaser.Math.Distance.Between(x, y, d.x, d.y) < radius);
  }

  levelUp() {
    const c = COIN_DASH;
    this.level++;
    this.levelText.setText(`Level ${this.level}`);
    this.droneSpeed *= c.droneSpeedBoost;
    this.drones.getChildren().forEach(d => d.body.velocity.scale(c.droneSpeedBoost));
    if (this.drones.getLength() >= c.maxDrones) return;
    // Spawn the new drone well away from the player.
    let x, y, attempts = 0;
    do {
      x = Phaser.Math.Between(30, c.width - 30);
      y = Phaser.Math.Between(75, c.height - 30);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 150 && ++attempts < 50);
    const drone = this.add.rectangle(x, y, 26, 26, c.colors.drone);
    this.drones.add(drone);
    drone.body.setCollideWorldBounds(true).setBounce(1, 1);
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    drone.body.setVelocity(Math.cos(angle) * this.droneSpeed, Math.sin(angle) * this.droneSpeed);
  }

  hitByDrone() {
    if (this.finished || this.time.now < this.invulnerableUntil) return;
    this.hitFeedback();
    this.lives--;
    this.updateLives();
    if (this.lives <= 0) return this.finish('A drone caught you!');
    // Brief invulnerability so one touch costs only one life; the player blinks meanwhile.
    const ms = COIN_DASH.invulnerableMs;
    this.invulnerableUntil = this.time.now + ms;
    this.tweens.add({
      targets: this.player, alpha: 0.2, duration: 125, yoyo: true,
      repeat: Math.max(0, Math.round(ms / 250) - 1),
      onComplete: () => this.player.setAlpha(1)
    });
  }

  updateLives() {
    this.livesText.setText('Lives: ' + '\u2665'.repeat(Math.max(0, this.lives)));
  }

  pulseCoin() {
    this.tweens.add({ targets: this.coin, scale: 1.18, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  coinBurst(x, y) {
    if (!this.textures.exists('spark')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4).generateTexture('spark', 8, 8);
      g.destroy();
    }
    const burst = this.add.particles(x, y, 'spark', {
      speed: { min: 70, max: 190 }, scale: { start: 1.2, end: 0 }, alpha: { start: 1, end: 0 },
      lifespan: 420, tint: COIN_DASH.colors.coin, emitting: false
    });
    burst.explode(14);
    this.time.delayedCall(500, () => burst.destroy());
    const label = this.add.text(x, y - 12, '+1', { font: 'bold 18px monospace', color: '#ffd166' }).setOrigin(0.5);
    this.tweens.add({ targets: label, y: y - 48, alpha: { value: 0, delay: 250, duration: 400 }, duration: 650, ease: 'Cubic.easeOut',
      onComplete: () => label.destroy() });
  }

  hitFeedback() {
    if (this.finished) return;
    this.cameras.main.shake(250, 0.012);
    this.cameras.main.flash(180, 255, 60, 80);
  }

  update() {
    if (this.finished || !this.started || this.paused) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`Coins: ${this.score}   Best: ${Math.max(this.best, this.score)}           Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const newBest = this.score > this.best;
    if (newBest) {
      this.best = this.score;
      this.saveBest(this.best);
    }
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, newBest ? 250 : 210, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\nBest: ${this.best}\n`
        + `${newBest ? 'New high score!\n' : ''}Press R to try again`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});
