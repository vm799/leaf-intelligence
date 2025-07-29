const EMAScraper = require('./emaScraper.js');
const { ClinicalTrialsEMAIntegration } = require('./clinicalTrialsIntegration.js');
const fs = require('fs').promises;

/**
 * Example usage of the EMA scraper
 */
async function basicExample() {
  console.log('=== Basic EMA Scraper Example ===\n');
  
  // Initialize scraper
  const scraper = new EMAScraper({
    downloadDocuments: false, // Set to true to download PDFs
    documentsPath: './downloads'
  });

  try {
    // Load the HTML (in production, you'd fetch this from the URL)
    // const html = await fs.readFile('./paste.txt', 'utf8');
    
    // Scrape the drug information
    const drugInfo = await scraper.scrapeDrugInfo(html, 'https://www.ema.europa.eu/en/medicines/human/EPAR/spravato');
    
    // Display basic information
    console.log('Drug Name:', drugInfo.basic.name);
    console.log('Active Substance:', drugInfo.basic.activeSubstance);
    console.log('Status:', drugInfo.basic.status);
    console.log('Category:', drugInfo.basic.category);
    console.log('\nSummary:', drugInfo.overview.summary);
    
    // Display product details
    console.log('\n=== Product Details ===');
    console.log('Therapeutic Area:', drugInfo.productDetails.therapeutic_area_mesh);
    console.log('ATC Code:', drugInfo.productDetails.anatomical_therapeutic_chemical_atc_code);
    
    // Display authorization details
    console.log('\n=== Authorization Details ===');
    console.log('Marketing Authorization Holder:', drugInfo.authorizationDetails.marketing_authorisation_holder);
    console.log('Authorization Date:', drugInfo.authorizationDetails.marketing_authorisation_issued);
    
    // Display document counts
    console.log('\n=== Documents Found ===');
    console.log('Overview Documents:', drugInfo.documents.overview.length);
    console.log('Product Information:', drugInfo.documents.productInformation.length);
    console.log('Assessment Reports:', drugInfo.documents.assessment.length);
    
    // Save to JSON file
    await fs.writeFile(
      'spravato_data.json', 
      JSON.stringify(drugInfo, null, 2),
      'utf8'
    );
    console.log('\nComplete data saved to spravato_data.json');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Clinical trials integration example
 */
async function integrationExample() {
  console.log('\n\n=== Clinical Trials Integration Example ===\n');
  
  // Initialize integration
  const integration = new ClinicalTrialsEMAIntegration({
    downloadDocuments: false,
    cacheTimeout: 3600000 // 1 hour
  });

  try {
    // Example 1: Get drug info by URL
    const drugUrl = 'https://www.ema.europa.eu/en/medicines/human/EPAR/spravato';
    console.log('Fetching drug information from:', drugUrl);
    
    const drugInfo = await integration.getDrugInfoByUrl(drugUrl);
    const clinicalInfo = integration.extractClinicalTrialRelevantInfo(drugInfo);
    
    console.log('\nClinical Trial Relevant Information:');
    console.log('- Drug Name:', clinicalInfo.drugName);
    console.log('- Active Substance:', clinicalInfo.activeSubstance);
    console.log('- Therapeutic Area:', clinicalInfo.therapeuticArea);
    console.log('- Indication:', clinicalInfo.indication);
    console.log('- Key Documents:', clinicalInfo.documents.assessmentReports.length, 'assessment reports');
    
    // Example 2: Process multiple drugs
    console.log('\n=== Batch Processing Example ===');
    const drugUrls = [
      'https://www.ema.europa.eu/en/medicines/human/EPAR/spravato',
      // Add more URLs here
    ];
    
    const results = await integration.getMultipleDrugsInfo(drugUrls);
    console.log(`Processed ${results.length} drugs`);
    results.forEach(result => {
      console.log(`- ${result.url}: ${result.status}`);
    });
    
  } catch (error) {
    console.error('Integration Error:', error.message);
  }
}

/**
 * Express.js server example
 */
async function serverExample() {
  console.log('\n\n=== Express Server Example ===\n');
  
  const express = require('express');
  const { setupEMARoutes } = require('./clinicalTrialsIntegration.js/index.js');
  
  const app = express();
  app.use(express.json());
  
  // Initialize integration
  const integration = new ClinicalTrialsEMAIntegration();
  
  // Setup routes
  setupEMARoutes(app, integration);
  
  // Additional custom route
  app.get('/api/ema/search/:drugName', async (req, res) => {
    try {
      const { drugName } = req.params;
      // In production, implement proper search functionality
      const url = `https://www.ema.europa.eu/en/medicines/human/EPAR/${drugName.toLowerCase()}`;
      const drugInfo = await integration.getDrugInfoByUrl(url);
      
      res.json({
        success: true,
        data: integration.extractClinicalTrialRelevantInfo(drugInfo)
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: 'Drug not found or error fetching data'
      });
    }
  });
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`EMA Scraper API running on port ${PORT}`);
    console.log('\nAvailable endpoints:');
    console.log('- GET  /api/ema/drug?url={emaUrl}');
    console.log('- POST /api/ema/drugs/batch');
    console.log('- POST /api/ema/drug/sync');
    console.log('- GET  /api/ema/search/:drugName');
  });
}

/**
 * Main function to run examples
 */
async function main() {
  // Run basic example
//   await basicExample();
  
//   // Run integration example
  await integrationExample();
  
//   // Optionally start the server
//   if (process.argv.includes('--server')) {
//     await serverExample();
//   }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { basicExample, integrationExample, serverExample };