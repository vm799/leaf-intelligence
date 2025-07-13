// Enhanced pubmed.js - Backend API handler for PubMed search requests
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const axios = require('axios');



/**
 * Rate limiter to prevent API overload
 */
class PubMedRateLimiter {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.lastRequestTime = 0;
    this.minDelay = 1000; // 1 second between requests
  }

  async executeRequest(requestFunction) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFunction, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const { requestFunction, resolve, reject } = this.queue.shift();
      
      try {
        // Ensure minimum delay between requests
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minDelay) {
          const delay = this.minDelay - timeSinceLastRequest;
          console.log(`Rate limiting: waiting ${delay}ms before next request`);
          await new Promise(r => setTimeout(r, delay));
        }

        this.lastRequestTime = Date.now();
        const result = await requestFunction();
        resolve(result);
        
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }
}

// Create global rate limiter instance
const rateLimiter = new PubMedRateLimiter();

/**
 * Main handler for PubMed search requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handlePubMedSearch(req, res) {
  try {
    // Extract query parameters
    const {
      term = '',
      page = 1,
      sortBy = 'relevance',
      fullTextOnly = false,
      yearFilter = '',
      journalFilter = '',
      expandSearch = true,
      searchType = 'auto' // 'drug', 'condition', 'both', or 'auto' (detect)
    } = req.query;

    // Base URL for PubMed E-utilities
    const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    
    // Your NCBI API key - use environment variable
    const apiKey = process.env.NCBI_API_KEY || '';
    
    // Create a filter object for reuse
    const filters = {
      yearFilter,
      journalFilter,
      fullTextOnly: fullTextOnly === 'true' || fullTextOnly === true
    };

    // Build sort parameter
    let sortParam = sortBy === 'date' ? 'pub date' : 'relevance';
    
    // Set up the XML parser
    const parser = new xml2js.Parser({ explicitArray: false });
    
    // Calculate pagination parameters
    const retmax = 20;
    const retstart = (page - 1) * retmax;
    
    console.log(`PubMed search initiated with term: ${term}, search type: ${searchType}, page: ${page}`);

    // Determine search type if set to auto
    let effectiveSearchType = searchType;
    if (searchType === 'auto') {
      effectiveSearchType = determineSearchType(term);
    }
    
    // Create search query based on search type
    let searchQuery = '';
    let isExpandableSearch = false;

    switch (effectiveSearchType) {
      case 'drug':
        searchQuery = buildDrugSearchQuery(term);
        isExpandableSearch = true;
        break;
      case 'condition':
        searchQuery = buildConditionSearchQuery(term);
        break;
      case 'both':
        searchQuery = buildCombinedSearchQuery(term);
        break;
      default:
        // Generic fallback
        searchQuery = term;
    }

    // Apply filters to search query
    searchQuery = applyFiltersToQuery(searchQuery, filters);

    console.log(`Using search query: ${searchQuery}`);

    // First, try the original search
    const searchResponse = await performPubMedSearch(
      baseUrl, 
      searchQuery, 
      retmax, 
      retstart, 
      sortParam, 
      apiKey, 
      parser
    );
    
    // Check if we have sufficient results
    const hasResults = searchResponse.idList && searchResponse.idList.length > 0;
    const totalResults = parseInt(searchResponse.count, 10) || 0;
    
    // If we have results or this isn't a drug search that can be expanded, process normally
    if (hasResults || !isExpandableSearch || !expandSearch || totalResults >= 5) {
      // Fetch full article details
      const articles = await fetchArticleDetails(
        baseUrl, 
        searchResponse.idList || [], 
        apiKey, 
        parser
      );
      
      return res.json({
        articles,
        totalResults,
        searchExpanded: false,
        originalTerm: term,
        searchType: effectiveSearchType
      });
    }
    
    // If we reach here, the original search didn't find enough results
    // and this is an expandable search (drug search)
    console.log(`Insufficient results (${totalResults}). Expanding search for related drugs.`);
    
    // Extract drug name
    const baseDrugName = extractDrugNameFromQuery(term);
    
    // Get related drug details
    const drugDetails = await getAllDrugDetails(baseDrugName);
    
    // Organize drug data
    const allDrugData = organizeDrugData(baseDrugName, drugDetails);
    
    // Get list of drug names to search with
    let relatedDrugs = [baseDrugName, ...allDrugData.allRelatedDrugs.map(d => d.name)];
    
    // Deduplicate and filter
    relatedDrugs = [...new Set(relatedDrugs)].filter(name => {
      // Apply filters for valid search terms
      if (!name || name.trim().length < 3) return false;
      
      // Skip very specific technical identifiers
      if (/[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+/.test(name)) return false;
      if (/^[A-Z]+\d+$/.test(name)) return false;
      if (name.length > 50) return false;
      
      return true;
    });

    // Prioritize more promising drug name formats
    relatedDrugs.sort((a, b) => {
      // Prioritize formats like "BMS 820836" or shorter names
      const aScore = (a.includes(' ') && /[A-Z]+\s\d+/.test(a)) ? 1 : 
                   (a.length < 15 ? 2 : 3);
      const bScore = (b.includes(' ') && /[A-Z]+\s\d+/.test(b)) ? 1 : 
                   (b.length < 15 ? 2 : 3);
      return aScore - bScore;
    });
    
    // Limit the number of searches to prevent API overload
    if (relatedDrugs.length > 10) {
      console.log(`Limiting from ${relatedDrugs.length} to 10 drugs for search`);
      relatedDrugs = relatedDrugs.slice(0, 10);
    }
    
    console.log(`Searching with these drug names: ${relatedDrugs.join(', ')}`);
    
    // Search for each drug with multiple strategies
    const searchPromises = relatedDrugs.map(drugName => 
      searchPubMedWithDrugName(baseUrl, drugName, filters, sortParam, apiKey, parser)
    );
    
    // Collect all search results
    const searchResults = await Promise.all(searchPromises);
    
    // Aggregate all articles and metadata
    const allArticles = new Map();
    const drugResultCounts = {};
    const successfulStrategies = {};
    
    searchResults.forEach((result, index) => {
      const drugName = relatedDrugs[index];
      drugResultCounts[drugName] = result.totalFound;
      
      if (result.successfulStrategy) {
        successfulStrategies[drugName] = result.successfulStrategy;
      }
      
      result.articles.forEach(article => {
        if (!allArticles.has(article.pmid)) {
          allArticles.set(article.pmid, article);
        }
      });
    });
    
    // Convert to array and paginate
    const combinedArticles = Array.from(allArticles.values());
    const paginatedArticles = combinedArticles.slice(retstart, retstart + retmax);
    
    // Return expanded search results
    return res.json({
      articles: paginatedArticles,
      totalResults: combinedArticles.length,
      searchExpanded: true,
      originalTerm: term,
      baseDrugName: baseDrugName,
      expandedWithDrugs: relatedDrugs,
      drugResultCounts: drugResultCounts,
      successfulStrategies: successfulStrategies,
      drugData: allDrugData,
      searchType: effectiveSearchType
    });
    
  } catch (error) {
    console.error('PubMed API error:', error);
    res.status(500).json({ 
      error: 'Error fetching data from PubMed',
      message: error.message
    });
  }
}


/**
 * Handle custom fulltext PubMed search requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleCustomPubMedSearch(req, res) {
  try {
    // Extract query parameters
    const {
      query = '',
      page = 1,
      sortBy = 'relevance',
      fullTextOnly = true,
      yearFilter = '',
      journalFilter = ''
    } = req.query;

    // Base URL for PubMed E-utilities
    const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    
    // Your NCBI API key - use environment variable
    const apiKey = process.env.NCBI_API_KEY || '';
    
    // Create a filter object for reuse
    const filters = {
      yearFilter,
      journalFilter,
      fullTextOnly: fullTextOnly === 'true' || fullTextOnly === true
    };

    // Build sort parameter
    let sortParam = sortBy === 'date' ? 'pub date' : 'relevance';
    
    // Set up the XML parser
    const parser = new xml2js.Parser({ explicitArray: false });
    
    // Calculate pagination parameters
    const retmax = 20;
    const retstart = (page - 1) * retmax;
    
    console.log(`PubMed custom search initiated with query: ${query}, page: ${page}`);

    // Start with the raw query provided by user
    let searchQuery = query;
    
    // Apply filters to search query
    searchQuery = applyFiltersToQuery(searchQuery, filters);

    console.log(`Using search query: ${searchQuery}`);

    // Perform the PubMed search
    const searchResponse = await performPubMedSearch(
      baseUrl, 
      searchQuery, 
      retmax, 
      retstart, 
      sortParam, 
      apiKey, 
      parser
    );
    
    // Check if we have results
    const hasResults = searchResponse.idList && searchResponse.idList.length > 0;
    const totalResults = parseInt(searchResponse.count, 10) || 0;
    
    // Fetch full article details
    const articles = await fetchArticleDetails(
      baseUrl, 
      searchResponse.idList || [], 
      apiKey, 
      parser
    );
    
    return res.json({
      articles,
      totalResults,
      originalQuery: query
    });
    
  } catch (error) {
    console.error('PubMed API error:', error);
    res.status(500).json({ 
      error: 'Error fetching data from PubMed',
      message: error.message
    });
  }
}
/**
 * Determines the search type based on the query term
 * @param {string} term - The search term
 * @returns {string} - The detected search type: 'drug', 'condition', or 'both'
 */
function determineSearchType(term) {
  // Split by 'AND' to check if there might be both drug and condition
  const parts = term.split(/\s+AND\s+/i);
  
  if (parts.length > 1) {
    return 'both';
  }
  
  // Check for common patterns that suggest a drug
  const drugPatterns = [
    /[A-Z][a-z]*mycin$/i,  // antibiotics (e.g., erythromycin)
    /[A-Z][a-z]*cillin$/i, // penicillins
    /[A-Z][a-z]*olol$/i,   // beta blockers
    /[A-Z][a-z]*pril$/i,   // ACE inhibitors
    /[A-Z][a-z]*sartan$/i, // ARBs
    /[A-Z][a-z]*statin$/i, // statins
    /[A-Z][a-z]*zole$/i,   // antifungals
    /[A-Z][a-z]*zumab$/i,  // monoclonal antibodies
    /[A-Z][a-z]*mab$/i,    // monoclonal antibodies
    /\d+\s?mg/i,           // dosage specification
    /tablet|capsule|injection|infusion|solution/i, // dosage forms
  ];
  
  for (const pattern of drugPatterns) {
    if (pattern.test(term)) {
      return 'drug';
    }
  }
  
  // Check for patterns that suggest a medical condition
  const conditionPatterns = [
    /syndrome|disease|disorder|infection|deficiency|cancer|carcinoma|tumor|^COVID|depression|diabetes|hypertension|asthma|arthritis/i
  ];
  
  for (const pattern of conditionPatterns) {
    if (pattern.test(term)) {
      return 'condition';
    }
  }
  
  // Default to drug if no specific pattern is recognized
  return 'drug';
}

/**
 * Builds a search query optimized for drug searches
 * @param {string} drugName - The drug name
 * @returns {string} - The formatted search query
 */
function buildDrugSearchQuery(drugName) {
  // Clean up the drug name
  const cleanDrugName = drugName.trim().replace(/\s+/g, ' ');
  
  // Create an optimized query for drugs
  return `("${cleanDrugName}"[Title/Abstract] OR "${cleanDrugName}"[MeSH Terms] OR "${cleanDrugName}"[Substance] OR "${cleanDrugName}"[Pharmacological Action])`;
}

/**
 * Builds a search query optimized for medical condition searches
 * @param {string} condition - The medical condition
 * @returns {string} - The formatted search query
 */
function buildConditionSearchQuery(condition) {
  // Clean up the condition name
  const cleanCondition = condition.trim().replace(/\s+/g, ' ');
  
  // Create an optimized query for conditions
  return `("${cleanCondition}"[Title/Abstract] OR "${cleanCondition}"[MeSH Terms] OR "${cleanCondition}"[Disease] OR "${cleanCondition} disease"[Title/Abstract] OR "${cleanCondition} syndrome"[Title/Abstract])`;
}

