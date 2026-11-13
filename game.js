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
let scoreText, livesText, extractionText, timerText;
let score = 0, lives = 3, invulnerable = false;
let isPaused = false, pauseElements = [];
let lastFired = 0;
let gameStarted = false;
let introTween1, introTween2, introTween3;
let landingX = 400;

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

// Diálogo de la Central (no bloquea el juego)
let commsElements = [];
let commsTyper = null;
let commsHold = null;
const FACE_HAPPY = " ,-^-, \n |^_^| \n '---' ";
const FACE_DEADPAN = " ,-^-, \n |-_-| \n '---' ";

function create() {
    scene = this;

    score = 0;
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

    landingX = Phaser.Math.Between(250, 550);

    let ambientRedOverlay = scene.add.rectangle(400, 300, 800, 600, 0xff0033, 0.12);
    ambientRedOverlay.setDepth(9999);

    drawGround();
    ensureSpiderTextures();

    coins = this.physics.add.group();
    enemies = this.physics.add.group();
    bullets = this.physics.add.group();

    for (let i = 0; i < 10; i++) {
        spawnStaticCoin(Phaser.Math.Between(100, 700), Phaser.Math.Between(100, 500));
    }

    // Las arañas ya están en el planeta desde el segundo cero (quietas hasta que aterrizas)
    for (let i = 0; i < 6; i++) {
        let sx, sy;
        do {
            sx = Phaser.Math.Between(70, 730);
            sy = Phaser.Math.Between(150, 540);
        } while (Phaser.Math.Distance.Between(sx, sy, landingX, 350) < 200);

        let enemy = spawnEnemy(sx, sy);
        enemy.setData('patrolTarget', { x: Phaser.Math.Between(100, 700), y: Phaser.Math.Between(100, 500) });
    }

    enemies.getChildren().forEach(e => e.setData('active', false));

    const playerAscii = 
        "  o  \n" +
        " [#] \n" +
        " / \\ ";
    
    player = this.add.text(landingX, 50, playerAscii, {
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

    ship = this.add.text(landingX, -50, shipAscii, {
        fontFamily: 'Courier, monospace',
        fontSize: '16px',
        fill: '#00ffff',
        align: 'center'
    }).setOrigin(0.5);

    beam = this.add.rectangle(landingX, 150, 60, 300, 0x00ffff, 0.25).setOrigin(0.5, 0);

    introTween1 = scene.tweens.add({
        targets: ship,
        y: 100,
        duration: 2000,
        ease: 'Power2',
        onComplete: () => {
            player.setPosition(landingX - 10, 120);
            player.setAlpha(1);

            introTween2 = scene.tweens.add({
                targets: player,
                y: 350,
                duration: 1500,
                ease: 'Linear',
                onComplete: () => {
                    beam.destroy();
                    scene.cameras.main.flash(500, 255, 0, 50);

                    introTween3 = scene.tweens.add({
                        targets: ship,
                        y: -100,
                        x: landingX + 500,
                        duration: 1500,
                        ease: 'Power2',
                        onComplete: () => ship.destroy()
                    });

                    enemies.getChildren().forEach(e => e.setData('active', true));
                    gameStarted = true;
                }
            });
        }
    });

    scoreText = this.add.text(16, 16, 'Huevos: 0 / 10', { fontSize: '18px', fill: '#ff4d79', fontFamily: 'Courier' });
    livesText = this.add.text(16, 42, 'Salud: 3', { fontSize: '18px', fill: '#ff0055', fontFamily: 'Courier' });
    extractionText = this.add.text(16, 68, '[E] Solicitar Extracción', { fontSize: '16px', fill: '#00ffff', fontFamily: 'Courier' });
    timerText = this.add.text(16, 94, '', { fontSize: '16px', fill: '#ffaa00', fontFamily: 'Courier' });

    createMinimap();

    this.physics.add.overlap(player, enemies, hitEnemy);
    this.physics.add.overlap(bullets, enemies, destroyEnemy);

    cursors = this.input.keyboard.createCursorKeys();
    spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.KeyF);
    extractKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Configurar evento de movimiento del mouse para el minijuego de corte
    scene.input.on('pointermove', (pointer) => {
        if (!cuttingActive) return;

        // Detectar arrastre de izquierda a derecha para cortar
        let deltaX = pointer.x - lastMouseX;
        if (deltaX > 2) { // Si mueve el mouse a la derecha activamente
            cutProgress += deltaX * 0.8;
            if (cutProgress >= 100) {
                completeCutting();
            }
        }
        lastMouseX = pointer.x;
    });
}

// ───────────────────────── SUELO ─────────────────────────
// Se dibuja una sola vez y se convierte en textura (no pesa en cada frame).
// Cada partida genera un planeta distinto.
function drawGround() {
    const W = 800, H = 600;
    const rnd = Phaser.Math.Between;
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    // base de tierra
    g.fillStyle(0x2b0b14, 1);
    g.fillRect(0, 0, W, H);

    // manchas de tierra más clara y más oscura
    const patchColors = [0x34101b, 0x240912, 0x3d1522, 0x1e0710, 0x40192a];
    for (let i = 0; i < 55; i++) {
        g.fillStyle(pick(patchColors), 0.5);
        g.fillEllipse(rnd(0, W), rnd(0, H), rnd(90, 260), rnd(40, 130));
    }

    // cráteres
    for (let i = 0; i < 6; i++) {
        const cx = rnd(60, W - 60), cy = rnd(150, H - 50);
        const cw = rnd(40, 90), ch = Math.round(cw * 0.45);
        g.fillStyle(0x14050b, 0.7);
        g.fillEllipse(cx, cy, cw, ch);
        g.lineStyle(2, 0x5a2236, 0.55);
        g.strokeEllipse(cx, cy - 1, cw + 4, ch + 3);
    }

    // grietas
    for (let i = 0; i < 16; i++) {
        let px = rnd(0, W), py = rnd(110, H);
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

    // grano / arenilla
    const grit = [0x4a1a2b, 0x5e2438, 0x1a060c, 0x3a1624];
    for (let i = 0; i < 900; i++) {
        g.fillStyle(pick(grit), 0.45 + Math.random() * 0.4);
        const s = Math.random() < 0.8 ? 1 : 2;
        g.fillRect(rnd(0, W), rnd(0, H), s, s);
    }

    // rocas con sombra y brillo
    for (let i = 0; i < 30; i++) {
        const rx = rnd(10, W - 10), ry = rnd(110, H - 10);
        const rw = rnd(6, 20), rh = Math.round(rw * 0.6);
        g.fillStyle(0x0d0306, 0.5);
        g.fillEllipse(rx + 2, ry + rh * 0.45, rw + 4, rh * 0.6);
        g.fillStyle(pick([0x3a1624, 0x4a2030, 0x2e1019]), 1);
        g.fillEllipse(rx, ry, rw, rh);
        g.fillStyle(0x7a3a52, 0.55);
        g.fillEllipse(rx - rw * 0.15, ry - rh * 0.2, rw * 0.5, rh * 0.4);
    }

    // mechones de pasto alienígena (más abajo = más cerca = más grande)
    const bladeColors = [0xff4d79, 0xd63a68, 0x9c2a4d, 0xff7aa0];
    for (let i = 0; i < 110; i++) {
        const tx = rnd(10, W - 10), ty = rnd(110, H - 6);
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

    // esporas luminosas
    for (let i = 0; i < 30; i++) {
        const sx = rnd(10, W - 10), sy = rnd(110, H - 10);
        g.fillStyle(0xff4d79, 0.12);
        g.fillCircle(sx, sy, 5);
        g.fillStyle(0xff9ab5, 0.7);
        g.fillCircle(sx, sy, 1.2);
    }

    // niebla en el horizonte (ayuda a leer el HUD)
    for (let i = 0; i < 10; i++) {
        g.fillStyle(0x12030a, 0.55 * (1 - i / 10));
        g.fillRect(0, i * 13, W, 13);
    }

    // viñeta en los bordes
    for (let k = 0; k < 8; k++) {
        const t = 18 * (k + 1);
        g.fillStyle(0x0a0206, 0.05);
        g.fillRect(0, 0, t, H);
        g.fillRect(W - t, 0, t, H);
        g.fillRect(0, H - t, W, t);
    }

    if (scene.textures.exists('ground')) scene.textures.remove('ground');
    g.generateTexture('ground', W, H);
    g.destroy();

    scene.add.image(0, 0, 'ground').setOrigin(0, 0).setDepth(-10);
}

// ───────────────────────── ARAÑAS ─────────────────────────
// Dos frames de caminata dibujados una vez (patas alternadas).
function ensureSpiderTextures() {
    if (scene.textures.exists('spider0')) return;

    const W = 56, H = 48;
    const legs = [
        { s: [24, 15], k: [12, 5],  f: [4, 11] },
        { s: [23, 18], k: [9, 14],  f: [2, 22] },
        { s: [23, 21], k: [9, 25],  f: [3, 34] },
        { s: [24, 24], k: [12, 33], f: [7, 41] }
    ];

    [0, 1].forEach(frame => {
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        const sign = frame === 0 ? 1 : -1;

        // sombra
        g.fillStyle(0x000000, 0.4);
        g.fillEllipse(30, 30, 32, 22);

        // patas (izquierda y derecha en espejo, andar alternado)
        legs.forEach((leg, i) => {
            [-1, 1].forEach(side => {
                const shift = (i % 2 === 0 ? 1 : -1) * side * sign * 2;
                const mx = v => (side === -1 ? v : W - v);
                const sx = mx(leg.s[0]), sy = leg.s[1];
                const kx = mx(leg.k[0]), ky = leg.k[1] + shift;
                const fx = mx(leg.f[0]), fy = leg.f[1] + shift * 1.5;

                g.lineStyle(3, 0x4a2010, 1);
                g.lineBetween(sx, sy, kx, ky);
                g.lineBetween(kx, ky, fx, fy);
                g.lineStyle(1, 0xffaa00, 0.85);
                g.lineBetween(sx, sy, kx, ky);
                g.lineBetween(kx, ky, fx, fy);
                g.fillStyle(0xffcc33, 1);
                g.fillCircle(kx, ky, 1.5);
            });
        });

        // abdomen
        g.fillStyle(0x1c0a14, 1);
        g.fillEllipse(28, 29, 20, 24);
        g.lineStyle(1.5, 0xffaa00, 0.9);
        g.strokeEllipse(28, 29, 20, 24);
        g.fillStyle(0xffaa00, 0.95);
        g.fillTriangle(28, 24, 25, 29, 31, 29);
        g.fillTriangle(28, 35, 25, 29, 31, 29);

        // cefalotórax
        g.fillStyle(0x2a1020, 1);
        g.fillEllipse(28, 15, 13, 13);
        g.lineStyle(1.5, 0xffaa00, 0.9);
        g.strokeEllipse(28, 15, 13, 13);

        // colmillos
        g.fillStyle(0xffaa00, 1);
        g.fillTriangle(25, 9, 27.5, 9, 26, 4);
        g.fillTriangle(31, 9, 28.5, 9, 30, 4);

        // ojos
        g.fillStyle(0xffe066, 1);
        g.fillCircle(25.5, 13, 1.8);
        g.fillCircle(30.5, 13, 1.8);
        g.fillCircle(27, 16.5, 1.1);
        g.fillCircle(29, 16.5, 1.1);

        g.generateTexture('spider' + frame, W, H);
        g.destroy();
    });
}

function spawnStaticCoin(x, y) {
    const redEggAscii = 
        "  /\\  \n" +
        " <##> \n" +
        "  \\/  ";

    let coin = scene.add.text(x, y, redEggAscii, {
        fontFamily: 'Courier, monospace',
        fontSize: '15px',
        fill: '#ff1a40'
    });
    
    scene.physics.add.existing(coin);
    coin.body.setSize(30, 35);
    coin.setDepth(y);
    coin.setScale(Phaser.Math.Clamp(y / 450, 0.8, 1.2));
    coins.add(coin);
}

function spawnEnemy(x, y) {
    let enemy = scene.add.sprite(x, y, 'spider0');

    scene.physics.add.existing(enemy);
    enemy.body.setSize(34, 30);
    enemy.setDepth(y);
    enemy.setScale(Phaser.Math.Clamp(y / 450, 0.7, 1.3));
    enemy.setData('animTimer', 0);
    enemy.setData('frame', 0);
    enemy.setData('active', false);
    enemy.setData('alertTinted', false);
    
    enemies.add(enemy);
    return enemy;
}

function hitEnemy(p, enemy) {
    if (invulnerable || isPaused || !gameStarted || extractionPhase === 2) return;

    if (cuttingActive) cancelCutting();

    lives--;
    livesText.setText('Salud: ' + lives);
    enemy.destroy();
    
    let side = Phaser.Math.Between(0, 3);
    let outX = side === 0 ? -300 : (side === 1 ? 1100 : Phaser.Math.Between(-300, 1100));
    let outY = side === 2 ? -300 : (side === 3 ? 900 : Phaser.Math.Between(-300, 900));
    let newE = spawnEnemy(outX, outY);
    newE.setData('active', true);
    newE.setData('patrolTarget', { x: Phaser.Math.Between(100, 700), y: Phaser.Math.Between(100, 500) });

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
    bullet.destroy();
    enemy.destroy();
    scene.time.delayedCall(6000, () => {
        if (lives > 0) {
            let side = Phaser.Math.Between(0, 3);
            let outX = side === 0 ? -300 : (side === 1 ? 1100 : Phaser.Math.Between(-300, 1100));
            let outY = side === 2 ? -300 : (side === 3 ? 900 : Phaser.Math.Between(-300, 900));
            let newE = spawnEnemy(outX, outY);
            newE.setData('active', true);
            newE.setData('patrolTarget', { x: Phaser.Math.Between(100, 700), y: Phaser.Math.Between(100, 500) });
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

    // Al interactuar con el huevo, se produce el temblor y se alerta a la horda
    if (!playerAlerted) {
        playerAlerted = true;
        scene.cameras.main.shake(800, 0.015);
    }

    // Interfaz en primer plano del minijuego
    let bgBox = scene.add.rectangle(400, 300, 450, 250, 0x05050a, 0.95).setStrokeStyle(3, 0xff1a40).setDepth(20000);
    let title = scene.add.text(400, 200, '>>> CORTE DE CÁPSULA TÁCTICA <<<', { fontSize: '14px', fill: '#ff4d79', fontFamily: 'Courier' }).setOrigin(0.5).setDepth(20001);
    let instruction = scene.add.text(400, 230, 'Mueve el mouse de izquierda a derecha', { fontSize: '12px', fill: '#ffffff', fontFamily: 'Courier' }).setOrigin(0.5).setDepth(20001);
    
    let barBg = scene.add.rectangle(400, 300, 300, 24, 0x222222).setStrokeStyle(1, 0xffffff).setDepth(20000);
    let barFill = scene.add.rectangle(250, 300, 0, 20, 0xff1a40).setOrigin(0, 0.5).setDepth(20001);

    let cancelBtn = scene.add.text(400, 380, '[ Presiona ESPACIO o muévete para cancelar ]', { fontSize: '11px', fill: '#ffaa00', fontFamily: 'Courier' }).setOrigin(0.5).setDepth(20001);

    cutUIElements = [bgBox, title, instruction, barBg, barFill, cancelBtn];
}

function completeCutting() {
    if (!cuttingActive) return;
    if (targetCoin && targetCoin.active) {
        targetCoin.destroy();
    }
    score++;
    scoreText.setText('Huevos: ' + score + ' / 10');
    closeCuttingUI();
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

// ───────────────────── DIÁLOGO DE LA CENTRAL ─────────────────────
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
        .setStrokeStyle(2, color).setDepth(15000);
    const face = scene.add.text(px + 14, py + 16, good ? FACE_HAPPY : FACE_DEADPAN, {
        fontFamily: font, fontSize: '16px', fill: css
    }).setDepth(15001);
    const header = scene.add.text(px + 104, py + 8, '> CENTRAL // TRANSMISIÓN ENTRANTE', {
        fontFamily: font, fontSize: '11px', fill: css
    }).setDepth(15001);
    const body = scene.add.text(px + 104, py + 28, '', {
        fontFamily: font, fontSize: '14px', fill: '#ffffff', wordWrap: { width: pw - 124 }
    }).setDepth(15001);

    commsElements = [bg, face, header, body];

    // efecto máquina de escribir
    let shown = 0;
    commsTyper = scene.time.addEvent({
        delay: 28,
        repeat: message.length - 1,
        callback: () => {
            shown++;
            if (body.active) body.setText(message.substring(0, shown));
        }
    });

    // se queda un rato y se desvanece
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
        showComms('¡Tienes ' + score + (score === 1 ? ' huevo' : ' huevos') + '! Qué bueno, vamos en seguida.', true);
        
        let offsetX = Phaser.Math.Between(-150, 150);
        let offsetY = Phaser.Math.Between(-100, 100);
        extractionPoint.x = Phaser.Math.Clamp(player.x + offsetX, 100, 700);
        extractionPoint.y = Phaser.Math.Clamp(player.y + offsetY, 100, 500);
    } else {
        extractionCountdownTimer = 3000;
        corporateHelpActive = false;
        showComms('¿En serio no te llevarás nada? Buah... igual nos quedas de paso.', false);
        
        extractionPoint.x = player.x < 400 ? 720 : 80;
        extractionPoint.y = player.y < 300 ? 520 : 80;
    }

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

            extractionShip = scene.add.text(extractionPoint.x, extractionPoint.y - 120, shipAscii, {
                fontFamily: 'Courier, monospace',
                fontSize: '16px',
                fill: '#00ffff',
                align: 'center'
            }).setOrigin(0.5);

            extractionBeam = scene.add.rectangle(extractionPoint.x, extractionPoint.y - 60, 50, 120, 0x00ffff, 0.3).setOrigin(0.5, 0);

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
    scene.physics.pause();
    scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.85).setDepth(10000);

    const victoryArt = 
        "  __  __ ___ ____ ___ ___  _   _    ____ _   _ __  __ ___  _     ____    _    \n" +
        " |  \\/  |_ _/ ___|_ _/ _ \\| \\ | |  / ___| | | |  \\/  | _ \\| |   |  _ \\  / \\   \n" +
        " | |\\/| || |\\___ \\| | | | |  \\| | | |   | | | | |\\/| | |_) | |   | | | |/ _ \\  \n" +
        " | |  | || | ___) | | |_| | |\\  | | |___| |_| | |  | |  __/| |___| |_| / ___ \\ \n" +
        " |_|  |_|___|____/___\\___/|_| \\_|  \\____|\\___/|_|  |_|_|   |_____|____/_/   \\_\\";

    scene.add.text(400, 260, victoryArt, {
        fontFamily: 'Courier, monospace',
        fontSize: '10px',
        fill: '#00ff41',
        align: 'center'
    }).setOrigin(0.5).setDepth(10001);

    scene.add.text(400, 350, 'Huevos extraídos: ' + score + ' / 10', {
        fontFamily: 'Courier, monospace',
        fontSize: '16px',
        fill: '#ffffff'
    }).setOrigin(0.5).setDepth(10001);

    scene.add.text(400, 400, 'Presiona ESPACIO para volver a jugar', {
        fontFamily: 'Courier, monospace',
        fontSize: '14px',
        fill: '#00ff41'
    }).setOrigin(0.5).setDepth(10001);

    scene.input.keyboard.once('keydown-SPACE', () => scene.scene.restart());
}

function endGame() {
    clearComms();
    scene.physics.pause();
    scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.85).setDepth(10000);

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
    }).setOrigin(0.5).setDepth(10001);

    scene.add.text(400, 350, 'Presiona ESPACIO para reintentar', {
        fontFamily: 'Courier, monospace',
        fontSize: '18px',
        fill: '#ffffff'
    }).setOrigin(0.5).setDepth(10001);

    scene.input.keyboard.once('keydown-SPACE', () => scene.scene.restart());
}

function update(time, delta) {
    if (lives <= 0) return;

    // El radar funciona desde el segundo cero (intro, pausa y corte incluidos)
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

            let bgOverlay = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.75).setDepth(10000);
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
            }).setOrigin(0.5).setDepth(10001);
            pauseElements.push(asciiTitle);

            let subText = scene.add.text(400, 370, '- PRESIONA ESPACIO PARA CONTINUAR -', {
                fontFamily: 'Courier, monospace',
                fontSize: '18px',
                fill: '#ffffff'
            }).setOrigin(0.5).setDepth(10001);
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

    if (extractionPhase === 2 || cuttingActive) {
        player.body.setVelocity(0);
        if (cuttingActive) {
            // Actualizar la barra visual del minijuego de corte
            if (cutUIElements[4]) {
                cutUIElements[4].width = Math.min(300, (cutProgress / 100) * 300);
            }
            // Si el jugador se mueve con flechas, cancela el corte
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

    coins.getChildren().forEach(coin => {
        if (coin.active && Phaser.Math.Distance.Between(player.x, player.y, coin.x, coin.y) < 40) {
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
                scene.physics.moveToObject(e, player.body.center, 45);
            } else {
                let target = e.getData('patrolTarget');
                if (Phaser.Math.Distance.Between(e.x, e.y, target.x, target.y) < 20) {
                    e.setData('patrolTarget', { x: Phaser.Math.Between(50, 750), y: Phaser.Math.Between(50, 550) });
                }
                scene.physics.moveToObject(e, target, 30);
            }

            // la araña mira hacia donde camina
            if (e.body.speed > 1) {
                e.rotation = Math.atan2(e.body.velocity.y, e.body.velocity.x) + Math.PI / 2;
            }
        } else {
            e.body.setVelocity(0);
        }

        e.setDepth(e.y);

        let depthScale = Phaser.Math.Clamp(e.y / 450, 0.7, 1.3);
        e.setScale(depthScale);

        // ojos y patas se ponen rojos cuando la horda está alerta
        if (playerAlerted && !e.getData('alertTinted')) {
            e.setTint(0xff5555);
            e.setData('alertTinted', true);
        }

        // animación de patas (más rápida en alerta)
        if (isActive) {
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

    coins.getChildren().forEach(coin => {
        coin.setDepth(coin.y);
        let coinScale = Phaser.Math.Clamp(coin.y / 450, 0.8, 1.2);
        coin.setScale(coinScale);
    });
}

// ───────────────────────── MINIMAPA ─────────────────────────
function createMinimap() {
    scene.minimapGfx = scene.add.graphics().setDepth(5000);
    scene.minimapLabel = scene.add.text(628, 446, 'RADAR PLANETARIO', {
        fontSize: '9px', fill: '#ff4d79', fontFamily: 'Courier'
    }).setDepth(5001);
}

function drawMinimap() {
    const g = scene.minimapGfx;
    if (!g) return;

    const mapX = 620, mapY = 440, mapW = 160, mapH = 140;
    const now = scene.time.now;

    const mx = x => mapX + Phaser.Math.Clamp((x / 800) * mapW, 2, mapW - 2);
    const my = y => mapY + 20 + Phaser.Math.Clamp((y / 600) * (mapH - 25), 2, mapH - 27);

    g.clear();

    // marco
    g.fillStyle(0x1a0508, 0.9);
    g.fillRect(mapX, mapY, mapW, mapH);
    g.lineStyle(2, 0xff4d79, 1);
    g.strokeRect(mapX, mapY, mapW, mapH);
    g.lineStyle(1, 0x4a1525, 1);
    g.strokeRect(mapX + 2, mapY + 22, mapW - 4, mapH - 29);

    // barrido del radar
    const sweepX = mapX + 2 + ((now / 25) % (mapW - 4));
    g.lineStyle(1, 0xff4d79, 0.25);
    g.lineBetween(sweepX, mapY + 22, sweepX, mapY + mapH - 7);

    // huevos
    g.fillStyle(0xff1a40, 1);
    coins.getChildren().forEach(coin => {
        if (coin.active) {
            const c = coin.body.center;
            g.fillRect(mx(c.x) - 1, my(c.y) - 1, 3, 3);
        }
    });

    // punto de extracción
    if (extracting && extractionZone) {
        const blink = Math.floor(now / 300) % 2 === 0;
        g.fillStyle(score > 0 ? 0x00ffff : 0xff0055, blink ? 1 : 0.4);
        g.fillRect(mx(extractionPoint.x) - 2, my(extractionPoint.y) - 2, 5, 5);
    }

    // arañas
    g.fillStyle(playerAlerted ? 0xff0000 : 0xffaa00, 1);
    enemies.getChildren().forEach(e => {
        if (e.active) {
            const c = e.body.center;
            g.fillRect(mx(c.x) - 1, my(c.y) - 1, 3, 3);
        }
    });

    const pulse = 3 + 2 * Math.sin(now / 200);

    if (player && player.alpha > 0) {
        // jugador
        const c = player.body.center;
        g.fillStyle(0x00ff41, 1);
        g.fillRect(mx(c.x) - 2, my(c.y) - 2, 4, 4);
        g.lineStyle(1, 0x00ff41, 0.6);
        g.strokeCircle(mx(c.x), my(c.y), pulse + 2);
    } else {
        // aún no aterrizas: marca el punto de aterrizaje
        g.lineStyle(1, 0x00ffff, 0.8);
        g.strokeCircle(mx(landingX), my(350), pulse + 2);
        g.fillStyle(0x00ffff, 1);
        g.fillRect(mx(landingX) - 1, my(350) - 1, 3, 3);
    }
}
