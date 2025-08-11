// require('dotenv').config();
// const express = require('express');
// const mongoose = require('mongoose');
// const multer = require('multer');
// const fs = require('fs');
// const pdfParse = require('pdf-parse');
// const { OpenAI } = require('openai');
// const path = require('path');
// const crypto = require('crypto'); // ADD THIS LINE
// const app = express();
// const upload = multer({ dest: 'uploads/' });
// const PORT = 4000;

// app.use(express.static('publiccrl'));
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// // === MONGODB SCHEMA ===
// // const LetterSchema = new mongoose.Schema({
// //   ndaNumber: String,
// //   applicationName: String,
// //   company: {
// //     name: String,
// //     contact: String,
// //     address: String
// //   },
// //   letterType: String,
// //   date: String,
// //   clinicalFindings: [String],
// //   studiesReferenced: [String],
// //   fdaOffice: String,
// //   fdaContact: String,
// //   signature: String,
// //   summary: String,
// //   rawText: String,
// //   aiSummary: String,
// //   aiAnalysis: String,
// //   aiIndex: [String]
// // });


// const LetterSchema = new mongoose.Schema({
//   ndaNumber: String,
//   applicationName: String,
//   company: {
//     name: String,
//     contact: String,
//     address: String
//   },
//   letterType: String,
//   date: String,
//   clinicalFindings: [String],
//   studiesReferenced: [String],
//   fdaOffice: String,
//   fdaContact: String,
//   signature: String,
//   summary: String,
//   rawText: String,
//   aiSummary: String,
//   aiAnalysis: String,
//   aiIndex: [String],
//   textHash: { type: String, unique: true, sparse: true } // ADD THIS LINE
// });
// const Letter = mongoose.model('Letter', LetterSchema);

// mongoose.connect(process.env.MONGO_URI)
//   .then(() => console.log('✅ Connected to MongoDB'))
//   .catch(err => console.error('❌ Mongo error:', err));

// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// // === LETTER SPLITTING ===
// async function extractLettersFromPdf(filePath) {
//   const dataBuffer = fs.readFileSync(filePath);
//   const data = await pdfParse(dataBuffer);
//   const rawText = data.text;

//   const cleaned = rawText.replace(/CENTER FOR DRUG.*?OTHER ACTION LETTERS/i, '').trim();
//   const letterBlocks = cleaned.split(/\n(?=NDA\s\d{6}\s+COMPLETE RESPONSE)/g);
//   return letterBlocks
//     .map(block => block.trim())
//     .filter(block => block.length > 500);
// }


// // === HELPER: Generate hash from text ===
// function generateTextHash(text) {
//   const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
//   return crypto.createHash('sha256').update(normalized).digest('hex');
// }

// // === HELPER: Extract NDA number from text ===
// function extractNDANumber(text) {
//   const match = text.match(/NDA\s*(\d{6})/i);
//   return match ? match[1] : null;
// }


// // === CHUNKED STRUCTURED EXTRACTION ===
// async function extractStructuredLetter(rawText) {
//   const MAX_CHARS = 12000;
//   const chunks = [];

//   if (rawText.length > MAX_CHARS) {
//     const paragraphs = rawText.split(/\n\s*\n/);
//     let currentChunk = "";

//     for (const p of paragraphs) {
//       if ((currentChunk + p).length > MAX_CHARS) {
//         chunks.push(currentChunk);
//         currentChunk = p + "\n\n";
//       } else {
//         currentChunk += p + "\n\n";
//       }
//     }
//     if (currentChunk) chunks.push(currentChunk);
//   } else {
//     chunks.push(rawText);
//   }

//   const partialSummaries = [];
//   for (let i = 0; i < chunks.length; i++) {
//     const response = await openai.chat.completions.create({
//       model: 'gpt-4',
//       messages: [{
//         role: 'user',
//         content: `This is part ${i + 1} of an FDA letter. Summarize this content in detail as plain text.\n\n"""${chunks[i]}"""`
//       }],
//       temperature: 0.2
//     });

