"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, forwardRef, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, GizmoHelper, GizmoViewport, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { MOUSE, TOUCH } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { createFloorTexture } from "@/lib/floor-texture";
import { useCreatorStore } from "@/lib/store";
import {
  CURVE_SEGMENTS,
  explodePartZOffsets,
  isPartSelected,
  letterHandlePosition,
  letterStylePreviewParams,
  partColorKey,
  partHandlePosition,
  resolvePartColor,
} from "@/lib/letter-utils";
import {
  PREVIEW_GIZMO_MARGIN_X,
  PREVIEW_GIZMO_MARGIN_Y,
  PREVIEW_GIZMO_SCALE,
} from "@/lib/preview-side-rail";
import type {
  CameraView,
  HoleShape,
  LetterOffset,
  LetterPartKind,
  LetterStyleInfo,
  MountingHole,
  PreviewData,
  PreviewLetter,
  Ring,
  RingContour,
  SelectedLetterPart,
  ShadowCoverPreview,
  SnapFitPreview,
} from "@/types";

const DEFAULT_SHADOW_COLOR = "#8B5FBF";

const MIN_CAMERA_DISTANCE = 28;
const MAX_CAMERA_DISTANCE = 3200;
const ZOOM_DOLLY_FACTOR = 1.1;

/** When true, left-button must not rotate the camera (pointer is over a piece). */
const suppressOrbitRef = { current: false };

function isPrimaryPointerButton(button: number) {
  return button === 0;
}

type CanvasPlaneDragState = {
  pointerId: number;
  startPointer: { x: number; y: number };
  startOffset: { x: number; y: number };
};

function useCanvasPlaneDrag({
  enabled,
  planeRef,
  getOffset,
  onOffsetChange,
  onActiveChange,
  onSelect,
}: {
  enabled: boolean;
  planeRef: RefObject<THREE.Object3D | null>;
  getOffset: () => LetterOffset;
  onOffsetChange: (x: number, y: number) => void;
  onActiveChange?: (active: boolean) => void;
  onSelect?: (options: { additive: boolean }) => void;
}) {
  const { camera, raycaster, gl, controls } = useThree();
  const plane = useMemo(() => new THREE.Plane(), []);
  const hitWorld = useMemo(() => new THREE.Vector3(), []);
  const hitLocal = useMemo(() => new THREE.Vector3(), []);
  const normal = useMemo(() => new THREE.Vector3(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const drag = useRef<CanvasPlaneDragState | null>(null);

  const setOrbitEnabled = useCallback(
    (value: boolean) => {
      const orbit = controls as OrbitControlsImpl | undefined;
      if (orbit) orbit.enabled = value;
    },
    [controls],
  );

  const projectClient = useCallback(
    (clientX: number, clientY: number) => {
      const group = planeRef.current;
      if (!group) return null;

      normal.set(0, 0, 1).transformDirection(group.matrixWorld);
      origin.set(0, 0, 0).applyMatrix4(group.matrixWorld);
      plane.setFromNormalAndCoplanarPoint(normal, origin);

      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      if (!raycaster.ray.intersectPlane(plane, hitWorld)) return null;

      hitLocal.copy(hitWorld);
      group.worldToLocal(hitLocal);
      return { x: hitLocal.x, y: hitLocal.y };
    },
    [camera, gl.domElement, hitLocal, hitWorld, normal, origin, plane, planeRef, raycaster],
  );

  const endDrag = useCallback(
    (pointerId: number) => {
      if (!drag.current || drag.current.pointerId !== pointerId) return;
      drag.current = null;
      setOrbitEnabled(true);
      onActiveChange?.(false);
      try {
        gl.domElement.releasePointerCapture(pointerId);
      } catch {
        /* pointer already released */
      }
    },
    [gl.domElement, onActiveChange, setOrbitEnabled],
  );

  useEffect(() => {
    const el = gl.domElement;

    const onMove = (event: PointerEvent) => {
      if (!drag.current || drag.current.pointerId !== event.pointerId) return;
      if ((event.buttons & 1) !== 1) {
        endDrag(event.pointerId);
        return;
      }
      const pos = projectClient(event.clientX, event.clientY);
      if (!pos) return;
      const dx = pos.x - drag.current.startPointer.x;
      const dy = pos.y - drag.current.startPointer.y;
      if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
        onOffsetChange(drag.current.startOffset.x + dx, drag.current.startOffset.y + dy);
      }
    };

    const onUp = (event: PointerEvent) => {
      if (!drag.current || drag.current.pointerId !== event.pointerId) return;
      endDrag(event.pointerId);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [endDrag, gl.domElement, onOffsetChange, projectClient]);

  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!enabled || !isPrimaryPointerButton(event.button)) return;
      const additive =
        event.nativeEvent.shiftKey || event.nativeEvent.metaKey || event.nativeEvent.ctrlKey;
      event.stopPropagation();
      onSelect?.({ additive });
      // Shift/⌘/Ctrl+clique só alterna seleção — sem arrastar
      if (additive) return;

      // Suspend orbit immediately so left-drag moves the piece (Bambu: left on object = select/move)
      setOrbitEnabled(false);
      const pos = projectClient(event.nativeEvent.clientX, event.nativeEvent.clientY);
      if (!pos) {
        setOrbitEnabled(true);
        return;
      }
      drag.current = {
        pointerId: event.pointerId,
        startPointer: pos,
        startOffset: getOffset(),
      };
      onActiveChange?.(true);
      try {
        gl.domElement.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    },
    [enabled, getOffset, gl.domElement, onActiveChange, onSelect, projectClient, setOrbitEnabled],
  );

  return { onPointerDown };
}

export type LetterSceneHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (t: number) => void;
};

function distanceToZoom(distance: number) {
  const clamped = Math.max(MIN_CAMERA_DISTANCE, Math.min(MAX_CAMERA_DISTANCE, distance));
  // 1 = zoom in (perto), 0 = zoom out (longe) — alinhado a zoomToDistance / barra (+ em cima).
  return (
    1 -
    (Math.log(clamped) - Math.log(MIN_CAMERA_DISTANCE)) /
      (Math.log(MAX_CAMERA_DISTANCE) - Math.log(MIN_CAMERA_DISTANCE))
  );
}

function zoomToDistance(t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  return (
    MIN_CAMERA_DISTANCE *
    Math.pow(MAX_CAMERA_DISTANCE / MIN_CAMERA_DISTANCE, 1 - clamped)
  );
}

function applyCameraDistance(controls: OrbitControlsImpl, distance: number) {
  const clamped = Math.max(MIN_CAMERA_DISTANCE, Math.min(MAX_CAMERA_DISTANCE, distance));
  const direction = controls.object.position.clone().sub(controls.target);
  if (direction.lengthSq() < 1e-6) {
    direction.set(0, 0, 1);
  }
  direction.normalize().multiplyScalar(clamped);
  controls.object.position.copy(controls.target).add(direction);
  controls.update();
}

let skipCameraPersist = false;

export function suppressCameraPersist() {
  skipCameraPersist = true;
  requestAnimationFrame(() => {
    skipCameraPersist = false;
  });
}

function closeRing(ring: Ring): Ring {
  if (ring.length < 2) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (a[0] === b[0] && a[1] === b[1]) return ring;
  return [...ring, a];
}

/** ExtrudeGeometry needs at least 4 distinct corners per hole path. */
function densifyRing(ring: Ring): Ring {
  const closed = closeRing(ring);
  const unique =
    closed.length > 1 &&
    closed[0][0] === closed[closed.length - 1][0] &&
    closed[0][1] === closed[closed.length - 1][1]
      ? closed.slice(0, -1)
      : closed;
  if (unique.length >= 4) return ring;
  const dense: Ring = [];
  for (let i = 0; i < unique.length; i += 1) {
    const j = (i + 1) % unique.length;
    const a = unique[i];
    const b = unique[j];
    dense.push(a);
    dense.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  }
  return dense;
}

function toShape(outer: Ring, holes: Ring[] = []) {
  const shape = new THREE.Shape();
  const ring = closeRing(outer);
  const outerArea = signedArea(ring);
  shape.moveTo(ring[0][0], ring[0][1]);
  for (let i = 1; i < ring.length; i += 1) {
    shape.lineTo(ring[i][0], ring[i][1]);
  }
  for (const hole of holes) {
    if (hole.length < 3) continue;
    const path = new THREE.Path();
    const hr = holeWinding(densifyRing(hole), outerArea);
    path.moveTo(hr[0][0], hr[0][1]);
    for (let i = 1; i < hr.length; i += 1) path.lineTo(hr[i][0], hr[i][1]);
    shape.holes.push(path);
  }
  return shape;
}

function pointInRing(pt: number[], ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function signedArea(ring: Ring) {
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const j = (i + 1) % ring.length;
    area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
  }
  return area / 2;
}

/** Centroid can fall outside U-shaped cavities; sample ring points instead. */
function ringInsideOuter(inner: Ring, outer: Ring) {
  for (const pt of inner) {
    if (pointInRing(pt, outer)) return true;
  }
  for (let i = 0; i < inner.length; i += 1) {
    const j = (i + 1) % inner.length;
    const mid: [number, number] = [(inner[i][0] + inner[j][0]) / 2, (inner[i][1] + inner[j][1]) / 2];
    if (pointInRing(mid, outer)) return true;
  }
  return false;
}

function holeWinding(ring: Ring, outerArea: number) {
  const closed = closeRing(ring);
  if (outerArea * signedArea(closed) > 0) return [...closed].reverse();
  return closed;
}

function extrude(shape: THREE.Shape, depth: number, z = 0) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: CURVE_SEGMENTS,
    steps: 1,
  });
  geo.translate(0, 0, z);
  return geo;
}

