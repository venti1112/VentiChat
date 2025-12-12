const si = require('systeminformation');
const fs = require('fs');
const path = require('path');
const cluster = require('cluster');
const { log } = require('./logger');
const redisClient = require('./redisClient');
const models = require('../models');

class SystemMonitor {
    constructor() {
        // 只有主进程才加载历史数据
        if (cluster.isMaster || cluster.isPrimary) {
            this.monitoring = false;
            this.monitorInterval = null;
            this.history = [];
            this.maxHistoryLength = 4320; // 保存最近4320个数据点（12小时的数据，每5秒一个点）
            this.previousNetworkStats = {}; // 保存上一次的网络统计数据
            this.previousDiskIOStats = {};  // 保存上一次的磁盘IO统计数据
            // 移除历史数据加载功能
        }
    }

    // 检查是否应该启用系统监控
    async isMonitoringEnabled() {
        try {
            const settings = await models.SystemSetting.findOne();
            return settings ? settings.enableSystemMonitor : true;
        } catch (error) {
            log('ERROR', `检查系统监控设置失败: ${error.message}`);
            // 出错时默认启用监控
            return true;
        }
    }

    // 强制更新监控状态
    async updateMonitoringState() {
        // 只有主进程才能控制监控
        if (!(cluster.isMaster || cluster.isPrimary)) return;

        const shouldBeEnabled = await this.isMonitoringEnabled();
        
        if (shouldBeEnabled && !this.monitoring) {
            // 应该启用但当前未启用，启动监控
            await this.startMonitoring();
        } else if (!shouldBeEnabled && this.monitoring) {
            // 应该禁用但当前已启用，停止监控
            await this.stopMonitoring();
        }
    }

    // 开始监控
    async startMonitoring(interval = 5000) { // 默认每5秒收集一次数据
        // 只有主进程才能启动监控
        if (!(cluster.isMaster || cluster.isPrimary)) return;
        
        // 检查是否启用了系统监控
        const enabled = await this.isMonitoringEnabled();
        if (!enabled) {
            log('INFO', '系统监控未启用，跳过启动监控');
            return;
        }

        if (this.monitoring) return;

        this.monitoring = true;
        this.collectData(); // 立即收集一次数据
        this.monitorInterval = setInterval(() => {
            this.collectData();
        }, interval);

        log('INFO', `系统监控已启动，采样间隔: ${interval}ms`);
    }

    // 停止监控
    async stopMonitoring() {
        // 只有主进程才能停止监控
        if (!(cluster.isMaster || cluster.isPrimary)) return;
        
        // 检查是否启用了系统监控
        const enabled = await this.isMonitoringEnabled();
        if (!enabled && this.monitoring) {
            this.monitoring = false;
            if (this.monitorInterval) {
                clearInterval(this.monitorInterval);
                this.monitorInterval = null;
            }
            
            log('INFO', '系统监控已禁用，正在停止监控');
        } else if (!this.monitoring) {
            return;
        } else {
            this.monitoring = false;
            if (this.monitorInterval) {
                clearInterval(this.monitorInterval);
                this.monitorInterval = null;
            }
            
            log('INFO', '系统监控已停止');
        }
    }

