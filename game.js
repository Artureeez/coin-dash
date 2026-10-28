/* global Phaser, COIN_DASH, COIN_DASH_ART */
// Gameplay lives here. Looks live in art/ (see art/art.js); hitbox sizes below are fixed
// so changing a texture never changes how the game plays.
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    const art = COIN_DASH_ART;
    art.buildTextures(this);
    this.score = 0;
    this.finished = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    art.world.background(this);
    this.hud = this.add.text(18, 12, '', art.world.hudStyle).setDepth(10);
    this.player = this.physics.add.image(c.width / 2, c.height / 2, 'player');
    this.player.body.setSize(24, 24);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.physics.add.image(100, 100, 'coin');
    this.coin.body.setCircle(9, this.coin.width / 2 - 9, this.coin.height / 2 - 9);
    this.placeCoin();
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.image(90 + i * 270, 100, 'drone');
      this.drones.add(drone);
      drone.body.setSize(26, 26);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      art.emit('coin', this, { x: this.coin.x, y: this.coin.y, score: this.score });
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, (player, drone) => {
      if (this.finished) return;
      art.emit('hit', this, { drone });
      this.finish('A drone caught you!');
    });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    art.emit('create', this);
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  update(time, delta) {
    if (this.finished) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`Coins: ${this.score}                       Time: ${seconds}s`);
    COIN_DASH_ART.emit('update', this, { time, delta, seconds, dx, dy });
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    COIN_DASH_ART.emit('finish', this, { reason, score: this.score });
    COIN_DASH_ART.world.finishPanel(this,
      `${reason}\n${this.score} coins collected\nPress R to try again`);
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
