"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { PlacedWallet } from "@/types/wallet";
import { getBuildingDimensions, getWalletWorldPosition } from "@/lib/building-math";
import { KOL_DATA, getKolType } from "@/data/kols";
import type { KolType } from "@/data/kols";

const TYPE_COLOR: Record<KolType, string> = {
  whale: "#00d4ff", dumper: "#ff6600", diamond: "#00ff88",
  degen: "#aa44ff", rugger: "#ff2244",
};

interface Props { wallets: PlacedWallet[]; count?: number; }

export default function FloatingLabels({ wallets, count = 25 }: Props) {
  const labels = useMemo(() => {
    // Top N KOLs by rank
    const topKols = KOL_DATA.slice(0, count);
    return topKols.map(kol => {
      const placed = wallets.find(w => w.address === kol.wallet);
      if (!placed) return null;
      const dims = getBuildingDimensions(placed);
      const pos = getWalletWorldPosition(placed, dims);
      const type = getKolType(kol);
      return { kol, pos: [pos[0], pos[1] + dims.height / 2 + 2, pos[2]] as [number, number, number], type, color: TYPE_COLOR[type] };
    }).filter(Boolean);
  }, [wallets, count]);

  return (
    <group>
      {labels.map(l => l && (
        <Html key={l.kol.wallet} position={l.pos} center distanceFactor={80}
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
      ))}
    </group>
  );
}