/**
 * Builds a combined search query for both drug and condition
 * @param {string} term - The search term containing both drug and condition
 * @returns {string} - The formatted combined search query
 */
function buildCombinedSearchQuery(term) {
  // Try to split term into drug and condition
  const splitPattern = /\s+AND\s+|\s+FOR\s+|\s+IN\s+/i;
  const parts = term.split(splitPattern);
  
  if (parts.length === 2) {
    // Assume first part is drug, second is condition
    const drug = parts[0].trim();
    const condition = parts[1].trim();
    
    // Build query that requires both terms
    return `(${buildDrugSearchQuery(drug)}) AND (${buildConditionSearchQuery(condition)})`;
  }
  
  // If we can't split it cleanly, just use the term as is
  return term;
}

/**
 * Applies filters to a search query
 * @param {string} query - The base search query
 * @param {Object} filters - The filter options
 * @returns {string} - The query with filters applied
 */
function applyFiltersToQuery(query, filters) {
  let modifiedQuery = query;
  
  // Add year filter if provided
  if (filters.yearFilter) {
    modifiedQuery += ` AND ${filters.yearFilter}[pdat]`;
  }
  
  // Add journal filter if provided
  if (filters.journalFilter) {
    modifiedQuery += ` AND "${filters.journalFilter}"[journal]`;
  }
  
  // Add full text filter if requested
  if (filters.fullTextOnly) {
    modifiedQuery += ' AND free full text[filter]';
  }
  
  return modifiedQuery;
}

/**
 * Performs a search on PubMed
 * @param {string} baseUrl - The base URL for PubMed API
 * @param {string} query - The search query
 * @param {number} retmax - Maximum number of results to return
 * @param {number} retstart - Starting index for results
 * @param {string} sortParam - Sort parameter
 * @param {string} apiKey - NCBI API key
 * @param {Object} parser - XML parser
 * @returns {Object} - Search results
 */
