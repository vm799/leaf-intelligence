// // // require('dotenv').config();
// // // const express = require('express');
// // // const mongoose = require('mongoose');
// // // const multer = require('multer');
// // // const fs = require('fs');
// // // const pdfParse = require('pdf-parse');
// // // const { OpenAI } = require('openai');
// // // const path = require('path');
// // // const crypto = require('crypto');
// // // const xlsx = require('xlsx');

// // // const app = express();
// // // const upload = multer({ dest: 'uploads/' });
// // // const PORT = 4000;

// // // app.use(express.static('publiccrl'));
// // // app.use(express.json({ limit: '50mb' }));
// // // app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// // // // === MONGODB SCHEMAS ===
// // // const LetterSchema = new mongoose.Schema({
// // //   ndaNumber: String,
// // //   applicationName: String,
// // //   company: {
// // //     name: String,
// // //     contact: String,
// // //     address: String
// // //   },
// // //   letterType: String,
// // //   date: String,
// // //   clinicalFindings: [String],
// // //   studiesReferenced: [String],
// // //   fdaOffice: String,
// // //   fdaContact: String,
// // //   signature: String,
// // //   summary: String,
// // //   rawText: String,
// // //   aiSummary: String,
// // //   aiAnalysis: String,
// // //   aiIndex: [String],
// // //   textHash: { type: String, unique: true, sparse: true }
// // // });

// // // const OrphanCRLMatchSchema = new mongoose.Schema({
// // //   // Orphan drug info
// // //   genericName: String,
// // //   dateDesignated: Date,
// // //   orphanDesignation: String,
// // //   orphanDesignationStatus: String,
// // //   fdaApprovalStatus: String,
// // //   marketingApprovalDate: String,
// // //   sponsorCompany: String,
// // //   sponsorCountry: String,
  
// // //   // CRL matches
// // //   crlMatches: [{
// // //     letterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Letter' },
// // //     ndaNumber: String,
// // //     applicationName: String,
// // //     company: String,
// // //     letterType: String,
// // //     date: String,
// // //     matchType: String, // 'exact', 'partial', 'company'
// // //     matchScore: Number,
// // //     aiSummary: String
// // //   }],
  
// // //   // Metadata
// // //   hasMatches: Boolean,
// // //   matchCount: Number,
// // //   searchDate: { type: Date, default: Date.now },
// // //   lastUpdated: { type: Date, default: Date.now }
// // // });

// // // OrphanCRLMatchSchema.index({ genericName: 1 });
// // // OrphanCRLMatchSchema.index({ hasMatches: 1 });
// // // OrphanCRLMatchSchema.index({ sponsorCompany: 1 });

// // // const Letter = mongoose.model('Letter', LetterSchema);
// // // const OrphanCRLMatch = mongoose.model('OrphanCRLMatch', OrphanCRLMatchSchema);

// // // mongoose.connect(process.env.MONGO_URI)
// // //   .then(() => console.log('✅ Connected to MongoDB'))
// // //   .catch(err => console.error('❌ Mongo error:', err));

// // // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// // // // === HELPER FUNCTIONS ===

// // // // Generate hash from text
// // // function generateTextHash(text) {
// // //   const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
// // //   return crypto.createHash('sha256').update(normalized).digest('hex');
// // // }

// // // // Extract NDA number from text
// // // function extractNDANumber(text) {
// // //   const match = text.match(/NDA\s*(\d{6})/i);
// // //   return match ? match[1] : null;
// // // }

// // // // Normalize drug names for better matching
// // // function normalizeDrugName(name) {
// // //   if (!name) return '';
// // //   return name
// // //     .toLowerCase()
// // //     .replace(/[^\w\s]/g, '') // Remove special characters
// // //     .replace(/\s+/g, ' ')     // Normalize spaces
// // //     .trim();
// // // }

// // // // Calculate match score between two strings
// // // function calculateMatchScore(str1, str2) {
// // //   const norm1 = normalizeDrugName(str1);
// // //   const norm2 = normalizeDrugName(str2);
  
// // //   if (norm1 === norm2) return 100;
  
// // //   // Check if one contains the other
// // //   if (norm1.includes(norm2) || norm2.includes(norm1)) {
// // //     const longer = norm1.length > norm2.length ? norm1 : norm2;
// // //     const shorter = norm1.length > norm2.length ? norm2 : norm1;
// // //     return (shorter.length / longer.length) * 80;
// // //   }
  
// // //   // Token-based matching
// // //   const tokens1 = new Set(norm1.split(' '));
// // //   const tokens2 = new Set(norm2.split(' '));
// // //   const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
// // //   const union = new Set([...tokens1, ...tokens2]);
  
// // //   if (union.size === 0) return 0;
// // //   return (intersection.size / union.size) * 60;
// // // }

// // // // === LETTER PROCESSING FUNCTIONS ===

// // // async function extractLettersFromPdf(filePath) {
// // //   const dataBuffer = fs.readFileSync(filePath);
// // //   const data = await pdfParse(dataBuffer);
// // //   const rawText = data.text;

// // //   const cleaned = rawText.replace(/CENTER FOR DRUG.*?OTHER ACTION LETTERS/i, '').trim();
// // //   const letterBlocks = cleaned.split(/\n(?=NDA\s\d{6}\s+COMPLETE RESPONSE)/g);
// // //   return letterBlocks
// // //     .map(block => block.trim())
// // //     .filter(block => block.length > 500);
// // // }

// // // async function extractStructuredLetter(rawText) {
// // //   const MAX_CHARS = 12000;
// // //   const chunks = [];

// // //   if (rawText.length > MAX_CHARS) {
// // //     const paragraphs = rawText.split(/\n\s*\n/);
// // //     let currentChunk = "";

// // //     for (const p of paragraphs) {
// // //       if ((currentChunk + p).length > MAX_CHARS) {
// // //         chunks.push(currentChunk);
// // //         currentChunk = p + "\n\n";
// // //       } else {
// // //         currentChunk += p + "\n\n";
// // //       }
// // //     }
// // //     if (currentChunk) chunks.push(currentChunk);
// // //   } else {
// // //     chunks.push(rawText);
// // //   }

// // //   const partialSummaries = [];
// // //   for (let i = 0; i < chunks.length; i++) {
// // //     const response = await openai.chat.completions.create({
// // //       model: 'gpt-4',
// // //       messages: [{
// // //         role: 'user',
// // //         content: `This is part ${i + 1} of an FDA letter. Summarize this content in detail as plain text.\n\n"""${chunks[i]}"""`
// // //       }],
// // //       temperature: 0.2
// // //     });

// // //     partialSummaries.push(response.choices[0].message.content.trim());
// // //   }

// // //   const mergedSummary = partialSummaries.join("\n\n");

// // //   const finalPrompt = `
// // // Based on the following full FDA letter summary, return a single valid JSON object with:
// // // - ndaNumber
// // // - applicationName
// // // - company: { name, contact, address }
// // // - letterType
// // // - date
// // // - clinicalFindings (bullet list)
// // // - studiesReferenced (list)
// // // - fdaOffice
// // // - fdaContact
// // // - signature
// // // - summary (brief)
// // // - rawText

// // // """${mergedSummary}"""
// // //   `;

// // //   const finalResponse = await openai.chat.completions.create({
// // //     model: 'gpt-3.5-turbo-1106',
// // //     messages: [{ role: 'user', content: finalPrompt }],
// // //     temperature: 0
// // //   });

// // //   const content = finalResponse.choices[0].message.content.trim();
// // //   const start = content.indexOf('{');
// // //   const end = content.lastIndexOf('}');
// // //   try {
// // //     return JSON.parse(content.slice(start, end + 1));
// // //   } catch (err) {
// // //     console.error('❌ Final structured parsing failed:', err);
// // //     return null;
// // //   }
// // // }

// // // async function enrichLetterWithAI(structuredLetter) {
// // //   const prompt = `
// // // From this FDA letter, return the following JSON:
// // // - aiSummary: Short contextual summary of the issue
// // // - aiAnalysis: Deeper analysis of the regulatory implications
// // // - aiIndex: Array of keywords (company, product, issue, drug, condition, etc.)

// // // """${structuredLetter.rawText}"""
// // //   `;

// // //   const response = await openai.chat.completions.create({
// // //     model: 'gpt-4',
// // //     messages: [{ role: 'user', content: prompt }],
// // //     temperature: 0.2
// // //   });

// // //   const content = response.choices[0].message.content.trim();
// // //   const start = content.indexOf('{');
// // //   const end = content.lastIndexOf('}');

// // //   try {
// // //     return JSON.parse(content.slice(start, end + 1));
// // //   } catch (e) {
// // //     console.error('❌ AI enrichment failed:', e);
// // //     return { aiSummary: '', aiAnalysis: '', aiIndex: [] };
// // //   }
// // // }

// // // // === ORPHAN DRUG FUNCTIONS ===

// // // async function searchDrugInCRLs(drugName, sponsorCompany) {
// // //   const matches = [];
  
// // //   // Create search regex
// // //   const searchTerms = normalizeDrugName(drugName).split(' ');
// // //   const regexPattern = searchTerms.map(term => `(?=.*${term})`).join('');
  
// // //   // Search in multiple fields
// // //   const searchQuery = {
// // //     $or: [
// // //       // Search in application name
// // //       { applicationName: { $regex: drugName, $options: 'i' } },
// // //       // Search in AI index
// // //       { aiIndex: { $in: [new RegExp(drugName, 'i')] } },
// // //       // Search in raw text (expensive but thorough)
// // //       { rawText: { $regex: drugName, $options: 'i' } },
// // //       // Search in AI summary
// // //       { aiSummary: { $regex: drugName, $options: 'i' } },
// // //       // Also search by company if available
// // //       ...(sponsorCompany ? [{ 'company.name': { $regex: sponsorCompany, $options: 'i' } }] : [])
// // //     ]
// // //   };
  
// // //   const letters = await Letter.find(searchQuery)
// // //     .select('ndaNumber applicationName company letterType date aiSummary rawText aiIndex')
// // //     .limit(50);
  
// // //   // Score and categorize matches
// // //   for (const letter of letters) {
// // //     let matchType = 'partial';
// // //     let matchScore = 0;
    
// // //     // Check application name match
// // //     if (letter.applicationName) {
// // //       const appScore = calculateMatchScore(drugName, letter.applicationName);
// // //       if (appScore > matchScore) {
// // //         matchScore = appScore;
// // //         if (appScore === 100) matchType = 'exact';
// // //         else if (appScore >= 80) matchType = 'strong';
// // //       }
// // //     }
    
// // //     // Check if drug appears in AI index
// // //     if (letter.aiIndex && letter.aiIndex.length > 0) {
// // //       const indexMatch = letter.aiIndex.some(index => 
// // //         normalizeDrugName(index) === normalizeDrugName(drugName)
// // //       );
// // //       if (indexMatch && matchScore < 90) {
// // //         matchScore = 90;
// // //         matchType = 'index';
// // //       }
// // //     }
    
// // //     // Check company match
// // //     if (sponsorCompany && letter.company?.name) {
// // //       const companyScore = calculateMatchScore(sponsorCompany, letter.company.name);
// // //       if (companyScore >= 80 && matchScore < 50) {
// // //         matchScore = 50;
// // //         matchType = 'company';
// // //       }
// // //     }
    
// // //     // Check raw text for context
// // //     if (letter.rawText && matchScore < 30) {
// // //       const normalizedText = normalizeDrugName(letter.rawText);
// // //       if (normalizedText.includes(normalizeDrugName(drugName))) {
// // //         matchScore = Math.max(matchScore, 30);
// // //         matchType = 'text';
// // //       }
// // //     }
    
// // //     matches.push({
// // //       letterId: letter._id,
// // //       ndaNumber: letter.ndaNumber,
// // //       applicationName: letter.applicationName,
// // //       company: letter.company?.name || 'Unknown',
// // //       letterType: letter.letterType,
// // //       date: letter.date,
// // //       matchType,
// // //       matchScore,
// // //       aiSummary: letter.aiSummary
// // //     });
// // //   }
  
// // //   // Sort by match score
// // //   return matches.sort((a, b) => b.matchScore - a.matchScore);
// // // }

// // // // === MIGRATION FUNCTION ===
// // // async function migrateExistingLetters() {
// // //   try {
// // //     console.log('🔄 Checking for letters without hashes...');
    
// // //     const lettersWithoutHash = await Letter.find({ 
// // //       textHash: { $exists: false },
// // //       rawText: { $exists: true, $ne: null }
// // //     });
    
// // //     if (lettersWithoutHash.length === 0) {
// // //       console.log('✅ All letters already have hashes!');
// // //       return;
// // //     }
    
// // //     console.log(`📋 Found ${lettersWithoutHash.length} letters to migrate`);
    
// // //     let migratedCount = 0;
// // //     let errorCount = 0;
    
// // //     for (const letter of lettersWithoutHash) {
// // //       try {
// // //         const textHash = generateTextHash(letter.rawText);
        
// // //         // Check if this hash already exists (potential duplicate)
// // //         const existing = await Letter.findOne({ 
// // //           textHash, 
// // //           _id: { $ne: letter._id } 
// // //         });
        
// // //         if (existing) {
// // //           console.log(`⚠️ Duplicate found: NDA ${letter.ndaNumber} matches ${existing.ndaNumber}`);
// // //           errorCount++;
// // //           continue;
// // //         }
        
// // //         letter.textHash = textHash;
// // //         await letter.save();
// // //         migratedCount++;
        
// // //         if (migratedCount % 10 === 0) {
// // //           console.log(`  ... migrated ${migratedCount} letters`);
// // //         }
// // //       } catch (err) {
// // //         console.error(`❌ Error migrating letter ${letter.ndaNumber}:`, err.message);
// // //         errorCount++;
// // //       }
// // //     }
    
// // //     console.log(`✅ Migration complete!`);
// // //     console.log(`   - Migrated: ${migratedCount}`);
// // //     console.log(`   - Errors/Duplicates: ${errorCount}`);
    
// // //   } catch (err) {
// // //     console.error('❌ Migration failed:', err);
// // //   }
// // // }

// // // // === API ENDPOINTS ===

// // // // Upload PDFs with duplicate checking
// // // app.post('/upload', upload.array('files'), async (req, res) => {
// // //   res.setHeader('Content-Type', 'text/html; charset=utf-8');

// // //   try {
// // //     const files = req.files;
// // //     let letterTexts = [];

// // //     for (const file of files) {
// // //       const letters = await extractLettersFromPdf(file.path);
// // //       letterTexts.push(...letters);
// // //       fs.unlinkSync(file.path);
// // //     }

// // //     res.write(`<style>body { font-family: monospace; white-space: pre-wrap; }</style>`);
// // //     res.write(`📦 ${files.length} PDF files uploaded\n`);
// // //     res.write(`📄 Found ${letterTexts.length} total letters\n\n`);

// // //     let savedCount = 0;
// // //     let skippedCount = 0;

// // //     for (let i = 0; i < letterTexts.length; i++) {
// // //       const rawText = letterTexts[i];
      
// // //       // Generate hash for duplicate detection
// // //       const textHash = generateTextHash(rawText);
      
// // //       // Try to extract NDA number for better logging
// // //       const ndaNumber = extractNDANumber(rawText);
      
// // //       res.write(`➡️ Processing letter ${i + 1}${ndaNumber ? ` (NDA ${ndaNumber})` : ''}...\n`);
      
