const EMAScraper = require('./emaScraper');
const axios = require('axios');

/**
 * Integration module for using EMA scraper in clinical trials backend
 */
class ClinicalTrialsEMAIntegration {
  constructor(options = {}) {
    this.scraper = new EMAScraper({
      downloadDocuments: options.downloadDocuments || false,
      documentsPath: options.documentsPath || './ema-documents',
      timeout: options.timeout || 30000
    });
    
    this.cache = new Map(); // Simple in-memory cache
    this.cacheTimeout = options.cacheTimeout || 3600000; // 1 hour default
  }

  /**
   * Get drug information by EMA URL
   * @param {string} drugUrl - Full URL to EMA drug page
   * @returns {Object} Drug information
   */
  async getDrugInfoByUrl(drugUrl) {
    // Check cache first
    const cached = this.getFromCache(drugUrl);
    if (cached) {
      return cached;
    }

    try {
      // Fetch HTML
      const response = await axios.get(drugUrl, {
        timeout: this.scraper.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Scrape information
      const drugInfo = await this.scraper.scrapeDrugInfo(response.data, drugUrl);
      
      // Cache the result
      this.setCache(drugUrl, drugInfo);
      
      return drugInfo;
    } catch (error) {
      throw new Error(`Failed to fetch drug information: ${error.message}`);
    }
  }

  /**
   * Get drug information by drug name
   * @param {string} drugName - Name of the drug
   * @returns {Object} Drug information
   */
  async getDrugInfoByName(drugName) {
    // This would require searching EMA website first
    // For now, construct the URL pattern (you'd need to implement search)
    const searchUrl = `https://www.ema.europa.eu/en/medicines/human/EPAR/${drugName.toLowerCase()}`;
    return this.getDrugInfoByUrl(searchUrl);
  }

  /**
   * Get multiple drugs information
   * @param {Array<string>} drugUrls - Array of drug URLs
   * @returns {Array<Object>} Array of drug information
   */
  async getMultipleDrugsInfo(drugUrls) {
    const results = await Promise.allSettled(
      drugUrls.map(url => this.getDrugInfoByUrl(url))
    );

    return results.map((result, index) => ({
      url: drugUrls[index],
      status: result.status,
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  }

  /**
   * Extract specific information for clinical trials
   * @param {Object} drugInfo - Complete drug information from scraper
   * @returns {Object} Filtered information relevant for clinical trials
   */
  extractClinicalTrialRelevantInfo(drugInfo) {
    return {
      drugName: drugInfo.basic.name,
      activeSubstance: drugInfo.basic.activeSubstance,
      status: drugInfo.basic.status,
      therapeuticArea: drugInfo.productDetails.therapeutic_area_mesh,
      atcCode: drugInfo.productDetails.anatomical_therapeutic_chemical_atc_code,
      indication: drugInfo.productDetails.therapeuticIndication,
      marketingAuthHolder: drugInfo.authorizationDetails.marketing_authorisation_holder,
      authorizationDate: drugInfo.authorizationDetails.marketing_authorisation_issued,
      
      // Summary for quick reference
      summary: drugInfo.overview.summary,
      
      // Key sections for clinical context
      howItWorks: this.findOverviewSection(drugInfo.overview.sections, 'How does'),
      benefits: this.findOverviewSection(drugInfo.overview.sections, 'benefits'),
      risks: this.findOverviewSection(drugInfo.overview.sections, 'risks'),
      
      // Document references
      documents: {
        productInfo: drugInfo.documents.productInformation.map(d => ({
          title: d.title,
          url: d.mainFile.url,
          lastUpdated: d.mainFile.lastUpdated
        })),
        assessmentReports: drugInfo.documents.assessment.map(d => ({
          title: d.title,
          url: d.mainFile.url,
          referenceNumber: d.referenceNumber
        }))
      },
      
      // Metadata
      lastScraped: drugInfo.metadata.scrapedAt,
      sourceUrl: drugInfo.metadata.pageUrl
    };
  }

  /**
   * Save drug information to database (example implementation)
   * @param {Object} drugInfo - Drug information to save
   * @param {Object} db - Database connection/model
   */
  async saveDrugInfoToDatabase(drugInfo, db) {
    const clinicalInfo = this.extractClinicalTrialRelevantInfo(drugInfo);
    
    // Example with MongoDB/Mongoose
    try {
      const drug = await db.Drug.findOneAndUpdate(
        { emaUrl: drugInfo.metadata.pageUrl },
        {
          ...clinicalInfo,
          fullData: drugInfo, // Store complete data as well
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
      
      return drug;
    } catch (error) {
      throw new Error(`Failed to save drug information: ${error.message}`);
    }
  }

  /**
   * Helper function to find overview section by keyword
   */
  findOverviewSection(sections, keyword) {
    const section = sections.find(s => 
      s.title.toLowerCase().includes(keyword.toLowerCase())
    );
    return section ? section.content : null;
  }

  /**
   * Cache management
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

/**
 * Express.js route example
 */
function setupEMARoutes(app, integration) {
  // Get drug info by URL
  app.get('/api/ema/drug', async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
      }

      const drugInfo = await integration.getDrugInfoByUrl(url);
      const clinicalInfo = integration.extractClinicalTrialRelevantInfo(drugInfo);
      
      res.json({
        success: true,
        data: clinicalInfo,
        fullData: req.query.full === 'true' ? drugInfo : undefined
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get multiple drugs
  app.post('/api/ema/drugs/batch', async (req, res) => {
    try {
      const { urls } = req.body;
      if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({ error: 'URLs array is required' });
      }

      const results = await integration.getMultipleDrugsInfo(urls);
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Sync drug to database
  app.post('/api/ema/drug/sync', async (req, res) => {
    try {
      const { url } = req.body;
      const drugInfo = await integration.getDrugInfoByUrl(url);
      
      // Assuming you have a database model available
      const saved = await integration.saveDrugInfoToDatabase(drugInfo, req.db);
      
      res.json({
        success: true,
        data: saved
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
}

module.exports = {
  ClinicalTrialsEMAIntegration,
  setupEMARoutes
};