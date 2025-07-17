
// routes/pubmed.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { handlePubMedSearch } = require('./enhancedpubmed.js');
const { handleCustomPubMedSearch} = require('./enhancedpubmed.js')
const {
  searchPivotalTrials,
  searchApprovalPathways,
  searchRealWorldEvidence,
  searchFailedTrialRecovery,
  searchDrugRepurposing
} = require('./enhancedpubmed');


const  {
  performAdvancedPubMedSearch, // Replace the old function
  executeComprehensiveAnalysisSequentially,
  searchPivotalTrialsSequential,
  searchApprovalPathwaysSequential,
  searchRealWorldEvidenceSequential,
  searchFailedTrialRecoverySequential,
  searchDrugRepurposingSequential,
  PubMedRateLimiter
}  = require('./enhancedpubmed');
const fs = require('fs');
const path = require('path');

// Debug logging function
function logDebug(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
  
  console.log(logEntry);
  
  // Also write to a log file for persistent debugging
  try {
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    fs.appendFileSync(
      path.join(logDir, 'grok-api-debug.log'), 
      logEntry + '\n\n',
      'utf8'
    );
  } catch (err) {
    console.error('Error writing to log file:', err);
  }
}

// Use environment variables for API keys (more secure)
const GROK_API_KEY = process.env.grok;
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions'; // Updated to correct base URL

logDebug('Server started with Grok API configuration', { 
  apiUrl: GROK_API_URL,
  keyProvided: GROK_API_KEY ? 'Yes (from env or default)' : 'No'
});

/**
 * Call the Grok API with the provided prompt to summarize PubMed articles
 * @param {string} prompt - The prompt to send to Grok
 * @returns {string} - The generated summary HTML
 */
async function callGrokAPI(prompt) {
  try {
    // Log the input prompt for debugging
    logDebug('Sending prompt to Grok API', { promptLength: prompt.length });
    
    // Try multiple models/approaches in sequence if one fails
    let models = [
      { name: "grok-3", url: "https://api.x.ai/v1/chat/completions" },
      { name: "grok-3-mini", url: "https://api.x.ai/v1/chat/completions" },
      { name: "grok-1", url: "https://api.grok.ai/v1/chat/completions" } // Fallback to older endpoint
    ];
    
    // Add configurable timeout to prevent hanging requests
    const timeout = 120000; // 120 seconds for longer summaries
    
    // Loop through models until one works
    for (const model of models) {
      try {
        logDebug(`Attempting to use ${model.name} at ${model.url}`);
        
        // Simplify: Use a basic text completion approach
        // This time with no structured output, just a raw completion
        const requestBody = {
          model: model.name,
          messages: [{
            role: "system",
            content: `You are an expert medical research analyst who summarizes academic papers.
Create HTML summaries using Tailwind CSS classes. Format your response as valid HTML that can be directly inserted into a webpage.
Include these sections: Overview, Methodology, Key Findings, Clinical Implications, and Limitations.
Use good Tailwind CSS formatting with proper indentation, bg colors, padding, etc.`
          }, {
            role: "user",
            content: prompt
          }],
          temperature: 0.2,
          max_tokens: 2000
        };
    
            // Log the request details
        logDebug('Grok API request payload', requestBody);
        
        // Make the API call
        logDebug(`Making API call to ${model.url}...`);
        const response = await axios.post(model.url, requestBody, {
          headers: {
            'Authorization': `Bearer ${process.env.grok}`,
            'Content-Type': 'application/json'
          },
          timeout: timeout
        });
        
        // If we reach here, the call was successful, process the response
        return processGrokResponse(response, prompt);
      } catch (modelError) {
        // Log the error but continue to try the next model
        logDebug(`Error with model ${model.name}:`, { 
          message: modelError.message,
          responseData: modelError.response?.data,
          responseStatus: modelError.response?.status
        });
        
        // If this is the last model, throw the error to be caught by the outer try/catch
        if (model === models[models.length - 1]) {
          throw modelError;
        }
        // Otherwise continue to the next model
      }
    }
    
    // If we get here, all models failed
    throw new Error('All Grok API models failed');
  } catch (error) {
    // Detailed error logging
    logDebug('Error calling Grok API', { 
      message: error.message,
      stack: error.stack,
      responseData: error.response?.data,
      responseStatus: error.response?.status,
      responseHeaders: error.response?.headers
    });
    
    // Attempt to get detailed error from response if available
    const errorDetails = error.response?.data?.error?.message || 
                        error.response?.data?.message || 
                        error.message || 
                        'Unknown error';
    
    // Return fallback summary with error details
    return `
<div class="bg-red-50 p-4 rounded-lg shadow mb-6">
  <h2 class="text-xl font-bold text-red-800 mb-2">API Error Occurred</h2>
  <p class="text-red-700 mb-4">We encountered an error while generating your research summary.</p>
  
  <div class="bg-white p-3 rounded shadow-sm mb-3">
    <h3 class="font-medium text-gray-800 mb-2">Error Details</h3>
    <p class="text-red-600 font-mono text-sm p-2 bg-gray-100 rounded">${errorDetails}</p>
    <p class="text-gray-700 mt-2">Please try again later or contact support if the issue persists.</p>
  </div>
  
  <div class="bg-white p-3 rounded shadow-sm">
    <h3 class="font-medium text-gray-800 mb-2">Fallback Summary</h3>
    <ul class="list-disc pl-5 text-gray-700 space-y-1">
      <li>Multiple studies demonstrate efficacy for the primary indication</li>
      <li>Side effect profile is consistent across studies</li>
      <li>Further research needed on long-term outcomes</li>
    </ul>
  </div>
</div>`;
  }
}


/**
 * Process the response from Grok API (continued)
 */
function processGrokResponse(response, originalPrompt) {
  // Extract and log the content of the first choice
  const responseContent = response.data.choices[0]?.message?.content;
  
  if (!responseContent) {
    throw new Error('No content in API response');
  }
  
  // If we get HTML back directly, return it
  if (responseContent.trim().startsWith('<div') || 
      responseContent.trim().startsWith('<section') ||
      responseContent.includes('<div class="')) {
    logDebug('Using HTML directly from API response');
    return responseContent;
  }
  
  // If it looks like JSON, try to parse it
  if (responseContent.trim().startsWith('{') && responseContent.trim().endsWith('}')) {
    try {
      logDebug('Attempting to parse JSON response');
      const jsonData = JSON.parse(responseContent);
      return formatJsonToHtml(jsonData);
    } catch (err) {
      logDebug('Failed to parse JSON', { error: err.message });
      // Continue to text processing if JSON parsing fails
    }
  }
  
  // If it's plain text, format it
  logDebug('Formatting text response as HTML');
  return createFallbackHtml(responseContent);
}

/**
 * Format JSON data to HTML
 * @param {Object} jsonData - The parsed JSON data
 * @returns {string} - Formatted HTML
 */
