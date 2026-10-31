// Brand mark and wordmark: foreground interactive black-widow orb web and corner logo.
import { animate } from "animejs";
import type { JSX } from "solid-js";
import { createEffect, For, onCleanup, onMount } from "solid-js";
import { Web } from "./web.tsx";

const RAD = Math.PI / 180;
const HUB = { x: 268, y: 224 };

const SPOKE_ANGLES: readonly number[] = [
  -82, -52, -22, 8, 38, 68, 98, 128, 158, 188, 218, 248,
];
const SPOKE_RADII: readonly number[] = [
  208, 232, 240, 230, 218, 202, 200, 220, 238, 242, 224, 204,
];
const RINGS: readonly number[] = [34, 66, 102, 140, 182];

export interface WebAnchorNode {
  readonly id: string;
  readonly spoke: number;
  readonly ring: number;
  readonly token: string;
  readonly label: string;
  readonly dx: number;
  readonly dy: number;
}

export const WEB_ANCHOR_NODES: readonly WebAnchorNode[] = [
  { id: "primary", spoke: 1, ring: 3, token: "--color-primary", label: "color.primary", dx: 12, dy: -8 },
  { id: "spacing", spoke: 4, ring: 2, token: "--spacing-4", label: "spacing.4", dx: 12, dy: 14 },
  { id: "radius", spoke: 7, ring: 3, token: "--radius-md", label: "radius.md", dx: -82, dy: 16 },
  { id: "surface", spoke: 9, ring: 2, token: "--color-surface", label: "color.surface", dx: -92, dy: -10 },
  { id: "motion", spoke: 11, ring: 3, token: "--motion-duration-fast", label: "motion.fast", dx: -78, dy: -12 },
];

const PLUCK_TOKENS: readonly string[] = [
  "--color-primary",
  "--color-on-primary",
  "--color-surface-raised",
  "--color-text",
  "--color-border-strong",
  "--spacing-4",
  "--radius-md",
  "--shadow-lg",
  "--font-family-brand",
  "--motion-duration-fast",
  "--color-semantic-error",
  "--color-accent",
];

function ptAt(r: number, deg: number): { x: number; y: number } {
  return {
    x: HUB.x + r * Math.cos(deg * RAD),
    y: HUB.y + r * Math.sin(deg * RAD),
  };
}

interface SilkSegment {
  readonly ringIdx: number;
  readonly spokeIdx: number;
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  readonly baseCx: number;
  readonly baseCy: number;
  readonly nx: number;
  readonly ny: number;
}

const SPOKE_TIPS: readonly { x: number; y: number }[] = SPOKE_ANGLES.map(
  (deg, i) => ptAt(SPOKE_RADII[i] ?? 214, deg),
);

