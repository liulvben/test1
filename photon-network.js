// Photon Cloud网络管理类
class PhotonNetworkManager {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.playerId = null;
        this.room = null;
        this.game = null;
        
        // Photon Cloud配置
        this.appId = '84e83fae-288e-4cf8-87e8-da69c2639380'; // 需要替换为你的Photon App ID
        this.appVersion = '1.0';
        
        this.callbacks = {
            onConnect: null,
            onDisconnect: null,
            onPlayerJoined: null,
            onPlayerLeft: null,
            onPlayerMove: null,
            onGameStart: null,
            onGameEnd: null,
            onError: null,
            onPlayerStatusUpdate: null
        };
    }
    
    // 设置游戏实例
    setGame(game) {
        this.game = game;
    }
    
    // 初始化Photon客户端
    initPhoton() {
        // 检查是否已加载Photon SDK
        if (typeof Photon === 'undefined') {
            console.error('Photon SDK未加载，请先引入Photon JavaScript SDK');
            this.handleError('Photon SDK未加载');
            return false;
        }
        
        try {
            // 创建LoadBalancing客户端
            this.client = new Photon.LoadBalancing.LoadBalancingClient(
                Photon.ConnectionProtocol.Wss,
                this.appId,
                this.appVersion
            );
            
            // 设置事件监听器
            this.setupPhotonEvents();
            return true;
        } catch (error) {
            console.error('初始化Photon客户端失败:', error);
            this.handleError(error);
            return false;
        }
    }
    
    // 设置Photon事件监听
    setupPhotonEvents() {
        if (!this.client) return;
        
        // 连接状态变化
        this.client.onStateChange = (state) => {
            console.log('Photon连接状态变化:', state);
            
            switch (state) {
                case Photon.LoadBalancing.Constants.State.Joined:
                    this.isConnected = true;
                    this.isConnecting = false;
                    this.updateConnectionStatus('online');
                    
                    // 设置玩家ID
                    this.playerId = this.client.getUserId();
                    document.getElementById('player-id').textContent = this.playerId;
                    
                    if (this.callbacks.onConnect) {
                        this.callbacks.onConnect();
                    }
                    break;
                    
                case Photon.LoadBalancing.Constants.State.Disconnected:
                    this.isConnected = false;
                    this.isConnecting = false;
                    this.updateConnectionStatus('offline');
                    
                    if (this.callbacks.onDisconnect) {
                        this.callbacks.onDisconnect();
                    }
                    break;
                    
                case Photon.LoadBalancing.Constants.State.Connecting:
                    this.isConnecting = true;
                    this.updateConnectionStatus('connecting');
                    break;
            }
        };
        
        // 玩家加入房间
        this.client.onPlayerJoined = (player) => {
            console.log('玩家加入房间:', player.getUserId());
            
            if (this.game && this.callbacks.onPlayerJoined) {
                // 创建玩家对象
                const playerData = {
                    id: player.getUserId(),
                    x: Math.random() * 700 + 50,
                    y: Math.random() * 500 + 50,
                    color: this.generateColor(),
                    isLocal: player.getUserId() === this.playerId
                };
                
                const gamePlayer = this.game.addPlayer(playerData);
                
                if (playerData.isLocal) {
                    this.game.localPlayer = gamePlayer;
                }
                
                this.callbacks.onPlayerJoined(gamePlayer);
                showNotification(`玩家 ${player.getUserId()} 加入了游戏`, 'info');
            }
            
            this.updatePlayerCount();
        };
        
        // 玩家离开房间
        this.client.onPlayerLeft = (player) => {
            console.log('玩家离开房间:', player.getUserId());
            
            if (this.game && this.callbacks.onPlayerLeft) {
                this.game.removePlayer(player.getUserId());
                this.callbacks.onPlayerLeft(player.getUserId());
                showNotification(`玩家 ${player.getUserId()} 离开了游戏`, 'info');
            }
            
            this.updatePlayerCount();
        };
        
        // 接收自定义事件
        this.client.onEvent = (eventCode, content, actorNr) => {
            this.handlePhotonEvent(eventCode, content, actorNr);
        };
        
        // 错误处理
        this.client.onError = (error) => {
            console.error('Photon错误:', error);
            this.handleError(error);
        };
    }
    
    // 处理Photon事件
    handlePhotonEvent(eventCode, content, actorNr) {
        switch (eventCode) {
            case 1: // 玩家移动事件
                if (this.game && content) {
                    const { x, y, vx, vy } = content;
                    this.game.updatePlayerPosition(actorNr.toString(), x, y, vx, vy);
                    
                    if (this.callbacks.onPlayerMove) {
                        this.callbacks.onPlayerMove(actorNr.toString(), x, y, vx, vy);
                    }
                }
                break;
                
            case 2: // 波打法事件
                if (this.game && content) {
                    const { x, y, playerId } = content;
                    this.game.createWave(x, y, playerId);
                }
                break;
                
            case 3: // 游戏开始事件
                if (this.game) {
                    this.game.setGameState('playing');
                    
                    if (this.callbacks.onGameStart) {
                        this.callbacks.onGameStart();
                    }
                    
                    showNotification('游戏开始！', 'success');
                }
                break;
                
            case 4: // 游戏结束事件
                if (this.game) {
                    this.game.setGameState('ended');
                    
                    if (this.callbacks.onGameEnd) {
                        this.callbacks.onGameEnd(content.winner);
                    }
                    
                    showNotification(`游戏结束！获胜者: ${content.winner}`, 'info');
                }
                break;
                
            case 5: // 玩家状态更新事件
                if (this.game && content) {
                    const { health, resistance, mana } = content;
                    
                    // 更新对应玩家的状态
                    const player = this.game.players.get(actorNr.toString());
                    if (player) {
                        player.health = health;
                        player.resistance = resistance;
                        player.mana = mana;
                    }
                    
                    if (this.callbacks.onPlayerStatusUpdate) {
                        this.callbacks.onPlayerStatusUpdate(actorNr.toString(), health, resistance, mana);
                    }
                }
                break;
        }
    }
    
    // 连接到Photon Cloud
    connect() {
        if (this.isConnecting || this.isConnected) {
            console.log('连接已在进行中或已连接，跳过连接请求');
            return;
        }
        
        if (!this.initPhoton()) {
            return;
        }
        
        this.isConnecting = true;
        this.updateConnectionStatus('connecting');
        console.log('开始连接到Photon Cloud');
        
        try {
            // 连接到Photon Cloud
            this.client.connect();
        } catch (error) {
            console.error('连接Photon Cloud失败:', error);
            this.isConnecting = false;
            this.handleError(error);
        }
    }
    
    // 加入或创建房间
    joinOrCreateRoom() {
        if (!this.isConnected || !this.client) {
            console.error('未连接到Photon Cloud');
            return;
        }
        
        const roomOptions = {
            maxPlayers: 4,
            customRoomProperties: { gameType: 'moba' },
            customRoomPropertiesForLobby: ['gameType']
        };
        
        this.client.joinRandomOrCreateRoom(null, roomOptions);
    }
    
    // 发送玩家移动数据
    sendPlayerMove(x, y, vx, vy) {
        if (!this.isConnected || !this.room) {
            return false;
        }
        
        try {
            const eventData = { x, y, vx, vy };
            this.client.sendEvent(1, eventData, { receiverGroup: Photon.LoadBalancing.ReceiverGroup.Others });
            return true;
        } catch (error) {
            console.error('发送移动数据失败:', error);
            return false;
        }
    }
    
    // 发送波打法事件
    sendWaveAttack(x, y) {
        if (!this.isConnected || !this.room) {
            return false;
        }
        
        try {
            const eventData = { x, y, playerId: this.playerId };
            this.client.sendEvent(2, eventData, { receiverGroup: Photon.LoadBalancing.ReceiverGroup.All });
            return true;
        } catch (error) {
            console.error('发送波打法事件失败:', error);
            return false;
        }
    }
    
    // 发送玩家状态更新
    sendPlayerStatus(health, resistance, mana) {
        if (!this.isConnected || !this.room) {
            return false;
        }
        
        try {
            const eventData = { 
                health: Math.round(health), 
                resistance: Math.round(resistance), 
                mana: Math.round(mana) 
            };
            this.client.sendEvent(5, eventData, { receiverGroup: Photon.LoadBalancing.ReceiverGroup.Others });
            return true;
        } catch (error) {
            console.error('发送玩家状态失败:', error);
            return false;
        }
    }
    
    // 断开连接
    disconnect() {
        if (this.client) {
            this.client.disconnect();
            this.client = null;
        }
        
        this.isConnected = false;
        this.isConnecting = false;
        this.updateConnectionStatus('offline');
    }
    
    // 生成随机颜色
    generateColor() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#a29bfe', '#fd79a8'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // 更新连接状态显示
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('status-indicator');
        
        // 移除所有状态类
        statusElement.classList.remove('status-online', 'status-offline', 'status-connecting');
        
        switch (status) {
            case 'online':
                statusElement.textContent = '在线';
                statusElement.classList.add('status-online');
                break;
            case 'offline':
                statusElement.textContent = '离线';
                statusElement.classList.add('status-offline');
                break;
            case 'connecting':
                statusElement.textContent = '连接中';
                statusElement.classList.add('status-connecting');
                break;
        }
    }
    
    // 更新在线玩家数量
    updatePlayerCount() {
        if (this.client && this.client.getCurrentRoom()) {
            const count = this.client.getCurrentRoom().getPlayerCount();
            document.getElementById('player-count').textContent = `在线玩家: ${count}`;
        } else {
            document.getElementById('player-count').textContent = '在线玩家: 0';
        }
    }
    
    // 处理错误
    handleError(error) {
        console.error('网络错误:', error);
        this.updateConnectionStatus('offline');
        
        if (this.callbacks.onError) {
            this.callbacks.onError(error.message || '网络连接错误');
        }
        
        showNotification('网络连接错误', 'error');
    }
    
    // 设置回调函数
    setCallback(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        }
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    
    // 显示通知
    setTimeout(() => {
        notification.classList.remove('hidden');
    }, 10);
    
    // 3秒后隐藏通知
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}