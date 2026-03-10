"use client";
import { useRef, useEffect } from "react";

export default function AmbientSound({ enabled }: { enabled: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      const a = new Audio("/bgm.mp3");
      a.loop = true;
      a.volume = 0.4;
      audioRef.current = a;
    }
    const a = audioRef.current;
    if (enabled) {
      const tryPlay = () => a.play().catch(() => {});
      tryPlay();
      // Browsers block autoplay — retry on first user interaction
      const unlock = () => { tryPlay(); document.removeEventListener("click", unlock); document.removeEventListener("keydown", unlock); };
      document.addEventListener("click", unlock, { once: true });
      document.addEventListener("keydown", unlock, { once: true });
    } else {
      a.pause();
    }
    return () => { audioRef.current?.pause(); };
  }, [enabled]);

  return null;
}
