/* global Phaser, COIN_DASH, COIN_DASH_ART */
// Gameplay lives here. Looks live in art/ (see art/art.js); hitbox sizes below are fixed
// so changing a texture never changes how the game plays.
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create(data) {
    const c = COIN_DASH;
    const art = COIN_DASH_ART;
    art.buildTextures(this);
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
    art.world.background(this);
    this.hud = this.add.text(18, 12, '', art.world.hudStyle).setDepth(10);
    this.levelText = this.add.text(c.width - 150, 12, 'Level 1', art.world.hudStyle)
      .setOrigin(1, 0).setDepth(10);
    this.livesText = this.add.text(c.width - 18, 12, '',
      Object.assign({}, art.world.hudStyle, { color: '#ff657a' })).setOrigin(1, 0).setDepth(10);
    this.updateLives();
    this.player = this.physics.add.image(c.width / 2, c.height / 2, 'player');
    this.player.body.setSize(24, 24);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.physics.add.image(100, 100, 'coin');
    this.coin.body.setCircle(9, this.coin.width / 2 - 9, this.coin.height / 2 - 9);
    this.placeCoin();
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const angle = (35 + i * 105) * Math.PI / 180;
      this.addDrone(90 + i * 270, 100, angle, c.droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      art.emit('coin', this, { x: this.coin.x, y: this.coin.y, score: this.score });
      if (this.score % c.coinsPerLevel === 0) this.levelUp();
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, (player, drone) => this.hitByDrone(drone));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart({ skipStart: true }));
    this.input.keyboard.on('keydown-SPACE', () => this.startRound());
    this.input.keyboard.on('keydown-ENTER', () => this.startRound());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    art.emit('create', this);
    // First load waits on a start screen; R restarts straight into play.
    if (data && data.skipStart) this.startRound();
    else {
      this.physics.pause();
      this.overlay = COIN_DASH_ART.world.rulesScreen(this, {
        title: 'COIN DASH', best: this.best, rules: this.rules(), controls: this.controls(),
        prompt: 'Press SPACE or ENTER to start'
      });
    }
  }

  // Start-screen text as data, built from settings so it stays true when tuning changes.
  // icon is a texture key or a short glyph; append entries here as features land.
  rules() {
    const c = COIN_DASH;
    return [
      { icon: 'coin', text: `Collect as many coins as you can in ${c.roundSeconds} seconds.` },
      { icon: 'drone', text: 'Dodge the drones: every touch costs a life.' },
      { icon: '♥', text: `${c.lives} lives. After a hit you are safe for ${c.invulnerableMs / 1000}s.` },
      { icon: '▲', text: `Every ${c.coinsPerLevel} coins: level up. Drones get faster`
        + ` and one more joins, up to ${c.maxDrones}.` }
    ];
  }

  // Key caps shown under the rules: keys are drawn on caps, label says what they do.
  controls() {
    return [
      { keys: ['←↑↓→', 'WASD'], label: 'move' },
      { keys: ['P'], label: 'pause' },
      { keys: ['R'], label: 'restart' }
    ];
  }

  // New drones are announced to art/ so they get the same look as the starting ones.
  addDrone(x, y, angle, speed) {
    const drone = this.add.image(x, y, 'drone');
    this.drones.add(drone);
    drone.body.setSize(26, 26);
    drone.body.setCollideWorldBounds(true).setBounce(1, 1);
    drone.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    // Per-drone quirks so the pack spreads out instead of tracing identical paths.
    const j = COIN_DASH.droneTurnJitter;
    drone.steerTurn = COIN_DASH.droneTurnRate * Phaser.Math.FloatBetween(1 - j, 1 + j);
    drone.steerPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    COIN_DASH_ART.emit('drone', this, { drone });
    return drone;
  }

  startRound() {
    if (this.started) return;
    this.started = true;
    this.deadline = this.time.now + COIN_DASH.roundSeconds * 1000;
    this.hideOverlay();
    this.physics.resume();
    COIN_DASH_ART.emit('start', this, {});
  }

  togglePause() {
    if (!this.started || this.finished) return;
    this.paused = !this.paused;
    COIN_DASH_ART.emit('pause', this, { paused: this.paused });
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
    this.hideOverlay();
    this.overlay = COIN_DASH_ART.world.overlay(this, message);
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
    COIN_DASH_ART.emit('levelup', this, { level: this.level });
    this.droneSpeed *= c.droneSpeedBoost;
    this.drones.getChildren().forEach(d => d.body.velocity.scale(c.droneSpeedBoost));
    if (this.drones.getLength() >= c.maxDrones) return;
    // Spawn the new drone well away from the player.
    let x, y, attempts = 0;
    do {
      x = Phaser.Math.Between(30, c.width - 30);
      y = Phaser.Math.Between(75, c.height - 30);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 150 && ++attempts < 50);
    this.addDrone(x, y, Phaser.Math.FloatBetween(0, Math.PI * 2), this.droneSpeed);
  }

  // Single place that decides who a drone chases.
  droneTarget(drone) {
    return this.player;
  }

  // Turn each drone's heading toward its target at a capped rate, keeping speed at droneSpeed.
  // The random push from addDrone() is the starting heading; world-bound bounces still apply.
  steerDrones(time, delta) {
    const c = COIN_DASH;
    const dt = Math.min(delta, 50) / 1000; // a long frame after a tab switch shouldn't snap headings
    const drones = this.drones.getChildren();
    drones.forEach(drone => {
      const target = this.droneTarget(drone);
      if (!target) return;
      const want = new Phaser.Math.Vector2(target.x - drone.x, target.y - drone.y).normalize();
      // Push away from close neighbours, stronger the closer they are.
      drones.forEach(other => {
        if (other === drone) return;
        const d = Phaser.Math.Distance.Between(drone.x, drone.y, other.x, other.y);
        if (d > 0 && d < c.droneSeparation) {
          const push = c.droneSeparationWeight * (1 - d / c.droneSeparation) / d;
          want.x += (drone.x - other.x) * push;
          want.y += (drone.y - other.y) * push;
        }
      });
      const goal = Math.atan2(want.y, want.x) + Math.sin(time / 600 + drone.steerPhase) * c.droneWobble;
      const v = drone.body.velocity;
      const heading = Phaser.Math.Angle.RotateTo(Math.atan2(v.y, v.x), goal, drone.steerTurn * dt);
      drone.body.setVelocity(Math.cos(heading) * this.droneSpeed, Math.sin(heading) * this.droneSpeed);
    });
  }

  hitByDrone(drone) {
    if (this.finished || this.time.now < this.invulnerableUntil) return;
    this.lives--;
    this.updateLives();
    const fatal = this.lives <= 0;
    // Brief invulnerability so one touch costs only one life; art/ blinks the player meanwhile.
    const ms = COIN_DASH.invulnerableMs;
    if (!fatal) this.invulnerableUntil = this.time.now + ms;
    COIN_DASH_ART.emit('hit', this, { drone, lives: this.lives, fatal, invulnerableMs: ms });
    if (fatal) this.finish('A drone caught you!');
  }

  updateLives() {
    this.livesText.setText('Lives: ' + '♥'.repeat(Math.max(0, this.lives)));
  }

  update(time, delta) {
    if (this.finished) return;
    const active = this.started && !this.paused;
    const seconds = this.started
      ? Math.max(0, Math.ceil((this.deadline - (this.paused ? this.pausedAt : this.time.now)) / 1000))
      : COIN_DASH.roundSeconds;
    let dx = 0, dy = 0;
    if (active) {
      dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
        - Number(this.cursors.left.isDown || this.keys.A.isDown);
      dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
        - Number(this.cursors.up.isDown || this.keys.W.isDown);
      const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
      this.player.body.setVelocity(direction.x, direction.y);
      this.steerDrones(time, delta);
    }
    this.hud.setText(`Coins: ${this.score}   Best: ${Math.max(this.best, this.score)}   Time: ${seconds}s`);
    // Art keeps animating on the start screen; while paused it holds still.
    if (!this.paused) COIN_DASH_ART.emit('update', this, { time, delta, seconds, dx, dy });
    if (active && seconds === 0) this.finish('Time is up!');
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
    COIN_DASH_ART.emit('finish', this, { reason, score: this.score, best: this.best, newBest });
    COIN_DASH_ART.world.finishPanel(this,
      `${reason}\n${this.score} coins collected\nBest: ${this.best}\n`
        + `${newBest ? 'New high score!\n' : ''}Press R to try again`);
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
