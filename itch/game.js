// ───────── Constantes del mundo ─────────
const WORLD_W = 2000;
const WORLD_H = 1500;
const MAX_ENEMIES = 35;

const FACE_HAPPY   = " ,-^-, \n |^_^| \n '---' ";
const FACE_DEADPAN = " ,-^-, \n |-_-| \n '---' ";

const SPIDER_PAL = { leg:0x4a2010, accent:0xffaa00, joint:0xffcc33, body:0x1c0a14, head:0x2a1020, eye:0xffe066, extraEyes:false };
const MOTHER_PAL = { leg:0x3a0a14, accent:0xff2244, joint:0xff6677, body:0x120208, head:0x1e0410, eye:0xff1111, extraEyes:true  };

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 600
    },
    backgroundColor: '#1a0508',
    physics: { default: 'arcade' },
    scene: { preload, create, update }
};

new Phaser.Game(config);

// ─── Estado global ───
let scene, player, cursors, attackKey, extractKey;
let ship, beam;
let coins, enemies, bullets;
let scoreText, moneyText, livesText, extractionText, timerText;
let score=0, money=0, lives=3, invulnerable=false;
let isPaused=false, pauseElements=[];
let lastFired=0, gameStarted=false;
let introTween1, introTween2, introTween3;
let landingX=1000, landingY=800;
let ambientOverlay=null, fogOverlay=null;
let nests=[], craters=[];
let slimePatches=[], craterCreatures=[], playerSlowed=false, playerSlowTimer=null;
let creaturesLaunched=false;
let freeLarvae=[]; // larvas volando/viviendo fuera del cráter

// Corte
let cuttingActive=false, targetCoin=null, cutProgress=0, lastMouseX=0, cutUIElements=[];

// Extracción
let playerAlerted=false, extracting=false;
let extractionTotalTimer=10000, extractionCountdownTimer=5000;
let extractionZone=null, extractionShip=null, extractionBeam=null;
let extractionPoint={x:0,y:0}, extractingStartTime=0, extractionPhase=0;
let corporateHelpActive=false;

// Comms
let commsElements=[], commsTyper=null, commsHold=null;

// Madre
let motherActive=false, mother=null, motherGlow=null;
let motherFrame=0, motherAnimEvent=null, motherWaveTimer=null;

// Animación del mercenario
let playerBobDir=1, playerBobOffset=0, playerBobBase=0, playerBobActive=false;
let playerShootTilt=0;

// Minijuego veneno
let venomActive=false, targetCorpse=null, venomProgress=0, venomUIElements=[];
let venomLastAngle=0, venomCircles=[], venomNeedle=null, venomZone={start:0,end:0};

// Touch
let joystickBase=null, joystickThumb=null;
let joystickVector={x:0,y:0}, joystickActive=false;

// ──────────────────────────────────────────
// PRELOAD: cargar el mercenario como textura
// ──────────────────────────────────────────
function preload() {
    this.load.image('mercenario', 'mercenario_hd.png');
}

// ─────────────────────────────────────────────────────────
function create() {
    scene = this;

    // reset
    score=0; money=0; lives=3; invulnerable=false;
    isPaused=false; pauseElements=[]; _pauseGuard=false;
    gameStarted=false; playerAlerted=false; extracting=false;
    cuttingActive=false; targetCoin=null; cutProgress=0;
    extractionZone=null; extractionShip=null; extractionBeam=null;
    extractionPhase=0; corporateHelpActive=false;
    playerBobDir=1; playerBobOffset=0; playerBobBase=0; playerBobActive=false; playerShootTilt=0;
    venomActive=false; targetCorpse=null; venomProgress=0; venomUIElements=[]; venomCircles=[]; venomNeedle=null;
    window.extractingStartTime=0;
    commsElements=[]; commsTyper=null; commsHold=null;
    motherActive=false; mother=null; motherGlow=null;
    motherFrame=0; motherAnimEvent=null; motherWaveTimer=null;
    nests=[]; craters=[]; slimePatches=[]; craterCreatures=[]; playerSlowed=false; playerSlowTimer=null;
    creaturesLaunched=false;
    freeLarvae=[];
    joystickVector={x:0,y:0}; joystickActive=false;
    joystickBase=null; joystickThumb=null;
    mmZoom=1;

    this.physics.world.setBounds(0,0,WORLD_W,WORLD_H);
    const cam = this.cameras.main;
    cam.setBounds(0,0,WORLD_W,WORLD_H);

    landingX = Phaser.Math.Between(Math.round(WORLD_W*0.3), Math.round(WORLD_W*0.7));
    landingY = Phaser.Math.Between(Math.round(WORLD_H*0.4), Math.round(WORLD_H*0.7));
    cam.centerOn(landingX, landingY-50);

    ambientOverlay = scene.add.rectangle(400,300,800,600,0xff0033,0.15).setScrollFactor(0).setDepth(9999);
    fogOverlay     = scene.add.rectangle(400,300,800,600,0xff1144,0.08).setScrollFactor(0).setDepth(9998);
    scene.tweens.add({ targets:fogOverlay, alpha:0.22, duration:3000, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });

    nests = buildNests();
    drawGround();
    spawnCraterEyes();
    ensureSpiderTextures();
    ensureEggTextures();

    coins   = this.add.group();
    enemies = this.physics.add.group();
    bullets = this.physics.add.group();

    nests.forEach(n => {
        for (let i=0; i<n.eggs; i++) {
            const a = (i/n.eggs)*Math.PI*2 + Math.random();
            const r = Phaser.Math.Between(35,80);
            spawnStaticCoin(n.x + Math.cos(a)*r, n.y + Math.sin(a)*r*0.7);
        }
    });

    // spawn inicial: 2 + score (mínimo 2)
    const initCount = 2 + score;
    for (let i=0; i<initCount; i++) {
        const p = farWorldPoint(700, landingX, landingY);
        const sizeMul = Phaser.Math.FloatBetween(0.6, 1.4);
        spawnEnemy(p.x, p.y, sizeMul);
    }
    enemies.getChildren().forEach(e => e.setData('active', false));

    // ── JUGADOR: sprite del mercenario ──
    const PLAYER_H  = 80;  // más grande para que se vea imponente
    const IMG_W     = 1199, IMG_H = 1312;
    const playerScale = PLAYER_H / IMG_H;
    const playerW     = Math.round(IMG_W * playerScale);

    // glow bajo el mercenario
    const playerGlow = this.add.ellipse(landingX, landingY, playerW*2.2, 18, 0x00ff88, 0.18);
    playerGlow.setDepth(0);
    scene.tweens.add({targets:playerGlow, alpha:0.32, scaleX:1.1, duration:900, yoyo:true, repeat:-1, ease:'Sine.easeInOut'});

    player = this.add.image(landingX, landingY-300, 'mercenario');
    player.setScale(playerScale);
    player.setAlpha(0);
    player.setOrigin(0.5, 1);
    player.setData('glowRef', playerGlow);

    this.physics.add.existing(player);
    player.body.setCollideWorldBounds(true);
    player.body.setSize(playerW * 0.52, PLAYER_H);
    player.body.setOffset(playerW * 0.24, 0);
    player.setData('facing', 'right');
    player.setData('isFlipped', false);

    // nave de intro — gráfico procedural
    ship = buildShipGraphic(this, landingX, landingY-400);
    // beam empieza invisible; aparece solo cuando la nave aterriza
    beam = this.add.rectangle(landingX, landingY-200, 60, 300, 0x00ffff, 0).setOrigin(0.5,0).setDepth(3499);

    // 1) nave baja en 1.2 s
    introTween1 = scene.tweens.add({
        targets: ship, y: landingY-220, duration:1200, ease:'Power2',
        onComplete: () => {
            // 2) beam aparece
            scene.tweens.add({ targets:beam, alpha:0.3, duration:200 });
            // 3) mercenario aparece en la posición del beam y baja
            player.setPosition(landingX, landingY-220);
            player.setAlpha(1);
            introTween2 = scene.tweens.add({
                targets: player, y: landingY, duration:1500, ease:'Linear',
                onComplete: () => {
                    // 4) beam desaparece, nave sube
                    scene.tweens.add({ targets:beam, alpha:0, duration:300,
                        onComplete: () => beam.destroy() });
                    scene.cameras.main.flash(400, 0, 230, 200);
                    introTween3 = scene.tweens.add({
                        targets: ship, y: landingY-500, x: landingX+400,
                        duration:1100, ease:'Power2',
                        onComplete: () => ship.destroy()
                    });
                    enemies.getChildren().forEach(e => e.setData('active',true));
                    gameStarted = true;
                    startSpawnManager();
                    scene.cameras.main.startFollow(player, true, 0.08, 0.08, 0, -26);
                }
            });
        }
    });

    const hudStyle = { fontFamily:'Courier', stroke:'#12030a', strokeThickness:3 };
    scoreText     = this.add.text(16,16,  'Huevos: 0 / 10',         {...hudStyle, fontSize:'18px', fill:'#ff4d79'}).setScrollFactor(0).setDepth(6000);
    moneyText     = this.add.text(16,42,  'Dinero: $0',              {...hudStyle, fontSize:'18px', fill:'#00ffcc'}).setScrollFactor(0).setDepth(6000);
    livesText     = this.add.text(16,68,  'Salud: 3',                {...hudStyle, fontSize:'18px', fill:'#ff0055'}).setScrollFactor(0).setDepth(6000);
    extractionText= this.add.text(16,94,  '[E] Solicitar Extracción',{...hudStyle, fontSize:'16px', fill:'#00ffff'}).setScrollFactor(0).setDepth(6000);
    timerText     = this.add.text(16,120, '',                         {...hudStyle, fontSize:'16px', fill:'#ffaa00'}).setScrollFactor(0).setDepth(6000);

    createMinimap();

    if (this.sys.game.device.os.android || this.sys.game.device.os.iOS || 'ontouchstart' in window) {
        crearControlesTactiles();
    }

    this.physics.add.overlap(player, enemies, hitEnemy);
    this.physics.add.overlap(bullets, enemies, destroyEnemy);

    // Limpiar solo los listeners de teclas específicas (no los internos de Phaser)
    this.input.keyboard.removeAllListeners('keydown-SPACE');
    this.input.keyboard.removeAllListeners('keydown-F');
    this.input.keyboard.removeAllListeners('keydown-E');

    cursors    = this.input.keyboard.createCursorKeys();
    attackKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    extractKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // SPACE: pausa
    this.input.keyboard.on('keydown-SPACE', () => {
        if (!gameStarted) return;
        if (cuttingActive) { cancelCutting(); return; }
        if (venomActive) { cancelVenom(); return; }
        togglePauseGame();
    });

    scene.input.on('pointermove', (pointer) => {
        if (!cuttingActive) return;
        const deltaX = pointer.x - lastMouseX;
        if (deltaX > 2) {
            cutProgress += deltaX * 0.8;
            if (cutProgress >= 100) completeCutting();
        }
        lastMouseX = pointer.x;
    });
}

