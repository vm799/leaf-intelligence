// AGENT ORCHESTRATOR - Multi-Agent System Command Center
// Routes pharmaceutical intelligence requests to appropriate specialized agents

const EventEmitter = require('events');
const BaseAgent = require('../agents/core/BaseAgent.js');

class AgentOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map();
    this.messageQueue = [];
    this.isProcessing = false;
    this.requestHistory = [];
    this.systemMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      systemUptime: new Date()
    };
    
    // Load balancing configuration
    this.loadBalancingStrategy = 'least_busy'; // 'round_robin', 'least_busy', 'capability_optimized'
    this.maxQueueSize = 100;
    this.healthCheckInterval = 30000; // 30 seconds
    
    console.log('🏛️  Agent Orchestrator initialized');
    this.startSystemMonitoring();
  }

  /**
   * Register a new agent with the orchestrator
   */
  async registerAgent(agent) {
    try {
      // Validate agent
      if (!(agent instanceof BaseAgent)) {
        throw new Error('Agent must extend BaseAgent class');
      }

      if (this.agents.has(agent.name)) {
        throw new Error(`Agent with name '${agent.name}' already registered`);
      }

      // Initialize the agent
      await agent.initialize();
      
      // Register event listeners
      this.setupAgentEventListeners(agent);
      
      // Store the agent
      this.agents.set(agent.name, agent);
      
      console.log(`📋 Registered agent: ${agent.name} with capabilities: ${agent.capabilities.join(', ')}`);
      this.emit('agent_registered', { 
        agent: agent.name, 
        capabilities: agent.capabilities, 
        timestamp: new Date() 
      });

      return true;
    } catch (error) {
      console.error(`❌ Failed to register agent ${agent.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Setup event listeners for an agent
   */
  setupAgentEventListeners(agent) {
    agent.on('request_processed', (data) => {
      this.systemMetrics.successfulRequests++;
      this.updateSystemMetrics(data.processingTime, true);
    });

    agent.on('request_failed', (data) => {
      this.systemMetrics.failedRequests++;
      this.updateSystemMetrics(data.processingTime, false);
      console.warn(`⚠️  Agent ${data.agent} failed request: ${data.error}`);
    });

    agent.on('error', (data) => {
      console.error(`💥 Agent ${data.agent} error: ${data.error}`);
      this.emit('agent_error', data);
    });

    agent.on('health_check', (healthData) => {
      // Store health data for system monitoring
      this.emit('agent_health_update', healthData);
    });
  }

  /**
   * Route a request to the most appropriate agent(s)
   */
  async routeRequest(request, capabilities = []) {
    const startTime = Date.now();
    this.systemMetrics.totalRequests++;

    try {
      console.log(`🔀 Orchestrator routing request for capabilities: ${capabilities.join(', ')}`);
      
      // Find suitable agents
      const suitableAgents = this.findSuitableAgents(capabilities);
      
      if (suitableAgents.length === 0) {
        throw new Error(`No agents available for capabilities: ${capabilities.join(', ')}`);
      }

      // Select the best agent based on load balancing strategy
      const selectedAgent = this.selectOptimalAgent(suitableAgents, request);
      
      console.log(`👉 Selected agent: ${selectedAgent.name} for request processing`);

      // Add required capabilities to request
      const enhancedRequest = {
        ...request,
        requiredCapabilities: capabilities,
        orchestrator_metadata: {
          request_id: this.generateRequestId(),
          route_time: new Date(),
          selected_agent: selectedAgent.name,
          available_agents: suitableAgents.map(a => a.name)
        }
      };

      // Process the request
      const result = await selectedAgent.process(enhancedRequest);
      
      // Store request history
      this.recordRequest(enhancedRequest, result, Date.now() - startTime);
      
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌ Orchestrator failed to route request:', error.message);
      
      this.recordRequest(request, { 
        success: false, 
        error: error.message 
      }, processingTime);

      throw error;
    }
  }

  /**
   * Find agents capable of handling the required capabilities
   */
  findSuitableAgents(capabilities) {
    return Array.from(this.agents.values())
      .filter(agent => {
        // Agent must be ready
        if (agent.status !== 'ready') return false;
        
        // Agent must have required capabilities
        const hasCapabilities = capabilities.length === 0 || 
          capabilities.some(cap => agent.capabilities.includes(cap));
        
        return hasCapabilities;
      });
  }

  /**
   * Select optimal agent based on load balancing strategy
   */
  selectOptimalAgent(suitableAgents, request) {
    switch (this.loadBalancingStrategy) {
      case 'round_robin':
        return this.selectRoundRobin(suitableAgents);
      
      case 'capability_optimized':
        return this.selectCapabilityOptimized(suitableAgents, request);
      
      case 'least_busy':
      default:
        return this.selectLeastBusy(suitableAgents);
    }
  }

  /**
   * Select agent with lowest current load
   */
  selectLeastBusy(agents) {
    return agents.reduce((prev, current) => {
      const prevLoad = prev.getLoad();
      const currentLoad = current.getLoad();
      
      // Consider health score and response time
      const prevScore = prevLoad.healthScore - (prevLoad.averageResponseTime / 1000);
      const currentScore = currentLoad.healthScore - (currentLoad.averageResponseTime / 1000);
      
      return currentScore > prevScore ? current : prev;
    });
  }

  /**
   * Select agent optimized for specific capabilities
   */
  selectCapabilityOptimized(agents, request) {
    const requiredCaps = request.requiredCapabilities || [];
    
    // Find agent with most matching capabilities
    const scored = agents.map(agent => {
      const matchingCaps = requiredCaps.filter(cap => 
        agent.capabilities.includes(cap)
      ).length;
      const totalCaps = agent.capabilities.length;
      const load = agent.getLoad();
      
      return {
        agent,
        score: (matchingCaps / Math.max(requiredCaps.length, 1)) + 
               (load.healthScore / 100) - 
               (load.errorRate * 2)
      };
    });
    
    return scored.sort((a, b) => b.score - a.score)[0].agent;
  }

  /**
   * Simple round-robin selection
   */
  selectRoundRobin(agents) {
    if (!this.roundRobinIndex) this.roundRobinIndex = 0;
    const selected = agents[this.roundRobinIndex % agents.length];
    this.roundRobinIndex++;
    return selected;
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    const agents = Array.from(this.agents.values());
    const uptime = Date.now() - this.systemMetrics.systemUptime.getTime();
    
    return {
      orchestrator: {
        status: 'operational',
        uptime: uptime,
        totalAgents: this.agents.size,
        activeAgents: agents.filter(a => a.status === 'ready').length,
        loadBalancingStrategy: this.loadBalancingStrategy,
        messageQueueLength: this.messageQueue.length,
        isProcessing: this.isProcessing
      },
      systemMetrics: {
        ...this.systemMetrics,
        successRate: this.systemMetrics.totalRequests > 0 ? 
          (this.systemMetrics.successfulRequests / this.systemMetrics.totalRequests * 100).toFixed(2) : 0
      },
      agents: agents.map(agent => ({
        name: agent.name,
        status: agent.status,
        capabilities: agent.capabilities,
        healthScore: agent.healthScore,
        processedRequests: agent.processedRequests,
        errorCount: agent.errorCount,
        lastActivity: agent.lastActivity,
        load: agent.getLoad()
      })),
      recentRequests: this.requestHistory.slice(-10) // Last 10 requests
    };
  }

  /**
   * Update system-wide metrics
   */
  updateSystemMetrics(processingTime, success) {
    const totalRequests = this.systemMetrics.successfulRequests + this.systemMetrics.failedRequests;
    
    if (totalRequests > 0) {
      const totalTime = this.systemMetrics.averageResponseTime * (totalRequests - 1) + processingTime;
      this.systemMetrics.averageResponseTime = Math.round(totalTime / totalRequests);
    }
  }

  /**
   * Record request for history and analytics
   */
  recordRequest(request, result, processingTime) {
    const record = {
      timestamp: new Date(),
      request_type: request.type || 'unknown',
      capabilities: request.requiredCapabilities || [],
      processing_time: processingTime,
      success: result.success !== false,
      agent: result.agent_name,
      error: result.error
    };

    this.requestHistory.push(record);
    
    // Keep only last 1000 requests in memory
    if (this.requestHistory.length > 1000) {
      this.requestHistory = this.requestHistory.slice(-1000);
    }
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start system monitoring
   */
  startSystemMonitoring() {
    setInterval(() => {
      this.performSystemHealthCheck();
    }, this.healthCheckInterval);
  }

  /**
   * Perform system health check
   */
  performSystemHealthCheck() {
    const agents = Array.from(this.agents.values());
    const healthyAgents = agents.filter(a => a.status === 'ready' && a.healthScore > 50);
    const systemHealth = healthyAgents.length / Math.max(agents.length, 1) * 100;

    this.emit('system_health_check', {
      timestamp: new Date(),
      systemHealth: Math.round(systemHealth),
      totalAgents: agents.length,
      healthyAgents: healthyAgents.length,
      metrics: this.systemMetrics
    });

    if (systemHealth < 70) {
      console.warn(`⚠️  System health below threshold: ${systemHealth}%`);
    }
  }

  /**
   * Get agent by name
   */
  getAgent(name) {
    return this.agents.get(name);
  }

  /**
   * Remove agent from orchestrator
   */
  async unregisterAgent(name) {
    const agent = this.agents.get(name);
    if (agent) {
      await agent.shutdown();
      this.agents.delete(name);
      console.log(`🔄 Unregistered agent: ${name}`);
      this.emit('agent_unregistered', { agent: name, timestamp: new Date() });
      return true;
    }
    return false;
  }

  /**
   * Shutdown all agents and orchestrator
   */
  async shutdown() {
    console.log('🔄 Shutting down Agent Orchestrator...');
    
    const shutdownPromises = Array.from(this.agents.values())
      .map(agent => agent.shutdown().catch(err => 
        console.error(`Error shutting down ${agent.name}:`, err.message)
      ));
    
    await Promise.all(shutdownPromises);
    this.agents.clear();
    
    console.log('✅ Agent Orchestrator shut down successfully');
    this.emit('orchestrator_shutdown', { timestamp: new Date() });
  }
}

module.exports = AgentOrchestrator;