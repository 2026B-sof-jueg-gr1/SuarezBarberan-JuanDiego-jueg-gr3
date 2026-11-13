// ───────── Constantes del mundo ─────────
const WORLD_W = 2000;
const WORLD_H = 1500;
const MAX_ENEMIES = 35; // Aumentado ligeramente para soportar las salidas de los cráteres

const FACE_HAPPY = " ,-^-, \n |^_^| \n '---' ";
const FACE_DEADPAN = " ,-^-, \n |-_-| \n '---' ";

const SPIDER_PAL = { leg: 0x4a2010, accent: 0xffaa00, joint: 0xffcc33, body: 0x1c0a14, head: 0x2a1020, eye: 0xffe066, extraEyes: false };
const MOTHER_PAL = { leg: 0x3a0a14, accent: 0xff2244, joint: 0xff6677, body: 0x120208, head: 0x1e0410, eye: 0xff1111, extraEyes: true };

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1a0508',
    physics: { default: 'arcade' },
    scene: { create, update }
};

new Phaser.Game(config);

let scene, player, ship, beam, cursors, spaceKey, attackKey, extractKey;
let coins, enemies, bullets;
let scoreText, moneyText, livesText, extractionText, timerText;
let score = 0, money = 0, lives = 3, invulnerable = false;
let isPaused = false, pauseElements = [];
let lastFired = 0;
let gameStarted = false;
let introTween1, introTween2, introTween3;
let landingX = 1000, landingY = 800;
let ambientOverlay = null;
let fogOverlay = null; // Capa para la neblina rojiza pesada
let nests = [];
let craters = []; // Guardaremos las posiciones de los cráteres y huecos del suelo

// Variables de minijuego de corte (Among Us style)
let cuttingActive = false;
let targetCoin = null;
let cutProgress = 0;
let lastMouseX = 0;
let cutUIElements = [];

let playerAlerted = false;
let extracting = false;
let extractionTotalTimer = 10000;
let extractionCountdownTimer = 5000;
let extractionZone = null;
let extractionShip = null;
let extractionBeam = null;
let extractionPoint = { x: 0, y: 0 };
let extractingStartTime = 0;
let extractionPhase = 0;
let corporateHelpActive = false;

// Diálogo de la Central
let commsElements = [];
let commsTyper = null;
let commsHold = null;

// Madre de las arañas
let motherActive = false;
let mother = null, motherGlow = null;
let motherFrame = 0;
let motherAnimEvent = null, motherWaveTimer = null;

function create() {
    scene = this;

    score = 0;
    money = 0;
    lives = 3;
    invulnerable = false;
    isPaused = false;
    pauseElements = [];
    gameStarted = false;
    playerAlerted = false;
    extracting = false;
    cuttingActive = false;
    targetCoin = null;
    cutProgress = 0;
    extractionZone = null;
    extractionShip = null;
    extractionBeam = null;
    extractionPhase = 0;
    corporateHelpActive = false;
    window.extractingStartTime = 0;
    commsElements = [];
    commsTyper = null;
    commsHold = null;
    motherActive = false;
    mother = null;
    motherGlow = null;
    motherFrame = 0;
    motherAnimEvent = null;
    motherWaveTimer = null;
    nests = [];
    craters = [];

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);

    landingX = Phaser.Math.Between(Math.round(WORLD_W * 0.3), Math.round(WORLD_W * 0.7));
    landingY = Phaser.Math.Between(Math.round(WORLD_H * 0.4), Math.round(WORLD_H * 0.7));
    cam.centerOn(landingX, landingY - 50);

    // FILTRO AMBIENTAL ROJIZO
    ambientOverlay = scene.add.rectangle(400, 300, 800, 600, 0xff0033, 0.15).setScrollFactor(0).setDepth(9999);

    // NEBLINA ROJIZA DINÁMICA (Efecto de atmósfera espesa)
    fogOverlay = scene.add.rectangle(400, 300, 800, 600, 0xff1144, 0.08).setScrollFactor(0).setDepth(9998);
    scene.tweens.add({
        targets: fogOverlay,
        alpha: 0.22,
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    nests = buildNests();
    drawGround();
    ensureSpiderTextures();
    ensureEggTextures();

    coins = this.add.group();
    enemies = this.physics.add.group();
    bullets = this.physics.add.group();

    nests.forEach(n => {
        for (let i = 0; i < n.eggs; i++) {
            const a = (i / n.eggs) * Math.PI * 2 + Math.random();
            const r = Phaser.Math.Between(35, 80);
            spawnStaticCoin(n.x + Math.cos(a) * r, n.y + Math.sin(a) * r * 0.7);
        }
    });

    for (let i = 0; i < 10; i++) {
        const p = farWorldPoint(700, landingX, landingY);
        spawnEnemy(p.x, p.y);
    }
    enemies.getChildren().forEach(e => e.setData('active', false));

    const playerAscii = 
        "  o  \n" +
        " [#] \n" +
        " / \\ ";
    
    player = this.add.text(landingX, landingY - 300, playerAscii, {
        fontFamily: 'Courier, monospace',
        fontSize: '18px',
        fill: '#00ff41'
    });
    this.physics.add.existing(player);
    player.body.setCollideWorldBounds(true);
    player.body.setSize(40, 50);
    player.setData('facing', 'right');
    player.setAlpha(0);

    const shipAscii = 
        "   /===\\   \n" +
        "  [=====]  \n" +
        "== O O O == ";

    ship = this.add.text(landingX, landingY - 400, shipAscii, {
        fontFamily: 'Courier, monospace',
        fontSize: '16px',
        fill: '#00ffff',
        align: 'center'
    }).setOrigin(0.5);

    beam = this.add.rectangle(landingX, landingY - 200, 60, 300, 0x00ffff, 0.25).setOrigin(0.5, 0);

    introTween1 = scene.tweens.add({
        targets: ship,
        y: landingY - 250,
        duration: 2000,
        ease: 'Power2',
        onComplete: () => {
            player.setPosition(landingX - 10, landingY - 230);
            player.setAlpha(1);

            introTween2 = scene.tweens.add({
                targets: player,
                y: landingY,
                duration: 1500,
                ease: 'Linear',
                onComplete: () => {
                    beam.destroy();
                    scene.cameras.main.flash(500, 255, 0, 50);

                    introTween3 = scene.tweens.add({
                        targets: ship,
                        y: landingY - 450,
                        x: landingX + 500,
                        duration: 1500,
                        ease: 'Power2',
                        onComplete: () => ship.destroy()
                    });

                    enemies.getChildren().forEach(e => e.setData('active', true));
                    gameStarted = true;

                    scene.cameras.main.startFollow(player, true, 0.08, 0.08, -27, -31);
                }
            });
        }
    });

    const hudStyle = { fontFamily: 'Courier', stroke: '#12030a', strokeThickness: 3 };
    scoreText = this.add.text(16, 16, 'Huevos: 0 / 10', { ...hudStyle, fontSize: '18px', fill: '#ff4d79' }).setScrollFactor(0).setDepth(6000);
    moneyText = this.add.text(16, 42, 'Dinero: $0', { ...hudStyle, fontSize: '18px', fill: '#00ffcc' }).setScrollFactor(0).setDepth(6000);
    livesText = this.add.text(16, 68, 'Salud: 3', { ...hudStyle, fontSize: '18px', fill: '#ff0055' }).setScrollFactor(0).setDepth(6000);
    extractionText = this.add.text(16, 94, '[E] Solicitar Extracción', { ...hudStyle, fontSize: '16px', fill: '#00ffff' }).setScrollFactor(0).setDepth(6000);
    timerText = this.add.text(16, 120, '', { ...hudStyle, fontSize: '16px', fill: '#ffaa00' }).setScrollFactor(0).setDepth(6000);

    createMinimap();

    this.physics.add.overlap(player, enemies, hitEnemy);
    this.physics.add.overlap(bullets, enemies, destroyEnemy);

    cursors = this.input.keyboard.createCursorKeys();
    spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.KeyF);
    extractKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    scene.input.on('pointermove', (pointer) => {
        if (!cuttingActive) return;

        let deltaX = pointer.x - lastMouseX;
        if (deltaX > 2) { 
            cutProgress += deltaX * 0.8;
            if (cutProgress >= 100) {
                completeCutting();
            }
        }
        lastMouseX = pointer.x;
    });
}

