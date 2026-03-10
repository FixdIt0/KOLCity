"use client";

import { useMemo, useRef, useState } from "react";
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

interface LabelData {
  wallet: string;
  name: string;
  rank: number;
  pos: [number, number, number];
  color: string;
}

const MAX_LABELS = 40;
const MAX_DIST = 150;
const frustum = new THREE.Frustum();
const projMatrix = new THREE.Matrix4();
const tmpVec = new THREE.Vector3();

export default function FloatingLabels({ wallets }: { wallets: PlacedWallet[] }) {
  const allLabels = useMemo<LabelData[]>(() => {
    return KOL_DATA.map(kol => {
      const placed = wallets.find(w => w.address === kol.wallet);
      if (!placed) return null;
      const dims = getBuildingDimensions(placed);
      const pos = getWalletWorldPosition(placed, dims);
      const type = getKolType(kol);
      return {
        wallet: kol.wallet,
        name: kol.name,
        rank: kol.rank,
        pos: [pos[0], pos[1] + dims.height / 2 + 2, pos[2]] as [number, number, number],
        color: TYPE_COLOR[type],
      };
    }).filter(Boolean) as LabelData[];
  }, [wallets]);

  const [visible, setVisible] = useState<LabelData[]>([]);
  const frameCount = useRef(0);
  const { camera } = useThree();

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % 30 !== 0) return;

    projMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projMatrix);

    const camPos = camera.position;
    const candidates: { label: LabelData; dist: number }[] = [];

    for (let i = 0; i < allLabels.length; i++) {
      const l = allLabels[i];
      tmpVec.set(l.pos[0], l.pos[1], l.pos[2]);
      const dist = camPos.distanceTo(tmpVec);
      if (dist > MAX_DIST) continue;
      if (!frustum.containsPoint(tmpVec)) continue;
      candidates.push({ label: l, dist });
    }

    candidates.sort((a, b) => a.dist - b.dist);
    const next = candidates.slice(0, MAX_LABELS).map(c => c.label);

    setVisible(prev => {
      if (prev.length === next.length && prev.every((v, i) => v.wallet === next[i].wallet)) return prev;
      return next;
    });
  });

  return (
    <group>
      {visible.map(l => (
        <Html key={l.wallet} position={l.pos} center
          distanceFactor={80}
          zIndexRange={[0, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}>
          <div style={{
            background: `${l.color}15`, border: `1px solid ${l.color}40`,
            borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap",
          }}>
            <span style={{ color: l.color, fontSize: 10, fontWeight: 600, fontFamily: "monospace" }}>
              {l.name}
            </span>
            <span style={{ color: `${l.color}80`, fontSize: 8, marginLeft: 4 }}>
              #{l.rank}
            </span>
          </div>
        </Html>
      ))}
    </group>
  );
}
