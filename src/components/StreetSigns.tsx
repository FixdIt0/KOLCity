"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { OFFSET_X, OFFSET_Z, BLOCK_STRIDE, BLOCKS_PER_ROW, ROAD_WIDTH } from "@/lib/city-constants";

const STREET_NAMES = [
  "Rug Pull Ave", "Pump Street", "Diamond District", "Degen Alley",
  "Shill Boulevard", "Exit Liquidity Lane", "Honeypot Highway",
  "Bag Holder Blvd", "Moon Mission Rd", "Paper Hands Pkwy",
  "Whale Watch Way", "Insider Trading Terrace", "FOMO Freeway",
  "Cope Corner", "Rekt Road",
];

export default function StreetSigns() {
  const signs = useMemo(() => {
    const result: { pos: [number, number, number]; name: string; rotY: number }[] = [];
    const center = Math.floor(BLOCKS_PER_ROW / 2);

    for (let i = 0; i < STREET_NAMES.length; i++) {
      const isVertical = i % 2 === 0;
      const offset = Math.floor(i / 2) - 3;
      const idx = center + offset;
      if (idx < 0 || idx >= BLOCKS_PER_ROW) continue;

      const x = isVertical
        ? OFFSET_X + idx * BLOCK_STRIDE - ROAD_WIDTH / 2
        : OFFSET_X + center * BLOCK_STRIDE;
      const z = isVertical
        ? OFFSET_Z + center * BLOCK_STRIDE
        : OFFSET_Z + idx * BLOCK_STRIDE - ROAD_WIDTH / 2;

      result.push({ pos: [x, 3.5, z], name: STREET_NAMES[i], rotY: isVertical ? 0 : Math.PI / 2 });
    }
    return result;
  }, []);

  return (
    <group>
      {signs.map((s, i) => (
        <group key={i} position={s.pos}>
          {/* Post */}
          <mesh position={[0, -1.5, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 3, 6]} />
            <meshStandardMaterial color="#444" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Sign label */}
          <Html center distanceFactor={100} zIndexRange={[0, 0]} style={{ pointerEvents: "none" }}>
            <div style={{
              background: "#1a5c1a", border: "1px solid #2a8a2a", borderRadius: 2,
              padding: "2px 6px", whiteSpace: "nowrap",
              fontSize: 8, color: "#fff", fontWeight: 700, fontFamily: "monospace",
              textTransform: "uppercase", letterSpacing: 0.5,
            }}>
              {s.name}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
