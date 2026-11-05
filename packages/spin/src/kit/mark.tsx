// Brand mark and wordmark: full-page organic spiral orb-weaver canvas with 7-stage camera zoom, ~10s weave, and CTM-exact mouse crawling.
import { animate } from "animejs";
import type { JSX } from "solid-js";
import { createEffect, For, onCleanup, onMount } from "solid-js";
import { Web } from "./web.tsx";

const RAD = Math.PI / 180;

// Widescreen 1440x900 canvas: hub sits at (800, 455) with wide organic aspect so the web spans edge-to-edge
const HUB_X = 800;
const HUB_Y = 455;
const ASPECT_X = 1.56;
const ASPECT_Y = 1.05;

// 15 irregular, natural radial spoke angles (non-uniform sector widths for an organic orb web)
const SPOKE_ANGLES = [
  -93, -67, -39, -15, 8, 31, 57, 82, 106, 132, 154, 177, -159, -136, -115,
] as const;

// Long boundary guy-line extents reaching past all edges/corners of the 1440x900 screen
const ANCHOR_EXTENTS = [
  680, 740, 820, 780, 760, 790, 820, 720, 680, 790, 920, 960, 940, 900, 760,
] as const;

export interface OrbRingSpec {
  readonly ringIndex: number;
  readonly radius: number;
  readonly label: string;
  readonly shortLabel: string;
  readonly href: string;
  readonly spokeIndex: number;
}

// 7 organic spiral revolutions (0..6) — one dedicated revolution per landing stage (Hero + 6 architecture stages)
export const ORB_RINGS: readonly OrbRingSpec[] = [
  {
    ringIndex: 0,
    radius: 436,
    label: "00 · Spin",
    shortLabel: "Hero",
    href: "/",
    spokeIndex: 0,
  },
  {
    ringIndex: 1,
    radius: 368,
    label: "01 · Themes",
    shortLabel: "Themes",
    href: "/themes",
    spokeIndex: 2,
  },
  {
    ringIndex: 2,
    radius: 302,
    label: "02 · Utilities",
    shortLabel: "Utilities",
    href: "/utilities",
    spokeIndex: 4,
  },
  {
    ringIndex: 3,
    radius: 240,
    label: "03 · Primitives",
    shortLabel: "Primitives",
    href: "/components",
    spokeIndex: 6,
  },
  {
    ringIndex: 4,
    radius: 182,
    label: "04 · Components",
    shortLabel: "Components",
    href: "/components/machine-combobox",
    spokeIndex: 8,
  },
  {
    ringIndex: 5,
    radius: 126,
    label: "05 · Tooling",
    shortLabel: "Tooling",
    href: "/tooling/lints",
    spokeIndex: 10,
  },
  {
    ringIndex: 6,
    radius: 74,
    label: "06 · Studio",
    shortLabel: "Studio",
    href: "/guide/studio",
    spokeIndex: 13,
  },
] as const;

export const WEB_ANCHOR_NODES: readonly {
  readonly id: string;
  readonly token: string;
  readonly ring: number;
  readonly spoke: number;
  readonly role: string;
}[] = [
  { id: "primary", token: "color.primary", ring: 1, spoke: 2, role: "Primary brand token" },
  { id: "surface", token: "color.surface-raised", ring: 2, spoke: 4, role: "Raised surface token" },
  { id: "spacing", token: "spacing.4", ring: 3, spoke: 6, role: "Rhythm scale step" },
  { id: "radius", token: "radius.lg", ring: 4, spoke: 8, role: "Corner geometry token" },
  { id: "font", token: "font.family.heading", ring: 5, spoke: 10, role: "Display typography token" },
  { id: "success", token: "color.semantic.success", ring: 6, spoke: 13, role: "Verification gate token" },
] as const;

interface SpokeGeom {
  readonly index: number;
  readonly angleDeg: number;
  readonly angleRad: number;
  readonly cos: number;
  readonly sin: number;
  readonly outerX: number;
  readonly outerY: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly forkAx: number;
  readonly forkAy: number;
  readonly forkBx: number;
  readonly forkBy: number;
}

interface SilkSegmentGeom {
  readonly globalIndex: number;
  readonly ringIndex: number;
  readonly spokeIndex: number;
  readonly nextSpokeIndex: number;
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  readonly baseCx: number;
  readonly baseCy: number;
  readonly midX: number;
  readonly midY: number;
  readonly token: string;
}

const TOKEN_CYCLE = [
  "color.primary",
  "color.surface-raised",
  "color.text",
  "spacing.4",
  "radius.md",
  "font.family.heading",
  "color.border-strong",
  "color.semantic.success",
] as const;

const SPOKES: readonly SpokeGeom[] = SPOKE_ANGLES.map((deg, index) => {
  const rad = deg * RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Organic variation in outer frame attachment radius
  const wave = Math.sin(index * 1.9 + 0.4) * 24 + Math.cos(index * 3.1) * 12;
  const outerR = ORB_RINGS[0]!.radius + 26 + wave;
  const anchorR = ANCHOR_EXTENTS[index] ?? 780;
  const outerX = HUB_X + cos * outerR * ASPECT_X;
  const outerY = HUB_Y + sin * outerR * ASPECT_Y;
  const anchorX = HUB_X + cos * anchorR * ASPECT_X;
  const anchorY = HUB_Y + sin * anchorR * ASPECT_Y;
  // Secondary Y-fork guy-line near the outer frame for natural anchor tension
  const forkMidX = outerX + (anchorX - outerX) * 0.35;
  const forkMidY = outerY + (anchorY - outerY) * 0.35;
  const perpX = -sin * 48;
  const perpY = cos * 48;
  return {
    index,
    angleDeg: deg,
    angleRad: rad,
    cos,
    sin,
    outerX,
    outerY,
    anchorX,
    anchorY,
    forkAx: forkMidX,
    forkAy: forkMidY,
    forkBx: anchorX + perpX,
    forkBy: anchorY + perpY,
  };
});

