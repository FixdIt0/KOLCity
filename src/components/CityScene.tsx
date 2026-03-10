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
  { id: "cycle", label: "Auto", icon: "\u27F3" },
  { id: "sunrise", label: "Sunrise", icon: "\uD83C\uDF05", time: 0.0 },
  { id: "day", label: "Day", icon: "\u2600\uFE0F", time: 0.25 },
  { id: "sunset", label: "Sunset", icon: "\uD83C\uDF07", time: 0.5 },
  { id: "night", label: "Night", icon: "\uD83C\uDF19", time: 0.75 },
] as const;

const TYPE_COLORS: Record<KolType, string> = {
  whale: "#3b82f6",
  dumper: "#f97316",
  diamond: "#22c55e",
  degen: "#a855f7",
  rugger: "#ef4444",
};
const TYPE_LABEL: Record<KolType, string> = {
  whale: "Whale",
  dumper: "Dumper",
  diamond: "Diamond",
  degen: "Degen",
  rugger: "Rugger",
};

const LB_PAGE = 20;

function formatPnl(val: number): string {
  if (Math.abs(val) >= 1000) return `${val >= 0 ? "+" : ""}${(val / 1000).toFixed(1)}k`;
  return `${val >= 0 ? "+" : ""}${val.toFixed(1)}`;
}

function formatVolume(val: number): string {
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return val.toFixed(0);
}

// Max absolute PNL for bar width scaling
const MAX_PNL = Math.max(...KOL_DATA.map(k => Math.abs(k.pnlSol)));

