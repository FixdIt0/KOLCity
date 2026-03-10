"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { KOL_DATA } from "@/data/kols";

const TICKER_MSGS = [
  "🚨 SPONSORED RUG IN PROGRESS",
  "📈 PUMP DETECTED — DUMP IMMINENT",
  "💀 ANOTHER KOL EXITS LIQUIDITY",
  "🎰 DEGEN ACTIVITY AT ALL-TIME HIGH",
  "🐋 WHALE ALERT: MASSIVE SELL-OFF",
  "💎 DIAMOND HANDS HOLDING STRONG (COPIUM)",
  "📊 562 KOLs TRACKED — 0 ACCOUNTABLE",
  "🔥 HOT TAKE: THEY'RE ALL INSIDERS",
];

export default function FloatingBillboard({ solPrice }: { solPrice?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const msgIdx = useRef(0);
  const timer = useRef(0);

  useFrame((_, delta) => {
    timer.current += delta;
    if (timer.current > 4) {
      timer.current = 0;
      msgIdx.current = (msgIdx.current + 1) % TICKER_MSGS.length;
      if (ref.current) ref.current.textContent = TICKER_MSGS[msgIdx.current];
    }
  });

  const topKol = KOL_DATA[0];

  return (
    <group position={[0, 55, 0]}>
      {/* SOL Price hologram */}
      <Html center distanceFactor={200} style={{ pointerEvents: "none" }}>
        <div style={{ textAlign: "center", userSelect: "none" }}>
          <div style={{
            fontSize: 24, fontWeight: 800, fontFamily: "monospace",
            color: "#00d4ff", textShadow: "0 0 20px #00d4ff60",
          }}>
            ◎ SOL ${solPrice?.toFixed(2) ?? "87.30"}
          </div>
          <div ref={ref} style={{
            fontSize: 10, color: "#ff44aa", fontFamily: "monospace",
            marginTop: 4, textShadow: "0 0 10px #ff44aa40",
          }}>
            {TICKER_MSGS[0]}
          </div>
          <div style={{
            fontSize: 8, color: "#ffffff40", fontFamily: "monospace", marginTop: 4,
          }}>
            👑 #1 {topKol.name} — +{topKol.pnlSol.toFixed(0)} SOL
          </div>
        </div>
      </Html>
    </group>
  );
}
