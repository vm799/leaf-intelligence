const express = require('express');
const mongoose = require('mongoose');
const pdf = require('pdf-parse');
const axios = require('axios');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

// MongoDB connection
const MONGO_URI = 'mongodb+srv://syneticslz:gMN1GUBtevSaw8DE@synetictest.bl3xxux.mongodb.net/?retryWrites=true&w=majority&appName=SyneticTest';

// MongoDB Schema (same as before)
const fda483Schema = new mongoose.Schema({
  _id: String,
  Record_Date: Date,
  FEI_Number: String,
  Legal_Name: String,
  Record_Type: String,
  Publish_Date: Date,
  Download: String,
  Record_ID: String,
  parsedText: String,
  parsedData: {
    inspectionDates: String,
    feiNumber: String,
    firmName: String,
    address: {
      street: String,
      city: String,
      state: String,
      zip: String,
      country: String
    },
    typeEstablishment: String,
    recipientName: String,
    recipientTitle: String,
    observations: [{
      number: Number,
      title: String,
      details: String,
      subItems: [{
        letter: String,
        content: String
      }]
    }],
    investigators: [{
      name: String,
      title: String
    }],
    dateIssued: String,
    totalPages: Number,
    parsingConfidence: {
      overall: Number,
      fields: Object
    }
  }
});

const FDA483 = mongoose.connection.useDb('fda_database').model('483s', fda483Schema);

// Improved FDA 483 Parser
class ImprovedFDA483Parser {
  constructor(text) {
    this.originalText = text;
    this.text = this.preprocessText(text);
    this.lines = this.text.split('\n').map(line => line.trim());
    this.confidence = {
      overall: 0,
      fields: {}
    };
    
    // Document structure indicators
    this.documentStart = this.findDocumentStart();
    this.observationStart = this.findObservationStart();
  }