// ──────────────────────────────────────────
// UPDATE
// ──────────────────────────────────────────
function update(time, delta) {
    if (lives <= 0) return;

    drawMinimap();

    // joystick táctil
    if (joystickBase && (joystickActive || Math.abs(joystickVector.x)>0.1 || Math.abs(joystickVector.y)>0.1)) {
        if (cuttingActive && (Math.abs(joystickVector.x)>0.5 || Math.abs(joystickVector.y)>0.5)) cancelCutting();
        if (!isPaused && gameStarted && extractionPhase!==2 && !cuttingActive) {
            player.body.setVelocity(joystickVector.x*200, joystickVector.y*200);
            if (joystickVector.x >  0.1) flipPlayer(false);
            if (joystickVector.x < -0.1) flipPlayer(true);
        }
    }

    if (isPaused || !gameStarted) {
        if (player && isPaused) player.body.setVelocity(0,0);
        return;
    }

    if (Phaser.Input.Keyboard.JustDown(extractKey)) triggerExtraction();
    // cancelVenom se maneja desde el listener de SPACE en create()

    // HUD extracción
    if (extracting) {
        const elapsed = scene.time.now - window.extractingStartTime;
        if (extractionPhase === 0) {
            const r = Math.max(0, Math.ceil((extractionTotalTimer - elapsed)/1000));
            extractionText.setText('EXTRACCIÓN EN CAMINO: ' + r + 's');
        } else if (extractionPhase === 1) {
            const r = Math.max(0, Math.ceil((extractionCountdownTimer - (elapsed-extractionTotalTimer))/1000));
            extractionText.setText((score>0?'SÚBETE AL [ X ] (VIP): ':'SÚBETE AL [ X ] (HOSTIL): ') + r + 's');
        }
    } else {
        extractionText.setText('[E] Solicitar Extracción');
    }

    // láser de apoyo corporativo
    if (corporateHelpActive && extractionShip) {
        enemies.getChildren().forEach(e => {
            if (e.active && Phaser.Math.Distance.Between(extractionShip.x, extractionShip.y, e.x, e.y) < 250) {
                if (Math.random() < 0.1) {
                    const laser = scene.add.text(extractionShip.x, extractionShip.y, 'v', {fontFamily:'Courier', fontSize:'14px', fill:'#00ffff'});
                    scene.physics.add.existing(laser);
                    scene.physics.moveToObject(laser, e, 600);
                    scene.physics.add.overlap(laser, e, (l,en) => { l.destroy(); en.destroy(); });
                }
            }
        });
    }

    // limpiar balas fuera de pantalla
    const view = scene.cameras.main.worldView;
    bullets.getChildren().slice().forEach(b => {
        if (!b.active) return;
        if (b.x < view.left-200 || b.x > view.right+200 || b.y < view.top-200 || b.y > view.bottom+200) {
            b.setActive(false); b.setVisible(false); b.destroy();
        }
    });

    // balas vs criaturas escondidas en cráteres (sin activar alerta global)
    if (craterCreatures.length > 0) {
        bullets.getChildren().slice().forEach(b => {
            if (!b.active) return;
            for (const c of craterCreatures) {
                if (c.launched || !c.creature || !c.creature.active) continue;
                const hitR = 22 * c.creatureScale;
                if (Phaser.Math.Distance.Between(b.x, b.y, c.x, c.y) < hitR) {
                    b.setActive(false); b.setVisible(false); b.destroy();
                    // muere escondida: explosión en su lugar, sin lanzar al resto
                    c.launched = true;
                    scene.tweens.killTweensOf(c.creature);
                    // destruir inmediatamente — el flash lo hacemos con un círculo separado
                    if (c.creature.active) c.creature.destroy();
                    // flash blanco en el punto exacto
                    const flash = scene.add.ellipse(c.x, c.y, 40*c.creatureScale, 28*c.creatureScale, 0xffffff, 0.9).setDepth(2600);
                    scene.tweens.add({ targets: flash, alpha: 0, scaleX: 2.2, scaleY: 2.2, duration: 200, ease: 'Power2',
                        onComplete: () => flash.destroy()
                    });
                    // baba en el lugar exacto
                    for (let i = 0; i < 6; i++) {
                        const ang = (i/6)*Math.PI*2;
                        const blob = scene.add.ellipse(c.x, c.y, Phaser.Math.Between(7,16), Phaser.Math.Between(5,11), 0x44ff44, 0.75).setDepth(5);
                        scene.tweens.add({ targets: blob,
                            x: c.x + Math.cos(ang)*Phaser.Math.Between(12,32),
                            y: c.y + Math.sin(ang)*Phaser.Math.Between(10,24),
                            alpha: 0.45, duration: 280, ease: 'Power2',
                            onComplete: () => { if (blob.active) { blob.setAlpha(0.45); slimePatches.push(blob); } }
                        });
                    }
                    const patch = scene.add.ellipse(c.x, c.y, 32, 18, 0x33ee33, 0.5).setDepth(4);
                    slimePatches.push(patch);
                    scene.tweens.add({ targets: patch, alpha: 0.1, duration: 7000,
                        onComplete: () => { patch.destroy(); const i=slimePatches.indexOf(patch); if(i!==-1)slimePatches.splice(i,1); }
                    });
                    break;
                }
            }
        });
    }

    // balas vs larvas (sin activar alerta global)
    if (freeLarvae.length > 0) {
        bullets.getChildren().slice().forEach(b => {
            if (!b.active) return;
            for (let i = freeLarvae.length - 1; i >= 0; i--) {
                const larva = freeLarvae[i];
                if (!larva.g.active || larva.state === 'dead') continue;
                if (Phaser.Math.Distance.Between(b.x, b.y, larva.g.x, larva.g.y) < 20 * larva.scale) {
                    b.setActive(false); b.setVisible(false); b.destroy();
                    larva.hp--;
                    if (larva.hp <= 0) {
                        explodeLarva(larva);
                    } else {
                        // daño pero sobrevive → se pone furiosa y carga al jugador
                        larva.frenzy = true;
                        larva.target = 'player';
                        larva.state = 'charging';
                        if (larva.eatTimer) { larva.eatTimer.remove(); larva.eatTimer = null; }
                        larva.slimed = false;
                    }
                    break;
                }
            }
        });
    }

    if (extractionPhase === 2 || cuttingActive || venomActive) {
        player.body.setVelocity(0,0);
        if (cuttingActive) {
            if (cutUIElements[4]) cutUIElements[4].width = Math.min(300,(cutProgress/100)*300);
            if (cursors.left.isDown||cursors.right.isDown||cursors.up.isDown||cursors.down.isDown) cancelCutting();
        }
        return;
    }

    // ── MOVIMIENTO (teclado) ──
    player.body.setVelocity(0,0);
    const usingJoy = joystickActive || Math.abs(joystickVector.x)>0.1 || Math.abs(joystickVector.y)>0.1;

    if (!usingJoy) {
        const spd = playerSlowed ? 85 : 200;
        if (cursors.left.isDown)  { player.body.setVelocityX(-spd); flipPlayer(true);  }
        else if (cursors.right.isDown) { player.body.setVelocityX(spd); flipPlayer(false); }
        if (cursors.up.isDown)    player.body.setVelocityY(-spd);
        else if (cursors.down.isDown) player.body.setVelocityY(spd);
    }

    // tilt de disparo: decae suavemente
    if (Math.abs(playerShootTilt) > 0.01) {
        playerShootTilt *= 0.88;
        player.setAngle(playerShootTilt * (player.getData('facing')==='left' ? 1 : -1));
    } else { player.setAngle(0); }

    // depth (origin en los pies)
    player.setDepth(player.y);
    // glow sigue al jugador
    const pg = player.getData('glowRef');
    if (pg && pg.active) { pg.setPosition(player.x, player.y); pg.setDepth(player.y - 1); }

    // detección de huevos
    const pc = player.body.center;
    if (!venomActive) {
        coins.getChildren().forEach(coin => {
            if (coin.active && Phaser.Math.Distance.Between(pc.x, pc.y, coin.x, coin.y) < 48) startCutting(coin);
        });
    }

    // baba en el suelo — ralentiza si pisas una mancha
    if (!playerSlowed && slimePatches.length > 0) {
        const pc2 = player.body.center;
        slimePatches.forEach(sp => {
            if (sp.active && Phaser.Math.Distance.Between(pc2.x, pc2.y, sp.x, sp.y) < 28) applySlime(sp.x, sp.y);
        });
    }

    // detección de cadáveres para veneno
    if (!venomActive && !cuttingActive) {
        enemies.getChildren().forEach(e => {
            if (e.getData('isCorpse') && !e.getData('venomHarvested')) {
                if (Phaser.Math.Distance.Between(pc.x, pc.y, e.x, e.y) < 55) startVenom(e);
            }
        });
    }

    // actualizar minijuego veneno
    if (venomActive) updateVenom();

    if (Phaser.Input.Keyboard.JustDown(attackKey)) shootBullet();

    // ── ARAÑAS ──
    enemies.getChildren().forEach(e => {
        const isActive = e.getData('active');
        if (isActive) {
            // baba cerca → siempre prioridad máxima, incluso sobre perseguir al jugador
            const slimeTgt = nearestSlimePatch(e.x, e.y);
            const slimeDist = slimeTgt ? Phaser.Math.Distance.Between(e.x, e.y, slimeTgt.x, slimeTgt.y) : 9999;
            if (slimeTgt && slimeDist < 280) {
                scene.physics.moveToObject(e, slimeTgt, (e.getData('wanderSpeed') || 45) * 1.4);
                if (slimeDist < 18) {
                    slimeTgt.destroy();
                    const idx = slimePatches.indexOf(slimeTgt);
                    if (idx !== -1) slimePatches.splice(idx, 1);
                    e.setData('idleUntil', scene.time.now + Phaser.Math.Between(800, 1800));
                }
            } else if (playerAlerted) {
                const d = Phaser.Math.Distance.Between(e.x, e.y, pc.x, pc.y);
                let spd = Phaser.Math.Clamp(d*0.35, 45, 160);
                if (e.getData('baby')) spd *= 1.25;
                scene.physics.moveToObject(e, pc, spd);
            } else if (scene.time.now < e.getData('idleUntil')) {
                e.body.setVelocity(0,0);
            } else {
                let tgt = e.getData('patrolTarget');
                if (Phaser.Math.Distance.Between(e.x, e.y, tgt.x, tgt.y) < 20) {
                    tgt = { x:Phaser.Math.Between(60,WORLD_W-60), y:Phaser.Math.Between(60,WORLD_H-60) };
                    e.setData('patrolTarget', tgt);
                    if (Math.random()<0.5) e.setData('idleUntil', scene.time.now + Phaser.Math.Between(1000,3000));
                }
                scene.physics.moveToObject(e, tgt, e.getData('wanderSpeed'));
            }
        } else {
            e.body.setVelocity(0,0);
        }

        if (isActive && e.body.speed>1) e.rotation = Math.atan2(e.body.velocity.y, e.body.velocity.x) + Math.PI/2;
        e.setDepth(e.y);

        // scale base + pulse agresivo al perseguir
        const baseScale = depthScaleFor(e.y) * (e.getData('sizeMul')||1);
        if (playerAlerted && isActive && e.body.speed > 80) {
            const pulse = 1 + 0.06 * Math.sin(scene.time.now * 0.015);
            e.setScale(baseScale * pulse);
        } else {
            e.setScale(baseScale);
        }

        if (playerAlerted && !e.getData('alertTinted')) { e.setTint(0xff5555); e.setData('alertTinted',true); }

        if (isActive && e.body.speed>1) {
            let timer = e.getData('animTimer') + 1;
            // velocidad de animación según velocidad real: más rápido = más frames/s
            const spd = e.body.speed;
            const threshold = spd > 120 ? 5 : spd > 60 ? 9 : 14;
            if (timer >= threshold) {
                const nf = (e.getData('frame')+1) % 2;
                e.setTexture('spider'+nf);
                e.setData('frame', nf);
                timer = 0;
            }
            e.setData('animTimer', timer);
        } else if (isActive) {
            // parado: frame 0
            e.setTexture('spider0');
            e.setData('frame', 0);
        }
    });
}

// ──────────────────────────────────────────
// Flip del mercenario según dirección
// ──────────────────────────────────────────
function flipPlayer(toLeft) {
    const isFlipped = player.getData('isFlipped');
    if (toLeft && !isFlipped) {
        player.setFlipX(true);
        player.setData('isFlipped', true);
        player.setData('facing', 'left');
    } else if (!toLeft && isFlipped) {
        player.setFlipX(false);
        player.setData('isFlipped', false);
        player.setData('facing', 'right');
    }
}

// ──────────────────────────────────────────
// UTILIDADES DEL MUNDO
// ──────────────────────────────────────────
function depthScaleFor(y) {
    return Phaser.Math.Clamp(0.75 + (y/WORLD_H)*0.5, 0.75, 1.25);
}

function farWorldPoint(minDist, refX, refY) {
    let x,y,tries=0;
    do {
        x = Phaser.Math.Between(60, WORLD_W-60);
        y = Phaser.Math.Between(60, WORLD_H-60);
        tries++;
    } while (Phaser.Math.Distance.Between(x,y,refX,refY)<minDist && tries<40);
    return {x,y};
}

function offscreenSpawnPoint() {
    const v=scene.cameras.main.worldView, m=120, side=Phaser.Math.Between(0,3);
    if (side===0) return {x:v.left-m,  y:Phaser.Math.Between(v.top,v.bottom)};
    if (side===1) return {x:v.right+m, y:Phaser.Math.Between(v.top,v.bottom)};
    if (side===2) return {x:Phaser.Math.Between(v.left,v.right), y:v.top-m};
    return                {x:Phaser.Math.Between(v.left,v.right), y:v.bottom+m};
}

function respawnPoint() {
    if (playerAlerted) return offscreenSpawnPoint();
    return farWorldPoint(900, player.body.center.x, player.body.center.y);
}

function startSpawnManager() {
    scene.time.addEvent({ delay: 7000, loop: true, callback: () => {
        if (!gameStarted || lives <= 0 || isPaused) return;
        const target = 2 + score;
        const active = enemies.getChildren().filter(e =>
            e.active && e.getData('active') && !e.getData('isCorpse') && !e.getData('baby')
        ).length;
        const toSpawn = Math.max(0, target - active);
        for (let i = 0; i < toSpawn; i++) {
            const pt = respawnPoint();
            const sizeMul = Phaser.Math.FloatBetween(0.6, 1.4);
            const ne = spawnEnemy(pt.x, pt.y, sizeMul);
            ne.setData('active', true);
        }
    }});
}