function depthScaleFor(y) {
    return Phaser.Math.Clamp(0.75 + (y / WORLD_H) * 0.5, 0.75, 1.25);
}

function farWorldPoint(minDist, refX, refY) {
    let x, y, tries = 0;
    do {
        x = Phaser.Math.Between(60, WORLD_W - 60);
        y = Phaser.Math.Between(60, WORLD_H - 60);
        tries++;
    } while (Phaser.Math.Distance.Between(x, y, refX, refY) < minDist && tries < 40);
    return { x, y };
}

function offscreenSpawnPoint() {
    const v = scene.cameras.main.worldView;
    const m = 120;
    const side = Phaser.Math.Between(0, 3);
    if (side === 0) return { x: v.left - m, y: Phaser.Math.Between(v.top, v.bottom) };
    if (side === 1) return { x: v.right + m, y: Phaser.Math.Between(v.top, v.bottom) };
    if (side === 2) return { x: Phaser.Math.Between(v.left, v.right), y: v.top - m };
    return { x: Phaser.Math.Between(v.left, v.right), y: v.bottom + m };
}

function respawnPoint() {
    if (playerAlerted) return offscreenSpawnPoint();
    const pc = player.body.center;
    return farWorldPoint(900, pc.x, pc.y);
}

function buildNests() {
    const result = [];
    const margin = 150;
    const rnd = Phaser.Math.Between;
    const dist2 = Phaser.Math.Distance.Between;

    const ang = Math.random() * Math.PI * 2;
    const d = rnd(280, 420);
    result.push({
        x: Phaser.Math.Clamp(landingX + Math.cos(ang) * d, margin, WORLD_W - margin),
        y: Phaser.Math.Clamp(landingY + Math.sin(ang) * d, margin, WORLD_H - margin),
        eggs: 3
    });

    [3, 2, 2].forEach(n => {
        let x, y, ok, tries = 0;
        do {
            x = rnd(margin, WORLD_W - margin);
            y = rnd(margin, WORLD_H - margin);
            ok = dist2(x, y, landingX, landingY) > 500 && result.every(r => dist2(x, y, r.x, r.y) > 450);
            tries++;
        } while (!ok && tries < 60);
        result.push({ x, y, eggs: n });
    });

    return result;
}

function drawRock(g, rx, ry, rw) {
    const rh = Math.round(rw * 0.6);
    g.fillStyle(0x0d0306, 0.5);
    g.fillEllipse(rx + 2, ry + rh * 0.45, rw + 4, rh * 0.6);
    g.fillStyle([0x3a1624, 0x4a2030, 0x2e1019][Math.floor(Math.random() * 3)], 1);
    g.fillEllipse(rx, ry, rw, rh);
    g.fillStyle(0x7a3a52, 0.55);
    g.fillEllipse(rx - rw * 0.15, ry - rh * 0.2, rw * 0.5, rh * 0.4);
}

