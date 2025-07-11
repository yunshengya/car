import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// 相机设置
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 8);

// 渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 天空设置
const baseUrl = import.meta.env.BASE_URL; // Vite 自动处理
const rgbeLoader = new RGBELoader();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
rgbeLoader.load(
  `${baseUrl}textures/sky.hdr`,
  (hdrTexture) => {
    const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;

    scene.environment = envMap; // 用于反射和 PBR
    scene.background = envMap; // 可选：用作背景

    hdrTexture.dispose();
    pmremGenerator.dispose();
  },
  undefined,
  (error) => {
    console.warn('加载 sky.hdr 失败:', error);
    // 这里可以继续执行，比如使用默认背景或不设置
  }
);

// 地面贴图也加上错误处理
const textureLoader = new THREE.TextureLoader();

const asphaltDiffuse = textureLoader.load(
  `${baseUrl}textures/c.jpg`,
  undefined,
  undefined,
  (error) => {
    console.warn('加载 c.jpg 失败:', error);
    // 这里可以设置一个默认贴图，或什么都不做
  }
);
const asphaltNormal = textureLoader.load(
  `${baseUrl}textures/a.jpg`,
  undefined,
  undefined,
  (error) => {
    console.warn('加载 a.jpg 失败:', error);
  }
);


// 让贴图重复平铺，避免拉伸
asphaltDiffuse.wrapS = asphaltDiffuse.wrapT = THREE.RepeatWrapping;
asphaltNormal.wrapS = asphaltNormal.wrapT = THREE.RepeatWrapping;
asphaltDiffuse.repeat.set(20, 20);
asphaltNormal.repeat.set(20, 20);

const planeGeometry = new THREE.PlaneGeometry(50, 50);
const planeMaterial = new THREE.MeshStandardMaterial({
  map: asphaltDiffuse,
  normalMap: asphaltNormal,
  metalness: 0.2,
  roughness: 0.8,
});
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

// 光照
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
scene.add(directionalLight);

// 操作说明
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
  helpPanel.style.opacity = helpVisible ? '1' : '0';
  helpPanel.style.pointerEvents = helpVisible ? 'auto' : 'none';
  toggleBtn.innerText = helpVisible ? '隐藏说明' : '显示说明';
});


// 控制器
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 载入汽车模型
const loader = new GLTFLoader();
let carModel = null;
loader.load('./models/su7-xiaomini.glb', gltf => {
  carModel = gltf.scene;
  carModel.position.set(0, 0, 0);
  carModel.castShadow = true;
  scene.add(carModel);
  loadingText.style.display = 'none';
}, undefined, error => {
  console.error(error);
});

// 提示加载中
const loadingText = document.createElement('div');
loadingText.style.position = 'absolute';
loadingText.style.top = '20px';
loadingText.style.left = '20px';
loadingText.style.color = '#fff';
loadingText.innerText = '🚗 加载中...';
document.body.appendChild(loadingText);

const keys = {
  KeyW: false,
  KeyS: false,
  KeyA: false,
  KeyD: false,
  KeyQ: false,
  KeyE: false,
  Space: false,
  ShiftLeft: false,
  ShiftRight: false,
};

window.addEventListener('keydown', e => {
  if (e.code in keys) keys[e.code] = true;
});

window.addEventListener('keyup', e => {
  if (e.code in keys) keys[e.code] = false;
});
// 移动参数
const speed = 0.1;
const runMultiplier = 5; // 跑步时速度倍数
const rotationSpeed = 0.03;

// 跳跃参数
let isJumping = false;
let jumpStartTime = 0;
const jumpDuration = 600; // 毫秒
const jumpHeight = 1.2;

// 碰撞检测辅助盒子
const carBox = new THREE.Box3();
const obstacles = []; // 以后可加障碍物模型加入数组

// 简易碰撞检测函数
function checkCollision (newPos) {
  // 目前只有地面，没有障碍，始终返回 false（无碰撞）
  // 你可以扩展此函数实现碰撞判断
  return false;
}

function animate (time = 0) {
  requestAnimationFrame(animate);

  if (carModel) {
    // 处理跳跃动画
    if (isJumping) {
      const elapsed = time - jumpStartTime;
      if (elapsed < jumpDuration) {
        // 用正弦曲线模拟跳跃
        const jumpProgress = elapsed / jumpDuration;
        carModel.position.y = Math.sin(jumpProgress * Math.PI) * jumpHeight;
      } else {
        carModel.position.y = 0;
        isJumping = false;
      }
    } else if (keys.Space && !isJumping) {
      isJumping = true;
      jumpStartTime = time;
    }

    // 处理移动与旋转
    // let moveForward = keys.KeyW ? currentSpeed : 0;
    // let moveBackward = keys.KeyS ? currentSpeed : 0;
    // let rotateLeft = keys.ArrowLeft ? rotationSpeed : 0;
    // let rotateRight = keys.ArrowRight ? rotationSpeed : 0;

    // 跑动速度判断
    const isRunning = keys.ShiftLeft || keys.ShiftRight;
    const currentSpeed = speed * (isRunning ? runMultiplier : 1);

    let moveForward = keys.KeyW ? currentSpeed : 0;
    let moveBackward = keys.KeyS ? currentSpeed : 0;
    let rotateLeft = keys.KeyA ? rotationSpeed : 0;
    let rotateRight = keys.KeyD ? rotationSpeed : 0;
    let rotateQ = keys.KeyQ ? rotationSpeed : 0;
    let rotateE = keys.KeyE ? rotationSpeed : 0;

    carModel.rotation.z += rotateQ - rotateE;
    carModel.rotation.y += rotateLeft - rotateRight;

    const forwardVector = new THREE.Vector3(1, 0, 0);
    forwardVector.applyEuler(carModel.rotation);
    const moveDistance = moveForward - moveBackward;

    const newPos = carModel.position.clone().add(forwardVector.multiplyScalar(moveDistance));

    if (!checkCollision(newPos)) {
      carModel.position.copy(newPos);
    }

    // // 计算前进后退新位置
    // const forwardVector = new THREE.Vector3(0, 0, -1);
    // forwardVector.applyEuler(carModel.rotation);
    // const moveDistance = moveForward - moveBackward;

    // const newPos = carModel.position.clone().add(forwardVector.multiplyScalar(moveDistance));

    // 碰撞检测
    if (!checkCollision(newPos)) {
      carModel.position.copy(newPos);
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

// 窗口自适应
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
