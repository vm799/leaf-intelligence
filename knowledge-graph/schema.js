// MONGODB KNOWLEDGE GRAPH SCHEMA
// Comprehensive pharmaceutical data relationship modeling for multi-agent system

const { ObjectId } = require('mongodb');

/**
 * MongoDB Collections Schema for Pharmaceutical Knowledge Graph
 * Designed to support complex relationship queries and AI-powered insights
 */

const mongoSchema = {
  // ================================
  // ENTITY COLLECTIONS
  // ================================

  /**
   * DRUGS COLLECTION
   * Core pharmaceutical products with regulatory and manufacturing data
   */
  drugs: {
    _id: ObjectId,
    name: String, // Brand name
    generic_name: String,
    nda_numbers: [String], // FDA application numbers
    anda_numbers: [String], // Generic drug application numbers
    
    // Patent information
    patents: [{
      number: String,
      expiry_date: Date,
      status: String, // 'active', 'expired', 'pending'
      type: String, // 'composition', 'method', 'formulation'
      strength: Number // Patent strength score 0-1
    }],
    
    // Manufacturing relationships
    manufacturers: [ObjectId], // Reference to companies collection
    
    // Regulatory relationships
    regulatory_actions: [ObjectId], // Reference to regulatory_actions collection
    
    // Clinical development
    clinical_trials: [ObjectId], // Reference to trials collection
    
    // Drug characteristics
    therapeutic_areas: [String],
    indications: [String],
    dosage_forms: [String],
    routes_of_administration: [String],
    
    // Market data
    market_data: {
      approval_date: Date,
      launch_date: Date,
      revenue_estimates: [{
        year: Number,
        revenue_usd: Number,
        source: String
      }],
      market_share: Number,
      competitive_position: String
    },
    
    // AI-generated insights
    ai_insights: {
      risk_score: Number, // 0-100 regulatory risk
      opportunity_score: Number, // 0-100 market opportunity
      competitive_threat_level: String, // 'low', 'medium', 'high'
      patent_cliff_risk: {
        score: Number,
        key_patents_expiring: [Date],
        estimated_revenue_at_risk: Number
      }
    },
    
    // Metadata
    created_at: Date,
    updated_at: Date,
    data_sources: [String], // Track where data came from
    data_quality_score: Number, // 0-100
    last_validation: Date
  },

  /**
   * COMPANIES COLLECTION
   * Pharmaceutical companies with comprehensive business intelligence
   */
  companies: {
    _id: ObjectId,
    name: String,
    ticker_symbol: String,
    company_type: String, // 'pharma', 'biotech', 'generic', 'cro'
    
    // Product portfolio
    products: [ObjectId], // Reference to drugs collection
    pipeline_drugs: [ObjectId], // Drugs in development
    
    // Regulatory history and compliance
    regulatory_history: [{
      action_id: ObjectId, // Reference to regulatory_actions
      date: Date,
      severity: String, // 'minor', 'major', 'critical'
      impact_score: Number, // 0-100
      resolution_status: String // 'pending', 'resolved', 'ongoing'
    }],
    
    // Financial and market data
    financial_data: {
      market_cap: Number,
      revenue: Number,
      r_and_d_spending: Number,
      profit_margin: Number,
      debt_to_equity_ratio: Number,
      last_updated: Date,
      currency: String
    },
    
    // Strategic relationships
    partnerships: [{
      partner_company_id: ObjectId,
      partnership_type: String, // 'licensing', 'joint_venture', 'merger', 'acquisition'
      start_date: Date,
      end_date: Date,
      value_usd: Number,
      status: String // 'active', 'completed', 'terminated'
    }],
    
    // Manufacturing and facilities
    facilities: [{
      facility_id: String, // FDA FEI number
      location: {
        address: String,
        city: String,
        state: String,
        country: String,
        coordinates: {
          latitude: Number,
          longitude: Number
        }
      },
      facility_type: String, // 'manufacturing', 'research', 'clinical'
      regulatory_status: String, // 'compliant', 'warning_letter', 'import_alert'
      last_inspection: Date
    }],
    
    // AI-generated insights
    competitive_intelligence: {
      market_position: String, // 'leader', 'challenger', 'follower', 'niche'
      innovation_score: Number, // 0-100
      regulatory_compliance_score: Number, // 0-100
      strategic_focus_areas: [String],
      predicted_growth_trajectory: String // 'aggressive', 'stable', 'declining'
    },
    
    created_at: Date,
    updated_at: Date
  },

  /**
   * REGULATORY ACTIONS COLLECTION
   * FDA, EMA, and other regulatory body actions with impact analysis
   */
  regulatory_actions: {
    _id: ObjectId,
    action_type: String, // 'warning_letter', '483_inspection', 'approval', 'recall', 'import_alert'
    regulatory_body: String, // 'FDA', 'EMA', 'PMDA', 'Health_Canada'
    date: Date,
    publication_date: Date,
    
    // Affected entities with impact assessment
    affected_entities: [{
      entity_type: String, // 'drug', 'company', 'facility'
      entity_id: ObjectId,
      impact_level: String, // 'high', 'medium', 'low'
      specific_impact: String, // Description of specific impact
      estimated_financial_impact: Number // USD
    }],
    
    // Action details
    details: {
      title: String,
      reason: String,
      classification: String,
      status: String, // 'open', 'closed', 'resolved'
      full_text: String,
      document_url: String,
      follow_up_required: Boolean,
      deadline: Date
    },
    
    // Response tracking
    responses: [{
      response_date: Date,
      response_type: String, // 'company_response', 'closeout_letter', 'follow_up'
      response_url: String,
      adequacy_assessment: String, // 'adequate', 'inadequate', 'pending_review'
    }],
    
    // AI analysis and predictions
    ai_analysis: {
      severity_score: Number, // 0-100
      predicted_impact: String,
      related_patterns: [String], // Similar historical cases
      resolution_probability: Number, // 0-1
      estimated_resolution_time: Number, // days
      market_sentiment_impact: String // 'positive', 'neutral', 'negative'
    },
    
    created_at: Date,
    updated_at: Date
  },

  /**
   * CLINICAL TRIALS COLLECTION
   * Comprehensive clinical development tracking with competitive intelligence
   */
  clinical_trials: {
    _id: ObjectId,
    nct_id: String, // ClinicalTrials.gov identifier
    title: String,
    official_title: String,
    
    // Trial design and status
    phase: String, // 'Phase I', 'Phase II', 'Phase III', 'Phase IV'
    study_type: String, // 'Interventional', 'Observational'
    status: String, // 'Recruiting', 'Completed', 'Terminated', 'Suspended'
    
    // Key stakeholders
    sponsor: ObjectId, // Reference to companies collection
    principal_investigator: String,
    collaborators: [ObjectId], // Reference to companies collection
    
    // Drugs and interventions
    drugs_tested: [ObjectId], // Reference to drugs collection
    primary_purpose: String,
    intervention_model: String,
    masking: String, // 'None', 'Single', 'Double', 'Triple', 'Quadruple'
    
    // Target conditions and populations
    conditions: [String],
    target_population: {
      enrollment_target: Number,
      actual_enrollment: Number,
      age_range: {
        min: Number,
        max: Number
      },
      gender: String, // 'All', 'Male', 'Female'
      inclusion_criteria: [String],
      exclusion_criteria: [String]
    },
    
    // Timeline and locations
    study_dates: {
      start_date: Date,
      completion_date: Date,
      primary_completion_date: Date,
      first_submitted: Date,
      last_updated: Date
    },
    
    locations: [{
      facility: String,
      city: String,
      state: String,
      country: String,
      status: String // 'Recruiting', 'Completed', 'Withdrawn'
    }],
    
    // Endpoints and outcomes
    primary_endpoints: [String],
    secondary_endpoints: [String],
    outcomes: {
      primary_endpoint_met: Boolean,
      results_summary: String,
      publication_date: Date,
      results_url: String,
      statistical_significance: Boolean,
      safety_profile: String
    },
    
    // Competitive and strategic intelligence
    competitive_intelligence: {
      strategic_importance: String, // 'high', 'medium', 'low'
      market_impact: String,
      competitive_advantage: String,
      differentiation_factors: [String],
      threat_to_existing_products: [ObjectId] // Reference to drugs that might be threatened
    },
    
    // AI-powered predictions
    ai_predictions: {
      success_probability: Number, // 0-1
      estimated_completion_date: Date,
      market_potential_score: Number, // 0-100
      competitive_threat_score: Number, // 0-100
      regulatory_risk_factors: [String]
    },
    
    created_at: Date,
    updated_at: Date
  },

  // ================================
  // RELATIONSHIP COLLECTIONS
  // ================================

  /**
   * RELATIONSHIPS COLLECTION
   * Graph-like relationships between entities with weighted connections
   */
  relationships: {
    _id: ObjectId,
    relationship_type: String, // 'manufactures', 'tests', 'competes_with', 'regulates', 'supplies', 'licenses'
    
    // Source and target entities
    from_entity: {
      collection: String, // 'drugs', 'companies', 'trials', 'regulatory_actions'
      entity_id: ObjectId,
      entity_name: String // Denormalized for performance
    },
    
    to_entity: {
      collection: String,
      entity_id: ObjectId,
      entity_name: String
    },
    
    // Relationship characteristics
    relationship_data: {
      strength: Number, // 0.0 to 1.0 - strength of relationship
      confidence: Number, // 0.0 to 1.0 - confidence in relationship accuracy
      context: String, // Additional context about the relationship
      date_established: Date,
      date_ends: Date, // For time-bound relationships
      status: String, // 'active', 'inactive', 'pending'
      
      // Financial aspects
      monetary_value: Number,
      currency: String,
      
      // Source attribution
      data_sources: [String],
      evidence_quality: String // 'high', 'medium', 'low'
    },
    
    // AI-enhanced relationship insights
    ai_insights: {
      relationship_importance: Number, // 0-100
      predicted_duration: Number, // months
      risk_factors: [String],
      opportunity_indicators: [String]
    },
    
    created_at: Date,
    updated_at: Date
  },

  // ================================
  // AI INSIGHTS AND ANALYTICS
  // ================================

  /**
   * INSIGHTS COLLECTION
   * AI-generated insights, patterns, and predictions
   */
  insights: {
    _id: ObjectId,
    insight_type: String, // 'pattern', 'risk_assessment', 'opportunity', 'trend', 'anomaly'
    title: String,
    description: String,
    
    // Entities involved in this insight
    entities_involved: [{
      collection: String,
      entity_id: ObjectId,
      entity_name: String,
      relevance_score: Number // 0-100
    }],
    
    // Insight characteristics
    confidence_score: Number, // 0-100
    urgency: String, // 'low', 'medium', 'high', 'critical'
    business_impact: String, // 'negligible', 'minor', 'moderate', 'major', 'severe'
    time_sensitivity: {
      expires_at: Date,
      refresh_frequency: String // 'daily', 'weekly', 'monthly'
    },
    
    // Categorization and targeting
    target_audiences: [String], // 'executives', 'regulatory', 'legal', 'consultants'
    therapeutic_areas: [String],
    geographic_regions: [String],
    
    // Evidence and supporting data
    supporting_evidence: [{
      evidence_type: String, // 'regulatory_action', 'market_data', 'clinical_result'
      source_entity_id: ObjectId,
      evidence_strength: Number, // 0-100
      description: String
    }],
    
    // Actions and recommendations
    recommended_actions: [{
      action_type: String, // 'monitor', 'investigate', 'alert', 'opportunity'
      priority: String, // 'low', 'medium', 'high'
      description: String,
      estimated_effort: String, // 'low', 'medium', 'high'
      potential_value: Number // Estimated value in USD
    }],
    
    // AI model information
    generated_by: String, // Which AI agent generated this insight
    model_version: String,
    training_data_date: Date,
    validation_status: String, // 'pending', 'validated', 'disputed', 'rejected'
    
    // User interaction tracking
    user_feedback: [{
      user_id: String,
      feedback_type: String, // 'useful', 'not_useful', 'inaccurate'
      feedback_text: String,
      timestamp: Date
    }],
    
    created_at: Date,
    updated_at: Date,
    expires_at: Date
  },

  // ================================
  // SYSTEM AND METADATA
  // ================================

  /**
   * DATA_SOURCES COLLECTION
   * Track and manage external data source information
   */
  data_sources: {
    _id: ObjectId,
    source_name: String, // 'FDA_API', 'EMA_Web', 'PubMed', 'ClinicalTrials.gov'
    source_type: String, // 'api', 'web_scraping', 'manual_entry', 'file_import'
    
    // Connection details
    connection_info: {
      base_url: String,
      api_key_required: Boolean,
      rate_limits: {
        requests_per_second: Number,
        requests_per_day: Number,
        current_usage: Number,
        last_reset: Date
      }
    },
    
    // Data quality and reliability
    quality_metrics: {
      reliability_score: Number, // 0-100
      completeness_score: Number, // 0-100
      freshness_score: Number, // 0-100
      last_successful_update: Date,
      total_records_imported: Number,
      error_rate: Number // 0-1
    },
    
    // Update tracking
    update_schedule: String, // 'real-time', 'hourly', 'daily', 'weekly'
    last_update_attempt: Date,
    next_scheduled_update: Date,
    
    created_at: Date,
    updated_at: Date,
    active: Boolean
  }
};

module.exports = {
  mongoSchema,
  
  // Collection names for easy reference
  collections: {
    DRUGS: 'drugs',
    COMPANIES: 'companies',
    REGULATORY_ACTIONS: 'regulatory_actions',
    CLINICAL_TRIALS: 'clinical_trials',
    RELATIONSHIPS: 'relationships',
    INSIGHTS: 'insights',
    DATA_SOURCES: 'data_sources'
  },

  // Relationship types for validation
  relationshipTypes: [
    'manufactures',
    'tests',
    'competes_with',
    'regulates',
    'supplies',
    'licenses',
    'partners_with',
    'acquires',
    'merges_with',
    'spin_off',
    'subsidiary_of',
    'treats_condition',
    'indicates_for',
    'contraindicated_with'
  ],

  // Entity types for validation
  entityTypes: [
    'drugs',
    'companies', 
    'regulatory_actions',
    'clinical_trials',
    'insights',
    'data_sources'
  ]
};