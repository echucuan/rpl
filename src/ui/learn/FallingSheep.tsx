import { useEffect, useRef, useState, type RefObject } from "react";

/** One sheep crossing the animation: where it falls and how it tumbles. */
export interface Sheep {
  id: number;
  left: number; // % of the width
  drift: number; // px sideways by the end of the fall
  spin: number; // deg turned by the end of the fall
  duration: number; // s
  flip: boolean; // facing left or right
}

let ctx: AudioContext | null = null;

/** A scared "beee": a buzzy voice shaped by mouth formants, with the shaky bleat of a sheep. Synthesized, no audio file. */
function bleat() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const a = ctx;
    const t = a.currentTime + 0.02;
    const dur = 0.8 + Math.random() * 0.3;
    const pitch = 480 + Math.random() * 120; // scared: high

    const voice = a.createOscillator();
    voice.type = "sawtooth";
    voice.frequency.setValueAtTime(pitch, t);
    voice.frequency.linearRampToValueAtTime(pitch * 1.15, t + 0.12);
    voice.frequency.linearRampToValueAtTime(pitch * 0.82, t + dur);

    // Vibrato and the fast on-off of the bleat ("be-e-e-e").
    const vibrato = a.createOscillator();
    vibrato.frequency.value = 7;
    const vibratoDepth = a.createGain();
    vibratoDepth.gain.value = pitch * 0.06;
    vibrato.connect(vibratoDepth).connect(voice.frequency);
    const shake = a.createOscillator();
    shake.frequency.value = 10 + Math.random() * 3;
    const shakeDepth = a.createGain();
    shakeDepth.gain.value = 0.45;
    const level = a.createGain();
    level.gain.value = 0.55;
    shake.connect(shakeDepth).connect(level.gain);
    voice.connect(level);

    // Envelope: quick start, short hold, fade.
    const env = a.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
    env.gain.setValueAtTime(0.2, t + dur - 0.2);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    env.connect(a.destination);

    // Mouth formants of an open "e/a".
    for (const [freq, q, gain] of [[750, 6, 1], [1250, 8, 0.6], [2700, 10, 0.25]]) {
      const f = a.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = freq;
      f.Q.value = q;
      const g = a.createGain();
      g.gain.value = gain;
      level.connect(f).connect(g).connect(env);
    }

    for (const o of [voice, vibrato, shake]) { o.start(t); o.stop(t + dur + 0.05); }
  } catch {
    // No sound available: the sheep still falls.
  }
}


/**
 * Every now and then a frightened sheep tumbles across the animation, bleating. It only happens while the animation
 * runs and is on screen, never with reduced motion. Returns the sheep to draw and the sound switch.
 */
export function useFallingSheep(active: boolean, watch: RefObject<HTMLElement | null>) {
  const [sheep, setSheep] = useState<Sheep[]>([]);
  // The sound always starts muted, and mutes itself again when the student leaves the window or the tab.
  const [sound, setSoundState] = useState(false);
  const soundRef = useRef(sound);
  const visible = useRef(false);
  const next = useRef(1);

  const setSound = (on: boolean) => {
    soundRef.current = on;
    setSoundState(on);
  };

  useEffect(() => {
    const mute = () => { soundRef.current = false; setSoundState(false); };
    const onVisibility = () => { if (document.hidden) mute(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", mute);
    return () => { document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("blur", mute); };
  }, []);

  useEffect(() => {
    const el = watch.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [watch]);

  useEffect(() => {
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!active || reduced) return;
    let timer = 0;
    const schedule = (first: boolean) => {
      timer = window.setTimeout(() => {
        if (visible.current && !document.hidden) {
          const s: Sheep = {
            id: next.current++,
            left: 6 + Math.random() * 80,
            drift: (Math.random() - 0.5) * 160,
            spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360),
            duration: 2.2 + Math.random() * 0.8,
            flip: Math.random() < 0.5,
          };
          setSheep((list) => [...list, s]);
          if (soundRef.current) bleat();
          window.setTimeout(() => setSheep((list) => list.filter((x) => x.id !== s.id)), s.duration * 1000 + 100);
        }
        schedule(false);
      }, (first ? 6 + Math.random() * 6 : 14 + Math.random() * 16) * 1000);
    };
    schedule(true);
    return () => window.clearTimeout(timer);
  }, [active]);

  return { sheep, sound, setSound };
}

/** The layer the sheep fall through (place it inside a positioned box). */
export function SheepLayer({ sheep }: { sheep: Sheep[] }) {
  return (
    <div className="sheep-layer" aria-hidden="true">
      {sheep.map((s) => (
        <span
          key={s.id}
          className="falling-sheep"
          style={{
            left: `${s.left}%`,
            animationDuration: `${s.duration}s`,
            ["--drift" as string]: `${s.drift}px`,
            ["--spin" as string]: `${s.spin}deg`,
          }}
        >
          <span className="fs-body" style={{ transform: s.flip ? "scaleX(-1)" : undefined }}>🐏</span>
          <span className="fs-sweat">💦</span>
          <span className="fs-bubble">¡Beeee!</span>
        </span>
      ))}
    </div>
  );
}