//     partialSummaries.push(response.choices[0].message.content.trim());
//   }

//   const mergedSummary = partialSummaries.join("\n\n");

//   const finalPrompt = `
// Based on the following full FDA letter summary, return a single valid JSON object with:
// - ndaNumber
// - applicationName
// - company: { name, contact, address }
// - letterType
// - date
// - clinicalFindings (bullet list)
// - studiesReferenced (list)
// - fdaOffice
// - fdaContact
// - signature
// - summary (brief)
// - rawText

// """${mergedSummary}"""
//   `;

//   const finalResponse = await openai.chat.completions.create({
//      model: 'gpt-3.5-turbo-1106',
//     messages: [{ role: 'user', content: finalPrompt }],
//     temperature: 0
//   });

//   const content = finalResponse.choices[0].message.content.trim();
//   const start = content.indexOf('{');
//   const end = content.lastIndexOf('}');
//   try {
//     return JSON.parse(content.slice(start, end + 1));
//   } catch (err) {
//     console.error('❌ Final structured parsing failed:', err);
//     return null;
//   }
// }

// // === ENRICH WITH AI SUMMARY, ANALYSIS & INDEXING ===
// async function enrichLetterWithAI(structuredLetter) {
//   const prompt = `
// From this FDA letter, return the following JSON:
// - aiSummary: Short contextual summary of the issue
// - aiAnalysis: Deeper analysis of the regulatory implications
// - aiIndex: Array of keywords (company, product, issue, drug, condition, etc.)

// """${structuredLetter.rawText}"""
//   `;

//   const response = await openai.chat.completions.create({
//     model: 'gpt-4',
//     messages: [{ role: 'user', content: prompt }],
//     temperature: 0.2
//   });

//   const content = response.choices[0].message.content.trim();
//   const start = content.indexOf('{');
//   const end = content.lastIndexOf('}');

//   try {
//     return JSON.parse(content.slice(start, end + 1));
//   } catch (e) {
//     console.error('❌ AI enrichment failed:', e);
//     return { aiSummary: '', aiAnalysis: '', aiIndex: [] };
//   }
// }

// // === MULTI FILE UPLOAD ===
// // === MULTI FILE UPLOAD WITH DUPLICATE CHECKING ===
// app.post('/upload', upload.array('files'), async (req, res) => {
//   res.setHeader('Content-Type', 'text/html; charset=utf-8');

//   try {
//     const files = req.files;
//     let letterTexts = [];

//     for (const file of files) {
//       const letters = await extractLettersFromPdf(file.path);
//       letterTexts.push(...letters);
//       fs.unlinkSync(file.path);
//     }

//     res.write(`<style>body { font-family: monospace; white-space: pre-wrap; }</style>`);
//     res.write(`📦 ${files.length} PDF files uploaded\n`);
//     res.write(`📄 Found ${letterTexts.length} total letters\n\n`);

//     let savedCount = 0;
//     let skippedCount = 0;

//     for (let i = 0; i < letterTexts.length; i++) {
//       const rawText = letterTexts[i];
      
//       // Generate hash for duplicate detection
//       const textHash = generateTextHash(rawText);
      
//       // Try to extract NDA number for better logging
//       const ndaNumber = extractNDANumber(rawText);
      
//       res.write(`➡️ Processing letter ${i + 1}${ndaNumber ? ` (NDA ${ndaNumber})` : ''}...\n`);
      
//       // Check if this letter already exists in database
//       const existingLetter = await Letter.findOne({ textHash });
      
//       if (existingLetter) {
//         res.write(`⏭️ Letter already in database (${existingLetter.ndaNumber || 'unknown NDA'}), skipping AI analysis\n\n`);
//         skippedCount++;
//         continue;
//       }
      
//       // If not duplicate, proceed with expensive AI operations
//       res.write(`🔍 New letter detected, performing AI analysis...\n`);
      
//       const structured = await extractStructuredLetter(rawText);

