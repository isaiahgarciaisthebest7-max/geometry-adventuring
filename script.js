const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const SETTINGS = {
    G: 0.82,       // Gravity
    JUMP: -12.5,   // Jump force
    SPEED: 9.2,    // Horizontal speed
    GROUND: 540,   // Floor level
    TICK: 1/60     // Fixed physics rate
};

let state = {
    active: false,
    cameraX: 0,
    attempts: 1,
    objects: [],
    levelLen: 0,
    bg: '#0066ff',
    accumulator: 0,
    lastTime: 0,
    levelIdx: 0
};

let player = {
    x: 400, y: 0, w: 38, h: 38,
    dy: 0, rot: 0, mode: 'CUBE', 
    onGround: false, dead: false, gravDir: 1
};

let input = { hold: false };

// --- INPUT HANDLERS ---
window.onkeydown = (e) => { 
    if(e.code === 'Space' || e.code === 'ArrowUp') input.hold = true; 
    if(e.code === 'Escape') toggleMenu();
};
window.onkeyup = (e) => { if(e.code === 'Space' || e.code === 'ArrowUp') input.hold = false; };
canvas.onmousedown = () => input.hold = true;
canvas.onmouseup = () => input.hold = false;

function toggleMenu() {
    state.active = false;
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
}

// --- LEVEL PROFILES ---
const levels = [
    { name: "Stereo Madness", bg: "#0066ff", len: 1.0 },
    { name: "Back on Track", bg: "#00ccff", len: 1.2 },
    { name: "Polargeist", bg: "#a020f0", len: 1.4 },
    { name: "Dry Out", bg: "#ff8c00", len: 1.6 },
    { name: "Cycles", bg: "#00008B", len: 2.0 },
    { name: "Blast Processing", bg: "#222", len: 2.5 }
];

function buildLevel(idx) {
    state.objects = [];
    let x = 1200;
    const add = (t, ox, oy, ow=40, oh=40, m=null) => state.objects.push({t, x:ox, y:oy, w:ow, h:oh, m});
    
    state.bg = levels[idx].bg;
    const limit = SETTINGS.SPEED * 60 * 60 * levels[idx].len;

    while (x < limit) {
        // Portal logic: Ensure portals are tall (unmissable)
        if(x > 5000 && x % 7000 < 500) {
            const modes = ['SHIP', 'BALL', 'WAVE', 'ROBOT', 'UFO'];
            add('portal', x, 0, 150, SETTINGS.GROUND, modes[Math.floor(Math.random()*modes.length)]);
            x += 1000;
        }

        // Object patterns
        if(player.mode === 'WAVE') {
            let gap = 170 + Math.sin(x/400)*90;
            add('block', x, 0, 80, gap);
            add('block', x, gap+170, 80, 400);
            x += 80;
        } else if(player.mode === 'BALL') {
            add('block', x, SETTINGS.GROUND-150, 100, 40); 
            if(x % 800 === 0) add('spike', x+40, SETTINGS.GROUND-40);
            x += 400;
        } else {
            add('block', x, SETTINGS.GROUND-40, 80, 40);
            if(Math.random() > 0.45) add('spike', x+140, SETTINGS.GROUND-40);
            x += 450;
        }
    }
    state.levelLen = x + 2000;
}

// --- PHYSICS & COLLISION ---
function updatePhysics() {
    if(!state.active || player.dead) return;
    state.cameraX += SETTINGS.SPEED;
    
    // Gamemode Logic
    switch(player.mode) {
        case 'CUBE':
            player.dy += SETTINGS.G;
            if(player.onGround && input.hold) { player.dy = SETTINGS.JUMP; player.onGround = false; }
            if(!player.onGround) player.rot += 6; else player.rot = Math.round(player.rot/90)*90;
            break;
        case 'SHIP':
            player.dy += input.hold ? -0.52 : 0.42; player.rot = player.dy * 2.5;
            break;
        case 'BALL':
            player.dy += 0.85 * player.gravDir;
            if(player.onGround && input.hold) { player.gravDir *= -1; player.onGround = false; input.hold = false; }
            player.rot += 5 * player.gravDir;
            break;
        case 'WAVE':
            player.dy = input.hold ? -9.5 : 9.5; player.rot = (player.dy > 0) ? 25 : -25;
            break;
        case 'ROBOT':
            player.dy += SETTINGS.G;
            if(player.onGround && input.hold) { player.dy = -15; player.onGround = false; }
            break;
        case 'UFO':
            player.dy += SETTINGS.G;
            if(input.hold) { player.dy = -10; input.hold = false; }
            break;
    }

    player.y += player.dy;

    // Floor/Ceiling Snapping
    if(player.y + player.h >= SETTINGS.GROUND) { 
        player.y = SETTINGS.GROUND - player.h; player.dy = 0; player.onGround = true; 
    } else if(player.y <= 0) { 
        player.y = 0; player.dy = 0; 
        if(player.mode !== 'BALL') crash(); else player.onGround = true; 
    } else { player.onGround = false; }

    // Object Collision Resolution
    const pR = { 
        l: state.cameraX + player.x + 10, 
        r: state.cameraX + player.x + player.w - 10, 
        t: player.y + 10, 
        b: player.y + player.h - 10 
    };

    for(let o of state.objects) {
        if(o.x > pR.r + 200) break;
        if(pR.r > o.x && pR.l < o.x+o.w && pR.b > o.y && pR.t < o.y+o.h) {
            if(o.t === 'spike') crash();
            if(o.t === 'block') {
                // Determine if landing on top or hitting a wall
                if(player.y - player.dy + player.h <= o.y + 12) {
                    player.y = o.y - player.h; player.dy = 0; player.onGround = true;
                } else if (player.y - player.dy >= o.y + o.h - 12) {
                    player.y = o.y + o.h; player.dy = 0; player.onGround = true;
                } else crash();
            }
            if(o.t === 'portal') { player.mode = o.m; document.getElementById('mode-display').innerText = player.mode; }
        }
    }
}

