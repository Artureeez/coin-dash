// Visual layer. game.js owns gameplay (movement, hitboxes, scoring); files in art/ own looks.
// Each art file registers textures and event handlers here, so design and gameplay
// can change in parallel without editing the same lines.
window.COIN_DASH_ART = {
  textureMakers: [],
  handlers: {},

  // fn(scene) should draw with scene.make.graphics(...) and call generateTexture(key, w, h).
  texture(fn) { this.textureMakers.push(fn); },

  // Events emitted by game.js: 'create', 'update', 'coin', 'hit', 'finish'.
  on(event, fn) { (this.handlers[event] = this.handlers[event] || []).push(fn); },

  // Textures live on the game, not the scene, so they survive a restart; build them once.
  buildTextures(scene) {
    if (this.built) return;
    this.textureMakers.forEach(fn => fn(scene));
    this.built = true;
  },

  emit(event, scene, payload) { (this.handlers[event] || []).forEach(fn => fn(scene, payload)); }
};
