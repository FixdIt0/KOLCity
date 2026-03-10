"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import CityGrid from "./CityGrid";
import SceneLighting from "./SceneLighting";
import SelectionBeam from "./SelectionBeam";
import FloatingLabels from "./FloatingLabels";
import SpeechBubbles from "./SpeechBubbles";
import StreetSigns from "./StreetSigns";
import Rain from "./Rain";
import BuildingParticles from "./BuildingParticles";
import MiniMap from "./MiniMap";
import AmbientSound from "./AmbientSound";
import InstancedCars from "./InstancedCars";
import { PlacedWallet } from "@/types/wallet";
import { getBuildingDimensions, getWalletWorldPosition } from "@/lib/building-math";
import { KOL_DATA, getKolType } from "@/data/kols";
import type { KOL, KolType } from "@/data/kols";
import { BLOCKS_PER_ROW, PARK_BLOCKS } from "@/lib/city-constants";
import { useSwapEvents } from "@/lib/swap-events";

function kolsToWallets(kols: KOL[]): PlacedWallet[] {
  const center = Math.floor(BLOCKS_PER_ROW / 2);
  const spiral: [number, number][] = [];
  const visited = new Set<string>();
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  let r = center, c = center, dir = 0, steps = 1, stepCount = 0, turnCount = 0;
  for (let i = 0; i < BLOCKS_PER_ROW * BLOCKS_PER_ROW; i++) {
    if (r >= 0 && r < BLOCKS_PER_ROW && c >= 0 && c < BLOCKS_PER_ROW) {
      const key = `${r},${c}`;
      if (!visited.has(key) && !PARK_BLOCKS.has(key)) { visited.add(key); spiral.push([r, c]); }
    }
    r += dirs[dir][0]; c += dirs[dir][1]; stepCount++;
    if (stepCount === steps) { stepCount = 0; dir = (dir + 1) % 4; turnCount++; if (turnCount === 2) { turnCount = 0; steps++; } }
  }
  return kols.map((kol, i) => {
    const block = spiral[Math.min(Math.floor(i / 16), spiral.length - 1)];
    const absPnl = Math.abs(kol.pnlSol);
    return {
      address: kol.wallet, txnCount: Math.round(Math.max(10, absPnl > 0 ? absPnl * 200 : 50)),
      walletAgeDays: 30, volumeTraded: Math.max(1, kol.volume || kol.trades * 10), feesPaid: 0,
      uniqueTokensSwapped: Math.max(1, kol.trades || Math.max(kol.buys, kol.sells)),
      latestBlocktime: kol.pnlSol > 0 ? Math.floor(Date.now() / 1000) - 600 : Math.floor(Date.now() / 1000) - 86400 * 30,
      identityName: kol.name, identityType: getKolType(kol), identityCategory: `#${kol.rank}`,
      blockRow: block[0], blockCol: block[1], localSlot: i % 16,
    };
  });
}

const TIME_PRESETS = [
  { id: "cycle", label: "Auto", icon: "⟳" },
  { id: "sunrise", label: "Sunrise", icon: "🌅", time: 0.0 },
  { id: "day", label: "Day", icon: "☀️", time: 0.25 },
  { id: "sunset", label: "Sunset", icon: "🌇", time: 0.5 },
  { id: "night", label: "Night", icon: "🌙", time: 0.75 },
] as const;

const TYPE_COLORS: Record<KolType, string> = { whale: "#58a6ff", dumper: "#f78166", diamond: "#3fb950", degen: "#d2a8ff", rugger: "#f85149" };
const TYPE_LABEL: Record<KolType, string> = { whale: "Whale", dumper: "Dumper", diamond: "Diamond", degen: "Degen", rugger: "Rugger" };

const LEADERBOARD_PAGE = 25;

