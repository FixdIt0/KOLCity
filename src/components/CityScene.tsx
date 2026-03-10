"use client";

import { useState, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import CityGrid from "./CityGrid";
import SceneLighting from "./SceneLighting";
import SelectionBeam from "./SelectionBeam";
import FloatingLabels from "./FloatingLabels";
import SpeechBubbles from "./SpeechBubbles";
import StreetSigns from "./StreetSigns";
import FloatingBillboard from "./FloatingBillboard";
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
import { WindowHoverInfo } from "./WindowTooltip";

// Place KOLs in spiral from center
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
      address: kol.wallet,
      txnCount: Math.round(Math.max(10, (absPnl > 0 ? absPnl * 200 : 50))),
      walletAgeDays: 30,
      volumeTraded: Math.max(1, kol.volume || kol.trades * 10),
      feesPaid: 0,
      uniqueTokensSwapped: Math.max(1, kol.trades || Math.max(kol.buys, kol.sells)),
      latestBlocktime: kol.pnlSol > 0 ? Math.floor(Date.now() / 1000) - 600 : Math.floor(Date.now() / 1000) - 86400 * 30,
      identityName: kol.name,
      identityType: getKolType(kol),
      identityCategory: `#${kol.rank}`,
      blockRow: block[0], blockCol: block[1], localSlot: i % 16,
    };
  });
}

const TIME_PRESETS = [
  { id: "cycle", label: "⟳ Cycle" },
  { id: "sunrise", label: "🌅", time: 0.0 },
  { id: "day", label: "☀️", time: 0.25 },
  { id: "sunset", label: "🌇", time: 0.5 },
  { id: "night", label: "🌙", time: 0.75 },
] as const;

const TYPE_EMOJI: Record<KolType, string> = { whale: "🐋", dumper: "🚽", diamond: "💎", degen: "🎰", rugger: "💀" };
const TYPE_LABEL: Record<KolType, string> = { whale: "Whale", dumper: "Dumper", diamond: "Diamond Hands", degen: "Degen", rugger: "Rugpull Architect" };

