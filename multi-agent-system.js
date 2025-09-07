// MULTI-AGENT SYSTEM INTEGRATION
// Demonstrates the complete pharmaceutical intelligence multi-agent system

const AgentOrchestrator = require('./orchestrator/AgentOrchestrator.js');
const DataCollectionAgent = require('./agents/intelligence/DataCollectionAgent.js');
const RiskAnalysisAgent = require('./agents/intelligence/RiskAnalysisAgent.js');
const CompetitiveIntelligenceAgent = require('./agents/intelligence/CompetitiveIntelligenceAgent.js');
const KnowledgeGraphAgent = require('./agents/intelligence/KnowledgeGraphAgent.js');
const RegulatoryMonitoringAgent = require('./agents/intelligence/RegulatoryMonitoringAgent.js');
const ClinicalTrialsAgent = require('./agents/intelligence/ClinicalTrialsAgent.js');
const ClientReportService = require('./client-reports-service.js');
const WebhookManager = require('./alerts/WebhookManager.js');
const ReportExporter = require('./exports/ReportExporter.js');

class LeafIntelligenceMultiAgentSystem {
  constructor() {
    this.orchestrator = new AgentOrchestrator();
    this.clientReportService = new ClientReportService();
    this.webhookManager = new WebhookManager();
    this.reportExporter = new ReportExporter();
    this.isInitialized = false;
    this.stage = '2B'; // Updated to Stage 2B
    
    console.log('🧠 Leaf Intelligence Multi-Agent System (Stage 2B) initializing...');
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
      
      // Stage 2B New Agents - Real-time Alert System
      console.log('🤖 Initializing Agent RegulatoryMonitoringAgent...');
      const regulatoryMonitoringAgent = new RegulatoryMonitoringAgent();
      await this.orchestrator.registerAgent(regulatoryMonitoringAgent);
      
      console.log('🤖 Initializing Agent ClinicalTrialsAgent...');
      const clinicalTrialsAgent = new ClinicalTrialsAgent();
      await this.orchestrator.registerAgent(clinicalTrialsAgent);
      
      // Initialize webhook system for real-time alerts
      console.log('📡 Initializing Webhook Alert System...');
      this.setupWebhookIntegration();
      
      // Set up orchestrator event listeners
      this.setupOrchestratorListeners();
      
      this.isInitialized = true;
      console.log('✅ Multi-agent system fully operational (Stage 2B - 6-Agent System with Real-time Alerts)');
      
      return {
        success: true,
        message: 'Stage 2B Multi-agent system initialized with real-time alert capabilities',
        stage: this.stage,
        new_features: ['Real-time FDA alerts', 'PDF/Excel export', 'Regulatory monitoring', 'Clinical trial predictions'],
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
      // DataCollectionAgent capabilities
      'collect_drug_data': ['fda_data_collection', 'data_quality_validation'],
      'regulatory_analysis': ['regulatory_monitoring', 'fda_data_collection'],
      'clinical_trials_search': ['clinical_trials_data', 'data_quality_validation'],
      'monitor_data_sources': ['fda_data_collection'],
      
      // RiskAnalysisAgent capabilities
      'assess_company_risk': ['compliance_monitoring', 'risk_scoring'],
      'analyze_warning_letters': ['warning_letter_analysis', 'risk_scoring'],
      'monitor_compliance': ['compliance_monitoring', 'regulatory_pattern_detection'],
      'predict_regulatory_risk': ['risk_scoring', 'regulatory_pattern_detection'],
      'generate_risk_report': ['compliance_monitoring', 'risk_mitigation_recommendations'],
      
      // CompetitiveIntelligenceAgent capabilities  
      'analyze_competitive_landscape': ['competitive_landscape_mapping', 'market_opportunity_identification'],
      'patent_cliff_analysis': ['patent_analysis', 'patent_cliff_analysis'],
      'assess_market_opportunity': ['market_opportunity_identification', 'competitive_landscape_mapping'],
      'track_competitor_pipeline': ['competitor_pipeline_tracking', 'market_share_analysis'],
      'analyze_patent_landscape': ['patent_analysis', 'licensing_opportunity_assessment'],
      'generate_competitive_report': ['competitive_landscape_mapping', 'patent_analysis'],
      
      // KnowledgeGraphAgent capabilities
      'build_knowledge_graph': ['graph_construction', 'entity_linking'],
      'discover_relationships': ['relationship_mapping', 'semantic_analysis'],
      'analyze_entity_connections': ['relationship_mapping', 'graph_analytics'],
      'find_hidden_patterns': ['pattern_recognition', 'knowledge_discovery'],
      'generate_insights': ['knowledge_discovery', 'graph_analytics'],
      'query_graph': ['graph_construction', 'semantic_analysis'],
      
      // RegulatoryMonitoringAgent capabilities (Stage 2B)
      'continuous_compliance_monitoring': ['continuous_compliance_monitoring', 'regulatory_change_detection'],
      'regulatory_change_detection': ['regulatory_change_detection', 'enforcement_action_tracking'],
      'enforcement_action_tracking': ['enforcement_action_tracking', 'compliance_deadline_management'],
      'guidance_document_monitoring': ['guidance_document_monitoring', 'regulatory_intelligence_aggregation'],
      'inspection_schedule_tracking': ['inspection_schedule_tracking', 'compliance_deadline_management'],
      'compliance_deadline_management': ['compliance_deadline_management', 'continuous_compliance_monitoring'],
      'regulatory_intelligence_aggregation': ['regulatory_intelligence_aggregation', 'regulatory_change_detection'],
      
      // ClinicalTrialsAgent capabilities (Stage 2B)
      'trial_outcome_prediction': ['trial_outcome_prediction', 'trial_risk_assessment'],
      'clinical_pipeline_analysis': ['clinical_pipeline_analysis', 'competitive_trial_monitoring'],
      'competitive_trial_monitoring': ['competitive_trial_monitoring', 'clinical_pipeline_analysis'],
      'enrollment_timeline_optimization': ['enrollment_timeline_optimization', 'trial_risk_assessment'],
      'regulatory_milestone_tracking': ['regulatory_milestone_tracking', 'compliance_deadline_management'],
      'trial_risk_assessment': ['trial_risk_assessment', 'endpoint_analysis'],
      'endpoint_analysis': ['endpoint_analysis', 'trial_outcome_prediction'],
      'investigator_network_analysis': ['investigator_network_analysis', 'enrollment_timeline_optimization'],
      
      // Stage 2B Export Capabilities
      'export_pdf_report': ['data_export', 'format_conversion'],
      'export_excel_report': ['data_export', 'format_conversion'],
      'generate_executive_report': ['executive_reporting', 'strategic_insights'],
      
      // Legacy/General capabilities
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
        version: '2.0.0-stage2b',
        timestamp: new Date()
      },
      orchestrator: this.orchestrator.getSystemStatus(),
      client_reports: {
        total_preserved: 64,
        redirect_service_active: true,
        backup_available: true
      },
      stage_2b_features: {
        webhook_alerts: this.webhookManager ? this.webhookManager.getStatus() : 'not_initialized',
        export_capabilities: ['PDF', 'Excel', 'Executive Reports'],
        new_agents: ['RegulatoryMonitoringAgent', 'ClinicalTrialsAgent'],
        real_time_monitoring: true
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

      // Test 4: Stage 2B Webhook Alert Processing
      console.log('\n🚨 Testing webhook alert processing...');
      const alertResult = await this.processWebhookAlert({
        type: 'fda_warning',
        title: 'Test FDA Warning Alert',
        severity: 'high',
        company: 'Test Pharmaceutical',
        alert_id: 'test_alert_001'
      });
      
      demonstrations.push({
        test: 'Webhook Alert Processing',
        success: alertResult.success,
        alert_processed: alertResult.alert_processed
      });

      // Test 5: Stage 2B Export Capabilities
      console.log('\n📋 Testing export capabilities...');
      try {
        const exportResult = await this.exportToPDF({
          summary: { totalFindings: 15, riskScore: 65, competitorsAnalyzed: 8 },
          findings: ['Test finding 1', 'Test finding 2']
        }, { template: 'executive_summary' });
        
        demonstrations.push({
          test: 'PDF Export Generation',
          success: exportResult.success,
          filename: exportResult.filename
        });
      } catch (error) {
        demonstrations.push({
          test: 'PDF Export Generation',
          success: false,
          error: 'PDF export requires additional dependencies (puppeteer)'
        });
      }

      console.log('\n✅ System demonstration completed successfully!');
      
      return {
        success: true,
        demonstrations: demonstrations,
        system_status: this.getSystemStatus(),
        summary: {
          total_tests: demonstrations.length,
          passed_tests: demonstrations.filter(d => d.success).length,
          system_operational: this.isInitialized,
          stage_2b_features_tested: demonstrations.filter(d => 
            d.test.includes('Webhook') || d.test.includes('Export')
          ).length
        },
        stage_2b_capabilities: this.getStage2BCapabilities()
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
   * Setup webhook integration for real-time alerts (Stage 2B)
   */
  setupWebhookIntegration() {
    // Register default webhook for system alerts
    this.webhookManager.registerWebhook('system_alerts', {
      url: 'http://localhost:3000/api/webhooks/system',
      events: ['fda_warning', 'regulatory_change', 'competitive_alert', 'trial_milestone'],
      secret: 'leaf_intelligence_webhook_secret'
    });

    // Create default alert rules
    this.webhookManager.createAlertRule('high_priority_alerts', {
      type: 'fda_warning',
      conditions: { severity: 'high' },
      webhooks: ['system_alerts'],
      priority: 'high'
    });

    // Start monitoring with 30-minute intervals
    this.webhookManager.startMonitoring(30);
    
    console.log('✅ Webhook alert system configured and monitoring started');
  }

  /**
   * Export intelligence data to PDF report (Stage 2B)
   */
  async exportToPDF(data, options = {}) {
    try {
      console.log('📋 Generating PDF pharmaceutical intelligence report...');
      
      const result = await this.reportExporter.exportToPDF(data, {
        template: options.template || 'executive_summary',
        company: options.company,
        title: options.title || 'Pharmaceutical Intelligence Report'
      });

      return {
        success: true,
        export_type: 'PDF',
        filename: result.filename,
        size: result.size,
        generated_at: result.generated_at,
        download_ready: true
      };

    } catch (error) {
      console.error('❌ PDF export failed:', error.message);
      throw new Error(`PDF export failed: ${error.message}`);
    }
  }

  /**
   * Export intelligence data to Excel report (Stage 2B)
   */
  async exportToExcel(data, options = {}) {
    try {
      console.log('📈 Generating Excel pharmaceutical intelligence report...');
      
      const result = await this.reportExporter.exportToExcel(data, {
        template: options.template || 'detailed_analysis',
        company: options.company,
        includeCharts: options.includeCharts !== false
      });

      return {
        success: true,
        export_type: 'Excel',
        filename: result.filename,
        size: result.size,
        sheets: result.sheets,
        generated_at: result.generated_at,
        download_ready: true
      };

    } catch (error) {
      console.error('❌ Excel export failed:', error.message);
      throw new Error(`Excel export failed: ${error.message}`);
    }
  }

  /**
   * Process webhook alert (Stage 2B)
   */
  async processWebhookAlert(alertData) {
    try {
      console.log(`🚨 Processing webhook alert: ${alertData.type}`);
      
      // Process the alert through the webhook manager
      await this.webhookManager.processAlert(alertData);
      
      // Log alert for system monitoring
      this.orchestrator.emit('webhook_alert_processed', {
        alert_type: alertData.type,
        severity: alertData.severity,
        processed_at: new Date()
      });

      return {
        success: true,
        alert_processed: true,
        alert_id: alertData.alert_id || 'generated',
        timestamp: new Date()
      };

    } catch (error) {
      console.error('❌ Webhook alert processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Get Stage 2B capabilities summary
   */
  getStage2BCapabilities() {
    return {
      real_time_alerts: {
        webhook_system: this.webhookManager.getStatus(),
        monitored_sources: ['FDA', 'EMA', 'ClinicalTrials.gov'],
        alert_types: ['fda_warning', 'regulatory_change', 'competitive_alert', 'trial_milestone']
      },
      export_capabilities: {
        formats: ['PDF', 'Excel'],
        templates: ['executive_summary', 'regulatory_analysis', 'competitive_intelligence'],
        automated_generation: true
      },
      new_agents: {
        regulatory_monitoring: {
          capabilities: 7,
          specialization: 'Continuous regulatory compliance and enforcement tracking'
        },
        clinical_trials: {
          capabilities: 8,
          specialization: 'Trial outcome prediction and pipeline analysis'
        }
      },
      total_agents: 6,
      total_capabilities: 37, // Updated count with Stage 2B agents
      upgrade_benefits: [
        'Real-time pharmaceutical intelligence alerts',
        'Professional PDF and Excel report generation',
        'Predictive clinical trial outcome analysis',
        'Continuous regulatory compliance monitoring',
        'Enhanced competitive intelligence automation'
      ]
    };
  }

  /**
   * Graceful shutdown of the entire system
   */
  async shutdown() {
    console.log('🔄 Shutting down multi-agent system (Stage 2B)...');
    
    // Stop webhook monitoring
    if (this.webhookManager) {
      this.webhookManager.stopMonitoring();
    }
    
    // Cleanup report exporter resources
    if (this.reportExporter) {
      await this.reportExporter.cleanup();
    }
    
    // Shutdown orchestrator
    if (this.orchestrator) {
      await this.orchestrator.shutdown();
    }
    
    this.isInitialized = false;
    console.log('✅ Stage 2B Multi-agent system shut down successfully');
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