/**
 * WeChat Session Keeper - 微信会话保活
 * 通过模拟用户活动来防止微信网页版会话过期
 */

(function() {
    'use strict';

    // 配置对象
    const CONFIG = {
        riskLevel: 'low', // low, medium, high
        enableWebSocketMonitor: true,
        enableBackgroundKeepAlive: true, // 后台保活模式
        activityInterval: 300000, // 5分钟
        debugMode: false
    };

    // 会话保活器类
    class WeChatSessionKeeper {
        constructor() {
            this.isActive = false;
            this.lastActivity = Date.now();
            this.activityTimer = null;
            this.config = { ...CONFIG };

            this.loadConfig();
            this.init();
        }

        // 加载用户配置
        loadConfig() {
            try {
                const stored = localStorage.getItem('wechat-session-keeper-config');
                if (stored) {
                    this.config = { ...this.config, ...JSON.parse(stored) };
                }

                // 文件传输助手页面的特殊优化
                if (window.location.hostname.includes('filehelper.weixin.qq.com')) {
                    // 使用更保守的默认设置，避免干扰文件传输
                    if (!stored) {
                        this.config.riskLevel = 'low';
                        this.config.enableBackgroundKeepAlive = true;
                        this.config.activityInterval = 300000; // 5分钟
                    }
                }
            } catch (error) {
                console.warn('[SessionKeeper] 加载配置失败:', error);
            }
        }

        // 保存用户配置
        saveConfig() {
            try {
                localStorage.setItem('wechat-session-keeper-config', JSON.stringify(this.config));
            } catch (error) {
                console.warn('[SessionKeeper] 保存配置失败:', error);
            }
        }

        // 初始化
        init() {
            const pageType = window.location.hostname.includes('filehelper.weixin.qq.com') ? '文件传输助手' : '微信网页版';
            this.log('🚀 微信会话保活已启动 (' + pageType + ')');

            // 延迟启动，确保页面稳定（特别是Firefox可能的重定向）
            setTimeout(() => {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => {
                        this.start();
                    });
                } else {
                    this.start();
                }
            }, 1000); // 等待1秒，确保任何重定向都已完成
        }

        // 启动保活功能
        start() {
            this.setupPageVisibilityMonitor();
            this.setupUserActivityMonitor();
            this.setupPeriodicActivity();

            if (this.config.enableWebSocketMonitor) {
                this.setupWebSocketMonitor();
            }

            this.createStatusIndicator();
            this.log('✅ 所有监控已启动');
        }

        // 页面可见性监控
        setupPageVisibilityMonitor() {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    this.log('👀 页面变为可见，执行活跃操作');
                    this.onPageActive();
                }
            });
        }

        // 用户活动监控
        setupUserActivityMonitor() {
            const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
            const self = this;

            events.forEach(function(event) {
                document.addEventListener(event, function() {
                    self.onUserActivity();
                }, { passive: true });
            });
        }

        // 定期活跃操作
        setupPeriodicActivity() {
            const interval = this.getActivityInterval();
            const self = this;

            this.activityTimer = setInterval(function() {
                if (self.shouldSimulateActivity()) {
                    self.simulateNaturalActivity();
                }
            }, interval);

            this.log('⏰ 定期活跃检查已设置，间隔: ' + (interval / 1000) + '秒');
        }

        // WebSocket监控
        setupWebSocketMonitor() {
            const originalWebSocket = window.WebSocket;
            const self = this;

            window.WebSocket = function(url, protocols) {
                const ws = new originalWebSocket(url, protocols);

                ws.addEventListener('close', function(event) {
                    console.warn('[SessionKeeper] 🔌 WebSocket连接关闭:', {
                        url: url.toString(),
                        code: event.code,
                        reason: event.reason
                    });

                    // 非正常关闭时尝试恢复
                    if (event.code !== 1000 && event.code !== 1001) {
                        setTimeout(function() {
                            console.log('[SessionKeeper] 🔄 尝试恢复连接...');
                            window.location.reload();
                        }, 5000);
                    }
                });

                return ws;
            };

            this.log('🔌 WebSocket监控已启用');
        }

        // 模拟自然用户活动
        simulateNaturalActivity() {
            const isPageVisible = !document.hidden;

            // 页面不可见时使用更安全的保活策略
            if (!isPageVisible && this.config.enableBackgroundKeepAlive) {
                this.simulateBackgroundActivity();
            } else {
                // 页面可见时的正常保活策略
                if (this.config.riskLevel === 'low') {
                    this.simulateScroll();
                } else {
                    const activities = [
                        () => this.simulateScroll(),
                        () => this.simulateMouseMove(),
                        () => this.simulateFocus()
                    ];

                    const randomActivity = activities[Math.floor(Math.random() * activities.length)];
                    randomActivity();
                }
            }

            this.lastActivity = Date.now();
            this.log(`🔄 执行保活操作 (${isPageVisible ? '前台' : '后台'}模式)`);
            this.updateStatusIndicator();
        }

        // 模拟滚动
        simulateScroll() {
            // 文件传输助手页面可能没有足够的滚动空间，使用更安全的方式
            if (window.location.hostname.includes('filehelper.weixin.qq.com')) {
                // 使用最小化的操作，避免影响文件上传/下载
                this.simulateBackgroundActivity();
                return;
            }

            const originalScrollY = window.scrollY;
            window.scrollBy(0, 1);

            setTimeout(function() {
                try {
                    // 优先使用现代API
                    window.scrollTo({ top: originalScrollY, behavior: 'instant' });
                } catch (e) {
                    // 兼容旧浏览器
                    window.scrollTo(0, originalScrollY);
                }
            }, 100);
        }

        // 模拟鼠标移动
        simulateMouseMove() {
            const event = new MouseEvent('mousemove', {
                clientX: window.innerWidth / 2 + Math.random() * 2 - 1,
                clientY: window.innerHeight / 2 + Math.random() * 2 - 1,
                bubbles: false
            });
            document.dispatchEvent(event);
        }

        // 模拟焦点
        simulateFocus() {
            window.dispatchEvent(new Event('focus'));
        }

        // 后台保活活动（更安全、更隐蔽）
        simulateBackgroundActivity() {
            // 使用最安全的方式：轻微修改localStorage来触发存储事件
            try {
                const timestamp = Date.now().toString();
                localStorage.setItem('wechat-keepalive-heartbeat', timestamp);

                // 立即清除，避免污染存储
                setTimeout(() => {
                    localStorage.removeItem('wechat-keepalive-heartbeat');
                }, 100);
            } catch (e) {
                // 如果localStorage不可用，使用最小化的DOM操作
                this.simulateMinimalScroll();
            }
        }

        // 最小化滚动（用于后台模式的备选方案）
        simulateMinimalScroll() {
            const originalScrollY = window.scrollY;
            // 使用极小的滚动距离
            window.scrollBy(0, 0.1);

            setTimeout(() => {
                try {
                    window.scrollTo({ top: originalScrollY, behavior: 'instant' });
                } catch (e) {
                    window.scrollTo(0, originalScrollY);
                }
            }, 50);
        }

        // 判断是否应该模拟活动
        shouldSimulateActivity() {
            const timeSinceLastActivity = Date.now() - this.lastActivity;
            const hasBeenInactiveEnough = timeSinceLastActivity > this.getMinInactiveTime();

            // 支持后台保活模式
            if (this.config.enableBackgroundKeepAlive) {
                return hasBeenInactiveEnough;
            }

            // 传统模式：仅在页面可见时保活
            const isPageVisible = !document.hidden;
            return isPageVisible && hasBeenInactiveEnough;
        }

        // 获取活动间隔
        getActivityInterval() {
            switch (this.config.riskLevel) {
                case 'low': return 300000; // 5分钟
                case 'medium': return 120000; // 2分钟
                case 'high': return 60000; // 1分钟
                default: return this.config.activityInterval;
            }
        }

        // 获取最小非活跃时间
        getMinInactiveTime() {
            switch (this.config.riskLevel) {
                case 'low': return 240000; // 4分钟
                case 'medium': return 90000; // 1.5分钟
                case 'high': return 45000; // 45秒
                default: return 180000; // 3分钟
            }
        }

        // 页面活跃处理
        onPageActive() {
            this.isActive = true;
            this.lastActivity = Date.now();

            const self = this;
            setTimeout(function() {
                self.simulateNaturalActivity();
            }, 1000);
        }

        // 用户活动处理
        onUserActivity() {
            this.lastActivity = Date.now();
            this.isActive = true;
        }

        // 创建状态指示器和配置按钮
        createStatusIndicator() {
            // 主状态指示器
            const indicator = document.createElement('div');
            indicator.id = 'wechat-session-keeper-indicator';
            indicator.innerHTML = '🟢';
            indicator.title = '微信会话保活运行中 - 点击查看详情';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                width: 28px;
                height: 28px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 10000;
                font-size: 14px;
                user-select: none;
                border: 2px solid #07c160;
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            `;

            // 配置按钮
            const configButton = document.createElement('div');
            configButton.id = 'wechat-session-keeper-config';
            configButton.innerHTML = '⚙️';
            configButton.title = '会话保活设置 - 点击配置';
            configButton.style.cssText = `
                position: fixed;
                top: 48px;
                right: 10px;
                width: 28px;
                height: 28px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 9999;
                font-size: 12px;
                user-select: none;
                border: 2px solid #666;
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            `;

            const self = this;

            // 状态指示器事件
            indicator.addEventListener('click', function() {
                self.showStatus();
            });

            indicator.addEventListener('mouseenter', function() {
                indicator.style.transform = 'scale(1.1)';
            });

            indicator.addEventListener('mouseleave', function() {
                indicator.style.transform = 'scale(1)';
            });

            // 配置按钮事件
            configButton.addEventListener('click', function() {
                self.showConfigDialog();
            });

            configButton.addEventListener('mouseenter', function() {
                configButton.style.transform = 'scale(1.1)';
                configButton.style.borderColor = '#07c160';
            });

            configButton.addEventListener('mouseleave', function() {
                configButton.style.transform = 'scale(1)';
                configButton.style.borderColor = '#666';
            });

            document.body.appendChild(indicator);
            document.body.appendChild(configButton);
        }

        // 更新状态指示器
        updateStatusIndicator() {
            const indicator = document.getElementById('wechat-session-keeper-indicator');
            if (indicator) {
                indicator.style.borderColor = '#ff6b6b';
                indicator.innerHTML = '🔄';

                setTimeout(function() {
                    indicator.style.borderColor = '#07c160';
                    indicator.innerHTML = '🟢';
                }, 1000);
            }
        }

        // 显示状态
        showStatus() {
            const timeSinceLastActivity = Math.round((Date.now() - this.lastActivity) / 1000);
            const lastActivityTime = new Date(this.lastActivity).toLocaleTimeString();
            const pageType = window.location.hostname.includes('filehelper.weixin.qq.com') ? '📁 文件传输助手' : '💬 微信网页版';

            const statusMessage = `微信会话保活状态：

📌 页面类型: ${pageType}
🟢 运行状态: ${this.isActive ? '活跃' : '待机'}
📱 页面状态: ${document.hidden ? '后台运行' : '前台活跃'}
⏰ 最后活动: ${lastActivityTime}
📊 距离上次活动: ${timeSinceLastActivity} 秒
⚙️ 风险等级: ${this.config.riskLevel}
🌙 后台保活: ${this.config.enableBackgroundKeepAlive ? '已启用' : '已禁用'}
🔌 WebSocket监控: ${this.config.enableWebSocketMonitor ? '已启用' : '已禁用'}
🐛 调试模式: ${this.config.debugMode ? '已启用' : '已禁用'}

💡 点击右侧设置按钮 ⚙️ 进行详细配置`;

            alert(statusMessage);
        }

        // 显示配置对话框
        showConfigDialog() {
            // 如果已经存在对话框，先移除
            const existingDialog = document.getElementById('session-keeper-config-dialog');
            if (existingDialog) {
                existingDialog.remove();
                return;
            }

            const self = this;

            // 创建背景遮罩
            const overlay = document.createElement('div');
            overlay.id = 'session-keeper-config-dialog';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                z-index: 20000;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(3px);
            `;

            // 创建对话框
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 12px 48px rgba(0, 0, 0, 0.25);
                max-width: 480px;
                width: 88%;
                max-height: 90vh;
                overflow-y: auto;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #333;
                animation: slideIn 0.3s ease-out;
            `;

            // 添加动画样式
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);

            const isFileHelper = window.location.hostname.includes('filehelper.weixin.qq.com');
            const fileHelperTip = isFileHelper ? `
                <div style="margin-bottom: 16px; padding: 12px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 8px; border-left: 3px solid #3b82f6;">
                    <h4 style="margin: 0 0 6px 0; color: #1e40af; font-size: 13px; font-weight: 600;">📁 文件传输助手模式</h4>
                    <div style="font-size: 11px; color: #1e40af; line-height: 1.4;">
                        已自动优化为文件传输场景，使用最安全的保活策略，不会干扰文件上传下载。
                    </div>
                </div>
            ` : '';

            dialog.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; color: #333; font-size: 20px; font-weight: 600;">🔄 会话保活设置</h3>
                    <button id="closeBtn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s ease;">×</button>
                </div>

                ${fileHelperTip}

                <div style="margin-bottom: 16px; padding: 14px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 8px; border-left: 3px solid #07c160;">
                    <h4 style="margin: 0 0 8px 0; color: #07c160; font-size: 14px; font-weight: 600;">💡 当前状态</h4>
                    <div id="statusInfo" style="font-size: 12px; color: #666; line-height: 1.4;"></div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">🛡️ 安全等级</label>
                    <div style="display: grid; gap: 8px;">
                        <label style="display: flex; align-items: center; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;" data-risk="low">
                            <input type="radio" name="riskLevel" value="low" style="margin-right: 10px; transform: scale(1.1);">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #059669; font-size: 13px; margin-bottom: 2px;">🛡️ 低风险模式 (推荐)</div>
                                <div style="font-size: 11px; color: #6b7280; line-height: 1.3;">5分钟间隔，仅使用轻微滚动</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;" data-risk="medium">
                            <input type="radio" name="riskLevel" value="medium" style="margin-right: 10px; transform: scale(1.1);">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #d97706; font-size: 13px; margin-bottom: 2px;">⚖️ 中等风险模式</div>
                                <div style="font-size: 11px; color: #6b7280; line-height: 1.3;">2分钟间隔，包含鼠标移动</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;" data-risk="high">
                            <input type="radio" name="riskLevel" value="high" style="margin-right: 10px; transform: scale(1.1);">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #dc2626; font-size: 13px; margin-bottom: 2px;">⚠️ 高风险模式</div>
                                <div style="font-size: 11px; color: #6b7280; line-height: 1.3;">1分钟间隔，所有操作</div>
                            </div>
                        </label>
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">⏱️ 活动间隔</label>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <input type="range" id="activityInterval" min="60" max="600" step="30"
                               style="flex: 1; height: 6px; border-radius: 3px; background: #e5e7eb; outline: none;">
                        <div id="intervalValue" style="min-width: 60px; font-weight: 600; color: #07c160; text-align: center; padding: 6px 10px; background: #f0f9ff; border-radius: 6px; font-size: 12px;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 10px; color: #9ca3af;">
                        <span>1分钟</span>
                        <span>10分钟</span>
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <div style="display: grid; gap: 8px;">
                        <label style="display: flex; align-items: center; padding: 10px 12px; background: #f9fafb; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;" id="backgroundLabel">
                            <input type="checkbox" id="enableBackgroundKeepAlive" style="margin-right: 10px; transform: scale(1.2);">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #333; font-size: 13px; margin-bottom: 2px;">🌙 后台保活模式 (推荐)</div>
                                <div style="font-size: 11px; color: #6b7280; line-height: 1.3;">页面切换到后台时继续保活</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center; padding: 10px 12px; background: #f9fafb; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;" id="websocketLabel">
                            <input type="checkbox" id="enableWebSocket" style="margin-right: 10px; transform: scale(1.2);">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #333; font-size: 13px; margin-bottom: 2px;">🔌 WebSocket连接监控</div>
                                <div style="font-size: 11px; color: #6b7280; line-height: 1.3;">自动检测连接断开并尝试恢复</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center; padding: 10px 12px; background: #f9fafb; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;" id="debugLabel">
                            <input type="checkbox" id="debugMode" style="margin-right: 10px; transform: scale(1.2);">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #333; font-size: 13px; margin-bottom: 2px;">🐛 调试模式</div>
                                <div style="font-size: 11px; color: #6b7280; line-height: 1.3;">在浏览器控制台显示详细日志</div>
                            </div>
                        </label>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-bottom: 12px;">
                    <button id="resetBtn" style="padding: 8px 16px; border: 2px solid #e5e7eb; background: white; color: #374151; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s ease; font-size: 12px;">
                        🔄 重置默认
                    </button>
                    <button id="saveBtn" style="padding: 8px 16px; background: linear-gradient(135deg, #07c160 0%, #059669 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; box-shadow: 0 3px 8px rgba(7, 193, 96, 0.3); transition: all 0.2s ease; font-size: 12px;">
                        💾 保存配置
                    </button>
                </div>

                <div style="padding: 12px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; font-size: 11px; line-height: 1.4;">
                    <div style="font-weight: 600; color: #d97706; margin-bottom: 6px;">⚠️ 重要提示</div>
                    <div style="color: #92400e;">
                        • 使用保活功能存在账号风险，建议低风险模式<br>
                        • 避免24小时连续运行，适度使用更安全<br>
                        • 如收到任何警告，请立即停止使用
                    </div>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // 设置当前配置值
            this.updateConfigDialog(dialog);

            // 绑定事件
            this.bindConfigDialogEvents(dialog, overlay);
        }

        // 更新配置对话框的值
        updateConfigDialog(dialog) {
            if (!dialog) return;

            const status = this.getStatus();
            const timeSinceLastActivity = Math.round(status.timeSinceLastActivity / 1000);

            // 更新状态信息
            const statusInfo = dialog.querySelector('#statusInfo');
            if (statusInfo) {
                statusInfo.innerHTML = `
                    <div style="margin-bottom: 8px;">🟢 运行状态: <strong>${status.isActive ? '活跃' : '待机'}</strong></div>
                    <div style="margin-bottom: 8px;">📱 页面状态: <strong>${document.hidden ? '后台运行' : '前台活跃'}</strong></div>
                    <div style="margin-bottom: 8px;">⏰ 最后活动: <strong>${status.lastActivity.toLocaleTimeString()}</strong></div>
                    <div style="margin-bottom: 8px;">📊 距上次活动: <strong>${timeSinceLastActivity} 秒</strong></div>
                    <div>⚙️ 当前模式: <strong>${this.getRiskLevelText(this.config.riskLevel)}</strong></div>
                `;
            }

            // 设置风险等级
            const riskRadios = dialog.querySelectorAll('input[name="riskLevel"]');
            riskRadios.forEach(function(radio) {
                if (radio.value === status.config.riskLevel) {
                    radio.checked = true;
                    if (radio.parentElement) {
                        radio.parentElement.style.borderColor = '#07c160';
                        radio.parentElement.style.backgroundColor = '#f0f9ff';
                    }
                }
            });

            // 设置活动间隔
            const intervalSlider = dialog.querySelector('#activityInterval');
            const intervalValue = dialog.querySelector('#intervalValue');
            if (intervalSlider && intervalValue) {
                intervalSlider.value = status.config.activityInterval / 1000;
                intervalValue.textContent = (status.config.activityInterval / 1000) + '秒';
            }

            // 设置复选框
            const enableBackgroundKeepAlive = dialog.querySelector('#enableBackgroundKeepAlive');
            const enableWebSocket = dialog.querySelector('#enableWebSocket');
            const debugMode = dialog.querySelector('#debugMode');
            if (enableBackgroundKeepAlive) enableBackgroundKeepAlive.checked = status.config.enableBackgroundKeepAlive;
            if (enableWebSocket) enableWebSocket.checked = status.config.enableWebSocketMonitor;
            if (debugMode) debugMode.checked = status.config.debugMode;

            // 更新复选框样式
            this.updateCheckboxStyles(dialog);
        }

        // 获取风险等级文本
        getRiskLevelText(level) {
            switch(level) {
                case 'low': return '🛡️ 低风险';
                case 'medium': return '⚖️ 中等风险';
                case 'high': return '⚠️ 高风险';
                default: return '未知';
            }
        }

        // 更新复选框样式
        updateCheckboxStyles(dialog) {
            const backgroundCheck = dialog.querySelector('#enableBackgroundKeepAlive');
            const websocketCheck = dialog.querySelector('#enableWebSocket');
            const debugCheck = dialog.querySelector('#debugMode');
            const backgroundLabel = dialog.querySelector('#backgroundLabel');
            const websocketLabel = dialog.querySelector('#websocketLabel');
            const debugLabel = dialog.querySelector('#debugLabel');

            if (backgroundCheck.checked) {
                backgroundLabel.style.backgroundColor = '#f0f4ff';
                backgroundLabel.style.borderLeft = '4px solid #6366f1';
            } else {
                backgroundLabel.style.backgroundColor = '#f9fafb';
                backgroundLabel.style.borderLeft = 'none';
            }

            if (websocketCheck.checked) {
                websocketLabel.style.backgroundColor = '#f0f9ff';
                websocketLabel.style.borderLeft = '4px solid #07c160';
            } else {
                websocketLabel.style.backgroundColor = '#f9fafb';
                websocketLabel.style.borderLeft = 'none';
            }

            if (debugCheck.checked) {
                debugLabel.style.backgroundColor = '#fff7ed';
                debugLabel.style.borderLeft = '4px solid #ea580c';
            } else {
                debugLabel.style.backgroundColor = '#f9fafb';
                debugLabel.style.borderLeft = 'none';
            }
        }

        // 绑定配置对话框事件
        bindConfigDialogEvents(dialog, overlay) {
            const self = this;

            // 关闭按钮
            const closeBtn = dialog.querySelector('#closeBtn');
            closeBtn.addEventListener('click', function() {
                overlay.remove();
            });

            closeBtn.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#f3f4f6';
            });

            closeBtn.addEventListener('mouseleave', function() {
                this.style.backgroundColor = 'transparent';
            });

            // 点击背景关闭
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) {
                    overlay.remove();
                }
            });

            // 风险等级选择
            const riskRadios = dialog.querySelectorAll('input[name="riskLevel"]');
            riskRadios.forEach(function(radio) {
                radio.addEventListener('change', function() {
                    // 重置所有样式
                    riskRadios.forEach(function(r) {
                        r.parentElement.style.borderColor = '#e5e7eb';
                        r.parentElement.style.backgroundColor = 'white';
                    });

                    // 高亮选中项
                    if (this.checked) {
                        this.parentElement.style.borderColor = '#07c160';
                        this.parentElement.style.backgroundColor = '#f0f9ff';
                    }

                    // 更新间隔滑块
                    const intervalSlider = dialog.querySelector('#activityInterval');
                    const intervalValue = dialog.querySelector('#intervalValue');

                    if (this.value === 'low') {
                        intervalSlider.value = 300;
                        intervalValue.textContent = '300秒';
                    } else if (this.value === 'medium') {
                        intervalSlider.value = 120;
                        intervalValue.textContent = '120秒';
                    } else if (this.value === 'high') {
                        intervalSlider.value = 60;
                        intervalValue.textContent = '60秒';
                    }
                });
            });

            // 间隔滑块
            const intervalSlider = dialog.querySelector('#activityInterval');
            const intervalValue = dialog.querySelector('#intervalValue');

            intervalSlider.addEventListener('input', function() {
                intervalValue.textContent = this.value + '秒';
            });

            // 复选框样式更新
            const backgroundCheck = dialog.querySelector('#enableBackgroundKeepAlive');
            const websocketCheck = dialog.querySelector('#enableWebSocket');
            const debugCheck = dialog.querySelector('#debugMode');

            backgroundCheck.addEventListener('change', function() {
                self.updateCheckboxStyles(dialog);
            });

            websocketCheck.addEventListener('change', function() {
                self.updateCheckboxStyles(dialog);
            });

            debugCheck.addEventListener('change', function() {
                self.updateCheckboxStyles(dialog);
            });

            // 重置按钮
            const resetBtn = dialog.querySelector('#resetBtn');
            resetBtn.addEventListener('click', function() {
                // 重置为默认配置
                dialog.querySelector('input[value="low"]').checked = true;
                intervalSlider.value = 300;
                intervalValue.textContent = '300秒';
                backgroundCheck.checked = true;
                websocketCheck.checked = true;
                debugCheck.checked = false;

                // 更新样式
                riskRadios.forEach(function(r) {
                    r.parentElement.style.borderColor = '#e5e7eb';
                    r.parentElement.style.backgroundColor = 'white';
                });
                dialog.querySelector('input[value="low"]').parentElement.style.borderColor = '#07c160';
                dialog.querySelector('input[value="low"]').parentElement.style.backgroundColor = '#f0f9ff';

                self.updateCheckboxStyles(dialog);

                // 显示重置成功
                this.textContent = '✅ 已重置';
                this.style.background = '#10b981';
                this.style.color = 'white';
                this.style.borderColor = '#10b981';

                setTimeout(function() {
                    resetBtn.textContent = '🔄 重置默认';
                    resetBtn.style.background = 'white';
                    resetBtn.style.color = '#374151';
                    resetBtn.style.borderColor = '#e5e7eb';
                }, 1500);
            });

            resetBtn.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#f9fafb';
                this.style.borderColor = '#d1d5db';
            });

            resetBtn.addEventListener('mouseleave', function() {
                if (this.textContent === '🔄 重置默认') {
                    this.style.backgroundColor = 'white';
                    this.style.borderColor = '#e5e7eb';
                }
            });

            // 保存按钮
            const saveBtn = dialog.querySelector('#saveBtn');
            saveBtn.addEventListener('click', function() {
                // 获取新配置
                const selectedRisk = dialog.querySelector('input[name="riskLevel"]:checked').value;
                const newConfig = {
                    riskLevel: selectedRisk,
                    activityInterval: parseInt(intervalSlider.value) * 1000,
                    enableBackgroundKeepAlive: backgroundCheck.checked,
                    enableWebSocketMonitor: websocketCheck.checked,
                    debugMode: debugCheck.checked
                };

                // 应用配置
                self.updateConfig(newConfig);

                // 显示保存成功
                this.textContent = '✅ 保存成功';
                this.style.background = '#10b981';
                this.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';

                setTimeout(function() {
                    saveBtn.textContent = '💾 保存配置';
                    saveBtn.style.background = 'linear-gradient(135deg, #07c160 0%, #059669 100%)';
                    saveBtn.style.boxShadow = '0 4px 12px rgba(7, 193, 96, 0.3)';

                    // 更新状态信息
                    self.updateConfigDialog(dialog);
                }, 1500);
            });

            saveBtn.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-1px)';
                this.style.boxShadow = '0 6px 16px rgba(7, 193, 96, 0.4)';
            });

            saveBtn.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                if (this.textContent === '💾 保存配置') {
                    this.style.boxShadow = '0 4px 12px rgba(7, 193, 96, 0.3)';
                }
            });
        }

        // 更新配置
        updateConfig(newConfig) {
            const oldConfig = Object.assign({}, this.config);
            this.config = Object.assign({}, this.config, newConfig);
            this.saveConfig();
            this.log('⚙️ 配置已更新', this.config);

            // 重启定时器以应用新的间隔设置
            if (this.activityTimer) {
                clearInterval(this.activityTimer);
                this.setupPeriodicActivity();
            }

            // 如果WebSocket监控设置发生变化，给出提示
            if (oldConfig.enableWebSocketMonitor !== this.config.enableWebSocketMonitor) {
                console.log('[SessionKeeper] WebSocket监控设置已更改，重新加载页面后生效');
            }

            this.log('📊 配置更新完成', {
                old: oldConfig,
                new: this.config
            });
        }

        // 获取状态
        getStatus() {
            return {
                isActive: this.isActive,
                lastActivity: new Date(this.lastActivity),
                timeSinceLastActivity: Date.now() - this.lastActivity,
                config: this.config
            };
        }

        // 停止保活
        stop() {
            if (this.activityTimer) {
                clearInterval(this.activityTimer);
                this.activityTimer = null;
            }
            this.log('🛑 会话保活已停止');
        }

        // 日志输出
        log(message) {
            if (this.config.debugMode) {
                console.log('[SessionKeeper] ' + message);
            }
        }
    }

    // 检查是否在微信页面
    function isWeChatPage() {
        const hostname = window.location.hostname;
        const wechatDomains = [
            'web.weixin.qq.com',
            'web.wechat.com',
            'web1.wechat.com',
            'web2.wechat.com',
            'wx.qq.com',
            'wx2.qq.com',
            'wx8.qq.com',
            'filehelper.weixin.qq.com'
        ];

        return wechatDomains.some(function(domain) {
            return hostname.includes(domain);
        });
    }

    // 检查是否是文件传输助手页面
    function isFileHelperPage() {
        return window.location.hostname.includes('filehelper.weixin.qq.com');
    }

    // 只在微信页面运行，并防止重复初始化
    if (isWeChatPage() && !window.sessionKeeper) {
        const sessionKeeper = new WeChatSessionKeeper();

        // 全局暴露，方便调试
        window.sessionKeeper = sessionKeeper;

        const pageType = isFileHelperPage() ? '文件传输助手' : '微信网页版';
        console.log('🎉 微信会话保活插件已加载！(' + pageType + ')');

        if (isFileHelperPage()) {
            console.log('📁 检测到文件传输助手页面，已启用特殊优化模式');
            console.log('   - 使用最安全的保活策略');
            console.log('   - 避免干扰文件上传/下载');
        }

        console.log('💡 提示：输入 sessionKeeper.getStatus() 查看状态');
        console.log('💡 提示：输入 sessionKeeper.updateConfig({riskLevel: "medium"}) 修改配置');
    } else if (window.sessionKeeper) {
        console.log('ℹ️ 微信会话保活插件已存在，跳过重复初始化');
    }

})();