/**
 * Computes an organic spiral knot point for `(ringIdx, spokeIdx)`.
 * Unlike rigid concentric polygons, the radius spirals inward continuously
 * across spokes and carries subtle natural asymmetry + gravity droop.
 */
function knotPoint(ringIdx: number, spokeIdx: number): [number, number] {
  const ring = ORB_RINGS[ringIdx]!;
  const nextRingRadius =
    ringIdx + 1 < ORB_RINGS.length
      ? ORB_RINGS[ringIdx + 1]!.radius
      : ring.radius * 0.58;
  const spoke = SPOKES[spokeIdx]!;
  const spokeFrac = spokeIdx / SPOKES.length;
  // Continuous inward spiral pitch + organic per-knot variation
  const spiralR =
    ring.radius - (ring.radius - nextRingRadius) * spokeFrac * 0.62;
  const organicOffset =
    Math.sin(spokeIdx * 2.3 + ringIdx * 1.7) * (4.5 - ringIdx * 0.4) +
    Math.cos(spokeIdx * 1.4 - ringIdx * 2.1) * 2.8;
  const r = spiralR + organicOffset;
  const gravityDroop = Math.max(0, spoke.sin) * (ring.radius * 0.035);
  return [
    HUB_X + spoke.cos * r * ASPECT_X,
    HUB_Y + spoke.sin * r * ASPECT_Y + gravityDroop,
  ];
}

// 7 rings × 15 spokes = 105 organic catenary silk segments
const SILK_SEGMENTS: readonly SilkSegmentGeom[] = ORB_RINGS.flatMap(
  (_ring, ringIndex) =>
    SPOKES.map((spoke, spokeIndex) => {
      const nextSpokeIndex = (spokeIndex + 1) % SPOKES.length;
      const nextSpoke = SPOKES[nextSpokeIndex]!;
      const [ax, ay] = knotPoint(ringIndex, spokeIndex);
      // On the last spoke of a ring, step smoothly inward toward the next ring's start knot
      const [bx, by] =
        spokeIndex === SPOKES.length - 1 && ringIndex + 1 < ORB_RINGS.length
          ? knotPoint(ringIndex + 1, 0)
          : knotPoint(ringIndex, nextSpokeIndex);

      const chordMidX = (ax + bx) * 0.5;
      const chordMidY = (ay + by) * 0.5;
      const dx = chordMidX - HUB_X;
      const dy = chordMidY - HUB_Y;
      // Inward radial tension + subtle downward gravity sag on each catenary strand
      const inwardPull = 0.915 + ((ringIndex + spokeIndex) % 3) * 0.012;
      const gravitySag = 4.2 + Math.max(0, (spoke.sin + nextSpoke.sin) * 0.5) * 6.5;
      const baseCx = HUB_X + dx * inwardPull;
      const baseCy = HUB_Y + dy * inwardPull + gravitySag;
      const midX = 0.25 * ax + 0.5 * baseCx + 0.25 * bx;
      const midY = 0.25 * ay + 0.5 * baseCy + 0.25 * by;
      const globalIndex = ringIndex * SPOKES.length + spokeIndex;
      return {
        globalIndex,
        ringIndex,
        spokeIndex,
        nextSpokeIndex,
        ax,
        ay,
        bx,
        by,
        baseCx,
        baseCy,
        midX,
        midY,
        token: TOKEN_CYCLE[globalIndex % TOKEN_CYCLE.length]!,
      };
    }),
);

function evalSegmentWithPause(
  seg: SilkSegmentGeom,
  rawLocalT: number,
): { x: number; y: number; deg: number; attachFrac: number } {
  const travelWindow = 0.85;
  const t = Math.max(0, Math.min(1, rawLocalT / travelWindow));
  const u = 1 - t;
  const x = u * u * seg.ax + 2 * u * t * seg.baseCx + t * t * seg.bx;
  const y = u * u * seg.ay + 2 * u * t * seg.baseCy + t * t * seg.by;
  const tx = 2 * u * (seg.baseCx - seg.ax) + 2 * t * (seg.bx - seg.baseCx);
  const ty = 2 * u * (seg.baseCy - seg.ay) + 2 * t * (seg.by - seg.baseCy);
  const deg = Math.atan2(ty, tx) / RAD + 90;
  return { x, y, deg, attachFrac: t };
}

function solveClampedIK(
  hx: number,
  hy: number,
  targetX: number,
  targetY: number,
  l1: number,
  l2: number,
  side: -1 | 1,
  pair: 0 | 1 | 2 | 3,
): { kx: number; ky: number; fx: number; fy: number } {
  const dx = targetX - hx;
  const dy = targetY - hy;
  const rawD = Math.hypot(dx, dy) || 0.001;
  const minD = Math.abs(l1 - l2) + 0.2;
  const maxD = l1 + l2 - 0.2;
  const d = Math.max(minD, Math.min(maxD, rawD));
  const ux = dx / rawD;
  const uy = dy / rawD;
  const fx = hx + ux * d;
  const fy = hy + uy * d;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = hx + a * ux;
  const my = hy + a * uy;
  const wantForward = pair <= 1;
  const sign = wantForward ? -side : side;
  const nx = -uy * sign;
  const ny = ux * sign;
  return {
    kx: mx + h * nx,
    ky: my + h * ny,
    fx,
    fy,
  };
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
  readonly phaseOffset: number;
}

