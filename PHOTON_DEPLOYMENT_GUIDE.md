# Photon Cloud 多人联机部署指南

## 概述
本指南介绍如何使用Photon Cloud为你的HTML5游戏实现多人联机功能。Photon Cloud是一个专业的游戏后端服务，提供稳定的实时多人游戏支持。

## 为什么选择Photon Cloud

### 优势
- **无需服务器部署**: 无需自己搭建和维护服务器
- **全球覆盖**: Photon在全球有多个数据中心，提供低延迟连接
- **专业稳定**: 专为游戏优化的实时通信服务
- **免费额度**: 提供免费使用额度，适合小型项目

### 与自建WebSocket服务器的对比
| 特性 | 自建WebSocket服务器 | Photon Cloud |
|------|-------------------|--------------|
| 服务器维护 | 需要自己维护 | 完全托管 |
| 部署复杂度 | 复杂 | 简单 |
| 成本 | 服务器费用 | 按使用量计费 |
| 扩展性 | 手动扩展 | 自动扩展 |
| 全球延迟 | 依赖服务器位置 | 全球多节点 |

## 快速开始

### 1. 注册Photon Cloud账户
1. 访问 [Photon Engine官网](https://www.photonengine.com/)
2. 注册免费账户
3. 登录到Photon Dashboard

### 2. 创建应用
1. 在Dashboard中点击"Create a New App"
2. 选择"Photon Realtime"服务
3. 填写应用名称（如："MyHTML5Game"）
4. 选择"LoadBalancing"应用类型
5. 创建应用

### 3. 获取App ID
1. 在应用详情页面找到"App ID"
2. 复制这个ID

### 4. 配置游戏代码
在 `photon-network.js` 文件中，将 `YOUR_PHOTON_APP_ID` 替换为你的实际App ID：

```javascript
// Photon Cloud配置
this.appId = '你的实际App ID'; // 替换这里
this.appVersion = '1.0';
```

### 5. 测试连接
1. 打开游戏页面
2. 点击"连接服务器"按钮
3. 如果连接成功，状态会显示"在线"

## 详细配置说明

### PhotonNetworkManager 类

#### 主要方法
- `connect()`: 连接到Photon Cloud
- `disconnect()`: 断开连接
- `joinOrCreateRoom()`: 加入或创建房间
- `sendPlayerMove(x, y, vx, vy)`: 发送玩家移动数据
- `sendWaveAttack(x, y)`: 发送波打法事件

#### 事件系统
Photon使用事件代码来区分不同类型的消息：

| 事件代码 | 用途 | 数据格式 |
|---------|------|----------|
| 1 | 玩家移动 | `{x, y, vx, vy}` |
| 2 | 波打法 | `{x, y, playerId}` |
| 3 | 游戏开始 | 无 |
| 4 | 游戏结束 | `{winner}` |

### 自定义事件
你可以根据需要添加更多事件类型：

```javascript
// 发送自定义事件
sendCustomEvent(eventCode, data) {
    if (!this.isConnected) return false;
    
    try {
        this.client.sendEvent(eventCode, data, { 
            receiverGroup: Photon.LoadBalancing.ReceiverGroup.All 
        });
        return true;
    } catch (error) {
        console.error('发送自定义事件失败:', error);
        return false;
    }
}

// 处理自定义事件
case 5: // 自定义事件
    if (this.game && content) {
        // 处理自定义事件数据
        this.game.handleCustomEvent(content);
    }
    break;
```

## 房间管理

### 房间选项
创建房间时可以设置各种选项：

```javascript
const roomOptions = {
    maxPlayers: 4,                    // 最大玩家数
    isVisible: true,                  // 房间是否可见
    isOpen: true,                     // 房间是否可加入
    customRoomProperties: {
        gameType: 'moba',             // 自定义属性
        map: 'forest',
        difficulty: 'normal'
    },
    customRoomPropertiesForLobby: ['gameType', 'map'] // 在房间列表中显示
};
```

### 房间匹配
Photon提供多种匹配方式：

```javascript
// 随机加入房间
this.client.joinRandomRoom();

// 根据属性匹配房间
this.client.joinRandomRoom({
    gameType: 'moba',
    map: 'forest'
});

// 创建特定名称的房间
this.client.createRoom('MyRoom', roomOptions);

// 加入特定名称的房间
this.client.joinRoom('MyRoom');
```

## 性能优化

### 1. 数据压缩
```javascript
// 发送优化后的移动数据
sendOptimizedMove(x, y, vx, vy) {
    // 使用整数而不是浮点数
    const data = {
        x: Math.round(x),
        y: Math.round(y),
        vx: Math.round(vx * 100) / 100, // 保留2位小数
        vy: Math.round(vy * 100) / 100
    };
    
    this.sendPlayerMove(data.x, data.y, data.vx, data.vy);
}
```

### 2. 发送频率控制
```javascript
// 限制移动数据发送频率
let lastMoveTime = 0;
const MOVE_SEND_INTERVAL = 50; // 50ms

sendThrottledMove(x, y, vx, vy) {
    const now = Date.now();
    if (now - lastMoveTime < MOVE_SEND_INTERVAL) {
        return;
    }
    
    lastMoveTime = now;
    this.sendPlayerMove(x, y, vx, vy);
}
```

### 3. 网络状态检测
```javascript
// 检测网络延迟
getNetworkStats() {
    if (!this.client) return null;
    
    return {
        ping: this.client.getRoundTripTime(),
        serverTimeOffset: this.client.getServerTimeOffset(),
        isConnected: this.isConnected
    };
}
```

## 错误处理

### 常见错误及解决方案

| 错误类型 | 原因 | 解决方案 |
|---------|------|----------|
| App ID错误 | App ID无效或未设置 | 检查App ID是否正确配置 |
| 网络连接失败 | 网络问题或Photon服务不可用 | 检查网络连接，重试连接 |
| 房间已满 | 房间达到最大玩家数 | 创建新房间或等待空位 |
| 版本不匹配 | 客户端版本与服务端不匹配 | 更新App Version配置 |

### 重连机制
```javascript
// 自动重连机制
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

handleDisconnect() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(() => {
            console.log(`尝试重连 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            this.connect();
        }, 2000); // 2秒后重试
    } else {
        console.error('重连失败，请检查网络连接');
        this.handleError('连接失败，请刷新页面重试');
    }
}
```

## 安全考虑

### 1. 输入验证
```javascript
// 验证玩家输入
validatePlayerInput(x, y, vx, vy) {
    // 检查数值范围
    if (x < 0 || x > 800 || y < 0 || y > 600) {
        return false;
    }
    
    // 检查速度限制
    if (Math.abs(vx) > 10 || Math.abs(vy) > 10) {
        return false;
    }
    
    return true;
}
```

### 2. 反作弊措施
```javascript
// 检测异常行为
detectCheating(playerId, currentData, previousData) {
    const distance = Math.sqrt(
        Math.pow(currentData.x - previousData.x, 2) + 
        Math.pow(currentData.y - previousData.y, 2)
    );
    
    // 如果移动距离过大，可能是作弊
    if (distance > 50) { // 假设最大合理移动距离
        console.warn(`检测到玩家 ${playerId} 可能作弊`);
        return true;
    }
    
    return false;
}
```

## 部署到生产环境

### 1. 域名配置
如果部署到自定义域名，确保：
- 域名已备案（如果需要）
- HTTPS证书有效
- CORS配置正确

### 2. CDN优化
考虑使用CDN加速静态资源：
- 将游戏文件上传到CDN
- 配置缓存策略
- 启用Gzip压缩

### 3. 监控和日志
```javascript
// 添加性能监控
window.addEventListener('beforeunload', () => {
    // 发送游戏统计信息
    const stats = {
        playTime: Date.now() - gameStartTime,
        playersMet: game.players.size,
        connectionQuality: networkManager.getNetworkStats()
    };
    
    // 可以发送到分析服务
    console.log('游戏统计:', stats);
});
```

## 故障排除

### 常见问题

**Q: 连接失败，显示"App ID无效"**
A: 检查Photon Dashboard中的App ID是否正确复制到代码中

**Q: 玩家可以连接但无法看到彼此**
A: 检查事件发送和接收逻辑，确保使用了正确的ReceiverGroup

**Q: 移动延迟过高**
A: 优化数据发送频率，检查网络连接质量

**Q: 房间无法创建或加入**
A: 检查房间选项配置，确保没有冲突的房间属性

### 调试技巧

1. **启用详细日志**
```javascript
// 在photon-network.js开头添加
const DEBUG = true;