    // 收集系统数据
    async collectData() {
        // 只有主进程才能收集数据
        if (!(cluster.isMaster || cluster.isPrimary)) return;
        
        // 检查是否启用了系统监控
        const enabled = await this.isMonitoringEnabled();
        if (!enabled) {
            // 如果监控被禁用，但仍在运行，则停止监控
            if (this.monitoring) {
                this.stopMonitoring();
            }
            return;
        }
        
        try {
            const timestamp = Date.now();
            
            // 收集CPU使用率
            const cpuData = await si.currentLoad();
            const cpuUsage = cpuData.currentLoad;
            
            // 收集内存使用率和详细信息
            const memData = await si.mem();
            const memoryUsage = (memData.active / memData.total) * 100;
            
            // 收集网络IO数据
            const networkData = await si.networkStats();
            let networkUsage = { received: 0, transmitted: 0 };
            
            if (networkData && networkData.length > 0) {
                // 获取主要网络接口的数据（排除回环接口）
                const primaryInterface = networkData.find(iface => iface.iface !== 'lo') || networkData[0];
                
                // 计算IO速度（B/s 转换为 KB/s）
                if (this.previousNetworkStats[primaryInterface.iface]) {
                    const timeDiff = (timestamp - this.previousNetworkStats[primaryInterface.iface].timestamp) / 1000; // 秒
                    if (timeDiff > 0) {
                        const rxBytes = primaryInterface.rx_bytes - this.previousNetworkStats[primaryInterface.iface].rx_bytes;
                        const txBytes = primaryInterface.tx_bytes - this.previousNetworkStats[primaryInterface.iface].tx_bytes;
                        
                        networkUsage = {
                            received: Math.max(0, (rxBytes / timeDiff) / 1024), // 转换为KB/s
                            transmitted: Math.max(0, (txBytes / timeDiff) / 1024) // 转换为KB/s
                        };
                    }
                }
                
                // 保存当前数据用于下次计算
                this.previousNetworkStats[primaryInterface.iface] = {
                    rx_bytes: primaryInterface.rx_bytes,
                    tx_bytes: primaryInterface.tx_bytes,
                    timestamp: timestamp
                };
            }
            
            // 收集磁盘IO数据
            const diskIOData = await si.disksIO();
            let diskIOUsage = { read: 0, write: 0 };
            
            if (diskIOData) {
                // 计算IO速度（数据传输速率）
                if (Object.keys(this.previousDiskIOStats).length > 0) {
                    const timeDiff = (timestamp - this.previousDiskIOStats.timestamp) / 1000; // 秒
                    if (timeDiff > 0) {
                        const readBytes = diskIOData.rIO_sec; // systeminformation已经提供了每秒读取字节数
                        const writeBytes = diskIOData.wIO_sec; // systeminformation已经提供了每秒写字节数
                        
                        diskIOUsage = {
                            read: Math.max(0, readBytes / 1024), // 转换为KB/s
                            write: Math.max(0, writeBytes / 1024) // 转换为KB/s
                        };
                    }
                }
                
                // 保存当前数据用于下次计算
                this.previousDiskIOStats = {
                    rIO_sec: diskIOData.rIO_sec,
                    wIO_sec: diskIOData.wIO_sec,
                    timestamp: timestamp
                };
            }
            
            const dataPoint = {
                timestamp,
                cpu: Math.round(cpuUsage * 100) / 100,
                memory: Math.round(memoryUsage * 100) / 100,
                // 添加详细的内存信息（以MB为单位）
                memoryDetails: {
                    total: Math.round(memData.total / (1024 * 1024)), // 转换为MB
                    active: Math.round(memData.active / (1024 * 1024)), // 转换为MB
                    available: Math.round(memData.available / (1024 * 1024)) // 转换为MB
                },
                network: {
                    received: Math.round(networkUsage.received * 100) / 100,
                    transmitted: Math.round(networkUsage.transmitted * 100) / 100
                },
                diskIO: { // 使用磁盘IO速度而不是使用率
                    read: Math.round(diskIOUsage.read * 100) / 100,
                    write: Math.round(diskIOUsage.write * 100) / 100
                }
            };

            // 添加到历史记录
            this.history.push(dataPoint);
            
            // 保持历史记录长度在限制范围内
            if (this.history.length > this.maxHistoryLength) {
                this.history.shift();
            }
            
            // 将最新数据存储到Redis中，供工作进程获取
            await redisClient.setEx('system_metrics:latest', 300, JSON.stringify(dataPoint)); // 5分钟过期
            
            // 将历史数据也存储到Redis中
            await redisClient.setEx('system_metrics:history', 300, JSON.stringify(this.history)); // 5分钟过期

            log('DEBUG', `系统监控数据已收集: CPU=${dataPoint.cpu}% MEM=${dataPoint.memory}% NET_RX=${dataPoint.network.received}KB/s NET_TX=${dataPoint.network.transmitted}KB/s DISK_R=${dataPoint.diskIO.read}KB/s DISK_W=${dataPoint.diskIO.write}KB/s`);
        } catch (error) {
            log('ERROR', `收集系统监控数据时出错: ${error.message}`);
        }
    }

    // 获取在线用户数
    getOnlineUsersCount(io) {
        if (!io) return 0;
        
        // 统计连接的socket数量
        let count = 0;
        for (const [id, socket] of io.sockets.sockets) {
            if (socket.connected) {
                count++;
            }
        }
        return count;
    }

    // 获取历史数据
    getHistory() {
        // 只有主进程才有历史数据
        if (!(cluster.isMaster || cluster.isPrimary)) return [];
        return [...this.history]; // 返回副本
    }

    // 清除历史数据
    clearHistory() {
        // 只有主进程才能清除历史数据
        if (!(cluster.isMaster || cluster.isPrimary)) return;
        
        this.history = [];
    }
    
    // 从Redis获取最新监控数据（供工作进程使用）
    async getLatestMetricsFromRedis() {
        try {
            const metricsStr = await redisClient.get('system_metrics:latest');
            if (metricsStr) {
                return JSON.parse(metricsStr);
            }
            return null;
        } catch (error) {
            log('ERROR', `从Redis获取系统监控数据失败: ${error.message}`);
            return null;
        }
    }
    
    // 从Redis获取历史监控数据（供工作进程使用）
    async getHistoryFromRedis() {
        try {
            const historyStr = await redisClient.get('system_metrics:history');
            if (historyStr) {
                return JSON.parse(historyStr);
            }
            return [];
        } catch (error) {
            log('ERROR', `从Redis获取系统监控历史数据失败: ${error.message}`);
            return [];
        }
    }
}

module.exports = new SystemMonitor();