const SPOKE_PATHS: readonly string[] = SPOKE_TIPS.map(
  (p) => `M${HUB.x} ${HUB.y} L${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
);

const FRAME_PATHS: readonly string[] = SPOKE_TIPS.map((a, i) => {
  const b = SPOKE_TIPS[(i + 1) % SPOKE_TIPS.length]!;
  const midX = (a.x + b.x) * 0.5;
  const midY = (a.y + b.y) * 0.5;
  const cx = midX + (HUB.x - midX) * 0.09;
  const cy = midY + (HUB.y - midY) * 0.09;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
});

const GUY_LINES: readonly string[] = [
  `M0 12 L${SPOKE_TIPS[9]!.x.toFixed(1)} ${SPOKE_TIPS[9]!.y.toFixed(1)}`,
  `M520 10 L${SPOKE_TIPS[1]!.x.toFixed(1)} ${SPOKE_TIPS[1]!.y.toFixed(1)}`,
  `M520 462 L${SPOKE_TIPS[4]!.x.toFixed(1)} ${SPOKE_TIPS[4]!.y.toFixed(1)}`,
  `M0 454 L${SPOKE_TIPS[7]!.x.toFixed(1)} ${SPOKE_TIPS[7]!.y.toFixed(1)}`,
  `M${HUB.x} 0 L${HUB.x} ${HUB.y}`,
];

const SILK_SEGMENTS: readonly SilkSegment[] = RINGS.flatMap((r, ringIdx) =>
  SPOKE_ANGLES.map((deg, spokeIdx) => {
    const nextDeg = SPOKE_ANGLES[(spokeIdx + 1) % SPOKE_ANGLES.length]!;
    const a = ptAt(r, deg);
    const b = ptAt(r, nextDeg);
    const midX = (a.x + b.x) * 0.5;
    const midY = (a.y + b.y) * 0.5;
    const toHubX = HUB.x - midX;
    const toHubY = HUB.y - midY;
    const dist = Math.hypot(toHubX, toHubY) || 1;
    const sag = 0.13;
    return {
      ringIdx,
      spokeIdx,
      ax: a.x,
      ay: a.y,
      bx: b.x,
      by: b.y,
      baseCx: midX + toHubX * sag,
      baseCy: midY + toHubY * sag,
      nx: toHubX / dist,
      ny: toHubY / dist,
    };
  })
);

function segmentPath(seg: SilkSegment, offset = 0): string {
  const cx = seg.baseCx + seg.nx * offset;
  const cy = seg.baseCy + seg.ny * offset;
  return `M${seg.ax.toFixed(1)} ${seg.ay.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${seg.bx.toFixed(1)} ${seg.by.toFixed(1)}`;
}

/** 2-bone analytic Inverse Kinematics solver in spider-local coordinates. */
function solveIK(
  hx: number,
  hy: number,
  fx: number,
  fy: number,
  l1: number,
  l2: number,
  bendSign: number,
): [number, number] {
  const dx = fx - hx;
  const dy = fy - hy;
  let d = Math.hypot(dx, dy);
  d = Math.max(Math.abs(l1 - l2) + 0.05, Math.min(l1 + l2 - 0.05, d));
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = hx + a * (dx / d);
  const my = hy + a * (dy / d);
  const nx = (-dy / d) * bendSign;
  const ny = (dx / d) * bendSign;
  return [mx + h * nx, my + h * ny];
}

interface LegRig {
  readonly side: -1 | 1;
  readonly pair: 0 | 1 | 2 | 3;
  readonly hipX: number;
  readonly hipY: number;
  readonly restFootX: number;
  readonly restFootY: number;
  readonly l1: number;
  readonly l2: number;
  readonly bend: -1 | 1;
  readonly archX: number;
  readonly archY: number;
}

// Long, spindly, razor-arched black-widow proportions (long front & rear reach)
const LEG_RIGS: readonly LegRig[] = [
  // Left 4 legs
  { side: -1, pair: 0, hipX: -4.8, hipY: -10.5, restFootX: -36, restFootY: -54, l1: 28, l2: 38, bend: 1, archX: -6, archY: -8 },
  { side: -1, pair: 1, hipX: -6.2, hipY: -7.0, restFootX: -54, restFootY: -18, l1: 27, l2: 35, bend: 1, archX: -8, archY: -4 },
  { side: -1, pair: 2, hipX: -6.0, hipY: -3.2, restFootX: -50, restFootY: 18, l1: 24, l2: 31, bend: -1, archX: -7, archY: 4 },
  { side: -1, pair: 3, hipX: -4.5, hipY: 0.5, restFootX: -34, restFootY: 56, l1: 29, l2: 39, bend: -1, archX: -5, archY: 9 },
  // Right 4 legs
  { side: 1, pair: 0, hipX: 4.8, hipY: -10.5, restFootX: 36, restFootY: -54, l1: 28, l2: 38, bend: -1, archX: 6, archY: -8 },
  { side: 1, pair: 1, hipX: 6.2, hipY: -7.0, restFootX: 54, restFootY: -18, l1: 27, l2: 35, bend: -1, archX: 8, archY: -4 },
  { side: 1, pair: 2, hipX: 6.0, hipY: -3.2, restFootX: 50, restFootY: 18, l1: 24, l2: 31, bend: 1, archX: 7, archY: 4 },
  { side: 1, pair: 3, hipX: 4.5, hipY: 0.5, restFootX: 34, restFootY: 56, l1: 29, l2: 39, bend: 1, archX: 5, archY: 9 },
];

export interface MarkPluckEvent {
  readonly token: string;
  readonly x: number;
  readonly y: number;
  readonly ring: number;
  readonly spoke: number;
}

export function Mark(props: {
  class?: string;
  activeAnchor?: string;
  reweaveKey?: number;
  onPluck?: (event: MarkPluckEvent) => void;
}): JSX.Element {
  const reduced =
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
    false;

  let svgEl: SVGSVGElement | undefined;
  let spiderGroup: SVGGElement | undefined;
  let draglineEl: SVGLineElement | undefined;
  let trailPathEl: SVGPathElement | undefined;
  let rippleEl: SVGCircleElement | undefined;
  let rippleOuterEl: SVGCircleElement | undefined;
  let rippleCoreEl: SVGCircleElement | undefined;
  let fangLeftEl: SVGPathElement | undefined;
  let fangRightEl: SVGPathElement | undefined;

  const spokeEls: SVGPathElement[] = [];
  const silkEls: SVGPathElement[] = [];
  const nodeEls: SVGCircleElement[] = [];
  const legFemurEls: SVGPathElement[] = [];
  const legTibiaEls: SVGPathElement[] = [];
  const legJointEls: SVGCircleElement[] = [];

  const silkDisp = new Float32Array(SILK_SEGMENTS.length);
  const silkVel = new Float32Array(SILK_SEGMENTS.length);

  let spiderX = HUB.x;
  let spiderY = HUB.y + 28;
  let targetX = HUB.x;
  let targetY = HUB.y + 28;
  let spiderAngle = 0;
  let targetAngle = 0;
  let pointerInside = false;
  let lastPointerX = HUB.x;
  let lastPointerY = HUB.y;
  let strikeImpulse = 0;

  const trailPoints: { x: number; y: number }[] = [
    { x: HUB.x, y: HUB.y },
    { x: HUB.x, y: HUB.y + 28 },
  ];

  const toLocal = (
    wx: number,
    wy: number,
    bx: number,
    by: number,
    deg: number,
  ): [number, number] => {
    const r = -deg * RAD;
    const dx = wx - bx;
    const dy = wy - by;
    return [
      dx * Math.cos(r) - dy * Math.sin(r),
      dx * Math.sin(r) + dy * Math.cos(r),
    ];
  };

  const toWorld = (
    lx: number,
    ly: number,
    bx: number,
    by: number,
    deg: number,
  ): [number, number] => {
    const r = deg * RAD;
    return [
      bx + lx * Math.cos(r) - ly * Math.sin(r),
      by + lx * Math.sin(r) + ly * Math.cos(r),
    ];
  };

  const footWorld = LEG_RIGS.map((rig) => {
    const [wx, wy] = toWorld(rig.restFootX, rig.restFootY, spiderX, spiderY, 0);
    return { x: wx, y: wy, fromX: wx, fromY: wy, toX: wx, toY: wy, stepT: 1 };
  });

  const renderLegs = (crouch = 0) => {
    for (let i = 0; i < LEG_RIGS.length; i++) {
      const rig = LEG_RIGS[i]!;
      const foot = footWorld[i]!;
      const [fxLocal, fyLocal] = toLocal(
        foot.x,
        foot.y,
        spiderX,
        spiderY,
        spiderAngle,
      );
      const lift = foot.stepT < 1 ? Math.sin(foot.stepT * Math.PI) * 9.5 : 0;
      const hx = rig.hipX;
      const hy = rig.hipY + crouch * 0.4;
      const tx = fxLocal + rig.side * lift * 0.45;
      const ty = fyLocal - lift;
      const [rawKx, rawKy] = solveIK(hx, hy, tx, ty, rig.l1, rig.l2, rig.bend);
      const kx = rawKx + rig.archX * (1 + lift * 0.04);
      const ky = rawKy + rig.archY;

      // Tapered widow leg: thicker femur + needle-sharp arched tibia/tarsus
      const midTx = (kx + tx) * 0.5 + rig.side * 3.2;
      const midTy = (ky + ty) * 0.5 - 2.4;

      legFemurEls[i]?.setAttribute(
        "d",
        `M${hx.toFixed(1)} ${hy.toFixed(1)} L${kx.toFixed(1)} ${ky.toFixed(1)}`,
      );
      legTibiaEls[i]?.setAttribute(
        "d",
        `M${kx.toFixed(1)} ${ky.toFixed(1)} Q${midTx.toFixed(1)} ${midTy.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`,
      );
      legJointEls[i]?.setAttribute("cx", kx.toFixed(1));
      legJointEls[i]?.setAttribute("cy", ky.toFixed(1));
    }
  };

  const pluckNear = (
    px: number,
    py: number,
    impulse = 22,
    emit = false,
    forcedToken?: string,
  ) => {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < SILK_SEGMENTS.length; i++) {
      const seg = SILK_SEGMENTS[i]!;
      const d = Math.hypot(seg.baseCx - px, seg.baseCy - py);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
      if (d < 108) {
        const falloff = 1 - d / 108;
        silkVel[i] =
          (silkVel[i] ?? 0) +
          impulse * falloff * (i % 2 === 0 ? 1 : -0.85);
      }
    }
    if (emit) {
      strikeImpulse = 1;
      const hit = SILK_SEGMENTS[bestIdx]!;
      const token =
        forcedToken ??
        PLUCK_TOKENS[(hit.spokeIdx + hit.ringIdx * 3) % PLUCK_TOKENS.length]!;
      props.onPluck?.({
        token,
        x: Math.round(px),
        y: Math.round(py),
        ring: hit.ringIdx + 1,
        spoke: hit.spokeIdx + 1,
      });
      if (!reduced && rippleEl && rippleOuterEl && rippleCoreEl) {
        for (const el of [rippleEl, rippleOuterEl, rippleCoreEl]) {
          el.setAttribute("cx", px.toFixed(1));
          el.setAttribute("cy", py.toFixed(1));
        }
        animate(rippleEl, {
          r: [3, 38],
          opacity: [0.95, 0],
          duration: 620,
          ease: "outCubic",
        });
        animate(rippleOuterEl, {
          r: [6, 64],
          opacity: [0.55, 0],
          duration: 820,
          ease: "outCubic",
        });
        animate(rippleCoreEl, {
          r: [2, 8, 3.5],
          opacity: [1, 0.9, 0],
          duration: 640,
          ease: "outCubic",
        });
      }
    }
  };

  const toSvgPoint = (e: PointerEvent): { x: number; y: number } | null => {
    if (!svgEl) return null;
    const rect = svgEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * 520,
      y: ((e.clientY - rect.top) / rect.height) * 480,
    };
  };

  const onPointerMove = (e: PointerEvent) => {
    const pt = toSvgPoint(e);
    if (!pt) return;
    pointerInside = true;
    const moveDist = Math.hypot(pt.x - lastPointerX, pt.y - lastPointerY);
    lastPointerX = pt.x;
    lastPointerY = pt.y;

    const dx = pt.x - HUB.x;
    const dy = pt.y - HUB.y;
    const dist = Math.hypot(dx, dy);
    const maxR = 158;
    const clampedR = Math.min(maxR, dist * 0.78);
    const angleRad = Math.atan2(dy, dx);
    targetX = HUB.x + Math.cos(angleRad) * clampedR;
    targetY = HUB.y + Math.sin(angleRad) * clampedR;
    targetAngle = Math.atan2(pt.y - spiderY, pt.x - spiderX) / RAD + 90;

    if (moveDist > 4) {
      pluckNear(pt.x, pt.y, Math.min(18, moveDist * 0.55), false);
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    const pt = toSvgPoint(e);
    if (!pt) return;
    pointerInside = true;
    const dx = pt.x - HUB.x;
    const dy = pt.y - HUB.y;
    const dist = Math.hypot(dx, dy);
    const maxR = 172;
    const clampedR = Math.min(maxR, dist);
    const angleRad = Math.atan2(dy, dx);
    targetX = HUB.x + Math.cos(angleRad) * clampedR;
    targetY = HUB.y + Math.sin(angleRad) * clampedR;
    targetAngle = Math.atan2(targetY - spiderY, targetX - spiderX) / RAD + 90;

    trailPoints.push({ x: targetX, y: targetY });
    if (trailPoints.length > 7) trailPoints.shift();
    if (trailPathEl) {
      trailPathEl.setAttribute(
        "d",
        trailPoints
          .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(" "),
      );
    }
    pluckNear(pt.x, pt.y, 32, true);
  };

  const onPointerLeave = () => {
    pointerInside = false;
  };

  const runSpinIntro = () => {
    if (reduced) return;
    if (spokeEls.length > 0) {
      animate(spokeEls, {
        strokeDashoffset: [1, 0],
        opacity: [0, 0.75],
        duration: 500,
        delay: (_el, i = 0) => i * 26,
        ease: "outQuart",
      });
    }
    if (silkEls.length > 0) {
      animate(silkEls, {
        strokeDashoffset: [1, 0],
        opacity: [0, 0.82],
        duration: 440,
        delay: (_el, i = 0) => 160 + i * 10,
        ease: "outCubic",
      });
    }
    if (nodeEls.length > 0) {
      animate(nodeEls, {
        scale: [0, 1],
        opacity: [0, 1],
        duration: 400,
        delay: (_el, i = 0) => 340 + i * 45,
        ease: "outBack",
      });
    }
    spiderX = HUB.x;
    spiderY = HUB.y - 135;
    targetX = HUB.x;
    targetY = HUB.y + 28;
    spiderAngle = 0;
    targetAngle = 0;
  };

  // Drive spider to a named anchor when controlled by an external interactive component
  createEffect(() => {
    const id = props.activeAnchor;
    if (!id) return;
    const anchor = WEB_ANCHOR_NODES.find((n) => n.id === id);
    if (!anchor) return;
    const dest = ptAt(
      RINGS[anchor.ring] ?? 102,
      SPOKE_ANGLES[anchor.spoke] ?? 0,
    );
    targetX = dest.x;
    targetY = dest.y;
    targetAngle = Math.atan2(dest.y - spiderY, dest.x - spiderX) / RAD + 90;
    trailPoints.push({ x: dest.x, y: dest.y });
    if (trailPoints.length > 7) trailPoints.shift();
    trailPathEl?.setAttribute(
      "d",
      trailPoints
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" "),
    );
    pluckNear(dest.x, dest.y, 28, true, anchor.token);
  });

  createEffect(() => {
    const key = props.reweaveKey;
    if (key !== undefined && key > 0) {
      runSpinIntro();
    }
  });

  onMount(() => {
    renderLegs(0);
    spiderGroup?.setAttribute(
      "transform",
      `translate(${spiderX.toFixed(1)} ${spiderY.toFixed(1)}) rotate(${spiderAngle.toFixed(1)})`,
    );
    if (reduced) return;

    runSpinIntro();

    let raf = 0;
    let last = performance.now();
    let nextPatrol = last + 2200;
    let visible = true;

    const onVis = () => {
      visible = !document.hidden;
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVis);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      // Predatory patrol bursts when idle
      if (!pointerInside && now > nextPatrol) {
        const pickSpoke =
          SPOKE_ANGLES[Math.floor(Math.random() * SPOKE_ANGLES.length)]!;
        const pickRing = RINGS[1 + Math.floor(Math.random() * 2)]!;
        const dest = ptAt(pickRing, pickSpoke);
        targetX = dest.x;
        targetY = dest.y;
        targetAngle =
          Math.atan2(dest.y - spiderY, dest.x - spiderX) / RAD + 90;
        pluckNear(dest.x, dest.y, 14, false);
        nextPatrol = now + 2400 + Math.random() * 2200;
      }

      // Fast predatory lunge speed when striking, crisp tracking otherwise
      strikeImpulse = Math.max(0, strikeImpulse - dt * 2.5);
      const speed = strikeImpulse > 0.1 ? 14.5 : 9.2;
      const followRate = Math.min(1, dt * speed);
      spiderX += (targetX - spiderX) * followRate;
      spiderY += (targetY - spiderY) * followRate;

      const diffAngle = ((targetAngle - spiderAngle + 540) % 360) - 180;
      spiderAngle += diffAngle * Math.min(1, dt * 11);

      const [spinX, spinY] = toWorld(0, 19, spiderX, spiderY, spiderAngle);
      if (draglineEl) {
        draglineEl.setAttribute("x2", spinX.toFixed(1));
        draglineEl.setAttribute("y2", spinY.toFixed(1));
      }

      // Fast alternating tetrapod gait
      let group0Stepping = false;
      let group1Stepping = false;
      for (let i = 0; i < LEG_RIGS.length; i++) {
        const f = footWorld[i]!;
        if (f.stepT < 1) {
          f.stepT = Math.min(1, f.stepT + dt * 13.5);
          const ease = 0.5 - 0.5 * Math.cos(f.stepT * Math.PI);
          f.x = f.fromX + (f.toX - f.fromX) * ease;
          f.y = f.fromY + (f.toY - f.fromY) * ease;
          if ((i + (i >= 4 ? 1 : 0)) % 2 === 0) group0Stepping = true;
          else group1Stepping = true;
        }
      }

      const velocity = Math.hypot(targetX - spiderX, targetY - spiderY);
      const strideThreshold = velocity > 3 ? 9 : 14;

      for (let i = 0; i < LEG_RIGS.length; i++) {
        const f = footWorld[i]!;
        if (f.stepT < 1) continue;
        const tetrapodGroup = (i + (i >= 4 ? 1 : 0)) % 2;
        if (tetrapodGroup === 0 && group1Stepping) continue;
        if (tetrapodGroup === 1 && group0Stepping) continue;

        const rig = LEG_RIGS[i]!;
        const leadX = (targetX - spiderX) * 0.34;
        const leadY = (targetY - spiderY) * 0.34;
        const [idealX, idealY] = toWorld(
          rig.restFootX,
          rig.restFootY,
          spiderX + leadX,
          spiderY + leadY,
          spiderAngle,
        );
        const drift = Math.hypot(idealX - f.x, idealY - f.y);
        if (drift > strideThreshold) {
          f.fromX = f.x;
          f.fromY = f.y;
          f.toX = idealX;
          f.toY = idealY;
          f.stepT = 0;
          if (tetrapodGroup === 0) group0Stepping = true;
          else group1Stepping = true;
        }
      }

      const crouch = Math.sin(now * 0.004) * 1.2 - strikeImpulse * 3.5;
      renderLegs(crouch);

      // Menacing chelicerae / fang flare when stalking or striking
      const fangSpread =
        Math.sin(now * 0.008) * (pointerInside ? 9 : 3.5) +
        strikeImpulse * 14;
      fangLeftEl?.setAttribute(
        "transform",
        `rotate(${(-fangSpread).toFixed(1)} -2.8 -14)`,
      );
      fangRightEl?.setAttribute(
        "transform",
        `rotate(${fangSpread.toFixed(1)} 2.8 -14)`,
      );

      spiderGroup?.setAttribute(
        "transform",
        `translate(${spiderX.toFixed(1)} ${spiderY.toFixed(1)}) rotate(${spiderAngle.toFixed(1)})`,
      );

      // Damped harmonic vibration on plucked silk strands
      for (let i = 0; i < SILK_SEGMENTS.length; i++) {
        const disp = silkDisp[i] ?? 0;
        const vel = silkVel[i] ?? 0;
        if (Math.abs(disp) > 0.04 || Math.abs(vel) > 0.04) {
          const nextVel = (vel - 310 * disp * dt) * Math.pow(0.05, dt);
          const nextDisp = disp + nextVel * dt;
          silkVel[i] = nextVel;
          silkDisp[i] = nextDisp;
          silkEls[i]?.setAttribute(
            "d",
            segmentPath(SILK_SEGMENTS[i]!, nextDisp),
          );
        } else if (disp !== 0) {
          silkDisp[i] = 0;
          silkVel[i] = 0;
          silkEls[i]?.setAttribute("d", segmentPath(SILK_SEGMENTS[i]!, 0));
        }
      }
    };

    raf = requestAnimationFrame(tick);
    onCleanup(() => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    });
  });

  return (
    <svg
      ref={(el) => {
        svgEl = el;
      }}
      viewBox="0 0 520 480"
      fill="none"
      class={props.class}
      role="img"
      aria-label="Interactive black-widow orb web — move cursor or click nodes to lure the spider"
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerLeave={onPointerLeave}
    >
      {/* Subtle tension rings around the hub */}
      <circle
        cx={HUB.x}
        cy={HUB.y}
        r="196"
        stroke="var(--color-primary)"
        stroke-width="0.75"
        stroke-dasharray="2 6"
        opacity="0.22"
      />
      <circle
        cx={HUB.x}
        cy={HUB.y}
        r="112"
        fill="var(--color-primary)"
        opacity="0.035"
      />

      {/* Structural guy-lines anchoring the web to the stage corners */}
      <g
        stroke="currentColor"
        stroke-width="1"
        stroke-dasharray="3 4"
        opacity="0.3"
      >
        <For each={GUY_LINES}>{(d) => <path d={d} />}</For>
      </g>

      {/* Outer perimeter frame silk */}
      <g stroke="currentColor" stroke-width="1.2" opacity="0.42">
        <For each={FRAME_PATHS}>{(d) => <path d={d} />}</For>
      </g>

      {/* 12 radial spokes radiating from the hub */}
      <g stroke="currentColor" stroke-width="1.15" stroke-linecap="round">
        <For each={SPOKE_PATHS}>
          {(d, i) => (
            <path
              ref={(el) => {
                spokeEls[i()] = el;
              }}
              pathLength="1"
              stroke-dasharray="1"
              stroke-dashoffset="0"
              opacity="0.72"
              d={d}
            />
          )}
        </For>
      </g>

      {/* 5 concentric capture-silk rings with elastic pluck physics */}
      <g stroke="currentColor" stroke-width="1.1" stroke-linecap="round">
        <For each={SILK_SEGMENTS}>
          {(seg, i) => (
            <path
              ref={(el) => {
                silkEls[i()] = el;
              }}
              pathLength="1"
              stroke-dasharray="1"
              stroke-dashoffset="0"
              opacity="0.78"
              d={segmentPath(seg, 0)}
            />
          )}
        </For>
      </g>

      {/* Crimson silk trail spun between visited intersections */}
      <path
        ref={(el) => {
          trailPathEl = el;
        }}
        d={`M${HUB.x} ${HUB.y}`}
        stroke="var(--color-primary)"
        stroke-width="1.25"
        stroke-dasharray="2 3"
        stroke-linecap="round"
        opacity="0.55"
      />

      {/* Interactive token prey nodes on the web */}
      <g>
        <For each={WEB_ANCHOR_NODES}>
          {(anchor, i) => {
            const pt = ptAt(
              RINGS[anchor.ring] ?? 102,
              SPOKE_ANGLES[anchor.spoke] ?? 0,
            );
            return (
              <g>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="9"
                  fill="var(--color-primary)"
                  opacity={props.activeAnchor === anchor.id ? "0.22" : "0.08"}
                />
                <circle
                  ref={(el) => {
                    nodeEls[i()] = el;
                  }}
                  cx={pt.x}
                  cy={pt.y}
                  r={props.activeAnchor === anchor.id ? "5.2" : "3.8"}
                  fill={
                    props.activeAnchor === anchor.id
                      ? "var(--color-primary)"
                      : "var(--color-surface-raised)"
                  }
                  stroke="var(--color-primary)"
                  stroke-width="2"
                />
                <text
                  x={pt.x + anchor.dx}
                  y={pt.y + anchor.dy}
                  fill={
                    props.activeAnchor === anchor.id
                      ? "var(--color-primary)"
                      : "var(--color-text-muted)"
                  }
                  font-family="var(--font-family-mono, monospace)"
                  font-size="10.5"
                  font-weight={props.activeAnchor === anchor.id ? "700" : "500"}
                >
                  {anchor.token}
                </text>
              </g>
            );
          }}
        </For>
      </g>

      {/* Pluck shockwave rings */}
      <circle
        ref={(el) => {
          rippleOuterEl = el;
        }}
        cx={HUB.x}
        cy={HUB.y}
        r="6"
        stroke="var(--color-primary)"
        stroke-width="1"
        stroke-dasharray="3 3"
        opacity="0"
      />
      <circle
        ref={(el) => {
          rippleEl = el;
        }}
        cx={HUB.x}
        cy={HUB.y}
        r="4"
        stroke="var(--color-primary)"
        stroke-width="2"
        opacity="0"
      />
      <circle
        ref={(el) => {
          rippleCoreEl = el;
        }}
        cx={HUB.x}
        cy={HUB.y}
        r="2"
        fill="var(--color-primary)"
        opacity="0"
      />

      {/* Hub knot */}
      <circle
        cx={HUB.x}
        cy={HUB.y}
        r="4.5"
        fill="var(--color-surface-raised)"
        stroke="currentColor"
        stroke-width="1.75"
      />
      <circle cx={HUB.x} cy={HUB.y} r="2" fill="var(--color-primary)" />

      {/* Live crimson dragline from hub to spinnerets */}
      <line
        ref={(el) => {
          draglineEl = el;
        }}
        x1={HUB.x}
        y1={HUB.y}
        x2={spiderX}
        y2={spiderY + 19}
        stroke="var(--color-primary)"
        stroke-width="1.6"
        stroke-linecap="round"
        opacity="0.9"
      />

      {/* The Black Widow — long razor-arched 2-bone IK legs + bulbous hourglass abdomen */}
      <g
        ref={(el) => {
          spiderGroup = el;
        }}
        transform={`translate(${spiderX} ${spiderY})`}
      >
        {/* Ominous cast shadow under carapace */}
        <ellipse
          cx="3"
          cy="6"
          rx="16"
          ry="22"
          fill="currentColor"
          opacity="0.16"
        />

        {/* Upper femur segments (thick proximal armor) */}
        <g
          stroke="currentColor"
          stroke-width="2.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <For each={LEG_RIGS}>
            {(_rig, i) => (
              <path
                ref={(el) => {
                  legFemurEls[i()] = el;
                }}
                d="M0 0 L0 0"
              />
            )}
          </For>
        </g>

        {/* Distal tibia/tarsus segments (spindly curved stiletto tips) */}
        <g
          stroke="currentColor"
          stroke-width="1.55"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <For each={LEG_RIGS}>
            {(_rig, i) => (
              <path
                ref={(el) => {
                  legTibiaEls[i()] = el;
                }}
                d="M0 0 L0 0"
              />
            )}
          </For>
        </g>

        {/* Sharp patella knee joints */}
        <g fill="var(--color-primary)" stroke="currentColor" stroke-width="1.2">
          <For each={LEG_RIGS}>
            {(_rig, i) => (
              <circle
                ref={(el) => {
                  legJointEls[i()] = el;
                }}
                cx="0"
                cy="0"
                r="1.9"
              />
            )}
          </For>
        </g>

        {/* Curved chelicerae / fangs & pedipalps */}
        <path
          ref={(el) => {
            fangLeftEl = el;
          }}
          d="M-2.8 -14 L-6.8 -22 L-2.2 -26.5 M-4.2 -13.5 L-10.5 -19.5 L-8.5 -24.5"
          stroke="currentColor"
          stroke-width="1.65"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          ref={(el) => {
            fangRightEl = el;
          }}
          d="M2.8 -14 L6.8 -22 L2.2 -26.5 M4.2 -13.5 L10.5 -19.5 L8.5 -24.5"
          stroke="currentColor"
          stroke-width="1.65"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        {/* Narrow armored cephalothorax (prosoma) */}
        <path
          d="M0 -16.8 L5.8 -12.8 L6.6 -5.0 L3.2 -0.8 L-3.2 -0.8 L-6.6 -5.0 L-5.8 -12.8 Z"
          fill="currentColor"
          stroke="var(--color-surface-raised)"
          stroke-width="1.3"
          stroke-linejoin="round"
        />

        {/* 8-eye arachnid cluster gleaming in primary ink */}
        <circle cx="-1.9" cy="-13.8" r="1.2" fill="var(--color-primary)" />
        <circle cx="1.9" cy="-13.8" r="1.2" fill="var(--color-primary)" />
        <circle cx="-3.9" cy="-12.6" r="0.95" fill="var(--color-primary)" />
        <circle cx="3.9" cy="-12.6" r="0.95" fill="var(--color-primary)" />
        <circle cx="-1.4" cy="-11.4" r="0.7" fill="var(--color-surface-raised)" />
        <circle cx="1.4" cy="-11.4" r="0.7" fill="var(--color-surface-raised)" />

        {/* Bulbous Black Widow opisthosoma (abdomen) tapering to spinneret point */}
        <path
          d="M0 -1.2 C10.2 -1.2 14.8 6.2 13.6 14.5 C12.4 21.8 5.2 26.8 0 29.2 C-5.2 26.8 -12.4 21.8 -13.6 14.5 C-14.8 6.2 -10.2 -1.2 0 -1.2 Z"
          fill="currentColor"
          stroke="var(--color-surface-raised)"
          stroke-width="1.5"
        />
        {/* Glossy chitin highlight */}
        <path
          d="M-6.8 4.5 C-9.2 9.5 -8.8 16.5 -4.8 21.5"
          stroke="var(--color-surface-raised)"
          stroke-width="1.1"
          stroke-linecap="round"
          opacity="0.35"
        />
        {/* Iconic Black Widow crimson hourglass */}
        <path
          d="M-5.8 6.2 L5.8 6.2 L1.4 13.2 L6.2 20.6 L-6.2 20.6 L-1.4 13.2 Z"
          fill="var(--color-primary)"
        />
      </g>
    </svg>
  );
}

// ── the corner mark ──────────────────────────────────────────────────────────

export type LogoSize = "sm" | "md" | "lg";

export interface LogoSpec {
  readonly px: number;
  readonly box: string;
  readonly viewBox: string;
  readonly shapes: readonly string[];
  readonly ink: string;
  readonly fillRule: "evenodd" | "nonzero" | "inherit";
}

const LOGO_SHAPES: readonly string[] = [
  "M10.9 7.4 Q8.8 4.6 5.6 3.6 L5.2 4.4 Q8.4 5.8 9.9 8.6 Z",
  "M14.1 8.6 Q15.6 5.8 18.8 4.4 L18.4 3.6 Q15.2 4.6 13.1 7.4 Z",
  "M9.7 10.5 Q7.5 8.8 4.9 8.6 L4.7 9.4 Q7.3 10.0 9.1 11.9 Z",
  "M14.9 11.9 Q16.7 10.0 19.3 9.4 L19.1 8.6 Q16.5 8.8 14.3 10.5 Z",
  "M9.1 14.2 Q7.1 14.6 4.5 15.2 L4.7 16.0 Q7.3 15.8 9.3 15.8 Z",
  "M14.7 15.8 Q16.7 15.8 19.3 16.0 L19.5 15.2 Q16.9 14.6 14.9 14.2 Z",
  "M9.2 17.8 Q7.9 20.1 6.2 21.4 L6.6 22.2 Q8.5 21.1 10.4 19.0 Z",
  "M13.6 19.0 Q15.5 21.1 17.4 22.2 L17.8 21.4 Q16.1 20.1 14.8 17.8 Z",
  "M9.6 8.2 A2.4 2.4 0 1 1 14.4 8.2 A2.4 2.4 0 1 1 9.6 8.2 Z",
  "M12.0 9.8 C17.1 11.9 17.1 17.9 12.0 20.6 C6.9 17.9 6.9 11.9 12.0 9.8 Z M12 11.8 L14.4 15.2 L12 18.6 L9.6 15.2 Z",
];

const LOGO_BOX: Record<
  LogoSize,
  { readonly px: number; readonly box: string }
> = {
  sm: { px: 16, box: "h-4 w-4" },
  md: { px: 20, box: "h-5 w-5" },
  lg: { px: 28, box: "h-7 w-7" },
};

const LOGO_WORD: Record<
  LogoSize,
  { readonly text: string; readonly gap: string }
> = {
  sm: { text: "text-md", gap: "gap-2" },
  md: { text: "text-xl", gap: "gap-2" },
  lg: { text: "text-2xl", gap: "gap-3" },
};

export function logoSpec(size: LogoSize): LogoSpec {
  const box = LOGO_BOX[size];
  return {
    px: box.px,
    box: box.box,
    viewBox: "0 0 24 24",
    shapes: LOGO_SHAPES,
    ink: "currentColor",
    fillRule: "evenodd",
  };
}

export function Logo(
  props: { size?: LogoSize; class?: string },
): JSX.Element {
  const size = () => props.size ?? "md";
  const spec = () => logoSpec(size());
  const word = () => LOGO_WORD[size()];
  return (
    <span
      class={`inline-flex items-center font-brand font-bold tracking-tight leading-none ${word().gap} ${
        props.class ?? ""
      }`}
    >
      <Web size={spec().px} class={`${spec().box} shrink-0 text-primary`} />
      <span class={`${word().text} leading-none`}>spin</span>
    </span>
  );
}
