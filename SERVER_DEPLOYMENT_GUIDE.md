# MOBA游戏服务器部署指南

## 问题分析

当游戏部署到GitHub Pages后，不同设备之间无法连接服务器，这是因为：

1. **GitHub Pages是静态托管服务** - 只能托管HTML/CSS/JS文件，无法运行Node.js服务器
2. **localhost限制** - 每个设备都试图连接到自己的localhost:8080，无法实现跨设备连接
3. **需要独立的游戏服务器** - 必须将服务器部署到可公开访问的云服务器上

## 解决方案

### 方案1：使用云服务器部署（推荐）

将游戏服务器部署到云服务提供商，如：

- **Heroku** (免费层可用)
- **Railway** (免费额度)
- **DigitalOcean** (性价比高)
- **阿里云/腾讯云** (国内访问快)

### 方案2：使用WebSocket托管服务

- **Pusher**
- **Socket.io**
- **Ably**

### 方案3：局域网内使用（开发测试）

- 在同一局域网内，使用服务器的局域网IP地址

## 服务器部署步骤（以Heroku为例）

### 1. 准备部署文件

创建 `Procfile` 文件：
```
web: node server.js
```

### 2. 修改服务器配置

在 `server.js` 中修改端口配置：
```javascript
const PORT = process.env.PORT || 8080;
```

### 3. 部署到Heroku

```bash
# 安装Heroku CLI
# 登录Heroku
heroku login

# 创建Heroku应用
heroku create your-game-server-name

# 部署代码
git push heroku main

# 查看应用状态
heroku open
```

### 4. 获取服务器地址

部署成功后，Heroku会提供类似这样的地址：
- Web地址: `https://your-game-server-name.herokuapp.com`
- WebSocket地址: `wss://your-game-server-name.herokuapp.com`

## 客户端配置

### 修改服务器地址

在游戏页面中，输入远程服务器地址：
- WebSocket地址: `wss://your-game-server-name.herokuapp.com`

### 预设服务器地址

我已经为游戏添加了预设服务器地址功能：
- **本地**按钮: `ws://localhost:8080` (开发测试用)
- **远程**按钮: `ws://your-server.com:8080` (需要替换为实际地址)

## 服务器配置说明

### 服务器文件结构
```
server.js          # 主服务器文件
package.json       # 依赖配置
Procfile           # Heroku部署配置
```

### 端口和协议
- **HTTP端口**: 使用环境变量 `PORT` (云服务自动分配)
- **WebSocket协议**: 根据环境自动选择 `ws://` 或 `wss://`

## 安全注意事项

1. **使用HTTPS/WSS** - 生产环境必须使用安全协议
2. **CORS配置** - 服务器已配置允许跨域访问
3. **输入验证** - 服务器对客户端输入进行验证
4. **速率限制** - 考虑添加API调用频率限制

## 测试连接

### 本地测试
1. 启动本地服务器: `node server.js`
2. 访问: `http://localhost:8080`
3. 使用"本地"预设按钮连接

### 远程测试
1. 部署服务器到云平台
2. 获取服务器地址
3. 在GitHub Pages页面输入远程地址
4. 多设备测试连接

## 故障排除

### 常见问题

1. **连接失败**
   - 检查服务器是否正常运行
   - 验证服务器地址格式
   - 查看浏览器控制台错误信息

2. **跨域问题**
   - 确保服务器CORS配置正确
   - 检查协议一致性 (http/https, ws/wss)

3. **防火墙问题**
   - 确保云服务器端口开放
   - 检查安全组规则

### 调试工具

- 浏览器开发者工具 → 网络标签
- 服务器日志输出
- WebSocket连接状态监控

## 性能优化建议

1. **服务器优化**
   - 使用集群模式处理多连接
   - 实现房间系统管理玩家
   - 添加心跳检测保持连接

2. **客户端优化**
   - 实现连接重试机制
   - 添加连接状态指示器
   - 优化网络数据传输

## 扩展功能

考虑为游戏添加以下功能：
- 用户认证系统
- 游戏房间管理
- 排行榜系统
- 聊天功能
- 观战模式

---

**注意**: 部署到生产环境前，请确保进行充分测试，特别是多玩家同时在线的情况。