function buildNests() {
    const result=[], margin=150;
    const rnd=Phaser.Math.Between, dist2=Phaser.Math.Distance.Between;
    const ang=Math.random()*Math.PI*2, d=rnd(280,420);
    result.push({
        x: Phaser.Math.Clamp(landingX+Math.cos(ang)*d, margin, WORLD_W-margin),
        y: Phaser.Math.Clamp(landingY+Math.sin(ang)*d, margin, WORLD_H-margin),
        eggs:3
    });
    [3,2,2].forEach(n => {
        let x,y,ok,tries=0;
        do {
            x=rnd(margin,WORLD_W-margin); y=rnd(margin,WORLD_H-margin);
            ok = dist2(x,y,landingX,landingY)>500 && result.every(r=>dist2(x,y,r.x,r.y)>450);
            tries++;
        } while (!ok && tries<60);
        result.push({x,y,eggs:n});
    });
    return result;
}

// ──────────────────────────────────────────
// SUELO
// ──────────────────────────────────────────
function drawRock(g, rx, ry, rw) {
    const rh=Math.round(rw*0.6);
    g.fillStyle(0x0d0306,0.5); g.fillEllipse(rx+2,ry+rh*0.45,rw+4,rh*0.6);
    g.fillStyle([0x3a1624,0x4a2030,0x2e1019][Math.floor(Math.random()*3)],1); g.fillEllipse(rx,ry,rw,rh);
    g.fillStyle(0x7a3a52,0.55); g.fillEllipse(rx-rw*0.15,ry-rh*0.2,rw*0.5,rh*0.4);
}

function drawGround() {
    const W=WORLD_W, H=WORLD_H, A=(W*H)/(800*600);
    const rnd=Phaser.Math.Between, pick=arr=>arr[Math.floor(Math.random()*arr.length)];
    const g=scene.make.graphics({x:0,y:0,add:false});

    g.fillStyle(0x2b0b14,1); g.fillRect(0,0,W,H);

    const patchColors=[0x34101b,0x240912,0x3d1522,0x1e0710,0x40192a];
    for (let i=0;i<Math.round(55*A);i++) {
        g.fillStyle(pick(patchColors),0.5);
        g.fillEllipse(rnd(0,W),rnd(0,H),rnd(90,260),rnd(40,130));
    }
    nests.forEach(n=>{
        g.fillStyle(0x14050b,0.55); g.fillEllipse(n.x,n.y+6,300,170);
        g.fillStyle(0x240912,0.7);  g.fillEllipse(n.x,n.y+4,230,130);
        g.lineStyle(2,0x5a2236,0.5); g.strokeEllipse(n.x,n.y+6,300,170);
        g.fillStyle(0xff4d79,0.05); g.fillEllipse(n.x,n.y,180,100);
        for (let i=0;i<12;i++) {
            const a=Math.random()*Math.PI*2;
            drawRock(g, n.x+Math.cos(a)*150, n.y+Math.sin(a)*85, rnd(8,18));
        }
    });
    for (let i=0;i<Math.round(10*A);i++) {
        const cx=rnd(80,W-80), cy=rnd(80,H-70), cw=rnd(50,110), ch=Math.round(cw*0.45);
        craters.push({x:cx,y:cy});
        g.fillStyle(0x0e0206,0.85); g.fillEllipse(cx,cy,cw,ch);
        g.lineStyle(2,0x7a2238,0.65); g.strokeEllipse(cx,cy-1,cw+4,ch+3);
    }
    for (let i=0;i<Math.round(16*A);i++) {
        let px=rnd(0,W),py=rnd(0,H),ang=Math.random()*Math.PI*2;
        for (let s=0;s<rnd(4,8);s++) {
            const len=rnd(14,34); ang+=(Math.random()-0.5)*1.1;
            const nx=px+Math.cos(ang)*len, ny=py+Math.sin(ang)*len*0.6;
            g.lineStyle(1,0x120409,0.85); g.lineBetween(px,py,nx,ny);
            g.lineStyle(1,0x5a2236,0.3);  g.lineBetween(px,py+1,nx,ny+1);
            px=nx; py=ny;
        }
    }
    const grit=[0x4a1a2b,0x5e2438,0x1a060c,0x3a1624];
    for (let i=0;i<Math.round(600*A);i++) {
        g.fillStyle(pick(grit),0.45+Math.random()*0.4);
        g.fillRect(rnd(0,W),rnd(0,H),Math.random()<0.8?1:2,Math.random()<0.8?1:2);
    }
    for (let i=0;i<Math.round(30*A);i++) drawRock(g,rnd(10,W-10),rnd(10,H-10),rnd(6,20));
    const bc=[0xff4d79,0xd63a68,0x9c2a4d,0xff7aa0];
    for (let i=0;i<Math.round(110*A);i++) {
        const tx=rnd(10,W-10), ty=rnd(10,H-6), k=0.55+(ty/H)*0.7, bl=rnd(3,6);
        g.fillStyle(0x0d0306,0.35); g.fillEllipse(tx,ty+1,12*k,4*k);
        for (let b=0;b<bl;b++) {
            const bx=tx+(b-bl/2)*2.2*k+rnd(-1,1), h=rnd(7,16)*k, lean=rnd(-5,5)*k;
            g.fillStyle(pick(bc),0.9); g.fillTriangle(bx-1.4*k,ty,bx+1.4*k,ty,bx+lean,ty-h);
        }
    }
    for (let i=0;i<Math.round(30*A);i++) {
        const sx=rnd(10,W-10),sy=rnd(10,H-10);
        g.fillStyle(0xff4d79,0.12); g.fillCircle(sx,sy,5);
        g.fillStyle(0xff9ab5,0.7);  g.fillCircle(sx,sy,1.2);
    }
    for (let k=0;k<10;k++) {
        const t=26*(k+1); g.fillStyle(0x0a0206,0.06);
        g.fillRect(0,0,t,H); g.fillRect(W-t,0,t,H);
        g.fillRect(0,0,W,t); g.fillRect(0,H-t,W,t);
    }
    if (scene.textures.exists('ground')) scene.textures.remove('ground');
    g.generateTexture('ground',W,H); g.destroy();
    scene.add.image(0,0,'ground').setOrigin(0,0).setDepth(-10);
}

// ──────────────────────────────────────────
// CRIATURAS DE CRÁTERES
// ──────────────────────────────────────────
// Criatura única: larva alienígena con mandíbulas y ojos compuestos
function drawCraterCreature(g, cx, cy, s) {
    g.clear();
    // sombra
    g.fillStyle(0x000000, 0.3); g.fillEllipse(cx+2, cy+14*s, 36*s, 8*s);

    // cuerpo segmentado — 3 segmentos abdominales
    const segColors = [0x2a0c1e, 0x3a1228, 0x2a0c1e];
    for (let i=0; i<3; i++) {
        g.fillStyle(segColors[i], 1);
        g.fillEllipse(cx, cy + (i-1)*7*s, 24*s - i*2*s, 14*s - i*s);
        g.lineStyle(0.8, 0xaa2244, 0.5);
        g.strokeEllipse(cx, cy + (i-1)*7*s, 24*s - i*2*s, 14*s - i*s);
    }
    // brillo dorsal
    g.fillStyle(0xcc3366, 0.25); g.fillEllipse(cx-4*s, cy-9*s, 10*s, 5*s);

    // cabeza — más ancha, aplanada
    g.fillStyle(0x1a0612, 1); g.fillEllipse(cx, cy-16*s, 30*s, 18*s);
    g.lineStyle(1.2, 0xff3366, 0.7); g.strokeEllipse(cx, cy-16*s, 30*s, 18*s);

    // mandíbulas inferiores (quelíceros) — 2 curvos hacia afuera
    g.lineStyle(2.5*s, 0x8a1a30, 1);
    g.lineBetween(cx-8*s, cy-10*s, cx-16*s, cy-4*s);
    g.lineBetween(cx+8*s, cy-10*s, cx+16*s, cy-4*s);
    g.lineStyle(1.5*s, 0xff4466, 0.8);
    g.lineBetween(cx-8*s, cy-10*s, cx-16*s, cy-4*s);
    g.lineBetween(cx+8*s, cy-10*s, cx+16*s, cy-4*s);
    // punta de quelícero
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx-16*s, cy-4*s, 2*s);
    g.fillCircle(cx+16*s, cy-4*s, 2*s);

    // ojos compuestos — 2 grandes hexagonales
    // ojo izquierdo
    g.fillStyle(0xdd0033, 1); g.fillEllipse(cx-9*s, cy-18*s, 11*s, 9*s);
    g.lineStyle(1, 0xff6688, 0.9); g.strokeEllipse(cx-9*s, cy-18*s, 11*s, 9*s);
    // facetas ojo izquierdo
    g.lineStyle(0.7, 0x330011, 0.8);
    g.lineBetween(cx-9*s, cy-22*s, cx-9*s, cy-14*s);
    g.lineBetween(cx-13*s, cy-18*s, cx-5*s, cy-18*s);
    g.fillStyle(0x000000, 0.6); g.fillCircle(cx-9*s, cy-18*s, 2.5*s);
    g.fillStyle(0xffffff, 0.7); g.fillCircle(cx-11*s, cy-20*s, 1.2*s);
    // ojo derecho
    g.fillStyle(0xdd0033, 1); g.fillEllipse(cx+9*s, cy-18*s, 11*s, 9*s);
    g.lineStyle(1, 0xff6688, 0.9); g.strokeEllipse(cx+9*s, cy-18*s, 11*s, 9*s);
    g.lineStyle(0.7, 0x330011, 0.8);
    g.lineBetween(cx+9*s, cy-22*s, cx+9*s, cy-14*s);
    g.lineBetween(cx+5*s, cy-18*s, cx+13*s, cy-18*s);
    g.fillStyle(0x000000, 0.6); g.fillCircle(cx+9*s, cy-18*s, 2.5*s);
    g.fillStyle(0xffffff, 0.7); g.fillCircle(cx+7*s, cy-20*s, 1.2*s);

    // ojo central pequeño (3er ojo)
    g.fillStyle(0xffcc00, 1); g.fillCircle(cx, cy-22*s, 3*s);
    g.fillStyle(0x000000, 1); g.fillCircle(cx, cy-22*s, 1.5*s);
    g.fillStyle(0xffffff, 0.8); g.fillCircle(cx-1*s, cy-23*s, 0.8*s);

    // antenas — 2 largas con bulbo en la punta
    g.lineStyle(1.5*s, 0x661122, 1);
    g.lineBetween(cx-6*s, cy-24*s, cx-18*s, cy-36*s);
    g.lineBetween(cx+6*s, cy-24*s, cx+18*s, cy-36*s);
    g.fillStyle(0xff2244, 1); g.fillCircle(cx-18*s, cy-36*s, 2.5*s);
    g.fillStyle(0xff2244, 1); g.fillCircle(cx+18*s, cy-36*s, 2.5*s);

    // 6 patas cortas (3 por lado)
    g.lineStyle(1.5*s, 0x551020, 1);
    [-1,0,1].forEach((row,i) => {
        g.lineBetween(cx-12*s, cy+(row*5-2)*s, cx-20*s, cy+(row*5+4)*s);
        g.lineBetween(cx+12*s, cy+(row*5-2)*s, cx+20*s, cy+(row*5+4)*s);
    });

    // babas / secreción en la boca
    g.fillStyle(0x44ff44, 0.6); g.fillEllipse(cx-3*s, cy-9*s, 4*s, 3*s);
    g.fillStyle(0x44ff44, 0.5); g.fillEllipse(cx+4*s, cy-8*s, 3*s, 2*s);
}

function spawnCraterEyes() {
    craters.forEach(c => {
        const s = Phaser.Math.FloatBetween(0.7, 1.3);
        const g = scene.add.graphics().setDepth(c.y + 2);
        drawCraterCreature(g, c.x, c.y, s);

        // parpadeo / bob
        const bobDur = Phaser.Math.Between(500, 1200);
        scene.tweens.add({targets:g, y: g.y - Phaser.Math.Between(3,8), duration:bobDur, yoyo:true, repeat:-1, ease:'Sine.easeInOut', delay:Phaser.Math.Between(0,800)});

        // guardar referencia para lanzarlos al atacar
        c.creature = g;
        c.creatureScale = s;
        c.launched = false;
        craterCreatures.push(c);
    });
}

// ── Larvas libres ─────────────────────────────────────────────────────────
// states: 'flying'→inicial hacia jugador | 'eating'→en baba | 'charging'→embistiendo entidad | 'hunting'→busca baba post-comida
// Al detectar cualquier entidad (larva, araña, jugador) en radio DETECT:
//   si eating → interrumpe, carga a muerte, al matar vuelve a eating
//   si hunting/flying → carga si está en radio

const LARVA_DETECT   = 110; // radio de detección territorial
const LARVA_CHARGE   = 170; // velocidad de carga
const LARVA_HUNT_SPD = 130; // velocidad buscando baba