//       if (!structured) {
//         res.write(`❌ Could not parse letter ${i + 1}\n\n`);
//         continue;
//       }

//       // Add the raw text back to structured data
//       structured.rawText = rawText;
      
//       const aiEnriched = await enrichLetterWithAI(structured);
//       const fullLetter = { 
//         ...structured, 
//         ...aiEnriched,
//         textHash // Add the hash to the document
//       };

//       try {
//         await Letter.create(fullLetter);
//         savedCount++;

//         for (const char of fullLetter.aiSummary || 'Done') {
//           res.write(char);
//           await new Promise(r => setTimeout(r, 8));
//         }
//         res.write('\n\n✅ Saved.\n\n');
//       } catch (err) {
//         if (err.code === 11000) {
//           res.write(`⚠️ Letter appears to be duplicate (race condition), skipping\n\n`);
//           skippedCount++;
//         } else {
//           throw err;
//         }
//       }
//     }

//     res.write(`\n🎉 Processing complete!\n`);
//     res.write(`📊 Summary:\n`);
//     res.write(`   - New letters saved: ${savedCount}\n`);
//     res.write(`   - Duplicates skipped: ${skippedCount}\n`);
//     res.write(`   - Total processed: ${letterTexts.length}`);
//     res.end();
//   } catch (err) {
//     console.error('❌ Error during upload:', err);
//     res.end('❌ Upload failed: ' + err.message);
//   }
// });
// // Add this endpoint to your server.js file

// // === EXTRACT SPECIFIC CRLS FOR ORPHAN DRUGS ===
// app.get('/extract-orphan-crls', async (req, res) => {
//   try {
//     console.log('🔍 Searching for specific orphan drug CRLs...');
    
//     // Define the specific CRLs we're looking for based on your data
//     const targetCRLs = [
//       {
//         company: 'Esteve Pharmaceuticals',
//         applicationName: 'Celecoxib and Tramadol',
//         orphanDrugs: [
//           'Adeno-associated virus serotype 9 vector containing human N-acetylgalactosamine-6-sulfate sulfatase gene',
//           'adeno-associated virus serotype 9 vector containing human Iduronate-2-sulfatase transgene',
//           'adeno-associated viral vector serotype 9 containing human N-acetylglucosaminidase alpha gene',
//           'adeno-associated virus vector serotype 9 expressing human sulfamidase'
//         ]
//       },
//       {
//         company: 'Chiesi',
//         applicationName: 'Mannitol',
//         orphanDrugs: [
//           'recombinant human galactocerebrosidase (rhGALC)'
//         ]
//       }
//     ];
    
//     // Search for matching CRLs
//     const searchQueries = [];
    
//     for (const target of targetCRLs) {
//       // Create flexible search patterns
//       searchQueries.push({
//         $or: [
//           // Search by company name (flexible matching)
//           { 'company.name': { $regex: target.company, $options: 'i' } },
//           // Search by application name
//           { applicationName: { $regex: target.applicationName, $options: 'i' } },
//           // Search in raw text for company
//           { rawText: { $regex: target.company, $options: 'i' } }
//         ]
//       });
//     }
    
//     // Execute search
//     const letters = await Letter.find({
//       $or: searchQueries
//     }).select('-rawText'); // Exclude rawText for cleaner output (remove this if you need it)
    
//     console.log(`✅ Found ${letters.length} potential CRL matches`);
    
//     // Now match with orphan drugs
//     const orphanCRLMatches = [];
    
//     // Get all orphan drugs from your Excel that match these companies
//     const orphanDrugs = await OrphanCRLMatch.find({
//       $or: [
//         { sponsorCompany: { $regex: 'Esteve', $options: 'i' } },
//         { sponsorCompany: { $regex: 'Chiesi', $options: 'i' } }
//       ]
//     });
    
//     console.log(`📊 Found ${orphanDrugs.length} orphan drugs from target companies`);
    
