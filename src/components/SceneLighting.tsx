"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars, Sky } from "@react-three/drei";
import * as THREE from "three";
import { getDayNightState, CYCLE_DURATION } from "@/lib/day-night";

interface SceneLightingProps {
  timeRef: React.MutableRefObject<number>;
  autoModeRef: React.MutableRefObject<boolean>;
}

export default function SceneLighting({ timeRef, autoModeRef }: SceneLightingProps) {
  const { scene } = useThree();
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const accentRef = useRef<THREE.PointLight>(null);
  const starsGroupRef = useRef<THREE.Group>(null);
  const skyRef = useRef<any>(null);

  useEffect(() => {
    scene.fog = new THREE.Fog("#0a0a18", 300, 800);
  }, [scene]);

  useFrame((_, delta) => {
    if (autoModeRef.current) {
      timeRef.current = (timeRef.current + delta / CYCLE_DURATION) % 1;
    }

    const t = timeRef.current;
    const state = getDayNightState(t);

    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(state.fogColor);
      scene.fog.near = state.fogNear;
      scene.fog.far = state.fogFar;
    }

    if (ambientRef.current) { ambientRef.current.color.copy(state.ambientColor); ambientRef.current.intensity = state.ambientIntensity; }
    if (sunRef.current) { sunRef.current.color.copy(state.sunColor); sunRef.current.intensity = state.sunIntensity; sunRef.current.position.copy(state.sunPosition); }
    if (hemiRef.current) { hemiRef.current.color.copy(state.hemiSkyColor); hemiRef.current.groundColor.copy(state.hemiGroundColor); hemiRef.current.intensity = state.hemiIntensity; }
    if (accentRef.current) { accentRef.current.color.copy(state.accentColor); accentRef.current.intensity = state.accentIntensity; }

    // Sky sun — unclamped so it goes below horizon at night
    const sunAngle = t * Math.PI * 2;
    const skySunY = Math.sin(sunAngle) * 200; // negative at night = dark sky
    const skySunX = Math.cos(sunAngle) * 200;
    if (skyRef.current?.material?.uniforms?.sunPosition) {
      skyRef.current.material.uniforms.sunPosition.value.set(skySunX, skySunY, 20);
    }

    // Stars fade
    if (starsGroupRef.current) {
      starsGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Points) {
          const mat = child.material as THREE.PointsMaterial;
          mat.transparent = true;
          mat.opacity = state.starsOpacity;
        }
      });
    }
  });

  return (
    <>
      <Sky ref={skyRef} distance={450000} sunPosition={[0, -200, 20]}
        turbidity={2} rayleigh={0.5} mieCoefficient={0.0005} mieDirectionalG={0.3} />
      <ambientLight ref={ambientRef} intensity={0.15} />
      <directionalLight ref={sunRef} position={[50, 0, 20]} intensity={0} />
      <hemisphereLight ref={hemiRef} args={["#111122", "#0a0a0a", 0.05]} />
      <pointLight ref={accentRef} position={[-20, 30, -20]} intensity={1.2} color="#6366f1" />
      <pointLight position={[30, 25, 30]} intensity={0.8} color="#f43f5e" />
      <group ref={starsGroupRef}>
        <Stars radius={400} depth={200} count={3000} factor={4} fade speed={1} />
      </group>
    </>
  );
}
