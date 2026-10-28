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
    this.bestBy = this.loadText(c.highScoreNameKey);
    // Names ride along on restart so R never asks again; first load pre-fills the last ones used.
    this.names = (data && data.names) || this.loadNames();
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
    this.input.keyboard.on('keydown-R', () => {
      this.confirmNames();
      this.scene.restart({ skipStart: true, names: this.names });
    });
    this.input.keyboard.on('keydown-SPACE', () => this.startRound());
    this.input.keyboard.on('keydown-ENTER', () => this.startRound());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    art.emit('create', this);
    // First load waits on a start screen; R restarts straight into play.
    if (data && data.skipStart) this.startRound();
    else {
      this.physics.pause();
      this.showOverlay('COIN DASH\nType your name, then press ENTER\n'
        + (this.best ? `Best: ${this.best}${this.byLine()}   ` : '') + 'P pauses');
      this.showNameEntry(1);
    }
    this.events.once('shutdown', () => this.removeNameEntry());
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
    this.confirmNames();
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

  // Name entry is an HTML <input> over the canvas, so any keyboard layout or IME just works.
  // One field per player: a second player's name is showNameEntry(2).
  showNameEntry(count) {
    const box = document.createElement('div');
    box.className = 'name-entry';
    this.nameInputs = [];
    for (let i = 0; i < count; i++) {
      const label = document.createElement('label');
      label.textContent = count > 1 ? `Player ${i + 1}` : 'Your name';
      const input = document.createElement('input');
      Object.assign(input, { type: 'text', maxLength: COIN_DASH.nameMaxLength, value: this.names[i] || '',
        placeholder: this.defaultName(i, count), autocomplete: 'off', spellcheck: false });
      label.appendChild(input);
      box.appendChild(label);
      this.nameInputs.push(input);
    }
    // Phaser hears keys on window; stopping them here keeps typed letters (R, P, SPACE...) out of the game.
    ['keydown', 'keyup', 'keypress'].forEach(type => box.addEventListener(type, (e) => {
      e.stopPropagation();
      if (type === 'keydown' && e.key === 'Enter') { e.preventDefault(); this.startRound(); }
    }));
    document.getElementById('game').appendChild(box);
    this.nameEntry = box;
    this.nameInputs[0].focus();
    this.nameInputs[0].select();
  }

  removeNameEntry() {
    if (this.nameEntry) this.nameEntry.remove();
    this.nameEntry = this.nameInputs = null;
  }

  // Reads the fields if still up (ENTER, SPACE after clicking away, or R), then remembers them.
  confirmNames() {
    if (!this.nameInputs) return;
    const count = this.nameInputs.length;
    this.names = this.nameInputs.map((input, i) =>
      input.value.replace(/\s+/g, ' ').trim().slice(0, COIN_DASH.nameMaxLength) || this.defaultName(i, count));
    this.saveText(COIN_DASH.playerNamesKey, JSON.stringify(this.names));
    this.removeNameEntry();
  }

  defaultName(i, count) { return count > 1 ? `Player ${i + 1}` : 'Player'; }

  playerLabel() { return this.names.join(' & ') || 'Player'; }

  byLine() { return this.bestBy ? ` by ${this.bestBy}` : ''; }

  loadNames() {
    try {
      const names = JSON.parse(this.loadText(COIN_DASH.playerNamesKey) || '[]');
      return Array.isArray(names) ? names.map(String) : [];
    } catch (e) {
      return []; // corrupt entry; start blank
    }
  }

  // Same storage caveats as loadBest/saveBest.
  loadText(key) {
    try { return window.localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  saveText(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* keep in memory only */ }
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
    this.addDrone(x, y, Phaser.Math.FloatBetween(0, Math.PI * 2), this.droneSpeed);
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
    }
    this.hud.setText(`${this.playerLabel()}  Coins: ${this.score}   Best: ${Math.max(this.best, this.score)}   Time: ${seconds}s`);
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
      this.bestBy = this.playerLabel();
      this.saveBest(this.best);
      this.saveText(COIN_DASH.highScoreNameKey, this.bestBy);
    }
    COIN_DASH_ART.emit('finish', this, { reason, score: this.score, best: this.best, newBest });
    COIN_DASH_ART.world.finishPanel(this,
      `${reason}\n${this.score} coins by ${this.playerLabel()}\nBest: ${this.best}${this.byLine()}\n`
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
