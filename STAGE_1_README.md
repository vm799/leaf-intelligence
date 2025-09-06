# STAGE 1: FOUNDATION & ARCHITECTURE (Day 1 Morning - 4 Hours)

## 🎯 **STAGE OBJECTIVES**
Transform scattered pharmaceutical data scripts into unified multi-agent foundation while preserving all 58 client reports.

---

## 📋 **STAGE 1A: CLIENT REPORT PRESERVATION (1 hour)**

### **Critical Asset Protection**
**ALL 58 individual client report pages must be preserved:**

```bash
# Create protected client reports directory
mkdir -p client-reports/
mkdir -p client-reports/drugs/
mkdir -p client-reports/companies/
mkdir -p client-reports/therapeutics/
mkdir -p client-reports/analytics/

# Preserve high-value client reports
mv public/Atirmociclib.html client-reports/drugs/
mv public/Disitamab.html client-reports/drugs/
mv public/imlunestrant.html client-reports/drugs/
mv public/Lu-NeoB.html client-reports/drugs/

mv public/avidity-sci.html client-reports/companies/
mv public/SyneticxXwideOak.html client-reports/companies/
mv public/blackstone.html client-reports/companies/

mv public/BreastCancerTherapeutics.html client-reports/therapeutics/
mv public/ultra-orphan.html client-reports/therapeutics/

mv public/TEG.html client-reports/analytics/
mv public/methodology-report.html client-reports/analytics/
mv public/competitive.html client-reports/analytics/
```

### **URL Redirection System**
```javascript
// Add to server.js - CRITICAL for client continuity
const clientReportRoutes = [
  { old: '/public/Atirmociclib.html', new: '/client-reports/drugs/Atirmociclib.html' },
  { old: '/public/avidity-sci.html', new: '/client-reports/companies/avidity-sci.html' },
  // ... all 58 reports
];

clientReportRoutes.forEach(route => {
  app.get(route.old, (req, res) => res.redirect(301, route.new));
});
```

**Validation**: Test all existing client URLs still work after migration.

---

## 🏗️ **STAGE 1B: MULTI-AGENT FOUNDATION (1.5 hours)**

### **Directory Structure Creation**
```bash
mkdir -p agents/
mkdir -p agents/core/
mkdir -p agents/intelligence/
mkdir -p agents/exports/
mkdir -p knowledge-graph/
mkdir -p orchestrator/
mkdir -p cache/enhanced/
```

### **Base Agent Class**
```javascript
// agents/core/BaseAgent.js
class BaseAgent {
  constructor(name, capabilities = []) {
    this.name = name;
    this.capabilities = capabilities;
    this.status = 'initializing';
    this.lastActivity = new Date();
    this.processedRequests = 0;
  }

  async initialize() {
    this.status = 'ready';
    console.log(`🤖 Agent ${this.name} initialized with capabilities: ${this.capabilities.join(', ')}`);
  }

  async process(request) {
    this.lastActivity = new Date();
    this.processedRequests++;
    // Override in specialized agents
  }

  getStatus() {
    return {
      name: this.name,
      status: this.status,
      capabilities: this.capabilities,
      lastActivity: this.lastActivity,
      processedRequests: this.processedRequests
    };
  }
}

export default BaseAgent;
```

### **Agent Orchestrator**
```javascript
// orchestrator/AgentOrchestrator.js
import BaseAgent from '../agents/core/BaseAgent.js';

class AgentOrchestrator {
  constructor() {
    this.agents = new Map();
    this.messageQueue = [];
    this.isProcessing = false;
  }

  registerAgent(agent) {
    if (!(agent instanceof BaseAgent)) {
      throw new Error('Agent must extend BaseAgent class');
    }
    this.agents.set(agent.name, agent);
    console.log(`📋 Registered agent: ${agent.name}`);
  }

  async routeRequest(request, capabilities = []) {
    const suitableAgents = Array.from(this.agents.values())
      .filter(agent => 
        capabilities.some(cap => agent.capabilities.includes(cap))
      );

    if (suitableAgents.length === 0) {
      throw new Error(`No agents available for capabilities: ${capabilities.join(', ')}`);
    }

    // Route to least busy suitable agent
    const selectedAgent = suitableAgents.reduce((prev, current) => 
      prev.processedRequests < current.processedRequests ? prev : current
    );

    return await selectedAgent.process(request);
  }

  getSystemStatus() {
    return {
      totalAgents: this.agents.size,
      agentStatus: Array.from(this.agents.values()).map(agent => agent.getStatus()),
      messageQueueLength: this.messageQueue.length,
      isProcessing: this.isProcessing
    };
  }
}

export default AgentOrchestrator;
```

**Validation**: Orchestrator can register and route to agents successfully.

---

## 🗄️ **STAGE 1C: MONGODB KNOWLEDGE GRAPH SCHEMA (1 hour)**

