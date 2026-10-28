/* global Phaser, COIN_DASH, COIN_DASH_ART */
// Drone (enemy) look. Texture key: 'drone'. The hitbox stays 26x26 regardless of texture size.
// A top-down quadcopter facing +x: four rotors on an X frame, a red hull and a glowing eye.
// Extra keys 'drone-1' and 'drone-2' are rotor animation frames (same size, so the body never changes).
const DRONE_SIZE = 34;
const DRONE_FRAMES = ['drone', 'drone-1', 'drone-2'];
const DRONE_COLORS = {
  arm: 0x5a2433,      // dark frame, still lighter than the navy floor
  rotor: 0x1c0d18,    // rotor housing
  rim: 0xff9aa8,      // light rim so rotors read against the background
  blade: 0xffd6dc,
  hullEdge: 0x8c1f33,
  hullShade: 0xd94a60,
  socket: 0x2a0610,
  eye: 0xff2240,
  eyeCore: 0xffe8ec,
  glow: 0xff3350
};

COIN_DASH_ART.texture(scene => {
  const g = scene.make.graphics({ add: false });
  const c = DRONE_SIZE / 2;
  const corners = [[7, 7, 1], [27, 7, -1], [27, 27, 1], [7, 27, -1]]; // x, y, spin direction

  DRONE_FRAMES.forEach((key, frame) => {
    g.clear();
    // X-frame arms.
    g.lineStyle(4, DRONE_COLORS.arm, 1);
    corners.forEach(([x, y]) => g.lineBetween(c, c, x, y));
    // Rotors: housing, rim and a two-blade prop. Each frame turns the blades 60 degrees,
    // and diagonal pairs spin in opposite directions like a real quadcopter.
    corners.forEach(([x, y, dir]) => {
      g.fillStyle(DRONE_COLORS.rotor, 0.85).fillCircle(x, y, 6.5);
      g.lineStyle(1, DRONE_COLORS.rim, 0.9).strokeCircle(x, y, 6.5);
      const a = dir * frame * Math.PI / 3 + Math.PI / 4;
      const bx = Math.cos(a) * 5.5, by = Math.sin(a) * 5.5;
      g.lineStyle(2, DRONE_COLORS.blade, 0.8).lineBetween(x - bx, y - by, x + bx, y + by);
      g.fillStyle(DRONE_COLORS.rim, 1).fillCircle(x, y, 1.2);
    });
    // Hull with a darker outline and a shaded lower half for some depth.
    g.fillStyle(COIN_DASH.colors.drone, 1).fillCircle(c, c, 9);
    g.fillStyle(DRONE_COLORS.hullShade, 1).fillCircle(c - 1.5, c + 1.5, 6);
    g.fillStyle(COIN_DASH.colors.drone, 1).fillCircle(c - 2.5, c - 1, 4.5);
    g.lineStyle(2, DRONE_COLORS.hullEdge, 1).strokeCircle(c, c, 9);
    // Eye at the front, in a dark socket so it stands out from the red hull.
    g.fillStyle(DRONE_COLORS.socket, 1).fillCircle(c + 4.5, c, 4);
    g.fillStyle(DRONE_COLORS.eye, 1).fillCircle(c + 5, c, 2.6);
    g.fillStyle(DRONE_COLORS.eyeCore, 1).fillCircle(c + 5.5, c - 0.5, 1);
    g.generateTexture(key, DRONE_SIZE, DRONE_SIZE);
  });

  // Soft danger glow, drawn additively under each drone.
  g.clear();
  for (let r = 24; r > 4; r -= 4) g.fillStyle(DRONE_COLORS.glow, 0.07).fillCircle(24, 24, r);
  g.generateTexture('drone-glow', 48, 48);
  g.destroy();
});

// Fired for every drone, including ones that join on level-up. Overlays are stored on the
// drone itself, so they go away with it on restart.
COIN_DASH_ART.on('drone', (scene, { drone }) => {
  drone.artPhase = scene.drones.getLength() * 1.7;
  drone.artFrame = 0;
  drone.artShadow = scene.add.ellipse(drone.x + 3, drone.y + 12, 26, 9, 0x000000, 0.35);
  drone.artGlow = scene.add.image(drone.x, drone.y, 'drone-glow').setBlendMode(Phaser.BlendModes.ADD);
  drone.artShadow.setBelow(drone);
  drone.artGlow.setBelow(drone);
  const v = drone.body.velocity;
  drone.rotation = Math.atan2(v.y, v.x);
  // Late arrivals fade in instead of popping into view ('update' drives the glow and shadow).
  if (scene.started) {
    drone.setAlpha(0);
    scene.tweens.add({ targets: drone, alpha: 1, duration: 400 });
  }
});

COIN_DASH_ART.on('update', (scene, { time, delta }) => {
  const turn = 6 * delta / 1000; // radians per frame when turning after a bounce
  scene.drones.getChildren().forEach(drone => {
    if (!drone.artGlow) return;
    // Spin the rotors by cycling frames.
    const frame = Math.floor(time / 45 + drone.artPhase * 3) % DRONE_FRAMES.length;
    if (frame !== drone.artFrame) {
      drone.artFrame = frame;
      drone.setTexture(DRONE_FRAMES[frame]);
    }
    // Turn the eye smoothly toward the direction of travel.
    const v = drone.body.velocity;
    if (v.lengthSq() > 1) {
      drone.rotation = Phaser.Math.Angle.RotateTo(drone.rotation, Math.atan2(v.y, v.x), turn);
    }
    // Hover: the shadow breathes as if the drone bobs (moving the drone itself would move its body).
    const bob = Math.sin(time / 260 + drone.artPhase);
    drone.artShadow.setPosition(drone.x + 3, drone.y + 12 + bob * 1.5)
      .setScale(0.9 + bob * 0.08).setAlpha(0.3 - bob * 0.06);
    drone.artGlow.setPosition(drone.x, drone.y)
      .setScale(1 + bob * 0.06).setAlpha(0.75 + Math.sin(time / 140 + drone.artPhase) * 0.2);
  });
});

// The drone that caught the player flashes white and sends out a shock ring.
COIN_DASH_ART.on('hit', (scene, { drone, fatal }) => {
  if (fatal) drone.artCaught = true;
  let flashes = 0;
  scene.time.addEvent({
    delay: 70, repeat: 7, callback: () => {
      if (++flashes % 2) drone.setTintFill(0xffffff); else drone.clearTint();
    }
  });
  const ring = scene.add.circle(drone.x, drone.y, 14).setStrokeStyle(3, DRONE_COLORS.glow, 1);
  scene.tweens.add({
    targets: ring, scale: 3.5, alpha: 0, duration: 450, ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy()
  });
  if (drone.artGlow) {
    scene.tweens.add({ targets: drone.artGlow, scale: 2.2, alpha: 1, duration: 200, yoyo: true });
  }
});

// When the round ends, the other drones power down a little so the culprit stands out.
COIN_DASH_ART.on('finish', scene => {
  scene.drones.getChildren().forEach(drone => {
    if (drone.artCaught) return;
    const targets = [drone, drone.artGlow].filter(Boolean);
    scene.tweens.add({ targets, alpha: 0.45, duration: 400 });
  });
});
