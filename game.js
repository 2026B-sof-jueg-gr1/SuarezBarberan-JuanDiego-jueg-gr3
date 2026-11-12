const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#05050a',
    physics: { default: 'arcade' },
    scene: { create, update }
};

new Phaser.Game(config);

let scene, player, cursors, spaceKey, attackKey;
let coins, enemies, bullets;
let scoreText, livesText, score = 0, lives = 3, invulnerable = false;
let isPaused = false, pauseElements = [];
let lastFired = 0;

function create() {
    scene = this;

    score = 0;
    lives = 3;
    invulnerable = false;
    isPaused = false;

    // 1. JUGADOR (Figura ASCII humana táctica)
    const playerAscii = 
        "  o  \n" +
        " [#] \n" +
        " / \\ ";
    
    player = this.add.text(400, 300, playerAscii, {
        fontFamily: 'Courier, monospace',
        fontSize: '18px',
        fill: '#00ff41'
    });
    this.physics.add.existing(player);
    player.body.setCollideWorldBounds(true);
    player.body.setSize(40, 50);
    player.setData('facing', 'right');

    // Grupos de juego
    coins = this.physics.add.group();
    enemies = this.physics.add.group();
    bullets = this.physics.add.group();

    // 2. COLOCAR LOS HUEVOS YA PRESENTES EN EL MAPA (10 huevos repartidos)
    for (let i = 0; i < 10; i++) {
        spawnStaticCoin(Phaser.Math.Between(100, 700), Phaser.Math.Between(100, 500));
    }

    // Colocar algunas arañas iniciales acechando en el mapa
    for (let i = 0; i < 3; i++) {
        spawnEnemy(Phaser.Math.Between(50, 750), Phaser.Math.Between(100, 500));
    }

    scoreText = this.add.text(16, 16, 'Huevos Restantes: 10', { fontSize: '20px', fill: '#00ff41', fontFamily: 'Courier' });
    livesText = this.add.text(16, 48, 'Salud del Traje: 3', { fontSize: '20px', fill: '#ff0055', fontFamily: 'Courier' });

    // Colisiones y overlaps
    this.physics.add.overlap(player, coins, collectCoin);
    this.physics.add.overlap(player, enemies, hitEnemy);
    this.physics.add.overlap(bullets, enemies, destroyEnemy);

    cursors = this.input.keyboard.createCursorKeys();
    spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE); // Pausa
    attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);    // Tecla F para disparar
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
        " \\\\// \n" +
        " (o.o) \n" +
        " // \\\\ ";

    let enemy = scene.add.text(x, y, spiderAscii, {
        fontFamily: 'Courier, monospace',
        fontSize: '14px',
        fill: '#ffaa00'
    });
    
    scene.physics.add.existing(enemy);
    enemy.body.setSize(35, 35);
    enemy.setData('animTimer', 0);
    enemy.setData('frame', 0);
    
    enemies.add(enemy);
}

function collectCoin(p, coin) {
    if (isPaused) return;
    coin.destroy();
    let remaining = coins.countActive(true);
    scoreText.setText('Huevos Restantes: ' + remaining);

    if (remaining === 0) {
        triggeredVictory();
    }
}

function hitEnemy(p, enemy) {
    if (invulnerable || isPaused) return;

    lives--;
    livesText.setText('Salud del Traje: ' + lives);
    enemy.destroy();
    spawnEnemy(Phaser.Math.Between(50, 750), Phaser.Math.Between(100, 500));

    if (lives <= 0) return endGame();

    invulnerable = true;
    scene.tweens.add({ targets: player, alpha: 0.3, duration: 100, yoyo: true, repeat: 7 });
    scene.time.delayedCall(1500, () => {
        invulnerable = false;
        player.setAlpha(1);
    });
}

function shootBullet() {
    if (scene.time.now < lastFired) return;

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
        if (lives > 0) spawnEnemy(Phaser.Math.Between(50, 750), Phaser.Math.Between(100, 500));
    });
}

function triggeredVictory() {
    scene.physics.pause();
    scene.add.text(400, 260, '¡MISIÓN CUMPLIDA!', { fontSize: '48px', fill: '#00ff41', fontFamily: 'Courier' }).setOrigin(0.5);
    scene.add.text(400, 330, 'Has recolectado todos los huevos del sector.',
        { fontSize: '18px', fill: '#fff', fontFamily: 'Courier' }).setOrigin(0.5);
}

function endGame() {
    scene.physics.pause();
    scene.add.text(400, 260, 'MISIÓN FALLIDA', { fontSize: '54px', fill: '#ff0055', fontFamily: 'Courier' }).setOrigin(0.5);
    scene.add.text(400, 330, 'Presiona ESPACIO para reintentar',
        { fontSize: '20px', fill: '#fff', fontFamily: 'Courier' }).setOrigin(0.5);
    scene.input.keyboard.once('keydown-SPACE', () => scene.scene.restart());
}

function update() {
    if (lives <= 0) return;

    if (Phaser.Input.Keyboard.JustDown(spaceKey)) {
        isPaused = !isPaused;
        if (isPaused) {
            scene.physics.pause();

            let bgOverlay = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.75);
            pauseElements.push(bgOverlay);

            const pauseArt = 
                "  ____   _   _   _ ___ ___ ___  ____  \n" +
                " |  _ \\ / \\ | | | / __/ __|   \\|  _ \\ \n" +
                " | |_) / _ \\| | | \\__ \\__ \\ |) | | | |\n" +
                " |  __/ ___ \\ |_| |___/___/___/|_| |_|\n" +
                " |_| /_/   \\_\\___/|____/____/         ";

            let asciiTitle = scene.add.text(400, 250, pauseArt, {
                fontFamily: 'Courier, monospace',
                fontSize: '14px',
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
            pauseElements.forEach(element => element.destroy());
            pauseElements = [];
        }
    }

    if (isPaused) {
        player.body.setVelocity(0);
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

    if (cursors.up.isDown) player.body.setVelocityY(-300);
    else if (cursors.down.isDown) player.body.setVelocityY(300);

    if (Phaser.Input.Keyboard.JustDown(attackKey)) {
        shootBullet();
    }

    const speed = 100;

    player.setDepth(player.y);

    enemies.getChildren().forEach(e => {
        scene.physics.moveToObject(e, player, speed);
        e.setDepth(e.y);

        let depthScale = Phaser.Math.Clamp(e.y / 450, 0.7, 1.3);
        e.setScale(depthScale);

        let timer = e.getData('animTimer') + 1;
        if (timer > 15) {
            let currentFrame = e.getData('frame');
            if (currentFrame === 0) {
                e.setText(" //\\\\\n (o.o) \n \\\\ //");
                e.setData('frame', 1);
            } else {
                e.setText(" \\\\// \n (o.o) \n // \\\\");
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
