// 游戏核心类
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.players = new Map(); // 存储所有玩家
        this.localPlayer = null; // 本地玩家
        this.gameState = 'waiting'; // waiting, playing, ended
        this.keys = {}; // 存储按键状态
        this.animationId = null;
        this.lastUpdateTime = 0;
        this.networkManager = null;
        
        // 地图和障碍物
        this.mapConfig = null;
        this.obstacles = [];
        
        // 波打法技能
        this.waves = []; // 存储所有波
        this.waveCooldown = 0; // 波打法冷却时间（毫秒）
        this.waveCooldownDuration = 500; // 波打法冷却时间持续时间（毫秒，0.5秒）
        this.lastWaveTime = 0; // 上次使用波打法的时间
        this.lastCollisionCheckTime = 0; // 上次检查碰撞的时间，用于计算伤害增量
        
        this.init();
    }
    
    init() {
        // 设置画布大小
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // 初始化键盘事件监听
        this.setupKeyboardControls();
        
        // 开始游戏循环
        this.startGameLoop();
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const maxWidth = container.clientWidth - 20;
        const maxHeight = container.clientHeight - 20;
        
        // 保持16:9的宽高比
        const aspectRatio = 16 / 9;
        let width = maxWidth;
        let height = width / aspectRatio;
        
        if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
    }
    
    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (['w', 'a', 's', 'd'].includes(key)) {
                e.preventDefault();
                this.keys[key] = true;
                
                // 如果本地玩家存在，更新移动状态
                if (this.localPlayer) {
                    this.updatePlayerMovement();
                }
            } else if (key === 'j') {
                // J键触发波打法
                e.preventDefault();
                const now = Date.now();
                if (this.localPlayer && 
                    (now - this.lastWaveTime >= this.waveCooldownDuration) && 
                    this.localPlayer.mana >= 100) {
                    this.createWave(this.localPlayer.x, this.localPlayer.y, this.localPlayer.id);
                    this.lastWaveTime = now; // 更新上次使用波打法的时间
                    
                    // 消耗蓝量
                    this.localPlayer.mana -= 100;
                    
                    // 设置移动限制（0.5秒）
                    this.localPlayer.setMovementRestriction(500);
                    
                    // 更新UI显示
                    this.updatePlayerStatusUI();
                    
                    // 如果网络管理器存在，发送波打法事件
                    if (this.networkManager && this.networkManager.isConnected) {
                        this.networkManager.sendWaveAttack(this.localPlayer.x, this.localPlayer.y);
                    }
                }
            }
        });
        
        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (['w', 'a', 's', 'd'].includes(key)) {
                e.preventDefault();
                this.keys[key] = false;
                
                // 如果本地玩家存在，更新移动状态
                if (this.localPlayer) {
                    this.updatePlayerMovement();
                }
            }
        });
    }
    
    updatePlayerMovement() {
        if (!this.localPlayer) return;
        
        // 检查是否处于移动限制状态
        if (this.localPlayer.checkMovementRestriction()) {
            // 如果处于移动限制状态，停止移动
            this.localPlayer.setVelocity(0, 0);
            
            // 如果网络管理器存在，发送停止移动数据
            if (this.networkManager && this.networkManager.isConnected) {
                this.networkManager.sendPlayerMove(this.localPlayer.x, this.localPlayer.y, 0, 0);
            }
            return;
        }
        
        let dx = 0;
        let dy = 0;
        const speed = 300; // 移动速度（像素/秒）
        
        if (this.keys['w']) dy -= speed;
        if (this.keys['s']) dy += speed;
        if (this.keys['a']) dx -= speed;
        if (this.keys['d']) dx += speed;
        
        // 检查新位置是否有效
        const newX = this.localPlayer.x + dx;
        const newY = this.localPlayer.y + dy;
        
        if (this.isValidPosition(newX, newY)) {
            // 更新玩家速度（速度值已经是像素/秒，将在Player.update中根据deltaTime计算实际移动距离）
            this.localPlayer.setVelocity(dx, dy);
            
            // 如果网络管理器存在，发送移动数据
            if (this.networkManager && this.networkManager.isConnected) {
                this.networkManager.sendPlayerMove(newX, newY, dx, dy);
            }
        } else {
            // 如果新位置无效，停止移动
            this.localPlayer.setVelocity(0, 0);
            
            // 如果网络管理器存在，发送停止移动数据
            if (this.networkManager && this.networkManager.isConnected) {
                this.networkManager.sendPlayerMove(this.localPlayer.x, this.localPlayer.y, 0, 0);
            }
        }
    }
    
    startGameLoop() {
        const gameLoop = (timestamp) => {
            const deltaTime = timestamp - this.lastUpdateTime;
            this.lastUpdateTime = timestamp;
            
            this.update(deltaTime);
            this.render();
            
            this.animationId = requestAnimationFrame(gameLoop);
        };
        
        this.animationId = requestAnimationFrame(gameLoop);
    }
    
    stopGameLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    update(deltaTime) {
        // 更新波打法冷却时间（已改为基于时间的计算，无需每帧更新）
        
        // 更新所有波
        for (let i = this.waves.length - 1; i >= 0; i--) {
            const wave = this.waves[i];
            wave.update(deltaTime);
            
            // 移除已经消失的波
            if (wave.radius > wave.maxRadius) {
                this.waves.splice(i, 1);
            }
        }
        
        // 检查波与玩家的碰撞
        this.checkWaveCollisions();
        
        // 更新所有玩家位置并检查血量
        const playersToRemove = [];
        this.players.forEach(player => {
            player.update(deltaTime);
            
            // 检查玩家血量，如果小于等于0，标记为需要移除
            if (player.health <= 0) {
                playersToRemove.push(player.id);
                return;
            }
            
            // 边界检测
            if (this.mapConfig) {
                // 使用地图配置的边界
                const mapLeft = (this.canvas.width - this.mapConfig.width) / 2;
                const mapTop = (this.canvas.height - this.mapConfig.height) / 2;
                
                player.x = Math.max(mapLeft + player.radius, Math.min(mapLeft + this.mapConfig.width - player.radius, player.x));
                player.y = Math.max(mapTop + player.radius, Math.min(mapTop + this.mapConfig.height - player.radius, player.y));
            } else {
                // 默认边界检测
                player.x = Math.max(player.radius, Math.min(this.canvas.width - player.radius, player.x));
                player.y = Math.max(player.radius, Math.min(this.canvas.height - player.radius, player.y));
            }
        });
        
        // 移除血量小于等于0的玩家
    playersToRemove.forEach(playerId => {
        const playerToRemove = this.players.find(p => p.id === playerId);
        this.removePlayer(playerId);
        showNotification(`玩家 ${playerId} 已被淘汰`, 'info');
        
        // 如果是本地玩家，发送状态更新并通知游戏结束
        if (this.localPlayer && this.localPlayer.id === playerId) {
            if (this.networkManager && this.networkManager.isConnected) {
                this.networkManager.sendPlayerStatus(0, 0, 0);
            }
            
            // 显示游戏结束信息
            showNotification('您已被淘汰，游戏结束', 'error');
            this.gameState = 'ended';
            document.getElementById('player-status').textContent = '游戏结束';
        }
        
        // 如果是网络游戏且玩家不是本地玩家，通知服务器移除该玩家
        if (this.networkManager && this.networkManager.isConnected && 
            (!this.localPlayer || this.localPlayer.id !== playerId)) {
            this.networkManager.sendMessage({
                type: 'playerEliminated',
                playerId: playerId
            });
        }
    });
        
        // 更新本地玩家位置显示
        if (this.localPlayer) {
            document.getElementById('player-position').textContent = 
                `X: ${Math.round(this.localPlayer.x)}, Y: ${Math.round(this.localPlayer.y)}`;
            
            // 恢复蓝量（每秒恢复50点）
            if (this.localPlayer.mana < this.localPlayer.maxMana) {
                this.localPlayer.mana = Math.min(this.localPlayer.maxMana, this.localPlayer.mana + 50 * deltaTime / 1000);
            }
            
            // 定期更新UI显示
            this.updatePlayerStatusUI();
        }
    }
    
    render() {
        // 清空画布
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制地图边界
        if (this.mapConfig) {
            this.drawMapBoundary();
        }
        
        // 绘制网格背景
        this.drawGrid();
        
        // 绘制障碍物
        this.drawObstacles();
        
        // 绘制所有波
        this.waves.forEach(wave => {
            wave.render(this.ctx);
        });
        
        // 绘制所有玩家
        this.players.forEach(player => {
            player.render(this.ctx);
        });
        
        // 如果游戏状态是等待中，显示提示信息
        if (this.gameState === 'waiting') {
            this.drawWaitingMessage();
        }
    }
    
    drawGrid() {
        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 1;
        
        // 垂直线
        for (let x = 0; x <= this.canvas.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // 水平线
        for (let y = 0; y <= this.canvas.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    drawWaitingMessage() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('等待连接服务器...', this.canvas.width / 2, this.canvas.height / 2);
    }
    
    drawMapBoundary() {
        if (!this.mapConfig) return;
        
        const mapLeft = (this.canvas.width - this.mapConfig.width) / 2;
        const mapTop = (this.canvas.height - this.mapConfig.height) / 2;
        
        // 绘制地图边界
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(mapLeft, mapTop, this.mapConfig.width, this.mapConfig.height);
        
        // 绘制地图外部的暗色区域
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        
        // 上方
        this.ctx.fillRect(0, 0, this.canvas.width, mapTop);
        // 下方
        this.ctx.fillRect(0, mapTop + this.mapConfig.height, this.canvas.width, this.canvas.height - mapTop - this.mapConfig.height);
        // 左侧
        this.ctx.fillRect(0, mapTop, mapLeft, this.mapConfig.height);
        // 右侧
        this.ctx.fillRect(mapLeft + this.mapConfig.width, mapTop, this.canvas.width - mapLeft - this.mapConfig.width, this.mapConfig.height);
    }
    
    drawObstacles() {
        if (!this.mapConfig || this.obstacles.length === 0) return;
        
        const mapLeft = (this.canvas.width - this.mapConfig.width) / 2;
        const mapTop = (this.canvas.height - this.mapConfig.height) / 2;
        
        this.ctx.fillStyle = '#666';
        
        this.obstacles.forEach(obstacle => {
            // 将障碍物位置转换为画布坐标
            const x = mapLeft + obstacle.x;
            const y = mapTop + obstacle.y;
            
            // 绘制障碍物
            this.ctx.fillRect(x, y, obstacle.width, obstacle.height);
            
            // 绘制障碍物边框
            this.ctx.strokeStyle = '#888';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x, y, obstacle.width, obstacle.height);
        });
    }
    
    // 添加玩家到游戏中
    addPlayer(playerData) {
        const player = new Player(playerData.id, playerData.x, playerData.y, playerData.color);
        
        // 如果提供了自定义属性，则设置它们
        if (playerData.health !== undefined) {
            player.health = playerData.health;
            player.maxHealth = playerData.health;
        }
        
        if (playerData.resistance !== undefined) {
            player.resistance = playerData.resistance;
            player.maxResistance = playerData.resistance;
        }
        
        if (playerData.mana !== undefined) {
            player.mana = playerData.mana;
            player.maxMana = playerData.mana;
        }
        
        this.players.set(playerData.id, player);
        
        // 如果是本地玩家，设置为本地玩家
        if (playerData.isLocal) {
            this.localPlayer = player;
            document.getElementById('player-id').textContent = playerData.id;
        }
        
        return player;
    }
    
    // 移除玩家
    removePlayer(playerId) {
        this.players.delete(playerId);
        
        // 如果移除的是本地玩家，重置本地玩家
        if (this.localPlayer && this.localPlayer.id === playerId) {
            this.localPlayer = null;
            document.getElementById('player-id').textContent = '未连接';
        }
    }
    
    // 更新玩家位置
    updatePlayerPosition(playerId, x, y, vx = 0, vy = 0) {
        const player = this.players.get(playerId);
        if (player) {
            player.x = x;
            player.y = y;
            player.vx = vx;
            player.vy = vy;
        }
    }
    
    // 更新玩家状态
    updatePlayerStatus(playerId, health, resistance, mana) {
        const player = this.players.get(playerId);
        if (player) {
            player.health = health;
            player.resistance = resistance;
            player.mana = mana;
            
            // 如果是本地玩家，更新UI
            if (player === this.localPlayer) {
                this.updatePlayerStatusUI();
            }
        }
    }
    
    // 设置游戏状态
    setGameState(state) {
        this.gameState = state;
        
        let statusText = '等待中';
        switch (state) {
            case 'waiting':
                statusText = '等待中';
                break;
            case 'playing':
                statusText = '游戏中';
                break;
            case 'ended':
                statusText = '游戏结束';
                break;
        }
        
        document.getElementById('player-status').textContent = statusText;
    }
    
    // 使用波打法技能（公共方法，供移动端控制调用）
    useWaveAttack() {
        const now = Date.now();
        if (this.localPlayer && 
            (now - this.lastWaveTime >= this.waveCooldownDuration) && 
            this.localPlayer.mana >= 100) {
            this.createWave(this.localPlayer.x, this.localPlayer.y, this.localPlayer.id);
            this.lastWaveTime = now; // 更新上次使用波打法的时间
            
            // 消耗蓝量
            this.localPlayer.mana -= 100;
            
            // 设置移动限制（0.5秒）
            this.localPlayer.setMovementRestriction(500);
            
            // 更新UI显示
            this.updatePlayerStatusUI();
            
            // 如果网络管理器存在，发送波打法事件
            if (this.networkManager && this.networkManager.isConnected) {
                this.networkManager.sendWaveAttack(this.localPlayer.x, this.localPlayer.y);
            }
            
            return true; // 返回成功使用
        }
        return false; // 返回使用失败
    }
    
    // 设置网络管理器
    setNetworkManager(networkManager) {
        this.networkManager = networkManager;
    }
    
    // 设置地图配置和障碍物
    setMapConfig(mapConfig, obstacles) {
        this.mapConfig = mapConfig;
        this.obstacles = obstacles;
    }
    
    // 检查位置是否有效（不与障碍物碰撞）
    isValidPosition(x, y, playerSize = 30) {
        if (!this.mapConfig || this.obstacles.length === 0) return true;
        
        const mapLeft = (this.canvas.width - this.mapConfig.width) / 2;
        const mapTop = (this.canvas.height - this.mapConfig.height) / 2;
        
        // 转换为地图坐标
        const mapX = x - mapLeft;
        const mapY = y - mapTop;
        
        // 检查地图边界
        if (mapX < playerSize/2 || mapX > this.mapConfig.width - playerSize/2 || 
            mapY < playerSize/2 || mapY > this.mapConfig.height - playerSize/2) {
            return false;
        }
        
        // 检查与障碍物的碰撞
        const playerRect = {
            x: mapX - playerSize/2,
            y: mapY - playerSize/2,
            width: playerSize,
            height: playerSize
        };
        
        for (const obstacle of this.obstacles) {
            if (this.checkCollision(playerRect, obstacle)) {
                return false;
            }
        }
        
        return true;
    }
    
    // 检查两个矩形是否碰撞
    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    // 更新玩家状态UI
    updatePlayerStatusUI() {
        if (!this.localPlayer) return;
        
        // 更新血量
        const healthPercent = (this.localPlayer.health / this.localPlayer.maxHealth) * 100;
        document.getElementById('health-bar').style.width = `${healthPercent}%`;
        document.getElementById('health-value').textContent = `${Math.round(this.localPlayer.health)}/${this.localPlayer.maxHealth}`;
        
        // 更新抵抗值
        const resistancePercent = (this.localPlayer.resistance / this.localPlayer.maxResistance) * 100;
        document.getElementById('resistance-bar').style.width = `${resistancePercent}%`;
        document.getElementById('resistance-value').textContent = `${Math.round(this.localPlayer.resistance)}/${this.localPlayer.maxResistance}`;
        
        // 更新蓝量
        const manaPercent = (this.localPlayer.mana / this.localPlayer.maxMana) * 100;
        document.getElementById('mana-bar').style.width = `${manaPercent}%`;
        document.getElementById('mana-value').textContent = `${Math.round(this.localPlayer.mana)}/${this.localPlayer.maxMana}`;
    }
    
    // 清理资源
    destroy() {
        this.stopGameLoop();
        this.players.clear();
        this.localPlayer = null;
        this.networkManager = null;
        this.waves = [];
    }
    
    // 创建波
    createWave(x, y, playerId) {
        const wave = new Wave(x, y, playerId);
        this.waves.push(wave);
        return wave;
    }
    
    // 检查波与玩家的碰撞
    checkWaveCollisions() {
        // 获取当前帧的时间间隔，用于计算伤害增量
        const currentTime = Date.now();
        let deltaTime = 16.67; // 默认60FPS，约16.67ms每帧
        
        // 如果有上一帧的时间，计算实际的时间间隔
        if (this.lastCollisionCheckTime) {
            deltaTime = currentTime - this.lastCollisionCheckTime;
        }
        this.lastCollisionCheckTime = currentTime;
        
        this.waves.forEach(wave => {
            this.players.forEach(player => {
                // 跳过波的主人
                if (player.id === wave.playerId) return;
                
                // 计算波与玩家的距离
                const distance = Math.sqrt(
                    Math.pow(player.x - wave.x, 2) + 
                    Math.pow(player.y - wave.y, 2)
                );
                
                // 更精确的碰撞检测：当波边缘接触到玩家中心时触发
                // 这样可以确保波的视觉效果与碰撞检测范围一致
                const collisionDistance = wave.radius;
                
                // 检查是否碰撞（波边缘接触到玩家中心）
                if (distance <= collisionDistance) {
                    // 记录玩家进入波的时间
                    wave.recordPlayerHit(player.id);
                    
                    // 计算这一帧应该造成的伤害增量
                        const damageDelta = wave.calculateDamageDelta(player.id, deltaTime);
                        
                        // 只有当伤害增量大于0时才处理
                        if (damageDelta > 0) {
                            // 计算伤害：先扣抵抗值，再扣血量
                            let resistanceDamage = Math.min(damageDelta, player.resistance);
                            let healthDamage = Math.max(0, damageDelta - player.resistance);
                            
                            // 扣除抵抗值
                            player.resistance -= resistanceDamage;
                            
                            // 扣除血量
                            player.health -= healthDamage;
                            
                            // 确保血量不低于0
                            player.health = Math.max(0, player.health);
                        
                        // 更新UI显示
                        this.updatePlayerStatusUI();
                        
                        // 改变玩家颜色表示被击中
                        player.color = '#ff4a4a';
                        setTimeout(() => {
                            player.color = '#4a9eff';
                        }, 500);
                        
                        // 如果是本地玩家，发送状态更新
                        if (player === this.localPlayer && this.networkManager && this.networkManager.isConnected) {
                            this.networkManager.sendPlayerStatus(player.health, player.resistance, player.mana);
                        }
                    }
                } else {
                    // 如果玩家不在波中，移除记录
                    if (wave.isPlayerInWave(player.id)) {
                        wave.removePlayerFromWave(player.id);
                    }
                }
            });
        });
    }
}

