const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#05050a',
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

// Variables de recolección y extracción
let collectingCoin = null;
let collectTimer = 0;
let collectDuration = 10000; // 10 segundos para tomar un huevo
let extracting = false;
let extractionTimer = 15000; // 15 segundos para la extracción

function create() {
    scene = this;

    score = 0;
    lives = 3;
    invulnerable = false;
    isPaused = false;
    gameStarted = false;
    extracting = false;
    collectingCoin = null;
    collectTimer = 0;

    landingX = Phaser.Math.Between(200, 600);

    coins = this.physics.add.group();
    enemies = this.physics.add.group();
    bullets = this.physics.add.group();

    // 1. COLOCAR LOS HUEVOS EN EL MAPA
    for (let i = 0; i < 10; i++) {
        spawnStaticCoin(Phaser.Math.Between(100, 700), Phaser.Math.Between(100, 500));
    }

    // 2. COLOCAR LAS ARAÑAS EN LOS BORDES LEJANOS
    for (let i = 0; i < 4; i++) {
        let edgeX = Math.random() < 0.5 ? Phaser.Math.Between(20, 100) : Phaser.Math.Between(700, 780);
        let edgeY = Math.random() < 0.5 ? Phaser.Math.Between(20, 100) : Phaser.Math.Between(450, 550);
        spawnEnemy(edgeX, edgeY);
    }

    enemies.getChildren().forEach(e => e.setData('active', false));

    // 3. JUGADOR
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

    // 4. NAVE Y HAZ DE LUZ SCI-FI
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
                    
                    // EFECTO DE TEMBLOR DE TIERRA / CÁMARA AL TOCAR EL SUELO
                    scene.cameras.main.shake(800, 0.015); // Tiembla 0.8s con intensidad de 1.5%

                    introTween3 = scene.tweens.add({
                        targets: ship,
                        y: -100,
                        x: landingX + 500,
                        duration: 1500,
                        ease: 'Power2',
                        onComplete: () => ship.destroy()
                    });

                    // Las arañas detectan el impacto y se activan (se verán en el minimapa avanzando desde lejos)
                    enemies.getChildren().forEach(e => e.setData('active', true));
                    gameStarted = true;
                }
            });
        }
    });

    scoreText = this.add.text(16, 16, 'Huevos: 0 / 10', { fontSize: '18px', fill: '#00ff41', fontFamily: 'Courier' });
    livesText = this.add.text(16, 42, 'Salud: 3', { fontSize: '18px', fill: '#ff0055', fontFamily: 'Courier' });
    extractionText = this.add.text(16, 68, '[E] Solicitar Extracción', { fontSize: '16px', fill: '#00ffff', fontFamily: 'Courier' });
    timerText = this.add.text(16, 94, '', { fontSize: '16px', fill: '#ffaa00', fontFamily: 'Courier' });

    this.physics.add.overlap(player, enemies, hitEnemy);
    this.physics.add.overlap(bullets, enemies, destroyEnemy);

    cursors = this.input.keyboard.createCursorKeys();
    spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    extractKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
}

function spawnStaticCoin(x, y) {
    const eggAscii = 
        " *Oo* \n" +
        "o@@@O\n" +
        " *o0* ";

    let coin = scene.add.text(x, y, eggAscii, {
        fontFamily: 'Courier, monospace',
        fontSize: '14px',
        fill: '#ff0055'
    });
    
    scene.physics.add.existing(coin);
    coin.body.setSize(30, 35);
    coins.add(coin);
}

function spawnEnemy(x, y) {
    const spiderAscii = 
        " /\\/\\/\\ \n" +
        " (o.o)  \n" +
        " / /\\ \\ ";

    let enemy = scene.add.text(x, y, spiderAscii, {
        fontFamily: 'Courier, monospace',
        fontSize: '14px',
        fill: '#ffaa00'
    });
    
    scene.physics.add.existing(enemy);
    enemy.body.setSize(35, 35);
    enemy.setData('animTimer', 0);
    enemy.setData('frame', 0);
    enemy.setData('active', false);
    
    enemies.add(enemy);
}

