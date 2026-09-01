"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { PreviewData, PreviewLetter, Ring } from "@/types";

function closeRing(ring: Ring): Ring {
  if (ring.length < 2) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (a[0] === b[0] && a[1] === b[1]) return ring;
  return [...ring, a];
}

function toShape(outer: Ring, holes: Ring[] = []) {
  const shape = new THREE.Shape();
  const ring = closeRing(outer);
  shape.moveTo(ring[0][0], ring[0][1]);
  for (let i = 1; i < ring.length; i += 1) {
    shape.lineTo(ring[i][0], ring[i][1]);
  }
  for (const hole of holes) {
    if (hole.length < 3) continue;
    const path = new THREE.Path();
    const hr = closeRing(hole);
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

function centroid(ring: Ring): [number, number] {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  const n = Math.max(1, ring.length);
  return [x / n, y / n];
}

function extrude(shape: THREE.Shape, depth: number, z = 0) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  });
  geo.translate(0, 0, z);
  return geo;
}

function framing(data: PreviewData, view: "free" | "front" | "back" | "side" | "reset") {
  const [minx, miny, maxx, maxy] = data.bounds;
  const cx = (minx + maxx) / 2;
  const cy = (miny + maxy) / 2 - 6;
  const width = Math.max(data.layout_width, 48);
  const height = Math.max(data.layout_height + 36, 80);
  const fov = (35 * Math.PI) / 180;
  const dist = Math.max(width * 0.72, height * 1.15) / Math.tan(fov / 2);
  const target = new THREE.Vector3(cx, cy, 6);
  if (view === "back") {
    return { position: new THREE.Vector3(cx, cy + height * 0.06, -dist), target };
  }
  if (view === "side") {
    return { position: new THREE.Vector3(cx + dist * 0.92, cy + height * 0.12, dist * 0.28), target };
  }
  return { position: new THREE.Vector3(cx, cy + height * 0.08, dist), target };
}

function LetterParts({
  letter,
  depth,
  front,
  showInterior,
  showLed,
}: {
  letter: PreviewLetter;
  depth: number;
  front: number;
  showInterior: boolean;
  showLed: boolean;
}) {
  const rear = Math.min(Math.max(1.4, depth * 0.12), 3.2);
  const wallDepth = Math.max(depth - 0.01, 2);

  const geometries = useMemo(() => {
    const walls: THREE.BufferGeometry[] = [];
    const backs: THREE.BufferGeometry[] = [];
    const fronts: THREE.BufferGeometry[] = [];
    const leds: THREE.Vector3[][] = [];

    letter.outer.forEach((outer) => {
      if (outer.length < 3) return;
      const inners = letter.inner.filter((inner) => inner.length >= 3 && pointInRing(centroid(inner), outer));
      const holes = letter.holes.filter((hole) => hole.length >= 3 && pointInRing(centroid(hole), outer));
      const innerHoles = letter.inner_holes.filter(
        (hole) => hole.length >= 3 && pointInRing(centroid(hole), outer),
      );

      const wallHoles = [...inners, ...holes];
      walls.push(extrude(toShape(outer, wallHoles), wallDepth, 0));
      backs.push(extrude(toShape(outer, holes), rear, 0));
      fronts.push(extrude(toShape(outer, holes), front, depth));

      innerHoles.forEach((ih) => {
        const matchingHole = holes.find((h) => pointInRing(centroid(h), ih)) ?? holes[0];
        if (matchingHole) {
          walls.push(extrude(toShape(ih, [matchingHole]), wallDepth, 0));
        }
      });

      inners.forEach((inner) => {
        const pts = closeRing(inner).map(([x, y]) => new THREE.Vector3(x, y, rear + 2.2));
        if (pts.length > 3) leds.push(pts);
      });
    });

    return { walls, backs, fronts, leds };
  }, [letter, depth, front, rear, wallDepth]);

  const plugX = (letter.bounds[0] + letter.bounds[2]) / 2;
  const plugY = letter.bounds[1];

  return (
    <group>
      {geometries.walls.map((geo, i) => (
        <mesh key={`w-${i}`} geometry={geo}>
          <meshStandardMaterial color="#f3eee6" roughness={0.42} metalness={0.04} />
        </mesh>
      ))}
      {geometries.backs.map((geo, i) => (
        <mesh key={`b-${i}`} geometry={geo}>
          <meshStandardMaterial color="#efe8de" roughness={0.48} metalness={0.04} />
        </mesh>
      ))}
      {!showInterior &&
        geometries.fronts.map((geo, i) => (
          <mesh key={`f-${i}`} geometry={geo}>
            <meshStandardMaterial color="#fff8f1" roughness={0.28} metalness={0.02} />
          </mesh>
        ))}
      <mesh position={[plugX, plugY - 1.2, rear * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3, 3, 7, 20]} />
        <meshStandardMaterial color="#d9d0c6" roughness={0.45} metalness={0.08} />
      </mesh>
      <mesh position={[plugX, plugY - 7.2, rear * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[4, 4, 8, 20]} />
        <meshStandardMaterial color="#cfc6bb" roughness={0.4} metalness={0.1} />
      </mesh>
      {showLed &&
        geometries.leds.map((pts, i) => (
          <LedStrip key={`led-${i}`} points={pts} />
        ))}
    </group>
  );
}

function LedStrip({ points }: { points: THREE.Vector3[] }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.15), [points]);
  const geo = useMemo(
    () => new THREE.TubeGeometry(curve, Math.max(24, points.length), 0.7, 8, true),
    [curve, points.length],
  );
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial
        color="#ffe29a"
        emissive="#ffd36a"
        emissiveIntensity={2.2}
        roughness={0.3}
        toneMapped={false}
      />
    </mesh>
  );
}