const LEG_RIGS: readonly LegRig[] = [
  // Left 4 legs
  { side: -1, pair: 0, hipX: -2.8, hipY: -7.2, restFootX: -12.0, restFootY: -20.0, l1: 8.2, l2: 9.2, phaseOffset: 0 },
  { side: -1, pair: 1, hipX: -4.1, hipY: -4.8, restFootX: -19.0, restFootY: -8.0, l1: 8.6, l2: 9.2, phaseOffset: Math.PI },
  { side: -1, pair: 2, hipX: -4.1, hipY: -2.2, restFootX: -19.0, restFootY: 6.0, l1: 8.6, l2: 9.2, phaseOffset: 0.4 },
  { side: -1, pair: 3, hipX: -3.0, hipY: 0.3, restFootX: -12.5, restFootY: 18.0, l1: 9.0, l2: 10.2, phaseOffset: Math.PI + 0.4 },
  // Right 4 legs
  { side: 1, pair: 0, hipX: 2.8, hipY: -7.2, restFootX: 12.0, restFootY: -20.0, l1: 8.2, l2: 9.2, phaseOffset: Math.PI },
  { side: 1, pair: 1, hipX: 4.1, hipY: -4.8, restFootX: 19.0, restFootY: -8.0, l1: 8.6, l2: 9.2, phaseOffset: 0 },
  { side: 1, pair: 2, hipX: 4.1, hipY: -2.2, restFootX: 19.0, restFootY: 6.0, l1: 8.6, l2: 9.2, phaseOffset: Math.PI + 0.4 },
  { side: 1, pair: 3, hipX: 3.0, hipY: 0.3, restFootX: 12.5, restFootY: 18.0, l1: 9.0, l2: 10.2, phaseOffset: 0.4 },
];

export interface MarkPluckEvent {
  readonly token: string;
  readonly x: number;
  readonly y: number;
  readonly ring: number;
  readonly spoke: number;
  readonly stage: number;
}

export interface SpiderStatus {
  readonly mode: "weaving" | "cursor" | "hub";
  readonly ring: number;
  readonly x: number;
  readonly y: number;
}

function shortestAngleDelta(fromDeg: number, toDeg: number): number {
  let diff = ((toDeg - fromDeg + 180) % 360) - 180;
  if (diff < -180) diff += 360;
  return diff;
}

// Camera keyframes per stage (0..6): gently zooms inward as the spider weaves from the outer perimeter to the hub
const CAMERA_KEYFRAMES: readonly {
  readonly scale: number;
  readonly tx: number;
  readonly ty: number;
}[] = [
  { scale: 0.96, tx: 18, ty: 0 },
  { scale: 1.04, tx: 28, ty: -6 },
  { scale: 1.14, tx: 42, ty: 8 },
  { scale: 1.26, tx: 56, ty: -8 },
  { scale: 1.40, tx: 72, ty: 6 },
  { scale: 1.56, tx: 88, ty: -4 },
  { scale: 1.72, tx: 102, ty: 0 },
] as const;

