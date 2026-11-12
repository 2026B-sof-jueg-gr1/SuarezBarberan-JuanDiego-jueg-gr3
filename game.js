const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#0a0a0f', // Fondo negro espacial / ciberpunk
    physics: { default: 'arcade' },
    scene: { create, update }
};

new Phaser.Game(config);

let scene, player, cursors, coins, enemies;
let scoreText, livesText, score, lives, invulnerable;

function makeTextures(s) {
    if (s.textures.exists('player')) return;
    const g = s.add.graphics();
    
    // Jugador: El Mercenario (Nave/Traje táctico)
    g.fillStyle(0x00ff41).fillRect(0, 0, 32, 32);
    g.generateTexture('player', 32, 32); g.clear();
    
    // Moneda: Huevo Alienígena (Brillo estelar)
    g.fillStyle(0xff0055).fillCircle(10, 10, 10);
    g.generateTexture('coin', 20, 20); g.clear();
    
    // Enemigo: Criatura Guardiana Alienígena
    g.fillStyle(0xffaa00).fillRect(0, 0, 28, 28);
    g.generateTexture('enemy', 28, 28);
    
    g.destroy();
}

function create() {
    scene = this;
    makeTextures(this);

    score = 0;
    lives = 3;
    invulnerable = false;

    player = this.physics.add.image(400, 300, 'player');
    player.setCollideWorldBounds(true);

    coins = this.physics.add.group();
    enemies = this.physics.add.group();

    spawnCoin();
    spawnEnemy();

    // Textos de la Interfaz (HUD) con temática espacial
    scoreText = this.add.text(16, 16, 'Huevos Recolectados: 0', { fontSize: '20px', fill: '#00ff41', fontFamily: 'Courier' });
    livesText = this.add.text(16, 48, 'Salud del Traje: 3', { fontSize: '20px', fill: '#ff0055', fontFamily: 'Courier' });

    this.physics.add.overlap(player, coins, collectCoin);
    this.physics.add.overlap(player, enemies, hitEnemy);

    cursors = this.input.keyboard.createCursorKeys();
}

function spawnCoin() {
    const x = Phaser.Math.Between(50, 750);
    const y = Phaser.Math.Between(80, 550);
    coins.create(x, y, 'coin');
}

function spawnEnemy() {
    const x = Math.random() < 0.5 ? 30 : 770;
    const y = Phaser.Math.Between(50, 550);
    enemies.create(x, y, 'enemy');
}

function collectCoin(p, coin) {
    coin.destroy();
    score++;
    scoreText.setText('Huevos Recolectados: ' + score);
    spawnCoin();

    // Cada 5 huevos recolectados, se activa otra criatura guardiana
    if (score % 5 === 0) spawnEnemy();
}

function hitEnemy(p, enemy) {
    if (invulnerable) return;

    lives--;
    livesText.setText('Salud del Traje: ' + lives);
    enemy.destroy();
    spawnEnemy();

    if (lives <= 0) return endGame();

    // 1.5 segundos de invulnerabilidad con parpadeo táctico
    invulnerable = true;
    scene.tweens.add({ targets: player, alpha: 0.3, duration: 100, yoyo: true, repeat: 7 });
    scene.time.delayedCall(1500, () => {
        invulnerable = false;
        player.setAlpha(1);
    });
}

function endGame() {
    scene.physics.pause();
    player.setTint(0xff0000);
    scene.add.text(400, 260, 'MISIÓN FALLIDA', { fontSize: '54px', fill: '#ff0055', fontFamily: 'Courier' }).setOrigin(0.5);
    scene.add.text(400, 330, 'Huevos robados: ' + score + '  -  Presiona ESPACIO para reintentar',
        { fontSize: '20px', fill: '#fff', fontFamily: 'Courier' }).setOrigin(0.5);
    scene.input.keyboard.once('keydown-SPACE', () => scene.scene.restart());
}

function update() {
    if (lives <= 0) return;

    player.setVelocity(0);
    if (cursors.left.isDown) player.setVelocityX(-300);
    else if (cursors.right.isDown) player.setVelocityX(300);
    if (cursors.up.isDown) player.setVelocityY(-300);
    else if (cursors.down.isDown) player.setVelocityY(300);

    // Las criaturas guardianas persiguen al mercenario; la velocidad escala con los huevos obtenidos
    const speed = 90 + score * 5;
    enemies.getChildren().forEach(e => scene.physics.moveToObject(e, player, speed));
}
