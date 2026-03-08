/**
 * WebSocket Connection Metrics and Monitoring
 * Tracks reconnection rate, latency by device, and connection health
 */

const EventEmitter = require('events');

class WebSocketMetrics extends EventEmitter {
  constructor(options = {}) {
    super();
    this.connections = new Map();
    this.metrics = {
      connections: {
        total: 0,
        active: 0,
        peak: 0,
        mobile: 0,
        desktop: 0,
        tablet: 0
      },
      reconnections: {
        total: 0,
        successful: 0,
        failed: 0,
        byDevice: {
          mobile: 0,
          desktop: 0,
          tablet: 0
        }
      },
      latency: {
        connect: [],
        message: [],
        reconnection: [],
        byDevice: {
          mobile: { connect: [], message: [] },
          desktop: { connect: [], message: [] },
          tablet: { connect: [], message: [] }
        }
      },
      events: {
        received: 0,
        sent: 0,
        dropped: 0
      },
      errors: {
        total: 0,
        byType: {}
      }
    };

    this.latencyMaxHistory = options.latencyMaxHistory || 1000;
    this.alertThresholds = {
      reconnectionRate: 0.1, // 10% of connections
      averageLatency: 2000, // 2 seconds
      mobileLatency: 3000, // 3 seconds
      connectionFailureRate: 0.05, // 5%
      eventDropRate: 0.01 // 1%
    };

    // Start periodic metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 30000); // Every 30 seconds
  }

  detectDeviceType(userAgent = '') {
    if (/Mobile|Android|iPhone|iPod/i.test(userAgent)) {
      return 'mobile';
    } else if (/iPad|Tablet/i.test(userAgent)) {
      return 'tablet';
    }
    return 'desktop';
  }

  trackConnection(socketId, metadata = {}) {
    const deviceType = this.detectDeviceType(metadata.userAgent);

    this.connections.set(socketId, {
      id: socketId,
      deviceType,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      metadata,
      latency: {
        connect: metadata.connectTime || 0,
        lastMessage: 0
      },
      reconnections: 0
    });

    this.metrics.connections.total++;
    this.metrics.connections.active++;
    this.metrics.connections[deviceType]++;

    if (this.metrics.connections.active > this.metrics.connections.peak) {
      this.metrics.connections.peak = this.metrics.connections.active;
    }

    if (metadata.connectTime) {
      this.trackLatency('connect', metadata.connectTime, deviceType);
    }

    this.emit('connection:added', { socketId, deviceType, metadata });
  }

  trackDisconnection(socketId, reason = 'unknown') {
    const connection = this.connections.get(socketId);
    if (!connection) return;

    const { deviceType } = connection;

    this.metrics.connections.active--;
    this.metrics.connections[deviceType]--;

    this.connections.delete(socketId);

    this.emit('connection:removed', { socketId, reason, deviceType });
  }

  trackLatency(type, duration, deviceType) {
    this.metrics.latency[type].push(duration);

    if (this.metrics.latency[type].length > this.latencyMaxHistory) {
      this.metrics.latency[type].shift();
    }

    if (deviceType && this.metrics.latency.byDevice[deviceType]) {
      this.metrics.latency.byDevice[deviceType][type]?.push(duration);
    }
  }

  trackError(errorType, socketId, details = {}) {
    this.metrics.errors.total++;
    if (!this.metrics.errors.byType[errorType]) {
      this.metrics.errors.byType[errorType] = 0;
    }
    this.metrics.errors.byType[errorType]++;
    this.emit('error', { errorType, socketId, details });
  }

  getAverageLatency(type) {
    const latencies = this.metrics.latency[type];
    if (latencies.length === 0) return 0;
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  getDeviceLatency(deviceType, latencyType) {
    const latencies = this.metrics.latency.byDevice[deviceType]?.[latencyType];
    if (!latencies || latencies.length === 0) return 0;
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  getReconnectionRate() {
    const total = this.metrics.connections.total;
    if (total === 0) return 0;
    return this.metrics.reconnections.total / total;
  }

  getHealthScore() {
    let score = 100;
    const reconRate = this.getReconnectionRate();
    if (reconRate > this.alertThresholds.reconnectionRate) {
      score -= (reconRate * 100);
    }
    const avgLatency = this.getAverageLatency('message');
    if (avgLatency > this.alertThresholds.averageLatency) {
      score -= ((avgLatency / this.alertThresholds.averageLatency) - 1) * 10;
    }
    if (this.metrics.errors.total > 0) {
      score -= Math.min(this.metrics.errors.total, 20);
    }
    return Math.max(0, score);
  }

  collectMetrics() {
    const metrics = this.getMetrics();
    this.emit('metrics:collected', metrics);
    this.cleanupOldLatencyData();
  }

  cleanupOldLatencyData() {
    for (const type of ['connect', 'message', 'reconnection']) {
      if (this.metrics.latency[type].length > this.latencyMaxHistory) {
        this.metrics.latency[type] = this.metrics.latency[type].slice(-this.latencyMaxHistory);
      }
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      computed: {
        averageLatency: {
          connect: this.getAverageLatency('connect'),
          message: this.getAverageLatency('message'),
          reconnection: this.getAverageLatency('reconnection')
        },
        deviceLatency: {
          mobile: {
            connect: this.getDeviceLatency('mobile', 'connect'),
            message: this.getDeviceLatency('mobile', 'message')
          },
          desktop: {
            connect: this.getDeviceLatency('desktop', 'connect'),
            message: this.getDeviceLatency('desktop', 'message')
          },
          tablet: {
            connect: this.getDeviceLatency('tablet', 'connect'),
            message: this.getDeviceLatency('tablet', 'message')
          }
        },
        reconnectionRate: this.getReconnectionRate(),
        healthScore: this.getHealthScore()
      }
    };
  }

  shutdown() {
    clearInterval(this.metricsInterval);
    this.removeAllListeners();
  }
}

module.exports = WebSocketMetrics;