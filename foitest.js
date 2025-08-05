// test-scraper.js
// Test script to scrape just the first page to verify everything works

const FDAScraper = require('./FOIAscraper.js');

async function testScraper() {
  const scraper = new FDAScraper();
  
  try {
    console.log('Starting test scrape of first page...');
    await scraper.init();
    
    // Navigate to first page
    await scraper.navigateToPage(1);
    
    // Scrape table data
    const documents = await scraper.scrapeTableData();
    console.log(`Found ${documents.length} documents on first page`);
    
    // Display first few documents
    console.log('\nFirst 3 documents:');
    documents.slice(0, 3).forEach((doc, index) => {
      console.log(`\n--- Document ${index + 1} ---`);
      console.log(`Company: ${doc.companyName}`);
      console.log(`FEI Number: ${doc.feiNumber}`);
      console.log(`Record Type: ${doc.recordType}`);
      console.log(`PDF URL: ${doc.pdfUrl}`);
      console.log(`Date: ${doc.recordDate}`);
    });
    
    // Try saving first document
    if (documents.length > 0) {
      console.log('\nTesting document save...');
      const savedDoc = await scraper.saveDocument(documents[0]);
      if (savedDoc) {
        console.log('✓ Document saved successfully');
      }
    }
    
    // Get statistics
    await scraper.getStats();
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await scraper.cleanup();
  }
}

// Run test
testScraper().catch(console.error);