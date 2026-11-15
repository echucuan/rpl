/**
 * Easter egg (not in Rocky's guide): when the chat is closed with ✕ after reading his answers,
 * Rocky launches from his corner. The show grows with the answers read since the last launch,
 * following RPL's flight phases:
 *   1 → countdown, lift-off and away (phases I–II); he fades back into his corner
 *   2 → … and he comes back down under his parachute (+ phase IV)
 *   3+ → full mission: he stops at apogee on screen, ejects, parachutes down (I–IV) and earns a badge
 * Rocky's own button is moved with the Web Animations API; the countdown, smoke and badge are drawn here.
 */
import { useEffect, useState, type RefObject } from "react";

export type Chute = "off" | "open" | "fold";

interface Props {
  fab: RefObject<HTMLButtonElement | null>;
  reads: number;
  onFlying: (on: boolean) => void;
  onChute: (c: Chute) => void;
  onDone: () => void;
}

interface Smoke { x: number; y: number; dist: number; dur: number }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Waits for an animation, but never much longer than it should last (a paused or hidden page must not leave Rocky stuck). */
const settle = (a: Animation, ms: number) => Promise.race([a.finished.catch(() => undefined), wait(ms + 300)]);
const SHAKE: Keyframe[] = [0, -3, 3, -2, 2, -3, 3, 0].map((x, i) => ({ transform: `translate(${x}px, ${i % 2 ? 1 : -1}px)` }));
/** Trail puffs left along the climb. */
const PUFFS = 40;
/** How long a puff of the trail lives (CSS rl-trail). */
const TRAIL_LIFE = 3200;
/**
 * The launch-pad cloud, as in the Rocket Tec logo: big billows that roll out sideways from under
 * Rocky, highest and biggest in the middle. x/y = where each billow ends up, from the pad (px).
 */
const PAD = Array.from({ length: 20 }, (_, i) => {
  const side = i % 2 ? 1 : -1;
  const k = Math.floor(i / 2) / 9; // 0 in the middle → 1 at the edges
  const size = 92 - k * 46 + (i % 3) * 9;
  return {
    x: side * (8 + k * 190) + ((i * 17) % 11) - 5,
    // Sitting on the pad line (half their size up), heaped higher in the middle.
    y: -size * 0.45 - (1 - k) * 34 - (i % 3) * 7,
    size,
    delay: k * 450 + (i % 3) * 70,
  };
});

/**
 * Mac-style "genie" close: the window pinches into a funnel towards Rocky's corner and is sucked
 * into it. Resolves when the window is gone.
 */