function drawGround() {
    const W = WORLD_W, H = WORLD_H;
    const A = (W * H) / (800 * 600);
    const rnd = Phaser.Math.Between;
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    g.fillStyle(0x2b0b14, 1);
    g.fillRect(0, 0, W, H);

    const patchColors = [0x34101b, 0x240912, 0x3d1522, 0x1e0710, 0x40192a];
    for (let i = 0; i < Math.round(55 * A); i++) {
        g.fillStyle(pick(patchColors), 0.5);
        g.fillEllipse(rnd(0, W), rnd(0, H), rnd(90, 260), rnd(40, 130));
    }

    nests.forEach(n => {
        g.fillStyle(0x14050b, 0.55);
        g.fillEllipse(n.x, n.y + 6, 300, 170);
        g.fillStyle(0x240912, 0.7);
        g.fillEllipse(n.x, n.y + 4, 230, 130);
        g.lineStyle(2, 0x5a2236, 0.5);
        g.strokeEllipse(n.x, n.y + 6, 300, 170);
        g.fillStyle(0xff4d79, 0.05);
        g.fillEllipse(n.x, n.y, 180, 100);
        for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2;
            drawRock(g, n.x + Math.cos(a) * 150, n.y + Math.sin(a) * 85, rnd(8, 18));
        }
    });

    // CRÁTERES Y HUECOS DEL PLANETA (Registramos sus posiciones para que salgan arañas de ahí)
    for (let i = 0; i < Math.round(10 * A); i++) {
        const cx = rnd(80, W - 80), cy = rnd(80, H - 70);
        const cw = rnd(50, 110), ch = Math.round(cw * 0.45);
        craters.push({ x: cx, y: cy }); // Guardar posición de hueco

        g.fillStyle(0x0e0206, 0.85);
        g.fillEllipse(cx, cy, cw, ch);
        g.lineStyle(2, 0x7a2238, 0.65);
        g.strokeEllipse(cx, cy - 1, cw + 4, ch + 3);
    }

    for (let i = 0; i < Math.round(16 * A); i++) {
        let px = rnd(0, W), py = rnd(0, H);
        let ang = Math.random() * Math.PI * 2;
        const segs = rnd(4, 8);
        for (let s = 0; s < segs; s++) {
            const len = rnd(14, 34);
            ang += (Math.random() - 0.5) * 1.1;
            const nx = px + Math.cos(ang) * len;
            const ny = py + Math.sin(ang) * len * 0.6;
            g.lineStyle(1, 0x120409, 0.85);
            g.lineBetween(px, py, nx, ny);
            g.lineStyle(1, 0x5a2236, 0.3);
            g.lineBetween(px, py + 1, nx, ny + 1);
            px = nx;
            py = ny;
        }
    }

    const grit = [0x4a1a2b, 0x5e2438, 0x1a060c, 0x3a1624];
    for (let i = 0; i < Math.round(600 * A); i++) {
        g.fillStyle(pick(grit), 0.45 + Math.random() * 0.4);
        const s = Math.random() < 0.8 ? 1 : 2;
        g.fillRect(rnd(0, W), rnd(0, H), s, s);
    }

    for (let i = 0; i < Math.round(30 * A); i++) {
        drawRock(g, rnd(10, W - 10), rnd(10, H - 10), rnd(6, 20));
    }

    const bladeColors = [0xff4d79, 0xd63a68, 0x9c2a4d, 0xff7aa0];
    for (let i = 0; i < Math.round(110 * A); i++) {
        const tx = rnd(10, W - 10), ty = rnd(10, H - 6);
        const k = 0.55 + (ty / H) * 0.7;
        const blades = rnd(3, 6);
        g.fillStyle(0x0d0306, 0.35);
        g.fillEllipse(tx, ty + 1, 12 * k, 4 * k);
        for (let b = 0; b < blades; b++) {
            const bx = tx + (b - blades / 2) * 2.2 * k + rnd(-1, 1);
            const h = rnd(7, 16) * k;
            const lean = rnd(-5, 5) * k;
            g.fillStyle(pick(bladeColors), 0.9);
            g.fillTriangle(bx - 1.4 * k, ty, bx + 1.4 * k, ty, bx + lean, ty - h);
        }
    }

    for (let i = 0; i < Math.round(30 * A); i++) {
        const sx = rnd(10, W - 10), sy = rnd(10, H - 10);
        g.fillStyle(0xff4d79, 0.12);
        g.fillCircle(sx, sy, 5);
        g.fillStyle(0xff9ab5, 0.7);
        g.fillCircle(sx, sy, 1.2);
    }

    for (let k = 0; k < 10; k++) {
        const t = 26 * (k + 1);
        g.fillStyle(0x0a0206, 0.06);
        g.fillRect(0, 0, t, H);
        g.fillRect(W - t, 0, t, H);
        g.fillRect(0, 0, W, t);
        g.fillRect(0, H - t, W, t);
    }

    if (scene.textures.exists('ground')) scene.textures.remove('ground');
    g.generateTexture('ground', W, H);
    g.destroy();

    scene.add.image(0, 0, 'ground').setOrigin(0, 0).setDepth(-10);
}

function buildSpiderTexture(key, frame, s, pal) {
    const W = 56 * s, H = 48 * s;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    const sign = frame === 0 ? 1 : -1;
    const legs = [
        { s: [24, 15], k: [12, 5],  f: [4, 11] },
        { s: [23, 18], k: [9, 14],  f: [2, 22] },
        { s: [23, 21], k: [9, 25],  f: [3, 34] },
        { s: [24, 24], k: [12, 33], f: [7, 41] }
    ];

    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(30 * s, 30 * s, 32 * s, 22 * s);

    legs.forEach((leg, i) => {
        [-1, 1].forEach(side => {
            const shift = (i % 2 === 0 ? 1 : -1) * side * sign * 2;
            const mx = v => (side === -1 ? v : 56 - v) * s;
            const sx = mx(leg.s[0]), sy = leg.s[1] * s;
            const kx = mx(leg.k[0]), ky = (leg.k[1] + shift) * s;
            const fx = mx(leg.f[0]), fy = (leg.f[1] + shift * 1.5) * s;

            g.lineStyle(3 * s, pal.leg, 1);
            g.lineBetween(sx, sy, kx, ky);
            g.lineBetween(kx, ky, fx, fy);
            g.lineStyle(Math.max(1, s), pal.accent, 0.85);
            g.lineBetween(sx, sy, kx, ky);
            g.lineBetween(kx, ky, fx, fy);
            g.fillStyle(pal.joint, 1);
            g.fillCircle(kx, ky, 1.5 * s);
        });
    });

    g.fillStyle(pal.body, 1);
    g.fillEllipse(28 * s, 29 * s, 20 * s, 24 * s);
    g.lineStyle(1.5 * s, pal.accent, 0.9);
    g.strokeEllipse(28 * s, 29 * s, 20 * s, 24 * s);
    g.fillStyle(pal.accent, 0.95);
    g.fillTriangle(28 * s, 24 * s, 25 * s, 29 * s, 31 * s, 29 * s);
    g.fillTriangle(28 * s, 35 * s, 25 * s, 29 * s, 31 * s, 29 * s);

    g.fillStyle(pal.head, 1);
    g.fillEllipse(28 * s, 15 * s, 13 * s, 13 * s);
    g.lineStyle(1.5 * s, pal.accent, 0.9);
    g.strokeEllipse(28 * s, 15 * s, 13 * s, 13 * s);

    g.fillStyle(pal.accent, 1);
    g.fillTriangle(25 * s, 9 * s, 27.5 * s, 9 * s, 26 * s, 4 * s);
    g.fillTriangle(31 * s, 9 * s, 28.5 * s, 9 * s, 30 * s, 4 * s);

    g.fillStyle(pal.eye, 1);
    g.fillCircle(25.5 * s, 13 * s, 1.8 * s);
    g.fillCircle(30.5 * s, 13 * s, 1.8 * s);
    g.fillCircle(27 * s, 16.5 * s, 1.1 * s);
    g.fillCircle(29 * s, 16.5 * s, 1.1 * s);
    if (pal.extraEyes) {
        g.fillCircle(23.8 * s, 15 * s, 1.2 * s);
        g.fillCircle(32.2 * s, 15 * s, 1.2 * s);
        g.fillCircle(28 * s, 11.2 * s, 1.2 * s);
    }

    g.generateTexture(key, W, H);
    g.destroy();
}

function ensureSpiderTextures() {
    if (scene.textures.exists('spider0')) return;

    [0, 1].forEach(f => {
        buildSpiderTexture('spider' + f, f, 1, SPIDER_PAL);
        buildSpiderTexture('mother' + f, f, 4, MOTHER_PAL);
    });

    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    for (let i = 0; i < 12; i++) {
        g.fillStyle(0xff1133, 0.05);
        g.fillEllipse(250, 160, 500 - i * 36, 320 - i * 24);
    }
    g.generateTexture('motherGlow', 500, 320);
    g.destroy();
}

