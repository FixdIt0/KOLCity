import * as THREE from "three";

function replaceInclude(source: string, name: string, replacement: string): string {
  const needle = `#include <${name}>`;
  const idx = source.indexOf(needle);
  if (idx < 0) return source;
  let start = idx;
  while (start > 0 && source[start - 1] !== "\n") start--;
  return source.substring(0, start) + replacement + "\n" + source.substring(idx + needle.length);
}

export function createBuildingMaterial(
  timeUniform: { value: number },
): THREE.ShaderMaterial {
  const std = THREE.ShaderLib.standard;
  let vertexShader = std.vertexShader;
  let fragmentShader = std.fragmentShader;

  vertexShader = replaceInclude(vertexShader, "common", /* glsl */ `
    attribute vec3 instanceBuildingColor;
    attribute float instanceWindowCols;
    attribute float instanceFillRatio;
    attribute float instanceLitRatio;
    attribute float instanceSeed;
    attribute float instanceFloors;
    attribute float instanceHighlight;
    varying vec3 vBuildingColor;
    varying float vWindowCols, vFillRatio, vLitRatio, vSeed, vFloors;
    varying float vHighlight;
    varying vec3 vModelNormal;
    varying vec2 vFaceUV;
    #include <common>
  `);

  vertexShader = replaceInclude(vertexShader, "begin_vertex", /* glsl */ `
    #include <begin_vertex>
    vBuildingColor = instanceBuildingColor;
    vHighlight = instanceHighlight;
    vWindowCols = instanceWindowCols;
    vFillRatio = instanceFillRatio;
    vLitRatio = instanceLitRatio;
    vSeed = instanceSeed;
    vFloors = instanceFloors;
    vModelNormal = normal;
    if (abs(normal.x) > 0.5) {
      vFaceUV = vec2(position.z + 0.5, position.y + 0.5);
    } else {
      vFaceUV = vec2(position.x + 0.5, position.y + 0.5);
    }
  `);

  fragmentShader = replaceInclude(fragmentShader, "common", /* glsl */ `
    uniform float uTime;
    varying vec3 vBuildingColor;
    varying float vWindowCols, vFillRatio, vLitRatio, vSeed, vFloors;
    varying float vHighlight;
    varying vec3 vModelNormal;
    varying vec2 vFaceUV;
    #include <common>
  `);

  fragmentShader = replaceInclude(fragmentShader, "emissivemap_fragment", /* glsl */ `
    #include <emissivemap_fragment>

    float timeNow = fract(uTime);

    // Night factor
    float nightFactor = 0.0;
    if (timeNow >= 0.50 && timeNow < 0.58) nightFactor = (timeNow - 0.50) / 0.08;
    else if (timeNow >= 0.58 && timeNow < 0.92) nightFactor = 1.0;
    else if (timeNow >= 0.92) nightFactor = 1.0 - (timeNow - 0.92) / 0.08;

    // Sunset tint
    float sunsetFactor = 0.0;
    if (timeNow >= 0.42 && timeNow < 0.50) sunsetFactor = (timeNow - 0.42) / 0.08;
    else if (timeNow >= 0.50 && timeNow < 0.58) sunsetFactor = 1.0 - (timeNow - 0.50) / 0.08;

    // Realistic building body — concrete/glass look
    vec3 baseColor = vBuildingColor;
    vec3 sunsetTint = mix(baseColor, baseColor * vec3(1.3, 0.9, 0.7), sunsetFactor * 0.5);
    float nightDim = mix(1.0, 0.55, nightFactor);

    // Height gradient — darker at base, lighter at top
    float heightGrad = smoothstep(-0.5, 0.5, vFaceUV.y) * 0.3 + 0.7;

    diffuseColor.rgb = sunsetTint * 0.35 * nightDim * heightGrad;
    totalEmissiveRadiance += sunsetTint * 0.65 * nightDim * heightGrad;

    // Ambient city glow on building faces at night
    totalEmissiveRadiance += vec3(0.02, 0.015, 0.04) * nightFactor;

    // Hover glow
    totalEmissiveRadiance += vec3(0.04, 0.04, 0.06) * vHighlight;

    // Neon window color — per-building variety
    vec3 neonColor;
    float neonType = fract(vSeed * 5.0);
    if (neonType < 0.3) neonColor = vec3(0.3, 0.7, 1.0);        // cool blue
    else if (neonType < 0.5) neonColor = vec3(1.0, 0.4, 0.6);    // warm pink
    else if (neonType < 0.65) neonColor = vec3(0.3, 1.0, 0.5);   // green
    else if (neonType < 0.8) neonColor = vec3(1.0, 0.6, 0.2);    // amber
    else neonColor = vec3(0.7, 0.8, 1.0);                         // white-blue

    float pulse = 0.9 + 0.1 * sin(uTime * 1.5 + vSeed * 15.0);

    // --- Windows on side faces ---
    if (abs(vModelNormal.y) < 0.5) {
      float faceId = 0.0;
      if (vModelNormal.x > 0.5) faceId = 1.0;
      else if (vModelNormal.x < -0.5) faceId = 2.0;
      else if (vModelNormal.z > 0.5) faceId = 3.0;

      float cols = vWindowCols;
      float rows = vFloors;

      if (cols > 0.5 && rows > 0.5) {
        float cellU = fract(vFaceUV.x * cols);
        float cellV = fract(vFaceUV.y * rows);
        bool inWindowSlot = cellU > 0.2 && cellU < 0.8 && cellV > 0.2 && cellV < 0.8;

        if (inWindowSlot) {
          float colIdx = floor(vFaceUV.x * cols);
          float rowIdx = floor(vFaceUV.y * rows);

          float h1 = fract(sin(colIdx * 127.1 + rowIdx * 311.7 + vSeed * 758.5 + faceId * 1731.3) * 43758.5453);
          bool hasWindow = h1 < vFillRatio;

          if (hasWindow) {
            float h2 = fract(sin(colIdx * 53.3 + rowIdx * 419.2 + vSeed * 317.9 + faceId * 2137.7) * 29187.3217);
            bool isLit = h2 < vLitRatio;

            if (isLit && nightFactor > 0.0) {
              // Lit window — neon colored glow at night
              totalEmissiveRadiance += neonColor * nightFactor * 2.5 * pulse;
            } else if (!isLit && nightFactor > 0.0) {
              // Dark window pane
              totalEmissiveRadiance *= 0.4;
              diffuseColor.rgb *= 0.3;
            } else {
              // Daytime window — slight glass reflection
              totalEmissiveRadiance *= 0.85;
              diffuseColor.rgb *= 0.75;
            }
          }
        }
      }

      // Subtle vertical edge darkening (architectural detail)
      float edgeDist = min(vFaceUV.x, 1.0 - vFaceUV.x);
      float edgeDark = smoothstep(0.0, 0.06, edgeDist);
      totalEmissiveRadiance *= mix(0.4, 1.0, edgeDark);
      diffuseColor.rgb *= mix(0.3, 1.0, edgeDark);

      // Horizontal floor lines — subtle concrete seams
      float floorLine = 1.0 - 0.15 * (1.0 - smoothstep(0.0, 0.03, fract(vFaceUV.y * vFloors)));
      totalEmissiveRadiance *= floorLine;
      diffuseColor.rgb *= floorLine;
    }

    // Rooftop accent glow — thin neon strip at top
    if (abs(vModelNormal.y) > 0.5 && vModelNormal.y > 0.0) {
      totalEmissiveRadiance += neonColor * 0.4 * nightFactor * pulse;
    }
  `);

  const uniforms = THREE.UniformsUtils.clone(std.uniforms);
  uniforms.uTime = timeUniform;
  uniforms.roughness.value = 0.55;
  uniforms.metalness.value = 0.25;

  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    lights: true, fog: true,
    defines: { STANDARD: "" },
  });
  (material as unknown as Record<string, boolean>).isMeshStandardMaterial = true;
  return material;
}
