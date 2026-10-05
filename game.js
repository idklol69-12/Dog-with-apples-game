(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreLabel = document.getElementById("score");
  const paceLabel = document.getElementById("pace");
  const bestLabel = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const playButton = document.getElementById("play-button");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayCopy = document.getElementById("overlay-copy");
  const overlayKicker = document.getElementById("overlay-kicker");
  const overlaySticker = document.getElementById("overlay-sticker");
  const missionCount = document.getElementById("mission-count");
  const missionProgress = document.getElementById("mission-progress");
  const missionHint = document.getElementById("mission-hint");

  const WIDTH = 900;
  const HEIGHT = 560;
  const ROAD = { x: 220, width: 460 };
  const LANE_COUNT = 3;
  const LANE_WIDTH = ROAD.width / LANE_COUNT;
  const DOG_Y = 448;
  const BEST_KEY = "apple-dash-best";
  const colors = {
    grass: "#b8d9ba",
    grassLight: "#c7e2c1",
    road: "#606f68",
    roadEdge: "#e7d7a9",
    line: "#f5efcc",
    apple: "#df5c4f"
  };

  let state = "ready";
  let score = 0;
  let best = getBest();
  let runStartingBest = best;
  let lane = 1;
  let objects = [];
  let particles = [];
  let spawnTimer = 0;
  let elapsed = 0;
  let roadOffset = 0;
  let lastTime = 0;
  let animationFrame = 0;
  let audioContext;

  bestLabel.textContent = formatScore(best);
  resizeCanvas();
  draw();

  function getBest() {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch {
      // The current score remains playable when storage is unavailable.
    }
  }

  function formatScore(value) {
    return String(value).padStart(2, "0");
  }

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.width * (HEIGHT / WIDTH) * ratio);
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    draw();
  }

  function laneCenter(index) {
    return ROAD.x + LANE_WIDTH * (index + 0.5);
  }

  function currentSpeed() {
    return 185 + Math.min(score, 35) * 6 + elapsed * 10;
  }

  function paceName() {
    const multiplier = currentSpeed() / 185;
    if (multiplier < 1.2) return "Easy";
    if (multiplier < 1.5) return "Picking up";
    if (multiplier < 1.9) return "Fast";
    return `Zoomies x${multiplier.toFixed(1)}`;
  }

  function updateHud() {
    scoreLabel.textContent = formatScore(score);
    paceLabel.textContent = paceName();
    missionCount.textContent = `${Math.min(score, 10)} / 10`;
    missionProgress.style.width = `${Math.min(score / 10, 1) * 100}%`;
    missionHint.textContent = score >= 10 ? "Apple expert! Biscuit approves." : "A little snack goes a long way.";
    bestLabel.textContent = formatScore(best);
  }

  function startGame() {
    score = 0;
    runStartingBest = best;
    lane = 1;
    objects = [];
    particles = [];
    spawnTimer = 0.55;
    elapsed = 0;
    roadOffset = 0;
    lastTime = performance.now();
    state = "playing";
    updateHud();
    overlay.classList.add("is-hidden");
    playButton.blur();
    animationFrame = requestAnimationFrame(loop);
  }

  function endGame() {
    const isNewBest = score > runStartingBest;
    state = "over";
    cancelAnimationFrame(animationFrame);
    playSound("hit");
    overlaySticker.textContent = "🥺";
    overlayKicker.textContent = "OH, BISCUIT!";
    overlayTitle.innerHTML = `You found ${score} apple${score === 1 ? "" : "s"}!`;
    overlayCopy.textContent = isNewBest
      ? "That’s a new best! Biscuit is already dreaming about the next run."
      : "The traffic won this round, but Biscuit is ready for another try.";
    playButton.innerHTML = 'Run it back <span aria-hidden="true">↻</span>';
    overlay.classList.remove("is-hidden");
    draw();
  }

  function resumeGame() {
    if (state !== "paused") {
      startGame();
      return;
    }
    state = "playing";
    lastTime = performance.now();
    overlay.classList.add("is-hidden");
    animationFrame = requestAnimationFrame(loop);
  }

  function move(direction) {
    if (state !== "playing") return;
    const nextLane = Math.max(0, Math.min(LANE_COUNT - 1, lane + direction));
    if (nextLane !== lane) {
      lane = nextLane;
      playSound("step");
    }
  }

  function spawnObject() {
    const occupied = objects.filter((item) => item.y < 150).map((item) => item.lane);
    const available = [0, 1, 2].filter((index) => !occupied.includes(index));
    if (!available.length) return;
    const targetLane = available[Math.floor(Math.random() * available.length)];
    const roll = Math.random();
    const kind = roll < 0.45 ? "apple" : roll < 0.79 ? "car" : "bus";
    objects.push({
      kind,
      lane: targetLane,
      y: -80,
      wobble: Math.random() * Math.PI * 2,
      color: ["#e57b53", "#e9bd55", "#648eaa", "#9976a5"][Math.floor(Math.random() * 4)]
    });
  }

  function loop(time) {
    if (state !== "playing") return;
    const dt = Math.min((time - lastTime) / 1000, 0.04);
    lastTime = time;
    elapsed += dt;
    roadOffset = (roadOffset + currentSpeed() * dt) % 84;
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObject();
      spawnTimer = Math.max(0.5, 1.1 - score * 0.018) + Math.random() * 0.35;
    }

    for (const item of objects) {
      const previousY = item.y;
      item.y += currentSpeed() * dt;
      if (item.kind === "apple" && item.lane === lane && item.y > DOG_Y - 39 && previousY < DOG_Y + 30) {
        item.collected = true;
        score += 1;
        particles.push(...makeParticles(laneCenter(lane), DOG_Y - 17));
        playSound("apple");
        if (score > best) {
          best = score;
          saveBest(best);
        }
        updateHud();
      } else if (item.kind !== "apple" && item.lane === lane && item.y > DOG_Y - 45 && previousY < DOG_Y + 33) {
        item.hit = true;
        objects = objects.filter((object) => !object.collected && !object.hit);
        endGame();
        return;
      }
    }
    objects = objects.filter((item) => !item.collected && !item.hit && item.y < HEIGHT + 100);
    const pace = paceName();
    if (paceLabel.textContent !== pace) paceLabel.textContent = pace;
    particles = particles.filter((particle) => particle.life > 0);
    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 190 * dt;
      particle.life -= dt;
    }

    draw();
    animationFrame = requestAnimationFrame(loop);
  }

  function makeParticles(x, y) {
    return Array.from({ length: 9 }, () => ({
      x, y,
      vx: (Math.random() - 0.5) * 180,
      vy: -55 - Math.random() * 125,
      life: 0.65,
      color: ["#f3bf55", "#ef8057", "#fff2c8"][Math.floor(Math.random() * 3)]
    }));
  }

  function roundedRect(x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function drawBackground() {
    ctx.fillStyle = colors.grass;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = colors.grassLight;
    for (let i = 0; i < 14; i++) {
      const y = (i * 83 + roadOffset * 0.25) % (HEIGHT + 45) - 20;
      const x = i % 2 ? 80 : 805;
      ctx.beginPath();
      ctx.ellipse(x, y, 29, 8, i % 2 ? -0.4 : 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = colors.roadEdge;
    ctx.fillRect(ROAD.x - 8, 0, ROAD.width + 16, HEIGHT);
    ctx.fillStyle = colors.road;
    ctx.fillRect(ROAD.x, 0, ROAD.width, HEIGHT);

    ctx.fillStyle = colors.line;
    for (let divider = 1; divider < LANE_COUNT; divider++) {
      const x = ROAD.x + LANE_WIDTH * divider - 2;
      for (let y = -84 + roadOffset; y < HEIGHT; y += 84) {
        roundedRect(x, y, 4, 45, 2, "rgba(255, 248, 213, .7)");
      }
    }
    for (let i = 0; i < 15; i++) {
      const y = (i * 53 + roadOffset) % (HEIGHT + 20);
      ctx.fillStyle = i % 2 ? "#e9c475" : "#f2e3b7";
      ctx.beginPath();
      ctx.arc(ROAD.x - 4, y, 2.5, 0, Math.PI * 2);
      ctx.arc(ROAD.x + ROAD.width + 4, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    drawBush(80, 128);
    drawBush(803, 355);
    drawFlower(130, 371);
    drawFlower(773, 117);
    drawSign();
  }

  function drawBush(x, y) {
    ctx.fillStyle = "#7daa70";
    [[0, 0, 23], [19, -8, 20], [38, 2, 18], [17, 8, 21]].forEach(([dx, dy, r]) => {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#a6ca85";
    ctx.beginPath();
    ctx.arc(x + 14, y - 10, 6, 0, Math.PI * 2);
    ctx.arc(x + 38, y - 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFlower(x, y) {
    ctx.fillStyle = "#6e9d69";
    ctx.fillRect(x - 1, y, 2, 17);
    ctx.fillStyle = "#f4d96b";
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * 5, y + Math.sin(angle) * 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#d57852";
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSign() {
    const x = 765;
    const y = 228;
    ctx.fillStyle = "#8b7654";
    ctx.fillRect(x + 19, y + 23, 6, 64);
    roundedRect(x, y, 44, 31, 8, "#fbf2d7");
    ctx.fillStyle = "#708867";
    ctx.font = "700 9px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SLOW", x + 22, y + 19);
    ctx.textAlign = "start";
  }

  function drawApple(item) {
    const x = laneCenter(item.lane);
    const y = item.y + Math.sin(item.wobble + elapsed * 4) * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(30, 38, 32, .16)";
    ctx.beginPath();
    ctx.ellipse(0, 17, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.apple;
    ctx.beginPath();
    ctx.arc(-7, 0, 10, 0, Math.PI * 2);
    ctx.arc(7, 0, 10, 0, Math.PI * 2);
    ctx.quadraticCurveTo(0, 20, -14, 8);
    ctx.fill();
    ctx.strokeStyle = "#7a5439";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.quadraticCurveTo(0, -17, 4, -18);
    ctx.stroke();
    ctx.fillStyle = "#83aa68";
    ctx.beginPath();
    ctx.ellipse(8, -14, 6, 3, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, .38)";
    ctx.beginPath();
    ctx.ellipse(-10, -3, 3, 5, -.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawVehicle(item) {
    const x = laneCenter(item.lane);
    const isBus = item.kind === "bus";
    const width = isBus ? 82 : 65;
    const height = isBus ? 113 : 91;
    ctx.save();
    ctx.translate(x, item.y);
    ctx.fillStyle = "rgba(30, 38, 32, .2)";
    ctx.beginPath();
    ctx.ellipse(4, height / 2 + 6, width / 2 + 4, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    roundedRect(-width / 2 + 4, 7, 7, 22, 3, "#35423e");
    roundedRect(width / 2 - 11, 7, 7, 22, 3, "#35423e");
    roundedRect(-width / 2 + 4, height - 29, 7, 21, 3, "#35423e");
    roundedRect(width / 2 - 11, height - 29, 7, 21, 3, "#35423e");
    roundedRect(-width / 2, 0, width, height, isBus ? 15 : 19, isBus ? "#edaa4f" : item.color);
    roundedRect(-width / 2 + 9, 11, width - 18, isBus ? 34 : 29, 9, "#b8d8d6");
    ctx.fillStyle = "rgba(255, 255, 255, .32)";
    roundedRect(-width / 2 + 13, 14, 8, isBus ? 27 : 20, 4, "rgba(255,255,255,.3)");
    if (isBus) {
      roundedRect(-width / 2 + 10, 52, width - 20, 23, 5, "#f4d993");
      roundedRect(-width / 2 + 10, 83, 12, 13, 3, "#fff1c7");
      roundedRect(-6, 83, 12, 13, 3, "#fff1c7");
      roundedRect(width / 2 - 22, 83, 12, 13, 3, "#fff1c7");
      ctx.fillStyle = "#fff4ce";
      ctx.font = "700 8px 'DM Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SCHOOL BUS", 0, 68);
    } else {
      roundedRect(-width / 2 + 10, 49, width - 20, 22, 7, "rgba(255,255,255,.22)");
      roundedRect(-width / 2 + 10, height - 11, 11, 5, 2, "#ffe4a4");
      roundedRect(width / 2 - 21, height - 11, 11, 5, 2, "#ffe4a4");
    }
    ctx.restore();
  }

  function drawDog() {
    const x = laneCenter(lane);
    const bouncing = state === "playing" ? Math.sin(elapsed * 13) * 3 : 0;
    const y = DOG_Y + bouncing;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = "rgba(30, 38, 32, .23)";
    ctx.beginPath();
    ctx.ellipse(0, 33 - bouncing, 35, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wagging tail
    ctx.strokeStyle = "#aa7447";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(22, 2);
    ctx.quadraticCurveTo(40, -13 + Math.sin(elapsed * 15) * 7, 34, -23);
    ctx.stroke();

    // Back paws and body
    roundedRect(-24, 16, 14, 20, 7, "#b67d4c");
    roundedRect(10, 16, 14, 20, 7, "#b67d4c");
    ctx.fillStyle = "#c18a55";
    ctx.beginPath();
    ctx.ellipse(0, 4, 31, 23, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#efd2a2";
    ctx.beginPath();
    ctx.ellipse(0, 11, 19, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = "#875937";
    ctx.beginPath();
    ctx.ellipse(-21, -19, 9, 16, -0.35, 0, Math.PI * 2);
    ctx.ellipse(21, -19, 9, 16, 0.35, 0, Math.PI * 2);
    ctx.fill();
    // Face
    ctx.fillStyle = "#d5a36d";
    ctx.beginPath();
    ctx.arc(0, -15, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6e5c5";
    ctx.beginPath();
    ctx.ellipse(0, -8, 15, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#36433b";
    ctx.beginPath();
    ctx.arc(-9, -18, 2.4, 0, Math.PI * 2);
    ctx.arc(9, -18, 2.4, 0, Math.PI * 2);
    ctx.arc(0, -10, 3.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#805d45";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.quadraticCurveTo(-2, -3, -6, -5);
    ctx.moveTo(0, -7);
    ctx.quadraticCurveTo(2, -3, 6, -5);
    ctx.stroke();

    // Collar and tag
    ctx.strokeStyle = "#e57c58";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 2, 21, 0.25, Math.PI - 0.25);
    ctx.stroke();
    ctx.fillStyle = "#f3ce6a";
    ctx.beginPath();
    ctx.arc(0, 18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(particle.life / 0.65, 0);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawBackground();
    for (const item of objects) {
      if (item.kind === "apple") drawApple(item);
      else drawVehicle(item);
    }
    drawDog();
    drawParticles();
  }

  function playSound(type) {
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      const sounds = {
        apple: [610, 930, 0.14],
        step: [270, 200, 0.055],
        hit: [190, 72, 0.32]
      };
      const [from, to, duration] = sounds[type];
      oscillator.type = type === "hit" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(from, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(to, audioContext.currentTime + duration);
      gain.gain.setValueAtTime(0.001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(type === "hit" ? 0.16 : 0.07, audioContext.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration + 0.02);
    } catch {
      // Audio is an enhancement; gameplay does not depend on it.
    }
  }

  document.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") move(-1);
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") move(1);
    if ((event.key === " " || event.key === "Enter") && state !== "playing") resumeGame();
  });

  playButton.addEventListener("click", resumeGame);
  document.querySelectorAll(".move-button").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      move(Number(button.dataset.move));
    });
  });
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("blur", () => {
    if (state === "playing") {
      state = "paused";
      cancelAnimationFrame(animationFrame);
      overlaySticker.textContent = "🐾";
      overlayKicker.textContent = "TAKE A BREATHER";
      overlayTitle.innerHTML = "Ready when<br>you are!";
      overlayCopy.textContent = "Biscuit is taking a quick sniff break.";
      playButton.innerHTML = 'Keep running <span aria-hidden="true">→</span>';
      overlay.classList.remove("is-hidden");
    }
  });

  document.getElementById("mission-progress").addEventListener("transitionend", () => {
    if (score === 10) missionHint.textContent = "Apple expert! Biscuit approves.";
  });
})();
