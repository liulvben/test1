// 主应用程序入口
document.addEventListener('DOMContentLoaded', () => {
    // 初始化游戏
    const game = new Game();
    
    // 将游戏实例设置为全局变量，以便其他脚本可以访问
    window.game = game;
    
    // 初始化网络管理器 - 使用Photon Cloud
    const networkManager = new PhotonNetworkManager();
    
    networkManager.setGame(game);
    game.setNetworkManager(networkManager);
    
    // 设置网络事件回调
    networkManager.setCallback('onConnect', () => {
        document.getElementById('connect-btn').disabled = true;
        document.getElementById('disconnect-btn').disabled = false;
        document.getElementById('match-btn').disabled = false;
        
        showNotification('已连接到Photon Cloud', 'success');
    });
    
    networkManager.setCallback('onDisconnect', () => {
        document.getElementById('connect-btn').disabled = false;
        document.getElementById('disconnect-btn').disabled = true;
        document.getElementById('match-btn').disabled = true;
        
        // 清空游戏中的玩家
        game.players.clear();
        game.localPlayer = null;
        game.setGameState('waiting');
        
        showNotification('已断开Photon Cloud连接', 'info');
    });
    
    networkManager.setCallback('onPlayerJoined', (player) => {
        // 更新玩家数量
        networkManager.updatePlayerCount(game.players.size);
        
        console.log('玩家加入:', player.id);
        game.addPlayer(player);
        
        if (player.isLocal) {
            game.localPlayer = player;
        }
    });
    
    networkManager.setCallback('onPlayerLeft', (playerId) => {
        // 更新玩家数量
        networkManager.updatePlayerCount(game.players.size);
        
        console.log('玩家离开:', playerId);
        game.removePlayer(playerId);
    });
    
    networkManager.setCallback('onPlayerMove', (playerId, x, y, vx, vy) => {
        game.updatePlayerPosition(playerId, x, y, vx, vy);
    });
    
    networkManager.setCallback('onGameStart', () => {
        document.getElementById('match-btn').textContent = '退出游戏';
        document.getElementById('match-btn').onclick = () => {
            networkManager.sendMessage('leaveGame', {});
        };
    });
    
    networkManager.setCallback('onGameEnd', (winner) => {
        document.getElementById('match-btn').textContent = '开始匹配';
        document.getElementById('match-btn').onclick = () => {
            networkManager.requestMatch();
        };
    });
    
    networkManager.setCallback('onError', (message) => {
        console.error('游戏错误:', message);
        showNotification('网络连接错误', 'error');
    });
    
    // 设置按钮事件
    document.getElementById('connect-btn').addEventListener('click', () => {
        // 直接连接到Photon Cloud，无需服务器地址
        networkManager.connect();
    });
    
    document.getElementById('disconnect-btn').addEventListener('click', () => {
        networkManager.disconnect();
    });
    
    document.getElementById('match-btn').addEventListener('click', () => {
        if (document.getElementById('match-btn').textContent === '开始匹配') {
            networkManager.requestMatch();
            document.getElementById('match-btn').textContent = '取消匹配';
            document.getElementById('match-btn').onclick = () => {
                networkManager.cancelMatch();
                document.getElementById('match-btn').textContent = '开始匹配';
                document.getElementById('match-btn').onclick = () => {
                    networkManager.requestMatch();
                };
            };
        }
    });
    
    // 页面卸载时断开连接
    window.addEventListener('beforeunload', () => {
        networkManager.disconnect();
    });
});