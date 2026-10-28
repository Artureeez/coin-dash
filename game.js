/* global Phaser, COIN_DASH, COIN_DASH_ART */
// Gameplay lives here. Looks live in art/ (see art/art.js); hitbox sizes below are fixed
// so changing a texture never changes how the game plays.
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create(data) {
    const c = COIN_DASH;
    const art = COIN_DASH_ART;
    art.buildTextures(this);
    // 'single', 'coop' (shared coins, own lives) or 'versus' (own coins, own lives).
    this.mode = (data && data.mode) || 'single';
    this.score = 0; // coins collected by everyone; drives level-ups in every mode
    this.best = this.loadBest();
    this.finished = false;
    this.started = false;
    this.paused = false;
    this.level = 1;
    this.droneSpeed = c.droneSpeed;
    // Drop the previous round's destroyed group so placeCoin() skips the drone check until new drones exist.
    this.drones = null;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    art.world.background(this);
    this.hud = this.add.text(18, 12, '', art.world.hudStyle).setDepth(10);
    this.levelText = this.add.text(c.width - 150, 12, 'Level 1', art.world.hudStyle)
      .setOrigin(1, 0).setDepth(10);
    this.livesText = this.add.text(c.width - 18, 12, '',
      Object.assign({}, art.world.hudStyle, { color: '#ff657a' })).setOrigin(1, 0).setDepth(10);
    const two = this.mode !== 'single';
    this.players = (two ? [c.width / 2 - 60, c.width / 2 + 60] : [c.width / 2])
      .map((x, i) => this.addPlayer(x, c.height / 2, i));
    this.player = this.players[0];
    this.updateLives();
    this.coin = this.physics.add.image(100, 100, 'coin');
    this.coin.body.setCircle(9, this.coin.width / 2 - 9, this.coin.height / 2 - 9);
    this.placeCoin();
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const angle = (35 + i * 105) * Math.PI / 180;
      this.addDrone(90 + i * 270, 100, angle, c.droneSpeed);
    }
    this.players.forEach(p => {
      this.physics.add.overlap(p, this.coin, () => this.collectCoin(p));
      this.physics.add.overlap(p, this.drones, (player, drone) => this.hitByDrone(drone, player));
    });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    const wasd = { up: this.keys.W, down: this.keys.S, left: this.keys.A, right: this.keys.D };
    // Two players split the keyboard; alone, either set works.
    if (two) [this.players[0].controls, this.players[1].controls] = [[wasd], [this.cursors]];
    else this.player.controls = [wasd, this.cursors];
    this.input.keyboard.on('keydown-R', () => this.scene.restart({ skipStart: true, mode: this.mode }));
    this.input.keyboard.on('keydown-SPACE', () => this.startRound());
    this.input.keyboard.on('keydown-ENTER', () => this.startRound());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    ['ONE', 'TWO', 'THREE'].forEach((key, i) =>
      this.input.keyboard.on('keydown-' + key, () => this.chooseMode(['single', 'coop', 'versus'][i])));
    art.emit('create', this);
    // First load waits on a start screen; R restarts straight into play.
    if (data && data.skipStart) this.startRound();
    else {
      this.physics.pause();
      this.showOverlay('COIN DASH\nSPACE or 1: solo  2: co-op  3: versus\n2P: P1 WASD, P2 arrows · P pauses');
    }
  }

  // Lives, coins and invulnerability live on each player, so co-op and versus need no extra bookkeeping.
  addPlayer(x, y, index) {
    const p = this.physics.add.image(x, y, 'player');
    p.body.setSize(24, 24);
    p.body.setCollideWorldBounds(true);
    return Object.assign(p, { index, lives: COIN_DASH.lives, score: 0, invulnerableUntil: 0, out: false, dx: 0, dy: 0 });
  }

  livePlayers() { return this.players.filter(p => !p.out); }

  // Players are built in create(), so picking a different mode needs a fresh scene.
  chooseMode(mode) {
    if (this.started) return;
    if (mode === this.mode) this.startRound();
    else this.scene.restart({ skipStart: true, mode });
  }

  // New drones are announced to art/ so they get the same look as the starting ones.
  addDrone(x, y, angle, speed) {
    const drone = this.add.image(x, y, 'drone');
    this.drones.add(drone);
    drone.body.setSize(26, 26);
    drone.body.setCollideWorldBounds(true).setBounce(1, 1);
    drone.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    COIN_DASH_ART.emit('drone', this, { drone });
    return drone;
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
    this.hideOverlay();
    this.overlay = COIN_DASH_ART.world.overlay(this, message);
  }

  hideOverlay() {
    if (this.overlay) this.overlay.forEach((item) => item.destroy());
    this.overlay = null;
  }

  collectCoin(p) {
    if (this.finished || p.out) return;
    this.score++;
    p.score++;
    // Versus effects follow the collector's own tally; otherwise the team's.
    const score = this.mode === 'versus' ? p.score : this.score;
    COIN_DASH_ART.emit('coin', this, { x: this.coin.x, y: this.coin.y, score, player: p });
    if (this.score % COIN_DASH.coinsPerLevel === 0) this.levelUp();
    this.placeCoin();
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath a player.
    let x, y, attempts = 0;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while ((this.nearPlayer(x, y, 60) || this.nearDrone(x, y, 40)) && ++attempts < 50);
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

  nearPlayer(x, y, radius) {
    return this.livePlayers().some(p => Phaser.Math.Distance.Between(x, y, p.x, p.y) < radius);
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
    // Spawn the new drone well away from the players.
    let x, y, attempts = 0;
    do {
      x = Phaser.Math.Between(30, c.width - 30);
      y = Phaser.Math.Between(75, c.height - 30);
    } while (this.nearPlayer(x, y, 150) && ++attempts < 50);
    this.addDrone(x, y, Phaser.Math.FloatBetween(0, Math.PI * 2), this.droneSpeed);
  }

  hitByDrone(drone, p = this.player) {
    if (this.finished || p.out || this.time.now < p.invulnerableUntil) return;
    p.lives--;
    // fatal = this player is out; the round only ends once nobody is left.
    const fatal = p.lives <= 0;
    if (fatal) {
      p.out = true;
      p.body.stop();
      p.body.enable = false;
    }
    this.updateLives();
    const roundOver = this.livePlayers().length === 0;
    // Brief invulnerability so one touch costs only one life; art/ blinks the player meanwhile.
    const ms = COIN_DASH.invulnerableMs;
    if (!fatal) p.invulnerableUntil = this.time.now + ms;
    COIN_DASH_ART.emit('hit', this, { drone, player: p, lives: p.lives, fatal, roundOver, invulnerableMs: ms });
    if (roundOver) this.finish(this.mode === 'single' ? 'A drone caught you!' : 'Both players are out!');
  }

  updateLives() {
    const hearts = p => p.out ? 'out' : '♥'.repeat(p.lives);
    this.lives = this.player.lives; // single-player view, kept for older readers of scene.lives
    this.livesText.setText(this.mode === 'single'
      ? 'Lives: ' + hearts(this.player)
      : this.players.map(p => `P${p.index + 1} ${hearts(p)}`).join('  '));
    // Two lives readouts are wider, so keep the level label clear of them.
    this.levelText.setX(this.livesText.x - this.livesText.width - 24);
  }

  update(time, delta) {
    if (this.finished) return;
    const active = this.started && !this.paused;
    const seconds = this.started
      ? Math.max(0, Math.ceil((this.deadline - (this.paused ? this.pausedAt : this.time.now)) / 1000))
      : COIN_DASH.roundSeconds;
    if (active) {
      this.livePlayers().forEach(p => {
        const held = dir => p.controls.some(k => k[dir].isDown);
        p.dx = Number(held('right')) - Number(held('left'));
        p.dy = Number(held('down')) - Number(held('up'));
        const direction = new Phaser.Math.Vector2(p.dx, p.dy).normalize().scale(COIN_DASH.playerSpeed);
        p.body.setVelocity(direction.x, direction.y);
      });
    }
    const [p1, p2] = this.players;
    this.hud.setText(this.mode === 'single'
      ? `Coins: ${this.score}   Best: ${Math.max(this.best, this.score)}   Time: ${seconds}s`
      : this.mode === 'coop' ? `Team coins: ${this.score}   Time: ${seconds}s`
        : `P1: ${p1.score}   P2: ${p2.score}   Time: ${seconds}s`);
    // Art keeps animating on the start screen; while paused it holds still.
    // Each player's dx/dy is on its sprite; the payload keeps player 1's for older handlers.
    if (!this.paused) COIN_DASH_ART.emit('update', this, { time, delta, seconds, dx: p1.dx, dy: p1.dy });
    if (active && seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    if (this.mode !== 'single') return this.finishTwoPlayer(reason);
    const newBest = this.score > this.best;
    if (newBest) {
      this.best = this.score;
      this.saveBest(this.best);
    }
    COIN_DASH_ART.emit('finish', this, { reason, score: this.score, best: this.best, newBest, mode: this.mode });
    COIN_DASH_ART.world.finishPanel(this,
      `${reason}\n${this.score} coins collected\nBest: ${this.best}\n`
        + `${newBest ? 'New high score!\n' : ''}Press R to try again`);
  }

  // Two-player rounds never touch the single-player high score.
  finishTwoPlayer(reason) {
    const [p1, p2] = this.players;
    const mode = this.mode;
    const winner = mode === 'versus' && p1.score !== p2.score ? (p1.score > p2.score ? p1 : p2) : null;
    COIN_DASH_ART.emit('finish', this, { reason, score: this.score, best: this.best, newBest: false, mode, winner });
    const again = `Press R to play ${mode === 'coop' ? 'co-op' : 'versus'} again`;
    COIN_DASH_ART.world.finishPanel(this, mode === 'coop'
      ? `${reason}\n${this.score} coins as a team\n${again}`
      : `${winner ? `Player ${winner.index + 1} wins!` : "It's a tie!"}\n`
        + `P1 ${p1.score} : ${p2.score} P2\n${reason}\n${again}`);
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