// // //       // Check if this letter already exists in database
// // //       const existingLetter = await Letter.findOne({ textHash });
      
// // //       if (existingLetter) {
// // //         res.write(`⏭️ Letter already in database (${existingLetter.ndaNumber || 'unknown NDA'}), skipping AI analysis\n\n`);
// // //         skippedCount++;
// // //         continue;
// // //       }
      
// // //       // If not duplicate, proceed with expensive AI operations
// // //       res.write(`🔍 New letter detected, performing AI analysis...\n`);
      
// // //       const structured = await extractStructuredLetter(rawText);

// // //       if (!structured) {
// // //         res.write(`❌ Could not parse letter ${i + 1}\n\n`);
// // //         continue;
// // //       }

// // //       // Add the raw text back to structured data
// // //       structured.rawText = rawText;
      
// // //       const aiEnriched = await enrichLetterWithAI(structured);
// // //       const fullLetter = { 
// // //         ...structured, 
// // //         ...aiEnriched,
// // //         textHash // Add the hash to the document
// // //       };

// // //       try {
// // //         await Letter.create(fullLetter);
// // //         savedCount++;

// // //         for (const char of fullLetter.aiSummary || 'Done') {
// // //           res.write(char);
// // //           await new Promise(r => setTimeout(r, 8));
// // //         }
// // //         res.write('\n\n✅ Saved.\n\n');
// // //       } catch (err) {
// // //         if (err.code === 11000) {
// // //           res.write(`⚠️ Letter appears to be duplicate (race condition), skipping\n\n`);
// // //           skippedCount++;
// // //         } else {
// // //           throw err;
// // //         }
// // //       }
// // //     }

// // //     res.write(`\n🎉 Processing complete!\n`);
// // //     res.write(`📊 Summary:\n`);
// // //     res.write(`   - New letters saved: ${savedCount}\n`);
// // //     res.write(`   - Duplicates skipped: ${skippedCount}\n`);
// // //     res.write(`   - Total processed: ${letterTexts.length}`);
// // //     res.end();
// // //   } catch (err) {
// // //     console.error('❌ Error during upload:', err);
// // //     res.end('❌ Upload failed: ' + err.message);
// // //   }
// // // });

// // // // Cross-reference orphan drugs with CRLs
// // // app.post('/cross-reference-orphan-drugs', async (req, res) => {
// // //   res.setHeader('Content-Type', 'text/html; charset=utf-8');
// // //   res.write(`<style>
// // //     body { font-family: monospace; white-space: pre-wrap; }
// // //     .match { color: green; font-weight: bold; }
// // //     .no-match { color: gray; }
// // //     .error { color: red; }
// // //   </style>`);
  
// // //   try {
// // //     // Read the Excel file
// // //     res.write('📂 Reading orphan drug designations file...\n');
// // //     const workbook = xlsx.readFile('all_OOPD.xls');
// // //     const sheet = workbook.Sheets[workbook.SheetNames[0]];
// // //     const orphanDrugs = xlsx.utils.sheet_to_json(sheet);
    
// // //     res.write(`✅ Found ${orphanDrugs.length} orphan drug designations\n\n`);
    
// // //     // Optional: limit for testing
// // //     const limit = req.body.limit || 50;
// // //     const startFrom = req.body.startFrom || 0;
    
// // //     res.write(`🔍 Processing drugs ${startFrom + 1} to ${Math.min(startFrom + limit, orphanDrugs.length)}...\n\n`);
    
// // //     let totalMatches = 0;
// // //     let drugsWithMatches = 0;
    
// // //     // Process each drug
// // //     for (let i = startFrom; i < Math.min(startFrom + limit, orphanDrugs.length); i++) {
// // //       const drug = orphanDrugs[i];
// // //       const genericName = drug['Generic Name'];
      
// // //       if (!genericName || genericName.trim() === '') {
// // //         continue;
// // //       }
      
// // //       res.write(`[${i + 1}/${orphanDrugs.length}] Searching for: ${genericName}`);
      
// // //       try {
// // //         // Check if we already have results for this drug
// // //         let existingMatch = await OrphanCRLMatch.findOne({ genericName });
        
// // //         if (existingMatch && !req.body.forceRefresh) {
// // //           res.write(` (cached)`);
// // //         } else {
// // //           // Search for matches in CRL database
// // //           const matches = await searchDrugInCRLs(
// // //             genericName, 
// // //             drug['Sponsor Company']
// // //           );
          
// // //           // Save or update the results
// // //           const matchData = {
// // //             genericName,
// // //             dateDesignated: drug['Date Designated'],
// // //             orphanDesignation: drug['Orphan Designation'],
// // //             orphanDesignationStatus: drug['Orphan Designation Status'],
// // //             fdaApprovalStatus: drug['FDA Orphan Approval Status'],
// // //             marketingApprovalDate: drug['Marketing Approval Date'],
// // //             sponsorCompany: drug['Sponsor Company'],
// // //             sponsorCountry: drug['Sponsor Country'],
// // //             crlMatches: matches,
// // //             hasMatches: matches.length > 0,
// // //             matchCount: matches.length,
// // //             lastUpdated: new Date()
// // //           };
          
// // //           if (existingMatch) {
// // //             await OrphanCRLMatch.updateOne(
// // //               { _id: existingMatch._id },
// // //               matchData
// // //             );
// // //           } else {
// // //             await OrphanCRLMatch.create(matchData);
// // //           }
          
// // //           existingMatch = matchData;
// // //         }
        
// // //         if (existingMatch.hasMatches) {
// // //           res.write(` <span class="match">✓ ${existingMatch.matchCount} matches found</span>\n`);
// // //           drugsWithMatches++;
// // //           totalMatches += existingMatch.matchCount;
          
// // //           // Show top match
// // //           if (existingMatch.crlMatches[0]) {
// // //             const topMatch = existingMatch.crlMatches[0];
// // //             res.write(`   → Best match: ${topMatch.applicationName || topMatch.ndaNumber} (${topMatch.matchType}, score: ${topMatch.matchScore.toFixed(0)})\n`);
// // //           }
// // //         } else {
// // //           res.write(` <span class="no-match">✗ No matches</span>\n`);
// // //         }
        
// // //       } catch (err) {
// // //         res.write(` <span class="error">❌ Error: ${err.message}</span>\n`);
// // //       }
      
// // //       // Flush output periodically
// // //       if (i % 10 === 0) {
// // //         await new Promise(r => setTimeout(r, 10));
// // //       }
// // //     }
    
// // //     res.write(`\n${'='.repeat(60)}\n`);
// // //     res.write(`📊 SUMMARY:\n`);
// // //     res.write(`   Total drugs processed: ${Math.min(limit, orphanDrugs.length - startFrom)}\n`);
// // //     res.write(`   Drugs with CRL matches: ${drugsWithMatches}\n`);
// // //     res.write(`   Total CRL matches found: ${totalMatches}\n`);
// // //     res.write(`   Match rate: ${((drugsWithMatches / Math.min(limit, orphanDrugs.length - startFrom)) * 100).toFixed(1)}%\n`);
    
// // //     res.end();
    
// // //   } catch (err) {
// // //     console.error('❌ Cross-reference error:', err);
// // //     res.write(`\n<span class="error">❌ Fatal error: ${err.message}</span>`);
// // //     res.end();
// // //   }
// // // });

// // // // Check for duplicate letters
// // // app.get('/check-duplicates', async (req, res) => {
// // //   try {
// // //     const pipeline = [
// // //       { $match: { textHash: { $exists: true } } },
// // //       { $group: { 
// // //         _id: '$textHash', 
// // //         count: { $sum: 1 },
// // //         letters: { $push: { 
// // //           id: '$_id', 
// // //           ndaNumber: '$ndaNumber',
// // //           applicationName: '$applicationName'
// // //         }}
// // //       }},
// // //       { $match: { count: { $gt: 1 } } }
// // //     ];
    
// // //     const duplicates = await Letter.aggregate(pipeline);
    
// // //     res.json({
// // //       duplicateGroups: duplicates.length,
// // //       duplicates: duplicates.map(d => ({
// // //         hash: d._id,
// // //         count: d.count,
// // //         letters: d.letters
// // //       }))
// // //     });
// // //   } catch (err) {
// // //     res.status(500).json({ error: err.message });
// // //   }
// // // });

// // // // Get orphan drugs with CRL matches
// // // app.get('/orphan-drugs-with-crls', async (req, res) => {
// // //   try {
// // //     const matches = await OrphanCRLMatch.find({ hasMatches: true })
// // //       .sort({ matchCount: -1 })
// // //       .limit(100);
    
// // //     res.json({
// // //       total: matches.length,
// // //       drugs: matches.map(m => ({
// // //         drug: m.genericName,
// // //         company: m.sponsorCompany,
// // //         designation: m.orphanDesignation,
// // //         crlCount: m.matchCount,
// // //         topMatch: m.crlMatches[0] ? {
// // //           nda: m.crlMatches[0].ndaNumber,
// // //           application: m.crlMatches[0].applicationName,
// // //           matchType: m.crlMatches[0].matchType,
// // //           score: m.crlMatches[0].matchScore
// // //         } : null
// // //       }))
// // //     });
// // //   } catch (err) {
// // //     res.status(500).json({ error: err.message });
// // //   }
// // // });

// // // // Search for a specific orphan drug
// // // app.get('/orphan-drug/:name', async (req, res) => {
// // //   try {
// // //     const match = await OrphanCRLMatch.findOne({ 
// // //       genericName: new RegExp(req.params.name, 'i') 
// // //     });
    
// // //     if (!match) {
// // //       return res.status(404).json({ error: 'Drug not found' });
// // //     }
    
// // //     res.json(match);
// // //   } catch (err) {
// // //     res.status(500).json({ error: err.message });
// // //   }
// // // });

// // // // Get statistics
// // // app.get('/orphan-crl-stats', async (req, res) => {
// // //   try {
// // //     const totalOrphans = await OrphanCRLMatch.countDocuments();
// // //     const withMatches = await OrphanCRLMatch.countDocuments({ hasMatches: true });
    
// // //     const topMatches = await OrphanCRLMatch.find({ hasMatches: true })
// // //       .sort({ matchCount: -1 })
// // //       .limit(10)
// // //       .select('genericName sponsorCompany matchCount');
    
// // //     const byCompany = await OrphanCRLMatch.aggregate([
// // //       { $match: { hasMatches: true } },
// // //       { $group: {
// // //         _id: '$sponsorCompany',
// // //         count: { $sum: 1 },
// // //         totalMatches: { $sum: '$matchCount' }
// // //       }},
// // //       { $sort: { totalMatches: -1 } },
// // //       { $limit: 10 }
// // //     ]);
    
// // //     res.json({
// // //       summary: {
// // //         totalOrphanDrugs: totalOrphans,
// // //         orphansWithCRLs: withMatches,
// // //         matchRate: ((withMatches / totalOrphans) * 100).toFixed(1) + '%'
// // //       },
// // //       topDrugsWithMostCRLs: topMatches,
// // //       topCompaniesByMatches: byCompany
// // //     });
// // //   } catch (err) {
// // //     res.status(500).json({ error: err.message });
// // //   }
// // // });

// // // // Export results to Excel
// // // app.get('/export-orphan-crl-matches', async (req, res) => {
// // //   try {
// // //     const matches = await OrphanCRLMatch.find({ hasMatches: true });
    
// // //     const csvData = [];
// // //     for (const match of matches) {
// // //       for (const crl of match.crlMatches) {
// // //         csvData.push({
// // //           'Generic Name': match.genericName,
// // //           'Orphan Designation': match.orphanDesignation,
// // //           'Sponsor Company': match.sponsorCompany,
// // //           'CRL NDA Number': crl.ndaNumber,
// // //           'CRL Application': crl.applicationName,
// // //           'CRL Company': crl.company,
// // //           'Match Type': crl.matchType,
// // //           'Match Score': crl.matchScore,
// // //           'CRL Date': crl.date,
// // //           'CRL Type': crl.letterType
// // //         });
// // //       }
// // //     }
    
// // //     const ws = xlsx.utils.json_to_sheet(csvData);
// // //     const wb = xlsx.utils.book_new();
// // //     xlsx.utils.book_append_sheet(wb, ws, 'Orphan-CRL Matches');
    
// // //     const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
// // //     res.setHeader('Content-Disposition', 'attachment; filename="orphan-crl-matches.xlsx"');
// // //     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
// // //     res.send(buffer);
// // //   } catch (err) {
// // //     res.status(500).json({ error: err.message });
// // //   }
// // // });

// // // // Home page
// // // app.get('/', (req, res) => {
// // //   res.send(`
// // //     <!DOCTYPE html>
// // //     <html>
// // //     <head>
// // //       <title>CRL Analysis Server</title>
// // //       <style>
// // //         body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
// // //         h1 { color: #333; }
// // //         .endpoint { background: #f4f4f4; padding: 10px; margin: 10px 0; border-radius: 5px; }
// // //         .method { color: #007bff; font-weight: bold; }
// // //         code { background: #e9ecef; padding: 2px 4px; border-radius: 3px; }
// // //       </style>
// // //     </head>
// // //     <body>
// // //       <h1>CRL Analysis Server</h1>
      
// // //       <h2>PDF Upload</h2>
// // //       <div class="endpoint">
// // //         <span class="method">POST</span> <code>/upload</code> - Upload CRL PDFs for processing
// // //       </div>
      
// // //       <h2>Orphan Drug Analysis</h2>
// // //       <div class="endpoint">
// // //         <span class="method">POST</span> <code>/cross-reference-orphan-drugs</code> - Cross-reference orphan drugs with CRLs
// // //       </div>
// // //       <div class="endpoint">
// // //         <span class="method">GET</span> <code>/orphan-drugs-with-crls</code> - Get all orphan drugs that have CRL matches
// // //       </div>
// // //       <div class="endpoint">
// // //         <span class="method">GET</span> <code>/orphan-drug/:name</code> - Search for specific orphan drug
// // //       </div>
// // //       <div class="endpoint">
// // //         <span class="method">GET</span> <code>/orphan-crl-stats</code> - Get statistics
// // //       </div>
// // //       <div class="endpoint">
// // //         <span class="method">GET</span> <code>/export-orphan-crl-matches</code> - Export results to Excel
// // //       </div>
      
// // //       <h2>Utilities</h2>
// // //       <div class="endpoint">
// // //         <span class="method">GET</span> <code>/check-duplicates</code> - Check for duplicate letters
// // //       </div>
// // //     </body>
// // //     </html>
// // //   `);
// // // });

// // // // === AUTO PROCESS ORPHAN DRUGS ===
// // // async function autoProcessOrphanDrugs() {
// // //   try {
// // //     console.log('\n🤖 AUTO-PROCESSING ORPHAN DRUGS');
// // //     console.log('================================');
    
// // //     // Check if Excel file exists
// // //     if (!fs.existsSync('all_OOPD.xls')) {
// // //       console.log('❌ all_OOPD.xls file not found - skipping auto-process');
// // //       return;
// // //     }
    
// // //     // Read the Excel file
// // //     const workbook = xlsx.readFile('all_OOPD.xls');
// // //     const sheet = workbook.Sheets[workbook.SheetNames[0]];
// // //     const orphanDrugs = xlsx.utils.sheet_to_json(sheet);
    
// // //     console.log(`📊 Found ${orphanDrugs.length} orphan drugs to process`);
    