//     // Create detailed matches
//     for (const letter of letters) {
//       // Find matching orphan drugs for this CRL
//       const matchingOrphans = orphanDrugs.filter(orphan => {
//         // Check if company matches
//         const companyMatch = 
//           (letter.company?.name && orphan.sponsorCompany && 
//            letter.company.name.toLowerCase().includes(orphan.sponsorCompany.toLowerCase().split(' ')[0])) ||
//           (letter.company?.name && orphan.sponsorCompany && 
//            orphan.sponsorCompany.toLowerCase().includes(letter.company.name.toLowerCase().split(' ')[0]));
        
//         return companyMatch;
//       });
      
//       // Create entry for each orphan drug match
//       for (const orphan of matchingOrphans) {
//         orphanCRLMatches.push({
//           // Orphan Drug Information
//           genericName: orphan.genericName,
//           orphanDesignation: orphan.orphanDesignation,
//           sponsor: orphan.sponsorCompany,
//           orphanDesignationStatus: orphan.orphanDesignationStatus,
//           fdaApprovalStatus: orphan.fdaApprovalStatus,
          
//           // CRL Information
//           crlApplication: letter.applicationName || 'Unknown',
//           crlNDANumber: letter.ndaNumber || 'Unknown',
//           crlCompany: letter.company?.name || 'Unknown',
//           crlDate: letter.date || 'Unknown',
//           crlType: letter.letterType || 'FDA Complete Response Letter',
          
//           // Additional CRL Details
//           crlClinicalFindings: letter.clinicalFindings || [],
//           crlStudiesReferenced: letter.studiesReferenced || [],
//           crlFDAOffice: letter.fdaOffice || 'Unknown',
//           crlSummary: letter.summary || '',
//           crlAISummary: letter.aiSummary || '',
//           crlAIAnalysis: letter.aiAnalysis || '',
          
//           // Metadata
//           matchConfidence: 'high',
//           extractedDate: new Date().toISOString()
//         });
//       }
//     }
    
//     // Also search for exact matches from your provided list
//     const specificSearches = [
//       { applicationName: /Celecoxib.*Tramadol/i },
//       { applicationName: /Mannitol.*Powder/i }
//     ];
    
//     const specificLetters = await Letter.find({
//       $or: specificSearches
//     });
    
//     console.log(`🎯 Found ${specificLetters.length} specific application matches`);
    
//     // Add specific matches
//     for (const letter of specificLetters) {
//       // Check if we already have this CRL
//       const alreadyAdded = orphanCRLMatches.some(
//         match => match.crlNDANumber === letter.ndaNumber && 
//                  match.crlApplication === letter.applicationName
//       );
      
//       if (!alreadyAdded) {
//         // Add based on your provided data
//         if (letter.applicationName?.toLowerCase().includes('celecoxib')) {
//           // Add all Esteve orphan drugs
//           const esteveOrphans = [
//             {
//               name: 'Adeno-associated virus serotype 9 vector containing human N-acetylgalactosamine-6-sulfate sulfatase gene',
//               designation: 'Treatment of mucopolysaccharidosis type IVA (Morquio A Syndrome)',
//               prevalence: 0.45,
//               usPatients: 1498
//             },
//             {
//               name: 'adeno-associated virus serotype 9 vector containing human Iduronate-2-sulfatase transgene',
//               designation: 'Treatment of mucopolysaccharidosis type II (Hunter syndrome)',
//               prevalence: 1,
//               usPatients: 3330
//             },
//             {
//               name: 'adeno-associated viral vector serotype 9 containing human N-acetylglucosaminidase alpha gene',
//               designation: 'Treatment of mucopolysaccharidosis type IIIB (Sanfilippo B syndrome)',
//               prevalence: 1,
//               usPatients: 3330
//             },
//             {
//               name: 'adeno-associated virus vector serotype 9 expressing human sulfamidase',
//               designation: 'Treatment of mucopolysaccharidosis type IIIA (Sanfilippo A Syndrome)',
//               prevalence: 1,
//               usPatients: 3330
//             }
//           ];
          