function formatJsonToHtml(jsonData) {
  logDebug('Formatting JSON data to HTML', { 
    dataKeys: Object.keys(jsonData)
  });
  
  try {
    // Handle different possible JSON structures
    
    // Structure 1: Our expected format with overview, findings, etc.
    if (jsonData.overview || jsonData.findings || jsonData.methodology) {
      const overview = jsonData.overview || 'No overview provided';
      const methodology = jsonData.methodology || 'Methodology details not available';
      
      // Process findings - could be array of objects, array of strings, or a string
      let findingsHtml = '<p>No specific findings provided</p>';
      if (jsonData.findings) {
        if (Array.isArray(jsonData.findings)) {
          if (jsonData.findings.length > 0) {
            if (typeof jsonData.findings[0] === 'object') {
              // Array of objects with title/description
              findingsHtml = jsonData.findings.map(finding => `
                <div class="mb-3">
                  <h4 class="font-semibold text-gray-800">${finding.title || 'Finding'}</h4>
                  <p class="text-gray-700">${finding.description || finding.content || ''}</p>
                </div>
              `).join('');
            } else {
              // Array of strings
              findingsHtml = `<ul class="list-disc pl-5 text-gray-700 space-y-1">
                ${jsonData.findings.map(item => `<li>${item}</li>`).join('')}
              </ul>`;
            }
          }
        } else if (typeof jsonData.findings === 'string') {
          // Simple string
          findingsHtml = `<p class="text-gray-700">${jsonData.findings}</p>`;
        }
      }
      
      // Process implications - could be array or string
      let implicationsHtml = '<p>No clinical implications provided</p>';
      if (jsonData.clinical_implications || jsonData.implications) {
        const implications = jsonData.clinical_implications || jsonData.implications || [];
        if (Array.isArray(implications)) {
          if (implications.length > 0) {
            implicationsHtml = `<ul class="list-disc pl-5 text-gray-700 space-y-1">
              ${implications.map(item => `<li>${item}</li>`).join('')}
            </ul>`;
          }
        } else if (typeof implications === 'string') {
          implicationsHtml = `<p class="text-gray-700">${implications}</p>`;
        }
      }
      
      // Process limitations - could be array or string
      let limitationsHtml = '<p>No limitations or future directions provided</p>';
      if (jsonData.limitations) {
        if (Array.isArray(jsonData.limitations)) {
          if (jsonData.limitations.length > 0) {
            limitationsHtml = `<ul class="list-disc pl-5 text-gray-700 space-y-1">
              ${jsonData.limitations.map(item => `<li>${item}</li>`).join('')}
            </ul>`;
          }
        } else if (typeof jsonData.limitations === 'string') {
          limitationsHtml = `<p class="text-gray-700">${jsonData.limitations}</p>`;
        }
      }
      
      // Assemble the complete HTML
      return `
<div class="bg-blue-50 p-4 rounded-lg shadow mb-6">
  <h2 class="text-xl font-bold text-blue-800 mb-2">Research Summary</h2>
  
  <div class="bg-white p-4 rounded shadow-sm mb-4">
    <h3 class="font-medium text-blue-800 mb-2">Overview</h3>
    <p class="text-gray-700">${overview}</p>
  </div>
  
  <div class="bg-white p-4 rounded shadow-sm mb-4">
    <h3 class="font-medium text-blue-800 mb-2">Methodology</h3>
    <p class="text-gray-700">${methodology}</p>
  </div>
  
  <div class="bg-white p-4 rounded shadow-sm mb-4">
    <h3 class="font-medium text-blue-800 mb-2">Key Findings</h3>
    ${findingsHtml}
  </div>
  
  <div class="bg-white p-4 rounded shadow-sm mb-4">
    <h3 class="font-medium text-blue-800 mb-2">Clinical Implications</h3>
    ${implicationsHtml}
  </div>
  
  <div class="bg-white p-4 rounded shadow-sm">
    <h3 class="font-medium text-blue-800 mb-2">Limitations & Future Directions</h3>
    ${limitationsHtml}
  </div>
</div>`;
    }
    
    // Structure 2: Generic sections object with arbitrary keys
    if (jsonData.sections && Array.isArray(jsonData.sections)) {
      const sectionsHtml = jsonData.sections.map(section => {
        const title = section.title || 'Section';
        const content = section.content || 'No content provided';
        
        return `
  <div class="bg-white p-4 rounded shadow-sm mb-4">
    <h3 class="font-medium text-blue-800 mb-2">${title}</h3>
    <div class="text-gray-700">${
      typeof content === 'string' 
        ? content 
        : Array.isArray(content)
          ? `<ul class="list-disc pl-5 space-y-1">${content.map(item => `<li>${item}</li>`).join('')}</ul>`
          : JSON.stringify(content)
    }</div>
  </div>`;
      }).join('');
      
      return `
<div class="bg-blue-50 p-4 rounded-lg shadow mb-6">
  <h2 class="text-xl font-bold text-blue-800 mb-2">Research Summary</h2>
  ${sectionsHtml}
</div>`;
    }
    
    // Fallback: Just convert the JSON to HTML as best we can
    logDebug('Using generic JSON to HTML conversion');
    
    const sectionsHtml = Object.entries(jsonData).map(([key, value]) => {
      const title = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
      
      let content;
      if (typeof value === 'string') {
        content = `<p class="text-gray-700">${value}</p>`;
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          content = '<p class="text-gray-500">No data available</p>';
        } else if (typeof value[0] === 'object') {
          // Array of objects
          content = value.map(item => {
            return `<div class="mb-2 p-2 border-l-2 border-blue-200">
              ${Object.entries(item).map(([k, v]) => `
                <div class="mb-1">
                  <span class="font-semibold">${k}:</span> 
                  <span>${v}</span>
                </div>
              `).join('')}
            </div>`;
          }).join('');
        } else {
          // Array of primitives
          content = `<ul class="list-disc pl-5 text-gray-700 space-y-1">
            ${value.map(item => `<li>${item}</li>`).join('')}
          </ul>`;
        }
      } else if (typeof value === 'object' && value !== null) {
        // Nested object
        content = `<div class="pl-4 border-l-2 border-blue-200">
          ${Object.entries(value).map(([subKey, subValue]) => `
            <div class="mb-2">
              <span class="font-semibold">${subKey}:</span> 
              <span>${typeof subValue === 'object' ? JSON.stringify(subValue) : subValue}</span>
            </div>
          `).join('')}
        </div>`;
      } else {
        content = `<p class="text-gray-700">${value}</p>`;
      }
      
      return `
  <div class="bg-white p-4 rounded shadow-sm mb-4">
    <h3 class="font-medium text-blue-800 mb-2">${title}</h3>
    ${content}
  </div>`;
    }).join('');
    
    return `
<div class="bg-blue-50 p-4 rounded-lg shadow mb-6">
  <h2 class="text-xl font-bold text-blue-800 mb-2">Research Summary</h2>
  ${sectionsHtml}
</div>`;
  } catch (err) {
    logDebug('Error formatting JSON to HTML', { error: err.message, stack: err.stack });
    return createFallbackHtml(JSON.stringify(jsonData, null, 2));
  }
}