export function Mark(props: {
  readonly class?: string;
  readonly stage?: number;
  readonly reweaveKey?: number;
  readonly activeToken?: string;
  readonly onPluck?: (event: MarkPluckEvent) => void;
  readonly onSelectStage?: (stage: number) => void;
  readonly onNavigateLayer?: (href: string, stage: number) => void;
  readonly onStatusChange?: (status: SpiderStatus) => void;
}): JSX.Element {
  let svgRef: SVGSVGElement | undefined;
  let cameraGroupRef: SVGGElement | undefined;
  let spiderGroupRef: SVGGElement | undefined;
  let bodyGroupRef: SVGGElement | undefined;
  let draglineRef: SVGLineElement | undefined;
  let spinneretSilkRef: SVGPathElement | undefined;
  let rippleCircleRef: SVGCircleElement | undefined;

  const spokeEls: SVGLineElement[] = [];
  const silkEls: SVGPathElement[] = [];
  const nodeGroupEls: SVGGElement[] = [];
  const legEls: SVGPathElement[] = [];
  const legJointEls: SVGCircleElement[] = [];

  // Plain non-reactive hover index so pointer hover NEVER triggers SolidJS createEffect or resets the animation!
  let hoveredRingIdx: number | null = null;

  // Progress ∈ [0, 7]: Stage s weaves from s to s + 1 (15 spokes per revolution)
  const weaveState = { progress: 0 };
  let activeWeaveAnim: { pause?: () => void } | null = null;
  let isCurrentlyWeaving = false;
  let lastReportedMode: SpiderStatus["mode"] | "" = "";

  // Spider kinematic state
  let spiderX = HUB_X;
  let spiderY = HUB_Y - ORB_RINGS[0]!.radius;
  let spiderDeg = 90;
  let gaitPhase = 0;
  let anchorKnotX = HUB_X;
  let anchorKnotY = HUB_Y;

  // Mouse-cursor target in cameraGroup local coordinates (transformed via getScreenCTM().inverse())
  const cursorTarget = {
    x: HUB_X,
    y: HUB_Y,
    active: false,
  };

  let reducedMotion = false;
  let rafId = 0;

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

  const renderLegs = (phase: number, breath = 0) => {
    for (let i = 0; i < LEG_RIGS.length; i++) {
      const rig = LEG_RIGS[i]!;
      const p = phase + rig.phaseOffset;
      const strideY = Math.sin(p) * 2.4;
      const swingLift = Math.max(0, Math.cos(p)) * 1.5;
      const hx = rig.hipX;
      const hy = rig.hipY + breath * 0.2;
      const desiredFx = rig.restFootX + rig.side * swingLift;
      const desiredFy = rig.restFootY + strideY;

      const { kx, ky, fx, fy } = solveClampedIK(
        hx,
        hy,
        desiredFx,
        desiredFy,
        rig.l1,
        rig.l2,
        rig.side,
        rig.pair,
      );

      legEls[i]?.setAttribute(
        "d",
        `M${hx.toFixed(1)} ${hy.toFixed(1)} L${kx.toFixed(1)} ${ky.toFixed(1)} L${fx.toFixed(1)} ${fy.toFixed(1)}`,
      );
      legJointEls[i]?.setAttribute("cx", kx.toFixed(1));
      legJointEls[i]?.setAttribute("cy", ky.toFixed(1));
    }
  };

  const updateSpiderTransform = (breath = 0) => {
    spiderGroupRef?.setAttribute(
      "transform",
      `translate(${spiderX.toFixed(2)} ${spiderY.toFixed(2)}) rotate(${spiderDeg.toFixed(2)})`,
    );
    bodyGroupRef?.setAttribute("transform", `translate(0 ${breath.toFixed(2)})`);
    const [spx, spy] = toWorld(0, 12.2, spiderX, spiderY, spiderDeg);
    if (draglineRef) {
      draglineRef.setAttribute("x1", anchorKnotX.toFixed(1));
      draglineRef.setAttribute("y1", anchorKnotY.toFixed(1));
      draglineRef.setAttribute("x2", spx.toFixed(1));
      draglineRef.setAttribute("y2", spy.toFixed(1));
    }
  };

  const reportStatus = (mode: SpiderStatus["mode"], ring: number) => {
    if (mode !== lastReportedMode) {
      lastReportedMode = mode;
      props.onStatusChange?.({
        mode,
        ring,
        x: Math.round(spiderX),
        y: Math.round(spiderY),
      });
    }
  };

  // Pure DOM highlight updater for completed strands — never touches spider position or reactive effects
  const updateStrandHighlights = () => {
    const totalSegs = SILK_SEGMENTS.length;
    const exactSeg = Math.max(0, Math.min(totalSegs, weaveState.progress * SPOKES.length));
    const completedCount = Math.floor(exactSeg);
    const activeStageRing = Math.min(
      ORB_RINGS.length - 1,
      Math.max(0, Math.floor(weaveState.progress - 0.0001)),
    );

    for (let i = 0; i < completedCount; i++) {
      const el = silkEls[i];
      if (!el) continue;
      const seg = SILK_SEGMENTS[i]!;
      const isHi =
        hoveredRingIdx !== null
          ? seg.ringIndex === hoveredRingIdx
          : seg.ringIndex === activeStageRing;
      el.setAttribute("opacity", isHi ? "0.95" : "0.52");
      el.setAttribute(
        "stroke",
        isHi ? "var(--color-primary)" : "var(--color-border-strong)",
      );
      el.setAttribute("stroke-width", isHi ? "1.95" : "1.3");
    }
  };

  const syncWeaveDOM = (progress: number) => {
    const totalSegs = SILK_SEGMENTS.length;
    const exactSeg = Math.max(0, Math.min(totalSegs, progress * SPOKES.length));
    const currentSegIdx = Math.min(totalSegs - 1, Math.floor(exactSeg));
    const localT = exactSeg - currentSegIdx;

    // 1. Radial spokes
    const spokeAlpha = Math.max(0.35, Math.min(0.68, progress * 1.4));
    for (let s = 0; s < SPOKES.length; s++) {
      const el = spokeEls[s];
      if (!el) continue;
      el.setAttribute("opacity", spokeAlpha.toFixed(2));
      el.setAttribute("stroke-dashoffset", "0");
    }

    // 2. Capture silk segments
    const activeStageRing = Math.min(
      ORB_RINGS.length - 1,
      Math.max(0, Math.floor(progress - 0.0001)),
    );

    for (let i = 0; i < totalSegs; i++) {
      const el = silkEls[i];
      if (!el) continue;
      const seg = SILK_SEGMENTS[i]!;
      const isHighlightedRing =
        hoveredRingIdx !== null
          ? seg.ringIndex === hoveredRingIdx
          : seg.ringIndex === activeStageRing;

      if (i < currentSegIdx || exactSeg >= totalSegs) {
        el.setAttribute("stroke-dashoffset", "0");
        el.setAttribute("opacity", isHighlightedRing ? "0.95" : "0.52");
        el.setAttribute(
          "stroke",
          isHighlightedRing
            ? "var(--color-primary)"
            : "var(--color-border-strong)",
        );
        el.setAttribute("stroke-width", isHighlightedRing ? "1.95" : "1.3");
      } else if (i === currentSegIdx && exactSeg < totalSegs) {
        const pose = evalSegmentWithPause(seg, localT);
        // Prevent stroke-linecap="round" from rendering a stray dot when attachFrac is 0!
        if (pose.attachFrac <= 0.004) {
          el.setAttribute("stroke-dashoffset", "1");
          el.setAttribute("opacity", "0");
        } else {
          el.setAttribute("stroke-dashoffset", (1 - pose.attachFrac).toFixed(3));
          el.setAttribute("opacity", "1");
          el.setAttribute("stroke", "var(--color-primary)");
          el.setAttribute("stroke-width", "2.25");
        }
      } else {
        el.setAttribute("stroke-dashoffset", "1");
        el.setAttribute("opacity", "0");
      }
    }

    // 3. Layer nodes appear as their ring weaves
    for (let r = 0; r < ORB_RINGS.length; r++) {
      const nodeEl = nodeGroupEls[r];
      if (!nodeEl) continue;
      const ringProgress = Math.max(0, Math.min(1, progress - r));
      nodeEl.setAttribute(
        "opacity",
        ringProgress > 0.15
          ? Math.min(1, (ringProgress - 0.15) * 1.5).toFixed(2)
          : "0.22",
      );
    }

    // 4. Position spider along the active segment
    const prevX = spiderX;
    const prevY = spiderY;

    if (exactSeg >= totalSegs) {
      const lastSeg = SILK_SEGMENTS[totalSegs - 1]!;
      spiderX = lastSeg.bx;
      spiderY = lastSeg.by;
      anchorKnotX = HUB_X;
      anchorKnotY = HUB_Y;
      spinneretSilkRef?.setAttribute("opacity", "0");
    } else {
      // If exactSeg is at an exact integer boundary (localT === 0) and we are not actively weaving,
      // rest at the end of the just-completed segment (`currentSegIdx - 1`) instead of jumping to the next ring!
      const restingAtEnd = !isCurrentlyWeaving && localT < 0.001 && currentSegIdx > 0;
      const seg = restingAtEnd
        ? SILK_SEGMENTS[currentSegIdx - 1]!
        : SILK_SEGMENTS[currentSegIdx]!;
      const pose = evalSegmentWithPause(seg, restingAtEnd ? 1 : localT);
      spiderX = pose.x;
      spiderY = pose.y;
      spiderDeg = pose.deg;
      anchorKnotX = HUB_X;
      anchorKnotY = HUB_Y;

      if (restingAtEnd) {
        spinneretSilkRef?.setAttribute("opacity", "0");
      } else {
        const [spx, spy] = toWorld(0, 12.2, spiderX, spiderY, spiderDeg);
        if (spinneretSilkRef) {
          spinneretSilkRef.setAttribute(
            "d",
            `M${seg.ax.toFixed(1)} ${seg.ay.toFixed(1)} Q${((seg.ax + spx) * 0.5).toFixed(1)} ${((seg.ay + spy) * 0.5).toFixed(1)} ${spx.toFixed(1)} ${spy.toFixed(1)}`,
          );
          spinneretSilkRef.setAttribute("opacity", "0.92");
        }
      }
    }

    const stepDist = Math.hypot(spiderX - prevX, spiderY - prevY);
    if (stepDist > 0.001 && stepDist < 80) {
      gaitPhase += stepDist * 0.42;
    }

    updateSpiderTransform(0);
    renderLegs(gaitPhase, 0);
  };

  const animateToStage = (targetStage: number, forceReweaveRing = false) => {
    // Stage s ∈ [0..6] weaves ring s, bringing progress from s to s + 1!
    const clampedStage = Math.max(0, Math.min(ORB_RINGS.length - 1, targetStage));
    const targetProgress = clampedStage + 1;

    activeWeaveAnim?.pause?.();

    if (reducedMotion) {
      isCurrentlyWeaving = false;
      weaveState.progress = targetProgress;
      syncWeaveDOM(targetProgress);
      reportStatus("cursor", clampedStage);
      return;
    }

    if (forceReweaveRing) {
      const startProgress = clampedStage;
      weaveState.progress = startProgress;
      syncWeaveDOM(startProgress);
    } else if (weaveState.progress < clampedStage) {
      // Complete earlier outer rings immediately so the spider spends the full ~9.8s
      // spinning the newly entered stage's ring!
      weaveState.progress = clampedStage;
      syncWeaveDOM(weaveState.progress);
    }

    const deltaRings = Math.abs(targetProgress - weaveState.progress);
    if (deltaRings < 0.005) {
      isCurrentlyWeaving = false;
      weaveState.progress = targetProgress;
      syncWeaveDOM(targetProgress);
      reportStatus("cursor", clampedStage);
      return;
    }

    const isForward = targetProgress > weaveState.progress;
    // ~9.8 seconds per ring revolution forward; 1.8s when stepping backward
    const duration = isForward
      ? Math.round(deltaRings * 9800)
      : Math.max(1100, Math.round(deltaRings * 1800));

    isCurrentlyWeaving = true;
    reportStatus("weaving", clampedStage);

    activeWeaveAnim = animate(weaveState, {
      progress: targetProgress,
      duration,
      ease: "linear",
      onUpdate: () => {
        syncWeaveDOM(weaveState.progress);
      },
      onComplete: () => {
        isCurrentlyWeaving = false;
        spinneretSilkRef?.setAttribute("opacity", "0");
        reportStatus("cursor", clampedStage);
      },
    });
  };

  const triggerPluckRipple = (
    x: number,
    y: number,
    token: string,
    ringIdx: number,
    spokeIdx: number,
  ) => {
    if (rippleCircleRef && !reducedMotion) {
      rippleCircleRef.setAttribute("cx", x.toFixed(1));
      rippleCircleRef.setAttribute("cy", y.toFixed(1));
      animate(rippleCircleRef, {
        r: [4, 48],
        opacity: [0.85, 0],
        duration: 620,
        ease: "outCubic",
      });
    }
    props.onPluck?.({
      token,
      x: Math.round(x),
      y: Math.round(y),
      ring: ringIdx + 1,
      spoke: spokeIdx + 1,
      stage: ringIdx,
    });
  };

  onMount(() => {
    reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const firstSeg = SILK_SEGMENTS[0]!;
    spiderX = firstSeg.ax;
    spiderY = firstSeg.ay;
    spiderDeg = 90;
    syncWeaveDOM(0);

    // Hardware-exact conversion from window pointer (clientX, clientY) into cameraGroup local SVG space!
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!cameraGroupRef) return;
      const ctm = cameraGroupRef.getScreenCTM();
      if (!ctm) return;
      const inv = ctm.inverse();
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(inv);
      cursorTarget.x = Math.max(80, Math.min(1380, pt.x));
      cursorTarget.y = Math.max(60, Math.min(850, pt.y));
      cursorTarget.active = true;
    };

    window.addEventListener("pointermove", handleWindowPointerMove, {
      passive: true,
    });

    // Continuous 60fps loop for post-weave mouse-cursor crawling + idle breathing
    let lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      if (!isCurrentlyWeaving && !reducedMotion) {
        const breath = Math.sin(now * 0.0032) * 0.45;
        if (cursorTarget.active) {
          const dx = cursorTarget.x - spiderX;
          const dy = cursorTarget.y - spiderY;
          const dist = Math.hypot(dx, dy);

          if (dist > 16) {
            const desiredDeg = Math.atan2(dy, dx) / RAD + 90;
            const angleDiff = shortestAngleDelta(spiderDeg, desiredDeg);
            spiderDeg += angleDiff * Math.min(1, dt * 10);

            const speed = Math.min(175, Math.max(30, (dist - 14) * 2.5));
            const step = Math.min(dist - 14, speed * dt);
            spiderX += (dx / dist) * step;
            spiderY += (dy / dist) * step;
            gaitPhase += step * 0.44;
          }
          updateSpiderTransform(breath);
          renderLegs(gaitPhase, breath);
        } else {
          updateSpiderTransform(breath);
          renderLegs(gaitPhase, breath);
        }
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    animateToStage(props.stage ?? 0, false);

    onCleanup(() => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      activeWeaveAnim?.pause?.();
      cancelAnimationFrame(rafId);
    });
  });

  // React ONLY to props.stage changes (never to hover state!)
  createEffect(() => {
    const targetStage = Math.max(
      0,
      Math.min(CAMERA_KEYFRAMES.length - 1, props.stage ?? 0),
    );
    const cam = CAMERA_KEYFRAMES[targetStage] ?? CAMERA_KEYFRAMES[0]!;
    if (cameraGroupRef && !reducedMotion) {
      cameraGroupRef.style.transition =
        "transform 1150ms cubic-bezier(0.22, 1, 0.36, 1)";
      cameraGroupRef.style.transformOrigin = `${HUB_X}px ${HUB_Y}px`;
      cameraGroupRef.style.transform = `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.scale.toFixed(3)})`;
    }
    if (svgRef) {
      animateToStage(targetStage, false);
    }
  });

  // React ONLY to explicit replay button clicks
  createEffect(() => {
    const key = props.reweaveKey;
    if (key !== undefined && key > 0 && svgRef) {
      animateToStage(props.stage ?? 0, true);
    }
  });

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      role="img"
      aria-label="Interactive outside-in orb-weaver web across Spin architecture layers"
      class={props.class ?? "h-full w-full text-text-muted"}
    >
      <defs>
        <radialGradient id="spin-orb-glow" cx="56%" cy="50%" r="58%">
          <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.11" />
          <stop offset="55%" stop-color="var(--color-primary)" stop-opacity="0.03" />
          <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0" />
        </radialGradient>
        <filter id="spin-spider-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx="0"
            dy="2.5"
            stdDeviation="2.5"
            flood-color="var(--color-text)"
            flood-opacity="0.22"
          />
        </filter>
      </defs>

      <g ref={cameraGroupRef}>
        {/* Ambient radial web glow */}
        <circle cx={HUB_X} cy={HUB_Y} r="620" fill="url(#spin-orb-glow)" />

        {/* Long outer anchor guy-lines + Y-forks stretching past all edges of the 1440x900 page */}
        <g stroke="var(--color-border-strong)" stroke-width="1" opacity="0.45">
          <For each={SPOKES}>
            {(s) => (
              <>
                <line
                  x1={s.outerX}
                  y1={s.outerY}
                  x2={s.anchorX}
                  y2={s.anchorY}
                  stroke-dasharray="5 5"
                />
                <line
                  x1={s.forkAx}
                  y1={s.forkAy}
                  x2={s.forkBx}
                  y2={s.forkBy}
                  stroke-dasharray="3 5"
                  opacity="0.65"
                />
              </>
            )}
          </For>
        </g>

        {/* Organic catenary outer boundary frame connecting spoke tips */}
        <g stroke="var(--color-border-strong)" stroke-width="1.2" opacity="0.48" fill="none">
          <For each={SPOKES}>
            {(s, idx) => {
              const next = SPOKES[(idx() + 1) % SPOKES.length]!;
              const mx = (s.outerX + next.outerX) * 0.5;
              const my = (s.outerY + next.outerY) * 0.5;
              const cx = HUB_X + (mx - HUB_X) * 0.93;
              const cy = HUB_Y + (my - HUB_Y) * 0.93 + 5;
              return (
                <path
                  d={`M${s.outerX.toFixed(1)} ${s.outerY.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${next.outerX.toFixed(1)} ${next.outerY.toFixed(1)}`}
                />
              );
            }}
          </For>
        </g>

        {/* 15 natural asymmetric radial spokes from hub to perimeter */}
        <g
          stroke="var(--color-border-strong)"
          stroke-width="1.25"
          stroke-linecap="round"
        >
          <For each={SPOKES}>
            {(s, idx) => (
              <line
                ref={(el) => {
                  spokeEls[idx()] = el;
                }}
                x1={HUB_X}
                y1={HUB_Y}
                x2={s.outerX}
                y2={s.outerY}
                pathLength="1"
                stroke-dasharray="1"
                stroke-dashoffset="0"
                opacity="0.48"
              />
            )}
          </For>
        </g>

        {/* Faint organic spiral guide path for unwritten inner layers */}
        <g
          stroke="var(--color-border)"
          stroke-width="0.75"
          stroke-dasharray="2 6"
          opacity="0.32"
          fill="none"
        >
          <For each={SILK_SEGMENTS}>
            {(seg) => (
              <path
                d={`M${seg.ax.toFixed(1)} ${seg.ay.toFixed(1)} Q${seg.baseCx.toFixed(1)} ${seg.baseCy.toFixed(1)} ${seg.bx.toFixed(1)} ${seg.by.toFixed(1)}`}
              />
            )}
          </For>
        </g>

        {/* 105 organic spiral capture silk segments (7 revolutions × 15 spokes, outside-in) */}
        <g stroke-linecap="round" fill="none">
          <For each={SILK_SEGMENTS}>
            {(seg, idx) => (
              <path
                ref={(el) => {
                  silkEls[idx()] = el;
                }}
                d={`M${seg.ax.toFixed(1)} ${seg.ay.toFixed(1)} Q${seg.baseCx.toFixed(1)} ${seg.baseCy.toFixed(1)} ${seg.bx.toFixed(1)} ${seg.by.toFixed(1)}`}
                pathLength="1"
                stroke-dasharray="1"
                stroke-dashoffset="1"
                stroke="var(--color-border-strong)"
                stroke-width="1.35"
                opacity="0"
                class="pointer-events-auto cursor-pointer transition-opacity duration-fast"
                onPointerEnter={() => {
                  hoveredRingIdx = seg.ringIndex;
                  updateStrandHighlights();
                  triggerPluckRipple(
                    seg.midX,
                    seg.midY,
                    seg.token,
                    seg.ringIndex,
                    seg.spokeIndex,
                  );
                }}
                onPointerLeave={() => {
                  hoveredRingIdx = null;
                  updateStrandHighlights();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onSelectStage?.(seg.ringIndex);
                }}
              />
            )}
          </For>
        </g>

        {/* Hub irregular silk mesh */}
        <circle
          cx={HUB_X}
          cy={HUB_Y}
          r="22"
          stroke="var(--color-border-strong)"
          stroke-width="0.9"
          stroke-dasharray="3 4"
          opacity="0.5"
        />
        <circle
          cx={HUB_X}
          cy={HUB_Y}
          r="11"
          stroke="var(--color-border-strong)"
          stroke-width="1"
          stroke-dasharray="2 3"
          opacity="0.6"
        />
        <circle
          cx={HUB_X}
          cy={HUB_Y}
          r="4.5"
          fill="var(--color-surface-raised)"
          stroke="var(--color-primary)"
          stroke-width="2"
        />

        {/* Pluck ripple ring */}
        <circle
          ref={rippleCircleRef}
          cx={HUB_X}
          cy={HUB_Y}
          r="4"
          stroke="var(--color-primary)"
          stroke-width="1.75"
          fill="none"
          opacity="0"
          pointer-events="none"
        />

        {/* Clickable layer badges anchored on rings 1..6 */}
        <g>
          <For each={ORB_RINGS}>
            {(ring, rIdx) => {
              const [nx, ny] = knotPoint(rIdx(), ring.spokeIndex);
              const isCurrent = () => (props.stage ?? 0) === rIdx();
              return (
                <g
                  ref={(el) => {
                    nodeGroupEls[rIdx()] = el;
                  }}
                  transform={`translate(${nx.toFixed(1)} ${ny.toFixed(1)})`}
                  class="pointer-events-auto cursor-pointer"
                  opacity="0.25"
                  onPointerEnter={() => {
                    hoveredRingIdx = rIdx();
                    updateStrandHighlights();
                  }}
                  onPointerLeave={() => {
                    hoveredRingIdx = null;
                    updateStrandHighlights();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isCurrent() && rIdx() > 0 && props.onNavigateLayer) {
                      props.onNavigateLayer(ring.href, rIdx());
                    } else {
                      props.onSelectStage?.(rIdx());
                    }
                  }}
                >
                  <circle
                    r={isCurrent() ? "12" : "8"}
                    fill="var(--color-primary)"
                    opacity={isCurrent() ? "0.22" : "0.08"}
                  />
                  <circle
                    r={isCurrent() ? "5" : "3.8"}
                    fill={
                      isCurrent()
                        ? "var(--color-primary)"
                        : "var(--color-surface-raised)"
                    }
                    stroke="var(--color-primary)"
                    stroke-width="1.8"
                  />
                  <g transform="translate(10 -10)">
                    <rect
                      x="0"
                      y="0"
                      width={ring.label.length * 6.4 + 14}
                      height="20"
                      rx="5"
                      fill="var(--color-surface-raised)"
                      stroke={
                        isCurrent()
                          ? "var(--color-primary)"
                          : "var(--color-border-strong)"
                      }
                      stroke-width={isCurrent() ? "1.5" : "1"}
                    />
                    <text
                      x="7"
                      y="13.5"
                      fill={
                        isCurrent()
                          ? "var(--color-primary)"
                          : "var(--color-text)"
                      }
                      font-size="10"
                      font-family="var(--font-family-mono, monospace)"
                      font-weight="600"
                    >
                      {ring.label}
                    </text>
                  </g>
                </g>
              );
            }}
          </For>
        </g>

        {/* Gossamer safety dragline from hub to spider spinnerets */}
        <line
          ref={draglineRef}
          x1={HUB_X}
          y1={HUB_Y}
          x2={HUB_X}
          y2={HUB_Y - ORB_RINGS[0]!.radius}
          stroke="var(--color-primary)"
          stroke-width="1.1"
          stroke-dasharray="3 3"
          opacity="0.55"
          pointer-events="none"
        />

        {/* Active silk strand emerging from spinnerets during weave */}
        <path
          ref={spinneretSilkRef}
          d=""
          stroke="var(--color-primary)"
          stroke-width="2.2"
          stroke-linecap="round"
          fill="none"
          opacity="0"
          pointer-events="none"
        />

        {/* Garden Orb-Weaver (Araneus) with bounded non-crossing radial 2-bone IK legs */}
        <g
          ref={spiderGroupRef}
          filter="url(#spin-spider-shadow)"
          transform={`translate(${HUB_X} ${HUB_Y - ORB_RINGS[0]!.radius}) rotate(90)`}
          pointer-events="none"
        >
          {/* 8 2-bone IK legs */}
          <g
            stroke="var(--color-text)"
            stroke-width="1.65"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          >
            <For each={LEG_RIGS}>
              {(_, i) => (
                <path
                  ref={(el) => {
                    legEls[i()] = el;
                  }}
                  d="M0 0 L0 0 L0 0"
                />
              )}
            </For>
          </g>

          {/* Patella knee joints */}
          <g
            fill="var(--color-surface-raised)"
            stroke="var(--color-primary)"
            stroke-width="1.15"
          >
            <For each={LEG_RIGS}>
              {(_, i) => (
                <circle
                  ref={(el) => {
                    legJointEls[i()] = el;
                  }}
                  r="1.45"
                />
              )}
            </For>
          </g>

          {/* Spider body: pedicel, prosoma, pedipalps, and botanical orb-weaver abdomen */}
          <g ref={bodyGroupRef}>
            <path
              d="M-1.9 -7.8 Q-4.4 -11.0 -2.3 -12.8 M1.9 -7.8 Q4.4 -11.0 2.3 -12.8"
              stroke="var(--color-text)"
              stroke-width="1.35"
              stroke-linecap="round"
              fill="none"
            />
            <ellipse
              cx="0"
              cy="-4.8"
              rx="4.1"
              ry="4.5"
              fill="var(--color-surface-raised)"
              stroke="var(--color-text)"
              stroke-width="1.6"
            />
            <circle cx="-1.3" cy="-8.0" r="0.75" fill="var(--color-primary)" />
            <circle cx="1.3" cy="-8.0" r="0.75" fill="var(--color-primary)" />

            <ellipse
              cx="0"
              cy="4.6"
              rx="6.4"
              ry="8.0"
              fill="var(--color-surface-raised)"
              stroke="var(--color-text)"
              stroke-width="1.75"
            />
            <path
              d="M0 -1.2 L2.8 4.4 L0 10.0 L-2.8 4.4 Z"
              fill="var(--color-primary)"
              opacity="0.92"
            />
            <circle cx="0" cy="4.4" r="1.35" fill="var(--color-surface-raised)" />
            <path
              d="M-1.2 12.2 L0 14.0 L1.2 12.2"
              stroke="var(--color-primary)"
              stroke-width="1.5"
              stroke-linecap="round"
              fill="none"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}

