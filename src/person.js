import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class People {
  constructor(scene, baseUrl) {
    this.scene = scene;
    this.baseUrl = baseUrl;
    this.model = null;

    this.isJumping = false;
    this.jumpStart = 0;
    this.jumpHeight = 1;
    this.jumpDuration = 600;

    this.box = new THREE.Box3();

    this.keys = {
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false,
      Digit0: false,
      Numpad0: false,  // 小键盘0
    };

    this.speed = 0.05;        // 移动速度
    this.rotationSpeed = 0.04; // 旋转速度

    this.initListeners();
    this.loadModel();
  }

  initListeners () {
    window.addEventListener('keydown', e => {
      if (e.code in this.keys) this.keys[e.code] = true;
    });
    window.addEventListener('keyup', e => {
      if (e.code in this.keys) this.keys[e.code] = false;
    });
  }

  loadModel () {
    const loader = new GLTFLoader();
    loader.load(
      `${this.baseUrl}models/person/Character.glb`,
      gltf => {
        this.model = gltf.scene;
        this.model.position.set(5, 0, 0);
        this.model.scale.set(0.5, 0.5, 0.5);  // 缩放调整大小
        this.scene.add(this.model);
      },
      undefined,
      err => console.error('加载人物模型失败', err)
    );
  }

  update (time) {
    if (!this.model) return;

    // 跳跃逻辑
    if (this.isJumping) {
      const elapsed = time - this.jumpStart;
      if (elapsed < this.jumpDuration) {
        const p = elapsed / this.jumpDuration;
        this.model.position.y = Math.sin(p * Math.PI) * this.jumpHeight;
      } else {
        this.model.position.y = 0;
        this.isJumping = false;
      }
    } else if (this.keys.Digit0 || this.keys.Numpad0) {
      this.isJumping = true;
      this.jumpStart = time;
    }

    // 转向控制
    if (this.keys.ArrowLeft) {
      this.model.rotation.y += this.rotationSpeed;
    }
    if (this.keys.ArrowRight) {
      this.model.rotation.y -= this.rotationSpeed;
    }

    // 计算前进方向（基于当前旋转）
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(this.model.rotation);

    // 前后移动
    if (this.keys.ArrowDown) {
      this.model.position.add(forward.clone().multiplyScalar(this.speed));
    }
    if (this.keys.ArrowUp) {
      this.model.position.add(forward.clone().multiplyScalar(-this.speed));
    }

    // 更新碰撞盒
    this.box.setFromObject(this.model);
  }

  // 外部调用判断人物与其他物体碰撞
  checkCollision (boxList) {
    for (const otherBox of boxList) {
      if (this.box.intersectsBox(otherBox)) {
        return true;
      }
    }
    return false;
  }
}
