// ✅ 完整版：Three.js SU7 模型展示 + 操作控制 + 道路边缘墙 + 碰撞检测

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const baseUrl = import.meta.env.BASE_URL;
const rgbeLoader = new RGBELoader();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

rgbeLoader.load(
  `${baseUrl}textures/sky.hdr`,
  (hdrTexture) => {
    const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
    scene.environment = envMap;
    scene.background = envMap;
    hdrTexture.dispose();
    pmremGenerator.dispose();
  },
  undefined,
  (error) => console.warn('加载 sky.hdr 失败:', error)
);

const textureLoader = new THREE.TextureLoader();
const asphaltDiffuse = textureLoader.load(`${baseUrl}textures/brick_pavement_02_diff_1k.jpg`, undefined, undefined, e => console.warn('加载 c.jpg 失败:', e));
const asphaltNormal = textureLoader.load(`${baseUrl}textures/brick_pavement_02_disp_1k.jpg`, undefined, undefined, e => console.warn('加载 a.jpg 失败:', e));
asphaltDiffuse.wrapS = asphaltDiffuse.wrapT = THREE.RepeatWrapping;
asphaltNormal.wrapS = asphaltNormal.wrapT = THREE.RepeatWrapping;
asphaltDiffuse.repeat.set(20, 20);
asphaltNormal.repeat.set(20, 20);

const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.MeshStandardMaterial({ map: asphaltDiffuse, normalMap: asphaltNormal, metalness: 0.2, roughness: 0.8 })
);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
scene.add(directionalLight);

const obstacles = [];

// 加载贴图
const wallDiffuse = textureLoader.load(
  `${baseUrl}textures/concrete_pavement_diff_1k.jpg`,
  undefined,
  undefined,
  (error) => console.warn('加载 wall diffuse 失败:', error)
);

const wallDisplace = textureLoader.load(
  `${baseUrl}textures/concrete_pavement_disp_1k.png`,
  undefined,
  undefined,
  (error) => console.warn('加载 wall displacement 失败:', error)
);

// 设置贴图平铺
wallDiffuse.wrapS = wallDiffuse.wrapT = THREE.RepeatWrapping;
wallDisplace.wrapS = wallDisplace.wrapT = THREE.RepeatWrapping;
wallDiffuse.repeat.set(2, 1);
wallDisplace.repeat.set(2, 1);

// 创建墙体材质
const wallMaterial = new THREE.MeshStandardMaterial({
  map: wallDiffuse,
  displacementMap: wallDisplace,
  displacementScale: 0.15,
  metalness: 0.2,
  roughness: 0.8,
});

// 创建墙体函数
function createWall (x, y, z, w, h, d) {
  const geometry = new THREE.BoxGeometry(w, h, d, 64, 64, 1); // 加细分显示凹凸
  const wall = new THREE.Mesh(geometry, wallMaterial);
  wall.position.set(x, y, z);
  wall.castShadow = wall.receiveShadow = true;
  scene.add(wall);

  const box = new THREE.Box3().setFromObject(wall);
  obstacles.push(box);
}

// 添加四面墙
const wallH = 2;
const wallT = 1;
const size = 50;

const halfSize = size / 2;
const halfT = wallT / 2;

// 前后墙（沿 X 轴摆放）
createWall(0, wallH / 2, -halfSize - halfT, size + wallT, wallH, wallT); // 前
createWall(0, wallH / 2, halfSize + halfT, size + wallT, wallH, wallT); // 后

// 左右墙（沿 Z 轴摆放）
createWall(-halfSize - halfT, wallH / 2, 0, wallT, wallH, size + wallT); // 左
createWall(halfSize + halfT, wallH / 2, 0, wallT, wallH, size + wallT); // 右



const helpPanel = document.createElement('div');
helpPanel.style.position = 'absolute';
helpPanel.style.top = '20px';
helpPanel.style.right = '20px';
helpPanel.style.background = 'rgba(0,0,0,0.6)';
helpPanel.style.color = '#fff';
helpPanel.style.padding = '10px 15px';
helpPanel.style.borderRadius = '8px';
helpPanel.style.fontSize = '14px';
helpPanel.style.maxWidth = '220px';
helpPanel.style.transition = 'opacity 0.3s';
helpPanel.innerHTML = `
  <b>🕹 操作说明</b><br/>
  - W/S：前进/后退<br/>
  - A/D：左转/右转<br/>
  - Q/E：车体前倾/后仰<br/>
  - Shift：加速<br/>
  - Space：跳跃<br/>
  <br/>
  <button id="toggleHelp" style="
    margin-top: 5px;
    background: #444;
    color: #fff;
    border: none;
    padding: 4px 8px;
    cursor: pointer;
    border-radius: 4px;
  ">隐藏说明</button>
`;
document.body.appendChild(helpPanel);
const toggleBtn = document.getElementById('toggleHelp');
let helpVisible = true;
toggleBtn.addEventListener('click', () => {
  helpVisible = !helpVisible;

  if (helpVisible) {
    helpPanel.style.opacity = '1';
    helpPanel.style.pointerEvents = 'auto';
    toggleBtn.innerText = '隐藏说明';
    toggleBtn.style.display = 'inline-block';
  } else {
    helpPanel.style.opacity = '0';
    helpPanel.style.pointerEvents = 'none';
    toggleBtn.style.display = 'none'; // 隐藏按钮本身

    // 显示“显示说明”浮动按钮
    showHintBtn.style.display = 'block';
  }
});