export default function CityScene() {
  const [selectedWallet, setSelectedWallet] = useState<PlacedWallet | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<[number, number, number] | null>(null);
  const [panelKol, setPanelKol] = useState<KOL | null>(null);
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
    setSelectedWallet(wallet);
    setSelectedPosition(position);
    const kol = KOL_DATA.find(k => k.wallet === wallet.address) ?? null;
    setPanelKol(kol);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelectedWallet(null);
    setSelectedPosition(null);
    setPanelKol(null);
  }, []);

  const flyToKol = useCallback((kol: KOL) => {
    const placed = wallets.find(w => w.address === kol.wallet);
    if (placed) {
      const dims = getBuildingDimensions(placed);
      handleSelectWallet(placed, getWalletWorldPosition(placed, dims));
    }
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

  const lbKols = useMemo(() => KOL_DATA.slice(lbPage * LB_PAGE, (lbPage + 1) * LB_PAGE), [lbPage]);
  const lbMaxPage = Math.ceil(KOL_DATA.length / LB_PAGE) - 1;

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: "#0d1117", fontFamily: "var(--font-jakarta)" }}>

      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="flex items-start justify-between px-4 pt-3 pb-2 gap-4">

          {/* Left: brand + controls */}
          <div className="pointer-events-auto flex flex-col gap-2 shrink-0">
            <div className="flex items-center gap-2.5">
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "#e2e8f0" }}>
                KOL City
              </span>
              <span style={{
                fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 500,
                color: "#64748b", background: "#1e293b", padding: "2px 6px",
                borderRadius: 4, letterSpacing: "0.02em",
              }}>
                {KOL_DATA.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {TIME_PRESETS.map(p => (
                <button key={p.id} onClick={() => handleTimePreset(p.id, "time" in p ? p.time : undefined)}
                  style={{
                    background: activePreset === p.id ? "#1e293b" : "transparent",
                    color: activePreset === p.id ? "#e2e8f0" : "#475569",
                    border: `1px solid ${activePreset === p.id ? "#334155" : "transparent"}`,
                    borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer",
                    transition: "all 150ms ease", fontFamily: "var(--font-jakarta)",
                  }}>
                  {p.icon}
                </button>
              ))}
              <div style={{ width: 1, height: 16, background: "#1e293b", margin: "0 4px" }} />
              <button onClick={() => setIsRaining(!isRaining)}
                style={{
                  background: isRaining ? "#0c2d6b" : "transparent",
                  color: isRaining ? "#3b82f6" : "#475569",
                  border: `1px solid ${isRaining ? "#1e3a5f" : "transparent"}`,
                  borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer",
                }}>{"\uD83C\uDF27"}</button>
              <button onClick={() => setSoundEnabled(!soundEnabled)}
                style={{
                  background: soundEnabled ? "#1e293b" : "transparent",
                  color: soundEnabled ? "#e2e8f0" : "#475569",
                  border: `1px solid ${soundEnabled ? "#334155" : "transparent"}`,
                  borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer",
                }}>{soundEnabled ? "\uD83D\uDD0A" : "\uD83D\uDD07"}</button>
            </div>
          </div>

          {/* Center: search */}
          <div className="pointer-events-auto relative w-full max-w-[260px]" style={{ marginTop: 2 }}>
            <div style={{ position: "relative" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text" placeholder="Search KOLs..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && searchResults.length > 0) { flyToKol(searchResults[0]); setSearchQuery(""); }
                  if (e.key === "Escape") setSearchQuery("");
                }}
                style={{
                  width: "100%", padding: "7px 10px 7px 32px", fontSize: 12,
                  fontFamily: "var(--font-jakarta)", fontWeight: 500,
                  background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8,
                  color: "#e2e8f0", outline: "none",
                }}
              />
            </div>
            {searchResults.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8,
                overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}>
                {searchResults.map(kol => {
                  const t = getKolType(kol);
                  return (
                    <button key={kol.wallet} onClick={() => { flyToKol(kol); setSearchQuery(""); }}
                      className="lb-row"
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        width: "100%", padding: "7px 10px", fontSize: 12, cursor: "pointer",
                        background: "transparent", border: "none", color: "#e2e8f0", textAlign: "left",
                      }}>
                      <img src={kol.pfp} alt="" style={{
                        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                        border: `1.5px solid ${TYPE_COLORS[t]}`,
                      }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                        {kol.name}
                      </span>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                        color: kol.pnlSol >= 0 ? "var(--kol-green)" : "var(--kol-red)",
                      }}>
                        {formatPnl(kol.pnlSol)}
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
                background: lbOpen ? "#1e293b" : "#0f172a",
                border: "1px solid #1e293b", borderRadius: 8,
                padding: "6px 12px", fontSize: 11, fontWeight: 600,
                color: lbOpen ? "#e2e8f0" : "#64748b", cursor: "pointer",
                fontFamily: "var(--font-jakarta)",
                transition: "all 150ms ease",
              }}>
              {lbOpen ? "Hide" : "Leaderboard"}
            </button>
          </div>
        </div>
      </div>

      {/* LEGEND */}
      <div className="absolute z-20 select-none pointer-events-none" style={{ top: 72, left: 16, display: "flex", gap: 10 }}>
        {(["whale", "diamond", "degen", "dumper", "rugger"] as KolType[]).map(t => (
          <span key={t} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#475569", fontWeight: 500, fontFamily: "var(--font-jakarta)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: TYPE_COLORS[t] }} />
            {TYPE_LABEL[t]}
          </span>
        ))}
      </div>

      {/* LEADERBOARD PANEL */}
      {lbOpen && (
        <div className="absolute z-20" style={{
          top: 52, right: panelKol ? 340 : 16, width: 280,
          background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10,
          maxHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          transition: "right 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          {/* Header */}
          <div style={{
            padding: "10px 14px", borderBottom: "1px solid #1e293b",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.01em" }}>Leaderboard</span>
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {lbPage * LB_PAGE + 1}-{Math.min((lbPage + 1) * LB_PAGE, KOL_DATA.length)}
            </span>
          </div>

          {/* List */}
          <div className="kol-scroll" style={{ flex: 1, overflowY: "auto" }}>
            {lbKols.map(kol => {
              const t = getKolType(kol);
              const sel = selectedWallet?.address === kol.wallet;
              const pnlPct = Math.min(100, (Math.abs(kol.pnlSol) / MAX_PNL) * 100);
              return (
                <button key={kol.wallet} onClick={() => flyToKol(kol)}
                  className="lb-row"
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "6px 14px", fontSize: 12, cursor: "pointer",
                    background: sel ? "rgba(59,130,246,0.08)" : "transparent",
                    border: "none",
                    borderLeft: sel ? "2px solid #3b82f6" : "2px solid transparent",
                    color: "#e2e8f0", textAlign: "left",
                    position: "relative",
                  }}>
                  {/* Rank */}
                  <span style={{
                    fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
                    color: kol.rank <= 3 ? "#f59e0b" : "#475569",
                    width: 22, textAlign: "right", flexShrink: 0,
                  }}>
                    {kol.rank}
                  </span>

                  {/* PFP */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <img src={kol.pfp} alt="" className={kol.rank <= 10 ? "pfp-top10" : ""}
                      style={{
                        width: 28, height: 28, borderRadius: "50%",
                        border: `1.5px solid ${sel ? "#3b82f6" : TYPE_COLORS[t]}`,
                        objectFit: "cover",
                      }}
                      onError={e => {
                        const el = e.target as HTMLImageElement;
                        el.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect fill="#1e293b" width="28" height="28" rx="14"/><text x="14" y="17" text-anchor="middle" fill="#475569" font-size="11" font-family="sans-serif">${kol.name.charAt(0)}</text></svg>`)}`;
                      }}
                    />
                  </div>

                  {/* Name + PNL bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                      color: sel ? "#e2e8f0" : "#cbd5e1",
                    }}>
                      {kol.name}
                    </div>
                    {/* Mini PNL bar */}
                    <div style={{
                      marginTop: 2, height: 2, borderRadius: 1,
                      background: "#1e293b", width: "100%", overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 1,
                        width: `${pnlPct}%`,
                        background: kol.pnlSol >= 0
                          ? "linear-gradient(90deg, #22c55e, #4ade80)"
                          : "linear-gradient(90deg, #ef4444, #f87171)",
                      }} />
                    </div>
                  </div>

                  {/* PNL value */}
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                    color: kol.pnlSol >= 0 ? "#22c55e" : "#ef4444",
                    flexShrink: 0, minWidth: 48, textAlign: "right",
                  }}>
                    {formatPnl(kol.pnlSol)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          <div style={{
            padding: "8px 14px", borderTop: "1px solid #1e293b",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <button onClick={() => setLbPage(Math.max(0, lbPage - 1))} disabled={lbPage === 0}
              style={{
                fontSize: 11, fontWeight: 600, fontFamily: "var(--font-jakarta)",
                color: lbPage === 0 ? "#1e293b" : "#64748b",
                background: "none", border: "none",
                cursor: lbPage === 0 ? "default" : "pointer",
              }}>
              Prev
            </button>
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {lbPage + 1}/{lbMaxPage + 1}
            </span>
            <button onClick={() => setLbPage(Math.min(lbMaxPage, lbPage + 1))} disabled={lbPage === lbMaxPage}
              style={{
                fontSize: 11, fontWeight: 600, fontFamily: "var(--font-jakarta)",
                color: lbPage === lbMaxPage ? "#1e293b" : "#64748b",
                background: "none", border: "none",
                cursor: lbPage === lbMaxPage ? "default" : "pointer",
              }}>
              Next
            </button>
          </div>
        </div>
      )}

      {/* KOL DETAIL SIDE PANEL */}
      {panelKol && <KolDetailPanel kol={panelKol} onClose={handleDeselect} />}

      {/* MINI-MAP */}
      <MiniMap wallets={wallets} selectedAddress={selectedWallet?.address} />

      {/* AMBIENT SOUND */}
      <AmbientSound enabled={soundEnabled} />

      {/* 3D CANVAS */}
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


/* ─── KOL Detail Side Panel ─── */

function KolDetailPanel({ kol, onClose }: { kol: KOL; onClose: () => void }) {
  const t = getKolType(kol);

  return (
    <div className="absolute z-30 slide-in-right" style={{
      top: 0, right: 0, bottom: 0, width: 320,
      background: "linear-gradient(180deg, #0f172a 0%, #0a0f1a 100%)",
      borderLeft: "1px solid #1e293b",
      display: "flex", flexDirection: "column",
      boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
    }}>
      {/* Close */}
      <button onClick={onClose} style={{
        position: "absolute", top: 14, right: 14, zIndex: 10,
        width: 28, height: 28, borderRadius: 8,
        background: "rgba(255,255,255,0.05)", border: "1px solid #1e293b",
        color: "#475569", cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center",
        transition: "all 150ms ease",
      }}
        onMouseEnter={e => { e.currentTarget.style.color = "#e2e8f0"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#475569"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 1l8 8M9 1l-8 8" />
        </svg>
      </button>

      {/* Scrollable content */}
      <div className="kol-scroll" style={{ flex: 1, overflowY: "auto", padding: "20px 20px 24px" }}>

        {/* Header: PFP + Name */}
        <div className="fade-up fade-up-1" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 24 }}>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <img src={kol.pfp} alt={kol.name}
              style={{
                width: 72, height: 72, borderRadius: "50%",
                border: `2px solid ${TYPE_COLORS[t]}`,
                objectFit: "cover",
                boxShadow: `0 0 20px ${TYPE_COLORS[t]}33`,
              }}
              onError={e => {
                const el = e.target as HTMLImageElement;
                el.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect fill="#1e293b" width="72" height="72" rx="36"/><text x="36" y="44" text-anchor="middle" fill="#475569" font-size="24" font-family="sans-serif">${kol.name.charAt(0)}</text></svg>`)}`;
              }}
            />
            {/* Rank badge */}
            <div style={{
              position: "absolute", bottom: -4, right: -4,
              background: kol.rank <= 3 ? "#f59e0b" : kol.rank <= 10 ? "#3b82f6" : "#334155",
              color: kol.rank <= 3 ? "#0f172a" : "#e2e8f0",
              fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
              padding: "2px 6px", borderRadius: 6,
              border: "2px solid #0f172a",
            }}>
              #{kol.rank}
            </div>
          </div>

          <h2 style={{
            fontSize: 20, fontWeight: 800, color: "#e2e8f0",
            letterSpacing: "-0.02em", margin: 0, lineHeight: 1.2,
          }}>
            {kol.name}
          </h2>

          {/* Type badge */}
          <div style={{
            marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5,
            background: `${TYPE_COLORS[t]}15`, border: `1px solid ${TYPE_COLORS[t]}30`,
            borderRadius: 6, padding: "3px 10px",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: TYPE_COLORS[t] }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: TYPE_COLORS[t] }}>{TYPE_LABEL[t]}</span>
          </div>
        </div>

        {/* PNL Hero */}
        <div className="fade-up fade-up-2" style={{
          background: "#0d1117", borderRadius: 10, padding: "14px 16px",
          marginBottom: 12, border: "1px solid #1e293b",
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            PNL (SOL)
          </div>
          <div style={{
            fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)",
            color: kol.pnlSol >= 0 ? "#22c55e" : "#ef4444",
            letterSpacing: "-0.02em", lineHeight: 1,
          }}>
            {kol.pnlSol >= 0 ? "+" : ""}{kol.pnlSol.toFixed(2)}
          </div>
          {/* PNL bar */}
          <div style={{
            marginTop: 10, height: 3, borderRadius: 2,
            background: "#1e293b", width: "100%", overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${Math.min(100, (Math.abs(kol.pnlSol) / MAX_PNL) * 100)}%`,
              background: kol.pnlSol >= 0
                ? "linear-gradient(90deg, #22c55e, #4ade80)"
                : "linear-gradient(90deg, #ef4444, #f87171)",
            }} />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="fade-up fade-up-3" style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12,
        }}>
          {[
            { label: "Volume", value: `${formatVolume(kol.volume)} SOL` },
            { label: "Trades", value: String(kol.trades || "\u2014") },
            { label: "Buys", value: String(kol.buys || "\u2014") },
            { label: "Sells", value: String(kol.sells || "\u2014") },
          ].map(s => (
            <div key={s.label} style={{
              background: "#0d1117", borderRadius: 8, padding: "10px 12px",
              border: "1px solid #1e293b",
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 14, fontFamily: "var(--font-mono)", fontWeight: 600, color: "#cbd5e1" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Socials */}
        <div className="fade-up fade-up-4" style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {kol.twitter && (
            <a href={kol.twitter} target="_blank" rel="noopener noreferrer" className="social-link"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8,
                background: "#0d1117", border: "1px solid #1e293b",
                color: "#94a3b8", textDecoration: "none",
                fontSize: 12, fontWeight: 500,
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {kol.twitter.replace("https://x.com/", "@")}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: "auto", flexShrink: 0, opacity: 0.4 }}>
                <path d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </a>
          )}
          {kol.telegram && (
            <a href={kol.telegram} target="_blank" rel="noopener noreferrer" className="social-link"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8,
                background: "#0d1117", border: "1px solid #1e293b",
                color: "#94a3b8", textDecoration: "none",
                fontSize: 12, fontWeight: 500,
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {kol.telegram.replace("https://t.me/", "").replace("http://t.me/", "")}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: "auto", flexShrink: 0, opacity: 0.4 }}>
                <path d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </a>
          )}
        </div>

        {/* Wallet address */}
        <div style={{
          background: "#0d1117", borderRadius: 8, padding: "10px 12px",
          border: "1px solid #1e293b",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <a href={`https://kolscan.io/account/${kol.wallet}`} target="_blank" rel="noopener noreferrer"
            style={{
              flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
              color: "#3b82f6", textDecoration: "none",
            }}>
            {kol.wallet}
          </a>
          <button onClick={() => navigator.clipboard.writeText(kol.wallet).catch(() => {})}
            style={{
              background: "none", border: "none", color: "#475569",
              cursor: "pointer", flexShrink: 0, padding: 2,
              transition: "color 150ms ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#e2e8f0"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#475569"; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
        </div>

        {/* View on kolscan button */}
        <a href={`https://kolscan.io/account/${kol.wallet}`} target="_blank" rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            marginTop: 12, padding: "10px 16px", borderRadius: 8,
            background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
            color: "#3b82f6", fontSize: 12, fontWeight: 600,
            textDecoration: "none", cursor: "pointer",
            transition: "all 150ms ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(59,130,246,0.18)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(59,130,246,0.1)"; }}>
          View on Kolscan
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 17L17 7M17 7H7M17 7v10" />
          </svg>
        </a>
      </div>
    </div>
  );
}
