const si = require('systeminformation');
const fs = require('fs');
const path = require('path');
const cluster = require('cluster');
const { log } = require('./logger');

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
            this.loadHistory();
        }
    }

    // 开始监控
    startMonitoring(interval = 5000) { // 默认每5秒收集一次数据
        // 只有主进程才能启动监控
        if (!(cluster.isMaster || cluster.isPrimary)) return;
        
        if (this.monitoring) return;

        this.monitoring = true;
        this.collectData(); // 立即收集一次数据
        this.monitorInterval = setInterval(() => {
            this.collectData();
        }, interval);

        log('INFO', `系统监控已启动，采样间隔: ${interval}ms`);
    }

    // 停止监控
    stopMonitoring() {
        // 只有主进程才能停止监控
        if (!(cluster.isMaster || cluster.isPrimary)) return;
        
        if (!this.monitoring) return;

        this.monitoring = false;
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }

        log('INFO', '系统监控已停止');
    }

    // 收集系统数据
    async collectData() {
        // 只有主进程才能收集数据
        if (!(cluster.isMaster || cluster.isPrimary)) return;
        
        try {
            const timestamp = Date.now();
            
            // 收集CPU使用率
            const cpuData = await si.currentLoad();
            const cpuUsage = cpuData.currentLoad;
            
            // 收集内存使用率
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

            // 保存历史记录到文件
            this.saveHistory();

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

    // 保存历史数据到文件
    saveHistory() {
        // 只有主进程才能保存历史数据
        if (!(cluster.isMaster || cluster.isPrimary)) return;
        
        try {
            const historyPath = path.join(__dirname, '..', 'userdata', 'system_monitor_history.json');
            fs.writeFileSync(historyPath, JSON.stringify(this.history));
        } catch (error) {
            log('ERROR', `保存系统监控历史数据时出错: ${error.message}`);
        }
    }

    // 从文件加载历史数据
    loadHistory() {
        // 只有主进程才能加载历史数据
        if (!(cluster.isMaster || cluster.isPrimary)) return;
        
        try {
            const historyPath = path.join(__dirname, '..', 'userdata', 'system_monitor_history.json');
            if (fs.existsSync(historyPath)) {
                const data = fs.readFileSync(historyPath, 'utf8');
                this.history = JSON.parse(data);
                log('INFO', `已加载 ${this.history.length} 条系统监控历史数据`);
            }
        } catch (error) {
            log('ERROR', `加载系统监控历史数据时出错: ${error.message}`);
        }
    }

    // 清除历史数据
    clearHistory() {
        // 只有主进程才能清除历史数据
        if (!(cluster.isMaster || cluster.isPrimary)) return;
        
        this.history = [];
        this.saveHistory();
    }
}

// 导出单例实例
module.exports = new SystemMonitor();