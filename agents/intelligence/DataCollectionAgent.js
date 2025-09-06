// DATA COLLECTION AGENT - Commander of Pharmaceutical Data Sources
// Orchestrates FDA, EMA, PubMed, clinical trials data ingestion with rate limiting

const BaseAgent = require('../core/BaseAgent.js');
const axios = require('axios');

class DataCollectionAgent extends BaseAgent {
  constructor() {
    super('DataCollectionAgent', [
      'fda_data_collection',
      'ema_data_collection', 
      'pubmed_integration',
      'clinical_trials_data',
      'regulatory_monitoring',
      'data_quality_validation',
      'api_rate_limiting'
    ]);

    // Data source configurations
    this.dataSources = {
      fda: {
        baseUrl: 'https://api.fda.gov',
        rateLimit: 1000, // requests per day
        currentRequests: 0,
        lastReset: new Date()
      },
      ema: {
        baseUrl: 'https://www.ema.europa.eu',
        rateLimit: 500,
        currentRequests: 0,
        lastReset: new Date()
      },
      pubmed: {
        baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
        rateLimit: 3, // requests per second
        currentRequests: 0,
        lastReset: new Date()
      },
      clinicalTrials: {
        baseUrl: 'https://clinicaltrials.gov/api',
        rateLimit: 100, // requests per minute
        currentRequests: 0,
        lastReset: new Date()
      }
    };

    // Cache for reducing API calls
    this.cache = new Map();
    this.cacheTimeout = 60 * 60 * 1000; // 1 hour
  }

  async onInitialize() {
    console.log('🔄 Initializing Data Collection Agent...');
    
    // Initialize rate limiting timers
    this.startRateLimitResets();
    
    // Test connectivity to key data sources
    await this.testDataSourceConnectivity();
    
    console.log('✅ Data Collection Agent ready for pharmaceutical data ingestion');
  }

  async onProcess(request) {
    const { type, source, params } = request;

    switch (type) {
      case 'collect_drug_data':
        return await this.collectDrugData(params);
      
      case 'collect_regulatory_actions':
        return await this.collectRegulatoryActions(params);
      
      case 'collect_clinical_trials':
        return await this.collectClinicalTrials(params);
      
      case 'validate_data_quality':
        return await this.validateDataQuality(params);
      
      case 'monitor_data_sources':
        return await this.monitorDataSources();
      
      default:
        throw new Error(`Unknown request type: ${type}`);
    }
  }

  /**
   * Collect comprehensive drug data from multiple sources
   */
  async collectDrugData(params) {
    const { drugName, nda, includeTrials = true } = params;
    
    try {
      console.log(`📊 Collecting drug data for: ${drugName || nda}`);
      
      const results = {
        drug_name: drugName,
        nda: nda,
        sources: {},
        data_quality_score: 0,
        collection_timestamp: new Date()
      };

      // FDA Drug Data
      if (await this.checkRateLimit('fda')) {
        try {
          const fdaData = await this.collectFDADrugData(drugName, nda);
          results.sources.fda = fdaData;
          results.data_quality_score += 25;
        } catch (error) {
          console.warn(`⚠️  FDA data collection failed: ${error.message}`);
          results.sources.fda = { error: error.message };
        }
      }

      // EMA Data
      if (await this.checkRateLimit('ema')) {
        try {
          const emaData = await this.collectEMADrugData(drugName);
          results.sources.ema = emaData;
          results.data_quality_score += 20;
        } catch (error) {
          console.warn(`⚠️  EMA data collection failed: ${error.message}`);
          results.sources.ema = { error: error.message };
        }
      }

      // PubMed Literature
      if (await this.checkRateLimit('pubmed')) {
        try {
          const pubmedData = await this.collectPubMedData(drugName);
          results.sources.pubmed = pubmedData;
          results.data_quality_score += 15;
        } catch (error) {
          console.warn(`⚠️  PubMed data collection failed: ${error.message}`);
          results.sources.pubmed = { error: error.message };
        }
      }

      // Clinical Trials
      if (includeTrials && await this.checkRateLimit('clinicalTrials')) {
        try {
          const trialsData = await this.collectClinicalTrialsData(drugName);
          results.sources.clinical_trials = trialsData;
          results.data_quality_score += 40;
        } catch (error) {
          console.warn(`⚠️  Clinical trials data collection failed: ${error.message}`);
          results.sources.clinical_trials = { error: error.message };
        }
      }

      return {
        success: true,
        data: results,
        summary: {
          sources_accessed: Object.keys(results.sources).length,
          data_quality_score: results.data_quality_score,
          has_fda_data: !!results.sources.fda && !results.sources.fda.error,
          has_trials_data: !!results.sources.clinical_trials && !results.sources.clinical_trials.error
        }
      };

    } catch (error) {
      throw new Error(`Drug data collection failed: ${error.message}`);
    }
  }