export function genie(panel: HTMLElement, target: { x: number; y: number }) {
  const r = panel.getBoundingClientRect();
  const dx = target.x - (r.left + r.width / 2);
  const dy = target.y - (r.top + r.height / 2);
  // Funnel tip on the side where Rocky is (x in % of the window).
  const tip = Math.min(100, Math.max(0, ((target.x - r.left) / r.width) * 100));
  const toward = (x: number, k: number) => x + (tip - x) * k;
  // Outline points: top-left, top-middle, top-right, right-middle, bottom-right, bottom-middle, bottom-left, left-middle.
  const shape = (top: number, mid: number, bottom: number) => {
    const p = [
      [toward(0, top), 0], [toward(50, top), 0], [toward(100, top), 0],
      [toward(100, mid), 50], [toward(100, bottom), 100], [toward(50, bottom), 100],
      [toward(0, bottom), 100], [toward(0, mid), 50],
    ];
    return `polygon(${p.map(([x, y]) => `${x.toFixed(1)}% ${y}%`).join(",")})`;
  };
  const win = panel.animate(
    [
      { transform: "none", clipPath: shape(0, 0, 0) },
      { transform: `translate(${dx * 0.04}px, ${dy * 0.06}px)`, clipPath: shape(0, 0.25, 0.8), offset: 0.3 },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.45}px) scale(.8, .6)`, clipPath: shape(0.35, 0.7, 0.95), offset: 0.6 },
      { transform: `translate(${dx * 0.8}px, ${dy * 0.85}px) scale(.25, .2)`, clipPath: shape(0.8, 0.92, 0.98), offset: 0.85 },
      { transform: `translate(${dx}px, ${dy}px) scale(.04)`, clipPath: shape(0.95, 0.98, 1), opacity: 0 },
    ],
    { duration: 650, easing: "cubic-bezier(.5,0,.75,.4)", fill: "forwards" },
  );
  return settle(win, 650);
}

export function RockyLaunch({ fab, reads, onFlying, onChute, onDone }: Props) {
  const [label, setLabel] = useState<string | null>(null);
  const [smoke, setSmoke] = useState<Smoke | null>(null);
  const [pad, setPad] = useState<{ x: number; y: number } | null>(null);
  const [eject, setEject] = useState<{ x: number; y: number } | null>(null);
  const [badge, setBadge] = useState(false);

  useEffect(() => {
    let alive = true;
    const el = fab.current;
    (async () => {
      if (!el) return onDone();
      await wait(250);
      for (const n of ["3", "2", "1"]) {
        setLabel(n);
        if (n === "1") {
          // Ignition: the pad disappears in a cloud of vapour before Rocky moves.
          const p = el.getBoundingClientRect();
          setPad({ x: p.left + p.width / 2, y: Math.min(p.bottom + 6, innerHeight) });
        }
        el.animate(SHAKE, { duration: 780, iterations: 1, easing: "linear" });
        await wait(800);
        if (!alive) return;
      }
      setLabel("¡Take off!");
      const r = el.getBoundingClientRect();
      const full = reads >= 3;
      // Full mission: the apogee stays on screen. Otherwise he leaves through the top.
      const rise = full ? -(r.top - 110) : -(r.bottom + 80);
      const dur = full ? 1400 : 1500;
      onFlying(true);
      setSmoke({ x: r.left + r.width / 2, y: r.bottom - 10, dist: -rise, dur });
      const smokeGone = performance.now() + dur + TRAIL_LIFE;
      const up = el.animate([{ transform: "translateY(0)" }, { transform: `translateY(${rise}px)` }], {
        duration: dur, easing: "cubic-bezier(.55,0,.9,.55)", fill: "forwards",
      });
      await wait(750);
      setLabel(null);
      await settle(up, dur);
      if (!alive) return;
      onFlying(false);

      if (reads === 1) {
        await wait(900);
        up.cancel();
        await settle(el.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "none" }], { duration: 500, easing: "ease-out" }), 500);
      } else {
        let from = rise;
        if (full) {
          await wait(400); // apogee
          setEject({ x: r.left + r.width / 2, y: r.top + rise });
          await wait(300);
        } else {
          from = -(r.bottom + 160);
          await wait(700);
        }
        onChute("open");
        up.cancel();
        // Under the parachute: a slow, steady fall (half the speed it used to have) while he swings
        // from side to side like a pendulum hanging from the canopy, each swing a little smaller.
        const fall = full ? 6000 : 5200;
        el.style.transformOrigin = "50% -55%"; // pivot near the parachute, above Rocky
        const down = el.animate([{ translate: `0 ${from}px` }, { translate: "0 0" }], {
          duration: fall, easing: "cubic-bezier(.25,.4,.45,1)", fill: "forwards",
        });
        const swing = [0, -24, 21, -18, 14, -10, 6, 0];
        const sway = el.animate(
          swing.map((x) => ({ transform: `translateX(${x}px) rotate(${(-x * 0.45).toFixed(1)}deg)` })),
          { duration: fall, easing: "ease-in-out", fill: "forwards" },
        );
        await settle(down, fall);
        down.cancel();
        sway.cancel();
        el.style.transformOrigin = "";
        if (!alive) return;
        onChute("fold");
        await wait(450);
        onChute("off");
        if (full) {
          setBadge(true);
          await wait(3400);
        }
      }
      await wait(Math.max(300, smokeGone - performance.now())); // let the smoke clear
      if (alive) onDone();
    })();
    return () => {
      alive = false;
      // Whatever happened, Rocky ends up back in his corner, still and visible.
      el?.getAnimations().forEach((a) => a.cancel());
      onFlying(false);
      onChute("off");
    };
    // The show runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
    <div className="rl-layer" aria-hidden="true">
      {label && <div key={label} className={`rl-count${label.length > 2 ? " go" : ""}`}>{label}</div>}
      {smoke && <div className="rl-smoke">{Array.from({ length: PUFFS }, (_, i) => {
        // Evenly spaced along the climb so the trail is one continuous column; each puff appears
        // when Rocky passes it (he speeds up: height ≈ t², so t ≈ √height). All are born small and
        // grow as they age: the oldest, at the bottom, are the widest, like a real trail.
        const f = i / (PUFFS - 1);
        const size = 30 + (i % 3) * 6;
        return (
          <span
            key={i}
            className="rl-trail"
            style={{ left: smoke.x + ((i * 37) % 9) - 4 - size / 2, top: smoke.y - f * smoke.dist - size / 2, width: size, height: size, animationDelay: `${Math.sqrt(f) * smoke.dur}ms` }}
          />
        );
      })}</div>}
      {eject && <span className="rl-eject" style={{ left: eject.x, top: eject.y }} />}
      {badge && (
        <div className="rl-badge" role="status">
          <b>🏅 Misión completa</b>
          <span>{reads} respuestas leídas · Fases I–IV</span>
        </div>
      )}
    </div>
    {pad && (
      // In front of Rocky, as in the logo: he rises out of the cloud.
      <div className="rl-layer rl-front" aria-hidden="true">
        {PAD.map((b, i) => (
          <span
            key={i}
            className="rl-billow"
            style={{
              left: pad.x - b.size / 2, top: pad.y - b.size / 2, width: b.size, height: b.size, animationDelay: `${b.delay}ms`,
              ["--x" as string]: `${b.x}px`, ["--y" as string]: `${b.y}px`,
            }}
          />
        ))}
      </div>
    )}
    </>
  );
}
