// Tup Duck Jump：長押しで溜めて、離して羽ばたき、向かってくる敵をよけて飛ぶ横スクロールアクション
(function () {
  "use strict";
  const store = {
    get(k, d) { try { const v = localStorage.getItem("tupduck:" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("tupduck:" + k, JSON.stringify(v)); } catch (e) { /* 保存できない環境では無視 */ } }
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- 画面（高さ540の仮想座標で描く） ---------- */
  const VH = 540;
  const canvas = document.getElementById("game"), ctx = canvas.getContext("2d");
  let VW = 960, scale = 1;
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    scale = canvas.height / VH;
    VW = canvas.width / scale;
  }
  window.addEventListener("resize", resize);
  resize();

  /* ---------- 画像 ---------- */
  const SRC = {
    duck: "duck.png", duckSun: "duck-sunglasses.png", duckProp: "duck-propeller.png",
    heart: "heart.png", heartEmpty: "heart-empty.png", coin: "coin.png", nut: "nut.png",
    magnet: "magnet.png", sunglasses: "sunglasses.png", propeller: "propeller.png",
    airplane: "airplane.png", lightning: "lightning.png", meteor: "meteor.png", ufo: "ufo.png",
    jellyfish: "jellyfish.png", fish: "fish.png", bgSky: "bg-sky.jpg"
  };
  const PIXEL = { heart: 1, heartEmpty: 1, coin: 1, nut: 1, magnet: 1, sunglasses: 1, propeller: 1 }; // ドット絵はくっきり描く
  const IMG = {};
  function loadAll() {
    return Promise.all(Object.keys(SRC).map((k) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { IMG[k] = im; res(); };
      im.onerror = () => res();
      im.src = "assets/" + SRC[k];
    })));
  }
  function sprite(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.lineJoin = "round"; g.lineCap = "round";
    draw(g);
    return c;
  }
  // パワポの元画像には素材サイトの透かしがあったため、同じ雰囲気で描き直したもの
  IMG.rocket = sprite(260, 120, (g) => {
    g.fillStyle = "#ff8a3d"; g.beginPath(); g.moveTo(74, 42); g.quadraticCurveTo(14, 28, 2, 60); g.quadraticCurveTo(14, 92, 74, 78); g.closePath(); g.fill();
    g.fillStyle = "#ffd84a"; g.beginPath(); g.moveTo(74, 50); g.quadraticCurveTo(34, 46, 24, 60); g.quadraticCurveTo(34, 74, 74, 70); g.closePath(); g.fill();
    g.strokeStyle = "#5a2b2b"; g.lineWidth = 4; g.fillStyle = "#e8443a";
    g.beginPath(); g.moveTo(100, 38); g.lineTo(74, 8); g.lineTo(136, 36); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(100, 82); g.lineTo(74, 112); g.lineTo(136, 84); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#f4f6f8"; g.beginPath(); g.moveTo(78, 36); g.lineTo(200, 32); g.quadraticCurveTo(250, 40, 258, 60); g.quadraticCurveTo(250, 80, 200, 88); g.lineTo(78, 84); g.quadraticCurveTo(68, 60, 78, 36); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#e8443a"; g.beginPath(); g.moveTo(212, 33); g.quadraticCurveTo(252, 42, 258, 60); g.quadraticCurveTo(252, 78, 212, 87); g.quadraticCurveTo(224, 60, 212, 33); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#e8443a"; g.fillRect(96, 55, 52, 10);
    g.fillStyle = "#8fd0f5"; g.beginPath(); g.arc(172, 60, 15, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#9aa3ad"; g.lineWidth = 5; g.stroke();
    g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.arc(167, 55, 5, 0, Math.PI * 2); g.fill();
  });
  IMG.whale = sprite(300, 130, (g) => {
    g.strokeStyle = "#3d4a61"; g.lineWidth = 4; g.fillStyle = "#6f86a8";
    g.beginPath(); g.moveTo(62, 62); g.quadraticCurveTo(30, 40, 8, 28); g.quadraticCurveTo(26, 62, 10, 98); g.quadraticCurveTo(36, 82, 62, 70); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(55, 60); g.quadraticCurveTo(110, 20, 210, 26); g.quadraticCurveTo(285, 32, 294, 64); g.quadraticCurveTo(286, 92, 220, 100); g.quadraticCurveTo(120, 106, 55, 72); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#c9d6e6"; g.beginPath(); g.moveTo(150, 97); g.quadraticCurveTo(232, 104, 288, 76); g.quadraticCurveTo(250, 90, 150, 86); g.closePath(); g.fill();
    g.strokeStyle = "#9fb0c8"; g.lineWidth = 2;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(170 + i * 22, 92 + i * 0.5); g.lineTo(196 + i * 20, 90 - i * 2); g.stroke(); }
    g.fillStyle = "#a8bad3";
    [[110, 50, 4], [140, 40, 5], [170, 46, 3.5], [200, 36, 4.5], [230, 46, 3], [150, 62, 3], [185, 60, 4], [125, 66, 3], [215, 58, 3.5], [250, 42, 3]].forEach((s) => { g.beginPath(); g.arc(s[0], s[1], s[2], 0, Math.PI * 2); g.fill(); });
    g.fillStyle = "#5d7396"; g.strokeStyle = "#3d4a61"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(192, 92); g.quadraticCurveTo(176, 122, 150, 124); g.quadraticCurveTo(170, 104, 176, 92); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#1f2633"; g.beginPath(); g.arc(258, 64, 4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#3d4a61"; g.lineWidth = 3; g.beginPath(); g.moveTo(292, 68); g.quadraticCurveTo(270, 78, 240, 76); g.stroke();
  });
  IMG.bag = sprite(150, 160, (g) => {
    g.strokeStyle = "#2b2b2b"; g.lineWidth = 4; g.fillStyle = "#ffffff";
    g.beginPath(); g.moveTo(38, 58); g.quadraticCurveTo(26, 16, 46, 6); g.quadraticCurveTo(56, 4, 54, 14); g.quadraticCurveTo(46, 30, 58, 56); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(96, 56); g.quadraticCurveTo(108, 30, 104, 18); g.quadraticCurveTo(112, 10, 122, 22); g.quadraticCurveTo(124, 40, 114, 58); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(34, 54); g.quadraticCurveTo(76, 62, 118, 52); g.quadraticCurveTo(146, 110, 130, 142); g.quadraticCurveTo(76, 160, 20, 142); g.quadraticCurveTo(6, 108, 34, 54); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#dcd6d6";
    g.beginPath(); g.moveTo(36, 128); g.quadraticCurveTo(76, 112, 118, 126); g.quadraticCurveTo(80, 136, 36, 128); g.fill();
    g.beginPath(); g.moveTo(28, 90); g.quadraticCurveTo(40, 76, 44, 64); g.quadraticCurveTo(46, 82, 28, 90); g.fill();
    g.beginPath(); g.moveTo(104, 80); g.quadraticCurveTo(118, 96, 126, 116); g.quadraticCurveTo(110, 104, 104, 80); g.fill();
    g.fillStyle = "#ffffff"; g.lineWidth = 3; g.beginPath(); g.roundRect(64, 54, 16, 28, 6); g.fill(); g.stroke();
    g.beginPath(); g.arc(72, 74, 3.5, 0, Math.PI * 2); g.stroke();
  });

  /* ---------- ステージ（空 → 宇宙 → 水中 → 空…、500mごと） ---------- */
  const STAGE_LEN = 500;
  const STAGES = [
    { name: "空", gravity: 750, maxFall: 460, flapMul: 1, drag: 0,
      enemies: [{ img: "airplane", h: 78, own: 50 }, { img: "lightning", h: 46, own: 320, hitH: 0.45 }, { img: "bag", h: 64, own: 40, wave: true }] },
    { name: "宇宙", gravity: 380, maxFall: 300, flapMul: 1.08, drag: 0, // 高く飛び、落ちづらくなる
      enemies: [{ img: "rocket", h: 66, own: 50 }, { img: "meteor", h: 54, own: 320, flip: true }, { img: "ufo", h: 56, own: 40, wave: true }] },
    { name: "水中", gravity: 560, maxFall: 340, flapMul: 0.72, drag: 2.2, // 操作が重くなる
      enemies: [{ img: "whale", h: 92, own: 40 }, { img: "fish", h: 40, own: 320 }, { img: "jellyfish", h: 66, own: 40, wave: true }] }
  ];
  const stageIndex = (m) => Math.floor(m / STAGE_LEN) % STAGES.length;

  /* ---------- 定数 ---------- */
  const SPEED_START = 260, SPEED_MAX = 760;
  const FLAP_MIN = 230, FLAP_MAX = 760; // 軽くタップは小さく、しっかり溜めると大きく羽ばたく
  const LIVES_START = 3, HURT_INV = 1.5;
  const GIRI_GAP = 26;                 // この距離以内でよけたら「ギリギリ」
  const DODGE_V = 760, DODGE_INV = 0.35, DODGE_CD = 1.1;
  const ITEMS = {
    sunglasses: { icon: "sunglasses", dur: 8, label: "サングラス：スピードアップ＆スコア2倍" },
    magnet: { icon: "magnet", dur: 9, label: "マグネット：まわりのコインや木の実を集める" },
    propeller: { icon: "propeller", dur: 6, label: "プロペラ帽：無敵！敵を倒せる" }
  };

  /* ---------- 状態 ---------- */
  let state = "loading"; // loading | title | playing | over
  let duck, enemies, pickups, items, popups, parts;
  let speed, distPx, score, coins, lives, inv, dodgeCd, charge, holding, item, itemT;
  let enemyT, pickupT, itemSpawnT, stage, stageBanner, bgOff, time, shake, giriFlash, flapT;
  let best = store.get("best", 0);
  const meters = () => distPx / 40;

  function reset() {
    duck = { x: 0, y: VH * 0.45, vy: 0 };
    enemies = []; pickups = []; items = []; popups = []; parts = [];
    speed = SPEED_START; distPx = 0; score = 0; coins = 0; lives = LIVES_START;
    inv = 0; dodgeCd = 0; charge = 0; holding = false; item = null; itemT = 0;
    enemyT = 1.2; pickupT = 0.8; itemSpawnT = rnd(9, 13); stage = 0; stageBanner = 2.2;
    shake = 0; giriFlash = 0; flapT = 0;
  }
  reset();
  bgOff = 0; time = 0;

  function duckImg() { return item === "sunglasses" ? IMG.duckSun : item === "propeller" ? IMG.duckProp : IMG.duck; }
  const DUCK_H = 70;
  function duckBox() { // 当たり判定（体のまんなかあたり）
    return { x: duck.x - DUCK_H * 0.75, y: duck.y - DUCK_H * 0.22, w: DUCK_H * 1.4, h: DUCK_H * 0.48 };
  }
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  /* ---------- 出現 ---------- */
  function spawnEnemy(def, y) {
    const im = IMG[def.img]; if (!im) return;
    const h = def.h, w = h * im.width / im.height;
    enemies.push({ def, im, w, h, x: -w / 2 - 10, baseY: y, y, t: Math.random() * 6, passed: false, dead: false, vy: 0, rot: 0 });
  }
  function spawnEnemies() {
    const st = STAGES[stage];
    const def = pick(st.enemies);
    // 一部はアヒルの高さを狙う（画面の端にじっとしていれば安全、にならないように）
    const y1 = Math.random() < 0.4 ? clamp(duck.y + rnd(-40, 40), 30, VH - 30) : rnd(30, VH - 30);
    spawnEnemy(def, y1);
    const ratio = (speed - SPEED_START) / (SPEED_MAX - SPEED_START);
    if (Math.random() < 0.18 + ratio * 0.3) { // 速くなると2体同時も
      let y2 = rnd(30, VH - 30);
      if (Math.abs(y2 - y1) < 150) y2 = y1 < VH / 2 ? y1 + rnd(160, 260) : y1 - rnd(160, 260);
      spawnEnemy(pick(st.enemies), clamp(y2, 30, VH - 30));
    }
  }
  function spawnPickups() {
    const y = rnd(60, VH - 60);
    if (Math.random() < 0.3) { pickups.push({ kind: "nut", x: -30, y, r: 16 }); return; }
    const n = 5, arc = Math.random() < 0.5;
    for (let i = 0; i < n; i++) {
      pickups.push({ kind: "coin", x: -30 - i * 44, y: y + (arc ? -Math.sin(i / (n - 1) * Math.PI) * 60 : 0), r: 14 });
    }
  }
  function spawnItem() {
    items.push({ kind: pick(Object.keys(ITEMS)), x: -40, y: rnd(80, VH - 80), t: 0 });
  }

  function popup(text, x, y, color, big) { popups.push({ text, x, y, color: color || "#fff", t: 0, big: !!big }); }
  function sparkle(x, y, color, n) {
    for (let i = 0; i < (n || 8); i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(60, 220);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rnd(0.3, 0.6), color: color || "#ffe066" });
    }
  }

  /* ---------- 入力：長押しで溜め、離して羽ばたく／下スワイプで緊急回避 ---------- */
  let downY = 0, downT = 0, gestureUsed = false;
  function flap() {
    const st = STAGES[stage];
    const c = Math.max(0.12, charge);
    duck.vy = -(FLAP_MIN + (FLAP_MAX - FLAP_MIN) * c) * st.flapMul;
    flapT = 0.18;
    sparkle(duck.x + 30, duck.y + 10, "rgba(255,255,255,.9)", 4);
  }
  function dodge() {
    if (dodgeCd > 0) return;
    duck.vy = DODGE_V;
    inv = Math.max(inv, DODGE_INV);
    dodgeCd = DODGE_CD;
    popup("緊急回避！", duck.x, duck.y - 50, "#9be7ff");
  }
  window.addEventListener("pointerdown", (e) => {
    if (state !== "playing" || (e.target.closest && e.target.closest("button, #announce"))) return;
    holding = true; charge = 0; gestureUsed = false;
    downY = e.clientY; downT = performance.now();
  });
  window.addEventListener("pointermove", (e) => {
    if (state !== "playing" || !holding || gestureUsed) return;
    const dy = (e.clientY - downY) / (window.innerHeight / VH);
    if (dy > 45 && performance.now() - downT < 400) { gestureUsed = true; holding = false; charge = 0; dodge(); }
  });
  function release() {
    if (state !== "playing" || !holding) return;
    holding = false;
    if (!gestureUsed) flap();
    charge = 0;
  }
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", () => { holding = false; charge = 0; });

  /* ---------- 更新 ---------- */
  function hurt() {
    lives--;
    inv = HURT_INV;
    shake = 0.35;
    popup("いたっ！", duck.x, duck.y - 50, "#ff8080");
    if (lives <= 0) gameOver();
  }

  function update(dt) {
    time += dt;
    if (state !== "playing") { bgOff += 60 * dt; return; }
    const st = STAGES[stage];
    const ratio = (speed - SPEED_START) / (SPEED_MAX - SPEED_START);

    // 飛んだ距離が長いほど速く（サングラス中はさらに速く）
    const base = Math.min(SPEED_MAX, SPEED_START + distPx * 0.009);
    speed = base * (item === "sunglasses" ? 1.3 : 1);
    const mult = item === "sunglasses" ? 2 : 1;
    distPx += speed * dt;
    bgOff += speed * dt;
    score += speed * dt * 0.1 * mult;

    const ns = stageIndex(meters());
    if (ns !== stage) { stage = ns; stageBanner = 2.2; }
    if (stageBanner > 0) stageBanner -= dt;

    // 溜め：速くなるほど早く溜まる
    if (holding) charge = Math.min(1, charge + dt / clamp(0.5 - ratio * 0.25, 0.25, 0.5));

    // アヒルの動き
    duck.x = VW * 0.74;
    duck.vy += st.gravity * dt;
    if (st.drag) duck.vy *= Math.exp(-st.drag * dt);
    const diving = dodgeCd > DODGE_CD - 0.25; // 緊急回避の直後0.25秒だけは急降下を許す
    if (duck.vy > st.maxFall && !diving) duck.vy = st.maxFall; // 落ちる速さに上限
    duck.y += duck.vy * dt;
    if (duck.y < 30) { duck.y = 30; duck.vy = Math.max(0, duck.vy); }
    if (duck.y > VH - 30) { duck.y = VH - 30; duck.vy = Math.min(0, duck.vy); }
    if (inv > 0) inv -= dt;
    if (dodgeCd > 0) dodgeCd -= dt;
    if (flapT > 0) flapT -= dt;
    if (shake > 0) shake -= dt;
    if (giriFlash > 0) giriFlash -= dt;
    if (item) { itemT -= dt; if (itemT <= 0) item = null; }

    // 出現
    enemyT -= dt;
    if (enemyT <= 0) { spawnEnemies(); enemyT = clamp(1.3 - ratio * 0.85, 0.42, 1.3) * rnd(0.8, 1.2); }
    pickupT -= dt;
    if (pickupT <= 0) { spawnPickups(); pickupT = rnd(1.4, 2.4); }
    itemSpawnT -= dt;
    if (itemSpawnT <= 0) { spawnItem(); itemSpawnT = rnd(12, 20); }

    const db = duckBox();

    // 敵：右へまっすぐ（ゆらゆら型は上下しながら右へ）
    enemies.forEach((en) => {
      en.t += dt;
      if (en.dead) {
        en.x += (speed * 0.5) * dt; en.vy += 900 * dt; en.y += en.vy * dt; en.rot += 8 * dt;
        return;
      }
      en.x += (speed + en.def.own) * dt;
      en.y = en.def.wave ? en.baseY + Math.sin(en.t * 1.8) * 70 : en.baseY;
      const hb = { x: en.x - en.w * 0.38, w: en.w * 0.76, y: en.y - en.h * (en.def.hitH || 0.6) / 2, h: en.h * (en.def.hitH || 0.6) };
      if (overlap(db, hb)) {
        if (item === "propeller") { // 無敵中は敵を倒せる
          en.dead = true; en.vy = -300;
          score += 100 * mult;
          popup("+" + 100 * mult + "p", en.x, en.y - 30, "#ffe066");
          sparkle(en.x, en.y, "#ffe066", 12);
        } else if (inv <= 0) {
          en.passed = true; // 当たった敵ではギリギリ判定をしない
          hurt();
        }
        return;
      }
      // ギリギリ回避：アヒルの横を通り過ぎた瞬間、上下のすきまが小さければボーナス
      if (!en.passed && hb.x > db.x + db.w) {
        en.passed = true;
        const gap = Math.max(hb.y - (db.y + db.h), db.y - (hb.y + hb.h));
        if (gap >= 0 && gap < GIRI_GAP) {
          score += 500 * mult;
          giriFlash = 0.5;
          popup("GIRIGIRI!!! +" + 500 * mult, duck.x - 40, duck.y - 60, "#ffcf33", true);
        }
      }
    });
    enemies = enemies.filter((en) => en.x - en.w / 2 < VW + 40 && en.y < VH + 200);

    // コイン・木の実（マグネット中は吸い寄せる）
    pickups.forEach((p) => {
      p.x += speed * dt;
      if (item === "magnet") {
        const dx = duck.x - p.x, dy = duck.y - p.y, d = Math.hypot(dx, dy);
        if (d < 260) { p.x += dx / d * 520 * dt; p.y += dy / d * 520 * dt; }
      }
      if (Math.hypot(p.x - duck.x, p.y - duck.y) < p.r + 34) {
        p.got = true;
        if (p.kind === "coin") { coins++; popup("+1C", p.x, p.y - 20, "#ffe066"); sparkle(p.x, p.y, "#ffe066", 5); }
        else { score += 50 * mult; popup("+" + 50 * mult + "p", p.x, p.y - 20, "#b8f28a"); sparkle(p.x, p.y, "#b8f28a", 6); }
      }
    });
    pickups = pickups.filter((p) => !p.got && p.x < VW + 40);

    // アイテム
    items.forEach((it) => {
      it.t += dt;
      it.x += speed * dt;
      const y = it.y + Math.sin(it.t * 3) * 10;
      if (Math.hypot(it.x - duck.x, y - duck.y) < 50) {
        it.got = true;
        item = it.kind; itemT = ITEMS[it.kind].dur;
        popup(ITEMS[it.kind].label, VW / 2, 120, "#fff", true);
        sparkle(it.x, y, "#ffffff", 14);
      }
    });
    items = items.filter((it) => !it.got && it.x < VW + 60);

    popups.forEach((p) => { p.t += dt; p.y -= 40 * dt; });
    popups = popups.filter((p) => p.t < 1.1);
    parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    parts = parts.filter((p) => p.t < p.life);
  }

  /* ---------- 背景 ---------- */
  const STARS = [0, 1, 2].map((layer) => Array.from({ length: 70 }, () => ({ x: Math.random() * 1600, y: Math.random() * VH * 0.8, r: rnd(0.6, 1.8) + layer * 0.5, tw: Math.random() * 6 })));
  const WEEDS = Array.from({ length: 14 }, (_, i) => ({ x: i * 115 + rnd(-30, 30), h: rnd(60, 140), ph: Math.random() * 6 }));
  const ROCKS = Array.from({ length: 6 }, (_, i) => ({ x: i * 280 + rnd(-40, 40), w: rnd(120, 220), h: rnd(70, 160) }));
  const BUBBLES = Array.from({ length: 26 }, () => ({ x: Math.random() * 1600, y: Math.random() * VH, r: rnd(2, 6), s: rnd(20, 60) }));

  function drawSky(off) {
    const im = IMG.bgSky;
    if (!im) { ctx.fillStyle = "#3f8fd6"; ctx.fillRect(0, 0, VW, VH); return; }
    const w = im.width * (VH / im.height), o = (off * 0.25) % (w * 2);
    for (let i = -2; i * w < VW + w; i++) {
      const x = o + i * w;
      ctx.save();
      if (((i % 2) + 2) % 2 === 1) { ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, w, VH); } // 左右反転して継ぎ目を目立たなくする
      else ctx.drawImage(im, x, 0, w, VH);
      ctx.restore();
    }
  }
  function drawSpace(off) {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, "#030716"); g.addColorStop(0.7, "#0b1a45"); g.addColorStop(1, "#163a7a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    STARS.forEach((layer, li) => {
      const o = (off * (0.03 + li * 0.05)) % 1600;
      layer.forEach((s) => {
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 2 + s.tw);
        ctx.fillStyle = "#fff";
        for (let x = ((s.x + o) % 1600) - 1600; x < VW; x += 1600) { ctx.beginPath(); ctx.arc(x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
      });
    });
    ctx.globalAlpha = 1;
    // 地球のふち（パワポの宇宙の背景の雰囲気）
    const cx = VW / 2, cy = VH + 1500, r = 1600;
    const eg = ctx.createRadialGradient(cx, cy, r - 120, cx, cy, r + 30);
    eg.addColorStop(0, "#1b3f86"); eg.addColorStop(0.9, "#3d7fd6"); eg.addColorStop(0.97, "#9fe1ff"); eg.addColorStop(1, "rgba(159,225,255,0)");
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(cx, cy, r + 30, 0, Math.PI * 2); ctx.fill();
  }
  function drawWater(off) {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, "#3b8fd9"); g.addColorStop(0.55, "#1c5fae"); g.addColorStop(1, "#0b2a5c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = "rgba(255,255,255,.07)"; // 上から差しこむ光
    for (let i = 0; i < 6; i++) {
      const x = (i / 6) * VW + Math.sin(time * 0.5 + i) * 30;
      ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 140, VH); ctx.lineTo(x + 40, VH); ctx.closePath(); ctx.fill();
    }
    const ro = (off * 0.12) % 1680;
    ctx.fillStyle = "#10376f";
    ROCKS.forEach((r) => {
      for (let x = ((r.x + ro) % 1680) - 1680; x < VW + 200; x += 1680) {
        ctx.beginPath(); ctx.moveTo(x, VH); ctx.quadraticCurveTo(x + r.w * 0.2, VH - r.h, x + r.w * 0.5, VH - r.h * 0.9); ctx.quadraticCurveTo(x + r.w * 0.85, VH - r.h * 0.6, x + r.w, VH); ctx.fill();
      }
    });
    const wo = (off * 0.4) % 1610;
    ctx.strokeStyle = "#0d2e5e"; ctx.lineWidth = 9;
    WEEDS.forEach((w) => {
      for (let x = ((w.x + wo) % 1610) - 1610; x < VW + 40; x += 1610) {
        const sway = Math.sin(time * 1.6 + w.ph) * 18;
        ctx.beginPath(); ctx.moveTo(x, VH + 5); ctx.quadraticCurveTo(x + sway, VH - w.h / 2, x + sway * 1.6, VH - w.h); ctx.stroke();
      }
    });
    ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 1.5;
    BUBBLES.forEach((b) => {
      const y = ((b.y - time * b.s) % VH + VH) % VH;
      for (let x = ((b.x + off * 0.2) % 1600) - 1600; x < VW; x += 1600) { ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.stroke(); }
    });
  }
  const BG = [drawSky, drawSpace, drawWater];

  /* ---------- 描画 ---------- */
  function drawImg(im, x, y, w, h, key) {
    ctx.imageSmoothingEnabled = !PIXEL[key];
    ctx.drawImage(im, x, y, w, h);
    ctx.imageSmoothingEnabled = true;
  }
  function render() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    let sx = 0, sy = 0;
    if (shake > 0) { sx = rnd(-6, 6); sy = rnd(-6, 6); }
    ctx.translate(sx, sy);
    BG[state === "playing" || state === "over" ? stage : 0](bgOff);

    if (giriFlash > 0) { // ギリギリのときの集中線
      ctx.save(); ctx.globalAlpha = giriFlash * 1.4; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
      for (let i = 0; i < 40; i++) {
        const a = i / 40 * Math.PI * 2, r1 = 140 + (i % 3) * 30;
        ctx.beginPath(); ctx.moveTo(duck.x + Math.cos(a) * r1, duck.y + Math.sin(a) * r1); ctx.lineTo(duck.x + Math.cos(a) * 900, duck.y + Math.sin(a) * 900); ctx.stroke();
      }
      ctx.restore();
    }

    pickups.forEach((p) => {
      const im = p.kind === "coin" ? IMG.coin : IMG.nut; if (!im) return;
      const h = p.r * 2.4, w = h * im.width / im.height;
      const squash = p.kind === "coin" ? Math.abs(Math.cos(time * 4 + p.x * 0.02)) * 0.7 + 0.3 : 1; // コインはくるくる回る
      drawImg(im, p.x - w * squash / 2, p.y - h / 2, w * squash, h, p.kind);
    });

    items.forEach((it) => {
      const y = it.y + Math.sin(it.t * 3) * 10, im = IMG[ITEMS[it.kind].icon]; if (!im) return;
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(it.x, y, 34 + Math.sin(time * 6) * 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 3; ctx.stroke();
      const h = 40, w = h * im.width / im.height;
      drawImg(im, it.x - w / 2, y - h / 2, w, h, ITEMS[it.kind].icon);
    });

    enemies.forEach((en) => {
      ctx.save();
      ctx.translate(en.x, en.y);
      if (en.dead) ctx.rotate(en.rot);
      if (en.def.flip) ctx.scale(-1, 1);
      ctx.drawImage(en.im, -en.w / 2, -en.h / 2, en.w, en.h);
      ctx.restore();
    });

    if (state === "playing" || state === "over") {
      // アヒル（上昇中は頭が上がる、羽ばたいた瞬間に少しつぶれる）
      const im = duckImg();
      if (im && !(inv > 0 && item !== "propeller" && Math.floor(inv * 14) % 2 === 0)) {
        const h = DUCK_H * (item === "propeller" ? 1.22 : 1), w = h * im.width / im.height;
        ctx.save();
        ctx.translate(duck.x, duck.y);
        ctx.rotate(clamp(-duck.vy * 0.0006, -0.35, 0.35));
        const sq = flapT > 0 ? 1 - flapT * 0.8 : 1;
        ctx.scale(1 + (1 - sq) * 0.6, sq);
        if (item === "propeller") { ctx.shadowColor = "#fff6a0"; ctx.shadowBlur = 24; }
        ctx.drawImage(im, -w / 2, -h * 0.55, w, h);
        ctx.restore();
      }
      // 溜めゲージ（アヒルの下）
      if (holding) {
        const gx = duck.x - 40, gy = duck.y + 42;
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.roundRect(gx, gy, 80, 10, 5); ctx.fill();
        ctx.fillStyle = charge >= 1 ? (Math.floor(time * 10) % 2 ? "#fff" : "#ffcf33") : "#ffcf33";
        ctx.beginPath(); ctx.roundRect(gx, gy, 80 * charge, 10, 5); ctx.fill();
      }
    }

    parts.forEach((p) => {
      ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    popups.forEach((p) => {
      ctx.globalAlpha = clamp(1.4 - p.t * 1.3, 0, 1);
      ctx.font = "900 " + (p.big ? 30 : 20) + "px 'Hiragino Sans','Yu Gothic UI',sans-serif";
      ctx.textAlign = "center"; ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.fillStyle = p.color;
      ctx.strokeText(p.text, p.x, p.y); ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (state === "playing") drawHud();
  }

  function hudText(t, x, y, size, align, color) {
    ctx.font = "900 " + size + "px 'Hiragino Sans','Yu Gothic UI',sans-serif";
    ctx.textAlign = align || "left"; ctx.lineWidth = 5; ctx.strokeStyle = "rgba(10,30,60,.6)"; ctx.fillStyle = color || "#fff";
    ctx.strokeText(t, x, y); ctx.fillText(t, x, y);
  }
  function drawHud() {
    hudText("SCORE：" + Math.floor(score), 20, 40, 28);
    if (IMG.coin) drawImg(IMG.coin, 22, 54, 18, 24, "coin");
    hudText(coins + " C", 48, 74, 20, "left", "#ffe066");
    hudText(Math.floor(meters()) + " m", 20, 100, 16, "left", "#e3f2ff");
    for (let i = 0; i < LIVES_START; i++) {
      const im = i < lives ? IMG.heart : IMG.heartEmpty;
      if (im) drawImg(im, VW - 46 - i * 42, 16, 34, 32, "heart");
    }
    if (item) {
      const im = IMG[ITEMS[item].icon];
      if (im) drawImg(im, VW - 150, 60, 44, 44 * im.height / im.width, ITEMS[item].icon);
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(VW - 98, 74, 78, 8);
      ctx.fillStyle = "#ffcf33"; ctx.fillRect(VW - 98, 74, 78 * itemT / ITEMS[item].dur, 8);
    }
    if (dodgeCd > 0) hudText("回避 " + dodgeCd.toFixed(1), VW - 20, 124, 14, "right", "#9be7ff");
    if (stageBanner > 0) {
      ctx.globalAlpha = clamp(stageBanner, 0, 1);
      hudText("STAGE " + (Math.floor(meters() / STAGE_LEN) + 1) + "：" + STAGES[stage].name, VW / 2, VH * 0.34, 40, "center", "#fff");
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- 画面の切り替え ---------- */
  const $ = (id) => document.getElementById(id);
  function startGame() {
    reset();
    state = "playing";
    $("title").hidden = true;
    $("over").hidden = true;
  }
  function gameOver() {
    state = "over";
    holding = false;
    const s = Math.floor(score);
    if (s > best) { best = s; store.set("best", best); }
    $("over-score").textContent = s;
    $("over-dist").textContent = Math.floor(meters());
    $("over-coins").textContent = coins;
    $("best-over").textContent = best;
    $("best-title").textContent = best;
    setTimeout(() => { $("over").hidden = false; }, 600);
  }
  $("start-btn").addEventListener("click", startGame);
  $("retry-btn").addEventListener("click", startGame);
  $("best-title").textContent = best;
  $("start-btn").disabled = true;
  loadAll().then(() => {
    state = "title";
    $("start-btn").disabled = false;
    $("loading").hidden = true;
  });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (window.TTAnnounce) window.TTAnnounce.checkAndShow();

  window.__duck = {
    get state() { return state; }, get score() { return score; }, get coins() { return coins; }, get lives() { return lives; },
    get meters() { return meters(); }, get y() { return duck.y; }, get vy() { return duck.vy; }, get charge() { return charge; },
    get stage() { return stage; }, get enemies() { return enemies.length; }, get item() { return item; }, get speed() { return speed; },
    // テスト用：距離や状態を直接動かす
    debug: { setMeters(m) { distPx = m * 40; }, giveItem(k) { item = k; itemT = ITEMS[k].dur; }, invincible(s) { inv = s; } }
  };
})();
