import { BatchedMesh } from 'three';
import { patchBatchedMeshMaterial } from '../../patch/PatchBatchedMeshMaterial.webgpu.js';
import { SquareDataTexture } from '../SquareDataTexture.js';
import { getUniformSchemaResult, UniformSchemaShader } from './Uniforms.common.js';

export function initUniformsPerInstance(this: BatchedMesh, schema: UniformSchemaShader): void {
  if (this.uniformsTexture) throw new Error('"initUniformsPerInstance" must be called only once.');

  const { channels, pixelsPerInstance, uniformMap, fetchInFragmentShader } = getUniformSchemaResult(schema);
  this.uniformsTexture = new SquareDataTexture(Float32Array, channels, pixelsPerInstance, this.maxInstanceCount, uniformMap, fetchInFragmentShader);

  patchBatchedMeshMaterial(this);
}