// 玩家类
class Player {
    constructor(id, x = 0, y = 0, color = '#4a9eff') {
        this.id = id;
        this.x = x;
        this.y = y;
        this.vx = 0; // x方向速度
        this.vy = 0; // y方向速度
        this.radius = 15; // 玩家半径
        this.color = color;
        this.trail = []; // 移动轨迹
        this.maxTrailLength = 10;
        
        // 玩家属性
        this.maxHealth = 1000; // 最大血量
        this.health = this.maxHealth; // 当前血量
        this.maxResistance = 50; // 最大抵抗值
        this.resistance = this.maxResistance; // 当前抵抗值
        this.maxMana = 1000; // 最大蓝量
        this.mana = this.maxMana; // 当前蓝量
        this.resistanceRecoveryRate = 20; // 每秒恢复的抵抗值
        this.lastResistanceRecovery = Date.now(); // 上次抵抗值恢复时间
        
        // 波打法移动限制
        this.movementRestricted = false; // 是否处于移动限制状态
        this.movementRestrictionEndTime = 0; // 移动限制结束时间
    }
    
    update(deltaTime) {
        // 检查移动限制状态
        this.checkMovementRestriction();
        
        // 如果处于移动限制状态，不更新位置
        if (!this.movementRestricted) {
            // 基于时间更新位置
            // deltaTime单位为毫秒，需要转换为秒
            const deltaTimeInSeconds = deltaTime / 1000;
            this.x += this.vx * deltaTimeInSeconds;
            this.y += this.vy * deltaTimeInSeconds;
            
            // 添加到轨迹
            if (this.vx !== 0 || this.vy !== 0) {
                this.trail.push({ x: this.x, y: this.y });
                if (this.trail.length > this.maxTrailLength) {
                    this.trail.shift();
                }
            }
        }
        
        // 应用摩擦力（基于时间，使用线性衰减而不是指数衰减，使移动更平滑）
        const deltaTimeInSeconds = deltaTime / 1000;
        const frictionAmount = 5 * deltaTimeInSeconds * 60; // 每秒减少5个单位速度
        if (Math.abs(this.vx) > frictionAmount) {
            this.vx -= Math.sign(this.vx) * frictionAmount;
        } else {
            this.vx = 0;
        }
        
        if (Math.abs(this.vy) > frictionAmount) {
            this.vy -= Math.sign(this.vy) * frictionAmount;
        } else {
            this.vy = 0;
        }
        
        // 恢复抵抗值（如果抵抗值低于最大值）
        if (this.resistance < this.maxResistance) {
            const now = Date.now();
            const timeDiff = (now - this.lastResistanceRecovery) / 1000; // 转换为秒
            if (timeDiff >= 0.1) { // 每0.1秒恢复一次，实现连续恢复效果
                const recoveryAmount = this.resistanceRecoveryRate * timeDiff;
                this.resistance = Math.min(this.maxResistance, this.resistance + recoveryAmount);
                this.lastResistanceRecovery = now;
            }
        }
    }
    
