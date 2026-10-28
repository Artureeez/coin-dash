// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  highScoreKey: 'coinDash.highScore',
  coinsPerLevel: 10,     // every N coins a drone joins and drones speed up
  droneSpeedBoost: 1.1,  // drone speed multiplier per level
  maxDrones: 8,
  obstacleStartLevel: 2,  // walls first appear on this level
  obstaclesFirst: 2,      // walls added on obstacleStartLevel
  obstaclesPerLevel: 1,   // walls added on each later level
  maxObstacles: 6,
  obstacleSizes: [[96, 20], [20, 96], [44, 44]], // [w, h]; kept short so they never seal off a region
  obstacleGap: 56,        // min free space between walls and from arena edges (player is 24 wide)
  obstacleClearance: 90,  // keep new walls this far from the player
  lives: 3,
  invulnerableMs: 1500,
  droneTurnRate: 2.2,        // max heading change in rad/s; lower = easier to dodge
  droneTurnJitter: 0.25,     // each drone's turn rate varies by up to +/- this fraction
  droneWobble: 0.35,         // rad of per-drone weave around the direct line to the target
  droneSeparation: 70,       // px; drones closer than this push their headings apart
  droneSeparationWeight: 1.5,
  // player2 is blue rather than violet so it can't be mistaken for an obstacle.
  colors: { background: 0x101c31, player: 0x71e8ce, player2: 0x5aa9ff, coin: 0xffd166, drone: 0xff657a, obstacle: 0x9b8cff }
};
