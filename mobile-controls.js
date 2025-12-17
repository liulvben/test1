// 移动端控制类
class MobileControls {
    constructor(game) {
        this.game = game;
        this.joystick = document.getElementById('joystick');
        this.joystickHandle = document.getElementById('joystick-handle');
        this.waveBtn = document.getElementById('mobile-wave-btn');
        
        this.joystickActive = false;
        this.joystickOrigin = { x: 0, y: 0 };
        this.joystickPosition = { x: 0, y: 0 };
        
        this.init();
    }
    
    init() {
        // 检测是否为移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            this.setupJoystick();
            this.setupActionButtons();
            console.log('移动端控制已初始化');
        }
    }
    
    setupJoystick() {
        // 获取摇杆中心位置
        const rect = this.joystick.getBoundingClientRect();
        this.joystickOrigin = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        
        // 触摸开始事件
        this.joystick.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.joystickActive = true;
            this.updateJoystickPosition(e.touches[0]);
        });
        
        // 触摸移动事件
        this.joystick.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.joystickActive) {
                this.updateJoystickPosition(e.touches[0]);
            }
        });
        
        // 触摸结束事件
        this.joystick.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.joystickActive = false;
            this.resetJoystick();
        });
        
        // 鼠标事件（用于桌面测试）
        this.joystick.addEventListener('mousedown', (e) => {
            this.joystickActive = true;
            this.updateJoystickPosition(e);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.joystickActive) {
                this.updateJoystickPosition(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (this.joystickActive) {
                this.joystickActive = false;
                this.resetJoystick();
            }
        });
    }
    
    updateJoystickPosition(touch) {
        // 获取摇杆中心位置（每次更新，因为窗口大小可能改变）
        const rect = this.joystick.getBoundingClientRect();
        this.joystickOrigin = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        
        // 计算触摸点相对于摇杆中心的位置
        const deltaX = touch.clientX - this.joystickOrigin.x;
        const deltaY = touch.clientY - this.joystickOrigin.y;
        
        // 计算距离
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = rect.width / 2 - 30; // 摇杆半径减去手柄半径
        
        // 限制摇杆移动范围
        let normalizedX = deltaX;
        let normalizedY = deltaY;
        
        if (distance > maxDistance) {
            normalizedX = (deltaX / distance) * maxDistance;
            normalizedY = (deltaY / distance) * maxDistance;
        }
        
        // 更新手柄位置
        this.joystickHandle.style.transform = `translate(calc(-50% + ${normalizedX}px), calc(-50% + ${normalizedY}px))`;
        
        // 计算方向向量（归一化）
        this.joystickPosition = {
            x: normalizedX / maxDistance,
            y: normalizedY / maxDistance
        };
        
        // 更新游戏中的玩家移动
        if (this.game && this.game.localPlayer) {
            const speed = 200; // 像素/秒
            this.game.localPlayer.setVelocity(
                this.joystickPosition.x * speed,
                this.joystickPosition.y * speed
            );
        }
    }
    
    resetJoystick() {
        // 重置手柄位置
        this.joystickHandle.style.transform = 'translate(-50%, -50%)';
        
        // 重置位置向量
        this.joystickPosition = { x: 0, y: 0 };
        
        // 停止玩家移动
        if (this.game && this.game.localPlayer) {
            this.game.localPlayer.setVelocity(0, 0);
        }
    }
    
    setupActionButtons() {
        // 波打法按钮事件
        this.waveBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.useWaveAttack();
        });
        
        this.waveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.useWaveAttack();
        });
    }
    
    useWaveAttack() {
        if (this.game && this.game.localPlayer) {
            this.game.useWaveAttack();
        }
    }
}

// 检测设备类型
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 在DOM加载完成后初始化移动端控制
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保游戏实例已创建
    setTimeout(() => {
        if (window.game && isMobileDevice()) {
            window.mobileControls = new MobileControls(window.game);
            console.log('移动端控制已启用');
        }
    }, 1000);
});