export default function CityScene() {
  const [selectedWallet, setSelectedWallet] = useState<PlacedWallet | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<[number, number, number] | null>(null);
  const [hoveredKol, setHoveredKol] = useState<KOL | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activePreset, setActivePreset] = useState("night");
  const [isRaining, setIsRaining] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const timeRef = useRef(0.75);
  const autoModeRef = useRef(false);

  const wallets = useMemo(() => kolsToWallets(KOL_DATA), []);
  const swapQueueRef = useSwapEvents(wallets);

  const handleSelectWallet = useCallback((wallet: PlacedWallet, position: [number, number, number]) => {
    setSelectedWallet(wallet); setSelectedPosition(position);
    setHoveredKol(KOL_DATA.find(k => k.wallet === wallet.address) ?? null);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelectedWallet(null); setSelectedPosition(null); setHoveredKol(null);
  }, []);

  const flyToKol = useCallback((kol: KOL) => {
    const placed = wallets.find(w => w.address === kol.wallet);
    if (placed) {
      const dims = getBuildingDimensions(placed);
      const pos = getWalletWorldPosition(placed, dims);
      handleSelectWallet(placed, pos);
    }
  }, [wallets, handleSelectWallet]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (!q) return;
    const match = KOL_DATA.find(k => k.name.toLowerCase().includes(q.toLowerCase()) || k.wallet.startsWith(q));
    if (match) flyToKol(match);
  }, [flyToKol]);

  const handleTimePreset = useCallback((id: string, time?: number) => {
    if (id === "cycle") { autoModeRef.current = true; }
    else if (time !== undefined) { timeRef.current = time; autoModeRef.current = false; }
    setActivePreset(id);
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    return KOL_DATA.filter(k => k.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8);
  }, [searchQuery]);

  const topKols = useMemo(() => KOL_DATA.slice(0, 100), []);

  const handleCopyWallet = useCallback(async (addr: string) => {
    try { await navigator.clipboard.writeText(addr); } catch {}
  }, []);

  return (
    <div className="relative w-full h-screen bg-[#0a0a12] overflow-hidden">
      {/* Title */}
      <div className="absolute top-4 left-4 z-10 select-none">
        <h1 className="text-2xl font-bold text-white/90 tracking-tight">🏙️ KOL City</h1>
        <p className="text-[10px] text-white/30 mt-0.5">
          {KOL_DATA.length} influencers • {KOL_DATA.filter(k => k.pnlSol < -100).length} ruggers • live from kolscan.io
        </p>
      </div>

      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-72">
        <input
          type="text" placeholder="Search KOL name or wallet..."
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch(searchQuery)}
          className="w-full px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-white/80 text-xs placeholder:text-white/20 outline-none focus:border-white/30"
        />
        {searchResults.length > 0 && (
          <div className="mt-1 rounded-lg bg-black/90 border border-white/10 overflow-hidden">
            {searchResults.map(kol => (
              <button key={kol.wallet} onClick={() => { flyToKol(kol); setSearchQuery(""); }}
                className="w-full px-3 py-1.5 text-left text-xs text-white/70 hover:bg-white/10 flex justify-between">
                <span>{kol.name} {TYPE_EMOJI[getKolType(kol)]}</span>
                <span className={kol.pnlSol >= 0 ? "text-green-400" : "text-red-400"}>
                  {kol.pnlSol >= 0 ? "+" : ""}{kol.pnlSol.toFixed(1)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Weather / Time Toggle */}
      <div className="absolute top-14 left-4 z-10 flex gap-1 select-none">
        {TIME_PRESETS.map(p => (
          <button key={p.id} onClick={() => handleTimePreset(p.id, "time" in p ? p.time : undefined)}
            className={`px-2 py-1 rounded text-xs transition-colors ${activePreset === p.id ? "bg-white/20 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
            {p.label}
          </button>
        ))}
        <button onClick={() => setIsRaining(!isRaining)}
          className={`px-2 py-1 rounded text-xs transition-colors ${isRaining ? "bg-blue-500/30 text-blue-300" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
          🌧️
        </button>
        <button onClick={() => setSoundEnabled(!soundEnabled)}
          className={`px-2 py-1 rounded text-xs transition-colors ${soundEnabled ? "bg-white/20 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
          {soundEnabled ? "🔊" : "🔇"}
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-[5.5rem] left-4 z-10 flex gap-1.5 text-[8px] text-white/40 select-none">
        {(["whale", "diamond", "degen", "dumper", "rugger"] as KolType[]).map(t => (
          <span key={t} className="bg-white/5 px-1.5 py-0.5 rounded">{TYPE_EMOJI[t]} {TYPE_LABEL[t]}</span>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="absolute top-4 right-4 z-10 w-64 max-h-[calc(100vh-10rem)] overflow-y-auto rounded-lg bg-black/70 backdrop-blur-md border border-white/10">
        <div className="sticky top-0 bg-black/90 px-3 py-2 border-b border-white/10 z-20">
          <h2 className="text-xs font-semibold text-white/80">📊 Leaderboard</h2>
        </div>
        <div className="divide-y divide-white/5">
          {topKols.map(kol => {
            const type = getKolType(kol);
            const sel = selectedWallet?.address === kol.wallet;
            return (
              <button key={kol.wallet} onClick={() => flyToKol(kol)}
                className={`w-full px-2 py-1 flex items-center gap-1.5 text-left hover:bg-white/5 ${sel ? "bg-white/10" : ""}`}>
                <span className="text-[8px] text-white/20 w-4 text-right">#{kol.rank}</span>
                <img src={kol.pfp} alt="" className="w-4 h-4 rounded-full"
                  onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect fill='%23333' width='16' height='16' rx='8'/%3E%3C/svg%3E"; }} />
                <span className="text-[10px] text-white/60 truncate flex-1">{kol.name} {TYPE_EMOJI[type]}</span>
                <span className={`text-[10px] font-mono ${kol.pnlSol >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {kol.pnlSol >= 0 ? "+" : ""}{kol.pnlSol.toFixed(0)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected KOL Card */}
      {hoveredKol && (
        <div className="absolute bottom-4 left-4 z-10 w-72 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 p-3">
          <button onClick={handleDeselect} className="absolute top-2 right-2 text-white/30 hover:text-white/60 text-xs">✕</button>
          <div className="flex items-center gap-2 mb-2">
            <img src={hoveredKol.pfp} alt="" className="w-10 h-10 rounded-full"
              onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect fill='%23333' width='40' height='40' rx='20'/%3E%3C/svg%3E"; }} />
            <div>
              <h3 className="text-sm font-bold text-white">{hoveredKol.name}</h3>
              <p className="text-[10px] text-white/40">{TYPE_EMOJI[getKolType(hoveredKol)]} {TYPE_LABEL[getKolType(hoveredKol)]} • #{hoveredKol.rank}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
            <div className="bg-white/5 rounded px-1.5 py-1">
              <div className="text-white/30">PNL</div>
              <div className={`font-mono font-bold ${hoveredKol.pnlSol >= 0 ? "text-green-400" : "text-red-400"}`}>
                {hoveredKol.pnlSol >= 0 ? "+" : ""}{hoveredKol.pnlSol.toFixed(1)}
              </div>
            </div>
            <div className="bg-white/5 rounded px-1.5 py-1">
              <div className="text-white/30">Volume</div>
              <div className="text-white/60 font-mono">{hoveredKol.volume.toFixed(0)}</div>
            </div>
            <div className="bg-white/5 rounded px-1.5 py-1">
              <div className="text-white/30">Trades</div>
              <div className="text-white/60 font-mono">{hoveredKol.trades || "—"}</div>
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            <a href={`https://kolscan.io/account/${hoveredKol.wallet}`} target="_blank" rel="noopener"
              className="text-[9px] text-blue-400/60 hover:text-blue-400 font-mono truncate flex-1">{hoveredKol.wallet}</a>
            <button onClick={() => handleCopyWallet(hoveredKol.wallet)}
              className="text-[9px] text-white/30 hover:text-white/60 shrink-0">📋</button>
          </div>
        </div>
      )}

      {/* Mini-map */}
      <MiniMap wallets={wallets} selectedAddress={selectedWallet?.address} />

      {/* Ambient Sound */}
      <AmbientSound enabled={soundEnabled} />

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 80, 120], fov: 50, near: 1, far: 2000 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        <SceneLighting timeRef={timeRef} autoModeRef={autoModeRef} />
        <CityGrid wallets={wallets} timeRef={timeRef} onSelectWallet={handleSelectWallet} selectedAddress={selectedWallet?.address} />
        <InstancedCars swapQueueRef={swapQueueRef} wallets={wallets} timeRef={timeRef} />
        <FloatingLabels wallets={wallets} count={30} />
        <SpeechBubbles />
        <StreetSigns />
        <FloatingBillboard />
        <Rain active={isRaining} />
        <BuildingParticles wallets={wallets} />
        {selectedPosition && <SelectionBeam position={selectedPosition} buildingHeight={10} />}
        <OrbitControls makeDefault minDistance={10} maxDistance={500} maxPolarAngle={Math.PI / 2.1}
          enableDamping dampingFactor={0.05} panSpeed={1.5} screenSpacePanning={false} />
      </Canvas>
    </div>
  );
}
