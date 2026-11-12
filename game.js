const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#05050a', // Fondo espacial oscuro tipo terminal
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

    // 1. GENERAR EL TERRENO DEL PLANETA (0s como suelo plomo y 1s como hierbas altas)
    const cols = 55;
    const rows = 22;
    let groundGrid = Array(rows).fill().map(() => Array(cols).fill(" "));
    let grassGrid = Array(rows).fill().map(() => Array(cols).fill(" "));

    // Llenar la base con ceros ('0') representando el suelo firme
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (r >= rows - 5) {
                groundGrid[r][c] = "0"; // Suelo base abajo
            } else if (Math.random() < 0.12) {
                groundGrid[r][c] = "0"; // Rocas o parches de suelo salpicados
            }
        }
    }

    // Crear hierbas ('1') mucho más largas y de diferentes tamaños
    for (let c = 0; c < cols; c += 2) {
        if (Math.random() < 0.75) {
            let height = Phaser.Math.Between(3, 9); // Alturas variables para las hierbas
            let startRow = rows - 5 - height + Phaser.Math.Between(0, 2);
            for (let h = 0; h < height; h++) {
                let currentRow = startRow + h;
                if (currentRow >= 0 && currentRow < rows) {
                    grassGrid[currentRow][c] = "1";
                }
            }
        }
    }

    // Convertir las matrices a cadenas de texto
    let groundText = groundGrid.map(row => row.join("")).join("\n");
    let grassText = grassGrid.map(row => row.join("")).join("\n");

    // Renderizar el suelo plomo ('0')
    this.add.text(40, 120, groundText, {
        fontFamily: 'Courier, monospace',
        fontSize: '15px',
        fill: '#7f8c8d' // Gris / Plomo elegante
    });

    // Renderizar las hierbas verdes oscuras y altas ('1') justo encima
    this.add.text(40, 120, grassText, {
        fontFamily: 'Courier, monospace',
        fontSize: '15px',
        fill: '#1e8449' // Verde oscuro / bosque profundo
    });

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
    
    // Huevo alienígena orgánico en ASCII
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
    
    // Enemigo guardián en ASCII
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