if (DEBUG) {
    console.log = function(...args) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}]`, ...args);
    };
}
```

2. **网络状态监控**
```javascript
// 定期检查网络状态
setInterval(() => {
    const stats = networkManager.getNetworkStats();
    if (stats) {
        console.log('网络状态:', stats);
    }
}, 5000);
```

## 扩展功能

### 1. 好友系统
```javascript
// 邀请好友加入房间
inviteFriend(friendId, roomName) {
    // 实现好友邀请逻辑
}
```

### 2. 排行榜
```javascript
// 上传分数到Photon Cloud
uploadScore(score) {
    // 使用Photon的Webhooks或自定义逻辑
}
```

### 3. 聊天系统
```javascript
// 实现游戏内聊天
sendChatMessage(message) {
    const eventData = {
        type: 'chat',
        message: message,
        timestamp: Date.now(),
        playerId: this.playerId
    };
    
    this.sendCustomEvent(10, eventData);
}
```

## 资源链接

- [Photon Engine官网](https://www.photonengine.com/)
- [Photon Realtime文档](https://doc.photonengine.com/en-us/realtime/current)
- [JavaScript SDK下载](https://www.photonengine.com/sdks#realtime-javascript)
- [示例项目](https://github.com/PhotonEngine)

## 技术支持

如果遇到问题，可以通过以下方式获取帮助：
- Photon官方文档
- Photon社区论坛
- GitHub Issues（如果是开源项目）
- 邮件支持（付费用户）

---

**注意**: 本指南基于Photon Cloud的免费版本，生产环境使用时请根据实际需求选择合适的付费方案。