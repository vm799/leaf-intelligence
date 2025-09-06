// MONGODB INDEXES FOR PHARMACEUTICAL KNOWLEDGE GRAPH
// Optimized indexes for complex pharmaceutical relationship queries and real-time analytics

/**
 * Create performance-optimized indexes for the pharmaceutical knowledge graph
 * These indexes support the multi-agent system's complex query patterns
 */

const createIndexes = async (db) => {
  console.log('🔍 Creating MongoDB indexes for pharmaceutical knowledge graph...');
  
  try {
    // ================================
    // DRUGS COLLECTION INDEXES
    // ================================
    
    console.log('📊 Creating drugs collection indexes...');
    
    // Primary search indexes
    await db.collection('drugs').createIndex({ name: 1 });
    await db.collection('drugs').createIndex({ generic_name: 1 });
    await db.collection('drugs').createIndex({ name: "text", generic_name: "text" });
    
    // Regulatory and application number indexes
    await db.collection('drugs').createIndex({ nda_numbers: 1 });
    await db.collection('drugs').createIndex({ anda_numbers: 1 });
    
    // Therapeutic area and indication searches
    await db.collection('drugs').createIndex({ therapeutic_areas: 1 });
    await db.collection('drugs').createIndex({ indications: 1 });
    
    // Patent cliff analysis indexes
    await db.collection('drugs').createIndex({ "patents.expiry_date": 1 });
    await db.collection('drugs').createIndex({ 
      "patents.expiry_date": 1, 
      "market_data.revenue_estimates.revenue_usd": -1 
    });
    
    // AI insights and risk analysis
    await db.collection('drugs').createIndex({ "ai_insights.risk_score": -1 });
    await db.collection('drugs').createIndex({ "ai_insights.opportunity_score": -1 });
    await db.collection('drugs').createIndex({ "ai_insights.patent_cliff_risk.score": -1 });
    
    // Market data analysis
    await db.collection('drugs').createIndex({ "market_data.approval_date": -1 });
    await db.collection('drugs').createIndex({ "market_data.launch_date": -1 });
    
    // Data quality and freshness
    await db.collection('drugs').createIndex({ data_quality_score: -1 });
    await db.collection('drugs').createIndex({ last_validation: -1 });
    await db.collection('drugs').createIndex({ updated_at: -1 });

    // ================================
    // COMPANIES COLLECTION INDEXES
    // ================================
    
    console.log('🏢 Creating companies collection indexes...');
    
    // Company identification
    await db.collection('companies').createIndex({ name: 1 });
    await db.collection('companies').createIndex({ ticker_symbol: 1 });
    await db.collection('companies').createIndex({ name: "text" });
    
    // Company type and categorization
    await db.collection('companies').createIndex({ company_type: 1 });
    
    // Financial analysis indexes
    await db.collection('companies').createIndex({ "financial_data.market_cap": -1 });
    await db.collection('companies').createIndex({ "financial_data.revenue": -1 });
    await db.collection('companies').createIndex({ "financial_data.r_and_d_spending": -1 });
    
    // Regulatory compliance tracking
    await db.collection('companies').createIndex({ 
      "regulatory_history.severity": 1,
      "regulatory_history.date": -1 
    });
    await db.collection('companies').createIndex({ "regulatory_history.impact_score": -1 });
    
    // Facility and manufacturing
    await db.collection('companies').createIndex({ "facilities.facility_id": 1 });
    await db.collection('companies').createIndex({ "facilities.regulatory_status": 1 });
    await db.collection('companies').createIndex({ "facilities.location.country": 1 });
    
    // Competitive intelligence
    await db.collection('companies').createIndex({ "competitive_intelligence.market_position": 1 });
    await db.collection('companies').createIndex({ "competitive_intelligence.innovation_score": -1 });
    await db.collection('companies').createIndex({ "competitive_intelligence.regulatory_compliance_score": -1 });
    
    // Partnership analysis
    await db.collection('companies').createIndex({ 
      "partnerships.partnership_type": 1,
      "partnerships.status": 1 
    });

    // ================================
    // REGULATORY ACTIONS COLLECTION INDEXES
    // ================================
    
    console.log('📋 Creating regulatory actions collection indexes...');
    
    // Primary regulatory action searches
    await db.collection('regulatory_actions').createIndex({ action_type: 1, date: -1 });
    await db.collection('regulatory_actions').createIndex({ regulatory_body: 1, date: -1 });
    await db.collection('regulatory_actions').createIndex({ date: -1 });
    
    // Status and resolution tracking
    await db.collection('regulatory_actions').createIndex({ "details.status": 1 });
    await db.collection('regulatory_actions').createIndex({ "details.deadline": 1 });
    
    // Impact analysis indexes
    await db.collection('regulatory_actions').createIndex({ 
      "affected_entities.entity_type": 1,
      "affected_entities.impact_level": 1 
    });
    await db.collection('regulatory_actions').createIndex({ "affected_entities.entity_id": 1 });
    await db.collection('regulatory_actions').createIndex({ "affected_entities.estimated_financial_impact": -1 });
    
    // AI analysis and severity scoring
    await db.collection('regulatory_actions').createIndex({ "ai_analysis.severity_score": -1 });
    await db.collection('regulatory_actions').createIndex({ "ai_analysis.resolution_probability": -1 });
    
    // Text search for regulatory content
    await db.collection('regulatory_actions').createIndex({ 
      "details.title": "text",
      "details.reason": "text" 
    });

    // ================================
    // CLINICAL TRIALS COLLECTION INDEXES
    // ================================
    
    console.log('🧪 Creating clinical trials collection indexes...');
    
    // Primary trial identification
    await db.collection('clinical_trials').createIndex({ nct_id: 1 });
    await db.collection('clinical_trials').createIndex({ title: "text", official_title: "text" });
    
    // Phase and status analysis
    await db.collection('clinical_trials').createIndex({ phase: 1, status: 1 });
    await db.collection('clinical_trials').createIndex({ status: 1, "study_dates.start_date": -1 });
    
    // Sponsor and competitive intelligence
    await db.collection('clinical_trials').createIndex({ sponsor: 1 });
    await db.collection('clinical_trials').createIndex({ 
      sponsor: 1, 
      phase: 1,
      "competitive_intelligence.strategic_importance": 1 
    });
    
    // Drug and condition targeting
    await db.collection('clinical_trials').createIndex({ drugs_tested: 1 });
    await db.collection('clinical_trials').createIndex({ conditions: 1 });
    
    // Timeline analysis
    await db.collection('clinical_trials').createIndex({ "study_dates.start_date": -1 });
    await db.collection('clinical_trials').createIndex({ "study_dates.completion_date": -1 });
    await db.collection('clinical_trials').createIndex({ "study_dates.primary_completion_date": 1 });
    
    // Outcomes and success tracking
    await db.collection('clinical_trials').createIndex({ "outcomes.primary_endpoint_met": 1 });
    await db.collection('clinical_trials').createIndex({ "outcomes.statistical_significance": 1 });
    
    // AI predictions and competitive analysis
    await db.collection('clinical_trials').createIndex({ "ai_predictions.success_probability": -1 });
    await db.collection('clinical_trials').createIndex({ "competitive_intelligence.competitive_threat_score": -1 });
    
    // Geographic analysis
    await db.collection('clinical_trials').createIndex({ "locations.country": 1 });

    // ================================
    // RELATIONSHIPS COLLECTION INDEXES
    // ================================
    
    console.log('🔗 Creating relationships collection indexes...');
    
    // Core relationship traversal indexes (critical for graph queries)
    await db.collection('relationships').createIndex({ 
      'from_entity.collection': 1, 
      'from_entity.entity_id': 1 
    });
    await db.collection('relationships').createIndex({ 
      'to_entity.collection': 1, 
      'to_entity.entity_id': 1 
    });
    
    // Bidirectional relationship queries
    await db.collection('relationships').createIndex({ 
      'from_entity.entity_id': 1,
      'to_entity.entity_id': 1 
    });
    
    // Relationship type and strength analysis
    await db.collection('relationships').createIndex({ 
      relationship_type: 1,
      'relationship_data.strength': -1 
    });
    await db.collection('relationships').createIndex({ 'relationship_data.confidence': -1 });
    await db.collection('relationships').createIndex({ 'relationship_data.status': 1 });
    
    // Temporal relationship analysis
    await db.collection('relationships').createIndex({ 'relationship_data.date_established': -1 });
    await db.collection('relationships').createIndex({ 'relationship_data.date_ends': 1 });
    
    // Financial relationship analysis
    await db.collection('relationships').createIndex({ 'relationship_data.monetary_value': -1 });
    
    // AI insights on relationships
    await db.collection('relationships').createIndex({ 'ai_insights.relationship_importance': -1 });

    // ================================
    // INSIGHTS COLLECTION INDEXES
    // ================================
    
    console.log('🧠 Creating AI insights collection indexes...');
    
    // Insight categorization and targeting
    await db.collection('insights').createIndex({ insight_type: 1, confidence_score: -1 });
    await db.collection('insights').createIndex({ target_audiences: 1 });
    await db.collection('insights').createIndex({ therapeutic_areas: 1 });
    
    // Business impact and urgency
    await db.collection('insights').createIndex({ urgency: 1, business_impact: 1 });
    await db.collection('insights').createIndex({ confidence_score: -1 });
    
    // Entity-based insight queries
    await db.collection('insights').createIndex({ 
      'entities_involved.entity_id': 1,
      'entities_involved.relevance_score': -1 
    });
    await db.collection('insights').createIndex({ 'entities_involved.collection': 1 });
    
    // Time-based insight management
    await db.collection('insights').createIndex({ created_at: -1 });
    await db.collection('insights').createIndex({ expires_at: 1 });
    await db.collection('insights').createIndex({ validation_status: 1 });
    
    // AI model tracking
    await db.collection('insights').createIndex({ generated_by: 1, model_version: 1 });
    
    // Text search for insights
    await db.collection('insights').createIndex({ title: "text", description: "text" });

    // ================================
    // DATA SOURCES COLLECTION INDEXES
    // ================================
    
    console.log('📡 Creating data sources collection indexes...');
    
    await db.collection('data_sources').createIndex({ source_name: 1 });
    await db.collection('data_sources').createIndex({ source_type: 1 });
    await db.collection('data_sources').createIndex({ active: 1 });
    await db.collection('data_sources').createIndex({ 'quality_metrics.reliability_score': -1 });
    await db.collection('data_sources').createIndex({ last_update_attempt: -1 });
    await db.collection('data_sources').createIndex({ next_scheduled_update: 1 });

    // ================================
    // COMPOUND INDEXES FOR COMPLEX QUERIES
    // ================================
    
    console.log('🔬 Creating compound indexes for complex pharmaceutical queries...');
    
    // Drug competitive analysis
    await db.collection('drugs').createIndex({
      therapeutic_areas: 1,
      "market_data.approval_date": -1,
      "ai_insights.opportunity_score": -1
    });
    
    // Company regulatory risk assessment
    await db.collection('companies').createIndex({
      company_type: 1,
      "competitive_intelligence.regulatory_compliance_score": -1,
      "financial_data.market_cap": -1
    });
    
    // Clinical trials competitive intelligence
    await db.collection('clinical_trials').createIndex({
      conditions: 1,
      phase: 1,
      status: 1,
      "competitive_intelligence.competitive_threat_score": -1
    });
    
    // Regulatory actions impact analysis
    await db.collection('regulatory_actions').createIndex({
      action_type: 1,
      "ai_analysis.severity_score": -1,
      date: -1
    });
    
    // Cross-entity relationship strength analysis
    await db.collection('relationships').createIndex({
      relationship_type: 1,
      'relationship_data.strength': -1,
      'relationship_data.status': 1
    });

    // ================================
    // GEOSPATIAL INDEXES
    // ================================
    
    console.log('🌍 Creating geospatial indexes...');
    
    // Company facility location analysis
    await db.collection('companies').createIndex({ 
      "facilities.location.coordinates": "2dsphere" 
    });
    
    // Clinical trial geographic distribution
    await db.collection('clinical_trials').createIndex({
      "locations.country": 1,
      "locations.city": 1
    });

    console.log('✅ All MongoDB indexes created successfully!');
    
    return {
      success: true,
      message: 'Knowledge graph indexes optimized for pharmaceutical intelligence queries',
      indexes_created: {
        drugs: 15,
        companies: 14,
        regulatory_actions: 11,
        clinical_trials: 13,
        relationships: 10,
        insights: 10,
        data_sources: 6,
        compound: 5,
        geospatial: 2,
        total: 86
      }
    };
    
  } catch (error) {
    console.error('❌ Failed to create indexes:', error.message);
    throw error;
  }
};