// 显示说明按钮
const showHintBtn = document.createElement('button');
showHintBtn.innerText = '显示说明';
showHintBtn.style.position = 'absolute';
showHintBtn.style.top = '20px';
showHintBtn.style.right = '20px';
showHintBtn.style.background = '#222';
showHintBtn.style.color = '#fff';
showHintBtn.style.border = 'none';
showHintBtn.style.padding = '6px 12px';
showHintBtn.style.borderRadius = '6px';
showHintBtn.style.cursor = 'pointer';
showHintBtn.style.zIndex = '1000';
showHintBtn.style.display = 'none'; // 初始隐藏
document.body.appendChild(showHintBtn);

// 点击显示说明按钮
showHintBtn.addEventListener('click', () => {
  helpVisible = true;
  helpPanel.style.opacity = '1';
  helpPanel.style.pointerEvents = 'auto';
  toggleBtn.innerText = '隐藏说明';
  toggleBtn.style.display = 'inline-block';
  showHintBtn.style.display = 'none';
});


toggleBtn.onclick = () => {
  helpVisible = false;
  helpPanel.style.opacity = '0';
  helpPanel.style.pointerEvents = 'none';
  toggleBtn.style.display = 'none';
  showHintBtn.style.display = 'block';
};
showHintBtn.onclick = () => {
  helpVisible = true;
  helpPanel.style.opacity = '1';
  helpPanel.style.pointerEvents = 'auto';
  toggleBtn.style.display = 'inline-block';
  showHintBtn.style.display = 'none';
};

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const loader = new GLTFLoader();
let carModel = null;
loader.load('./models/su7-xiaomini.glb', gltf => {
  carModel = gltf.scene;
  carModel.position.set(0, 0, 0);
  carModel.castShadow = true;
  scene.add(carModel);
  loadingText.style.display = 'none';
}, undefined, e => console.error(e));

const loadingText = document.createElement('div');
loadingText.innerText = '🚗 加载中...';
Object.assign(loadingText.style, { position: 'absolute', top: '20px', left: '20px', color: '#fff' });
document.body.appendChild(loadingText);

const keys = { KeyW: false, KeyS: false, KeyA: false, KeyD: false, KeyQ: false, KeyE: false, Space: false, ShiftLeft: false, ShiftRight: false };
window.addEventListener('keydown', e => {
  if (e.code in keys) keys[e.code] = true;
  if (e.code === 'KeyR' && carModel) {
    carModel.position.set(0, 0, 0);
    carModel.rotation.set(0, 0, 0);
    isJumping = false;
  }
});
window.addEventListener('keyup', e => { if (e.code in keys) keys[e.code] = false });

let isJumping = false, jumpStartTime = 0;
const jumpDuration = 600, jumpHeight = 1.2;
const speed = 0.1, runMultiplier = 5, rotationSpeed = 0.03;
const carBox = new THREE.Box3();

function checkCollision (newPos) {
  if (!carModel) return false;
  carBox.setFromObject(carModel);
  carBox.translate(newPos.clone().sub(carModel.position));
  return obstacles.some(ob => carBox.intersectsBox(ob));
}

function animate (time = 0) {
  requestAnimationFrame(animate);
  if (carModel) {
    if (isJumping) {
      const t = time - jumpStartTime;
      if (t < jumpDuration) {
        const p = t / jumpDuration;
        carModel.position.y = Math.sin(p * Math.PI) * jumpHeight;
      } else {
        carModel.position.y = 0;
        isJumping = false;
      }
    } else if (keys.Space && !isJumping) {
      isJumping = true;
      jumpStartTime = time;
    }

    const run = keys.ShiftLeft || keys.ShiftRight;
    const curSpeed = speed * (run ? runMultiplier : 1);
    const moveF = keys.KeyW ? curSpeed : 0;
    const moveB = keys.KeyS ? curSpeed : 0;
    const rotL = keys.KeyA ? rotationSpeed : 0;
    const rotR = keys.KeyD ? rotationSpeed : 0;
    const tiltQ = keys.KeyQ ? rotationSpeed : 0;
    const tiltE = keys.KeyE ? rotationSpeed : 0;
    carModel.rotation.z += tiltQ - tiltE;
    carModel.rotation.y += rotL - rotR;

    const forward = new THREE.Vector3(1, 0, 0).applyEuler(carModel.rotation);
    const delta = moveF - moveB;
    const newPos = carModel.position.clone().add(forward.multiplyScalar(delta));
    if (!checkCollision(newPos)) carModel.position.copy(newPos);
  }
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