function spawnFreeLarva(x, y, scale, vx, vy) {
    const g = scene.add.graphics().setDepth(2500);
    g.x = x; g.y = y;
    const larva = {
        g, vx, vy, hp: 3, scale,
        state: 'flying',       // estado actual
        target: null,          // entidad objetivo al cargar
        moveEvt: null,
        eatTimer: null,        // timer de fin de comida
        slimed: false,
        frenzy: false
    };
    drawCraterCreature(g, 0, 0, scale);
    larva.moveEvt = scene.time.addEvent({ delay:16, loop:true, callback:() => tickLarva(larva) });
    freeLarvae.push(larva);
    return larva;
}

function tickLarva(larva) {
    const g = larva.g;
    if (!g || !g.active) { killLarva(larva); return; }
    if (larva.state === 'dead') return;
    const DT = 0.016;

    // ── Detectar entidad más cercana ──
    const threat = nearestThreat(larva);

    // ── EATING: comiendo baba ──
    if (larva.state === 'eating') {
        redrawLarva(larva, 0x00ff44);
        if (threat) {
            // ¡interrupción territorial! → cargar
            if (larva.eatTimer) { larva.eatTimer.remove(); larva.eatTimer = null; }
            larva.slimed = false;
            larva.target = threat;
            larva.state = 'charging';
            const t = scene.add.text(g.x, g.y-32,'¡INTRUSO!',{fontFamily:'Courier',fontSize:'12px',fill:'#ff2200',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setDepth(25000);
            scene.tweens.add({targets:t, y:t.y-25, alpha:0, duration:600, onComplete:()=>t.destroy()});
        }
        return;
    }

    // ── CHARGING: embiste a objetivo ──
    if (larva.state === 'charging') {
        const tgt = getTargetPos(larva.target);
        if (!tgt) {
            // objetivo desaparecido → volver a comer o hunting
            larva.target = null;
            larva.state = larva.slimed ? 'eating' : 'hunting';
            return;
        }
        // apuntar hacia objetivo a toda velocidad
        const ang = Math.atan2(tgt.y - g.y, tgt.x - g.x);
        larva.vx = Math.cos(ang) * LARVA_CHARGE;
        larva.vy = Math.sin(ang) * LARVA_CHARGE;
        g.x += larva.vx * DT;
        g.y += larva.vy * DT;
        redrawLarva(larva, 0xff2200); // tinte rojo al cargar

        // ¿impacto con objetivo?
        if (Phaser.Math.Distance.Between(g.x, g.y, tgt.x, tgt.y) < 26) {
            resolveChargeImpact(larva);
            return;
        }
        // ¿nuevo threat más cercano? reapunta
        if (threat && threat !== larva.target) larva.target = threat;
        return;
    }

    // ── HUNTING: busca baba con frenzy ──
    if (larva.state === 'hunting') {
        if (threat) {
            // también carga en hunting si hay entidad cerca
            larva.target = threat;
            larva.state = 'charging';
            return;
        }
        const slimeTgt = nearestSlimePatch(g.x, g.y);
        if (slimeTgt) {
            const ang = Math.atan2(slimeTgt.y - g.y, slimeTgt.x - g.x);
            larva.vx = Math.cos(ang) * LARVA_HUNT_SPD;
            larva.vy = Math.sin(ang) * LARVA_HUNT_SPD;
        } else {
            // sin baba visible → va hacia el jugador
            if (player && player.active) {
                const pc = player.body.center;
                const ang = Math.atan2(pc.y - g.y, pc.x - g.x);
                larva.vx = Math.cos(ang) * LARVA_HUNT_SPD;
                larva.vy = Math.sin(ang) * LARVA_HUNT_SPD;
            }
        }
    }

    // ── FLYING: va hacia jugador inicial ──
    // vx/vy ya están fijos desde el lanzamiento; solo aplica hasta detectar baba o threat

    // ── Movimiento ──
    g.x += larva.vx * DT;
    g.y += larva.vy * DT;
    redrawLarva(larva, larva.frenzy ? 0xff4400 : null);

    // ── Colisión jugador (contacto directo en flying) ──
    if (larva.state === 'flying' && player && player.active && !invulnerable) {
        const dx = g.x - player.body.center.x, dy = g.y - player.body.center.y;
        if (Math.hypot(dx,dy) < 28) { explodeLarva(larva); return; }
    }

    // ── Detectar baba → pasar a eating ──
    if (!larva.slimed && larva.state !== 'charging') {
        for (const sp of slimePatches) {
            if (!sp.active) continue;
            if (Phaser.Math.Distance.Between(g.x, g.y, sp.x, sp.y) < 34) {
                larva.slimed = true;
                larva.vx = 0; larva.vy = 0;
                larva.state = 'eating';
                larva.target = null;
                const t = scene.add.text(g.x, g.y-30,'¡NOM!',{fontFamily:'Courier',fontSize:'13px',fill:'#44ff44',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setDepth(25000);
                scene.tweens.add({targets:t, y:t.y-25, alpha:0, duration:700, onComplete:()=>t.destroy()});
                // timer de fin de comida
                larva.eatTimer = scene.time.delayedCall(Phaser.Math.Between(2500,4500), ()=>{
                    larva.eatTimer = null;
                    if (!g.active || larva.state==='dead') return;
                    larva.slimed = false;
                    larva.frenzy = true;
                    larva.scale = Math.min(larva.scale * 1.18, 2.8); // creció
                    larva.state = 'hunting';
                    const t2 = scene.add.text(g.x, g.y-35,'¡FURIA!',{fontFamily:'Courier',fontSize:'14px',fill:'#ff4400',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setDepth(25000);
                    scene.tweens.add({targets:t2, y:t2.y-30, alpha:0, duration:800, onComplete:()=>t2.destroy()});
                    scene.cameras.main.shake(180, 0.005);
                });
                break;
            }
        }
    }

    // ── En flying, si detecta threat → cargar ──
    if (larva.state === 'flying' && threat) {
        larva.target = threat;
        larva.state = 'charging';
    }

    if (g.x < -200 || g.x > WORLD_W+200 || g.y < -200 || g.y > WORLD_H+200) killLarva(larva);
}

// Devuelve la posición actual del objetivo (jugador, araña u otra larva)
function getTargetPos(tgt) {
    if (!tgt) return null;
    if (tgt === 'player') {
        if (!player || !player.active) return null;
        return { x: player.body.center.x, y: player.body.center.y };
    }
    if (tgt.getData) { // araña (sprite Phaser)
        if (!tgt.active || !tgt.getData('active') || tgt.getData('isCorpse')) return null;
        return { x: tgt.x, y: tgt.y };
    }
    if (tgt.g) { // otra larva
        if (!tgt.g.active || tgt.state==='dead') return null;
        return { x: tgt.g.x, y: tgt.g.y };
    }
    return null;
}

// Resuelve el impacto de la carga según el tipo de objetivo
function resolveChargeImpact(larva) {
    const tgt = larva.target;
    larva.target = null;
    const g = larva.g;

    // sacudida visual
    scene.tweens.add({targets:g, x: g.x + Phaser.Math.Between(-10,10), duration:60, yoyo:true, repeat:2});

    if (tgt === 'player') {
        // golpea al jugador
        explodeLarva(larva);
        return;
    }

    if (tgt && tgt.getData) {
        // araña
        const eSize = tgt.getData('sizeMul') || 1;
        if (larva.scale >= eSize * 0.75) {
            leaveCorpse(tgt);
            larva.scale = Math.min(larva.scale * 1.1, 2.8);
            const t = scene.add.text(g.x, g.y-28,'¡DEVORADA!',{fontFamily:'Courier',fontSize:'11px',fill:'#ff6600',stroke:'#000',strokeThickness:2}).setOrigin(0.5).setDepth(25000);
            scene.tweens.add({targets:t, y:t.y-20, alpha:0, duration:600, onComplete:()=>t.destroy()});
        } else {
            larva.hp--;
            if (larva.hp<=0) { explodeLarva(larva); return; }
        }
        // volver a comer si había baba cerca
        larva.state = larva.slimed ? 'eating' : 'hunting';
        return;
    }

    if (tgt && tgt.g) {
        // otra larva — pelea a muerte inmediata
        const other = tgt;
        scene.tweens.add({targets:[g, other.g], x:'+='+Phaser.Math.Between(-12,12), duration:70, yoyo:true, repeat:4});
        if (larva.scale >= other.scale) {
            larva.scale = Math.min(larva.scale * 1.22, 3.0);
            larva.hp = Math.min(larva.hp+1, 5);
            larva.frenzy = true;
            explodeLarva(other);
            const t = scene.add.text(g.x, g.y-36,'¡SOBREVIVE!',{fontFamily:'Courier',fontSize:'12px',fill:'#ffaa00',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setDepth(25000);
            scene.tweens.add({targets:t, y:t.y-30, alpha:0, duration:900, onComplete:()=>t.destroy()});
        } else {
            larva.hp--;
            if (larva.hp<=0) { explodeLarva(larva); return; }
        }
        larva.state = larva.slimed ? 'eating' : 'hunting';
    }
}

// Entidad más cercana dentro del radio de detección territorial
function nearestThreat(larva) {
    const gx = larva.g.x, gy = larva.g.y;
    let best = null, bestDist = LARVA_DETECT;

    // jugador
    if (player && player.active) {
        const d = Phaser.Math.Distance.Between(gx, gy, player.body.center.x, player.body.center.y);
        if (d < bestDist) { bestDist = d; best = 'player'; }
    }
    // arañas
    enemies.getChildren().forEach(e => {
        if (!e.active || !e.getData('active') || e.getData('isCorpse')) return;
        const d = Phaser.Math.Distance.Between(gx, gy, e.x, e.y);
        if (d < bestDist) { bestDist = d; best = e; }
    });
    // otras larvas
    freeLarvae.forEach(other => {
        if (other === larva || !other.g.active || other.state==='dead') return;
        const d = Phaser.Math.Distance.Between(gx, gy, other.g.x, other.g.y);
        if (d < bestDist) { bestDist = d; best = other; }
    });
    return best;
}

function nearestSlimePatch(x, y) {
    let best = null, bestDist = 700;
    slimePatches.forEach(sp => {
        if (!sp.active) return;
        const d = Phaser.Math.Distance.Between(x, y, sp.x, sp.y);
        if (d < bestDist) { bestDist = d; best = sp; }
    });
    return best;
}

function redrawLarva(larva, tintColor) {
    larva.g.clear();
    drawCraterCreature(larva.g, 0, 0, larva.scale);
    if (tintColor) {
        larva.g.fillStyle(tintColor, 0.28);
        larva.g.fillEllipse(0, -10*larva.scale, 32*larva.scale, 22*larva.scale);
    }
}

function killLarva(larva) {
    if (larva.state === 'dead') return;
    larva.state = 'dead';
    if (larva.moveEvt) { larva.moveEvt.remove(); larva.moveEvt = null; }
    if (larva.eatTimer) { larva.eatTimer.remove(); larva.eatTimer = null; }
    if (larva.g && larva.g.active) larva.g.destroy();
    const idx = freeLarvae.indexOf(larva);
    if (idx !== -1) freeLarvae.splice(idx, 1);
}

function explodeLarva(larva) {
    if (!larva.g || !larva.g.active || larva.state==='dead') return;
    const ex = larva.g.x, ey = larva.g.y;
    const hitPlayer = player && player.active && !invulnerable &&
        Phaser.Math.Distance.Between(ex, ey, player.body.center.x, player.body.center.y) < 42;
    killLarva(larva);
    // baba al morir
    for (let i=0; i<6; i++) {
        const ang = (i/6)*Math.PI*2;
        const blob = scene.add.ellipse(ex, ey, Phaser.Math.Between(8,18), Phaser.Math.Between(5,12), 0x44ff44, 0.7).setDepth(5);
        scene.tweens.add({targets:blob, x:ex+Math.cos(ang)*Phaser.Math.Between(15,40), y:ey+Math.sin(ang)*Phaser.Math.Between(10,30), alpha:0.4, duration:280, ease:'Power2', onComplete:()=>{ if(blob.active){blob.setAlpha(0.4); slimePatches.push(blob);} }});
    }
    const patch = scene.add.ellipse(ex, ey, 36, 20, 0x33ee33, 0.5).setDepth(4);
    slimePatches.push(patch);
    scene.tweens.add({targets:patch, alpha:0.1, duration:7000, onComplete:()=>{ patch.destroy(); const i=slimePatches.indexOf(patch); if(i!==-1)slimePatches.splice(i,1); }});
    if (hitPlayer) {
        lives--; livesText.setText('Salud: '+lives);
        if (lives<=0) { endGame(); return; }
        invulnerable=true;
        scene.tweens.add({targets:player, alpha:0.3, duration:100, yoyo:true, repeat:7});
        scene.time.delayedCall(1500, ()=>{ invulnerable=false; player.setAlpha(1); });
        applySlime(ex, ey);
    }
}

function launchCraterCreatures() {
    craterCreatures.forEach((c, i) => {
        if (c.launched || !c.creature || !c.creature.active) return;
        c.launched = true;
        const g = c.creature;
        scene.tweens.killTweensOf(g);
        // 1) se hunden
        scene.tweens.add({targets:g, y: c.y+18, alpha:0, duration:250, ease:'Power2.easeIn', delay: i*60, onComplete:()=>{
            if (!g.active) return;
            g.destroy(); // la graphics del cráter se destruye; nace larva libre
            const pc = player.body ? player.body.center : {x:player.x, y:player.y};
            const ang = Math.atan2(pc.y - c.y, pc.x - c.x);
            const spd = Phaser.Math.Between(90, 160); // velocidad reducida para más counter play
            const larva = spawnFreeLarva(c.x, c.y, c.creatureScale, Math.cos(ang)*spd, Math.sin(ang)*spd);
            // 2) pop visual de salida
            scene.tweens.add({targets:larva.g, y: larva.g.y - 20, duration:200, ease:'Back.easeOut'});
        }});
    });
}

// explodeCraterCreature eliminada — reemplazada por explodeLarva / killLarva

function applySlime(x, y) {
    // ralentiza si el jugador está cerca
    if (playerSlowed) return;
    if (Phaser.Math.Distance.Between(x, y, player.body.center.x, player.body.center.y) < 60) {
        playerSlowed = true;
        const slowText = scene.add.text(player.x, player.y-40,'¡BABA!',{fontFamily:'Courier',fontSize:'16px',fill:'#44ff44',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setDepth(25000);
        scene.tweens.add({targets:slowText, y:slowText.y-30, alpha:0, duration:900, onComplete:()=>slowText.destroy()});
        if (playerSlowTimer) playerSlowTimer.remove();
        playerSlowTimer = scene.time.delayedCall(3000, ()=>{ playerSlowed=false; playerSlowTimer=null; });
    }
}

// ──────────────────────────────────────────
// NAVE DE INTRO (gráfico procedural)
// ──────────────────────────────────────────
function buildShipGraphic(sc, x, y) {
    if (!sc.textures.exists('ship')) {
        const g = sc.make.graphics({x:0, y:0, add:false});
        const W=260, H=130, cx=130, cy=70;

        // sombra bajo la nave
        g.fillStyle(0x000000, 0.25);
        g.fillEllipse(cx+4, cy+52, 220, 28);

        // alas extendidas
        g.fillStyle(0x041e2e, 1);
        g.fillTriangle(cx-50,cy+20,  cx-130,cy+50,  cx-30,cy+38);
        g.fillTriangle(cx+50,cy+20,  cx+130,cy+50,  cx+30,cy+38);
        // borde alas cyan
        g.lineStyle(1.5, 0x00e5ff, 0.6);
        g.lineBetween(cx-50,cy+20, cx-130,cy+50);
        g.lineBetween(cx-130,cy+50, cx-30,cy+38);
        g.lineBetween(cx+50,cy+20, cx+130,cy+50);
        g.lineBetween(cx+130,cy+50, cx+30,cy+38);
        // detalle ala — línea interna
        g.lineStyle(1, 0x007799, 0.5);
        g.lineBetween(cx-50,cy+28, cx-110,cy+46);
        g.lineBetween(cx+50,cy+28, cx+110,cy+46);

        // fuselaje principal (elipse gruesa)
        g.fillStyle(0x06303f, 1);
        g.fillEllipse(cx, cy+10, 190, 52);
        // capa interior más clara
        g.fillStyle(0x0a4a60, 1);
        g.fillEllipse(cx, cy+6, 170, 40);
        // franja de energía
        g.fillStyle(0x00e5ff, 0.85);
        g.fillRect(cx-82, cy+6, 164, 3);
        g.fillStyle(0x00ffcc, 0.4);
        g.fillRect(cx-82, cy+10, 164, 2);

        // cúpula superior (cockpit)
        g.fillStyle(0x062840, 1);
        g.fillEllipse(cx, cy-10, 120, 50);
        g.fillStyle(0x0d4a62, 1);
        g.fillEllipse(cx, cy-14, 100, 38);
        // vidrio del cockpit
        g.fillStyle(0x00ccff, 0.18);
        g.fillEllipse(cx, cy-16, 90, 32);
        // reflejo vidrio
        g.fillStyle(0xffffff, 0.22);
        g.fillEllipse(cx-18, cy-22, 38, 12);

        // ventanas laterales (3)
        [-36, 0, 36].forEach(ox => {
            g.fillStyle(0x001a2a, 1);   g.fillCircle(cx+ox, cy+8, 9);
            g.fillStyle(0x00ffcc, 0.9); g.fillCircle(cx+ox, cy+8, 6);
            g.fillStyle(0xffffff, 0.6); g.fillCircle(cx+ox-3, cy+5, 2.5);
        });

        // motores inferiores (3 toberas)
        [-44, 0, 44].forEach(ox => {
            g.fillStyle(0x020e14, 1);   g.fillEllipse(cx+ox, cy+36, 22, 10);
            g.fillStyle(0x00ffcc, 0.7); g.fillEllipse(cx+ox, cy+37, 14, 6);
            g.fillStyle(0xffffff, 0.5); g.fillEllipse(cx+ox, cy+37, 6, 3);
        });
        // glow motor
        g.fillStyle(0x00ffcc, 0.12);
        g.fillEllipse(cx, cy+44, 160, 20);

        // luces de posición (puntas de ala)
        g.fillStyle(0xff4444, 1); g.fillCircle(cx-124, cy+49, 4);
        g.fillStyle(0x44ff44, 1); g.fillCircle(cx+124, cy+49, 4);

        // borde fuselaje
        g.lineStyle(2, 0x00aacc, 0.9);
        g.strokeEllipse(cx, cy+10, 190, 52);
        g.lineStyle(1.5, 0x005566, 0.7);
        g.strokeEllipse(cx, cy-10, 120, 50);

        g.generateTexture('ship', W, H);
        g.destroy();
    }

    const img = sc.add.image(x, y, 'ship').setOrigin(0.5, 0.5).setDepth(3500);
    return img;
}

// ──────────────────────────────────────────
// ARAÑAS
// ──────────────────────────────────────────
function buildSpiderTexture(key, frame, s, pal) {
    const W=56*s, H=48*s, g=scene.make.graphics({x:0,y:0,add:false}), sign=frame===0?1:-1;
    const legs=[
        {s:[24,15],k:[12,5], f:[4,11]},
        {s:[23,18],k:[9,14], f:[2,22]},
        {s:[23,21],k:[9,25], f:[3,34]},
        {s:[24,24],k:[12,33],f:[7,41]}
    ];
    g.fillStyle(0x000000,0.4); g.fillEllipse(30*s,30*s,32*s,22*s);
    legs.forEach((leg,i)=>{
        [-1,1].forEach(side=>{
            const shift=(i%2===0?1:-1)*side*sign*2;
            const mx=v=>(side===-1?v:56-v)*s;
            const sx=mx(leg.s[0]),sy=leg.s[1]*s, kx=mx(leg.k[0]),ky=(leg.k[1]+shift)*s, fx=mx(leg.f[0]),fy=(leg.f[1]+shift*1.5)*s;
            g.lineStyle(3*s,pal.leg,1); g.lineBetween(sx,sy,kx,ky); g.lineBetween(kx,ky,fx,fy);
            g.lineStyle(Math.max(1,s),pal.accent,0.85); g.lineBetween(sx,sy,kx,ky); g.lineBetween(kx,ky,fx,fy);
            g.fillStyle(pal.joint,1); g.fillCircle(kx,ky,1.5*s);
        });
    });
    g.fillStyle(pal.body,1); g.fillEllipse(28*s,29*s,20*s,24*s);
    g.lineStyle(1.5*s,pal.accent,0.9); g.strokeEllipse(28*s,29*s,20*s,24*s);
    g.fillStyle(pal.accent,0.95);
    g.fillTriangle(28*s,24*s,25*s,29*s,31*s,29*s);
    g.fillTriangle(28*s,35*s,25*s,29*s,31*s,29*s);
    g.fillStyle(pal.head,1); g.fillEllipse(28*s,15*s,13*s,13*s);
    g.lineStyle(1.5*s,pal.accent,0.9); g.strokeEllipse(28*s,15*s,13*s,13*s);
    g.fillStyle(pal.accent,1);
    g.fillTriangle(25*s,9*s,27.5*s,9*s,26*s,4*s);
    g.fillTriangle(31*s,9*s,28.5*s,9*s,30*s,4*s);
    g.fillStyle(pal.eye,1);
    g.fillCircle(25.5*s,13*s,1.8*s); g.fillCircle(30.5*s,13*s,1.8*s);
    g.fillCircle(27*s,16.5*s,1.1*s); g.fillCircle(29*s,16.5*s,1.1*s);
    if (pal.extraEyes) {
        g.fillCircle(23.8*s,15*s,1.2*s); g.fillCircle(32.2*s,15*s,1.2*s); g.fillCircle(28*s,11.2*s,1.2*s);
    }
    g.generateTexture(key,W,H); g.destroy();
}

function ensureSpiderTextures() {
    if (scene.textures.exists('spider0')) return;
    [0,1].forEach(f => {
        buildSpiderTexture('spider'+f, f, 1, SPIDER_PAL);
        buildSpiderTexture('mother'+f, f, 4, MOTHER_PAL);
    });
    const g=scene.make.graphics({x:0,y:0,add:false});
    for (let i=0;i<12;i++) { g.fillStyle(0xff1133,0.05); g.fillEllipse(250,160,500-i*36,320-i*24); }
    g.generateTexture('motherGlow',500,320); g.destroy();
}

// ──────────────────────────────────────────
// HUEVOS
// ──────────────────────────────────────────
function drawEggSac(g,cx,cy,w,h,embryo) {
    g.fillStyle(0x3a0614,1); g.fillEllipse(cx,cy,w,h);
    g.fillStyle(0x8a1230,1); g.fillEllipse(cx,cy,w-3,h-3);
    g.fillStyle(0xc41f4a,1); g.fillEllipse(cx,cy+h*0.03,w-8,h-9);
    g.fillStyle(0xff4d79,0.55); g.fillEllipse(cx,cy+h*0.07,w-14,h-17);
    if (embryo) {
        const u=w/30;
        g.lineStyle(1,0x2a0a18,0.9);
        for (let i=-1;i<=1;i++) {
            g.lineBetween(cx-2*u,cy+(3+i*3)*u,cx-7*u,cy+(1+i*4)*u);
            g.lineBetween(cx+2*u,cy+(3+i*3)*u,cx+7*u,cy+(1+i*4)*u);
        }
        g.fillStyle(0x2a0a18,0.95);
        g.fillEllipse(cx,cy+4*u,w*0.3,h*0.26);
        g.fillEllipse(cx,cy-4*u,w*0.2,h*0.14);
        g.fillStyle(0xffaa00,1);
        g.fillCircle(cx-1.5*u,cy-4.5*u,0.9*u);
        g.fillCircle(cx+1.5*u,cy-4.5*u,0.9*u);
    }
    g.fillStyle(0xffd6e0,0.7); g.fillEllipse(cx-w*0.18,cy-h*0.24,w*0.2,h*0.16);
    g.fillStyle(0xffffff,0.6); g.fillCircle(cx-w*0.2,cy-h*0.28,1.1);
    g.lineStyle(1,0xff8aa8,0.45); g.strokeEllipse(cx,cy,w-1,h-1);
}

function ensureEggTextures() {
    if (!scene.textures.exists('egg')) {
        const g=scene.make.graphics({x:0,y:0,add:false});
        g.fillStyle(0x2a0712,0.7); g.fillEllipse(40,68,70,17);
        g.lineStyle(1,0xffb0c8,0.3); g.strokeEllipse(40,68,72,18);
        g.lineStyle(1,0xffc0d0,0.35);
        [[10,70],[70,71],[22,77],[58,78],[4,65],[76,65]].forEach(p=>g.lineBetween(40,63,p[0],p[1]));
        drawEggSac(g,21,57,20,25,false);
        drawEggSac(g,59,58,18,23,false);
        drawEggSac(g,40,42,38,48,true);
        g.generateTexture('egg',80,80); g.destroy();
    }
    if (!scene.textures.exists('eggGlow')) {
        const g=scene.make.graphics({x:0,y:0,add:false});
        for (let r=56;r>6;r-=5) { g.fillStyle(0xff3366,0.04); g.fillCircle(60,60,r); }
        g.generateTexture('eggGlow',120,120); g.destroy();
    }
}

function spawnStaticCoin(x,y) {
    const k=depthScaleFor(y);
    const glow=scene.add.image(x,y+4,'eggGlow')
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(y-1).setScale(k).setAlpha(0.5);
    scene.tweens.add({targets:glow,alpha:0.95,duration:Phaser.Math.Between(700,1100),delay:Phaser.Math.Between(0,600),yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    const coin=scene.add.image(x,y,'egg').setDepth(y).setScale(k);
    coin.setData('glow',glow);
    coins.add(coin);
}

// ──────────────────────────────────────────
// SPAWNS
// ──────────────────────────────────────────
function spawnEnemy(x,y,sizeMul=1) {
    const e=scene.add.sprite(x,y,'spider0');
    scene.physics.add.existing(e);
    e.body.setSize(34,30);
    e.setDepth(y); e.setScale(depthScaleFor(y)*sizeMul);
    e.setData('sizeMul',sizeMul);  e.setData('animTimer',0);
    e.setData('frame',0);          e.setData('active',false);
    e.setData('alertTinted',false);e.setData('idleUntil',0);
    e.setData('wanderSpeed',Phaser.Math.Between(35,60));
    e.setData('patrolTarget',{x:Phaser.Math.Between(60,WORLD_W-60),y:Phaser.Math.Between(60,WORLD_H-60)});
    enemies.add(e);
    return e;
}

function hitEnemy(p,enemy) {
    if (invulnerable||isPaused||!gameStarted||extractionPhase===2) return;
    if (!enemy.active) return;
    if (cuttingActive) cancelCutting();

    lives--;
    livesText.setText('Salud: '+lives);
    leaveCorpse(enemy);
    if (lives<=0) return endGame();

    invulnerable=true;
    scene.tweens.add({targets:player,alpha:0.3,duration:100,yoyo:true,repeat:7});
    scene.time.delayedCall(1500,()=>{ invulnerable=false; player.setAlpha(1); });
}

function buildBulletTexture() {
    if (scene.textures.exists('bullet')) return;
    const g = scene.make.graphics({x:0,y:0,add:false});
    // cuerpo del proyectil: cápsula verde brillante
    g.fillStyle(0x00ff41, 1);
    g.fillRoundedRect(0, 2, 18, 5, 2);
    // núcleo más brillante
    g.fillStyle(0xccffcc, 0.9);
    g.fillRoundedRect(2, 3, 10, 3, 1);
    // punta brillante
    g.fillStyle(0xffffff, 0.8);
    g.fillRect(0, 3, 3, 3);
    // estela de glow
    g.fillStyle(0x00ff41, 0.2);
    g.fillRoundedRect(0, 1, 18, 7, 3);
    g.generateTexture('bullet', 18, 9);
    g.destroy();
}

function shootBullet() {
    if (!gameStarted||scene.time.now<lastFired||extractionPhase===2||cuttingActive) return;
    buildBulletTexture();
    const facingLeft = player.getData('facing')==='left';
    const pc = player.body.center;
    const bx = pc.x + (facingLeft ? -24 : 24);
    const by = pc.y - 8;
    // Crear directo desde el grupo para que el overlap lo detecte
    const bullet = bullets.create(bx, by, 'bullet');
    bullet.setFlipX(facingLeft);
    bullet.setDepth(player.y);
    bullet.body.setVelocity(facingLeft ? -580 : 580, 0);
    bullet.body.setAllowGravity(false);
    lastFired = scene.time.now + 280;
    // flash en el cañón
    const flash = scene.add.circle(bx + (facingLeft ? -12 : 12), by, 6, 0xffffff, 0.9);
    flash.setDepth(player.y + 1);
    scene.tweens.add({targets:flash, alpha:0, scaleX:2.5, scaleY:2.5, duration:120, onComplete:()=>flash.destroy()});
    playerShootTilt = 8;
}

function leaveCorpse(enemy) {
    enemies.remove(enemy, false, false);
    if (enemy.body) scene.physics.world.remove(enemy.body);
    enemy.setData('active', false);
    enemy.setData('isCorpse', true);
    enemy.setData('venomHarvested', false);
    // Tinte brillante para contraste — naranja/amarillo sobre el fondo oscuro
    enemy.setTint(0xff8800);
    enemy.setAlpha(1);
    enemy.setAngle(enemy.angle + 90);
    enemy.setDepth(2000); // visible sobre arañas y cráteres
    // Pulso de muerte
    scene.tweens.add({targets:enemy, scaleX: enemy.scaleX*1.3, scaleY: enemy.scaleY*0.6,
        duration:120, yoyo:true, ease:'Power2'});
    // Alerta global: todas las arañas vivas entran en modo ataque
    if (!playerAlerted) {
        playerAlerted = true;
        scene.cameras.main.shake(500, 0.012);
        enemies.getChildren().forEach(e => { if (e.getData('active')) e.setData('alertTinted',false); });
    }
    // criaturas de cráteres: se ocultan y luego salen disparadas (siempre, aunque ya estuviera alertado)
    if (!creaturesLaunched) {
        creaturesLaunched = true;
        scene.time.delayedCall(600, launchCraterCreatures);
    }
}

function destroyEnemy(bullet,enemy) {
    if (!bullet.active || !enemy.active) return;
    bullet.setActive(false); bullet.setVisible(false); bullet.destroy();
    leaveCorpse(enemy);
}

// ──────────────────────────────────────────
// CORTE DE HUEVO
// ──────────────────────────────────────────
// ──────────────────────────────────────────
// MINIJUEGO VENENO
// ──────────────────────────────────────────
function startVenom(corpse) {
    if (venomActive || !gameStarted) return;
    venomActive = true; targetCorpse = corpse; venomProgress = 0;
    corpse.setData('venomHarvested', true); // reservar

    // ── UI: fondo ──
    const cx=400, cy=300;
    const bg   = scene.add.rectangle(cx,cy,500,320,0x020810,0.93).setStrokeStyle(2,0xff8800).setScrollFactor(0).setDepth(20000);
    const title= scene.add.text(cx,165,'>>> EXTRACCIÓN DE VENENO <<<',{fontSize:'13px',fill:'#ff8800',fontFamily:'Courier'}).setOrigin(0.5).setScrollFactor(0).setDepth(20001);
    const instr= scene.add.text(cx,192,'Haz CLICK cuando la aguja esté en la zona verde',{fontSize:'11px',fill:'#aaffaa',fontFamily:'Courier'}).setOrigin(0.5).setScrollFactor(0).setDepth(20001);

    // ── Araña cadáver en perspectiva (representación gráfica) ──
    const spiderDisp = scene.add.sprite(cx, cy+10, 'spider0').setScrollFactor(0).setDepth(20001)
        .setScale(2.2).setTint(0xff8800).setAlpha(0.9);
    // vibrar levemente
    scene.tweens.add({targets:spiderDisp, angle:4, duration:80, yoyo:true, repeat:-1, ease:'Sine'});

    // ── Círculo de aguja ──
    const R = 72; // radio
    const arcBg = scene.add.graphics().setScrollFactor(0).setDepth(20002);
    arcBg.lineStyle(14, 0x1a1a1a, 1); arcBg.strokeCircle(cx, cy+10, R);

    // zona verde aleatoria cada intento
    const zoneG = scene.add.graphics().setScrollFactor(0).setDepth(20002);

    // aguja (línea roja)
    const needleG = scene.add.graphics().setScrollFactor(0).setDepth(20003);

    // barras de progreso (4 círculos huecos que se llenan)
    const dots = [];
    for (let i=0;i<4;i++) {
        const d = scene.add.circle(cx-45+i*30, cy+105, 8, 0x222222).setScrollFactor(0).setDepth(20002).setStrokeStyle(2,0xff8800);
        dots.push(d);
    }
    const cancel = scene.add.text(cx,cy+128,'[ ESPACIO para cancelar ]',{fontSize:'10px',fill:'#ff4444',fontFamily:'Courier'}).setOrigin(0.5).setScrollFactor(0).setDepth(20001);

    venomUIElements = [bg, title, instr, spiderDisp, arcBg, zoneG, needleG, cancel, ...dots];
    venomCircles = dots;
    venomNeedle = needleG;

    // generar primera zona
    newVenomZone(zoneG, cx, cy+10, R);

    // needle angle state
    venomNeedle.setData('angle', 0);
    venomNeedle.setData('speed', 1.8); // grados por frame
    venomNeedle.setData('arcG', zoneG);
    venomNeedle.setData('R', R);
    venomNeedle.setData('cx', cx);
    venomNeedle.setData('cy', cy+10);

    // click / space para extraer
    const clickFn = () => { if (venomActive) attemptVenom(); };
    scene.input.once('pointerdown', clickFn);
    scene.input.keyboard.once('keydown-F', clickFn);
    venomNeedle.setData('clickFn', clickFn);
}

function newVenomZone(g, cx, cy, R) {
    const start = Phaser.Math.Between(10, 300);
    const size  = Phaser.Math.Between(35, 65);
    venomZone = { start, end: start + size };
    g.clear();
    // arco verde
    g.lineStyle(14, 0x00ff66, 0.8);
    g.beginPath();
    g.arc(cx, cy, R, Phaser.Math.DegToRad(start), Phaser.Math.DegToRad(start+size), false);
    g.strokePath();
}

function updateVenom() {
    if (!venomNeedle) return;
    const ang  = venomNeedle.getData('angle') + venomNeedle.getData('speed');
    venomNeedle.setData('angle', ang % 360);
    const R  = venomNeedle.getData('R');
    const cx = venomNeedle.getData('cx');
    const cy = venomNeedle.getData('cy');
    const rad = Phaser.Math.DegToRad(ang);
    venomNeedle.clear();
    // base central
    venomNeedle.fillStyle(0xffffff,1); venomNeedle.fillCircle(cx,cy,4);
    // línea aguja
    venomNeedle.lineStyle(3, 0xff2222, 1);
    venomNeedle.lineBetween(cx, cy, cx + Math.cos(rad)*R, cy + Math.sin(rad)*R);
    // punta
    venomNeedle.fillStyle(0xff2222,1); venomNeedle.fillCircle(cx+Math.cos(rad)*R, cy+Math.sin(rad)*R, 5);
}

function attemptVenom() {
    if (!venomActive) return;
    const ang = venomNeedle.getData('angle') % 360;
    const hit = ang >= venomZone.start && ang <= venomZone.end;
    if (hit) {
        // éxito
        venomProgress++;
        if (venomCircles[venomProgress-1]) venomCircles[venomProgress-1].setFillStyle(0x00ff66);
        scene.cameras.main.flash(150, 0, 80, 0);
        if (venomProgress >= 4) {
            // completado
            completeVenom();
            return;
        }
        // nueva zona, más rápida
        venomNeedle.setData('speed', 1.8 + venomProgress * 0.5);
        newVenomZone(venomNeedle.getData('arcG'), venomNeedle.getData('cx'), venomNeedle.getData('cy'), venomNeedle.getData('R'));
    } else {
        // fallo — flash rojo, resetear progreso
        venomProgress = 0;
        venomCircles.forEach(d => d.setFillStyle(0x222222));
        scene.cameras.main.flash(200, 80, 0, 0);
        venomNeedle.setData('speed', 1.8);
        newVenomZone(venomNeedle.getData('arcG'), venomNeedle.getData('cx'), venomNeedle.getData('cy'), venomNeedle.getData('R'));
    }
    // re-registrar click para siguiente intento
    const clickFn = () => { if (venomActive) attemptVenom(); };
    scene.input.once('pointerdown', clickFn);
    scene.input.keyboard.once('keydown-F', clickFn);
}

function completeVenom() {
    const ex = targetCorpse ? targetCorpse.x : player.x;
    const ey = targetCorpse ? targetCorpse.y - 30 : player.y;
    money += 150;
    moneyText.setText('Dinero: $'+money);
    closeVenomUI();
    // cadáver se desintegra levemente
    if (targetCorpse) scene.tweens.add({targets:targetCorpse, alpha:0.3, scaleX:0.5, scaleY:0.5, duration:500});
    const ft = scene.add.text(ex, ey,'+ $150 VENENO',{fontFamily:'Courier, monospace',fontSize:'18px',fill:'#ff8800',stroke:'#000',strokeThickness:4}).setOrigin(0.5).setDepth(25000);
    scene.tweens.add({targets:ft, y:ey-70, alpha:0, scale:1.3, duration:1200, ease:'Power2', onComplete:()=>ft.destroy()});
}

function closeVenomUI() {
    venomActive = false;
    // limpiar listeners pendientes
    scene.input.removeAllListeners('pointerdown');
    venomUIElements.forEach(e=>{ if(e&&e.destroy) e.destroy(); });
    venomUIElements = []; venomCircles = []; venomNeedle = null; targetCorpse = null;
}

function cancelVenom() {
    if (!venomActive) return;
    if (targetCorpse) targetCorpse.setData('venomHarvested', false); // permitir reintentar
    closeVenomUI();
}

function startCutting(coin) {
    if (cuttingActive||!gameStarted) return;
    cuttingActive=true; targetCoin=coin; cutProgress=0;
    lastMouseX=scene.input.activePointer.x;
    if (!playerAlerted) { playerAlerted=true; scene.cameras.main.shake(800,0.015); }

    const bgBox  =scene.add.rectangle(400,300,450,250,0x05050a,0.95).setStrokeStyle(3,0xff1a40).setScrollFactor(0).setDepth(20000);
    const title  =scene.add.text(400,200,'>>> CORTE DE CÁPSULA TÁCTICA <<<',{fontSize:'14px',fill:'#ff4d79',fontFamily:'Courier'}).setOrigin(0.5).setScrollFactor(0).setDepth(20001);
    const instr  =scene.add.text(400,230,'Desliza el dedo o el mouse de izquierda a derecha',{fontSize:'12px',fill:'#ffffff',fontFamily:'Courier'}).setOrigin(0.5).setScrollFactor(0).setDepth(20001);
    const barBg  =scene.add.rectangle(400,300,300,24,0x222222).setStrokeStyle(1,0xffffff).setScrollFactor(0).setDepth(20000);
    const barFill=scene.add.rectangle(250,300,0,20,0xff1a40).setOrigin(0,0.5).setScrollFactor(0).setDepth(20001);
    const cancel =scene.add.text(400,380,'[ Presiona ESPACIO o muévete para cancelar ]',{fontSize:'11px',fill:'#ffaa00',fontFamily:'Courier'}).setOrigin(0.5).setScrollFactor(0).setDepth(20001);
    cutUIElements=[bgBox,title,instr,barBg,barFill,cancel];
}

function completeCutting() {
    if (!cuttingActive) return;
    let ex=player.x, ey=player.y-30;
    if (targetCoin&&targetCoin.active) {
        ex=targetCoin.x; ey=targetCoin.y;
        const glow=targetCoin.getData('glow');
        if (glow) { scene.tweens.killTweensOf(glow); glow.destroy(); }
        targetCoin.destroy();
    }
    score++; money+=300;
    scoreText.setText('Huevos: '+score+' / 10');
    moneyText.setText('Dinero: $'+money);
    closeCuttingUI();
    const ft=scene.add.text(ex,ey,'+ $300',{fontFamily:'Courier, monospace',fontSize:'22px',fill:'#00ffcc',stroke:'#000000',strokeThickness:4}).setOrigin(0.5).setDepth(25000);
    scene.tweens.add({targets:ft,y:ey-70,alpha:0,scale:1.4,duration:1200,ease:'Power2',onComplete:()=>ft.destroy()});
    if (score>3&&!motherActive) summonMother();
}

function cancelCutting() { closeCuttingUI(); timerText.setText('¡Corte cancelado!'); scene.time.delayedCall(1500,()=>timerText.setText('')); }
function closeCuttingUI() { cuttingActive=false; targetCoin=null; cutUIElements.forEach(e=>e.destroy()); cutUIElements=[]; }

// ──────────────────────────────────────────
// MADRE
// ──────────────────────────────────────────
function summonMother() {
    motherActive=true;
    scene.cameras.main.shake(1400,0.02);
    scene.tweens.add({targets:ambientOverlay,alpha:0.28,duration:1500});
    scene.tweens.add({targets:fogOverlay,alpha:0.35,duration:1500});

    motherGlow=scene.add.image(400,70,'motherGlow').setScrollFactor(0).setDepth(2999).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35);
    scene.tweens.add({targets:motherGlow,alpha:1,duration:700,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});

    mother=scene.add.image(400,-320,'mother0').setScrollFactor(0).setDepth(3000).setRotation(Math.PI).setScale(1.6);
    scene.tweens.add({targets:mother,y:10,duration:1800,ease:'Power2'});
    scene.tweens.add({targets:mother,x:430,duration:2200,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});

    motherAnimEvent=scene.time.addEvent({delay:380,loop:true,callback:()=>{
        motherFrame=1-motherFrame;
        if (mother&&mother.active) mother.setTexture('mother'+motherFrame);
    }});

    const banner=scene.add.text(400,250,'¡LA MADRE DE LAS ARAÑAS\nESTÁ FURIOSA!',{fontFamily:'Courier, monospace',fontSize:'26px',fill:'#ff2244',align:'center',stroke:'#12030a',strokeThickness:5})
        .setOrigin(0.5).setScrollFactor(0).setDepth(16000).setAlpha(0).setScale(0.6);
    scene.tweens.add({targets:banner,alpha:1,scale:1,duration:350,ease:'Back.easeOut',
        onComplete:()=>scene.tweens.add({targets:banner,alpha:0,delay:2200,duration:600,onComplete:()=>banner.destroy()})});
    scheduleMotherWave(1800);
}

function scheduleMotherWave(firstDelay) {
    if (!motherActive) return;
    const delay=firstDelay||Math.max(1800,3800-(score-4)*400);
    motherWaveTimer=scene.time.delayedCall(delay,()=>{
        motherWaveTimer=null;
        if (!motherActive||lives<=0) return;
        if (!isPaused&&extractionPhase!==2) { spawnBabies(Phaser.Math.Between(2,3)); spawnFromCraters(Phaser.Math.Between(1,2)); }
        scheduleMotherWave();
    });
}

function spawnBabies(n) {
    if (!motherActive||!mother||!mother.active) return;
    scene.tweens.add({targets:mother,scale:1.75,duration:160,yoyo:true});
    scene.cameras.main.shake(250,0.006);
    const v=scene.cameras.main.worldView;
    for (let i=0;i<n;i++) {
        if (enemies.countActive(true)>=MAX_ENEMIES) break;
        const bx=Phaser.Math.Clamp(Phaser.Math.Between(v.left+60,v.right-60),20,WORLD_W-20);
        const baby=spawnEnemy(bx,v.top-40-i*30,0.6);
        baby.setData('baby',true); baby.setData('active',true);
    }
}

function spawnFromCraters(n) {
    if (!motherActive||craters.length===0) return;
    for (let i=0;i<n;i++) {
        if (enemies.countActive(true)>=MAX_ENEMIES) break;
        const c=Phaser.Utils.Array.GetRandom(craters);
        const sp=spawnEnemy(c.x,c.y,0.85); sp.setData('active',true); sp.setAlpha(0);
        scene.tweens.add({targets:sp,alpha:1,scale:depthScaleFor(c.y),duration:400,ease:'Power2'});
    }
}

function stopMother() {
    motherActive=false;
    if (motherWaveTimer) { motherWaveTimer.remove(false); motherWaveTimer=null; }
    if (motherAnimEvent) { motherAnimEvent.remove(false); motherAnimEvent=null; }
}

// ──────────────────────────────────────────
// COMMS
// ──────────────────────────────────────────
function clearComms() {
    if (commsTyper) { commsTyper.remove(false); commsTyper=null; }
    if (commsHold)  { commsHold.remove(false);  commsHold=null;  }
    if (commsElements.length) { scene.tweens.killTweensOf(commsElements); commsElements.forEach(e=>e.destroy()); commsElements=[]; }
}

function showComms(message, good) {
    clearComms();
    const color=good?0x00ffff:0xff0055, css=good?'#00ffff':'#ff4d79';
    const px=20,py=500,pw=580,ph=82,font='Courier, monospace';
    const bg   =scene.add.rectangle(px+pw/2,py+ph/2,pw,ph,0x05050a,0.93).setStrokeStyle(2,color).setScrollFactor(0).setDepth(15000);
    const face =scene.add.text(px+14,py+16,good?FACE_HAPPY:FACE_DEADPAN,{fontFamily:font,fontSize:'16px',fill:css}).setScrollFactor(0).setDepth(15001);
    const hdr  =scene.add.text(px+104,py+8,'> CENTRAL // TRANSMISIÓN ENTRANTE',{fontFamily:font,fontSize:'11px',fill:css}).setScrollFactor(0).setDepth(15001);
    const body =scene.add.text(px+104,py+28,'',{fontFamily:font,fontSize:'14px',fill:'#ffffff',wordWrap:{width:pw-124}}).setScrollFactor(0).setDepth(15001);
    commsElements=[bg,face,hdr,body];
    let shown=0;
    commsTyper=scene.time.addEvent({delay:28,repeat:message.length-1,callback:()=>{ shown++; if(body.active) body.setText(message.substring(0,shown)); }});
    commsHold=scene.time.delayedCall(message.length*28+2800,()=>{ commsHold=null; scene.tweens.add({targets:commsElements,alpha:0,duration:400,onComplete:clearComms}); });
}

// ──────────────────────────────────────────
// EXTRACCIÓN
// ──────────────────────────────────────────
function triggerExtraction() {
    if (extracting||!gameStarted||isPaused||cuttingActive) return;
    extracting=true; extractionPhase=0; window.extractingStartTime=scene.time.now;
    if (!playerAlerted) { playerAlerted=true; scene.cameras.main.shake(600,0.01); }

    const pc = player.body ? player.body.center : {x:player.x, y:player.y};
    if (score>0) {
        extractionCountdownTimer=7000; corporateHelpActive=true;
        showComms('¡Tienes '+score+(score===1?' huevo':' huevos')+' acumulando $'+money+'! Vamos en seguida.',true);
        extractionPoint.x=pc.x+Phaser.Math.Between(-150,150);
        extractionPoint.y=pc.y+Phaser.Math.Between(-100,100);
    } else {
        extractionCountdownTimer=3000; corporateHelpActive=false;
        showComms('¿En serio no te llevarás nada? Cero dólares para ti. Resuélvelo.',false);
        const v=scene.cameras.main.worldView;
        extractionPoint.x=pc.x<v.centerX?v.right-80:v.left+80;
        extractionPoint.y=pc.y<v.centerY?v.bottom-80:v.top+80;
    }
    extractionPoint.x=Phaser.Math.Clamp(extractionPoint.x,100,WORLD_W-100);
    extractionPoint.y=Phaser.Math.Clamp(extractionPoint.y,100,WORLD_H-100);

    extractionZone=scene.add.text(extractionPoint.x,extractionPoint.y,'[ X ]',{fontFamily:'Courier, monospace',fontSize:'18px',fill:score>0?'#00ffff':'#ff0055'}).setOrigin(0.5);
    scene.tweens.add({targets:extractionZone,alpha:0.2,duration:400,yoyo:true,repeat:-1});

    scene.time.delayedCall(extractionTotalTimer,()=>{
        if (lives>0&&extracting) {
            extractionPhase=1;
            if (extractionZone) extractionZone.destroy();
            // Nave: origin(0.5,0.5), 130px alto → base en shipFinalY+65
            const shipFinalY = extractionPoint.y - 100;
            extractionShip=buildShipGraphic(scene, extractionPoint.x, extractionPoint.y-360);
            // Rayo: sale de la base de la nave hasta el suelo
            const beamTop = extractionPoint.y - 360 + 65;
            const beamH = extractionPoint.y - beamTop + 20;
            extractionBeam=scene.add.rectangle(extractionPoint.x, beamTop, 50, beamH, 0x00ffff, 0.3).setOrigin(0.5,0).setDepth(3499);
            scene.tweens.add({targets:[extractionShip,extractionBeam],y:'+=260',duration:1500,ease:'Power2',onComplete:()=>scene.cameras.main.shake(300,0.008)});

            scene.time.delayedCall(extractionCountdownTimer,()=>{
                if (lives>0&&extracting&&extractionPhase===1) {
                    const pc = player.body ? player.body.center : {x:player.x, y:player.y};
                    if (Phaser.Math.Distance.Between(pc.x, pc.y, extractionPoint.x, extractionPoint.y) < 120) {
                        extractionPhase=2; corporateHelpActive=false; player.body.setVelocity(0,0);
                        // Mover hacia la nave: primero X, luego subir dentro del casco
                        const boardY = shipFinalY + 28; // interior inferior de la nave
                        scene.tweens.add({
                            targets:player, x:extractionPoint.x, duration:400, ease:'Power2',
                            onComplete:()=>{
                                scene.tweens.add({
                                    targets:player, y:boardY, duration:900, ease:'Power2',
                                    onComplete:()=>{
                                        player.setAlpha(0);
                                        scene.time.delayedCall(300, triggeredVictory);
                                    }
                                });
                            }
                        });
                    } else {
                        showComms('Abandono de personal detectado. Adiós.',false);
                        extracting=false; corporateHelpActive=false;
                        if (extractionShip) extractionShip.destroy();
                        if (extractionBeam) extractionBeam.destroy();
                    }
                }
            });
        }
    });
}

// ──────────────────────────────────────────
// VICTORIA / DERROTA
// ──────────────────────────────────────────
function triggeredVictory() {
    clearComms(); stopMother(); scene.physics.pause();
    scene.add.rectangle(400,300,800,600,0x000000,0.85).setScrollFactor(0).setDepth(10000);
    scene.add.text(400,210,'MISIÓN', {fontFamily:'Courier, monospace',fontSize:'64px',fill:'#00ff41',stroke:'#003310',strokeThickness:6,align:'center'})
        .setOrigin(0.5).setScrollFactor(0).setDepth(10001);
    scene.add.text(400,285,'CUMPLIDA', {fontFamily:'Courier, monospace',fontSize:'54px',fill:'#00ff41',stroke:'#003310',strokeThickness:6,align:'center'})
        .setOrigin(0.5).setScrollFactor(0).setDepth(10001);
    scene.add.text(400,350,'Huevos extraídos: '+score+' / 10',{fontFamily:'Courier, monospace',fontSize:'16px',fill:'#ffffff'}).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
    scene.add.text(400,382,'Dinero total: $'+money+' / $3000',{fontFamily:'Courier, monospace',fontSize:'18px',fill:'#00ffcc'}).setOrigin(0.5).setScrollFactor(0).setDepth(10001);
    const btn=scene.add.text(400,430,'PRESIONA ESPACIO PARA VOLVER A JUGAR',{fontFamily:'Courier, monospace',fontSize:'14px',fill:'#00ff41',backgroundColor:'#222',padding:{x:10,y:5}}).setOrigin(0.5).setScrollFactor(0).setDepth(10001).setInteractive();
    btn.on('pointerdown',()=>{ scene.scene.restart(); });
    scene.input.keyboard.removeAllListeners('keydown-SPACE');
    scene.input.keyboard.once('keydown-SPACE',()=>{ scene.scene.restart(); });
}

function endGame() {
    clearComms(); stopMother(); scene.physics.pause();
    scene.add.rectangle(400,300,800,600,0x000000,0.85).setScrollFactor(0).setDepth(10000);
    scene.add.text(400,230,'MISIÓN', {fontFamily:'Courier, monospace',fontSize:'64px',fill:'#ff0055',stroke:'#500010',strokeThickness:6,align:'center'})
        .setOrigin(0.5).setScrollFactor(0).setDepth(10001);
    scene.add.text(400,305,'FALLIDA', {fontFamily:'Courier, monospace',fontSize:'64px',fill:'#ff0055',stroke:'#500010',strokeThickness:6,align:'center'})
        .setOrigin(0.5).setScrollFactor(0).setDepth(10001);
    const btn=scene.add.text(400,350,'PRESIONA ESPACIO PARA REINTENTAR',{fontFamily:'Courier, monospace',fontSize:'18px',fill:'#ffffff',backgroundColor:'#222',padding:{x:10,y:5}}).setOrigin(0.5).setScrollFactor(0).setDepth(10001).setInteractive();
    btn.on('pointerdown',()=>{ scene.scene.restart(); });
    scene.input.keyboard.removeAllListeners('keydown-SPACE');
    scene.input.keyboard.once('keydown-SPACE',()=>{ scene.scene.restart(); });
}

// ──────────────────────────────────────────
// PAUSA
// ──────────────────────────────────────────
let _pauseGuard = false;
function togglePauseGame() {
    if (_pauseGuard) return;
    if (!scene || !scene.physics || !scene.physics.world) return;
    _pauseGuard = true;
    scene.time.delayedCall(50, () => { _pauseGuard = false; });
    isPaused=!isPaused;
    if (isPaused) {
        try { scene.physics.pause(); } catch(e) {}
        try { scene.tweens.pauseAll(); } catch(e) {}
        [introTween1,introTween2,introTween3].forEach(t=>{ try{t&&t.pause();}catch(e){} });
        // Fondo negro semitransparente — se ve el estado del juego detrás
        const bg=scene.add.rectangle(400,300,800,600,0x000000,0.60).setScrollFactor(0).setDepth(10000);
        // Línea decorativa superior
        const lineT=scene.add.rectangle(400,185,340,2,0x00ff41,1).setScrollFactor(0).setDepth(10001);
        // Título
        const title=scene.add.text(400,220,'PAUSA',
            {fontFamily:'Courier, monospace',fontSize:'68px',fill:'#00ff41',
             stroke:'#001a08',strokeThickness:8,shadow:{offsetX:0,offsetY:0,color:'#00ff41',blur:18,fill:true}})
            .setOrigin(0.5).setScrollFactor(0).setDepth(10001);
        // HUD actual visible (salud, dinero, huevos)
        const info=scene.add.text(400,305,
            'Huevos: '+score+' / 10    Dinero: $'+money+'    Salud: '+lives,
            {fontFamily:'Courier, monospace',fontSize:'14px',fill:'#aaffcc'})
            .setOrigin(0.5).setScrollFactor(0).setDepth(10001);
        // Instrucción
        const sub=scene.add.text(400,355,'Pulsa ESPACIO o haz click para continuar',
            {fontFamily:'Courier, monospace',fontSize:'15px',fill:'#ffffff',alpha:0.9})
            .setOrigin(0.5).setScrollFactor(0).setDepth(10001);
        // parpadeo en el sub
        scene.tweens.add({targets:sub,alpha:0.3,duration:600,yoyo:true,repeat:-1});
        // Línea decorativa inferior
        const lineB=scene.add.rectangle(400,385,340,2,0x00ff41,1).setScrollFactor(0).setDepth(10001);
        // click para reanudar
        bg.setInteractive().on('pointerdown', togglePauseGame);
        pauseElements.push(bg,lineT,title,info,sub,lineB);
    } else {
        try { scene.physics.resume(); } catch(e) {}
        try { scene.tweens.resumeAll(); } catch(e) {}
        [introTween1,introTween2,introTween3].forEach(t=>{ try{t&&t.resume();}catch(e){} });
        pauseElements.forEach(e=>{ scene.tweens.killTweensOf(e); e.destroy(); });
        pauseElements=[];
    }
}

// ──────────────────────────────────────────
// CONTROLES TÁCTILES
// ──────────────────────────────────────────
function crearControlesTactiles() {
    const D=10000;
    joystickBase =scene.add.circle(120,480,60,0xffffff,0.15).setScrollFactor(0).setDepth(D).setInteractive();
    joystickThumb=scene.add.circle(120,480,30,0xffffff,0.4 ).setScrollFactor(0).setDepth(D);
    joystickBase.on('pointerdown',()=>joystickActive=true);
    scene.input.on('pointermove',(p)=>{
        if (!joystickActive||!p.isDown||!joystickBase) return;
        let dx=p.x-joystickBase.x, dy=p.y-joystickBase.y, dist=Math.hypot(dx,dy), max=60;
        if (dist>max) { dx=(dx/dist)*max; dy=(dy/dist)*max; }
        joystickThumb.setPosition(joystickBase.x+dx,joystickBase.y+dy);
        joystickVector={x:dx/max,y:dy/max};
    });
    scene.input.on('pointerup',()=>{ joystickActive=false; if(joystickThumb&&joystickBase)joystickThumb.setPosition(joystickBase.x,joystickBase.y); joystickVector={x:0,y:0}; });

    const btnS=scene.add.circle(720,500,45,0xff1a40,0.4).setScrollFactor(0).setDepth(D).setStrokeStyle(2,0xff1a40).setInteractive();
    scene.add.text(720,500,'F',{fontSize:'24px',fill:'#fff',fontFamily:'Courier'}).setOrigin(0.5).setScrollFactor(0).setDepth(D+1);
    btnS.on('pointerdown',shootBullet);

    const btnE=scene.add.circle(720,380,35,0x00ffff,0.4).setScrollFactor(0).setDepth(D).setStrokeStyle(2,0x00ffff).setInteractive();
    scene.add.text(720,380,'E',{fontSize:'20px',fill:'#fff',fontFamily:'Courier'}).setOrigin(0.5).setScrollFactor(0).setDepth(D+1);
    btnE.on('pointerdown',triggerExtraction);

    scene.add.text(400,30,'||',{fontSize:'24px',fill:'#fff',fontFamily:'Courier',backgroundColor:'#333',padding:{x:15,y:5}})
        .setOrigin(0.5).setScrollFactor(0).setDepth(D).setInteractive()
        .on('pointerdown',togglePauseGame);
}

// ──────────────────────────────────────────
// MINIMAPA  (zoom con rueda del mouse)
// ──────────────────────────────────────────
// mmZoom: 1 = todo el mundo; >1 = acercado al jugador
let mmZoom = 1, mmZoomMin = 1, mmZoomMax = 4;

function createMinimap() {
    scene.minimapGfx = scene.add.graphics().setScrollFactor(0).setDepth(5000);
    scene.add.text(618,436,'RADAR PLANETARIO',{fontSize:'9px',fill:'#ff4d79',fontFamily:'Courier'}).setScrollFactor(0).setDepth(5001);
    // hint zoom
    scene.add.text(618,424,'scroll: zoom',{fontSize:'7px',fill:'#7a3050',fontFamily:'Courier'}).setScrollFactor(0).setDepth(5001);

    // zona interactiva para capturar la rueda
    const hitArea = scene.add.rectangle(700,505,180,150,0x000000,0).setScrollFactor(0).setDepth(5002).setInteractive();
    hitArea.on('wheel', (_p, _dx, _dy, deltaY) => {
        mmZoom = Phaser.Math.Clamp(mmZoom - deltaY * 0.003, mmZoomMin, mmZoomMax);
    });
}

function drawMinimap() {
    const g = scene.minimapGfx; if (!g) return;
    const mapX=610, mapY=430, mapW=180, mapH=150;
    const inX=mapX+2, inY=mapY+22, inW=mapW-4, inH=mapH-29;
    const now = scene.time.now;

    // centro del mapa en el jugador cuando hay zoom
    const pc = (player && player.body) ? player.body.center : {x:landingX, y:landingY};
    const viewW = WORLD_W / mmZoom;
    const viewH = WORLD_H / mmZoom;
    const originX = Phaser.Math.Clamp(pc.x - viewW/2, 0, WORLD_W - viewW);
    const originY = Phaser.Math.Clamp(pc.y - viewH/2, 0, WORLD_H - viewH);

    // proyecta coordenada mundo → pixel del mapa
    const mx = x => inX + Phaser.Math.Clamp((x - originX) / viewW, 0, 1) * inW;
    const my = y => inY + Phaser.Math.Clamp((y - originY) / viewH, 0, 1) * inH;

    g.clear();

    // fondo
    g.fillStyle(0x1a0508, 0.9); g.fillRect(mapX, mapY, mapW, mapH);
    g.lineStyle(2, 0xff4d79, 1); g.strokeRect(mapX, mapY, mapW, mapH);
    g.lineStyle(1, 0x4a1525, 1); g.strokeRect(inX, inY, inW, inH);

    // línea de barrido
    const sw = inX + ((now/25) % inW);
    g.lineStyle(1, 0xff4d79, 0.25); g.lineBetween(sw, inY, sw, inY+inH);

    // rectángulo de vista de cámara
    const v = scene.cameras.main.worldView;
    const vx = mx(v.x), vy = my(v.y);
    const vw = (v.width  / viewW) * inW;
    const vh = (v.height / viewH) * inH;
    g.lineStyle(1, 0xffffff, 0.35); g.strokeRect(vx, vy, vw, vh);

    // huevos
    g.fillStyle(0xff1a40, 1);
    coins.getChildren().forEach(c => { if (c.active) g.fillRect(mx(c.x)-1, my(c.y)-1, 3, 3); });

    // zona de extracción
    if (extracting && extractionZone) {
        const blink = Math.floor(now/300) % 2 === 0;
        g.fillStyle(score>0 ? 0x00ffff : 0xff0055, blink ? 1 : 0.4);
        g.fillRect(mx(extractionPoint.x)-2, my(extractionPoint.y)-2, 5, 5);
    }

    // enemigos
    g.fillStyle(playerAlerted ? 0xff0000 : 0xffaa00, 1);
    enemies.getChildren().forEach(e => { if (e.active) g.fillRect(mx(e.x)-1, my(e.y)-1, 3, 3); });

    // jugador
    const pulse = 3 + 2*Math.sin(now/200);
    if (player && player.alpha > 0) {
        g.fillStyle(0x00ff41, 1); g.fillRect(mx(pc.x)-2, my(pc.y)-2, 4, 4);
        g.lineStyle(1, 0x00ff41, 0.6); g.strokeCircle(mx(pc.x), my(pc.y), pulse+2);
    } else {
        g.lineStyle(1, 0x00ffff, 0.8); g.strokeCircle(mx(landingX), my(landingY), pulse+2);
        g.fillStyle(0x00ffff, 1); g.fillRect(mx(landingX)-1, my(landingY)-1, 3, 3);
    }

    // indicador de zoom
    if (mmZoom > 1.05) {
        g.fillStyle(0xff4d79, 0.7);
        g.fillRect(mapX+4, mapY+mapH-6, Math.round((mmZoom-1)/(mmZoomMax-1)*(mapW-8)), 3);
    }
}