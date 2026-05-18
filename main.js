import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

let camera, scene, cssRenderer, webglRenderer;
let particles;
let controls;
let keys = {};
let candles = []; // Cada entrada: { group, light, flameUniforms }
let ledLights = []; // Luces LED del mural: { mesh, light, baseY, phase }
let canMove = false;
let bgMusic;

init();
animate();

function init() {
  const container = document.getElementById('app');

  // Camera setup
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 5000);
  camera.position.set(0, 0, 500); // Stand a bit back from center

  // Scene setup
  scene = new THREE.Scene();

  // WebGL Renderer setup (Para partículas, pisos, iluminación)
  webglRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  webglRenderer.setSize(window.innerWidth, window.innerHeight);
  webglRenderer.setPixelRatio(window.devicePixelRatio);
  webglRenderer.domElement.style.position = 'absolute';
  webglRenderer.domElement.style.top = '0px';
  webglRenderer.domElement.style.zIndex = '1'; // Fondo
  container.appendChild(webglRenderer.domElement);

  // CSS3D Renderer setup (Para elementos HTML interactivos)
  cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.domElement.style.position = 'absolute';
  cssRenderer.domElement.style.top = '0px';
  cssRenderer.domElement.style.zIndex = '2'; // Frente
  // Fundamental para que los clicks pasen al DOM y el Drag pase a OrbitControls
  // cssRenderer.domElement.style.pointerEvents = 'none' no se pone aquí para no romper el OrbitControls, 
  // pero los fondos de pared HTML sí dejan pasar el click.
  container.appendChild(cssRenderer.domElement);

  // --- Magia WebGL (Habitación Física y Luces) ---
  // Iluminación para dar volumen y realismo
  // Luz ambiental cálida nocturna (ámbar suave, muy tenue para simular noche)
  const ambientLight = new THREE.AmbientLight(0xff6a00, 0.18); // Naranja oscuro, intensidad baja
  scene.add(ambientLight);

  // Luz principal: ámbar dorado cálido tipo vela, desde arriba
  const pointLight = new THREE.PointLight(0xff8c42, 1.6, 2800);
  pointLight.position.set(0, 350, 0);
  scene.add(pointLight);

  // Segunda luz de acento: rojo vino desde abajo-frente (simula reflexión del piso)
  const accentLight = new THREE.PointLight(0xc0392b, 0.5, 2000);
  accentLight.position.set(0, -400, 300);
  scene.add(accentLight);

  // Tercera luz: ámbar suave lateral para dar profundidad
  const sideLight = new THREE.PointLight(0xffa040, 0.7, 2500);
  sideLight.position.set(-600, 200, -600);
  scene.add(sideLight);

  // ── PISO: Madera oscura con vetas procedurales ──────────────────────────
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const floorCtx = floorCanvas.getContext('2d');
  // Base color caoba oscuro
  floorCtx.fillStyle = '#1a0d06';
  floorCtx.fillRect(0, 0, 512, 512);
  // Tablones de madera (líneas horizontales)
  const plankColors = ['#2b1206', '#1f0e05', '#261005', '#1a0c04'];
  const plankHeight = 64;
  for (let row = 0; row < 8; row++) {
    const y = row * plankHeight;
    floorCtx.fillStyle = plankColors[row % plankColors.length];
    floorCtx.fillRect(0, y, 512, plankHeight - 2);
    // Vetas de madera (líneas sinuosas)
    floorCtx.strokeStyle = 'rgba(60,20,5,0.35)';
    floorCtx.lineWidth = 1;
    for (let v = 0; v < 6; v++) {
      floorCtx.beginPath();
      floorCtx.moveTo(0, y + 8 + v * 9);
      for (let x = 0; x < 512; x += 30) {
        floorCtx.quadraticCurveTo(x + 15, y + 8 + v * 9 + (Math.random() * 6 - 3), x + 30, y + 8 + v * 9);
      }
      floorCtx.stroke();
    }
    // Línea de junta entre tablones
    floorCtx.fillStyle = '#0d0603';
    floorCtx.fillRect(0, y + plankHeight - 2, 512, 2);
  }
  const floorTexture = new THREE.CanvasTexture(floorCanvas);
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(4, 4);

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.55,   // Semi-brillante, como madera barnizada
    metalness: 0.08,
  });

  // ── PAREDES: Estuco rojo vino / borgoña con textura granulada ────────────
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 512;
  wallCanvas.height = 512;
  const wallCtx = wallCanvas.getContext('2d');
  // Base azul acero medio oscuro — bonito y profundo sin ser negro
  wallCtx.fillStyle = '#1a2d4a';
  wallCtx.fillRect(0, 0, 512, 512);
  // Ruido de estuco: pinceladas en tonos similares
  const wallShades = ['rgba(30,55,90,0.55)', 'rgba(15,38,68,0.5)', 'rgba(40,70,110,0.38)', 'rgba(20,45,78,0.6)'];
  for (let i = 0; i < 2800; i++) {
    wallCtx.fillStyle = wallShades[Math.floor(Math.random() * wallShades.length)];
    const wx = Math.random() * 512;
    const wy = Math.random() * 512;
    const ww = Math.random() * 18 + 4;
    const wh = Math.random() * 6 + 1;
    const angle = Math.random() * Math.PI;
    wallCtx.save();
    wallCtx.translate(wx, wy);
    wallCtx.rotate(angle);
    wallCtx.fillRect(-ww / 2, -wh / 2, ww, wh);
    wallCtx.restore();
  }
  // Líneas sutiles tipo papel tapiz / paneles
  wallCtx.strokeStyle = 'rgba(50,90,150,0.28)';
  wallCtx.lineWidth = 1;
  for (let ly = 0; ly < 512; ly += 128) {
    wallCtx.beginPath(); wallCtx.moveTo(0, ly); wallCtx.lineTo(512, ly); wallCtx.stroke();
  }
  for (let lx = 0; lx < 512; lx += 128) {
    wallCtx.beginPath(); wallCtx.moveTo(lx, 0); wallCtx.lineTo(lx, 512); wallCtx.stroke();
  }

  const wallTexture = new THREE.CanvasTexture(wallCanvas);
  wallTexture.wrapS = THREE.RepeatWrapping;
  wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.repeat.set(3, 2);

  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallTexture,
    roughness: 0.92,   // Muy mate, como estuco
    metalness: 0.0,
  });

  const wallGeometry = new THREE.PlaneGeometry(2000, 1500);
  const floorGeometry = new THREE.PlaneGeometry(2000, 2000);
  const offset = 1005; // 5px detrás de las paredes CSS (que están a 1000)

  // Piso
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -750; // Justo en la base de las paredes
  scene.add(floor);

  // Pared Frontal
  const wallFront = new THREE.Mesh(wallGeometry, wallMaterial);
  wallFront.position.set(0, 0, -offset);
  scene.add(wallFront);

  // Pared Trasera
  const wallBack = new THREE.Mesh(wallGeometry, wallMaterial.clone());
  wallBack.position.set(0, 0, offset);
  wallBack.rotation.y = Math.PI;
  scene.add(wallBack);

  // Pared Derecha
  const wallRight = new THREE.Mesh(wallGeometry, wallMaterial.clone());
  wallRight.position.set(offset, 0, 0);
  wallRight.rotation.y = -Math.PI / 2;
  scene.add(wallRight);

  // Pared Izquierda
  const wallLeft = new THREE.Mesh(wallGeometry, wallMaterial.clone());
  wallLeft.position.set(-offset, 0, 0);
  wallLeft.rotation.y = Math.PI / 2;
  scene.add(wallLeft);

  // Sistema de Partículas (Luciérnagas mágicas)
  const particleCount = 300; // Reducido para un efecto más sutil y elegante
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i++) {
    // Distribuir en una esfera enorme alrededor del centro
    positions[i] = (Math.random() - 0.5) * 3000;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffd700, // Dorado
    size: 6,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  particles = new THREE.Points(geometry, material);
  scene.add(particles);
  // ------------------------------------------

  // Room parameters
  const wallWidth = 2000;
  const wallHeight = 1500;
  const distance = wallWidth / 2; // Distance from center

  // 1. Wall Front: Letter & Hangman Game
  const frontWall = createFrontWall();
  frontWall.position.set(0, 0, -distance);
  scene.add(frontWall);

  // 2. Wall Right: Painting & Audio
  const rightWall = createRightWall();
  rightWall.position.set(distance, 0, 0);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.element.style.opacity = '0';
  rightWall.element.style.pointerEvents = 'none';
  rightWall.element.style.transition = 'opacity 2s ease-in-out';
  scene.add(rightWall);

  // 3. Wall Back: Video
  const backWall = createBackWall();
  backWall.position.set(0, 0, distance);
  backWall.rotation.y = Math.PI;
  backWall.element.style.opacity = '0';
  backWall.element.style.pointerEvents = 'none';
  backWall.element.style.transition = 'opacity 2s ease-in-out';
  scene.add(backWall);

  // 4. Wall Left: Photo Wall
  const leftWall = createLeftWall();
  leftWall.position.set(-distance, 0, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.element.style.opacity = '0';
  leftWall.element.style.pointerEvents = 'none';
  leftWall.element.style.transition = 'opacity 2s ease-in-out';
  scene.add(leftWall);

  // Luces LED del mural en WebGL (posicionadas sobre la pared izquierda)
  createStringLightsWebGL(scene, -distance);

  // Velas románticas en el piso
  createCandles(scene);

  // Controls setup (Atado al CSS Renderer porque está encima)
  controls = new OrbitControls(camera, cssRenderer.domElement);
  controls.enableZoom = false; // Keep the user in the center
  controls.enablePan = false;
  controls.enableRotate = false; // Bloquear rotación inicialmente
  controls.rotateSpeed = -0.5; // Invert rotation for a "look around" feel
  // controls.minPolarAngle = Math.PI / 2; // Lock vertical rotation (keep horizon flat)
  // controls.maxPolarAngle = Math.PI / 2;

  // Window resize handler
  window.addEventListener('resize', onWindowResize);

  // Keyboard handlers
  document.addEventListener('keydown', (e) => keys[e.code] = true);
  document.addEventListener('keyup', (e) => keys[e.code] = false);

  // Overlay logic
  document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('instructions').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('instructions').style.display = 'none';
    }, 500);

    // Iniciar música de fondo al entrar a la sala
    bgMusic = document.getElementById('bg-music');
    if (bgMusic) {
      bgMusic.volume = 0.5; // Volumen un poco más alto para asegurar que se escuche
      bgMusic.play().catch(e => console.log('Cargando audio pesado...'));
    }
  });

  // Respaldo infalible: Si el navegador bloqueó el primer intento (o estaba cargando los 84MB), 
  // cualquier click posterior en la pantalla intentará darle play.
  document.body.addEventListener('pointerdown', () => {
    if (bgMusic && bgMusic.paused) {
      bgMusic.play().catch(e => { });
    }
  });

  // Listener para mostrar las paredes al ganar
  document.addEventListener('gameWon', () => {
    setTimeout(() => {
      rightWall.element.style.opacity = '1';
      rightWall.element.style.pointerEvents = 'auto';
      backWall.element.style.opacity = '1';
      backWall.element.style.pointerEvents = 'auto';
      leftWall.element.style.opacity = '1';
      leftWall.element.style.pointerEvents = 'auto';

      // Aparecer velas WebGL con retraso escalonado para efecto dramático
      candles.forEach(({ group }, idx) => {
        setTimeout(() => { group.visible = true; }, idx * 60);
      });
      canMove = true; // Habilitar movimiento al ganar
      controls.enableRotate = true; // Habilitar rotación de cámara al ganar
    }, 1500); // Retraso de 1.5s para que se aprecie el confeti primero
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  webglRenderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  updateMovement();
  controls.update();

  // Animar luces LED del mural (parpadeo suave y oscilación)
  const t = performance.now() * 0.001;
  ledLights.forEach(({ mesh, light, baseY, phase }) => {
    const flicker = 0.75 + Math.sin(t * 3.5 + phase) * 0.15 + Math.sin(t * 7.1 + phase * 1.7) * 0.08;
    if (light) light.intensity = flicker * 0.9;
    if (mesh && mesh.material) mesh.material.opacity = 0.6 + flicker * 0.4;
    // Pequeña oscilación vertical tipo colgante
    if (mesh) mesh.position.y = baseY + Math.sin(t * 1.2 + phase) * 1.5;
  });

  // Animar llamas WebGL (fluctuación de llama y luz)
  candles.forEach(({ flameUniforms, light, flameGroup }, i) => {
    if (!flameUniforms) return;
    flameUniforms.uTime.value = t + i * 1.3; // Desfase por vela
    // Fluctuación sutil de la luz de punto
    if (light) {
      light.intensity = 0.6 + Math.sin(t * 4.7 + i) * 0.15 + Math.sin(t * 2.3 + i * 0.7) * 0.1;
    }
    // Ondeo de la llama
    if (flameGroup) {
      flameGroup.rotation.z = Math.sin(t * 3.1 + i * 0.9) * 0.08;
      flameGroup.position.y = Math.sin(t * 5.2 + i * 1.1) * 1.5;
    }
  });

  // Rotación mágica de las partículas
  if (particles) {
    particles.rotation.y += 0.0002; // Más lento y relajante
    particles.rotation.x += 0.0001;
  }

  webglRenderer.render(scene, camera);
  cssRenderer.render(scene, camera);
}

function updateMovement() {
  if (!canMove) return; // Bloquear movimiento si no se ha ganado el juego

  const speed = 15;
  const direction = new THREE.Vector3();
  const frontVector = new THREE.Vector3(0, 0, (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0));
  const sideVector = new THREE.Vector3((keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0), 0, 0);

  direction.addVectors(frontVector, sideVector);
  if (direction.length() > 0) {
    direction.normalize().multiplyScalar(speed);

    // Convert local direction to world direction (respecting only Y rotation)
    const camEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    direction.applyEuler(new THREE.Euler(0, camEuler.y, 0));

    // Bounds check
    const newPos = camera.position.clone().add(direction);
    const limit = 900; // Keep slightly away from the walls (wall is at 1000)
    if (newPos.x > limit) newPos.x = limit;
    if (newPos.x < -limit) newPos.x = -limit;
    if (newPos.z > limit) newPos.z = limit;
    if (newPos.z < -limit) newPos.z = -limit;

    const actualMove = newPos.clone().sub(camera.position);
    camera.position.add(actualMove);
    controls.target.add(actualMove);
  }
}

// --- Wall Creators ---

function createCandles(scene) {
  // Shader de llama: distorsión procedural con ruido simplex simplificado
  const flameVertexShader = `
    uniform float uTime;
    varying vec2 vUv;
    varying float vDistort;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1,0)), f.x),
        mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
        f.y
      );
    }

    void main() {
      vUv = uv;
      vec3 pos = position;
      // Distorsión lateral en la punta (más efecto arriba)
      float sway = noise(vec2(pos.y * 2.0 + uTime * 1.8, uTime * 0.9)) - 0.5;
      pos.x += sway * uv.y * 5.0;
      // Ensanchamiento suave en la base
      pos.x *= 1.0 - uv.y * 0.35;
      vDistort = sway;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const flameFragmentShader = `
    uniform float uTime;
    varying vec2 vUv;
    varying float vDistort;

    void main() {
      // Gradiente vertical: base naranja, punta amarilla, desvanece en la cima
      float core = 1.0 - vUv.y;
      core = pow(core, 1.4);
      // Suavizar bordes laterales
      float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
      edge = pow(edge, 0.7);
      float alpha = core * edge;
      alpha *= smoothstep(1.0, 0.7, vUv.y); // Desvanecer punta
      alpha *= smoothstep(0.0, 0.15, vUv.y); // Desvanecer base
      // Color: de rojo-naranja en base a amarillo en punta
      vec3 col = mix(vec3(1.0, 0.25, 0.0), vec3(1.0, 0.85, 0.1), vUv.y);
      col = mix(col, vec3(1.0, 1.0, 0.6), pow(vUv.y, 3.0)); // Núcleo brillante en la cima
      gl_FragColor = vec4(col, alpha * 0.92);
    }
  `;

  // Materiales reutilizables para el cuerpo de la vela
  const waxMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5e6c8,   // Marfil cálido
    roughness: 0.8,
    metalness: 0.0,
  });
  const wickMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1008 });

  for (let i = 0; i < 30; i++) {
    let x, z;
    do {
      x = (Math.random() - 0.5) * 1800;
      z = (Math.random() - 0.5) * 1800;
    } while (Math.sqrt(x * x + z * z) < 300);

    const group = new THREE.Group();
    group.position.set(x, -750, z);

    // Altura y radio aumentados para velas más grandes y visibles
    const candleH = 90 + Math.random() * 80;   // antes: 40 + random*50
    const candleR = 10 + Math.random() * 7;     // antes: 5 + random*4

    // Cuerpo (cilindro)
    const bodyGeo = new THREE.CylinderGeometry(candleR, candleR * 1.05, candleH, 12);
    const body = new THREE.Mesh(bodyGeo, waxMaterial);
    body.position.y = candleH / 2;
    group.add(body);

    // Mecha
    const wickGeo = new THREE.CylinderGeometry(0.5, 0.5, 8, 6);
    const wick = new THREE.Mesh(wickGeo, wickMaterial);
    wick.position.y = candleH + 4;
    group.add(wick);

    // Llama (PlaneGeometry con ShaderMaterial, doble cara)
    const flameUniforms = { uTime: { value: 0 } };
    const flameMat = new THREE.ShaderMaterial({
      uniforms: flameUniforms,
      vertexShader: flameVertexShader,
      fragmentShader: flameFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const flameGeo = new THREE.PlaneGeometry(candleR * 2.2, candleR * 3.5, 4, 8);
    const flameMesh = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.position.y = candleH + 8 + (candleR * 1.75);

    // Segunda plana perpendicular para dar volumen a la llama
    const flameMesh2 = new THREE.Mesh(flameGeo, flameMat);
    flameMesh2.position.y = candleH + 8 + (candleR * 1.75);
    flameMesh2.rotation.y = Math.PI / 2;

    const flameGroup = new THREE.Group();
    flameGroup.add(flameMesh);
    flameGroup.add(flameMesh2);
    group.add(flameGroup);

    // Luz de punto por vela (sólo 1 de cada 3 para no saturar la GPU)
    let light = null;
    if (i % 3 === 0) {
      light = new THREE.PointLight(0xff7722, 0.9, 550);
      light.position.set(0, candleH + 14, 0);
      group.add(light);
    }

    // Invisible hasta ganar (igual que antes)
    group.visible = false;

    scene.add(group);
    candles.push({ group, light, flameUniforms, flameGroup });
  }
}

function createFrontWall() {
  const el = document.createElement('div');
  el.className = 'wall-container wall-front';

  // Letter
  const letterBox = document.createElement('div');
  letterBox.className = 'letter-box';
  letterBox.innerHTML = `
    <h1>Para mi amor,</h1>
    <p>Cada momento contigo es un tesoro que guardo en mi corazón. He creado este pequeño detalle para ti, para recordar nuestros momentos juntos y pedirle a Dios por nuestro amor.</p>
    <br>
    <p>Peroooo no todo es tan fácil, tienes que adivinar la palabra clave para poder entrar jijiji.</p>
    <br>
    <p>Pista: es nuestro primer amor ⛪</p>
    <br>
    <p>Te amo.</p>
  `;

  // Hangman Game
  const gameBox = document.createElement('div');
  gameBox.className = 'game-box';
  gameBox.innerHTML = `
    <h2>Adivina la frase</h2>
    <div class="hangman-word" id="hangman-word"></div>
    <div class="game-status" id="game-status"></div>
  `;

  el.appendChild(letterBox);
  el.appendChild(gameBox);

  // Hangman Logic
  setTimeout(() => initHangman(gameBox), 100);

  return new CSS3DObject(el);
}

function initHangman(gameBox) {
  let phase = 1;
  const wordP1 = "JESUS";
  const lettersP1 = wordP1.split('');
  let guessedP1 = [];

  const acrosticLines = [
    { start: 'J', rest: "untos" },
    { start: 'E', rest: "staremos," },
    { start: 'S', rest: "iempre bajo la bendicion de Dios," },
    { start: 'U', rest: "nidos por el amor que El mismo creo," },
    { start: 'S', rest: "abiendo que El nos junto a los dos." }
  ];
  let guessedP2 = [];
  let pressedKeys = new Set(); // Rastrear teclas presionadas físicamente

  const wordContainer = gameBox.querySelector('#hangman-word');
  const statusContainer = gameBox.querySelector('#game-status');

  const removeAccents = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  };

  function renderPhase1() {
    wordContainer.className = 'hangman-word vertical-mode';
    wordContainer.innerHTML = '';
    let win = true;
    lettersP1.forEach(char => {
      const span = document.createElement('div');
      span.className = 'hangman-letter box-style';
      if (guessedP1.includes(char)) {
        span.innerText = char;
      } else {
        span.innerText = '';
        win = false;
      }
      wordContainer.appendChild(span);
    });

    if (win) {
      statusContainer.innerText = 'Ya falta poco... corachon 😘';
      setTimeout(() => startPhase2(), 1500);
    }
  }

  function startPhase2() {
    phase = 2;
    pressedKeys.clear(); // Resetear teclas para la segunda fase
    statusContainer.innerText = '';
    wordContainer.className = 'hangman-word acrostic-mode';
    renderPhase2();
  }

  function renderPhase2() {
    wordContainer.innerHTML = '';
    let win = true;

    acrosticLines.forEach(line => {
      const row = document.createElement('div');
      row.className = 'acrostic-row';

      const firstLetter = document.createElement('div');
      firstLetter.className = 'hangman-letter small box-style first-letter';
      firstLetter.innerText = line.start;
      row.appendChild(firstLetter);

      const restChars = line.rest.split('');
      restChars.forEach(char => {
        if (char === ' ') {
          const space = document.createElement('div');
          space.className = 'acrostic-space';
          row.appendChild(space);
        } else if (/[.,]/.test(char)) {
          const punct = document.createElement('div');
          punct.className = 'hangman-letter small';
          punct.style.borderBottom = 'none';
          punct.innerText = char;
          row.appendChild(punct);
        } else {
          const span = document.createElement('div');
          span.className = 'hangman-letter small';
          const normalizedChar = removeAccents(char);
          if (guessedP2.includes(normalizedChar)) {
            span.innerText = char;
          } else {
            span.innerText = '';
            win = false;
          }
          row.appendChild(span);
        }
      });
      wordContainer.appendChild(row);
    });

    if (win) {
      statusContainer.innerText = '¡Felicidades mi amor! ❤️';
      statusContainer.style.color = '#ff4b72';
      createConfetti();

      const firstLetters = wordContainer.querySelectorAll('.first-letter');
      firstLetters.forEach(l => l.classList.add('highlight'));

      document.dispatchEvent(new Event('gameWon'));
    }
  }

  function handleGuess(letter) {
    if (phase === 1) {
      if (!guessedP1.includes(letter)) {
        guessedP1.push(letter);
        renderPhase1();
      }
    } else if (phase === 2) {
      if (!guessedP2.includes(letter)) {
        guessedP2.push(letter);
        renderPhase2();
      }
    }
  }

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const physicalKeyHandler = (e) => {
    const key = e.key.toUpperCase();
    if (alphabet.includes(key) && !pressedKeys.has(key)) {
      pressedKeys.add(key);
      handleGuess(key);
    }
  };

  // Clean up potential existing listener
  document.removeEventListener('keydown', physicalKeyHandler);
  document.addEventListener('keydown', physicalKeyHandler);

  renderPhase1();
}

function createConfetti() {
  const heartCount = 80;

  // Forma de corazón con THREE.Shape (curvas de Bezier)
  function makeHeartShape(size) {
    const s = new THREE.Shape();
    s.moveTo(0, size * 0.35);
    s.bezierCurveTo(size * 0.5, size * 0.9, size, size * 0.6, size * 0.5, size * 0.1);
    s.bezierCurveTo(size * 0.8, -size * 0.4, size * 0.3, -size * 0.6, 0, -size * 0.5);
    s.bezierCurveTo(-size * 0.3, -size * 0.6, -size * 0.8, -size * 0.4, -size * 0.5, size * 0.1);
    s.bezierCurveTo(-size, size * 0.6, -size * 0.5, size * 0.9, 0, size * 0.35);
    return s;
  }

  // Colores de corazón
  const colors = [0xff1744, 0xff69b4, 0xff4081, 0xff80ab, 0xf50057];

  // Geometrías reutilizables por tamaño (3 tamaños)
  const geos = [14, 20, 28].map(sz => new THREE.ShapeGeometry(makeHeartShape(sz)));

  const hearts = []; // { mesh, vx, vy, vz, rotSpeed, life }

  for (let i = 0; i < heartCount; i++) {
    setTimeout(() => {
      const geo = geos[Math.floor(Math.random() * geos.length)];
      const mat = new THREE.MeshStandardMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        emissive: 0xff1744,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.85 + Math.random() * 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geo, mat);

      // Posición inicial: dispersos en X/Z frente a la cámara, por encima
      mesh.position.set(
        (Math.random() - 0.5) * 1600,  // ancho de la habitación
        700 + Math.random() * 300,      // arriba del techo visible
        (Math.random() - 0.5) * 800     // profundidad
      );

      // Orientación inicial aleatoria
      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      scene.add(mesh);

      hearts.push({
        mesh,
        vx: (Math.random() - 0.5) * 1.5,   // deriva lateral
        vy: -(3 + Math.random() * 3.5),      // velocidad de caída
        vz: (Math.random() - 0.5) * 1.0,
        rotX: (Math.random() - 0.5) * 0.04,
        rotY: (Math.random() - 0.5) * 0.06,
        rotZ: (Math.random() - 0.5) * 0.05,
        born: performance.now(),
        life: 4000 + Math.random() * 3000,   // tiempo de vida en ms
      });
    }, Math.random() * 2500);
  }

  // Loop propio de actualización de corazones (se integra en el requestAnimationFrame global)
  function tickHearts() {
    const now = performance.now();
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      const age = now - h.born;

      // Mover
      h.mesh.position.x += h.vx;
      h.mesh.position.y += h.vy;
      h.mesh.position.z += h.vz;

      // Rotar
      h.mesh.rotation.x += h.rotX;
      h.mesh.rotation.y += h.rotY;
      h.mesh.rotation.z += h.rotZ;

      // Desvanecer en los últimos 800ms de vida
      const fadeStart = h.life - 800;
      if (age > fadeStart) {
        h.mesh.material.opacity = Math.max(0, 1 - (age - fadeStart) / 800) * 0.95;
      }

      // Eliminar cuando expira o cae muy abajo
      if (age > h.life || h.mesh.position.y < -900) {
        scene.remove(h.mesh);
        h.mesh.material.dispose();
        hearts.splice(i, 1);
      }
    }

    if (hearts.length > 0) requestAnimationFrame(tickHearts);
  }

  // Arrancar el tick después de un frame para que los primeros corazones estén listos
  setTimeout(() => requestAnimationFrame(tickHearts), 100);
}

function setDucking(isDucking) {
  if (bgMusic) {
    bgMusic.volume = isDucking ? 0.02 : 0.2; // Baja el volumen casi a 0 cuando hay otro audio
  }
}

function createRightWall() {
  const el = document.createElement('div');
  el.className = 'wall-container';

  const frame = document.createElement('div');
  frame.className = 'painting-frame';
  frame.innerHTML = `
    <div class="painting-inner">
      <div class="play-icon">▶</div>
    </div>
  `;

  let isPlaying = false;
  frame.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); // Evita que OrbitControls cancele el clic si se mueve ligeramente el mouse
    const audio = document.getElementById('wall-audio');

    if (!audio) {
      alert("Error: No se encontró el reproductor de audio.");
      return;
    }

    if (isPlaying) {
      audio.pause();
      setDucking(false);
      frame.querySelector('.play-icon').innerText = '▶';
      isPlaying = false;
    } else {
      audio.play().then(() => {
        setDucking(true);
        frame.querySelector('.play-icon').innerText = '⏸';
        isPlaying = true;
      }).catch(err => {
        alert("Asegúrate de haber guardado tu canción como 'mi_audio.mp3' en la carpeta resources. (Detalle: " + err.message + ")");
      });
    }
  });

  // Si el audio termina naturalmente
  const audioEl = document.getElementById('wall-audio');
  if (audioEl) {
    audioEl.addEventListener('ended', () => {
      setDucking(false);
      frame.querySelector('.play-icon').innerText = '▶';
      isPlaying = false;
    });
  }

  el.appendChild(frame);
  return new CSS3DObject(el);
}

function createBackWall() {
  const el = document.createElement('div');
  el.className = 'wall-container';

  const videoContainer = document.createElement('div');
  videoContainer.className = 'video-container';
  
  ytPlaceholderElement = document.createElement('div');
  ytPlaceholderElement.style.width = '100%';
  ytPlaceholderElement.style.height = '100%';
  ytPlaceholderElement.style.borderRadius = '10px';
  ytPlaceholderElement.style.backgroundColor = 'black';
  videoContainer.appendChild(ytPlaceholderElement);

  el.appendChild(videoContainer);

  // Si la API de YouTube cargó rapidísimo, inicializar de una vez
  if (isYoutubeApiReady) {
    initYoutubePlayer();
  }

  return new CSS3DObject(el);
}

// --- Integración API de YouTube ---
let isYoutubeApiReady = false;
let ytPlaceholderElement = null;
let ytPlayer = null;

// Cargar el script oficial de YouTube
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
if (firstScriptTag) {
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
} else {
  document.head.appendChild(tag);
}

// Función global que llama YouTube cuando su código está listo
window.onYouTubeIframeAPIReady = function() {
  isYoutubeApiReady = true;
  if (ytPlaceholderElement) {
    initYoutubePlayer();
  }
};

function initYoutubePlayer() {
  if (ytPlayer) return; // Evitar inicialización doble
  ytPlayer = new window.YT.Player(ytPlaceholderElement, {
    videoId: '3tpPDAmgWFc',
    playerVars: {
      'playsinline': 1,
      'controls': 1,
      'rel': 0
    },
    events: {
      'onStateChange': (event) => {
        // YT.PlayerState.PLAYING = 1, PAUSED = 2, ENDED = 0
        if (event.data === 1) {
          setDucking(true);
        } else if (event.data === 2 || event.data === 0) {
          setDucking(false);
        }
      }
    }
  });
}


function createStringLightsWebGL(scene, wallX) {
  // Dos tiras verticales de luces, una en cada lateral del mural (izquierda y derecha de la pared)
  // La pared izquierda está en X = wallX ≈ -1000, rotada PI/2 en Y.
  // Su ancho local corre a lo largo del eje Z: de -1000 a +1000.
  // Los laterales del mural están en Z ≈ -750 y Z ≈ +750.

  const palette = [
    { hex: 0xffd700 }, // Dorado
    { hex: 0xff6b9d }, // Rosa
    { hex: 0x7ec8e3 }, // Celeste
    { hex: 0xff9944 }, // Naranja cálido
  ];

  const xOffset = wallX < 0 ? wallX + 25 : wallX - 25; // levemente dentro de la pared
  const topY = 650;   // altura del techo
  const bottomY = -680;   // altura del suelo
  const countPerSide = 16;
  const bulbGeo = new THREE.SphereGeometry(11, 8, 8);

  // Las dos columnas laterales: Z izquierda y Z derecha del mural
  const sideZs = [-820, 820];

  sideZs.forEach((sideZ, sideIdx) => {
    const cablePoints = [];

    for (let i = 0; i < countPerSide; i++) {
      const frac = i / (countPerSide - 1);
      // Ligera oscilación horizontal (tipo guirnalda que ondea) en X
      const swayX = Math.sin(frac * Math.PI * 3) * 8;
      const bulbY = topY - frac * (topY - bottomY);

      const col = palette[(i + sideIdx * 2) % palette.length];

      const bulbMat = new THREE.MeshStandardMaterial({
        color: col.hex,
        emissive: col.hex,
        emissiveIntensity: 2.5,
        transparent: true,
        opacity: 0.98,
      });

      const bulb = new THREE.Mesh(bulbGeo, bulbMat.clone());
      bulb.position.set(xOffset + swayX, bulbY, sideZ);
      bulb.visible = false;
      scene.add(bulb);

      // PointLight en 1 de cada 2 para iluminación visible
      let ptLight = null;
      if (i % 2 === 0) {
        ptLight = new THREE.PointLight(col.hex, 1.3, 400);
        ptLight.position.copy(bulb.position);
        ptLight.visible = false;
        scene.add(ptLight);
      }

      ledLights.push({
        mesh: bulb,
        light: ptLight,
        baseY: bulbY,
        phase: Math.random() * Math.PI * 2,
      });

      cablePoints.push(new THREE.Vector3(xOffset + swayX, bulbY, sideZ));
    }

    // Cable vertical que conecta las bombillitas
    const cableGeo = new THREE.BufferGeometry().setFromPoints(cablePoints);
    const cableMat = new THREE.LineBasicMaterial({ color: 0x1a1008 });
    const cable = new THREE.Line(cableGeo, cableMat);
    cable.visible = false;
    scene.add(cable);

    // Aparecer al ganar
    document.addEventListener('gameWon', () => {
      setTimeout(() => {
        cable.visible = true;
      }, 1800);
    });
  });

  // Aparición escalonada de todas las luces al ganar
  document.addEventListener('gameWon', () => {
    setTimeout(() => {
      ledLights.forEach(({ mesh, light }, idx) => {
        setTimeout(() => {
          mesh.visible = true;
          if (light) light.visible = true;
        }, idx * 80);
      });
    }, 1800);
  });
}

function createLeftWall() {
  const el = document.createElement('div');
  el.className = 'wall-container';

  const grid = document.createElement('div');
  grid.className = 'photo-grid';

  const photos = [
    { src: new URL('./resources/Boda.jpg', import.meta.url).href, caption: 'Hermosa siempre' },
    { src: new URL('./resources/IMG_20251212_175237_369.jpg', import.meta.url).href, caption: 'Elegantes' },
    { src: new URL('./resources/Juntos.jpg', import.meta.url).href, caption: 'Siempre unidos' },
    { src: new URL('./resources/Maria.jpg', import.meta.url).href, caption: 'Stella Maris' },
    { src: new URL('./resources/Pesebre.jpg', import.meta.url).href, caption: 'Nuestro pesebre' },
    { src: new URL('./resources/Salida.jpg', import.meta.url).href, caption: 'Una salida inolvidable' },
    { src: new URL('./resources/navidad.jpg', import.meta.url).href, caption: 'Nuestra navidad' },
    { src: new URL('./resources/paseo.jpg', import.meta.url).href, caption: 'Aventuras contigo' },
    { src: new URL('./resources/santisimo.jpg', import.meta.url).href, caption: 'Paz y amor' },
    { src: new URL('./resources/Congreso_juntos.jpg', import.meta.url).href, caption: 'Un gran equipo' },
    { src: new URL('./resources/Osito_de_peluche.jpg', import.meta.url).href, caption: 'Osito de peluce' },
    { src: new URL('./resources/Princesa.jpg', import.meta.url).href, caption: 'Mi dulce princesa' }
  ];

  photos.forEach((photo) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    const rotation = (Math.random() - 0.5) * 20; // Random rotation between -10 and 10 deg
    card.style.setProperty('--rot', rotation);

    card.innerHTML = `
      <img src="${photo.src}" class="photo-img" alt="Memory">
      <div class="photo-caption">${photo.caption}</div>
    `;
    grid.appendChild(card);
  });

  el.appendChild(grid);

  // Las luces LED se crean como objetos Three.js desde createStringLightsWebGL()
  // (se llama desde init() después de posicionar la pared izquierda)

  return new CSS3DObject(el);
}