/**
 * Drop all indexes (for development/testing)
 */
const dropAllIndexes = async (db) => {
  console.log('🗑️  Dropping all indexes...');
  
  const collections = ['drugs', 'companies', 'regulatory_actions', 'clinical_trials', 'relationships', 'insights', 'data_sources'];
  
  for (const collectionName of collections) {
    try {
      await db.collection(collectionName).dropIndexes();
      console.log(`✅ Dropped indexes for ${collectionName}`);
    } catch (error) {
      console.warn(`⚠️  Could not drop indexes for ${collectionName}: ${error.message}`);
    }
  }
};

/**
 * Get index usage statistics
 */
const getIndexStats = async (db) => {
  console.log('📊 Gathering index usage statistics...');
  
  const collections = ['drugs', 'companies', 'regulatory_actions', 'clinical_trials', 'relationships', 'insights', 'data_sources'];
  const stats = {};
  
  for (const collectionName of collections) {
    try {
      const indexStats = await db.collection(collectionName).aggregate([
        { $indexStats: {} }
      ]).toArray();
      
      stats[collectionName] = indexStats.map(stat => ({
        name: stat.name,
        usage_count: stat.accesses?.ops || 0,
        last_used: stat.accesses?.since || null
      }));
    } catch (error) {
      console.warn(`⚠️  Could not get stats for ${collectionName}: ${error.message}`);
      stats[collectionName] = [];
    }
  }
  
  return stats;
};