function drawEggSac(g, cx, cy, w, h, embryo) {
    g.fillStyle(0x3a0614, 1);
    g.fillEllipse(cx, cy, w, h);
    g.fillStyle(0x8a1230, 1);
    g.fillEllipse(cx, cy, w - 3, h - 3);
    g.fillStyle(0xc41f4a, 1);
    g.fillEllipse(cx, cy + h * 0.03, w - 8, h - 9);
    g.fillStyle(0xff4d79, 0.55);
    g.fillEllipse(cx, cy + h * 0.07, w - 14, h - 17);

    if (embryo) {
        const u = w / 30;
        g.lineStyle(1, 0x2a0a18, 0.9);
        for (let i = -1; i <= 1; i++) {
            g.lineBetween(cx - 2 * u, cy + (3 + i * 3) * u, cx - 7 * u, cy + (1 + i * 4) * u);
            g.lineBetween(cx + 2 * u, cy + (3 + i * 3) * u, cx + 7 * u, cy + (1 + i * 4) * u);
        }
        g.fillStyle(0x2a0a18, 0.95);
        g.fillEllipse(cx, cy + 4 * u, w * 0.3, h * 0.26);
        g.fillEllipse(cx, cy - 4 * u, w * 0.2, h * 0.14);
        g.fillStyle(0xffaa00, 1);
        g.fillCircle(cx - 1.5 * u, cy - 4.5 * u, 0.9 * u);
        g.fillCircle(cx + 1.5 * u, cy - 4.5 * u, 0.9 * u);
    }

    g.fillStyle(0xffd6e0, 0.7);
    g.fillEllipse(cx - w * 0.18, cy - h * 0.24, w * 0.2, h * 0.16);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(cx - w * 0.2, cy - h * 0.28, 1.1);

    g.lineStyle(1, 0xff8aa8, 0.45);
    g.strokeEllipse(cx, cy, w - 1, h - 1);
}

function ensureEggTextures() {
    if (!scene.textures.exists('egg')) {
        const g = scene.make.graphics({ x: 0, y: 0, add: false });

        g.fillStyle(0x2a0712, 0.7);
        g.fillEllipse(40, 68, 70, 17);
        g.lineStyle(1, 0xffb0c8, 0.3);
        g.strokeEllipse(40, 68, 72, 18);
        g.lineStyle(1, 0xffc0d0, 0.35);
        [[10, 70], [70, 71], [22, 77], [58, 78], [4, 65], [76, 65]].forEach(p => g.lineBetween(40, 63, p[0], p[1]));

        drawEggSac(g, 21, 57, 20, 25, false);
        drawEggSac(g, 59, 58, 18, 23, false);
        drawEggSac(g, 40, 42, 38, 48, true);

        g.generateTexture('egg', 80, 80);
        g.destroy();
    }

    if (!scene.textures.exists('eggGlow')) {
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        for (let r = 56; r > 6; r -= 5) {
            g.fillStyle(0xff3366, 0.04);
            g.fillCircle(60, 60, r);
        }
        g.generateTexture('eggGlow', 120, 120);
        g.destroy();
    }
}

