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
    this.bestBy = this.loadText(c.highScoreNameKey);
    // Names ride along on restart so R never asks again; first load pre-fills the last ones used.
    this.names = (data && data.names) || this.loadNames();
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
    this.obstacles = this.physics.add.staticGroup();
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
    this.physics.add.collider(this.players, this.obstacles);
    this.physics.add.collider(this.drones, this.obstacles);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    const wasd = { up: this.keys.W, down: this.keys.S, left: this.keys.A, right: this.keys.D };
    // Two players split the keyboard; alone, either set works.
    if (two) [this.players[0].controls, this.players[1].controls] = [[wasd], [this.cursors]];
    else this.player.controls = [wasd, this.cursors];
    this.input.keyboard.on('keydown-R', () => {
      this.confirmNames();
      this.scene.restart({ skipStart: true, mode: this.mode, names: this.names });
    });
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
      // The prompt line is left empty: the HTML name entry and mode buttons sit in its place.
      this.overlay = COIN_DASH_ART.world.rulesScreen(this, {
        title: 'COIN DASH', best: `${this.best}${this.byLine().toUpperCase()}`,
        rules: this.rules(), controls: this.controls(), prompt: ''
      });
      this.showNameEntry(this.players.length);
    }
    this.events.once('shutdown', () => this.removeNameEntry());
  }

  // Start-screen text as data, built from settings so it stays true when tuning changes.
  // icon is a texture key or a short glyph; append entries here as features land.
  rules() {
    const c = COIN_DASH;
    return [
      { icon: 'coin', text: `Collect as many coins as you can in ${c.roundSeconds} seconds.` },
      { icon: 'drone', text: 'Drones hunt you down: every touch costs a life.' },
      { icon: '♥', text: `${c.lives} lives. After a hit you are safe for ${c.invulnerableMs / 1000}s.` },
      { icon: '▲', text: `Every ${c.coinsPerLevel} coins: level up. Drones get faster`
        + ` and one more joins, up to ${c.maxDrones}.` },
      { icon: 'obstacle-2', text: `From level ${c.obstacleStartLevel}, walls appear. Nobody gets through them.` },
      { icon: 'player', text: 'Co-op: share the coins. Versus: most coins wins. P1 WASD, P2 arrows.' }
    ];
  }

  // Key caps shown under the rules: keys are drawn on caps, label says what they do.
  controls() {
    return [
      { keys: ['←↑↓→', 'WASD'], label: 'move' },
      { keys: ['P'], label: 'pause' },
      { keys: ['R'], label: 'restart' },
      { keys: ['M'], label: 'mute' }
    ];
  }

  // Lives, coins and invulnerability live on each player, so co-op and versus need no extra bookkeeping.
  addPlayer(x, y, index) {
    const p = this.physics.add.image(x, y, 'player');
    p.body.setSize(24, 24);
    p.body.setCollideWorldBounds(true);
    return Object.assign(p, { index, lives: COIN_DASH.lives, score: 0, invulnerableUntil: 0, out: false, dx: 0, dy: 0 });
  }

  livePlayers() { return this.players.filter(p => !p.out); }

  // Players are built in create(), so picking a different mode needs a fresh scene. It reopens
  // the start screen so the second player can type a name before the round begins.
  chooseMode(mode) {
    if (this.started || mode === this.mode) return;
    this.confirmNames();
    this.scene.restart({ mode, names: this.names });
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
    this.confirmNames();
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
    } while ((this.nearPlayer(x, y, 60) || this.nearDrone(x, y, 40) || this.nearObstacle(x, y, 28))
      && ++attempts < 50);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  // Name entry is an HTML <input> over the canvas, so any keyboard layout or IME just works.
  // One field per player, plus clickable mode buttons: 1/2/3 typed into a field stay part of the name.
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
    const modes = document.createElement('div');
    modes.className = 'modes';
    [['single', 'Solo'], ['coop', 'Co-op'], ['versus', 'Versus']].forEach(([mode, text], i) => {
      const button = document.createElement('button');
      Object.assign(button, { type: 'button', textContent: `${i + 1} ${text}`, title: `Press ${i + 1}` });
      if (mode === this.mode) button.className = 'active';
      button.addEventListener('click', () => this.chooseMode(mode));
      modes.appendChild(button);
    });
    const start = document.createElement('button');
    Object.assign(start, { type: 'button', className: 'start', textContent: '▶ Enter' });
    start.addEventListener('click', () => this.startRound());
    modes.appendChild(start);
    box.appendChild(modes);
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
    // Solo shows one field; keep player 2's saved name for the next two-player round.
    // Blank stays blank so the field shows the right placeholder ("Player" / "Player 1") next time.
    this.names = this.names.slice();
    this.nameInputs.forEach((input, i) => {
      this.names[i] = input.value.replace(/\s+/g, ' ').trim().slice(0, COIN_DASH.nameMaxLength);
    });
    this.saveText(COIN_DASH.playerNamesKey, JSON.stringify(this.names));
    this.removeNameEntry();
  }

  defaultName(i, count) { return count > 1 ? `Player ${i + 1}` : 'Player'; }

  nameOf(p) { return this.names[p.index] || this.defaultName(p.index, this.players.length); }

  playerLabel() { return this.players.map(p => this.nameOf(p)).join(' & '); }

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

  nearPlayer(x, y, radius) {
    return this.livePlayers().some(p => Phaser.Math.Distance.Between(x, y, p.x, p.y) < radius);
  }

  nearDrone(x, y, radius) {
    // Drones don't exist yet when the first coin is placed in create().
    if (!this.drones) return false;
    return this.drones.getChildren().some(d => Phaser.Math.Distance.Between(x, y, d.x, d.y) < radius);
  }

  // Distance from a point to the nearest wall's edge (0 if inside), so checks respect wall shape.
  nearObstacle(x, y, radius) {
    return this.obstacles.getChildren().some(o => {
      const b = o.body;
      const dx = Math.max(b.x - x, 0, x - b.right), dy = Math.max(b.y - y, 0, y - b.bottom);
      return dx * dx + dy * dy < radius * radius;
    });
  }

  // Walls stay a gap apart from each other and the arena edges, so the open floor is always
  // one connected region the player fits through; nothing can be boxed in.
  addObstacles(count) {
    const c = COIN_DASH, gap = c.obstacleGap;
    for (let n = 0; n < count && this.obstacles.getLength() < c.maxObstacles; n++) {
      const kind = Phaser.Math.Between(0, c.obstacleSizes.length - 1);
      const [w, h] = c.obstacleSizes[kind];
      let x, y, ok = false;
      for (let attempts = 0; attempts < 60 && !ok; attempts++) {
        x = Phaser.Math.Between(gap + w / 2, c.width - gap - w / 2);
        y = Phaser.Math.Between(44 + gap + h / 2, c.height - gap - h / 2);
        // Grow the candidate by a margin and test what falls inside it.
        const zone = d => new Phaser.Geom.Rectangle(x - w / 2 - d, y - h / 2 - d, w + d * 2, h + d * 2);
        const near = (px, py, d) => zone(d).contains(px, py);
        const spaced = zone(gap);
        ok = !this.livePlayers().some(p => near(p.x, p.y, c.obstacleClearance))
          && !this.drones.getChildren().some(d => near(d.x, d.y, 60))
          && !near(this.coin.x, this.coin.y, 40)
          && !this.obstacles.getChildren().some(o => Phaser.Geom.Intersects.RectangleToRectangle(spaced,
            new Phaser.Geom.Rectangle(o.body.x, o.body.y, o.body.width, o.body.height)));
      }
      if (!ok) continue; // crowded arena: skip this wall rather than force an unfair spot
      const obstacle = this.obstacles.create(x, y, `obstacle-${kind}`);
      // Texture includes a glow margin; the wall itself is exactly w x h.
      obstacle.body.setSize(w, h);
      COIN_DASH_ART.emit('obstacle', this, { obstacle });
    }
  }

  levelUp() {
    const c = COIN_DASH;
    this.level++;
    this.levelText.setText(`Level ${this.level}`);
    COIN_DASH_ART.emit('levelup', this, { level: this.level });
    this.droneSpeed *= c.droneSpeedBoost;
    this.drones.getChildren().forEach(d => d.body.velocity.scale(c.droneSpeedBoost));
    if (this.level >= c.obstacleStartLevel) {
      this.addObstacles(this.level === c.obstacleStartLevel ? c.obstaclesFirst : c.obstaclesPerLevel);
    }
    if (this.drones.getLength() >= c.maxDrones) return;
    // Spawn the new drone well away from the players.
    let x, y, attempts = 0;
    do {
      x = Phaser.Math.Between(30, c.width - 30);
      y = Phaser.Math.Between(75, c.height - 30);
    } while ((this.nearPlayer(x, y, 150) || this.nearObstacle(x, y, 30)) && ++attempts < 50);
    this.addDrone(x, y, Phaser.Math.FloatBetween(0, Math.PI * 2), this.droneSpeed);
  }

  // Single place that decides who a drone chases: the nearest player still in the round.
  droneTarget(drone) {
    let best = null, bestDist = Infinity;
    this.livePlayers().forEach(p => {
      const d = Phaser.Math.Distance.Between(drone.x, drone.y, p.x, p.y);
      if (d < bestDist) { best = p; bestDist = d; }
    });
    return best;
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
      this.steerDrones(time, delta);
    }
    const [p1, p2] = this.players;
    this.hud.setText(this.mode === 'single'
      ? `${this.nameOf(p1)}  Coins: ${this.score}   Best: ${Math.max(this.best, this.score)}   Time: ${seconds}s`
      : this.mode === 'coop' ? `Team coins: ${this.score}   Time: ${seconds}s`
        : `${this.nameOf(p1)}: ${p1.score}   ${this.nameOf(p2)}: ${p2.score}   Time: ${seconds}s`);
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
      this.bestBy = this.playerLabel();
      this.saveBest(this.best);
      this.saveText(COIN_DASH.highScoreNameKey, this.bestBy);
    }
    COIN_DASH_ART.emit('finish', this, { reason, score: this.score, best: this.best, newBest, mode: this.mode });
    COIN_DASH_ART.world.finishPanel(this,
      `${reason}\n${this.score} coins by ${this.playerLabel()}\nBest: ${this.best}${this.byLine()}\n`
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
      ? `${reason}\n${this.score} coins by ${this.playerLabel()}\n${again}`
      : `${winner ? `${this.nameOf(winner)} wins!` : "It's a tie!"}\n`
        + `${this.nameOf(p1)} ${p1.score} : ${p2.score} ${this.nameOf(p2)}\n${reason}\n${again}`);
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
  // The intro cutscene (art/intro.js) plays first when it is loaded, then starts CoinDash.
  scene: [window.CoinDashIntro, CoinDash].filter(Boolean)
});