/**
 * The wordmark beside the mark: one-off display type the theme cannot
 * name as a style, so the lockup reads the theme's own brand voice
 * directly — the brand face, bold, on the size ramp — through the
 * variables the preflight emits. The escape excuses the ownership
 * rules; the style props name no class, so the vocabulary rule has
 * nothing to read. A reskin re-voices the lockup with the theme.
 */
const LOGO_WORD: Record<
  LogoSize,
  { readonly gap: string; readonly size: string }
> = {
  sm: { gap: "gap-2", size: "var(--font-size-lg)" },
  md: { gap: "gap-2", size: "var(--font-size-xl)" },
  lg: { gap: "gap-3", size: "var(--font-size-2xl)" },
};

export type LogoSize = "sm" | "md" | "lg";

interface LogoSpec {
  readonly px: number;
  readonly box: string;
}

const LOGO_BOX: Record<LogoSize, LogoSpec> = {
  sm: { px: 22, box: "h-5 w-5" },
  md: { px: 32, box: "h-8 w-8" },
  lg: { px: 34, box: "h-8 w-8" },
};

export function logoSpec(size: LogoSize): LogoSpec {
  return LOGO_BOX[size];
}

export function Logo(props: {
  size?: LogoSize;
  class?: string;
}): JSX.Element {
  const size = () => props.size ?? "md";
  const spec = () => logoSpec(size());
  const word = () => LOGO_WORD[size()];
  return (
    <span
      data-spin-escape="brand lockup"
      style={{
        "font-family": "var(--font-family-brand)",
        "font-weight": "var(--font-weight-bold)",
      }}
      class={`inline-flex items-center ${word().gap} ${
        props.class ?? ""
      }`}
    >
      <Web size={spec().px} class={`${spec().box} shrink-0 text-primary`} />
      <span style={{ "font-size": word().size }}>spin</span>
    </span>
  );
}
