"use client";

import { useEffect, useRef } from "react";

export default function AmbientSound({ enabled }: { enabled: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      audioRef.current?.pause();
      return;
    }
    // Use a simple oscillator-based ambient drone since we don't have audio files
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0.03;
    gain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 80;
    osc1.connect(gain);
    osc1.start();

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 120;
    const gain2 = ctx.createGain();
    gain2.gain.value = 0.015;
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start();

    return () => {
      osc1.stop(); osc2.stop(); ctx.close();
    };
  }, [enabled]);

  return null;
}
