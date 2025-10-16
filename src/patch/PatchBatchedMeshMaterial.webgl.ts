import { BatchedMesh } from 'three';

export function patchBatchedMeshMaterial(batchedMesh: BatchedMesh): void {
  const material: any = batchedMesh.material;

  const onBeforeCompileBase = material.onBeforeCompile.bind(material);

  material.onBeforeCompile = (shader: any, renderer: any) => {
    if ((batchedMesh as any).uniformsTexture) {
      shader.uniforms.uniformsTexture = { value: (batchedMesh as any).uniformsTexture };
      const { vertex, fragment } = (batchedMesh as any).uniformsTexture.getUniformsGLSL(
        'uniformsTexture',
        'batchIndex',
        'float'
      );
      shader.vertexShader = shader.vertexShader.replace('void main() {', vertex);
      shader.fragmentShader = shader.fragmentShader.replace('void main() {', fragment);

      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        'void main() { float batchIndex = getIndirectIndex( gl_DrawID );'
      );
    }

    onBeforeCompileBase(shader, renderer);
  };
}