function extrudeContour(contour: RingContour, depth: number, z = 0) {
  const geos: THREE.BufferGeometry[] = [];
  contour.outer.forEach((outer) => {
    if (outer.length < 3) return;
    const innerHoles = contour.holes.filter((hole) => hole.length >= 3 && ringInsideOuter(hole, outer));
    geos.push(extrude(toShape(outer, innerHoles), depth, z));
  });
  return geos;
}

function framing(
  data: PreviewData,
  view: CameraView,
  focus?: THREE.Vector3,
) {
  const [minx, miny, maxx, maxy] = data.bounds;
  const cx = focus?.x ?? (minx + maxx) / 2;
  const cy = focus?.y ?? (miny + maxy) / 2;
  const cz = focus?.z ?? 4;
  const spanX = focus ? Math.max(maxx - minx, 48) * 0.55 : Math.max(data.layout_width, 48);
  const spanY = focus ? Math.max(maxy - miny, 48) * 0.75 : Math.max(data.layout_height + 36, 80);
  const fov = (35 * Math.PI) / 180;
  const dist = Math.max(spanX * 0.72, spanY * 1.15) / Math.tan(fov / 2);
  const target = new THREE.Vector3(cx, cy, cz);

  // Top (front): orthographic-style look onto the plate / letter faces (+Z)
  if (view === "front") {
    return {
      position: new THREE.Vector3(cx, cy, dist),
      target: new THREE.Vector3(cx, cy, cz),
    };
  }
  // Bottom (back): look from under the plate (-Z) — plate becomes ghost grid
  if (view === "back") {
    return {
      position: new THREE.Vector3(cx, cy, -dist),
      target: new THREE.Vector3(cx, cy, cz),
    };
  }
  // Printer front edge
  if (view === "plateFront") {
    return {
      position: new THREE.Vector3(cx, cy - dist, Math.max(cz, 8)),
      target: new THREE.Vector3(cx, cy, cz),
    };
  }
  if (view === "plateBack") {
    return {
      position: new THREE.Vector3(cx, cy + dist, Math.max(cz, 8)),
      target: new THREE.Vector3(cx, cy, cz),
    };
  }
  if (view === "left") {
    return {
      position: new THREE.Vector3(cx - dist, cy, Math.max(cz, 8)),
      target: new THREE.Vector3(cx, cy, cz),
    };
  }
  if (view === "right" || view === "side") {
    return {
      position: new THREE.Vector3(cx + dist, cy, Math.max(cz, 8)),
      target: new THREE.Vector3(cx, cy, cz),
    };
  }
  if (view === "reset") {
    return {
      position: new THREE.Vector3(cx + dist * 0.42, cy - dist * 0.38, dist * 0.78),
      target,
    };
  }
  return { position: new THREE.Vector3(cx, cy, dist), target };
}

function framingThumbnail(data: PreviewData) {
  const [minx, miny, maxx, maxy] = data.bounds;
  const cx = (minx + maxx) / 2;
  const cy = (miny + maxy) / 2;
  const width = Math.max(data.layout_width, 36);
  const height = Math.max(data.layout_height, 52);
  const fov = (28 * Math.PI) / 180;
  const dist = Math.max(width * 0.76, height * 0.66) / Math.tan(fov / 2);
  const target = new THREE.Vector3(cx, cy, 10);
  return {
    position: new THREE.Vector3(cx + dist * 0.72, cy + height * 0.03, dist * 0.38),
    target,
  };
}

function selectionHudWorldPoint(
  data: PreviewData,
  selectedLetterIndices: number[],
  selectedParts: SelectedLetterPart[],
  letterOffsets: Record<number, LetterOffset>,
  partOffsets: Record<string, LetterOffset>,
  explodedFactor: number,
  depthMm: number,
  frontMm: number,
  wallMm: number,
  letterStyle?: LetterStyleInfo,
): THREE.Vector3 | null {
  const primaryPart = selectedParts.length > 0 ? selectedParts[selectedParts.length - 1]! : null;
  const selectedLetterIndex =
    primaryPart?.letterIndex ??
    (selectedLetterIndices.length > 0 ? selectedLetterIndices[selectedLetterIndices.length - 1]! : null);
  if (selectedLetterIndex === null) return null;
  const letter = data.letters.find((item) => item.index === selectedLetterIndex);
  if (!letter) return null;

  const offset = letterOffsets[selectedLetterIndex] ?? { x: 0, y: 0 };
  const styleParams = letterStylePreviewParams(letterStyle, depthMm, wallMm);

  if (primaryPart && explodedFactor > 0.01) {
    const partOffset = partOffsets[partColorKey(selectedLetterIndex, primaryPart.part)];
    const [x, y, z] = partHandlePosition(
      letter,
      primaryPart.part,
      styleParams,
      depthMm,
      frontMm,
      explodedFactor,
      partOffset,
    );
    return new THREE.Vector3(x + offset.x, y + offset.y, z + selectedLetterIndex * 0.03);
  }

  const [x, y, z] = letterHandlePosition(letter, depthMm, offset);
  return new THREE.Vector3(x, y, z + selectedLetterIndex * 0.03);
}

