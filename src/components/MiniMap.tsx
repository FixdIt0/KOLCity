"use client";

import { useMemo } from "react";
import { PlacedWallet } from "@/types/wallet";
import { BLOCK_STRIDE, OFFSET_X, OFFSET_Z, GRID_WORLD } from "@/lib/city-constants";
import { KOL_DATA, getKolType } from "@/data/kols";
import type { KolType } from "@/data/kols";

const TYPE_COLOR: Record<KolType, string> = {
  whale: "#58a6ff", dumper: "#f78166", diamond: "#3fb950", degen: "#d2a8ff", rugger: "#f85149",
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
      const nx = (x + size / 2) / size;
      const nz = (z + size / 2) / size;
      return { nx, nz, color: TYPE_COLOR[type], address: w.address };
    });
  }, [wallets]);

  return (
    <div style={{
      position: "absolute", bottom: 16, right: 16, width: 120, height: 120,
      background: "#161b22", border: "1px solid #30363d", borderRadius: 6,
      overflow: "hidden", zIndex: 20,
    }}>
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
        {dots.map((d, i) => (
          <circle key={i} cx={d.nx * 100} cy={d.nz * 100}
            r={d.address === selectedAddress ? 2.5 : 1}
            fill={d.address === selectedAddress ? "#fff" : d.color}
            opacity={d.address === selectedAddress ? 1 : 0.5} />
        ))}
      </svg>
    </div>
  );
}