//           for (const orphan of esteveOrphans) {
//             orphanCRLMatches.push({
//               genericName: orphan.name,
//               orphanDesignation: orphan.designation,
//               sponsor: 'Esteve Pharmaceuticals, S.A.',
//               estimatedPrevalencePer100k: orphan.prevalence,
//               estimatedUSPatients: orphan.usPatients,
              
//               crlApplication: letter.applicationName,
//               crlNDANumber: letter.ndaNumber,
//               crlCompany: letter.company?.name || 'Esteve Pharmaceuticals, S.A.',
//               crlDate: letter.date || '5/15/2023',
//               crlType: letter.letterType || 'FDA Complete Response Letter',
              
//               crlClinicalFindings: letter.clinicalFindings || [],
//               crlStudiesReferenced: letter.studiesReferenced || [],
//               crlFDAOffice: letter.fdaOffice || '',
//               crlSummary: letter.summary || '',
//               crlAISummary: letter.aiSummary || '',
//               crlAIAnalysis: letter.aiAnalysis || '',
              
//               matchConfidence: 'exact',
//               extractedDate: new Date().toISOString()
//             });
//           }
//         } else if (letter.applicationName?.toLowerCase().includes('mannitol')) {
//           // Add Chiesi orphan drugs
//           orphanCRLMatches.push({
//             genericName: 'recombinant human galactocerebrosidase (rhGALC)',
//             orphanDesignation: 'Treatment of globoid cell leukodystrophy (Krabbe Disease)',
//             sponsor: 'Chiesi USA, Inc.',
//             estimatedPrevalencePer100k: 1,
//             estimatedUSPatients: 3330,
            
//             crlApplication: letter.applicationName,
//             crlNDANumber: letter.ndaNumber,
//             crlCompany: letter.company?.name || 'Chiesi USA, Inc.',
//             crlDate: letter.date || '1/15/2022',
//             crlType: letter.letterType || 'FDA Complete Response Letter',
            
//             crlClinicalFindings: letter.clinicalFindings || [],
//             crlStudiesReferenced: letter.studiesReferenced || [],
//             crlFDAOffice: letter.fdaOffice || '',
//             crlSummary: letter.summary || '',
//             crlAISummary: letter.aiSummary || '',
//             crlAIAnalysis: letter.aiAnalysis || '',
            
//             matchConfidence: 'exact',
//             extractedDate: new Date().toISOString()
//           });
//         }
//       }
//     }
    
//     // Return as JSON
//     res.json({
//       success: true,
//       totalMatches: orphanCRLMatches.length,
//       extractedDate: new Date().toISOString(),
//       data: orphanCRLMatches
//     });
    
//   } catch (err) {
//     console.error('❌ Error extracting orphan CRLs:', err);
//     res.status(500).json({ 
//       success: false, 
//       error: err.message 
//     });
//   }
// });

// // === SAVE EXTRACTED DATA TO FILE ===
// app.get('/save-orphan-crls', async (req, res) => {
//   try {
//     // First get the data
//     const response = await fetch(`http://localhost:${PORT}/extract-orphan-crls`);
//     const data = await response.json();
    
//     if (!data.success) {
//       throw new Error('Failed to extract data');
//     }
    
//     // Save to JSON file
//     const filename = `orphan-crls-${new Date().toISOString().split('T')[0]}.json`;
//     fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    
//     // Also create CSV for Excel
//     if (data.data.length > 0) {
//       const csvData = data.data.map(item => ({
//         'Generic Name': item.genericName,
//         'Orphan Designation': item.orphanDesignation,
//         'Sponsor': item.sponsor,
//         'CRL Application': item.crlApplication,
//         'CRL NDA Number': item.crlNDANumber,
//         'CRL Company': item.crlCompany,
//         'CRL Date': item.crlDate,
//         'CRL Type': item.crlType,
//         'Est. Prevalence (/100k)': item.estimatedPrevalencePer100k || '',
//         'Est. US Patients': item.estimatedUSPatients || '',
//         'CRL Summary': item.crlSummary,
//         'AI Summary': item.crlAISummary,
//         'Match Confidence': item.matchConfidence
//       }));
      
