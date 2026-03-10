"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface RainProps { active: boolean; }

const COUNT = 3000;

export default function Rain({ active }: RainProps) {
  const ref = useRef<THREE.Points>(null);

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 400;
      pos[i * 3 + 1] = Math.random() * 100;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 400;
      vel[i] = 30 + Math.random() * 40;
    }
    return { positions: pos, velocities: vel };
  }, []);

  useFrame((_, delta) => {
    if (!active || !ref.current) return;
    const geo = ref.current.geometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] -= velocities[i] * delta;
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 80 + Math.random() * 20;
        arr[i * 3] = (Math.random() - 0.5) * 400;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 400;
      }
    }
    posAttr.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#8888cc" size={0.15} transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}