// // //     // Check how many have already been processed
// // //     const processedCount = await OrphanCRLMatch.countDocuments();
// // //     console.log(`✅ Already processed: ${processedCount}`);
    
// // //     if (processedCount >= orphanDrugs.length) {
// // //       console.log('🎉 All orphan drugs already processed!');
// // //       console.log('   To force reprocessing, delete records from OrphanCRLMatch collection');
// // //       return;
// // //     }
    
// // //     const remaining = orphanDrugs.length - processedCount;
// // //     console.log(`📋 Remaining to process: ${remaining}`);
// // //     console.log(`⏰ Estimated time: ${Math.ceil(remaining * 0.5 / 60)} minutes`);
// // //     console.log('\n🚀 Starting auto-processing...\n');
    
// // //     const BATCH_SIZE = 100; // Process 100 at a time
// // //     let totalProcessed = 0;
// // //     let totalMatches = 0;
// // //     let drugsWithMatches = 0;
    
// // //     // Process in batches
// // //     for (let startFrom = 0; startFrom < orphanDrugs.length; startFrom += BATCH_SIZE) {
// // //       const endAt = Math.min(startFrom + BATCH_SIZE, orphanDrugs.length);
// // //       console.log(`\n📦 Processing batch: ${startFrom + 1} to ${endAt}`);
      
// // //       for (let i = startFrom; i < endAt; i++) {
// // //         const drug = orphanDrugs[i];
// // //         const genericName = drug['Generic Name'];
        
// // //         if (!genericName || genericName.trim() === '') {
// // //           continue;
// // //         }
        
// // //         // Check if already processed
// // //         const existingMatch = await OrphanCRLMatch.findOne({ genericName });
        
// // //         if (existingMatch) {
// // //           process.stdout.write(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - SKIP (cached)\r`);
// // //           if (existingMatch.hasMatches) {
// // //             drugsWithMatches++;
// // //             totalMatches += existingMatch.matchCount;
// // //           }
// // //           continue;
// // //         }
        
// // //         // Search for matches
// // //         process.stdout.write(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - searching...  \r`);
        
// // //         try {
// // //           const matches = await searchDrugInCRLs(
// // //             genericName, 
// // //             drug['Sponsor Company']
// // //           );
          
// // //           // Save results
// // //           const matchData = {
// // //             genericName,
// // //             dateDesignated: drug['Date Designated'],
// // //             orphanDesignation: drug['Orphan Designation'],
// // //             orphanDesignationStatus: drug['Orphan Designation Status'],
// // //             fdaApprovalStatus: drug['FDA Orphan Approval Status'],
// // //             marketingApprovalDate: drug['Marketing Approval Date'],
// // //             sponsorCompany: drug['Sponsor Company'],
// // //             sponsorCountry: drug['Sponsor Country'],
// // //             crlMatches: matches,
// // //             hasMatches: matches.length > 0,
// // //             matchCount: matches.length,
// // //             lastUpdated: new Date()
// // //           };
          
// // //           await OrphanCRLMatch.create(matchData);
// // //           totalProcessed++;
          
// // //           if (matches.length > 0) {
// // //             drugsWithMatches++;
// // //             totalMatches += matches.length;
// // //             console.log(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - ✅ ${matches.length} matches`);
// // //           } else {
// // //             process.stdout.write(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - ✗ no matches    \r`);
// // //           }
          
// // //         } catch (err) {
// // //           console.log(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - ❌ Error: ${err.message}`);
// // //         }
        
// // //         // Add small delay to prevent overwhelming the database
// // //         if (totalProcessed % 10 === 0) {
// // //           await new Promise(r => setTimeout(r, 100));
// // //         }
// // //       }
      
// // //       // Show batch summary
// // //       console.log(`\n📊 Batch complete. Total progress: ${Math.min(endAt, orphanDrugs.length)}/${orphanDrugs.length}`);
// // //       console.log(`   Drugs with matches so far: ${drugsWithMatches}`);
// // //       console.log(`   Total CRL matches found: ${totalMatches}`);
// // //     }
    
// // //     // Final summary
// // //     console.log('\n' + '='.repeat(60));
// // //     console.log('🎉 AUTO-PROCESSING COMPLETE!');
// // //     console.log('='.repeat(60));
// // //     console.log(`📊 FINAL RESULTS:`);
// // //     console.log(`   Total drugs processed: ${totalProcessed}`);
// // //     console.log(`   Drugs with CRL matches: ${drugsWithMatches}`);
// // //     console.log(`   Total CRL matches found: ${totalMatches}`);
// // //     console.log(`   Match rate: ${((drugsWithMatches / totalProcessed) * 100).toFixed(1)}%`);
// // //     console.log('\n📈 View results at:');
// // //     console.log(`   - Statistics: http://localhost:${PORT}/orphan-crl-stats`);
// // //     console.log(`   - Export Excel: http://localhost:${PORT}/export-orphan-crl-matches`);
// // //     console.log(`   - View matches: http://localhost:${PORT}/orphan-drugs-with-crls`);
    
// // //   } catch (err) {
// // //     console.error('❌ Auto-processing failed:', err);
// // //   }
// // // }

// // // // === STARTUP FUNCTIONS ===

// // // // Run migration and auto-process on startup
// // // mongoose.connection.once('open', async () => {
// // //   // First run migration
// // //   await migrateExistingLetters();
  
// // //   // Wait a moment for everything to settle
// // //   await new Promise(r => setTimeout(r, 2000));
  
// // //   // Auto-process orphan drugs
// // //   // Comment out this line if you don't want auto-processing
// // //   await autoProcessOrphanDrugs();
// // // });

// // // // Start server
// // // app.listen(PORT, () => {
// // //   console.log(`🚀 Server running at http://localhost:${PORT}`);
// // //   console.log(`📝 Make sure you have:`);
// // //   console.log(`   - .env file with MONGO_URI and OPENAI_API_KEY`);
// // //   console.log(`   - all_OOPD.xls file in the root directory`);
// // //   console.log(`   - Run: npm install xlsx`);
// // //   console.log('\n⏳ Connecting to database and starting auto-processing...');
// // // });

// // require('dotenv').config();
// // const express = require('express');
// // const mongoose = require('mongoose');
// // const multer = require('multer');
// // const fs = require('fs');
// // const pdfParse = require('pdf-parse');
// // const { OpenAI } = require('openai');
// // const path = require('path');
// // const crypto = require('crypto');
// // const xlsx = require('xlsx');

// // const app = express();
// // const upload = multer({ dest: 'uploads/' });
// // const PORT = 4000;

// // app.use(express.static('publiccrl'));
// // app.use(express.json({ limit: '50mb' }));
// // app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// // // === MONGODB SCHEMAS ===
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
// //   aiIndex: [String],
// //   textHash: { type: String, unique: true, sparse: true }
// // });

// // const OrphanCRLMatchSchema = new mongoose.Schema({
// //   // Orphan drug info
// //   genericName: String,
// //   dateDesignated: Date,
// //   orphanDesignation: String,
// //   orphanDesignationStatus: String,
// //   fdaApprovalStatus: String,
// //   marketingApprovalDate: String,
// //   sponsorCompany: String,
// //   sponsorCountry: String,
  
// //   // CRL matches
// //   crlMatches: [{
// //     letterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Letter' },
// //     ndaNumber: String,
// //     applicationName: String,
// //     company: String,
// //     letterType: String,
// //     date: String,
// //     matchType: String, // 'exact', 'partial', 'company'
// //     matchScore: Number,
// //     aiSummary: String
// //   }],
  
// //   // Metadata
// //   hasMatches: Boolean,
// //   matchCount: Number,
// //   searchDate: { type: Date, default: Date.now },
// //   lastUpdated: { type: Date, default: Date.now }
// // });

// // OrphanCRLMatchSchema.index({ genericName: 1 });
// // OrphanCRLMatchSchema.index({ hasMatches: 1 });
// // OrphanCRLMatchSchema.index({ sponsorCompany: 1 });

// // const Letter = mongoose.model('Letter', LetterSchema);
// // const OrphanCRLMatch = mongoose.model('OrphanCRLMatch', OrphanCRLMatchSchema);

// // mongoose.connect(process.env.MONGO_URI)
// //   .then(() => console.log('✅ Connected to MongoDB'))
// //   .catch(err => console.error('❌ Mongo error:', err));

// // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// // // === HELPER FUNCTIONS ===

// // // Generate hash from text
// // function generateTextHash(text) {
// //   const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
// //   return crypto.createHash('sha256').update(normalized).digest('hex');
// // }

// // // Extract NDA number from text
// // function extractNDANumber(text) {
// //   const match = text.match(/NDA\s*(\d{6})/i);
// //   return match ? match[1] : null;
// // }

// // // Normalize drug names for better matching
// // function normalizeDrugName(name) {
// //   if (!name) return '';
// //   return name
// //     .toLowerCase()
// //     .replace(/[^\w\s]/g, '') // Remove special characters
// //     .replace(/\s+/g, ' ')     // Normalize spaces
// //     .trim();
// // }

// // // Normalize drug names for better matching
// // function normalizeDrugName(name) {
// //   if (!name) return '';
// //   return name
// //     .toLowerCase()
// //     .replace(/[^\w\s]/g, '') // Remove special characters
// //     .replace(/\s+/g, ' ')     // Normalize spaces
// //     .trim();
// // }

// // // Escape special regex characters
// // function escapeRegex(string) {
// //   return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// // }

// // // Calculate match score between two strings
// // function calculateMatchScore(str1, str2) {
// //   const norm1 = normalizeDrugName(str1);
// //   const norm2 = normalizeDrugName(str2);
  
// //   if (norm1 === norm2) return 100;
  
// //   // Check if one contains the other
// //   if (norm1.includes(norm2) || norm2.includes(norm1)) {
// //     const longer = norm1.length > norm2.length ? norm1 : norm2;
// //     const shorter = norm1.length > norm2.length ? norm2 : norm1;
// //     return (shorter.length / longer.length) * 80;
// //   }
  
// //   // Token-based matching
// //   const tokens1 = new Set(norm1.split(' '));
// //   const tokens2 = new Set(norm2.split(' '));
// //   const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
// //   const union = new Set([...tokens1, ...tokens2]);
  
// //   if (union.size === 0) return 0;
// //   return (intersection.size / union.size) * 60;
// // }

// // // === LETTER PROCESSING FUNCTIONS ===

// // async function extractLettersFromPdf(filePath) {
// //   const dataBuffer = fs.readFileSync(filePath);
// //   const data = await pdfParse(dataBuffer);
// //   const rawText = data.text;

// //   const cleaned = rawText.replace(/CENTER FOR DRUG.*?OTHER ACTION LETTERS/i, '').trim();
// //   const letterBlocks = cleaned.split(/\n(?=NDA\s\d{6}\s+COMPLETE RESPONSE)/g);
// //   return letterBlocks
// //     .map(block => block.trim())
// //     .filter(block => block.length > 500);
// // }

// // async function extractStructuredLetter(rawText) {
// //   const MAX_CHARS = 12000;
// //   const chunks = [];

// //   if (rawText.length > MAX_CHARS) {
// //     const paragraphs = rawText.split(/\n\s*\n/);
// //     let currentChunk = "";

// //     for (const p of paragraphs) {
// //       if ((currentChunk + p).length > MAX_CHARS) {
// //         chunks.push(currentChunk);
// //         currentChunk = p + "\n\n";
// //       } else {
// //         currentChunk += p + "\n\n";
// //       }
// //     }
// //     if (currentChunk) chunks.push(currentChunk);
// //   } else {
// //     chunks.push(rawText);
// //   }

// //   const partialSummaries = [];
// //   for (let i = 0; i < chunks.length; i++) {
// //     const response = await openai.chat.completions.create({
// //       model: 'gpt-4',
// //       messages: [{
// //         role: 'user',
// //         content: `This is part ${i + 1} of an FDA letter. Summarize this content in detail as plain text.\n\n"""${chunks[i]}"""`
// //       }],
// //       temperature: 0.2
// //     });

// //     partialSummaries.push(response.choices[0].message.content.trim());
// //   }

// //   const mergedSummary = partialSummaries.join("\n\n");

// //   const finalPrompt = `
// // Based on the following full FDA letter summary, return a single valid JSON object with:
// // - ndaNumber
// // - applicationName
// // - company: { name, contact, address }
// // - letterType
// // - date
// // - clinicalFindings (bullet list)
// // - studiesReferenced (list)
// // - fdaOffice
// // - fdaContact
// // - signature
// // - summary (brief)
// // - rawText

// // """${mergedSummary}"""
// //   `;

// //   const finalResponse = await openai.chat.completions.create({
// //     model: 'gpt-3.5-turbo-1106',
// //     messages: [{ role: 'user', content: finalPrompt }],
// //     temperature: 0
// //   });

// //   const content = finalResponse.choices[0].message.content.trim();
// //   const start = content.indexOf('{');
// //   const end = content.lastIndexOf('}');
// //   try {
// //     return JSON.parse(content.slice(start, end + 1));
// //   } catch (err) {
// //     console.error('❌ Final structured parsing failed:', err);
// //     return null;
// //   }
// // }

// // async function enrichLetterWithAI(structuredLetter) {
// //   const prompt = `
// // From this FDA letter, return the following JSON:
// // - aiSummary: Short contextual summary of the issue
// // - aiAnalysis: Deeper analysis of the regulatory implications
// // - aiIndex: Array of keywords (company, product, issue, drug, condition, etc.)

// // """${structuredLetter.rawText}"""
// //   `;

// //   const response = await openai.chat.completions.create({
// //     model: 'gpt-4',
// //     messages: [{ role: 'user', content: prompt }],
// //     temperature: 0.2
// //   });

// //   const content = response.choices[0].message.content.trim();
// //   const start = content.indexOf('{');
// //   const end = content.lastIndexOf('}');

// //   try {
// //     return JSON.parse(content.slice(start, end + 1));
// //   } catch (e) {
// //     console.error('❌ AI enrichment failed:', e);
// //     return { aiSummary: '', aiAnalysis: '', aiIndex: [] };
// //   }
// // }

// // // === ORPHAN DRUG FUNCTIONS ===

// // async function searchDrugInCRLs(drugName, sponsorCompany) {
// //   const matches = [];
  
// //   // Escape special regex characters to prevent errors
// //   const escapedDrugName = escapeRegex(drugName);
  
// //   // Also create a normalized version for broader matching
// //   const normalizedDrugName = normalizeDrugName(drugName);
  
// //   // Search in multiple fields
// //   const searchQuery = {
// //     $or: [
// //       // Search in application name (using escaped version)
// //       { applicationName: { $regex: escapedDrugName, $options: 'i' } },
// //       // Search in AI index
// //       { aiIndex: { $in: [new RegExp(escapedDrugName, 'i')] } },
// //       // Search in AI summary
// //       { aiSummary: { $regex: escapedDrugName, $options: 'i' } },
// //       // Also search by normalized version if different
// //       ...(normalizedDrugName !== escapedDrugName ? [
// //         { applicationName: { $regex: normalizedDrugName, $options: 'i' } },
// //         { aiIndex: { $in: [new RegExp(normalizedDrugName, 'i')] } },
// //         { aiSummary: { $regex: normalizedDrugName, $options: 'i' } }
// //       ] : []),
// //       // Search by company if available
// //       ...(sponsorCompany ? [{ 'company.name': { $regex: escapeRegex(sponsorCompany), $options: 'i' } }] : [])
// //     ]
// //   };
  
