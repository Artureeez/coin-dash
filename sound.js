/* global COIN_DASH_ART */
// Sound effects, synthesized with Web Audio so nothing is loaded from disk or network.
// Listens to the same events as art/, so gameplay code never has to know about audio.
(() => {
  const muteKey = 'coinDash.muted';
  let ctx = null, out = null, nextBeat = 0, beatIndex = 0, lastCoinAt = 0, combo = 0;
  let muted = false;
  try { muted = window.localStorage.getItem(muteKey) === '1'; } catch (e) { /* storage blocked; default to sound on */ }

  // Browsers keep audio locked until a user gesture, so the context is made on the first key or click.
  // Capture phase runs before Phaser's own listeners, so the Space that starts a round is already audible.
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      out = ctx.createGain();
      out.gain.value = muted ? 0 : 0.35;
      out.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', (e) => {
    unlock();
    if (e.code !== 'KeyM' || e.repeat) return;
    muted = !muted;
    try { window.localStorage.setItem(muteKey, muted ? '1' : '0'); } catch (err) { /* keep in-memory only */ }
    if (out) out.gain.setTargetAtTime(muted ? 0 : 0.35, ctx.currentTime, 0.02);
    if (!muted) tone(880, 0.06, { type: 'square', vol: 0.15 });
  }, true);

  // One enveloped oscillator; every effect below is a few of these in sequence.
  function tone(freq, dur, o = {}) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (o.at || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  const notes = (list, step, o) => list.forEach((f, i) => tone(f, o.dur || step * 1.6, Object.assign({}, o, { at: i * step })));

  const A = COIN_DASH_ART;
  A.on('create', () => { combo = 0; beatIndex = 0; nextBeat = 0; });
  A.on('start', () => notes([392, 523, 659, 784], 0.07, { type: 'square', vol: 0.14 }));
  A.on('pause', (scene, p) => tone(p.paused ? 660 : 990, 0.08, { type: 'square', vol: 0.14, to: p.paused ? 440 : 1320 }));

  // Quick pickups build a combo that raises the pitch, so a good streak sounds like one.
  A.on('coin', (scene, p) => {
    const now = scene.time.now;
    combo = now - lastCoinAt < 1500 ? Math.min(combo + 1, 12) : 0;
    lastCoinAt = now;
    const f = 988 * Math.pow(2, combo / 12) * (1 + Math.min(p.score, 60) / 600);
    tone(f, 0.07, { type: 'square', vol: 0.13 });
    tone(f * 1.5, 0.18, { type: 'square', vol: 0.11, at: 0.06 });
  });

  A.on('hit', (scene, p) => {
    tone(220, 0.25, { type: 'sawtooth', vol: 0.22, to: 55 });
    tone(140, 0.18, { type: 'square', vol: 0.15, to: 70, at: 0.02 });
    if (!p.fatal) tone(1200, 0.08, { type: 'triangle', vol: 0.08, to: 300, at: 0.05 });
  });

  A.on('levelup', () => notes([523, 659, 784, 1047, 1319], 0.06, { type: 'triangle', vol: 0.2 }));

  A.on('finish', (scene, p) => {
    if (p.newBest) {
      notes([523, 659, 784, 1047], 0.11, { type: 'square', vol: 0.12 });
      notes([784, 1047, 1319, 1568], 0.11, { type: 'triangle', vol: 0.12, dur: 0.15 });
      tone(1047, 0.6, { type: 'square', vol: 0.12, at: 0.5 });
      tone(1568, 0.6, { type: 'triangle', vol: 0.12, at: 0.5 });
    } else {
      notes([659, 587, 523, 392], 0.16, { type: 'triangle', vol: 0.2, dur: 0.22 });
      tone(196, 0.5, { type: 'triangle', vol: 0.18, at: 0.64 });
    }
  });

  // Soft bass pulse while playing. 'update' is not emitted while paused or after finish,
  // so the beat stops on its own; it only schedules a short way ahead to keep that prompt.
  A.on('update', (scene) => {
    if (!ctx || muted || !scene.started || scene.finished) return;
    const now = ctx.currentTime;
    if (nextBeat < now) nextBeat = now + 0.05;
    while (nextBeat < now + 0.1) {
      const f = [55, 55, 65.4, 49][(beatIndex >> 1) % 4];
      tone(f, 0.18, { type: 'sine', vol: beatIndex % 2 ? 0.05 : 0.09, at: nextBeat - now });
      nextBeat += 60 / (100 + 8 * (scene.level - 1)) / 2;
      beatIndex++;
    }
  });
})();
