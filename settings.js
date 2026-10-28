// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  highScoreKey: 'coinDash.highScore',
  highScoreNameKey: 'coinDash.highScoreName',
  playerNamesKey: 'coinDash.playerNames',
  nameMaxLength: 12,
  coinsPerLevel: 10,     // every N coins a drone joins and drones speed up
  droneSpeedBoost: 1.1,  // drone speed multiplier per level
  maxDrones: 8,
  lives: 3,
  invulnerableMs: 1500,
  colors: { background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a }
};
