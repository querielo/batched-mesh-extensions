import { BatchedMesh, BufferGeometry, TypedArray } from 'three';

// TODO: add optional distance and first load function like InstancedMesh2
// TODO: improve and fix comments
// TODO: should we use an internal different metood instead of adding a flag in getLODIndex?
// TODO: if we use distance for LOD, should we update the LOD0 metric infinity to 0

export type LODInfo = { start: number; count: number; metric: number; metricSquared: number };

declare module 'three' {
  interface BatchedMesh {
    /**
     * If `true`, LOD uses camera distance; otherwise it uses screen size.
     * @default undefined
     */
    useDistanceForLOD?: boolean;
    /**
     * Adds a Level of Detail (LOD) geometry to the BatchedMesh.
     * @param geometryId The ID of the geometry to which the LOD is being added.
     * @param geometryOrIndex The BufferGeometry to be added as LOD or the index array.
     * @param metric The screen-space metric (e.g., fraction of screen height) at which this LOD should be used.
     */
    addGeometryLOD(geometryId: number, geometryOrIndex: BufferGeometry | TypedArray, metric: number): void;
    /**
     * Retrieves the LOD index for a given screen-space metric.
     * @param LOD The array of LOD information.
     * @param metric The calculated screen-space metric for the object.
     * @param useDistSquared Whether to use the squared distance for LOD calculations.
     * @returns The index of the appropriate LOD
     */
    getLODIndex(LOD: LODInfo[], metric: number, useDistSquared?: boolean): number;
  }
}

export function addGeometryLOD(this: BatchedMesh, geometryId: number, geoOrIndex: BufferGeometry | TypedArray, metric: number): void {
  const geometryInfo = this._geometryInfo[geometryId];
  const srcIndexArray = (geoOrIndex as BufferGeometry).isBufferGeometry ? (geoOrIndex as BufferGeometry).index.array : geoOrIndex as TypedArray;
  const metricSquared = metric ** 2;

  geometryInfo.LOD ??= [{ start: geometryInfo.start, count: geometryInfo.count, metric: Infinity, metricSquared: Infinity }];

  const LOD = geometryInfo.LOD;
  const lastLOD = LOD[LOD.length - 1];
  const start = lastLOD.start + lastLOD.count;
  const count = srcIndexArray.length;

  if ((start - geometryInfo.start) + count > geometryInfo.reservedIndexCount) {
    throw new Error('BatchedMesh LOD: Reserved space request exceeds the maximum buffer size.');
  }

  LOD.push({ start, count, metric, metricSquared });

  const dstIndex = this.geometry.getIndex();
  const dstIndexArray = dstIndex.array;
  const vertexStart = geometryInfo.vertexStart;

  for (let i = 0; i < count; i++) {
    dstIndexArray[start + i] = srcIndexArray[i] + vertexStart;
  }

  dstIndex.needsUpdate = true;
}

export function getLODIndex(this: BatchedMesh, LODs: LODInfo[], metric: number, useDistSquared = false): number {
  const metricKey: keyof LODInfo = useDistSquared ? 'metricSquared' : 'metric';

  if (this.useDistanceForLOD) {
    for (let i = LODs.length - 1; i > 0; i--) {
      const level = LODs[i];
      const distance = level[metricKey];
      if (metric >= distance) return i;
    }

    return 0;
  }

  for (let i = LODs.length - 1; i > 0; i--) {
    const level = LODs[i];
    const screenSize = level[metricKey];
    if (metric <= screenSize) return i;
  }

  return 0;
}