/**
 * Validate index performance for key queries
 */
const validateIndexPerformance = async (db) => {
  console.log('🔍 Validating index performance...');
  
  const testQueries = [
    // Drug name search
    {
      collection: 'drugs',
      query: { name: 'Atirmociclib' },
      description: 'Drug name lookup'
    },
    
    // Company regulatory risk
    {
      collection: 'companies',
      query: { 
        'regulatory_history.severity': 'major',
        'competitive_intelligence.regulatory_compliance_score': { $lt: 70 }
      },
      description: 'Company regulatory risk assessment'
    },
    
    // Recent regulatory actions
    {
      collection: 'regulatory_actions',
      query: { 
        action_type: 'warning_letter',
        date: { $gte: new Date(Date.now() - 365*24*60*60*1000) }
      },
      description: 'Recent warning letters'
    },
    
    // Active clinical trials
    {
      collection: 'clinical_trials',
      query: {
        status: 'Recruiting',
        phase: 'Phase III'
      },
      description: 'Active Phase III trials'
    },
    
    // Drug-company relationships
    {
      collection: 'relationships',
      query: {
        relationship_type: 'manufactures',
        'from_entity.collection': 'companies',
        'to_entity.collection': 'drugs'
      },
      description: 'Manufacturing relationships'
    }
  ];
  
  const results = [];
  
  for (const test of testQueries) {
    try {
      const startTime = Date.now();
      const explainResult = await db.collection(test.collection)
        .find(test.query)
        .explain('executionStats');
      const endTime = Date.now();
      
      results.push({
        description: test.description,
        execution_time_ms: endTime - startTime,
        documents_examined: explainResult.executionStats.totalDocsExamined,
        documents_returned: explainResult.executionStats.totalDocsReturned,
        index_used: explainResult.executionStats.executionStages.indexName || 'COLLSCAN',
        efficient: explainResult.executionStats.totalDocsExamined <= explainResult.executionStats.totalDocsReturned * 10
      });
    } catch (error) {
      results.push({
        description: test.description,
        error: error.message
      });
    }
  }
  
  return results;
};

module.exports = {
  createIndexes,
  dropAllIndexes,
  getIndexStats,
  validateIndexPerformance
};