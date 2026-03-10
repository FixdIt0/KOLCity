"use client";

import { useMemo } from "react";
import { PlacedWallet } from "@/types/wallet";
import { BLOCKS_PER_ROW, BLOCK_STRIDE, OFFSET_X, OFFSET_Z, GRID_WORLD } from "@/lib/city-constants";
import { KOL_DATA, getKolType } from "@/data/kols";
import type { KolType } from "@/data/kols";

const TYPE_COLOR: Record<KolType, string> = {
  whale: "#0088ff", dumper: "#ff6600", diamond: "#00ff88", degen: "#aa44ff", rugger: "#ff2244",
};

interface Props { wallets: PlacedWallet[]; selectedAddress?: string | null; }

export default function MiniMap({ wallets, selectedAddress }: Props) {
  const dots = useMemo(() => {
    const size = GRID_WORLD;
    return wallets.slice(0, 200).map(w => {
      const kol = KOL_DATA.find(k => k.wallet === w.address);
      const type = kol ? getKolType(kol) : "whale";
      const x = OFFSET_X + w.blockCol * BLOCK_STRIDE;
      const z = OFFSET_Z + w.blockRow * BLOCK_STRIDE;
      // Normalize to 0-1
      const nx = (x + size / 2) / size;
      const nz = (z + size / 2) / size;
      return { nx, nz, color: TYPE_COLOR[type], address: w.address, name: kol?.name };
    });
  }, [wallets]);

  return (
    <div style={{
      position: "absolute", bottom: 16, right: 16, width: 140, height: 140,
      background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 8, overflow: "hidden", zIndex: 10,
    }}>
      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", padding: "2px 4px", fontFamily: "monospace" }}>
        MINI-MAP
      </div>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "calc(100% - 16px)" }}>
        {dots.map((d, i) => (
          <circle key={i} cx={d.nx * 100} cy={d.nz * 100} r={d.address === selectedAddress ? 2.5 : 1}
            fill={d.address === selectedAddress ? "#fff" : d.color} opacity={d.address === selectedAddress ? 1 : 0.6} />
        ))}
      </svg>
    </div>
  );
}
