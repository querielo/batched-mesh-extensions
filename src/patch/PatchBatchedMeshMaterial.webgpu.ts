import { BatchedMesh } from 'three';
import type { NodeMaterial } from 'three/webgpu';
import {
  uniform,
  int,
  ivec2,
  vec2,
  vec3,
  vec4,
  float,
  instanceIndex,
  drawIndex,
  textureLoad,
  positionLocal,
  varying
} from 'three/tsl';

function patchNodeMaterial(batchedMesh: BatchedMesh): void {
  const material = batchedMesh.material as NodeMaterial;

  const setupMaterial = material.setupPosition.bind(material);
  (material as any).setupPosition = (builder: any) => {
    const result = setupMaterial(builder);

    if ((batchedMesh as any).uniformsTexture) {
      const uTex = (batchedMesh as any).uniformsTexture;
      const map = uTex.uniformMap;

      const uSize = uniform(uTex.image.width, 'float');
      const uPPI = uniform(uTex.pixelsPerInstance, 'float');

      const hasIndirect = Boolean((batchedMesh as any)._indirectTexture);
      let idx: any;

      let drawId: any = null;
      if (drawId === null) {
        if (builder.getDrawIndex() === null) {
          drawId = instanceIndex;
        } else {
          drawId = drawIndex;
        }
      }

      if (hasIndirect) {
        const indTex: any = (batchedMesh as any)._indirectTexture;
        const bid = float(drawId);
        const iSize = uniform(indTex.image.width, 'float');
        const ix = bid.mod(iSize);
        const iy = bid.div(iSize).floor();
        idx = float(textureLoad(indTex, ivec2(int(ix), int(iy))).x);
      } else {
        idx = float(drawId);
      }

      const j = idx.mul(uPPI);
      const x = j.mod(uSize);
      const y = j.div(uSize).floor();

      const texels: any[] = [];
      for (let i = 0; i < uTex.pixelsPerInstance; i++) {
        texels.push(textureLoad(uTex, ivec2(int(x.add(float(i))), int(y))));
      }

      const pick = (offset: number, size: number): any => {
        const comps: any[] = [];
        const channels = uTex.channels;
        for (let k = 0; k < size; k++) {
          const absolute = offset + k;
          const tIdx = Math.floor(absolute / channels);
          const cIdx = absolute % channels;
          const t = texels[tIdx] ?? texels[texels.length - 1];
          comps.push(
            cIdx === 0 ? (t as any).r : cIdx === 1 ? (t as any).g : cIdx === 2 ? (t as any).b : (t as any).a
          );
        }
        if (size === 1) return comps[0];
        if (size === 2) return vec2(comps[0], comps[1]);
        if (size === 3) return vec3(comps[0], comps[1], comps[2]);
        // size >= 4
        return vec4(comps[0], comps[1], comps[2], comps[3]);
      };

      const setIf = (
        key: string,
        prop: string,
        size: number | null,
        toType: 'float' | 'vec2' | 'vec3' | 'vec4' | 'color' = 'float',
        fallback?: any
      ): void => {
        const entry = map.get(key);
        if (!entry) return;
        const node = pick(entry.offset, size ?? entry.size);
        let value = node;
        if (toType === 'vec4' && entry.size === 3) value = vec4(node.x, node.y, node.z, float(1));
        if (toType === 'vec3' && entry.size === 4) value = vec3(node.x, node.y, node.z);
        if (toType === 'color') {
          // treat color as vec3; accept vec4 by dropping alpha
          value
            = entry.size === 4
              ? vec3(node.x, node.y, node.z)
              : entry.size === 3
                ? node
                : vec3(node, node, node);
        }
        if (fallback && value === undefined) value = fallback;
        // Force computation in vertex stage and pass via varyings to fragment
        (material as any)[prop] = varying(value);
      };
      const getIf = (
        key: string,
        size: number | null,
        toType: 'float' | 'vec2' | 'vec3' | 'vec4' | 'color' = 'float',
        fallback?: any
      ): any => {
        const entry = map.get(key);
        if (!entry) return null;
        const node = pick(entry.offset, size ?? entry.size);
        let value = node;
        if (toType === 'vec4' && entry.size === 3) value = vec4(node.x, node.y, node.z, float(1));
        if (toType === 'vec3' && entry.size === 4) value = vec3(node.x, node.y, node.z);
        if (toType === 'color') {
          value
            = entry.size === 4
              ? vec3(node.x, node.y, node.z)
              : entry.size === 3
                ? node
                : vec3(node, node, node);
        }
        if (fallback && value === undefined) value = fallback;
        return value;
      };
      const assignCombined = (
        baseKey: string,
        mapKey: string,
        prop: string,
        baseSize: number | null,
        mapSize: number | null,
        toType: 'float' | 'vec2' | 'vec3' | 'vec4' | 'color'
      ): void => {
        const base = getIf(baseKey, baseSize, toType);
        const mapNode = getIf(mapKey, mapSize, toType);
        if (base && mapNode) {
          (material as any)[prop] = varying((base as any).mul(mapNode));
        } else if (base) {
          (material as any)[prop] = varying(base);
        } else if (mapNode) {
          (material as any)[prop] = varying(mapNode);
        }
      };
      const scaleNode = getIf('scale', 3, 'vec3');
      const positionOffsetNode = getIf('positionOffset', 3, 'vec3');
      const dispBase = getIf('displacement', 1, 'float');
      const dispScale = getIf('displacementScale', 1, 'float');
      const dispBias = getIf('displacementBias', 1, 'float');
      if (scaleNode || positionOffsetNode) {
        let pos = positionLocal as any;
        if (scaleNode) pos = pos.mul(scaleNode);
        if (positionOffsetNode) pos = pos.add(positionOffsetNode);
        (material as any).positionNode = pos;
      }
      if (dispBase || dispScale || dispBias) {
        let d = dispBase ?? float(1);
        if (dispScale) d = d.mul(dispScale);
        if (dispBias) d = d.add(dispBias);
        (material as any).displacementNode = d;
      }
      assignCombined('diffuse', 'color', 'colorNode', 3, null, 'vec4');
      const opacityBase = getIf('opacity', 1, 'float');
      const alphaMapNode = getIf('alphaMap', 1, 'float');
      if (opacityBase && alphaMapNode) {
        (material as any).opacityNode = varying(opacityBase.mul(alphaMapNode));
      } else if (opacityBase) {
        (material as any).opacityNode = varying(opacityBase);
      }
      setIf('alphaTest', 'alphaTestNode', 1, 'float');
      setIf('depth', 'depthNode', 1, 'float');
      setIf('emissiveIntensity', 'emissiveIntensityNode', 1, 'float');
      setIf('lightMapIntensity', 'lightMapIntensityNode', 1, 'float');
      setIf('envMapIntensity', 'envMapIntensityNode', 1, 'float');
      setIf('envMapRotation', 'envMapRotationNode', 3, 'vec3');
      assignCombined('roughness', 'roughnessMap', 'roughnessNode', 1, 1, 'float');
      assignCombined('metalness', 'metalnessMap', 'metalnessNode', 1, 1, 'float');
      assignCombined('emissive', 'emissiveMap', 'emissiveNode', null, 3, 'color');
      setIf('clearcoat', 'clearcoatNode', 1, 'float');
      setIf('clearcoatRoughness', 'clearcoatRoughnessNode', 1, 'float');
      setIf('clearcoatNormal', 'clearcoatNormalNode', 3, 'vec3');
      setIf('sheen', 'sheenNode', null, 'color');
      setIf('ior', 'iorNode', 1, 'float');
      setIf('transmission', 'transmissionNode', null, 'color');
      setIf('thickness', 'thicknessNode', 1, 'float');
      setIf('attenuationDistance', 'attenuationDistanceNode', 1, 'float');
      setIf('attenuationColor', 'attenuationColorNode', null, 'color');
      setIf('anisotropy', 'anisotropyNode', 2, 'vec2');
      setIf('iridescence', 'iridescenceNode', 1, 'float');
      setIf('iridescenceIOR', 'iridescenceIORNode', 1, 'float');
      setIf('iridescenceThickness', 'iridescenceThicknessNode', 1, 'float');
      setIf('shininess', 'shininessNode', 1, 'float');
      setIf('specular', 'specularNode', null, 'color');
      setIf('specularIntensity', 'specularIntensityNode', 1, 'float');
      setIf('specularColor', 'specularColorNode', null, 'color');
      setIf('normal', 'normalNode', 3, 'vec3');
      setIf('normalScale', 'normalScaleNode', 2, 'vec2');
      setIf('bumpScale', 'bumpScaleNode', 1, 'float');
      assignCombined('ao', 'aoMap', 'aoNode', 1, 1, 'float');
    }
    return result;
  };

  (material as any).needsUpdate = true;
}

export function patchBatchedMeshMaterial(batchedMesh: BatchedMesh): void {
  const material = batchedMesh.material as any;
  if ((material as NodeMaterial).isNodeMaterial) {
    patchNodeMaterial(batchedMesh);
  }
}