function spawnStaticCoin(x, y) {
    const k = depthScaleFor(y);

    const glow = scene.add.image(x, y + 4, 'eggGlow')
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(y - 1).setScale(k).setAlpha(0.5);
    scene.tweens.add({
        targets: glow,
        alpha: 0.95,
        duration: Phaser.Math.Between(700, 1100),
        delay: Phaser.Math.Between(0, 600),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    const coin = scene.add.image(x, y, 'egg').setDepth(y).setScale(k);
    coin.setData('glow', glow);
    coins.add(coin);
}

function spawnEnemy(x, y, sizeMul = 1) {
    let enemy = scene.add.sprite(x, y, 'spider0');

    scene.physics.add.existing(enemy);
    enemy.body.setSize(34, 30);
    enemy.setDepth(y);
    enemy.setScale(depthScaleFor(y) * sizeMul);
    enemy.setData('sizeMul', sizeMul);
    enemy.setData('animTimer', 0);
    enemy.setData('frame', 0);
    enemy.setData('active', false);
    enemy.setData('alertTinted', false);
    enemy.setData('idleUntil', 0);
    enemy.setData('wanderSpeed', Phaser.Math.Between(35, 60));
    enemy.setData('patrolTarget', {
        x: Phaser.Math.Between(60, WORLD_W - 60),
        y: Phaser.Math.Between(60, WORLD_H - 60)
    });
    
    enemies.add(enemy);
    return enemy;
}

function hitEnemy(p, enemy) {
    if (invulnerable || isPaused || !gameStarted || extractionPhase === 2) return;
    if (!enemy.active) return;

    if (cuttingActive) cancelCutting();

    lives--;
    livesText.setText('Salud: ' + lives);

    const wasBaby = enemy.getData('baby');
    enemy.destroy();

    if (!wasBaby) {
        const pt = respawnPoint();
        const newE = spawnEnemy(pt.x, pt.y);
        newE.setData('active', true);
    }

    if (lives <= 0) return endGame();

    invulnerable = true;
    scene.tweens.add({ targets: player, alpha: 0.3, duration: 100, yoyo: true, repeat: 7 });
    scene.time.delayedCall(1500, () => {
        invulnerable = false;
        player.setAlpha(1);
    });
}

function shootBullet() {
    if (!gameStarted || scene.time.now < lastFired || extractionPhase === 2 || cuttingActive) return;

    let bullet = scene.add.text(player.x + 15, player.y + 15, '---', {
        fontFamily: 'Courier, monospace',
        fontSize: '16px',
        fill: '#00ff41'
    });
    scene.physics.add.existing(bullet);
    
    let facing = player.getData('facing');
    let speedX = 0;
    if (facing === 'left') speedX = -500;
    else if (facing === 'right') speedX = 500;

    bullet.body.setVelocityX(speedX);
    bullets.add(bullet);

    lastFired = scene.time.now + 300;
}

function destroyEnemy(bullet, enemy) {
    if (!enemy.active) return;

    const wasBaby = enemy.getData('baby');
    bullet.destroy();
    enemy.destroy();

    if (wasBaby) return;

    scene.time.delayedCall(6000, () => {
        if (lives > 0) {
            const pt = respawnPoint();
            const newE = spawnEnemy(pt.x, pt.y);
            newE.setData('active', true);
        }
    });
}

// INICIAR MINIJUEGO DE CORTE TIPO AMONG US
function startCutting(coin) {
    if (cuttingActive || !gameStarted) return;
    cuttingActive = true;
    targetCoin = coin;
    cutProgress = 0;
    lastMouseX = scene.input.activePointer.x;

    if (!playerAlerted) {
        playerAlerted = true;
        scene.cameras.main.shake(800, 0.015);
    }

    let bgBox = scene.add.rectangle(400, 300, 450, 250, 0x05050a, 0.95).setStrokeStyle(3, 0xff1a40).setScrollFactor(0).setDepth(20000);
    let title = scene.add.text(400, 200, '>>> CORTE DE CÁPSULA TÁCTICA <<<', { fontSize: '14px', fill: '#ff4d79', fontFamily: 'Courier' }).setOrigin(0.5).setScrollFactor(0).setDepth(20001);
    let instruction = scene.add.text(400, 230, 'Mueve el mouse de izquierda a derecha', { fontSize: '12px', fill: '#ffffff', fontFamily: 'Courier' }).setOrigin(0.5).setScrollFactor(0).setDepth(20001);
    
    let barBg = scene.add.rectangle(400, 300, 300, 24, 0x222222).setStrokeStyle(1, 0xffffff).setScrollFactor(0).setDepth(20000);
    let barFill = scene.add.rectangle(250, 300, 0, 20, 0xff1a40).setOrigin(0, 0.5).setScrollFactor(0).setDepth(20001);

    let cancelBtn = scene.add.text(400, 380, '[ Presiona ESPACIO o muévete para cancelar ]', { fontSize: '11px', fill: '#ffaa00', fontFamily: 'Courier' }).setOrigin(0.5).setScrollFactor(0).setDepth(20001);

    cutUIElements = [bgBox, title, instruction, barBg, barFill, cancelBtn];
}

function completeCutting() {
    if (!cuttingActive) return;

    let eggX = player.x;
    let eggY = player.y - 30;

    if (targetCoin && targetCoin.active) {
        eggX = targetCoin.x;
        eggY = targetCoin.y;
        const glow = targetCoin.getData('glow');
        if (glow) {
            scene.tweens.killTweensOf(glow);
            glow.destroy();
        }
        targetCoin.destroy();
    }

    score++;
    money += 300; 
    scoreText.setText('Huevos: ' + score + ' / 10');
    moneyText.setText('Dinero: $' + money);

    closeCuttingUI();

    let floatText = scene.add.text(eggX, eggY, '+ $300', {
        fontFamily: 'Courier, monospace',
        fontSize: '22px',
        fill: '#00ffcc',
        stroke: '#000000',
        strokeThickness: 4
    }).setOrigin(0.5).setDepth(25000);

    scene.tweens.add({
        targets: floatText,
        y: eggY - 70,
        alpha: 0,
        scale: 1.4,
        duration: 1200,
        ease: 'Power2',
        onComplete: () => floatText.destroy()
    });

    if (score > 3 && !motherActive) summonMother();
}

function cancelCutting() {
    closeCuttingUI();
    timerText.setText('¡Corte cancelado!');
    scene.time.delayedCall(1500, () => timerText.setText(''));
}

function closeCuttingUI() {
    cuttingActive = false;
    targetCoin = null;
    cutUIElements.forEach(el => el.destroy());
    cutUIElements = [];
}

// ───────────────────── MADRE DE LAS ARAÑAS ─────────────────────
function summonMother() {
    motherActive = true;

    scene.cameras.main.shake(1400, 0.02);
    scene.tweens.add({ targets: ambientOverlay, alpha: 0.28, duration: 1500 });
    scene.tweens.add({ targets: fogOverlay, alpha: 0.35, duration: 1500 });

    motherGlow = scene.add.image(400, 70, 'motherGlow')
        .setScrollFactor(0).setDepth(-9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35);
    scene.tweens.add({ targets: motherGlow, alpha: 1, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    mother = scene.add.image(400, -320, 'mother0')
        .setScrollFactor(0).setDepth(-8).setRotation(Math.PI).setScale(1.6);
    scene.tweens.add({ targets: mother, y: 10, duration: 1800, ease: 'Power2' });
    scene.tweens.add({ targets: mother, x: 430, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    motherFrame = 0;
    motherAnimEvent = scene.time.addEvent({
        delay: 380,
        loop: true,
        callback: () => {
            motherFrame = 1 - motherFrame;
            if (mother && mother.active) mother.setTexture('mother' + motherFrame);
        }
    });

    const banner = scene.add.text(400, 250, '¡LA MADRE DE LAS ARAÑAS\nESTÁ FURIOSA!', {
        fontFamily: 'Courier, monospace',
        fontSize: '26px',
        fill: '#ff2244',
        align: 'center',
        stroke: '#12030a',
        strokeThickness: 5
    }).setOrigin(0.5).setScrollFactor(0).setDepth(16000).setAlpha(0).setScale(0.6);

    scene.tweens.add({
        targets: banner,
        alpha: 1,
        scale: 1,
        duration: 350,
        ease: 'Back.easeOut',
        onComplete: () => {
            scene.tweens.add({ targets: banner, alpha: 0, delay: 2200, duration: 600, onComplete: () => banner.destroy() });
        }
    });

    scheduleMotherWave(1800);
}

function scheduleMotherWave(firstDelay) {
    if (!motherActive) return;

    const delay = firstDelay || Math.max(1800, 3800 - (score - 4) * 400);
    motherWaveTimer = scene.time.delayedCall(delay, () => {
        motherWaveTimer = null;
        if (!motherActive || lives <= 0) return;
        if (!isPaused && extractionPhase !== 2) {
            spawnBabies(Phaser.Math.Between(2, 3)); // Crías desde arriba
            spawnFromCraters(Phaser.Math.Between(1, 2)); // Arañas saliendo de los huecos/cráteres del planeta
        }
        scheduleMotherWave();
    });
}

function spawnBabies(n) {
    if (!motherActive || !mother || !mother.active) return;

    scene.tweens.add({ targets: mother, scale: 1.75, duration: 160, yoyo: true });
    scene.cameras.main.shake(250, 0.006);

    const v = scene.cameras.main.worldView;
    for (let i = 0; i < n; i++) {
        if (enemies.countActive(true) >= MAX_ENEMIES) break;
        const bx = Phaser.Math.Clamp(Phaser.Math.Between(v.left + 60, v.right - 60), 20, WORLD_W - 20);
        const baby = spawnEnemy(bx, v.top - 40 - i * 30, 0.6);
        baby.setData('baby', true);
        baby.setData('active', true);
    }
}

// NUEVA FUNCIÓN: Generar arañas furiosas saliendo de los huecos/cráteres del suelo
function spawnFromCraters(n) {
    if (!motherActive || craters.length === 0) return;

    for (let i = 0; i < n; i++) {
        if (enemies.countActive(true) >= MAX_ENEMIES) break;
        // Elegir un cráter al azar en el mapa
        let crater = Phaser.Utils.Array.GetRandom(craters);
        
        let spider = spawnEnemy(crater.x, crater.y, 0.85);
        spider.setData('active', true);
        spider.setAlpha(0);

        // Efecto de aparición emergiendo del hueco
        scene.tweens.add({
            targets: spider,
            alpha: 1,
            scale: depthScaleFor(crater.y),
            duration: 400,
            ease: 'Power2'
        });
    }
}

function stopMother() {
    motherActive = false;
    if (motherWaveTimer) { motherWaveTimer.remove(false); motherWaveTimer = null; }
    if (motherAnimEvent) { motherAnimEvent.remove(false); motherAnimEvent = null; }
}

function clearComms() {
    if (commsTyper) { commsTyper.remove(false); commsTyper = null; }
    if (commsHold) { commsHold.remove(false); commsHold = null; }
    if (commsElements.length) {
        scene.tweens.killTweensOf(commsElements);
        commsElements.forEach(el => el.destroy());
        commsElements = [];
    }
}

function showComms(message, good) {
    clearComms();

    const color = good ? 0x00ffff : 0xff0055;
    const css = good ? '#00ffff' : '#ff4d79';
    const px = 20, py = 500, pw = 580, ph = 82;
    const font = 'Courier, monospace';

    const bg = scene.add.rectangle(px + pw / 2, py + ph / 2, pw, ph, 0x05050a, 0.93)
        .setStrokeStyle(2, color).setScrollFactor(0).setDepth(15000);
    const face = scene.add.text(px + 14, py + 16, good ? FACE_HAPPY : FACE_DEADPAN, {
        fontFamily: font, fontSize: '16px', fill: css
    }).setScrollFactor(0).setDepth(15001);
    const header = scene.add.text(px + 104, py + 8, '> CENTRAL // TRANSMISIÓN ENTRANTE', {
        fontFamily: font, fontSize: '11px', fill: css
    }).setScrollFactor(0).setDepth(15001);
    const body = scene.add.text(px + 104, py + 28, '', {
        fontFamily: font, fontSize: '14px', fill: '#ffffff', wordWrap: { width: pw - 124 }
    }).setScrollFactor(0).setDepth(15001);

    commsElements = [bg, face, header, body];

    let shown = 0;
    commsTyper = scene.time.addEvent({
        delay: 28,
        repeat: message.length - 1,
        callback: () => {
            shown++;
            if (body.active) body.setText(message.substring(0, shown));
        }
    });

    commsHold = scene.time.delayedCall(message.length * 28 + 2800, () => {
        commsHold = null;
        scene.tweens.add({
            targets: commsElements,
            alpha: 0,
            duration: 400,
            onComplete: clearComms
        });
    });
}

function triggerExtraction() {
    if (extracting || !gameStarted || isPaused || cuttingActive) return;
    extracting = true;
    extractionPhase = 0;
    window.extractingStartTime = scene.time.now;

    if (!playerAlerted) {
        playerAlerted = true;
        scene.cameras.main.shake(600, 0.01);
    }

    if (score > 0) {
        extractionCountdownTimer = 7000;
        corporateHelpActive = true;
        showComms('¡Tienes ' + score + (score === 1 ? ' huevo' : ' huevos') + ' acumulando $' + money + '! Vamos en seguida.', true);
        
        let offsetX = Phaser.Math.Between(-150, 150);
        let offsetY = Phaser.Math.Between(-100, 100);
        extractionPoint.x = player.x + offsetX;
        extractionPoint.y = player.y + offsetY;
    } else {
        extractionCountdownTimer = 3000;
        corporateHelpActive = false;
        showComms('¿En serio no te llevarás nada? Cero dólares para ti. Resuélvelo.', false);
        
        const view = scene.cameras.main.worldView;
        extractionPoint.x = player.x < view.centerX ? view.right - 80 : view.left + 80;
        extractionPoint.y = player.y < view.centerY ? view.bottom - 80 : view.top + 80;
    }

    extractionPoint.x = Phaser.Math.Clamp(extractionPoint.x, 100, WORLD_W - 100);
    extractionPoint.y = Phaser.Math.Clamp(extractionPoint.y, 100, WORLD_H - 100);

    extractionZone = scene.add.text(extractionPoint.x, extractionPoint.y, '[ X ]', {
        fontFamily: 'Courier, monospace',
        fontSize: '18px',
        fill: score > 0 ? '#00ffff' : '#ff0055'
    }).setOrigin(0.5);

    scene.tweens.add({
        targets: extractionZone,
        alpha: 0.2,
        duration: 400,
        yoyo: true,
        repeat: -1
    });

    scene.time.delayedCall(extractionTotalTimer, () => {
        if (lives > 0 && extracting) {
            extractionPhase = 1;
            if (extractionZone) extractionZone.destroy();

            const shipAscii = 
                "   /===\\   \n" +
                "  [=====]  \n" +
                "== O O O == ";

            extractionShip = scene.add.text(extractionPoint.x, extractionPoint.y - 400, shipAscii, {
                fontFamily: 'Courier, monospace',
                fontSize: '16px',
                fill: '#00ffff',
                align: 'center'
            }).setOrigin(0.5);

            extractionBeam = scene.add.rectangle(extractionPoint.x, extractionPoint.y - 340, 50, 120, 0x00ffff, 0.3).setOrigin(0.5, 0);

            scene.tweens.add({
                targets: [extractionShip, extractionBeam],
                y: '+=280',
                duration: 1500,
                ease: 'Power2',
                onComplete: () => {
                    scene.cameras.main.shake(300, 0.008);
                }
            });

            scene.time.delayedCall(extractionCountdownTimer, () => {
                if (lives > 0 && extracting && extractionPhase === 1) {
                    let distance = Phaser.Math.Distance.Between(player.x, player.y, extractionPoint.x, extractionPoint.y);
                    if (distance < 50) {
                        extractionPhase = 2;
                        corporateHelpActive = false;
                        player.body.setVelocity(0);

                        scene.tweens.add({
                            targets: player,
                            y: extractionPoint.y - 100,
                            duration: 1500,
                            ease: 'Power2',
                            onComplete: () => {
                                triggeredVictory();
                            }
                        });
                    } else {
                        showComms('Abandono de personal detectado. Adiós.', false);
                        extracting = false;
                        corporateHelpActive = false;
                        if (extractionShip) extractionShip.destroy();
                        if (extractionBeam) extractionBeam.destroy();
                    }
                }
            });
        }
    });
}

function triggeredVictory() {
    clearComms();
    stopMother();
    scene.physics.pause();
    scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.85).setScrollFactor(0).setDepth(10000);

    const victoryArt = 
        "  __  __ ___ ____ ___ ___  _   _    ____ _   _ __  __ ___  _     ____    _    \n" +
        " |  \\/  |_ _/ ___|_ _/ _ \\| \\ | |  / ___| | | |  \\/  | _ \\| |   |  _ \\  / \\   \n" +
        " | |\\/| || |\\___ \\| | | | |  \\| | | |   | | | | |\\/| | |_) | |   | | | |/ _ \\  \n" +
        " | |  | || | ___) | | |_| | |\\  | | |___| |_| | |  | |  __/| |___| |_| / ___ \\ \n" +
        " |_|  |_|___|____/___\\___/|_| \\_|  \\____|\\___/|_|  |_|_|   |_____|____/_/   \\_\\";

    scene.add.text(400, 240, victoryArt, {
        fontFamily: 'Courier, monospace',
        fontSize: '10px',
        fill: '#00ff41',
        align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);

    scene.add.text(400, 330, 'Huevos extraídos: ' + score + ' / 10', {
        fontFamily: 'Courier, monospace',
        fontSize: '16px',
        fill: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);

    scene.add.text(400, 370, 'Dinero total obtenido: $' + money + ' / $3000', {
        fontFamily: 'Courier, monospace',
        fontSize: '18px',
        fill: '#00ffcc'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);

    scene.add.text(400, 420, 'Presiona ESPACIO para volver a jugar', {
        fontFamily: 'Courier, monospace',
        fontSize: '14px',
        fill: '#00ff41'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);

    scene.input.keyboard.once('keydown-SPACE', () => scene.scene.restart());
}

function endGame() {
    clearComms();
    stopMother();
    scene.physics.pause();
    scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.85).setScrollFactor(0).setDepth(10000);

    const cleanDefeat = 
        " __  __ ___ ____ ___ ___  _   _      ___ _    _     ___ ____    _    \n" +
        "|  \\/  |_ _/ ___|_ _/ _ \\| \\ | |    |  _| |  | |   |_ _|  _ \\  / \\   \n" +
        "| |\\/| || |\\___ \\| | | | |  \\| |    | |_ | |  | |    | || | | |/ _ \\  \n" +
        "| |  | || | ___) | | |_| | |\\  |    |  _|| |__| |___ | || |_| / ___ \\ \n" +
        "|_|  |_|___|____/___\\___/|_| \\_|    |_|  |_____|_____|___|____/_/   \\_\\";

    scene.add.text(400, 260, cleanDefeat, {
        fontFamily: 'Courier, monospace',
        fontSize: '12px',
        fill: '#ff0055',
        align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);

    scene.add.text(400, 350, 'Presiona ESPACIO para reintentar', {
        fontFamily: 'Courier, monospace',
        fontSize: '18px',
        fill: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);

    scene.input.keyboard.once('keydown-SPACE', () => scene.scene.restart());
}

function update(time, delta) {
    if (lives <= 0) return;

    drawMinimap();

    if (Phaser.Input.Keyboard.JustDown(spaceKey)) {
        if (cuttingActive) {
            cancelCutting();
            return;
        }

        isPaused = !isPaused;
        if (isPaused) {
            scene.physics.pause();
            if (introTween1) introTween1.pause();
            if (introTween2) introTween2.pause();
            if (introTween3) introTween3.pause();

            let bgOverlay = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.75).setScrollFactor(0).setDepth(10000);
            pauseElements.push(bgOverlay);

            const pauseArt = 
                "  ____   _   _ ____   ____      _    \n" +
                " |  _ \\ / \\ | / ___| / ___|    / \\   \n" +
                " | |_) / _ \\| \\___ \\ \\___ \\   / _ \\  \n" +
                " |  __/ ___ \\ |___) | ___) | / ___ \\ \n" +
                " |_| /_/   \\_\\____/ |____/ /_/   \\_\\";

            let asciiTitle = scene.add.text(400, 250, pauseArt, {
                fontFamily: 'Courier, monospace',
                fontSize: '16px',
                fill: '#00ff41',
                align: 'center'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
            pauseElements.push(asciiTitle);

            let subText = scene.add.text(400, 370, '- PRESIONA ESPACIO PARA CONTINUAR -', {
                fontFamily: 'Courier, monospace',
                fontSize: '18px',
                fill: '#ffffff'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
            pauseElements.push(subText);

        } else {
            scene.physics.resume();
            if (introTween1) introTween1.resume();
            if (introTween2) introTween2.resume();
            if (introTween3) introTween3.resume();

            pauseElements.forEach(element => element.destroy());
            pauseElements = [];
        }
    }

    if (isPaused || !gameStarted) {
        if (player && isPaused) player.body.setVelocity(0);
        if (isPaused) return;
        if (!gameStarted) return;
    }

    if (Phaser.Input.Keyboard.JustDown(extractKey)) {
        triggerExtraction();
    }

    if (extracting) {
        let elapsedTime = scene.time.now - window.extractingStartTime;
        if (extractionPhase === 0) {
            let remainingInitial = Math.max(0, Math.ceil((extractionTotalTimer - elapsedTime) / 1000));
            extractionText.setText('EXTRACCIÓN EN CAMINO: ' + remainingInitial + 's');
        } else if (extractionPhase === 1) {
            let elapsedArrival = elapsedTime - extractionTotalTimer;
            let remainingArrival = Math.max(0, Math.ceil((extractionCountdownTimer - elapsedArrival) / 1000));
            let zoneLabel = score > 0 ? 'SÚBETE AL [ X ] (VIP): ' : 'SÚBETE AL [ X ] (ZONA HOSTIL): ';
            extractionText.setText(zoneLabel + remainingArrival + 's');
        }
    } else {
        extractionText.setText('[E] Solicitar Extracción');
    }

    if (corporateHelpActive && extractionShip) {
        enemies.getChildren().forEach(e => {
            if (e.active && Phaser.Math.Distance.Between(extractionShip.x, extractionShip.y, e.x, e.y) < 250) {
                if (Math.random() < 0.1) {
                    let supportLaser = scene.add.text(extractionShip.x, extractionShip.y, 'v', { fontFamily: 'Courier', fontSize: '14px', fill: '#00ffff' });
                    scene.physics.add.existing(supportLaser);
                    scene.physics.moveToObject(supportLaser, e, 600);
                    scene.physics.add.overlap(supportLaser, e, (laser, enemy) => {
                        laser.destroy();
                        enemy.destroy();
                    });
                }
            }
        });
    }

    const view = scene.cameras.main.worldView;

    bullets.getChildren().slice().forEach(b => {
        if (b.x < view.left - 150 || b.x > view.right + 150) b.destroy();
    });

    if (extractionPhase === 2 || cuttingActive) {
        player.body.setVelocity(0);
        if (cuttingActive) {
            if (cutUIElements[4]) {
                cutUIElements[4].width = Math.min(300, (cutProgress / 100) * 300);
            }
            if (cursors.left.isDown || cursors.right.isDown || cursors.up.isDown || cursors.down.isDown) {
                cancelCutting();
            }
        }
        return;
    }

    player.body.setVelocity(0);
    
    if (cursors.left.isDown) {
        player.body.setVelocityX(-300);
        player.setData('facing', 'left');
    } else if (cursors.right.isDown) {
        player.body.setVelocityX(300);
        player.setData('facing', 'right');
    }

    if (cursors.up.isDown) {
        player.body.setVelocityY(-300);
    } else if (cursors.down.isDown) {
        player.body.setVelocityY(300);
    }

    const pc = player.body.center;

    coins.getChildren().forEach(coin => {
        if (coin.active && Phaser.Math.Distance.Between(pc.x, pc.y, coin.x, coin.y) < 45) {
            startCutting(coin);
        }
    });

    if (Phaser.Input.Keyboard.JustDown(attackKey)) {
        shootBullet();
    }

    player.setDepth(player.y);

    enemies.getChildren().forEach(e => {
        const isActive = e.getData('active');

        if (isActive) {
            if (playerAlerted) {
                const d = Phaser.Math.Distance.Between(e.x, e.y, pc.x, pc.y);
                let speed = Phaser.Math.Clamp(d * 0.35, 45, 160);
                if (e.getData('baby')) speed *= 1.25;
                scene.physics.moveToObject(e, pc, speed);
            } else if (scene.time.now < e.getData('idleUntil')) {
                e.body.setVelocity(0);
            } else {
                let target = e.getData('patrolTarget');
                if (Phaser.Math.Distance.Between(e.x, e.y, target.x, target.y) < 20) {
                    target = {
                        x: Phaser.Math.Between(60, WORLD_W - 60),
                        y: Phaser.Math.Between(60, WORLD_H - 60)
                    };
                    e.setData('patrolTarget', target);
                    if (Math.random() < 0.5) {
                        e.setData('idleUntil', scene.time.now + Phaser.Math.Between(1000, 3000));
                    }
                }
                scene.physics.moveToObject(e, target, e.getData('wanderSpeed'));
            }
        } else {
            e.body.setVelocity(0);
        }

        const moving = isActive && e.body.speed > 1;

        if (moving) {
            e.rotation = Math.atan2(e.body.velocity.y, e.body.velocity.x) + Math.PI / 2;
        }

        e.setDepth(e.y);
        e.setScale(depthScaleFor(e.y) * (e.getData('sizeMul') || 1));

        if (playerAlerted && !e.getData('alertTinted')) {
            e.setTint(0xff5555);
            e.setData('alertTinted', true);
        }

        if (moving) {
            let timer = e.getData('animTimer') + 1;
            if (timer > (playerAlerted ? 8 : 15)) {
                let nextFrame = e.getData('frame') === 0 ? 1 : 0;
                e.setTexture('spider' + nextFrame);
                e.setData('frame', nextFrame);
                timer = 0;
            }
            e.setData('animTimer', timer);
        }
    });
}

function createMinimap() {
    scene.minimapGfx = scene.add.graphics().setScrollFactor(0).setDepth(5000);
    scene.minimapLabel = scene.add.text(618, 436, 'RADAR PLANETARIO', {
        fontSize: '9px', fill: '#ff4d79', fontFamily: 'Courier'
    }).setScrollFactor(0).setDepth(5001);
}

function drawMinimap() {
    const g = scene.minimapGfx;
    if (!g) return;

    const mapX = 610, mapY = 430, mapW = 180, mapH = 150;
    const inX = mapX + 2, inY = mapY + 22, inW = mapW - 4, inH = mapH - 29;
    const now = scene.time.now;

    const mx = x => inX + Phaser.Math.Clamp(x / WORLD_W, 0, 1) * inW;
    const my = y => inY + Phaser.Math.Clamp(y / WORLD_H, 0, 1) * inH;

    g.clear();

    g.fillStyle(0x1a0508, 0.9);
    g.fillRect(mapX, mapY, mapW, mapH);
    g.lineStyle(2, 0xff4d79, 1);
    g.strokeRect(mapX, mapY, mapW, mapH);
    g.lineStyle(1, 0x4a1525, 1);
    g.strokeRect(inX, inY, inW, inH);

    const sweepX = inX + ((now / 25) % inW);
    g.lineStyle(1, 0xff4d79, 0.25);
    g.lineBetween(sweepX, inY, sweepX, inY + inH);

    const v = scene.cameras.main.worldView;
    g.lineStyle(1, 0xffffff, 0.35);
    g.strokeRect(mx(v.x), my(v.y), (v.width / WORLD_W) * inW, (v.height / WORLD_H) * inH);

    g.fillStyle(0xff1a40, 1);
    coins.getChildren().forEach(coin => {
        if (coin.active) g.fillRect(mx(coin.x) - 1, my(coin.y) - 1, 3, 3);
    });

    if (extracting && extractionZone) {
        const blink = Math.floor(now / 300) % 2 === 0;
        g.fillStyle(score > 0 ? 0x00ffff : 0xff0055, blink ? 1 : 0.4);
        g.fillRect(mx(extractionPoint.x) - 2, my(extractionPoint.y) - 2, 5, 5);
    }

    g.fillStyle(playerAlerted ? 0xff0000 : 0xffaa00, 1);
    enemies.getChildren().forEach(e => {
        if (e.active) g.fillRect(mx(e.x) - 1, my(e.y) - 1, 3, 3);
    });

    const pulse = 3 + 2 * Math.sin(now / 200);

    if (player && player.alpha > 0) {
        const c = player.body.center;
        g.fillStyle(0x00ff41, 1);
        g.fillRect(mx(c.x) - 2, my(c.y) - 2, 4, 4);
        g.lineStyle(1, 0x00ff41, 0.6);
        g.strokeCircle(mx(c.x), my(c.y), pulse + 2);
    } else {
        g.lineStyle(1, 0x00ffff, 0.8);
        g.strokeCircle(mx(landingX), my(landingY), pulse + 2);
        g.fillStyle(0x00ffff, 1);
        g.fillRect(mx(landingX) - 1, my(landingY) - 1, 3, 3);
    }
}
