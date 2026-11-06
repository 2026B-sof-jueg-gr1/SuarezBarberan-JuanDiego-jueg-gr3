const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1e1e2e',
    physics: { default: 'arcade' },
    scene: { create, update }
};

new Phaser.Game(config);

let scene, player, cursors, coins, enemies;
let scoreText, livesText, score, lives, invulnerable;

function makeTextures(s) {
    if (s.textures.exists('player')) return;
    const g = s.add.graphics();
    g.fillStyle(0x4cc9f0).fillRect(0, 0, 32, 32);
    g.generateTexture('player', 32, 32); g.clear();
    g.fillStyle(0xffd60a).fillCircle(10, 10, 10);
    g.generateTexture('coin', 20, 20); g.clear();
    g.fillStyle(0xef476f).fillRect(0, 0, 28, 28);
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

    scoreText = this.add.text(16, 16, 'Puntos: 0', { fontSize: '24px', fill: '#fff' });
    livesText = this.add.text(16, 48, 'Vidas: 3', { fontSize: '24px', fill: '#ef476f' });

    this.physics.add.overlap(player, coins, collectCoin);
    this.physics.add.overlap(player, enemies, hitEnemy);

    cursors = this.input.keyboard.createCursorKeys();
}

function spawnCoin() {
    const x = Phaser.Math.Between(30, 770);
    const y = Phaser.Math.Between(30, 570);
    coins.create(x, y, 'coin');
}

function spawnEnemy() {
    // Aparece en un borde lejos del jugador
    const x = Math.random() < 0.5 ? 20 : 780;
    const y = Phaser.Math.Between(20, 580);
    enemies.create(x, y, 'enemy');
}

function collectCoin(p, coin) {
    coin.destroy();
    score++;
    scoreText.setText('Puntos: ' + score);
    spawnCoin();

    // Cada 5 monedas aparece un enemigo más
    if (score % 5 === 0) spawnEnemy();
}

function hitEnemy(p, enemy) {
    if (invulnerable) return;

    lives--;
    livesText.setText('Vidas: ' + lives);
    enemy.destroy();
    spawnEnemy();

    if (lives <= 0) return endGame();

    // 1.5 s de invulnerabilidad con parpadeo
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
    scene.add.text(400, 280, 'GAME OVER', { fontSize: '64px', fill: '#fff' }).setOrigin(0.5);
    scene.add.text(400, 340, 'Puntos: ' + score + '  -  Espacio para reiniciar',
        { fontSize: '24px', fill: '#ccc' }).setOrigin(0.5);
    scene.input.keyboard.once('keydown-SPACE', () => scene.scene.restart());
}

function update() {
    if (lives <= 0) return;

    player.setVelocity(0);
    if (cursors.left.isDown) player.setVelocityX(-300);
    else if (cursors.right.isDown) player.setVelocityX(300);
    if (cursors.up.isDown) player.setVelocityY(-300);
    else if (cursors.down.isDown) player.setVelocityY(300);

    // Los enemigos te persiguen, más rápido mientras más puntos tengas
    const speed = 80 + score * 4;
    enemies.getChildren().forEach(e => scene.physics.moveToObject(e, player, speed));
}