async function performPubMedSearch(baseUrl, query, retmax, retstart, sortParam, apiKey, parser) {
  const maxRetries = 5;
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      const searchUrl = `${baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${retmax}&retstart=${retstart}&sort=${encodeURIComponent(sortParam)}&usehistory=y${apiKey ? `&api_key=${apiKey}` : ''}`;
      
      const response = await fetch(searchUrl, { 
        timeout: 30000,  // 30 second timeout
        headers: {
          'User-Agent': 'Your-App-Name/1.0 (your@email.com)'  // Identifying your application
        }
      });
      
      if (!response.ok) {
        throw new Error(`PubMed search API responded with status: ${response.status}`);
      }
      
      const data = await response.text();
      const result = await parser.parseStringPromise(data);
      
      // Extract IDs and count
      let idList = [];
      let count = 0;
      
      if (result.eSearchResult) {
        count = parseInt(result.eSearchResult.Count, 10) || 0;
        
        if (result.eSearchResult.IdList && result.eSearchResult.IdList.Id) {
          idList = Array.isArray(result.eSearchResult.IdList.Id) 
            ? result.eSearchResult.IdList.Id
            : [result.eSearchResult.IdList.Id];
        }
      }
      
      return {
        idList,
        count
      };
    } catch (error) {
      retries++;
      
      if (retries > maxRetries) {
        console.error(`Failed to connect to PubMed after ${maxRetries} attempts: ${error.message}`);
        throw error;
      }
      
      // Exponential backoff - wait 2^retries * 1000ms before retrying
      const delay = Math.pow(2, retries) * 1000; 
      console.log(`PubMed API request failed (attempt ${retries}/${maxRetries}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Fetches full article details from PubMed
 * @param {string} baseUrl - The base URL for PubMed API
 * @param {Array} ids - Article IDs to fetch
 * @param {string} apiKey - NCBI API key
 * @param {Object} parser - XML parser
 * @returns {Array} - Array of processed article objects
 */
async function fetchArticleDetails(baseUrl, ids, apiKey, parser) {
  if (!ids.length) {
    return [];
  }
  
  const fetchUrl = `${baseUrl}/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml${apiKey ? `&api_key=${apiKey}` : ''}`;
  const fetchResponse = await fetch(fetchUrl);
  
  if (!fetchResponse.ok) {
    throw new Error(`PubMed fetch API responded with status: ${fetchResponse.status}`);
  }
  
  const fetchData = await fetchResponse.text();
  const fetchResult = await parser.parseStringPromise(fetchData);
  
  if (!fetchResult.PubmedArticleSet || !fetchResult.PubmedArticleSet.PubmedArticle) {
    return [];
  }
  
  const pubmedArticles = Array.isArray(fetchResult.PubmedArticleSet.PubmedArticle) 
    ? fetchResult.PubmedArticleSet.PubmedArticle 
    : [fetchResult.PubmedArticleSet.PubmedArticle];
  
  // Process articles using the same logic as before
  return pubmedArticles.map(article => {
    const medlineCitation = article.MedlineCitation;
    const pmid = medlineCitation.PMID ? medlineCitation.PMID._ || medlineCitation.PMID : '';
    const articleData = medlineCitation.Article;
    
    if (!articleData) return null;
    
    const title = articleData.ArticleTitle ? 
      (typeof articleData.ArticleTitle === 'string' ? articleData.ArticleTitle : articleData.ArticleTitle._) : 
      'No title available';
    
    const journal = articleData.Journal ? 
      (articleData.Journal.Title || 'Journal not specified') : 
      'Journal not specified';
    
    let pubDate = '';
    if (articleData.Journal && articleData.Journal.JournalIssue && articleData.Journal.JournalIssue.PubDate) {
      const pubDateObj = articleData.Journal.JournalIssue.PubDate;
      if (pubDateObj.Year) {
        pubDate = pubDateObj.Year;
        if (pubDateObj.Month) {
          pubDate = `${pubDateObj.Month} ${pubDate}`;
          if (pubDateObj.Day) {
            pubDate = `${pubDateObj.Day} ${pubDate}`;
          }
        }
      } else if (pubDateObj.MedlineDate) {
        pubDate = pubDateObj.MedlineDate;
      }
    }
    
    let authors = [];
    if (articleData.AuthorList && articleData.AuthorList.Author) {
      const authorList = Array.isArray(articleData.AuthorList.Author) ? 
        articleData.AuthorList.Author : 
        [articleData.AuthorList.Author];
      
      authors = authorList.map(author => {
        if (author.LastName && author.ForeName) {
          return `${author.LastName} ${author.ForeName.charAt(0)}`;
        } else if (author.LastName) {
          return author.LastName;
        } else if (author.CollectiveName) {
          return author.CollectiveName;
        }
        return '';
      }).filter(Boolean);
    }
    
    let abstract = '';
    if (articleData.Abstract && articleData.Abstract.AbstractText) {
      if (Array.isArray(articleData.Abstract.AbstractText)) {
        abstract = articleData.Abstract.AbstractText.map(text => {
          if (typeof text === 'string') return text;
          return text._ || '';
        }).join(' ');
      } else if (typeof articleData.Abstract.AbstractText === 'string') {
        abstract = articleData.Abstract.AbstractText;
      } else if (articleData.Abstract.AbstractText._) {
        abstract = articleData.Abstract.AbstractText._;
      }
    }
    
    let keywords = [];
    if (medlineCitation.KeywordList && medlineCitation.KeywordList.Keyword) {
      keywords = Array.isArray(medlineCitation.KeywordList.Keyword) ? 
        medlineCitation.KeywordList.Keyword.map(k => typeof k === 'string' ? k : k._) : 
        [typeof medlineCitation.KeywordList.Keyword === 'string' ? 
          medlineCitation.KeywordList.Keyword : 
          medlineCitation.KeywordList.Keyword._];
    }
    
    let meshTerms = [];
    if (medlineCitation.MeshHeadingList && medlineCitation.MeshHeadingList.MeshHeading) {
      const meshHeadings = Array.isArray(medlineCitation.MeshHeadingList.MeshHeading) ? 
        medlineCitation.MeshHeadingList.MeshHeading : 
        [medlineCitation.MeshHeadingList.MeshHeading];
      
      meshTerms = meshHeadings.map(heading => {
        if (heading.DescriptorName) {
          return typeof heading.DescriptorName === 'string' ? 
            heading.DescriptorName : 
            heading.DescriptorName._ || '';
        }
        return '';
      }).filter(Boolean);
    }
    
    let doi = '';
    if (articleData.ELocationID) {
      const elocations = Array.isArray(articleData.ELocationID) ? 
        articleData.ELocationID : 
        [articleData.ELocationID];
      
      const doiLocation = elocations.find(loc => 
        loc.$ && loc.$.EIdType === 'doi'
      );
      
      if (doiLocation) {
        doi = doiLocation._ || doiLocation;
      }
    }
    
    let fullTextUrl = '';
    if (article.PubmedData && article.PubmedData.ArticleIdList && article.PubmedData.ArticleIdList.ArticleId) {
      const articleIds = Array.isArray(article.PubmedData.ArticleIdList.ArticleId) ? 
        article.PubmedData.ArticleIdList.ArticleId : 
        [article.PubmedData.ArticleIdList.ArticleId];
      
      const pmcId = articleIds.find(id => id.$ && id.$.IdType === 'pmc');
      if (pmcId) {
        fullTextUrl = `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId._}/`;
      }
    }
    
    return {
      pmid,
      title,
      authors,
      journal,
      pubDate,
      abstract: abstract || 'No abstract available',
      keywords,
      meshTerms,
      doi,
      fullTextUrl
    };
  }).filter(Boolean);
}

/**
 * Enhanced search function for drug names with multiple strategies
 * @param {string} baseUrl - The base URL for PubMed API
 * @param {string} drugName - The drug name to search
 * @param {Object} filters - Search filters
 * @param {string} sortParam - Sort parameter
 * @param {string} apiKey - NCBI API key
 * @param {Object} parser - XML parser
 * @returns {Object} - Search results
 */
async function searchPubMedWithDrugName(baseUrl, drugName, filters, sortParam, apiKey, parser) {
  try {
    // Try different search strategies for each drug name
    const searchStrategies = [
      // Strategy 1: Simple full text search - most likely to work for codes and complex names
      `"${drugName}"`,

      // Strategy 2: Standard search with All Fields
      `"${drugName}"[All Fields]`,

      // Strategy 3: Search in title/abstract explicitly
      `"${drugName}"[Title/Abstract]`,

      // Only try these more specific strategies if the drug name is simple (no brackets, etc.)
      ...(!/[\[\]\(\)]/g.test(drugName) ? [
        // Strategy 4: Try as MeSH term
        `"${drugName}"[MeSH Terms]`,

        // Strategy 5: Try as substance
        `"${drugName}"[Substance]`,

        // Strategy 6: Try as supplementary concept
        `"${drugName}"[Supplementary Concept]`
      ] : [])
    ];

    // Track all articles found with this drug name
    const articlesMap = new Map();
    let totalResultsFound = 0;
    let successfulStrategy = null;

    // Delay between API calls (milliseconds) - increase if getting rate limit errors
    const apiDelay = 1000; // 1 second delay between requests

    // Helper function to introduce delay
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Try each search strategy until we find results
    for (const searchStrategy of searchStrategies) {
      // Construct complete search query with filters
      let completeQuery = searchStrategy;
      
      // Add filters
      if (filters.yearFilter) {
        completeQuery += ` AND ${filters.yearFilter}[pdat]`;
      }
      
      if (filters.journalFilter) {
        completeQuery += ` AND "${filters.journalFilter}"[journal]`;
      }
      
      if (filters.fullTextOnly) {
        completeQuery += ' AND free full text[filter]';
      }
      
      console.log(`Trying search strategy for ${drugName}: ${completeQuery}`);
      
      try {
        // Call the PubMed API with retry logic
        const searchUrl = `${baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(completeQuery)}&retmax=100&retstart=0&sort=${encodeURIComponent(sortParam)}&usehistory=y${apiKey ? `&api_key=${apiKey}` : ''}`;
        
        // Implement retry logic with exponential backoff
        let retries = 0;
        const maxRetries = 3;
        let searchResponse;
        
        while (retries <= maxRetries) {
          try {
            searchResponse = await fetch(searchUrl);
            
            // If we got a 429 (Too Many Requests), wait and retry
            if (searchResponse.status === 429) {
              const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff
              console.log(`Rate limited (429) on attempt ${retries + 1}. Waiting ${waitTime}ms before retry.`);
              await delay(waitTime);
              retries++;
              continue;
            }
            
            // Break out of retry loop if we get a successful response
            break;
          } catch (fetchError) {
            if (retries === maxRetries) throw fetchError;
            retries++;
            await delay(Math.pow(2, retries) * 1000);
          }
        }
        
        if (!searchResponse.ok) {
          console.error(`Error with search strategy ${searchStrategy} for drug ${drugName}: API responded with status ${searchResponse.status}`);
          continue; // Try next strategy
        }
        
        const searchData = await searchResponse.text();
        const searchResult = await parser.parseStringPromise(searchData);
        
        if (!searchResult.eSearchResult || !searchResult.eSearchResult.IdList) {
          console.log(`No results for strategy ${searchStrategy} for drug ${drugName}`);
          continue; // Try next strategy
        }
        
        // Extract article IDs
        let articleIds = [];
        if (searchResult.eSearchResult.IdList.Id) {
          if (Array.isArray(searchResult.eSearchResult.IdList.Id)) {
            articleIds = searchResult.eSearchResult.IdList.Id;
          } else {
            articleIds = [searchResult.eSearchResult.IdList.Id];
          }
        }
        
        if (articleIds.length === 0) {
          continue; // Try next strategy
        }
        
        // We found results with this strategy!
        successfulStrategy = searchStrategy;
        totalResultsFound = parseInt(searchResult.eSearchResult.Count, 10) || 0;
        
        // Wait before making another API call to avoid rate limits
        await delay(apiDelay);
        
        // Fetch full article data - limit batch size to avoid timeouts
        const batchSize = 20;
        let processedArticles = 0;
        
        while (processedArticles < articleIds.length) {
          // Get the next batch of IDs
          const batchIds = articleIds.slice(processedArticles, processedArticles + batchSize);
          
          // Fetch details for this batch
          const fetchUrl = `${baseUrl}/efetch.fcgi?db=pubmed&id=${batchIds.join(',')}&retmode=xml${apiKey ? `&api_key=${apiKey}` : ''}`;
          
          // Apply retry logic for fetch request too
          let fetchRetries = 0;
          let fetchResponse;
          
          while (fetchRetries <= maxRetries) {
            try {
              fetchResponse = await fetch(fetchUrl);
              
              // If we got a 429, wait and retry
              if (fetchResponse.status === 429) {
                const waitTime = Math.pow(2, fetchRetries) * 1000;
                console.log(`Rate limited (429) on fetch attempt ${fetchRetries + 1}. Waiting ${waitTime}ms before retry.`);
                await delay(waitTime);
                fetchRetries++;
                continue;
              }
              
              break; // Success, exit retry loop
            } catch (fetchError) {
              if (fetchRetries === maxRetries) throw fetchError;
              fetchRetries++;
              await delay(Math.pow(2, fetchRetries) * 1000);
            }
          }
          
          if (!fetchResponse.ok) {
            console.error(`Error fetching articles for drug ${drugName}: API responded with status ${fetchResponse.status}`);
            processedArticles += batchSize;
            continue;
          }
          
          const fetchData = await fetchResponse.text();
          const fetchResult = await parser.parseStringPromise(fetchData);
          
          if (!fetchResult.PubmedArticleSet || !fetchResult.PubmedArticleSet.PubmedArticle) {
            processedArticles += batchSize;
            continue;
          }
          
          // Process this batch of articles
          const pubmedArticles = Array.isArray(fetchResult.PubmedArticleSet.PubmedArticle) 
            ? fetchResult.PubmedArticleSet.PubmedArticle 
            : [fetchResult.PubmedArticleSet.PubmedArticle];
          
          // Process articles
          for (const article of pubmedArticles) {
            const medlineCitation = article.MedlineCitation;
            const pmid = medlineCitation.PMID ? medlineCitation.PMID._ || medlineCitation.PMID : '';
            
            if (!pmid || articlesMap.has(pmid)) {
              continue; // Skip if already processed or no PMID
            }
            
            const articleData = medlineCitation.Article;
            if (!articleData) {
              continue;
            }
            
            // Extract article data
            const title = articleData.ArticleTitle ? 
              (typeof articleData.ArticleTitle === 'string' ? articleData.ArticleTitle : articleData.ArticleTitle._) : 
              'No title available';
              const journal = articleData.Journal ? 
              (articleData.Journal.Title || 'Journal not specified') : 
              'Journal not specified';
            
            let pubDate = '';
            if (articleData.Journal && articleData.Journal.JournalIssue && articleData.Journal.JournalIssue.PubDate) {
              const pubDateObj = articleData.Journal.JournalIssue.PubDate;
              if (pubDateObj.Year) {
                pubDate = pubDateObj.Year;
                if (pubDateObj.Month) {
                  pubDate = `${pubDateObj.Month} ${pubDate}`;
                  if (pubDateObj.Day) {
                    pubDate = `${pubDateObj.Day} ${pubDate}`;
                  }
                }
              } else if (pubDateObj.MedlineDate) {
                pubDate = pubDateObj.MedlineDate;
              }
            }
            
            let authors = [];
            if (articleData.AuthorList && articleData.AuthorList.Author) {
              const authorList = Array.isArray(articleData.AuthorList.Author) ? 
                articleData.AuthorList.Author : 
                [articleData.AuthorList.Author];
              
              authors = authorList.map(author => {
                if (author.LastName && author.ForeName) {
                  return `${author.LastName} ${author.ForeName.charAt(0)}`;
                } else if (author.LastName) {
                  return author.LastName;
                } else if (author.CollectiveName) {
                  return author.CollectiveName;
                }
                return '';
              }).filter(Boolean);
            }
            
            let abstract = '';
            if (articleData.Abstract && articleData.Abstract.AbstractText) {
              if (Array.isArray(articleData.Abstract.AbstractText)) {
                abstract = articleData.Abstract.AbstractText.map(text => {
                  if (typeof text === 'string') return text;
                  return text._ || '';
                }).join(' ');
              } else if (typeof articleData.Abstract.AbstractText === 'string') {
                abstract = articleData.Abstract.AbstractText;
              } else if (articleData.Abstract.AbstractText._) {
                abstract = articleData.Abstract.AbstractText._;
              }
            }
            
            let keywords = [];
            if (medlineCitation.KeywordList && medlineCitation.KeywordList.Keyword) {
              keywords = Array.isArray(medlineCitation.KeywordList.Keyword) ? 
                medlineCitation.KeywordList.Keyword.map(k => typeof k === 'string' ? k : k._) : 
                [typeof medlineCitation.KeywordList.Keyword === 'string' ? 
                  medlineCitation.KeywordList.Keyword : 
                  medlineCitation.KeywordList.Keyword._];
            }
            
            let meshTerms = [];
            if (medlineCitation.MeshHeadingList && medlineCitation.MeshHeadingList.MeshHeading) {
              const meshHeadings = Array.isArray(medlineCitation.MeshHeadingList.MeshHeading) ? 
                medlineCitation.MeshHeadingList.MeshHeading : 
                [medlineCitation.MeshHeadingList.MeshHeading];
              
              meshTerms = meshHeadings.map(heading => {
                if (heading.DescriptorName) {
                  return typeof heading.DescriptorName === 'string' ? 
                    heading.DescriptorName : 
                    heading.DescriptorName._ || '';
                }
                return '';
              }).filter(Boolean);
            }
            
            let doi = '';
            if (articleData.ELocationID) {
              const elocations = Array.isArray(articleData.ELocationID) ? 
                articleData.ELocationID : 
                [articleData.ELocationID];
              
              const doiLocation = elocations.find(loc => 
                loc.$ && loc.$.EIdType === 'doi'
              );
              
              if (doiLocation) {
                doi = doiLocation._ || doiLocation;
              }
            }
            
            let fullTextUrl = '';
            if (article.PubmedData && article.PubmedData.ArticleIdList && article.PubmedData.ArticleIdList.ArticleId) {
              const articleIds = Array.isArray(article.PubmedData.ArticleIdList.ArticleId) ? 
                article.PubmedData.ArticleIdList.ArticleId : 
                [article.PubmedData.ArticleIdList.ArticleId];
              
              const pmcId = articleIds.find(id => id.$ && id.$.IdType === 'pmc');
              if (pmcId) {
                fullTextUrl = `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId._}/`;
              }
            }
            
            // Add to map
            articlesMap.set(pmid, {
              pmid,
              title,
              authors,
              journal,
              pubDate,
              abstract: abstract || 'No abstract available',
              keywords,
              meshTerms,
              doi,
              fullTextUrl,
              // Add search metadata
              foundWith: drugName,
              searchStrategy: successfulStrategy
            });
          }
          
          // Update processed count
          processedArticles += batchSize;
          
          // Wait before next batch to avoid rate limits
          if (processedArticles < articleIds.length) {
            await delay(apiDelay);
          }
        }
        
        // If we found articles with this strategy, no need to try others
        if (articlesMap.size > 0) {
          console.log(`Found ${articlesMap.size} articles for drug ${drugName} using strategy: ${successfulStrategy}`);
          break;
        }
      } catch (strategyError) {
        console.error(`Error with strategy "${searchStrategy}" for ${drugName}:`, strategyError);
      }
      
      // Wait between search strategies to avoid rate limits
      await delay(apiDelay);
    }
    
    return {
      articles: Array.from(articlesMap.values()),
      totalFound: articlesMap.size,
      totalPotential: totalResultsFound,
      successfulStrategy: successfulStrategy
    };
  } catch (error) {
    console.error(`Error searching PubMed for drug ${drugName}:`, error);
    return { articles: [], totalFound: 0, totalPotential: 0, successfulStrategy: null };
  }
}

/**
 * Helper function to extract drug name from a complex query
 * @param {string} query - The search query
 * @returns {string} - The extracted drug name
 */
function extractDrugNameFromQuery(query) {
  const patterns = [
    /"([^"]+)"\[Title\/Abstract\]/,
    /"([^"]+)"\[MeSH Terms\]/,
    /"([^"]+)"\[Pharmacological Action\]/,
    /^([A-Za-z0-9\-]+)$/
  ];
  
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  const terms = query.split(/\s+AND\s+|\s+OR\s+|\s*[\[\]\(\)"]\s*/).filter(term => 
    term && term.length > 2 && 
    !/^(Title|Abstract|MeSH|Terms|Pharmacological|Action)$/.test(term)
  );
  
  return terms.sort((a, b) => b.length - a.length)[0] || query;
}

/**
 * Helper function to organize drug data
 * @param {string} baseDrugName - The base drug name
 * @param {Array} drugDetails - Drug details from various sources
 * @returns {Object} - Organized drug data
 */
function organizeDrugData(baseDrugName, drugDetails) {
  const allDrugData = {
    originalDrug: baseDrugName,
    genericNames: [],
    brandNames: [],
    chemicalNames: [],
    synonyms: [],
    codes: [],
    allRelatedDrugs: [] // Will contain all drugs used in search
  };
  
  // Organize drug information
  for (const drugDetail of drugDetails) {
    // Store drug info organized by category
    if (drugDetail.type === 'Generic Name') {
      allDrugData.genericNames.push(drugDetail.name);
    } else if (drugDetail.type === 'Brand Name') {
      allDrugData.brandNames.push(drugDetail.name);
    } else if (drugDetail.type === 'Chemical Name' || drugDetail.type === 'Substance Name') {
      allDrugData.chemicalNames.push(drugDetail.name);
    } else if (drugDetail.type === 'Synonym' || drugDetail.type === 'Related Term') {
      allDrugData.synonyms.push(drugDetail.name);
    } else if (drugDetail.type === 'Code' || drugDetail.id) {
      allDrugData.codes.push(drugDetail.id || drugDetail.name);
    }
    
    // Add to the unified list of all drugs
    allDrugData.allRelatedDrugs.push({
      name: drugDetail.name,
      type: drugDetail.type,
      source: drugDetail.source,
      id: drugDetail.id
    });
  }
  
  return allDrugData;
}

/**
 * Get complete details of all related drugs including their sources and types
 * @param {string} drugName - The drug name to search for
 * @returns {Array} - Array of drug details
 */
async function getAllDrugDetails(drugName) {
  try {
    // Object to store all results from various drug databases
    const results = {
      originalQuery: drugName,
      sources: {
        rxnorm: { names: [], links: [] },
        fda: { names: [], links: [] },
        pubchem: { names: [], links: [] },
        chembl: { names: [], links: [] },
        drugbank: { names: [], links: [] }
      }
    };

    // Execute searches in parallel to speed up processing
    const searchPromises = [
      searchRxNorm(drugName, results).catch(error => {
        console.error('RxNorm search error:', error.message);
      }),
      searchFDA(drugName, results).catch(error => {
        console.error('FDA search error:', error.message);
      }),
      searchPubChem(drugName, results).catch(error => {
        console.error('PubChem search error:', error.message);
      }),
      // Additional data sources could be added here
      searchChEMBL(drugName, results).catch(error => {
        console.error('ChEMBL search error:', error.message);
      }),
      searchDrugBank(drugName, results).catch(error => {
        console.error('DrugBank search error:', error.message);
      })
    ];
    
    // Wait for all searches to complete
    await Promise.all(searchPromises);
    
    // Extract all the unique drug details from the search results
    const drugDetails = [];
    
    for (const [sourceName, sourceData] of Object.entries(results.sources)) {
      if (sourceData.names && sourceData.names.length > 0) {
        for (const nameObj of sourceData.names) {
          // Skip error and info messages
          if (nameObj.type === 'Error' || nameObj.type === 'Info' || 
              !nameObj.name || typeof nameObj.name !== 'string') {
            continue;
          }
          
          // Skip very short names (likely not useful for searches)
          if (nameObj.name.trim().length < 3) {
            continue;
          }
          
          // Add to the drug details
          drugDetails.push({
            name: nameObj.name,
            type: nameObj.type || 'Unknown',
            source: sourceName,
            id: nameObj.id || null
          });
        }
      }
    }
    
    // Return all detailed drug info
    return drugDetails;
  } catch (error) {
    console.error(`Error getting all drug details for ${drugName}:`, error);
    return [];
  }
}

/**
 * Search RxNorm API for drug information
 * @param {string} drugName - The drug name to search
 * @param {Object} results - Results object to populate
 */
async function searchRxNorm(drugName, results) {
  try {
    // Step 1: Get RxCUI for the drug
    const rxcuiResponse = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(drugName)}&search=1`);
    
    if (rxcuiResponse.data && rxcuiResponse.data.idGroup && rxcuiResponse.data.idGroup.rxnormId) {
      const rxcui = rxcuiResponse.data.idGroup.rxnormId[0];
      
      // Add the RxCUI itself as a code
      results.sources.rxnorm.names.push({
        name: `RxCUI:${rxcui}`,
        type: 'Code',
        id: rxcui
      });
      
      // Add the standard name to results
      if (rxcuiResponse.data.idGroup.name) {
        results.sources.rxnorm.names.push({
          name: rxcuiResponse.data.idGroup.name,
          type: 'Standard Name'
        });
      }
      
      // Step 2: Get related names
      const relatedResponse = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/allrelated.json`);
      
      if (relatedResponse.data && relatedResponse.data.allRelatedGroup && relatedResponse.data.allRelatedGroup.conceptGroup) {
        for (const group of relatedResponse.data.allRelatedGroup.conceptGroup) {
          if (group.conceptProperties) {
            for (const property of group.conceptProperties) {
              results.sources.rxnorm.names.push({
                name: property.name,
                type: group.tty || 'Related Term',
                id: property.rxcui
              });
            }
          }
        }
      }
      
      // Step 3: Get all related NDC codes
      try {
        const ndcResponse = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/ndcs.json`);
        
        if (ndcResponse.data && ndcResponse.data.ndcGroup && ndcResponse.data.ndcGroup.ndcList) {
          const ndcList = ndcResponse.data.ndcGroup.ndcList.ndc;
          if (ndcList) {
            const ndcs = Array.isArray(ndcList) ? ndcList : [ndcList];
            for (const ndc of ndcs) {
              results.sources.rxnorm.names.push({
                name: `NDC:${ndc}`,
                type: 'Code',
                id: ndc
              });
            }
          }
        }
      } catch (ndcError) {
        console.error('Error getting NDC codes:', ndcError.message);
      }
      
      // Step 4: Get brand names specifically
      try {
        const brandResponse = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=BN`);
        
        if (brandResponse.data && brandResponse.data.relatedGroup && brandResponse.data.relatedGroup.conceptGroup) {
          const brandGroups = Array.isArray(brandResponse.data.relatedGroup.conceptGroup) ? 
            brandResponse.data.relatedGroup.conceptGroup : 
            [brandResponse.data.relatedGroup.conceptGroup];
            
          for (const group of brandGroups) {
            if (group.conceptProperties) {
              const properties = Array.isArray(group.conceptProperties) ? 
                group.conceptProperties : [group.conceptProperties];
                
              for (const property of properties) {
                results.sources.rxnorm.names.push({
                  name: property.name,
                  type: 'Brand Name',
                  id: property.rxcui
                });
              }
            }
          }
        }
      } catch (brandError) {
        console.error('Error getting brand names:', brandError.message);
      }
    }
  } catch (error) {
    console.error('Error searching RxNorm:', error.message);
    results.sources.rxnorm.names.push({
      name: "Error searching RxNorm database",
      type: "Error"
    });
  }
}

/**
 * Search FDA API for drug information
 * @param {string} drugName - The drug name to search
 * @param {Object} results - Results object to populate
 */
async function searchFDA(drugName, results) {
  try {
    // Search by generic name
    const fdaGenericResponse = await axios.get(`https://api.fda.gov/drug/label.json?search=openfda.generic_name:${encodeURIComponent(drugName)}&limit=5`);
    
    if (fdaGenericResponse.data && fdaGenericResponse.data.results) {
      processFDAResults(fdaGenericResponse.data.results, results);
    }
    
    // Search by brand name
    const fdaBrandResponse = await axios.get(`https://api.fda.gov/drug/label.json?search=openfda.brand_name:${encodeURIComponent(drugName)}&limit=5`);
    
    if (fdaBrandResponse.data && fdaBrandResponse.data.results) {
      processFDAResults(fdaBrandResponse.data.results, results);
    }
    
    // Try to search by substance name as well
    try {
      const fdaSubstanceResponse = await axios.get(`https://api.fda.gov/drug/label.json?search=openfda.substance_name:${encodeURIComponent(drugName)}&limit=5`);
      
      if (fdaSubstanceResponse.data && fdaSubstanceResponse.data.results) {
        processFDAResults(fdaSubstanceResponse.data.results, results);
      }
    } catch (substanceError) {
      // Ignore substance name search errors
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      // No results found is a normal condition
      results.sources.fda.names.push({
        name: "No FDA records found",
        type: "Info"
      });
    } else {
      console.error('Error searching FDA:', error.message);
      results.sources.fda.names.push({
        name: "Error searching FDA database",
        type: "Error"
      });
    }
  }
}

