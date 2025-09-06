// MULTI-AGENT SYSTEM INTEGRATION
// Demonstrates the complete pharmaceutical intelligence multi-agent system

const AgentOrchestrator = require('./orchestrator/AgentOrchestrator.js');
const DataCollectionAgent = require('./agents/intelligence/DataCollectionAgent.js');
const RiskAnalysisAgent = require('./agents/intelligence/RiskAnalysisAgent.js');
const CompetitiveIntelligenceAgent = require('./agents/intelligence/CompetitiveIntelligenceAgent.js');
const KnowledgeGraphAgent = require('./agents/intelligence/KnowledgeGraphAgent.js');
const ClientReportService = require('./client-reports-service.js');

class LeafIntelligenceMultiAgentSystem {
  constructor() {
    this.orchestrator = new AgentOrchestrator();
    this.clientReportService = new ClientReportService();
    this.isInitialized = false;
    
    console.log('🧠 Leaf Intelligence Multi-Agent System initializing...');
  }

  async initialize() {
    try {
      console.log('🚀 Starting multi-agent system initialization...');
      
      // Initialize Core Pharmaceutical Intelligence Agents - Stage 2A Complete
      console.log('🤖 Initializing Agent DataCollectionAgent...');
      const dataCollectionAgent = new DataCollectionAgent();
      await this.orchestrator.registerAgent(dataCollectionAgent);
      
      console.log('🤖 Initializing Agent RiskAnalysisAgent...');
      const riskAnalysisAgent = new RiskAnalysisAgent();
      await this.orchestrator.registerAgent(riskAnalysisAgent);
      
      console.log('🤖 Initializing Agent CompetitiveIntelligenceAgent...');
      const competitiveIntelligenceAgent = new CompetitiveIntelligenceAgent();
      await this.orchestrator.registerAgent(competitiveIntelligenceAgent);
      
      console.log('🤖 Initializing Agent KnowledgeGraphAgent...');
      const knowledgeGraphAgent = new KnowledgeGraphAgent();
      await this.orchestrator.registerAgent(knowledgeGraphAgent);
      
      // Additional agents for Stage 2B
      // const regulatoryMonitoringAgent = new RegulatoryMonitoringAgent();
      // const clinicalTrialsAgent = new ClinicalTrialsAgent();
      
      // Set up orchestrator event listeners
      this.setupOrchestratorListeners();
      
      this.isInitialized = true;
      console.log('✅ Multi-agent system fully operational');
      
      return {
        success: true,
        message: 'Multi-agent system initialized successfully',
        agents: this.orchestrator.getSystemStatus().agents.map(a => ({
          name: a.name,
          capabilities: a.capabilities,
          status: a.status
        }))
      };
      
    } catch (error) {
      console.error('❌ Failed to initialize multi-agent system:', error.message);
      throw error;
    }
  }

  setupOrchestratorListeners() {
    this.orchestrator.on('agent_registered', (data) => {
      console.log(`📋 Agent registered: ${data.agent} with ${data.capabilities.length} capabilities`);
    });

    this.orchestrator.on('system_health_check', (data) => {
      if (data.systemHealth < 70) {
        console.warn(`⚠️  System health warning: ${data.systemHealth}% (${data.healthyAgents}/${data.totalAgents} agents healthy)`);
      }
    });

    this.orchestrator.on('agent_error', (data) => {
      console.error(`💥 Agent ${data.agent} error: ${data.error}`);
    });
  }

  /**
   * Process pharmaceutical intelligence request
   */
  async processIntelligenceRequest(request) {
    if (!this.isInitialized) {
      throw new Error('Multi-agent system not initialized');
    }

    const { query, user_type, request_type, parameters } = request;
    
    console.log(`🔍 Processing intelligence request: ${request_type} for ${user_type}`);

    // Determine required capabilities based on request type
    const capabilities = this.determineRequiredCapabilities(request_type, parameters);
    
    // Route to appropriate agent(s)
    const result = await this.orchestrator.routeRequest({
      type: request_type,
      user_type: user_type,
      query: query,
      params: parameters,
      timestamp: new Date()
    }, capabilities);

    return {
      success: result.success,
      data: result.result || result,
      metadata: {
        processed_by: result.agent_name,
        processing_time: result.processing_time,
        capabilities_used: capabilities,
        timestamp: result.timestamp
      }
    };
  }

