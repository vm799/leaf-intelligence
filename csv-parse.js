const { MongoClient } = require('mongodb');
const fs = require('fs');
const Papa = require('papaparse');

// Configuration
// const MONGODB_URI = process.env.MONGODB_URI || ;
const DATABASE_NAME = process.env.DB_NAME || 'medicines_database';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'psusa_assessments';
const CSV_FILE_PATH = process.env.CSV_FILE || './medicines_output_periodic_safety_update_report_single_assessments_en (1)(PSUSA).csv';

// MongoDB connection options
const mongoOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

// Function to parse and validate dates
function parseDate(dateStr) {
  if (!dateStr || dateStr === null) return null;
  
  // Handle DD/MM/YYYY format
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  return null;
}

// Function to clean and transform the CSV data
function cleanPSUSAData(rawData) {
  return rawData.map((row, index) => {
    // Parse active substances into an array
    let activeSubstances = [];
    if (row["Active substance"]) {
      activeSubstances = row["Active substance"]
        .split(/[;,]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }
    
    const cleanedRow = {
      _id: `psusa_${index + 1}`,
      category: row.Category || null,
      activeSubstancesInScope: row["Active substances in scope of procedure"] || null,
      activeSubstances: activeSubstances, // Array format for better querying
      activeSubstanceRaw: row["Active substance"] || null, // Keep original for reference
      relatedMedicines: row["Related medicines"] || null,
      procedureNumber: row["Procedure number"] || null,
      regulatoryOutcome: row["Regulatory outcome"] || null,
      firstPublishedDate: parseDate(row["First published date"]),
      firstPublishedDateRaw: row["First published date"] || null,
      lastUpdatedDate: parseDate(row["Last updated date"]),
      lastUpdatedDateRaw: row["Last updated date"] || null,
      psusaUrl: row["PSUSA URL"] || null,
      
      // Metadata
      dataSource: "EMA_PSUSA_REPORT",
      recordType: "PSUSA_ASSESSMENT",
      uploadedAt: new Date(),
      uploadBatch: new Date().toISOString()
    };
    
    // Add derived fields
    if (cleanedRow.procedureNumber) {
      const procMatch = cleanedRow.procedureNumber.match(/PSUSA\/(\d+)\/(\d+)/);
      if (procMatch) {
        cleanedRow.psusaId = procMatch[1];
        cleanedRow.periodCode = procMatch[2];
        cleanedRow.year = parseInt(procMatch[2].substring(0, 4));
        cleanedRow.period = parseInt(procMatch[2].substring(4, 6));
      }
    }
    
    return cleanedRow;
  });
}

async function uploadPSUSAData() {
  let client;
  
  try {
    console.log('🔄 Starting EMA PSUSA data upload process...');
    
    // Read and parse the CSV file
    console.log(`📖 Reading CSV data from: ${CSV_FILE_PATH}`);
    const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    
    const parseResult = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      delimitersToGuess: [',', '\t', '|', ';']
    });
    
    if (parseResult.errors.length > 0) {
      console.warn('⚠️  CSV parsing warnings:', parseResult.errors);
    }
    
    console.log(`📊 Parsed ${parseResult.data.length} raw records`);
    
    // Clean and transform the data
    console.log('🧹 Cleaning and transforming data...');
    const cleanedData = cleanPSUSAData(parseResult.data);
    
    console.log(`✅ Transformed ${cleanedData.length} records`);
    
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI, mongoOptions);
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    console.log(`✅ Connected to database: ${DATABASE_NAME}`);
    console.log(`📋 Using collection: ${COLLECTION_NAME}`);
    
    // Check if collection exists and has data
    const existingCount = await collection.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Collection already contains ${existingCount} documents`);
      const response = await promptUser('Do you want to continue? This will add duplicates if IDs match [y/N]: ');
      if (response.toLowerCase() !== 'y' && response.toLowerCase() !== 'yes') {
        console.log('❌ Upload cancelled by user');
        return;
      }
    }
    
    // Create indexes for better performance
    console.log('🔍 Creating database indexes...');
    await collection.createIndex({ procedureNumber: 1 }, { unique: true, background: true });
    await collection.createIndex({ activeSubstances: 1 }, { background: true });
    await collection.createIndex({ category: 1 }, { background: true });
    await collection.createIndex({ regulatoryOutcome: 1 }, { background: true });
    await collection.createIndex({ year: 1 }, { background: true });
    await collection.createIndex({ period: 1 }, { background: true });
    await collection.createIndex({ firstPublishedDate: 1 }, { background: true });
    await collection.createIndex({ psusaId: 1 }, { background: true });
    await collection.createIndex({ uploadedAt: 1 }, { background: true });
    
    // Insert documents in batches
    const BATCH_SIZE = 100;
    let insertedCount = 0;
    let duplicateCount = 0;
    
    console.log('📤 Starting bulk insert...');
    
    for (let i = 0; i < cleanedData.length; i += BATCH_SIZE) {
      const batch = cleanedData.slice(i, i + BATCH_SIZE);
      
      try {
        const result = await collection.insertMany(batch, { 
          ordered: false,
          writeConcern: { w: 'majority' }
        });
        insertedCount += result.insertedCount;
        console.log(`✅ Batch ${Math.ceil((i + 1) / BATCH_SIZE)}: Inserted ${result.insertedCount} documents`);
      } catch (error) {
        if (error.code === 11000) {
          // Handle duplicate key errors
          const duplicatesInBatch = error.result ? error.result.insertedCount : 0;
          insertedCount += duplicatesInBatch;
          duplicateCount += (batch.length - duplicatesInBatch);
          console.log(`⚠️  Batch ${Math.ceil((i + 1) / BATCH_SIZE)}: ${duplicatesInBatch} inserted, ${batch.length - duplicatesInBatch} duplicates skipped`);
        } else {
          throw error;
        }
      }
    }
    
    // Final verification and statistics
    const finalCount = await collection.countDocuments();
    
    console.log('\n🎉 EMA PSUSA data upload completed successfully!');
    console.log('📊 Summary:');
    console.log(`   • Total records processed: ${cleanedData.length}`);
    console.log(`   • Successfully inserted: ${insertedCount}`);
    console.log(`   • Duplicates skipped: ${duplicateCount}`);
    console.log(`   • Total documents in collection: ${finalCount}`);
    console.log(`   • Database: ${DATABASE_NAME}`);
    console.log(`   • Collection: ${COLLECTION_NAME}`);
    
    // Display data statistics
    const categories = await collection.distinct('category');
    const outcomes = await collection.distinct('regulatoryOutcome');
    const years = await collection.distinct('year');
    
    console.log(`\n📁 Data Statistics:`);
    console.log(`   • Categories: ${categories.filter(Boolean).join(', ')}`);
    console.log(`   • Regulatory Outcomes: ${outcomes.filter(Boolean).join(', ')}`);
    console.log(`   • Years covered: ${years.filter(Boolean).sort().join(', ')}`);
    
    // Sample queries to verify data
    console.log(`\n🔍 Sample Data Verification:`);
    const sampleRecord = await collection.findOne({});
    console.log(`   • Sample record ID: ${sampleRecord._id}`);
    console.log(`   • Sample active substance: ${sampleRecord.activeSubstances[0] || 'N/A'}`);
    
    const recentRecords = await collection.countDocuments({
      firstPublishedDate: { $gte: new Date('2025-01-01') }
    });
    console.log(`   • Records from 2025: ${recentRecords}`);
    
  } catch (error) {
    console.error('❌ Error during upload:', error.message);
    
    if (error.code === 'ENOENT') {
      console.error(`📂 CSV file not found: ${CSV_FILE_PATH}`);
      console.error('   Make sure the file path is correct');
    } else if (error.name === 'MongoNetworkError') {
      console.error('🔌 MongoDB connection failed. Check your connection string and network');
    } else if (error.name === 'SyntaxError') {
      console.error('📄 CSV parsing failed. Check your data file format');
    }
    
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Helper function for user input
function promptUser(question) {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer);
    });
  });
}

// Helper function to display usage
function displayUsage() {
  console.log('\n📋 EMA PSUSA Data MongoDB Upload Script');
  console.log('=====================================');
  console.log('\nUsage: node upload-psusa-data.js');
  console.log('\nEnvironment Variables:');
  console.log('  MONGODB_URI    - MongoDB connection string (default: mongodb://localhost:27017)');
  console.log('  DB_NAME        - Database name (default: ema_psusa_db)');
  console.log('  COLLECTION_NAME - Collection name (default: psusa_assessments)');
  console.log('  CSV_FILE       - Path to CSV file (default: ./medicines_output...csv)');
  console.log('\nExamples:');
  console.log('  # Local MongoDB');
  console.log('  node upload-psusa-data.js');
  console.log('\n  # MongoDB Atlas');
  console.log('  MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/" node upload-psusa-data.js');
  console.log('');
  console.log('📊 This script will:');
  console.log('   • Parse the EMA PSUSA CSV file');
  console.log('   • Clean and transform the data');
  console.log('   • Create proper date fields from DD/MM/YYYY format');
  console.log('   • Split active substances into arrays');
  console.log('   • Extract procedure information (year, period)');
  console.log('   • Create indexes for fast querying');
  console.log('   • Handle duplicates gracefully');
}

// Main execution
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    displayUsage();
    process.exit(0);
  }
  
  uploadPSUSAData().catch(console.error);
}

module.exports = { uploadPSUSAData, cleanPSUSAData };