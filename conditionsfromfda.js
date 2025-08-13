const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Configuration
const APIS = {
  FDA: 'https://api.fda.gov',
  MESH: 'https://id.nlm.nih.gov/mesh',
  CLINICALTRIALS: 'https://clinicaltrials.gov/api/v2',
  DRUGBANK: 'https://go.drugbank.com/public_api/v1'
};

/**
 * Comprehensive search for condition data across multiple APIs
 * @param {string} condition - The medical condition to search for
 * @returns {Object} - Combined results from multiple medical APIs
 */
async function searchConditionData(condition) {
  const results = {
    condition: condition,
    timestamp: new Date().toISOString(),
    sources: {
      fda_drugs: { data: [], count: 0, error: null },
      clinical_trials: { data: [], count: 0, error: null },
      mesh_terms: { data: [], count: 0, error: null },
      condition_info: { data: {}, error: null }
    },
    summary: {
      total_drugs: 0,
      active_trials: 0,
      drug_names: [],
      related_conditions: []
    }
  };

  // Search FDA Drug Data
  await searchFDADrugs(condition, results);
  
  // Search Clinical Trials
  await searchClinicalTrials(condition, results);
  
  // Search MeSH Terms
  await searchMeSHTerms(condition, results);
  
  // Get Condition Information
  await getConditionInfo(condition, results);

  // Update summary
  updateSummary(results);
  
  return results;
}

/**
 * Search FDA drug databases
 */
async function searchFDADrugs(condition, results) {
  const searchQuery = condition.replace(/[^\w\s]/g, '').replace(/\s+/g, '+');
  
  const endpoints = [
    {
      name: 'labels',
      url: `${APIS.FDA}/drug/label.json`,
      searchField: 'indications_and_usage',
      limit: 50
    },
    {
      name: 'ndc',
      url: `${APIS.FDA}/drug/ndc.json`,
      searchField: 'brand_name',
      limit: 20
    }
  ];

  const fdaResults = [];

  for (const endpoint of endpoints) {
    try {
      const params = {
        search: `${endpoint.searchField}:"${searchQuery}"`,
        limit: endpoint.limit
      };

      const response = await axios.get(endpoint.url, {
        params,
        timeout: 8000,
        headers: { 'User-Agent': 'Medical-Research-API/2.0' }
      });

      if (response.data?.results) {
        fdaResults.push(...response.data.results.map(item => ({
          ...item,
          source: endpoint.name,
          drug_name: extractDrugName(item, endpoint.name)
        })));
      }

    } catch (error) {
      console.error(`FDA ${endpoint.name} error:`, error.message);
    }
  }

  results.sources.fda_drugs.data = fdaResults;
  results.sources.fda_drugs.count = fdaResults.length;
}

/**
 * Search Clinical Trials
 */
async function searchClinicalTrials(condition, results) {
  try {
    const params = {
      'query.cond': condition,
      'query.recrs': 'a,f,d', // Active, completed, recruiting
      'countTotal': true,
      'pageSize': 20,
      'format': 'json'
    };

    const response = await axios.get(`${APIS.CLINICALTRIALS}/studies`, {
      params,
      timeout: 10000
    });

    if (response.data?.studies) {
      const trials = response.data.studies.map(study => ({
        nct_id: study.protocolSection?.identificationModule?.nctId,
        title: study.protocolSection?.identificationModule?.briefTitle,
        status: study.protocolSection?.statusModule?.overallStatus,
        phase: study.protocolSection?.designModule?.phases?.[0],
        condition: study.protocolSection?.conditionsModule?.conditions,
        intervention: study.protocolSection?.armsInterventionsModule?.interventions?.[0],
        sponsor: study.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name,
        start_date: study.protocolSection?.statusModule?.startDateStruct?.date
      }));

      results.sources.clinical_trials.data = trials;
      results.sources.clinical_trials.count = trials.length;
    }

  } catch (error) {
    console.error('Clinical Trials error:', error.message);
    results.sources.clinical_trials.error = error.message;
  }
}

/**
 * Search MeSH Terms for related conditions
 */
async function searchMeSHTerms(condition, results) {
  try {
    // Search for MeSH terms related to the condition
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`;
    const params = {
      db: 'mesh',
      term: condition,
      retmode: 'json',
      retmax: 10
    };

    const searchResponse = await axios.get(searchUrl, { params, timeout: 8000 });
    
    if (searchResponse.data?.esearchresult?.idlist?.length > 0) {
      const meshIds = searchResponse.data.esearchresult.idlist.slice(0, 5);
      
      // Get details for MeSH terms
      const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi`;
      const summaryParams = {
        db: 'mesh',
        id: meshIds.join(','),
        retmode: 'json'
      };

      const summaryResponse = await axios.get(summaryUrl, { 
        params: summaryParams, 
        timeout: 8000 
      });

      if (summaryResponse.data?.result) {
        const meshTerms = Object.values(summaryResponse.data.result)
          .filter(item => item.ds_meshterms)
          .map(item => ({
            mesh_id: item.uid,
            term: item.ds_meshterms?.[0],
            scope_note: item.ds_scopenote
          }));

        results.sources.mesh_terms.data = meshTerms;
        results.sources.mesh_terms.count = meshTerms.length;
      }
    }

  } catch (error) {
    console.error('MeSH Terms error:', error.message);
    results.sources.mesh_terms.error = error.message;
  }
}

