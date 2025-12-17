// 网络管理类
class NetworkManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // 初始重连延迟1秒
        // 动态获取服务器地址，支持局域网连接
        this.serverUrl = this.getServerUrl();
        this.game = null;
        this.playerId = null;
        this.callbacks = {
            onConnect: null,
            onDisconnect: null,
            onPlayerJoined: null,
            onPlayerLeft: null,
            onPlayerMove: null,
            onGameStart: null,
            onGameEnd: null,
            onError: null
        };
    }
    
    // 设置游戏实例
    setGame(game) {
        this.game = game;
    }
    
    // 动态获取服务器URL，支持局域网连接
    getServerUrl() {
        // 获取当前页面的主机和端口
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
        
        // 如果端口不是80或443，则包含端口号
        const portPart = (port === '80' || port === '443') ? '' : `:${port}`;
        
        // 不再需要/ws路径，因为服务器已配置为处理所有WebSocket升级请求
        return `${protocol}//${host}${portPart}`;
    }
    
    // 连接服务器
    connect(serverUrl = this.serverUrl) {
        if (this.isConnecting || this.isConnected) {
            return;
        }
        
        this.isConnecting = true;
        this.updateConnectionStatus('connecting');
        
        try {
            this.socket = new WebSocket(serverUrl);
            this.setupSocketEvents();
        } catch (error) {
            console.error('创建WebSocket连接失败:', error);
            this.isConnecting = false;
            this.handleError(error);
        }
    }
    
    // 设置WebSocket事件
    setupSocketEvents() {
        this.socket.onopen = () => {
            this.isConnected = true;
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus('online');
            
            // 请求玩家ID
            this.sendMessage('requestPlayerId', {});
            
            if (this.callbacks.onConnect) {
                this.callbacks.onConnect();
            }
        };
        
        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('解析消息失败:', error);
            }
        };
        
        this.socket.onclose = (event) => {
            this.isConnected = false;
            this.isConnecting = false;
            this.updateConnectionStatus('offline');
            
            if (this.callbacks.onDisconnect) {
                this.callbacks.onDisconnect();
            }
            
            // 自动重连
            this.attemptReconnect();
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket错误:', error);
            this.isConnecting = false;
            this.handleError(error);
        };
    }
    
    // 处理服务器消息
    handleMessage(data) {
        const { type, payload } = data;
        
        switch (type) {
            case 'playerId':
                this.playerId = payload.id;
                document.getElementById('player-id').textContent = this.playerId;
                break;
                
            case 'gameState':
                if (this.game) {
                    this.game.setGameState(payload.state);
                }
                break;
                
            case 'players':
                if (this.game && payload.players) {
                    // 清空当前玩家列表
                    this.game.players.clear();
                    
                    // 添加所有玩家
                    payload.players.forEach(playerData => {
                        const isLocal = playerData.id === this.playerId;
                        const player = this.game.addPlayer({
                            id: playerData.id,
                            x: playerData.x,
                            y: playerData.y,
                            color: playerData.color,
                            isLocal
                        });
                        
                        if (isLocal) {
                            this.game.localPlayer = player;
                        }
                    });
                    
                    // 更新玩家数量
                    this.updatePlayerCount(this.game.players.size);
                }
                break;
                
            case 'playerJoined':
                if (this.game && this.callbacks.onPlayerJoined) {
                    const player = this.game.addPlayer({
                        id: payload.id,
                        x: payload.x,
                        y: payload.y,
                        color: payload.color,
                        isLocal: false
                    });
                    
                    this.callbacks.onPlayerJoined(player);
                    showNotification(`玩家 ${payload.id} 加入了游戏`, 'info');
                }
                break;
                
            case 'playerLeft':
                if (this.game && this.callbacks.onPlayerLeft) {
                    this.game.removePlayer(payload.id);
                    this.callbacks.onPlayerLeft(payload.id);
                    showNotification(`玩家 ${payload.id} 离开了游戏`, 'info');
                }
                break;
                
            case 'playerMove':
                if (this.game) {
                    this.game.updatePlayerPosition(payload.id, payload.x, payload.y, payload.vx, payload.vy);
                    
                    if (this.callbacks.onPlayerMove) {
                        this.callbacks.onPlayerMove(payload.id, payload.x, payload.y, payload.vx, payload.vy);
                    }
                }
                break;
                
            case 'gameStart':
                if (this.game) {
                    this.game.setGameState('playing');
                    
                    // 设置地图配置和障碍物
                    if (payload.mapConfig && payload.obstacles) {
                        this.game.setMapConfig(payload.mapConfig, payload.obstacles);
                    }
                    
                    if (this.callbacks.onGameStart) {
                        this.callbacks.onGameStart();
                    }
                    
                    showNotification('游戏开始！', 'success');
                }
                break;
                
            case 'gameEnd':
                if (this.game) {
                    this.game.setGameState('ended');
                    
                    if (this.callbacks.onGameEnd) {
                        this.callbacks.onGameEnd(payload.winner);
                    }
                    
                    showNotification(`游戏结束！获胜者: ${payload.winner}`, 'info');
                }
                break;
                
            case 'waveAttack':
                if (this.game) {
                    this.game.createWave(payload.x, payload.y, payload.playerId);
                    
                    // 如果不是本地玩家的波打法，为使用波打法的玩家设置移动限制
                    if (payload.playerId !== this.playerId) {
                        const player = this.game.players.get(payload.playerId);
                        if (player) {
                            player.setMovementRestriction(500);
                        }
                    }
                }
                break;
                
            case 'playerStatus':
                if (this.game) {
                    this.game.updatePlayerStatus(payload.id, payload.health, payload.resistance, payload.mana);
                }
                break;
                
            case 'playerEliminated':
                if (this.game) {
                    this.game.removePlayer(payload.playerId);
                    showNotification(`玩家 ${payload.playerId} 已被淘汰`, 'info');
                }
                break;
                
            case 'error':
                if (this.callbacks.onError) {
                    this.callbacks.onError(payload.message);
                }
                
                showNotification(`错误: ${payload.message}`, 'error');
                break;
                
            default:
                    // 未知消息类型，忽略
        }
    }
    
    // 发送消息
    sendMessage(type, payload) {
        if (!this.isConnected || !this.socket) {
            return false;
        }
        
        try {
            const message = JSON.stringify({ type, payload });
            this.socket.send(message);
            return true;
        } catch (error) {
            console.error('发送消息失败:', error);
            return false;
        }
    }
    
    // 请求匹配
    requestMatch() {
        return this.sendMessage('requestMatch', {});
    }
    
    // 取消匹配
    cancelMatch() {
        return this.sendMessage('cancelMatch', {});
    }
    
    // 发送玩家移动数据
    sendPlayerMove(x, y, vx, vy) {
        return this.sendMessage('playerMove', { x, y, vx, vy });
    }
    
    // 发送波打法事件
    sendWaveAttack(x, y) {
        return this.sendMessage('waveAttack', { x, y });
    }
    
    // 发送玩家状态更新
    sendPlayerStatus(health, resistance, mana) {
        return this.sendMessage('playerStatus', { health, resistance, mana });
    }
    
    // 断开连接
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        
        this.isConnected = false;
        this.isConnecting = false;
        this.updateConnectionStatus('offline');
    }
    
    // 尝试重连
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            showNotification('无法连接到服务器，请检查网络连接', 'error');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避
        
        showNotification(`连接断开，${delay/1000}秒后尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'info');
        
        setTimeout(() => {
            if (!this.isConnected && !this.isConnecting) {
                this.connect();
            }
        }, delay);
    }
    
    // 更新连接状态显示
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('status-indicator');
        const playerCountElement = document.getElementById('player-count');
        
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
                playerCountElement.textContent = '在线玩家: 0';
                break;
            case 'connecting':
                statusElement.textContent = '连接中';
                statusElement.classList.add('status-connecting');
                break;
        }
    }
    
    // 更新在线玩家数量
    updatePlayerCount(count) {
        document.getElementById('player-count').textContent = `在线玩家: ${count}`;
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