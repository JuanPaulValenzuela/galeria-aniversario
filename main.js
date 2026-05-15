import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

let camera, scene, renderer;
let controls;
let keys = {};
let candles = [];
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

  // CSS3D Renderer setup
  renderer = new CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0px';
  container.appendChild(renderer.domElement);

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

  // Velas románticas en el piso
  createCandles(scene);

  // Controls setup
  controls = new OrbitControls(camera, renderer.domElement);
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
      bgMusic.play().catch(e => {});
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

      candles.forEach(c => {
        c.element.style.opacity = '1';
      });
      canMove = true; // Habilitar movimiento al ganar
      controls.enableRotate = true; // Habilitar rotación de cámara al ganar
    }, 1500); // Retraso de 1.5s para que se aprecie el confeti primero
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  updateMovement();
  controls.update();

  // Hacer que las velas siempre miren hacia la cámara (Billboarding)
  candles.forEach(c => {
    c.rotation.y = Math.atan2(camera.position.x - c.position.x, camera.position.z - c.position.z);
  });

  renderer.render(scene, camera);
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
  for (let i = 0; i < 30; i++) {
    const el = document.createElement('div');
    el.className = 'candle-container';
    el.innerHTML = `
      <div class="candle-flame"></div>
      <div class="candle-body"></div>
    `;
    const candle = new CSS3DObject(el);

    // Posicionarlas por todo el piso, evitando el centro exacto
    let x, z;
    do {
      x = (Math.random() - 0.5) * 1800;
      z = (Math.random() - 0.5) * 1800;
    } while (Math.sqrt(x * x + z * z) < 300);

    candle.position.set(x, -750 + 60, z); // El piso está en Y=-750, +60 por la mitad de la altura de la vela
    candle.element.style.opacity = '0';
    candle.element.style.transition = 'opacity 2s ease-in-out';

    scene.add(candle);
    candles.push(candle);
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
    <p>Cada momento contigo es un tesoro que guardo en mi corazón. He creado este pequeño mundo virtual para nosotros, para recordar nuestros momentos y divertirnos un poco.</p>
    <br>
    <p>Resuelve el juego de la derecha para descubrir nuestro mensaje secreto.</p>
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
  const heartSymbols = ['❤️', '💖', '💕', '💗'];
  for (let i = 0; i < 80; i++) {
    // Retrasar la creación de cada corazón para crear un efecto cascada/lluvia continua
    setTimeout(() => {
      const heart = document.createElement('div');
      heart.innerText = heartSymbols[Math.floor(Math.random() * heartSymbols.length)];
      heart.style.position = 'absolute';
      heart.style.fontSize = `${Math.random() * 20 + 20}px`;
      heart.style.left = Math.random() * 100 + '%';
      heart.style.top = `${-50 - Math.random() * 100}px`; // Inician un poco más arriba
      heart.style.zIndex = '9999';
      heart.style.opacity = (Math.random() * 0.5 + 0.5).toString();

      const duration = Math.random() * 3 + 3; // Entre 3s y 6s de caída
      heart.style.transition = `top ${duration}s ease-in, transform ${duration}s linear`;
      document.body.appendChild(heart);

      setTimeout(() => {
        heart.style.top = '100vh';
        heart.style.transform = `rotate(${Math.random() * 720}deg) translateX(${Math.random() * 150 - 75}px)`;
      }, 50);

      setTimeout(() => heart.remove(), duration * 1000 + 100);
    }, Math.random() * 2500); // Esparcir los nacimientos a lo largo de 2.5 segundos
  }
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
  videoContainer.innerHTML = `
    <video controls loop>
      <!-- Example open source video, replace with your own -->
      <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4">
      Tu navegador no soporta el tag de video.
    </video>
  `;

  const videoEl = videoContainer.querySelector('video');
  if (videoEl) {
    videoEl.addEventListener('play', () => setDucking(true));
    videoEl.addEventListener('pause', () => setDucking(false));
    videoEl.addEventListener('ended', () => setDucking(false));
  }

  el.appendChild(videoContainer);
  return new CSS3DObject(el);
}

function createLeftWall() {
  const el = document.createElement('div');
  el.className = 'wall-container';

  const grid = document.createElement('div');
  grid.className = 'photo-grid';

  const photos = [
    { src: new URL('./resources/Boda.jpg', import.meta.url).href, caption: 'El día más feliz' },
    { src: new URL('./resources/IMG_20251212_175237_369.jpg', import.meta.url).href, caption: 'Momentos juntos' },
    { src: new URL('./resources/Juntos.jpg', import.meta.url).href, caption: 'Siempre unidos' },
    { src: new URL('./resources/Maria.jpg', import.meta.url).href, caption: 'Mi persona favorita' },
    { src: new URL('./resources/Pesebre.jpg', import.meta.url).href, caption: 'Nuestro pesebre' },
    { src: new URL('./resources/Salida.jpg', import.meta.url).href, caption: 'Una salida inolvidable' },
    { src: new URL('./resources/navidad.jpg', import.meta.url).href, caption: 'Nuestra navidad' },
    { src: new URL('./resources/paseo.jpg', import.meta.url).href, caption: 'Aventuras contigo' },
    { src: new URL('./resources/santisimo.jpg', import.meta.url).href, caption: 'Paz y amor' }
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

  // Luces de navidad colgadas en la pared
  const lightsContainer = document.createElement('div');
  lightsContainer.className = 'string-lights';
  for (let i = 0; i < 18; i++) {
    const light = document.createElement('div');
    light.className = 'light-bulb';

    if (i % 3 === 0) light.classList.add('c1');
    else if (i % 3 === 1) light.classList.add('c2');
    else light.classList.add('c3');

    // Crear efecto de arco/colgante matemático simple
    const drop = Math.sin((i / 17) * Math.PI) * 50;
    light.style.transform = `translateY(${drop}px)`;
    light.style.animationDelay = `-${Math.random() * 2}s`;

    lightsContainer.appendChild(light);
  }
  el.appendChild(lightsContainer);

  return new CSS3DObject(el);
}