  // Preprocess text to handle redactions and normalize
  preprocessText(text) {
    return text
      // Remove excessive redaction markers at the beginning
      .replace(/^(\s*\(b\)\s*\(\d+\)\s*\n)+/gm, '')
      // Normalize whitespace
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\s{3,}/g, '  ')
      // Fix common OCR issues
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/FEJ/g, 'FEI')
      .replace(/[lI]SSUE[DO]/g, 'ISSUED')
      // Remove page headers/footers that appear mid-content
      .replace(/FORM FDA 483.*?PAGE \d+ OF \d+ PAGES/gi, '')
      .replace(/SEE REVERSE\s*OF THIS PAGE/gi, '');
  }

  // Find where the actual document content begins
  findDocumentStart() {
    const patterns = [
      /DEPARTMENT\s+OF\s+HEALTH/i,
      /FOOD\s+AND\s+DRUG\s+ADMINISTRATION/i,
      /DISTRICT\s+ADDRESS/i
    ];
    
    for (let i = 0; i < this.lines.length; i++) {
      if (patterns.some(p => p.test(this.lines[i]))) {
        return i;
      }
    }
    return 0;
  }

  // Find where observations section begins
  findObservationStart() {
    for (let i = 0; i < this.lines.length; i++) {
      if (/OBSERVATION\s+\d+/i.test(this.lines[i]) || /^\d+\.\s+[A-Z]/i.test(this.lines[i])) {
        return i;
      }
    }
    return -1;
  }

  // Extract inspection dates with improved logic
  extractInspectionDates() {
    // Look for dates pattern near "DATE(S) OF INSPECTION"
    const dateSection = this.extractSection('DATE(S) OF INSPECTION', 'FEI NUMBER');
    
    if (dateSection) {
      // Extract date range pattern (MM/DD/YYYY - MM/DD/YYYY)
      const dateRangePattern = /(\d{1,2}\/\d{1,2}\/\d{4}\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{4})/;
      const match = dateSection.match(dateRangePattern);
      
      if (match) {
        this.confidence.fields.inspectionDates = 1.0;
        return match[1].trim();
      }
    }
    
    // Fallback: search entire document
    const fullMatch = this.text.match(/(\d{1,2}\/\d{1,2}\/\d{4}\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{4})/);
    if (fullMatch) {
      this.confidence.fields.inspectionDates = 0.7;
      return fullMatch[1].trim();
    }
    
    this.confidence.fields.inspectionDates = 0;
    return null;
  }

  // Extract section between two markers
  extractSection(startMarker, endMarker) {
    const startPattern = new RegExp(startMarker, 'i');
    const endPattern = new RegExp(endMarker, 'i');
    
    let startIndex = -1;
    let endIndex = -1;
    
    // Find start
    for (let i = this.documentStart; i < this.lines.length; i++) {
      if (startPattern.test(this.lines[i])) {
        startIndex = i;
        break;
      }
    }
    
    if (startIndex === -1) return null;
    
    // Find end
    for (let i = startIndex + 1; i < this.lines.length && i < startIndex + 10; i++) {
      if (endPattern.test(this.lines[i])) {
        endIndex = i;
        break;
      }
    }
    
    if (endIndex === -1) endIndex = Math.min(startIndex + 5, this.lines.length);
    
    return this.lines.slice(startIndex, endIndex).join(' ');
  }

  // Extract FEI Number with better accuracy
  extractFEINumber() {
    const feiSection = this.extractSection('FEI NUMBER', 'NAME AND TITLE');
    
    if (feiSection) {
      // Look for 7-10 digit number
      const feiPattern = /\b(\d{7,10})\b/;
      const match = feiSection.match(feiPattern);
      
      if (match) {
        this.confidence.fields.feiNumber = 1.0;
        return match[1];
      }
    }
    
    this.confidence.fields.feiNumber = 0;
    return null;
  }

  // Extract Firm Name with improved logic
  extractFirmName() {
    // Look for section after "FIRM NAME" but before "STREET ADDRESS"
    const firmSection = this.extractSection('FIRM NAME', 'STREET ADDRESS');
    
    if (firmSection) {
      // Remove the markers themselves
      let firmName = firmSection
        .replace(/FIRM\s*NAME/i, '')
        .replace(/STREET\s*ADDRESS/i, '')
        .trim();
      
      // Remove any remaining address components
      firmName = firmName.split(/\d{4,}/)[0].trim(); // Remove ZIP codes
      
      if (firmName && firmName.length > 2 && firmName !== 'STREET') {
        this.confidence.fields.firmName = 1.0;
        return firmName;
      }
    }
    
    // Fallback: Look near recipient section
    const recipientArea = this.extractSection('TO:', 'CITY, STATE');
    if (recipientArea) {
      const lines = recipientArea.split('\n');
      for (const line of lines) {
        if (line.includes('Pharmaceutical') || line.includes('Laboratories') || 
            line.includes('Inc') || line.includes('Ltd') || line.includes('LLC')) {
          this.confidence.fields.firmName = 0.8;
          return line.trim();
        }
      }
    }
    
    this.confidence.fields.firmName = 0;
    return null;
  }

  // Extract Address with improved parsing
  extractAddress() {
    const address = {
      street: '',
      city: '',
      state: '',
      zip: '',
      country: 'USA'
    };

    // Find the address section more precisely
    const addressSection = this.extractSection('STREET ADDRESS', 'TYPE ESTABLISHMENT');
    
    if (addressSection) {
      // Extract street (should be right after STREET ADDRESS)
      const streetMatch = addressSection.match(/STREET\s*ADDRESS\s*([^,\n]+?)(?=CITY|$)/i);
      if (streetMatch) {
        address.street = streetMatch[1].trim();
      }
    }

    // Look for city, state, zip pattern
    const cityStateZipPattern = /([^,\n]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/;
    
    // Search in a broader area
    const searchStart = Math.max(0, this.documentStart);
    const searchEnd = this.observationStart > 0 ? this.observationStart : this.lines.length;
    
    for (let i = searchStart; i < searchEnd; i++) {
      const match = this.lines[i].match(cityStateZipPattern);
      if (match) {
        address.city = match[1].trim();
        address.state = match[2];
        address.zip = match[3];
        this.confidence.fields.address = 1.0;
        break;
      }
    }

    // If no address found, mark as low confidence
    if (!address.street && !address.city) {
      this.confidence.fields.address = 0;
    }

    return address;
  }

  // Extract Type of Establishment
  extractTypeEstablishment() {
    const typeSection = this.extractSection('TYPE ESTABLISHMENT INSPECTED', 'DATE ISSUED');
    
    if (typeSection) {
      let type = typeSection
        .replace(/TYPE\s*ESTABLISHMENT\s*INSPECTED/i, '')
        .replace(/DATE\s*ISSUED/i, '')
        .trim();
      
      // Common establishment types
      const validTypes = ['Drug Manufacturer', 'Device Manufacturer', 'Food Facility', 
                         'Pharmaceutical', 'Medical Device', 'Compounding'];
      
      for (const validType of validTypes) {
        if (type.includes(validType)) {
          this.confidence.fields.typeEstablishment = 1.0;
          return validType;
        }
      }
      
      if (type && type.length < 50) {
        this.confidence.fields.typeEstablishment = 0.8;
        return type;
      }
    }
    
    this.confidence.fields.typeEstablishment = 0;
    return null;
  }

  // Extract Recipient with improved parsing
  extractRecipientInfo() {
    const recipientSection = this.extractSection('TO WHOM REPORT ISSUED', 'FIRM NAME');
    
    if (recipientSection) {
      // Look for "TO:" pattern
      const toMatch = recipientSection.match(/TO:\s*([^,\n]+)(?:,\s*([^\n]+))?/i);
      if (toMatch) {
        this.confidence.fields.recipient = 1.0;
        return {
          name: toMatch[1].trim(),
          title: toMatch[2] ? toMatch[2].trim() : ''
        };
      }
    }
    
    this.confidence.fields.recipient = 0;
    return { name: '', title: '' };
  }

  // Extract Observations with improved accuracy
  extractObservations() {
    const observations = [];
    
    if (this.observationStart === -1) {
      this.confidence.fields.observations = 0;
      return observations;
    }

    // Extract observation section only
    const obsText = this.lines.slice(this.observationStart).join('\n');
    
    // Pattern to match observations
    const obsPattern = /(?:OBSERVATION\s*)?(\d+)[\s\.]+(.*?)(?=(?:OBSERVATION\s*)?\d+[\s\.]|EMPLOYEE\(S\)|DATE\s*ISSUED|$)/gsi;
    
    let match;
    while ((match = obsPattern.exec(obsText)) !== null) {
      const obsNumber = parseInt(match[1]);
      const obsContent = match[2].trim();
      
      if (obsNumber && obsContent.length > 20) {
        const observation = this.parseObservationContent(obsNumber, obsContent);
        observations.push(observation);
      }
    }

    // Remove duplicates and sort
    const uniqueObs = this.deduplicateObservations(observations);
    
    this.confidence.fields.observations = uniqueObs.length > 0 ? 1.0 : 0;
    return uniqueObs;
  }

  // Parse individual observation content
  parseObservationContent(number, content) {
    // Clean the content
    content = content
      .replace(/\(b\)\s*\(\d+\)/g, '[REDACTED]')
      .replace(/SEE REVERSE.*$/i, '')
      .replace(/FORM FDA.*$/i, '')
      .replace(/PAGE \d+ OF \d+.*$/i, '');

    // Extract title (first sentence)
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    const title = sentences[0] ? sentences[0].trim() : content.substring(0, 200);

    // Extract sub-items
    const subItems = [];
    const subItemMatches = content.matchAll(/([A-E])\.\s*([^A-E]+?)(?=[A-E]\.|$)/gs);
    
    for (const subMatch of subItemMatches) {
      const letter = subMatch[1];
      const subContent = subMatch[2].trim()
        .replace(/\s+/g, ' ')
        .substring(0, 500);
      
      if (subContent.length > 10) {
        subItems.push({ letter, content: subContent });
      }
    }

    // Get details (main content without sub-items)
    let details = content;
    if (subItems.length > 0) {
      // Remove sub-items from details
      const firstSubIndex = content.search(/[A-E]\.\s*/);
      if (firstSubIndex > 0) {
        details = content.substring(0, firstSubIndex).trim();
      }
    }

    return {
      number,
      title: title.substring(0, 300),
      details: details.substring(0, 1000),
      subItems
    };
  }

  // Deduplicate observations
  deduplicateObservations(observations) {
    const seen = new Map();
    
    observations.forEach(obs => {
      if (!seen.has(obs.number) || obs.title.length > seen.get(obs.number).title.length) {
        seen.set(obs.number, obs);
      }
    });
    
    return Array.from(seen.values()).sort((a, b) => a.number - b.number);
  }

  // Extract investigators with better parsing
  extractInvestigators() {
    const investigators = [];
    
    // Look for investigator section near the end
    const endSection = this.lines.slice(-50).join('\n');
    
    // Multiple patterns for investigators
    const patterns = [
      /([A-Za-z\s\-\.]+),\s*((?:Investigator|Inspector|CSO|Compliance\s*Officer)[^\n]*)/gi,
      /([A-Za-z\s\-\.]+)\s*,?\s*FDA\s*(Investigator|Inspector)/gi,
      /EMPLOYEE\(S\)\s*SIGNATURE[^\n]*\n([^\n]+)/i
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(endSection)) !== null) {
        const name = match[1].trim();
        const title = match[2] ? match[2].trim() : 'Investigator';
        
        // Validate name
        if (this.isValidName(name)) {
          investigators.push({ name, title });
        }
      }
    });

    // Deduplicate
    const unique = this.deduplicateInvestigators(investigators);
    
    this.confidence.fields.investigators = unique.length > 0 ? 1.0 : 0;
    return unique;
  }

  // Validate investigator name
  isValidName(name) {
    // Check if it's a valid name
    if (!name || name.length < 3 || name.length > 50) return false;
    if (name.match(/\d{3,}/)) return false; // No long numbers
    if (name.split(/\s+/).length > 5) return false; // Not too many words
    if (!/[a-zA-Z]/.test(name)) return false; // Must have letters
    
    // Exclude common false positives
    const excludePatterns = ['PAGE', 'FORM', 'FDA', 'OBSERVATION', 'DATE'];
    for (const exclude of excludePatterns) {
      if (name.includes(exclude)) return false;
    }
    
    return true;
  }

  // Deduplicate investigators
  deduplicateInvestigators(investigators) {
    const seen = new Map();
    
    investigators.forEach(inv => {
      const key = inv.name.toLowerCase().replace(/[^a-z]/g, '');
      if (!seen.has(key)) {
        seen.set(key, inv);
      }
    });
    
    return Array.from(seen.values());
  }

  // Extract date issued
  extractDateIssued() {
    const dateSection = this.extractSection('DATE ISSUED', 'FORM FDA');
    
    if (dateSection) {
      const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4})/;
      const match = dateSection.match(datePattern);
      
      if (match) {
        this.confidence.fields.dateIssued = 1.0;
        return match[1];
      }
    }
    
    this.confidence.fields.dateIssued = 0;
    return null;
  }

  // Extract total pages
  extractTotalPages() {
    const pagePattern = /PAGE\s*\d+\s*OF\s*(\d+)\s*PAGES?/gi;
    const matches = [...this.text.matchAll(pagePattern)];
    
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const totalPages = parseInt(lastMatch[1]);
      
      if (totalPages > 0 && totalPages < 100) {
        this.confidence.fields.totalPages = 1.0;
        return totalPages;
      }
    }
    
    this.confidence.fields.totalPages = 0;
    return null;
  }

  // Calculate overall confidence with weighted scoring
  calculateConfidence() {
    const weights = {
      firmName: 0.15,
      feiNumber: 0.15,
      inspectionDates: 0.10,
      observations: 0.25,
      address: 0.10,
      investigators: 0.10,
      dateIssued: 0.05,
      typeEstablishment: 0.05,
      recipient: 0.03,
      totalPages: 0.02
    };

    let weightedSum = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([field, weight]) => {
      if (this.confidence.fields[field] !== undefined) {
        weightedSum += this.confidence.fields[field] * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
  }

  // Main parse method
  parse() {
    const recipientInfo = this.extractRecipientInfo();
    
    const parsedData = {
      inspectionDates: this.extractInspectionDates(),
      feiNumber: this.extractFEINumber(),
      firmName: this.extractFirmName(),
      address: this.extractAddress(),
      typeEstablishment: this.extractTypeEstablishment(),
      recipientName: recipientInfo.name,
      recipientTitle: recipientInfo.title,
      observations: this.extractObservations(),
      investigators: this.extractInvestigators(),
      dateIssued: this.extractDateIssued(),
      totalPages: this.extractTotalPages(),
      parsingConfidence: {
        overall: 0,
        fields: { ...this.confidence.fields }
      }
    };

    // Calculate overall confidence
    parsedData.parsingConfidence.overall = this.calculateConfidence();

    return parsedData;
  }
}

// PDF download function (same as before)
async function downloadPDF(url, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Downloading PDF (attempt ${attempt}/${maxRetries}): ${url}`);
      
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      return Buffer.from(response.data);
    } catch (error) {
      lastError = error;
      console.log(`Axios attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        console.log('Falling back to Puppeteer...');
        const browser = await puppeteer.launch({ 
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
          const page = await browser.newPage();
          await page.goto(url, { 
            waitUntil: 'networkidle0',
            timeout: 60000 
          });
          
          const pdfBuffer = await page.pdf();
          return pdfBuffer;
        } finally {
          await browser.close();
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
  
  throw lastError;
}

// Extract text from PDF
async function extractTextFromPDF(pdfBuffer) {
  try {
    const data = await pdf(pdfBuffer, {
      max: 0,
      version: 'v2.0.550'
    });
    
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
}

// Main processing function
async function processFDA483Record(record, useImprovedParser = true) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing record: ${record._id}`);
    console.log(`Legal Name: ${record.Legal_Name}`);
    console.log(`PDF URL: ${record.Download}`);
    
    // Download PDF
    const pdfBuffer = await downloadPDF(record.Download);
    console.log(`PDF downloaded successfully (${pdfBuffer.length} bytes)`);
    
    // Extract text
    const extractedText = await extractTextFromPDF(pdfBuffer);
    console.log(`Text extracted successfully (${extractedText.length} characters)`);
    
    // Parse the text
    const Parser = useImprovedParser ? ImprovedFDA483Parser : FDA483Parser;
    const parser = new Parser(extractedText);
    const parsedData = parser.parse();
    
    // Create result object
    const result = {
      _id: record._id,
      originalRecord: record,
      parsedText: extractedText,
      parsedData: parsedData
    };
    
    // Enhanced output
    console.log('\n📊 PARSING RESULTS:');
    console.log(`├─ Parser Version: ${useImprovedParser ? 'Improved' : 'Original'}`);
    console.log(`├─ Confidence Score: ${parsedData.parsingConfidence.overall.toFixed(1)}%`);
    console.log(`├─ Firm Name: ${parsedData.firmName || '❌ Not found'}`);
    console.log(`├─ FEI Number: ${parsedData.feiNumber || '❌ Not found'}`);
    console.log(`├─ Inspection Dates: ${parsedData.inspectionDates || '❌ Not found'}`);
    console.log(`├─ Date Issued: ${parsedData.dateIssued || '❌ Not found'}`);
    console.log(`├─ Total Pages: ${parsedData.totalPages || '❌ Not found'}`);
    console.log(`├─ Observations Found: ${parsedData.observations.length}`);
    console.log(`└─ Investigators Found: ${parsedData.investigators.length}`);
    
    // Show field-level confidence
    console.log('\n📈 Field Confidence:');
    Object.entries(parsedData.parsingConfidence.fields).forEach(([field, conf]) => {
      const icon = conf >= 0.8 ? '✅' : conf >= 0.5 ? '🟡' : '❌';
      console.log(`  ${icon} ${field}: ${(conf * 100).toFixed(0)}%`);
    });
    
    // Display observations summary
    if (parsedData.observations.length > 0) {
      console.log('\n📋 OBSERVATIONS:');
      parsedData.observations.forEach(obs => {
        console.log(`\n  ${obs.number}. ${obs.title.substring(0, 100)}...`);
        if (obs.subItems.length > 0) {
          console.log(`     Sub-items: ${obs.subItems.length} (${obs.subItems.map(s => s.letter).join(', ')})`);
        }
      });
    }
    
    console.log(`\n${'='.repeat(60)}\n`);
    
    return result;
  } catch (error) {
    console.error(`❌ Error processing record ${record._id}:`, error);
    throw error;
  }
}

// Test function for real records
async function testRealRecord(recordId, compareVersions = false) {
  try {
    console.log('\n🧪 TEST MODE - Processing real record without saving to database\n');
    
    let record;
    if (recordId) {
      record = await FDA483.findById(recordId);
      if (!record) {
        console.error('❌ Record not found with ID:', recordId);
        return null;
      }
    } else {
      const unparsedRecords = await FDA483.find({ parsedText: { $exists: false } }).limit(5);
      if (unparsedRecords.length === 0) {
        console.error('❌ No unparsed records found');
        return null;
      }
      record = unparsedRecords[Math.floor(Math.random() * unparsedRecords.length)];
      console.log('📌 Selected random unparsed record:', record._id);
    }
    
    console.log('\n📄 ORIGINAL RECORD INFO:');
    console.log('='.repeat(50));
    console.log(`ID: ${record._id}`);
    console.log(`Legal Name: ${record.Legal_Name}`);
    console.log(`FEI Number: ${record.FEI_Number}`);
    console.log(`Record Date: ${record.Record_Date}`);
    console.log(`PDF URL: ${record.Download}`);
    console.log('='.repeat(50));
    
    if (compareVersions) {
      console.log('\n⚖️  COMPARING PARSER VERSIONS...\n');
      
      // Process with improved parser
      console.log('🔵 IMPROVED PARSER:');
      const improvedResult = await processFDA483Record(record, true);
      
      // Process with original parser
      console.log('\n🔴 ORIGINAL PARSER:');
      const originalResult = await processFDA483Record(record, false);
      
      // Compare results
      console.log('\n📊 COMPARISON SUMMARY:');
      console.log('='.repeat(50));
      console.log('Field                 | Original        | Improved');
      console.log('-'.repeat(50));
      
      const fields = ['firmName', 'feiNumber', 'inspectionDates', 'typeEstablishment'];
      fields.forEach(field => {
        const orig = originalResult.parsedData[field] || 'Not found';
        const impr = improvedResult.parsedData[field] || 'Not found';
        console.log(`${field.padEnd(20)} | ${String(orig).substring(0, 15).padEnd(15)} | ${String(impr).substring(0, 15)}`);
      });
      
      console.log(`${'observations'.padEnd(20)} | ${originalResult.parsedData.observations.length} found        | ${improvedResult.parsedData.observations.length} found`);
      console.log(`${'confidence'.padEnd(20)} | ${originalResult.parsedData.parsingConfidence.overall.toFixed(1)}%           | ${improvedResult.parsedData.parsingConfidence.overall.toFixed(1)}%`);
      console.log('='.repeat(50));
      
      return { improved: improvedResult, original: originalResult };
    } else {
      // Just use improved parser
      const result = await processFDA483Record(record, true);
      
      // Display detailed results
      console.log('\n🔍 DETAILED PARSING RESULTS:');
      console.log('='.repeat(70));
      
      // Basic Info
      console.log('\n📋 BASIC INFORMATION:');
      console.log(`Firm Name: ${result.parsedData.firmName || '❌ Not found'}`);
      console.log(`FEI Number: ${result.parsedData.feiNumber || '❌ Not found'}`);
      console.log(`Inspection Dates: ${result.parsedData.inspectionDates || '❌ Not found'}`);
      console.log(`Date Issued: ${result.parsedData.dateIssued || '❌ Not found'}`);
console.log(`Type of Establishment: ${result.parsedData.typeEstablishment || '❌ Not found'}`);
      console.log(`Total Pages: ${result.parsedData.totalPages || '❌ Not found'}`);
      
      // Address
      console.log('\n📍 ADDRESS:');
      if (result.parsedData.address.street) {
        console.log(`Street: ${result.parsedData.address.street}`);
        console.log(`City: ${result.parsedData.address.city}`);
        console.log(`State: ${result.parsedData.address.state}`);
        console.log(`ZIP: ${result.parsedData.address.zip}`);
        console.log(`Country: ${result.parsedData.address.country}`);
      } else {
        console.log('❌ Address not found');
      }
      
      // Recipient
      console.log('\n👤 RECIPIENT:');
      if (result.parsedData.recipientName) {
        console.log(`Name: ${result.parsedData.recipientName}`);
        console.log(`Title: ${result.parsedData.recipientTitle}`);
      } else {
        console.log('❌ Recipient information not found');
      }
      
      // Investigators
      console.log('\n👥 INVESTIGATORS:');
      if (result.parsedData.investigators.length > 0) {
        result.parsedData.investigators.forEach((inv, i) => {
          console.log(`${i + 1}. ${inv.name}, ${inv.title}`);
        });
      } else {
        console.log('❌ No investigators found');
      }
      
      // Observations - Full Details
      console.log('\n📝 OBSERVATIONS (Full Details):');
      console.log('-'.repeat(70));
      if (result.parsedData.observations.length > 0) {
        result.parsedData.observations.forEach(obs => {
          console.log(`\nOBSERVATION ${obs.number}`);
          console.log('Title:', obs.title);
          if (obs.details && obs.details !== obs.title) {
            console.log('Details:', obs.details);
          }
          if (obs.subItems.length > 0) {
            console.log('Sub-items:');
            obs.subItems.forEach(item => {
              console.log(`  ${item.letter}. ${item.content}`);
            });
          }
          console.log('-'.repeat(50));
        });
      } else {
        console.log('❌ No observations found');
      }
      
      // Confidence Analysis
      console.log('\n📊 CONFIDENCE ANALYSIS:');
      console.log(`Overall Confidence: ${result.parsedData.parsingConfidence.overall.toFixed(1)}%`);
      console.log('\nField-by-field confidence:');
      Object.entries(result.parsedData.parsingConfidence.fields).forEach(([field, conf]) => {
        const percentage = (conf * 100).toFixed(0);
        const bar = '█'.repeat(Math.floor(conf * 20)) + '░'.repeat(20 - Math.floor(conf * 20));
        const icon = conf >= 0.8 ? '✅' : conf >= 0.5 ? '🟡' : '❌';
        console.log(`  ${icon} ${field.padEnd(20)} [${bar}] ${percentage}%`);
      });
      
      // Save decision
      console.log('\n💾 SAVE DECISION:');
      if (result.parsedData.parsingConfidence.overall >= 70) {
        console.log('✅ This record would be SAVED (confidence >= 70%)');
      } else {
        console.log('⚠️  This record would NOT be saved (confidence < 70%)');
        console.log('   Recommendation: Manual review required');
      }
      
      console.log('\n🏁 TEST COMPLETE - No data was saved to the database\n');
      
      return result;
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
    throw error;
  }
}

// API Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Process single record with parser selection
app.get('/process/:recordId', async (req, res) => {
  try {
    const useImproved = req.query.parser !== 'original';
    const record = await FDA483.findById(req.params.recordId);
    
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    const result = await processFDA483Record(record, useImproved);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compare parsers endpoint
app.get('/compare/:recordId', async (req, res) => {
  try {
    const record = await FDA483.findById(req.params.recordId);
    
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    const improvedResult = await processFDA483Record(record, true);
    const originalResult = await processFDA483Record(record, false);
    
    res.json({
      recordId: record._id,
      comparison: {
        improved: {
          confidence: improvedResult.parsedData.parsingConfidence.overall,
          firmName: improvedResult.parsedData.firmName,
          observationCount: improvedResult.parsedData.observations.length
        },
        original: {
          confidence: originalResult.parsedData.parsingConfidence.overall,
          firmName: originalResult.parsedData.firmName,
          observationCount: originalResult.parsedData.observations.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Batch processing with improved parser
async function startBatchProcessing(options = {}) {
  const {
    limit = 10,
    saveToDb = false,
    minConfidence = 70,
    useImproved = true
  } = options;

  try {
    console.log('\n🤖 Starting automated batch processing...');
    console.log(`📊 Parameters: limit=${limit}, saveToDb=${saveToDb}, minConfidence=${minConfidence}%, parser=${useImproved ? 'improved' : 'original'}\n`);
    
    const records = await FDA483.find({ parsedText: { $exists: false } }).limit(limit);
    console.log(`📁 Found ${records.length} unprocessed records\n`);
    
    const results = {
      processed: 0,
      successful: 0,
      saved: 0,
      lowConfidence: 0,
      failed: 0,
      avgConfidence: 0,
      details: []
    };
    
    for (const record of records) {
      try {
        const result = await processFDA483Record(record, useImproved);
        results.processed++;
        results.successful++;
        
        const confidence = result.parsedData.parsingConfidence.overall;
        results.avgConfidence += confidence;
        
        if (confidence >= minConfidence) {
          if (saveToDb) {
            await FDA483.updateOne(
              { _id: record._id },
              { 
                $set: { 
                  parsedText: result.parsedText,
                  parsedData: result.parsedData
                }
              }
            );
            results.saved++;
            console.log(`✅ Saved record ${record._id} with ${confidence.toFixed(1)}% confidence`);
          }
        } else {
          results.lowConfidence++;
          console.log(`⚠️  Low confidence (${confidence.toFixed(1)}%) for record ${record._id}`);
        }
        
        results.details.push({
          recordId: record._id,
          firmName: result.parsedData.firmName,
          confidence: confidence,
          observations: result.parsedData.observations.length,
          saved: saveToDb && confidence >= minConfidence
        });
        
      } catch (error) {
        results.failed++;
        console.error(`❌ Failed to process ${record._id}: ${error.message}`);
        results.details.push({
          recordId: record._id,
          error: error.message
        });
      }
    }
    
    // Calculate average confidence
    if (results.successful > 0) {
      results.avgConfidence = results.avgConfidence / results.successful;
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 BATCH PROCESSING SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Total Records Processed: ${results.processed}`);
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`💾 Saved to DB: ${results.saved}`);
    console.log(`⚠️  Low Confidence: ${results.lowConfidence}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Average Confidence: ${results.avgConfidence.toFixed(1)}%`);
    console.log('='.repeat(60) + '\n');
    
    return results;
    
  } catch (error) {
    console.error('❌ Batch processing error:', error);
    throw error;
  }
}