function hitEnemy(p, enemy) {
    if (invulnerable || isPaused || !gameStarted) return;

    collectingCoin = null;
    collectTimer = 0;

    lives--;
    livesText.setText('Salud: ' + lives);
    enemy.destroy();
    
    let edgeX = Math.random() < 0.5 ? 30 : 750;
    spawnEnemy(edgeX, Phaser.Math.Between(100, 500));
    enemies.getChildren().forEach(e => e.setData('active', true));

    if (lives <= 0) return endGame();

    invulnerable = true;
    scene.tweens.add({ targets: player, alpha: 0.3, duration: 100, yoyo: true, repeat: 7 });
    scene.time.delayedCall(1500, () => {
        invulnerable = false;
        player.setAlpha(1);
    });
}

function shootBullet() {
    if (!gameStarted || scene.time.now < lastFired) return;

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
    scene.time.delayedCall(3000, () => {
        if (lives > 0) {
            let edgeX = Math.random() < 0.5 ? 30 : 750;
            spawnEnemy(edgeX, Phaser.Math.Between(100, 500));
            enemies.getChildren().forEach(e => {
                if (!e.getData('active')) e.setData('active', true);
            });
        }
    });
}

function triggerExtraction() {
    if (extracting || !gameStarted || isPaused) return;
    extracting = true;
    extractionText.setText('EXTRACCIÓN EN CAMINO...');

    scene.time.delayedCall(extractionTimer, () => {
        if (lives > 0) triggeredVictory();
    });
}

function triggeredVictory() {
    scene.physics.pause();
    scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.85);

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
    }).setOrigin(0.5);

    scene.add.text(400, 350, 'Huevos extraídos: ' + score + ' / 10', {
        fontFamily: 'Courier, monospace',
        fontSize: '16px',
        fill: '#ffffff'
    }).setOrigin(0.5);

    scene.add.text(400, 400, 'Presiona ESPACIO para volver a jugar', {
        fontFamily: 'Courier, monospace',
        fontSize: '14px',
        fill: '#00ff41'
    }).setOrigin(0.5);

    scene.input.keyboard.once('keydown-SPACE', () => scene.scene.restart());
}

function endGame() {
    scene.physics.pause();
    scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.85);

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
    }).setOrigin(0.5);

    scene.add.text(400, 350, 'Presiona ESPACIO para reintentar', {
        fontFamily: 'Courier, monospace',
        fontSize: '18px',
        fill: '#ffffff'
    }).setOrigin(0.5);
    scene.input.keyboard.once('keydown-SPACE', () => scene.scene.restart());
}