/**
 * Get general condition information
 */
async function getConditionInfo(condition, results) {
  try {
    // Search for condition information from MedlinePlus
    const medlinePlusUrl = `https://wsearch.nlm.nih.gov/ws/query`;
    const params = {
      db: 'healthTopics',
      term: condition,
      retmode: 'json',
      retmax: 3
    };

    const response = await axios.get(medlinePlusUrl, { params, timeout: 8000 });
    
    if (response.data?.list) {
      const conditionData = {
        definition: `Medical condition: ${condition}`,
        sources: response.data.list.slice(0, 3).map(item => ({
          title: item.content,
          url: item.url
        }))
      };

      results.sources.condition_info.data = conditionData;
    }

  } catch (error) {
    console.error('Condition Info error:', error.message);
    results.sources.condition_info.error = error.message;
  }
}

/**
 * Extract drug name from different FDA endpoints
 */
function extractDrugName(item, source) {
  switch (source) {
    case 'labels':
      return item.openfda?.brand_name?.[0] || 
             item.openfda?.generic_name?.[0] || 
             'Unknown Drug';
    case 'ndc':
      return item.brand_name || item.generic_name || 'Unknown Drug';
    default:
      return 'Unknown Drug';
  }
}

/**
 * Update summary statistics
 */
function updateSummary(results) {
  // Collect unique drug names
  const drugNames = new Set();
  results.sources.fda_drugs.data.forEach(drug => {
    if (drug.drug_name && drug.drug_name !== 'Unknown Drug') {
      drugNames.add(drug.drug_name);
    }
  });

  // Count active trials
  const activeTrials = results.sources.clinical_trials.data.filter(trial => 
    trial.status && ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'ENROLLING_BY_INVITATION'].includes(trial.status.toUpperCase())
  ).length;

  // Extract related conditions from MeSH
  const relatedConditions = results.sources.mesh_terms.data.map(term => term.term).filter(Boolean);

  results.summary = {
    total_drugs: drugNames.size,
    active_trials: activeTrials,
    drug_names: Array.from(drugNames),
    related_conditions: relatedConditions
  };
}

// API Routes

/**
 * GET /api/condition/:condition
 * Comprehensive search for condition data
 */
app.get('/api/condition/:condition', async (req, res) => {
  try {
    const { condition } = req.params;
    
    if (!condition || condition.trim().length === 0) {
      return res.status(400).json({
        error: 'Condition parameter is required',
        example: '/api/condition/diabetes'
      });
    }

    console.log(`Comprehensive search for condition: ${condition}`);
    const results = await searchConditionData(condition.trim());
    
    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/sources
 * Get information about available data sources
 */
app.get('/api/sources', (req, res) => {
  res.json({
    success: true,
    sources: [
      {
        name: 'FDA Drug Database',
        description: 'Official FDA drug labels and NDC directory',
        endpoints: ['Drug Labels', 'National Drug Code']
      },
      {
        name: 'ClinicalTrials.gov',
        description: 'Clinical trials database',
        endpoints: ['Active Trials', 'Completed Studies']
      },
      {
        name: 'MeSH Terms',
        description: 'Medical Subject Headings taxonomy',
        endpoints: ['Related Conditions', 'Medical Terms']
      },
      {
        name: 'MedlinePlus',
        description: 'Consumer health information',
        endpoints: ['Condition Information']
      }
    ]
  });
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Medical Condition Research API'
  });
});

/**
 * GET /
 * Root endpoint with API documentation
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Medical Condition Research API',
    version: '2.0.0',
    endpoints: {
      search: 'GET /api/condition/:condition',
      sources: 'GET /api/sources',
      health: 'GET /api/health'
    },
    examples: {
      diabetes: '/api/condition/diabetes',
      hypertension: '/api/condition/hypertension',
      depression: '/api/condition/depression'
    },
    data_sources: [
      'FDA Drug Database',
      'ClinicalTrials.gov',
      'MeSH Medical Terms',
      'MedlinePlus'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Medical Condition Research API running on port ${PORT}`);
  console.log(`Example: http://localhost:${PORT}/api/condition/diabetes`);
});

module.exports = app;