export default function CityScene() {
  const [selectedWallet, setSelectedWallet] = useState<PlacedWallet | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<[number, number, number] | null>(null);
  const [hoveredKol, setHoveredKol] = useState<KOL | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activePreset, setActivePreset] = useState("night");
  const [isRaining, setIsRaining] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [lbOpen, setLbOpen] = useState(true);
  const [lbPage, setLbPage] = useState(0);
  const timeRef = useRef(0.75);
  const autoModeRef = useRef(false);

  const wallets = useMemo(() => kolsToWallets(KOL_DATA), []);
  const swapQueueRef = useSwapEvents(wallets);

  const handleSelectWallet = useCallback((wallet: PlacedWallet, position: [number, number, number]) => {
    setSelectedWallet(wallet); setSelectedPosition(position);
    setHoveredKol(KOL_DATA.find(k => k.wallet === wallet.address) ?? null);
  }, []);

  const handleDeselect = useCallback(() => { setSelectedWallet(null); setSelectedPosition(null); setHoveredKol(null); }, []);

  const flyToKol = useCallback((kol: KOL) => {
    const placed = wallets.find(w => w.address === kol.wallet);
    if (placed) { const dims = getBuildingDimensions(placed); handleSelectWallet(placed, getWalletWorldPosition(placed, dims)); }
  }, [wallets, handleSelectWallet]);

  const handleTimePreset = useCallback((id: string, time?: number) => {
    if (id === "cycle") autoModeRef.current = true;
    else if (time !== undefined) { timeRef.current = time; autoModeRef.current = false; }
    setActivePreset(id);
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    return KOL_DATA.filter(k => k.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 6);
  }, [searchQuery]);

  const lbKols = useMemo(() => KOL_DATA.slice(lbPage * LEADERBOARD_PAGE, (lbPage + 1) * LEADERBOARD_PAGE), [lbPage]);
  const lbMaxPage = Math.ceil(KOL_DATA.length / LEADERBOARD_PAGE) - 1;

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: "#0d1117" }}>

      {/* ─── TOP BAR ─── */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="flex items-start justify-between px-4 pt-3 pb-2 gap-4">

          {/* Left: brand + controls */}
          <div className="pointer-events-auto flex flex-col gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold tracking-tight" style={{ color: "#c9d1d9" }}>KOL City</span>
              <span className="text-[10px] font-mono" style={{ color: "#484f58" }}>{KOL_DATA.length} KOLs</span>
            </div>
            {/* Time + weather row */}
            <div className="flex items-center gap-1">
              {TIME_PRESETS.map(p => (
                <button key={p.id} onClick={() => handleTimePreset(p.id, "time" in p ? p.time : undefined)}
                  style={{
                    background: activePreset === p.id ? "#21262d" : "transparent",
                    color: activePreset === p.id ? "#c9d1d9" : "#484f58",
                    border: `1px solid ${activePreset === p.id ? "#30363d" : "transparent"}`,
                    borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer",
                    transition: "all 150ms ease",
                  }}>
                  {p.icon}
                </button>
              ))}
              <div style={{ width: 1, height: 16, background: "#21262d", margin: "0 4px" }} />
              <button onClick={() => setIsRaining(!isRaining)}
                style={{
                  background: isRaining ? "#0c2d6b" : "transparent",
                  color: isRaining ? "#58a6ff" : "#484f58",
                  border: `1px solid ${isRaining ? "#1f3d68" : "transparent"}`,
                  borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer",
                }}>🌧</button>
              <button onClick={() => setSoundEnabled(!soundEnabled)}
                style={{
                  background: soundEnabled ? "#21262d" : "transparent",
                  color: soundEnabled ? "#c9d1d9" : "#484f58",
                  border: `1px solid ${soundEnabled ? "#30363d" : "transparent"}`,
                  borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer",
                }}>{soundEnabled ? "🔊" : "🔇"}</button>
            </div>
          </div>

          {/* Center: search */}
          <div className="pointer-events-auto relative w-full max-w-[280px]" style={{ marginTop: 2 }}>
            <input
              type="text" placeholder="Search KOL..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && searchResults.length > 0) { flyToKol(searchResults[0]); setSearchQuery(""); }
                if (e.key === "Escape") setSearchQuery("");
              }}
              style={{
                width: "100%", padding: "6px 10px", fontSize: 12, fontFamily: "inherit",
                background: "#161b22", border: "1px solid #30363d", borderRadius: 6,
                color: "#c9d1d9", outline: "none",
              }}
            />
            {searchResults.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                background: "#161b22", border: "1px solid #30363d", borderRadius: 6,
                overflow: "hidden",
              }}>
                {searchResults.map(kol => {
                  const t = getKolType(kol);
                  return (
                    <button key={kol.wallet} onClick={() => { flyToKol(kol); setSearchQuery(""); }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "6px 10px", fontSize: 12, cursor: "pointer",
                        background: "transparent", border: "none", color: "#c9d1d9", textAlign: "left",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#21262d")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: TYPE_COLORS[t], flexShrink: 0 }} />
                        {kol.name}
                      </span>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: kol.pnlSol >= 0 ? "#3fb950" : "#f85149" }}>
                        {kol.pnlSol >= 0 ? "+" : ""}{kol.pnlSol.toFixed(0)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: leaderboard toggle */}
          <div className="pointer-events-auto shrink-0" style={{ marginTop: 2 }}>
            <button onClick={() => setLbOpen(!lbOpen)}
              style={{
                background: "#161b22", border: "1px solid #30363d", borderRadius: 6,
                padding: "5px 10px", fontSize: 11, color: "#8b949e", cursor: "pointer",
              }}>
              {lbOpen ? "Hide" : "Leaderboard"}
            </button>
          </div>
        </div>
      </div>

      {/* ─── LEGEND ─── */}
      <div className="absolute z-20 select-none pointer-events-none" style={{ top: 72, left: 16, display: "flex", gap: 8 }}>
        {(["whale", "diamond", "degen", "dumper", "rugger"] as KolType[]).map(t => (
          <span key={t} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#484f58" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: TYPE_COLORS[t] }} />
            {TYPE_LABEL[t]}
          </span>
        ))}
      </div>

      {/* ─── LEADERBOARD PANEL ─── */}
      {lbOpen && (
        <div className="absolute z-20" style={{
          top: 52, right: 16, width: 240,
          background: "#161b22", border: "1px solid #30363d", borderRadius: 8,
          maxHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #21262d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#c9d1d9" }}>Leaderboard</span>
            <span style={{ fontSize: 10, color: "#484f58", fontFamily: "monospace" }}>
              {lbPage * LEADERBOARD_PAGE + 1}–{Math.min((lbPage + 1) * LEADERBOARD_PAGE, KOL_DATA.length)}
            </span>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {lbKols.map(kol => {
              const t = getKolType(kol);
              const sel = selectedWallet?.address === kol.wallet;
              return (
                <button key={kol.wallet} onClick={() => flyToKol(kol)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "5px 12px", fontSize: 12, cursor: "pointer",
                    background: sel ? "#1c2128" : "transparent", border: "none",
                    borderLeft: sel ? "2px solid #58a6ff" : "2px solid transparent",
                    color: "#c9d1d9", textAlign: "left",
                    transition: "background 100ms ease",
                  }}
                  onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "#1c2128"; }}
                  onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ fontSize: 10, color: "#484f58", fontFamily: "monospace", width: 24, textAlign: "right", flexShrink: 0 }}>
                    {kol.rank}
                  </span>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: TYPE_COLORS[t], flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
                    {kol.name}
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: kol.pnlSol >= 0 ? "#3fb950" : "#f85149", flexShrink: 0 }}>
                    {kol.pnlSol >= 0 ? "+" : ""}{kol.pnlSol.toFixed(0)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          <div style={{
            padding: "6px 12px", borderTop: "1px solid #21262d",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <button onClick={() => setLbPage(Math.max(0, lbPage - 1))} disabled={lbPage === 0}
              style={{ fontSize: 11, color: lbPage === 0 ? "#30363d" : "#8b949e", background: "none", border: "none", cursor: lbPage === 0 ? "default" : "pointer" }}>
              ← Prev
            </button>
            <span style={{ fontSize: 10, color: "#484f58", fontFamily: "monospace" }}>
              {lbPage + 1}/{lbMaxPage + 1}
            </span>
            <button onClick={() => setLbPage(Math.min(lbMaxPage, lbPage + 1))} disabled={lbPage === lbMaxPage}
              style={{ fontSize: 11, color: lbPage === lbMaxPage ? "#30363d" : "#8b949e", background: "none", border: "none", cursor: lbPage === lbMaxPage ? "default" : "pointer" }}>
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ─── SELECTED KOL CARD ─── */}
      {hoveredKol && (
        <div className="absolute z-20" style={{
          bottom: 16, left: 16, width: 280,
          background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 12,
        }}>
          <button onClick={handleDeselect}
            style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 14 }}>
            ✕
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <img src={hoveredKol.pfp} alt="" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }}
              onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect fill='%2321262d' width='32' height='32' rx='16'/%3E%3C/svg%3E"; }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#c9d1d9" }}>{hoveredKol.name}</div>
              <div style={{ fontSize: 11, color: "#484f58", display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: TYPE_COLORS[getKolType(hoveredKol)] }} />
                {TYPE_LABEL[getKolType(hoveredKol)]} · #{hoveredKol.rank}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[
              { label: "PNL (SOL)", value: `${hoveredKol.pnlSol >= 0 ? "+" : ""}${hoveredKol.pnlSol.toFixed(1)}`, color: hoveredKol.pnlSol >= 0 ? "#3fb950" : "#f85149" },
              { label: "Volume", value: hoveredKol.volume.toFixed(0), color: "#c9d1d9" },
              { label: "Trades", value: String(hoveredKol.trades || "—"), color: "#c9d1d9" },
            ].map(s => (
              <div key={s.label} style={{ background: "#0d1117", borderRadius: 6, padding: "6px 8px" }}>
                <div style={{ fontSize: 10, color: "#484f58", marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 600, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <a href={`https://kolscan.io/account/${hoveredKol.wallet}`} target="_blank" rel="noopener"
              style={{ fontSize: 10, fontFamily: "monospace", color: "#58a6ff", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              {hoveredKol.wallet}
            </a>
            <button onClick={() => navigator.clipboard.writeText(hoveredKol.wallet).catch(() => {})}
              style={{ background: "none", border: "none", color: "#484f58", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>
              📋
            </button>
          </div>
        </div>
      )}

      {/* ─── MINI-MAP ─── */}
      <MiniMap wallets={wallets} selectedAddress={selectedWallet?.address} />

      {/* ─── AMBIENT SOUND ─── */}
      <AmbientSound enabled={soundEnabled} />

      {/* ─── 3D CANVAS ─── */}
      <Canvas
        camera={{ position: [0, 80, 120], fov: 50, near: 1, far: 2000 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.5 }}
        style={{ position: "absolute", inset: 0 }}
      >
        <SceneLighting timeRef={timeRef} autoModeRef={autoModeRef} />
        <CityGrid wallets={wallets} timeRef={timeRef} onSelectWallet={handleSelectWallet} selectedAddress={selectedWallet?.address} />
        <InstancedCars swapQueueRef={swapQueueRef} wallets={wallets} timeRef={timeRef} />
        <FloatingLabels wallets={wallets} count={30} />
        <SpeechBubbles />
        <StreetSigns />
        <Rain active={isRaining} />
        <BuildingParticles wallets={wallets} />
        {selectedPosition && <SelectionBeam position={selectedPosition} buildingHeight={10} />}
        <OrbitControls makeDefault minDistance={10} maxDistance={500} maxPolarAngle={Math.PI / 2.1}
          enableDamping dampingFactor={0.05} panSpeed={1.5} screenSpacePanning={false} />
        <EffectComposer>
          <Bloom intensity={1.8} luminanceThreshold={0.2} luminanceSmoothing={0.9} mipmapBlur radius={0.8} />
          <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={new THREE.Vector2(0.0006, 0.0006)} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