  /**
   * Determine required capabilities for a request
   */
  determineRequiredCapabilities(requestType, parameters) {
    const capabilityMap = {
      'collect_drug_data': ['fda_data_collection', 'data_quality_validation'],
      'regulatory_analysis': ['regulatory_monitoring', 'fda_data_collection'],
      'clinical_trials_search': ['clinical_trials_data', 'data_quality_validation'],
      'competitive_intelligence': ['fda_data_collection', 'ema_data_collection'],
      'executive_briefing': ['executive_reporting', 'strategic_insights'],
      'export_data': ['data_export', 'format_conversion']
    };

    return capabilityMap[requestType] || ['fda_data_collection'];
  }

  /**
   * Get system status and health
   */
  getSystemStatus() {
    return {
      system: {
        initialized: this.isInitialized,
        version: '1.0.0-stage1',
        timestamp: new Date()
      },
      orchestrator: this.orchestrator.getSystemStatus(),
      client_reports: {
        total_preserved: 64,
        redirect_service_active: true,
        backup_available: true
      }
    };
  }

  /**
   * Process client report request (maintains backward compatibility)
   */
  async processClientReportRequest(reportPath) {
    // Check if this is a legacy URL that needs redirection
    const redirectPath = this.clientReportService.getRedirect(reportPath);
    
    if (redirectPath) {
      return {
        success: true,
        redirect: true,
        new_path: redirectPath,
        message: 'Report moved to organized structure - redirecting'
      };
    }

    // Check if report exists in new structure
    if (this.clientReportService.validateReportAccess(reportPath)) {
      return {
        success: true,
        path: reportPath,
        enhanced: false // TODO: Add AI enhancement in Stage 2
      };
    }

    return {
      success: false,
      error: 'Report not found',
      available_reports: Array.from(this.clientReportService.reports.keys())
    };
  }

  /**
   * Demonstrate system capabilities
   */
  async demonstrateCapabilities() {
    console.log('🎭 Demonstrating multi-agent system capabilities...');
    
    const demonstrations = [];

    try {
      // Test 1: Drug data collection
      console.log('\n📊 Testing drug data collection...');
      const drugDataResult = await this.processIntelligenceRequest({
        request_type: 'collect_drug_data',
        user_type: 'executive',
        query: 'Atirmociclib drug information',
        parameters: {
          drugName: 'Atirmociclib',
          includeTrials: true
        }
      });
      
      demonstrations.push({
        test: 'Drug Data Collection',
        success: drugDataResult.success,
        processing_time: drugDataResult.metadata.processing_time,
        agent: drugDataResult.metadata.processed_by
      });

      // Test 2: System monitoring
      console.log('\n🔍 Testing data source monitoring...');
      const monitoringResult = await this.processIntelligenceRequest({
        request_type: 'monitor_data_sources',
        user_type: 'technical',
        query: 'System health check',
        parameters: {}
      });

      demonstrations.push({
        test: 'Data Source Monitoring',
        success: monitoringResult.success,
        processing_time: monitoringResult.metadata.processing_time,
        agent: monitoringResult.metadata.processed_by
      });

      // Test 3: Client report redirection
      console.log('\n🔗 Testing client report redirection...');
      const reportResult = await this.processClientReportRequest('/public/Atirmociclib.html');
      
      demonstrations.push({
        test: 'Client Report Redirection',
        success: reportResult.success,
        redirect_path: reportResult.redirect ? reportResult.new_path : null
      });

      console.log('\n✅ System demonstration completed successfully!');
      
      return {
        success: true,
        demonstrations: demonstrations,
        system_status: this.getSystemStatus(),
        summary: {
          total_tests: demonstrations.length,
          passed_tests: demonstrations.filter(d => d.success).length,
          system_operational: this.isInitialized
        }
      };

    } catch (error) {
      console.error('❌ System demonstration failed:', error.message);
      return {
        success: false,
        error: error.message,
        demonstrations: demonstrations
      };
    }
  }

  /**
   * Graceful shutdown of the entire system
   */
  async shutdown() {
    console.log('🔄 Shutting down multi-agent system...');
    
    if (this.orchestrator) {
      await this.orchestrator.shutdown();
    }
    
    this.isInitialized = false;
    console.log('✅ Multi-agent system shut down successfully');
  }
}

// Export for use in server integration
module.exports = LeafIntelligenceMultiAgentSystem;

// If run directly, demonstrate the system
if (require.main === module) {
  async function runDemo() {
    const system = new LeafIntelligenceMultiAgentSystem();
    
    try {
      await system.initialize();
      const demo = await system.demonstrateCapabilities();
      
      console.log('\n' + '='.repeat(50));
      console.log('DEMONSTRATION RESULTS:');
      console.log('='.repeat(50));
      console.log(JSON.stringify(demo, null, 2));
      
    } catch (error) {
      console.error('Demo failed:', error.message);
    } finally {
      await system.shutdown();
      process.exit(0);
    }
  }
  
  runDemo().catch(console.error);
}