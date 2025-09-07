// AGENT COMMUNICATION API ROUTES
// RESTful API endpoints for pharmaceutical intelligence multi-agent system

const express = require('express');
const AgentOrchestrator = require('./AgentOrchestrator.js');
const LeafIntelligenceMultiAgentSystem = require('../multi-agent-system.js');
const ClientReportService = require('../client-reports-service.js');
const KnowledgeGraphManager = require('../knowledge-graph/KnowledgeGraphManager.js');

const router = express.Router();

// Initialize system components
let multiAgentSystem = null;
let clientReportService = null;
let knowledgeGraph = null;

// Initialize components
async function initializeComponents() {
  if (!multiAgentSystem) {
    multiAgentSystem = new LeafIntelligenceMultiAgentSystem();
    await multiAgentSystem.initialize();
  }
  
  if (!clientReportService) {
    clientReportService = new ClientReportService();
  }
  
  if (!knowledgeGraph) {
    knowledgeGraph = new KnowledgeGraphManager();
    // Note: MongoDB connection will be established when needed
  }
}

// Middleware to ensure system is initialized
const ensureInitialized = async (req, res, next) => {
  try {
    if (!multiAgentSystem) {
      await initializeComponents();
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to initialize multi-agent system',
      details: error.message
    });
  }
};

// ================================
// SYSTEM STATUS AND HEALTH
// ================================

/**
 * GET /api/agents/status
 * Get comprehensive system status
 */
router.get('/status', ensureInitialized, (req, res) => {
  try {
    const systemStatus = multiAgentSystem.getSystemStatus();
    
    res.json({
      success: true,
      system_status: systemStatus,
      api_version: '2.0.0-stage2b',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting system status:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get system status',
      details: error.message
    });
  }
});

/**
 * GET /api/agents/health
 * Quick health check endpoint
 */
router.get('/health', (req, res) => {
  const health = {
    status: 'operational',
    timestamp: new Date().toISOString(),
    services: {
      multi_agent_system: multiAgentSystem ? 'initialized' : 'not_initialized',
      client_reports: clientReportService ? 'active' : 'not_active',
      knowledge_graph: knowledgeGraph ? 'available' : 'not_available',
      webhook_system: multiAgentSystem?.webhookManager ? 'active' : 'not_active',
      export_system: multiAgentSystem?.reportExporter ? 'active' : 'not_active'
    }
  };
  
  res.json({
    success: true,
    health: health
  });
});

// ================================
// PHARMACEUTICAL INTELLIGENCE QUERIES
// ================================

/**
 * POST /api/intelligence/query
 * Route pharmaceutical intelligence requests to appropriate agents
 */
router.post('/query', ensureInitialized, async (req, res) => {
  try {
    const { query, user_type, request_type, parameters } = req.body;
    
    // Validate required parameters
    if (!query || !user_type || !request_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        required: ['query', 'user_type', 'request_type']
      });
    }

    console.log(`🔍 Intelligence query from ${user_type}: ${request_type}`);
    
    const result = await multiAgentSystem.processIntelligenceRequest({
      query,
      user_type,
      request_type,
      parameters: parameters || {}
    });

    res.json({
      success: result.success,
      result: result.data,
      metadata: result.metadata,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Intelligence query failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Intelligence query processing failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/intelligence/drug-analysis
 * Specialized endpoint for drug analysis requests
 */
router.post('/drug-analysis', ensureInitialized, async (req, res) => {
  try {
    const { drug_name, nda, include_trials, include_competitive } = req.body;
    
    if (!drug_name && !nda) {
      return res.status(400).json({
        success: false,
        error: 'Either drug_name or nda is required'
      });
    }

    const result = await multiAgentSystem.processIntelligenceRequest({
      query: `Drug analysis for ${drug_name || nda}`,
      user_type: req.body.user_type || 'analyst',
      request_type: 'collect_drug_data',
      parameters: {
        drugName: drug_name,
        nda: nda,
        includeTrials: include_trials !== false,
        includeCompetitive: include_competitive !== false
      }
    });

    res.json({
      success: result.success,
      drug_analysis: result.data,
      processing_metadata: result.metadata,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Drug analysis failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Drug analysis processing failed',
      details: error.message
    });
  }
});

// ================================
// CLIENT REPORTS AND REDIRECTION
// ================================

/**
 * GET /api/reports/check-redirect
 * Check if a report path needs redirection
 */
router.get('/check-redirect', (req, res) => {
  try {
    const { path } = req.query;
    
    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Path parameter is required'
      });
    }

    if (!clientReportService) {
      clientReportService = new ClientReportService();
    }

    const redirectPath = clientReportService.getRedirect(path);
    
    res.json({
      success: true,
      needs_redirect: !!redirectPath,
      original_path: path,
      redirect_path: redirectPath,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Redirect check failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Redirect check failed',
      details: error.message
    });
  }
});

/**
 * GET /api/reports/list
 * List all available client reports
 */
router.get('/list', (req, res) => {
  try {
    if (!clientReportService) {
      clientReportService = new ClientReportService();
    }

    const reports = Array.from(clientReportService.reports.entries()).map(([id, report]) => ({
      report_id: id,
      path: report.path,
      type: report.type,
      business_value: report.business_value,
      access_level: report.access_level,
      last_updated: report.last_updated
    }));

    res.json({
      success: true,
      total_reports: reports.length,
      reports: reports,
      backup_available: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Report listing failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to list reports',
      details: error.message
    });
  }
});

// ================================
// KNOWLEDGE GRAPH OPERATIONS
// ================================

/**
 * GET /api/knowledge-graph/stats
 * Get knowledge graph statistics
 */
