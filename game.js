/* Team United Christmas invite — Playfair Fun & Games
   Polished sprite-based court. No ads. No tracking. */
(function () {
  "use strict";

  const DEFAULTS = {
    hostName: "Mike Moncada",
    landingLine: "Mike Moncada is inviting you to a Christmas party!",
    landingSubline: "But only the worthy get the details!",
    howToPlay: [
      "Balls are tossed up for you. Tap or swipe a lane to hit each one.",
      "Send the ball at the snowmen before they waddle in for a hug.",
      "Get 8 hits to open the invite. A hug costs a heart, but it is all in fun.",
    ],
    eventName: "Team United Christmas Party",
    date: "Saturday, December 12, 2026",
    time: "4:00 PM",
    location: "223A Hickory Lane, Barrie",
    rsvp: "[RSVP]",
    rsvpEndpoint: "local",
    rsvpStorageKey: "playfair-team-united-rsvp",
    madeBy: "Playfair Fun & Games",
    tagline: "You're Invited to Play",
    hitsToWin: 8,
    lives: 3,
    failsBeforeAssist: 3,
    cookieContestNote:
      "Optional cookie contest! Must be homemade and Christmas themed.",
    privacyNote:
      "No ads. No tracking. The only information collected is what you type in the RSVP, if you choose to send it.",
  };

  const SPRITE_SRCS = {
    bg: "./assets/sprites/winter-bg.jpg",
    girlIdle: "./assets/sprites/girl-idle.png",
    girlToss: "./assets/sprites/girl-toss.png",
    girlSpike: "./assets/sprites/girl-spike.png",
    girlHug: "./assets/sprites/girl-hug.png",
    girlWin: "./assets/sprites/girl-win.png",
    ball: "./assets/sprites/volleyball.png",
    poof: "./assets/sprites/snow-poof.png",
    snowSanta: "./assets/sprites/snowman-santa.png",
    snowGreen: "./assets/sprites/snowman-green.png",
    snowHat: "./assets/sprites/snowman-tophat.png",
    snowHug: "./assets/sprites/snowman-hug.png",
    snowBaby: "./assets/sprites/snowman-baby.png",
  };

  const SNOW_TYPES = ["snowSanta", "snowGreen", "snowHat", "snowBaby"];

  /* Court corners in the 720x1280 background image. */
  const BG = { w: 720, h: 1280, farL: 255, farR: 475, farY: 530, nearL: 148, nearR: 518, nearY: 908, netY: 650 };

  let config = { ...DEFAULTS };
  let sprites = {};
  let audio, muted = false, unlocked = false;
  let raf = 0, running = false, state;
  let confetti = [];

  const screens = {
    loading: document.getElementById("screen-loading"),
    landing: document.getElementById("screen-landing"),
    howto: document.getElementById("screen-howto"),
    game: document.getElementById("screen-game"),
    reveal: document.getElementById("screen-reveal"),
  };
  const canvas = document.getElementById("court");
  const ctx = canvas.getContext("2d", { alpha: false });
  const hudHits = document.getElementById("hud-hits");
  const hudLives = document.getElementById("hud-lives");
  const assistBar = document.getElementById("assist-bar");
  const assistCopy = document.getElementById("assist-copy");
  const gameHint = document.getElementById("game-hint");

  function showScreen(name) {
    Object.keys(screens).forEach((key) => {
      if (screens[key]) screens[key].hidden = key !== name;
    });
    if (name === "game") startLevel();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fillFooters() {
    const html =
      "Made by <b>" +
      escapeHtml(config.madeBy) +
      '</b><span class="tag">' +
      escapeHtml(config.tagline) +
      "</span>";
    document.querySelectorAll(".madeby").forEach((el) => {
      el.innerHTML = html;
    });
  }

  function applyConfig() {
    document.getElementById("landing-line").textContent = config.landingLine;
    const kicker = document.getElementById("landing-kicker");
    if (kicker) kicker.textContent = config.tagline;
    const sub = document.getElementById("landing-subline");
    if (sub) sub.textContent = config.landingSubline || "";
    const list = document.getElementById("howto-lines");
    list.innerHTML = "";
    (config.howToPlay || DEFAULTS.howToPlay).forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    });
    document.getElementById("event-name").textContent = config.eventName;
    document.getElementById("field-date").textContent = config.date;
    document.getElementById("field-time").textContent = config.time;
    document.getElementById("field-location").textContent = config.location;
    const contestNote = (config.cookieContestNote || "").trim();
    const contestEl = document.getElementById("cookie-contest");
    const contestText = document.getElementById("cookie-contest-note");
    const contestLabel = document.getElementById("rsvp-cookie-label");
    if (contestText) contestText.textContent = contestNote;
    if (contestEl) contestEl.hidden = !contestNote;
    if (contestLabel) contestLabel.hidden = !contestNote;
    document.getElementById("privacy-note").textContent = config.privacyNote;
    document.getElementById("hud-goal").textContent = "/" + config.hitsToWin;
    fillFooters();
    setupRsvp();
  }

  function loadConfig() {
    return fetch("./config.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        config = { ...DEFAULTS, ...data };
      })
      .catch(() => {
        config = { ...DEFAULTS };
      })
      .then(applyConfig);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load " + src));
      img.src = src;
    });
  }

  function preloadSprites() {
    const keys = Object.keys(SPRITE_SRCS);
    let done = 0;
    const bar = document.getElementById("load-bar");
    return Promise.all(
      keys.map((key) =>
        loadImage(SPRITE_SRCS[key]).then((img) => {
          sprites[key] = img;
          done += 1;
          if (bar) bar.style.width = Math.round((done / keys.length) * 100) + "%";
        })
      )
    );
  }

  function ensureAudio() {
    if (audio) return audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio = new AC();
    return audio;
  }

  function unlockAudio() {
    const ctxA = ensureAudio();
    if (!ctxA) return;
    if (ctxA.state === "suspended") ctxA.resume();
    unlocked = true;
  }

  function beep(freq, dur, type, gain, slide) {
    if (muted || !unlocked) return;
    const actx = ensureAudio();
    if (!actx) return;
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.12, t + dur * 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function sfx(name) {
    if (name === "toss") beep(420, 0.1, "sine", 0.06, 520);
    else if (name === "spike") {
      beep(240, 0.1, "triangle", 0.14, 140);
      beep(680, 0.08, "sine", 0.05);
    } else if (name === "poof") {
      beep(880, 0.16, "sine", 0.09, 380);
      beep(280, 0.14, "triangle", 0.07);
    } else if (name === "hug") {
      beep(520, 0.16, "sine", 0.08);
      beep(660, 0.2, "sine", 0.07);
    } else if (name === "miss") beep(200, 0.16, "sine", 0.05, 120);
    else if (name === "win") {
      beep(523, 0.16, "sine", 0.1);
      setTimeout(() => beep(659, 0.16, "sine", 0.1), 110);
      setTimeout(() => beep(784, 0.28, "sine", 0.12), 220);
    } else if (name === "tap") beep(640, 0.06, "sine", 0.05);
  }

  function bgXform() {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const scale = Math.max(cw / BG.w, ch / BG.h);
    return { scale, ox: (cw - BG.w * scale) / 2, oy: (ch - BG.h * scale) / 2, cw, ch };
  }

  function toCanvas(x, y, xf) {
    return { x: xf.ox + x * xf.scale, y: xf.oy + y * xf.scale };
  }

  function lanePoint(lane, imgY, xf) {
    const t = (imgY - BG.farY) / (BG.nearY - BG.farY);
    const left = BG.farL + (BG.nearL - BG.farL) * t;
    const right = BG.farR + (BG.nearR - BG.farR) * t;
    const imgX = left + ((lane + 0.5) / 3) * (right - left);
    return toCanvas(imgX, imgY, xf);
  }

  function newState(assist) {
    return {
      hits: 0,
      lives: config.lives,
      fails: (state && state.fails) || 0,
      assist: !!assist,
      snowmen: [],
      fly: [],
      trails: [],
      snowFar: [],
      snowNear: [],
      particles: [],
      hearts: [],
      popups: [],
      poofs: [],
      spawnT: 0.35,
      toss: null,
      tossWait: 0.15,
      pose: "idle",
      poseT: 0,
      hugging: 0,
      shake: 0,
      flash: 0,
      last: 0,
      pointer: null,
      ended: false,
      time: 0,
    };
  }

  function resize() {
    const parent = canvas.parentElement;
    const hudH = document.getElementById("hud").offsetHeight;
    const footH = screens.game.querySelector(".madeby").offsetHeight;
    const assistH = assistBar.hidden ? 0 : assistBar.offsetHeight + 8;
    const hintH = gameHint.offsetHeight;
    const h = Math.max(320, parent.clientHeight - hudH - footH - assistH - hintH);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = "100%";
    canvas.style.height = h + "px";
    const w = canvas.clientWidth || parent.clientWidth;
    const visH = canvas.clientHeight || h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(visH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function startLevel() {
    if (raf) cancelAnimationFrame(raf);
    const keepFails = state && state.fails ? state.fails : 0;
    const assist = keepFails >= config.failsBeforeAssist;
    state = newState(assist);
    state.fails = keepFails;
    state.snowFar = flakeField(28, 0.04, 1.1);
    state.snowNear = flakeField(22, 0.1, 2.2);
    running = true;
    hudHits.textContent = "0";
    renderLives();
    updateAssistUI();
    resize();
    state.last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function flakeField(n, vmin, smax) {
    return Array.from({ length: n }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: 0.7 + Math.random() * smax,
      v: vmin + Math.random() * vmin * 2,
      drift: Math.random() * 6,
    }));
  }

  function renderLives() {
    hudLives.textContent = "❤ ".repeat(Math.max(0, state.lives)).trim() || "—";
  }

  function updateAssistUI() {
    const show = state.fails >= 2 || state.assist;
    assistBar.hidden = !show;
    if (state.assist) {
      assistCopy.textContent = "We turned on a little help. You can also skip.";
      gameHint.textContent = "Assist is on — the ready ring stays up longer";
    } else if (show) {
      assistCopy.textContent = "Need a hand? You can skip to the invite.";
      gameHint.textContent = "Tap or swipe a lane when the ball floats at the top";
    } else {
      gameHint.textContent = "Tap or swipe a lane to hit the ball";
    }
    resize();
  }

  function popup(x, y, text, color) {
    state.popups.push({ x, y, text, color: color || "#fff8e8", life: 0.8, vy: -50 });
  }

  function loseHeart(xf) {
    if (state.ended || state.hugging > 0) return;
    state.lives -= 1;
    state.hugging = 0.75;
    state.pose = "hug";
    state.poseT = 0.75;
    sfx("hug");
    const g = lanePoint(1, BG.nearY, xf);
    for (let i = 0; i < 8; i++) {
      state.hearts.push({
        x: g.x + (Math.random() - 0.5) * 50,
        y: g.y - 90,
        vy: -50 - Math.random() * 40,
        life: 0.9,
      });
    }
    renderLives();
    if (state.lives <= 0) {
      state.fails += 1;
      if (state.fails >= config.failsBeforeAssist) state.assist = true;
      updateAssistUI();
      state.lives = config.lives;
      state.snowmen = [];
      state.fly = [];
      state.toss = null;
      state.tossWait = 0.4;
      renderLives();
    }
  }

  function burstConfetti(xf) {
    confetti = [];
    for (let i = 0; i < 70; i++) {
      confetti.push({
        x: Math.random() * xf.cw,
        y: -20 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 80,
        vy: 40 + Math.random() * 90,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 8,
        c: ["#c4122a", "#f4d35e", "#fff", "#3bb273", "#7ec8e3"][i % 5],
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 7,
        life: 2.2,
      });
    }
  }

  function win() {
    if (state.ended) return;
    state.ended = true;
    state.pose = "win";
    state.poseT = 1.2;
    sfx("win");
    burstConfetti(bgXform());
    setTimeout(() => {
      running = false;
      showScreen("reveal");
    }, 1100);
  }

  function startToss() {
    const windowTime = state.assist ? 0.9 : 0.55;
    state.toss = { phase: "rise", t: 0, rise: 0.42, window: windowTime, drop: 0.32 };
    state.pose = "toss";
    state.poseT = 0.4;
    sfx("toss");
  }

  function tossPos(xf, toss) {
    const hands = lanePoint(1, BG.nearY - 10, xf);
    const peak = { x: hands.x + 18, y: hands.y - 210 * xf.scale * 1.6 };
    let p;
    if (toss.phase === "rise") p = toss.t / toss.rise;
    else if (toss.phase === "window") p = 1;
    else p = 1;
    const drop = toss.phase === "drop" ? toss.t / toss.drop : 0;
    return {
      x: hands.x + 16 + drop * 18,
      y: hands.y - 80 * xf.scale + (peak.y - (hands.y - 80 * xf.scale)) * Math.min(1, p) + drop * 90 * xf.scale,
    };
  }

  function aim(lane) {
    if (!running || state.ended || !state.toss) return;
    if (state.toss.phase !== "window") return;
    const xf = bgXform();
    const start = tossPos(xf, state.toss);
    const targetY = BG.netY - 8;
    const dest = lanePoint(lane, targetY, xf);
    state.fly.push({
      x: start.x, y: start.y, tx: dest.x, ty: dest.y,
      lane, t: 0, dur: state.assist ? 0.28 : 0.32,
      trail: [],
    });
    state.toss = null;
    state.tossWait = 0.16;
    state.pose = "spike";
    state.poseT = 0.38;
    sfx("spike");
  }

  function poofAt(x, y) {
    state.poofs.push({ x, y, t: 0, life: 0.45 });
    state.shake = Math.max(state.shake, 0.35);
    state.flash = 0.28;
    for (let i = 0; i < 18; i++) {
      const a = (Math.PI * 2 * i) / 18 + Math.random() * 0.2;
      const sp = 70 + Math.random() * 120;
      state.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.5 + Math.random() * 0.3, r: 3 + Math.random() * 7,
        c: Math.random() > 0.3 ? "#ffffff" : "#d7eef8",
      });
    }
  }

  function tick(now) {
    if (!running && !(state && state.ended && state.pose === "win")) return;
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    state.time += dt;
    const xf = bgXform();
    const paused = state.hugging > 0;
    if (state.hugging > 0) state.hugging = Math.max(0, state.hugging - dt);
    if (state.poseT > 0) state.poseT = Math.max(0, state.poseT - dt);
    else if (!state.ended) state.pose = "idle";
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.6);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.2);

    if (!paused && !state.ended) {
      state.spawnT -= dt;
      const live = state.snowmen.filter((s) => !s.gone).length;
      const maxS = state.assist ? 2 : 3;
      if (state.spawnT <= 0 && live < maxS) {
        const used = new Set(state.snowmen.filter((s) => !s.gone).map((s) => s.lane));
        const free = [0, 1, 2].filter((n) => !used.has(n));
        const lane = free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * 3);
        state.snowmen.push({
          lane,
          imgY: BG.farY + 8,
          speed: (state.assist ? 22 : 36) * (0.88 + Math.random() * 0.28),
          wobble: Math.random() * Math.PI * 2,
          kind: SNOW_TYPES[Math.floor(Math.random() * SNOW_TYPES.length)],
          gone: false,
          hugging: false,
        });
        state.spawnT = state.assist ? 1.35 : 1.0;
      }

      state.snowmen.forEach((s) => {
        if (s.gone) return;
        s.imgY += s.speed * dt;
        s.wobble += dt * 5.2;
        if (s.imgY >= BG.nearY - 6) {
          s.gone = true;
          s.hugging = true;
          loseHeart(xf);
        }
      });

      if (!state.toss) {
        state.tossWait -= dt;
        if (state.tossWait <= 0) startToss();
      } else {
        const toss = state.toss;
        toss.t += dt;
        if (toss.phase === "rise" && toss.t >= toss.rise) {
          toss.phase = "window";
          toss.t = 0;
        } else if (toss.phase === "window" && toss.t >= toss.window) {
          toss.phase = "drop";
          toss.t = 0;
          sfx("miss");
        } else if (toss.phase === "drop" && toss.t >= toss.drop) {
          state.toss = null;
          state.tossWait = 0.18;
        }
      }

      state.fly.forEach((b) => {
        b.t += dt / b.dur;
        const p = Math.min(1, b.t);
        const arc = Math.sin(p * Math.PI) * 90 * xf.scale;
        b.cx = b.x + (b.tx - b.x) * p;
        b.cy = b.y + (b.ty - b.y) * p - arc;
        b.trail.push({ x: b.cx, y: b.cy });
        if (b.trail.length > 10) b.trail.shift();
        if (p >= 1 && !b.done) {
          b.done = true;
          const hitbox = (state.assist ? 70 : 52) * xf.scale;
          let got = false;
          state.snowmen.forEach((s) => {
            if (s.gone) return;
            const sp = lanePoint(s.lane, s.imgY, xf);
            const sameLane = s.lane === b.lane;
            if (sameLane && Math.hypot(sp.x - b.tx, sp.y - b.ty) < hitbox + 24) {
              s.gone = true;
              got = true;
              poofAt(sp.x, sp.y - 20);
            }
          });
          if (got) {
            state.hits += 1;
            hudHits.textContent = String(state.hits);
            popup(b.tx, b.ty - 20, "+1", "#fff4c4");
            sfx("poof");
            if (state.hits >= config.hitsToWin) win();
          }
        }
      });
      state.fly = state.fly.filter((b) => !b.done || b.t < 1.12);
    }

    function flakes(list, speed) {
      list.forEach((s) => {
        s.y += s.v * dt * speed;
        s.x += Math.sin(state.time * 0.7 + s.drift) * 0.02 * dt;
        if (s.y > 1.05) { s.y = -0.05; s.x = Math.random(); }
      });
    }
    flakes(state.snowFar, 0.12);
    flakes(state.snowNear, 0.22);

    state.particles.forEach((p) => {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; p.r += 10 * dt;
    });
    state.particles = state.particles.filter((p) => p.life > 0);
    state.hearts.forEach((h) => { h.life -= dt; h.y += h.vy * dt; });
    state.hearts = state.hearts.filter((h) => h.life > 0);
    state.popups.forEach((p) => { p.life -= dt; p.y += p.vy * dt; });
    state.popups = state.popups.filter((p) => p.life > 0);
    state.poofs.forEach((p) => { p.t += dt; });
    state.poofs = state.poofs.filter((p) => p.t < p.life);
    confetti.forEach((c) => {
      c.life -= dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; c.vy += 30 * dt;
    });
    confetti = confetti.filter((c) => c.life > 0 && c.y < xf.ch + 20);

    draw(xf, now);
    raf = requestAnimationFrame(tick);
  }

  function drawSprite(img, x, y, h, opts) {
    if (!img) return;
    opts = opts || {};
    const aspect = img.width / Math.max(1, img.height);
    const w = h * aspect;
    ctx.save();
    ctx.translate(x, y);
    if (opts.rot) ctx.rotate(opts.rot);
    ctx.scale(opts.flip ? -1 : 1, 1);
    if (opts.sx || opts.sy) ctx.scale(opts.sx || 1, opts.sy || 1);
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  function draw(xf, now) {
    const { cw, ch, scale } = xf;
    ctx.save();
    if (state.shake > 0) {
      const mag = state.shake * 8;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    if (sprites.bg) {
      ctx.drawImage(sprites.bg, xf.ox, xf.oy, BG.w * scale, BG.h * scale);
    } else {
      ctx.fillStyle = "#87c4e0";
      ctx.fillRect(0, 0, cw, ch);
    }

    // far snow
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    state.snowFar.forEach((s) => {
      ctx.beginPath();
      ctx.arc(s.x * cw, s.y * ch, s.s, 0, Math.PI * 2);
      ctx.fill();
    });

    const depth = (imgY) => {
      const t = (imgY - BG.farY) / (BG.nearY - BG.farY);
      return 0.42 + Math.max(0, Math.min(1, t)) * 0.58;
    };

    const far = state.snowmen.filter((s) => !s.gone && s.imgY <= BG.netY).sort((a, b) => a.imgY - b.imgY);
    const near = state.snowmen.filter((s) => !s.gone && s.imgY > BG.netY).sort((a, b) => a.imgY - b.imgY);

    far.forEach((s) => drawSnowman(s, xf, depth(s.imgY)));

    // net overlay so far snowmen pass behind it
    drawNet(xf);

    near.forEach((s) => drawSnowman(s, xf, depth(s.imgY)));

    // girl
    const girl = lanePoint(1, BG.nearY + 8, xf);
    const girlH = 250 * scale * 1.55;
    const bounce = state.pose === "idle" ? Math.sin(state.time * 6) * 3 : 0;
    let gImg = sprites.girlIdle;
    if (state.pose === "toss") gImg = sprites.girlToss;
    else if (state.pose === "spike") gImg = sprites.girlSpike;
    else if (state.pose === "hug") gImg = sprites.girlHug;
    else if (state.pose === "win") gImg = sprites.girlWin;
    // soft contact shadow
    ctx.fillStyle = "rgba(40, 60, 90, 0.22)";
    ctx.beginPath();
    ctx.ellipse(girl.x, girl.y + 4, 48 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    const squash = state.pose === "spike" ? { sy: 1.04, sx: 0.97 } : { sx: 1, sy: 1 + bounce * 0.004 };
    drawSprite(gImg, girl.x, girl.y + bounce, girlH, squash);

    // toss + fly balls
    if (state.toss) {
      const p = tossPos(xf, state.toss);
      if (state.toss.phase === "window") {
        const pulse = 0.85 + Math.sin(now / 70) * 0.18;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 26 * pulse * scale, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 210, 80, 0.95)";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 34 * pulse * scale, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      const sq = state.toss.phase === "rise" ? 1.08 - state.toss.t : 1;
      drawBall(p.x, p.y, 18 * scale, state.time * 4, sq);
    }
    state.fly.forEach((b) => {
      if (b.cx == null) return;
      // trail
      b.trail.forEach((pt, i) => {
        const a = ((i + 1) / b.trail.length) * 0.35;
        ctx.globalAlpha = a;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
      const stretch = 1.12;
      drawBall(b.cx, b.cy, 17 * scale, b.t * 10, stretch);
    });

    state.poofs.forEach((p) => {
      const k = p.t / p.life;
      const img = sprites.poof;
      const h = (70 + 150 * k) * scale;
      drawSprite(img, p.x, p.y + h * 0.45, h, { alpha: 1 - k * 0.85, sx: 1 + k * 0.4, sy: 1 + k * 0.4 });
    });

    state.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // near snow (in front)
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    state.snowNear.forEach((s) => {
      ctx.beginPath();
      ctx.arc(s.x * cw, s.y * ch, s.s + 0.4, 0, Math.PI * 2);
      ctx.fill();
    });

    state.hearts.forEach((h) => {
      ctx.globalAlpha = Math.max(0, h.life);
      drawHeart(h.x, h.y, 9);
      ctx.globalAlpha = 1;
    });
    state.popups.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 1.4);
      ctx.font = "800 28px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(80,30,20,0.45)";
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.globalAlpha = 1;
    });

    confetti.forEach((c) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, c.life));
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.c;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    });

    if (state.flash > 0) {
      ctx.fillStyle = "rgba(255,255,255," + state.flash * 0.35 + ")";
      ctx.fillRect(0, 0, cw, ch);
    }
    ctx.restore();
  }

  function drawSnowman(s, xf, d) {
    const p = lanePoint(s.lane, s.imgY, xf);
    const h = 95 * xf.scale * (0.7 + d * 1.15);
    const waddle = Math.sin(s.wobble) * 0.14;
    const bob = Math.abs(Math.sin(s.wobble)) * 4;
    ctx.fillStyle = "rgba(40,60,90,0.2)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, h * 0.28, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    const img = sprites[s.kind] || sprites.snowSanta;
    drawSprite(img, p.x, p.y + bob, h, { rot: waddle, sx: 1 + Math.sin(s.wobble) * 0.03, sy: 1 - Math.sin(s.wobble) * 0.03 });
  }

  function drawNet(xf) {
    const left = toCanvas(BG.farL - 10, BG.netY, xf);
    const right = toCanvas(BG.farR + 10, BG.netY, xf);
    // the painted net is already in the photo; a light mesh helps depth sorting
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    const y = toCanvas(0, BG.netY, xf).y;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(left.x, y + i * 3.2);
      ctx.lineTo(right.x, y + i * 3.2);
      ctx.stroke();
    }
  }

  function drawBall(x, y, r, spin, stretch) {
    const img = sprites.ball;
    if (!img) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin || 0);
    ctx.scale(stretch || 1, 2 - (stretch || 1));
    ctx.drawImage(img, -r, -r, r * 2, r * 2);
    ctx.restore();
  }

  function drawHeart(x, y, s) {
    ctx.fillStyle = "#e31b3d";
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.5, y - s, x, y - s * 0.45);
    ctx.bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
    ctx.fill();
  }

  function laneFromPoint(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const xf = bgXform();
    const mid = lanePoint(1, BG.nearY, xf).x;
    const left = lanePoint(0, BG.nearY, xf).x;
    const right = lanePoint(2, BG.nearY, xf).x;
    if (x < (left + mid) / 2) return 0;
    if (x > (mid + right) / 2) return 2;
    return 1;
  }

  function onPointerDown(ev) {
    if (screens.game.hidden) return;
    ev.preventDefault();
    unlockAudio();
    const t = ev.changedTouches ? ev.changedTouches[0] : ev;
    if (state) state.pointer = { x: t.clientX, y: t.clientY };
  }

  function onPointerUp(ev) {
    if (screens.game.hidden || !state || !state.pointer) return;
    ev.preventDefault();
    const t = ev.changedTouches ? ev.changedTouches[0] : ev;
    const dx = t.clientX - state.pointer.x;
    const dy = t.clientY - state.pointer.y;
    let lane;
    if (Math.abs(dy) > 24 || Math.abs(dx) > 24) {
      if (dx < -30) lane = 0;
      else if (dx > 30) lane = 2;
      else lane = 1;
    } else {
      lane = laneFromPoint(t.clientX);
    }
    state.pointer = null;
    aim(lane);
  }

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointerup", onPointerUp, { passive: false });
  canvas.addEventListener("pointercancel", () => state && (state.pointer = null));
  canvas.addEventListener("touchstart", (e) => { if (e.target === canvas) e.preventDefault(); }, { passive: false });
  window.addEventListener("resize", () => { if (!screens.game.hidden) resize(); });

  function firstGesture() {
    unlockAudio();
    sfx("tap");
  }

  document.getElementById("btn-begin").addEventListener("click", () => {
    firstGesture();
    showScreen("howto");
  });
  document.getElementById("btn-start").addEventListener("click", () => {
    firstGesture();
    showScreen("game");
  });
  document.getElementById("btn-skip").addEventListener("click", () => {
    firstGesture();
    running = false;
    showScreen("reveal");
  });
  document.getElementById("btn-mute").addEventListener("click", () => {
    muted = !muted;
    document.getElementById("btn-mute").textContent = muted ? "Sound off" : "Sound on";
    if (!muted) unlockAudio();
  });


  function isLocalRsvp() {
    const ep = String(config.rsvpEndpoint || "local").trim();
    return !ep || ep.toLowerCase() === "local";
  }

  function rsvpPayload(form) {
    const familyName = String(form.familyName.value || "").trim();
    const attendingCount = Number(form.attendingCount.value);
    const dish = String(form.dish.value || "").trim();
    const cookie = form.cookieContest;
    const cookieContest = !!(cookie && cookie.checked);
    return {
      familyName,
      attendingCount,
      dish,
      cookieContest,
      eventName: config.eventName,
      date: config.date,
      time: config.time,
      location: config.location,
      hostName: config.hostName,
      submittedAt: new Date().toISOString(),
    };
  }

  function saveLocalRsvp(payload) {
    const key = config.rsvpStorageKey || "playfair-team-united-rsvp";
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(list)) list = [];
    } catch (e) {
      list = [];
    }
    list.push(payload);
    localStorage.setItem(key, JSON.stringify(list));
    localStorage.setItem(key + "-latest", JSON.stringify(payload));
  }

  function showRsvpThanks(payload, localOnly) {
    const form = document.getElementById("rsvp-form");
    const thanks = document.getElementById("rsvp-thanks");
    const lead = document.getElementById("rsvp-thanks-lead");
    const body = document.getElementById("rsvp-thanks-body");
    if (form) form.hidden = true;
    if (thanks) thanks.hidden = false;
    if (lead) lead.textContent = "Thank you, " + payload.familyName + "!";
    const dishBit = payload.dish ? " You are bringing " + payload.dish + "." : "";
    const contestBit = payload.cookieContest ? " You're entering the cookie contest!" : "";
    const count = payload.attendingCount === 1 ? "1 person" : payload.attendingCount + " people";
    if (localOnly) {
      body.textContent =
        "This RSVP is saved on this device so the form can be tested. It has not been sent to Mike yet. " +
        count + " attending." + dishBit + contestBit;
    } else {
      body.textContent =
        "Your RSVP is on its way to Mike. " + count + " attending." + dishBit + contestBit;
    }
  }

  function setupRsvp() {
    const form = document.getElementById("rsvp-form");
    if (!form || form.dataset.bound === "1") {
      const key = (config.rsvpStorageKey || "playfair-team-united-rsvp") + "-latest";
      try {
        const latest = JSON.parse(localStorage.getItem(key) || "null");
        if (latest && latest.familyName) showRsvpThanks(latest, isLocalRsvp());
      } catch (e) {}
      return;
    }
    form.dataset.bound = "1";
    const err = document.getElementById("rsvp-error");
    const btn = document.getElementById("rsvp-submit");
    try {
      const key = (config.rsvpStorageKey || "playfair-team-united-rsvp") + "-latest";
      const latest = JSON.parse(localStorage.getItem(key) || "null");
      if (latest && latest.familyName) showRsvpThanks(latest, isLocalRsvp());
    } catch (e) {}
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (err) { err.hidden = true; err.textContent = ""; }
      const payload = rsvpPayload(form);
      if (!payload.familyName) {
        if (err) { err.hidden = false; err.textContent = "Please add a family name."; }
        form.familyName.focus();
        return;
      }
      if (!Number.isFinite(payload.attendingCount) || payload.attendingCount < 1) {
        if (err) { err.hidden = false; err.textContent = "Please add how many people will attend."; }
        form.attendingCount.focus();
        return;
      }
      saveLocalRsvp(payload);
      console.log("RSVP payload", payload);
      if (isLocalRsvp()) {
        showRsvpThanks(payload, true);
        return;
      }
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      fetch(config.rsvpEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => {
          if (!res.ok) throw new Error("HTTP " + res.status);
          showRsvpThanks(payload, false);
        })
        .catch(() => {
          if (err) {
            err.hidden = false;
            err.textContent =
              "Could not send to Mike yet, but your RSVP is saved on this device. Please try again later or tell Mike directly.";
          }
          if (btn) { btn.disabled = false; btn.textContent = "Send RSVP"; }
        });
    });
  }

  function registerSW() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  /* Test hook for mid-action screenshots and local QA. */
  window.__invite = {
    show: showScreen,
    config: () => config,
    getState: () => state,
    win,
    skip: () => showScreen("reveal"),
    start: startLevel,
    aim,
    poseForShot: function () {
      if (screens.game.hidden) showScreen("game");
      const xf = bgXform();
      state.snowmen = [
        { lane: 0, imgY: BG.farY + 40, speed: 0, wobble: 1.2, kind: "snowSanta", gone: false },
        { lane: 1, imgY: BG.netY - 20, speed: 0, wobble: 2.1, kind: "snowGreen", gone: false },
        { lane: 2, imgY: BG.netY + 40, speed: 0, wobble: 0.4, kind: "snowHat", gone: false },
        { lane: 0, imgY: BG.nearY - 80, speed: 0, wobble: 3.0, kind: "snowBaby", gone: false },
      ];
      const from = tossPos(xf, { phase: "window", t: 0, rise: 1, window: 1, drop: 1 });
      const dest = lanePoint(1, BG.netY - 8, xf);
      state.fly = [{
        x: from.x, y: from.y, tx: dest.x, ty: dest.y, lane: 1,
        t: 0.72, dur: 1, cx: from.x + (dest.x - from.x) * 0.72,
        cy: from.y + (dest.y - from.y) * 0.72 - Math.sin(0.72 * Math.PI) * 90 * xf.scale,
        trail: [], done: false,
      }];
      for (let i = 0; i < 8; i++) {
        const p = i / 8;
        state.fly[0].trail.push({
          x: from.x + (state.fly[0].cx - from.x) * p,
          y: from.y + (state.fly[0].cy - from.y) * p,
        });
      }
      const hit = lanePoint(1, BG.netY - 20, xf);
      poofAt(hit.x, hit.y);
      popup(hit.x, hit.y - 30, "+1", "#fff4c4");
      state.pose = "spike";
      state.poseT = 1;
      state.hits = 3;
      hudHits.textContent = "3";
      state.toss = null;
    },
  };

  function registerReady() {
    Promise.all([loadConfig(), preloadSprites()])
      .then(() => {
        showScreen("landing");
        registerSW();
      })
      .catch((err) => {
        console.error(err);
        applyConfig();
        showScreen("landing");
      });
  }

  registerReady();
})();