function MountingBar({ data, show }: { data: PreviewData; show: boolean }) {
  if (!show) return null;
  const [minx, miny, maxx] = data.bounds;
  const width = maxx - minx + 36;
  const y = miny - 18;
  const z = 4;
  return (
    <group>
      <mesh position={[(minx + maxx) / 2, y, z]}>
        <boxGeometry args={[width, 8, 14]} />
        <meshStandardMaterial color="#2b2b2b" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[(minx + maxx) / 2, y + 5.2, z]}>
        <boxGeometry args={[width - 8, 1.2, 8]} />
        <meshStandardMaterial color="#3c3c3c" metalness={0.4} roughness={0.45} />
      </mesh>
    </group>
  );
}

function CameraRig({
  data,
  view,
}: {
  data: PreviewData;
  view: "free" | "front" | "back" | "side" | "reset";
}) {
  const { camera, controls, invalidate } = useThree();

  useLayoutEffect(() => {
    if (view === "free") return;
    const { position, target } = framing(data, view);
    camera.position.copy(position);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    const orbit = controls as OrbitControlsImpl | undefined;
    if (orbit && "target" in orbit) {
      orbit.target.copy(target);
      orbit.update();
    }
    invalidate();
  }, [camera, controls, data, invalidate, view]);

  return null;
}

export function LetterScene({
  data,
  depthMm,
  frontMm,
  showInterior,
  showLed,
  showBar,
  cameraView,
}: {
  data: PreviewData;
  depthMm: number;
  frontMm: number;
  showInterior: boolean;
  showLed: boolean;
  showBar: boolean;
  cameraView: "free" | "front" | "back" | "side" | "reset";
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { position, target } = framing(data, cameraView === "free" ? "front" : cameraView);

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      camera={{ fov: 35, near: 2, far: 8000, position: position.toArray() }}
      style={{ width: "100%", height: "100%" }}
      onCreated={({ camera }) => {
        camera.lookAt(target);
      }}
    >
      <color attach="background" args={["#f7f3ee"]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[140, 180, 120]} intensity={1.05} />
      <directionalLight position={[-110, 50, 70]} intensity={0.4} />
      <hemisphereLight args={["#fff7ee", "#d7cfc4", 0.45]} />
      <pointLight position={[target.x, target.y + 20, 50]} intensity={showLed ? 0.5 : 0.12} color="#ffd9a0" />
      <group>
        {data.letters.map((letter) => (
          <LetterParts
            key={`${letter.index}-${letter.char}`}
            letter={letter}
            depth={depthMm}
            front={frontMm}
            showInterior={showInterior}
            showLed={showLed}
          />
        ))}
        <MountingBar data={data} show={showBar} />
      </group>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={80}
        maxDistance={1600}
      />
      <CameraRig data={data} view={cameraView} />
    </Canvas>
  );
}