//       const ws = xlsx.utils.json_to_sheet(csvData);
//       const wb = xlsx.utils.book_new();
//       xlsx.utils.book_append_sheet(wb, ws, 'Orphan CRLs');
      
//       const xlsxFilename = `orphan-crls-${new Date().toISOString().split('T')[0]}.xlsx`;
//       xlsx.writeFile(wb, xlsxFilename);
      
//       res.json({
//         success: true,
//         message: `Data saved successfully`,
//         files: {
//           json: filename,
//           excel: xlsxFilename
//         },
//         totalRecords: data.data.length
//       });
//     } else {
//       res.json({
//         success: true,
//         message: 'No data to save',
//         totalRecords: 0
//       });
//     }
    
//   } catch (err) {
//     console.error('❌ Error saving orphan CRLs:', err);
//     res.status(500).json({ 
//       success: false, 
//       error: err.message 
//     });
//   }
// });

// // === SEARCH FOR SPECIFIC ORPHAN CRL ===
// app.post('/search-specific-crl', async (req, res) => {
//   try {
//     const { company, applicationName, ndaNumber } = req.body;
    
//     const searchQuery = {};
    
//     if (company) {
//       searchQuery['company.name'] = { $regex: company, $options: 'i' };
//     }
    
//     if (applicationName) {
//       searchQuery.applicationName = { $regex: applicationName, $options: 'i' };
//     }
    
//     if (ndaNumber) {
//       searchQuery.ndaNumber = ndaNumber;
//     }
    
//     const letters = await Letter.find(searchQuery);
    
//     res.json({
//       success: true,
//       count: letters.length,
//       results: letters
//     });
    
//   } catch (err) {
//     res.status(500).json({ 
//       success: false, 
//       error: err.message 
//     });
//   }
// });
// // === MIGRATION: Add hashes to existing letters ===
// async function migrateExistingLetters() {
//   try {
//     console.log('🔄 Checking for letters without hashes...');
    
//     const lettersWithoutHash = await Letter.find({ 
//       textHash: { $exists: false },
//       rawText: { $exists: true, $ne: null }
//     });
    
//     if (lettersWithoutHash.length === 0) {
//       console.log('✅ All letters already have hashes!');
//       return;
//     }
    
//     console.log(`📋 Found ${lettersWithoutHash.length} letters to migrate`);
    
//     let migratedCount = 0;
//     let errorCount = 0;
    
//     for (const letter of lettersWithoutHash) {
//       try {
//         const textHash = generateTextHash(letter.rawText);
        
//         // Check if this hash already exists (potential duplicate)
//         const existing = await Letter.findOne({ 
//           textHash, 
//           _id: { $ne: letter._id } 
//         });
        
//         if (existing) {
//           console.log(`⚠️ Duplicate found: NDA ${letter.ndaNumber} matches ${existing.ndaNumber}`);
//           // Optionally delete the duplicate
//           // await Letter.deleteOne({ _id: letter._id });
//           errorCount++;
//           continue;
//         }
        
//         letter.textHash = textHash;
//         await letter.save();
//         migratedCount++;
        
//         if (migratedCount % 10 === 0) {
//           console.log(`  ... migrated ${migratedCount} letters`);
//         }
//       } catch (err) {
//         console.error(`❌ Error migrating letter ${letter.ndaNumber}:`, err.message);
//         errorCount++;
//       }
//     }
    
//     console.log(`✅ Migration complete!`);
//     console.log(`   - Migrated: ${migratedCount}`);
//     console.log(`   - Errors/Duplicates: ${errorCount}`);
    
//   } catch (err) {
//     console.error('❌ Migration failed:', err);
//   }
// }

// // Run migration on startup (you can comment this out after first run)
// mongoose.connection.once('open', async () => {
//   await migrateExistingLetters();
// });


// // === START SERVER ===
// app.listen(PORT, () => {
//   console.log(`🚀 Server running at http://localhost:${PORT}`);
// });
