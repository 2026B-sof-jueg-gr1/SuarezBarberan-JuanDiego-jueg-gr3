const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#05050a',
    physics: { default: 'arcade' },
    scene: { create, update }
};

new Phaser.Game(config);

let scene, player, ship, beam, cursors, spaceKey, attackKey;
let coins, enemies, bullets;
let scoreText, livesText, score = 0, lives = 3, invulnerable = false;
let isPaused = false, pauseElements = [];
let lastFired = 0;
let gameStarted = false;
let introTween1, introTween2, introTween3; // Referencias para pausar los tweens de la intro

function create() {
    scene = this;

    score = 0;
    lives = 3;
    invulnerable = false;
    isPaused = false;
    gameStarted = false;

    coins = this.physics.add.group();
    enemies = this.physics.add.group();
    bullets = this.physics.add.group();

    // 1. COLOCAR LOS HUEVOS EN EL MAPA
    for (let i = 0; i < 10; i++) {
        spawnStaticCoin(Phaser.Math.Between(100, 700), Phaser.Math.Between(100, 500));
    }

    // 2. COLOCAR LAS ARAÑAS
    for (let i = 0; i < 3; i++) {
        spawnEnemy(Phaser.Math.Between(50, 750), Phaser.Math.Between(100, 500));
    }

    enemies.getChildren().forEach(e => e.setData('active', false));

    // 3. JUGADOR
    const playerAscii = 
        "  o  \n" +
        " [#] \n" +
        " / \\ ";
    
    player = this.add.text(400, 50, playerAscii, {
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

    ship = this.add.text(400, -50, shipAscii, {
        fontFamily: 'Courier, monospace',
        fontSize: '16px',
        fill: '#00ffff',
        align: 'center'
    }).setOrigin(0.5);

    beam = this.add.rectangle(400, 150, 60, 300, 0x00ffff, 0.25).setOrigin(0.5, 0);

    // Animaciones de entrada guardadas para poder pausarlas
    introTween1 = scene.tweens.add({
        targets: ship,
        y: 100,
        duration: 2000,
        ease: 'Power2',
        onComplete: () => {
            player.setPosition(390, 120);
            player.setAlpha(1);

            introTween2 = scene.tweens.add({
                targets: player,
                y: 350,
                duration: 1500,
                ease: 'Linear',
                onComplete: () => {
                    beam.destroy();
                    
                    introTween3 = scene.tweens.add({
                        targets: ship,
                        y: -100,
                        x: 900,
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

    scoreText = this.add.text(16, 16, 'Huevos Restantes: 10', { fontSize: '20px', fill: '#00ff41', fontFamily: 'Courier' });
    livesText = this.add.text(16, 48, 'Salud del Traje: 3', { fontSize: '20px', fill: '#ff0055', fontFamily: 'Courier' });

    this.physics.add.overlap(player, coins, collectCoin);
    this.physics.add.overlap(player, enemies, hitEnemy);
    this.physics.add.overlap(bullets, enemies, destroyEnemy);

    cursors = this.input.keyboard.createCursorKeys();
    spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
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
    // Araña alienígena real con múltiples patas
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

function collectCoin(p, coin) {
    if (isPaused || !gameStarted) return;
    coin.destroy();
    let remaining = coins.countActive(true);
    scoreText.setText('Huevos Restantes: ' + remaining);

    if (remaining === 0) {
        triggeredVictory();
    }
}

function hitEnemy(p, enemy) {
    if (invulnerable || isPaused || !gameStarted) return;

    lives--;
    livesText.setText('Salud del Traje: ' + lives);
    enemy.destroy();
    spawnEnemy(Phaser.Math.Between(50, 750), Phaser.Math.Between(100, 500));
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
    scene.time.delayedCall(2000, () => {
        if (lives > 0) {
            spawnEnemy(Phaser.Math.Between(50, 750), Phaser.Math.Between(100, 500));
            enemies.getChildren().forEach(e => {
                if (!e.getData('active')) e.setData('active', true);
            });
        }
    });
}

function triggeredVictory() {
    scene.physics.pause();
    let bgOverlay = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.85);

    // Arte ASCII en bloque para MISIÓN CUMPLIDA
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

    scene.add.text(400, 350, 'Has recolectado todos los huevos del sector.', {
        fontFamily: 'Courier, monospace',
        fontSize: '16px',
        fill: '#ffffff'
    }).setOrigin(0.5);
}

function endGame() {
    scene.physics.pause();
    let bgOverlay = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.85);

    // Arte ASCII en bloque para MISIÓN FALLIDA
    const defeatArt = 
        "  __  __ ___ ____ ___ ___  _   _    💾  ___ _    _     ___ ____    _    \n" +
        " |  \\/  |_ _/ ___|_ _/ _ \\| \\ | |   |  |_ _| |  | |   |_ _|  _ \\  / \\   \n" +
        " | |\\/| || |\\___ \\| | | | |  \\| |   | | | || |  | |    | || | | |/ _ \\  \n" +
        " | |  | || | ___) | | |_| | |\\  |   | | | || |__| |___ | || |_| / ___ \\ \n" +
        " |_|  |_|___|____/___\\___/|_| \\_|   |_||___|_____|_____|___|____/_/   \\_\\";

    // Versión limpia en texto ASCII puro para derrota
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

function update() {
    if (lives <= 0) return;

    if (Phaser.Input.Keyboard.JustDown(spaceKey)) {
        isPaused = !isPaused;
        if (isPaused) {
            scene.physics.pause();
            // Pausar también los tweens de la cinemática de entrada si está ocurriendo
            if (introTween1) introTween1.pause();
            if (introTween2) introTween2.pause();
            if (introTween3) introTween3.pause();

            let bgOverlay = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.75);
            pauseElements.push(bgOverlay);

            // Arte ASCII en bloque exacto para "PAUSA"
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
            // Reanudar los tweens de la intro si seguían activos
            if (introTween1) introTween1.resume();
            if (introTween2) introTween2.resume();
            if (introTween3) introTween3.resume();

            pauseElements.forEach(element => element.destroy());
            pauseElements = [];
        }
    }

    if (isPaused || !gameStarted) {
        if (player && !isPaused) {
            // Si no está pausado pero está en la intro, dejamos que actúe el tween
        } else if (player) {
            player.body.setVelocity(0);
        }
        if (isPaused) return;
        if (!gameStarted) {
            // Durante la intro dejamos correr solo los tweens
            return;
        }
    }

    player.body.setVelocity(0);
    if (cursors.left.isDown) {
        player.body.setVelocityX(-300);
        player.setData('facing', 'left');
    } else if (cursors.right.isDown) {
        player.body.setVelocityX(300);
        player.setData('facing', 'right');
    }

    if (cursors.up.isDown) player.body.setVelocityY(-300);
    else if (cursors.down.isDown) player.body.setVelocityY(300);

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
                // Animación de caminata de las patas de la araña
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
}