/**
 * Process FDA search results
 * @param {Array} fdaResults - FDA API search results
 * @param {Object} results - Results object to populate
 */
function processFDAResults(fdaResults, results) {
  for (const drug of fdaResults) {
    if (drug.openfda) {
      // Add SPL application number
      if (drug.openfda.application_number) {
        for (const appNum of drug.openfda.application_number) {
          results.sources.fda.names.push({
            name: `FDA-App:${appNum}`,
            type: 'Code',
            id: appNum
          });
        }
      }
      
      // Add SPL ID
      if (drug.openfda.spl_id) {
        for (const splId of drug.openfda.spl_id) {
          results.sources.fda.names.push({
            name: `SPL-ID:${splId}`,
            type: 'Code',
            id: splId
          });
        }
      }
      
      // Add generic names
      if (drug.openfda.generic_name) {
        for (const name of drug.openfda.generic_name) {
          results.sources.fda.names.push({
            name: name,
            type: 'Generic Name'
          });
        }
      }
      
      // Add brand names
      if (drug.openfda.brand_name) {
        for (const name of drug.openfda.brand_name) {
          results.sources.fda.names.push({
            name: name,
            type: 'Brand Name'
          });
        }
      }
      
      // Add substance names
      if (drug.openfda.substance_name) {
        for (const name of drug.openfda.substance_name) {
          results.sources.fda.names.push({
            name: name,
            type: 'Substance Name'
          });
        }
      }
      
      // Add manufacturer names
      if (drug.openfda.manufacturer_name) {
        for (const name of drug.openfda.manufacturer_name) {
          results.sources.fda.names.push({
            name: `Manufacturer: ${name}`,
            type: 'Manufacturer'
          });
        }
      }
    }
  }
}

/**
 * Search PubChem API for drug information
 * @param {string} drugName - The drug name to search
 * @param {Object} results - Results object to populate
 */