// CLI Entry Point
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const printUsage = () => {
    console.log(`
FDA 483 Parser - Improved CLI Usage:
====================================

Commands:
  batch [options]           Process multiple records
  single <recordId>         Process a single record
  test-real [recordId]      Test with real record (no save)
  compare [recordId]        Compare original vs improved parser
  stats                     Show database statistics

Options for 'batch':
  --limit <n>          Number of records to process (default: 10)
  --save               Save results to MongoDB
  --min-conf <n>       Minimum confidence to save (default: 70)
  --parser <type>      Use 'improved' or 'original' (default: improved)

Options for 'test-real':
  --compare            Compare both parser versions

Examples:
  node fda483-parser.js batch --limit 5 --save --parser improved
  node fda483-parser.js test-real 669c4a1eccc11f227ba6be49
  node fda483-parser.js test-real --compare
  node fda483-parser.js compare 669c4a1eccc11f227ba6be49
    `);
  };
  
  const runCLI = async () => {
    try {
      await mongoose.connect(MONGO_URI);
      console.log('✅ Connected to MongoDB\n');
      
      switch (command) {
        case 'batch': {
          const limitIndex = args.indexOf('--limit');
          const limit = limitIndex > -1 ? parseInt(args[limitIndex + 1]) : 10;
          const saveToDb = args.includes('--save');
          const minConfIndex = args.indexOf('--min-conf');
          const minConfidence = minConfIndex > -1 ? parseInt(args[minConfIndex + 1]) : 70;
          const parserIndex = args.indexOf('--parser');
          const useImproved = parserIndex > -1 ? args[parserIndex + 1] === 'improved' : true;
          
          await startBatchProcessing({ limit, saveToDb, minConfidence, useImproved });
          break;
        }
        
        case 'single': {
          const recordId = args[1];
          if (!recordId) {
            console.error('❌ Please provide a record ID');
            printUsage();
            break;
          }
          
          const record = await FDA483.findById(recordId);
          if (!record) {
            console.error('❌ Record not found');
            break;
          }
          
          await processFDA483Record(record, true);
          break;
        }
        
        case 'test-real': {
          const recordId = args[1] === '--compare' ? null : args[1];
          const compareVersions = args.includes('--compare');
          await testRealRecord(recordId, compareVersions);
          break;
        }
        
        case 'compare': {
          const recordId = args[1];
          if (!recordId) {
            // Get random record
            const records = await FDA483.find({ parsedText: { $exists: false } }).limit(1);
            if (records.length === 0) {
              console.error('❌ No unparsed records found');
              break;
            }
            await testRealRecord(records[0]._id, true);
          } else {
            await testRealRecord(recordId, true);
          }
          break;
        }
        
        case 'stats': {
          const totalCount = await FDA483.countDocuments();
          const parsedCount = await FDA483.countDocuments({ parsedText: { $exists: true } });
          const highConfCount = await FDA483.countDocuments({ 
            'parsedData.parsingConfidence.overall': { $gte: 70 } 
          });
          
          console.log('📊 DATABASE STATISTICS:');
          console.log('='.repeat(40));
          console.log(`Total Records: ${totalCount}`);
          console.log(`Parsed Records: ${parsedCount} (${((parsedCount/totalCount)*100).toFixed(1)}%)`);
          console.log(`High Confidence (≥70%): ${highConfCount}`);
          console.log(`Unparsed Records: ${totalCount - parsedCount}`);
          console.log('='.repeat(40));
          break;
        }
        
        default:
          printUsage();
      }
      
    } catch (error) {
      console.error('❌ CLI Error:', error);
    } finally {
      await mongoose.disconnect();
      console.log('\n👋 Disconnected from MongoDB');
    }
  };
  
  runCLI();
}

// Connect to MongoDB and start server
mongoose.connect(MONGO_URI)
.then(() => {
  console.log('✅ Connected to MongoDB');
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 Compare parsers: http://localhost:${PORT}/compare/[recordId]`);
  });
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Export for testing
module.exports = { 
  ImprovedFDA483Parser,
  processFDA483Record,
  startBatchProcessing,
  downloadPDF,
  extractTextFromPDF,
  testRealRecord
};