function SelectionHudTracker({
  worldPoint,
  onScreenPos,
}: {
  worldPoint: THREE.Vector3 | null;
  onScreenPos?: (pos: { x: number; y: number; visible: boolean } | null) => void;
}) {
  const { camera, size } = useThree();
  const lastKey = useRef<string>("");

  useFrame(() => {
    if (!onScreenPos) return;
    if (!worldPoint) {
      if (lastKey.current !== "hidden") {
        lastKey.current = "hidden";
        onScreenPos(null);
      }
      return;
    }

    const projected = worldPoint.clone().project(camera);
    const visible =
      projected.z > -1 &&
      projected.z < 1 &&
      Math.abs(projected.x) <= 1.35 &&
      Math.abs(projected.y) <= 1.35;
    const x = (projected.x * 0.5 + 0.5) * size.width;
    const y = (-projected.y * 0.5 + 0.5) * size.height;
    const key = `${visible ? 1 : 0}:${x.toFixed(1)}:${y.toFixed(1)}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    onScreenPos({ x, y, visible });
  });

  return null;
}

function selectionFocusPoint(
  data: PreviewData,
  selectedLetterIndices: number[],
  selectedParts: SelectedLetterPart[],
  letterOffsets: Record<number, LetterOffset>,
  partOffsets: Record<string, LetterOffset>,
  explodedFactor: number,
  depthMm: number,
  frontMm: number,
  wallMm: number,
  letterStyle?: LetterStyleInfo,
): THREE.Vector3 | null {
  const primaryPart = selectedParts.length > 0 ? selectedParts[selectedParts.length - 1]! : null;
  const selectedLetterIndex =
    primaryPart?.letterIndex ??
    (selectedLetterIndices.length > 0 ? selectedLetterIndices[selectedLetterIndices.length - 1]! : null);
  if (selectedLetterIndex === null) return null;
  const letter = data.letters.find((item) => item.index === selectedLetterIndex);
  if (!letter) return null;

  const offset = letterOffsets[selectedLetterIndex] ?? { x: 0, y: 0 };
  const styleParams = letterStylePreviewParams(letterStyle, depthMm, wallMm);
  const [minx, miny, maxx, maxy] = letter.bounds;
  let cx = (minx + maxx) / 2 + offset.x;
  let cy = (miny + maxy) / 2 + offset.y;
  let cz = depthMm / 2;

  if (primaryPart && primaryPart.letterIndex === selectedLetterIndex) {
    const partOffset = partOffsets[partColorKey(selectedLetterIndex, primaryPart.part)] ?? { x: 0, y: 0 };
    cx += partOffset.x * explodedFactor;
    cy += partOffset.y * explodedFactor;
    const zOff = explodePartZOffsets(styleParams, explodedFactor);
    if (primaryPart.part === "back") cz = Math.max(styleParams.rearMm / 2, 1) + zOff.back;
    else if (primaryPart.part === "front") cz = depthMm + frontMm / 2 + zOff.front;
    else if (primaryPart.part === "support") {
      cz = styleParams.rearMm + (depthMm - styleParams.rearMm) / 2 + zOff.support;
    } else {
      cz = depthMm / 2 + zOff.body;
    }
  }

  return new THREE.Vector3(cx, cy, cz);
}

function PartGroup({
  part,
  letterIndex,
  partSelectable,
  holeToolActive,
  explodedFactor,
  selected,
  partOffset,
  basePosition,
  dragPlaneRef,
  onSelectPart,
  onDragPart,
  onDragActiveChange,
  children,
}: {
  part: LetterPartKind;
  letterIndex: number;
  partSelectable: boolean;
  holeToolActive?: boolean;
  explodedFactor: number;
  selected: boolean;
  partOffset?: { x: number; y: number };
  basePosition?: [number, number, number];
  dragPlaneRef: RefObject<THREE.Object3D | null>;
  onSelectPart?: (selection: SelectedLetterPart, options?: { additive?: boolean }) => void;
  onDragPart?: (letterIndex: number, part: LetterPartKind, x: number, y: number) => void;
  onDragActiveChange?: (active: boolean) => void;
  children: ReactNode;
}) {
  const base = basePosition ?? [0, 0, 0];
  const stored = partOffset ?? { x: 0, y: 0 };
  const offset = { x: stored.x * explodedFactor, y: stored.y * explodedFactor };
  const interactive = partSelectable && !holeToolActive;
  const storedRef = useRef(stored);
  storedRef.current = stored;

  const dragBind = useCanvasPlaneDrag({
    enabled: interactive,
    planeRef: dragPlaneRef,
    getOffset: () => storedRef.current,
    onOffsetChange: (x, y) => onDragPart?.(letterIndex, part, x, y),
    onActiveChange: onDragActiveChange,
    onSelect: ({ additive }) => onSelectPart?.({ letterIndex, part }, { additive }),
  });

  return (
    <group
      position={[base[0] + offset.x, base[1] + offset.y, base[2]]}
      raycast={holeToolActive ? () => null : undefined}
      onPointerEnter={interactive ? () => { suppressOrbitRef.current = true; } : undefined}
      onPointerLeave={interactive ? () => { suppressOrbitRef.current = false; } : undefined}
      {...dragBind}
    >
      {children}
    </group>
  );
}

function partMaterialProps(selected: boolean, partSelectable: boolean) {
  return {
    emissive: selected && partSelectable ? "#4488ff" : "#000000",
    emissiveIntensity: selected && partSelectable ? 0.35 : 0,
  };
}

/** Stable depth bias so adjacent letters / coplanar faces don't flicker. */
function letterDepthBias(letterIndex: number, part: "body" | "front" | "back" = "body") {
  const partBias = part === "front" ? -2 : part === "back" ? 1 : 0;
  return {
    polygonOffset: true as const,
    polygonOffsetFactor: partBias - letterIndex * 0.5,
    polygonOffsetUnits: partBias - letterIndex,
  };
}

function InternalSupports({
  letter,
  letterIndex,
  styleParams,
  wallMm,
  depth,
  partColors,
  partOffsets,
  partSelectable,
  holeToolActive,
  explodedFactor,
  bodyZOffset = 0,
  selectedParts,
  onSelectPart,
  onDragPart,
  onDragActiveChange,
  dragPlaneRef,
}: {
  letter: PreviewLetter;
  letterIndex: number;
  styleParams: ReturnType<typeof letterStylePreviewParams>;
  wallMm: number;
  depth: number;
  partColors: Record<string, string>;
  partOffsets: Record<string, { x: number; y: number }>;
  partSelectable: boolean;
  holeToolActive?: boolean;
  explodedFactor: number;
  bodyZOffset?: number;
  selectedParts: SelectedLetterPart[];
  onSelectPart?: (selection: SelectedLetterPart, options?: { additive?: boolean }) => void;
  onDragPart?: (letterIndex: number, part: LetterPartKind, x: number, y: number) => void;
  onDragActiveChange?: (active: boolean) => void;
  dragPlaneRef: RefObject<THREE.Object3D | null>;
}) {
  const ribs = useMemo(() => {
    if (letter.support_ribs && letter.support_ribs.length > 0) {
      return letter.support_ribs;
    }
    if (styleParams.supports <= 0) return [];
    const [minx, miny, maxx, maxy] = letter.bounds;
    const cx = (minx + maxx) / 2;
    const ribW = Math.max(1.2, wallMm * 0.8);
    const ribH = depth - styleParams.rearMm - 1.5;
    if (ribH < 2) return [];
    const spanY = (maxy - miny) * 0.6;
    const positions =
      styleParams.supports === 1
        ? [cx]
        : [minx + (maxx - minx) * 0.33, minx + (maxx - minx) * 0.67];
    return positions.slice(0, styleParams.supports).map((px) => ({
      x: px,
      y: (miny + maxy) / 2,
      width: ribW,
      height: spanY,
      z: styleParams.rearMm + ribH / 2,
      depth: ribH,
    }));
  }, [depth, letter.bounds, letter.support_ribs, styleParams, wallMm]);

  if (ribs.length === 0) return null;

  const selected = isPartSelected(selectedParts, { letterIndex, part: "support" });
  const color = resolvePartColor(letterIndex, "support", partColors, styleParams);
  const mat = partMaterialProps(selected, partSelectable);

  return (
    <PartGroup
      part="support"
      letterIndex={letterIndex}
      partSelectable={partSelectable}
      holeToolActive={holeToolActive}
      explodedFactor={explodedFactor}
      selected={selected}
      partOffset={partOffsets[partColorKey(letterIndex, "support")]}
      basePosition={[0, 0, bodyZOffset]}
      dragPlaneRef={dragPlaneRef}
      onSelectPart={onSelectPart}
      onDragPart={onDragPart}
      onDragActiveChange={onDragActiveChange}
    >
      {ribs.map((rib, i) => (
        <group key={`rib-${i}`} position={[rib.x, rib.y, rib.z]}>
          <mesh>
            <boxGeometry args={[rib.width, rib.height, rib.depth]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} {...mat} />
          </mesh>
          <mesh position={[0, 0, rib.depth / 2 - 0.25]}>
            <boxGeometry args={[rib.width + 0.4, rib.height * 0.92, 0.5]} />
            <meshStandardMaterial color={color} roughness={0.42} metalness={0.06} emissive="#888888" emissiveIntensity={0.08} />
          </mesh>
        </group>
      ))}
    </PartGroup>
  );
}

function SnapFitGrooves({
  snap,
  showInterior,
}: {
  snap: SnapFitPreview;
  showInterior: boolean;
}) {
  const geos = useMemo(
    () => extrudeContour(snap.groove, snap.channel_height, snap.channel_z),
    [snap],
  );
  if (!snap.enabled || geos.length === 0) return null;

  return (
    <>
      {geos.map((geo, i) => (
        <mesh key={`groove-${i}`} geometry={geo}>
          <meshStandardMaterial
            color={showInterior ? "#4a5568" : "#757575"}
            emissive={showInterior ? "#3b82f6" : "#000000"}
            emissiveIntensity={showInterior ? 0.18 : 0}
            roughness={0.58}
            metalness={0.1}
          />
        </mesh>
      ))}
    </>
  );
}

function SnapFitLip({
  snap,
  depth,
  selected,
  partSelectable,
  tight,
}: {
  snap: SnapFitPreview;
  depth: number;
  selected: boolean;
  partSelectable: boolean;
  tight: boolean;
}) {
  const geos = useMemo(() => {
    const z = depth - snap.lip_depth;
    return extrudeContour(snap.lip, snap.lip_depth, z);
  }, [depth, snap]);

  if (!snap.enabled || geos.length === 0) return null;

  const lipColor = tight ? "#9fd4ff" : "#a8e0a0";

  return (
    <>
      {geos.map((geo, i) => (
        <mesh key={`lip-${i}`} geometry={geo}>
          <meshStandardMaterial
            color={lipColor}
            emissive={selected && partSelectable ? "#4488ff" : "#3d7a45"}
            emissiveIntensity={selected && partSelectable ? 0.35 : 0.12}
            roughness={0.38}
            metalness={0.04}
          />
        </mesh>
      ))}
    </>
  );
}

function ShadowCoverMesh({
  shadowCover,
  depthMm,
  color,
}: {
  shadowCover: ShadowCoverPreview;
  depthMm: number;
  color: string;
}) {
  const geometries = useMemo(() => extrudeContour(shadowCover, depthMm, 0), [depthMm, shadowCover]);

  return (
    <group>
      {geometries.map((geo, i) => (
        <mesh key={`shadow-${i}`} geometry={geo}>
          <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

function LetterParts({
  letter,
  letterIndex,
  depth,
  front,
  wallMm,
  showInterior,
  showLed,
  explodedFactor,
  holeToolActive,
  wallProfileId,
  letterStyle,
  partColors,
  partOffsets,
  partSelectable,
  selectedParts,
  selected,
  onSelectPart,
  onDragPart,
  onDragActiveChange,
  letterHoles,
  holePreviewPos,
  pendingHole,
  selectedHoleId,
  onSelectHole,
  dragPlaneRef,
  hideRear = false,
}: {
  letter: PreviewLetter;
  letterIndex: number;
  depth: number;
  front: number;
  wallMm: number;
  showInterior: boolean;
  showLed: boolean;
  explodedFactor: number;
  holeToolActive?: boolean;
  wallProfileId: string;
  letterStyle?: LetterStyleInfo;
  partColors: Record<string, string>;
  partOffsets: Record<string, { x: number; y: number }>;
  partSelectable: boolean;
  selectedParts: SelectedLetterPart[];
  selected: boolean;
  onSelectPart?: (selection: SelectedLetterPart, options?: { additive?: boolean }) => void;
  onDragPart?: (letterIndex: number, part: LetterPartKind, x: number, y: number) => void;
  onDragActiveChange?: (active: boolean) => void;
  letterHoles?: MountingHole[];
  holePreviewPos?: { x: number; y: number } | null;
  pendingHole?: PendingHoleConfig;
  selectedHoleId?: string | null;
  onSelectHole?: (holeId: string, anchor: { clientX: number; clientY: number }) => void;
  dragPlaneRef: RefObject<THREE.Object3D | null>;
  hideRear?: boolean;
}) {
  const styleParams = useMemo(
    () => letterStylePreviewParams(letterStyle, depth, wallMm),
    [depth, letterStyle, wallMm],
  );
  const rear = letter.rear_mm ?? styleParams.rearMm;
  const hasFace = styleParams.fixedFace || styleParams.removableFace;
  // Stop walls before the face slab so body and front don't share the same volume (z-fighting)
  const wallDepth = Math.max(depth - rear - (hasFace ? front : 0), 2);
  const snapFit = letter.snap_fit ?? null;
  const zOff = explodePartZOffsets(styleParams, explodedFactor);
  const ledZ = styleParams.backlit ? rear * 0.35 : rear + 2.2;

  const geometries = useMemo(() => {
    const walls: THREE.BufferGeometry[] = [];
    const friezeGeos: THREE.BufferGeometry[] = [];
    const backs: THREE.BufferGeometry[] = [];
    const fronts: THREE.BufferGeometry[] = [];
    const integratedFaces: THREE.BufferGeometry[] = [];
    const leds: THREE.Vector3[][] = [];
    const insetContour = snapFit?.front_inset;
    const hasInset = Boolean(insetContour && insetContour.outer.length > 0);

    letter.outer.forEach((outer) => {
      if (outer.length < 3) return;
      const inners = letter.inner.filter((inner) => inner.length >= 3 && ringInsideOuter(inner, outer));
      const holes = letter.holes.filter((hole) => hole.length >= 3 && ringInsideOuter(hole, outer));

      const wallHoles = [...inners, ...holes];
      walls.push(extrude(toShape(outer, wallHoles), wallDepth, rear));
      if (styleParams.showRear) {
        backs.push(extrude(toShape(outer, holes), rear, 0));
      }
      if (styleParams.fixedFace) {
        integratedFaces.push(extrude(toShape(outer, holes), front, depth - front));
      } else if (styleParams.removableFace) {
        if (hasInset && insetContour) {
          insetContour.outer.forEach((insetOuter) => {
            if (insetOuter.length < 3) return;
            const insetHoles = insetContour.holes.filter(
              (hole) => hole.length >= 3 && ringInsideOuter(hole, insetOuter),
            );
            const glyphHoles = holes.filter((hole) => hole.length >= 3 && ringInsideOuter(hole, insetOuter));
            fronts.push(extrude(toShape(insetOuter, [...insetHoles, ...glyphHoles]), front, depth - front));
          });
        } else {
          fronts.push(extrude(toShape(outer, holes), front, depth - front));
        }
      }

      if ((wallProfileId === "frieze" || wallProfileId === "shelf") && letter.frieze_bands) {
        if (wallProfileId === "shelf") {
          const shelfZ = letter.shelf_z ?? depth * 0.6;
          letter.frieze_bands.forEach((band) => {
            band.outer.forEach((ring) => {
              if (ring.length < 3) return;
              friezeGeos.push(extrude(toShape(ring, band.holes), Math.max(0.6, band.step * 0.9), shelfZ));
            });
          });
        } else {
          const bandH = wallDepth / Math.max(letter.frieze_bands.length, 1);
          letter.frieze_bands.forEach((band, bi) => {
            band.outer.forEach((ring) => {
              if (ring.length < 3) return;
              friezeGeos.push(extrude(toShape(ring, band.holes), bandH * 0.85, rear + bi * bandH));
            });
          });
        }
      }

      inners.forEach((inner) => {
        const pts = closeRing(inner).map(([x, y]) => new THREE.Vector3(x, y, ledZ));
        if (pts.length > 3) leds.push(pts);
      });
    });

    return { walls, friezeGeos, backs, fronts, integratedFaces, leds };
  }, [depth, front, ledZ, letter, rear, snapFit, styleParams, wallDepth, wallMm, wallProfileId]);

  const letterHighlight = selected && !partSelectable;
  const bodySelected = isPartSelected(selectedParts, { letterIndex, part: "body" });
  const backSelected = isPartSelected(selectedParts, { letterIndex, part: "back" });
  const frontSelected = isPartSelected(selectedParts, { letterIndex, part: "front" });
  const bodyColor = resolvePartColor(letterIndex, "body", partColors, styleParams);
  const backColor = resolvePartColor(letterIndex, "back", partColors, styleParams);
  const faceColor = resolvePartColor(letterIndex, "front", partColors, styleParams);
  const showFace = styleParams.fixedFace || styleParams.removableFace;
  const getPartOffset = (part: LetterPartKind) => partOffsets[partColorKey(letterIndex, part)];

  return (
    <>
      <PartGroup
        part="body"
        letterIndex={letterIndex}
        partSelectable={partSelectable}
        holeToolActive={holeToolActive}
        explodedFactor={explodedFactor}
        selected={bodySelected}
        partOffset={getPartOffset("body")}
        basePosition={[0, 0, zOff.body]}
        dragPlaneRef={dragPlaneRef}
        onSelectPart={onSelectPart}
        onDragPart={onDragPart}
        onDragActiveChange={onDragActiveChange}
      >
        {geometries.walls.map((geo, i) => (
          <mesh key={`w-${i}`} geometry={geo}>
            <meshStandardMaterial
              color={bodyColor}
              emissive={letterHighlight ? "#4488ff" : partMaterialProps(bodySelected, partSelectable).emissive}
              emissiveIntensity={letterHighlight ? 0.35 : partMaterialProps(bodySelected, partSelectable).emissiveIntensity}
              roughness={0.42}
              metalness={0.04}
              transparent={showInterior}
              opacity={showInterior ? 0.28 : 1}
              depthWrite={!showInterior}
              {...letterDepthBias(letterIndex, "body")}
            />
          </mesh>
        ))}
        {geometries.friezeGeos.map((geo, i) => (
          <mesh key={`fri-${i}`} geometry={geo}>
            <meshStandardMaterial
              color="#b0b0b0"
              roughness={0.48}
              metalness={0.06}
              transparent={showInterior}
              opacity={showInterior ? 0.35 : 1}
              depthWrite={!showInterior}
              {...letterDepthBias(letterIndex, "body")}
            />
          </mesh>
        ))}
        {snapFit?.enabled ? <SnapFitGrooves snap={snapFit} showInterior={showInterior} /> : null}
      </PartGroup>

      {styleParams.fixedFace ? (
        <PartGroup
          part="front"
          letterIndex={letterIndex}
          partSelectable={partSelectable}
          holeToolActive={holeToolActive}
          explodedFactor={explodedFactor}
          selected={frontSelected}
          partOffset={getPartOffset("front")}
          basePosition={[0, 0, zOff.front]}
          dragPlaneRef={dragPlaneRef}
          onSelectPart={onSelectPart}
          onDragPart={onDragPart}
        onDragActiveChange={onDragActiveChange}
        >
          {geometries.integratedFaces.map((geo, i) => (
            <mesh key={`if-${i}`} geometry={geo}>
              <meshStandardMaterial
                color={faceColor}
                {...partMaterialProps(frontSelected, partSelectable)}
                roughness={0.32}
                metalness={0.02}
                transparent={showInterior}
                opacity={showInterior ? 0.22 : 1}
                depthWrite={!showInterior}
                {...letterDepthBias(letterIndex, "front")}
              />
            </mesh>
          ))}
        </PartGroup>
      ) : null}

      <InternalSupports
        letter={letter}
        letterIndex={letterIndex}
        styleParams={styleParams}
        wallMm={wallMm}
        depth={depth}
        partColors={partColors}
        partOffsets={partOffsets}
        partSelectable={partSelectable}
        holeToolActive={holeToolActive}
        explodedFactor={explodedFactor}
        bodyZOffset={zOff.support}
        selectedParts={selectedParts}
        onSelectPart={onSelectPart}
        onDragPart={onDragPart}
        onDragActiveChange={onDragActiveChange}
        dragPlaneRef={dragPlaneRef}
      />

      {styleParams.showRear && !hideRear ? (
        <PartGroup
          part="back"
          letterIndex={letterIndex}
          partSelectable={partSelectable}
          holeToolActive={holeToolActive}
          explodedFactor={explodedFactor}
          selected={backSelected}
          partOffset={getPartOffset("back")}
          basePosition={[0, 0, zOff.back]}
          dragPlaneRef={dragPlaneRef}
          onSelectPart={onSelectPart}
          onDragPart={onDragPart}
        onDragActiveChange={onDragActiveChange}
        >
          {geometries.backs.map((geo, i) => (
            <mesh key={`b-${i}`} geometry={geo}>
              <meshStandardMaterial
                color={backColor}
                emissive={styleParams.backlit ? "#ffd36a" : partMaterialProps(backSelected, partSelectable).emissive}
                emissiveIntensity={
                  styleParams.backlit ? 0.25 : partMaterialProps(backSelected, partSelectable).emissiveIntensity
                }
                roughness={0.48}
                metalness={0.04}
                transparent={showInterior || styleParams.backlit}
                opacity={showInterior ? 0.2 : styleParams.backlit ? 0.88 : 1}
                depthWrite={!showInterior}
                {...letterDepthBias(letterIndex, "back")}
              />
            </mesh>
          ))}
          {letterHoles && letterHoles.length > 0 ? (
            <MountingHolesVisual
              holes={letterHoles}
              depth={depth}
              selectedHoleId={selectedHoleId}
              onSelectHole={onSelectHole}
            />
          ) : null}
          {holeToolActive && holePreviewPos && pendingHole ? (
            <HolePreviewMarker x={holePreviewPos.x} y={holePreviewPos.y} config={pendingHole} />
          ) : null}
        </PartGroup>
      ) : null}

      {showFace && styleParams.removableFace ? (
        <PartGroup
          part="front"
          letterIndex={letterIndex}
          partSelectable={partSelectable}
          holeToolActive={holeToolActive}
          explodedFactor={explodedFactor}
          selected={frontSelected}
          partOffset={getPartOffset("front")}
          basePosition={[0, 0, zOff.front]}
          dragPlaneRef={dragPlaneRef}
          onSelectPart={onSelectPart}
          onDragPart={onDragPart}
        onDragActiveChange={onDragActiveChange}
        >
          {geometries.fronts.map((geo, i) => (
            <mesh key={`fr-${i}`} geometry={geo}>
              <meshStandardMaterial
                color={faceColor}
                {...partMaterialProps(frontSelected, partSelectable)}
                roughness={styleParams.frontMount === "press-fit" ? 0.22 : 0.28}
                metalness={0.02}
                transparent={showInterior}
                opacity={showInterior ? 0.22 : 1}
                depthWrite={!showInterior}
                {...letterDepthBias(letterIndex, "front")}
              />
            </mesh>
          ))}
          {snapFit?.enabled ? (
            <SnapFitLip
              snap={snapFit}
              depth={depth}
              selected={frontSelected}
              partSelectable={partSelectable}
              tight={snapFit.tight}
            />
          ) : null}
        </PartGroup>
      ) : null}

      {showLed &&
        geometries.leds.map((pts, i) => (
          <group key={`led-${i}`} position={[0, 0, zOff.body]}>
            <LedStrip points={pts} intensity={styleParams.backlit ? 3.2 : 2.2} />
          </group>
        ))}
    </>
  );
}

function LedStrip({ points, intensity = 2.2 }: { points: THREE.Vector3[]; intensity?: number }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.15), [points]);
  const geo = useMemo(
    () => new THREE.TubeGeometry(curve, Math.max(24, points.length), 0.7, 12, true),
    [curve, points.length],
  );
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial
        color="#ffe29a"
        emissive="#ffd36a"
        emissiveIntensity={intensity}
        roughness={0.3}
        toneMapped={false}
      />
    </mesh>
  );
}

function isCircularHole(hole: MountingHole) {
  return (
    hole.shape === "circle" ||
    (Math.abs(hole.width_mm - hole.length_mm) < 0.05 &&
      hole.corner_radius_mm >= hole.width_mm / 2 - 0.05)
  );
}

function roundedRectShape(width: number, length: number, radius: number) {
  const shape = new THREE.Shape();
  const hw = width / 2;
  const hl = length / 2;
  const r = Math.max(0, Math.min(radius, hw, hl));
  if (r <= 0.05) {
    shape.moveTo(-hw, -hl);
    shape.lineTo(hw, -hl);
    shape.lineTo(hw, hl);
    shape.lineTo(-hw, hl);
    shape.closePath();
    return shape;
  }
  shape.moveTo(-hw + r, -hl);
  shape.lineTo(hw - r, -hl);
  shape.absarc(hw - r, -hl + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(hw, hl - r);
  shape.absarc(hw - r, hl - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-hw + r, hl);
  shape.absarc(-hw + r, hl - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hw, -hl + r);
  shape.absarc(-hw + r, -hl + r, r, Math.PI, Math.PI * 1.5, false);
  shape.closePath();
  return shape;
}

function HoleMarker({
  hole,
  depth,
  selected,
  onSelect,
}: {
  hole: MountingHole;
  depth: number;
  selected?: boolean;
  onSelect?: (holeId: string, anchor: { clientX: number; clientY: number }) => void;
}) {
  const isThrough = hole.depth_mm >= depth - 0.05;
  const cutDepth = isThrough ? depth + 0.6 : Math.max(1, Math.min(hole.depth_mm, depth)) + 0.3;
  const circular = isCircularHole(hole);
  const r = hole.width_mm / 2;
  const hitR = Math.max(r, hole.length_mm / 2, 3) + 1.5;

  const outlinePoints = useMemo(() => {
    if (circular) return circleOutlinePoints(r);
    const shape = roundedRectShape(hole.width_mm, hole.length_mm, hole.corner_radius_mm);
    return sampleShapePoints(shape);
  }, [circular, hole.corner_radius_mm, hole.length_mm, hole.width_mm, r]);

  const voidGeometry = useMemo(() => {
    if (circular) {
      return new THREE.CylinderGeometry(r, r, cutDepth, 32);
    }
    const shape = roundedRectShape(hole.width_mm, hole.length_mm, hole.corner_radius_mm);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: cutDepth, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, cutDepth / 2);
    return geo;
  }, [circular, cutDepth, hole.corner_radius_mm, hole.length_mm, hole.width_mm, r]);

  const voidZ = cutDepth / 2;

  return (
    <group position={[hole.x, hole.y, 0]} renderOrder={22}>
      <group position={[0, 0, 0.12]} raycast={() => null}>
        <SolidHoleOutline
          points={outlinePoints}
          color={selected ? "#4488ff" : HOLE_PREVIEW_COLOR}
          lineWidth={selected ? HOLE_LINE_WIDTH + 1.2 : HOLE_LINE_WIDTH}
        />
      </group>
      <mesh
        position={[0, 0, voidZ]}
        rotation={circular ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
        renderOrder={21}
        raycast={() => null}
      >
        <primitive object={voidGeometry} attach="geometry" />
        <meshStandardMaterial
          color={isThrough ? "#eef2f6" : "#1e2836"}
          emissive={selected ? "#4488ff" : isThrough ? "#000000" : "#0a1018"}
          emissiveIntensity={selected ? 0.45 : isThrough ? 0 : 0.35}
          roughness={0.92}
          metalness={0}
          depthWrite
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      {/* Invisible hit target so the hole outline is easy to click */}
      <mesh
        position={[0, 0, 0.2]}
        renderOrder={30}
        userData={{ holeToolPick: true }}
        onPointerDown={(e) => {
          if (!onSelect) return;
          e.stopPropagation();
          onSelect(hole.id, { clientX: e.clientX, clientY: e.clientY });
        }}
        onClick={(e) => {
          if (!onSelect) return;
          e.stopPropagation();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <circleGeometry args={[hitR, 28]} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} />
      </mesh>
    </group>
  );
}

function MountingHolesVisual({
  holes,
  depth,
  selectedHoleId,
  onSelectHole,
}: {
  holes: MountingHole[];
  depth: number;
  selectedHoleId?: string | null;
  onSelectHole?: (holeId: string, anchor: { clientX: number; clientY: number }) => void;
}) {
  return (
    <group>
      {holes.map((hole) => (
        <HoleMarker
          key={hole.id}
          hole={hole}
          depth={depth}
          selected={selectedHoleId === hole.id}
          onSelect={onSelectHole}
        />
      ))}
    </group>
  );
}

type PendingHoleConfig = {
  shape: HoleShape;
  width_mm: number;
  length_mm: number;
  depth_mm: number;
  corner_radius_mm: number;
};

const HOLE_PREVIEW_COLOR = "#1971c2";
const HOLE_LINE_WIDTH = 4.2;

function sampleShapePoints(shape: THREE.Shape, segments = 64): THREE.Vector3[] {
  const spaced = shape.getSpacedPoints(segments);
  return spaced.map((p) => new THREE.Vector3(p.x, p.y, 0));
}

function circleOutlinePoints(radius: number, segments = 64): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
  }
  return points;
}

function SolidHoleOutline({
  points,
  color = HOLE_PREVIEW_COLOR,
  lineWidth = HOLE_LINE_WIDTH,
}: {
  points: THREE.Vector3[];
  color?: string;
  lineWidth?: number;
}) {
  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      renderOrder={26}
      depthTest={false}
      transparent
      opacity={0.98}
      raycast={() => null}
    />
  );
}

function HolePreviewMarker({
  x,
  y,
  config,
}: {
  x: number;
  y: number;
  config: PendingHoleConfig;
}) {
  const circular = config.shape === "circle";
  const r = config.width_mm / 2;

  const outlinePoints = useMemo(() => {
    if (circular) return circleOutlinePoints(r);
    const shape = roundedRectShape(config.width_mm, config.length_mm, config.corner_radius_mm);
    return sampleShapePoints(shape);
  }, [circular, config.corner_radius_mm, config.length_mm, config.width_mm, r]);

  return (
    <group position={[x, y, 0.12]} renderOrder={25} raycast={() => null}>
      <SolidHoleOutline points={outlinePoints} />
    </group>
  );
}

function useDisableMeshRaycast(groupRef: React.RefObject<THREE.Group | null>, disabled: boolean) {
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!disabled || !group) return;

    const patched: THREE.Mesh[] = [];
    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || obj.userData.holeToolPick) return;
      const original = obj.raycast.bind(obj);
      obj.raycast = () => undefined;
      obj.userData._holeToolRaycast = original;
      patched.push(obj);
    });

    return () => {
      patched.forEach((mesh) => {
        const original = mesh.userData._holeToolRaycast as THREE.Mesh["raycast"] | undefined;
        if (original) mesh.raycast = original;
        delete mesh.userData._holeToolRaycast;
      });
    };
  }, [disabled, groupRef]);
}

function HoleToolPlaneTracker({
  active,
  bounds,
  groupRef,
  letterIndex,
  onPreview,
  onPlace,
}: {
  active: boolean;
  bounds: [number, number, number, number];
  groupRef: React.RefObject<THREE.Group | null>;
  letterIndex: number;
  onPreview: (pos: { letterIndex: number; x: number; y: number }) => void;
  onPlace: (x: number, y: number) => void;
}) {
  const { camera, raycaster, pointer, gl, invalidate } = useThree();
  const plane = useMemo(() => new THREE.Plane(), []);
  const hitWorld = useMemo(() => new THREE.Vector3(), []);
  const hitLocal = useMemo(() => new THREE.Vector3(), []);
  const normal = useMemo(() => new THREE.Vector3(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const previewRef = useRef<{ x: number; y: number } | null>(null);

  const projectPointer = useCallback(
    (ndcX: number, ndcY: number) => {
      const group = groupRef.current;
      if (!group) return null;

      normal.set(0, 0, 1).transformDirection(group.matrixWorld);
      origin.set(0, 0, 0).applyMatrix4(group.matrixWorld);
      plane.setFromNormalAndCoplanarPoint(normal, origin);

      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      if (!raycaster.ray.intersectPlane(plane, hitWorld)) return null;

      hitLocal.copy(hitWorld);
      group.worldToLocal(hitLocal);

      const [minx, miny, maxx, maxy] = bounds;
      if (hitLocal.x < minx || hitLocal.x > maxx || hitLocal.y < miny || hitLocal.y > maxy) return null;
      return { x: hitLocal.x, y: hitLocal.y };
    },
    [bounds, camera, groupRef, hitLocal, hitWorld, normal, origin, plane, raycaster],
  );

  useFrame(() => {
    if (!active) return;

    const pos = projectPointer(pointer.x, pointer.y);
    if (!pos) return;

    const prev = previewRef.current;
    if (!prev || Math.abs(prev.x - pos.x) > 0.005 || Math.abs(prev.y - pos.y) > 0.005) {
      previewRef.current = pos;
      onPreview({ letterIndex, x: pos.x, y: pos.y });
      invalidate();
    }
  });

  useEffect(() => {
    if (!active) return;

    const el = gl.domElement;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;

      const rect = el.getBoundingClientRect();
      const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const group = groupRef.current;
      if (group) {
        const hits = raycaster.intersectObjects(group.children, true);
        if (hits.some((hit) => hit.object.userData.holeToolPick)) return;
      }
      const pos = projectPointer(ndcX, ndcY);
      if (pos) onPlace(pos.x, pos.y);
    };

    el.addEventListener("pointerdown", onPointerDown);
    return () => el.removeEventListener("pointerdown", onPointerDown);
  }, [active, camera, gl.domElement, groupRef, onPlace, projectPointer, raycaster]);

  return null;
}

const SCENE_BG = "#383838";
const PLATE_THICKNESS = 3.2;
const PLATE_CORNER_RADIUS_RATIO = 0.028;

function roundedPlateShape(size: number, radius: number, tabDepth: number, tabWidth: number) {
  const half = size / 2;
  const r = Math.min(radius, half * 0.45);
  const tw = tabWidth / 2;
  const shape = new THREE.Shape();
  // Clockwise outer path; front tab on -Y
  shape.moveTo(-half + r, -half);
  shape.lineTo(-tw, -half);
  shape.lineTo(-tw, -half - tabDepth * 0.55);
  shape.quadraticCurveTo(-tw, -half - tabDepth, -tw + tabDepth * 0.45, -half - tabDepth);
  shape.lineTo(tw - tabDepth * 0.45, -half - tabDepth);
  shape.quadraticCurveTo(tw, -half - tabDepth, tw, -half - tabDepth * 0.55);
  shape.lineTo(tw, -half);
  shape.lineTo(half - r, -half);
  shape.quadraticCurveTo(half, -half, half, -half + r);
  shape.lineTo(half, half - r);
  shape.quadraticCurveTo(half, half, half - r, half);
  shape.lineTo(-half + r, half);
  shape.quadraticCurveTo(-half, half, -half, half - r);
  shape.lineTo(-half, -half + r);
  shape.quadraticCurveTo(-half, -half, -half + r, -half);
  return shape;
}

/** True when the camera is under the build plate (Bambu-style Bottom view). */
function useCameraBelowPlate() {
  const { camera } = useThree();
  const belowRef = useRef(false);
  const [below, setBelow] = useState(false);

  useFrame(() => {
    // Plate lies on XY; underside is -Z. Small hysteresis avoids flicker at the equator.
    const next = belowRef.current ? camera.position.z < 2 : camera.position.z < -1;
    if (next !== belowRef.current) {
      belowRef.current = next;
      setBelow(next);
    }
  });

  return below;
}

function PlateAxes({ half, size }: { half: number; size: number }) {
  const axisLen = Math.max(14, size * 0.07);
  const axisRadius = Math.max(0.35, size * 0.0018);
  return (
    <group position={[-half + 1.5, -half + 1.5, 0.4]}>
      <mesh position={[axisLen / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[axisRadius, axisRadius, axisLen, 6]} />
        <meshBasicMaterial color="#e03131" toneMapped={false} depthTest={false} />
      </mesh>
      <mesh position={[0, axisLen / 2, 0]}>
        <cylinderGeometry args={[axisRadius, axisRadius, axisLen, 6]} />
        <meshBasicMaterial color="#2f9e44" toneMapped={false} depthTest={false} />
      </mesh>
      <mesh position={[0, 0, axisLen / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[axisRadius, axisRadius, axisLen, 6]} />
        <meshBasicMaterial color="#1971c2" toneMapped={false} depthTest={false} />
      </mesh>
    </group>
  );
}

function BuildPlate({ size, showGrid }: { size: number; showGrid: boolean }) {
  const texture = useMemo(() => createFloorTexture({ showGrid }), [showGrid]);
  const belowPlate = useCameraBelowPlate();
  const radius = size * PLATE_CORNER_RADIUS_RATIO;
  const tabDepth = Math.max(6, size * 0.028);
  const tabWidth = Math.max(28, size * 0.14);

  const { topGeo, bodyGeo, edgeGeo } = useMemo(() => {
    const shape = roundedPlateShape(size, radius, tabDepth, tabWidth);
    const body = new THREE.ExtrudeGeometry(shape, {
      depth: PLATE_THICKNESS,
      bevelEnabled: false,
      curveSegments: 8,
    });
    body.translate(0, 0, -PLATE_THICKNESS - 0.35);

    const top = new THREE.PlaneGeometry(size, size);
    const edge = new THREE.EdgesGeometry(top);
    return { topGeo: top, bodyGeo: body, edgeGeo: edge };
  }, [radius, size, tabDepth, tabWidth]);

  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(
    () => () => {
      topGeo.dispose();
      bodyGeo.dispose();
      edgeGeo.dispose();
    },
    [bodyGeo, edgeGeo, topGeo],
  );

  const half = size / 2;
  const cell = Math.max(8, size / 20);

  // Bottom view: ghost wireframe plate so models remain visible (Bambu Studio behavior).
  // drei Grid remaps plane verts (xzy) + defaults to BackSide; with our XY plate rotation
  // that only shows from +Z. From under the plate (−Z) we need FrontSide/DoubleSide.
  if (belowPlate) {
    return (
      <group position={[0, 0, -0.5]} renderOrder={-20}>
        <Grid
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, 0.02]}
          args={[size, size]}
          cellSize={cell}
          cellThickness={0.7}
          cellColor="#d0d5dc"
          sectionSize={cell * 5}
          sectionThickness={1.15}
          sectionColor="#f0f2f5"
          fadeDistance={size * 4}
          fadeStrength={0.6}
          infiniteGrid={false}
          side={THREE.DoubleSide}
        />
        <lineSegments geometry={edgeGeo} renderOrder={-19}>
          <lineBasicMaterial color="#f0f2f5" toneMapped={false} />
        </lineSegments>
        <PlateAxes half={half} size={size} />
      </group>
    );
  }

  return (
    <group position={[0, 0, -0.5]} renderOrder={-20}>
      <mesh geometry={bodyGeo} renderOrder={-22}>
        <meshStandardMaterial color="#25282d" roughness={0.82} metalness={0.08} />
      </mesh>
      <mesh geometry={topGeo} position={[0, 0, 0]} renderOrder={-21}>
        <meshBasicMaterial map={texture} toneMapped={false} depthWrite />
      </mesh>
      <PlateAxes half={half} size={size} />
    </group>
  );
}

function SceneFloor({ data, showGrid, showPlane }: { data: PreviewData; showGrid: boolean; showPlane: boolean }) {
  if (!showGrid && !showPlane) return null;
  const [minx, miny, maxx, maxy] = data.bounds;
  const cx = (minx + maxx) / 2;
  const cy = (miny + maxy) / 2;
  const size = Math.max(maxx - minx, maxy - miny, 120) + 100;

  return (
    <group position={[cx, cy, 0]}>
      {showPlane ? <BuildPlate size={size} showGrid={showGrid} /> : null}
      {showGrid && !showPlane ? (
        <Grid
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, 0.01]}
          args={[size, size]}
          cellSize={10}
          cellThickness={0.55}
          cellColor="#6b7280"
          sectionSize={50}
          sectionThickness={1.1}
          sectionColor="#9ca3af"
          fadeDistance={size * 2}
          fadeStrength={1.4}
          infiniteGrid
          side={THREE.DoubleSide}
        />
      ) : null}
    </group>
  );
}

function LetterGroup({
  letter,
  offset,
  depthMm,
  frontMm,
  wallMm,
  showInterior,
  showLed,
  explodedFactor,
  wallProfileId,
  letterStyle,
  partColors,
  partOffsets,
  partSelectable,
  selectedParts,
  selected,
  holes,
  holeToolActive,
  pendingHole,
  onSelect,
  onSelectPart,
  onDrag,
  onDragPart,
  onSelectHole,
  selectedHoleId,
  onAddHole,
  onDragActiveChange,
  hideRear = false,
}: {
  letter: PreviewLetter;
  offset: LetterOffset;
  depthMm: number;
  frontMm: number;
  wallMm: number;
  showInterior: boolean;
  showLed: boolean;
  explodedFactor: number;
  wallProfileId: string;
  letterStyle?: LetterStyleInfo;
  partColors: Record<string, string>;
  partOffsets: Record<string, { x: number; y: number }>;
  partSelectable: boolean;
  selectedParts: SelectedLetterPart[];
  selected: boolean;
  holes: MountingHole[];
  holeToolActive: boolean;
  pendingHole?: PendingHoleConfig;
  onSelect: (index: number, options?: { additive?: boolean }) => void;
  onSelectPart?: (selection: SelectedLetterPart, options?: { additive?: boolean }) => void;
  onDrag: (index: number, dx: number, dy: number) => void;
  onDragPart?: (letterIndex: number, part: LetterPartKind, x: number, y: number) => void;
  onSelectHole?: (holeId: string, anchor: { clientX: number; clientY: number }) => void;
  selectedHoleId?: string | null;
  onAddHole?: (x: number, y: number, letterIndex: number) => void;
  onDragActiveChange?: (active: boolean) => void;
  hideRear?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const contentRef = useRef<THREE.Group>(null);
  const holePreviewPos = useCreatorStore((s) => s.holePreviewPos);
  const setHolePreviewPos = useCreatorStore((s) => s.setHolePreviewPos);
  const letterHoles = holes.filter((h) => h.letter_index === letter.index);
  const previewPos =
    holePreviewPos?.letterIndex === letter.index ? { x: holePreviewPos.x, y: holePreviewPos.y } : null;
  const handlePreview = useCallback(
    (pos: { letterIndex: number; x: number; y: number }) => {
      setHolePreviewPos(pos);
    },
    [setHolePreviewPos],
  );
  const handlePlace = useCallback(
    (x: number, y: number) => {
      onAddHole?.(x, y, letter.index);
    },
    [letter.index, onAddHole],
  );

  useDisableMeshRaycast(contentRef, holeToolActive);

  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  const letterDrag = useCanvasPlaneDrag({
    enabled: !holeToolActive && !partSelectable,
    planeRef: contentRef,
    getOffset: () => offsetRef.current,
    onOffsetChange: (x, y) => onDrag(letter.index, x, y),
    onActiveChange: onDragActiveChange,
    onSelect: ({ additive }) => onSelect(letter.index, { additive }),
  });

  return (
    <group ref={groupRef} position={[offset.x, offset.y, letter.index * 0.03]}>
      <group ref={contentRef}>
        <group
          onPointerEnter={
            !holeToolActive && !partSelectable
              ? () => {
                  suppressOrbitRef.current = true;
                }
              : undefined
          }
          onPointerLeave={
            !holeToolActive && !partSelectable
              ? () => {
                  suppressOrbitRef.current = false;
                }
              : undefined
          }
          {...letterDrag}
        >
          <LetterParts
            letter={letter}
            letterIndex={letter.index}
            depth={depthMm}
            front={frontMm}
            wallMm={wallMm}
            showInterior={showInterior}
            showLed={showLed}
            explodedFactor={explodedFactor}
            holeToolActive={holeToolActive}
            wallProfileId={wallProfileId}
            letterStyle={letterStyle}
            partColors={partColors}
            partOffsets={partOffsets}
            partSelectable={partSelectable}
            selectedParts={selectedParts}
            selected={selected}
            onSelectPart={onSelectPart}
            onDragPart={onDragPart}
            onDragActiveChange={onDragActiveChange}
            letterHoles={letterHoles}
            holePreviewPos={previewPos}
            pendingHole={pendingHole}
            selectedHoleId={selectedHoleId}
            onSelectHole={onSelectHole}
            dragPlaneRef={contentRef}
            hideRear={hideRear}
          />
        </group>
        {holeToolActive ? (
          <HoleToolPlaneTracker
            active
            bounds={letter.bounds}
            groupRef={contentRef}
            letterIndex={letter.index}
            onPreview={handlePreview}
            onPlace={handlePlace}
          />
        ) : null}
      </group>
      {selected && !partSelectable ? (
        <mesh
          position={[
            (letter.bounds[0] + letter.bounds[2]) / 2,
            (letter.bounds[1] + letter.bounds[3]) / 2,
            depthMm / 2,
          ]}
          renderOrder={5}
          raycast={() => null}
        >
          <boxGeometry
            args={[
              letter.bounds[2] - letter.bounds[0] + 4,
              letter.bounds[3] - letter.bounds[1] + 4,
              depthMm + 4,
            ]}
          />
          <meshBasicMaterial color="#4488ff" wireframe transparent opacity={0.25} depthTest={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function CameraFocusOnSelection({
  focus,
}: {
  focus: THREE.Vector3 | null;
}) {
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | undefined;
  const { invalidate } = useThree();
  const lastFocus = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!controls || !focus) return;
    const key = `${focus.x.toFixed(2)}:${focus.y.toFixed(2)}:${focus.z.toFixed(2)}`;
    if (lastFocus.current === key) return;
    lastFocus.current = key;
    controls.target.copy(focus);
    controls.update();
    invalidate();
  }, [controls, focus, invalidate]);

  return null;
}

function CameraRig({
  data,
  view,
  savedCamera,
  focus,
}: {
  data: PreviewData;
  view: CameraView;
  savedCamera: { position: [number, number, number]; target: [number, number, number] } | null;
  focus?: THREE.Vector3 | null;
}) {
  const { camera, controls, invalidate } = useThree();

  useLayoutEffect(() => {
    if (view === "free") {
      if (!savedCamera) return;
      suppressCameraPersist();
      const target = new THREE.Vector3(...savedCamera.target);
      camera.position.set(...savedCamera.position);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      const orbit = controls as OrbitControlsImpl | undefined;
      if (orbit && "target" in orbit) {
        orbit.target.copy(target);
        orbit.update();
      }
      invalidate();
      return;
    }
    suppressCameraPersist();
    const { position, target } = framing(data, view, focus ?? undefined);
    camera.position.copy(position);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    const orbit = controls as OrbitControlsImpl | undefined;
    if (orbit && "target" in orbit) {
      orbit.target.copy(target);
      orbit.update();
    }
    invalidate();
  }, [camera, controls, data, focus, invalidate, savedCamera, view]);

  return null;
}

function CameraPersist() {
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | undefined;
  const persistTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!controls) return;

    const save = () => {
      if (skipCameraPersist) return;
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(() => {
        useCreatorStore.getState().setViewer({
          cameraView: "free",
          camera: {
            position: controls.object.position.toArray() as [number, number, number],
            target: controls.target.toArray() as [number, number, number],
          },
        });
      }, 200);
    };

    controls.addEventListener("change", save);
    return () => {
      controls.removeEventListener("change", save);
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [controls]);

  return null;
}

function RenderQuality({ dpr, background }: { dpr: number; background: string }) {
  const { gl, invalidate } = useThree();
  useLayoutEffect(() => {
    gl.setPixelRatio(dpr);
    gl.setClearColor(background);
    invalidate();
  }, [background, dpr, gl, invalidate]);
  return null;
}

function CameraZoomSync({ onZoomChange }: { onZoomChange: (t: number) => void }) {
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | undefined;

  useEffect(() => {
    if (!controls) return;

    const emit = () => {
      const distance = controls.object.position.distanceTo(controls.target);
      onZoomChange(distanceToZoom(distance));
    };

    controls.addEventListener("change", emit);
    emit();
    return () => controls.removeEventListener("change", emit);
  }, [controls, onZoomChange]);

  return null;
}

/** Keep depth precision stable across zoom (avoids plate/letter z-fighting when far). */
function CameraNearFarSync() {
  const { camera, controls } = useThree();

  useFrame(() => {
    const orbit = controls as OrbitControlsImpl | undefined;
    if (!orbit || !("target" in orbit)) return;
    const dist = camera.position.distanceTo(orbit.target);
    const near = Math.max(0.05, dist * 0.0025);
    const far = Math.max(dist * 40, near * 200);
    if (Math.abs(camera.near - near) > near * 0.05 || Math.abs(camera.far - far) > far * 0.05) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function BambuNavigationBindings({
  controlsRef,
  isDraggingRef,
}: {
  controlsRef: RefObject<OrbitControlsImpl | null>;
  isDraggingRef: RefObject<boolean>;
}) {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const el = gl.domElement;
    const onContextMenu = (event: Event) => event.preventDefault();

    const applyMouseMap = () => {
      const controls = controlsRef.current;
      if (!controls) return;
      controls.mouseButtons.LEFT = MOUSE.ROTATE;
      controls.mouseButtons.MIDDLE = MOUSE.PAN;
      controls.mouseButtons.RIGHT = MOUSE.PAN;
      controls.touches.ONE = TOUCH.ROTATE;
      controls.touches.TWO = TOUCH.DOLLY_PAN;
    };

    // Capture phase: block orbit before OrbitControls sees the event when over a piece
    const onPointerDownCapture = (event: PointerEvent) => {
      applyMouseMap();
      if (event.button !== 0) return;
      if (!suppressOrbitRef.current) return;
      const controls = controlsRef.current;
      if (controls) controls.enabled = false;
    };

    const onPointerUp = () => {
      requestAnimationFrame(() => {
        if (isDraggingRef.current) return;
        const controls = controlsRef.current;
        if (controls) controls.enabled = true;
      });
    };

    applyMouseMap();
    el.addEventListener("contextmenu", onContextMenu);
    el.addEventListener("pointerdown", onPointerDownCapture, true);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    return () => {
      el.removeEventListener("contextmenu", onContextMenu);
      el.removeEventListener("pointerdown", onPointerDownCapture, true);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [controlsRef, gl, isDraggingRef]);

  return null;
}

function PreviewOrientationGizmo() {
  return (
    <GizmoHelper alignment="bottom-left" margin={[PREVIEW_GIZMO_MARGIN_X, PREVIEW_GIZMO_MARGIN_Y]}>
      <group scale={PREVIEW_GIZMO_SCALE}>
        <GizmoViewport
          axisColors={["#d64045", "#2f9e44", "#1971c2"]}
          labelColor="#e8eaed"
          labels={["X", "Y", "Z"]}
          hideNegativeAxes
          axisHeadScale={0.9}
        />
      </group>
    </GizmoHelper>
  );
}

export const LetterScene = forwardRef<
  LetterSceneHandle,
  {
    data: PreviewData;
    depthMm: number;
    frontMm: number;
    wallMm: number;
    showInterior: boolean;
    showLed: boolean;
    showGrid: boolean;
    showPlane: boolean;
    explodedFactor: number;
    wallProfileId: string;
    mountingHoles: MountingHole[];
    holeToolActive: boolean;
    pendingHole?: PendingHoleConfig;
    selectedLetterIndices: number[];
    selectedParts: SelectedLetterPart[];
    partColors: Record<string, string>;
    partOffsets: Record<string, LetterOffset>;
    letterOffsets: Record<number, LetterOffset>;
    selectedHoleId?: string | null;
    onSelectLetter: (index: number, options?: { additive?: boolean }) => void;
    onSelectPart?: (selection: SelectedLetterPart, options?: { additive?: boolean }) => void;
    onDeselectLetter?: () => void;
    onDragLetter: (index: number, x: number, y: number) => void;
    onDragPart?: (letterIndex: number, part: LetterPartKind, x: number, y: number) => void;
    onSelectionHud?: (pos: { x: number; y: number; visible: boolean } | null) => void;
    onSelectHole?: (holeId: string, anchor: { clientX: number; clientY: number }) => void;
    onAddHole?: (x: number, y: number, letterIndex: number) => void;
    cameraView: CameraView;
    pixelRatio: number;
    letterStyle?: LetterStyleInfo;
    onZoomChange?: (t: number) => void;
    thumbnailMode?: boolean;
  }
>(function LetterScene(
  {
    data,
    depthMm,
    frontMm,
    wallMm,
    showInterior,
    showLed,
    showGrid,
    showPlane,
    explodedFactor,
    wallProfileId,
    mountingHoles,
    holeToolActive,
    pendingHole,
    selectedLetterIndices,
    selectedParts,
    partColors,
    partOffsets,
    letterOffsets,
    selectedHoleId,
    onSelectLetter,
    onSelectPart,
    onDragLetter,
    onDragPart,
    onSelectionHud,
    onSelectHole,
    onAddHole,
    onDeselectLetter,
    cameraView,
    pixelRatio,
    letterStyle: letterStyleProp,
    onZoomChange,
    thumbnailMode = false,
  },
  ref,
) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const savedCamera = useCreatorStore((s) => s.camera);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const letterStyle = letterStyleProp ?? data.letter_style;
  const styleParams = useMemo(
    () => letterStylePreviewParams(letterStyle, depthMm, wallMm),
    [depthMm, letterStyle, wallMm],
  );
  const effectiveExplodedFactor = thumbnailMode
    ? styleParams.removableFace
      ? 0.24
      : styleParams.fixedFace
        ? 0
        : 0.14
    : explodedFactor;
  const partSelectable = !thumbnailMode && effectiveExplodedFactor > 0.01;
  const handleDragActiveChange = useCallback((active: boolean) => {
    isDraggingRef.current = active;
    setIsDragging(active);
  }, []);
  const shadowEnabled = Boolean(data.shadow_enabled && data.shadow_cover);
  const shadowDepthMm = data.shadow_depth_mm ?? styleParams.rearMm;
  const shadowColor = partColors.shadow ?? DEFAULT_SHADOW_COLOR;

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        const controls = controlsRef.current;
        if (!controls) return;
        const next = controls.object.position.distanceTo(controls.target) / ZOOM_DOLLY_FACTOR;
        applyCameraDistance(controls, next);
      },
      zoomOut: () => {
        const controls = controlsRef.current;
        if (!controls) return;
        const next = controls.object.position.distanceTo(controls.target) * ZOOM_DOLLY_FACTOR;
        applyCameraDistance(controls, next);
      },
      setZoom: (t: number) => {
        const controls = controlsRef.current;
        if (!controls) return;
        applyCameraDistance(controls, zoomToDistance(t));
      },
    }),
    [],
  );
  const initialFraming = thumbnailMode
    ? framingThumbnail(data)
    : cameraView === "free" && savedCamera
      ? {
          position: new THREE.Vector3(...savedCamera.position),
          target: new THREE.Vector3(...savedCamera.target),
        }
      : framing(data, cameraView === "free" ? "reset" : cameraView);
  const sceneBackground = thumbnailMode ? "#eef2f6" : SCENE_BG;
  const { position, target } = initialFraming;
  const effectivePixelRatio = thumbnailMode ? Math.min(pixelRatio, 1.25) : pixelRatio;
  const effectiveShowInterior = thumbnailMode ? true : showInterior;
  const effectiveShowLed = thumbnailMode ? Boolean(styleParams.backlit) : showLed;
  const effectiveShowGrid = thumbnailMode ? false : showGrid;
  const effectiveShowPlane = thumbnailMode ? false : showPlane;
  const selectionFocus = useMemo(
    () =>
      thumbnailMode
        ? null
        : selectionFocusPoint(
            data,
            selectedLetterIndices,
            selectedParts,
            letterOffsets,
            partOffsets,
            effectiveExplodedFactor,
            depthMm,
            frontMm,
            wallMm,
            letterStyle,
          ),
    [
      data,
      depthMm,
      effectiveExplodedFactor,
      frontMm,
      letterOffsets,
      letterStyle,
      partOffsets,
      selectedLetterIndices,
      selectedParts,
      thumbnailMode,
      wallMm,
    ],
  );

  const selectionHudPoint = useMemo(
    () =>
      thumbnailMode
        ? null
        : selectionHudWorldPoint(
            data,
            selectedLetterIndices,
            selectedParts,
            letterOffsets,
            partOffsets,
            effectiveExplodedFactor,
            depthMm,
            frontMm,
            wallMm,
            letterStyle,
          ),
    [
      data,
      depthMm,
      effectiveExplodedFactor,
      frontMm,
      letterOffsets,
      letterStyle,
      partOffsets,
      selectedLetterIndices,
      selectedParts,
      thumbnailMode,
      wallMm,
    ],
  );

  return (
    <Canvas
      dpr={effectivePixelRatio}
      frameloop={thumbnailMode ? "demand" : "always"}
      gl={{
        antialias: !thumbnailMode,
        alpha: false,
        powerPreference: thumbnailMode ? "default" : "high-performance",
        stencil: false,
      }}
      camera={{ fov: thumbnailMode ? 28 : 35, near: 0.5, far: 8000, position: position.toArray() }}
      style={{
        width: "100%",
        height: "100%",
        touchAction: thumbnailMode ? "auto" : "none",
        pointerEvents: thumbnailMode ? "none" : "auto",
        cursor: thumbnailMode
          ? "inherit"
          : holeToolActive
            ? "crosshair"
            : isDragging
              ? "grabbing"
              : "auto",
      }}
      onCreated={({ camera }) => {
        camera.lookAt(target);
      }}
      onPointerMissed={() => {
        if (thumbnailMode) return;
        if (!holeToolActive && (selectedLetterIndices.length > 0 || selectedParts.length > 0)) {
          onDeselectLetter?.();
        }
      }}
    >
      <RenderQuality dpr={effectivePixelRatio} background={sceneBackground} />
      <color attach="background" args={[sceneBackground]} />
      <ambientLight intensity={thumbnailMode ? 1 : 0.78} />
      <directionalLight
        position={[140, 180, 120]}
        intensity={thumbnailMode ? 1.25 : 0.85}
        castShadow={false}
      />
      <directionalLight position={[-110, 50, 70]} intensity={thumbnailMode ? 0.55 : 0.35} />
      {/* Underside fill so Bottom view shows letter backs instead of a black silhouette */}
      <directionalLight position={[40, -30, -140]} intensity={thumbnailMode ? 0.2 : 0.55} />
      <hemisphereLight
        args={
          thumbnailMode
            ? ["#fff7ee", "#c8d0da", 0.65]
            : ["#4a4e54", "#2a2c30", 0.42]
        }
      />
      <pointLight
        position={[target.x, target.y + 20, 50]}
        intensity={effectiveShowLed ? (thumbnailMode ? 0.65 : 0.5) : thumbnailMode ? 0.08 : 0.06}
        color="#ffd9a0"
      />

      {!thumbnailMode ? <SceneFloor data={data} showGrid={effectiveShowGrid} showPlane={effectiveShowPlane} /> : null}

      <group>
        {shadowEnabled && data.shadow_cover ? (
          <ShadowCoverMesh
            shadowCover={data.shadow_cover}
            depthMm={shadowDepthMm}
            color={shadowColor}
          />
        ) : null}
        {data.letters.map((letter) => (
          <LetterGroup
            key={`${letter.index}-${letter.char}`}
            letter={letter}
            offset={letterOffsets[letter.index] ?? { x: 0, y: 0 }}
            depthMm={depthMm}
            frontMm={frontMm}
            wallMm={wallMm}
            showInterior={effectiveShowInterior}
            showLed={effectiveShowLed}
            explodedFactor={effectiveExplodedFactor}
            wallProfileId={wallProfileId}
            letterStyle={letterStyle}
            partColors={partColors}
            partOffsets={partOffsets}
            partSelectable={partSelectable}
            selectedParts={selectedParts}
            selected={!thumbnailMode && selectedLetterIndices.includes(letter.index)}
            holes={mountingHoles}
            holeToolActive={thumbnailMode ? false : holeToolActive}
            pendingHole={pendingHole}
            onSelect={onSelectLetter}
            onSelectPart={onSelectPart}
            onDrag={(index, x, y) => onDragLetter(index, x, y)}
            onDragPart={onDragPart}
            onDragActiveChange={handleDragActiveChange}
            onSelectHole={onSelectHole}
            selectedHoleId={selectedHoleId}
            onAddHole={onAddHole}
            hideRear={shadowEnabled}
          />
        ))}
      </group>

      {!thumbnailMode ? (
        <>
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enabled={!isDragging}
            enableDamping
            dampingFactor={0.12}
            minDistance={MIN_CAMERA_DISTANCE}
            maxDistance={MAX_CAMERA_DISTANCE}
            enableRotate
            enablePan
            enableZoom
            zoomToCursor
            screenSpacePanning
            panSpeed={0.7}
            zoomSpeed={0.4}
            rotateSpeed={0.45}
            mouseButtons={{
              LEFT: MOUSE.ROTATE,
              MIDDLE: MOUSE.PAN,
              RIGHT: MOUSE.PAN,
            }}
            touches={{
              ONE: TOUCH.ROTATE,
              TWO: TOUCH.DOLLY_PAN,
            }}
          />
          <BambuNavigationBindings controlsRef={controlsRef} isDraggingRef={isDraggingRef} />
          <CameraPersist />
          <CameraNearFarSync />
          {onZoomChange ? <CameraZoomSync onZoomChange={onZoomChange} /> : null}
          <PreviewOrientationGizmo />
          <SelectionHudTracker worldPoint={selectionHudPoint} onScreenPos={onSelectionHud} />
          <CameraFocusOnSelection focus={selectionFocus} />
          <CameraRig data={data} view={cameraView} savedCamera={savedCamera} focus={selectionFocus} />
        </>
      ) : null}
    </Canvas>
  );
});