// //   try {
// //     const letters = await Letter.find(searchQuery)
// //       .select('ndaNumber applicationName company letterType date aiSummary rawText aiIndex')
// //       .limit(50);
    
// //     // Score and categorize matches
// //     for (const letter of letters) {
// //       let matchType = 'partial';
// //       let matchScore = 0;
      
// //       // Check application name match
// //       if (letter.applicationName) {
// //         const appScore = calculateMatchScore(drugName, letter.applicationName);
// //         if (appScore > matchScore) {
// //           matchScore = appScore;
// //           if (appScore === 100) matchType = 'exact';
// //           else if (appScore >= 80) matchType = 'strong';
// //         }
// //       }
      
// //       // Check if drug appears in AI index
// //       if (letter.aiIndex && letter.aiIndex.length > 0) {
// //         const indexMatch = letter.aiIndex.some(index => 
// //           normalizeDrugName(index) === normalizeDrugName(drugName)
// //         );
// //         if (indexMatch && matchScore < 90) {
// //           matchScore = 90;
// //           matchType = 'index';
// //         }
// //       }
      
// //       // Check company match
// //       if (sponsorCompany && letter.company?.name) {
// //         const companyScore = calculateMatchScore(sponsorCompany, letter.company.name);
// //         if (companyScore >= 80 && matchScore < 50) {
// //           matchScore = 50;
// //           matchType = 'company';
// //         }
// //       }
      
// //       // Check raw text for context (only for normalized version to save resources)
// //       if (letter.rawText && matchScore < 30) {
// //         const normalizedText = normalizeDrugName(letter.rawText);
// //         if (normalizedText.includes(normalizedDrugName)) {
// //           matchScore = Math.max(matchScore, 30);
// //           matchType = 'text';
// //         }
// //       }
      
// //       matches.push({
// //         letterId: letter._id,
// //         ndaNumber: letter.ndaNumber,
// //         applicationName: letter.applicationName,
// //         company: letter.company?.name || 'Unknown',
// //         letterType: letter.letterType,
// //         date: letter.date,
// //         matchType,
// //         matchScore,
// //         aiSummary: letter.aiSummary
// //       });
// //     }
// //   } catch (err) {
// //     // If regex still fails, try with just normalized version
// //     if (err.message.includes('Regular expression')) {
// //       console.log(`  Regex error for "${drugName}", trying normalized search only...`);
      
// //       const fallbackQuery = {
// //         $or: [
// //           { applicationName: { $regex: normalizedDrugName, $options: 'i' } },
// //           { aiIndex: { $in: [normalizedDrugName] } },
// //           { aiSummary: { $regex: normalizedDrugName, $options: 'i' } }
// //         ]
// //       };
      
// //       try {
// //         const letters = await Letter.find(fallbackQuery)
// //           .select('ndaNumber applicationName company letterType date aiSummary aiIndex')
// //           .limit(50);
          
// //         for (const letter of letters) {
// //           matches.push({
// //             letterId: letter._id,
// //             ndaNumber: letter.ndaNumber,
// //             applicationName: letter.applicationName,
// //             company: letter.company?.name || 'Unknown',
// //             letterType: letter.letterType,
// //             date: letter.date,
// //             matchType: 'normalized',
// //             matchScore: 25,
// //             aiSummary: letter.aiSummary
// //           });
// //         }
// //       } catch (fallbackErr) {
// //         console.log(`  Fallback also failed: ${fallbackErr.message}`);
// //       }
// //     }
// //   }
  
// //   // Sort by match score
// //   return matches.sort((a, b) => b.matchScore - a.matchScore);
// // }

// // // === MIGRATION FUNCTION ===
// // async function migrateExistingLetters() {
// //   try {
// //     console.log('🔄 Checking for letters without hashes...');
    
// //     const lettersWithoutHash = await Letter.find({ 
// //       textHash: { $exists: false },
// //       rawText: { $exists: true, $ne: null }
// //     });
    
// //     if (lettersWithoutHash.length === 0) {
// //       console.log('✅ All letters already have hashes!');
// //       return;
// //     }
    
// //     console.log(`📋 Found ${lettersWithoutHash.length} letters to migrate`);
    
// //     let migratedCount = 0;
// //     let errorCount = 0;
    
// //     for (const letter of lettersWithoutHash) {
// //       try {
// //         const textHash = generateTextHash(letter.rawText);
        
// //         // Check if this hash already exists (potential duplicate)
// //         const existing = await Letter.findOne({ 
// //           textHash, 
// //           _id: { $ne: letter._id } 
// //         });
        
// //         if (existing) {
// //           console.log(`⚠️ Duplicate found: NDA ${letter.ndaNumber} matches ${existing.ndaNumber}`);
// //           errorCount++;
// //           continue;
// //         }
        
// //         letter.textHash = textHash;
// //         await letter.save();
// //         migratedCount++;
        
// //         if (migratedCount % 10 === 0) {
// //           console.log(`  ... migrated ${migratedCount} letters`);
// //         }
// //       } catch (err) {
// //         console.error(`❌ Error migrating letter ${letter.ndaNumber}:`, err.message);
// //         errorCount++;
// //       }
// //     }
    
// //     console.log(`✅ Migration complete!`);
// //     console.log(`   - Migrated: ${migratedCount}`);
// //     console.log(`   - Errors/Duplicates: ${errorCount}`);
    
// //   } catch (err) {
// //     console.error('❌ Migration failed:', err);
// //   }
// // }

// // // === API ENDPOINTS ===

// // // Upload PDFs with duplicate checking
// // app.post('/upload', upload.array('files'), async (req, res) => {
// //   res.setHeader('Content-Type', 'text/html; charset=utf-8');

// //   try {
// //     const files = req.files;
// //     let letterTexts = [];

// //     for (const file of files) {
// //       const letters = await extractLettersFromPdf(file.path);
// //       letterTexts.push(...letters);
// //       fs.unlinkSync(file.path);
// //     }

// //     res.write(`<style>body { font-family: monospace; white-space: pre-wrap; }</style>`);
// //     res.write(`📦 ${files.length} PDF files uploaded\n`);
// //     res.write(`📄 Found ${letterTexts.length} total letters\n\n`);

// //     let savedCount = 0;
// //     let skippedCount = 0;

// //     for (let i = 0; i < letterTexts.length; i++) {
// //       const rawText = letterTexts[i];
      
// //       // Generate hash for duplicate detection
// //       const textHash = generateTextHash(rawText);
      
// //       // Try to extract NDA number for better logging
// //       const ndaNumber = extractNDANumber(rawText);
      
// //       res.write(`➡️ Processing letter ${i + 1}${ndaNumber ? ` (NDA ${ndaNumber})` : ''}...\n`);
      
// //       // Check if this letter already exists in database
// //       const existingLetter = await Letter.findOne({ textHash });
      
// //       if (existingLetter) {
// //         res.write(`⏭️ Letter already in database (${existingLetter.ndaNumber || 'unknown NDA'}), skipping AI analysis\n\n`);
// //         skippedCount++;
// //         continue;
// //       }
      
// //       // If not duplicate, proceed with expensive AI operations
// //       res.write(`🔍 New letter detected, performing AI analysis...\n`);
      
// //       const structured = await extractStructuredLetter(rawText);

// //       if (!structured) {
// //         res.write(`❌ Could not parse letter ${i + 1}\n\n`);
// //         continue;
// //       }

// //       // Add the raw text back to structured data
// //       structured.rawText = rawText;
      
// //       const aiEnriched = await enrichLetterWithAI(structured);
// //       const fullLetter = { 
// //         ...structured, 
// //         ...aiEnriched,
// //         textHash // Add the hash to the document
// //       };

// //       try {
// //         await Letter.create(fullLetter);
// //         savedCount++;

// //         for (const char of fullLetter.aiSummary || 'Done') {
// //           res.write(char);
// //           await new Promise(r => setTimeout(r, 8));
// //         }
// //         res.write('\n\n✅ Saved.\n\n');
// //       } catch (err) {
// //         if (err.code === 11000) {
// //           res.write(`⚠️ Letter appears to be duplicate (race condition), skipping\n\n`);
// //           skippedCount++;
// //         } else {
// //           throw err;
// //         }
// //       }
// //     }

// //     res.write(`\n🎉 Processing complete!\n`);
// //     res.write(`📊 Summary:\n`);
// //     res.write(`   - New letters saved: ${savedCount}\n`);
// //     res.write(`   - Duplicates skipped: ${skippedCount}\n`);
// //     res.write(`   - Total processed: ${letterTexts.length}`);
// //     res.end();
// //   } catch (err) {
// //     console.error('❌ Error during upload:', err);
// //     res.end('❌ Upload failed: ' + err.message);
// //   }
// // });

// // // Cross-reference orphan drugs with CRLs
// // app.post('/cross-reference-orphan-drugs', async (req, res) => {
// //   res.setHeader('Content-Type', 'text/html; charset=utf-8');
// //   res.write(`<style>
// //     body { font-family: monospace; white-space: pre-wrap; }
// //     .match { color: green; font-weight: bold; }
// //     .no-match { color: gray; }
// //     .error { color: red; }
// //   </style>`);
  
// //   try {
// //     // Read the Excel file
// //     res.write('📂 Reading orphan drug designations file...\n');
// //     const workbook = xlsx.readFile('all_OOPD.xls');
// //     const sheet = workbook.Sheets[workbook.SheetNames[0]];
// //     const orphanDrugs = xlsx.utils.sheet_to_json(sheet);
    
// //     res.write(`✅ Found ${orphanDrugs.length} orphan drug designations\n\n`);
    
// //     // Optional: limit for testing
// //     const limit = req.body.limit || 50;
// //     const startFrom = req.body.startFrom || 0;
    
// //     res.write(`🔍 Processing drugs ${startFrom + 1} to ${Math.min(startFrom + limit, orphanDrugs.length)}...\n\n`);
    
// //     let totalMatches = 0;
// //     let drugsWithMatches = 0;
    
// //     // Process each drug
// //     for (let i = startFrom; i < Math.min(startFrom + limit, orphanDrugs.length); i++) {
// //       const drug = orphanDrugs[i];
// //       const genericName = drug['Generic Name'];
      
// //       if (!genericName || genericName.trim() === '') {
// //         continue;
// //       }
      
// //       res.write(`[${i + 1}/${orphanDrugs.length}] Searching for: ${genericName}`);
      
// //       try {
// //         // Check if we already have results for this drug
// //         let existingMatch = await OrphanCRLMatch.findOne({ genericName });
        
// //         if (existingMatch && !req.body.forceRefresh) {
// //           res.write(` (cached)`);
// //         } else {
// //           // Search for matches in CRL database
// //           const matches = await searchDrugInCRLs(
// //             genericName, 
// //             drug['Sponsor Company']
// //           );
          
// //           // Save or update the results
// //           const matchData = {
// //             genericName,
// //             dateDesignated: drug['Date Designated'],
// //             orphanDesignation: drug['Orphan Designation'],
// //             orphanDesignationStatus: drug['Orphan Designation Status'],
// //             fdaApprovalStatus: drug['FDA Orphan Approval Status'],
// //             marketingApprovalDate: drug['Marketing Approval Date'],
// //             sponsorCompany: drug['Sponsor Company'],
// //             sponsorCountry: drug['Sponsor Country'],
// //             crlMatches: matches,
// //             hasMatches: matches.length > 0,
// //             matchCount: matches.length,
// //             lastUpdated: new Date()
// //           };
          
// //           if (existingMatch) {
// //             await OrphanCRLMatch.updateOne(
// //               { _id: existingMatch._id },
// //               matchData
// //             );
// //           } else {
// //             await OrphanCRLMatch.create(matchData);
// //           }
          
// //           existingMatch = matchData;
// //         }
        
// //         if (existingMatch.hasMatches) {
// //           res.write(` <span class="match">✓ ${existingMatch.matchCount} matches found</span>\n`);
// //           drugsWithMatches++;
// //           totalMatches += existingMatch.matchCount;
          
// //           // Show top match
// //           if (existingMatch.crlMatches[0]) {
// //             const topMatch = existingMatch.crlMatches[0];
// //             res.write(`   → Best match: ${topMatch.applicationName || topMatch.ndaNumber} (${topMatch.matchType}, score: ${topMatch.matchScore.toFixed(0)})\n`);
// //           }
// //         } else {
// //           res.write(` <span class="no-match">✗ No matches</span>\n`);
// //         }
        
// //       } catch (err) {
// //         res.write(` <span class="error">❌ Error: ${err.message}</span>\n`);
// //       }
      
// //       // Flush output periodically
// //       if (i % 10 === 0) {
// //         await new Promise(r => setTimeout(r, 10));
// //       }
// //     }
    
// //     res.write(`\n${'='.repeat(60)}\n`);
// //     res.write(`📊 SUMMARY:\n`);
// //     res.write(`   Total drugs processed: ${Math.min(limit, orphanDrugs.length - startFrom)}\n`);
// //     res.write(`   Drugs with CRL matches: ${drugsWithMatches}\n`);
// //     res.write(`   Total CRL matches found: ${totalMatches}\n`);
// //     res.write(`   Match rate: ${((drugsWithMatches / Math.min(limit, orphanDrugs.length - startFrom)) * 100).toFixed(1)}%\n`);
    
// //     res.end();
    
// //   } catch (err) {
// //     console.error('❌ Cross-reference error:', err);
// //     res.write(`\n<span class="error">❌ Fatal error: ${err.message}</span>`);
// //     res.end();
// //   }
// // });

// // // Check for duplicate letters
// // app.get('/check-duplicates', async (req, res) => {
// //   try {
// //     const pipeline = [
// //       { $match: { textHash: { $exists: true } } },
// //       { $group: { 
// //         _id: '$textHash', 
// //         count: { $sum: 1 },
// //         letters: { $push: { 
// //           id: '$_id', 
// //           ndaNumber: '$ndaNumber',
// //           applicationName: '$applicationName'
// //         }}
// //       }},
// //       { $match: { count: { $gt: 1 } } }
// //     ];
    
// //     const duplicates = await Letter.aggregate(pipeline);
    
// //     res.json({
// //       duplicateGroups: duplicates.length,
// //       duplicates: duplicates.map(d => ({
// //         hash: d._id,
// //         count: d.count,
// //         letters: d.letters
// //       }))
// //     });
// //   } catch (err) {
// //     res.status(500).json({ error: err.message });
// //   }
// // });

// // // Get orphan drugs with CRL matches
// // app.get('/orphan-drugs-with-crls', async (req, res) => {
// //   try {
// //     const matches = await OrphanCRLMatch.find({ hasMatches: true })
// //       .sort({ matchCount: -1 })
// //       .limit(100);
    
// //     res.json({
// //       total: matches.length,
// //       drugs: matches.map(m => ({
// //         drug: m.genericName,
// //         company: m.sponsorCompany,
// //         designation: m.orphanDesignation,
// //         crlCount: m.matchCount,
// //         topMatch: m.crlMatches[0] ? {
// //           nda: m.crlMatches[0].ndaNumber,
// //           application: m.crlMatches[0].applicationName,
// //           matchType: m.crlMatches[0].matchType,
// //           score: m.crlMatches[0].matchScore
// //         } : null
// //       }))
// //     });
// //   } catch (err) {
// //     res.status(500).json({ error: err.message });
// //   }
// // });

