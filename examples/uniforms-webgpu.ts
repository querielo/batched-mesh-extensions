import { extendBatchedMeshPrototype, getBatchedMeshCount } from '@three.ez/batched-mesh-extensions';
import { BatchedMesh, BoxGeometry, Color, CylinderGeometry, DirectionalLight, Matrix4, PerspectiveCamera, Scene, SphereGeometry, SRGBColorSpace, AmbientLight } from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { WebGPURenderer, MeshStandardNodeMaterial } from 'three/webgpu';

extendBatchedMeshPrototype();

const scene = new Scene();
scene.background = new Color(0x202020);
const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 12);
camera.lookAt(0, 0, 0);

const renderer = new WebGPURenderer({ antialias: true });
renderer.outputColorSpace = SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const apiLabel = document.createElement('div');
apiLabel.style.position = 'fixed';
apiLabel.style.top = '8px';
apiLabel.style.right = '8px';
apiLabel.style.zIndex = '1000';
apiLabel.style.padding = '4px 8px';
apiLabel.style.borderRadius = '4px';
apiLabel.style.background = 'rgba(0,0,0,0.5)';
apiLabel.style.color = '#fff';
apiLabel.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial';
apiLabel.style.fontSize = '12px';
apiLabel.style.pointerEvents = 'none';
apiLabel.textContent = (renderer.backend as any).isWebGLBackend ? 'WebGL 2' : 'WebGPU';
document.body.appendChild(apiLabel);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.update();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const dirLight = new DirectionalLight(0xffffff, 2.0);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);
scene.add(new AmbientLight(0xffffff, 0.2));

const sphere = new SphereGeometry(0.75, 24, 16);
const box = new BoxGeometry(1, 1, 1);
const cyl = new CylinderGeometry(0.6, 0.6, 1.2, 24);
const material = new MeshStandardNodeMaterial({ transparent: true, depthWrite: false });

const gridX = 8;
const gridY = 8;
const capacity = gridX * gridY;
const { vertexCount, indexCount } = getBatchedMeshCount([sphere, box, cyl]);
const batchedMesh = new BatchedMesh(capacity, vertexCount, indexCount, material);
scene.add(batchedMesh);

const sphereGeometryId = batchedMesh.addGeometry(sphere);
const boxGeometryId = batchedMesh.addGeometry(box);
const cylGeometryId = batchedMesh.addGeometry(cyl);

const spacing = 2.0;
const offsetX = -((gridX - 1) * spacing) / 2;
const offsetY = -((gridY - 1) * spacing) / 2;
let instanceIndex = 0;
for (let y = 0; y < gridY; y++) {
  for (let x = 0; x < gridX; x++) {
    const which = (x + y) % 3;
    const gId = which === 0 ? sphereGeometryId : which === 1 ? boxGeometryId : cylGeometryId;
    const id = batchedMesh.addInstance(gId);
    const px = offsetX + x * spacing;
    const py = offsetY + y * spacing;
    batchedMesh.setMatrixAt(id, new Matrix4().makeTranslation(px, py, 0));
    instanceIndex++;
  }
}

(batchedMesh as any).initUniformsPerInstance({
  fragment: {
    color: 'vec3',
    metalness: 'float',
    roughness: 'float',
    opacity: 'float'
  }
});

let idx = 0;
for (let y = 0; y < gridY; y++) {
  for (let x = 0; x < gridX; x++) {
    const u = x / (gridX - 1);
    const v = y / (gridY - 1);

    const color = new Color().setHSL(u, 0.6, 0.5);
    const metalness = u;
    const roughness = 1.0 - v;
    const opacity = 0.35 + 0.65 * ((u + v) / 2);

    (batchedMesh as any).setUniformAt(idx, 'color', color);
    (batchedMesh as any).setUniformAt(idx, 'metalness', metalness);
    (batchedMesh as any).setUniformAt(idx, 'roughness', roughness);
    (batchedMesh as any).setUniformAt(idx, 'opacity', opacity);
    idx++;
  }
}

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