function update(time, delta) {
    if (lives <= 0) return;

    if (Phaser.Input.Keyboard.JustDown(spaceKey)) {
        isPaused = !isPaused;
        if (isPaused) {
            scene.physics.pause();
            if (introTween1) introTween1.pause();
            if (introTween2) introTween2.pause();
            if (introTween3) introTween3.pause();

            let bgOverlay = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.75);
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
            }).setOrigin(0.5);
            pauseElements.push(asciiTitle);

            let subText = scene.add.text(400, 370, '- PRESIONA ESPACIO PARA CONTINUAR -', {
                fontFamily: 'Courier, monospace',
                fontSize: '18px',
                fill: '#ffffff'
            }).setOrigin(0.5);
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
        let timeLeft = Math.ceil((extractionTimer - scene.time.now) / 1000);
        if (timeLeft < 0) timeLeft = 0;
        timerText.setText('Extracción en: ' + timeLeft + 's');
    }

    player.body.setVelocity(0);
    
    // Mecánica de recolección de 10 segundos
    if (collectingCoin) {
        collectTimer += delta;
        let progress = Math.floor((collectTimer / collectDuration) * 100);
        timerText.setText('Recolectando: ' + progress + '%');

        if (Phaser.Math.Distance.Between(player.x, player.y, collectingCoin.x, collectingCoin.y) > 50) {
            collectingCoin = null;
            collectTimer = 0;
            timerText.setText('');
        } else if (collectTimer >= collectDuration) {
            collectingCoin.destroy();
            collectingCoin = null;
            collectTimer = 0;
            score++;
            scoreText.setText('Huevos: ' + score + ' / 10');
            timerText.setText('');
        }
    } else {
        if (cursors.left.isDown) {
            player.body.setVelocityX(-300);
            player.setData('facing', 'left');
        } else if (cursors.right.isDown) {
            player.body.setVelocityX(300);
            player.setData('facing', 'right');
        }

        if (cursors.up.isDown) player.body.setVelocityY(-300);
        else if (cursors.down.isDown) player.body.setVelocityY(300);

        coins.getChildren().forEach(coin => {
            if (coin.active && Phaser.Math.Distance.Between(player.x, player.y, coin.x, coin.y) < 40) {
                collectingCoin = coin;
                collectTimer = 0;
            }
        });
    }

    if (Phaser.Input.Keyboard.JustDown(attackKey)) {
        shootBullet();
    }

    const speed = 100;
    player.setDepth(player.y);

    enemies.getChildren().forEach(e => {
        if (e.getData('active')) {
            scene.physics.moveToObject(e, player, speed);
        } else {
            e.body.setVelocity(0);
        }

        e.setDepth(e.y);

        let depthScale = Phaser.Math.Clamp(e.y / 450, 0.7, 1.3);
        e.setScale(depthScale);

        let timer = e.getData('animTimer') + 1;
        if (timer > 15) {
            let currentFrame = e.getData('frame');
            if (currentFrame === 0) {
                e.setText(" \\/\\/\\/ \n (o.o)  \n \\ \\/ / ");
                e.setData('frame', 1);
            } else {
                e.setText(" /\\/\\/\\ \n (o.o)  \n / /\\ \\ ");
                e.setData('frame', 0);
            }
            e.setData('animTimer', 0);
        } else {
            e.setData('animTimer', timer);
        }
    });

    coins.getChildren().forEach(coin => {
        coin.setDepth(coin.y);
        let coinScale = Phaser.Math.Clamp(coin.y / 450, 0.8, 1.2);
        coin.setScale(coinScale);
    });

    drawMinimap();
}

function drawMinimap() {
    if (scene.minimapContainer) {
        scene.minimapContainer.destroy();
    }

    let mapX = 620;
    let mapY = 440;
    let mapW = 160;
    let mapH = 140;

    scene.minimapContainer = scene.add.group();

    let bg = scene.add.rectangle(mapX + mapW/2, mapY + mapH/2, mapW, mapH, 0x000000, 0.8)
        .setStrokeStyle(2, 0x00ff41);
    scene.minimapContainer.add(bg);

    let label = scene.add.text(mapX + 8, mapY + 6, 'RADAR', { fontSize: '10px', fill: '#00ff41', fontFamily: 'Courier' });
    scene.minimapContainer.add(label);

    function scaleX(x) { return mapX + (x / 800) * mapW; }
    function scaleY(y) { return mapY + 20 + (y / 600) * (mapH - 25); }

    // Dibujar huevos
    coins.getChildren().forEach(coin => {
        if (coin.active) {
            let dot = scene.add.rectangle(scaleX(coin.x), scaleY(coin.y), 3, 3, 0xff0055);
            scene.minimapContainer.add(dot);
        }
    });

    // Dibujar enemigos (se verá en el minimapa cómo avanzan desde los bordes hacia el centro)
    enemies.getChildren().forEach(e => {
        if (e.active) {
            let dot = scene.add.rectangle(scaleX(e.x), scaleY(e.y), 3, 3, 0xffaa00);
            scene.minimapContainer.add(dot);
        }
    });

    // Dibujar jugador
    if (player && player.alpha > 0) {
        let pDot = scene.add.rectangle(scaleX(player.x), scaleY(player.y), 4, 4, 0x00ff41);
        scene.minimapContainer.add(pDot);
    }
}
