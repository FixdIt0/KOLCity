"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PlacedWallet } from "@/types/wallet";
import { getBuildingDimensions, getWalletWorldPosition } from "@/lib/building-math";
import { KOL_DATA, getKolType } from "@/data/kols";

const SMOKE_COUNT = 200;
const COIN_COUNT = 150;

interface Props { wallets: PlacedWallet[]; }

export default function BuildingParticles({ wallets }: Props) {
  const smokeRef = useRef<THREE.Points>(null);
  const coinRef = useRef<THREE.Points>(null);

  // Find rugger and whale building positions
  const { smokeOrigins, coinOrigins } = useMemo(() => {
    const smoke: [number, number, number][] = [];
    const coins: [number, number, number][] = [];
    for (const kol of KOL_DATA.slice(0, 100)) {
      const placed = wallets.find(w => w.address === kol.wallet);
      if (!placed) continue;
      const dims = getBuildingDimensions(placed);
      const pos = getWalletWorldPosition(placed, dims);
      const type = getKolType(kol);
      if (type === "rugger") smoke.push([pos[0], pos[1] + dims.height / 2, pos[2]]);
      else if (type === "whale" || type === "diamond") coins.push([pos[0], pos[1] + dims.height / 2 + 2, pos[2]]);
    }
    return { smokeOrigins: smoke.slice(0, 10), coinOrigins: coins.slice(0, 8) };
  }, [wallets]);

  const smokePos = useMemo(() => {
    const arr = new Float32Array(SMOKE_COUNT * 3);
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const origin = smokeOrigins[i % Math.max(1, smokeOrigins.length)];
      if (!origin) continue;
      arr[i * 3] = origin[0] + (Math.random() - 0.5) * 2;
      arr[i * 3 + 1] = origin[1] + Math.random() * 8;
      arr[i * 3 + 2] = origin[2] + (Math.random() - 0.5) * 2;
    }
    return arr;
  }, [smokeOrigins]);

  const coinPos = useMemo(() => {
    const arr = new Float32Array(COIN_COUNT * 3);
    for (let i = 0; i < COIN_COUNT; i++) {
      const origin = coinOrigins[i % Math.max(1, coinOrigins.length)];
      if (!origin) continue;
      arr[i * 3] = origin[0] + (Math.random() - 0.5) * 3;
      arr[i * 3 + 1] = origin[1] + Math.random() * 5;
      arr[i * 3 + 2] = origin[2] + (Math.random() - 0.5) * 3;
    }
    return arr;
  }, [coinOrigins]);

  useFrame((_, delta) => {
    // Smoke rises
    if (smokeRef.current && smokeOrigins.length > 0) {
      const attr = smokeRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      const a = attr.array as Float32Array;
      for (let i = 0; i < SMOKE_COUNT; i++) {
        a[i * 3 + 1] += delta * (2 + Math.random());
        a[i * 3] += (Math.random() - 0.5) * delta * 0.5;
        const origin = smokeOrigins[i % smokeOrigins.length];
        if (origin && a[i * 3 + 1] > origin[1] + 15) {
          a[i * 3] = origin[0] + (Math.random() - 0.5) * 2;
          a[i * 3 + 1] = origin[1];
          a[i * 3 + 2] = origin[2] + (Math.random() - 0.5) * 2;
        }
      }
      attr.needsUpdate = true;
    }
    // Coins fall
    if (coinRef.current && coinOrigins.length > 0) {
      const attr = coinRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      const a = attr.array as Float32Array;
      for (let i = 0; i < COIN_COUNT; i++) {
        a[i * 3 + 1] -= delta * (3 + Math.random() * 2);
        a[i * 3] += Math.sin(a[i * 3 + 1] * 2 + i) * delta * 0.3;
        if (a[i * 3 + 1] < 0) {
          const origin = coinOrigins[i % coinOrigins.length];
          if (origin) {
            a[i * 3] = origin[0] + (Math.random() - 0.5) * 3;
            a[i * 3 + 1] = origin[1] + Math.random() * 5;
            a[i * 3 + 2] = origin[2] + (Math.random() - 0.5) * 3;
          }
        }
      }
      attr.needsUpdate = true;
    }
  });

  return (
    <group>
      {smokeOrigins.length > 0 && (
        <points ref={smokeRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[smokePos, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#553333" size={0.6} transparent opacity={0.3} sizeAttenuation />
        </points>
      )}
      {coinOrigins.length > 0 && (
        <points ref={coinRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[coinPos, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#ffdd44" size={0.25} transparent opacity={0.7} sizeAttenuation />
        </points>
      )}
    </group>
  );
}
