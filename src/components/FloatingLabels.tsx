"use client";

import { useMemo, useState, useCallback } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PlacedWallet } from "@/types/wallet";
import { getBuildingDimensions, getWalletWorldPosition } from "@/lib/building-math";
import { KOL_DATA, getKolType } from "@/data/kols";
import type { KolType } from "@/data/kols";

const TYPE_COLOR: Record<KolType, string> = {
  whale: "#00d4ff", dumper: "#ff6600", diamond: "#00ff88",
  degen: "#aa44ff", rugger: "#ff2244",
};

interface Props { wallets: PlacedWallet[]; }

// Pre-compute all label data once
function buildAllLabels(wallets: PlacedWallet[]) {
  return KOL_DATA.map(kol => {
    const placed = wallets.find(w => w.address === kol.wallet);
    if (!placed) return null;
    const dims = getBuildingDimensions(placed);
    const pos = getWalletWorldPosition(placed, dims);
    const type = getKolType(kol);
    return {
      kol,
      pos: [pos[0], pos[1] + dims.height / 2 + 2, pos[2]] as [number, number, number],
      type,
      color: TYPE_COLOR[type],
    };
  }).filter(Boolean) as { kol: typeof KOL_DATA[0]; pos: [number, number, number]; type: KolType; color: string }[];
}

const MAX_VISIBLE = 80; // max labels rendered at once for perf
const CULL_DISTANCE = 200; // hide labels beyond this distance
const tmpVec = new THREE.Vector3();

export default function FloatingLabels({ wallets }: Props) {
  const allLabels = useMemo(() => buildAllLabels(wallets), [wallets]);
  const [visible, setVisible] = useState<number[]>(() => allLabels.slice(0, MAX_VISIBLE).map((_, i) => i));
  const { camera } = useThree();

  // Every ~15 frames, re-cull which labels are visible based on camera distance
  const frameRef = useMemo(() => ({ count: 0 }), []);
  useFrame(() => {
    frameRef.count++;
    if (frameRef.count % 15 !== 0) return;

    const camPos = camera.position;
    const scored: { idx: number; dist: number }[] = [];

    for (let i = 0; i < allLabels.length; i++) {
      const l = allLabels[i];
      tmpVec.set(l.pos[0], l.pos[1], l.pos[2]);
      const dist = camPos.distanceTo(tmpVec);
      if (dist < CULL_DISTANCE) {
        scored.push({ idx: i, dist });
      }
    }

    scored.sort((a, b) => a.dist - b.dist);
    const next = scored.slice(0, MAX_VISIBLE).map(s => s.idx);

    setVisible(prev => {
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
      return next;
    });
  });

  return (
    <group>
      {visible.map(idx => {
        const l = allLabels[idx];
        return (
          <Html key={l.kol.wallet} position={l.pos} center distanceFactor={80}
            zIndexRange={[0, 0]}
            style={{ pointerEvents: "none", userSelect: "none" }}>
            <div style={{
              background: `${l.color}15`, border: `1px solid ${l.color}40`,
              borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap",
              backdropFilter: "blur(4px)",
            }}>
              <span style={{ color: l.color, fontSize: 10, fontWeight: 600, fontFamily: "monospace" }}>
                {l.kol.name}
              </span>
              <span style={{ color: `${l.color}80`, fontSize: 8, marginLeft: 4 }}>
                #{l.kol.rank}
              </span>
            </div>
          </Html>
        );
      })}
    </group>
  );
}
