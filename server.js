// MOBA游戏服务器
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 创建HTTP服务器，支持CORS
const server = http.createServer((req, res) => {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // 处理WebSocket升级请求的特殊情况
    if (req.headers.upgrade === 'websocket') {
        // 让WebSocket服务器处理
        return;
    }
    
    // 处理静态文件请求
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };
    
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 创建WebSocket服务器，监听所有网络接口
const wss = new WebSocket.Server({
    server,
    // 不设置路径，让服务器处理所有WebSocket升级请求
});

// 游戏状态
const gameState = {
    players: new Map(),
    matches: new Map(),
    waitingPlayers: []
};

// 地图配置
const mapConfig = {
    width: 800,
    height: 600
};

// 障碍物配置
const obstacles = [
    { x: 200, y: 150, width: 100, height: 20 },
    { x: 500, y: 150, width: 100, height: 20 },
    { x: 350, y: 250, width: 20, height: 100 },
    { x: 200, y: 450, width: 100, height: 20 },
    { x: 500, y: 450, width: 100, height: 20 },
    { x: 100, y: 300, width: 20, height: 100 },
    { x: 680, y: 300, width: 20, height: 100 },
    { x: 350, y: 350, width: 100, height: 20 }
];

// 生成唯一ID
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// 生成随机颜色
function generateColor() {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#a29bfe', '#fd79a8'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// 检查两个矩形是否碰撞
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// 检查位置是否有效（不与障碍物碰撞且在地图边界内）
function isValidPosition(x, y, playerSize = 20) {
    // 检查地图边界
    if (x < playerSize/2 || x > mapConfig.width - playerSize/2 || 
        y < playerSize/2 || y > mapConfig.height - playerSize/2) {
        return false;
    }
    
    // 检查与障碍物的碰撞
    const playerRect = {
        x: x - playerSize/2,
        y: y - playerSize/2,
        width: playerSize,
        height: playerSize
    };
    
    for (const obstacle of obstacles) {
        if (checkCollision(playerRect, obstacle)) {
            return false;
        }
    }
    
    return true;
}

// 广播消息给所有客户端
function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// 发送消息给特定客户端
function sendToClient(client, message) {
    if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
    }
}

// 处理玩家连接
wss.on('connection', (ws) => {
    console.log('新的客户端连接');
    
    // 为新玩家分配ID
    const playerId = generateId();
    ws.playerId = playerId;
    
    // 发送玩家ID
    sendToClient(ws, {
        type: 'playerId',
        payload: { id: playerId }
    });
    
    // 创建新玩家
    let x, y;
    // 尝试找到一个不与障碍物碰撞的初始位置
    do {
        x = Math.floor(Math.random() * (mapConfig.width - 100)) + 50;
        y = Math.floor(Math.random() * (mapConfig.height - 100)) + 50;
    } while (!isValidPosition(x, y));
    
    const player = {
        id: playerId,
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        color: generateColor(),
        ws: ws
    };
    
    // 添加到游戏状态
    gameState.players.set(playerId, player);
    
    // 发送当前游戏状态
    sendToClient(ws, {
        type: 'gameState',
        payload: { state: 'waiting' }
    });
    
    // 发送所有玩家信息
    const players = Array.from(gameState.players.values()).map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        color: p.color
    }));
    
    sendToClient(ws, {
        type: 'players',
        payload: { players }
    });
    
    // 通知其他玩家有新玩家加入
    wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'playerJoined',
                payload: {
                    id: player.id,
                    x: player.x,
                    y: player.y,
                    color: player.color
                }
            }));
        }
    });
    
    // 处理消息
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (error) {
            console.error('解析消息失败:', error);
        }
    });
    
    // 处理断开连接
    ws.on('close', () => {
        console.log(`客户端断开连接: ${playerId}`);
        
        // 从游戏状态中移除玩家
        gameState.players.delete(playerId);
        
        // 从等待队列中移除
        const waitingIndex = gameState.waitingPlayers.indexOf(playerId);
        if (waitingIndex !== -1) {
            gameState.waitingPlayers.splice(waitingIndex, 1);
        }
        
        // 通知其他玩家
        broadcast({
            type: 'playerLeft',
            payload: { id: playerId }
        });
    });
});

// 添加WebSocket服务器错误处理
wss.on('error', (error) => {
    console.error('WebSocket服务器错误:', error);
});