// // // Search for a specific orphan drug
// // app.get('/orphan-drug/:name', async (req, res) => {
// //   try {
// //     const match = await OrphanCRLMatch.findOne({ 
// //       genericName: new RegExp(req.params.name, 'i') 
// //     });
    
// //     if (!match) {
// //       return res.status(404).json({ error: 'Drug not found' });
// //     }
    
// //     res.json(match);
// //   } catch (err) {
// //     res.status(500).json({ error: err.message });
// //   }
// // });

// // // Get statistics
// // app.get('/orphan-crl-stats', async (req, res) => {
// //   try {
// //     const totalOrphans = await OrphanCRLMatch.countDocuments();
// //     const withMatches = await OrphanCRLMatch.countDocuments({ hasMatches: true });
    
// //     const topMatches = await OrphanCRLMatch.find({ hasMatches: true })
// //       .sort({ matchCount: -1 })
// //       .limit(10)
// //       .select('genericName sponsorCompany matchCount');
    
// //     const byCompany = await OrphanCRLMatch.aggregate([
// //       { $match: { hasMatches: true } },
// //       { $group: {
// //         _id: '$sponsorCompany',
// //         count: { $sum: 1 },
// //         totalMatches: { $sum: '$matchCount' }
// //       }},
// //       { $sort: { totalMatches: -1 } },
// //       { $limit: 10 }
// //     ]);
    
// //     res.json({
// //       summary: {
// //         totalOrphanDrugs: totalOrphans,
// //         orphansWithCRLs: withMatches,
// //         matchRate: ((withMatches / totalOrphans) * 100).toFixed(1) + '%'
// //       },
// //       topDrugsWithMostCRLs: topMatches,
// //       topCompaniesByMatches: byCompany
// //     });
// //   } catch (err) {
// //     res.status(500).json({ error: err.message });
// //   }
// // });
// // // Add this endpoint to your server.js file

// // // === EXTRACT SPECIFIC CRLS FOR ORPHAN DRUGS ===
// // app.get('/extract-orphan-crls', async (req, res) => {
// //   try {
// //     console.log('🔍 Searching for specific orphan drug CRLs...');
    
// //     // Define the specific CRLs we're looking for based on your data
// //     const targetCRLs = [
// //       {
// //         company: 'Esteve Pharmaceuticals',
// //         applicationName: 'Celecoxib and Tramadol',
// //         orphanDrugs: [
// //           'Adeno-associated virus serotype 9 vector containing human N-acetylgalactosamine-6-sulfate sulfatase gene',
// //           'adeno-associated virus serotype 9 vector containing human Iduronate-2-sulfatase transgene',
// //           'adeno-associated viral vector serotype 9 containing human N-acetylglucosaminidase alpha gene',
// //           'adeno-associated virus vector serotype 9 expressing human sulfamidase'
// //         ]
// //       },
// //       {
// //         company: 'Chiesi',
// //         applicationName: 'Mannitol',
// //         orphanDrugs: [
// //           'recombinant human galactocerebrosidase (rhGALC)'
// //         ]
// //       }
// //     ];
    
// //     // Search for matching CRLs
// //     const searchQueries = [];
    
// //     for (const target of targetCRLs) {
// //       // Create flexible search patterns
// //       searchQueries.push({
// //         $or: [
// //           // Search by company name (flexible matching)
// //           { 'company.name': { $regex: target.company, $options: 'i' } },
// //           // Search by application name
// //           { applicationName: { $regex: target.applicationName, $options: 'i' } },
// //           // Search in raw text for company
// //           { rawText: { $regex: target.company, $options: 'i' } }
// //         ]
// //       });
// //     }
    
// //     // Execute search
// //     const letters = await Letter.find({
// //       $or: searchQueries
// //     }).select('-rawText'); // Exclude rawText for cleaner output (remove this if you need it)
    
// //     console.log(`✅ Found ${letters.length} potential CRL matches`);
    
// //     // Now match with orphan drugs
// //     const orphanCRLMatches = [];
    
// //     // Get all orphan drugs from your Excel that match these companies
// //     const orphanDrugs = await OrphanCRLMatch.find({
// //       $or: [
// //         { sponsorCompany: { $regex: 'Esteve', $options: 'i' } },
// //         { sponsorCompany: { $regex: 'Chiesi', $options: 'i' } }
// //       ]
// //     });
    
// //     console.log(`📊 Found ${orphanDrugs.length} orphan drugs from target companies`);
    
// //     // Create detailed matches
// //     for (const letter of letters) {
// //       // Find matching orphan drugs for this CRL
// //       const matchingOrphans = orphanDrugs.filter(orphan => {
// //         // Check if company matches
// //         const companyMatch = 
// //           (letter.company?.name && orphan.sponsorCompany && 
// //            letter.company.name.toLowerCase().includes(orphan.sponsorCompany.toLowerCase().split(' ')[0])) ||
// //           (letter.company?.name && orphan.sponsorCompany && 
// //            orphan.sponsorCompany.toLowerCase().includes(letter.company.name.toLowerCase().split(' ')[0]));
        
// //         return companyMatch;
// //       });
      
// //       // Create entry for each orphan drug match
// //       for (const orphan of matchingOrphans) {
// //         orphanCRLMatches.push({
// //           // Orphan Drug Information
// //           genericName: orphan.genericName,
// //           orphanDesignation: orphan.orphanDesignation,
// //           sponsor: orphan.sponsorCompany,
// //           orphanDesignationStatus: orphan.orphanDesignationStatus,
// //           fdaApprovalStatus: orphan.fdaApprovalStatus,
          
// //           // CRL Information
// //           crlApplication: letter.applicationName || 'Unknown',
// //           crlNDANumber: letter.ndaNumber || 'Unknown',
// //           crlCompany: letter.company?.name || 'Unknown',
// //           crlDate: letter.date || 'Unknown',
// //           crlType: letter.letterType || 'FDA Complete Response Letter',
          
// //           // Additional CRL Details
// //           crlClinicalFindings: letter.clinicalFindings || [],
// //           crlStudiesReferenced: letter.studiesReferenced || [],
// //           crlFDAOffice: letter.fdaOffice || 'Unknown',
// //           crlSummary: letter.summary || '',
// //           crlAISummary: letter.aiSummary || '',
// //           crlAIAnalysis: letter.aiAnalysis || '',
          
// //           // Metadata
// //           matchConfidence: 'high',
// //           extractedDate: new Date().toISOString()
// //         });
// //       }
// //     }
    
// //     // Also search for exact matches from your provided list
// //     const specificSearches = [
// //       { applicationName: /Celecoxib.*Tramadol/i },
// //       { applicationName: /Mannitol.*Powder/i }
// //     ];
    
// //     const specificLetters = await Letter.find({
// //       $or: specificSearches
// //     });
    
// //     console.log(`🎯 Found ${specificLetters.length} specific application matches`);
    
// //     // Add specific matches
// //     for (const letter of specificLetters) {
// //       // Check if we already have this CRL
// //       const alreadyAdded = orphanCRLMatches.some(
// //         match => match.crlNDANumber === letter.ndaNumber && 
// //                  match.crlApplication === letter.applicationName
// //       );
      
// //       if (!alreadyAdded) {
// //         // Add based on your provided data
// //         if (letter.applicationName?.toLowerCase().includes('celecoxib')) {
// //           // Add all Esteve orphan drugs
// //           const esteveOrphans = [
// //             {
// //               name: 'Adeno-associated virus serotype 9 vector containing human N-acetylgalactosamine-6-sulfate sulfatase gene',
// //               designation: 'Treatment of mucopolysaccharidosis type IVA (Morquio A Syndrome)',
// //               prevalence: 0.45,
// //               usPatients: 1498
// //             },
// //             {
// //               name: 'adeno-associated virus serotype 9 vector containing human Iduronate-2-sulfatase transgene',
// //               designation: 'Treatment of mucopolysaccharidosis type II (Hunter syndrome)',
// //               prevalence: 1,
// //               usPatients: 3330
// //             },
// //             {
// //               name: 'adeno-associated viral vector serotype 9 containing human N-acetylglucosaminidase alpha gene',
// //               designation: 'Treatment of mucopolysaccharidosis type IIIB (Sanfilippo B syndrome)',
// //               prevalence: 1,
// //               usPatients: 3330
// //             },
// //             {
// //               name: 'adeno-associated virus vector serotype 9 expressing human sulfamidase',
// //               designation: 'Treatment of mucopolysaccharidosis type IIIA (Sanfilippo A Syndrome)',
// //               prevalence: 1,
// //               usPatients: 3330
// //             }
// //           ];
          
// //           for (const orphan of esteveOrphans) {
// //             orphanCRLMatches.push({
// //               genericName: orphan.name,
// //               orphanDesignation: orphan.designation,
// //               sponsor: 'Esteve Pharmaceuticals, S.A.',
// //               estimatedPrevalencePer100k: orphan.prevalence,
// //               estimatedUSPatients: orphan.usPatients,
              
// //               crlApplication: letter.applicationName,
// //               crlNDANumber: letter.ndaNumber,
// //               crlCompany: letter.company?.name || 'Esteve Pharmaceuticals, S.A.',
// //               crlDate: letter.date || '5/15/2023',
// //               crlType: letter.letterType || 'FDA Complete Response Letter',
              
// //               crlClinicalFindings: letter.clinicalFindings || [],
// //               crlStudiesReferenced: letter.studiesReferenced || [],
// //               crlFDAOffice: letter.fdaOffice || '',
// //               crlSummary: letter.summary || '',
// //               crlAISummary: letter.aiSummary || '',
// //               crlAIAnalysis: letter.aiAnalysis || '',
              
// //               matchConfidence: 'exact',
// //               extractedDate: new Date().toISOString()
// //             });
// //           }
// //         } else if (letter.applicationName?.toLowerCase().includes('mannitol')) {
// //           // Add Chiesi orphan drugs
// //           orphanCRLMatches.push({
// //             genericName: 'recombinant human galactocerebrosidase (rhGALC)',
// //             orphanDesignation: 'Treatment of globoid cell leukodystrophy (Krabbe Disease)',
// //             sponsor: 'Chiesi USA, Inc.',
// //             estimatedPrevalencePer100k: 1,
// //             estimatedUSPatients: 3330,
            
// //             crlApplication: letter.applicationName,
// //             crlNDANumber: letter.ndaNumber,
// //             crlCompany: letter.company?.name || 'Chiesi USA, Inc.',
// //             crlDate: letter.date || '1/15/2022',
// //             crlType: letter.letterType || 'FDA Complete Response Letter',
            
// //             crlClinicalFindings: letter.clinicalFindings || [],
// //             crlStudiesReferenced: letter.studiesReferenced || [],
// //             crlFDAOffice: letter.fdaOffice || '',
// //             crlSummary: letter.summary || '',
// //             crlAISummary: letter.aiSummary || '',
// //             crlAIAnalysis: letter.aiAnalysis || '',
            
// //             matchConfidence: 'exact',
// //             extractedDate: new Date().toISOString()
// //           });
// //         }
// //       }
// //     }
    
// //     // Return as JSON
// //     res.json({
// //       success: true,
// //       totalMatches: orphanCRLMatches.length,
// //       extractedDate: new Date().toISOString(),
// //       data: orphanCRLMatches
// //     });
    
// //   } catch (err) {
// //     console.error('❌ Error extracting orphan CRLs:', err);
// //     res.status(500).json({ 
// //       success: false, 
// //       error: err.message 
// //     });
// //   }
// // });

// // // === SAVE EXTRACTED DATA TO FILE ===
// // app.get('/save-orphan-crls', async (req, res) => {
// //   try {
// //     // First get the data
// //     const response = await fetch(`http://localhost:${PORT}/extract-orphan-crls`);
// //     const data = await response.json();
    
// //     if (!data.success) {
// //       throw new Error('Failed to extract data');
// //     }
    
// //     // Save to JSON file
// //     const filename = `orphan-crls-${new Date().toISOString().split('T')[0]}.json`;
// //     fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    
// //     // Also create CSV for Excel
// //     if (data.data.length > 0) {
// //       const csvData = data.data.map(item => ({
// //         'Generic Name': item.genericName,
// //         'Orphan Designation': item.orphanDesignation,
// //         'Sponsor': item.sponsor,
// //         'CRL Application': item.crlApplication,
// //         'CRL NDA Number': item.crlNDANumber,
// //         'CRL Company': item.crlCompany,
// //         'CRL Date': item.crlDate,
// //         'CRL Type': item.crlType,
// //         'Est. Prevalence (/100k)': item.estimatedPrevalencePer100k || '',
// //         'Est. US Patients': item.estimatedUSPatients || '',
// //         'CRL Summary': item.crlSummary,
// //         'AI Summary': item.crlAISummary,
// //         'Match Confidence': item.matchConfidence
// //       }));
      
// //       const ws = xlsx.utils.json_to_sheet(csvData);
// //       const wb = xlsx.utils.book_new();
// //       xlsx.utils.book_append_sheet(wb, ws, 'Orphan CRLs');
      
// //       const xlsxFilename = `orphan-crls-${new Date().toISOString().split('T')[0]}.xlsx`;
// //       xlsx.writeFile(wb, xlsxFilename);
      
// //       res.json({
// //         success: true,
// //         message: `Data saved successfully`,
// //         files: {
// //           json: filename,
// //           excel: xlsxFilename
// //         },
// //         totalRecords: data.data.length
// //       });
// //     } else {
// //       res.json({
// //         success: true,
// //         message: 'No data to save',
// //         totalRecords: 0
// //       });
// //     }
    
// //   } catch (err) {
// //     console.error('❌ Error saving orphan CRLs:', err);
// //     res.status(500).json({ 
// //       success: false, 
// //       error: err.message 
// //     });
// //   }
// // });

// // // === SEARCH FOR SPECIFIC ORPHAN CRL ===
// // app.post('/search-specific-crl', async (req, res) => {
// //   try {
// //     const { company, applicationName, ndaNumber } = req.body;
    
// //     const searchQuery = {};
    
// //     if (company) {
// //       searchQuery['company.name'] = { $regex: company, $options: 'i' };
// //     }
    
// //     if (applicationName) {
// //       searchQuery.applicationName = { $regex: applicationName, $options: 'i' };
// //     }
    
// //     if (ndaNumber) {
// //       searchQuery.ndaNumber = ndaNumber;
// //     }
    
// //     const letters = await Letter.find(searchQuery);
    
// //     res.json({
// //       success: true,
// //       count: letters.length,
// //       results: letters
// //     });
    
// //   } catch (err) {
// //     res.status(500).json({ 
// //       success: false, 
// //       error: err.message 
// //     });
// //   }
// // });
// // // Export results to Excel
// // app.get('/export-orphan-crl-matches', async (req, res) => {
// //   try {
// //     const matches = await OrphanCRLMatch.find({ hasMatches: true });
    
// //     const csvData = [];
// //     for (const match of matches) {
// //       for (const crl of match.crlMatches) {
// //         csvData.push({
// //           'Generic Name': match.genericName,
// //           'Orphan Designation': match.orphanDesignation,
// //           'Sponsor Company': match.sponsorCompany,
// //           'CRL NDA Number': crl.ndaNumber,
// //           'CRL Application': crl.applicationName,
// //           'CRL Company': crl.company,
// //           'Match Type': crl.matchType,
// //           'Match Score': crl.matchScore,
// //           'CRL Date': crl.date,
// //           'CRL Type': crl.letterType
// //         });
// //       }
// //     }
    
