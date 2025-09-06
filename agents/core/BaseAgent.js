// BASE AGENT CLASS - Foundation for Multi-Agent System
// All specialized pharmaceutical intelligence agents inherit from this base

const EventEmitter = require('events');

class BaseAgent extends EventEmitter {
  constructor(name, capabilities = []) {
    super();
    this.name = name;
    this.capabilities = capabilities;
    this.status = 'initializing';
    this.lastActivity = new Date();
    this.processedRequests = 0;
    this.errorCount = 0;
    this.averageProcessingTime = 0;
    this.healthScore = 100;
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastHealthCheck: new Date()
    };
    
    // Agent-specific configuration
    this.config = {
      maxConcurrentRequests: 5,
      requestTimeout: 30000, // 30 seconds
      retryAttempts: 3,
      backoffMultiplier: 2
    };
  }

  async initialize() {
    try {
      this.status = 'initializing';
      console.log(`🤖 Initializing Agent ${this.name}...`);
      
      // Perform any agent-specific initialization
      await this.onInitialize();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.status = 'ready';
      this.emit('initialized', { agent: this.name, timestamp: new Date() });
      console.log(`✅ Agent ${this.name} initialized with capabilities: ${this.capabilities.join(', ')}`);
      
      return true;
    } catch (error) {
      this.status = 'error';
      this.errorCount++;
      console.error(`❌ Failed to initialize Agent ${this.name}:`, error.message);
      this.emit('error', { agent: this.name, error: error.message, timestamp: new Date() });
      throw error;
    }
  }

  async process(request) {
    const startTime = Date.now();
    this.lastActivity = new Date();
    this.processedRequests++;
    this.metrics.totalRequests++;

    try {
      // Validate agent is ready
      if (this.status !== 'ready') {
        throw new Error(`Agent ${this.name} is not ready (status: ${this.status})`);
      }

      // Validate request has required capabilities
      if (request.requiredCapabilities) {
        const hasCapabilities = request.requiredCapabilities.every(cap => 
          this.capabilities.includes(cap)
        );
        if (!hasCapabilities) {
          throw new Error(`Agent ${this.name} lacks required capabilities: ${request.requiredCapabilities.join(', ')}`);
        }
      }

      console.log(`🔄 Agent ${this.name} processing request: ${request.type || 'unknown'}`);
      
      // Process the request (implemented by specialized agents)
      const result = await this.onProcess(request);
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);
      
      // Prepare response
      const response = {
        success: true,
        agent_name: this.name,
        processing_time: processingTime,
        timestamp: new Date(),
        result: result,
        capabilities_used: this.getUsedCapabilities(request)
      };

      this.emit('request_processed', { agent: this.name, request, response, processingTime });
      console.log(`✅ Agent ${this.name} completed request in ${processingTime}ms`);
      
      return response;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false);
      this.errorCount++;
      
      console.error(`❌ Agent ${this.name} failed to process request:`, error.message);
      
      const errorResponse = {
        success: false,
        agent_name: this.name,
        processing_time: processingTime,
        timestamp: new Date(),
        error: error.message,
        error_type: error.constructor.name
      };

      this.emit('request_failed', { agent: this.name, request, error: error.message, processingTime });
      return errorResponse;
    }
  }

  // Method to be overridden by specialized agents
  async onInitialize() {
    // Default initialization - can be overridden
    return Promise.resolve();
  }

  // Method to be overridden by specialized agents
  async onProcess(request) {
    throw new Error(`Agent ${this.name} must implement onProcess method`);
  }

  // Determine which capabilities were used for a request
  getUsedCapabilities(request) {
    return request.requiredCapabilities || this.capabilities.slice(0, 1);
  }

  // Update performance metrics
  updateMetrics(processingTime, success) {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // Update average response time
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + processingTime;
    this.metrics.averageResponseTime = Math.round(totalTime / this.metrics.totalRequests);
    
    // Update health score based on success rate
    const successRate = this.metrics.successfulRequests / this.metrics.totalRequests;
    this.healthScore = Math.round(successRate * 100);
  }

  // Start health monitoring
  startHealthMonitoring() {
    setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Health check every minute
  }

  // Perform health check
  performHealthCheck() {
    this.metrics.lastHealthCheck = new Date();
    
    // Check if agent has been inactive for too long
    const inactiveTime = Date.now() - this.lastActivity.getTime();
    const maxInactiveTime = 10 * 60 * 1000; // 10 minutes
    
    if (inactiveTime > maxInactiveTime && this.status === 'ready') {
      console.log(`⚠️  Agent ${this.name} has been inactive for ${Math.round(inactiveTime / 60000)} minutes`);
    }
    
    // Emit health status
    this.emit('health_check', this.getHealthStatus());
  }

  // Get current agent status
  getStatus() {
    return {
      name: this.name,
      status: this.status,
      capabilities: this.capabilities,
      lastActivity: this.lastActivity,
      processedRequests: this.processedRequests,
      errorCount: this.errorCount,
      healthScore: this.healthScore,
      averageProcessingTime: this.metrics.averageResponseTime
    };
  }

  // Get detailed health status
  getHealthStatus() {
    const uptime = Date.now() - this.metrics.lastHealthCheck.getTime();
    return {
      name: this.name,
      status: this.status,
      healthScore: this.healthScore,
      uptime: uptime,
      metrics: { ...this.metrics },
      lastActivity: this.lastActivity,
      memoryUsage: process.memoryUsage()
    };
  }

  // Graceful shutdown
  async shutdown() {
    console.log(`🔄 Shutting down Agent ${this.name}...`);
    this.status = 'shutting_down';
    
    try {
      // Perform any cleanup
      await this.onShutdown();
      this.status = 'stopped';
      this.emit('shutdown', { agent: this.name, timestamp: new Date() });
      console.log(`✅ Agent ${this.name} shut down successfully`);
    } catch (error) {
      console.error(`❌ Error shutting down Agent ${this.name}:`, error.message);
      this.status = 'error';
      throw error;
    }
  }

  // Method to be overridden by specialized agents
  async onShutdown() {
    // Default shutdown - can be overridden
    return Promise.resolve();
  }

  // Check if agent can handle specific capabilities
  canHandle(requiredCapabilities) {
    if (!Array.isArray(requiredCapabilities)) {
      requiredCapabilities = [requiredCapabilities];
    }
    return requiredCapabilities.every(cap => this.capabilities.includes(cap));
  }

  // Get agent load (for load balancing)
  getLoad() {
    return {
      currentRequests: this.processedRequests,
      healthScore: this.healthScore,
      averageResponseTime: this.metrics.averageResponseTime,
      errorRate: this.metrics.failedRequests / Math.max(this.metrics.totalRequests, 1)
    };
  }
}

module.exports = BaseAgent;