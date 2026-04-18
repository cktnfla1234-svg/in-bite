let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

/** Tiny crunchy "kwa-sak" signature sound (very short + low volume). */
export function playCrunchNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.value = 1400;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.07, now + 0.008);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  const click = ctx.createOscillator();
  click.type = "triangle";
  click.frequency.setValueAtTime(980, now);
  click.frequency.exponentialRampToValueAtTime(620, now + 0.06);
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.0001, now);
  clickGain.gain.exponentialRampToValueAtTime(0.035, now + 0.01);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  click.connect(clickGain);
  clickGain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 0.1);
  click.start(now + 0.01);
  click.stop(now + 0.09);
}