// //     const ws = xlsx.utils.json_to_sheet(csvData);
// //     const wb = xlsx.utils.book_new();
// //     xlsx.utils.book_append_sheet(wb, ws, 'Orphan-CRL Matches');
    
// //     const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
// //     res.setHeader('Content-Disposition', 'attachment; filename="orphan-crl-matches.xlsx"');
// //     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
// //     res.send(buffer);
// //   } catch (err) {
// //     res.status(500).json({ error: err.message });
// //   }
// // });

// // // Home page
// // app.get('/', (req, res) => {
// //   res.send(`
// //     <!DOCTYPE html>
// //     <html>
// //     <head>
// //       <title>CRL Analysis Server</title>
// //       <style>
// //         body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
// //         h1 { color: #333; }
// //         .endpoint { background: #f4f4f4; padding: 10px; margin: 10px 0; border-radius: 5px; }
// //         .method { color: #007bff; font-weight: bold; }
// //         code { background: #e9ecef; padding: 2px 4px; border-radius: 3px; }
// //       </style>
// //     </head>
// //     <body>
// //       <h1>CRL Analysis Server</h1>
      
// //       <h2>PDF Upload</h2>
// //       <div class="endpoint">
// //         <span class="method">POST</span> <code>/upload</code> - Upload CRL PDFs for processing
// //       </div>
      
// //       <h2>Orphan Drug Analysis</h2>
// //       <div class="endpoint">
// //         <span class="method">POST</span> <code>/cross-reference-orphan-drugs</code> - Cross-reference orphan drugs with CRLs
// //       </div>
// //       <div class="endpoint">
// //         <span class="method">GET</span> <code>/orphan-drugs-with-crls</code> - Get all orphan drugs that have CRL matches
// //       </div>
// //       <div class="endpoint">
// //         <span class="method">GET</span> <code>/orphan-drug/:name</code> - Search for specific orphan drug
// //       </div>
// //       <div class="endpoint">
// //         <span class="method">GET</span> <code>/orphan-crl-stats</code> - Get statistics
// //       </div>
// //       <div class="endpoint">
// //         <span class="method">GET</span> <code>/export-orphan-crl-matches</code> - Export results to Excel
// //       </div>
      
// //       <h2>Utilities</h2>
// //       <div class="endpoint">
// //         <span class="method">GET</span> <code>/check-duplicates</code> - Check for duplicate letters
// //       </div>
// //     </body>
// //     </html>
// //   `);
// // });

// // // === AUTO PROCESS ORPHAN DRUGS ===
// // async function autoProcessOrphanDrugs() {
// //   try {
// //     console.log('\n🤖 AUTO-PROCESSING ORPHAN DRUGS');
// //     console.log('================================');
    
// //     // Check if Excel file exists
// //     if (!fs.existsSync('all_OOPD.xls')) {
// //       console.log('❌ all_OOPD.xls file not found - skipping auto-process');
// //       return;
// //     }
    
// //     // Read the Excel file
// //     const workbook = xlsx.readFile('all_OOPD.xls');
// //     const sheet = workbook.Sheets[workbook.SheetNames[0]];
// //     const orphanDrugs = xlsx.utils.sheet_to_json(sheet);
    
// //     console.log(`📊 Found ${orphanDrugs.length} orphan drugs to process`);
    
// //     // Check how many have already been processed
// //     const processedCount = await OrphanCRLMatch.countDocuments();
// //     console.log(`✅ Already processed: ${processedCount}`);
    
// //     if (processedCount >= orphanDrugs.length) {
// //       console.log('🎉 All orphan drugs already processed!');
// //       console.log('   To force reprocessing, delete records from OrphanCRLMatch collection');
// //       return;
// //     }
    
// //     const remaining = orphanDrugs.length - processedCount;
// //     console.log(`📋 Remaining to process: ${remaining}`);
// //     console.log(`⏰ Estimated time: ${Math.ceil(remaining * 0.5 / 60)} minutes`);
// //     console.log('\n🚀 Starting auto-processing...\n');
    
// //     const BATCH_SIZE = 100; // Process 100 at a time
// //     let totalProcessed = 0;
// //     let totalMatches = 0;
// //     let drugsWithMatches = 0;
    
// //     // Process in batches
// //     for (let startFrom = 0; startFrom < orphanDrugs.length; startFrom += BATCH_SIZE) {
// //       const endAt = Math.min(startFrom + BATCH_SIZE, orphanDrugs.length);
// //       console.log(`\n📦 Processing batch: ${startFrom + 1} to ${endAt}`);
      
// //       for (let i = startFrom; i < endAt; i++) {
// //         const drug = orphanDrugs[i];
// //         const genericName = drug['Generic Name'];
        
// //         if (!genericName || genericName.trim() === '') {
// //           continue;
// //         }
        
// //         // Check if already processed
// //         const existingMatch = await OrphanCRLMatch.findOne({ genericName });
        
// //         if (existingMatch) {
// //           process.stdout.write(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - SKIP (cached)\r`);
// //           if (existingMatch.hasMatches) {
// //             drugsWithMatches++;
// //             totalMatches += existingMatch.matchCount;
// //           }
// //           continue;
// //         }
        
// //         // Search for matches
// //         process.stdout.write(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - searching...  \r`);
        
// //         try {
// //           const matches = await searchDrugInCRLs(
// //             genericName, 
// //             drug['Sponsor Company']
// //           );
          
// //           // Save results
// //           const matchData = {
// //             genericName,
// //             dateDesignated: drug['Date Designated'],
// //             orphanDesignation: drug['Orphan Designation'],
// //             orphanDesignationStatus: drug['Orphan Designation Status'],
// //             fdaApprovalStatus: drug['FDA Orphan Approval Status'],
// //             marketingApprovalDate: drug['Marketing Approval Date'],
// //             sponsorCompany: drug['Sponsor Company'],
// //             sponsorCountry: drug['Sponsor Country'],
// //             crlMatches: matches,
// //             hasMatches: matches.length > 0,
// //             matchCount: matches.length,
// //             lastUpdated: new Date()
// //           };
          
// //           await OrphanCRLMatch.create(matchData);
// //           totalProcessed++;
          
// //           if (matches.length > 0) {
// //             drugsWithMatches++;
// //             totalMatches += matches.length;
// //             console.log(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - ✅ ${matches.length} matches`);
// //           } else {
// //             process.stdout.write(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - ✗ no matches    \r`);
// //           }
          
// //         } catch (err) {
// //           console.log(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - ❌ Error: ${err.message}`);
// //         }
        
// //         // Add small delay to prevent overwhelming the database
// //         if (totalProcessed % 10 === 0) {
// //           await new Promise(r => setTimeout(r, 100));
// //         }
// //       }
      
// //       // Show batch summary
// //       console.log(`\n📊 Batch complete. Total progress: ${Math.min(endAt, orphanDrugs.length)}/${orphanDrugs.length}`);
// //       console.log(`   Drugs with matches so far: ${drugsWithMatches}`);
// //       console.log(`   Total CRL matches found: ${totalMatches}`);
// //     }
    
// //     // Final summary
// //     console.log('\n' + '='.repeat(60));
// //     console.log('🎉 AUTO-PROCESSING COMPLETE!');
// //     console.log('='.repeat(60));
// //     console.log(`📊 FINAL RESULTS:`);
// //     console.log(`   Total drugs processed: ${totalProcessed}`);
// //     console.log(`   Drugs with CRL matches: ${drugsWithMatches}`);
// //     console.log(`   Total CRL matches found: ${totalMatches}`);
// //     console.log(`   Match rate: ${((drugsWithMatches / totalProcessed) * 100).toFixed(1)}%`);
// //     console.log('\n📈 View results at:');
// //     console.log(`   - Statistics: http://localhost:${PORT}/orphan-crl-stats`);
// //     console.log(`   - Export Excel: http://localhost:${PORT}/export-orphan-crl-matches`);
// //     console.log(`   - View matches: http://localhost:${PORT}/orphan-drugs-with-crls`);
    
// //   } catch (err) {
// //     console.error('❌ Auto-processing failed:', err);
// //   }
// // }

// // // === STARTUP FUNCTIONS ===

// // // Run migration and auto-process on startup
// // mongoose.connection.once('open', async () => {
// //   // First run migration
// // //   await migrateExistingLetters();
  
// //   // Wait a moment for everything to settle
// //   await new Promise(r => setTimeout(r, 2000));
  
// //   // Auto-process orphan drugs
// //   // Comment out this line if you don't want auto-processing
// //   await autoProcessOrphanDrugs();
// // });

// // // Start server
// // app.listen(PORT, () => {
// //   console.log(`🚀 Server running at http://localhost:${PORT}`);
// //   console.log(`📝 Make sure you have:`);
// //   console.log(`   - .env file with MONGO_URI and OPENAI_API_KEY`);
// //   console.log(`   - all_OOPD.xls file in the root directory`);
// //   console.log(`   - Run: npm install xlsx`);
// //   console.log('\n⏳ Connecting to database and starting auto-processing...');
// // });

// require('dotenv').config();
// const express = require('express');
// const mongoose = require('mongoose');
// const multer = require('multer');
// const fs = require('fs');
// const pdfParse = require('pdf-parse');
// const { OpenAI } = require('openai');
// const path = require('path');
// const crypto = require('crypto');
// const xlsx = require('xlsx');

// const app = express();
// const upload = multer({ dest: 'uploads/' });
// const PORT = 4000;

// app.use(express.static('publiccrl'));
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// // === MONGODB SCHEMAS ===
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
//   textHash: { type: String, unique: true, sparse: true }
// });

// const OrphanCRLMatchSchema = new mongoose.Schema({
//   genericName: String,
//   dateDesignated: Date,
//   orphanDesignation: String,
//   orphanDesignationStatus: String,
//   fdaApprovalStatus: String,
//   marketingApprovalDate: String,
//   sponsorCompany: String,
//   sponsorCountry: String,
//   crlMatches: [{
//     letterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Letter' },
//     ndaNumber: String,
//     applicationName: String,
//     company: String,
//     letterType: String,
//     date: String,
//     matchType: String,
//     matchScore: Number,
//     aiSummary: String
//   }],
//   hasMatches: Boolean,
//   matchCount: Number,
//   searchDate: { type: Date, default: Date.now },
//   lastUpdated: { type: Date, default: Date.now }
// });

// OrphanCRLMatchSchema.index({ genericName: 1 });
// OrphanCRLMatchSchema.index({ hasMatches: 1 });
// OrphanCRLMatchSchema.index({ sponsorCompany: 1 });

// const Letter = mongoose.model('Letter', LetterSchema);
// const OrphanCRLMatch = mongoose.model('OrphanCRLMatch', OrphanCRLMatchSchema);

// mongoose.connect(process.env.MONGO_URI)
//   .then(() => console.log('✅ Connected to MongoDB'))
//   .catch(err => console.error('❌ Mongo error:', err));

// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// // === HELPER FUNCTIONS ===

// function generateTextHash(text) {
//   const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
//   return crypto.createHash('sha256').update(normalized).digest('hex');
// }

// function extractNDANumber(text) {
//   const match = text.match(/NDA\s*(\d{6})/i);
//   return match ? match[1] : null;
// }

// function normalizeDrugName(name) {
//   if (!name) return '';
//   return name
//     .toLowerCase()
//     .replace(/[^\w\s]/g, '')
//     .replace(/\s+/g, ' ')
//     .trim();
// }

// function escapeRegex(string) {
//   return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// }

// function calculateMatchScore(str1, str2) {
//   const norm1 = normalizeDrugName(str1);
//   const norm2 = normalizeDrugName(str2);
  
//   if (norm1 === norm2) return 100;
  
//   if (norm1.includes(norm2) || norm2.includes(norm1)) {
//     const longer = norm1.length > norm2.length ? norm1 : norm2;
//     const shorter = norm1.length > norm2.length ? norm2 : norm1;
//     return (shorter.length / longer.length) * 80;
//   }
  
//   const tokens1 = new Set(norm1.split(' '));
//   const tokens2 = new Set(norm2.split(' '));
//   const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
//   const union = new Set([...tokens1, ...tokens2]);
  
//   if (union.size === 0) return 0;
//   return (intersection.size / union.size) * 60;
// }

// // === LETTER PROCESSING FUNCTIONS ===

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
//     model: 'gpt-3.5-turbo-1106',
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

// // === ORPHAN DRUG FUNCTIONS ===

// async function searchDrugInCRLs(drugName, sponsorCompany) {
//   const matches = [];
  
//   const escapedDrugName = escapeRegex(drugName);
//   const normalizedDrugName = normalizeDrugName(drugName);
  
//   const searchQuery = {
//     $or: [
//       { applicationName: { $regex: escapedDrugName, $options: 'i' } },
//       { aiIndex: { $in: [new RegExp(escapedDrugName, 'i')] } },
//       { aiSummary: { $regex: escapedDrugName, $options: 'i' } }
//     ]
//   };
  
//   if (normalizedDrugName !== escapedDrugName) {
//     searchQuery.$or.push(
//       { applicationName: { $regex: normalizedDrugName, $options: 'i' } },
//       { aiIndex: { $in: [new RegExp(normalizedDrugName, 'i')] } },
//       { aiSummary: { $regex: normalizedDrugName, $options: 'i' } }
//     );
//   }
  
//   if (sponsorCompany) {
//     searchQuery.$or.push({ 'company.name': { $regex: escapeRegex(sponsorCompany), $options: 'i' } });
//   }
  
//   try {
//     const letters = await Letter.find(searchQuery)
//       .select('ndaNumber applicationName company letterType date aiSummary rawText aiIndex')
//       .limit(50);
    
//     for (const letter of letters) {
//       let matchType = 'partial';
//       let matchScore = 0;
      
//       if (letter.applicationName) {
//         const appScore = calculateMatchScore(drugName, letter.applicationName);
//         if (appScore > matchScore) {
//           matchScore = appScore;
//           if (appScore === 100) matchType = 'exact';
//           else if (appScore >= 80) matchType = 'strong';
//         }
//       }
      
//       if (letter.aiIndex && letter.aiIndex.length > 0) {
//         const indexMatch = letter.aiIndex.some(index => 
//           normalizeDrugName(index) === normalizeDrugName(drugName)
//         );
//         if (indexMatch && matchScore < 90) {
//           matchScore = 90;
//           matchType = 'index';
//         }
//       }
      
//       if (sponsorCompany && letter.company?.name) {
//         const companyScore = calculateMatchScore(sponsorCompany, letter.company.name);
//         if (companyScore >= 80 && matchScore < 50) {
//           matchScore = 50;
//           matchType = 'company';
//         }
//       }
      
//       if (letter.rawText && matchScore < 30) {
//         const normalizedText = normalizeDrugName(letter.rawText);
//         if (normalizedText.includes(normalizedDrugName)) {
//           matchScore = Math.max(matchScore, 30);
//           matchType = 'text';
//         }
//       }
      
//       matches.push({
//         letterId: letter._id,
//         ndaNumber: letter.ndaNumber,
//         applicationName: letter.applicationName,
//         company: letter.company?.name || 'Unknown',
//         letterType: letter.letterType,
//         date: letter.date,
//         matchType,
//         matchScore,
//         aiSummary: letter.aiSummary
//       });
//     }
//   } catch (err) {
//     if (err.message.includes('Regular expression')) {
//       console.log(`  Regex error for "${drugName}", trying normalized search only...`);
      