    render(ctx) {
        // 绘制轨迹
        if (this.trail.length > 1) {
            ctx.strokeStyle = this.color + '40'; // 添加透明度
            ctx.lineWidth = this.radius * 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            
            for (let i = 0; i < this.trail.length; i++) {
                const point = this.trail[i];
                const alpha = i / this.trail.length; // 渐变透明度
                
                if (i === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            }
            
            ctx.stroke();
        }
        
        // 绘制玩家
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 如果处于移动限制状态，绘制特殊效果
        if (this.movementRestricted) {
            ctx.strokeStyle = '#ff9900'; // 橙色边框表示移动限制
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
            ctx.stroke();
            
            // 绘制移动限制剩余时间
            const remainingTime = Math.max(0, this.movementRestrictionEndTime - Date.now()) / 1000;
            ctx.fillStyle = '#ff9900';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${remainingTime.toFixed(1)}s`, this.x, this.y + this.radius + 15);
        } else {
            // 绘制普通边框
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // 绘制玩家ID
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.id, this.x, this.y - this.radius - 5);
    }
    
    setVelocity(vx, vy) {
        this.vx = vx;
        this.vy = vy;
    }
    
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }
    
    // 设置移动限制
    setMovementRestriction(duration) {
        this.movementRestricted = true;
        this.movementRestrictionEndTime = Date.now() + duration;
        // 立即停止当前移动
        this.vx = 0;
        this.vy = 0;
    }
    
    // 检查移动限制状态
    checkMovementRestriction() {
        if (this.movementRestricted && Date.now() >= this.movementRestrictionEndTime) {
            this.movementRestricted = false;
            this.movementRestrictionEndTime = 0;
        }
        return this.movementRestricted;
    }
}

// 波类
class Wave {
    constructor(x, y, playerId) {
        this.x = x;
        this.y = y;
        this.playerId = playerId; // 波的主人ID
        this.radius = 10; // 初始半径
        this.maxRadius = 150; // 最大半径
        this.speed = 150; // 扩散速度（像素/秒）
        this.color = '#00ffff'; // 波的颜色
        this.hitPlayers = new Set(); // 已击中的玩家ID集合
        this.playerHitTimes = new Map(); // 玩家ID与进入波的时间映射
        this.createdAt = Date.now(); // 创建时间（毫秒）
        this.lastUpdateTime = this.createdAt; // 上次更新时间
        this.damageRate = 100; // 每秒伤害值
    }
    
    update(deltaTime) {
        // 基于时间更新波的半径
        // deltaTime单位为毫秒，需要转换为秒
        const deltaTimeInSeconds = deltaTime / 1000;
        this.radius += this.speed * deltaTimeInSeconds;
        this.lastUpdateTime = Date.now();
    }
    
    // 计算玩家在波中停留的时间（秒）
    getTimeInWave(playerId) {
        if (!this.playerHitTimes.has(playerId)) {
            return 0;
        }
        const hitTime = this.playerHitTimes.get(playerId);
        return (Date.now() - hitTime) / 1000; // 转换为秒
    }
    
    // 记录玩家进入波的时间
    recordPlayerHit(playerId) {
        if (!this.playerHitTimes.has(playerId)) {
            this.playerHitTimes.set(playerId, Date.now());
        }
    }
    
    // 计算基于时间的伤害
    calculateDamage(playerId) {
        const timeInWave = this.getTimeInWave(playerId);
        return Math.floor(this.damageRate * timeInWave); // 每秒造成100点伤害
    }
    
    // 计算这一帧应该造成的伤害增量
    calculateDamageDelta(playerId, deltaTime) {
        if (!this.playerHitTimes.has(playerId)) {
            return 0;
        }
        // 将deltaTime从毫秒转换为秒，然后计算这一帧的伤害
        const deltaTimeInSeconds = deltaTime / 1000;
        // 不使用Math.floor，保留小数部分，确保即使很小的伤害也能被计算
        return this.damageRate * deltaTimeInSeconds;
    }
    
    render(ctx) {
        // 计算透明度（随着半径增大而减小）
        const opacity = Math.max(0, 1 - (this.radius / this.maxRadius));
        
        // 使用全局透明度而不是颜色透明度，这样更可靠
        ctx.save();
        
        // 绘制波的外边缘（碰撞检测范围）
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // 绘制内部填充（半透明，表示波的内部区域）
        ctx.globalAlpha = opacity * 0.3;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制一个更明显的内圈，表示波的内部区域
        ctx.globalAlpha = opacity * 0.5;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        
        // 恢复全局透明度
        ctx.restore();
    }
    
    // 检查是否已经击中过某个玩家（保留此方法以兼容其他可能的代码）
    hasHitPlayer(playerId) {
        return this.hitPlayers.has(playerId);
    }
    
    // 添加被击中的玩家ID（保留此方法以兼容其他可能的代码）
    addHitPlayer(playerId) {
        this.hitPlayers.add(playerId);
    }
    
    // 检查玩家是否在波中
    isPlayerInWave(playerId) {
        return this.playerHitTimes.has(playerId);
    }
    
    // 移除玩家（当玩家离开波时调用）
    removePlayerFromWave(playerId) {
        this.playerHitTimes.delete(playerId);
        this.hitPlayers.delete(playerId);
    }
}