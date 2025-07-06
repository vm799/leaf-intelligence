const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const router = express.Router();

// API endpoints
const FDA_BASE_URL = 'https://api.fda.gov/device';

// Helper function for FDA API requests with better error handling
async function fdaRequest(endpoint, params = {}) {
  try {
    const response = await axios.get(`${FDA_BASE_URL}${endpoint}`, {
      params: { limit: 100, ...params },
      timeout: 15000
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching from ${endpoint}:`, error.message);
    return { results: [], error: error.message };
  }
}

// Enhanced helper function for FDA API requests with pagination
async function fdaRequestWithPagination(endpoint, params = {}, maxResults = 1000) {
  try {
    const allResults = [];
    let skip = 0;
    const limit = 100;
    let hasMoreData = true;
    
    console.log(`Fetching paginated data from ${endpoint}...`);
    
    while (hasMoreData && allResults.length < maxResults) {
      const requestParams = {
        limit,
        skip,
        ...params
      };
      
      const response = await axios.get(`${FDA_BASE_URL}${endpoint}`, {
        params: requestParams,
        timeout: 15000
      });
      
      const data = response.data;
      
      if (data.results && data.results.length > 0) {
        allResults.push(...data.results);
        skip += limit;
        
        if (data.results.length < limit) {
          hasMoreData = false;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        hasMoreData = false;
      }
    }
    
    console.log(`Fetched ${allResults.length} total results from ${endpoint}`);
    
    return {
      results: allResults,
      meta: {
        totalFetched: allResults.length,
        disclaimer: 'Results fetched with pagination'
      }
    };
    
  } catch (error) {
    console.error(`Error fetching paginated data from ${endpoint}:`, error.message);
    return { 
      results: [], 
      error: error.message,
      meta: { totalFetched: 0 }
    };
  }
}

// Smart search term analysis
function analyzeSearchTerm(searchTerm, searchMode = 'auto') {
  const term = searchTerm.toLowerCase().trim();
  
  // If mode is explicitly set, use it
  if (searchMode === 'company') {
    return {
      type: 'company',
      mode: 'company',
      searchStrategies: [
        { endpoint: '510k', field: 'applicant', value: searchTerm },
        { endpoint: 'pma', field: 'applicant', value: searchTerm },
        { endpoint: 'registrationlisting', field: 'establishment_name', value: searchTerm },
        { endpoint: 'recall', field: 'recalling_firm', value: searchTerm },
        { endpoint: 'event', field: 'manufacturer_name', value: searchTerm }
      ]
    };
  }
  
  if (searchMode === 'device') {
    return {
      type: 'device',
      mode: 'device',
      searchStrategies: [
        { endpoint: '510k', field: 'device_name', value: searchTerm },
        { endpoint: 'pma', field: 'trade_name', value: searchTerm },
        { endpoint: 'classification', field: 'device_name', value: searchTerm },
        { endpoint: 'recall', field: 'product_description', value: searchTerm },
        { endpoint: 'event', field: 'device.device_name', value: searchTerm }
      ]
    };
  }
  
  // Auto-detection logic
  // K-number pattern
  if (/^k\d{6}$/i.test(term)) {
    return {
      type: 'k-number',
      mode: 'device',
      searchStrategies: [
        { endpoint: '510k', field: 'k_number', value: searchTerm.toUpperCase() }
      ]
    };
  }
  
  // PMA number pattern
  if (/^p\d{6}$/i.test(term)) {
    return {
      type: 'pma-number',
      mode: 'device',
      searchStrategies: [
        { endpoint: 'pma', field: 'pma_number', value: searchTerm.toUpperCase() }
      ]
    };
  }

  // Product code pattern (3 letters)
  if (/^[a-z]{3}$/i.test(term)) {
    return {
      type: 'product-code',
      mode: 'device',
      searchStrategies: [
        { endpoint: '510k', field: 'product_code', value: searchTerm.toUpperCase() },
        { endpoint: 'pma', field: 'product_code', value: searchTerm.toUpperCase() },
        { endpoint: 'classification', field: 'product_code', value: searchTerm.toUpperCase() }
      ]
    };
  }
  
  // Company indicators
  const companyIndicators = ['inc', 'corp', 'ltd', 'llc', 'co', 'company', 'corporation', 'medical', 'healthcare', 'pharma'];
  const isCompany = companyIndicators.some(indicator => term.includes(indicator));
  
  if (isCompany) {
    return {
      type: 'company',
      mode: 'company',
      searchStrategies: [
        { endpoint: '510k', field: 'applicant', value: searchTerm },
        { endpoint: 'pma', field: 'applicant', value: searchTerm },
        { endpoint: 'registrationlisting', field: 'establishment_name', value: searchTerm }
      ]
    };
  }
  
  // Default to device
  return {
    type: 'device',
    mode: 'device',
    searchStrategies: [
      { endpoint: '510k', field: 'device_name', value: searchTerm },
      { endpoint: 'pma', field: 'trade_name', value: searchTerm },
      { endpoint: 'classification', field: 'device_name', value: searchTerm }
    ]
  };
}

// Enhanced search functions
async function smartSearch510k(searchTerm, analysis) {
  const strategies = analysis.searchStrategies.filter(s => s.endpoint === '510k');
  
  for (const strategy of strategies) {
    try {
      const result = await fdaRequestWithPagination('/510k.json', { 
        search: `${strategy.field}:"${strategy.value}"` 
      }, 1000);
      
      if (result.results && result.results.length > 0) {
        return result;
      }
    } catch (error) {
      console.log(`510k strategy failed for ${strategy.field}: ${error.message}`);
    }
  }
  
  // Fallback search
  return await fdaRequestWithPagination('/510k.json', { 
    search: `device_name:"${searchTerm}" OR applicant:"${searchTerm}" OR product_code:"${searchTerm}"` 
  }, 1000);
}

async function smartSearchPMA(searchTerm, analysis) {
  const strategies = analysis.searchStrategies.filter(s => s.endpoint === 'pma');
  
  for (const strategy of strategies) {
    try {
      const result = await fdaRequestWithPagination('/pma.json', { 
        search: `${strategy.field}:"${strategy.value}"` 
      }, 1000);
      
      if (result.results && result.results.length > 0) {
        return result;
      }
    } catch (error) {
      console.log(`PMA strategy failed for ${strategy.field}: ${error.message}`);
    }
  }
  
  return await fdaRequestWithPagination('/pma.json', { 
    search: `trade_name:"${searchTerm}" OR applicant:"${searchTerm}" OR product_code:"${searchTerm}"` 
  }, 1000);
}

async function smartSearchClassification(searchTerm, analysis) {
  try {
    const strategies = analysis.searchStrategies.filter(s => s.endpoint === 'classification');
    
    for (const strategy of strategies) {
      try {
        const result = await fdaRequestWithPagination('/classification.json', { 
          search: `${strategy.field}:"${strategy.value}"` 
        }, 1000);
        
        if (result.results && result.results.length > 0) {
          return result;
        }
      } catch (error) {
        console.log(`Classification strategy failed for ${strategy.field}: ${error.message}`);
      }
    }
    
    // Fallback search
    return await fdaRequestWithPagination('/classification.json', { 
      search: `device_name:"${searchTerm}" OR product_code:"${searchTerm}"` 
    }, 1000);
    
  } catch (error) {
    console.error(`Classification search error: ${error.message}`);
    return { 
      results: [], 
      error: `Classification search failed: ${error.message}`,
      meta: { totalFetched: 0 }
    };
  }
}

async function smartSearchRecalls(searchTerm, analysis) {
  const strategies = analysis.searchStrategies.filter(s => s.endpoint === 'recall');
  
  for (const strategy of strategies) {
    try {
      const result = await fdaRequestWithPagination('/recall.json', { 
        search: `${strategy.field}:"${strategy.value}"` 
      }, 1000);
      
      if (result.results && result.results.length > 0) {
        return result;
      }
    } catch (error) {
      console.log(`Recall strategy failed for ${strategy.field}: ${error.message}`);
    }
  }
  
  return await fdaRequestWithPagination('/recall.json', { 
    search: `product_description:"${searchTerm}" OR recalling_firm:"${searchTerm}" OR product_code:"${searchTerm}"` 
  }, 1000);
}

async function smartSearchAdverseEvents(searchTerm, analysis) {
  const strategies = analysis.searchStrategies.filter(s => s.endpoint === 'event');
  
  for (const strategy of strategies) {
    try {
      const result = await fdaRequestWithPagination('/event.json', { 
        search: `${strategy.field}:"${strategy.value}"` 
      }, 1000);
      
      if (result.results && result.results.length > 0) {
        return result;
      }
    } catch (error) {
      console.log(`Adverse event strategy failed for ${strategy.field}: ${error.message}`);
    }
  }
  
  return await fdaRequestWithPagination('/event.json', { 
    search: `device.generic_name:"${searchTerm}" OR manufacturer_name:"${searchTerm}"` 
  }, 1000);
}

async function smartSearchRegistrations(searchTerm, analysis) {
  const strategies = analysis.searchStrategies.filter(s => s.endpoint === 'registrationlisting');
  
  for (const strategy of strategies) {
    try {
      const result = await fdaRequestWithPagination('/registrationlisting.json', { 
        search: `${strategy.field}:"${strategy.value}"` 
      }, 1000);
      
      if (result.results && result.results.length > 0) {
        return result;
      }
    } catch (error) {
      console.log(`Registration strategy failed for ${strategy.field}: ${error.message}`);
    }
  }
  
  return await fdaRequestWithPagination('/registrationlisting.json', { 
    search: `establishment_name:"${searchTerm}" OR products.product_code:"${searchTerm}"` 
  }, 1000);
}

// Main data gathering function
async function getAllFDAData(searchTerm, searchMode = 'auto', maxResults = 1000) {
  console.log(`Smart FDA search for: ${searchTerm} (mode: ${searchMode}, max ${maxResults} per endpoint)`);
  
  const searchAnalysis = analyzeSearchTerm(searchTerm, searchMode);
  console.log(`Search type detected: ${searchAnalysis.type}, mode: ${searchAnalysis.mode}`);
  
  const results = await Promise.allSettled([
    smartSearch510k(searchTerm, searchAnalysis),
    smartSearchPMA(searchTerm, searchAnalysis),
    smartSearchRecalls(searchTerm, searchAnalysis),
    smartSearchAdverseEvents(searchTerm, searchAnalysis),
    smartSearchRegistrations(searchTerm, searchAnalysis),
    smartSearchClassification(searchTerm, searchAnalysis)
  ]);

  const [
    fiveOneOk,
    pma,
    recalls,
    adverseEvents,
    registrations,
    classification
  ] = results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error('FDA API call failed:', result.reason.message);
      return { results: [], error: result.reason.message, meta: { totalFetched: 0 } };
    }
  });

  const successfulEndpoints = [];
  const failedEndpoints = [];
  
  const endpointNames = ['510k', 'pma', 'recalls', 'adverseEvents', 'registrations', 'classification'];
  const endpointResults = [fiveOneOk, pma, recalls, adverseEvents, registrations, classification];
  
  let totalRecords = 0;
  endpointResults.forEach((result, index) => {
    const count = result.results?.length || 0;
    totalRecords += count;
    
    if (count > 0) {
      successfulEndpoints.push(`${endpointNames[index]} (${count})`);
    } else if (result.error) {
      failedEndpoints.push(endpointNames[index]);
    }
  });
  
  console.log(`FDA API Summary - Total Records: ${totalRecords}`);
  console.log(`Successful: [${successfulEndpoints.join(', ')}]`);
  if (failedEndpoints.length > 0) {
    console.log(`Failed: [${failedEndpoints.join(', ')}]`);
  }

  return {
    fiveOneOk,
    pma,
    recalls,
    adverseEvents,
    registrations,
    classification,
    _metadata: {
      successfulEndpoints,
      failedEndpoints,
      totalEndpoints: endpointNames.length,
      totalRecords,
      maxResultsPerEndpoint: maxResults,
      searchType: searchAnalysis.type,
      searchMode: searchAnalysis.mode
    }
  };
}

// Generate pathway insights
function generatePathwayInsights(fdaData) {
  const insights = {
    pathwayBreakdown: {
      '510k': { count: 0, percentage: 0, devices: [] },
      'pma': { count: 0, percentage: 0, devices: [] },
      'deNovo': { count: 0, percentage: 0, devices: [] }
    },
    totalApprovedDevices: 0,
    averageTimeToApproval: {
      '510k': 'Unknown',
      'pma': 'Unknown'
    },
    productCodes: new Set(),
    deviceClasses: new Set(),
    commonRequirements: [],
    recommendations: []
  };

  // Analyze 510(k) clearances
  if (fdaData.fiveOneOk?.results) {
    const cleared510k = fdaData.fiveOneOk.results.filter(device => 
      device.decision_description?.toLowerCase().includes('cleared') ||
      device.decision_description?.toLowerCase().includes('substantially equivalent')
    );
    
    insights.pathwayBreakdown['510k'].count = cleared510k.length;
    insights.pathwayBreakdown['510k'].devices = cleared510k.map(device => ({
      kNumber: device.k_number,
      deviceName: device.device_name,
      applicant: device.applicant,
      decisionDate: device.decision_date,
      productCode: device.product_code,
      deviceClass: device.device_class || device.openfda?.device_class
    }));

    // Collect product codes and device classes
    cleared510k.forEach(device => {
      if (device.product_code) insights.productCodes.add(device.product_code);
      if (device.device_class) insights.deviceClasses.add(device.device_class);
      if (device.openfda?.device_class) insights.deviceClasses.add(device.openfda.device_class);
    });
  }

  // Analyze PMA approvals
  if (fdaData.pma?.results) {
    const approvedPMA = fdaData.pma.results.filter(device => 
      device.decision_description?.toLowerCase().includes('approved')
    );
    
    insights.pathwayBreakdown.pma.count = approvedPMA.length;
    insights.pathwayBreakdown.pma.devices = approvedPMA.map(device => ({
      pmaNumber: device.pma_number,
      deviceName: device.trade_name || device.generic_name,
      applicant: device.applicant,
      decisionDate: device.decision_date,
      productCode: device.product_code,
      expedited: device.expedited_review_flag === 'Y'
    }));

    // Collect product codes
    approvedPMA.forEach(device => {
      if (device.product_code) insights.productCodes.add(device.product_code);
    });
  }

  // Check for De Novo in 510(k) results
  if (fdaData.fiveOneOk?.results) {
    const deNovoDevices = fdaData.fiveOneOk.results.filter(device => 
      device.decision_description?.toLowerCase().includes('de novo') ||
      device.clearance_type?.toLowerCase().includes('de novo')
    );
    
    insights.pathwayBreakdown.deNovo.count = deNovoDevices.length;
    insights.pathwayBreakdown.deNovo.devices = deNovoDevices.map(device => ({
      kNumber: device.k_number,
      deviceName: device.device_name,
      applicant: device.applicant,
      decisionDate: device.decision_date,
      productCode: device.product_code,
      newClassification: true
    }));
  }

  // Calculate totals and percentages
  insights.totalApprovedDevices = 
    insights.pathwayBreakdown['510k'].count +
    insights.pathwayBreakdown.pma.count +
    insights.pathwayBreakdown.deNovo.count;

  if (insights.totalApprovedDevices > 0) {
    insights.pathwayBreakdown['510k'].percentage = 
      Math.round((insights.pathwayBreakdown['510k'].count / insights.totalApprovedDevices) * 100);
    insights.pathwayBreakdown.pma.percentage = 
      Math.round((insights.pathwayBreakdown.pma.count / insights.totalApprovedDevices) * 100);
    insights.pathwayBreakdown.deNovo.percentage = 
      Math.round((insights.pathwayBreakdown.deNovo.count / insights.totalApprovedDevices) * 100);
  }

  // Determine dominant pathway
  let dominantPathway = '510k';
  if (insights.pathwayBreakdown.pma.count > insights.pathwayBreakdown['510k'].count) {
    dominantPathway = 'pma';
  }
  if (insights.pathwayBreakdown.deNovo.count > insights.pathwayBreakdown[dominantPathway].count) {
    dominantPathway = 'deNovo';
  }

  // Generate recommendations
  if (insights.pathwayBreakdown['510k'].percentage > 70) {
    insights.recommendations.push('510(k) is the dominant pathway - focus on predicate device identification');
  } else if (insights.pathwayBreakdown.pma.percentage > 50) {
    insights.recommendations.push('PMA pathway required - prepare for extensive clinical data requirements');
  } else if (insights.pathwayBreakdown.deNovo.count > 0) {
    insights.recommendations.push('De Novo pathway available for novel devices without predicates');
  }

  // Add device class recommendations
  if (insights.deviceClasses.has('III') || insights.deviceClasses.has('3')) {
    insights.recommendations.push('Class III devices typically require PMA approval');
  } else if (insights.deviceClasses.has('II') || insights.deviceClasses.has('2')) {
    insights.recommendations.push('Class II devices typically go through 510(k) pathway');
  }

  return {
    ...insights,
    productCodes: Array.from(insights.productCodes),
    deviceClasses: Array.from(insights.deviceClasses),
    dominantPathway
  };
}

// Main device intelligence endpoint
router.get('/device-intelligence', async (req, res) => {
  try {
    const { q: searchTerm, mode: searchMode = 'auto' } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term (q) is required' });
    }

    console.log(`Enhanced Device Intelligence Search for: ${searchTerm} (mode: ${searchMode})`);
    
    // Get FDA data with enhanced pathway analysis
    const fdaData = await getAllFDAData(searchTerm, searchMode);
    
    // Generate comprehensive pathway insights
    const pathwayInsights = generateEnhancedPathwayInsights(fdaData);
    
    // Generate timeline analysis
    const timelineAnalysis = generateTimelineAnalysis(fdaData);
    
    // Generate product code insights
    const productCodeInsights = generateProductCodeInsights(fdaData);
    
    // Generate CFR parts analysis
    const cfrPartsAnalysis = generateCFRPartsAnalysis(fdaData);
    
    // Create comprehensive profile
    const profile = createEnhancedProfile(searchTerm, fdaData, pathwayInsights, searchMode);
    
    res.json({
      searchTerm,
      searchMode,
      timestamp: new Date().toISOString(),
      profile,
      pathwayInsights,
      timelineAnalysis,
      productCodeInsights,
      cfrPartsAnalysis,
      data: {
        fda: fdaData
      },
      sources: {
        fdaAPIs: Object.keys(fdaData).filter(key => 
          key !== '_metadata' && fdaData[key].results?.length > 0
        )
      }
    });

  } catch (error) {
    console.error('Enhanced device intelligence search error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});


// Enhanced pathway insights generation
function generateEnhancedPathwayInsights(fdaData) {
  const insights = {
    pathwayBreakdown: {
      '510k': { count: 0, percentage: 0, devices: [], avgTimeToApproval: null },
      'pma': { count: 0, percentage: 0, devices: [], avgTimeToApproval: null },
      'deNovo': { count: 0, percentage: 0, devices: [], avgTimeToApproval: null }
    },
    totalApprovedDevices: 0,
    productCodes: new Map(),
    deviceClasses: new Map(),
    cfrParts: new Map(),
    commonRequirements: [],
    recommendations: [],
    pathwayTrends: {
      yearlyBreakdown: {},
      recentTrend: 'stable'
    },
    deNovoAnalysis: {
      detectionMethods: {},
      yearlyTrends: {},
      topProductCodes: []
    }
  };

  // Enhanced 510(k) and De Novo analysis
  if (fdaData.fiveOneOk?.results) {
    // Filter for cleared/approved devices
    const cleared510k = fdaData.fiveOneOk.results.filter(device => 
      device.decision_description?.toLowerCase().includes('cleared') ||
      device.decision_description?.toLowerCase().includes('substantially equivalent') ||
      device.decision_code === 'SESE' || // Substantially Equivalent
      device.decision_code === 'DENG' || // De Novo Granted
      device.k_number?.startsWith('DEN') || // De Novo K-numbers
      device.decision_description?.toLowerCase().includes('de novo')
    );
    
    // Use enhanced De Novo detection
    const { deNovoDevices, regular510kDevices } = detectDeNovoDevices(cleared510k);
    
    // Process regular 510(k) devices
    insights.pathwayBreakdown['510k'].count = regular510kDevices.length;
    insights.pathwayBreakdown['510k'].devices = regular510kDevices.map(device => ({
      kNumber: device.k_number,
      deviceName: device.device_name,
      applicant: device.applicant,
      decisionDate: device.decision_date,
      productCode: device.product_code,
      deviceClass: device.device_class || device.openfda?.device_class,
      timeToApproval: calculateTimeToApproval(device.date_received, device.decision_date),
      decisionCode: device.decision_code
    }));

    // Process De Novo devices with enhanced analysis
    insights.pathwayBreakdown.deNovo.count = deNovoDevices.length;
    insights.pathwayBreakdown.deNovo.devices = deNovoDevices.map(device => ({
      kNumber: device.k_number,
      deviceName: device.device_name,
      applicant: device.applicant,
      decisionDate: device.decision_date,
      productCode: device.product_code,
      deviceClass: device.device_class || device.openfda?.device_class,
      timeToApproval: calculateTimeToApproval(device.date_received, device.decision_date),
      decisionCode: device.decision_code,
      newClassification: true,
      detectionMethod: device.deNovoDetectionMethod || ['unknown']
    }));

    // Analyze De Novo detection methods
    deNovoDevices.forEach(device => {
      const methods = device.deNovoDetectionMethod || ['unknown'];
      methods.forEach(method => {
        insights.deNovoAnalysis.detectionMethods[method] = 
          (insights.deNovoAnalysis.detectionMethods[method] || 0) + 1;
      });
    });

    // Process all cleared devices for insights
    cleared510k.forEach(device => {
      // Product codes
      if (device.product_code) {
        const count = insights.productCodes.get(device.product_code) || 0;
        insights.productCodes.set(device.product_code, count + 1);
      }
      
      // Device classes
      const deviceClass = device.device_class || device.openfda?.device_class;
      if (deviceClass) {
        const count = insights.deviceClasses.get(deviceClass) || 0;
        insights.deviceClasses.set(deviceClass, count + 1);
      }
      
      // CFR parts
      const regNumber = device.regulation_number || device.openfda?.regulation_number;
      if (regNumber) {
        const part = regNumber.split('.')[0];
        const count = insights.cfrParts.get(part) || 0;
        insights.cfrParts.set(part, count + 1);
      }
      
      // Yearly trends
      if (device.decision_date) {
        const year = new Date(device.decision_date).getFullYear();
        if (!insights.pathwayTrends.yearlyBreakdown[year]) {
          insights.pathwayTrends.yearlyBreakdown[year] = { '510k': 0, 'pma': 0, 'deNovo': 0 };
        }
        
        // Check if this is a De Novo device
        const isDeNovo = deNovoDevices.some(d => d.k_number === device.k_number);
        if (isDeNovo) {
          insights.pathwayTrends.yearlyBreakdown[year].deNovo++;
          
          // Track De Novo yearly trends separately
          if (!insights.deNovoAnalysis.yearlyTrends[year]) {
            insights.deNovoAnalysis.yearlyTrends[year] = 0;
          }
          insights.deNovoAnalysis.yearlyTrends[year]++;
        } else {
          insights.pathwayTrends.yearlyBreakdown[year]['510k']++;
        }
      }
    });

    // Calculate average time to approval for 510(k)
    const validTimes = regular510kDevices
      .map(d => calculateTimeToApproval(d.date_received, d.decision_date))
      .filter(t => t && t > 0 && t < 1000);
    if (validTimes.length > 0) {
      insights.pathwayBreakdown['510k'].avgTimeToApproval = 
        Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length);
    }

    // Calculate average time for De Novo
    const validDeNovoTimes = deNovoDevices
      .map(d => calculateTimeToApproval(d.date_received, d.decision_date))
      .filter(t => t && t > 0 && t < 1500); // De Novo can take longer
    if (validDeNovoTimes.length > 0) {
      insights.pathwayBreakdown.deNovo.avgTimeToApproval = 
        Math.round(validDeNovoTimes.reduce((a, b) => a + b, 0) / validDeNovoTimes.length);
    }
  }

  // PMA analysis (unchanged)
  if (fdaData.pma?.results) {
    const approvedPMA = fdaData.pma.results.filter(device => 
      device.decision_description?.toLowerCase().includes('approved') ||
      device.decision_code === 'APPR'
    );
    
    insights.pathwayBreakdown.pma.count = approvedPMA.length;
    insights.pathwayBreakdown.pma.devices = approvedPMA.map(device => ({
      pmaNumber: device.pma_number,
      deviceName: device.trade_name || device.generic_name,
      applicant: device.applicant,
      decisionDate: device.decision_date,
      productCode: device.product_code,
      expedited: device.expedited_review_flag === 'Y',
      timeToApproval: calculateTimeToApproval(device.date_received, device.decision_date)
    }));

    // Process PMA devices for insights
    approvedPMA.forEach(device => {
      if (device.product_code) {
        const count = insights.productCodes.get(device.product_code) || 0;
        insights.productCodes.set(device.product_code, count + 1);
      }
      
      if (device.regulation_number) {
        const part = device.regulation_number.split('.')[0];
        const count = insights.cfrParts.get(part) || 0;
        insights.cfrParts.set(part, count + 1);
      }
      
      if (device.decision_date) {
        const year = new Date(device.decision_date).getFullYear();
        if (!insights.pathwayTrends.yearlyBreakdown[year]) {
          insights.pathwayTrends.yearlyBreakdown[year] = { '510k': 0, 'pma': 0, 'deNovo': 0 };
        }
        insights.pathwayTrends.yearlyBreakdown[year].pma++;
      }
    });

    // Calculate average time to approval for PMA
    const validPMATimes = approvedPMA
      .map(d => calculateTimeToApproval(d.date_received, d.decision_date))
      .filter(t => t && t > 0 && t < 2000);
    if (validPMATimes.length > 0) {
      insights.pathwayBreakdown.pma.avgTimeToApproval = 
        Math.round(validPMATimes.reduce((a, b) => a + b, 0) / validPMATimes.length);
    }
  }

  // Calculate totals and percentages
  insights.totalApprovedDevices = 
    insights.pathwayBreakdown['510k'].count +
    insights.pathwayBreakdown.pma.count +
    insights.pathwayBreakdown.deNovo.count;

  if (insights.totalApprovedDevices > 0) {
    insights.pathwayBreakdown['510k'].percentage = 
      Math.round((insights.pathwayBreakdown['510k'].count / insights.totalApprovedDevices) * 100);
    insights.pathwayBreakdown.pma.percentage = 
      Math.round((insights.pathwayBreakdown.pma.count / insights.totalApprovedDevices) * 100);
    insights.pathwayBreakdown.deNovo.percentage = 
      Math.round((insights.pathwayBreakdown.deNovo.count / insights.totalApprovedDevices) * 100);
  }

  // Generate enhanced recommendations
  insights.recommendations = generatePathwayRecommendations(insights);

  // Convert Maps to sorted arrays
  insights.productCodes = Array.from(insights.productCodes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code, count]) => ({ 
      code, 
      count, 
      percentage: insights.totalApprovedDevices > 0 ? 
        Math.round((count / insights.totalApprovedDevices) * 100) : 0 
    }));

  insights.deviceClasses = Array.from(insights.deviceClasses.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cls, count]) => ({ 
      class: cls, 
      count, 
      percentage: insights.totalApprovedDevices > 0 ? 
        Math.round((count / insights.totalApprovedDevices) * 100) : 0 
    }));

  insights.cfrParts = Array.from(insights.cfrParts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([part, count]) => ({ 
      part, 
      count, 
      percentage: insights.totalApprovedDevices > 0 ? 
        Math.round((count / insights.totalApprovedDevices) * 100) : 0 
    }));

  return insights;
}


function extractDeNovoIndicators(device) {
  const indicators = [];
  
  if ((device.decision_description || '').toLowerCase().includes('de novo')) {
    indicators.push('decision_description');
  }
  if ((device.clearance_type || '').toLowerCase().includes('de novo')) {
    indicators.push('clearance_type');
  }
  if ((device.advisory_committee_description || '').toLowerCase().includes('de novo')) {
    indicators.push('advisory_committee_description');
  }
  if ((device.review_advisory_committee || '').toLowerCase().includes('de novo')) {
    indicators.push('review_advisory_committee');
  }
  if (device.expedited_review_flag === 'Y') {
    indicators.push('expedited_review');
  }
  
  return indicators;
}

// Calculate time to approval in days
function calculateTimeToApproval(dateReceived, decisionDate) {
  if (!dateReceived || !decisionDate) return null;
  
  try {
    const received = new Date(dateReceived);
    const decision = new Date(decisionDate);
    const diffTime = Math.abs(decision - received);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch (error) {
    return null;
  }
}

function detectDeNovoDevices(fiveOneOkResults) {
  const deNovoDevices = [];
  const regular510kDevices = [];
  
  if (!fiveOneOkResults || !fiveOneOkResults.length) {
    return { deNovoDevices, regular510kDevices };
  }

  fiveOneOkResults.forEach(device => {
    // Primary detection: K-number starts with "DEN"
    const kNumber = device.k_number || '';
    const isDeNovoByKNumber = kNumber.toUpperCase().startsWith('DEN');
    
    // Secondary detection: Decision code is "DENG" (De Novo Granted)
    const decisionCode = device.decision_code || '';
    const isDeNovoByDecisionCode = decisionCode.toUpperCase() === 'DENG';
    
    // Tertiary detection: Text-based indicators (fallback)
    const decisionDesc = (device.decision_description || '').toLowerCase();
    const isDeNovoByText = decisionDesc.includes('de novo') || 
                          decisionDesc.includes('denovo') || 
                          decisionDesc.includes('de-novo');
    
    // Quaternary detection: Clearance type
    const clearanceType = (device.clearance_type || '').toLowerCase();
    const isDeNovoByClearanceType = clearanceType.includes('de novo');
    
    const isDeNovo = isDeNovoByKNumber || isDeNovoByDecisionCode || isDeNovoByText || isDeNovoByClearanceType;
    
    if (isDeNovo) {
      deNovoDevices.push({
        ...device,
        deNovoDetectionMethod: [
          ...(isDeNovoByKNumber ? ['k_number_pattern'] : []),
          ...(isDeNovoByDecisionCode ? ['decision_code'] : []),
          ...(isDeNovoByText ? ['decision_description'] : []),
          ...(isDeNovoByClearanceType ? ['clearance_type'] : [])
        ]
      });
    } else {
      regular510kDevices.push(device);
    }
  });
  
  console.log(`De Novo detection results:`);
  console.log(`  🔵 Regular 510(k): ${regular510kDevices.length} devices`);
  console.log(`  🟣 De Novo: ${deNovoDevices.length} devices`);
  
  if (deNovoDevices.length > 0) {
    console.log(`De Novo devices found:`);
    deNovoDevices.forEach(device => {
      console.log(`  - ${device.k_number}: ${device.device_name} (detected by: ${device.deNovoDetectionMethod.join(', ')})`);
    });
  }
  
  return { deNovoDevices, regular510kDevices };
}


// Generate timeline analysis
function generateTimelineAnalysis(fdaData) {
  const timeline = {};
  
  // Process all approval data
  const allApprovals = [];
  
  // 510(k) approvals
  if (fdaData.fiveOneOk?.results) {
    fdaData.fiveOneOk.results.forEach(device => {
      if (device.decision_date && device.decision_description?.toLowerCase().includes('cleared')) {
        const year = new Date(device.decision_date).getFullYear();
        const pathway = device.decision_description?.toLowerCase().includes('de novo') ? 'deNovo' : '510k';
        
        if (!timeline[year]) {
          timeline[year] = { '510k': 0, 'pma': 0, 'deNovo': 0, total: 0 };
        }
        timeline[year][pathway]++;
        timeline[year].total++;
      }
    });
  }
  
  // PMA approvals
  if (fdaData.pma?.results) {
    fdaData.pma.results.forEach(device => {
      if (device.decision_date && device.decision_description?.toLowerCase().includes('approved')) {
        const year = new Date(device.decision_date).getFullYear();
        
        if (!timeline[year]) {
          timeline[year] = { '510k': 0, 'pma': 0, 'deNovo': 0, total: 0 };
        }
        timeline[year].pma++;
        timeline[year].total++;
      }
    });
  }
  
  return {
    yearlyData: timeline,
    trendAnalysis: calculateTrendAnalysis(timeline)
  };
}

// Calculate trend analysis
function calculateTrendAnalysis(timeline) {
  const years = Object.keys(timeline).sort();
  if (years.length < 2) return { trend: 'insufficient_data', growth: 0 };
  
  const recent = timeline[years[years.length - 1]]?.total || 0;
  const previous = timeline[years[years.length - 2]]?.total || 0;
  
  const growth = previous > 0 ? ((recent - previous) / previous) * 100 : 0;
  
  let trend = 'stable';
  if (growth > 10) trend = 'increasing';
  else if (growth < -10) trend = 'decreasing';
  
  return { trend, growth: Math.round(growth) };
}

// Generate product code insights
function generateProductCodeInsights(fdaData) {
  const productCodeMap = new Map();
  
  // Collect all product codes with device information
  [fdaData.fiveOneOk, fdaData.pma, fdaData.classification].forEach(dataset => {
    if (dataset?.results) {
      dataset.results.forEach(device => {
        const productCode = device.product_code;
        if (productCode) {
          if (!productCodeMap.has(productCode)) {
            productCodeMap.set(productCode, {
              code: productCode,
              deviceName: device.device_name || device.trade_name || device.generic_name,
              deviceClass: device.device_class || device.openfda?.device_class,
              regulationNumber: device.regulation_number || device.openfda?.regulation_number,
              count: 0,
              pathways: { '510k': 0, 'pma': 0, 'deNovo': 0 }
            });
          }
          
          const info = productCodeMap.get(productCode);
          info.count++;
          
          // Determine pathway
          if (device.k_number) {
            if (device.decision_description?.toLowerCase().includes('de novo')) {
              info.pathways.deNovo++;
            } else {
              info.pathways['510k']++;
            }
          } else if (device.pma_number) {
            info.pathways.pma++;
          }
        }
      });
    }
  });
  
  return Array.from(productCodeMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

// Generate CFR parts analysis
function generateCFRPartsAnalysis(fdaData) {
  const cfrMap = new Map();
  
  [fdaData.fiveOneOk, fdaData.pma, fdaData.classification].forEach(dataset => {
    if (dataset?.results) {
      dataset.results.forEach(device => {
        const regNumber = device.regulation_number || device.openfda?.regulation_number;
        if (regNumber) {
          const part = regNumber.split('.')[0];
          if (!cfrMap.has(part)) {
            cfrMap.set(part, {
              part,
              description: getCFRPartDescription(part),
              count: 0,
              regulations: new Set(),
              deviceClasses: new Set()
            });
          }
          
          const info = cfrMap.get(part);
          info.count++;
          info.regulations.add(regNumber);
          
          const deviceClass = device.device_class || device.openfda?.device_class;
          if (deviceClass) info.deviceClasses.add(deviceClass);
        }
      });
    }
  });
  
  return Array.from(cfrMap.values())
    .map(part => ({
      ...part,
      regulations: Array.from(part.regulations),
      deviceClasses: Array.from(part.deviceClasses)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// Get CFR part description
function getCFRPartDescription(part) {
  const descriptions = {
    '862': 'Clinical Chemistry and Clinical Toxicology Devices',
    '864': 'Hematology and Pathology Devices',
    '866': 'Immunology and Microbiology Devices',
    '868': 'Anesthesiology Devices',
    '870': 'Cardiovascular Devices',
    '872': 'Dental Devices',
    '874': 'Ear, Nose, and Throat Devices',
    '876': 'Gastroenterology-Urology Devices',
    '878': 'General and Plastic Surgery Devices',
    '880': 'General Hospital and Personal Use Devices',
    '882': 'Neurological Devices',
    '884': 'Obstetrical and Gynecological Devices',
    '886': 'Ophthalmic Devices',
    '888': 'Orthopedic Devices',
    '890': 'Physical Medicine Devices',
    '892': 'Radiology Devices'
  };
  return descriptions[part] || `CFR Part ${part}`;
}

// Generate pathway recommendations
function generatePathwayRecommendations(insights) {
  const recommendations = [];
  
  // Determine dominant pathway
  let dominantPathway = '510k';
  let dominantCount = insights.pathwayBreakdown['510k'].count;
  
  if (insights.pathwayBreakdown.pma.count > dominantCount) {
    dominantPathway = 'pma';
    dominantCount = insights.pathwayBreakdown.pma.count;
  }
  
  if (insights.pathwayBreakdown.deNovo.count > dominantCount) {
    dominantPathway = 'deNovo';
    dominantCount = insights.pathwayBreakdown.deNovo.count;
  }
  
  // Generate recommendations based on pathway distribution
  if (insights.pathwayBreakdown['510k'].percentage > 70) {
    recommendations.push('510(k) is the dominant pathway (${insights.pathwayBreakdown["510k"].percentage}%) - focus on predicate device identification');
    if (insights.pathwayBreakdown['510k'].avgTimeToApproval) {
      recommendations.push(`Average 510(k) clearance time: ${insights.pathwayBreakdown['510k'].avgTimeToApproval} days`);
    }
  }
  
  if (insights.pathwayBreakdown.pma.percentage > 30) {
    recommendations.push(`PMA pathway significant (${insights.pathwayBreakdown.pma.percentage}%) - prepare for extensive clinical data requirements`);
    if (insights.pathwayBreakdown.pma.avgTimeToApproval) {
      recommendations.push(`Average PMA approval time: ${insights.pathwayBreakdown.pma.avgTimeToApproval} days`);
    }
  }
  
  if (insights.pathwayBreakdown.deNovo.count > 0) {
    recommendations.push(`De Novo pathway available (${insights.pathwayBreakdown.deNovo.percentage}%) for novel devices without predicates`);
    if (insights.pathwayBreakdown.deNovo.avgTimeToApproval) {
      recommendations.push(`Average De Novo clearance time: ${insights.pathwayBreakdown.deNovo.avgTimeToApproval} days`);
    }
  }
  
  // Product code recommendations
  if (insights.productCodes.length > 0) {
    const topProductCode = insights.productCodes[0];
    recommendations.push(`Most common product code: ${topProductCode.code} (${topProductCode.percentage}% of devices)`);
  }
  
  // CFR parts recommendations
  if (insights.cfrParts.length > 0) {
    const topCFRPart = insights.cfrParts[0];
    recommendations.push(`Primary CFR regulation: 21 CFR Part ${topCFRPart.part} (${topCFRPart.percentage}% of devices)`);
  }
  
  return recommendations;
}

// Enhanced product code classification endpoint
router.get('/product-code/:productCode/classifications', async (req, res) => {
  try {
    const { productCode } = req.params;
    
    if (!productCode) {
      return res.status(400).json({ error: 'Product code is required' });
    }

    console.log(`Comprehensive Product Code Analysis for: ${productCode}`);
    
    // Get all FDA data for this product code
    const fdaData = await getAllFDAData(productCode, 'device');
    
    // Get detailed classification data
    const classificationData = await getEnhancedProductCodeClassification(productCode);
    
    // Get pathway analysis for this product code
    const pathwayAnalysis = generateEnhancedPathwayInsights(fdaData);
    
    // Get approved devices using this product code
    const approvedDevices = getApprovedDevicesByProductCode(fdaData);
    
    // Get regulatory requirements
    const regulatoryRequirements = await getProductCodeRegulatory(productCode, classificationData);
    
    res.json({
      productCode,
      timestamp: new Date().toISOString(),
      classification: classificationData,
      pathwayAnalysis,
      approvedDevices,
      regulatoryRequirements,
      fdaData,
      summary: generateEnhancedProductCodeSummary(fdaData, classificationData, pathwayAnalysis)
    });

  } catch (error) {
    console.error('Enhanced product code search error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Get enhanced classification for product code
async function getEnhancedProductCodeClassification(productCode) {
  try {
    const classificationData = await fdaRequestWithPagination('/classification.json', {
      search: `product_code:"${productCode}"`
    });

    if (!classificationData.results || classificationData.results.length === 0) {
      return { 
        error: 'No classification found for this product code',
        productCode,
        searchAttempted: true
      };
    }

    const classification = classificationData.results[0];
    
    // Get additional details if available
    const additionalClassifications = classificationData.results.slice(1);
    
    return {
      productCode,
      deviceName: classification.device_name,
      deviceClass: classification.device_class,
      regulationNumber: classification.regulation_number,
      medicalSpecialty: classification.medical_specialty_description,
      panelCode: classification.review_panel,
      summary: classification.summary,
      definitionText: classification.definition,
      physicalState: classification.physical_state,
      technicalMethod: classification.technical_method,
      targetArea: classification.target_area,
      gmpExempt: classification.gmp_exempt_flag === 'Y',
      exemptions: extractExemptions(classification),
      specialControls: extractSpecialControls(classification),
      additionalClassifications: additionalClassifications.map(cls => ({
        deviceName: cls.device_name,
        regulationNumber: cls.regulation_number,
        summary: cls.summary
      }))
    };
  } catch (error) {
    console.error('Error fetching enhanced classification:', error);
    return { 
      error: error.message,
      productCode,
      searchAttempted: true
    };
  }
}

// Extract exemptions from classification
function extractExemptions(classification) {
  const exemptions = [];
  
  if (classification.gmp_exempt_flag === 'Y') {
    exemptions.push('GMP Exempt');
  }
  
  if (classification.device_class === 'I') {
    exemptions.push('510(k) Exempt (Class I)');
  }
  
  // Check for other exemption indicators in the text
  const exemptionText = (classification.summary || '').toLowerCase();
  if (exemptionText.includes('exempt')) {
    exemptions.push('Additional exemptions may apply');
  }
  
  return exemptions;
}

// Extract special controls from classification
function extractSpecialControls(classification) {
  const controls = [];
  
  if (classification.device_class === 'II') {
    controls.push('General Controls');
    controls.push('Special Controls Required');
  } else if (classification.device_class === 'III') {
    controls.push('General Controls');
    controls.push('PMA Required');
  } else if (classification.device_class === 'I') {
    controls.push('General Controls Only');
  }
  
  // Extract specific controls from summary text
  const summaryText = classification.summary || '';
  if (summaryText.toLowerCase().includes('clinical')) {
    controls.push('Clinical Data May Be Required');
  }
  
  if (summaryText.toLowerCase().includes('biocompatibility')) {
    controls.push('Biocompatibility Testing');
  }
  
  if (summaryText.toLowerCase().includes('sterilization')) {
    controls.push('Sterilization Validation');
  }
  
  return controls;
}

// Get approved devices by product code
function getApprovedDevicesByProductCode(fdaData) {
  const devices = {
    '510k': [],
    'pma': [],
    'deNovo': [],
    total: 0
  };
  
  // Process 510(k) devices
  if (fdaData.fiveOneOk?.results) {
    fdaData.fiveOneOk.results.forEach(device => {
      if (device.decision_description?.toLowerCase().includes('cleared')) {
        const deviceInfo = {
          id: device.k_number,
          deviceName: device.device_name,
          applicant: device.applicant,
          decisionDate: device.decision_date,
          decisionDescription: device.decision_description,
          productCode: device.product_code,
          deviceClass: device.device_class
        };
        
        if (device.decision_description?.toLowerCase().includes('de novo')) {
          devices.deNovo.push(deviceInfo);
        } else {
          devices['510k'].push(deviceInfo);
        }
        devices.total++;
      }
    });
  }
  
  // Process PMA devices
  if (fdaData.pma?.results) {
    fdaData.pma.results.forEach(device => {
      if (device.decision_description?.toLowerCase().includes('approved')) {
        devices.pma.push({
          id: device.pma_number,
          deviceName: device.trade_name || device.generic_name,
          applicant: device.applicant,
          decisionDate: device.decision_date,
          decisionDescription: device.decision_description,
          productCode: device.product_code,
          expedited: device.expedited_review_flag === 'Y'
        });
        devices.total++;
      }
    });
  }
  
  return devices;
}

// Get regulatory requirements for product code
async function getProductCodeRegulatory(productCode, classificationData) {
  const requirements = {
    pathway: 'Unknown',
    documentation: [],
    timeline: 'Unknown',
    fees: 'Unknown',
    clinicalData: 'Unknown'
  };
  
  if (classificationData.deviceClass) {
    switch (classificationData.deviceClass) {
      case 'I':
        requirements.pathway = 'Class I - General Controls';
        requirements.documentation = ['Device Description', 'Labeling', 'Safety Information'];
        requirements.timeline = '0-30 days (if exempt)';
        requirements.fees = 'None (if exempt)';
        requirements.clinicalData = 'Usually not required';
        break;
        
      case 'II':
        requirements.pathway = 'Class II - 510(k) Clearance';
        requirements.documentation = ['510(k) Submission', 'Predicate Comparison', 'Performance Testing', 'Labeling'];
        requirements.timeline = '90-180 days';
        requirements.fees = '$12,432 (small business: $3,108)';
        requirements.clinicalData = 'May be required';
        break;
        
      case 'III':
        requirements.pathway = 'Class III - PMA Approval';
        requirements.documentation = ['PMA Application', 'Clinical Studies', 'Manufacturing Information', 'Risk Analysis'];
        requirements.timeline = '180-320 days';
requirements.fees = '$365,657 (small business: $91,414)';
        requirements.clinicalData = 'Required';
        break;
    }
  }
  
  return requirements;
}

// Generate enhanced product code summary
function generateEnhancedProductCodeSummary(fdaData, classificationData, pathwayAnalysis) {
  return {
    productCode: classificationData.productCode,
    deviceName: classificationData.deviceName,
    deviceClass: classificationData.deviceClass,
    totalApprovedDevices: pathwayAnalysis.totalApprovedDevices,
    pathwayBreakdown: {
      primaryPathway: pathwayAnalysis.totalApprovedDevices > 0 ? 
        (pathwayAnalysis.pathwayBreakdown['510k'].count > pathwayAnalysis.pathwayBreakdown.pma.count ? '510(k)' : 'PMA') : 'Unknown',
      '510k': pathwayAnalysis.pathwayBreakdown['510k'].count,
      'pma': pathwayAnalysis.pathwayBreakdown.pma.count,
      'deNovo': pathwayAnalysis.pathwayBreakdown.deNovo.count
    },
    regulatoryComplexity: classificationData.deviceClass === 'III' ? 'High' : 
                         classificationData.deviceClass === 'II' ? 'Medium' : 'Low',
    exemptions: classificationData.exemptions || [],
    specialControls: classificationData.specialControls || [],
    recentActivity: pathwayAnalysis.totalApprovedDevices > 0 ? 
                   `${pathwayAnalysis.totalApprovedDevices} approved devices found` : 'No recent approvals'
  };
}

// Enhanced search with better PMA and De Novo detection
async function smartSearchPMA(searchTerm, analysis) {
  const strategies = analysis.searchStrategies.filter(s => s.endpoint === 'pma');
  
  // Try multiple search strategies for better PMA detection
  const searchQueries = [
    `trade_name:"${searchTerm}"`,
    `generic_name:"${searchTerm}"`,
    `applicant:"${searchTerm}"`,
    `product_code:"${searchTerm}"`,
    `advisory_committee_description:"${searchTerm}"`,
    // Broader searches
    searchTerm.split(' ').map(word => `trade_name:${word} OR generic_name:${word}`).join(' OR ')
  ];
  
  for (const query of searchQueries) {
    try {
      const result = await fdaRequestWithPagination('/pma.json', { 
        search: query 
      }, 1000);
      
      if (result.results && result.results.length > 0) {
        console.log(`PMA search successful with query: ${query}, found ${result.results.length} results`);
        return result;
      }
    } catch (error) {
      console.log(`PMA search failed for query "${query}": ${error.message}`);
    }
  }
  
  // Final fallback - very broad search
  try {
    return await fdaRequestWithPagination('/pma.json', { 
      search: `trade_name:"${searchTerm}" OR generic_name:"${searchTerm}" OR product_code:"${searchTerm}"` 
    }, 1000);
  } catch (error) {
    console.error(`All PMA search strategies failed: ${error.message}`);
    return { results: [], error: error.message, meta: { totalFetched: 0 } };
  }
}

// Enhanced 510(k) search with better De Novo detection
async function smartSearch510k(searchTerm, analysis) {
  const strategies = analysis.searchStrategies.filter(s => s.endpoint === '510k');
  
  // Enhanced search queries including De Novo detection
  const searchQueries = [
    `device_name:"${searchTerm}"`,
    `applicant:"${searchTerm}"`,
    `product_code:"${searchTerm}"`,
    `k_number:"${searchTerm}"`,
    // De Novo specific searches
    `device_name:"${searchTerm}" AND (decision_description:"de novo" OR clearance_type:"de novo")`,
    `advisory_committee_description:"${searchTerm}"`,
    // Broader searches
    searchTerm.split(' ').map(word => `device_name:${word}`).join(' OR ')
  ];
  
  for (const query of searchQueries) {
    try {
      const result = await fdaRequestWithPagination('/510k.json', { 
        search: query 
      }, 1000);
      
      if (result.results && result.results.length > 0) {
        console.log(`510(k) search successful with query: ${query}, found ${result.results.length} results`);
        return result;
      }
    } catch (error) {
      console.log(`510(k) search failed for query "${query}": ${error.message}`);
    }
  }
  
  // Final fallback
  try {
    return await fdaRequestWithPagination('/510k.json', { 
      search: `device_name:"${searchTerm}" OR applicant:"${searchTerm}" OR product_code:"${searchTerm}"` 
    }, 1000);
  } catch (error) {
    console.error(`All 510(k) search strategies failed: ${error.message}`);
    return { results: [], error: error.message, meta: { totalFetched: 0 } };
  }
}

// New endpoint for comprehensive device pathway analysis
router.get('/device-pathways-comprehensive', async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term (q) is required' });
    }

    console.log(`Comprehensive device pathway analysis for: ${searchTerm}`);
    
    // Get all approved devices with enhanced search
    const fdaData = await getAllFDADataEnhanced(searchTerm, 'device');
    
    // Generate comprehensive pathway insights
    const pathwayInsights = generateEnhancedPathwayInsights(fdaData);
    
    // Get detailed timeline analysis
    const timelineAnalysis = generateDetailedTimelineAnalysis(fdaData);
    
    // Get competitive landscape
    const competitiveLandscape = generateCompetitiveLandscape(fdaData);
    
    // Get regulatory guidance
    const regulatoryGuidance = generateRegulatoryGuidance(pathwayInsights);
    
    res.json({
      searchTerm,
      timestamp: new Date().toISOString(),
      pathwayInsights,
      timelineAnalysis,
      competitiveLandscape,
      regulatoryGuidance,
      fdaData,
      summary: {
        totalDevices: pathwayInsights.totalApprovedDevices,
        pathwayBreakdown: pathwayInsights.pathwayBreakdown,
        dominantPathway: getDominantPathway(pathwayInsights),
        productCodes: pathwayInsights.productCodes,
        cfrParts: pathwayInsights.cfrParts,
        avgTimeToApproval: calculateOverallAvgTime(pathwayInsights)
      }
    });

  } catch (error) {
    console.error('Comprehensive device pathway analysis error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Enhanced FDA data collection
async function getAllFDADataEnhanced(searchTerm, searchMode = 'auto', maxResults = 1000) {
  console.log(`Enhanced FDA search for: ${searchTerm} (mode: ${searchMode}, max ${maxResults} per endpoint)`);
  
  const searchAnalysis = analyzeSearchTerm(searchTerm, searchMode);
  console.log(`Search type detected: ${searchAnalysis.type}, mode: ${searchAnalysis.mode}`);
  
  // Enhanced parallel searches with better error handling
  const results = await Promise.allSettled([
    smartSearch510kEnhanced(searchTerm, searchAnalysis),
    smartSearchPMAEnhanced(searchTerm, searchAnalysis),
    smartSearchRecalls(searchTerm, searchAnalysis),
    smartSearchAdverseEvents(searchTerm, searchAnalysis),
    smartSearchRegistrations(searchTerm, searchAnalysis),
    smartSearchClassification(searchTerm, searchAnalysis),
    smartSearchEnforcement(searchTerm, searchAnalysis) // Additional endpoint
  ]);

  const [
    fiveOneOk,
    pma,
    recalls,
    adverseEvents,
    registrations,
    classification,
    enforcement
  ] = results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error('FDA API call failed:', result.reason?.message || result.reason);
      return { results: [], error: result.reason?.message || 'Unknown error', meta: { totalFetched: 0 } };
    }
  });

  // Enhanced metadata tracking
  const successfulEndpoints = [];
  const failedEndpoints = [];
  
  const endpointNames = ['510k', 'pma', 'recalls', 'adverseEvents', 'registrations', 'classification', 'enforcement'];
  const endpointResults = [fiveOneOk, pma, recalls, adverseEvents, registrations, classification, enforcement];
  
  let totalRecords = 0;
  endpointResults.forEach((result, index) => {
    const count = result.results?.length || 0;
    totalRecords += count;
    
    if (count > 0) {
      successfulEndpoints.push(`${endpointNames[index]} (${count})`);
    } else if (result.error) {
      failedEndpoints.push(endpointNames[index]);
    }
  });
  
  console.log(`Enhanced FDA API Summary - Total Records: ${totalRecords}`);
  console.log(`Successful: [${successfulEndpoints.join(', ')}]`);
  if (failedEndpoints.length > 0) {
    console.log(`Failed: [${failedEndpoints.join(', ')}]`);
  }

  return {
    fiveOneOk,
    pma,
    recalls,
    adverseEvents,
    registrations,
    classification,
    enforcement,
    _metadata: {
      successfulEndpoints,
      failedEndpoints,
      totalEndpoints: endpointNames.length,
      totalRecords,
      maxResultsPerEndpoint: maxResults,
      searchType: searchAnalysis.type,
      searchMode: searchAnalysis.mode,
      enhancedSearch: true
    }
  };
}


// Enhanced 510(k) search that also looks for De Novo
async function smartSearch510kEnhanced(searchTerm, analysis) {
  // First try the regular 510(k) search
  const regularResult = await smartSearch510k(searchTerm, analysis);
  
  // Then try specific De Novo searches
  const deNovoResult = await searchDeNovoDevices(searchTerm);
  
  // Combine results
  const combinedResults = [
    ...(regularResult.results || []),
    ...(deNovoResult.results || [])
  ];
  
  // Remove duplicates based on k_number
  const uniqueResults = combinedResults.filter((device, index, array) => 
    array.findIndex(d => d.k_number === device.k_number) === index
  );
  
  console.log(`Combined 510(k) + De Novo search: ${uniqueResults.length} total results`);
  
  return {
    results: uniqueResults,
    meta: {
      totalFetched: uniqueResults.length,
      regular510k: regularResult.results?.length || 0,
      deNovoFound: deNovoResult.results?.length || 0
    }
  };
}


// Enhanced search specifically for De Novo devices
// Enhanced search specifically for De Novo devices using K-number pattern
async function searchDeNovoDevices(searchTerm) {
  const deNovoSearchQueries = [
    // Direct K-number pattern search for De Novo
    `device_name:"${searchTerm}" AND k_number:DEN*`,
    `device_name:${searchTerm} AND k_number:DEN*`,
    
    // Decision code search
    `device_name:"${searchTerm}" AND decision_code:DENG`,
    `device_name:${searchTerm} AND decision_code:DENG`,
    
    // Broader searches
    `"${searchTerm}" AND k_number:DEN*`,
    `"${searchTerm}" AND decision_code:DENG`,
    
    // Text-based fallbacks
    `device_name:"${searchTerm}" AND decision_description:"de novo"`,
    `"${searchTerm}" AND decision_description:"de novo"`
  ];
  
  let bestResult = { results: [] };
  
  for (const query of deNovoSearchQueries) {
    try {
      console.log(`🔍 De Novo search query: ${query}`);
      
      const result = await fdaRequestWithPagination('/510k.json', { 
        search: query 
      }, 200); // Smaller limit for De Novo specific searches
      
      if (result.results && result.results.length > 0) {
        console.log(`✅ De Novo query found ${result.results.length} results`);
        
        // Verify these are actually De Novo devices using our detection
        const { deNovoDevices } = detectDeNovoDevices(result.results);
        
        if (deNovoDevices.length > bestResult.results.length) {
          bestResult = { 
            results: deNovoDevices,
            meta: { 
              totalFetched: deNovoDevices.length,
              searchQuery: query,
              originalResultCount: result.results.length
            }
          };
        }
      }
    } catch (error) {
      console.log(`❌ De Novo search failed for query "${query}": ${error.message}`);
    }
  }
  
  console.log(`🎯 De Novo search complete: ${bestResult.results.length} verified De Novo devices found`);
  return bestResult;
}


// Enhanced PMA search with comprehensive strategies
async function smartSearchPMAEnhanced(searchTerm, analysis) {
  const strategies = [
    // Direct product searches
    { field: 'trade_name', value: searchTerm, exact: true },
    { field: 'generic_name', value: searchTerm, exact: true },
    { field: 'pma_number', value: searchTerm.toUpperCase(), exact: true },
    { field: 'product_code', value: searchTerm.toUpperCase(), exact: true },
    
    // Company searches
    { field: 'applicant', value: searchTerm, exact: false },
    
    // Broad device category searches
    { field: 'trade_name', value: searchTerm, exact: false },
    { field: 'generic_name', value: searchTerm, exact: false },
    
    // Advisory committee searches (often contains device type info)
    { field: 'advisory_committee_description', value: searchTerm, exact: false }
  ];
  
  let bestResult = { results: [] };
  
  for (const strategy of strategies) {
    try {
      let searchQuery;
      
      if (strategy.exact) {
        searchQuery = `${strategy.field}:"${strategy.value}"`;
      } else {
        // Multi-word handling for better matching
        const words = strategy.value.split(' ').filter(word => word.length > 2);
        if (words.length === 1) {
          searchQuery = `${strategy.field}:${strategy.value}`;
        } else {
          const exactMatch = `${strategy.field}:"${strategy.value}"`;
          const partialMatches = words.map(word => `${strategy.field}:${word}`).join(' AND ');
          searchQuery = `(${exactMatch}) OR (${partialMatches})`;
        }
      }
      
      const result = await fdaRequestWithPagination('/pma.json', { 
        search: searchQuery 
      }, 1000);
      
      if (result.results && result.results.length > bestResult.results.length) {
        bestResult = result;
        console.log(`PMA enhanced search improved results: ${strategy.field} strategy found ${result.results.length} results`);
      }
      
      // If we find substantial results, we can continue to try other strategies for completeness
      // but keep track of the best one
      
    } catch (error) {
      console.log(`PMA enhanced strategy failed for ${strategy.field}: ${error.message}`);
    }
  }
  
  return bestResult;
}

// Search enforcement actions
async function smartSearchEnforcement(searchTerm, analysis) {
  try {
    const result = await fdaRequestWithPagination('/enforcement.json', { 
      search: `product_description:"${searchTerm}" OR recalling_firm:"${searchTerm}"` 
    }, 500); // Smaller limit for enforcement
    
    return result;
  } catch (error) {
    console.log(`Enforcement search failed: ${error.message}`);
    return { results: [], error: error.message, meta: { totalFetched: 0 } };
  }
}

// Generate detailed timeline analysis
function generateDetailedTimelineAnalysis(fdaData) {
    const timeline = {
        monthly: {},
        yearly: {},
        trends: {
            overall: 'stable',
            byPathway: {}
        },
        seasonality: {},
        recentActivity: []
    };
    
    const allDevices = [];
    
    // Collect all devices with dates
    if (fdaData.fiveOneOk?.results) {
        fdaData.fiveOneOk.results.forEach(device => {
            if (device.decision_date) {
                try {
                    const date = new Date(device.decision_date);
                    if (!isNaN(date.getTime())) { // Valid date check
                        const pathway = device.decision_description?.toLowerCase().includes('de novo') ? 'deNovo' : '510k';
                        allDevices.push({
                            ...device,
                            pathway,
                            date,
                            year: date.getFullYear(),
                            month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                        });
                    }
                } catch (error) {
                    console.warn('Invalid date format:', device.decision_date);
                }
            }
        });
    }
    
    if (fdaData.pma?.results) {
        fdaData.pma.results.forEach(device => {
            if (device.decision_date) {
                try {
                    const date = new Date(device.decision_date);
                    if (!isNaN(date.getTime())) { // Valid date check
                        allDevices.push({
                            ...device,
                            pathway: 'pma',
                            date,
                            year: date.getFullYear(),
                            month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                        });
                    }
                } catch (error) {
                    console.warn('Invalid date format:', device.decision_date);
                }
            }
        });
    }
    
    // Process timeline data
    allDevices.forEach(device => {
        const year = device.year;
        const month = device.month;
        
        // Yearly aggregation
        if (!timeline.yearly[year]) {
            timeline.yearly[year] = { '510k': 0, 'pma': 0, 'deNovo': 0, total: 0 };
        }
        timeline.yearly[year][device.pathway]++;
        timeline.yearly[year].total++;
        
        // Monthly aggregation
        if (!timeline.monthly[month]) {
            timeline.monthly[month] = { '510k': 0, 'pma': 0, 'deNovo': 0, total: 0 };
        }
        timeline.monthly[month][device.pathway]++;
        timeline.monthly[month].total++;
        
        // Recent activity (last 2 years)
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        
        if (device.date > twoYearsAgo) {
            timeline.recentActivity.push({
                date: device.decision_date,
                pathway: device.pathway,
                deviceName: device.device_name || device.trade_name || device.generic_name || 'Unknown Device',
                applicant: device.applicant || 'Unknown Applicant',
                id: device.k_number || device.pma_number || 'Unknown ID'
            });
        }
    });
    
    // Sort recent activity by date (newest first)
    timeline.recentActivity.sort((a, b) => new Date(b.date) - new Date(a.date));
    timeline.recentActivity = timeline.recentActivity.slice(0, 20);
    
    // Calculate trends
    const years = Object.keys(timeline.yearly).sort();
    if (years.length >= 2) {
        const recent = timeline.yearly[years[years.length - 1]]?.total || 0;
        const previous = timeline.yearly[years[years.length - 2]]?.total || 0;
        
        if (recent > previous * 1.1) {
            timeline.trends.overall = 'increasing';
        } else if (recent < previous * 0.9) {
            timeline.trends.overall = 'decreasing';
        } else {
            timeline.trends.overall = 'stable';
        }
    }
    
    return timeline;
}

function generateEnhancedSummary(applicableParts, recommendations, pathway) {
  if (applicableParts.length === 0) {
    return 'No specific CFR parts identified. Device may be unregulated or require manual regulatory review.';
  }

  const primaryPart = applicableParts[0];
  let summary = `Primary regulation: 21 CFR Part ${primaryPart.part} (${primaryPart.description}). `;
  
  summary += `Recommended pathway: ${pathway.recommendedPath}. `;
  summary += `Estimated timeline: ${pathway.timeline}. `;
  summary += `Estimated costs: ${pathway.costs}. `;
  
  if (primaryPart.exemptions) {
    const totalExemptions = Object.values(primaryPart.exemptions).flat().length;
    summary += `${totalExemptions} potential exemptions identified. `;
  }

  return summary;
}

async function enhancedCFRPartsSearch(searchTerm, fdaData) {
  const applicableParts = identifyApplicableCFRParts(fdaData, searchTerm);
  const recommendations = generateCFRRecommendations(applicableParts, fdaData);
  const pathway = generateRegulatoryPathwayRecommendation(fdaData, applicableParts);

  return {
    searchTerm,
    timestamp: new Date().toISOString(),
    applicableParts,
    recommendations,
    suggestedPathway: pathway,
    summary: generateEnhancedSummary(applicableParts, recommendations, pathway)
  };
}

// Generate competitive landscape
function generateCompetitiveLandscape(fdaData) {
  const companies = new Map();
  
  // Analyze all approved devices by company
  [fdaData.fiveOneOk, fdaData.pma].forEach(dataset => {
    if (dataset?.results) {
      dataset.results.forEach(device => {
        const company = device.applicant || 'Unknown';
        if (!companies.has(company)) {
          companies.set(company, {
            name: company,
            devices: [],
            pathways: { '510k': 0, 'pma': 0, 'deNovo': 0 },
            productCodes: new Set(),
            totalApprovals: 0
          });
        }
        
        const companyData = companies.get(company);
        companyData.devices.push({
          name: device.device_name || device.trade_name || device.generic_name,
          id: device.k_number || device.pma_number,
          date: device.decision_date,
          productCode: device.product_code,
          pathway: device.k_number ? 
            (device.decision_description?.toLowerCase().includes('de novo') ? 'deNovo' : '510k') : 'pma'
        });
        
        if (device.k_number) {
          if (device.decision_description?.toLowerCase().includes('de novo')) {
            companyData.pathways.deNovo++;
          } else {
            companyData.pathways['510k']++;
          }
        } else {
          companyData.pathways.pma++;
        }
        
        if (device.product_code) {
          companyData.productCodes.add(device.product_code);
        }
        companyData.totalApprovals++;
      });
    }
  });
  
  // Convert to array and sort by total approvals
  const competitiveData = Array.from(companies.values())
    .map(company => ({
      ...company,
      productCodes: Array.from(company.productCodes),
      marketShare: 0 // Will be calculated below
    }))
    .sort((a, b) => b.totalApprovals - a.totalApprovals)
    .slice(0, 15); // Top 15 companies
  
  // Calculate market share
  const totalDevices = competitiveData.reduce((sum, company) => sum + company.totalApprovals, 0);
  competitiveData.forEach(company => {
    company.marketShare = totalDevices > 0 ? Math.round((company.totalApprovals / totalDevices) * 100) : 0;
  });
  
  return {
    topCompanies: competitiveData,
    marketConcentration: calculateMarketConcentration(competitiveData),
    totalCompanies: companies.size,
    totalDevices
  };
}

// Calculate market concentration (HHI-like metric)
function calculateMarketConcentration(companies) {
  const hhi = companies.reduce((sum, company) => {
    return sum + (company.marketShare * company.marketShare);
  }, 0);
  
  let concentration = 'Low';
  if (hhi > 2500) concentration = 'High';
  else if (hhi > 1500) concentration = 'Moderate';
  
  return { hhi, level: concentration };
}

// Generate regulatory guidance
function generateRegulatoryGuidance(pathwayInsights) {
  const guidance = {
    recommendedPathway: '',
    keyConsiderations: [],
    timeline: '',
    clinicalRequirements: '',
    costs: '',
    riskFactors: []
  };
  
  // Determine recommended pathway based on data
  const pathways = pathwayInsights.pathwayBreakdown;
  const total = pathwayInsights.totalApprovedDevices;
  
  if (total === 0) {
    guidance.recommendedPathway = 'Insufficient data - consider De Novo pathway for novel devices';
    guidance.keyConsiderations.push('No approved predicates found - may indicate novel device category');
    return guidance;
  }
  
  // Determine primary pathway
  if (pathways['510k'].percentage > 60) {
    guidance.recommendedPathway = '510(k) Clearance (Primary)';
    guidance.timeline = `${pathways['510k'].avgTimeToApproval || 90}-180 days typical`;
    guidance.clinicalRequirements = 'Typically bench testing, may require clinical data';
    guidance.costs = '$12,432 (small business: $3,108)';
    guidance.keyConsiderations.push('Identify appropriate predicate devices');
    guidance.keyConsiderations.push('Demonstrate substantial equivalence');
  } else if (pathways.pma.percentage > 40) {
    guidance.recommendedPathway = 'PMA Approval (Primary)';
    guidance.timeline = `${pathways.pma.avgTimeToApproval || 300}-400 days typical`;
    guidance.clinicalRequirements = 'Clinical studies required';
    guidance.costs = '$365,657 (small business: $91,414)';
    guidance.keyConsiderations.push('Prepare comprehensive clinical data package');
    guidance.keyConsiderations.push('Consider pre-submission meetings with FDA');
  } else {
    guidance.recommendedPathway = 'Mixed Pathways - Device-specific determination needed';
    guidance.keyConsiderations.push('Multiple pathways viable - depends on specific device characteristics');
  }
  
  // Add De Novo considerations
  if (pathways.deNovo.count > 0) {
    guidance.keyConsiderations.push(`De Novo pathway available (${pathways.deNovo.count} precedents)`);
    if (pathways.deNovo.avgTimeToApproval) {
      guidance.timeline += ` | De Novo: ${pathways.deNovo.avgTimeToApproval} days`;
    }
  }
  
  return guidance;
}

// Get dominant pathway
function getDominantPathway(pathwayInsights) {
  const pathways = pathwayInsights.pathwayBreakdown;
  
  if (pathways['510k'].count >= pathways.pma.count && pathways['510k'].count >= pathways.deNovo.count) {
    return '510(k)';
  } else if (pathways.pma.count >= pathways.deNovo.count) {
    return 'PMA';
  } else {
    return 'De Novo';
  }
}

// Calculate overall average time to approval
function calculateOverallAvgTime(pathwayInsights) {
  const pathways = pathwayInsights.pathwayBreakdown;
  let totalTime = 0;
  let totalDevices = 0;
  
  Object.values(pathways).forEach(pathway => {
    if (pathway.avgTimeToApproval && pathway.count > 0) {
      totalTime += pathway.avgTimeToApproval * pathway.count;
      totalDevices += pathway.count;
    }
  });
  
  return totalDevices > 0 ? Math.round(totalTime / totalDevices) : null;
}



// Product Code specific search endpoint
router.get('/product-code/:productCode', async (req, res) => {
  try {
    const { productCode } = req.params;
    
    if (!productCode) {
      return res.status(400).json({ error: 'Product code is required' });
    }

    console.log(`Product Code Search for: ${productCode}`);
    
    // Get all FDA data for this product code
    const fdaData = await getAllFDAData(productCode, 'device');
    
    // Get classification data specifically for this product code
    const classificationData = await getProductCodeClassification(productCode);
    
    // Generate pathway analysis
    const pathwayAnalysis = generatePathwayInsights(fdaData);
    
    res.json({
      productCode,
      timestamp: new Date().toISOString(),
      classification: classificationData,
      pathwayAnalysis,
      fdaData,
      summary: generateProductCodeSummary(fdaData, classificationData, pathwayAnalysis)
    });

  } catch (error) {
    console.error('Product code search error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Get detailed classification for product code
async function getProductCodeClassification(productCode) {
  try {
    const classificationData = await fdaRequestWithPagination('/classification.json', {
      search: `product_code:"${productCode}"`
    });

    if (!classificationData.results || classificationData.results.length === 0) {
      return { error: 'No classification found for this product code' };
    }

    const classification = classificationData.results[0];
    
    return {
      productCode,
      deviceName: classification.device_name,
      deviceClass: classification.device_class,
      regulationNumber: classification.regulation_number,
      medicalSpecialty: classification.medical_specialty_description,
      panelCode: classification.review_panel,
      summary: classification.summary,
      definitionText: classification.definition,
      physicalState: classification.physical_state,
      technicalMethod: classification.technical_method,
      targetArea: classification.target_area
    };
  } catch (error) {
    console.error('Error fetching classification:', error);
    return { error: error.message };
  }
}

// Generate summary for product code search
function generateProductCodeSummary(fdaData, classificationData, pathwayAnalysis) {
  return {
    productCode: classificationData.productCode,
    deviceName: classificationData.deviceName,
    deviceClass: classificationData.deviceClass,
    totalApprovedDevices: pathwayAnalysis.totalApprovedDevices,
    primaryPathway: pathwayAnalysis.dominantPathway,
    regulatoryComplexity: classificationData.deviceClass === 'III' ? 'High' : 
                         classificationData.deviceClass === 'II' ? 'Medium' : 'Low',
    recentActivity: pathwayAnalysis.totalApprovedDevices > 0 ? 
                   `${pathwayAnalysis.totalApprovedDevices} approved devices found` : 'No recent approvals'
  };
}

// Enhanced profile creation
function createEnhancedProfile(searchTerm, fdaData, pathwayInsights, searchMode) {
  const isCompanySearch = searchMode === 'company' || fdaData._metadata?.searchMode === 'company';
  
  const profile = {
    searchTerm,
    searchType: fdaData._metadata?.searchType || 'unknown',
    searchMode: fdaData._metadata?.searchMode || searchMode || 'device',
    isCompanySearch,
    overview: {
      totalFDARecords: fdaData._metadata?.totalRecords || 0,
      regulatoryComplexity: 'Unknown',
      primaryClassification: isCompanySearch ? 'Multiple Devices' : 'Unknown',
      marketStatus: 'Unknown'
    },
    regulatory: {
      deviceClasses: pathwayInsights.deviceClasses || [],
      pathways: [],
      productCodes: pathwayInsights.productCodes || []
    },
    safety: {
      recallCount: fdaData.recalls?.results?.length || 0,
      adverseEventCount: fdaData.adverseEvents?.results?.length || 0,
      riskLevel: 'Unknown'
    },
    market: {
      active510k: fdaData.fiveOneOk?.results?.length || 0,
      activePMA: fdaData.pma?.results?.length || 0,
      currentRegistrations: fdaData.registrations?.results?.length || 0
    },
    recommendations: pathwayInsights.recommendations || [],
    companyInfo: {
      manufacturers: [],
      applicants: [],
      facilities: [],
      devicePortfolio: []
    }
  };

  // Enhanced company information extraction
  if (isCompanySearch) {
    const companies = new Set();
    const applicants = new Set();
    const facilities = new Set();
    const deviceTypes = new Set();
    
    [fdaData.fiveOneOk, fdaData.pma, fdaData.registrations].forEach(dataset => {
      if (dataset?.results) {
        dataset.results.forEach(item => {
          if (item.applicant) applicants.add(item.applicant);
          if (item.company_name) companies.add(item.company_name);
          if (item.establishment_name) facilities.add(item.establishment_name);
          if (item.manufacturer_name) companies.add(item.manufacturer_name);
          if (item.device_name) deviceTypes.add(item.device_name);
          if (item.trade_name) deviceTypes.add(item.trade_name);
          if (item.generic_name) deviceTypes.add(item.generic_name);
        });
      }
    });
    
    profile.companyInfo.manufacturers = Array.from(companies).slice(0, 10);
    profile.companyInfo.applicants = Array.from(applicants).slice(0, 10);
    profile.companyInfo.facilities = Array.from(facilities).slice(0, 10);
    profile.companyInfo.devicePortfolio = Array.from(deviceTypes).slice(0, 15);
  }

  // Determine regulatory pathways
  if (pathwayInsights.pathwayBreakdown['510k'].count > 0) {
    profile.regulatory.pathways.push('510(k) Clearance');
  }
  if (pathwayInsights.pathwayBreakdown.pma.count > 0) {
    profile.regulatory.pathways.push('PMA Approval');
  }
  if (pathwayInsights.pathwayBreakdown.deNovo.count > 0) {
    profile.regulatory.pathways.push('De Novo Classification');
  }

  // Determine complexity and classification
  const classLevels = new Set(pathwayInsights.deviceClasses);
  
  if (isCompanySearch) {
    const deviceCount = profile.companyInfo.devicePortfolio.length;
    const facilityCount = profile.companyInfo.facilities.length;
    const hasMultipleClasses = classLevels.size > 1;
    
    if (deviceCount > 10 || facilityCount > 5 || hasMultipleClasses) {
      profile.overview.regulatoryComplexity = 'High';
    } else if (deviceCount > 3 || facilityCount > 2) {
      profile.overview.regulatoryComplexity = 'Medium';
    } else if (deviceCount > 0) {
      profile.overview.regulatoryComplexity = 'Low';
    }
    
    profile.overview.primaryClassification = classLevels.size > 1 ? 
      `Multiple Classes (${Array.from(classLevels).join(', ')})` : 
      classLevels.size === 1 ? `Primarily Class ${Array.from(classLevels)[0]}` : 'Various Devices';
  } else {
    // Device-specific analysis
    const hasClassIII = classLevels.has('III') || classLevels.has('3');
    const hasClassII = classLevels.has('II') || classLevels.has('2');
    const hasClassI = classLevels.has('I') || classLevels.has('1');
    
    if (hasClassIII) {
      profile.overview.regulatoryComplexity = 'High';
      profile.overview.primaryClassification = 'Class III';
    } else if (hasClassII) {
      profile.overview.regulatoryComplexity = 'Medium';
      profile.overview.primaryClassification = 'Class II';
    } else if (hasClassI) {
      profile.overview.regulatoryComplexity = 'Low';
      profile.overview.primaryClassification = 'Class I';
    }
  }

  // Risk and safety assessment
  if (profile.safety.recallCount > 5 || profile.safety.adverseEventCount > 10) {
    profile.safety.riskLevel = 'High';
  } else if (profile.safety.recallCount > 0 || profile.safety.adverseEventCount > 0) {
    profile.safety.riskLevel = 'Medium';
  } else {
    profile.safety.riskLevel = 'Low';
  }

  // Market status
  if (profile.market.active510k > 0 || profile.market.activePMA > 0) {
    profile.overview.marketStatus = isCompanySearch ? 'Active FDA Portfolio' : 'FDA Cleared/Approved';
  } else if (profile.market.currentRegistrations > 0) {
    profile.overview.marketStatus = 'Registered';
  } else if (profile.overview.totalFDARecords > 0) {
    profile.overview.marketStatus = 'Has FDA History';
  }

  return profile;
}

// Device pathway search endpoint
router.get('/device-pathways', async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term (q) is required' });
    }

    console.log(`Device pathway search for: ${searchTerm}`);
    
    // Get all approved devices for this search term
    const fdaData = await getAllFDAData(searchTerm, 'device');
    
    // Generate pathway insights
    const pathwayInsights = generatePathwayInsights(fdaData);
    
    // Get market trends
    const marketTrends = analyzeMarketTrends(fdaData);
    
    res.json({
      searchTerm,
      timestamp: new Date().toISOString(),
      pathwayInsights,
      marketTrends,
      fdaData,
      summary: {
        totalDevices: pathwayInsights.totalApprovedDevices,
        pathwayBreakdown: pathwayInsights.pathwayBreakdown,
        dominantPathway: pathwayInsights.dominantPathway,
        productCodes: pathwayInsights.productCodes,
        deviceClasses: pathwayInsights.deviceClasses
      }
    });

  } catch (error) {
    console.error('Device pathway search error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Analyze market trends
function analyzeMarketTrends(fdaData) {
  const trends = {
    yearlyApprovals: {},
    recentTrend: 'stable',
    averageTimeToApproval: 'Unknown'
  };

  // Combine all approvals with dates
  const allApprovals = [];
  
  // Add 510(k) clearances
  if (fdaData.fiveOneOk?.results) {
    fdaData.fiveOneOk.results.forEach(device => {
      if (device.decision_date && device.decision_description?.toLowerCase().includes('cleared')) {
        allApprovals.push({
          ...device,
          pathway: '510(k)',
          date: device.decision_date,
          type: 'clearance'
        });
      }
    });
  }

  // Add PMA approvals
  if (fdaData.pma?.results) {
    fdaData.pma.results.forEach(device => {
      if (device.decision_date && device.decision_description?.toLowerCase().includes('approved')) {
        allApprovals.push({
          ...device,
          pathway: 'PMA',
          date: device.decision_date,
          type: 'approval'
        });
      }
    });
  }

  // Group by year
  allApprovals.forEach(approval => {
    if (approval.date) {
      const year = new Date(approval.date).getFullYear();
      if (!trends.yearlyApprovals[year]) {
        trends.yearlyApprovals[year] = { total: 0, byPathway: {} };
      }
      trends.yearlyApprovals[year].total++;
      trends.yearlyApprovals[year].byPathway[approval.pathway] = 
        (trends.yearlyApprovals[year].byPathway[approval.pathway] || 0) + 1;
    }
  });

  // Calculate trend
  const years = Object.keys(trends.yearlyApprovals).sort();
  if (years.length >= 2) {
    const recent = trends.yearlyApprovals[years[years.length - 1]]?.total || 0;
    const previous = trends.yearlyApprovals[years[years.length - 2]]?.total || 0;
    
    if (recent > previous * 1.1) {
      trends.recentTrend = 'increasing';
    } else if (recent < previous * 0.9) {
      trends.recentTrend = 'decreasing';
    }
  }

  return trends;
}

// CFR Part search endpoint
router.get('/cfr-parts', async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term (q) is required' });
    }

    // Get applicable CFR parts based on device data
    const fdaData = await getAllFDAData(searchTerm, 'device');
    const applicableParts = identifyApplicableCFRParts(fdaData, searchTerm);
    
    res.json({
      searchTerm,
      timestamp: new Date().toISOString(),
      applicableParts,
      recommendations: generateCFRRecommendations(applicableParts, fdaData)
    });

  } catch (error) {
    console.error('CFR parts search error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Identify applicable CFR parts based on FDA data
// function identifyApplicableCFRParts(fdaData, searchTerm) {
//   const partMapping = {
//     '862': { description: 'Clinical Chemistry and Clinical Toxicology Devices', keywords: ['chemistry', 'toxicology', 'blood', 'urine', 'clinical', 'laboratory', 'analyzer', 'glucose', 'cholesterol'] },
//     '864': { description: 'Hematology and Pathology Devices', keywords: ['hematology', 'pathology', 'blood', 'cell', 'microscope', 'centrifuge', 'hemoglobin'] },
//     '866': { description: 'Immunology and Microbiology Devices', keywords: ['immunology', 'microbiology', 'bacteria', 'virus', 'culture', 'antibody', 'antigen', 'test'] },
//     '868': { description: 'Anesthesiology Devices', keywords: ['anesthesia', 'anesthetic', 'ventilator', 'breathing', 'airway', 'oxygen', 'gas'] },
//     '870': { description: 'Cardiovascular Devices', keywords: ['heart', 'cardiac', 'cardiovascular', 'pacemaker', 'defibrillator', 'stent', 'catheter', 'blood pressure', 'ecg', 'ekg'] },
//     '872': { description: 'Dental Devices', keywords: ['dental', 'tooth', 'teeth', 'oral', 'mouth', 'gum', 'implant', 'filling', 'crown', 'bridge'] },
//     '874': { description: 'Ear, Nose, and Throat Devices', keywords: ['ear', 'nose', 'throat', 'hearing', 'ent', 'otolaryngology', 'cochlear', 'tinnitus', 'sinus'] },
//     '876': { description: 'Gastroenterology-Urology Devices', keywords: ['gastro', 'urology', 'stomach', 'kidney', 'bladder', 'endoscope', 'catheter', 'dialysis'] },
//     '878': { description: 'General and Plastic Surgery Devices', keywords: ['surgery', 'surgical', 'scalpel', 'suture', 'implant', 'plastic', 'cosmetic'] },
//     '880': { description: 'General Hospital and Personal Use Devices', keywords: ['hospital', 'bed', 'wheelchair', 'thermometer', 'syringe', 'bandage', 'personal'] },
//     '882': { description: 'Neurological Devices', keywords: ['neuro', 'brain', 'nerve', 'spinal', 'stimulator', 'electrode', 'eeg', 'epilepsy'] },
//     '884': { description: 'Obstetrical and Gynecological Devices', keywords: ['obstetric', 'gynecological', 'pregnancy', 'fetal', 'contraceptive', 'menstrual'] },
//     '886': { description: 'Ophthalmic Devices', keywords: ['eye', 'ophthalmic', 'vision', 'lens', 'contact', 'retina', 'glaucoma', 'cataract'] },
//     '888': { description: 'Orthopedic Devices', keywords: ['orthopedic', 'bone', 'joint', 'hip', 'knee', 'spine', 'fracture', 'prosthetic'] },
//     '890': { description: 'Physical Medicine Devices', keywords: ['physical', 'rehabilitation', 'therapy', 'exercise', 'mobility', 'walker', 'crutch'] },
//     '892': { description: 'Radiology Devices', keywords: ['radiology', 'x-ray', 'mri', 'ct', 'ultrasound', 'imaging', 'scanner', 'radiation'] }
//   };

//   const applicableParts = [];
//   const searchText = searchTerm.toLowerCase();
  
//   // Check direct keyword matches
//   Object.entries(partMapping).forEach(([part, info]) => {
//     const score = info.keywords.filter(keyword => 
//       searchText.includes(keyword) || keyword.includes(searchText)
//     ).length;
    
//     if (score > 0) {
//       applicableParts.push({
//         part,
//         description: info.description,
//         relevanceScore: score,
//         matchType: 'keyword'
//       });
//     }
//   });

//   // Check FDA data for regulation numbers and medical specialties
//   Object.values(fdaData).forEach(dataset => {
//     if (dataset.results) {
//       dataset.results.forEach(item => {
//         // Check regulation numbers
//         const regNumber = item.regulation_number || item.openfda?.regulation_number;
//         if (regNumber) {
//           const part = regNumber.split('.')[0];
//           if (partMapping[part] && !applicableParts.find(p => p.part === part)) {
//             applicableParts.push({
//               part,
//               description: partMapping[part].description,
//               relevanceScore: 10, // High score for direct regulation match
//               matchType: 'regulation',
//               regulationNumber: regNumber
//             });
//           }
//         }

//         // Check medical specialty
//         const specialty = item.medical_specialty_description || item.openfda?.medical_specialty_description;
//         if (specialty) {
//           Object.entries(partMapping).forEach(([part, info]) => {
//             if (info.description.toLowerCase().includes(specialty.toLowerCase()) ||
//                 specialty.toLowerCase().includes(part)) {
//               if (!applicableParts.find(p => p.part === part)) {
//                 applicableParts.push({
//                   part,
//                   description: info.description,
//                   relevanceScore: 8,
//                   matchType: 'specialty',
//                   specialty
//                 });
//               }
//             }
//           });
//         }
//       });
//     }
//   });

//   // Sort by relevance score and return top matches
//   return applicableParts
//     .sort((a, b) => b.relevanceScore - a.relevanceScore)
//     .slice(0, 5);
// }

function identifyApplicableCFRParts(fdaData, searchTerm) {
  const partMapping = {
    '862': { 
      description: 'Clinical Chemistry and Clinical Toxicology Devices',
      keywords: ['chemistry', 'toxicology', 'blood', 'urine', 'clinical', 'laboratory', 'analyzer', 'glucose', 'cholesterol'],
      exemptions: {
        'Class I': ['862.1040 - Sample cups/containers', '862.1050 - Pipettes', '862.1060 - Specimen transport bags'],
        'Class II': ['862.3030 - Some automated analyzers with FDA guidance']
      },
      requirements: {
        'analytical_performance': 'Accuracy, precision, linearity validation required',
        'clinical_validation': 'Clinical correlation studies for new analytes',
        'interference_studies': 'Hemolysis, lipemia, bilirubin testing',
        'stability_studies': 'Reagent stability validation'
      }
    },
    '864': { 
      description: 'Hematology and Pathology Devices',
      keywords: ['hematology', 'pathology', 'blood', 'cell', 'microscope', 'centrifuge', 'hemoglobin'],
      exemptions: {
        'Class I': ['864.1040 - Manual differential counters', '864.1050 - Hemacytometers'],
        'Class II': ['864.5425 - Some automated cell counters']
      },
      requirements: {
        'precision_studies': 'Within-run and between-run precision validation',
        'linearity_studies': 'Measurement range validation',
        'carryover_studies': 'Sample-to-sample contamination testing'
      }
    },
    '866': { 
      description: 'Immunology and Microbiology Devices',
      keywords: ['immunology', 'microbiology', 'bacteria', 'virus', 'culture', 'antibody', 'antigen', 'test'],
      exemptions: {
        'Class I': ['866.1040 - Basic culture media', '866.1050 - Transport media'],
        'Class II': ['866.3020 - Some automated ID systems']
      },
      requirements: {
        'clinical_sensitivity': 'Positive percent agreement studies',
        'clinical_specificity': 'Negative percent agreement studies',
        'cross_reactivity': 'Testing with related organisms',
        'analytical_sensitivity': 'Limit of detection studies'
      }
    },
    '868': { 
      description: 'Anesthesiology Devices',
      keywords: ['anesthesia', 'anesthetic', 'ventilator', 'breathing', 'airway', 'oxygen', 'gas'],
      exemptions: {
        'Class I': ['868.1040 - Manual resuscitators', '868.1050 - Oxygen masks'],
        'Class II': []
      },
      requirements: {
        'electrical_safety': 'IEC 60601-1 compliance required',
        'alarm_systems': 'Comprehensive alarm testing',
        'gas_analysis': 'Accuracy of gas concentration measurements'
      }
    },
    '870': { 
      description: 'Cardiovascular Devices',
      keywords: ['heart', 'cardiac', 'cardiovascular', 'pacemaker', 'defibrillator', 'stent', 'catheter', 'blood pressure'],
      exemptions: {
        'Class I': ['870.1025 - Manual sphygmomanometers', '870.1100 - Stethoscopes'],
        'Class II': []
      },
      requirements: {
        'biocompatibility': 'ISO 10993 biological evaluation required',
        'electrical_safety': 'IEC 60601-1 compliance',
        'clinical_studies': 'Safety and effectiveness validation',
        'electromagnetic_compatibility': 'EMC testing per IEC 60601-1-2'
      }
    },
    '872': { 
      description: 'Dental Devices',
      keywords: ['dental', 'tooth', 'teeth', 'oral', 'mouth', 'gum', 'implant', 'filling'],
      exemptions: {
        'Class I': ['872.1040 - Basic dental tools', '872.1050 - Dental floss'],
        'Class II': ['872.3025 - Some dental amalgam']
      },
      requirements: {
        'biocompatibility': 'ISO 10993 testing for oral contact',
        'mechanical_properties': 'Strength and durability testing',
        'clinical_studies': 'Long-term safety data'
      }
    },
    '874': { 
      description: 'Ear, Nose, and Throat Devices',
      keywords: ['ear', 'nose', 'throat', 'hearing', 'ent', 'otolaryngology', 'cochlear'],
      exemptions: {
        'Class I': ['874.1040 - Basic ENT tools', '874.1050 - Ear specula'],
        'Class II': []
      },
      requirements: {
        'acoustic_safety': 'Sound pressure level limits',
        'biocompatibility': 'ISO 10993 for body contact',
        'clinical_studies': 'Hearing improvement validation'
      }
    },
    '876': { 
      description: 'Gastroenterology-Urology Devices',
      keywords: ['gastro', 'urology', 'stomach', 'kidney', 'bladder', 'endoscope', 'catheter'],
      exemptions: {
        'Class I': ['876.1040 - Basic catheters', '876.1050 - Urine collection bags'],
        'Class II': []
      },
      requirements: {
        'biocompatibility': 'ISO 10993 for body contact',
        'sterility': 'Sterility assurance validation',
        'clinical_studies': 'Safety and effectiveness data'
      }
    },
    '878': { 
      description: 'General and Plastic Surgery Devices',
      keywords: ['surgery', 'surgical', 'scalpel', 'suture', 'implant', 'plastic'],
      exemptions: {
        'Class I': ['878.1040 - Basic surgical tools', '878.1050 - Surgical gauze'],
        'Class II': []
      },
      requirements: {
        'biocompatibility': 'ISO 10993 comprehensive testing',
        'sterility': 'Sterility validation required',
        'mechanical_properties': 'Strength and durability testing'
      }
    },
    '880': { 
      description: 'General Hospital and Personal Use Devices',
      keywords: ['hospital', 'bed', 'wheelchair', 'thermometer', 'syringe', 'bandage'],
      exemptions: {
        'Class I': ['880.1040 - Hospital beds', '880.1050 - Wheelchairs', '880.1060 - Thermometers'],
        'Class II': []
      },
      requirements: {
        'electrical_safety': 'IEC 60601-1 for powered devices',
        'mechanical_safety': 'Stability and strength testing',
        'clinical_validation': 'Accuracy studies for measurement devices'
      }
    },
    '882': { 
      description: 'Neurological Devices',
      keywords: ['neuro', 'brain', 'nerve', 'spinal', 'stimulator', 'electrode', 'eeg'],
      exemptions: {
        'Class I': ['882.1040 - Basic neurological tools'],
        'Class II': []
      },
      requirements: {
        'electrical_safety': 'IEC 60601-1 compliance',
        'biocompatibility': 'ISO 10993 for neural contact',
        'clinical_studies': 'Neurological safety and efficacy',
        'electromagnetic_compatibility': 'EMC testing critical'
      }
    },
    '884': { 
      description: 'Obstetrical and Gynecological Devices',
      keywords: ['obstetric', 'gynecological', 'pregnancy', 'fetal', 'contraceptive'],
      exemptions: {
        'Class I': ['884.1040 - Basic OB/GYN tools'],
        'Class II': []
      },
      requirements: {
        'biocompatibility': 'ISO 10993 for intimate contact',
        'clinical_studies': 'Safety during pregnancy',
        'sterility': 'Sterility validation for invasive devices'
      }
    },
    '886': { 
      description: 'Ophthalmic Devices',
      keywords: ['eye', 'ophthalmic', 'vision', 'lens', 'contact', 'retina', 'glaucoma'],
      exemptions: {
        'Class I': ['886.1040 - Basic eye tools', '886.1050 - Reading glasses'],
        'Class II': []
      },
      requirements: {
        'biocompatibility': 'ISO 10993 for ocular contact',
        'optical_properties': 'Optical quality testing',
        'clinical_studies': 'Vision improvement validation'
      }
    },
    '888': { 
      description: 'Orthopedic Devices',
      keywords: ['orthopedic', 'bone', 'joint', 'hip', 'knee', 'spine', 'fracture'],
      exemptions: {
        'Class I': ['888.1100 - Basic orthopedic tools'],
        'Class II': ['888.3027 - Some external fixators']
      },
      requirements: {
        'biocompatibility': 'ISO 10993 comprehensive testing',
        'mechanical_testing': 'Fatigue and wear testing',
        'clinical_studies': 'Long-term implant performance',
        'material_characterization': 'Complete material analysis'
      }
    },
    '890': { 
      description: 'Physical Medicine Devices',
      keywords: ['physical', 'rehabilitation', 'therapy', 'exercise', 'mobility'],
      exemptions: {
        'Class I': ['890.1040 - Exercise equipment', '890.1050 - Mobility aids'],
        'Class II': []
      },
      requirements: {
        'mechanical_safety': 'Stability and strength testing',
        'clinical_validation': 'Therapeutic effectiveness studies',
        'electrical_safety': 'IEC 60601-1 for powered devices'
      }
    }
//./ ADD *("...
// ]")
  }
  const applicableParts = [];
  const searchText = searchTerm.toLowerCase();
  
  // Enhanced keyword matching with exemption and requirement analysis
  Object.entries(partMapping).forEach(([part, info]) => {
    const score = info.keywords.filter(keyword => 
      searchText.includes(keyword) || keyword.includes(searchText)
    ).length;
    
    if (score > 0) {
      applicableParts.push({
        part,
        description: info.description,
        relevanceScore: score,
        matchType: 'keyword',
        exemptions: info.exemptions,
        requirements: info.requirements
      });
    }
  });

  // Enhanced FDA data analysis for regulation numbers
  Object.values(fdaData).forEach(dataset => {
    if (dataset.results) {
      dataset.results.forEach(item => {
        const regNumber = item.regulation_number || item.openfda?.regulation_number;
        if (regNumber) {
          const part = regNumber.split('.')[0];
          if (partMapping[part] && !applicableParts.find(p => p.part === part)) {
            applicableParts.push({
              part,
              description: partMapping[part].description,
              relevanceScore: 10,
              matchType: 'regulation',
              regulationNumber: regNumber,
              exemptions: partMapping[part].exemptions,
              requirements: partMapping[part].requirements
            });
          }
        }
      });
    }
  });

  return applicableParts.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
}

// 2. REPLACE your existing generateCFRRecommendations function
function generateCFRRecommendations(applicableParts, fdaData) {
  const recommendations = [];
  
  if (applicableParts.length === 0) {
    recommendations.push('No specific CFR parts identified - device may be unregulated or require manual review');
    return recommendations;
  }

  const primaryPart = applicableParts[0];
  recommendations.push(`Primary regulatory focus: 21 CFR Part ${primaryPart.part} - ${primaryPart.description}`);

  // Enhanced device class analysis with specific exemption guidance
  const deviceClasses = new Set();
  Object.values(fdaData).forEach(dataset => {
    if (dataset.results) {
      dataset.results.forEach(item => {
        if (item.device_class) deviceClasses.add(item.device_class);
        if (item.openfda?.device_class) deviceClasses.add(item.openfda.device_class);
      });
    }
  });

  // Detailed class-specific recommendations with exemptions
  if (deviceClasses.has('III') || deviceClasses.has('3')) {
    recommendations.push('**Class III Device - PMA Required**');
    recommendations.push('• PMA Application with clinical studies required');
    recommendations.push('• Estimated timeline: 180-320 days');
    recommendations.push('• Estimated costs: $365,657 (standard) / $91,414 (small business)');
    recommendations.push('• No exemptions available for Class III devices');
  }
  
  if (deviceClasses.has('II') || deviceClasses.has('2')) {
    recommendations.push('**Class II Device - 510(k) Typically Required**');
    recommendations.push('• 510(k) Premarket Notification required unless exempt');
    recommendations.push('• Estimated timeline: 90-180 days');
    recommendations.push('• Estimated costs: $12,432 (standard) / $3,108 (small business)');
    
    // Check for Class II exemptions
    if (primaryPart.exemptions && primaryPart.exemptions['Class II']) {
      recommendations.push('• **Potential Class II Exemptions:**');
      primaryPart.exemptions['Class II'].forEach(exemption => {
        recommendations.push(`  - ${exemption}`);
      });
    }
  }
  
  if (deviceClasses.has('I') || deviceClasses.has('1')) {
    recommendations.push('**Class I Device - Minimal FDA Oversight**');
    recommendations.push('• General controls apply');
    recommendations.push('• Device listing and establishment registration required');
    
    // Check for Class I exemptions
    if (primaryPart.exemptions && primaryPart.exemptions['Class I']) {
      recommendations.push('• **Class I Exemptions Available:**');
      primaryPart.exemptions['Class I'].forEach(exemption => {
        recommendations.push(`  - ${exemption}`);
      });
      recommendations.push('• **If exempt: No 510(k) required, minimal costs**');
    } else {
      recommendations.push('• 510(k) may be required if no exemptions apply');
    }
  }

  // Special requirements analysis
  if (primaryPart.requirements) {
    recommendations.push('**Special Requirements for this CFR Part:**');
    Object.entries(primaryPart.requirements).forEach(([key, value]) => {
      recommendations.push(`• ${key.replace('_', ' ').toUpperCase()}: ${value}`);
    });
  }

  // Multiple parts handling
  if (applicableParts.length > 1) {
    recommendations.push(`**Additional CFR Parts to Consider:**`);
    applicableParts.slice(1).forEach(part => {
      recommendations.push(`• 21 CFR Part ${part.part}: ${part.description}`);
    });
  }

  return recommendations;
}

// 3. NEW FUNCTION: Enhanced exemption analysis
function analyzeDeviceExemptions(productCode, deviceClass, cfrPart, regulationNumber) {
  const exemptionAnalysis = {
    productCode,
    deviceClass,
    cfrPart,
    regulationNumber,
    exemptionStatus: 'Unknown',
    exemptionDetails: [],
    requirements: [],
    estimatedPath: 'Unknown',
    estimatedTimeline: 'Unknown',
    estimatedCosts: 'Unknown'
  };

  // Class-specific exemption analysis
  switch (deviceClass) {
    case 'I':
      exemptionAnalysis.exemptionStatus = 'Potentially Exempt';
      exemptionAnalysis.exemptionDetails = [
        'Most Class I devices are exempt from 510(k)',
        'Must still comply with general controls',
        'Device listing and establishment registration required',
        'Cannot make therapeutic claims beyond intended use'
      ];
      exemptionAnalysis.requirements = [
        'General Controls (21 CFR 820)',
        'Device Listing',
        'Establishment Registration',
        'Labeling Requirements'
      ];
      exemptionAnalysis.estimatedPath = 'Direct Marketing (if exempt)';
      exemptionAnalysis.estimatedTimeline = '30-60 days';
      exemptionAnalysis.estimatedCosts = '$0-$1,000';
      break;

    case 'II':
      exemptionAnalysis.exemptionStatus = 'Limited Exemptions';
      exemptionAnalysis.exemptionDetails = [
        'Most Class II devices require 510(k)',
        'Some specific devices have exemptions',
        'Must comply with general and special controls',
        'Predicate device identification required'
      ];
      exemptionAnalysis.requirements = [
        'General Controls',
        'Special Controls',
        '510(k) Premarket Notification (unless exempt)',
        'Quality System Regulation (QSR)'
      ];
      exemptionAnalysis.estimatedPath = '510(k) Clearance';
      exemptionAnalysis.estimatedTimeline = '90-180 days';
      exemptionAnalysis.estimatedCosts = '$12,432 (standard) / $3,108 (small business)';
      break;

    case 'III':
      exemptionAnalysis.exemptionStatus = 'No Exemptions';
      exemptionAnalysis.exemptionDetails = [
        'All Class III devices require PMA',
        'Extensive clinical studies required',
        'Highest level of regulatory oversight',
        'Advisory panel review may be required'
      ];
      exemptionAnalysis.requirements = [
        'General Controls',
        'PMA Application',
        'Clinical Studies',
        'Manufacturing Information',
        'Risk Analysis',
        'Quality System Regulation (QSR)'
      ];
      exemptionAnalysis.estimatedPath = 'PMA Approval';
      exemptionAnalysis.estimatedTimeline = '180-320 days';
      exemptionAnalysis.estimatedCosts = '$365,657 (standard) / $91,414 (small business)';
      break;
  }

  return exemptionAnalysis;
}

// 4. NEW FUNCTION: Generate regulatory pathway recommendation
function generateRegulatoryPathwayRecommendation(fdaData, cfrParts) {
  const pathway = {
    recommendedPath: 'Unknown',
    confidence: 'Low',
    reasoning: [],
    alternatives: [],
    nextSteps: [],
    timeline: 'Unknown',
    costs: 'Unknown',
    risks: []
  };

  if (cfrParts.length === 0) {
    pathway.recommendedPath = 'Manual Review Required';
    pathway.reasoning.push('No specific CFR parts identified');
    pathway.nextSteps.push('Consult with regulatory expert');
    return pathway;
  }

  const primaryPart = cfrParts[0];
  const deviceClasses = extractDeviceClasses(fdaData);

  // Determine primary pathway based on device class
  if (deviceClasses.includes('III') || deviceClasses.includes('3')) {
    pathway.recommendedPath = 'PMA (Premarket Approval)';
    pathway.confidence = 'High';
    pathway.reasoning.push('Class III device requires PMA');
    pathway.timeline = '180-320 days';
    pathway.costs = '$365,657 (standard) / $91,414 (small business)';
    pathway.nextSteps = [
      'Develop comprehensive clinical study protocol',
      'Conduct clinical trials',
      'Prepare PMA application with all required sections',
      'Consider pre-submission meeting with FDA'
    ];
    pathway.risks = [
      'Clinical study delays',
      'FDA questions requiring additional data',
      'Potential advisory panel review'
    ];
  } else if (deviceClasses.includes('II') || deviceClasses.includes('2')) {
    pathway.recommendedPath = '510(k) Clearance';
    pathway.confidence = 'High';
    pathway.reasoning.push('Class II device typically requires 510(k)');
    pathway.timeline = '90-180 days';
    pathway.costs = '$12,432 (standard) / $3,108 (small business)';
    
    // Check for potential exemptions
    if (primaryPart.exemptions && primaryPart.exemptions['Class II']) {
      pathway.alternatives.push('Exemption Analysis - some Class II devices may be exempt');
    }
    
    pathway.nextSteps = [
      'Identify appropriate predicate device',
      'Conduct substantial equivalence comparison',
      'Prepare 510(k) submission',
      'Consider pre-submission meeting for novel devices'
    ];
    pathway.risks = [
      'No suitable predicate device available',
      'FDA questions requiring additional testing',
      'Potential reclassification to Class III'
    ];
  } else if (deviceClasses.includes('I') || deviceClasses.includes('1')) {
    pathway.recommendedPath = 'Direct Marketing (if exempt)';
    pathway.confidence = 'Medium';
    pathway.reasoning.push('Class I device likely exempt from 510(k)');
    pathway.timeline = '30-60 days';
    pathway.costs = '$0-$1,000';
    
    pathway.alternatives.push('510(k) submission if not exempt');
    
    pathway.nextSteps = [
      'Verify exemption status',
      'Complete device listing and establishment registration',
      'Ensure compliance with general controls',
      'Prepare appropriate labeling'
    ];
    pathway.risks = [
      'Exemption status unclear',
      'General controls compliance issues',
      'Labeling requirements not met'
    ];
  }

  return pathway;
}

// 5. NEW FUNCTION: Extract device classes helper
function extractDeviceClasses(fdaData) {
  const deviceClasses = new Set();
  
  Object.values(fdaData).forEach(dataset => {
    if (dataset.results) {
      dataset.results.forEach(item => {
        if (item.device_class) deviceClasses.add(item.device_class);
        if (item.openfda?.device_class) deviceClasses.add(item.openfda.device_class);
      });
    }
  });
  
  return Array.from(deviceClasses);
}

// 6. NEW FUNCTION: Generate comprehensive device requirements
function generateDeviceRequirements(cfrPart, deviceClass, regulationNumber) {
  const requirements = {
    general: [],
    specific: [],
    testing: [],
    documentation: [],
    timeline: 'Unknown',
    costs: 'Unknown'
  };

  // General requirements based on device class
  switch (deviceClass) {
    case 'I':
      requirements.general = [
        'General Controls (21 CFR 820)',
        'Device Listing',
        'Establishment Registration',
        'Labeling Requirements (21 CFR 801)'
      ];
      requirements.timeline = '30-60 days (if exempt)';
      requirements.costs = '$0-$1,000';
      break;

    case 'II':
      requirements.general = [
        'General Controls',
        'Special Controls',
        '510(k) Premarket Notification',
        'Quality System Regulation (QSR)',
        'Medical Device Reporting (MDR)'
      ];
      requirements.timeline = '90-180 days';
      requirements.costs = '$12,432 (standard) / $3,108 (small business)';
      break;

    case 'III':
      requirements.general = [
        'General Controls',
        'PMA Application',
        'Clinical Studies',
        'Quality System Regulation (QSR)',
        'Medical Device Reporting (MDR)'
      ];
      requirements.timeline = '180-320 days';
      requirements.costs = '$365,657 (standard) / $91,414 (small business)';
      break;
  }

  // CFR-specific requirements
  const cfrRequirements = {
    '862': {
      specific: ['Clinical validation studies', 'Analytical performance testing'],
      testing: ['Accuracy studies', 'Precision studies', 'Interference testing', 'Stability testing'],
      documentation: ['Clinical study reports', 'Analytical validation reports']
    },
    '870': {
      specific: ['Biocompatibility testing', 'Electrical safety testing'],
      testing: ['ISO 10993 biological evaluation', 'IEC 60601-1 electrical safety', 'EMC testing'],
      documentation: ['Biocompatibility reports', 'Electrical safety reports']
    },
    '888': {
      specific: ['Biocompatibility testing', 'Mechanical testing'],
      testing: ['ISO 10993 testing', 'Fatigue testing', 'Wear testing', 'Corrosion testing'],
      documentation: ['Material characterization', 'Mechanical test reports']
    }
  };

  if (cfrRequirements[cfrPart]) {
    requirements.specific = cfrRequirements[cfrPart].specific;
    requirements.testing = cfrRequirements[cfrPart].testing;
    requirements.documentation = cfrRequirements[cfrPart].documentation;
  }

  return requirements;
}
// Generate CFR recommendations
// function generateCFRRecommendations(applicableParts, fdaData) {
//   const recommendations = [];
  
//   if (applicableParts.length === 0) {
//     recommendations.push('No specific CFR parts identified - device may be unregulated or require manual review');
//     return recommendations;
//   }

//   // Primary CFR part recommendation
//   const primaryPart = applicableParts[0];
//   recommendations.push(`Primary regulatory focus: 21 CFR Part ${primaryPart.part} - ${primaryPart.description}`);

//   // Multiple parts handling
//   if (applicableParts.length > 1) {
//     recommendations.push(`Multiple CFR parts may apply - review all ${applicableParts.length} identified parts for complete compliance`);
//   }

//   // Device class specific recommendations
//   const deviceClasses = new Set();
//   Object.values(fdaData).forEach(dataset => {
//     if (dataset.results) {
//       dataset.results.forEach(item => {
//         if (item.device_class) deviceClasses.add(item.device_class);
//         if (item.openfda?.device_class) deviceClasses.add(item.openfda.device_class);
//       });
//     }
//   });

//   if (deviceClasses.has('III') || deviceClasses.has('3')) {
//     recommendations.push('Class III device identified - PMA pathway likely required with extensive clinical data');
//   } else if (deviceClasses.has('II') || deviceClasses.has('2')) {
//     recommendations.push('Class II device identified - 510(k) pathway typically required unless exempt');
//   } else if (deviceClasses.has('I') || deviceClasses.has('1')) {
//     recommendations.push('Class I device identified - minimal FDA oversight, may be exempt from 510(k)');
//   }

//   return recommendations;
// }

// Search by company name endpoint
router.get('/company-intelligence', async (req, res) => {
  try {
    const { q: companyName } = req.query;
    
    if (!companyName) {
      return res.status(400).json({ error: 'Company name (q) is required' });
    }

    console.log(`Company intelligence search for: ${companyName}`);
    
    // Get FDA data for company
    const fdaData = await getAllFDAData(companyName, 'company');
    
    // Generate company-specific insights
    const companyInsights = generateCompanyInsights(fdaData, companyName);
    
    res.json({
      companyName,
      timestamp: new Date().toISOString(),
      insights: companyInsights,
      fdaData,
      summary: generateCompanySummary(companyInsights, fdaData)
    });

  } catch (error) {
    console.error('Company intelligence search error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Generate company-specific insights
function generateCompanyInsights(fdaData, companyName) {
  const insights = {
    devicePortfolio: {
      total: 0,
      by510k: 0,
      byPMA: 0,
      deviceTypes: new Set(),
      productCodes: new Set(),
      deviceClasses: new Set()
    },
    facilities: new Set(),
    subsidiaries: new Set(),
    regulatoryHistory: {
      first510k: null,
      firstPMA: null,
      recentActivity: []
    },
    safetyProfile: {
      recalls: 0,
      adverseEvents: 0,
      riskAssessment: 'Unknown'
    },
    marketPresence: {
      activeClearances: 0,
      registeredFacilities: 0,
      medicalSpecialties: new Set()
    }
  };

  // Analyze 510(k) data
  if (fdaData.fiveOneOk?.results) {
    fdaData.fiveOneOk.results.forEach(device => {
      insights.devicePortfolio.by510k++;
      if (device.device_name) insights.devicePortfolio.deviceTypes.add(device.device_name);
      if (device.product_code) insights.devicePortfolio.productCodes.add(device.product_code);
      if (device.device_class) insights.devicePortfolio.deviceClasses.add(device.device_class);
      if (device.applicant) insights.subsidiaries.add(device.applicant);
      
      // Track regulatory history
      if (device.decision_date) {
        const date = new Date(device.decision_date);
        if (!insights.regulatoryHistory.first510k || date < new Date(insights.regulatoryHistory.first510k)) {
          insights.regulatoryHistory.first510k = device.decision_date;
        }
        
        insights.regulatoryHistory.recentActivity.push({
          date: device.decision_date,
          type: '510(k)',
          device: device.device_name,
          kNumber: device.k_number,
          decision: device.decision_description
        });
      }
    });
  }

  // Analyze PMA data
  if (fdaData.pma?.results) {
    fdaData.pma.results.forEach(device => {
      insights.devicePortfolio.byPMA++;
      if (device.trade_name) insights.devicePortfolio.deviceTypes.add(device.trade_name);
      if (device.generic_name) insights.devicePortfolio.deviceTypes.add(device.generic_name);
      if (device.product_code) insights.devicePortfolio.productCodes.add(device.product_code);
      if (device.applicant) insights.subsidiaries.add(device.applicant);
      
      // Track regulatory history
      if (device.decision_date) {
        const date = new Date(device.decision_date);
        if (!insights.regulatoryHistory.firstPMA || date < new Date(insights.regulatoryHistory.firstPMA)) {
          insights.regulatoryHistory.firstPMA = device.decision_date;
        }
        
        insights.regulatoryHistory.recentActivity.push({
          date: device.decision_date,
          type: 'PMA',
          device: device.trade_name || device.generic_name,
          pmaNumber: device.pma_number,
          decision: device.decision_description
        });
      }
    });
  }

  // Analyze registrations for facilities
  if (fdaData.registrations?.results) {
    fdaData.registrations.results.forEach(reg => {
      if (reg.establishment_name) insights.facilities.add(reg.establishment_name);
      insights.marketPresence.registeredFacilities++;
      
      // Extract medical specialties from products
      if (reg.products) {
        reg.products.forEach(product => {
          if (product.openfda?.medical_specialty_description) {
            insights.marketPresence.medicalSpecialties.add(product.openfda.medical_specialty_description);
          }
        });
      }
    });
  }

  // Analyze safety data
  if (fdaData.recalls?.results) {
    insights.safetyProfile.recalls = fdaData.recalls.results.length;
  }
  
  if (fdaData.adverseEvents?.results) {
    insights.safetyProfile.adverseEvents = fdaData.adverseEvents.results.length;
  }

  // Calculate totals
  insights.devicePortfolio.total = insights.devicePortfolio.by510k + insights.devicePortfolio.byPMA;
  insights.marketPresence.activeClearances = insights.devicePortfolio.total;

  // Risk assessment
  if (insights.safetyProfile.recalls > 10 || insights.safetyProfile.adverseEvents > 20) {
    insights.safetyProfile.riskAssessment = 'High';
  } else if (insights.safetyProfile.recalls > 0 || insights.safetyProfile.adverseEvents > 0) {
    insights.safetyProfile.riskAssessment = 'Medium';
  } else {
    insights.safetyProfile.riskAssessment = 'Low';
  }

  // Sort recent activity by date
  insights.regulatoryHistory.recentActivity.sort((a, b) => new Date(b.date) - new Date(a.date));
  insights.regulatoryHistory.recentActivity = insights.regulatoryHistory.recentActivity.slice(0, 10);

  // Convert sets to arrays
  insights.devicePortfolio.deviceTypes = Array.from(insights.devicePortfolio.deviceTypes);
  insights.devicePortfolio.productCodes = Array.from(insights.devicePortfolio.productCodes);
  insights.devicePortfolio.deviceClasses = Array.from(insights.devicePortfolio.deviceClasses);
  insights.facilities = Array.from(insights.facilities);
  insights.subsidiaries = Array.from(insights.subsidiaries);
  insights.marketPresence.medicalSpecialties = Array.from(insights.marketPresence.medicalSpecialties);

  return insights;
}

// Generate company summary
function generateCompanySummary(insights, fdaData) {
  return {
    totalDevices: insights.devicePortfolio.total,
    primaryPathway: insights.devicePortfolio.by510k > insights.devicePortfolio.byPMA ? '510(k)' : 'PMA',
    deviceClasses: insights.devicePortfolio.deviceClasses,
    safetyProfile: insights.safetyProfile.riskAssessment,
    marketPresence: insights.marketPresence.medicalSpecialties.length,
    regulatoryComplexity: insights.devicePortfolio.total > 50 ? 'High' : 
                         insights.devicePortfolio.total > 10 ? 'Medium' : 'Low'
  };
}

module.exports = router;
// const express = require('express');
// const axios = require('axios');
// const cheerio = require('cheerio');

// const router = express.Router();

// // API endpoints
// const FDA_BASE_URL = 'https://api.fda.gov/device';
// const ECFR_BASE_URL = 'https://www.ecfr.gov/api/versioner/v1/full';
// const FEDERAL_REGISTER_URL = 'https://www.federalregister.gov/api/v1/articles';

// // Helper function for FDA API requests
// async function fdaRequest(endpoint, params = {}) {
//   try {
//     const response = await axios.get(`${FDA_BASE_URL}${endpoint}`, {
//       params: { limit: 100, ...params },
//       timeout: 10000
//     });
//     return response.data;
//   } catch (error) {
//     console.error(`Error fetching from ${endpoint}:`, error.message);
//     return { results: [], error: error.message };
//   }
// }

// // Enhanced helper function for FDA API requests with pagination
// async function fdaRequestWithPagination(endpoint, params = {}, maxResults = 1000) {
//   try {
//     const allResults = [];
//     let skip = 0;
//     const limit = 100;
//     let hasMoreData = true;
    
//     console.log(`Fetching paginated data from ${endpoint}...`);
    
//     while (hasMoreData && allResults.length < maxResults) {
//       const requestParams = {
//         limit,
//         skip,
//         ...params
//       };
      
//       const response = await axios.get(`${FDA_BASE_URL}${endpoint}`, {
//         params: requestParams,
//         timeout: 15000
//       });
      
//       const data = response.data;
      
//       if (data.results && data.results.length > 0) {
//         allResults.push(...data.results);
//         skip += limit;
        
//         if (data.results.length < limit || 
//             (data.meta?.results?.total && allResults.length >= data.meta.results.total)) {
//           hasMoreData = false;
//         }
        
//         await new Promise(resolve => setTimeout(resolve, 100));
//       } else {
//         hasMoreData = false;
//       }
//     }
    
//     console.log(`Fetched ${allResults.length} total results from ${endpoint}`);
    
//     return {
//       results: allResults,
//       meta: {
//         totalFetched: allResults.length,
//         disclaimer: 'Results fetched with pagination'
//       }
//     };
    
//   } catch (error) {
//     console.error(`Error fetching paginated data from ${endpoint}:`, error.message);
//     return { 
//       results: [], 
//       error: error.message,
//       meta: { totalFetched: 0 }
//     };
//   }
// }

// // Smart search term analysis with company/device distinction
// function analyzeSearchTerm(searchTerm, searchMode = 'auto') {
//   const term = searchTerm.toLowerCase().trim();
  
//   // If mode is explicitly set, use it
//   if (searchMode === 'company') {
//     return {
//       type: 'company',
//       mode: 'company',
//       searchStrategies: [
//         { endpoint: '510k', field: 'applicant', value: searchTerm },
//         { endpoint: 'pma', field: 'applicant', value: searchTerm },
//         { endpoint: 'registrationlisting', field: 'establishment_name', value: searchTerm },
//         { endpoint: 'recall', field: 'recalling_firm', value: searchTerm },
//         { endpoint: 'event', field: 'manufacturer_name', value: searchTerm },
//         { endpoint: 'udi', field: 'company_name', value: searchTerm }
//       ]
//     };
//   }
  
//   if (searchMode === 'device') {
//     return {
//       type: 'device',
//       mode: 'device',
//       searchStrategies: [
//         { endpoint: '510k', field: 'device_name', value: searchTerm },
//         { endpoint: 'pma', field: 'trade_name', value: searchTerm },
//         { endpoint: 'classification', field: 'device_name', value: searchTerm },
//         { endpoint: 'recall', field: 'product_description', value: searchTerm },
//         { endpoint: 'event', field: 'device.device_name', value: searchTerm },
//         { endpoint: 'udi', field: 'device_description', value: searchTerm }
//       ]
//     };
//   }
  
//   // Auto-detection logic
//   // K-number pattern
//   if (/^k\d{6}$/i.test(term)) {
//     return {
//       type: 'k-number',
//       mode: 'device',
//       searchStrategies: [
//         { endpoint: '510k', field: 'k_number', value: searchTerm.toUpperCase() },
//         { endpoint: 'classification', field: 'k_number', value: searchTerm.toUpperCase() },
//         { endpoint: 'recall', field: 'k_numbers', value: searchTerm.toUpperCase() }
//       ]
//     };
//   }
  
//   // PMA number pattern
//   if (/^p\d{6}$/i.test(term)) {
//     return {
//       type: 'pma-number',
//       mode: 'device',
//       searchStrategies: [
//         { endpoint: 'pma', field: 'pma_number', value: searchTerm.toUpperCase() },
//         { endpoint: 'recall', field: 'pma_numbers', value: searchTerm.toUpperCase() }
//       ]
//     };
//   }
  
//   // Company indicators
//   const companyIndicators = ['inc', 'corp', 'ltd', 'llc', 'co', 'company', 'corporation', 'medical', 'healthcare', 'pharma', 'medtronic', 'abbott', 'pfizer', 'johnson', 'boston scientific'];
//   const isCompany = companyIndicators.some(indicator => term.includes(indicator));
  
//   if (isCompany) {
//     return {
//       type: 'company',
//       mode: 'company',
//       searchStrategies: [
//         { endpoint: '510k', field: 'applicant', value: searchTerm },
//         { endpoint: 'pma', field: 'applicant', value: searchTerm },
//         { endpoint: 'registrationlisting', field: 'establishment_name', value: searchTerm },
//         { endpoint: 'recall', field: 'recalling_firm', value: searchTerm },
//         { endpoint: 'event', field: 'manufacturer_name', value: searchTerm },
//         { endpoint: 'udi', field: 'company_name', value: searchTerm }
//       ]
//     };
//   }
  
//   // Default to device
//   return {
//     type: 'device',
//     mode: 'device',
//     searchStrategies: [
//       { endpoint: '510k', field: 'device_name', value: searchTerm },
//       { endpoint: 'pma', field: 'trade_name', value: searchTerm },
//       { endpoint: 'classification', field: 'device_name', value: searchTerm },
//       { endpoint: 'recall', field: 'product_description', value: searchTerm },
//       { endpoint: 'event', field: 'device.device_name', value: searchTerm },
//       { endpoint: 'udi', field: 'device_description', value: searchTerm }
//     ]
//   };
// }

// // Enhanced search functions with better error handling
// async function smartSearch510k(searchTerm, analysis) {
//   const strategies = analysis.searchStrategies.filter(s => s.endpoint === '510k');
  
//   if (strategies.length === 0) {
//     const searchFields = [
//       `device_name:"${searchTerm}"`,
//       `applicant:"${searchTerm}"`,
//       `k_number:"${searchTerm}"`
//     ];
//     const search = searchFields.join(' OR ');
//     return await fdaRequestWithPagination('/510k.json', { search }, 1000);
//   }
  
//   for (const strategy of strategies) {
//     try {
//       const result = await fdaRequestWithPagination('/510k.json', { 
//         search: `${strategy.field}:"${strategy.value}"` 
//       }, 1000);
      
//       if (result.results && result.results.length > 0) {
//         return result;
//       }
//     } catch (error) {
//       console.log(`510k strategy failed for ${strategy.field}: ${error.message}`);
//     }
//   }
  
//   // Fallback search
//   return await fdaRequestWithPagination('/510k.json', { 
//     search: `device_name:"${searchTerm}" OR applicant:"${searchTerm}"` 
//   }, 1000);
// }

// async function smartSearchPMA(searchTerm, analysis) {
//   const strategies = analysis.searchStrategies.filter(s => s.endpoint === 'pma');
  
//   if (strategies.length === 0) {
//     const searchFields = [
//       `generic_name:"${searchTerm}"`,
//       `trade_name:"${searchTerm}"`,
//       `applicant:"${searchTerm}"`
//     ];
//     const search = searchFields.join(' OR ');
//     return await fdaRequestWithPagination('/pma.json', { search }, 1000);
//   }
  
//   for (const strategy of strategies) {
//     try {
//       const result = await fdaRequestWithPagination('/pma.json', { 
//         search: `${strategy.field}:"${strategy.value}"` 
//       }, 1000);
      
//       if (result.results && result.results.length > 0) {
//         return result;
//       }
//     } catch (error) {
//       console.log(`PMA strategy failed for ${strategy.field}: ${error.message}`);
//     }
//   }
  
//   return await fdaRequestWithPagination('/pma.json', { 
//     search: `trade_name:"${searchTerm}" OR applicant:"${searchTerm}"` 
//   }, 1000);
// }

// async function smartSearchClassification(searchTerm, analysis) {
//   try {
//     const strategies = analysis.searchStrategies.filter(s => s.endpoint === 'classification');
    
//     if (strategies.length === 0) {
//       const searchFields = [
//         `device_name:"${searchTerm}"`,
//         `medical_specialty_description:"${searchTerm}"`,
//         `product_code:"${searchTerm}"`
//       ];
//       const search = searchFields.join(' OR ');
//       return await fdaRequestWithPagination('/classification.json', { search }, 1000);
//     }
    
//     for (const strategy of strategies) {
//       try {
//         const result = await fdaRequestWithPagination('/classification.json', { 
//           search: `${strategy.field}:"${strategy.value}"` 
//         }, 1000);
        
//         if (result.results && result.results.length > 0) {
//           return result;
//         }
//       } catch (error) {
//         console.log(`Classification strategy failed for ${strategy.field}: ${error.message}`);
//       }
//     }
    
//     // Fallback search
//     return await fdaRequestWithPagination('/classification.json', { 
//       search: `device_name:"${searchTerm}"` 
//     }, 1000);
    
//   } catch (error) {
//     console.error(`Classification search error: ${error.message}`);
//     return { 
//       results: [], 
//       error: `Classification search failed: ${error.message}`,
//       meta: { totalFetched: 0 }
//     };
//   }
// }

// async function smartSearchRecalls(searchTerm, analysis) {
//   const strategies = analysis.searchStrategies.filter(s => s.endpoint === 'recall');
  
//   if (strategies.length === 0) {
//     const searchFields = [
//       `product_description:"${searchTerm}"`,
//       `recalling_firm:"${searchTerm}"`
//     ];
//     const search = searchFields.join(' OR ');
//     return await fdaRequestWithPagination('/recall.json', { search }, 1000);
//   }
  
//   for (const strategy of strategies) {
//     try {
//       const result = await fdaRequestWithPagination('/recall.json', { 
//         search: `${strategy.field}:"${strategy.value}"` 
//       }, 1000);
      
//       if (result.results && result.results.length > 0) {
//         return result;
//       }
//     } catch (error) {
//       console.log(`Recall strategy failed for ${strategy.field}: ${error.message}`);
//     }
//   }
  
//   return await fdaRequestWithPagination('/recall.json', { 
//     search: `product_description:"${searchTerm}" OR recalling_firm:"${searchTerm}"` 
//   }, 1000);
// }

// async function smartSearchAdverseEvents(searchTerm, analysis) {
//   const strategies = analysis.searchStrategies.filter(s => s.endpoint === 'event');
  
//   if (strategies.length === 0) {
//     const searchFields = [
//       `device.generic_name:"${searchTerm}"`,
//       `device.brand_name:"${searchTerm}"`,
//       `manufacturer_name:"${searchTerm}"`
//     ];
//     const search = searchFields.join(' OR ');
//     return await fdaRequestWithPagination('/event.json', { search }, 1000);
//   }
  
//   for (const strategy of strategies) {
//     try {
//       const result = await fdaRequestWithPagination('/event.json', { 
//         search: `${strategy.field}:"${strategy.value}"` 
//       }, 1000);
      
//       if (result.results && result.results.length > 0) {
//         return result;
//       }
//     } catch (error) {
//       console.log(`Adverse event strategy failed for ${strategy.field}: ${error.message}`);
//     }
//   }
  
//   return await fdaRequestWithPagination('/event.json', { 
//     search: `device.generic_name:"${searchTerm}" OR manufacturer_name:"${searchTerm}"` 
//   }, 1000);
// }

// async function smartSearchRegistrations(searchTerm, analysis) {
//   const strategies = analysis.searchStrategies.filter(s => s.endpoint === 'registrationlisting');
  
//   if (strategies.length === 0) {
//     const searchFields = [
//       `establishment_name:"${searchTerm}"`,
//       `products.openfda.device_name:"${searchTerm}"`
//     ];
//     const search = searchFields.join(' OR ');
//     return await fdaRequestWithPagination('/registrationlisting.json', { search }, 1000);
//   }
  
//   for (const strategy of strategies) {
//     try {
//       const result = await fdaRequestWithPagination('/registrationlisting.json', { 
//         search: `${strategy.field}:"${strategy.value}"` 
//       }, 1000);
      
//       if (result.results && result.results.length > 0) {
//         return result;
//       }
//     } catch (error) {
//       console.log(`Registration strategy failed for ${strategy.field}: ${error.message}`);
//     }
//   }
  
//   return await fdaRequestWithPagination('/registrationlisting.json', { 
//     search: `establishment_name:"${searchTerm}"` 
//   }, 1000);
// }

// async function smartSearchUDI(searchTerm, analysis) {
//   const strategies = analysis.searchStrategies.filter(s => s.endpoint === 'udi');
  
//   if (strategies.length === 0) {
//     const searchFields = [
//       `device_description:"${searchTerm}"`,
//       `brand_name:"${searchTerm}"`,
//       `company_name:"${searchTerm}"`
//     ];
//     const search = searchFields.join(' OR ');
//     return await fdaRequestWithPagination('/udi.json', { search }, 1000);
//   }
  
//   for (const strategy of strategies) {
//     try {
//       const result = await fdaRequestWithPagination('/udi.json', { 
//         search: `${strategy.field}:"${strategy.value}"` 
//       }, 1000);
      
//       if (result.results && result.results.length > 0) {
//         return result;
//       }
//     } catch (error) {
//       console.log(`UDI strategy failed for ${strategy.field}: ${error.message}`);
//     }
//   }
  
//   return await fdaRequestWithPagination('/udi.json', { 
//     search: `device_description:"${searchTerm}" OR company_name:"${searchTerm}"` 
//   }, 1000);
// }

// async function smartSearchEnforcement(searchTerm, analysis) {
//   const searchFields = [
//     `product_description:"${searchTerm}"`,
//     `recalling_firm:"${searchTerm}"`
//   ];
//   const search = searchFields.join(' OR ');
//   return await fdaRequestWithPagination('/enforcement.json', { search }, 1000);
// }

// // Updated getAllFDAData function with search mode
// async function getAllFDAData(searchTerm, searchMode = 'auto', maxResults = 1000) {
//   console.log(`Smart FDA search for: ${searchTerm} (mode: ${searchMode}, max ${maxResults} per endpoint)`);
  
//   const searchAnalysis = analyzeSearchTerm(searchTerm, searchMode);
//   console.log(`Search type detected: ${searchAnalysis.type}, mode: ${searchAnalysis.mode}`);
  
//   const results = await Promise.allSettled([
//     smartSearch510k(searchTerm, searchAnalysis),
//     smartSearchPMA(searchTerm, searchAnalysis),
//     smartSearchRecalls(searchTerm, searchAnalysis),
//     smartSearchAdverseEvents(searchTerm, searchAnalysis),
//     smartSearchEnforcement(searchTerm, searchAnalysis),
//     smartSearchRegistrations(searchTerm, searchAnalysis),
//     smartSearchUDI(searchTerm, searchAnalysis),
//     smartSearchClassification(searchTerm, searchAnalysis)
//   ]);

//   const [
//     fiveOneOk,
//     pma,
//     recalls,
//     adverseEvents,
//     enforcement,
//     registrations,
//     udi,
//     classification
//   ] = results.map(result => {
//     if (result.status === 'fulfilled') {
//       return result.value;
//     } else {
//       console.error('FDA API call failed:', result.reason.message);
//       return { results: [], error: result.reason.message, meta: { totalFetched: 0 } };
//     }
//   });

//   const successfulEndpoints = [];
//   const failedEndpoints = [];
  
//   const endpointNames = ['510k', 'pma', 'recalls', 'adverseEvents', 'enforcement', 'registrations', 'udi', 'classification'];
//   const endpointResults = [fiveOneOk, pma, recalls, adverseEvents, enforcement, registrations, udi, classification];
  
//   let totalRecords = 0;
//   endpointResults.forEach((result, index) => {
//     const count = result.results?.length || 0;
//     totalRecords += count;
    
//     if (count > 0) {
//       successfulEndpoints.push(`${endpointNames[index]} (${count})`);
//     } else if (result.error) {
//       failedEndpoints.push(endpointNames[index]);
//     }
//   });
  
//   console.log(`FDA API Summary - Total Records: ${totalRecords}`);
//   console.log(`Successful: [${successfulEndpoints.join(', ')}]`);
//   if (failedEndpoints.length > 0) {
//     console.log(`Failed: [${failedEndpoints.join(', ')}]`);
//   }

//   return {
//     fiveOneOk,
//     pma,
//     recalls,
//     adverseEvents,
//     enforcement,
//     registrations,
//     udi,
//     classification,
//     _metadata: {
//       successfulEndpoints,
//       failedEndpoints,
//       totalEndpoints: endpointNames.length,
//       totalRecords,
//       maxResultsPerEndpoint: maxResults,
//       searchType: searchAnalysis.type,
//       searchMode: searchAnalysis.mode
//     }
//   };
// }

// // Enhanced profile creation for company vs device
// function createEnhancedProfile(searchTerm, fdaData, ecfrData, applicableParts, searchMode) {
//   const isCompanySearch = searchMode === 'company' || fdaData._metadata?.searchMode === 'company';
  
//   const profile = {
//     searchTerm,
//     searchType: fdaData._metadata?.searchType || 'unknown',
//     searchMode: fdaData._metadata?.searchMode || searchMode || 'device',
//     isCompanySearch,
//     overview: {
//       totalFDARecords: fdaData._metadata?.totalRecords || 0,
//       regulatoryComplexity: 'Unknown',
//       primaryClassification: isCompanySearch ? 'Multiple Devices' : 'Unknown',
//       marketStatus: 'Unknown'
//     },
//     regulatory: {
//       applicableParts: applicableParts?.length || 0,
//       deviceClasses: [],
//       pathways: [],
//       exemptions: [],
//       regulationNumbers: []
//     },
//     safety: {
//       recallCount: fdaData.recalls?.results?.length || 0,
//       adverseEventCount: fdaData.adverseEvents?.results?.length || 0,
//       riskLevel: 'Unknown'
//     },
//     market: {
//       active510k: fdaData.fiveOneOk?.results?.length || 0,
//       activePMA: fdaData.pma?.results?.length || 0,
//       currentRegistrations: fdaData.registrations?.results?.length || 0,
//       udiRecords: fdaData.udi?.results?.length || 0
//     },
//     recommendations: [],
//     keyRegulations: [],
//     companyInfo: {
//       manufacturers: [],
//       applicants: [],
//       facilities: [],
//       devicePortfolio: []
//     }
//   };

//   // Enhanced company information extraction
//   const companies = new Set();
//   const applicants = new Set();
//   const facilities = new Set();
//   const deviceTypes = new Set();
  
//   [fdaData.fiveOneOk, fdaData.pma, fdaData.registrations].forEach(dataset => {
//     if (dataset?.results) {
//       dataset.results.forEach(item => {
//         if (item.applicant) applicants.add(item.applicant);
//         if (item.company_name) companies.add(item.company_name);
//         if (item.establishment_name) facilities.add(item.establishment_name);
//         if (item.manufacturer_name) companies.add(item.manufacturer_name);
//         if (item.device_name) deviceTypes.add(item.device_name);
//         if (item.trade_name) deviceTypes.add(item.trade_name);
//         if (item.generic_name) deviceTypes.add(item.generic_name);
//       });
//     }
//   });
  
//   profile.companyInfo.manufacturers = Array.from(companies).slice(0, 10);
//   profile.companyInfo.applicants = Array.from(applicants).slice(0, 10);
//   profile.companyInfo.facilities = Array.from(facilities).slice(0, 10);
//   profile.companyInfo.devicePortfolio = Array.from(deviceTypes).slice(0, 15);

//   // Device classification analysis
//   const classLevels = new Set();
//   const regulationNumbers = new Set();
  
//   [fdaData.classification, fdaData.fiveOneOk, fdaData.pma].forEach(dataset => {
//     if (dataset?.results) {
//       dataset.results.forEach(item => {
//         if (item.device_class) classLevels.add(item.device_class);
//         if (item.openfda?.device_class) classLevels.add(item.openfda.device_class);
//         if (item.regulation_number) regulationNumbers.add(item.regulation_number);
//         if (item.openfda?.regulation_number) regulationNumbers.add(item.openfda.regulation_number);
//       });
//     }
//   });

//   profile.regulatory.deviceClasses = Array.from(classLevels);
//   profile.regulatory.regulationNumbers = Array.from(regulationNumbers);

//   // Different complexity analysis for companies vs devices
//   if (isCompanySearch) {
//     const deviceCount = profile.companyInfo.devicePortfolio.length;
//     const facilityCount = profile.companyInfo.facilities.length;
//     const hasMultipleClasses = classLevels.size > 1;
    
//     if (deviceCount > 10 || facilityCount > 5 || hasMultipleClasses) {
//       profile.overview.regulatoryComplexity = 'High';
//     } else if (deviceCount > 3 || facilityCount > 2) {
//       profile.overview.regulatoryComplexity = 'Medium';
//     } else if (deviceCount > 0) {
//       profile.overview.regulatoryComplexity = 'Low';
//     }
    
//     profile.overview.primaryClassification = classLevels.size > 1 ? 
//       `Multiple Classes (${Array.from(classLevels).join(', ')})` : 
//       classLevels.size === 1 ? `Primarily Class ${Array.from(classLevels)[0]}` : 'Various Devices';
//   } else {
//     // Device-specific analysis (existing logic)
//     const hasClassIII = classLevels.has('III') || classLevels.has('3');
//     const hasClassII = classLevels.has('II') || classLevels.has('2');
//     const hasClassI = classLevels.has('I') || classLevels.has('1');
    
//     if (hasClassIII) {
//       profile.overview.regulatoryComplexity = 'High';
//       profile.overview.primaryClassification = 'Class III';
//     } else if (hasClassII) {
//       profile.overview.regulatoryComplexity = 'Medium';
//       profile.overview.primaryClassification = 'Class II';
//     } else if (hasClassI) {
//       profile.overview.regulatoryComplexity = 'Low';
//       profile.overview.primaryClassification = 'Class I';
//     }
//   }

//   // Risk and pathway analysis
//   if (profile.safety.recallCount > 5 || profile.safety.adverseEventCount > 10) {
//     profile.safety.riskLevel = 'High';
//   } else if (profile.safety.recallCount > 0 || profile.safety.adverseEventCount > 0) {
//     profile.safety.riskLevel = 'Medium';
//   } else {
//     profile.safety.riskLevel = 'Low';
//   }

//   // Market status
//   if (profile.market.active510k > 0 || profile.market.activePMA > 0) {
//     profile.overview.marketStatus = isCompanySearch ? 'Active FDA Portfolio' : 'FDA Cleared/Approved';
//   } else if (profile.market.currentRegistrations > 0) {
//     profile.overview.marketStatus = 'Registered';
//   } else if (profile.overview.totalFDARecords > 0) {
//     profile.overview.marketStatus = 'Has FDA History';
//   }

//   // Generate recommendations
//   if (isCompanySearch) {
//     if (profile.companyInfo.devicePortfolio.length > 5) {
//       profile.recommendations.push('Large device portfolio - consider centralized regulatory strategy');
//     }
//     if (profile.companyInfo.facilities.length > 1) {
//       profile.recommendations.push('Multiple facilities - ensure consistent QSR compliance across sites');
//     }
//     if (profile.safety.riskLevel === 'High') {
//       profile.recommendations.push('High safety event profile - implement enhanced post-market surveillance');
//     }
//   } else {
//     if (classLevels.has('III')) {
//       profile.recommendations.push('PMA pathway required - plan 2-3+ years for approval');
//     } else if (classLevels.has('II')) {
//       profile.recommendations.push('510(k) clearance pathway - identify predicate devices');
//     }
//   }

//   return profile;
// }
// // Function to get eCFR regulation text
// async function getECFRRegulation(regulationNumber) {
//   try {
//     if (!regulationNumber) return null;
    
//     // Parse regulation number (e.g., "872.3200" -> title 21, part 872, section 3200)
//     const parts = regulationNumber.split('.');
//     if (parts.length !== 2) return null;
    
//     const part = parts[0];
//     const section = parts[1];
    
//     console.log(`Fetching eCFR regulation ${regulationNumber} (part ${part}, section ${section})`);
    
//     // Use the actual eCFR renderer API endpoint
//     const url = `https://www.ecfr.gov/api/renderer/v1/content/enhanced/2025-06-26/title-21?chapter=I&subchapter=H&part=${part}`;
//     const response = await axios.get(url, { 
//       timeout: 15000,
//       headers: {
//         'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
//         'User-Agent': 'Mozilla/5.0 (compatible; FDA-Device-Search/1.0)'
//       }
//     });
    
//     // Parse the HTML response to find the specific regulation
//     const regulation = parseECFRHtml(response.data, part, section);
    
//     if (!regulation) {
//       console.log(`No regulation data found for ${regulationNumber}`);
//       return null;
//     }
    
//     return {
//       regulationNumber,
//       title: regulation?.title || 'Regulation text not found',
//       text: regulation?.text || '',
//       identification: regulation?.identification || '',
//       classification: regulation?.classification || '',
//       requirements: extractRequirements(regulation?.text || ''),
//       classificationCriteria: extractClassificationCriteria(regulation?.text || ''),
//       testingRequirements: extractTestingRequirements(regulation?.text || ''),
//       url: `https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-${part}/section-${part}.${section}`,
//       deviceClass: regulation?.deviceClass || 'Unknown',
//       exemptions: regulation?.exemptions || []
//     };
//   } catch (error) {
//     console.error(`Error fetching eCFR data for ${regulationNumber}:`, error.message);
//     return null;
//   }
// }

// // Helper to parse eCFR HTML content and find specific regulation
// function parseECFRHtml(htmlContent, part, section) {
//   try {
//     const cheerio = require('cheerio');
//     const $ = cheerio.load(htmlContent);
    
//     // Look for the specific section using multiple strategies
//     const sectionId = `${part}.${section}`;
    
//     // Strategy 1: Look for section with exact ID
//     let sectionElement = $(`#${sectionId}`);
    
//     // Strategy 2: Look for section using data attributes or text content
//     if (sectionElement.length === 0) {
//       sectionElement = $(`.section`).filter(function() {
//         return $(this).attr('id') === sectionId || 
//                $(this).find('h4').text().includes(sectionId);
//       });
//     }
    
//     // Strategy 3: Look for any element containing the section number in its text
//     if (sectionElement.length === 0) {
//       sectionElement = $('div').filter(function() {
//         const text = $(this).find('h4').first().text();
//         return text.includes(`§ ${sectionId}`) || text.includes(`${sectionId}`);
//       });
//     }
    
//     if (sectionElement.length === 0) {
//       console.log(`Section ${sectionId} not found in eCFR HTML`);
//       // Let's try to find what sections ARE available
//       const availableSections = [];
//       $('div.section').each(function() {
//         const id = $(this).attr('id');
//         const title = $(this).find('h4').first().text();
//         if (id) availableSections.push(id);
//         if (title.includes('§ 872.')) availableSections.push(title);
//       });
//       console.log('Available sections found:', availableSections.slice(0, 10));
//       return null;
//     }
    
//     // Extract section title
//     const titleElement = sectionElement.find('h4').first();
//     const title = titleElement.text().trim();
    
//     // Extract identification paragraph - look for text containing "Identification"
//     let identification = '';
//     sectionElement.find('p').each(function() {
//       const text = $(this).text();
//       if (text.includes('Identification.') && text.length > 50) {
//         identification = text.replace(/^\([a-z]\)\s*Identification\.\s*/i, '').trim();
//         return false; // break the loop
//       }
//     });
    
//     // Extract classification paragraph - look for text containing "Classification"
//     let classification = '';
//     sectionElement.find('p').each(function() {
//       const text = $(this).text();
//       if (text.includes('Classification.') && text.length > 20) {
//         classification = text.replace(/^\([a-z]\)\s*Classification\.\s*/i, '').trim();
//         return false; // break the loop
//       }
//     });
    
//     // Get all text content from the section
//     const fullText = sectionElement.text();
    
//     // Extract device class (I, II, III)
//     const deviceClass = extractDeviceClass(classification);
    
//     // Extract exemptions
//     const exemptions = extractExemptions(classification);
    
//     return {
//       title,
//       text: fullText,
//       identification,
//       classification,
//       deviceClass,
//       exemptions
//     };
    
//   } catch (error) {
//     console.error('Error parsing eCFR HTML:', error);
//     return null;
//   }
// }

// // Helper to extract clean text from paragraph elements
// function extractParagraphText(element) {
//   if (!element || element.length === 0) return '';
  
//   const cheerio = require('cheerio');
//   const $ = cheerio.load(element.html());
  
//   // Remove links and citations, keep just the text content
//   $('a').remove();
//   $('.fr-reference').remove();
//   $('.cfr').remove();
  
//   return $.text().trim();
// }

// // Extract device class from classification text
// function extractDeviceClass(classificationText) {
//   if (!classificationText) return 'Unknown';
  
//   const classMatch = classificationText.match(/Class\s+(I{1,3}|1|2|3)/i);
//   if (classMatch) {
//     const classValue = classMatch[1].toUpperCase();
//     // Convert Roman numerals to Arabic numbers
//     if (classValue === 'I') return 'I';
//     if (classValue === 'II') return 'II';
//     if (classValue === 'III') return 'III';
//     return classValue;
//   }
  
//   return 'Unknown';
// }

// // Extract exemption information
// function extractExemptions(classificationText) {
//   if (!classificationText) return [];
  
//   const exemptions = [];
  
//   if (classificationText.includes('exempt from the premarket notification')) {
//     exemptions.push('510(k) exempt');
//   }
  
//   if (classificationText.includes('exempt from the current good manufacturing practice')) {
//     exemptions.push('QSR exempt (if not sterile)');
//   }
  
//   if (classificationText.includes('special controls')) {
//     exemptions.push('Requires special controls');
//   }
  
//   return exemptions;
// }

// // Enhanced requirements extraction
// function extractRequirements(text) {
//   const requirements = [];
//   const patterns = [
//     /must\s+([^.;]+)/gi,
//     /shall\s+([^.;]+)/gi,
//     /required\s+to\s+([^.;]+)/gi,
//     /device\s+is\s+intended\s+([^.;]+)/gi,
//     /special\s+control[s]?\s*[:]\s*([^.;]+)/gi,
//     /premarket\s+approval\s+([^.;]+)/gi
//   ];
  
//   patterns.forEach(pattern => {
//     const matches = text.match(pattern);
//     if (matches) {
//       requirements.push(...matches.map(match => match.trim()));
//     }
//   });
  
//   return [...new Set(requirements)].slice(0, 10); // Limit to top 10 unique requirements
// }

// // Enhanced classification criteria extraction
// function extractClassificationCriteria(text) {
//   const criteria = [];
//   const patterns = [
//     /Class\s+(I{1,3}|1|2|3)\s*\([^)]*\)/gi,
//     /general\s+controls/gi,
//     /special\s+controls/gi,
//     /premarket\s+approval/gi,
//     /510\(k\)\s+exempt/gi,
//     /prescription\s+use/gi
//   ];
  
//   patterns.forEach(pattern => {
//     const matches = text.match(pattern);
//     if (matches) {
//       criteria.push(...matches.map(match => match.trim()));
//     }
//   });
  
//   return [...new Set(criteria)];
// }

// // Enhanced testing requirements extraction
// function extractTestingRequirements(text) {
//   const tests = [];
//   const patterns = [
//     /biocompatibility\s+([^.;]+)/gi,
//     /sterilization\s+([^.;]+)/gi,
//     /electrical\s+safety\s+([^.;]+)/gi,
//     /clinical\s+(?:testing|studies|data)\s+([^.;]+)/gi,
//     /performance\s+testing\s+([^.;]+)/gi,
//     /ISO\s+\d+[^.\s]*\s*([^.;]*)/gi,
//     /ASTM\s+[A-Z]\d+[^.\s]*\s*([^.;]*)/gi
//   ];
  
//   patterns.forEach(pattern => {
//     const matches = text.match(pattern);
//     if (matches) {
//       tests.push(...matches.map(match => match.trim()));
//     }
//   });
  
//   return [...new Set(tests)].slice(0, 8); // Limit to top 8 unique requirements
// }

// // Get Federal Register notices
// async function getFederalRegisterNotices(searchTerm) {
//   try {
//     const response = await axios.get(FEDERAL_REGISTER_URL, {
//       params: {
//         'conditions[term]': searchTerm,
//         'conditions[agencies][]': 'food-and-drug-administration',
//         'per_page': 20,
//         'order': 'relevance'
//       },
//       timeout: 10000
//     });
    
//     return response.data.results?.map(notice => ({
//       title: notice.title,
//       summary: notice.abstract,
//       date: notice.publication_date,
//       type: notice.type,
//       url: notice.html_url,
//       docketNumber: notice.docket_id,
//       cfr_references: notice.cfr_references || []
//     })) || [];
//   } catch (error) {
//     console.error('Error fetching Federal Register data:', error.message);
//     return [];
//   }
// }

// // Get FDA guidance documents
// async function getFDAGuidance(searchTerm) {
//   try {
//     // FDA doesn't have a public API for guidance documents, so we'll simulate
//     // In practice, you might scrape their guidance database or use a different approach
//     const guidanceUrl = `https://www.fda.gov/medical-devices/device-regulation-and-guidance/guidance-documents-medical-devices-and-radiation-emitting-products`;
    
//     // This is a placeholder - you'd need to implement actual scraping or use FDA's search
//     return {
//       searchTerm,
//       guidanceDocuments: [
//         {
//           title: `Guidance for ${searchTerm} Devices`,
//           type: 'Draft Guidance',
//           date: '2024-01-15',
//           url: 'https://www.fda.gov/guidance-example',
//           summary: 'FDA guidance on regulatory requirements and recommendations'
//         }
//       ],
//       note: 'Guidance documents require web scraping or manual collection - this is a placeholder'
//     };
//   } catch (error) {
//     console.error('Error fetching FDA guidance:', error.message);
//     return { guidanceDocuments: [], error: error.message };
//   }
// }

// // Get international regulatory data (placeholder for future enhancement)
// async function getInternationalData(searchTerm) {
//   return {
//     searchTerm,
//     sources: {
//       'Health Canada': { status: 'Not implemented', url: 'https://health-products.canada.ca/mdall-limh/' },
//       'CE Marking (EU)': { status: 'Not implemented', url: 'https://ec.europa.eu/growth/single-market/ce-marking_en' },
//       'TGA (Australia)': { status: 'Not implemented', url: 'https://www.tga.gov.au/' },
//       'PMDA (Japan)': { status: 'Not implemented', url: 'https://www.pmda.go.jp/english/' }
//     },
//     note: 'International regulatory data integration available for future enhancement'
//   };
// }

// // Enhanced main search route with all sources
// router.get('/enhanced-search', async (req, res) => {
//   try {
//     const { q: searchTerm } = req.query;
    
//     if (!searchTerm) {
//       return res.status(400).json({ error: 'Search term (q) is required' });
//     }

//     console.log(`Enhanced search for: ${searchTerm}`);
    
//     // Get basic FDA data (from previous implementation)
//     const [
//       fiveOneOk,
//       pma,
//       recalls,
//       adverseEvents,
//       enforcement,
//       registrations,
//       udi,
//       classification
//     ] = await Promise.all([
//       search510k(searchTerm),
//       searchPMA(searchTerm),
//       searchRecalls(searchTerm),
//       searchAdverseEvents(searchTerm),
//       searchEnforcement(searchTerm),
//       searchRegistrations(searchTerm),
//       searchUDI(searchTerm),
//       searchClassification(searchTerm)
//     ]);

//     // Get regulatory enrichment data
//     const [
//       federalRegisterNotices,
//       fdaGuidance,
//       internationalData
//     ] = await Promise.all([
//       getFederalRegisterNotices(searchTerm),
//       getFDAGuidance(searchTerm),
//       getInternationalData(searchTerm)
//     ]);

//     // Extract regulation numbers for eCFR lookup
//     const regulationNumbers = extractRegulationNumbers({
//       classification,
//       fiveOneOk,
//       pma
//     });

//     // Get eCFR regulation details
//     const ecfrData = await Promise.all(
//       regulationNumbers.map(regNum => getECFRRegulation(regNum))
//     );

//     // Link and enrich all data
//     const enrichedData = await enrichWithRegulatoryData({
//       fdaData: {
//         fiveOneOk,
//         pma,
//         recalls,
//         adverseEvents,
//         enforcement,
//         registrations,
//         udi,
//         classification
//       },
//       regulatoryData: {
//         ecfr: ecfrData.filter(item => item !== null),
//         federalRegister: federalRegisterNotices,
//         guidance: fdaGuidance,
//         international: internationalData
//       }
//     });

//     // Generate comprehensive analysis
//     const comprehensiveAnalysis = generateComprehensiveAnalysis(enrichedData, searchTerm);

//     res.json({
//       searchTerm,
//       timestamp: new Date().toISOString(),
//       analysis: comprehensiveAnalysis,
//       data: enrichedData,
//       sources: {
//         'FDA APIs': 'api.fda.gov',
//         'eCFR': 'ecfr.gov',
//         'Federal Register': 'federalregister.gov',
//         'FDA Guidance': 'fda.gov/guidance',
//         'International': 'Various (placeholder)'
//       }
//     });

//   } catch (error) {
//     console.error('Enhanced search error:', error);
//     res.status(500).json({ error: 'Internal server error', message: error.message });
//   }
// });

// // Extract regulation numbers from FDA data
// function extractRegulationNumbers(data) {
//   const regNumbers = new Set();
  
//   // From classification data
//   if (data.classification.results) {
//     data.classification.results.forEach(item => {
//       if (item.regulation_number) {
//         regNumbers.add(item.regulation_number);
//       }
//     });
//   }
  
//   // From 510(k) data
//   if (data.fiveOneOk.results) {
//     data.fiveOneOk.results.forEach(item => {
//       if (item.openfda?.regulation_number) {
//         regNumbers.add(item.openfda.regulation_number);
//       }
//     });
//   }
  
//   // From PMA data
//   if (data.pma.results) {
//     data.pma.results.forEach(item => {
//       if (item.openfda?.regulation_number) {
//         regNumbers.add(item.openfda.regulation_number);
//       }
//     });
//   }
  
//   return Array.from(regNumbers);
// }

// // Enrich FDA data with regulatory information
// async function enrichWithRegulatoryData({ fdaData, regulatoryData }) {
//   const enriched = { ...fdaData };
  
//   // Add regulatory context to each FDA record
//   Object.keys(enriched).forEach(key => {
//     if (enriched[key].results) {
//       enriched[key].results = enriched[key].results.map(item => {
//         const regulationNumber = item.regulation_number || 
//           item.openfda?.regulation_number;
        
//         const regulatoryContext = {
//           ecfrRegulation: null,
//           relatedNotices: [],
//           guidanceDocuments: [],
//           complianceRequirements: []
//         };
        
//         // Find matching eCFR regulation
//         if (regulationNumber) {
//           regulatoryContext.ecfrRegulation = regulatoryData.ecfr.find(
//             reg => reg?.regulationNumber === regulationNumber
//           );
//         }
        
//         // Find related Federal Register notices
//         regulatoryContext.relatedNotices = regulatoryData.federalRegister.filter(
//           notice => notice.title.toLowerCase().includes(
//             (item.device_name || item.generic_name || '').toLowerCase()
//           )
//         );
        
//         return {
//           ...item,
//           _regulatoryContext: regulatoryContext
//         };
//       });
//     }
//   });
  
//   // Add standalone regulatory data
//   enriched.regulatoryEnrichment = regulatoryData;
  
//   return enriched;
// }

// // Generate comprehensive regulatory analysis
// function generateComprehensiveAnalysis(data, searchTerm) {
//   const analysis = {
//     regulatoryComplexity: 'Unknown',
//     keyRegulations: [],
//     complianceRequirements: [],
//     marketAccessStrategy: [],
//     riskAssessment: {
//       level: 'Unknown',
//       factors: []
//     },
//     recommendations: [],
//     deviceClassification: {
//       classes: [],
//       pathways: [],
//       exemptions: []
//     }
//   };
  
//   // Analyze regulatory complexity
//   const uniqueRegulations = new Set();
//   const classLevels = new Set();
//   const exemptions = new Set();
  
//   // Extract regulation data from eCFR
//   Object.values(data).forEach(dataset => {
//     if (dataset.results) {
//       dataset.results.forEach(item => {
//         if (item._regulatoryContext?.ecfrRegulation) {
//           const reg = item._regulatoryContext.ecfrRegulation;
//           uniqueRegulations.add(reg.regulationNumber);
//           if (reg.deviceClass && reg.deviceClass !== 'Unknown') {
//             classLevels.add(reg.deviceClass);
//           }
//           if (reg.exemptions) {
//             reg.exemptions.forEach(ex => exemptions.add(ex));
//           }
//         }
//         if (item.device_class) {
//           classLevels.add(item.device_class);
//         }
//       });
//     }
//   });
  
//   // Determine complexity based on classes and regulations
//   const hasClassIII = classLevels.has('III') || classLevels.has('3');
//   const hasClassII = classLevels.has('II') || classLevels.has('2');
//   const multipleRegulations = uniqueRegulations.size > 3;
  
//   if (hasClassIII || multipleRegulations) {
//     analysis.regulatoryComplexity = 'High';
//   } else if (hasClassII || uniqueRegulations.size > 1) {
//     analysis.regulatoryComplexity = 'Medium';
//   } else {
//     analysis.regulatoryComplexity = 'Low';
//   }
  
//   // Extract key regulations with enhanced detail
//   analysis.keyRegulations = Array.from(uniqueRegulations).map(regNum => {
//     const ecfrData = data.regulatoryEnrichment?.ecfr?.find(
//       reg => reg?.regulationNumber === regNum
//     );
//     return {
//       number: regNum,
//       title: ecfrData?.title || 'Unknown',
//       deviceClass: ecfrData?.deviceClass || 'Unknown',
//       requirements: ecfrData?.requirements || [],
//       exemptions: ecfrData?.exemptions || [],
//       url: ecfrData?.url
//     };
//   });
  
//   // Device classification summary
//   analysis.deviceClassification.classes = Array.from(classLevels);
//   analysis.deviceClassification.exemptions = Array.from(exemptions);
  
//   // Determine regulatory pathways
//   if (hasClassIII) {
//     analysis.deviceClassification.pathways.push('PMA (Premarket Approval)');
//   }
//   if (hasClassII || classLevels.has('I')) {
//     const has510kExempt = exemptions.has('510(k) exempt');
//     if (has510kExempt) {
//       analysis.deviceClassification.pathways.push('510(k) Exempt');
//     } else {
//       analysis.deviceClassification.pathways.push('510(k) Clearance');
//     }
//   }
  
//   // Risk assessment
//   const recallCount = data.recalls?.results?.length || 0;
//   const adverseEventCount = data.adverseEvents?.results?.length || 0;
  
//   if (recallCount > 5 || adverseEventCount > 10 || hasClassIII) {
//     analysis.riskAssessment.level = 'High';
//     analysis.riskAssessment.factors.push('Class III device or multiple safety issues');
//   } else if (recallCount > 0 || adverseEventCount > 0 || hasClassII) {
//     analysis.riskAssessment.level = 'Medium';
//     analysis.riskAssessment.factors.push('Class II device or some safety concerns');
//   } else {
//     analysis.riskAssessment.level = 'Low';
//     analysis.riskAssessment.factors.push('Class I device with no significant safety issues');
//   }
  
//   // Generate specific recommendations
//   if (hasClassIII) {
//     analysis.recommendations.push('PMA pathway required - plan 2-3+ years for approval');
//     analysis.recommendations.push('Extensive clinical trials likely required');
//   } else if (hasClassII) {
//     analysis.recommendations.push('510(k) clearance pathway - identify predicate devices');
//     if (!exemptions.has('510(k) exempt')) {
//       analysis.recommendations.push('Prepare 510(k) submission with substantial equivalence data');
//     }
//   } else {
//     analysis.recommendations.push('Class I device - minimal FDA oversight required');
//   }
  
//   if (exemptions.has('QSR exempt (if not sterile)')) {
//     analysis.recommendations.push('Consider QSR exemption if device is not sterile');
//   }
  
//   if (analysis.regulatoryComplexity === 'High') {
//     analysis.recommendations.push('Engage regulatory consultant early in development');
//   }
  
//   if (uniqueRegulations.size > 1) {
//     analysis.recommendations.push('Review multiple CFR sections for complete compliance');
//   }
  
//   return analysis;
// }


// async function search510k(searchTerm, maxResults = 1000) {
//   const searchFields = [
//     `device_name:"${searchTerm}"`,
//     `applicant:"${searchTerm}"`,
//     `k_number:"${searchTerm}"`,
//     `product_code:"${searchTerm}"`,
//     `openfda.device_name:"${searchTerm}"`,
//     `openfda.medical_specialty_description:"${searchTerm}"`
//   ];
  
//   const search = searchFields.join(' OR ');
//   return await fdaRequestWithPagination('/510k.json', { search }, maxResults);
// }

// async function searchPMA(searchTerm, maxResults = 1000) {
//   const searchFields = [
//     `generic_name:"${searchTerm}"`,
//     `trade_name:"${searchTerm}"`,
//     `applicant:"${searchTerm}"`,
//     `pma_number:"${searchTerm}"`,
//     `product_code:"${searchTerm}"`
//   ];
  
//   const search = searchFields.join(' OR ');
//   return await fdaRequestWithPagination('/pma.json', { search }, maxResults);
// }

// async function searchRecalls(searchTerm, maxResults = 1000) {
//   const searchFields = [
//     `product_description:"${searchTerm}"`,
//     `recalling_firm:"${searchTerm}"`,
//     `product_code:"${searchTerm}"`,
//     `k_numbers:"${searchTerm}"`,
//     `pma_numbers:"${searchTerm}"`,
//     `reason_for_recall:"${searchTerm}"`
//   ];
  
//   const search = searchFields.join(' OR ');
//   return await fdaRequestWithPagination('/recall.json', { search }, maxResults);
// }

// async function searchAdverseEvents(searchTerm, maxResults = 1000) {
//   const searchFields = [
//     `device.generic_name:"${searchTerm}"`,
//     `device.brand_name:"${searchTerm}"`,
//     `device.manufacturer_d_name:"${searchTerm}"`,
//     `device.device_name:"${searchTerm}"`,
//     `manufacturer_name:"${searchTerm}"`
//   ];
  
//   const search = searchFields.join(' OR ');
//   return await fdaRequestWithPagination('/event.json', { search }, maxResults);
// }

// async function searchEnforcement(searchTerm, maxResults = 1000) {
//   const searchFields = [
//     `product_description:"${searchTerm}"`,
//     `recalling_firm:"${searchTerm}"`,
//     `product_code:"${searchTerm}"`,
//     `reason_for_recall:"${searchTerm}"`
//   ];
  
//   const search = searchFields.join(' OR ');
//   return await fdaRequestWithPagination('/enforcement.json', { search }, maxResults);
// }

// async function searchRegistrations(searchTerm, maxResults = 1000) {
//   const searchFields = [
//     `products.product_code:"${searchTerm}"`,
//     `products.openfda.device_name:"${searchTerm}"`,
//     `products.openfda.medical_specialty_description:"${searchTerm}"`,
//     `proprietary_name:"${searchTerm}"`
//   ];
  
//   const search = searchFields.join(' OR ');
//   return await fdaRequestWithPagination('/registrationlisting.json', { search }, maxResults);
// }

// async function searchUDI(searchTerm, maxResults = 1000) {
//   const searchFields = [
//     `device_description:"${searchTerm}"`,
//     `brand_name:"${searchTerm}"`,
//     `company_name:"${searchTerm}"`,
//     `catalog_number:"${searchTerm}"`,
//     `version_or_model_number:"${searchTerm}"`
//   ];
  
//   const search = searchFields.join(' OR ');
//   return await fdaRequestWithPagination('/udi.json', { search }, maxResults);
// }

// async function searchClassification(searchTerm, maxResults = 1000) {
//   const searchFields = [
//     `device_name:"${searchTerm}"`,
//     `medical_specialty_description:"${searchTerm}"`,
//     `product_code:"${searchTerm}"`,
//     `regulation_number:"${searchTerm}"`
//   ];
  
//   const search = searchFields.join(' OR ');
//   return await fdaRequestWithPagination('/classification.json', { search }, maxResults);
// }

// // Route to get complete eCFR part document
// router.get('/ecfr-part/:part', async (req, res) => {
//   try {
//     const { part } = req.params;
    
//     // Validate part number
//     const validParts = {
//       '862': 'Clinical Chemistry and Clinical Toxicology Devices',
//       '864': 'Hematology and Pathology Devices', 
//       '866': 'Immunology and Microbiology Devices',
//       '868': 'Anesthesiology Devices',
//       '870': 'Cardiovascular Devices',
//       '872': 'Dental Devices',
//       '874': 'Ear, Nose, and Throat Devices',
//       '876': 'Gastroenterology-Urology Devices',
//       '878': 'General and Plastic Surgery Devices',
//       '880': 'General Hospital and Personal Use Devices',
//       '882': 'Neurological Devices',
//       '884': 'Obstetrical and Gynecological Devices',
//       '886': 'Ophthalmic Devices',
//       '888': 'Orthopedic Devices',
//       '890': 'Physical Medicine Devices',
//       '892': 'Radiology Devices'
//     };
    
//     if (!validParts[part]) {
//       return res.status(400).json({ 
//         error: 'Invalid part number',
//         validParts: Object.keys(validParts),
//         description: 'Use part numbers 862-892 for medical device regulations'
//       });
//     }
    
//     console.log(`Fetching complete eCFR Part ${part}: ${validParts[part]}`);
    
//     const partDocument = await getCompleteECFRPart(part);
    
//     if (!partDocument) {
//       return res.status(404).json({ 
//         error: `Could not fetch eCFR Part ${part}`,
//         part,
//         description: validParts[part]
//       });
//     }
    
//     res.json({
//       part,
//       title: `21 CFR Part ${part}`,
//       description: validParts[part],
//       timestamp: new Date().toISOString(),
//       url: `https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-${part}`,
//       data: partDocument
//     });
    
//   } catch (error) {
//     console.error(`Error fetching eCFR Part ${req.params.part}:`, error);
//     res.status(500).json({ error: 'Internal server error', message: error.message });
//   }
// });


// // Add these functions to your backend router (baceknd file)

// // Product Code specific search endpoint
// router.get('/product-code/:productCode', async (req, res) => {
//   try {
//     const { productCode } = req.params;
    
//     if (!productCode) {
//       return res.status(400).json({ error: 'Product code is required' });
//     }

//     console.log(`Product Code Search for: ${productCode}`);
    
//     // Get all FDA data for this product code
//     const fdaData = await getProductCodeData(productCode);
    
//     // Get classification data specifically for this product code
//     const classificationData = await getProductCodeClassification(productCode);
    
//     // Get CFR regulation details
//     const cfrData = await getCFRForProductCode(classificationData);
    
//     // Get pathway analysis
//     const pathwayAnalysis = await analyzeRegulatoryPathways(fdaData);
    
//     res.json({
//       productCode,
//       timestamp: new Date().toISOString(),
//       classification: classificationData,
//       cfrRegulations: cfrData,
//       pathwayAnalysis,
//       fdaData,
//       summary: generateProductCodeSummary(fdaData, classificationData, pathwayAnalysis)
//     });

//   } catch (error) {
//     console.error('Product code search error:', error);
//     res.status(500).json({ error: 'Internal server error', message: error.message });
//   }
// });

// // Get comprehensive FDA data for a product code
// async function getProductCodeData(productCode) {
//   const results = await Promise.allSettled([
//     // 510(k) clearances
//     fdaRequestWithPagination('/510k.json', { 
//       search: `product_code:"${productCode}"` 
//     }),
//     // PMA approvals
//     fdaRequestWithPagination('/pma.json', { 
//       search: `product_code:"${productCode}"` 
//     }),
//     // De Novo requests (often in 510k database with special status)
//     fdaRequestWithPagination('/510k.json', { 
//       search: `product_code:"${productCode}" AND decision_description:"De Novo"` 
//     }),
//     // Classification
//     fdaRequestWithPagination('/classification.json', { 
//       search: `product_code:"${productCode}"` 
//     }),
//     // Recalls
//     fdaRequestWithPagination('/recall.json', { 
//       search: `product_code:"${productCode}"` 
//     }),
//     // Registrations
//     fdaRequestWithPagination('/registrationlisting.json', { 
//       search: `products.product_code:"${productCode}"` 
//     })
//   ]);

//   const [fiveOneOk, pma, deNovo, classification, recalls, registrations] = results.map(result => 
//     result.status === 'fulfilled' ? result.value : { results: [], error: result.reason?.message }
//   );

//   return {
//     fiveOneOk,
//     pma,
//     deNovo,
//     classification,
//     recalls,
//     registrations
//   };
// }

// // Get detailed classification for product code
// async function getProductCodeClassification(productCode) {
//   try {
//     const classificationData = await fdaRequestWithPagination('/classification.json', {
//       search: `product_code:"${productCode}"`
//     });

//     if (!classificationData.results || classificationData.results.length === 0) {
//       return { error: 'No classification found for this product code' };
//     }

//     const classification = classificationData.results[0];
    
//     return {
//       productCode,
//       deviceName: classification.device_name,
//       deviceClass: classification.device_class,
//       regulationNumber: classification.regulation_number,
//       medicalSpecialty: classification.medical_specialty_description,
//       panelCode: classification.review_panel,
//       summary: classification.summary,
//       definitionText: classification.definition,
//       physicalState: classification.physical_state,
//       technicalMethod: classification.technical_method,
//       targetArea: classification.target_area,
//       exemptions: extractExemptionDetails(classification),
//       specialControls: extractSpecialControls(classification)
//     };
//   } catch (error) {
//     console.error('Error fetching classification:', error);
//     return { error: error.message };
//   }
// }

// // Extract exemption details from classification
// function extractExemptionDetails(classification) {
//   const exemptions = [];
  
//   if (classification.implant_flag === 'N' && classification.life_sustain_support_flag === 'N') {
//     exemptions.push('510(k) exempt');
//   }
  
//   if (classification.gmp_exempt_flag === 'Y') {
//     exemptions.push('GMP exempt');
//   }
  
//   return exemptions;
// }

// // Extract special controls information
// function extractSpecialControls(classification) {
//   const controls = [];
  
//   if (classification.device_class === 'II' || classification.device_class === '2') {
//     controls.push('General controls apply');
//     controls.push('Special controls required');
//   }
  
//   if (classification.device_class === 'III' || classification.device_class === '3') {
//     controls.push('PMA required');
//     controls.push('Clinical data typically required');
//   }
  
//   return controls;
// }

// // Get CFR regulation details for product code
// async function getCFRForProductCode(classificationData) {
//   if (!classificationData.regulationNumber) {
//     return { error: 'No regulation number found' };
//   }
  
//   const cfrData = await getECFRRegulation(classificationData.regulationNumber);
//   return cfrData;
// }

// // Analyze regulatory pathways for approved devices
// async function analyzeRegulatoryPathways(fdaData) {
//   const pathwayAnalysis = {
//     totalApprovedDevices: 0,
//     pathways: {
//       '510k': { count: 0, devices: [] },
//       'pma': { count: 0, devices: [] },
//       'deNovo': { count: 0, devices: [] }
//     },
//     recentApprovals: [],
//     pathwayTrends: {}
//   };

//   // Analyze 510(k) clearances
//   if (fdaData.fiveOneOk?.results) {
//     const cleared510k = fdaData.fiveOneOk.results.filter(device => 
//       device.decision_description?.toLowerCase().includes('cleared') ||
//       device.decision_description?.toLowerCase().includes('substantially equivalent')
//     );
    
//     pathwayAnalysis.pathways['510k'].count = cleared510k.length;
//     pathwayAnalysis.pathways['510k'].devices = cleared510k.map(device => ({
//       kNumber: device.k_number,
//       deviceName: device.device_name,
//       applicant: device.applicant,
//       decisionDate: device.decision_date,
//       clearanceType: device.clearance_type || 'Traditional 510(k)'
//     }));
//   }

//   // Analyze PMA approvals
//   if (fdaData.pma?.results) {
//     const approvedPMA = fdaData.pma.results.filter(device => 
//       device.decision_description?.toLowerCase().includes('approved')
//     );
    
//     pathwayAnalysis.pathways.pma.count = approvedPMA.length;
//     pathwayAnalysis.pathways.pma.devices = approvedPMA.map(device => ({
//       pmaNumber: device.pma_number,
//       deviceName: device.trade_name || device.generic_name,
//       applicant: device.applicant,
//       decisionDate: device.decision_date,
//       expedited: device.expedited_review_flag === 'Y'
//     }));
//   }

//   // Analyze De Novo requests
//   if (fdaData.deNovo?.results) {
//     pathwayAnalysis.pathways.deNovo.count = fdaData.deNovo.results.length;
//     pathwayAnalysis.pathways.deNovo.devices = fdaData.deNovo.results.map(device => ({
//       kNumber: device.k_number,
//       deviceName: device.device_name,
//       applicant: device.applicant,
//       decisionDate: device.decision_date,
//       newClassification: true
//     }));
//   }

//   // Calculate totals
//   pathwayAnalysis.totalApprovedDevices = 
//     pathwayAnalysis.pathways['510k'].count +
//     pathwayAnalysis.pathways.pma.count +
//     pathwayAnalysis.pathways.deNovo.count;

//   // Get recent approvals across all pathways
//   const allApprovals = [
//     ...pathwayAnalysis.pathways['510k'].devices.map(d => ({ ...d, pathway: '510(k)' })),
//     ...pathwayAnalysis.pathways.pma.devices.map(d => ({ ...d, pathway: 'PMA' })),
//     ...pathwayAnalysis.pathways.deNovo.devices.map(d => ({ ...d, pathway: 'De Novo' }))
//   ];

//   pathwayAnalysis.recentApprovals = allApprovals
//     .filter(device => device.decisionDate)
//     .sort((a, b) => new Date(b.decisionDate) - new Date(a.decisionDate))
//     .slice(0, 10);

//   return pathwayAnalysis;
// }

// // Generate summary for product code search
// function generateProductCodeSummary(fdaData, classificationData, pathwayAnalysis) {
//   return {
//     productCode: classificationData.productCode,
//     deviceName: classificationData.deviceName,
//     deviceClass: classificationData.deviceClass,
//     totalApprovedDevices: pathwayAnalysis.totalApprovedDevices,
//     primaryPathway: getPrimaryPathway(pathwayAnalysis),
//     regulatoryComplexity: classificationData.deviceClass === 'III' ? 'High' : 
//                          classificationData.deviceClass === 'II' ? 'Medium' : 'Low',
//     recentActivity: pathwayAnalysis.recentApprovals.length > 0 ? 
//                    `Latest approval: ${pathwayAnalysis.recentApprovals[0].decisionDate}` : 'No recent approvals',
//     exemptions: classificationData.exemptions || [],
//     specialControls: classificationData.specialControls || []
//   };
// }

// // Determine primary regulatory pathway
// function getPrimaryPathway(pathwayAnalysis) {
//   const pathways = pathwayAnalysis.pathways;
  
//   if (pathways.pma.count > 0) return 'PMA';
//   if (pathways.deNovo.count > 0) return 'De Novo';
//   if (pathways['510k'].count > 0) return '510(k)';
  
//   return 'Unknown';
// }

// // Device term search with pathway analysis
// router.get('/device-pathways', async (req, res) => {
//   try {
//     const { q: searchTerm } = req.query;
    
//     if (!searchTerm) {
//       return res.status(400).json({ error: 'Search term (q) is required' });
//     }

//     console.log(`Device pathway search for: ${searchTerm}`);
    
//     // Get all approved devices for this search term
//     const approvedDevices = await getApprovedDevicesWithPathways(searchTerm);
    
//     // Analyze pathway distribution
//     const pathwayDistribution = analyzePathwayDistribution(approvedDevices);
    
//     // Get market trends
//     const marketTrends = analyzeMarketTrends(approvedDevices);
    
//     res.json({
//       searchTerm,
//       timestamp: new Date().toISOString(),
//       approvedDevices,
//       pathwayDistribution,
//       marketTrends,
//       summary: {
//         totalDevices: approvedDevices.total,
//         pathwayBreakdown: pathwayDistribution,
//         dominantPathway: getDominantPathway(pathwayDistribution)
//       }
//     });

//   } catch (error) {
//     console.error('Device pathway search error:', error);
//     res.status(500).json({ error: 'Internal server error', message: error.message });
//   }
// });

// // Get all approved devices with their pathways
// async function getApprovedDevicesWithPathways(searchTerm) {
//   const searchFields = [
//     `device_name:"${searchTerm}"`,
//     `openfda.device_name:"${searchTerm}"`,
//     `generic_name:"${searchTerm}"`,
//     `trade_name:"${searchTerm}"`
//   ];
  
//   const search = searchFields.join(' OR ');
  
//   const results = await Promise.allSettled([
//     // 510(k) clearances
//     fdaRequestWithPagination('/510k.json', { 
//       search: `(${search}) AND decision_description:"Substantially Equivalent"` 
//     }),
//     // PMA approvals
//     fdaRequestWithPagination('/pma.json', { 
//       search: `(${search}) AND decision_description:"Approved"` 
//     }),
//     // De Novo clearances
//     fdaRequestWithPagination('/510k.json', { 
//       search: `(${search}) AND decision_description:"De Novo"` 
//     })
//   ]);

//   const [fiveOneOk, pma, deNovo] = results.map(result => 
//     result.status === 'fulfilled' ? result.value : { results: [] }
//   );

//   return {
//     fiveOneOk: fiveOneOk.results || [],
//     pma: pma.results || [],
//     deNovo: deNovo.results || [],
//     total: (fiveOneOk.results?.length || 0) + (pma.results?.length || 0) + (deNovo.results?.length || 0)
//   };
// }

// // Analyze pathway distribution
// function analyzePathwayDistribution(approvedDevices) {
//   return {
//     '510k': {
//       count: approvedDevices.fiveOneOk.length,
//       percentage: approvedDevices.total > 0 ? 
//         Math.round((approvedDevices.fiveOneOk.length / approvedDevices.total) * 100) : 0
//     },
//     'pma': {
//       count: approvedDevices.pma.length,
//       percentage: approvedDevices.total > 0 ? 
//         Math.round((approvedDevices.pma.length / approvedDevices.total) * 100) : 0
//     },
//     'deNovo': {
//       count: approvedDevices.deNovo.length,
//       percentage: approvedDevices.total > 0 ? 
//         Math.round((approvedDevices.deNovo.length / approvedDevices.total) * 100) : 0
//     }
//   };
// }

// // Analyze market trends
// function analyzeMarketTrends(approvedDevices) {
//   const trends = {
//     yearlyApprovals: {},
//     recentTrend: 'stable',
//     averageTimeToApproval: 'Unknown'
//   };

//   // Combine all approvals with dates
//   const allApprovals = [
//     ...approvedDevices.fiveOneOk.map(d => ({ ...d, pathway: '510(k)', date: d.decision_date })),
//     ...approvedDevices.pma.map(d => ({ ...d, pathway: 'PMA', date: d.decision_date })),
//     ...approvedDevices.deNovo.map(d => ({ ...d, pathway: 'De Novo', date: d.decision_date }))
//   ];

//   // Group by year
//   allApprovals.forEach(approval => {
//     if (approval.date) {
//       const year = new Date(approval.date).getFullYear();
//       if (!trends.yearlyApprovals[year]) {
//         trends.yearlyApprovals[year] = { total: 0, byPathway: {} };
//       }
//       trends.yearlyApprovals[year].total++;
//       trends.yearlyApprovals[year].byPathway[approval.pathway] = 
//         (trends.yearlyApprovals[year].byPathway[approval.pathway] || 0) + 1;
//     }
//   });

//   return trends;
// }

// // Get dominant pathway
// function getDominantPathway(distribution) {
//   const pathways = Object.entries(distribution);
//   const dominant = pathways.reduce((max, [pathway, data]) => 
//     data.count > max.count ? { pathway, count: data.count } : max
//   , { pathway: 'Unknown', count: 0 });
  
//   return dominant.pathway;
// }
// // Route to search within a specific eCFR part
// router.get('/ecfr-part/:part/search', async (req, res) => {
//   try {
//     const { part } = req.params;
//     const { q: searchTerm } = req.query;
    
//     if (!searchTerm) {
//       return res.status(400).json({ error: 'Search term (q) is required' });
//     }
    
//     console.log(`Searching eCFR Part ${part} for: ${searchTerm}`);
    
//     const partDocument = await getCompleteECFRPart(part);
//     if (!partDocument) {
//       return res.status(404).json({ error: `Could not fetch eCFR Part ${part}` });
//     }
    
//     // Search within the part document
//     const searchResults = searchWithinECFRPart(partDocument, searchTerm);
    
//     res.json({
//       part,
//       searchTerm,
//       timestamp: new Date().toISOString(),
//       matchCount: searchResults.length,
//       results: searchResults
//     });
    
//   } catch (error) {
//     console.error(`Error searching eCFR Part ${req.params.part}:`, error);
//     res.status(500).json({ error: 'Internal server error', message: error.message });
//   }
// });

// // Function to get complete eCFR part document
// async function getCompleteECFRPart(part) {
//   try {
//     const url = `https://www.ecfr.gov/api/renderer/v1/content/enhanced/2025-06-26/title-21?chapter=I&subchapter=H&part=${part}`;
//     const response = await axios.get(url, { 
//       timeout: 30000, // Longer timeout for complete documents
//       headers: {
//         'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
//         'User-Agent': 'Mozilla/5.0 (compatible; FDA-Device-Search/1.0)'
//       }
//     });
    
//     return parseCompleteECFRPart(response.data, part);
    
//   } catch (error) {
//     console.error(`Error fetching eCFR Part ${part}:`, error.message);
//     return null;
//   }
// }

// // Parse complete eCFR part document
// function parseCompleteECFRPart(htmlContent, part) {
//   try {
//     const cheerio = require('cheerio');
//     const $ = cheerio.load(htmlContent);
    
//     const partData = {
//       partNumber: part,
//       title: '',
//       authority: '',
//       source: '',
//       subparts: [],
//       sections: [],
//       fullText: '',
//       summary: {
//         totalSections: 0,
//         deviceTypes: [],
//         classDistribution: { classI: 0, classII: 0, classIII: 0 }
//       }
//     };
    
//     // Extract part title
//     const partTitle = $(`#part-${part} h1`).first().text().trim();
//     partData.title = partTitle;
    
//     // Extract authority and source
//     partData.authority = $(`#part-${part} .authority p`).text().trim();
//     partData.source = $(`#part-${part} .source p`).text().trim();
    
//     // Parse all subparts
//     $(`#part-${part} .subpart`).each(function() {
//       const subpartId = $(this).attr('id');
//       const subpartTitle = $(this).find('h2').first().text().trim();
      
//       const subpart = {
//         id: subpartId,
//         title: subpartTitle,
//         sections: []
//       };
      
//       // Parse sections within this subpart
//       $(this).find('.section').each(function() {
//         const section = parseECFRSection($, $(this), part);
//         if (section) {
//           subpart.sections.push(section);
//           partData.sections.push(section);
          
//           // Update statistics
//           partData.summary.totalSections++;
//           if (section.deviceClass) {
//             if (section.deviceClass.includes('I')) partData.summary.classDistribution.classI++;
//             if (section.deviceClass.includes('II')) partData.summary.classDistribution.classII++;
//             if (section.deviceClass.includes('III')) partData.summary.classDistribution.classIII++;
//           }
          
//           // Extract device types for summary
//           if (section.identification && section.identification.length > 50) {
//             const deviceType = extractDeviceType(section.identification);
//             if (deviceType && !partData.summary.deviceTypes.includes(deviceType)) {
//               partData.summary.deviceTypes.push(deviceType);
//             }
//           }
//         }
//       });
      
//       partData.subparts.push(subpart);
//     });
    
//     // Get full text content
//     partData.fullText = $(`#part-${part}`).text().replace(/\s+/g, ' ').trim();
    
//     // Limit device types to most common ones
//     partData.summary.deviceTypes = partData.summary.deviceTypes.slice(0, 20);
    
//     return partData;
    
//   } catch (error) {
//     console.error('Error parsing complete eCFR part:', error);
//     return null;
//   }
// }

// // Parse individual eCFR section
// function parseECFRSection($, sectionElement, part) {
//   try {
//     const sectionId = sectionElement.attr('id');
//     if (!sectionId) return null;
    
//     const titleElement = sectionElement.find('h4').first();
//     const title = titleElement.text().trim();
    
//     // Extract identification
//     let identification = '';
//     sectionElement.find('p').each(function() {
//       const text = $(this).text();
//       if (text.includes('Identification.') && text.length > 50) {
//         identification = text.replace(/^\([a-z]\)\s*Identification\.\s*/i, '').trim();
//         return false;
//       }
//     });
    
//     // Extract classification
//     let classification = '';
//     sectionElement.find('p').each(function() {
//       const text = $(this).text();
//       if (text.includes('Classification.') && text.length > 20) {
//         classification = text.replace(/^\([a-z]\)\s*Classification\.\s*/i, '').trim();
//         return false;
//       }
//     });
    
//     const fullText = sectionElement.text();
//     const deviceClass = extractDeviceClass(classification);
//     const exemptions = extractExemptions(classification);
    
//     return {
//       sectionId,
//       title,
//       identification,
//       classification,
//       deviceClass,
//       exemptions,
//       fullText,
//       url: `https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-${part}/section-${sectionId}`
//     };
    
//   } catch (error) {
//     console.error('Error parsing eCFR section:', error);
//     return null;
//   }
// }

// // Extract device type from identification text
// function extractDeviceType(identification) {
//   if (!identification) return null;
  
//   // Look for device type patterns
//   const patterns = [
//     /is\s+an?\s+([^.]{10,60})\s+(?:device|system|equipment|instrument)/i,
//     /is\s+a\s+([^.]{10,60})\s+intended/i,
//     /([A-Z][a-z]+(?:\s+[a-z]+)*)\s+is\s+a\s+device/i
//   ];
  
//   for (const pattern of patterns) {
//     const match = identification.match(pattern);
//     if (match && match[1]) {
//       return match[1].trim().toLowerCase();
//     }
//   }
  
//   return null;
// }

// // Search within eCFR part document
// function searchWithinECFRPart(partDocument, searchTerm) {
//   const results = [];
//   const searchRegex = new RegExp(searchTerm, 'gi');
  
//   partDocument.sections.forEach(section => {
//     const matches = [];
    
//     // Check if search term appears in title
//     if (searchRegex.test(section.title)) {
//       matches.push({ field: 'title', context: section.title });
//     }
    
//     // Check identification text
//     if (section.identification && searchRegex.test(section.identification)) {
//       const context = extractContext(section.identification, searchTerm, 100);
//       matches.push({ field: 'identification', context });
//     }
    
//     // Check classification text
//     if (section.classification && searchRegex.test(section.classification)) {
//       const context = extractContext(section.classification, searchTerm, 100);
//       matches.push({ field: 'classification', context });
//     }
    
//     // Check full text
//     if (searchRegex.test(section.fullText)) {
//       const context = extractContext(section.fullText, searchTerm, 150);
//       matches.push({ field: 'fullText', context });
//     }
    
//     if (matches.length > 0) {
//       results.push({
//         section: section.sectionId,
//         title: section.title,
//         deviceClass: section.deviceClass,
//         url: section.url,
//         matches
//       });
//     }
//   });
  
//   return results;
// }

// // Extract context around search term
// function extractContext(text, searchTerm, contextLength = 100) {
//   const regex = new RegExp(`(.{0,${contextLength/2}})${searchTerm}(.{0,${contextLength/2}})`, 'i');
//   const match = text.match(regex);
  
//   if (match) {
//     return `...${match[1]}${match[0]}${match[2]}...`.replace(/\s+/g, ' ').trim();
//   }
  
//   return text.substring(0, contextLength) + '...';
// }

// // Comprehensive device intelligence endpoint
// // Main device intelligence route with search mode support
// router.get('/device-intelligence', async (req, res) => {
//   try {
//     const { q: searchTerm, mode: searchMode = 'auto' } = req.query;
    
//     if (!searchTerm) {
//       return res.status(400).json({ error: 'Search term (q) is required' });
//     }

//     console.log(`Device Intelligence Search for: ${searchTerm} (mode: ${searchMode})`);
    
//     // Get FDA data with search mode
//     const fdaData = await getAllFDAData(searchTerm, searchMode);
    
//     // Generate charts data
//     const chartsData = generateChartsData(fdaData);
    
//     // Identify applicable eCFR parts (for device searches)
//     let applicableParts = [];
//     let ecfrData = {};
    
//     if (searchMode !== 'company') {
//       applicableParts = identifyApplicableECFRParts(fdaData, searchTerm);
//       if (applicableParts.length > 0) {
//         ecfrData = await getApplicableECFRData(applicableParts, searchTerm);
//       }
//     }
    
//     // Create profile
//     const deviceProfile = createEnhancedProfile(searchTerm, fdaData, ecfrData, applicableParts, searchMode);
    
//     res.json({
//       searchTerm,
//       searchMode,
//       timestamp: new Date().toISOString(),
//       profile: deviceProfile,
//       data: {
//         fda: fdaData,
//         ecfr: ecfrData,
//         charts: chartsData
//       },
//       applicableParts,
//       sources: {
//         fdaAPIs: Object.keys(fdaData).filter(key => 
//           key !== '_metadata' && fdaData[key].results?.length > 0
//         ),
//         ecfrParts: applicableParts.map(p => `${p.part} - ${p.description}`)
//       }
//     });

//   } catch (error) {
//     console.error('Device intelligence search error:', error);
//     res.status(500).json({ error: 'Internal server error', message: error.message });
//   }
// });


// // Generate interactive charts data
// function generateChartsData(fdaData) {
//   const endpointNames = ['510k', 'pma', 'recalls', 'adverseEvents', 'enforcement', 'registrations', 'udi', 'classification'];
//   const endpointData = [fdaData.fiveOneOk, fdaData.pma, fdaData.recalls, fdaData.adverseEvents, fdaData.enforcement, fdaData.registrations, fdaData.udi, fdaData.classification];
  
//   // Source distribution chart
//   const sourceDistribution = endpointNames.map((name, index) => ({
//     name: name === 'fiveOneOk' ? '510(k)' : name.charAt(0).toUpperCase() + name.slice(1),
//     value: endpointData[index]?.results?.length || 0,
//     color: getChartColor(index)
//   })).filter(item => item.value > 0);

//   // Timeline data (last 5 years)
//   const timelineData = generateTimelineData(fdaData);
  
//   // Device class distribution
//   const classDistribution = generateClassDistribution(fdaData);
  
//   // Safety events over time
//   const safetyTimeline = generateSafetyTimeline(fdaData);

//   return {
//     sourceDistribution,
//     timeline: timelineData,
//     classDistribution,
//     safetyTimeline
//   };
// }

// function getChartColor(index) {
//   const colors = ['#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#6B7280'];
//   return colors[index % colors.length];
// }

// function generateTimelineData(fdaData) {
//   const years = {};
//   const currentYear = new Date().getFullYear();
  
//   // Initialize last 5 years
//   for (let i = 4; i >= 0; i--) {
//     const year = currentYear - i;
//     years[year] = { year, clearances: 0, recalls: 0, adverseEvents: 0 };
//   }
  
//   // Count 510k clearances by year
//   if (fdaData.fiveOneOk?.results) {
//     fdaData.fiveOneOk.results.forEach(item => {
//       if (item.decision_date) {
//         const year = new Date(item.decision_date).getFullYear();
//         if (years[year]) {
//           years[year].clearances++;
//         }
//       }
//     });
//   }
  
//   // Count PMA approvals by year
//   if (fdaData.pma?.results) {
//     fdaData.pma.results.forEach(item => {
//       if (item.decision_date) {
//         const year = new Date(item.decision_date).getFullYear();
//         if (years[year]) {
//           years[year].clearances++;
//         }
//       }
//     });
//   }
  
//   // Count recalls by year
//   if (fdaData.recalls?.results) {
//     fdaData.recalls.results.forEach(item => {
//       if (item.event_date_initiated) {
//         const year = new Date(item.event_date_initiated).getFullYear();
//         if (years[year]) {
//           years[year].recalls++;
//         }
//       }
//     });
//   }
  
//   // Count adverse events by year
//   if (fdaData.adverseEvents?.results) {
//     fdaData.adverseEvents.results.forEach(item => {
//       if (item.date_received) {
//         const year = new Date(item.date_received).getFullYear();
//         if (years[year]) {
//           years[year].adverseEvents++;
//         }
//       }
//     });
//   }
  
//   return Object.values(years);
// }

// function generateClassDistribution(fdaData) {
//   const classes = { 'I': 0, 'II': 0, 'III': 0, 'Unknown': 0 };
  
//   [fdaData.classification, fdaData.fiveOneOk, fdaData.pma].forEach(dataset => {
//     if (dataset?.results) {
//       dataset.results.forEach(item => {
//         const deviceClass = item.device_class || item.openfda?.device_class;
//         if (deviceClass) {
//           if (classes[deviceClass] !== undefined) {
//             classes[deviceClass]++;
//           } else {
//             classes['Unknown']++;
//           }
//         } else {
//           classes['Unknown']++;
//         }
//       });
//     }
//   });
  
//   return Object.entries(classes)
//     .filter(([key, value]) => value > 0)
//     .map(([key, value]) => ({
//       name: `Class ${key}`,
//       value,
//       color: key === 'I' ? '#10B981' : key === 'II' ? '#F59E0B' : key === 'III' ? '#EF4444' : '#6B7280'
//     }));
// }

// function generateSafetyTimeline(fdaData) {
//   const months = {};
//   const currentDate = new Date();
  
//   // Initialize last 12 months
//   for (let i = 11; i >= 0; i--) {
//     const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
//     const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
//     months[key] = { 
//       month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
//       recalls: 0, 
//       adverseEvents: 0 
//     };
//   }
  
//   // Count recalls by month
//   if (fdaData.recalls?.results) {
//     fdaData.recalls.results.forEach(item => {
//       if (item.event_date_initiated) {
//         const date = new Date(item.event_date_initiated);
//         const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
//         if (months[key]) {
//           months[key].recalls++;
//         }
//       }
//     });
//   }
  
//   // Count adverse events by month
//   if (fdaData.adverseEvents?.results) {
//     fdaData.adverseEvents.results.forEach(item => {
//       if (item.date_received) {
//         const date = new Date(item.date_received);
//         const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
//         if (months[key]) {
//           months[key].adverseEvents++;
//         }
//       }
//     });
//   }
  
//   return Object.values(months);
// }






// // Get all FDA data for a device with fallback handling
// // async function getAllFDAData(searchTerm) {
// //   console.log(`Fetching FDA data for: ${searchTerm}`);
  
// //   // Use Promise.allSettled to continue even if some endpoints fail
// //   const results = await Promise.allSettled([
// //     search510k(searchTerm),
// //     searchPMA(searchTerm),
// //     searchRecalls(searchTerm),
// //     searchAdverseEvents(searchTerm),
// //     searchEnforcement(searchTerm),
// //     searchRegistrations(searchTerm),
// //     searchUDI(searchTerm),
// //     searchClassification(searchTerm)
// //   ]);

// //   // Process results and handle failures gracefully
// //   const [
// //     fiveOneOk,
// //     pma,
// //     recalls,
// //     adverseEvents,
// //     enforcement,
// //     registrations,
// //     udi,
// //     classification
// //   ] = results.map(result => {
// //     if (result.status === 'fulfilled') {
// //       return result.value;
// //     } else {
// //       console.error('FDA API call failed:', result.reason.message);
// //       return { results: [], error: result.reason.message };
// //     }
// //   });

// //   // Log successful vs failed endpoints
// //   const successfulEndpoints = [];
// //   const failedEndpoints = [];
  
// //   const endpointNames = ['510k', 'pma', 'recalls', 'adverseEvents', 'enforcement', 'registrations', 'udi', 'classification'];
// //   const endpointResults = [fiveOneOk, pma, recalls, adverseEvents, enforcement, registrations, udi, classification];
  
// //   endpointResults.forEach((result, index) => {
// //     if (result.results && result.results.length > 0) {
// //       successfulEndpoints.push(endpointNames[index]);
// //     } else if (result.error) {
// //       failedEndpoints.push(endpointNames[index]);
// //     }
// //   });
  
// //   console.log(`FDA API Summary - Successful: [${successfulEndpoints.join(', ')}], Failed: [${failedEndpoints.join(', ')}]`);

// //   return {
// //     fiveOneOk,
// //     pma,
// //     recalls,
// //     adverseEvents,
// //     enforcement,
// //     registrations,
// //     udi,
// //     classification,
// //     _metadata: {
// //       successfulEndpoints,
// //       failedEndpoints,
// //       totalEndpoints: endpointNames.length
// //     }
// //   };
// // }

// // Updated getAllFDAData function with configurable max results
// // async function getAllFDAData(searchTerm, maxResults = 1000) {
// //   console.log(`Fetching FDA data for: ${searchTerm} (max ${maxResults} per endpoint)`);
  
// //   // Use Promise.allSettled to continue even if some endpoints fail
// //   const results = await Promise.allSettled([
// //     search510k(searchTerm, maxResults),
// //     searchPMA(searchTerm, maxResults),
// //     searchRecalls(searchTerm, maxResults),
// //     searchAdverseEvents(searchTerm, maxResults),
// //     searchEnforcement(searchTerm, maxResults),
// //     searchRegistrations(searchTerm, maxResults),
// //     searchUDI(searchTerm, maxResults),
// //     searchClassification(searchTerm, maxResults)
// //   ]);

// //   // Process results and handle failures gracefully
// //   const [
// //     fiveOneOk,
// //     pma,
// //     recalls,
// //     adverseEvents,
// //     enforcement,
// //     registrations,
// //     udi,
// //     classification
// //   ] = results.map(result => {
// //     if (result.status === 'fulfilled') {
// //       return result.value;
// //     } else {
// //       console.error('FDA API call failed:', result.reason.message);
// //       return { results: [], error: result.reason.message, meta: { totalFetched: 0 } };
// //     }
// //   });

// //   // Log successful vs failed endpoints with counts  
// //   const successfulEndpoints = [];
// //   const failedEndpoints = [];
  
// //   const endpointNames = ['510k', 'pma', 'recalls', 'adverseEvents', 'enforcement', 'registrations', 'udi', 'classification'];
// //   const endpointResults = [fiveOneOk, pma, recalls, adverseEvents, enforcement, registrations, udi, classification];
  
// //   let totalRecords = 0;
// //   endpointResults.forEach((result, index) => {
// //     const count = result.results?.length || 0;
// //     totalRecords += count;
    
// //     if (count > 0) {
// //       successfulEndpoints.push(`${endpointNames[index]} (${count})`);
// //     } else if (result.error) {
// //       failedEndpoints.push(endpointNames[index]);
// //     }
// //   });
  
// //   console.log(`FDA API Summary - Total Records: ${totalRecords}`);
// //   console.log(`Successful: [${successfulEndpoints.join(', ')}]`);
// //   if (failedEndpoints.length > 0) {
// //     console.log(`Failed: [${failedEndpoints.join(', ')}]`);
// //   }

// //   return {
// //     fiveOneOk,
// //     pma,
// //     recalls,
// //     adverseEvents,
// //     enforcement,
// //     registrations,
// //     udi,
// //     classification,
// //     _metadata: {
// //       successfulEndpoints,
// //       failedEndpoints,
// //       totalEndpoints: endpointNames.length,
// //       totalRecords,
// //       maxResultsPerEndpoint: maxResults
// //     }
// //   };
// // }


// // Identify applicable eCFR parts based on FDA data
// function identifyApplicableECFRParts(fdaData, searchTerm) {
//   const partMapping = {
//     '862': { description: 'Clinical Chemistry and Clinical Toxicology Devices', keywords: ['chemistry', 'toxicology', 'blood', 'urine', 'clinical', 'laboratory', 'analyzer', 'glucose', 'cholesterol'] },
//     '864': { description: 'Hematology and Pathology Devices', keywords: ['hematology', 'pathology', 'blood', 'cell', 'microscope', 'centrifuge', 'hemoglobin'] },
//     '866': { description: 'Immunology and Microbiology Devices', keywords: ['immunology', 'microbiology', 'bacteria', 'virus', 'culture', 'antibody', 'antigen', 'test'] },
//     '868': { description: 'Anesthesiology Devices', keywords: ['anesthesia', 'anesthetic', 'ventilator', 'breathing', 'airway', 'oxygen', 'gas'] },
//     '870': { description: 'Cardiovascular Devices', keywords: ['heart', 'cardiac', 'cardiovascular', 'pacemaker', 'defibrillator', 'stent', 'catheter', 'blood pressure', 'ecg', 'ekg'] },
//     '872': { description: 'Dental Devices', keywords: ['dental', 'tooth', 'teeth', 'oral', 'mouth', 'gum', 'implant', 'filling', 'crown', 'bridge'] },
//     '874': { description: 'Ear, Nose, and Throat Devices', keywords: ['ear', 'nose', 'throat', 'hearing', 'ent', 'otolaryngology', 'cochlear', 'tinnitus', 'sinus'] },
//     '876': { description: 'Gastroenterology-Urology Devices', keywords: ['gastro', 'urology', 'stomach', 'kidney', 'bladder', 'endoscope', 'catheter', 'dialysis'] },
//     '878': { description: 'General and Plastic Surgery Devices', keywords: ['surgery', 'surgical', 'scalpel', 'suture', 'implant', 'plastic', 'cosmetic'] },
//     '880': { description: 'General Hospital and Personal Use Devices', keywords: ['hospital', 'bed', 'wheelchair', 'thermometer', 'syringe', 'bandage', 'personal'] },
//     '882': { description: 'Neurological Devices', keywords: ['neuro', 'brain', 'nerve', 'spinal', 'stimulator', 'electrode', 'eeg', 'epilepsy'] },
//     '884': { description: 'Obstetrical and Gynecological Devices', keywords: ['obstetric', 'gynecological', 'pregnancy', 'fetal', 'contraceptive', 'menstrual'] },
//     '886': { description: 'Ophthalmic Devices', keywords: ['eye', 'ophthalmic', 'vision', 'lens', 'contact', 'retina', 'glaucoma', 'cataract'] },
//     '888': { description: 'Orthopedic Devices', keywords: ['orthopedic', 'bone', 'joint', 'hip', 'knee', 'spine', 'fracture', 'prosthetic'] },
//     '890': { description: 'Physical Medicine Devices', keywords: ['physical', 'rehabilitation', 'therapy', 'exercise', 'mobility', 'walker', 'crutch'] },
//     '892': { description: 'Radiology Devices', keywords: ['radiology', 'x-ray', 'mri', 'ct', 'ultrasound', 'imaging', 'scanner', 'radiation'] }
//   };

//   const applicableParts = [];
//   const searchText = searchTerm.toLowerCase();
  
//   // Check direct keyword matches
//   Object.entries(partMapping).forEach(([part, info]) => {
//     const score = info.keywords.filter(keyword => 
//       searchText.includes(keyword) || keyword.includes(searchText)
//     ).length;
    
//     if (score > 0) {
//       applicableParts.push({
//         part,
//         description: info.description,
//         relevanceScore: score,
//         matchType: 'keyword'
//       });
//     }
//   });

//   // Check FDA data for regulation numbers and product codes
//   Object.values(fdaData).forEach(dataset => {
//     if (dataset.results) {
//       dataset.results.forEach(item => {
//         // Check regulation numbers
//         const regNumber = item.regulation_number || item.openfda?.regulation_number;
//         if (regNumber) {
//           const part = regNumber.split('.')[0];
//           if (partMapping[part] && !applicableParts.find(p => p.part === part)) {
//             applicableParts.push({
//               part,
//               description: partMapping[part].description,
//               relevanceScore: 10, // High score for direct regulation match
//               matchType: 'regulation',
//               regulationNumber: regNumber
//             });
//           }
//         }

//         // Check medical specialty
//         const specialty = item.medical_specialty_description || item.openfda?.medical_specialty_description;
//         if (specialty) {
//           Object.entries(partMapping).forEach(([part, info]) => {
//             if (info.description.toLowerCase().includes(specialty.toLowerCase()) ||
//                 specialty.toLowerCase().includes(info.description.toLowerCase())) {
//               if (!applicableParts.find(p => p.part === part)) {
//                 applicableParts.push({
//                   part,
//                   description: info.description,
//                   relevanceScore: 8,
//                   matchType: 'specialty',
//                   specialty
//                 });
//               }
//             }
//           });
//         }
//       });
//     }
//   });

//   // Sort by relevance score and return top matches
//   return applicableParts
//     .sort((a, b) => b.relevanceScore - a.relevanceScore)
//     .slice(0, 5); // Limit to top 5 most relevant parts
// }

// // Get eCFR data for applicable parts
// async function getApplicableECFRData(applicableParts, searchTerm) {
//   const ecfrData = {};
  
//   for (const partInfo of applicableParts) {
//     try {
//       console.log(`Fetching eCFR Part ${partInfo.part}: ${partInfo.description}`);
      
//       // Get the complete part document
//       const partDocument = await getCompleteECFRPart(partInfo.part);
      
//       if (partDocument) {
//         // Search within the part for relevant sections
//         const searchResults = searchWithinECFRPart(partDocument, searchTerm);
        
//         ecfrData[partInfo.part] = {
//           partInfo,
//           document: partDocument,
//           searchResults,
//           relevantSections: searchResults.slice(0, 10) // Top 10 most relevant sections
//         };
//       }
//     } catch (error) {
//       console.error(`Error fetching eCFR Part ${partInfo.part}:`, error.message);
//     }
//   }
  
//   return ecfrData;
// }

// // Create comprehensive device profile
// function createDeviceProfile(searchTerm, fdaData, ecfrData, applicableParts) {
//   const profile = {
//     deviceName: searchTerm,
//     overview: {
//       totalFDARecords: 0,
//       regulatoryComplexity: 'Unknown',
//       primaryClassification: 'Unknown',
//       marketStatus: 'Unknown'
//     },
//     regulatory: {
//       applicableParts: applicableParts.length,
//       deviceClasses: [],
//       pathways: [],
//       exemptions: []
//     },
//     safety: {
//       recallCount: 0,
//       adverseEventCount: 0,
//       riskLevel: 'Unknown'
//     },
//     market: {
//       active510k: 0,
//       activePMA: 0,
//       currentRegistrations: 0,
//       udiRecords: 0
//     },
//     recommendations: [],
//     keyRegulations: [],
//     applicableStandards: []
//   };

//   // Analyze FDA data
//   Object.entries(fdaData).forEach(([key, data]) => {
//     if (data.results?.length > 0) {
//       profile.overview.totalFDARecords += data.results.length;
      
//       if (key === 'recalls') profile.safety.recallCount = data.results.length;
//       if (key === 'adverseEvents') profile.safety.adverseEventCount = data.results.length;
//       if (key === 'fiveOneOk') profile.market.active510k = data.results.length;
//       if (key === 'pma') profile.market.activePMA = data.results.length;
//       if (key === 'registrations') profile.market.currentRegistrations = data.results.length;
//       if (key === 'udi') profile.market.udiRecords = data.results.length;
//     }
//   });

//   // Analyze eCFR data
//   Object.values(ecfrData).forEach(partData => {
//     if (partData.searchResults?.length > 0) {
//       partData.searchResults.forEach(result => {
//         if (result.deviceClass && !profile.regulatory.deviceClasses.includes(result.deviceClass)) {
//           profile.regulatory.deviceClasses.push(result.deviceClass);
//         }
//       });
      
//       // Extract key regulations
//       profile.keyRegulations.push(...partData.searchResults.slice(0, 3).map(result => ({
//         section: result.section,
//         title: result.title,
//         deviceClass: result.deviceClass,
//         part: partData.partInfo.part,
//         url: result.url
//       })));
//     }
//   });

//   // Determine regulatory pathways
//   if (profile.regulatory.deviceClasses.includes('III')) {
//     profile.regulatory.pathways.push('PMA (Premarket Approval)');
//     profile.overview.regulatoryComplexity = 'High';
//   }
//   if (profile.regulatory.deviceClasses.includes('II')) {
//     profile.regulatory.pathways.push('510(k) Clearance');
//     if (profile.overview.regulatoryComplexity === 'Unknown') {
//       profile.overview.regulatoryComplexity = 'Medium';
//     }
//   }
//   if (profile.regulatory.deviceClasses.includes('I')) {
//     profile.regulatory.pathways.push('Class I (Minimal Requirements)');
//     if (profile.overview.regulatoryComplexity === 'Unknown') {
//       profile.overview.regulatoryComplexity = 'Low';
//     }
//   }

//   // Determine primary classification
//   if (profile.regulatory.deviceClasses.length > 0) {
//     profile.overview.primaryClassification = `Class ${profile.regulatory.deviceClasses.sort().reverse()[0]}`;
//   }

//   // Risk assessment
//   if (profile.safety.recallCount > 5 || profile.safety.adverseEventCount > 10) {
//     profile.safety.riskLevel = 'High';
//   } else if (profile.safety.recallCount > 0 || profile.safety.adverseEventCount > 0) {
//     profile.safety.riskLevel = 'Medium';
//   } else {
//     profile.safety.riskLevel = 'Low';
//   }

//   // Market status
//   if (profile.market.active510k > 0 || profile.market.activePMA > 0) {
//     profile.overview.marketStatus = 'FDA Cleared/Approved';
//   } else if (profile.market.currentRegistrations > 0) {
//     profile.overview.marketStatus = 'Registered';
//   } else {
//     profile.overview.marketStatus = 'Unknown';
//   }

//   // Generate recommendations
//   if (profile.regulatory.deviceClasses.includes('III')) {
//     profile.recommendations.push('PMA required - Plan 2-3+ years for approval process');
//     profile.recommendations.push('Extensive clinical trials likely required');
//   } else if (profile.regulatory.deviceClasses.includes('II')) {
//     profile.recommendations.push('510(k) pathway available - Identify predicate devices');
//   }

//   if (profile.safety.riskLevel === 'High') {
//     profile.recommendations.push('Conduct thorough safety analysis before development');
//   }

//   if (applicableParts.length > 2) {
//     profile.recommendations.push('Multiple CFR parts apply - Review all applicable regulations');
//   }

//   return profile;
// }

// module.exports = router;