//       const fallbackQuery = {
//         $or: [
//           { applicationName: { $regex: normalizedDrugName, $options: 'i' } },
//           { aiIndex: { $in: [normalizedDrugName] } },
//           { aiSummary: { $regex: normalizedDrugName, $options: 'i' } }
//         ]
//       };
      
//       try {
//         const letters = await Letter.find(fallbackQuery)
//           .select('ndaNumber applicationName company letterType date aiSummary aiIndex')
//           .limit(50);
          
//         for (const letter of letters) {
//           matches.push({
//             letterId: letter._id,
//             ndaNumber: letter.ndaNumber,
//             applicationName: letter.applicationName,
//             company: letter.company?.name || 'Unknown',
//             letterType: letter.letterType,
//             date: letter.date,
//             matchType: 'normalized',
//             matchScore: 25,
//             aiSummary: letter.aiSummary
//           });
//         }
//       } catch (fallbackErr) {
//         console.log(`  Fallback also failed: ${fallbackErr.message}`);
//       }
//     }
//   }
  
//   return matches.sort((a, b) => b.matchScore - a.matchScore);
// }

// // === MIGRATION FUNCTION ===
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
        
//         const existing = await Letter.findOne({ 
//           textHash, 
//           _id: { $ne: letter._id } 
//         });
        
//         if (existing) {
//           console.log(`⚠️ Duplicate found: NDA ${letter.ndaNumber} matches ${existing.ndaNumber}`);
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

// // === AUTO EXTRACT ORPHAN CRLS ===
// async function autoExtractOrphanCRLs() {
//   try {
//     console.log('\n📋 AUTO-EXTRACTING ORPHAN DRUG CRLS WITH FULL DATA');
//     console.log('===================================================');
    
//     const targetCRLs = [
//       {
//         company: 'Esteve Pharmaceuticals',
//         applicationName: 'Celecoxib and Tramadol',
//         orphanDrugs: [
//           {
//             name: 'Adeno-associated virus serotype 9 vector containing human N-acetylgalactosamine-6-sulfate sulfatase gene',
//             designation: 'Treatment of mucopolysaccharidosis type IVA (Morquio A Syndrome)',
//             prevalence: 0.45,
//             usPatients: 1498
//           },
//           {
//             name: 'adeno-associated virus serotype 9 vector containing human Iduronate-2-sulfatase transgene',
//             designation: 'Treatment of mucopolysaccharidosis type II (Hunter syndrome)',
//             prevalence: 1,
//             usPatients: 3330
//           },
//           {
//             name: 'adeno-associated viral vector serotype 9 containing human N-acetylglucosaminidase alpha gene',
//             designation: 'Treatment of mucopolysaccharidosis type IIIB (Sanfilippo B syndrome)',
//             prevalence: 1,
//             usPatients: 3330
//           },
//           {
//             name: 'adeno-associated virus vector serotype 9 expressing human sulfamidase',
//             designation: 'Treatment of mucopolysaccharidosis type IIIA (Sanfilippo A Syndrome)',
//             prevalence: 1,
//             usPatients: 3330
//           }
//         ]
//       },
//       {
//         company: 'Chiesi',
//         applicationName: 'Mannitol',
//         orphanDrugs: [
//           {
//             name: 'recombinant human galactocerebrosidase (rhGALC)',
//             designation: 'Treatment of globoid cell leukodystrophy (Krabbe Disease)',
//             prevalence: 1,
//             usPatients: 3330
//           }
//         ]
//       }
//     ];
    
//     console.log('🔍 Searching for CRLs from:');
//     console.log('   - Esteve Pharmaceuticals');
//     console.log('   - Chiesi USA');
//     console.log('📄 Will extract COMPLETE letter data including full text');
    
//     const searchQueries = [];
    
//     for (const target of targetCRLs) {
//       searchQueries.push({
//         $or: [
//           { 'company.name': { $regex: target.company, $options: 'i' } },
//           { applicationName: { $regex: target.applicationName, $options: 'i' } },
//           { rawText: { $regex: target.company, $options: 'i' } }
//         ]
//       });
//     }
    
//     const specificSearches = [
//       { applicationName: /Celecoxib.*Tramadol/i },
//       { applicationName: /Mannitol.*Powder/i }
//     ];
    
//     // Get ALL fields from the letters - no selection/exclusion
//     const letters = await Letter.find({
//       $or: [...searchQueries, ...specificSearches]
//     });
    
//     console.log(`✅ Found ${letters.length} potential CRL matches with full data`);
    
//     const orphanCRLMatches = [];
//     const fullTextMatches = []; // Separate array for full text data
    
//     for (const letter of letters) {
//       let orphansToAdd = [];
      
//       if (letter.applicationName?.toLowerCase().includes('celecoxib') || 
//           letter.company?.name?.toLowerCase().includes('esteve')) {
//         orphansToAdd = targetCRLs[0].orphanDrugs.map(o => ({
//           ...o,
//           sponsor: 'Esteve Pharmaceuticals, S.A.'
//         }));
//       } else if (letter.applicationName?.toLowerCase().includes('mannitol') || 
//                  letter.company?.name?.toLowerCase().includes('chiesi')) {
//         orphansToAdd = targetCRLs[1].orphanDrugs.map(o => ({
//           ...o,
//           sponsor: 'Chiesi USA, Inc.'
//         }));
//       }
      
//       for (const orphan of orphansToAdd) {
//         // Create summary record for Excel/CSV
//         orphanCRLMatches.push({
//           genericName: orphan.name,
//           orphanDesignation: orphan.designation,
//           sponsor: orphan.sponsor,
//           estimatedPrevalencePer100k: orphan.prevalence,
//           estimatedUSPatients: orphan.usPatients,
//           crlApplication: letter.applicationName || 'Unknown',
//           crlNDANumber: letter.ndaNumber || 'Unknown',
//           crlCompany: letter.company?.name || orphan.sponsor,
//           crlDate: letter.date || 'Unknown',
//           crlType: letter.letterType || 'FDA Complete Response Letter',
//           crlClinicalFindings: letter.clinicalFindings || [],
//           crlStudiesReferenced: letter.studiesReferenced || [],
//           crlFDAOffice: letter.fdaOffice || '',
//           crlFDAContact: letter.fdaContact || '',
//           crlSignature: letter.signature || '',
//           crlSummary: letter.summary || '',
//           crlAISummary: letter.aiSummary || '',
//           crlAIAnalysis: letter.aiAnalysis || '',
//           crlAIIndex: letter.aiIndex || [],
//           matchConfidence: 'high',
//           extractedDate: new Date().toISOString(),
//           mongoId: letter._id.toString()
//         });
        
//         // Create full record with complete raw text
//         fullTextMatches.push({
//           // Orphan drug information
//           orphanDrug: {
//             genericName: orphan.name,
//             designation: orphan.designation,
//             sponsor: orphan.sponsor,
//             estimatedPrevalencePer100k: orphan.prevalence,
//             estimatedUSPatients: orphan.usPatients
//           },
//           // Complete CRL letter data - EVERYTHING from MongoDB
//           crlLetter: {
//             _id: letter._id.toString(),
//             ndaNumber: letter.ndaNumber,
//             applicationName: letter.applicationName,
//             company: letter.company,
//             letterType: letter.letterType,
//             date: letter.date,
//             clinicalFindings: letter.clinicalFindings,
//             studiesReferenced: letter.studiesReferenced,
//             fdaOffice: letter.fdaOffice,
//             fdaContact: letter.fdaContact,
//             signature: letter.signature,
//             summary: letter.summary,
//             aiSummary: letter.aiSummary,
//             aiAnalysis: letter.aiAnalysis,
//             aiIndex: letter.aiIndex,
//             textHash: letter.textHash,
//             // FULL RAW TEXT
//             rawText: letter.rawText || ''
//           },
//           metadata: {
//             matchConfidence: 'high',
//             extractedDate: new Date().toISOString()
//           }
//         });
//       }
//     }
    
//     console.log(`📊 Created ${orphanCRLMatches.length} orphan-CRL matches`);
//     console.log(`📚 Extracted ${fullTextMatches.length} full text records`);
    
//     // Save summary JSON (without full text for readability)
//     const summaryFilename = `orphan-crls-summary-${new Date().toISOString().split('T')[0]}.json`;
//     const summaryData = {
//       success: true,
//       totalMatches: orphanCRLMatches.length,
//       extractedDate: new Date().toISOString(),
//       data: orphanCRLMatches
//     };
//     fs.writeFileSync(summaryFilename, JSON.stringify(summaryData, null, 2));
//     console.log(`💾 Saved summary JSON: ${summaryFilename}`);
    
//     // Save FULL DATA JSON with complete raw text
//     const fullDataFilename = `orphan-crls-FULL-DATA-${new Date().toISOString().split('T')[0]}.json`;
//     const fullData = {
//       success: true,
//       totalMatches: fullTextMatches.length,
//       extractedDate: new Date().toISOString(),
//       description: 'Complete CRL letters with full raw text for orphan drug matches',
//       data: fullTextMatches
//     };
//     fs.writeFileSync(fullDataFilename, JSON.stringify(fullData, null, 2));
//     console.log(`📚 Saved FULL DATA JSON with raw text: ${fullDataFilename}`);
    
//     // Create Excel file for easy viewing (summary data)
//     if (orphanCRLMatches.length > 0) {
//       const csvData = orphanCRLMatches.map(item => ({
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
//         'Clinical Findings Count': item.crlClinicalFindings.length,
//         'Studies Referenced Count': item.crlStudiesReferenced.length,
//         'FDA Office': item.crlFDAOffice,
//         'CRL Summary': (item.crlSummary || '').substring(0, 500),
//         'AI Summary': (item.crlAISummary || '').substring(0, 500),
//         'AI Analysis': (item.crlAIAnalysis || '').substring(0, 500),
//         'AI Keywords': (item.crlAIIndex || []).join('; '),
//         'Match Confidence': item.matchConfidence,
//         'MongoDB ID': item.mongoId
//       }));
      
//       const ws = xlsx.utils.json_to_sheet(csvData);
//       const wb = xlsx.utils.book_new();
//       xlsx.utils.book_append_sheet(wb, ws, 'Orphan CRLs Summary');
      
//       // Add a second sheet with clinical findings details
//       const clinicalData = [];
//       orphanCRLMatches.forEach(item => {
//         (item.crlClinicalFindings || []).forEach(finding => {
//           clinicalData.push({
//             'Generic Name': item.genericName,
//             'CRL NDA Number': item.crlNDANumber,
//             'Clinical Finding': finding
//           });
//         });
//       });
      
//       if (clinicalData.length > 0) {
//         const ws2 = xlsx.utils.json_to_sheet(clinicalData);
//         xlsx.utils.book_append_sheet(wb, ws2, 'Clinical Findings');
//       }
      
//       // Add a third sheet with studies referenced
//       const studiesData = [];
//       orphanCRLMatches.forEach(item => {
//         (item.crlStudiesReferenced || []).forEach(study => {
//           studiesData.push({
//             'Generic Name': item.genericName,
//             'CRL NDA Number': item.crlNDANumber,
//             'Study Referenced': study
//           });
//         });
//       });
      
//       if (studiesData.length > 0) {
//         const ws3 = xlsx.utils.json_to_sheet(studiesData);
//         xlsx.utils.book_append_sheet(wb, ws3, 'Studies Referenced');
//       }
      
//       const xlsxFilename = `orphan-crls-detailed-${new Date().toISOString().split('T')[0]}.xlsx`;
//       xlsx.writeFile(wb, xlsxFilename);
//       console.log(`📊 Saved detailed Excel with 3 sheets: ${xlsxFilename}`);
//     }
    
//     // Create a separate text file with just the raw texts for easy reading
//     const rawTextFilename = `orphan-crls-raw-texts-${new Date().toISOString().split('T')[0]}.txt`;
//     let rawTextContent = 'ORPHAN DRUG CRL RAW TEXTS\n';
//     rawTextContent += '=' .repeat(80) + '\n\n';
    
//     fullTextMatches.forEach((match, index) => {
//       rawTextContent += `\n${'='.repeat(80)}\n`;
//       rawTextContent += `RECORD ${index + 1}\n`;
//       rawTextContent += `${'='.repeat(80)}\n`;
//       rawTextContent += `Orphan Drug: ${match.orphanDrug.genericName}\n`;
//       rawTextContent += `Designation: ${match.orphanDrug.designation}\n`;
//       rawTextContent += `CRL NDA: ${match.crlLetter.ndaNumber}\n`;
//       rawTextContent += `CRL Application: ${match.crlLetter.applicationName}\n`;
//       rawTextContent += `MongoDB ID: ${match.crlLetter._id}\n`;
//       rawTextContent += `${'='.repeat(80)}\n`;
//       rawTextContent += `RAW TEXT:\n`;
//       rawTextContent += `${'-'.repeat(80)}\n`;
//       rawTextContent += match.crlLetter.rawText || '[No raw text available]';
//       rawTextContent += `\n\n`;
//     });
    
//     fs.writeFileSync(rawTextFilename, rawTextContent);
//     console.log(`📄 Saved raw texts file: ${rawTextFilename}`);
    
//     console.log('\n✅ Orphan CRL extraction complete with FULL DATA!');
//     console.log('📁 Files created:');
//     console.log(`   1. Summary JSON: ${summaryFilename}`);
//     console.log(`   2. FULL DATA JSON: ${fullDataFilename} (includes complete raw text)`);
//     // console.log(`   3. Detailed Excel: ${xlsxFilename} (3 sheets)`);
//     console.log(`   4. Raw texts file: ${rawTextFilename}`);
//     console.log('\n💡 The FULL DATA JSON contains everything from MongoDB including complete raw letter text');
    
//   } catch (err) {
//     console.error('❌ Error extracting orphan CRLs:', err);
//   }
// }

// // === AUTO PROCESS ORPHAN DRUGS ===
// async function autoProcessOrphanDrugs() {
//   try {
//     console.log('\n🤖 AUTO-PROCESSING ORPHAN DRUGS');
//     console.log('================================');
    
//     if (!fs.existsSync('all_OOPD.xls')) {
//       console.log('❌ all_OOPD.xls file not found - skipping auto-process');
//       return;
//     }
    
//     const workbook = xlsx.readFile('all_OOPD.xls');
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const orphanDrugs = xlsx.utils.sheet_to_json(sheet);
    
//     console.log(`📊 Found ${orphanDrugs.length} orphan drugs to process`);
    
//     const processedCount = await OrphanCRLMatch.countDocuments();
//     console.log(`✅ Already processed: ${processedCount}`);
    
//     if (processedCount >= orphanDrugs.length) {
//       console.log('🎉 All orphan drugs already processed!');
//       console.log('   To force reprocessing, delete records from OrphanCRLMatch collection');
//       return;
//     }
    
//     const remaining = orphanDrugs.length - processedCount;
//     console.log(`📋 Remaining to process: ${remaining}`);
//     console.log(`⏰ Estimated time: ${Math.ceil(remaining * 0.5 / 60)} minutes`);
//     console.log('\n🚀 Starting auto-processing...\n');
    
//     const BATCH_SIZE = 100;
//     let totalProcessed = 0;
//     let totalMatches = 0;
//     let drugsWithMatches = 0;
    
//     for (let startFrom = 0; startFrom < orphanDrugs.length; startFrom += BATCH_SIZE) {
//       const endAt = Math.min(startFrom + BATCH_SIZE, orphanDrugs.length);
//       console.log(`\n📦 Processing batch: ${startFrom + 1} to ${endAt}`);
      