async function searchPubChem(drugName, results) {
  try {
    // Step 1: Find the compound ID
    const pubchemResponse = await axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(drugName)}/cids/JSON`);
    
    if (pubchemResponse.data && pubchemResponse.data.IdentifierList && pubchemResponse.data.IdentifierList.CID) {
      const cid = pubchemResponse.data.IdentifierList.CID[0];
      
      // Add the CID itself
      results.sources.pubchem.names.push({
        name: `PubChem CID:${cid}`,
        type: 'Code',
        id: cid
      });
      
      // Step 2: Get synonyms
      const synonymsResponse = await axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`);
      
      if (synonymsResponse.data && synonymsResponse.data.InformationList && synonymsResponse.data.InformationList.Information) {
        const info = synonymsResponse.data.InformationList.Information[0];
        
        if (info.Synonym) {
          // Filter out long and messy names
          const filteredSynonyms = info.Synonym.filter(syn => 
            syn.length < 100 && !syn.includes('UNII') && !syn.includes('CHEBI') && !syn.includes('DTXSID')
          );
          
          // Take just the first 30 synonyms to avoid overwhelming
          const trimmedSynonyms = filteredSynonyms.slice(0, 30);
          
          for (const synonym of trimmedSynonyms) {
            results.sources.pubchem.names.push({
              name: synonym,
              type: 'Synonym'
            });
          }
        }
      }
      
      // Step 3: Try to get more structured data
      try {
        const compoundResponse = await axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/record/JSON?record_type=3d`);
        
        if (compoundResponse.data && compoundResponse.data.PC_Compounds && compoundResponse.data.PC_Compounds[0]) {
          const compound = compoundResponse.data.PC_Compounds[0];
          
          // Add IUPAC name if available
          if (compound.props) {
            for (const prop of compound.props) {
              if (prop.urn && prop.urn.label && prop.urn.label === "IUPAC Name" && prop.value && prop.value.sval) {
                results.sources.pubchem.names.push({
                  name: prop.value.sval,
                  type: 'IUPAC Name'
                });
              }
            }
          }
        }
      } catch (structureError) {
        // Ignore structure data errors
      }
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      results.sources.pubchem.names.push({
        name: "No PubChem records found",
        type: "Info"
      });
    } else {
      console.error('Error searching PubChem:', error.message);
      results.sources.pubchem.names.push({
        name: "Error searching PubChem database",
        type: "Error"
      });
    }
  }
}

/**
 * Search ChEMBL API for drug information
 * @param {string} drugName - The drug name to search
 * @param {Object} results - Results object to populate
 */
async function searchChEMBL(drugName, results) {
  try {
    // ChEMBL API search
    const chemblResponse = await axios.get(`https://www.ebi.ac.uk/chembl/api/data/molecule.json?molecule_structures__canonical_smiles__flexmatch=${encodeURIComponent(drugName)}&limit=5`);
    
    if (chemblResponse.data && chemblResponse.data.molecules) {
      for (const molecule of chemblResponse.data.molecules) {
        if (molecule.molecule_chembl_id) {
          results.sources.chembl.names.push({
            name: `ChEMBL:${molecule.molecule_chembl_id}`,
            type: 'Code',
            id: molecule.molecule_chembl_id
          });
        }
        
        if (molecule.pref_name) {
          results.sources.chembl.names.push({
            name: molecule.pref_name,
            type: 'Chemical Name'
          });
        }
        
        // Add synonyms/trade names if available
        if (molecule.molecule_synonyms) {
          for (const synonym of molecule.molecule_synonyms) {
            if (synonym.synonym) {
              results.sources.chembl.names.push({
                name: synonym.synonym,
                type: synonym.syn_type === 'TRADE_NAME' ? 'Brand Name' : 'Synonym'
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error searching ChEMBL:', error.message);
  }
}

/**
 * Search DrugBank for drug information (placeholder)
 * @param {string} drugName - The drug name to search
 * @param {Object} results - Results object to populate
 */
async function searchDrugBank(drugName, results) {
  // This is a placeholder - DrugBank requires authentication
  results.sources.drugbank.names.push({
    name: "DrugBank API integration would require an API key",
    type: "Info"
  });
}

/**
 * New endpoint for AI summary generation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function generateAISummary(req, res) {
  try {
    const { articles, prompt } = req.body;
    
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'No articles provided for summarization'
      });
    }
    
    // Prepare the data for the AI
    const articleData = articles.map(article => {
      return {
        title: article.title,
        authors: article.authors,
        journal: article.journal,
        year: article.pubDate,
        abstract: article.abstract
      };
    });
    
    // Create prompt for the AI
    const aiPrompt = prompt || 
      `Summarize the following ${articleData.length} PubMed articles about ${articleData[0].title.split(' ').slice(0, 3).join(' ')}... and provide key insights:`;
    
    // Format articles data for the AI
    const articleTexts = articleData.map((article, index) => 
      `Article ${index + 1}:\nTitle: ${article.title}\nAuthors: ${article.authors.join(', ')}\nJournal: ${article.journal} (${article.year})\nAbstract: ${article.abstract}\n`
    ).join('\n---\n\n');
    
    // Combine prompt and article data
    const fullPrompt = `${aiPrompt}\n\n${articleTexts}\n\nUse Tailwind CSS formatting for your summary, organizing information in a clear, structured way. Include main findings, methodology, results, and clinical implications when available. Present conflicting findings if they exist.`;
    
    // Call Grok or other AI API here
    // This is a placeholder - implement your actual AI API call
    const summary = await callGrokAPI(fullPrompt);
    
    return res.json({
      success: true,
      summary: summary
    });
    
  } catch (error) {
    console.error('Error generating AI summary:', error);
    res.status(500).json({ 
      error: 'Error generating summary',
      message: error.message
    });
  }
}

/**
 * Placeholder for Grok API call
 * @param {string} prompt - The prompt for Grok
 * @returns {string} - The AI-generated summary
 */
async function callGrokAPI(prompt) {
  try {
    // This is a placeholder - implement your actual Grok API call
    // For now, return a simulated response
    console.log('Calling Grok API with prompt:', prompt.substring(0, 100) + '...');
    
    // In a real implementation, you would call an actual API
    // const response = await axios.post('https://api.grok.ai/v1/generate', {
    //   prompt: prompt,
    //   max_tokens: 1000
    // });
    // return response.data.text;
    
    // Simulated response
    return `
<div class="bg-blue-50 p-4 rounded-lg shadow mb-6">
  <h2 class="text-xl font-bold text-blue-800 mb-2">Research Summary</h2>
  <p class="text-blue-700 mb-4">Based on the analysis of ${prompt.split('Article').length - 1} PubMed articles.</p>
  
  <div class="bg-white p-3 rounded shadow-sm mb-3">
    <h3 class="font-medium text-gray-800 mb-2">Key Findings</h3>
    <ul class="list-disc pl-5 text-gray-700 space-y-1">
      <li>Multiple studies demonstrate efficacy for the primary indication</li>
      <li>Side effect profile is consistent across studies</li>
      <li>Dosage recommendations range from X to Y mg daily</li>
    </ul>
  </div>
  
  <div class="bg-white p-3 rounded shadow-sm">
    <h3 class="font-medium text-gray-800 mb-2">Clinical Implications</h3>
    <ul class="list-disc pl-5 text-gray-700 space-y-1">
      <li>May offer therapeutic benefits for patients who are treatment-resistant</li>
      <li>Regular monitoring recommended during treatment period</li>
      <li>Further research needed on long-term outcomes</li>
    </ul>
  </div>
</div>`;
  } catch (error) {
    console.error('Error calling Grok API:', error);
    return 'Error generating summary. Please try again later.';
  }
}

// Export all handlers
module.exports = {
  handlePubMedSearch,
  generateAISummary,
handleCustomPubMedSearch
};

// Enhanced PubMed Drug Analysis Backend - Advanced Functions
// Add these functions to your existing enhancedpubmed.js file


/**
 * Search for pivotal trials for a specific drug
 * @param {string} drugName - The drug name to search
 * @param {string} apiKey - NCBI API key
 * @returns {Object} - Search results for pivotal trials
 */
async function searchPivotalTrials(drugName, apiKey = '') {
  const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const parser = new xml2js.Parser({ explicitArray: false });
  
  const searchQueries = [
    `"${drugName}" AND "pivotal trial"`,
    `"${drugName}" AND "pivotal study"`,
    `"${drugName}" AND "phase III" AND "pivotal"`,
    `"${drugName}" AND "registration trial"`,
    `"${drugName}" AND "regulatory trial"`,
    `"${drugName}" AND "FDA approval" AND "phase III"`,
    `"${drugName}" AND "EMA approval" AND "phase III"`
  ];
  
  console.log(`🔍 Searching for pivotal trials for: ${drugName}`);
  
  try {
    const results = await Promise.all(
      searchQueries.map(query => performAdvancedPubMedSearch(baseUrl, query, apiKey, parser, 'pivotal'))
    );
    
    // Combine and deduplicate results
    const allArticles = new Map();
    results.forEach(result => {
      result.articles.forEach(article => {
        if (!allArticles.has(article.pmid)) {
          allArticles.set(article.pmid, {
            ...article,
            searchContext: 'pivotal_trial',
            relevanceScore: calculatePivotalRelevance(article)
          });
        }
      });
    });
    
    const sortedArticles = Array.from(allArticles.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return {
      articles: sortedArticles,
      totalResults: sortedArticles.length,
      searchType: 'pivotal_trials',
      queries: searchQueries
    };
    
  } catch (error) {
    console.error('Error searching pivotal trials:', error);
    return { articles: [], totalResults: 0, error: error.message };
  }
}

/**
 * Search for FDA approval pathways and designations
 * @param {string} drugName - The drug name to search
 * @param {string} apiKey - NCBI API key
 * @returns {Object} - Search results for approval pathways
 */
async function searchApprovalPathways(drugName, apiKey = '') {
  const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const parser = new xml2js.Parser({ explicitArray: false });
  
  const searchQueries = [
    `"${drugName}" AND "FDA approval"`,
    `"${drugName}" AND "accelerated approval"`,
    `"${drugName}" AND "breakthrough therapy"`,
    `"${drugName}" AND "fast track"`,
    `"${drugName}" AND "orphan drug"`,
    `"${drugName}" AND "priority review"`,
    `"${drugName}" AND "EMA approval"`,
    `"${drugName}" AND "regulatory pathway"`,
    `"${drugName}" AND "conditional approval"`,
    `"${drugName}" AND "REMS" AND "FDA"`
  ];
  
  console.log(`🛣️ Searching for approval pathways for: ${drugName}`);
  
  try {
    const results = await Promise.all(
      searchQueries.map(query => performAdvancedPubMedSearch(baseUrl, query, apiKey, parser, 'approval'))
    );
    
    const allArticles = new Map();
    results.forEach(result => {
      result.articles.forEach(article => {
        if (!allArticles.has(article.pmid)) {
          allArticles.set(article.pmid, {
            ...article,
            searchContext: 'approval_pathway',
            relevanceScore: calculateApprovalRelevance(article)
          });
        }
      });
    });
    
    const sortedArticles = Array.from(allArticles.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return {
      articles: sortedArticles,
      totalResults: sortedArticles.length,
      searchType: 'approval_pathways',
      queries: searchQueries
    };
    
  } catch (error) {
    console.error('Error searching approval pathways:', error);
    return { articles: [], totalResults: 0, error: error.message };
  }
}

/**
 * Search for real-world evidence studies
 * @param {string} drugName - The drug name to search
 * @param {string} apiKey - NCBI API key
 * @returns {Object} - Search results for real-world evidence
 */
async function searchRealWorldEvidence(drugName, apiKey = '') {
  const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const parser = new xml2js.Parser({ explicitArray: false });
  
  const searchQueries = [
    `"${drugName}" AND "real-world evidence"`,
    `"${drugName}" AND "real world data"`,
    `"${drugName}" AND "RWE"`,
    `"${drugName}" AND "registry study"`,
    `"${drugName}" AND "claims data"`,
    `"${drugName}" AND "EHR" AND "electronic health"`,
    `"${drugName}" AND "observational study"`,
    `"${drugName}" AND "post-market surveillance"`,
    `"${drugName}" AND "effectiveness study"`,
    `"${drugName}" AND "real-world effectiveness"`
  ];
  
  console.log(`🌍 Searching for real-world evidence for: ${drugName}`);
  
  try {
    const results = await Promise.all(
      searchQueries.map(query => performAdvancedPubMedSearch(baseUrl, query, apiKey, parser, 'rwe'))
    );
    
    const allArticles = new Map();
    results.forEach(result => {
      result.articles.forEach(article => {
        if (!allArticles.has(article.pmid)) {
          allArticles.set(article.pmid, {
            ...article,
            searchContext: 'real_world_evidence',
            relevanceScore: calculateRWERelevance(article)
          });
        }
      });
    });
    
    const sortedArticles = Array.from(allArticles.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return {
      articles: sortedArticles,
      totalResults: sortedArticles.length,
      searchType: 'real_world_evidence',
      queries: searchQueries
    };
    
  } catch (error) {
    console.error('Error searching real-world evidence:', error);
    return { articles: [], totalResults: 0, error: error.message };
  }
}

/**
 * Search for failed trial recovery strategies
 * @param {string} drugName - The drug name to search
 * @param {string} apiKey - NCBI API key
 * @returns {Object} - Search results for failed trial recovery
 */
async function searchFailedTrialRecovery(drugName, apiKey = '') {
  const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const parser = new xml2js.Parser({ explicitArray: false });
  
  const searchQueries = [
    `"${drugName}" AND "post hoc analysis"`,
    `"${drugName}" AND "failed trial"`,
    `"${drugName}" AND "secondary endpoint"`,
    `"${drugName}" AND "subgroup analysis"`,
    `"${drugName}" AND "negative trial"`,
    `"${drugName}" AND "rescue analysis"`,
    `"${drugName}" AND "alternative endpoint"`,
    `"${drugName}" AND "biomarker enrichment"`,
    `"${drugName}" AND "patient selection"`,
    `"${drugName}" AND "trial redesign"`
  ];
  
  console.log(`🔄 Searching for failed trial recovery for: ${drugName}`);
  
  try {
    const results = await Promise.all(
      searchQueries.map(query => performAdvancedPubMedSearch(baseUrl, query, apiKey, parser, 'recovery'))
    );
    
    const allArticles = new Map();
    results.forEach(result => {
      result.articles.forEach(article => {
        if (!allArticles.has(article.pmid)) {
          allArticles.set(article.pmid, {
            ...article,
            searchContext: 'failed_trial_recovery',
            relevanceScore: calculateRecoveryRelevance(article)
          });
        }
      });
    });
    
    const sortedArticles = Array.from(allArticles.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return {
      articles: sortedArticles,
      totalResults: sortedArticles.length,
      searchType: 'failed_trial_recovery',
      queries: searchQueries
    };
    
  } catch (error) {
    console.error('Error searching failed trial recovery:', error);
    return { articles: [], totalResults: 0, error: error.message };
  }
}

/**
 * Search for drug repurposing attempts
 * @param {string} drugName - The drug name to search
 * @param {string} apiKey - NCBI API key
 * @returns {Object} - Search results for drug repurposing
 */
async function searchDrugRepurposing(drugName, apiKey = '') {
  const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const parser = new xml2js.Parser({ explicitArray: false });
  
  const searchQueries = [
    `"${drugName}" AND "new indication"`,
    `"${drugName}" AND "repurposing"`,
    `"${drugName}" AND "repositioning"`,
    `"${drugName}" AND "off-label"`,
    `"${drugName}" AND "alternative indication"`,
    `"${drugName}" AND "expanded indication"`,
    `"${drugName}" AND "label expansion"`,
    `"${drugName}" AND "investigational use"`,
    `"${drugName}" AND "compassionate use"`,
    `"${drugName}" AND "orphan indication"`
  ];
  
  console.log(`🧭 Searching for drug repurposing for: ${drugName}`);
  
  try {
    const results = await Promise.all(
      searchQueries.map(query => performAdvancedPubMedSearch(baseUrl, query, apiKey, parser, 'repurposing'))
    );
    
    const allArticles = new Map();
    results.forEach(result => {
      result.articles.forEach(article => {
        if (!allArticles.has(article.pmid)) {
          allArticles.set(article.pmid, {
            ...article,
            searchContext: 'drug_repurposing',
            relevanceScore: calculateRepurposingRelevance(article)
          });
        }
      });
    });
    
    const sortedArticles = Array.from(allArticles.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return {
      articles: sortedArticles,
      totalResults: sortedArticles.length,
      searchType: 'drug_repurposing',
      queries: searchQueries
    };
    
  } catch (error) {
    console.error('Error searching drug repurposing:', error);
    return { articles: [], totalResults: 0, error: error.message };
  }
}

/**
 * Rate-limited PubMed search function using your existing working approach
 * @param {string} baseUrl - PubMed API base URL
 * @param {string} query - Search query
 * @param {string} apiKey - NCBI API key
 * @param {Object} parser - XML parser
 * @param {string} searchType - Type of search for debugging
 * @returns {Object} - Search results
 */
async function performAdvancedPubMedSearch(baseUrl, query, apiKey, parser, searchType) {
  const retmax = 10; // Reduced from 20 to minimize load
  const retstart = 0;
  
  // Use rate limiter to execute the request
  return await rateLimiter.executeRequest(async () => {
    console.log(`[${searchType}] Executing rate-limited search: ${query.substring(0, 50)}...`);
    
    try {
      // Step 1: Search for IDs with timeout and retry logic
      const searchUrl = `${baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${retmax}&retstart=${retstart}&usehistory=y${apiKey ? `&api_key=${apiKey}` : ''}`;
      
      let searchResponse;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          searchResponse = await fetch(searchUrl, {
            timeout: 15000, // Reduced timeout
            headers: {
              'User-Agent': 'DrugAnalysis-Tool/1.0'
            }
          });
          
          if (searchResponse.ok) {
            break; // Success, exit retry loop
          } else if (searchResponse.status === 429) {
            // Rate limited - wait longer before retry
            const waitTime = Math.pow(2, retries) * 2000; // Exponential backoff: 2s, 4s, 8s
            console.log(`[${searchType}] Rate limited, waiting ${waitTime}ms before retry ${retries + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retries++;
          } else {
            throw new Error(`Search failed with status: ${searchResponse.status}`);
          }
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            throw error;
          }
          console.log(`[${searchType}] Search attempt ${retries} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
      
      if (!searchResponse || !searchResponse.ok) {
        throw new Error(`Search failed after ${maxRetries} retries`);
      }
      
      const searchData = await searchResponse.text();
      const searchResult = await parser.parseStringPromise(searchData);
      
      // Extract IDs
      let idList = [];
      if (searchResult.eSearchResult && searchResult.eSearchResult.IdList && searchResult.eSearchResult.IdList.Id) {
        idList = Array.isArray(searchResult.eSearchResult.IdList.Id) 
          ? searchResult.eSearchResult.IdList.Id 
          : [searchResult.eSearchResult.IdList.Id];
      }
      
      if (idList.length === 0) {
        console.log(`[${searchType}] No results found for query: ${query.substring(0, 50)}...`);
        return { articles: [], totalResults: 0, query, searchType };
      }
      
      console.log(`[${searchType}] Found ${idList.length} articles, fetching details...`);
      
      // Step 2: Fetch article details with rate limiting
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause between search and fetch
      
      const fetchUrl = `${baseUrl}/efetch.fcgi?db=pubmed&id=${idList.join(',')}&retmode=xml${apiKey ? `&api_key=${apiKey}` : ''}`;
      
      let fetchResponse;
      retries = 0;
      
      while (retries < maxRetries) {
        try {
          fetchResponse = await fetch(fetchUrl, {
            timeout: 20000, // Longer timeout for fetch
            headers: {
              'User-Agent': 'DrugAnalysis-Tool/1.0'
            }
          });
          
          if (fetchResponse.ok) {
            break;
          } else if (fetchResponse.status === 429) {
            const waitTime = Math.pow(2, retries) * 3000; // Longer wait for fetch
            console.log(`[${searchType}] Fetch rate limited, waiting ${waitTime}ms before retry ${retries + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retries++;
          } else {
            throw new Error(`Fetch failed with status: ${fetchResponse.status}`);
          }
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            throw error;
          }
          console.log(`[${searchType}] Fetch attempt ${retries} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1500 * retries));
        }
      }
      
      if (!fetchResponse || !fetchResponse.ok) {
        throw new Error(`Fetch failed after ${maxRetries} retries`);
      }
      
      const fetchData = await fetchResponse.text();
      const fetchResult = await parser.parseStringPromise(fetchData);
      
      // Parse articles using your existing function
      const articles = [];
      if (fetchResult.PubmedArticleSet && fetchResult.PubmedArticleSet.PubmedArticle) {
        const articleList = Array.isArray(fetchResult.PubmedArticleSet.PubmedArticle) 
          ? fetchResult.PubmedArticleSet.PubmedArticle 
          : [fetchResult.PubmedArticleSet.PubmedArticle];
        
        articleList.forEach(article => {
          const parsedArticle = parseAdvancedArticle(article);
          if (parsedArticle) {
            articles.push(parsedArticle);
          }
        });
      }
      
      console.log(`[${searchType}] Successfully parsed ${articles.length} articles`);
      
      return {
        articles,
        totalResults: articles.length,
        query,
        searchType
      };
      
    } catch (error) {
      console.error(`[${searchType}] Search error:`, error.message);
      return { 
        articles: [], 
        totalResults: 0, 
        error: error.message, 
        query,
        searchType 
      };
    }
  });
}
/**
 * Parse advanced article with enhanced fields
 * @param {Object} article - Raw article data from PubMed
 * @returns {Object} - Parsed article object
 */
function parseAdvancedArticle(article) {
  try {
    const medlineCitation = article.MedlineCitation;
    const pubmedData = article.PubmedData;
    
    if (!medlineCitation || !medlineCitation.Article) {
      return null;
    }
    
    const articleData = medlineCitation.Article;
    
    // Extract PMID
    const pmid = medlineCitation.PMID._ || medlineCitation.PMID;
    
    // Extract title
    const title = articleData.ArticleTitle || 'No title available';
    
    // Extract authors
    const authors = [];
    if (articleData.AuthorList && articleData.AuthorList.Author) {
      const authorList = Array.isArray(articleData.AuthorList.Author) 
        ? articleData.AuthorList.Author 
        : [articleData.AuthorList.Author];
      
      authorList.forEach(author => {
        if (author.LastName && author.ForeName) {
          authors.push(`${author.LastName}, ${author.ForeName}`);
        } else if (author.CollectiveName) {
          authors.push(author.CollectiveName);
        }
      });
    }
    
    // Extract journal and date
    const journal = articleData.Journal ? articleData.Journal.Title || 'Unknown journal' : 'Unknown journal';
    const pubDate = extractPublicationDate(articleData);
    
    // Extract abstract
    let abstract = 'No abstract available';
    if (articleData.Abstract && articleData.Abstract.AbstractText) {
      const abstractText = Array.isArray(articleData.Abstract.AbstractText) 
        ? articleData.Abstract.AbstractText.map(text => text._ || text).join(' ') 
        : (articleData.Abstract.AbstractText._ || articleData.Abstract.AbstractText);
      abstract = abstractText;
    }
    
    // Extract keywords and MeSH terms
    const keywords = [];
    const meshTerms = [];
    
    if (medlineCitation.KeywordList && medlineCitation.KeywordList.Keyword) {
      const keywordList = Array.isArray(medlineCitation.KeywordList.Keyword) 
        ? medlineCitation.KeywordList.Keyword 
        : [medlineCitation.KeywordList.Keyword];
      keywordList.forEach(keyword => {
        keywords.push(keyword._ || keyword);
      });
    }
    
    if (medlineCitation.MeshHeadingList && medlineCitation.MeshHeadingList.MeshHeading) {
      const meshList = Array.isArray(medlineCitation.MeshHeadingList.MeshHeading) 
        ? medlineCitation.MeshHeadingList.MeshHeading 
        : [medlineCitation.MeshHeadingList.MeshHeading];
      meshList.forEach(mesh => {
        if (mesh.DescriptorName) {
          meshTerms.push(mesh.DescriptorName._ || mesh.DescriptorName);
        }
      });
    }
    
    // Extract DOI and full text URL
    let doi = '';
    let fullTextUrl = '';
    
    if (articleData.ELocationID) {
      const elocations = Array.isArray(articleData.ELocationID) 
        ? articleData.ELocationID 
        : [articleData.ELocationID];
      
      const doiLocation = elocations.find(loc => loc.$ && loc.$.EIdType === 'doi');
      if (doiLocation) {
        doi = doiLocation._ || doiLocation;
      }
    }
    
    if (pubmedData && pubmedData.ArticleIdList && pubmedData.ArticleIdList.ArticleId) {
      const articleIds = Array.isArray(pubmedData.ArticleIdList.ArticleId) 
        ? pubmedData.ArticleIdList.ArticleId 
        : [pubmedData.ArticleIdList.ArticleId];
      
      const pmcId = articleIds.find(id => id.$ && id.$.IdType === 'pmc');
      if (pmcId) {
        fullTextUrl = `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId._}/`;
      }
    }
    
    // Extract publication types
    const publicationTypes = [];
    if (articleData.PublicationTypeList && articleData.PublicationTypeList.PublicationType) {
      const typeList = Array.isArray(articleData.PublicationTypeList.PublicationType) 
        ? articleData.PublicationTypeList.PublicationType 
        : [articleData.PublicationTypeList.PublicationType];
      typeList.forEach(type => {
        publicationTypes.push(type._ || type);
      });
    }
    
    return {
      pmid,
      title,
      authors,
      journal,
      pubDate,
      abstract,
      keywords,
      meshTerms,
      publicationTypes,
      doi,
      fullTextUrl,
      pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
    };
    
  } catch (error) {
    console.error('Error parsing article:', error);
    return null;
  }
}

/**
 * Extract publication date from article data
 * @param {Object} articleData - Article data object
 * @returns {string} - Formatted publication date
 */
function extractPublicationDate(articleData) {
  try {
    if (articleData.Journal && articleData.Journal.JournalIssue && articleData.Journal.JournalIssue.PubDate) {
      const pubDate = articleData.Journal.JournalIssue.PubDate;
      
      if (pubDate.Year) {
        const year = pubDate.Year;
        const month = pubDate.Month || '';
        const day = pubDate.Day || '';
        
        return `${year}${month ? ' ' + month : ''}${day ? ' ' + day : ''}`;
      }
    }
    
    return 'Unknown date';
  } catch (error) {
    return 'Unknown date';
  }
}

/**
 * Calculate relevance score for pivotal trial articles
 * @param {Object} article - Article object
 * @returns {number} - Relevance score
 */
function calculatePivotalRelevance(article) {
  let score = 0;
  
  const titleLower = article.title.toLowerCase();
  const abstractLower = article.abstract.toLowerCase();
  const combined = titleLower + ' ' + abstractLower;
  
  // High value terms
  if (combined.includes('pivotal')) score += 10;
  if (combined.includes('phase iii')) score += 8;
  if (combined.includes('registration')) score += 7;
  if (combined.includes('fda approval')) score += 9;
  if (combined.includes('regulatory')) score += 6;
  
  // Publication types
  if (article.publicationTypes.some(type => type.toLowerCase().includes('clinical trial'))) score += 5;
  if (article.publicationTypes.some(type => type.toLowerCase().includes('randomized'))) score += 3;
  
  // High-impact journals
  const highImpactJournals = ['new england journal of medicine', 'lancet', 'jama', 'nature', 'science'];
  if (highImpactJournals.some(journal => article.journal.toLowerCase().includes(journal))) score += 5;
  
  return score;
}

/**
 * Calculate relevance score for approval pathway articles
 * @param {Object} article - Article object
 * @returns {number} - Relevance score
 */
function calculateApprovalRelevance(article) {
  let score = 0;
  
  const combined = (article.title + ' ' + article.abstract).toLowerCase();
  
  // FDA-specific terms
  if (combined.includes('fda approval')) score += 10;
  if (combined.includes('accelerated approval')) score += 9;
  if (combined.includes('breakthrough therapy')) score += 8;
  if (combined.includes('fast track')) score += 7;
  if (combined.includes('orphan drug')) score += 6;
  if (combined.includes('priority review')) score += 5;
  
  // Regulatory terms
  if (combined.includes('regulatory pathway')) score += 8;
  if (combined.includes('submission')) score += 4;
  if (combined.includes('nda') || combined.includes('bla')) score += 6;
  
  return score;
}

/**
 * Calculate relevance score for real-world evidence articles
 * @param {Object} article - Article object
 * @returns {number} - Relevance score
 */
function calculateRWERelevance(article) {
  let score = 0;
  
  const combined = (article.title + ' ' + article.abstract).toLowerCase();
  
  // RWE-specific terms
  if (combined.includes('real-world evidence')) score += 10;
  if (combined.includes('real world data')) score += 9;
  if (combined.includes('rwe')) score += 8;
  if (combined.includes('registry')) score += 7;
  if (combined.includes('observational')) score += 6;
  if (combined.includes('claims data')) score += 8;
  if (combined.includes('electronic health')) score += 7;
  
  return score;
}

/**
 * Calculate relevance score for failed trial recovery articles
 * @param {Object} article - Article object
 * @returns {number} - Relevance score
 */
function calculateRecoveryRelevance(article) {
  let score = 0;
  
  const combined = (article.title + ' ' + article.abstract).toLowerCase();
  
  // Recovery-specific terms
  if (combined.includes('post hoc')) score += 10;
  if (combined.includes('failed trial')) score += 9;
  if (combined.includes('secondary endpoint')) score += 8;
  if (combined.includes('subgroup analysis')) score += 7;
  if (combined.includes('biomarker enrichment')) score += 6;
  if (combined.includes('rescue')) score += 5;
  
  return score;
}

/**
 * Calculate relevance score for drug repurposing articles
 * @param {Object} article - Article object
 * @returns {number} - Relevance score
 */
function calculateRepurposingRelevance(article) {
  let score = 0;
  
  const combined = (article.title + ' ' + article.abstract).toLowerCase();
  
  // Repurposing-specific terms
  if (combined.includes('repurposing')) score += 10;
  if (combined.includes('repositioning')) score += 9;
  if (combined.includes('new indication')) score += 8;
  if (combined.includes('off-label')) score += 7;
  if (combined.includes('expanded indication')) score += 6;
  if (combined.includes('orphan indication')) score += 5;
  
  return score;
}


async function executeComprehensiveAnalysisSequentially(drugName, apiKey) {
  console.log(`🔄 Starting sequential comprehensive analysis for: ${drugName}`);
  
  const results = {
    pivotalTrials: { articles: [], totalResults: 0, searchType: 'pivotal_trials' },
    approvalPathways: { articles: [], totalResults: 0, searchType: 'approval_pathways' },
    realWorldEvidence: { articles: [], totalResults: 0, searchType: 'real_world_evidence' },
    failedTrialRecovery: { articles: [], totalResults: 0, searchType: 'failed_trial_recovery' },
    drugRepurposing: { articles: [], totalResults: 0, searchType: 'drug_repurposing' }
  };
  
  const errors = [];
  
  try {
    // Execute searches sequentially to avoid rate limiting
    console.log(`🎯 Step 1/5: Searching pivotal trials...`);
    results.pivotalTrials = await searchPivotalTrialsSequential(drugName, apiKey);
    
    console.log(`✅ Step 2/5: Searching approval pathways...`);
    results.approvalPathways = await searchApprovalPathwaysSequential(drugName, apiKey);
    
    console.log(`📊 Step 3/5: Searching real-world evidence...`);
    results.realWorldEvidence = await searchRealWorldEvidenceSequential(drugName, apiKey);
    
    console.log(`💡 Step 4/5: Searching failed trial recovery...`);
    results.failedTrialRecovery = await searchFailedTrialRecoverySequential(drugName, apiKey);
    
    console.log(`🔄 Step 5/5: Searching drug repurposing...`);
    results.drugRepurposing = await searchDrugRepurposingSequential(drugName, apiKey);
    
  } catch (error) {
    console.error('Error in sequential analysis:', error);
    errors.push(error.message);
  }
  
  // Collect errors from individual searches
  Object.values(results).forEach(result => {
    if (result.error) {
      errors.push(`${result.searchType}: ${result.error}`);
    }
  });
  
  console.log(`✅ Sequential analysis complete. Errors: ${errors.length}`);
  
  return { results, errors };
}

/**
 * Enhanced search for pivotal trials with drug-specific context
 */
async function searchPivotalTrialsSequential(drugName, apiKey) {
  const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const parser = new xml2js.Parser({ explicitArray: false });
  
  // Much more targeted queries focusing on actual registration trials
  const searchQueries = [
    `"${drugName}"[Title/Abstract] AND ("pivotal trial" OR "registration trial" OR "regulatory trial") AND ("FDA approval" OR "EMA approval" OR "marketing authorization")`,
    `"${drugName}"[Title/Abstract] AND "phase III"[Title/Abstract] AND ("efficacy" OR "safety") AND ("approval" OR "submission" OR "regulatory")`,
    `"${drugName}"[Title/Abstract] AND ("NDA" OR "BLA" OR "MAA") AND ("clinical trial" OR "study")`,
    `"${drugName}"[Title/Abstract] AND ("pivotal study" OR "confirmatory trial") AND ("primary endpoint" OR "efficacy endpoint")`,
    `"${drugName}"[MeSH Terms] AND "Clinical Trials, Phase III"[MeSH Terms] AND ("Drug Approval"[MeSH Terms] OR "Marketing Authorization"[Title/Abstract])`
  ];
  
  const allArticles = new Map();
  
  for (const query of searchQueries) {
    try {
      console.log(`🎯 Pivotal search: ${query.substring(0, 60)}...`);
      const result = await performAdvancedPubMedSearch(baseUrl, query, apiKey, parser, 'pivotal');
      
      result.articles.forEach(article => {
        if (!allArticles.has(article.pmid)) {
          // Enhanced relevance scoring for pivotal trials
          const relevanceScore = calculateEnhancedPivotalRelevance(article, drugName);
          if (relevanceScore > 5) { // Only include high-relevance articles
            allArticles.set(article.pmid, {
              ...article,
              searchContext: 'pivotal_trial',
              relevanceScore: relevanceScore,
              drugFocus: calculateDrugFocus(article, drugName)
            });
          }
        }
      });
    } catch (error) {
      console.error(`Error in pivotal query "${query.substring(0, 40)}...":`, error.message);
    }
  }
  
  const sortedArticles = Array.from(allArticles.values())
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 15); // Limit to top 15 most relevant
  
  return {
    articles: sortedArticles,
    totalResults: sortedArticles.length,
    searchType: 'pivotal_trials',
    queries: searchQueries
  };
}

/**
 * Enhanced search for approval pathways with regulatory focus
 */
async function searchApprovalPathwaysSequential(drugName, apiKey) {
  const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const parser = new xml2js.Parser({ explicitArray: false });
  
  const searchQueries = [
    `"${drugName}"[Title/Abstract] AND ("FDA approval" OR "FDA clearance" OR "marketing authorization") AND ("breakthrough therapy" OR "fast track" OR "accelerated approval" OR "orphan drug")`,
    `"${drugName}"[Title/Abstract] AND ("regulatory pathway" OR "approval pathway" OR "regulatory strategy") AND ("FDA" OR "EMA" OR "Health Canada" OR "PMDA")`,
    `"${drugName}"[Title/Abstract] AND ("PDUFA" OR "regulatory submission" OR "NDA" OR "BLA" OR "MAA") AND ("designation" OR "status")`,
    `"${drugName}"[Title/Abstract] AND ("priority review" OR "REMS" OR "Risk Evaluation and Mitigation") AND ("approval" OR "regulatory")`,
    `"${drugName}"[MeSH Terms] AND ("Drug Approval"[MeSH Terms] OR "United States Food and Drug Administration"[MeSH Terms]) AND ("regulation" OR "policy")`
  ];
  
  const allArticles = new Map();
  
  for (const query of searchQueries) {
    try {
      console.log(`✅ Approval search: ${query.substring(0, 60)}...`);
      const result = await performAdvancedPubMedSearch(baseUrl, query, apiKey, parser, 'approval');
      
      result.articles.forEach(article => {
        if (!allArticles.has(article.pmid)) {
          const relevanceScore = calculateEnhancedApprovalRelevance(article, drugName);
          if (relevanceScore > 5) {
            allArticles.set(article.pmid, {
              ...article,
              searchContext: 'approval_pathway',
              relevanceScore: relevanceScore,
              drugFocus: calculateDrugFocus(article, drugName)
            });
          }
        }
      });
    } catch (error) {
      console.error(`Error in approval query "${query.substring(0, 40)}...":`, error.message);
    }
  }
  
  const sortedArticles = Array.from(allArticles.values())
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 15);
  
  return {
    articles: sortedArticles,
    totalResults: sortedArticles.length,
    searchType: 'approval_pathways',
    queries: searchQueries
  };
}

/**
 * Enhanced search for real-world evidence with RWE focus
 */
async function searchRealWorldEvidenceSequential(drugName, apiKey) {
  const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const parser = new xml2js.Parser({ explicitArray: false });
  
  const searchQueries = [
    `"${drugName}"[Title/Abstract] AND ("real-world evidence" OR "real world data" OR "RWE") AND ("regulatory" OR "FDA" OR "EMA" OR "submission")`,
    `"${drugName}"[Title/Abstract] AND ("registry study" OR "claims database" OR "electronic health records" OR "EHR") AND ("effectiveness" OR "safety")`,
    `"${drugName}"[Title/Abstract] AND ("observational study" OR "retrospective analysis") AND ("post-market" OR "post-marketing" OR "surveillance")`,
    `"${drugName}"[Title/Abstract] AND ("PASS" OR "post-authorization safety study") AND ("real-world" OR "observational")`,
    `"${drugName}"[MeSH Terms] AND ("Epidemiologic Studies"[MeSH Terms] OR "Product Surveillance, Postmarketing"[MeSH Terms]) AND ("effectiveness" OR "safety")`
  ];
  
  const allArticles = new Map();
  
  for (const query of searchQueries) {
    try {
      console.log(`📊 RWE search: ${query.substring(0, 60)}...`);
      const result = await performAdvancedPubMedSearch(baseUrl, query, apiKey, parser, 'rwe');
      
      result.articles.forEach(article => {
        if (!allArticles.has(article.pmid)) {
          const relevanceScore = calculateEnhancedRWERelevance(article, drugName);
          if (relevanceScore > 5) {
            allArticles.set(article.pmid, {
              ...article,
              searchContext: 'real_world_evidence',
              relevanceScore: relevanceScore,
              drugFocus: calculateDrugFocus(article, drugName)
            });
          }
        }
      });
    } catch (error) {
      console.error(`Error in RWE query "${query.substring(0, 40)}...":`, error.message);
    }
  }
  
  const sortedArticles = Array.from(allArticles.values())
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 15);
  
  return {
    articles: sortedArticles,
    totalResults: sortedArticles.length,
    searchType: 'real_world_evidence',
    queries: searchQueries
  };
}

/**
 * Enhanced search for failed trial recovery with specific failure context
 */
async function searchFailedTrialRecoverySequential(drugName, apiKey) {
  const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const parser = new xml2js.Parser({ explicitArray: false });
  
  const searchQueries = [
    `"${drugName}"[Title/Abstract] AND ("failed trial" OR "negative trial" OR "missed endpoint") AND ("post hoc" OR "secondary analysis" OR "subgroup")`,
    `"${drugName}"[Title/Abstract] AND ("post hoc analysis" OR "retrospective analysis") AND ("primary endpoint" OR "efficacy" OR "failed")`,
    `"${drugName}"[Title/Abstract] AND ("biomarker enrichment" OR "patient selection" OR "responder analysis") AND ("trial" OR "study")`,
    `"${drugName}"[Title/Abstract] AND ("rescue study" OR "salvage analysis" OR "alternative endpoint") AND ("clinical trial" OR "development")`,
    `"${drugName}"[Title/Abstract] AND ("futility" OR "interim analysis" OR "dose modification") AND ("clinical development" OR "trial design")`
  ];
  
  const allArticles = new Map();
  
  for (const query of searchQueries) {
    try {
      console.log(`💡 Recovery search: ${query.substring(0, 60)}...`);
      const result = await performAdvancedPubMedSearch(baseUrl, query, apiKey, parser, 'recovery');
      
      result.articles.forEach(article => {
        if (!allArticles.has(article.pmid)) {
          const relevanceScore = calculateEnhancedRecoveryRelevance(article, drugName);
          if (relevanceScore > 5) {
            allArticles.set(article.pmid, {
              ...article,
              searchContext: 'failed_trial_recovery',
              relevanceScore: relevanceScore,
              drugFocus: calculateDrugFocus(article, drugName)
            });
          }
        }
      });
    } catch (error) {
      console.error(`Error in recovery query "${query.substring(0, 40)}...":`, error.message);
    }
  }
  
  const sortedArticles = Array.from(allArticles.values())
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 15);
  
  return {
    articles: sortedArticles,
    totalResults: sortedArticles.length,
    searchType: 'failed_trial_recovery',
    queries: searchQueries
  };
}

/**
 * Enhanced search for drug repurposing with specific indication focus
 */
async function searchDrugRepurposingSequential(drugName, apiKey) {
  const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const parser = new xml2js.Parser({ explicitArray: false });
  
  const searchQueries = [
    `"${drugName}"[Title/Abstract] AND ("new indication" OR "expanded indication" OR "label expansion") AND ("clinical trial" OR "study")`,
    `"${drugName}"[Title/Abstract] AND ("repurposing" OR "repositioning" OR "repurposed") AND ("indication" OR "therapeutic")`,
    `"${drugName}"[Title/Abstract] AND ("off-label" OR "off label") AND ("use" OR "prescribing" OR "indication")`,
    `"${drugName}"[Title/Abstract] AND ("investigational" OR "exploratory") AND ("indication" OR "therapeutic use" OR "treatment")`,
    `"${drugName}"[Title/Abstract] AND ("compassionate use" OR "expanded access") AND ("indication" OR "treatment")`
  ];
  
  const allArticles = new Map();
  
  for (const query of searchQueries) {
    try {
      console.log(`🔄 Repurposing search: ${query.substring(0, 60)}...`);
      const result = await performAdvancedPubMedSearch(baseUrl, query, apiKey, parser, 'repurposing');
      
      result.articles.forEach(article => {
        if (!allArticles.has(article.pmid)) {
          const relevanceScore = calculateEnhancedRepurposingRelevance(article, drugName);
          if (relevanceScore > 5) {
            allArticles.set(article.pmid, {
              ...article,
              searchContext: 'drug_repurposing',
              relevanceScore: relevanceScore,
              drugFocus: calculateDrugFocus(article, drugName)
            });
          }
        }
      });
    } catch (error) {
      console.error(`Error in repurposing query "${query.substring(0, 40)}...":`, error.message);
    }
  }
  
  const sortedArticles = Array.from(allArticles.values())
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 15);
  
  return {
    articles: sortedArticles,
    totalResults: sortedArticles.length,
    searchType: 'drug_repurposing',
    queries: searchQueries
  };
}

/**
 * Calculate how much the article focuses on the specific drug
 */
function calculateDrugFocus(article, drugName) {
  const combined = (article.title + ' ' + article.abstract).toLowerCase();
  const drugLower = drugName.toLowerCase();
  
  let focus = 0;
  
  // High weight if drug is in title
  if (article.title.toLowerCase().includes(drugLower)) {
    focus += 10;
  }
  
  // Count mentions in abstract
  const mentions = (combined.match(new RegExp(drugLower, 'g')) || []).length;
  focus += mentions * 2;
  
  // Check if it's the primary drug being studied
  const firstSentence = article.abstract.substring(0, 200).toLowerCase();
  if (firstSentence.includes(drugLower)) {
    focus += 5;
  }
  
  return focus;
}

/**
 * Enhanced relevance scoring for pivotal trials
 */
function calculateEnhancedPivotalRelevance(article, drugName) {
  let score = 0;
  
  const titleLower = article.title.toLowerCase();
  const abstractLower = article.abstract.toLowerCase();
  const combined = titleLower + ' ' + abstractLower;
  const drugLower = drugName.toLowerCase();
  
  // Drug focus scoring
  const drugFocus = calculateDrugFocus(article, drugName);
  if (drugFocus < 3) return 0; // Skip articles that barely mention the drug
  
  score += Math.min(drugFocus, 15); // Cap at 15 points
  
  // Pivotal trial indicators
  if (combined.includes('pivotal')) score += 15;
  if (combined.includes('registration trial')) score += 12;
  if (combined.includes('regulatory trial')) score += 10;
  if (combined.includes('phase iii') || combined.includes('phase 3')) score += 8;
  if (combined.includes('fda approval') || combined.includes('ema approval')) score += 10;
  if (combined.includes('nda') || combined.includes('bla') || combined.includes('maa')) score += 8;
  
  // Publication types
  if (article.publicationTypes.some(type => type.toLowerCase().includes('clinical trial'))) score += 6;
  if (article.publicationTypes.some(type => type.toLowerCase().includes('randomized'))) score += 4;
  
  // High-impact journals
  const highImpactJournals = ['new england journal of medicine', 'lancet', 'jama', 'nature medicine', 'bmj'];
  if (highImpactJournals.some(journal => article.journal.toLowerCase().includes(journal))) score += 8;
  
  // Regulatory journals
  const regulatoryJournals = ['drug development research', 'regulatory affairs', 'therapeutic innovation'];
  if (regulatoryJournals.some(journal => article.journal.toLowerCase().includes(journal))) score += 6;
  
  return score;
}

/**
 * Enhanced relevance scoring for approval pathways
 */
function calculateEnhancedApprovalRelevance(article, drugName) {
  let score = 0;
  
  const combined = (article.title + ' ' + article.abstract).toLowerCase();
  const drugFocus = calculateDrugFocus(article, drugName);
  
  if (drugFocus < 3) return 0;
  score += Math.min(drugFocus, 15);
  
  // FDA/regulatory terms
  if (combined.includes('fda approval')) score += 15;
  if (combined.includes('breakthrough therapy')) score += 12;
  if (combined.includes('accelerated approval')) score += 12;
  if (combined.includes('fast track')) score += 10;
  if (combined.includes('orphan drug')) score += 10;
  if (combined.includes('priority review')) score += 8;
  if (combined.includes('regulatory pathway')) score += 10;
  if (combined.includes('pdufa')) score += 8;
  if (combined.includes('rems')) score += 6;
  
  return score;
}

/**
 * Enhanced relevance scoring for real-world evidence
 */
function calculateEnhancedRWERelevance(article, drugName) {
  let score = 0;
  
  const combined = (article.title + ' ' + article.abstract).toLowerCase();
  const drugFocus = calculateDrugFocus(article, drugName);
  
  if (drugFocus < 3) return 0;
  score += Math.min(drugFocus, 15);
  
  // RWE-specific terms
  if (combined.includes('real-world evidence') || combined.includes('real world evidence')) score += 15;
  if (combined.includes('real world data') || combined.includes('real-world data')) score += 12;
  if (combined.includes('rwe')) score += 10;
  if (combined.includes('registry')) score += 8;
  if (combined.includes('claims database') || combined.includes('claims data')) score += 10;
  if (combined.includes('electronic health records') || combined.includes('ehr')) score += 8;
  if (combined.includes('observational')) score += 6;
  if (combined.includes('post-market') || combined.includes('post-marketing')) score += 8;
  if (combined.includes('effectiveness')) score += 6;
  if (combined.includes('pass') && combined.includes('study')) score += 8;
  
  return score;
}

/**
 * Enhanced relevance scoring for failed trial recovery
 */
function calculateEnhancedRecoveryRelevance(article, drugName) {
  let score = 0;
  
  const combined = (article.title + ' ' + article.abstract).toLowerCase();
  const drugFocus = calculateDrugFocus(article, drugName);
  
  if (drugFocus < 3) return 0;
  score += Math.min(drugFocus, 15);
  
  // Recovery-specific terms
  if (combined.includes('failed trial') || combined.includes('negative trial')) score += 15;
  if (combined.includes('post hoc')) score += 12;
  if (combined.includes('missed endpoint') || combined.includes('failed endpoint')) score += 10;
  if (combined.includes('subgroup analysis')) score += 8;
  if (combined.includes('biomarker enrichment')) score += 10;
  if (combined.includes('responder analysis')) score += 8;
  if (combined.includes('rescue')) score += 8;
  if (combined.includes('futility')) score += 6;
  if (combined.includes('interim analysis')) score += 5;
  
  return score;
}

/**
 * Enhanced relevance scoring for drug repurposing
 */
function calculateEnhancedRepurposingRelevance(article, drugName) {
  let score = 0;
  
  const combined = (article.title + ' ' + article.abstract).toLowerCase();
  const drugFocus = calculateDrugFocus(article, drugName);
  
  if (drugFocus < 3) return 0;
  score += Math.min(drugFocus, 15);
  
  // Repurposing-specific terms
  if (combined.includes('repurposing') || combined.includes('repositioning')) score += 15;
  if (combined.includes('new indication')) score += 12;
  if (combined.includes('expanded indication') || combined.includes('label expansion')) score += 10;
  if (combined.includes('off-label') || combined.includes('off label')) score += 8;
  if (combined.includes('investigational use')) score += 6;
  if (combined.includes('compassionate use') || combined.includes('expanded access')) score += 8;
  if (combined.includes('orphan indication')) score += 6;
  
  return score;
}


// Export the new functions
module.exports = {
  ...module.exports, // Preserve existing exports
  performAdvancedPubMedSearch, // Replace the old function
  executeComprehensiveAnalysisSequentially,
  searchPivotalTrialsSequential,
  searchApprovalPathwaysSequential,
  searchRealWorldEvidenceSequential,
  searchFailedTrialRecoverySequential,
  searchDrugRepurposingSequential,
  PubMedRateLimiter
};

// Export all new functions
module.exports = {
  ...module.exports, // Preserve existing exports
  searchPivotalTrials,
  searchApprovalPathways,
  searchRealWorldEvidence,
  searchFailedTrialRecovery,
  searchDrugRepurposing,
  performAdvancedPubMedSearch,
  parseAdvancedArticle,
  calculatePivotalRelevance,
  calculateApprovalRelevance,
  calculateRWERelevance,
  calculateRecoveryRelevance,
  calculateRepurposingRelevance
};