// fda-scraper.js
const puppeteer = require('puppeteer');
const mongoose = require('mongoose');

// MongoDB Schema
const documentSchema = new mongoose.Schema({
  recordDate: String,
  companyName: String,
  feiNumber: String,
  recordType: String,
  pdfUrl: String,
  state: String,
  country: String,
  establishmentType: String,
  publishDate: String,
  excerpt: String,
  pageNumber: Number,
  scrapedAt: { type: Date, default: Date.now }
});

const FDADocument = mongoose.model('FDADocument', documentSchema);

// Configuration
const config = {
  baseUrl: 'https://www.fda.gov',
  startUrl: 'https://www.fda.gov/about-fda/office-inspections-and-investigations/oii-foia-electronic-reading-room',
  mongoUri: 'mongodb+srv://syneticslz:gMN1GUBtevSaw8DE@synetictest.bl3xxux.mongodb.net/fda-foia?retryWrites=true&w=majority&appName=SyneticTest',
  itemsPerPage: 10,
  retryAttempts: 3,
  retryDelay: 2000,
  pageLoadTimeout: 60000
  // Removed recordTypeFilter
};

class FDAScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.totalDocumentsFound = 0;
    this.documentsByType = {}; // Track documents by type
  }

  async init() {
    // Connect to MongoDB
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

    // Launch Puppeteer
    this.browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setDefaultNavigationTimeout(config.pageLoadTimeout);
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Removed applyFilter method since we're not filtering anymore

  async navigateToPage(pageNumber) {
    try {
      console.log(`Navigating to page ${pageNumber}...`);
      
      if (pageNumber === 1) {
        await this.page.goto(config.startUrl, { waitUntil: 'networkidle2' });
        await this.wait(3000);
        // No filter applied
      } else {
        // Use the clickNextPage method
        const clicked = await this.clickNextPage();
        if (!clicked) {
          console.log('Could not click next button');
          return false;
        }
      }

      // Wait for table to load
      await this.page.waitForSelector('table.lcds-datatable tbody tr', { timeout: 10000 });
      await this.wait(2000);
      
      return true;
    } catch (error) {
      console.error(`Error navigating to page ${pageNumber}:`, error.message);
      return false;
    }
  }

  async scrapeTableData() {
    try {
      // Wait for table to be present
      await this.page.waitForSelector('table.lcds-datatable tbody tr');
      
      const data = await this.page.evaluate(() => {
        const rows = document.querySelectorAll('table.lcds-datatable tbody tr');
        const results = [];

        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 9) {
            const recordType = cells[3].textContent.trim();
            const pdfLink = cells[3].querySelector('a');
            const pdfUrl = pdfLink ? pdfLink.getAttribute('href') : null;

            // Get all records, not just 483
            results.push({
              recordDate: cells[0].textContent.trim(),
              companyName: cells[1].textContent.trim(),
              feiNumber: cells[2].textContent.trim(),
              recordType: recordType,
              pdfUrl: pdfUrl,
              state: cells[4].textContent.trim() || null,
              country: cells[5].textContent.trim() || null,
              establishmentType: cells[6].textContent.trim(),
              publishDate: cells[7].textContent.trim(),
              excerpt: cells[8].textContent.trim() || null
            });
          }
        });

        return results;
      });

      // Count documents by type
      const typeCounts = {};
      data.forEach(doc => {
        typeCounts[doc.recordType] = (typeCounts[doc.recordType] || 0) + 1;
      });
      
      console.log(`Found ${data.length} documents on current page`);
      console.log('Document types:', typeCounts);
      
      return data;
    } catch (error) {
      console.error('Error scraping table data:', error.message);
      return [];
    }
  }

  async clickNextPage() {
    try {
      // Method 1: Try clicking the anchor inside the next button
      const clicked = await this.page.evaluate(() => {
        const nextButton = document.querySelector('li.paginate_button.next:not(.disabled) a');
        if (nextButton) {
          nextButton.click();
          return true;
        }
        return false;
      });
      
      if (clicked) {
        console.log('Clicked next page');
        return true;
      }
      
      // Method 2: If that doesn't work, try using puppeteer click
      const nextButton = await this.page.$('#datatable_next:not(.disabled) a');
      if (nextButton) {
        await nextButton.click();
        console.log('Clicked next page (method 2)');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error clicking next page:', error.message);
      return false;
    }
  }

  async saveDocument(docData, pageNumber) {
    try {
      // Check if document already exists
      const existingDoc = await FDADocument.findOne({
        feiNumber: docData.feiNumber,
        recordDate: docData.recordDate,
        recordType: docData.recordType
      });

      if (existingDoc) {
        console.log(`Document already exists: ${docData.companyName} - ${docData.recordDate} - ${docData.recordType}`);
        return existingDoc;
      }

      // Create new document
      const newDoc = new FDADocument({
        ...docData,
        pageNumber: pageNumber,
        pdfUrl: docData.pdfUrl ? `${config.baseUrl}${docData.pdfUrl}` : null,
        localPdfPath: null // No local download
      });

      await newDoc.save();
      console.log(`Saved: ${docData.companyName} - ${docData.recordDate} - ${docData.recordType}`);
      
      // Track documents by type
      this.documentsByType[docData.recordType] = (this.documentsByType[docData.recordType] || 0) + 1;
      this.totalDocumentsFound++;
      
      return newDoc;
    } catch (error) {
      console.error(`Error saving document: ${error.message}`);
      return null;
    }
  }

  async getPageInfo() {
    try {
      const pageInfo = await this.page.evaluate(() => {
        const infoText = document.querySelector('.dataTables_info');
        if (infoText) {
          const match = infoText.textContent.match(/of (\d+) entries/);
          return match ? parseInt(match[1]) : null;
        }
        return null;
      });
      
      return pageInfo;
    } catch (error) {
      console.error('Error getting page info:', error.message);
      return null;
    }
  }

  async scrapeAllDocuments() {
    let currentPage = 1;
    let hasMorePages = true;
    let consecutiveEmptyPages = 0;

    console.log('Starting to scrape all FDA documents...\n');

    while (hasMorePages) {
      console.log(`\n=== Processing page ${currentPage} ===`);
      
      const navigated = await this.navigateToPage(currentPage);
      if (!navigated) {
        console.log('Navigation failed, ending scrape');
        break;
      }

      // Get total entries if on first page
      if (currentPage === 1) {
        const totalEntries = await this.getPageInfo();
        if (totalEntries) {
          console.log(`Total documents found: ${totalEntries}`);
          console.log(`Estimated pages: ${Math.ceil(totalEntries / config.itemsPerPage)}\n`);
        }
      }

      const documents = await this.scrapeTableData();
      
      if (documents.length === 0) {
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= 3) {
          console.log('No more documents found after 3 consecutive empty pages');
          hasMorePages = false;
          break;
        }
      } else {
        consecutiveEmptyPages = 0;
        
        // Save each document
        for (const doc of documents) {
          await this.saveDocument(doc, currentPage);
          await this.wait(500); // Small delay between saves
        }
      }

      // Check if there's a next page
      const nextButton = await this.page.$('li.paginate_button.next:not(.disabled) a');
      if (!nextButton) {
        console.log('No next page button found or it is disabled');
        hasMorePages = false;
      } else {
        currentPage++;
        await this.wait(2000); // Delay between pages
      }

      // Optional: Limit pages for testing
      // if (currentPage >= 5) break;
    }

    console.log(`\n=== Scraping Complete ===`);
    console.log(`Total pages processed: ${currentPage}`);
    console.log(`Total documents saved: ${this.totalDocumentsFound}`);
    console.log('\nDocuments by type:');
    Object.entries(this.documentsByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }

  async getStats() {
    const totalDocs = await FDADocument.countDocuments();
    const docsWithPDF = await FDADocument.countDocuments({ pdfUrl: { $ne: null } });
    
    // Get counts by record type
    const typeStats = await FDADocument.aggregate([
      {
        $group: {
          _id: '$recordType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    console.log('\n=== Database Statistics ===');
    console.log(`Total documents in database: ${totalDocs}`);
    console.log(`Documents with PDF links: ${docsWithPDF}`);
    console.log('\nDocuments by type:');
    typeStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count}`);
    });
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
    await mongoose.connection.close();
    console.log('\nCleaned up resources');
  }
}

// Main execution
async function main() {
  const scraper = new FDAScraper();

  try {
    await scraper.init();
    await scraper.scrapeAllDocuments();
    await scraper.getStats();
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await scraper.cleanup();
  }
}

// Run the scraper
if (require.main === module) {
  main().catch(console.error);
}

module.exports = FDAScraper;

// // fda-483-scraper.js
// const puppeteer = require('puppeteer');
// const mongoose = require('mongoose');
// // const atlasConfig = require('./config'); // Import your Atlas config

// // MongoDB Schema
// const documentSchema = new mongoose.Schema({
//   recordDate: String,
//   companyName: String,
//   feiNumber: String,
//   recordType: String,
//   pdfUrl: String,
//   state: String,
//   country: String,
//   establishmentType: String,
//   publishDate: String,
//   excerpt: String,
//   pageNumber: Number,
//   scrapedAt: { type: Date, default: Date.now }
// });

// const FDADocument = mongoose.model('FDADocument', documentSchema);

// // Configuration
// const config = {
//   baseUrl: 'https://www.fda.gov',
//   startUrl: 'https://www.fda.gov/about-fda/office-inspections-and-investigations/oii-foia-electronic-reading-room',
//   mongoUri: 'mongodb+srv://syneticslz:gMN1GUBtevSaw8DE@synetictest.bl3xxux.mongodb.net/fda-foia?retryWrites=true&w=majority&appName=SyneticTest',// Use Atlas connection string
//   itemsPerPage: 10,
//   retryAttempts: 3,
//   retryDelay: 2000,
//   pageLoadTimeout: 60000,
//   recordTypeFilter: '483' // Only scrape 483 documents
// };

// class FDA483Scraper {
//   constructor() {
//     this.browser = null;
//     this.page = null;
//     this.totalDocumentsFound = 0;
//     this.total483Documents = 0;
//   }

//   async init() {
//     // Connect to MongoDB
//     await mongoose.connect(config.mongoUri);
//     console.log('Connected to MongoDB');

//     // Launch Puppeteer
//     this.browser = await puppeteer.launch({
//       headless: false,
//       args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
//     });

//     this.page = await this.browser.newPage();
//     await this.page.setViewport({ width: 1920, height: 1080 });
//     await this.page.setDefaultNavigationTimeout(config.pageLoadTimeout);
//     await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
//   }

//   async wait(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
//   }

//   async applyFilter() {
//     try {
//       console.log('Applying 483 filter...');
      
//       // Wait for the filter dropdown to be available
//       await this.page.waitForSelector('#foia_record_type_name', { timeout: 10000 });
      
//       // Select "483" from the dropdown
//       await this.page.select('#foia_record_type_name', '483');
      
//       // Wait for the table to update
//       await this.wait(3000);
      
//       console.log('Filter applied successfully');
//     } catch (error) {
//       console.error('Error applying filter:', error.message);
//     }
//   }

//   async navigateToPage(pageNumber) {
//     try {
//       console.log(`Navigating to page ${pageNumber}...`);
      
//       if (pageNumber === 1) {
//         await this.page.goto(config.startUrl, { waitUntil: 'networkidle2' });
//         await this.wait(3000);
        
//         // Apply the 483 filter on first page
//         await this.applyFilter();
//       } else {
//         // Use the new clickNextPage method
//         const clicked = await this.clickNextPage();
//         if (!clicked) {
//           console.log('Could not click next button');
//           return false;
//         }
//       }

//       // Wait for table to load
//       await this.page.waitForSelector('table.lcds-datatable tbody tr', { timeout: 10000 });
//       await this.wait(2000);
      
//       return true;
//     } catch (error) {
//       console.error(`Error navigating to page ${pageNumber}:`, error.message);
//       return false;
//     }
//   }

//   async scrapeTableData() {
//     try {
//       // Wait for table to be present
//       await this.page.waitForSelector('table.lcds-datatable tbody tr');
      
//       const data = await this.page.evaluate(() => {
//         const rows = document.querySelectorAll('table.lcds-datatable tbody tr');
//         const results = [];

//         rows.forEach(row => {
//           const cells = row.querySelectorAll('td');
//           if (cells.length >= 9) {
//             const recordType = cells[3].textContent.trim();
            
//             // Only get 483 records
//             if (recordType === '483') {
//               const pdfLink = cells[3].querySelector('a');
//               const pdfUrl = pdfLink ? pdfLink.getAttribute('href') : null;

//               results.push({
//                 recordDate: cells[0].textContent.trim(),
//                 companyName: cells[1].textContent.trim(),
//                 feiNumber: cells[2].textContent.trim(),
//                 recordType: recordType,
//                 pdfUrl: pdfUrl,
//                 state: cells[4].textContent.trim() || null,
//                 country: cells[5].textContent.trim() || null,
//                 establishmentType: cells[6].textContent.trim(),
//                 publishDate: cells[7].textContent.trim(),
//                 excerpt: cells[8].textContent.trim() || null
//               });
//             }
//           }
//         });

//         return results;
//       });

//       console.log(`Found ${data.length} 483 documents on current page`);
//       return data;
//     } catch (error) {
//       console.error('Error scraping table data:', error.message);
//       return [];
//     }
//   }

//   async clickNextPage() {
//     try {
//       // Method 1: Try clicking the anchor inside the next button
//       const clicked = await this.page.evaluate(() => {
//         const nextButton = document.querySelector('li.paginate_button.next:not(.disabled) a');
//         if (nextButton) {
//           nextButton.click();
//           return true;
//         }
//         return false;
//       });
      
//       if (clicked) {
//         console.log('Clicked next page');
//         return true;
//       }
      
//       // Method 2: If that doesn't work, try using puppeteer click
//       const nextButton = await this.page.$('#datatable_next:not(.disabled) a');
//       if (nextButton) {
//         await nextButton.click();
//         console.log('Clicked next page (method 2)');
//         return true;
//       }
      
//       return false;
//     } catch (error) {
//       console.error('Error clicking next page:', error.message);
//       return false;
//     }
//   }

//   async saveDocument(docData, pageNumber) {
//     try {
//       // Check if document already exists
//       const existingDoc = await FDADocument.findOne({
//         feiNumber: docData.feiNumber,
//         recordDate: docData.recordDate
//       });

//       if (existingDoc) {
//         console.log(`Document already exists: ${docData.companyName} - ${docData.recordDate}`);
//         return existingDoc;
//       }

//       // Create new document
//       const newDoc = new FDADocument({
//         ...docData,
//         pageNumber: pageNumber,
//         pdfUrl: docData.pdfUrl ? `${config.baseUrl}${docData.pdfUrl}` : null,
//         localPdfPath: null // No local download
//       });

//       await newDoc.save();
//       console.log(`Saved: ${docData.companyName} - ${docData.recordDate}`);
//       this.total483Documents++;
//       return newDoc;
//     } catch (error) {
//       console.error(`Error saving document: ${error.message}`);
//       return null;
//     }
//   }

//   async getPageInfo() {
//     try {
//       const pageInfo = await this.page.evaluate(() => {
//         const infoText = document.querySelector('.dataTables_info');
//         if (infoText) {
//           const match = infoText.textContent.match(/of (\d+) entries/);
//           return match ? parseInt(match[1]) : null;
//         }
//         return null;
//       });
      
//       return pageInfo;
//     } catch (error) {
//       console.error('Error getting page info:', error.message);
//       return null;
//     }
//   }

//   async scrapeAll483Documents() {
//     let currentPage = 1;
//     let hasMorePages = true;
//     let consecutiveEmptyPages = 0;

//     console.log('Starting to scrape all 483 documents...\n');

//     while (hasMorePages) {
//       console.log(`\n=== Processing page ${currentPage} ===`);
      
//       const navigated = await this.navigateToPage(currentPage);
//       if (!navigated) {
//         console.log('Navigation failed, ending scrape');
//         break;
//       }

//       // Get total entries if on first page
//       if (currentPage === 1) {
//         const totalEntries = await this.getPageInfo();
//         if (totalEntries) {
//           console.log(`Total 483 documents found: ${totalEntries}`);
//           console.log(`Estimated pages: ${Math.ceil(totalEntries / config.itemsPerPage)}\n`);
//         }
//       }

//       const documents = await this.scrapeTableData();
      
//       if (documents.length === 0) {
//         consecutiveEmptyPages++;
//         if (consecutiveEmptyPages >= 3) {
//           console.log('No more 483 documents found after 3 consecutive empty pages');
//           hasMorePages = false;
//           break;
//         }
//       } else {
//         consecutiveEmptyPages = 0;
        
//         // Save each document
//         for (const doc of documents) {
//           await this.saveDocument(doc, currentPage);
//           await this.wait(500); // Small delay between saves
//         }
//       }

//       // Check if there's a next page
//       const nextButton = await this.page.$('li.paginate_button.next:not(.disabled) a');
//       if (!nextButton) {
//         console.log('No next page button found or it is disabled');
//         hasMorePages = false;
//       } else {
//         currentPage++;
//         await this.wait(2000); // Delay between pages
//       }

//       // Optional: Limit pages for testing
//       // if (currentPage >= 5) break;
//     }

//     console.log(`\n=== Scraping Complete ===`);
//     console.log(`Total pages processed: ${currentPage}`);
//     console.log(`Total 483 documents saved: ${this.total483Documents}`);
//   }

//   async getStats() {
//     const totalDocs = await FDADocument.countDocuments();
//     const docsWithPDF = await FDADocument.countDocuments({ pdfUrl: { $ne: null } });

//     console.log('\n=== Database Statistics ===');
//     console.log(`Total documents in database: ${totalDocs}`);
//     console.log(`Documents with PDF links: ${docsWithPDF}`);
//   }

//   async cleanup() {
//     if (this.browser) {
//       await this.browser.close();
//     }
//     await mongoose.connection.close();
//     console.log('\nCleaned up resources');
//   }
// }

// // Main execution
// async function main() {
//   const scraper = new FDA483Scraper();

//   try {
//     await scraper.init();
//     await scraper.scrapeAll483Documents();
//     await scraper.getStats();
//   } catch (error) {
//     console.error('Fatal error:', error);
//   } finally {
//     await scraper.cleanup();
//   }
// }

// // Run the scraper
// if (require.main === module) {
//   main().catch(console.error);
// }

// module.exports = FDA483Scraper;

