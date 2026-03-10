"use client";
import { MeshReflectorMaterial } from "@react-three/drei";

export default function Ground({ size }: { size: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <MeshReflectorMaterial
        mirror={0}
        blur={[300, 100]}
        resolution={1024}
        mixBlur={1}
        mixStrength={0.6}
        roughness={1}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#12121e"
        metalness={0.5}
      />
    </mesh>
  );
}
