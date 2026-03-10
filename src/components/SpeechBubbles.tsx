"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { OFFSET_X, OFFSET_Z, BLOCK_STRIDE, BLOCKS_PER_ROW } from "@/lib/city-constants";

const PHRASES = [
  "BUY NOW! 🚀", "NOT FINANCIAL ADVICE", "1000x EASY", "WAGMI",
  "DYOR (jk just ape)", "LFG!!!", "GENERATIONAL WEALTH", "STILL EARLY",
  "DIAMOND HANDS ONLY 💎", "PUMP IT", "FUD = OPPORTUNITY",
  "TRUST ME BRO", "NFA BUT...", "MOON SOON 🌙", "SEND IT",
  "BAGS ARE PACKED 💰", "ALPHA LEAK 🤫", "DEV IS BASED",
  "RUG? WHAT RUG?", "BULLISH AF", "FLOOR IS LAVA",
];

export default function SpeechBubbles() {
  const bubbles = useMemo(() => {
    const result: { pos: [number, number, number]; text: string; color: string }[] = [];
    const rng = (s: number) => { s = Math.sin(s) * 43758.5453; return s - Math.floor(s); };

    for (let i = 0; i < 20; i++) {
      const blockR = Math.floor(rng(i * 7.3) * BLOCKS_PER_ROW);
      const blockC = Math.floor(rng(i * 13.7) * BLOCKS_PER_ROW);
      const x = OFFSET_X + blockC * BLOCK_STRIDE + (rng(i * 3.1) - 0.5) * 8;
      const z = OFFSET_Z + blockR * BLOCK_STRIDE + (rng(i * 5.9) - 0.5) * 8;
      const phrase = PHRASES[Math.floor(rng(i * 17.3) * PHRASES.length)];
      const colors = ["#00d4ff", "#ff44aa", "#44ff88", "#ffaa00", "#aa66ff"];
      result.push({ pos: [x, 1.5, z], text: phrase, color: colors[i % colors.length] });
    }
    return result;
  }, []);

  return (
    <group>
      {bubbles.map((b, i) => (
        <Html key={i} position={b.pos} center distanceFactor={120} style={{ pointerEvents: "none" }}>
          <div style={{
            background: "rgba(0,0,0,0.75)", border: `1px solid ${b.color}40`,
            borderRadius: 8, padding: "3px 8px", whiteSpace: "nowrap",
            fontSize: 9, color: b.color, fontWeight: 600, fontFamily: "monospace",
          }}>
            💬 {b.text}
          </div>
        </Html>
      ))}
    </group>
  );
}