//       for (let i = startFrom; i < endAt; i++) {
//         const drug = orphanDrugs[i];
//         const genericName = drug['Generic Name'];
        
//         if (!genericName || genericName.trim() === '') {
//           continue;
//         }
        
//         const existingMatch = await OrphanCRLMatch.findOne({ genericName });
        
//         if (existingMatch) {
//           process.stdout.write(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - SKIP (cached)\r`);
//           if (existingMatch.hasMatches) {
//             drugsWithMatches++;
//             totalMatches += existingMatch.matchCount;
//           }
//           continue;
//         }
        
//         process.stdout.write(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - searching...  \r`);
        
//         try {
//           const matches = await searchDrugInCRLs(
//             genericName, 
//             drug['Sponsor Company']
//           );
          
//           const matchData = {
//             genericName,
//             dateDesignated: drug['Date Designated'],
//             orphanDesignation: drug['Orphan Designation'],
//             orphanDesignationStatus: drug['Orphan Designation Status'],
//             fdaApprovalStatus: drug['FDA Orphan Approval Status'],
//             marketingApprovalDate: drug['Marketing Approval Date'],
//             sponsorCompany: drug['Sponsor Company'],
//             sponsorCountry: drug['Sponsor Country'],
//             crlMatches: matches,
//             hasMatches: matches.length > 0,
//             matchCount: matches.length,
//             lastUpdated: new Date()
//           };
          
//           await OrphanCRLMatch.create(matchData);
//           totalProcessed++;
          
//           if (matches.length > 0) {
//             drugsWithMatches++;
//             totalMatches += matches.length;
//             console.log(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - ✅ ${matches.length} matches`);
//           } else {
//             process.stdout.write(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - ✗ no matches    \r`);
//           }
          
//         } catch (err) {
//           console.log(`[${i + 1}/${orphanDrugs.length}] ${genericName.substring(0, 30).padEnd(30)} - ❌ Error: ${err.message}`);
//         }
        
//         if (totalProcessed % 10 === 0) {
//           await new Promise(r => setTimeout(r, 100));
//         }
//       }
      
//       console.log(`\n📊 Batch complete. Total progress: ${Math.min(endAt, orphanDrugs.length)}/${orphanDrugs.length}`);
//       console.log(`   Drugs with matches so far: ${drugsWithMatches}`);
//       console.log(`   Total CRL matches found: ${totalMatches}`);
//     }
    
//     console.log('\n' + '='.repeat(60));
//     console.log('🎉 AUTO-PROCESSING COMPLETE!');
//     console.log('='.repeat(60));
//     console.log(`📊 FINAL RESULTS:`);
//     console.log(`   Total drugs processed: ${totalProcessed}`);
//     console.log(`   Drugs with CRL matches: ${drugsWithMatches}`);
//     console.log(`   Total CRL matches found: ${totalMatches}`);
//     console.log(`   Match rate: ${((drugsWithMatches / totalProcessed) * 100).toFixed(1)}%`);
//     console.log('\n📈 View results at:');
//     console.log(`   - Statistics: http://localhost:${PORT}/orphan-crl-stats`);
//     console.log(`   - Export Excel: http://localhost:${PORT}/export-orphan-crl-matches`);
//     console.log(`   - View matches: http://localhost:${PORT}/orphan-drugs-with-crls`);
    
//   } catch (err) {
//     console.error('❌ Auto-processing failed:', err);
//   }
// }

// // === API ENDPOINTS ===

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
//       const textHash = generateTextHash(rawText);
//       const ndaNumber = extractNDANumber(rawText);
      
//       res.write(`➡️ Processing letter ${i + 1}${ndaNumber ? ` (NDA ${ndaNumber})` : ''}...\n`);
      
//       const existingLetter = await Letter.findOne({ textHash });
      
//       if (existingLetter) {
//         res.write(`⏭️ Letter already in database (${existingLetter.ndaNumber || 'unknown NDA'}), skipping AI analysis\n\n`);
//         skippedCount++;
//         continue;
//       }
      
//       res.write(`🔍 New letter detected, performing AI analysis...\n`);
      
//       const structured = await extractStructuredLetter(rawText);

//       if (!structured) {
//         res.write(`❌ Could not parse letter ${i + 1}\n\n`);
//         continue;
//       }

//       structured.rawText = rawText;
      
//       const aiEnriched = await enrichLetterWithAI(structured);
//       const fullLetter = { 
//         ...structured, 
//         ...aiEnriched,
//         textHash
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

// app.post('/cross-reference-orphan-drugs', async (req, res) => {
//   res.setHeader('Content-Type', 'text/html; charset=utf-8');
//   res.write(`<style>
//     body { font-family: monospace; white-space: pre-wrap; }
//     .match { color: green; font-weight: bold; }
//     .no-match { color: gray; }
//     .error { color: red; }
//   </style>`);
  
//   try {
//     res.write('📂 Reading orphan drug designations file...\n');
//     const workbook = xlsx.readFile('all_OOPD.xls');
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const orphanDrugs = xlsx.utils.sheet_to_json(sheet);
    
//     res.write(`✅ Found ${orphanDrugs.length} orphan drug designations\n\n`);
    
//     const limit = req.body.limit || 50;
//     const startFrom = req.body.startFrom || 0;
    
//     res.write(`🔍 Processing drugs ${startFrom + 1} to ${Math.min(startFrom + limit, orphanDrugs.length)}...\n\n`);
    
//     let totalMatches = 0;
//     let drugsWithMatches = 0;
    
//     for (let i = startFrom; i < Math.min(startFrom + limit, orphanDrugs.length); i++) {
//       const drug = orphanDrugs[i];
//       const genericName = drug['Generic Name'];
      
//       if (!genericName || genericName.trim() === '') {
//         continue;
//       }
      
//       res.write(`[${i + 1}/${orphanDrugs.length}] Searching for: ${genericName}`);
      
//       try {
//         let existingMatch = await OrphanCRLMatch.findOne({ genericName });
        
//         if (existingMatch && !req.body.forceRefresh) {
//           res.write(` (cached)`);
//         } else {
//           const matches = await searchDrugInCRLs(
//             genericName, 
//             drug['Sponsor Company']
//           );
          
//           const matchData = {
//             genericName,
//             dateDesignated: drug['Date Designated'],
//             orphanDesignation: drug['Orphan Designation'],
//             orphanDesignationStatus: drug['Orphan Designation Status'],
//             fdaApprovalStatus: drug['FDA Orphan Approval Status'],
//             marketingApprovalDate: drug['Marketing Approval Date'],
//             sponsorCompany: drug['Sponsor Company'],
//             sponsorCountry: drug['Sponsor Country'],
//             crlMatches: matches,
//             hasMatches: matches.length > 0,
//             matchCount: matches.length,
//             lastUpdated: new Date()
//           };
          
//           if (existingMatch) {
//             await OrphanCRLMatch.updateOne(
//               { _id: existingMatch._id },
//               matchData
//             );
//           } else {
//             await OrphanCRLMatch.create(matchData);
//           }
          
//           existingMatch = matchData;
//         }
        
//         if (existingMatch.hasMatches) {
//           res.write(` <span class="match">✓ ${existingMatch.matchCount} matches found</span>\n`);
//           drugsWithMatches++;
//           totalMatches += existingMatch.matchCount;
          
//           if (existingMatch.crlMatches[0]) {
//             const topMatch = existingMatch.crlMatches[0];
//             res.write(`   → Best match: ${topMatch.applicationName || topMatch.ndaNumber} (${topMatch.matchType}, score: ${topMatch.matchScore.toFixed(0)})\n`);
//           }
//         } else {
//           res.write(` <span class="no-match">✗ No matches</span>\n`);
//         }
        
//       } catch (err) {
//         res.write(` <span class="error">❌ Error: ${err.message}</span>\n`);
//       }
      
//       if (i % 10 === 0) {
//         await new Promise(r => setTimeout(r, 10));
//       }
//     }
    
//     res.write(`\n${'='.repeat(60)}\n`);
//     res.write(`📊 SUMMARY:\n`);
//     res.write(`   Total drugs processed: ${Math.min(limit, orphanDrugs.length - startFrom)}\n`);
//     res.write(`   Drugs with CRL matches: ${drugsWithMatches}\n`);
//     res.write(`   Total CRL matches found: ${totalMatches}\n`);
//     res.write(`   Match rate: ${((drugsWithMatches / Math.min(limit, orphanDrugs.length - startFrom)) * 100).toFixed(1)}%\n`);
    
//     res.end();
    
//   } catch (err) {
//     console.error('❌ Cross-reference error:', err);
//     res.write(`\n<span class="error">❌ Fatal error: ${err.message}</span>`);
//     res.end();
//   }
// });

// app.get('/check-duplicates', async (req, res) => {
//   try {
//     const pipeline = [
//       { $match: { textHash: { $exists: true } } },
//       { $group: { 
//         _id: '$textHash', 
//         count: { $sum: 1 },
//         letters: { $push: { 
//           id: '$_id', 
//           ndaNumber: '$ndaNumber',
//           applicationName: '$applicationName'
//         }}
//       }},
//       { $match: { count: { $gt: 1 } } }
//     ];
    
//     const duplicates = await Letter.aggregate(pipeline);
    
//     res.json({
//       duplicateGroups: duplicates.length,
//       duplicates: duplicates.map(d => ({
//         hash: d._id,
//         count: d.count,
//         letters: d.letters
//       }))
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// app.get('/orphan-drugs-with-crls', async (req, res) => {
//   try {
//     const matches = await OrphanCRLMatch.find({ hasMatches: true })
//       .sort({ matchCount: -1 })
//       .limit(100);
    
//     res.json({
//       total: matches.length,
//       drugs: matches.map(m => ({
//         drug: m.genericName,
//         company: m.sponsorCompany,
//         designation: m.orphanDesignation,
//         crlCount: m.matchCount,
//         topMatch: m.crlMatches[0] ? {
//           nda: m.crlMatches[0].ndaNumber,
//           application: m.crlMatches[0].applicationName,
//           matchType: m.crlMatches[0].matchType,
//           score: m.crlMatches[0].matchScore
//         } : null
//       }))
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// app.get('/orphan-drug/:name', async (req, res) => {
//   try {
//     const match = await OrphanCRLMatch.findOne({ 
//       genericName: new RegExp(req.params.name, 'i') 
//     });
    
//     if (!match) {
//       return res.status(404).json({ error: 'Drug not found' });
//     }
    
//     res.json(match);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// app.get('/orphan-crl-stats', async (req, res) => {
//   try {
//     const totalOrphans = await OrphanCRLMatch.countDocuments();
//     const withMatches = await OrphanCRLMatch.countDocuments({ hasMatches: true });
    
//     const topMatches = await OrphanCRLMatch.find({ hasMatches: true })
//       .sort({ matchCount: -1 })
//       .limit(10)
//       .select('genericName sponsorCompany matchCount');
    
//     const byCompany = await OrphanCRLMatch.aggregate([
//       { $match: { hasMatches: true } },
//       { $group: {
//         _id: '$sponsorCompany',
//         count: { $sum: 1 },
//         totalMatches: { $sum: '$matchCount' }
//       }},
//       { $sort: { totalMatches: -1 } },
//       { $limit: 10 }
//     ]);
    
//     res.json({
//       summary: {
//         totalOrphanDrugs: totalOrphans,
//         orphansWithCRLs: withMatches,
//         matchRate: totalOrphans > 0 ? ((withMatches / totalOrphans) * 100).toFixed(1) + '%' : '0%'
//       },
//       topDrugsWithMostCRLs: topMatches,
//       topCompaniesByMatches: byCompany
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// app.get('/export-orphan-crl-matches', async (req, res) => {
//   try {
//     const matches = await OrphanCRLMatch.find({ hasMatches: true });
    
//     const csvData = [];
//     for (const match of matches) {
//       for (const crl of match.crlMatches) {
//         csvData.push({
//           'Generic Name': match.genericName,
//           'Orphan Designation': match.orphanDesignation,
//           'Sponsor Company': match.sponsorCompany,
//           'CRL NDA Number': crl.ndaNumber,
//           'CRL Application': crl.applicationName,
//           'CRL Company': crl.company,
//           'Match Type': crl.matchType,
//           'Match Score': crl.matchScore,
//           'CRL Date': crl.date,
//           'CRL Type': crl.letterType
//         });
//       }
//     }
    
//     const ws = xlsx.utils.json_to_sheet(csvData);
//     const wb = xlsx.utils.book_new();
//     xlsx.utils.book_append_sheet(wb, ws, 'Orphan-CRL Matches');
    
//     const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
//     res.setHeader('Content-Disposition', 'attachment; filename="orphan-crl-matches.xlsx"');
//     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//     res.send(buffer);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// app.get('/', (req, res) => {
//   res.send(`
//     <!DOCTYPE html>
//     <html>
//     <head>
//       <title>CRL Analysis Server</title>
//       <style>
//         body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
//         h1 { color: #333; }
//         .endpoint { background: #f4f4f4; padding: 10px; margin: 10px 0; border-radius: 5px; }
//         .method { color: #007bff; font-weight: bold; }
//         code { background: #e9ecef; padding: 2px 4px; border-radius: 3px; }
//       </style>
//     </head>
//     <body>
//       <h1>CRL Analysis Server</h1>
      
//       <h2>PDF Upload</h2>
//       <div class="endpoint">
//         <span class="method">POST</span> <code>/upload</code> - Upload CRL PDFs for processing
//       </div>
      
//       <h2>Orphan Drug Analysis</h2>
//       <div class="endpoint">
//         <span class="method">POST</span> <code>/cross-reference-orphan-drugs</code> - Cross-reference orphan drugs with CRLs
//       </div>
//       <div class="endpoint">
//         <span class="method">GET</span> <code>/orphan-drugs-with-crls</code> - Get all orphan drugs that have CRL matches
//       </div>
//       <div class="endpoint">
//         <span class="method">GET</span> <code>/orphan-drug/:name</code> - Search for specific orphan drug
//       </div>
//       <div class="endpoint">
//         <span class="method">GET</span> <code>/orphan-crl-stats</code> - Get statistics
//       </div>
//       <div class="endpoint">
//         <span class="method">GET</span> <code>/export-orphan-crl-matches</code> - Export results to Excel
//       </div>
      
//       <h2>Utilities</h2>
//       <div class="endpoint">
//         <span class="method">GET</span> <code>/check-duplicates</code> - Check for duplicate letters
//       </div>
//     </body>
//     </html>
//   `);
// });

// // === STARTUP FUNCTIONS ===

// mongoose.connection.once('open', async () => {
//   // await migrateExistingLetters();
//   await new Promise(r => setTimeout(r, 2000));
//   await autoExtractOrphanCRLs();
//   await new Promise(r => setTimeout(r, 1000));
//   // Comment out the line below if you don't want auto-processing
//   // await autoProcessOrphanDrugs();
// });

// app.listen(PORT, () => {
//   console.log(`🚀 Server running at http://localhost:${PORT}`);
//   console.log(`📝 Make sure you have:`);
//   console.log(`   - .env file with MONGO_URI and OPENAI_API_KEY`);
//   console.log(`   - all_OOPD.xls file in the root directory`);
//   console.log(`   - Run: npm install xlsx`);
//   console.log('\n⏳ Connecting to database and starting auto-extraction...');
// });