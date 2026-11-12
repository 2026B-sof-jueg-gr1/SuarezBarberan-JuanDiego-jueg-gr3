const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#05050a', // Fondo muy oscuro tipo terminal de datos
    physics: { default: 'arcade' },
    scene: { create, update }
};

new Phaser.Game(config);

let scene, player, cursors, coins, enemies;
let scoreText, livesText, score, lives, invulnerable;

function create() {
    scene = this;

    score = 0;
    lives = 3;
    invulnerable = false;

    // 1. GENERAR EL SUELO Y ENTORNO HECHO DE BITS (0 y 1)
    // Creamos una capa de texto fija o decorativa en el fondo que simula el terreno binario
    let bitTerrain = "";
    for (let i = 0; i < 25; i++) {
        let row = "";
        for (let j = 0; j < 60; j++) {
            row += Math.random() < 0.5 ? "0" : "1";
        }
        bitTerrain += row + "\n";
    }

    this.add.text(50, 50, bitTerrain, {
        fontFamily: 'Courier, monospace',
        fontSize: '14px',
        fill: '#005522', // Verde oscuro sutil para que parezca el suelo de datos
        align: 'left'
    }).setAlpha(0.4);

    // 2. JUGADOR (Figura ASCII humana táctica)
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

    coins = this.physics.add.group();
    enemies = this.physics.add.group();

    spawnCoin();
    spawnEnemy();

    scoreText = this.add.text(16, 16, 'Huevos Recolectados: 0', { fontSize: '20px', fill: '#00ff41', fontFamily: 'Courier' });
    livesText = this.add.text(16, 48, 'Salud del Traje: 3', { fontSize: '20px', fill: '#ff0055', fontFamily: 'Courier' });

    this.physics.add.overlap(player, coins, collectCoin);
    this.physics.add.overlap(player, enemies, hitEnemy);

    cursors = this.input.keyboard.createCursorKeys();
}

function spawnCoin() {
    const x = Phaser.Math.Between(50, 750);
    const y = Phaser.Math.Between(80, 550);
    
    // Huevo alienígena hecho de símbolos orgánicos
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

function spawnEnemy() {
    const x = Math.random() < 0.5 ? 30 : 770;
    const y = Phaser.Math.Between(50, 550);
    
    // Enemigo guardián
    const enemyAscii = 
        "#####\n" +
        "#X#X#\n" +
        "#####";

    let enemy = scene.add.text(x, y, enemyAscii, {
        fontFamily: 'Courier, monospace',
        fontSize: '14px',
        fill: '#ffaa00'
    });
    
    scene.physics.add.existing(enemy);
    enemy.body.setSize(35, 35);
    enemies.add(enemy);
}

function collectCoin(p, coin) {
    coin.destroy();
    score++;
    scoreText.setText('Huevos Recolectados: ' + score);
    spawnCoin();

    if (score % 5 === 0) spawnEnemy();
}

function hitEnemy(p, enemy) {
    if (invulnerable) return;

    lives--;
    livesText.setText('Salud del Traje: ' + lives);
    enemy.destroy();
    spawnEnemy();

    if (lives <= 0) return endGame();

    invulnerable = true;
    scene.tweens.add({ targets: player, alpha: 0.3, duration: 100, yoyo: true, repeat: 7 });
    scene.time.delayedCall(1500, () => {
        invulnerable = false;
        player.setAlpha(1);
    });
}

function endGame() {
    scene.physics.pause();
    scene.add.text(400, 260, 'MISIÓN FALLIDA', { fontSize: '54px', fill: '#ff0055', fontFamily: 'Courier' }).setOrigin(0.5);
    scene.add.text(400, 330, 'Huevos robados: ' + score + '  -  Presiona ESPACIO para reintentar',
        { fontSize: '20px', fill: '#fff', fontFamily: 'Courier' }).setOrigin(0.5);
    scene.input.keyboard.once('keydown-SPACE', () => scene.scene.restart());
}

function update() {
    if (lives <= 0) return;

    player.body.setVelocity(0);
    if (cursors.left.isDown) player.body.setVelocityX(-300);
    else if (cursors.right.isDown) player.body.setVelocityX(300);
    if (cursors.up.isDown) player.body.setVelocityY(-300);
    else if (cursors.down.isDown) player.body.setVelocityY(300);

    const speed = 90 + score * 5;
    enemies.getChildren().forEach(e => scene.physics.moveToObject(e, player, speed));
}