### **Enhanced Collections Structure**
```javascript
// knowledge-graph/schema.js
const mongoSchema = {
  // Entity Collections
  drugs: {
    _id: ObjectId,
    name: String,
    nda_numbers: [String],
    patents: [{
      number: String,
      expiry_date: Date,
      status: String
    }],
    manufacturers: [ObjectId], // Reference to companies
    regulatory_actions: [ObjectId], // Reference to regulatory_actions
    clinical_trials: [ObjectId], // Reference to trials
    created_at: Date,
    updated_at: Date,
    data_sources: [String] // Track where data came from
  },

  companies: {
    _id: ObjectId,
    name: String,
    products: [ObjectId], // Reference to drugs
    regulatory_history: [{
      action_id: ObjectId,
      date: Date,
      severity: String
    }],
    financial_data: {
      market_cap: Number,
      revenue: Number,
      last_updated: Date
    },
    created_at: Date,
    updated_at: Date
  },

  regulatory_actions: {
    _id: ObjectId,
    type: String, // 'warning_letter', '483_inspection', 'approval', 'recall'
    date: Date,
    affected_entities: [{
      entity_type: String, // 'drug', 'company', 'facility'
      entity_id: ObjectId,
      impact_level: String // 'high', 'medium', 'low'
    }],
    details: {
      reason: String,
      classification: String,
      status: String,
      full_text: String
    },
    ai_analysis: {
      severity_score: Number,
      predicted_impact: String,
      related_patterns: [String]
    },
    created_at: Date,
    updated_at: Date
  },

  clinical_trials: {
    _id: ObjectId,
    nct_id: String,
    title: String,
    phase: String,
    status: String,
    sponsor: ObjectId, // Reference to companies
    drugs_tested: [ObjectId], // Reference to drugs
    conditions: [String],
    outcomes: {
      primary_endpoint_met: Boolean,
      results_summary: String,
      publication_date: Date
    },
    competitive_intelligence: {
      strategic_importance: String,
      market_impact: String
    },
    created_at: Date,
    updated_at: Date
  },

  // Relationship Collections for Graph Queries
  relationships: {
    _id: ObjectId,
    type: String, // 'manufactures', 'tests', 'competes_with', 'regulates'
    from_entity: {
      collection: String,
      entity_id: ObjectId
    },
    to_entity: {
      collection: String,
      entity_id: ObjectId
    },
    relationship_data: {
      strength: Number, // 0.0 to 1.0
      context: String,
      date_established: Date,
      confidence: Number
    },
    created_at: Date
  },

  // AI-Generated Insights
  insights: {
    _id: ObjectId,
    type: String, // 'pattern', 'risk_assessment', 'opportunity', 'trend'
    title: String,
    description: String,
    entities_involved: [{
      collection: String,
      entity_id: ObjectId,
      relevance: Number
    }],
    confidence_score: Number,
    business_impact: String,
    generated_by: String, // Which agent generated this
    validated: Boolean,
    created_at: Date,
    expires_at: Date
  }
};
```

### **MongoDB Indexes for Performance**
```javascript
// knowledge-graph/indexes.js
const createIndexes = async (db) => {
  // Entity indexes
  await db.collection('drugs').createIndex({ name: 1 });
  await db.collection('drugs').createIndex({ nda_numbers: 1 });
  await db.collection('companies').createIndex({ name: 1 });
  await db.collection('regulatory_actions').createIndex({ date: -1, type: 1 });
  await db.collection('clinical_trials').createIndex({ nct_id: 1 });
  
  // Relationship indexes for graph queries
  await db.collection('relationships').createIndex({ 
    'from_entity.collection': 1, 
    'from_entity.entity_id': 1 
  });
  await db.collection('relationships').createIndex({ 
    'to_entity.collection': 1, 
    'to_entity.entity_id': 1 
  });
  
  // AI insights indexes
  await db.collection('insights').createIndex({ type: 1, confidence_score: -1 });
  await db.collection('insights').createIndex({ created_at: -1 });
};
```

**Validation**: MongoDB schema supports complex pharmaceutical relationship queries.

---

## 🔌 **STAGE 1D: API RESTRUCTURING (30 minutes)**

### **Agent Communication API**
```javascript
// orchestrator/api-routes.js
import express from 'express';
import AgentOrchestrator from './AgentOrchestrator.js';

const router = express.Router();
const orchestrator = new AgentOrchestrator();

// Agent system status
router.get('/agents/status', (req, res) => {
  res.json({
    success: true,
    system: orchestrator.getSystemStatus(),
    timestamp: new Date().toISOString()
  });
});

// Route request to appropriate agents
router.post('/intelligence/query', async (req, res) => {
  try {
    const { query, user_type, capabilities } = req.body;
    
    const result = await orchestrator.routeRequest({
      query,
      user_type,
      timestamp: new Date()
    }, capabilities);

    res.json({
      success: true,
      result,
      processed_by: result.agent_name,
      processing_time: result.processing_time
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
```

**Validation**: API can route requests to agents and return system status.

---

## ✅ **STAGE 1 COMPLETION CHECKLIST**

- [ ] All 58 client reports preserved and accessible via redirects
- [ ] Multi-agent foundation classes created and tested
- [ ] Agent orchestrator can register and route to agents
- [ ] MongoDB knowledge graph schema implemented
- [ ] Database indexes created for performance
- [ ] Agent communication API endpoints functional
- [ ] System status monitoring operational

## 📊 **STAGE 1 SUCCESS METRICS**
- **Client Continuity**: 100% of existing client URLs still functional
- **System Foundation**: Multi-agent orchestrator operational
- **Data Architecture**: Knowledge graph schema ready for data ingestion
- **API Readiness**: Agent communication endpoints responding

## 🚀 **NEXT STAGE PREPARATION**
Stage 1 creates the foundation for Stage 2's agent deployment and knowledge graph population. All client reports remain accessible throughout the transformation.

---

**Estimated Completion Time**: 4 hours  
**Risk Level**: Low (no client-facing changes)  
**Rollback Capability**: Instant (simple file movement reversal)