  /**
   * Collect FDA drug data
   */
  async collectFDADrugData(drugName, nda) {
    const cacheKey = `fda_${drugName}_${nda}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('📋 Using cached FDA data');
        return cached.data;
      }
    }

    this.dataSources.fda.currentRequests++;
    
    try {
      let searchQuery = '';
      if (nda) {
        searchQuery = `application_number:${nda}`;
      } else if (drugName) {
        searchQuery = `openfda.brand_name:"${drugName}" OR openfda.generic_name:"${drugName}"`;
      }

      const response = await axios.get(
        `${this.dataSources.fda.baseUrl}/drug/drugsfda.json?search=${encodeURIComponent(searchQuery)}&limit=10`,
        { timeout: 10000 }
      );

      const data = {
        applications: response.data.results || [],
        total_results: response.data.results?.length || 0,
        search_query: searchQuery
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });

      return data;

    } catch (error) {
      if (error.response?.status === 404) {
        return { applications: [], total_results: 0, search_query: searchQuery };
      }
      throw error;
    }
  }

  /**
   * Collect EMA drug data (simplified implementation)
   */
  async collectEMADrugData(drugName) {
    const cacheKey = `ema_${drugName}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    this.dataSources.ema.currentRequests++;

    // Placeholder for EMA data collection
    // In production, this would integrate with EMA's actual APIs or web scraping
    const data = {
      drug_name: drugName,
      ema_status: 'data_collection_placeholder',
      note: 'EMA integration requires specialized scraping or API access'
    };

    this.cache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });

    return data;
  }

  /**
   * Collect PubMed literature data
   */
  async collectPubMedData(drugName) {
    const cacheKey = `pubmed_${drugName}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    this.dataSources.pubmed.currentRequests++;

    try {
      // Search PubMed for drug-related articles
      const searchResponse = await axios.get(
        `${this.dataSources.pubmed.baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(drugName)}&retmax=10&retmode=json`,
        { timeout: 5000 }
      );

      const data = {
        search_term: drugName,
        article_count: searchResponse.data.esearchresult?.count || 0,
        article_ids: searchResponse.data.esearchresult?.idlist || [],
        search_timestamp: new Date()
      };

      this.cache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });

      return data;

    } catch (error) {
      throw new Error(`PubMed search failed: ${error.message}`);
    }
  }

  /**
   * Collect clinical trials data
   */
  async collectClinicalTrialsData(drugName) {
    const cacheKey = `trials_${drugName}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    this.dataSources.clinicalTrials.currentRequests++;

    // Placeholder for clinical trials data collection
    const data = {
      drug_name: drugName,
      trials_found: 0,
      note: 'Clinical trials integration placeholder'
    };

    this.cache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });

    return data;
  }

  /**
   * Validate data quality across sources
   */
  async validateDataQuality(params) {
    const { data } = params;
    
    const quality = {
      completeness_score: 0,
      consistency_score: 0,
      freshness_score: 0,
      overall_score: 0,
      issues: []
    };

    // Check data completeness
    if (data.sources?.fda) quality.completeness_score += 40;
    if (data.sources?.ema) quality.completeness_score += 20;
    if (data.sources?.pubmed) quality.completeness_score += 20;
    if (data.sources?.clinical_trials) quality.completeness_score += 20;

    // Check data freshness (within last 24 hours is optimal)
    const dataAge = Date.now() - new Date(data.collection_timestamp).getTime();
    const ageHours = dataAge / (1000 * 60 * 60);
    quality.freshness_score = Math.max(0, 100 - (ageHours * 2));

    // Basic consistency checks
    quality.consistency_score = 85; // Placeholder

    quality.overall_score = Math.round(
      (quality.completeness_score * 0.4) +
      (quality.consistency_score * 0.35) +
      (quality.freshness_score * 0.25)
    );

    return {
      success: true,
      quality_assessment: quality
    };
  }

  /**
   * Check rate limits for a data source
   */
  async checkRateLimit(source) {
    const sourceConfig = this.dataSources[source];
    if (!sourceConfig) return false;

    const now = new Date();
    const timeSinceReset = now - sourceConfig.lastReset;

    // Reset counters based on rate limit period
    let resetPeriod;
    switch (source) {
      case 'fda':
      case 'ema':
        resetPeriod = 24 * 60 * 60 * 1000; // Daily
        break;
      case 'pubmed':
        resetPeriod = 1000; // Per second
        break;
      case 'clinicalTrials':
        resetPeriod = 60 * 1000; // Per minute
        break;
    }

    if (timeSinceReset > resetPeriod) {
      sourceConfig.currentRequests = 0;
      sourceConfig.lastReset = now;
    }

    return sourceConfig.currentRequests < sourceConfig.rateLimit;
  }

  /**
   * Start rate limit reset timers
   */
  startRateLimitResets() {
    // Reset daily limits (FDA, EMA)
    setInterval(() => {
      this.dataSources.fda.currentRequests = 0;
      this.dataSources.ema.currentRequests = 0;
      console.log('🔄 Reset daily API rate limits');
    }, 24 * 60 * 60 * 1000);

    // Reset per-minute limits (Clinical Trials)
    setInterval(() => {
      this.dataSources.clinicalTrials.currentRequests = 0;
    }, 60 * 1000);

    // Reset per-second limits (PubMed)
    setInterval(() => {
      this.dataSources.pubmed.currentRequests = 0;
    }, 1000);
  }

  /**
   * Test connectivity to data sources
   */
  async testDataSourceConnectivity() {
    console.log('🔍 Testing data source connectivity...');
    
    const tests = [
      { name: 'FDA API', test: () => axios.get(`${this.dataSources.fda.baseUrl}/drug/drugsfda.json?limit=1`, { timeout: 5000 }) },
      { name: 'PubMed API', test: () => axios.get(`${this.dataSources.pubmed.baseUrl}/esearch.fcgi?db=pubmed&term=aspirin&retmax=1&retmode=json`, { timeout: 5000 }) }
    ];

    for (const { name, test } of tests) {
      try {
        await test();
        console.log(`✅ ${name} connectivity: OK`);
      } catch (error) {
        console.warn(`⚠️  ${name} connectivity: ${error.message}`);
      }
    }
  }

  /**
   * Monitor data source health and performance
   */
  async monitorDataSources() {
    const status = {
      timestamp: new Date(),
      sources: {}
    };

    for (const [name, config] of Object.entries(this.dataSources)) {
      status.sources[name] = {
        rate_limit: config.rateLimit,
        current_requests: config.currentRequests,
        utilization: ((config.currentRequests / config.rateLimit) * 100).toFixed(2) + '%',
        last_reset: config.lastReset
      };
    }

    status.cache = {
      size: this.cache.size,
      hit_rate: 'calculated_in_production' // Would track actual hit rate
    };

    return {
      success: true,
      monitoring_data: status
    };
  }
}

module.exports = DataCollectionAgent;