function crash() {
    player.dead = true;
    document.getElementById('flash').style.opacity = 0.8;
    setTimeout(() => {
        document.getElementById('flash').style.opacity = 0;
        resetPlayer(false);
    }, 450);
}

function resetPlayer(full) {
    player.y = SETTINGS.GROUND - player.h; player.dy = 0; player.rot = 0;
    player.mode = (state.levelIdx === 5) ? 'WAVE' : 'CUBE';
    player.dead = false; state.cameraX = 0; player.gravDir = 1;
    if(!full) state.attempts++;
    document.getElementById('mode-display').innerText = player.mode;
    const att = document.getElementById('attempt-text');
    att.innerText = "ATTEMPT " + state.attempts; att.style.opacity = 1;
    setTimeout(() => att.style.opacity = 0, 1500);
}

function startLevel(idx) {
    state.levelIdx = idx; state.active = true; state.attempts = 1;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    buildLevel(idx); resetPlayer(true);
    state.lastTime = performance.now(); requestAnimationFrame(gameLoop);
}

function draw() {
    ctx.fillStyle = state.bg; ctx.fillRect(0,0,1280,640);
    ctx.fillStyle = "#000"; ctx.fillRect(0, SETTINGS.GROUND, 1280, 100);
    ctx.strokeStyle = "white"; ctx.strokeRect(-1, SETTINGS.GROUND, 1282, 1);
    
    ctx.save(); ctx.translate(-state.cameraX, 0);
    for(let o of state.objects) {
        if(o.x < state.cameraX - 100 || o.x > state.cameraX + 1300) continue;
        if(o.t === 'block') {
            ctx.fillStyle = "#000"; ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.strokeStyle = "#fff"; ctx.strokeRect(o.x, o.y, o.w, o.h);
        } else if(o.t === 'spike') {
            ctx.fillStyle = "#fff"; ctx.beginPath();
            ctx.moveTo(o.x, o.y+o.h); ctx.lineTo(o.x+o.w/2, o.y); ctx.lineTo(o.x+o.w, o.y+o.h); ctx.fill();
        } else if(o.t === 'portal') {
            ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fillRect(o.x, 0, o.w, SETTINGS.GROUND);
        }
    }
    
    if(!player.dead) {
        ctx.save();
        ctx.translate(state.cameraX + player.x + 19, player.y + 19);
        ctx.rotate(player.rot * Math.PI / 180);
        
        // Mode Rendering
        if(player.mode === 'CUBE' || player.mode === 'ROBOT') {
            ctx.fillStyle = "#0ff"; ctx.fillRect(-19,-19,38,38); ctx.strokeRect(-19,-19,38,38);
        } else if(player.mode === 'SHIP') {
            ctx.fillStyle = "#0ff"; ctx.beginPath(); ctx.moveTo(-20, 10); ctx.lineTo(20, 10); ctx.lineTo(0, -15); ctx.fill(); ctx.stroke();
        } else if(player.mode === 'WAVE') {
            ctx.fillStyle = "#0ff"; ctx.beginPath(); ctx.moveTo(-20, 10); ctx.lineTo(20, 0); ctx.lineTo(-20, -10); ctx.fill(); ctx.stroke();
        } else if(player.mode === 'BALL') {
            ctx.fillStyle = "#0ff"; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
    }
    ctx.restore();

    let pct = Math.min(100, Math.floor((state.cameraX / state.levelLen) * 100));
    document.getElementById('progress-fill').style.width = pct + "%";
    document.getElementById('percent-text').innerText = pct + "%";
}

function gameLoop(time) {
    if(!state.active) return;
    state.accumulator += (time - state.lastTime) / 1000;
    state.lastTime = time;
    while(state.accumulator >= SETTINGS.TICK) {
        updatePhysics();
        state.accumulator -= SETTINGS.TICK;
    }
    draw();
    requestAnimationFrame(gameLoop);
}

// Level Grid Generation
const grid = document.getElementById('level-list');
levels.forEach((l, i) => {
    grid.innerHTML += `<div class="lvl-card" onclick="startLevel(${i})"><b>${l.name}</b><br><small>${l.diff}</small></div>`;
});