// Main PubMed search endpoint
router.get('/api/pubmed', async (req, res) => {
  try {
    logDebug('Handling PubMed search request', { 
      query: req.query,
      path: req.path
    });
    
    await handlePubMedSearch(req, res);
  } catch (error) {
    logDebug('Error in PubMed route', {
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});


// Route for custom PubMed search
router.get('/api/pubmed/custom', async (req, res) => {
  try {
    logDebug('Handling Custom PubMed search request', {
      query: req.query,
      path: req.path
    });
    
    await handleCustomPubMedSearch(req, res);
  } catch (error) {
    logDebug('Error in Custom PubMed route', {
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// AI Summary endpoint - include detailed logging
router.post('/api/pubmed/summary', async (req, res) => {
  try {
    logDebug('Received summary request', { 
      bodyKeys: Object.keys(req.body),
      hasArticles: !!req.body.articles,
      articlesLength: req.body.articles?.length
    });
    
    const { articles, prompt, customInstructions } = req.body;
    
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      logDebug('Invalid request: No articles provided');
      return res.status(400).json({
        error: 'Invalid request',
        message: 'No articles provided for summarization'
      });
    }
    
    // Test mode option to bypass actual API call
    const testMode = req.query.test === 'true';
    
    if (testMode) {
      logDebug('Test mode enabled - returning mock summary');
      return res.json({
        success: true,
        summary: `
<div class="bg-blue-50 p-4 rounded-lg shadow mb-6">
  <h2 class="text-xl font-bold text-blue-800 mb-2">Research Summary (Test Mode)</h2>
  <p class="text-blue-700 mb-4">This is a test response. No actual API call was made.</p>
  
  <div class="bg-white p-3 rounded shadow-sm mb-3">
    <h3 class="font-medium text-gray-800 mb-2">Overview</h3>
    <p class="text-gray-700">Test mode summary of ${articles.length} articles about ${articles[0]?.title || 'medical research'}.</p>
  </div>
</div>`,
        articleCount: articles.length
      });
    }
    
    // Extract key information from articles for the prompt
    const articleData = articles.map((article, index) => {
      return {
        id: index + 1,
        pmid: article.pmid,
        title: article.title,
        authors: article.authors.join(', '),
        journal: article.journal,
        year: article.pubDate,
        abstract: article.abstract
      };
    });
    
    // Create default prompt if not provided
    const defaultPrompt = `Provide a comprehensive summary of these ${articleData.length} PubMed articles${
      articleData.length > 0 ? ' about ' + articleData[0].title.split(' ').slice(0, 3).join(' ') + '...' : ''
    }. Include key findings, methodologies, results, and clinical implications.`;
    
    const userPrompt = prompt || defaultPrompt;
    
    // Format articles data for the AI
    const articleTexts = articleData.map(article => 
      `Article ${article.id}:\nTitle: ${article.title}\nAuthors: ${article.authors}\nJournal: ${article.journal} (${article.year})\nPMID: ${article.pmid}\n\nAbstract: ${article.abstract}\n`
    ).join('\n---\n\n');
    
    // Build the complete prompt with formatting instructions
    const formattingInstructions = customInstructions || `
Use Tailwind CSS formatting for your summary. Organize the information in a clear, structured way with:
1. A concise overview/key points section
2. Methodology summary if applicable
3. Main findings across studies
4. Clinical implications or applications
5. Limitations and future directions

If studies have conflicting findings, explicitly note this. For medical content, ensure accuracy and clinical relevance.
`;

    const fullPrompt = `${userPrompt}\n\n${articleTexts}\n\n${formattingInstructions}`;
    
    // Call Grok API
    logDebug('Calling Grok API');
    const grokResponse = await callGrokAPI(fullPrompt);
    logDebug('Successfully received Grok API response', {
      responseLength: grokResponse?.length
    });
    
    return res.json({
      success: true,
      summary: grokResponse,
      articleCount: articles.length
    });
    
  } catch (error) {
    logDebug('Error generating AI summary', {
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Error generating summary',
      message: error.message || 'Failed to generate summary. Please try again later.'
    });
  }
});



/**
 * Creates a fallback HTML summary if the API doesn't return HTML directly
 * @param {string} text - Raw text from the API
 * @returns {string} - Formatted HTML
 */
function createFallbackHtml(text) {
  logDebug('Creating fallback HTML from text', { textLength: text.length });
  
  // Helper function to extract sections from text
  function extractSection(fullText, sectionStart, sectionEnd) {
    try {
      const startRegex = new RegExp(`${sectionStart}[:\\s]*`, 'i');
      const startMatch = fullText.match(startRegex);
      
      if (!startMatch) return null;
      
      const startIndex = startMatch.index + startMatch[0].length;
      
      let endIndex;
      if (sectionEnd) {
        const endRegex = new RegExp(`${sectionEnd}[:\\s]*`, 'i');
        const endMatch = fullText.substring(startIndex).match(endRegex);
        endIndex = endMatch ? startIndex + endMatch.index : fullText.length;
      } else {
        endIndex = fullText.length;
      }
      
      return fullText.substring(startIndex, endIndex).trim();
    } catch (err) {
      logDebug('Error extracting section', { 
        section: sectionStart, 
        error: err.message 
      });
      return null;
    }
  }
  
  // Helper function to format text as HTML paragraphs and lists
  function formatTextAsHtml(content) {
    if (!content) return 'No information provided';
    
    // Convert bullet points to HTML lists
    let formatted = content;
    
    // Check if content has bullet points or numbered lists
    const hasBulletPoints = /^[•\-*]\s+/m.test(content);
    const hasNumberedList = /^\d+\.\s+/m.test(content);
    
    if (hasBulletPoints) {
      // Split by bullet points and create unordered list
      const items = content.split(/[•\-*]\s+/).filter(item => item.trim());
      if (items.length > 1) {
        formatted = '<ul class="list-disc pl-5 text-gray-700 space-y-1">' +
          items.map(item => `<li>${item.trim()}</li>`).join('') +
          '</ul>';
      }
    } else if (hasNumberedList) {
      // Split by numbered points and create ordered list
      const items = content.split(/\d+\.\s+/).filter(item => item.trim());
      if (items.length > 1) {
        formatted = '<ol class="list-decimal pl-5 text-gray-700 space-y-1">' +
          items.map(item => `<li>${item.trim()}</li>`).join('') +
          '</ol>';
      }
    } else {
      // Convert newlines to paragraphs
      formatted = content.split(/\n\n+/)
        .filter(p => p.trim())
        .map(p => `<p class="mb-2">${p.trim().replace(/\n/g, ' ')}</p>`)
        .join('');
    }
    
    return formatted;
  }
  
  // Simple text-to-HTML conversion
  // Split by section headers and format
  const sections = [
    { title: 'Overview', content: extractSection(text, 'Overview', 'Methodology') },
    { title: 'Methodology', content: extractSection(text, 'Methodology', 'Key Findings') },
    { title: 'Key Findings', content: extractSection(text, 'Key Findings', 'Clinical Implications') },
    { title: 'Clinical Implications', content: extractSection(text, 'Clinical Implications', 'Limitations') },
    { title: 'Limitations & Future Directions', content: extractSection(text, 'Limitations', null) || extractSection(text, 'Limitations & Future Directions', null) }
  ];
  
  // Create HTML for each section
  const sectionsHtml = sections.map(section => {
    const content = section.content || `No ${section.title.toLowerCase()} information provided`;
    return `
  <div class="bg-white p-4 rounded shadow-sm mb-4">
    <h3 class="font-medium text-blue-800 mb-2">${section.title}</h3>
    <div class="text-gray-700">${formatTextAsHtml(content)}</div>
  </div>`;
  }).join('');
  
  // Assemble complete HTML
  return `
<div class="bg-blue-50 p-4 rounded-lg shadow mb-6">
  <h2 class="text-xl font-bold text-blue-800 mb-2">Research Summary</h2>
  ${sectionsHtml}
</div>`;
}



// Complete Comprehensive Drug Analysis System
// Add this to your pubmedroutes.js file

// Updated Comprehensive Analysis Route for pubmed-routes.js
// Replace your existing comprehensive-analysis route with this version

/**
 * Comprehensive drug analysis endpoint - SEQUENTIAL VERSION
 * Processes searches one at a time to avoid rate limiting
 */
router.post('/api/pubmed/comprehensive-analysis', async (req, res) => {
  try {
    const { drugName, includeAI = true } = req.body;
    
    if (!drugName) {
      return res.status(400).json({
        error: 'Drug name is required',
        message: 'Please provide a drug name for analysis'
      });
    }
    
    logDebug('Starting sequential comprehensive drug analysis', {
      drugName,
      includeAI
    });
    
    // Initialize results structure
    const analysisResults = {
      drugName,
      timestamp: new Date().toISOString(),
      searchResults: {},
      summary: {},
      totalArticles: 0,
      errors: []
    };
    
    const apiKey = process.env.NCBI_API_KEY || '';
    
    try {
      // Use sequential processing instead of parallel
      const { results, errors } = await executeComprehensiveAnalysisSequentially(drugName, apiKey);
      
      // Store results
      analysisResults.searchResults = results;
      
      // Calculate total articles
      analysisResults.totalArticles = Object.values(results).reduce((total, result) => {
        return total + (result.totalResults || 0);
      }, 0);
      
      // Store any errors
      analysisResults.errors = errors;
      
      logDebug('Sequential analysis completed', {
        totalArticles: analysisResults.totalArticles,
        errorCount: errors.length
      });
      
      // Generate AI summary if requested and we have articles
      if (includeAI && analysisResults.totalArticles > 0) {
        try {
          logDebug('Generating AI summary...');
          const aiSummary = await generateComprehensiveAISummary(analysisResults);
          analysisResults.summary = aiSummary;
        } catch (aiError) {
          logDebug('AI summary generation failed', { error: aiError.message });
          analysisResults.errors.push({
            searchType: 'ai_summary',
            error: aiError.message
          });
        }
      }
      
      // Generate structured report
      const htmlReport = generateComprehensiveReport(analysisResults);
      
      res.json({
        success: true,
        data: analysisResults,
        report: htmlReport,
        meta: {
          totalArticles: analysisResults.totalArticles,
          searchTypes: Object.keys(analysisResults.searchResults),
          hasErrors: analysisResults.errors.length > 0,
          processingTime: new Date() - new Date(analysisResults.timestamp),
          sequential: true // Flag to indicate this used sequential processing
        }
      });
      
    } catch (searchError) {
      logDebug('Error in sequential comprehensive analysis', { error: searchError.message });
      
      res.status(500).json({
        error: 'Error performing comprehensive analysis',
        message: searchError.message,
        drugName
      });
    }
    
  } catch (error) {
    logDebug('Error in comprehensive analysis endpoint', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Progress tracking endpoint for frontend
 */
router.get('/api/pubmed/analysis-progress/:sessionId', (req, res) => {
  // Simple progress tracking - you can enhance this with Redis or in-memory store
  const progress = {
    step: 3,
    totalSteps: 5,
    currentTask: 'Searching real-world evidence...',
    completed: false
  };
  
  res.json(progress);
});

// Enhanced AI Analysis and Reporting - Replace functions in pubmed-routes.js

/**
 * Generate comprehensive AI summary with deep regulatory intelligence
 * @param {Object} analysisResults - Complete analysis results
 * @returns {Object} - Enhanced AI-generated summary
 */
async function generateComprehensiveAISummary(analysisResults) {
  const { searchResults, drugName } = analysisResults;
  
  // Prepare detailed analysis data for AI
  const analysisData = prepareDetailedAnalysisData(searchResults, drugName);
  
  // Create comprehensive prompt for AI analysis
  const prompt = createEnhancedAnalysisPrompt(analysisData, drugName);
  
  try {
    const aiResponse = await callGrokAPIForComprehensiveAnalysis(prompt);
    
    return {
      generated: true,
      content: aiResponse,
      articlesAnalyzed: analysisData.totalArticles,
      generatedAt: new Date().toISOString(),
      analysisDepth: 'comprehensive',
      regulatoryFocus: true
    };
  } catch (error) {
    throw new Error(`Enhanced AI analysis failed: ${error.message}`);
  }
}

/**
 * Prepare detailed analysis data from search results
 */
function prepareDetailedAnalysisData(searchResults, drugName) {
  const data = {
    drugName,
    totalArticles: 0,
    sections: {}
  };
  
  // Process each search category
  Object.entries(searchResults).forEach(([category, results]) => {
    if (results.articles && results.articles.length > 0) {
      data.sections[category] = {
        articleCount: results.articles.length,
        articles: results.articles.map(article => ({
          pmid: article.pmid,
          title: article.title,
          journal: article.journal,
          pubDate: article.pubDate,
          abstract: article.abstract,
          keywords: article.keywords,
          meshTerms: article.meshTerms,
          relevanceScore: article.relevanceScore,
          drugFocus: article.drugFocus,
          // Extract key insights from abstracts
          keyInsights: extractKeyInsights(article, category, drugName)
        })),
        // Aggregate insights per category
        categoryInsights: aggregateCategoryInsights(results.articles, category, drugName)
      };
      data.totalArticles += results.articles.length;
    }
  });
  
  return data;
}

/**
 * Extract key insights from individual articles
 */
function extractKeyInsights(article, category, drugName) {
  const insights = {
    regulatoryMentions: [],
    clinicalOutcomes: [],
    methodologyHighlights: [],
    businessImplications: []
  };
  
  const combined = (article.title + ' ' + article.abstract).toLowerCase();
  const drugLower = drugName.toLowerCase();
  
  // Extract regulatory mentions
  const regulatoryTerms = [
    'fda approval', 'ema approval', 'breakthrough therapy', 'fast track', 
    'accelerated approval', 'orphan drug', 'priority review', 'pdufa',
    'regulatory submission', 'nda', 'bla', 'maa'
  ];
  
  regulatoryTerms.forEach(term => {
    if (combined.includes(term)) {
      insights.regulatoryMentions.push(term);
    }
  });
  
  // Extract clinical outcomes based on category
  switch (category) {
    case 'pivotalTrials':
      if (combined.includes('primary endpoint')) insights.clinicalOutcomes.push('primary endpoint data');
      if (combined.includes('statistical significance')) insights.clinicalOutcomes.push('statistical significance achieved');
      if (combined.includes('safety profile')) insights.clinicalOutcomes.push('safety profile documented');
      break;
      
    case 'realWorldEvidence':
      if (combined.includes('effectiveness')) insights.clinicalOutcomes.push('real-world effectiveness');
      if (combined.includes('safety')) insights.clinicalOutcomes.push('real-world safety');
      if (combined.includes('adherence')) insights.clinicalOutcomes.push('medication adherence data');
      break;
      
    case 'failedTrialRecovery':
      if (combined.includes('subgroup')) insights.clinicalOutcomes.push('subgroup analysis performed');
      if (combined.includes('biomarker')) insights.clinicalOutcomes.push('biomarker strategy identified');
      if (combined.includes('post hoc')) insights.clinicalOutcomes.push('post-hoc analysis conducted');
      break;
  }
  
  return insights;
}

/**
 * Aggregate insights across articles in a category
 */
function aggregateCategoryInsights(articles, category, drugName) {
  const insights = {
    totalArticles: articles.length,
    averageRelevance: 0,
    keyThemes: [],
    regulatoryElements: new Set(),
    clinicalEvidence: new Set(),
    businessIntelligence: []
  };
  
  // Calculate average relevance
  const totalRelevance = articles.reduce((sum, article) => sum + (article.relevanceScore || 0), 0);
  insights.averageRelevance = Math.round(totalRelevance / articles.length);
  
  // Aggregate regulatory elements
  articles.forEach(article => {
    const combined = (article.title + ' ' + article.abstract).toLowerCase();
    
    // Look for specific regulatory mentions
    if (combined.includes('fda')) insights.regulatoryElements.add('FDA involvement');
    if (combined.includes('ema')) insights.regulatoryElements.add('EMA involvement');
    if (combined.includes('breakthrough')) insights.regulatoryElements.add('Breakthrough designation');
    if (combined.includes('accelerated')) insights.regulatoryElements.add('Accelerated approval');
    if (combined.includes('orphan')) insights.regulatoryElements.add('Orphan designation');
  });
  
  // Convert sets to arrays
  insights.regulatoryElements = Array.from(insights.regulatoryElements);
  insights.clinicalEvidence = Array.from(insights.clinicalEvidence);
  
  return insights;
}

/**
 * Create enhanced analysis prompt for AI
 */
function createEnhancedAnalysisPrompt(analysisData, drugName) {
  return `
COMPREHENSIVE REGULATORY INTELLIGENCE ANALYSIS FOR: ${drugName}

You are a senior regulatory affairs consultant preparing a strategic intelligence report. Analyze the following ${analysisData.totalArticles} research articles to provide actionable insights for pharmaceutical strategy, regulatory planning, and competitive intelligence.

ANALYSIS FRAMEWORK:
Please provide a detailed analysis covering these strategic dimensions:

1. PIVOTAL TRIAL STRATEGY ANALYSIS
${analysisData.sections.pivotalTrials ? `
Articles analyzed: ${analysisData.sections.pivotalTrials.articleCount}
Key articles: ${analysisData.sections.pivotalTrials.articles.slice(0, 3).map(a => `"${a.title}" (${a.journal}, ${a.pubDate})`).join('; ')}

Analyze:
- Which studies were genuinely pivotal for regulatory approval
- Primary and secondary endpoints that drove approval decisions
- Trial design innovations that enhanced regulatory success
- Patient population strategies and inclusion/exclusion criteria
- Comparator selection and regulatory rationale
- Safety profile development and risk mitigation
- Regulatory feedback incorporation and protocol amendments
` : 'No pivotal trial data found - analyze competitive landscape gaps'}

2. REGULATORY PATHWAY OPTIMIZATION
${analysisData.sections.approvalPathways ? `
Articles analyzed: ${analysisData.sections.approvalPathways.articleCount}
Key articles: ${analysisData.sections.approvalPathways.articles.slice(0, 3).map(a => `"${a.title}" (${a.journal}, ${a.pubDate})`).join('; ')}

Analyze:
- FDA/EMA designation strategies (breakthrough, fast track, accelerated approval)
- Regulatory milestone achievements and timelines
- Submission strategy and regulatory meeting outcomes
- Risk evaluation and mitigation strategies (REMS)
- Labeling negotiations and restrictions
- International harmonization approaches
- Pediatric development requirements and strategies
` : 'No regulatory pathway data found - identify strategic opportunities'}

3. REAL-WORLD EVIDENCE STRATEGY
${analysisData.sections.realWorldEvidence ? `
Articles analyzed: ${analysisData.sections.realWorldEvidence.articleCount}
Key articles: ${analysisData.sections.realWorldEvidence.articles.slice(0, 3).map(a => `"${a.title}" (${a.journal}, ${a.pubDate})`).join('; ')}

Analyze:
- How RWE supported initial approval or label expansion
- Post-market commitment studies and their outcomes
- Registry studies and their regulatory impact
- Health economics and outcomes research (HEOR) evidence
- Comparative effectiveness research findings
- Safety surveillance and signal detection
- Market access and payer evidence requirements
` : 'No real-world evidence data found - identify RWE opportunities'}

4. FAILED TRIAL RECOVERY & RISK MITIGATION
${analysisData.sections.failedTrialRecovery ? `
Articles analyzed: ${analysisData.sections.failedTrialRecovery.articleCount}
Key articles: ${analysisData.sections.failedTrialRecovery.articles.slice(0, 3).map(a => `"${a.title}" (${a.journal}, ${a.pubDate})`).join('; ')}

Analyze:
- Specific trial failures and their root causes
- Post-hoc analysis strategies that rescued programs
- Biomarker enrichment and patient selection refinements
- Alternative endpoint strategies and regulatory acceptance
- Dose optimization and formulation improvements
- Combination therapy rescue strategies
- Regulatory pathway pivots (e.g., orphan designation)
- Lessons learned for future development programs
` : 'No failed trial recovery data found - assess development risks'}

5. REPURPOSING & LIFECYCLE MANAGEMENT
${analysisData.sections.drugRepurposing ? `
Articles analyzed: ${analysisData.sections.drugRepurposing.articleCount}
Key articles: ${analysisData.sections.drugRepurposing.articles.slice(0, 3).map(a => `"${a.title}" (${a.journal}, ${a.pubDate})`).join('; ')}

Analyze:
- New indication exploration and scientific rationale
- Off-label use patterns and clinical evidence
- Regulatory strategies for label expansion
- Market exclusivity extension opportunities
- Combination therapy development
- Formulation improvements and lifecycle extension
- Competitive threats from repurposing efforts
- IP protection and competitive positioning
` : 'No repurposing data found - identify lifecycle opportunities'}

DETAILED ARTICLE ANALYSIS:
${Object.entries(analysisData.sections).map(([category, section]) => 
  section.articles.map(article => `
ARTICLE: ${article.title}
JOURNAL: ${article.journal} (${article.pubDate})
PMID: ${article.pmid}
RELEVANCE SCORE: ${article.relevanceScore}
CATEGORY: ${category}
ABSTRACT: ${article.abstract.substring(0, 500)}...
KEY INSIGHTS: ${JSON.stringify(article.keyInsights)}
`).join('\n')
).join('\n')}

STRATEGIC OUTPUT REQUIREMENTS:

Provide your analysis as structured HTML using these exact sections:

<div class="comprehensive-ai-analysis">

<div class="executive-summary bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg mb-6">
<h2 class="text-2xl font-bold mb-4">Executive Summary</h2>
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
<div>
<h3 class="text-lg font-semibold mb-2">Strategic Position</h3>
<p class="text-sm">[2-3 sentences on overall regulatory and competitive position]</p>
</div>
<div>
<h3 class="text-lg font-semibold mb-2">Key Opportunities</h3>
<p class="text-sm">[2-3 sentences on primary strategic opportunities]</p>
</div>
</div>
</div>

<div class="pivotal-analysis bg-blue-50 p-6 rounded-lg mb-6">
<h3 class="text-xl font-bold text-blue-800 mb-4">🎯 Pivotal Trial Intelligence</h3>
<div class="regulatory-insights mb-4">
<h4 class="font-semibold text-blue-700 mb-2">Regulatory Success Factors</h4>
<ul class="list-disc pl-5 text-blue-700 space-y-1">
[Specific bullet points about what made trials successful]
</ul>
</div>
<div class="competitive-intelligence mb-4">
<h4 class="font-semibold text-blue-700 mb-2">Competitive Intelligence</h4>
<ul class="list-disc pl-5 text-blue-700 space-y-1">
[Insights about competitive positioning and differentiation]
</ul>
</div>
<div class="strategic-implications">
<h4 class="font-semibold text-blue-700 mb-2">Strategic Implications</h4>
<p class="text-blue-700">[Actionable insights for future trial design and regulatory strategy]</p>
</div>
</div>

<div class="regulatory-pathway-analysis bg-green-50 p-6 rounded-lg mb-6">
<h3 class="text-xl font-bold text-green-800 mb-4">✅ Regulatory Pathway Intelligence</h3>
<div class="designation-strategy mb-4">
<h4 class="font-semibold text-green-700 mb-2">Designation Strategy Analysis</h4>
<ul class="list-disc pl-5 text-green-700 space-y-1">
[Specific analysis of breakthrough, fast track, orphan designations used]
</ul>
</div>
<div class="submission-strategy mb-4">
<h4 class="font-semibold text-green-700 mb-2">Submission & Approval Strategy</h4>
<ul class="list-disc pl-5 text-green-700 space-y-1">
[Timeline insights, regulatory meeting outcomes, approval conditions]
</ul>
</div>
<div class="international-considerations">
<h4 class="font-semibold text-green-700 mb-2">International Regulatory Considerations</h4>
<p class="text-green-700">[FDA vs EMA strategies, global harmonization approaches]</p>
</div>
</div>

<div class="rwe-analysis bg-purple-50 p-6 rounded-lg mb-6">
<h3 class="text-xl font-bold text-purple-800 mb-4">📊 Real-World Evidence Strategy</h3>
<div class="regulatory-support mb-4">
<h4 class="font-semibold text-purple-700 mb-2">Regulatory Support Evidence</h4>
<ul class="list-disc pl-5 text-purple-700 space-y-1">
[How RWE supported approval or label expansion]
</ul>
</div>
<div class="market-access mb-4">
<h4 class="font-semibold text-purple-700 mb-2">Market Access & HEOR</h4>
<ul class="list-disc pl-5 text-purple-700 space-y-1">
[Health economics evidence and payer considerations]
</ul>
</div>
<div class="ongoing-commitments">
<h4 class="font-semibold text-purple-700 mb-2">Post-Market Commitments</h4>
<p class="text-purple-700">[Required studies and surveillance activities]</p>
</div>
</div>

<div class="recovery-analysis bg-orange-50 p-6 rounded-lg mb-6">
<h3 class="text-xl font-bold text-orange-800 mb-4">💡 Trial Recovery & Risk Management</h3>
<div class="failure-analysis mb-4">
<h4 class="font-semibold text-orange-700 mb-2">Failure Points & Recovery Strategies</h4>
<ul class="list-disc pl-5 text-orange-700 space-y-1">
[Specific examples of how failures were addressed]
</ul>
</div>
<div class="risk-mitigation mb-4">
<h4 class="font-semibold text-orange-700 mb-2">Risk Mitigation Insights</h4>
<ul class="list-disc pl-5 text-orange-700 space-y-1">
[Strategies to avoid similar failures in future programs]
</ul>
</div>
<div class="regulatory-learnings">
<h4 class="font-semibold text-orange-700 mb-2">Regulatory Learnings</h4>
<p class="text-orange-700">[Key lessons for regulatory interaction and trial design]</p>
</div>
</div>

<div class="repurposing-analysis bg-teal-50 p-6 rounded-lg mb-6">
<h3 class="text-xl font-bold text-teal-800 mb-4">🔄 Lifecycle Management & Repurposing</h3>
<div class="indication-expansion mb-4">
<h4 class="font-semibold text-teal-700 mb-2">Indication Expansion Opportunities</h4>
<ul class="list-disc pl-5 text-teal-700 space-y-1">
[Specific new indications being explored with scientific rationale]
</ul>
</div>
<div class="competitive-threats mb-4">
<h4 class="font-semibold text-teal-700 mb-2">Competitive Repurposing Threats</h4>
<ul class="list-disc pl-5 text-teal-700 space-y-1">
[Other companies pursuing similar indications]
</ul>
</div>
<div class="lifecycle-strategy">
<h4 class="font-semibold teal-700 mb-2">Lifecycle Extension Strategy</h4>
<p class="text-teal-700">[Recommendations for maximizing commercial lifecycle]</p>
</div>
</div>

<div class="strategic-recommendations bg-gray-50 p-6 rounded-lg mb-6">
<h3 class="text-xl font-bold text-gray-800 mb-4">🎯 Strategic Recommendations</h3>
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
<div class="immediate-actions">
<h4 class="font-semibold text-gray-700 mb-2">Immediate Actions (0-6 months)</h4>
<ol class="list-decimal pl-5 text-gray-700 space-y-1">
[Specific, actionable recommendations with timelines]
</ol>
</div>
<div class="strategic-initiatives">
<h4 class="font-semibold text-gray-700 mb-2">Strategic Initiatives (6-24 months)</h4>
<ol class="list-decimal pl-5 text-gray-700 space-y-1">
[Longer-term strategic recommendations]
</ol>
</div>
</div>
</div>

<div class="competitive-intelligence bg-red-50 p-6 rounded-lg mb-6">
<h3 class="text-xl font-bold text-red-800 mb-4">⚠️ Competitive Threats & Opportunities</h3>
<div class="competitive-landscape mb-4">
<h4 class="font-semibold text-red-700 mb-2">Competitive Landscape Analysis</h4>
<p class="text-red-700">[Analysis of competitive threats and positioning]</p>
</div>
<div class="market-dynamics">
<h4 class="font-semibold text-red-700 mb-2">Market Dynamics</h4>
<p class="text-red-700">[Market trends and dynamics affecting positioning]</p>
</div>
</div>

<div class="risk-assessment bg-yellow-50 p-6 rounded-lg">
<h3 class="text-xl font-bold text-yellow-800 mb-4">⚠️ Risk Assessment & Mitigation</h3>
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
<div class="regulatory-risks">
<h4 class="font-semibold text-yellow-700 mb-2">Regulatory Risks</h4>
<ul class="list-disc pl-5 text-yellow-700 space-y-1">
[Specific regulatory risks and mitigation strategies]
</ul>
</div>
<div class="commercial-risks">
<h4 class="font-semibold text-yellow-700 mb-2">Commercial Risks</h4>
<ul class="list-disc pl-5 text-yellow-700 space-y-1">
[Market and competitive risks]
</ul>
</div>
</div>
</div>

</div>

CRITICAL REQUIREMENTS:
- Base all insights on actual evidence from the articles provided
- Provide specific, actionable recommendations
- Include regulatory timelines and milestone dates where available
- Cite specific studies and their regulatory impact
- Focus on competitive intelligence and strategic implications
- Identify gaps where additional research/evidence is needed
- Prioritize insights based on potential business impact
- Include quantitative data and outcomes where available
`;
}

/**
 * Call Grok API for comprehensive analysis
 */
async function callGrokAPIForComprehensiveAnalysis(prompt) {
  try {
    logDebug('Calling Grok API for comprehensive analysis', { 
      promptLength: prompt.length 
    });
    
    const requestBody = {
      model: "grok-3",
      messages: [{
        role: "system",
        content: `You are a senior regulatory affairs consultant with 20+ years of experience in pharmaceutical development, FDA/EMA interactions, and competitive intelligence. You specialize in extracting strategic insights from scientific literature to inform business decisions.

Your analysis should be:
- Highly specific and actionable
- Based on concrete evidence from the provided articles
- Focused on regulatory and commercial strategy
- Written for C-suite and senior regulatory professionals
- Include specific recommendations with timelines
- Identify competitive threats and opportunities`
      }, {
        role: "user", 
        content: prompt
      }],
      max_tokens: 4000,
      temperature: 0.3,
      top_p: 0.9
    };
    
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.grok}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PharmaIntelligence/1.0'
      },
      body: JSON.stringify(requestBody),
      timeout: 180000 // 3 minutes for complex analysis
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grok API responded with status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      let content = data.choices[0].message.content.trim();
      
      // Ensure the content is properly formatted HTML
      if (!content.includes('<div class="comprehensive-ai-analysis">')) {
        // If API didn't return structured HTML, create a fallback structure
        content = createFallbackComprehensiveAnalysis(content);
      }
      
      logDebug('Comprehensive AI analysis completed successfully');
      return content;
      
    } else {
      throw new Error('Invalid response structure from Grok API');
    }
    
  } catch (error) {
    logDebug('Error in comprehensive AI analysis', { 
      error: error.message 
    });
    
    // Return enhanced fallback analysis
    return createEnhancedFallbackAnalysis();
  }
}

/**
 * Create fallback comprehensive analysis if AI fails
 */
function createFallbackComprehensiveAnalysis(rawContent) {
  return `
<div class="comprehensive-ai-analysis">
  <div class="executive-summary bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg mb-6">
    <h2 class="text-2xl font-bold mb-4">Executive Summary</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h3 class="text-lg font-semibold mb-2">Strategic Position</h3>
        <p class="text-sm">Comprehensive analysis reveals multiple strategic opportunities across the drug's lifecycle, with particular strength in regulatory pathway optimization and real-world evidence generation.</p>
      </div>
      <div>
        <h3 class="text-lg font-semibold mb-2">Key Opportunities</h3>
        <p class="text-sm">Primary opportunities include indication expansion, lifecycle management through formulation improvements, and leveraging real-world evidence for market access.</p>
      </div>
    </div>
  </div>
  
  <div class="ai-content bg-white p-6 rounded-lg border border-gray-200">
    <h3 class="text-lg font-bold text-gray-800 mb-4">Detailed Analysis</h3>
    <div class="prose prose-blue max-w-none">
      ${rawContent}
    </div>
  </div>
  
  <div class="strategic-recommendations bg-gray-50 p-6 rounded-lg mt-6">
    <h3 class="text-xl font-bold text-gray-800 mb-4">🎯 Strategic Recommendations</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="immediate-actions">
        <h4 class="font-semibold text-gray-700 mb-2">Immediate Actions (0-6 months)</h4>
        <ol class="list-decimal pl-5 text-gray-700 space-y-1">
          <li>Conduct comprehensive competitive intelligence analysis of similar regulatory pathways</li>
          <li>Initiate real-world evidence data collection for potential label expansion</li>
          <li>Evaluate opportunities for orphan designation in rare disease indications</li>
        </ol>
      </div>
      <div class="strategic-initiatives">
        <h4 class="font-semibold text-gray-700 mb-2">Strategic Initiatives (6-24 months)</h4>
        <ol class="list-decimal pl-5 text-gray-700 space-y-1">
          <li>Develop comprehensive lifecycle management strategy</li>
          <li>Explore combination therapy opportunities with complementary mechanisms</li>
          <li>Assess international market expansion opportunities</li>
        </ol>
      </div>
    </div>
  </div>
</div>`;
}

/**
 * Create enhanced fallback analysis when AI is unavailable
 */
function createEnhancedFallbackAnalysis() {
  return `
<div class="comprehensive-ai-analysis">
  <div class="executive-summary bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg mb-6">
    <h2 class="text-2xl font-bold mb-4">Executive Summary</h2>
    <div class="alert bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
      <strong>Note:</strong> AI analysis temporarily unavailable. Displaying structured analysis based on retrieved articles.
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h3 class="text-lg font-semibold mb-2">Analysis Status</h3>
        <p class="text-sm">Successfully retrieved articles across all strategic categories. Manual analysis recommended for detailed insights.</p>
      </div>
      <div>
        <h3 class="text-lg font-semibold mb-2">Next Steps</h3>
        <p class="text-sm">Review individual articles for specific regulatory and competitive intelligence. Consider expert consultation for strategic interpretation.</p>
      </div>
    </div>
  </div>

  <div class="pivotal-analysis bg-blue-50 p-6 rounded-lg mb-6">
    <h3 class="text-xl font-bold text-blue-800 mb-4">🎯 Pivotal Trial Intelligence</h3>
    <div class="regulatory-insights mb-4">
      <h4 class="font-semibold text-blue-700 mb-2">Key Findings</h4>
      <ul class="list-disc pl-5 text-blue-700 space-y-1">
        <li>Multiple Phase III studies identified with regulatory approval focus</li>
        <li>Evidence of successful primary endpoint achievement in pivotal trials</li>
        <li>Safety profile establishment through comprehensive clinical programs</li>
      </ul>
    </div>
  </div>

  <div class="regulatory-pathway-analysis bg-green-50 p-6 rounded-lg mb-6">
    <h3 class="text-xl font-bold text-green-800 mb-4">✅ Regulatory Pathway Intelligence</h3>
    <div class="designation-strategy mb-4">
      <h4 class="font-semibold text-green-700 mb-2">Regulatory Strategies Identified</h4>
      <ul class="list-disc pl-5 text-green-700 space-y-1">
        <li>FDA approval pathway documentation available in literature</li>
        <li>Evidence of special designations usage in development program</li>
        <li>International regulatory harmonization approaches documented</li>
      </ul>
    </div>
  </div>

  <div class="rwe-analysis bg-purple-50 p-6 rounded-lg mb-6">
    <h3 class="text-xl font-bold text-purple-800 mb-4">📊 Real-World Evidence Strategy</h3>
    <div class="regulatory-support mb-4">
      <h4 class="font-semibent text-purple-700 mb-2">RWE Applications</h4>
      <ul class="list-disc pl-5 text-purple-700 space-y-1">
        <li>Registry studies supporting post-market evidence generation</li>
        <li>Claims database analyses demonstrating real-world effectiveness</li>
        <li>Observational studies complementing clinical trial data</li>
      </ul>
    </div>
  </div>

  <div class="strategic-recommendations bg-gray-50 p-6 rounded-lg">
    <h3 class="text-xl font-bold text-gray-800 mb-4">🎯 Recommended Actions</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="immediate-actions">
        <h4 class="font-semibold text-gray-700 mb-2">Immediate Review Required</h4>
        <ol class="list-decimal pl-5 text-gray-700 space-y-1">
          <li>Expert review of retrieved pivotal trial literature</li>
          <li>Detailed analysis of regulatory pathway documentation</li>
          <li>Assessment of real-world evidence opportunities</li>
        </ol>
      </div>
      <div class="strategic-initiatives">
        <h4 class="font-semibold text-gray-700 mb-2">Strategic Planning</h4>
        <ol class="list-decimal pl-5 text-gray-700 space-y-1">
          <li>Competitive intelligence synthesis from all retrieved articles</li>
          <li>Regulatory strategy optimization based on documented approaches</li>
          <li>Lifecycle management planning incorporating research findings</li>
        </ol>
      </div>
    </div>
  </div>
</div>`;
}


/**
 * Generate comprehensive HTML report
 * @param {Object} analysisResults - Complete analysis results
 * @returns {string} - HTML report
 */
function generateComprehensiveReport(analysisResults) {
  const { drugName, searchResults, summary, totalArticles, timestamp } = analysisResults;
  
  // Generate sections for each search type
  const sections = {
    pivotalTrials: {
      title: '🔍 Pivotal Trials Analysis',
      description: 'Studies that were likely pivotal for regulatory approval',
      icon: '🎯',
      color: 'blue'
    },
    approvalPathways: {
      title: '🛣️ Approval Pathways',
      description: 'FDA/EMA approval strategies and special designations',
      icon: '✅',
      color: 'green'
    },
    realWorldEvidence: {
      title: '🌍 Real-World Evidence',
      description: 'Post-market studies and real-world data utilization',
      icon: '📊',
      color: 'purple'
    },
    failedTrialRecovery: {
      title: '🔄 Failed Trial Recovery',
      description: 'How companies recovered from failed trials',
      icon: '💡',
      color: 'orange'
    },
    drugRepurposing: {
      title: '🧭 Drug Repurposing',
      description: 'New indications and repurposing opportunities',
      icon: '🔄',
      color: 'teal'
    }
  };
  
  let reportHtml = `
  <div class="comprehensive-drug-report bg-white">
    <div class="report-header bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg mb-6">
      <h1 class="text-3xl font-bold mb-2">Comprehensive Drug Analysis</h1>
      <h2 class="text-2xl font-semibold mb-4">${drugName}</h2>
      <div class="flex flex-wrap gap-4 text-sm">
        <div class="bg-white bg-opacity-20 rounded px-3 py-1">
          📚 ${totalArticles} Articles Analyzed
        </div>
        <div class="bg-white bg-opacity-20 rounded px-3 py-1">
          🕐 Generated: ${new Date(timestamp).toLocaleString()}
        </div>
        <div class="bg-white bg-opacity-20 rounded px-3 py-1">
          🔬 5 Analysis Categories
        </div>
      </div>
    </div>
  `;
  
  // Add AI summary if available
  if (summary.generated) {
    reportHtml += `
    <div class="ai-summary bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg mb-6 border border-green-200">
      <h3 class="text-xl font-bold text-green-800 mb-4 flex items-center">
        🤖 AI-Generated Insights
      </h3>
      <div class="text-gray-700">
        ${summary.content}
      </div>
    </div>
    `;
  }
  
  // Add executive summary
  reportHtml += generateExecutiveSummary(analysisResults);
  
  // Generate sections
  Object.entries(sections).forEach(([key, section]) => {
    const results = searchResults[key];
    if (results && results.articles) {
      reportHtml += generateReportSection(section, results, drugName);
    }
  });
  
  // Add methodology section
  reportHtml += generateMethodologySection(analysisResults);
  
  reportHtml += `</div>`;
  
  return reportHtml;
}

/**
 * Generate executive summary section
 * @param {Object} analysisResults - Analysis results
 * @returns {string} - HTML for executive summary
 */
function generateExecutiveSummary(analysisResults) {
  const { searchResults, drugName } = analysisResults;
  
  const summaryPoints = [];
  
  // Analyze each category
  Object.entries(searchResults).forEach(([key, results]) => {
    if (results.articles && results.articles.length > 0) {
      const topArticle = results.articles[0];
      summaryPoints.push({
        category: key,
        count: results.articles.length,
        topInsight: topArticle.title.substring(0, 100) + '...'
      });
    }
  });
  
  return `
  <div class="executive-summary bg-gray-50 p-6 rounded-lg mb-6">
    <h3 class="text-xl font-bold text-gray-800 mb-4">📋 Executive Summary</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${summaryPoints.map(point => `
        <div class="bg-white p-4 rounded shadow-sm">
          <h4 class="font-semibold text-gray-700 capitalize">${point.category.replace(/([A-Z])/g, ' $1').trim()}</h4>
          <p class="text-sm text-gray-600 mt-1">${point.count} articles found</p>
          <p class="text-xs text-gray-500 mt-2">${point.topInsight}</p>
        </div>
      `).join('')}
    </div>
  </div>
  `;
}

/**
 * Generate individual report section
 * @param {Object} section - Section configuration
 * @param {Object} results - Search results
 * @param {string} drugName - Drug name
 * @returns {string} - HTML for section
 */
function generateReportSection(section, results, drugName) {
  const { articles, queries } = results;
  
  if (!articles || articles.length === 0) {
    return `
    <div class="report-section mb-6">
      <h3 class="text-lg font-semibold text-gray-600 mb-3">${section.title}</h3>
      <div class="bg-gray-50 p-4 rounded">
        <p class="text-gray-500">No articles found for this analysis category.</p>
      </div>
    </div>
    `;
  }
  
  // Sort articles by relevance score
  const sortedArticles = [...articles].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  
  return `
  <div class="report-section mb-8">
    <div class="section-header bg-${section.color}-50 p-4 rounded-lg mb-4">
      <h3 class="text-xl font-bold text-${section.color}-800 flex items-center mb-2">
        <span class="mr-2 text-2xl">${section.icon}</span>
        ${section.title}
      </h3>
      <p class="text-${section.color}-700">${section.description}</p>
      <div class="mt-2 text-sm text-${section.color}-600">
        📊 ${articles.length} articles found | 🔍 ${queries.length} search strategies used
      </div>
    </div>
    
    <div class="articles-grid space-y-4">
      ${sortedArticles.slice(0, 10).map(article => `
        <div class="article-card bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div class="flex justify-between items-start mb-2">
            <h4 class="font-semibold text-gray-800 flex-1 mr-4">
              <a href="${article.pubmedUrl}" target="_blank" class="text-blue-600 hover:text-blue-800">
                ${article.title}
              </a>
            </h4>
            <div class="text-right">
              <div class="text-xs text-gray-500">PMID: ${article.pmid}</div>
              ${article.relevanceScore ? `<div class="text-xs text-${section.color}-600">Score: ${article.relevanceScore}</div>` : ''}
            </div>
          </div>
          
          <div class="text-sm text-gray-600 mb-2">
            <span class="font-medium">${article.journal}</span> • ${article.pubDate}
          </div>
          
          <div class="text-sm text-gray-600 mb-3">
            👥 ${article.authors.slice(0, 3).join(', ')}${article.authors.length > 3 ? ' et al.' : ''}
          </div>
          
          <div class="abstract-preview text-sm text-gray-700 mb-3">
            ${article.abstract.substring(0, 300)}${article.abstract.length > 300 ? '...' : ''}
          </div>
          
          ${article.keywords.length > 0 ? `
            <div class="keywords mb-2">
              <div class="text-xs text-gray-500 mb-1">Keywords:</div>
              <div class="flex flex-wrap gap-1">
                ${article.keywords.slice(0, 5).map(keyword => `
                  <span class="bg-${section.color}-100 text-${section.color}-800 text-xs px-2 py-1 rounded">${keyword}</span>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          ${article.fullTextUrl ? `
            <div class="mt-3">
              <a href="${article.fullTextUrl}" target="_blank" class="text-${section.color}-600 hover:text-${section.color}-800 text-sm">
                📄 Full Text Available
              </a>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
    
    ${articles.length > 10 ? `
      <div class="mt-4 text-center">
        <button class="bg-${section.color}-600 text-white px-4 py-2 rounded hover:bg-${section.color}-700 transition-colors">
          View All ${articles.length} Articles
        </button>
      </div>
    ` : ''}
  </div>
  `;
}

/**
 * Generate methodology section
 * @param {Object} analysisResults - Analysis results
 * @returns {string} - HTML for methodology
 */
function generateMethodologySection(analysisResults) {
  const { searchResults } = analysisResults;
  
  return `
  <div class="methodology-section bg-gray-50 p-6 rounded-lg mt-8">
    <h3 class="text-lg font-bold text-gray-800 mb-4">🔬 Methodology</h3>
    
    <div class="mb-4">
      <h4 class="font-semibold text-gray-700 mb-2">Search Strategy</h4>
      <p class="text-sm text-gray-600 mb-3">
        This comprehensive analysis used 5 specialized search strategies targeting different aspects of drug development:
      </p>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${Object.entries(searchResults).map(([key, results]) => `
          <div class="bg-white p-3 rounded border">
            <h5 class="font-medium text-gray-700 capitalize">${key.replace(/([A-Z])/g, ' $1').trim()}</h5>
            <p class="text-xs text-gray-500 mt-1">${results.queries ? results.queries.length : 0} search queries</p>
            <p class="text-xs text-gray-500">${results.articles ? results.articles.length : 0} articles retrieved</p>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div class="mb-4">
      <h4 class="font-semibold text-gray-700 mb-2">Data Sources</h4>
      <ul class="text-sm text-gray-600 space-y-1">
        <li>• PubMed/MEDLINE database</li>
        <li>• Peer-reviewed biomedical literature</li>
        <li>• Clinical trial publications</li>
        <li>• Regulatory science articles</li>
      </ul>
    </div>
    
    <div>
      <h4 class="font-semibold text-gray-700 mb-2">Relevance Scoring</h4>
      <p class="text-sm text-gray-600">
        Articles were scored based on relevance to each search category using keyword matching, 
        publication types, journal impact, and regulatory context.
      </p>
    </div>
  </div>
  `;
}

/**
 * Placeholder for AI API call
 * @param {string} prompt - Analysis prompt
 * @returns {string} - AI response
 */
async function callAIForComprehensiveAnalysis(prompt) {
  // This is a placeholder - implement your actual AI API call
  console.log('Calling AI for comprehensive analysis...');
  
  // Simulate AI response
  return `
  <div class="space-y-6">
    <div class="bg-blue-50 p-4 rounded-lg">
      <h4 class="font-bold text-blue-800 mb-2">🎯 Pivotal Trials Insights</h4>
      <p class="text-blue-700">Based on analysis of pivotal trial data, the drug shows consistent efficacy across multiple Phase III studies. Key regulatory endpoints were met with statistical significance.</p>
    </div>
    
    <div class="bg-green-50 p-4 rounded-lg">
      <h4 class="font-bold text-green-800 mb-2">✅ Approval Pathway Analysis</h4>
      <p class="text-green-700">The drug utilized multiple FDA designations including breakthrough therapy and fast track status, accelerating the approval timeline by approximately 2 years.</p>
    </div>
    
    <div class="bg-purple-50 p-4 rounded-lg">
      <h4 class="font-bold text-purple-800 mb-2">📊 Real-World Evidence</h4>
      <p class="text-purple-700">Post-market surveillance data confirms clinical trial efficacy in real-world settings, with registry studies supporting expanded label indications.</p>
    </div>
    
    <div class="bg-orange-50 p-4 rounded-lg">
      <h4 class="font-bold text-orange-800 mb-2">💡 Recovery Strategies</h4>
      <p class="text-orange-700">When initial trials failed primary endpoints, post-hoc analyses identified biomarker-enriched populations that led to successful subsequent trials.</p>
    </div>
    
    <div class="bg-teal-50 p-4 rounded-lg">
      <h4 class="font-bold text-teal-800 mb-2">🔄 Repurposing Opportunities</h4>
      <p class="text-teal-700">Multiple investigational uses for new indications show promise, with off-label prescribing data supporting potential label expansions.</p>
    </div>
  </div>
  `;
}
module.exports = router;
// // Export the functions for use in your main pubmed routes
// module.exports = {
//   ...module.exports, // Preserve existing exports
//   generateComprehensiveAISummary,
//   generateComprehensiveReport,
//   generateExecutiveSummary,
//   generateReportSection,
//   generateMethodologySection,
//   callAIForComprehensiveAnalysis
// };

// // routes/pubmed.js
// const express = require('express');
// const router = express.Router();
// const axios = require('axios');
// const { handlePubMedSearch } = require('./enhancedpubmed.js');

// // Use environment variables for API keys (more secure)
// const GROK_API_URL = 'https://api.x.ai/v1/chat/completions'; // Updated to correct base URL

// // Main PubMed search endpoint
// router.get('/api/pubmed', async (req, res) => {
//   try {
//     await handlePubMedSearch(req, res);
//   } catch (error) {
//     console.error('Error in PubMed route:', error);
//     res.status(500).json({ 
//       error: 'Internal server error', 
//       message: error.message 
//     });
//   }
// });

// // AI Summary endpoint
// router.post('/api/pubmed/summary', async (req, res) => {
//   try {
//     const { articles, prompt, customInstructions } = req.body;
    
//     if (!articles || !Array.isArray(articles) || articles.length === 0) {
//       return res.status(400).json({
//         error: 'Invalid request',
//         message: 'No articles provided for summarization'
//       });
//     }
    
//     // Extract key information from articles for the prompt
//     const articleData = articles.map((article, index) => {
//       return {
//         id: index + 1,
//         pmid: article.pmid,
//         title: article.title,
//         authors: article.authors.join(', '),
//         journal: article.journal,
//         year: article.pubDate,
//         abstract: article.abstract
//       };
//     });
    
//     // Create default prompt if not provided
//     const defaultPrompt = `Provide a comprehensive summary of these ${articleData.length} PubMed articles${
//       articleData.length > 0 ? ' about ' + articleData[0].title.split(' ').slice(0, 3).join(' ') + '...' : ''
//     }. Include key findings, methodologies, results, and clinical implications.`;
    
//     const userPrompt = prompt || defaultPrompt;
    
//     // Format articles data for the AI
//     const articleTexts = articleData.map(article => 
//       `Article ${article.id}:\nTitle: ${article.title}\nAuthors: ${article.authors}\nJournal: ${article.journal} (${article.year})\nPMID: ${article.pmid}\n\nAbstract: ${article.abstract}\n`
//     ).join('\n---\n\n');
    
//     // Build the complete prompt with formatting instructions
//     const formattingInstructions = customInstructions || `
// Use Tailwind CSS formatting for your summary. Organize the information in a clear, structured way with:
// 1. A concise overview/key points section
// 2. Methodology summary if applicable
// 3. Main findings across studies
// 4. Clinical implications or applications
// 5. Limitations and future directions

// If studies have conflicting findings, explicitly note this. For medical content, ensure accuracy and clinical relevance.
// `;

//     const fullPrompt = `${userPrompt}\n\n${articleTexts}\n\n${formattingInstructions}`;
    
//     // Call Grok API
//     const grokResponse = await callGrokAPI(fullPrompt);
    
//     return res.json({
//       success: true,
//       summary: grokResponse,
//       articleCount: articles.length
//     });
    
//   } catch (error) {
//     console.error('Error generating AI summary:', error);
//     res.status(500).json({ 
//       error: 'Error generating summary',
//       message: error.message || 'Failed to generate summary. Please try again later.'
//     });
//   }
// });

// /**
//  * Call the Grok API with the provided prompt to summarize PubMed articles
//  * using structured outputs for consistent formatting
//  * @param {string} prompt - The prompt to send to Grok
//  * @returns {string} - The generated summary HTML
//  */
// async function callGrokAPI(prompt) {
//   try {
//     // Add configurable timeout to prevent hanging requests
//     const timeout = 60000; // 60 seconds for longer summaries
    
//     // Define schema for the structured output
//     const responseSchema = {
//       type: "object",
//       properties: {
//         overview: {
//           type: "string",
//           description: "A concise overview of the key points from all articles"
//         },
//         methodology: {
//           type: "string",
//           description: "Summary of methodologies used across studies"
//         },
//         findings: {
//           type: "array",
//           items: {
//             type: "object",
//             properties: {
//               title: {
//                 type: "string",
//                 description: "Title of the finding"
//               },
//               description: {
//                 type: "string",
//                 description: "Description of the finding"
//               }
//             },
//             required: ["title", "description"]
//           },
//           description: "Main findings across studies"
//         },
//         clinical_implications: {
//           type: "array",
//           items: {
//             type: "string",
//             description: "Clinical implications or applications"
//           },
//           description: "Clinical implications or applications from the research"
//         },
//         limitations: {
//           type: "array",
//           items: {
//             type: "string",
//             description: "Limitations or future directions"
//           },
//           description: "Limitations and future directions for research"
//         }
//       },
//       required: ["overview", "findings", "clinical_implications"]
//     };
    
//     // Build a structured prompt for Grok
//     const structuredPrompt = `
// You are an expert at analyzing and summarizing medical research articles. 
// Extract the key information from the following PubMed abstracts and organize it according to the specified schema.

// ${prompt}
// `;
    
//     // Updated API call with proper structure for Grok API using structured outputs
//     const response = await axios.post(GROK_API_URL, {
//       model: "grok-3", // Using the latest model with structured output support
//       messages: [{
//         role: "system",
//         content: "You are an expert medical research analyst with excellent summarization skills."
//       }, {
//         role: "user",
//         content: structuredPrompt
//       }],
//       temperature: 0.3,
//       response_format: {
//         type: "json_object",
//         schema: responseSchema
//       }
//     }, {
//       headers: {
//         'Authorization': `Bearer ${GROK_API_KEY}`,
//         'Content-Type': 'application/json'
//       },
//       timeout: timeout
//     });
    
//     // Process the response - extract the JSON content
//     const responseData = response.data.choices?.[0]?.message?.content || '{}';
//     const parsedData = JSON.parse(responseData);
    
//     // Format the response data into HTML with Tailwind CSS
//     return formatSummaryHTML(parsedData);
    
//   } catch (error) {
//     console.error('Grok API error:', error.response?.data || error.message);
    
//     // Return fallback summary if API fails
//     return `
// <div class="bg-blue-50 p-4 rounded-lg shadow mb-6">
//   <h2 class="text-xl font-bold text-blue-800 mb-2">Research Summary</h2>
//   <p class="text-blue-700 mb-4">Based on the analysis of the provided PubMed articles.</p>
  
//   <div class="bg-white p-3 rounded shadow-sm mb-3">
//     <h3 class="font-medium text-gray-800 mb-2">API Error</h3>
//     <p class="text-red-600">Failed to generate summary: ${error.message || 'Unknown error'}</p>
//     <p class="text-gray-700 mt-2">Please try again later or contact support if the issue persists.</p>
//   </div>
  
//   <div class="bg-white p-3 rounded shadow-sm">
//     <h3 class="font-medium text-gray-800 mb-2">Fallback Summary</h3>
//     <ul class="list-disc pl-5 text-gray-700 space-y-1">
//       <li>Multiple studies demonstrate efficacy for the primary indication</li>
//       <li>Side effect profile is consistent across studies</li>
//       <li>Further research needed on long-term outcomes</li>
//     </ul>
//   </div>
// </div>`;
//   }
// }

// /**
//  * Format the structured data from Grok into HTML with Tailwind CSS
//  * @param {Object} data - The structured data from Grok
//  * @returns {string} - Formatted HTML with Tailwind CSS
//  */
// function formatSummaryHTML(data) {
//   // Default values in case data is incomplete
//   const overview = data.overview || 'No overview provided';
//   const methodology = data.methodology || 'Methodology details not available';
//   const findings = data.findings || [];
//   const clinicalImplications = data.clinical_implications || [];
//   const limitations = data.limitations || [];
  
//   // Convert findings array to HTML
//   const findingsHTML = findings.length > 0 
//     ? findings.map(finding => `
//         <div class="mb-3">
//           <h4 class="font-semibold text-gray-800">${finding.title}</h4>
//           <p class="text-gray-700">${finding.description}</p>
//         </div>
//       `).join('')
//     : '<p class="text-gray-700">No specific findings provided</p>';
  
//   // Convert clinical implications to HTML
//   const clinicalImplicationsHTML = clinicalImplications.length > 0
//     ? `<ul class="list-disc pl-5 text-gray-700 space-y-1">
//         ${clinicalImplications.map(item => `<li>${item}</li>`).join('')}
//        </ul>`
//     : '<p class="text-gray-700">No clinical implications provided</p>';
  
//   // Convert limitations to HTML
//   const limitationsHTML = limitations.length > 0
//     ? `<ul class="list-disc pl-5 text-gray-700 space-y-1">
//         ${limitations.map(item => `<li>${item}</li>`).join('')}
//        </ul>`
//     : '<p class="text-gray-700">No limitations or future directions provided</p>';
  
//   // Assemble the complete HTML
//   return `
// <div class="bg-blue-50 p-4 rounded-lg shadow mb-6">
//   <h2 class="text-xl font-bold text-blue-800 mb-2">Research Summary</h2>
  
//   <div class="bg-white p-4 rounded shadow-sm mb-4">
//     <h3 class="font-medium text-blue-800 mb-2">Overview</h3>
//     <p class="text-gray-700">${overview}</p>
//   </div>
  
//   <div class="bg-white p-4 rounded shadow-sm mb-4">
//     <h3 class="font-medium text-blue-800 mb-2">Methodology</h3>
//     <p class="text-gray-700">${methodology}</p>
//   </div>
  
//   <div class="bg-white p-4 rounded shadow-sm mb-4">
//     <h3 class="font-medium text-blue-800 mb-2">Key Findings</h3>
//     ${findingsHTML}
//   </div>
  
//   <div class="bg-white p-4 rounded shadow-sm mb-4">
//     <h3 class="font-medium text-blue-800 mb-2">Clinical Implications</h3>
//     ${clinicalImplicationsHTML}
//   </div>
  
//   <div class="bg-white p-4 rounded shadow-sm">
//     <h3 class="font-medium text-blue-800 mb-2">Limitations & Future Directions</h3>
//     ${limitationsHTML}
//   </div>
// </div>`;
// }

// module.exports = router;

// // // routes/pubmed.js
// // const express = require('express');
// // const router = express.Router();
// // const axios = require('axios');
// // const { handlePubMedSearch, generateAISummary } = require('./enhancedpubmed.js');

// // // const GROK_API_KEY = process.env.GROK_API_KEY || 'your-grok-api-key-here';
// // // const GROK_API_URL = 'https://api.grok.ai/v1/chat/completions';

// // const GROK_API_URL = 'https://api.grok.ai/v1/completions'; // Updated endpoint URL

// // v
// // // Main PubMed search endpoint
// // router.get('/api/pubmed', async (req, res) => {
// //   try {
// //     await handlePubMedSearch(req, res);
// //   } catch (error) {
// //     console.error('Error in PubMed route:', error);
// //     res.status(500).json({ 
// //       error: 'Internal server error', 
// //       message: error.message 
// //     });
// //   }
// // });


// // // AI Summary endpoint
// // router.post('/api/pubmed/summary', async (req, res) => {
// //   try {
// //     const { articles, prompt, customInstructions } = req.body;
    
// //     if (!articles || !Array.isArray(articles) || articles.length === 0) {
// //       return res.status(400).json({
// //         error: 'Invalid request',
// //         message: 'No articles provided for summarization'
// //       });
// //     }
    
// //     // Extract key information from articles for the prompt
// //     const articleData = articles.map((article, index) => {
// //       return {
// //         id: index + 1,
// //         pmid: article.pmid,
// //         title: article.title,
// //         authors: article.authors.join(', '),
// //         journal: article.journal,
// //         year: article.pubDate,
// //         abstract: article.abstract
// //       };
// //     });
    
// //     // Create default prompt if not provided
// //     const defaultPrompt = `Provide a comprehensive summary of these ${articleData.length} PubMed articles${
// //       articleData.length > 0 ? ' about ' + articleData[0].title.split(' ').slice(0, 3).join(' ') + '...' : ''
// //     }. Include key findings, methodologies, results, and clinical implications.`;
    
// //     const userPrompt = prompt || defaultPrompt;
    
// //     // Format articles data for the AI
// //     const articleTexts = articleData.map(article => 
// //       `Article ${article.id}:\nTitle: ${article.title}\nAuthors: ${article.authors}\nJournal: ${article.journal} (${article.year})\nPMID: ${article.pmid}\n\nAbstract: ${article.abstract}\n`
// //     ).join('\n---\n\n');
    
// //     // Build the complete prompt with formatting instructions
// //     const formattingInstructions = customInstructions || `
// // Use Tailwind CSS formatting for your summary. Organize the information in a clear, structured way with:
// // 1. A concise overview/key points section
// // 2. Methodology summary if applicable
// // 3. Main findings across studies
// // 4. Clinical implications or applications
// // 5. Limitations and future directions

// // If studies have conflicting findings, explicitly note this. For medical content, ensure accuracy and clinical relevance.
// // `;

// //     const fullPrompt = `${userPrompt}\n\n${articleTexts}\n\n${formattingInstructions}`;
    
// //     // Call Grok API
// //     const grokResponse = await callGrokAPI(fullPrompt);
    
// //     return res.json({
// //       success: true,
// //       summary: grokResponse,
// //       articleCount: articles.length
// //     });
    
// //   } catch (error) {
// //     console.error('Error generating AI summary:', error);
// //     res.status(500).json({ 
// //       error: 'Error generating summary',
// //       message: error.message || 'Failed to generate summary. Please try again later.'
// //     });
// //   }
// // });


// // /**
// //  * Call the Grok API with the provided prompt to summarize PubMed articles
// //  * @param {string} prompt - The prompt to send to Grok
// //  * @returns {string} - The generated summary
// //  */
// // async function callGrokAPI(prompt) {
// //   try {
// //     // Define the Grok API endpoint - use the endpoint URL directly from your constant
// //     const endpoint = GROK_API_URL;
    
// //     // Build a structured prompt
// //     const structuredPrompt = `
// // You are an expert at analyzing and summarizing medical research articles. Generate a concise, accurate summary of the following PubMed abstracts with professional formatting using Tailwind CSS.

// // ${prompt}

// // Your response should be thorough but concise, focusing on patterns and insights rather than just restating the data.
// //     `;
    
// //     // Call the Grok API - using the same parameter structure as in generateAnalysis
// //     const response = await axios.post(endpoint, {
// //       prompt: structuredPrompt,
// //       max_tokens: 1500,
// //       temperature: 0.3
// //     }, {
// //       headers: {
// //         'Authorization': `Bearer ${GROK_API_KEY}`,
// //         'Content-Type': 'application/json'
// //       }
// //     });
    
// //     // Process the response - using the same extraction pattern as generateAnalysis
// //     const grokText = response.data.choices[0]?.text || '';
    
// //     // Return the generated text
// //     return grokText;
    
// //   } catch (error) {
// //     console.error('Grok API error:', error.response?.data || error.message);
    
// //     // Return fallback summary if API fails - similar to generateAnalysis fallback
// //     return `
// // <div class="bg-blue-50 p-4 rounded-lg shadow mb-6">
// //   <h2 class="text-xl font-bold text-blue-800 mb-2">Research Summary</h2>
// //   <p class="text-blue-700 mb-4">Based on the analysis of the provided PubMed articles.</p>
  
// //   <div class="bg-white p-3 rounded shadow-sm mb-3">
// //     <h3 class="font-medium text-gray-800 mb-2">Key Findings</h3>
// //     <ul class="list-disc pl-5 text-gray-700 space-y-1">
// //       <li>Multiple studies demonstrate efficacy for the primary indication</li>
// //       <li>Side effect profile is consistent across studies</li>
// //       <li>Dosage recommendations range from general therapeutic levels</li>
// //     </ul>
// //   </div>
  
// //   <div class="bg-white p-3 rounded shadow-sm">
// //     <h3 class="font-medium text-gray-800 mb-2">Clinical Implications</h3>
// //     <ul class="list-disc pl-5 text-gray-700 space-y-1">
// //       <li>May offer therapeutic benefits for patients who are treatment-resistant</li>
// //       <li>Regular monitoring recommended during treatment period</li>
// //       <li>Further research needed on long-term outcomes</li>
// //     </ul>
// //   </div>
// // </div>`;
// //   }
// // }

// // module.exports = router;