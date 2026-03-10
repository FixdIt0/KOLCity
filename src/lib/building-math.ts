import { WalletBuilding, PlacedWallet } from "@/types/wallet";
import { CELL_SIZE, ROAD_WIDTH, BLOCK_SIZE, BLOCK_STRIDE, BLOCKS_PER_ROW, GRID_WORLD } from "./city-constants";
import { SkyscraperType } from "./skyscraper-types";
import { getBlockZone } from "./city-zoning";

const FLOOR_HEIGHT = 0.3;

export function floors(txns: number): number {
  txns = Math.max(10, Math.min(txns, 500_000));
  const x = (Math.log10(txns) - 1) / (Math.log10(500_000) - 1);
  return Math.round(1 + x * x * 149);
}

const WIDTH_MIN = 0.6, WIDTH_MAX = 3.0;

function buildingWidth(volume: number, maxVolume: number): number {
  if (maxVolume <= 0) return WIDTH_MIN;
  const x = Math.log10(volume + 1) / Math.log10(maxVolume + 1);
  const t = Math.sqrt(x);
  return WIDTH_MIN + t * (WIDTH_MAX - WIDTH_MIN);
}

let cachedMaxVolume = 0;

export function setMaxVolume(wallets: WalletBuilding[]) {
  cachedMaxVolume = 0;
  for (const w of wallets) if (w.volumeTraded > cachedMaxVolume) cachedMaxVolume = w.volumeTraded;
}

export function getBuildingDimensions(wallet: WalletBuilding) {
  const height = floors(wallet.txnCount) * FLOOR_HEIGHT;
  const width = buildingWidth(wallet.volumeTraded, cachedMaxVolume);
  return { height, width, depth: width };
}

export function getWalletWorldPosition(
  w: PlacedWallet, dims: { width: number; depth: number; height: number },
): [number, number, number] {
  const offset = -GRID_WORLD / 2 + BLOCK_SIZE / 2 + ROAD_WIDTH / 2;
  const bx = offset + w.blockCol * BLOCK_STRIDE - BLOCK_SIZE / 2;
  const bz = offset + w.blockRow * BLOCK_STRIDE - BLOCK_SIZE / 2;
  const lr = Math.floor(w.localSlot / 4), lc = w.localSlot % 4;
  return [bx + lc * CELL_SIZE + dims.width / 2 + 0.5, dims.height / 2, bz + lr * CELL_SIZE + dims.depth / 2 + 0.5];
}

export function getWindowCols(w: number): number { return Math.max(2, Math.min(7, Math.round(w * 2.5))); }

export function getWindowFillRatio(u: number): number {
  return u <= 0 ? 0 : Math.max(0.02, Math.min(1.0, u / (u + 500)));
}

export function getLitRatio(t: number | null | undefined): number {
  if (t == null) return 0.05;
  const age = (Date.now() / 1000 - t) / 86400;
  return Math.min(0.45, Math.max(0.05, 0.45 * Math.exp(-age / 14)));
}

export function getInstanceSeed(address: string): number {
  let h = 0;
  for (let i = 0; i < address.length; i++) h = (h * 31 + address.charCodeAt(i)) | 0;
  return Math.abs(h % 10007) / 10007;
}

export function getWindowRows(f: number): number { return Math.min(f, 35); }

export function getSkyscraperType(wallet: PlacedWallet): SkyscraperType {
  const zone = getBlockZone(wallet.blockRow, wallet.blockCol, BLOCKS_PER_ROW);
  if (zone.zone !== "downtown") return "box";
  const s = getInstanceSeed(wallet.address);
  if (s < 0.40) return "box";
  if (s < 0.55) return "setback";
  if (s < 0.70) return "twin";
  if (s < 0.85) return "cantilever";
  return "spire";
}

// Realistic urban building colors — concrete, glass, steel
// KOL type only affects window glow (in shader), not the body
const COLOR_HEIGHT_MAX = 150 * FLOOR_HEIGHT;

export function getBuildingColor(height: number, kolType?: string | null): string {
  const t = Math.min(1, height / COLOR_HEIGHT_MAX);
  // Short = warm concrete, tall = cool glass/steel
  const r = Math.floor(95 - t * 30);
  const g = Math.floor(92 - t * 25);
  const b = Math.floor(100 - t * 10);
  return `rgb(${r},${g},${b})`;
}