// 处理客户端消息
function handleMessage(ws, data) {
    const { type, payload } = data;
    const playerId = ws.playerId;
    const player = gameState.players.get(playerId);
    
    if (!player) return;
    
    switch (type) {
        case 'requestMatch':
            // 添加到等待队列
            if (!gameState.waitingPlayers.includes(playerId)) {
                gameState.waitingPlayers.push(playerId);
                console.log(`玩家 ${playerId} 请求匹配`);
                
                // 检查是否有足够的玩家开始游戏
                if (gameState.waitingPlayers.length >= 2) {
                    startGame();
                } else {
                    sendToClient(ws, {
                        type: 'gameState',
                        payload: { state: 'waiting' }
                    });
                    
                    sendToClient(ws, {
                        type: 'message',
                        payload: { message: '正在寻找对手...' }
                    });
                }
            }
            break;
            
        case 'cancelMatch':
            // 从等待队列中移除
            const index = gameState.waitingPlayers.indexOf(playerId);
            if (index !== -1) {
                gameState.waitingPlayers.splice(index, 1);
                console.log(`玩家 ${playerId} 取消匹配`);
                
                sendToClient(ws, {
                    type: 'message',
                    payload: { message: '已取消匹配' }
                });
            }
            break;
            
        case 'playerMove':
            // 检查新位置是否有效
            if (isValidPosition(payload.x, payload.y)) {
                // 更新玩家位置
                player.x = payload.x;
                player.y = payload.y;
                player.vx = payload.vx || 0;
                player.vy = payload.vy || 0;
                
                // 广播玩家移动
                broadcast({
                    type: 'playerMove',
                    payload: {
                        id: playerId,
                        x: player.x,
                        y: player.y,
                        vx: player.vx,
                        vy: player.vy
                    }
                });
            }
            break;
            
        case 'waveAttack':
            // 处理波打法事件
            console.log(`玩家 ${playerId} 使用波打法`);
            
            // 广播波打法事件给所有客户端
            broadcast({
                type: 'waveAttack',
                payload: {
                    playerId: playerId,
                    x: payload.x,
                    y: payload.y
                }
            });
            break;
            
        case 'leaveGame':
            // 玩家离开游戏
            const matchIndex = gameState.waitingPlayers.indexOf(playerId);
            if (matchIndex !== -1) {
                gameState.waitingPlayers.splice(matchIndex, 1);
            }
            
            sendToClient(ws, {
                type: 'gameState',
                payload: { state: 'waiting' }
            });
            break;
    }
}

// 开始游戏
function startGame() {
    const players = gameState.waitingPlayers.slice(0, 2); // 取前两个玩家
    gameState.waitingPlayers = gameState.waitingPlayers.slice(2); // 从等待队列中移除
    
    const matchId = generateId();
    gameState.matches.set(matchId, players);
    
    console.log(`游戏开始，匹配ID: ${matchId}，玩家: ${players.join(', ')}`);
    
    // 通知所有玩家游戏开始
    players.forEach(playerId => {
        const player = gameState.players.get(playerId);
        if (player) {
            sendToClient(player.ws, {
                type: 'gameStart',
                payload: { 
                    matchId,
                    mapConfig,
                    obstacles
                }
            });
        }
    });
    
    // 设置游戏结束计时器（演示用，实际游戏应该有胜负条件）
    setTimeout(() => {
        endGame(matchId, players[0]); // 假设第一个玩家获胜
    }, 60000); // 60秒后结束游戏
}

// 结束游戏
function endGame(matchId, winnerId) {
    const players = gameState.matches.get(matchId);
    if (!players) return;
    
    console.log(`游戏结束，匹配ID: ${matchId}，获胜者: ${winnerId}`);
    
    // 通知玩家游戏结束
    players.forEach(playerId => {
        const player = gameState.players.get(playerId);
        if (player) {
            sendToClient(player.ws, {
                type: 'gameEnd',
                payload: { winner: winnerId }
            });
        }
    });
    
    // 从游戏状态中移除匹配
    gameState.matches.delete(matchId);
}

// 启动服务器
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0'; // 监听所有网络接口，支持远程连接

server.listen(PORT, HOST, () => {
    console.log(`HTTP服务器运行在 http://${HOST}:${PORT}`);
    console.log(`WebSocket服务器运行在 ws://${HOST}:${PORT}`);
    
    // 显示本地和局域网访问地址
    const os = require('os');
    const interfaces = os.networkInterfaces();
    console.log('\n可用的访问地址:');
    console.log(`- 本地访问: http://localhost:${PORT}`);
    console.log(`- 局域网访问:`);
    
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                console.log(`  http://${interface.address}:${PORT}`);
            }
        }
    }
});