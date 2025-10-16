import { extendBatchedMeshPrototype as extendBatchedMeshPrototypeWebGL } from './ExtendBatchedMeshPrototype.webgl.js';

/**
 * Enhances the BatchedMesh prototype with additional methods.
 */
export function extendBatchedMeshPrototype(): void {
  extendBatchedMeshPrototypeWebGL();
}