router.get('/knowledge-graph/stats', async (req, res) => {
  try {
    if (!knowledgeGraph) {
      knowledgeGraph = new KnowledgeGraphManager();
    }

    // For Stage 1, return placeholder statistics
    // In Stage 2, this will connect to actual MongoDB
    const stats = {
      status: 'schema_ready',
      collections_defined: 7,
      indexes_optimized: 86,
      ready_for_data_ingestion: true,
      estimated_setup_time: '< 5 minutes'
    };

    res.json({
      success: true,
      knowledge_graph: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Knowledge graph stats failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get knowledge graph statistics',
      details: error.message
    });
  }
});

/**
 * POST /api/knowledge-graph/search
 * Search entities in the knowledge graph
 */
router.post('/search', async (req, res) => {
  try {
    const { entity_type, query, filters } = req.body;
    
    if (!entity_type || !query) {
      return res.status(400).json({
        success: false,
        error: 'entity_type and query are required'
      });
    }

    // For Stage 1, return placeholder search results
    // In Stage 2, this will perform actual knowledge graph searches
    const searchResults = {
      entity_type: entity_type,
      query: query,
      results_count: 0,
      results: [],
      message: 'Knowledge graph search will be available in Stage 2 after data ingestion',
      available_entity_types: ['drugs', 'companies', 'regulatory_actions', 'clinical_trials', 'relationships']
    };

    res.json({
      success: true,
      search_results: searchResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Knowledge graph search failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Knowledge graph search failed',
      details: error.message
    });
  }
});

// ================================
// STAGE 2B - WEBHOOK ENDPOINTS
// ================================

/**
 * POST /api/webhooks/register
 * Register a new webhook endpoint
 */
router.post('/webhooks/register', ensureInitialized, async (req, res) => {
  try {
    const { webhook_id, url, events, secret } = req.body;
    
    if (!webhook_id || !url) {
      return res.status(400).json({
        success: false,
        error: 'webhook_id and url are required'
      });
    }

    const webhookResult = multiAgentSystem.webhookManager.registerWebhook(webhook_id, {
      url,
      events: events || ['fda_warning', 'regulatory_change'],
      secret
    });

    res.json({
      success: true,
      webhook_registered: webhookResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Webhook registration failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Webhook registration failed',
      details: error.message
    });
  }
});

/**
 * POST /api/webhooks/alert
 * Process incoming webhook alert
 */
router.post('/webhooks/alert', ensureInitialized, async (req, res) => {
  try {
    const alertData = req.body;
    
    const result = await multiAgentSystem.processWebhookAlert(alertData);
    
    res.json({
      success: result.success,
      alert_processed: result.alert_processed,
      timestamp: result.timestamp
    });

  } catch (error) {
    console.error('❌ Webhook alert processing failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Webhook alert processing failed',
      details: error.message
    });
  }
});

// ================================
// STAGE 2B - EXPORT ENDPOINTS  
// ================================

/**
 * POST /api/export/pdf
 * Export pharmaceutical intelligence data to PDF
 */
router.post('/export/pdf', ensureInitialized, async (req, res) => {
  try {
    const { data, options = {} } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data parameter is required for PDF export'
      });
    }

    const result = await multiAgentSystem.exportToPDF(data, options);
    
    res.json({
      success: result.success,
      export_details: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ PDF export failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'PDF export failed',
      details: error.message
    });
  }
});

/**
 * POST /api/export/excel
 * Export pharmaceutical intelligence data to Excel
 */
router.post('/export/excel', ensureInitialized, async (req, res) => {
  try {
    const { data, options = {} } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data parameter is required for Excel export'
      });
    }

    const result = await multiAgentSystem.exportToExcel(data, options);
    
    res.json({
      success: result.success,
      export_details: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Excel export failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Excel export failed',
      details: error.message
    });
  }
});

/**
 * GET /api/stage2b/capabilities
 * Get Stage 2B feature capabilities summary
 */
router.get('/stage2b/capabilities', ensureInitialized, (req, res) => {
  try {
    const capabilities = multiAgentSystem.getStage2BCapabilities();
    
    res.json({
      success: true,
      stage: '2B',
      capabilities: capabilities,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Stage 2B capabilities query failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get Stage 2B capabilities',
      details: error.message
    });
  }
});

// ================================
// SYSTEM MANAGEMENT
// ================================

/**
 * POST /api/agents/initialize
 * Initialize or reinitialize the multi-agent system
 */
router.post('/initialize', async (req, res) => {
  try {
    console.log('🔄 API request to initialize multi-agent system...');
    
    // Force reinitialization
    multiAgentSystem = new LeafIntelligenceMultiAgentSystem();
    const result = await multiAgentSystem.initialize();
    
    res.json({
      success: result.success,
      initialization_result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ System initialization failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'System initialization failed',
      details: error.message
    });
  }
});

/**
 * POST /api/agents/demo
 * Run system capabilities demonstration
 */
router.post('/demo', ensureInitialized, async (req, res) => {
  try {
    console.log('🎭 Running system capabilities demonstration...');
    
    const demo = await multiAgentSystem.demonstrateCapabilities();
    
    res.json({
      success: demo.success,
      demonstration: demo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ System demonstration failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'System demonstration failed',
      details: error.message
    });
  }
});

// ================================
// ERROR HANDLING MIDDLEWARE
// ================================

router.use((error, req, res, next) => {
  console.error('❌ API Router Error:', error.message);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error in agent communication API',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Contact system administrator',
    timestamp: new Date().toISOString()
  });
});

// ================================
// EXPORT ROUTER
// ================================

module.exports = {
  router,
  initializeComponents,
  
  // Export for testing
  getMultiAgentSystem: () => multiAgentSystem,
  getClientReportService: () => clientReportService,
  getKnowledgeGraph: () => knowledgeGraph
};