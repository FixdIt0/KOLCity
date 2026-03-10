"use client";

import { useRef, useEffect } from "react";
import { PlacedWallet } from "@/types/wallet";
import { KOL_DATA } from "@/data/kols";

export interface SwapEvent {
  walletAddress: string;
  signature: string;
  tokenIn: string | null;
  tokenOut: string | null;
  amountSol: number | null;
}

const MAX_QUEUE = 60;

/** Generate fake swap events from KOL wallets to drive car traffic */
export function useSwapEvents(wallets: PlacedWallet[]): React.MutableRefObject<SwapEvent[]> {
  const queueRef = useRef<SwapEvent[]>([]);

  useEffect(() => {
    if (wallets.length === 0) return;
    const activeKols = KOL_DATA.filter(k => k.trades > 0 || k.pnlSol !== 0).slice(0, 100);
    if (activeKols.length === 0) return;

    const interval = setInterval(() => {
      const kol = activeKols[Math.floor(Math.random() * activeKols.length)];
      const isBuy = Math.random() > 0.4;
      queueRef.current.push({
        walletAddress: kol.wallet,
        signature: `fake_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        tokenIn: isBuy ? "SOL" : "MEME",
        tokenOut: isBuy ? "MEME" : "SOL",
        amountSol: Math.random() * 10,
      });
      if (queueRef.current.length > MAX_QUEUE) queueRef.current.splice(0, queueRef.current.length - MAX_QUEUE);
    }, 800 + Math.random() * 1200);

    return () => clearInterval(interval);
  }, [wallets]);

  return queueRef;
}
