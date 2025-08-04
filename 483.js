const express = require('express');
const mongoose = require('mongoose');
const pdf = require('pdf-parse');
const axios = require('axios');
const puppeteer = require('puppeteer');
// Add this at the top of your file after other requires
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

// MongoDB connection
const MONGO_URI = 'mongodb+srv://syneticslz:gMN1GUBtevSaw8DE@synetictest.bl3xxux.mongodb.net/?retryWrites=true&w=majority&appName=SyneticTest';

// MongoDB Schema (updated for simplified observations)
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
      title: String,      // First sentence after observation number
      fullText: String    // Complete text of the observation
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



// Configuration for size limits
const SIZE_LIMITS = {
  PDF_SIZE_MB: 5,        // Skip PDFs larger than 5MB
  TEXT_LENGTH: 50000,    // Skip if extracted text > 50,000 characters
  OBSERVATION_COUNT: 20  // Skip if more than 20 observations detected
};

// File to log skipped records
const SKIPPED_RECORDS_FILE = 'skipped_large_records.json';


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
    // Look for common phrases that precede observations in FDA 483s
    const startPhrases = [
      /DURING\s+AN?\s+INSPECTION\s+OF\s+YOUR\s+FIRM/i,
      /I\s+OBSERVED/i,
      /WE\s+OBSERVED/i,
      /\(I\)\s*\(WE\)\s*OBSERVED/i,
      /OBSERVED\s*:/i,
      /INSPECTIONAL\s+OBSERVATIONS/i,
      /^OBSERVATION\s+1\b/i
    ];
    
    for (let i = 0; i < this.lines.length; i++) {
      // Check if any start phrase is found
      if (startPhrases.some(phrase => phrase.test(this.lines[i]))) {
        console.log(`DEBUG: Found observation start phrase at line ${i}: "${this.lines[i].substring(0, 50)}..."`);
        // Look ahead for first observation
        for (let j = i; j < Math.min(i + 20, this.lines.length); j++) {
          if (/^OBSERVATION\s+1\b/i.test(this.lines[j])) {
            console.log(`DEBUG: Found OBSERVATION 1 at line ${j}`);
            return j;
          }
        }
      }
    }
    
    // Fallback: just look for OBSERVATION 1 anywhere
    for (let i = 0; i < this.lines.length; i++) {
      if (/^OBSERVATION\s+1\b/i.test(this.lines[i])) {
        console.log(`DEBUG: Found OBSERVATION 1 (fallback) at line ${i}`);
        return i;
      }
    }
    
    console.log('DEBUG: Could not find observation start');
    return -1;
  }

  // Extract inspection dates with improved logic
  extractInspectionDates() {
    // Method 1: Look for dates pattern near "DATE(S) OF INSPECTION"
    const dateSection = this.extractSection('DATE\\(S\\)\\s*OF\\s*INSPECTION', 'FEI NUMBER');
    
    if (dateSection) {
      // Extract date range pattern (MM/DD/YYYY - MM/DD/YYYY)
      const dateRangePattern = /(\d{1,2}\/\d{1,2}\/\d{4}\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{4})/;
      const match = dateSection.match(dateRangePattern);
      
      if (match) {
        this.confidence.fields.inspectionDates = 1.0;
        return match[1].trim();
      }
    }
    
    // Method 2: Look for DATE(S) OF INSPECTION in first 50 lines
    for (let i = 0; i < Math.min(50, this.lines.length); i++) {
      if (/DATE\(S\)\s*OF\s*INSPECTION/i.test(this.lines[i])) {
        // Check next few lines for date range
        for (let j = i; j < Math.min(i + 5, this.lines.length); j++) {
          const dateMatch = this.lines[j].match(/(\d{1,2}\/\d{1,2}\/\d{4}\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{4})/);
          if (dateMatch) {
            this.confidence.fields.inspectionDates = 0.9;
            return dateMatch[1].trim();
          }
        }
      }
    }
    
    // Method 3: Fallback - search entire document for date ranges
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
    // Method 1: Look for section after "FEI NUMBER"
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
    
    // Method 2: Look for FEI NUMBER pattern anywhere in first 50 lines
    for (let i = 0; i < Math.min(50, this.lines.length); i++) {
      if (/FEI\s*NUMBER/i.test(this.lines[i])) {
        // Check same line first
        const sameLine = this.lines[i].match(/FEI\s*NUMBER\s*:?\s*(\d{7,10})/i);
        if (sameLine) {
          this.confidence.fields.feiNumber = 1.0;
          return sameLine[1];
        }
        
        // Check next few lines
        for (let j = i + 1; j < Math.min(i + 5, this.lines.length); j++) {
          const match = this.lines[j].match(/\b(\d{7,10})\b/);
          if (match) {
            this.confidence.fields.feiNumber = 0.9;
            return match[1];
          }
        }
      }
    }
    
    this.confidence.fields.feiNumber = 0;
    return null;
  }

  // Extract Firm Name with improved logic
  extractFirmName() {
    // Method 1: Look for section after "FIRM NAME" but before "STREET ADDRESS"
    const firmSection = this.extractSection('FIRM NAME', 'STREET ADDRESS');
    
    if (firmSection) {
      // Remove the markers and clean up
      let firmName = firmSection
        .replace(/FIRM\s*NAME\s*:?\s*/i, '')
        .replace(/STREET\s*ADDRESS.*/i, '')
        .replace(/CITY.*$/i, '') // Remove city/state info if on same line
        .trim();
      
      // Clean up common issues
      firmName = firmName.split(/\n/)[0].trim(); // Take only first line
      firmName = firmName.split(/\d{5,}/)[0].trim(); // Remove ZIP codes
      
      if (firmName && firmName.length > 2 && !firmName.match(/^(STREET|CITY|STATE|TYPE)/i)) {
        this.confidence.fields.firmName = 1.0;
        return firmName;
      }
    }
    
    // Method 2: Look for FIRM NAME pattern in first 50 lines
    for (let i = 0; i < Math.min(50, this.lines.length); i++) {
      if (/FIRM\s*NAME/i.test(this.lines[i])) {
        // Check if firm name is on same line
        const sameLine = this.lines[i].replace(/FIRM\s*NAME\s*:?\s*/i, '').trim();
        if (sameLine && sameLine.length > 2 && !sameLine.match(/STREET|ADDRESS/i)) {
          this.confidence.fields.firmName = 1.0;
          return sameLine;
        }
        
        // Check next non-empty line
        for (let j = i + 1; j < Math.min(i + 5, this.lines.length); j++) {
          const line = this.lines[j].trim();
          if (line && !line.match(/^(STREET|ADDRESS|CITY|STATE|TYPE|[0-9])/i)) {
            this.confidence.fields.firmName = 0.9;
            return line;
          }
        }
      }
    }
    
    // Method 3: Look in structured header area
    for (let i = 0; i < Math.min(30, this.lines.length); i++) {
      const line = this.lines[i].trim();
      if ((line.includes('Pharmaceutical') || line.includes('Laboratories') || 
           line.includes('Inc') || line.includes('Ltd') || line.includes('LLC') ||
           line.includes('Corporation') || line.includes('Company')) &&
          !line.includes('FOOD AND DRUG') && !line.includes('FDA') &&
          line.length > 5 && line.length < 100) {
        // Make sure it's not an address line
        if (!line.match(/^\d+\s+\w+/) && !line.match(/STREET|AVENUE|ROAD|DRIVE|SUITE/i)) {
          this.confidence.fields.firmName = 0.8;
          return line;
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

  // Helper method to extract first sentence
  extractFirstSentence(text) {
    // Clean the text first
    const cleanedText = text
      .replace(/\(b\)\s*\(\d+\)/g, '[REDACTED]')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Match first sentence - handles various sentence endings
    const sentenceMatch = cleanedText.match(/^([^.!?]+[.!?])/);
    
    if (sentenceMatch) {
      return sentenceMatch[1].trim();
    }
    
    // If no sentence ending found, take first 200 characters or until newline
    const firstLine = cleanedText.split('\n')[0];
    return firstLine.length > 200 ? firstLine.substring(0, 200) + '...' : firstLine;
  }

  // Extract Observations with simplified approach - just first sentence
  // extractObservations() {
  //   const observations = [];
    
  //   if (this.observationStart === -1) {
  //     console.log('DEBUG: No observation start found');
  //     this.confidence.fields.observations = 0;
  //     return observations;
  //   }

  //   console.log(`DEBUG: Starting observation extraction from line ${this.observationStart}`);
    
  //   // Look for pattern: "OBSERVATION N" at start of line
  //   for (let i = this.observationStart; i < this.lines.length; i++) {
  //     // More flexible pattern to catch variations
  //     const obsMatch = this.lines[i].match(/^\s*OBSERVATION\s+(\d+)\s*(.*)$/i);
      
  //     if (obsMatch) {
  //       const obsNumber = parseInt(obsMatch[1]);
  //       console.log(`DEBUG: Found OBSERVATION ${obsNumber} at line ${i}`);
        
  //       let firstSentence = obsMatch[2].trim(); // Text on same line as OBSERVATION N
        
  //       // If no text on same line, get the next non-empty line
  //       if (!firstSentence) {
  //         let j = i + 1;
  //         while (j < this.lines.length && !this.lines[j].trim()) {
  //           j++;
  //         }
          
  //         if (j < this.lines.length) {
  //           firstSentence = this.lines[j].trim();
  //         }
  //       }
        
  //       // Skip if we still don't have a first sentence
  //       if (!firstSentence) {
  //         console.log(`DEBUG: No text found for OBSERVATION ${obsNumber}, skipping`);
  //         continue;
  //       }
        
  //       // Collect all text until the next observation or end marker
  //       let fullText = firstSentence + '\n';
  //       let k = i + 1;
        
  //       // Skip to start of full text if we already grabbed first sentence
  //       if (!obsMatch[2].trim() && k < this.lines.length && this.lines[k].trim() === firstSentence) {
  //         k++;
  //       }
        
  //       while (k < this.lines.length) {
  //         // Stop if we hit another observation
  //         if (/^\s*OBSERVATION\s+\d+/i.test(this.lines[k])) {
  //           break;
  //         }
  //         // Stop if we hit common end markers
  //         if (/^(EMPLOYEE|INVESTIGATOR|FDA\s+EMPLOYEE|DATE\s+ISSUED)/i.test(this.lines[k])) {
  //           break;
  //         }
  //         fullText += this.lines[k] + '\n';
  //         k++;
  //       }
        
  //       observations.push({
  //         number: obsNumber,
  //         title: firstSentence,
  //         fullText: fullText.replace(/\(b\)\s*\(\d+\)/g, '[REDACTED]').trim()
  //       });
  //     }
  //   }

  //   console.log(`DEBUG: Found ${observations.length} observations`);
    
  //   // Sort by observation number
  //   observations.sort((a, b) => a.number - b.number);
    
  //   this.confidence.fields.observations = observations.length > 0 ? 1.0 : 0;
  //   return observations;
  // }

  extractObservations() {
  const observations = [];
  
  if (this.observationStart === -1) {
    console.log('DEBUG: No observation start found');
    this.confidence.fields.observations = 0;
    return observations;
  }

  console.log(`DEBUG: Starting memory-safe observation extraction from line ${this.observationStart}`);
  
  // Pre-check: if text is very long, limit how much we process
  const MAX_TOTAL_OBSERVATION_CHARS = 20000; // 20KB total limit for all observations
  let totalCharsProcessed = 0;
  
  // Look for pattern: "OBSERVATION N" at start of line
  for (let i = this.observationStart; i < this.lines.length && totalCharsProcessed < MAX_TOTAL_OBSERVATION_CHARS; i++) {
    // More flexible pattern to catch variations
    const obsMatch = this.lines[i].match(/^\s*OBSERVATION\s+(\d+)\s*(.*)$/i);
    
    if (obsMatch) {
      const obsNumber = parseInt(obsMatch[1]);
      console.log(`DEBUG: Found OBSERVATION ${obsNumber} at line ${i}`);
      
      let firstSentence = obsMatch[2].trim(); // Text on same line as OBSERVATION N
      
      // If no text on same line, get the next non-empty line
      if (!firstSentence) {
        let j = i + 1;
        while (j < this.lines.length && !this.lines[j].trim()) {
          j++;
        }
        
        if (j < this.lines.length) {
          firstSentence = this.lines[j].trim();
        }
      }
      
      // Skip if we still don't have a first sentence
      if (!firstSentence) {
        console.log(`DEBUG: No text found for OBSERVATION ${obsNumber}, skipping`);
        continue;
      }
      
      // MEMORY-SAFE: Limit each observation's full text collection
      const MAX_CHARS_PER_OBSERVATION = 2000; // 2KB per observation max
      let fullText = firstSentence + '\n';
      let charCount = firstSentence.length + 1;
      let k = i + 1;
      
      // Skip to start of full text if we already grabbed first sentence
      if (!obsMatch[2].trim() && k < this.lines.length && this.lines[k].trim() === firstSentence) {
        k++;
      }
      
      // Collect text with strict limits
      while (k < this.lines.length && charCount < MAX_CHARS_PER_OBSERVATION) {
        // Stop if we hit another observation
        if (/^\s*OBSERVATION\s+\d+/i.test(this.lines[k])) {
          break;
        }
        // Stop if we hit common end markers
        if (/^(EMPLOYEE|INVESTIGATOR|FDA\s+EMPLOYEE|DATE\s+ISSUED)/i.test(this.lines[k])) {
          break;
        }
        
        const lineLength = this.lines[k].length + 1;
        
        // Check if adding this line would exceed the limit
        if (charCount + lineLength > MAX_CHARS_PER_OBSERVATION) {
          fullText += '[TRUNCATED - Text too long]\n';
          break;
        }
        
        fullText += this.lines[k] + '\n';
        charCount += lineLength;
        k++;
      }
      
      // Track total characters processed
      totalCharsProcessed += charCount;
      
      observations.push({
        number: obsNumber,
        title: firstSentence,
        fullText: fullText.replace(/\(b\)\s*\(\d+\)/g, '[REDACTED]').trim()
      });
      
      // Safety check: if we've processed too many observations, stop
      if (observations.length >= 25) {
        console.log('⚠️ Memory Safety: Limiting to 25 observations to prevent memory issues');
        break;
      }
      
      console.log(`DEBUG: Processed observation ${obsNumber} (${charCount} chars, ${totalCharsProcessed} total)`);
    }
  }

  console.log(`DEBUG: Found ${observations.length} observations (${totalCharsProcessed} total chars)`);
  
  // Sort by observation number
  observations.sort((a, b) => a.number - b.number);
  
  this.confidence.fields.observations = observations.length > 0 ? 1.0 : 0;
  return observations;
}


  // Update deduplicateObservations to work with new structure
  deduplicateObservations(observations) {
    const seen = new Map();
    
    observations.forEach(obs => {
      if (!seen.has(obs.number) || obs.fullText.length > seen.get(obs.number).fullText.length) {
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
    // Method 1: Look for DATE ISSUED section
    const dateSection = this.extractSection('DATE ISSUED', 'FORM FDA');
    
    if (dateSection) {
      const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4})/;
      const match = dateSection.match(datePattern);
      
      if (match) {
        this.confidence.fields.dateIssued = 1.0;
        return match[1];
      }
    }
    
    // Method 2: Look for DATE ISSUED in last 30 lines (often at bottom)
    const bottomLines = this.lines.slice(-30);
    for (let i = 0; i < bottomLines.length; i++) {
      if (/DATE\s*ISSUED/i.test(bottomLines[i])) {
        // Check same line first
        const sameLine = bottomLines[i].match(/DATE\s*ISSUED\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
        if (sameLine) {
          this.confidence.fields.dateIssued = 1.0;
          return sameLine[1];
        }
        
        // Check next few lines
        for (let j = i + 1; j < Math.min(i + 5, bottomLines.length); j++) {
          const dateMatch = bottomLines[j].match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (dateMatch) {
            this.confidence.fields.dateIssued = 0.9;
            return dateMatch[1];
          }
        }
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
// Function to log skipped records
async function logSkippedRecord(record, reason, size = null) {
  const skippedEntry = {
    recordId: record._id,
    legalName: record.Legal_Name,
    feiNumber: record.FEI_Number,
    recordDate: record.Record_Date,
    pdfUrl: record.Download,
    reason: reason,
    size: size,
    skippedAt: new Date().toISOString()
  };

  try {
    let existingSkipped = [];
    try {
      const fileContent = await fs.readFile(SKIPPED_RECORDS_FILE, 'utf8');
      existingSkipped = JSON.parse(fileContent);
    } catch (err) {
      // File doesn't exist yet, start with empty array
    }

    // Check if already logged
    const alreadyLogged = existingSkipped.find(entry => entry.recordId === record._id);
    if (!alreadyLogged) {
      existingSkipped.push(skippedEntry);
      await fs.writeFile(SKIPPED_RECORDS_FILE, JSON.stringify(existingSkipped, null, 2));
      console.log(`📝 Logged skipped record to ${SKIPPED_RECORDS_FILE}`);
    }
  } catch (error) {
    console.error('❌ Error logging skipped record:', error);
  }
}

// Modified processFDA483Record with size checks
async function processFDA483RecordWithSizeCheck(record, useImprovedParser = true) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing record: ${record._id}`);
    console.log(`Legal Name: ${record.Legal_Name}`);
    console.log(`PDF URL: ${record.Download}`);
    
    // Download PDF
    const pdfBuffer = await downloadPDF(record.Download);
    const pdfSizeMB = pdfBuffer.length / (1024 * 1024);
    console.log(`PDF downloaded successfully (${pdfBuffer.length} bytes = ${pdfSizeMB.toFixed(2)}MB)`);
    
    // CHECK 1: PDF Size limit
    if (pdfSizeMB > SIZE_LIMITS.PDF_SIZE_MB) {
      console.log(`⚠️  SKIPPING: PDF too large (${pdfSizeMB.toFixed(2)}MB > ${SIZE_LIMITS.PDF_SIZE_MB}MB limit)`);
      await logSkippedRecord(record, 'PDF_TOO_LARGE', `${pdfSizeMB.toFixed(2)}MB`);
      return { skipped: true, reason: 'PDF_TOO_LARGE', size: pdfSizeMB };
    }
    
    // Extract text
    const extractedText = await extractTextFromPDF(pdfBuffer);
    console.log(`Text extracted successfully (${extractedText.length} characters)`);
    
    // CHECK 2: Text length limit
    if (extractedText.length > SIZE_LIMITS.TEXT_LENGTH) {
      console.log(`⚠️  SKIPPING: Text too long (${extractedText.length} chars > ${SIZE_LIMITS.TEXT_LENGTH} limit)`);
      await logSkippedRecord(record, 'TEXT_TOO_LONG', `${extractedText.length} characters`);
      return { skipped: true, reason: 'TEXT_TOO_LONG', size: extractedText.length };
    }
    
    // CHECK 3: Quick observation count check (before full parsing)
    const observationMatches = extractedText.match(/OBSERVATION\s+\d+/gi);
    const observationCount = observationMatches ? observationMatches.length : 0;
    
    if (observationCount > SIZE_LIMITS.OBSERVATION_COUNT) {
      console.log(`⚠️  SKIPPING: Too many observations (${observationCount} > ${SIZE_LIMITS.OBSERVATION_COUNT} limit)`);
      await logSkippedRecord(record, 'TOO_MANY_OBSERVATIONS', `${observationCount} observations`);
      return { skipped: true, reason: 'TOO_MANY_OBSERVATIONS', size: observationCount };
    }
    
    // CHECK 4: ENHANCED - Check if this is a problematic record pattern
    // Skip records that are likely to cause memory issues based on patterns
    const avgCharsPerObservation = extractedText.length / Math.max(observationCount, 1);
    if (avgCharsPerObservation > 1000 && observationCount > 5) {
      console.log(`⚠️  SKIPPING: High complexity document (${avgCharsPerObservation.toFixed(0)} avg chars/observation)`);
      await logSkippedRecord(record, 'HIGH_COMPLEXITY', `${avgCharsPerObservation.toFixed(0)} chars/obs`);
      return { skipped: true, reason: 'HIGH_COMPLEXITY', size: avgCharsPerObservation };
    }
    
    // CHECK 5: Skip the specific problematic record ID temporarily
    if (record._id === '68837a98c16d6329954344ca') {
      console.log(`⚠️  SKIPPING: Known problematic record (causes memory issues)`);
      await logSkippedRecord(record, 'KNOWN_PROBLEMATIC', 'Memory intensive');
      return { skipped: true, reason: 'KNOWN_PROBLEMATIC', size: 'memory intensive' };
    }
    
    // Proceed with memory-safe parsing if all checks pass
    console.log(`✅ Passed all size checks, proceeding with memory-safe parsing...`);
    
    const parser = new ImprovedFDA483Parser(extractedText);
    const parsedData = parser.parse();
    
    // Clean up immediately after parsing
    parser.originalText = null;
    parser.text = null;
    parser.lines = null;
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Create result object
    const result = {
      _id: record._id,
      originalRecord: record,
      parsedText: extractedText.length > 100000 ? 
        extractedText.substring(0, 100000) + '\n[TRUNCATED]' : 
        extractedText,
      parsedData: parsedData,
      skipped: false
    };
    
    // Enhanced output
    console.log('\n📊 PARSING RESULTS:');
    console.log(`├─ Parser Version: Memory-Safe Enhanced`);
    console.log(`├─ PDF Size: ${pdfSizeMB.toFixed(2)}MB`);
    console.log(`├─ Text Length: ${extractedText.length} characters`);
    console.log(`├─ Observation Count: ${observationCount}`);
    console.log(`├─ Avg Chars/Observation: ${avgCharsPerObservation.toFixed(0)}`);
    console.log(`├─ Confidence Score: ${parsedData.parsingConfidence.overall.toFixed(1)}%`);
    console.log(`├─ Firm Name: ${parsedData.firmName || '❌ Not found'}`);
    console.log(`├─ FEI Number: ${parsedData.feiNumber || '❌ Not found'}`);
    console.log(`├─ Inspection Dates: ${parsedData.inspectionDates || '❌ Not found'}`);
    console.log(`├─ Date Issued: ${parsedData.dateIssued || '❌ Not found'}`);
    console.log(`├─ Total Pages: ${parsedData.totalPages || '❌ Not found'}`);
    console.log(`├─ Observations Found: ${parsedData.observations.length}`);
    console.log(`└─ Investigators Found: ${parsedData.investigators.length}`);
    
    console.log(`\n${'='.repeat(60)}\n`);
    
    return result;
  } catch (error) {
    console.error(`❌ Error processing record ${record._id}:`, error);
    
    // Log as skipped due to error
    await logSkippedRecord(record, 'PROCESSING_ERROR', error.message);
    return { skipped: true, reason: 'PROCESSING_ERROR', error: error.message };
  }
}

// Modified batch processing with skip handling
// Update the batch processing to use the enhanced version
async function startBatchProcessingWithSkips(options = {}) {
  const {
    limit = 10,
    saveToDb = false,
    minConfidence = 70
  } = options;

  try {
    console.log('\n🤖 Starting batch processing with enhanced size checks...');
    console.log(`📊 Parameters: limit=${limit}, saveToDb=${saveToDb}, minConfidence=${minConfidence}%`);
    console.log(`📏 Size Limits: PDF=${SIZE_LIMITS.PDF_SIZE_MB}MB, Text=${SIZE_LIMITS.TEXT_LENGTH} chars, Obs=${SIZE_LIMITS.OBSERVATION_COUNT}`);
    console.log(`🧠 Memory Safety: 2KB/observation, 20KB total, 25 obs max`);
    console.log(`📝 Skipped records will be logged to: ${SKIPPED_RECORDS_FILE}\n`);
    
    const records = await FDA483.find({ parsedText: { $exists: false } }).limit(limit);
    console.log(`📁 Found ${records.length} unprocessed records\n`);
    
    const results = {
      processed: 0,
      successful: 0,
      saved: 0,
      skipped: 0,
      lowConfidence: 0,
      failed: 0,
      avgConfidence: 0,
      skipReasons: {},
      details: []
    };
    
    for (const record of records) {
      const result = await processFDA483RecordWithSizeCheck(record, true);
      results.processed++;
      
      if (result.skipped) {
        results.skipped++;
        
        // Count skip reasons
        if (!results.skipReasons[result.reason]) {
          results.skipReasons[result.reason] = 0;
        }
        results.skipReasons[result.reason]++;
        
        console.log(`⏭️  Skipped record ${record._id}: ${result.reason}`);
        
        results.details.push({
          recordId: record._id,
          skipped: true,
          reason: result.reason,
          size: result.size
        });
        
        continue;
      }
      
      // Handle successful processing
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
        saved: saveToDb && confidence >= minConfidence,
        skipped: false
      });
      
      // Force garbage collection between records
      if (global.gc) {
        global.gc();
      }
      
      // Add small delay to let memory settle
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Calculate average confidence
    if (results.successful > 0) {
      results.avgConfidence = results.avgConfidence / results.successful;
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 ENHANCED BATCH PROCESSING SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Total Records Processed: ${results.processed}`);
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`💾 Saved to DB: ${results.saved}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    console.log(`⚠️  Low Confidence: ${results.lowConfidence}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Average Confidence: ${results.avgConfidence.toFixed(1)}%`);
    
    if (results.skipped > 0) {
      console.log('\n📋 Skip Reasons:');
      Object.entries(results.skipReasons).forEach(([reason, count]) => {
        console.log(`  ${reason}: ${count} records`);
      });
      console.log(`\n📝 All skipped records logged to: ${SKIPPED_RECORDS_FILE}`);
    }
    
    console.log('='.repeat(60) + '\n');
    
    return results;
    
  } catch (error) {
    console.error('❌ Batch processing error:', error);
    throw error;
  }
}

// Function to process only skipped records (for later)
async function processSkippedRecords(options = {}) {
  const {
    saveToDb = false,
    minConfidence = 70,
    memoryLimit = 8192 // Assumes you'll run with --max-old-space-size=8192
  } = options;

  try {
    console.log('\n🔄 Processing previously skipped records...');
    console.log(`⚠️  Make sure to run with: node --max-old-space-size=${memoryLimit} script.js\n`);
    
    // Read skipped records
    const fileContent = await fs.readFile(SKIPPED_RECORDS_FILE, 'utf8');
    const skippedRecords = JSON.parse(fileContent);
    
    console.log(`📁 Found ${skippedRecords.length} skipped records to process\n`);
    
    const results = {
      processed: 0,
      successful: 0,
      saved: 0,
      stillFailed: 0,
      avgConfidence: 0
    };
    
    for (const skippedEntry of skippedRecords) {
      try {
        console.log(`\n🔄 Retrying ${skippedEntry.recordId} (was skipped for: ${skippedEntry.reason})`);
        
        const record = await FDA483.findById(skippedEntry.recordId);
        if (!record) {
          console.log(`❌ Record not found: ${skippedEntry.recordId}`);
          continue;
        }
        
        // Process without size checks (assuming you have more memory now)
        const result = await processFDA483Record(record, true);
        results.processed++;
        results.successful++;
        
        const confidence = result.parsedData.parsingConfidence.overall;
        results.avgConfidence += confidence;
        
        if (confidence >= minConfidence && saveToDb) {
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
          console.log(`✅ Saved previously skipped record with ${confidence.toFixed(1)}% confidence`);
        }
        
      } catch (error) {
        results.stillFailed++;
        console.error(`❌ Still failed: ${skippedEntry.recordId} - ${error.message}`);
      }
    }
    
    if (results.successful > 0) {
      results.avgConfidence = results.avgConfidence / results.successful;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SKIPPED RECORDS PROCESSING SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Total Attempted: ${results.processed}`);
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`💾 Saved: ${results.saved}`);
    console.log(`❌ Still Failed: ${results.stillFailed}`);
    console.log(`📈 Average Confidence: ${results.avgConfidence.toFixed(1)}%`);
    console.log('='.repeat(60) + '\n');
    
    return results;
    
  } catch (error) {
    console.error('❌ Error processing skipped records:', error);
    throw error;
  }
}

// Function to show skipped records summary
async function showSkippedSummary() {
  try {
    const fileContent = await fs.readFile(SKIPPED_RECORDS_FILE, 'utf8');
    const skippedRecords = JSON.parse(fileContent);
    
    console.log('\n📋 SKIPPED RECORDS SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Total Skipped: ${skippedRecords.length}`);
    
    // Group by reason
    const byReason = {};
    skippedRecords.forEach(record => {
      if (!byReason[record.reason]) {
        byReason[record.reason] = [];
      }
      byReason[record.reason].push(record);
    });
    
    Object.entries(byReason).forEach(([reason, records]) => {
      console.log(`\n${reason}: ${records.length} records`);
      records.slice(0, 5).forEach(record => {
        console.log(`  - ${record.recordId} (${record.legalName}) - ${record.size}`);
      });
      if (records.length > 5) {
        console.log(`  ... and ${records.length - 5} more`);
      }
    });
    
    console.log('='.repeat(50) + '\n');
    
  } catch (error) {
    console.log('📝 No skipped records file found or error reading it');
  }
}

// PDF download function
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
    const parser = new ImprovedFDA483Parser(extractedText);
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
    console.log(`├─ Parser Version: Improved (Simplified Observations)`);
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
        console.log(`\n  ${obs.number}. ${obs.title}`);
        // Show if there's more content
        if (obs.fullText.length > obs.title.length) {
          console.log(`     [Full text contains ${obs.fullText.length} characters]`);
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
    
    // Process the record
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
        console.log('First Sentence:', obs.title);
        console.log('\nFull Text:');
        console.log('-'.repeat(50));
        // Wrap long text for better readability
        const wrapped = obs.fullText.match(/.{1,70}(\s|$)/g) || [obs.fullText];
        wrapped.forEach(line => console.log(line.trim()));
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
    
  } catch (error) {
    console.error('❌ Test error:', error);
    throw error;
  }
}

// API Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Process single record
app.get('/process/:recordId', async (req, res) => {
  try {
    const record = await FDA483.findById(req.params.recordId);
    
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    const result = await processFDA483Record(record, true);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Batch processing
async function startBatchProcessing(options = {}) {
  const {
    limit = 10,
    saveToDb = false,
    minConfidence = 70
  } = options;

  try {
    console.log('\n🤖 Starting automated batch processing...');
    console.log(`📊 Parameters: limit=${limit}, saveToDb=${saveToDb}, minConfidence=${minConfidence}%\n`);
    
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
        const result = await processFDA483Record(record, true);
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
// if (require.main === module) {
//   const args = process.argv.slice(2);
//   const command = args[0];
  
//   const printUsage = () => {
//     console.log(`
// FDA 483 Parser - Simplified Observations CLI Usage:
// ==================================================

// Commands:
//   batch [options]           Process multiple records
//   single <recordId>         Process a single record
//   test-real [recordId]      Test with real record (no save)
//   stats                     Show database statistics

// Options for 'batch':
//   --limit <n>          Number of records to process (default: 10)
//   --save               Save results to MongoDB
//   --min-conf <n>       Minimum confidence to save (default: 70)

// Examples:
//   node fda483-parser.js batch --limit 5 --save
//   node fda483-parser.js test-real 669c4a1eccc11f227ba6be49
//   node fda483-parser.js test-real
//   node fda483-parser.js stats
//     `);
//   };
  
//   const runCLI = async () => {
//     try {
//       await mongoose.connect(MONGO_URI);
//       console.log('✅ Connected to MongoDB\n');
      
//       switch (command) {
//         case 'batch': {
//           const limitIndex = args.indexOf('--limit');
//           const limit = limitIndex > -1 ? parseInt(args[limitIndex + 1]) : 10;
//           const saveToDb = args.includes('--save');
//           const minConfIndex = args.indexOf('--min-conf');
//           const minConfidence = minConfIndex > -1 ? parseInt(args[minConfIndex + 1]) : 70;
          
//           await startBatchProcessing({ limit, saveToDb, minConfidence });
//           break;
//         }
        
//         case 'single': {
//           const recordId = args[1];
//           if (!recordId) {
//             console.error('❌ Please provide a record ID');
//             printUsage();
//             break;
//           }
          
//           const record = await FDA483.findById(recordId);
//           if (!record) {
//             console.error('❌ Record not found');
//             break;
//           }
          
//           await processFDA483Record(record, true);
//           break;
//         }
        
//         case 'test-real': {
//           const recordId = args[1];
//           await testRealRecord(recordId);
//           break;
//         }
        
//         case 'stats': {
//           const totalCount = await FDA483.countDocuments();
//           const parsedCount = await FDA483.countDocuments({ parsedText: { $exists: true } });
//           const highConfCount = await FDA483.countDocuments({ 
//             'parsedData.parsingConfidence.overall': { $gte: 70 } 
//           });
          
//           console.log('📊 DATABASE STATISTICS:');
//           console.log('='.repeat(40));
//           console.log(`Total Records: ${totalCount}`);
//           console.log(`Parsed Records: ${parsedCount} (${((parsedCount/totalCount)*100).toFixed(1)}%)`);
//           console.log(`High Confidence (≥70%): ${highConfCount}`);
//           console.log(`Unparsed Records: ${totalCount - parsedCount}`);
//           console.log('='.repeat(40));
//           break;
//         }
        
//         default:
//           printUsage();
//       }
      
//     } catch (error) {
//       console.error('❌ CLI Error:', error);
//     } finally {
//       await mongoose.disconnect();
//       console.log('\n👋 Disconnected from MongoDB');
//     }
//   };
  
//   runCLI();
// }
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const printUsage = () => {
    console.log(`
FDA 483 Parser - With Progress Tracking CLI Usage:
================================================

Processing Commands:
  batch [options]           Process multiple records (original)
  batch-skip [options]      Process records with size checks (skip large ones)
  batch-enhanced [options]  Process with enhanced memory safety
  single <recordId>         Process a single record
  test-real [recordId]      Test with real record (no save)
  process-skipped [options] Process previously skipped records

Progress & Status Commands:
  progress                  Show detailed processing progress
  progress-detailed         Show detailed progress with confidence breakdown
  status                    Quick status summary
  stats                     Show database statistics (existing)
  skipped-summary           Show summary of skipped records

Options for processing commands:
  --limit <n>          Number of records to process (default: 10)
  --save               Save results to MongoDB
  --min-conf <n>       Minimum confidence to save (default: 70)

Examples:
  node fda483-parser.js progress
  node fda483-parser.js status
  node fda483-parser.js progress-detailed
  node fda483-parser.js batch-enhanced --limit 50 --save
  node fda483-parser.js process-skipped --save

Size Limits (configurable at top of file):
  PDF Size: ${SIZE_LIMITS.PDF_SIZE_MB}MB
  Text Length: ${SIZE_LIMITS.TEXT_LENGTH} characters
  Observation Count: ${SIZE_LIMITS.OBSERVATION_COUNT} observations
  `);
};
  

  
// Add this function to your code (after your other functions)

// Progress checker function
async function checkProcessingProgress() {
  try {
    console.log('\n📊 PROCESSING PROGRESS REPORT');
    console.log('='.repeat(50));
    
    // Get counts
    const totalCount = await FDA483.countDocuments();
    const processedCount = await FDA483.countDocuments({ parsedText: { $exists: true } });
    const unprocessedCount = totalCount - processedCount;
    
    // Get high confidence count
    const highConfidenceCount = await FDA483.countDocuments({ 
      'parsedData.parsingConfidence.overall': { $gte: 70 } 
    });
    
    // Get low confidence count
    const lowConfidenceCount = await FDA483.countDocuments({ 
      'parsedData.parsingConfidence.overall': { $lt: 70, $exists: true } 
    });
    
    // Calculate percentages
    const processedPercent = ((processedCount / totalCount) * 100).toFixed(1);
    const unprocessedPercent = ((unprocessedCount / totalCount) * 100).toFixed(1);
    const highConfPercent = totalCount > 0 ? ((highConfidenceCount / totalCount) * 100).toFixed(1) : 0;
    
    // Progress bar
    const progressBarLength = 40;
    const filledLength = Math.floor((processedCount / totalCount) * progressBarLength);
    const progressBar = '█'.repeat(filledLength) + '░'.repeat(progressBarLength - filledLength);
    
    // Display results
    console.log('📈 OVERALL PROGRESS:');
    console.log(`[${progressBar}] ${processedPercent}%`);
    console.log('');
    console.log(`📊 Total Records: ${totalCount.toLocaleString()}`);
    console.log(`✅ Processed: ${processedCount.toLocaleString()} (${processedPercent}%)`);
    console.log(`⏳ Remaining: ${unprocessedCount.toLocaleString()} (${unprocessedPercent}%)`);
    console.log('');
    console.log('🎯 QUALITY BREAKDOWN:');
    console.log(`✅ High Confidence (≥70%): ${highConfidenceCount.toLocaleString()} (${highConfPercent}% of total)`);
    console.log(`⚠️  Low Confidence (<70%): ${lowConfidenceCount.toLocaleString()}`);
    
    // Estimate remaining time (if we have processing history)
    const estimateTime = await estimateRemainingTime(unprocessedCount);
    if (estimateTime) {
      console.log('');
      console.log('⏰ TIME ESTIMATES:');
      console.log(estimateTime);
    }
    
    // Check for skipped records
    await checkSkippedRecords();
    
    console.log('='.repeat(50));
    
    return {
      total: totalCount,
      processed: processedCount,
      remaining: unprocessedCount,
      processedPercent: parseFloat(processedPercent),
      highConfidence: highConfidenceCount,
      lowConfidence: lowConfidenceCount
    };
    
  } catch (error) {
    console.error('❌ Error checking progress:', error);
    throw error;
  }
}

// Estimate remaining processing time
async function estimateRemainingTime(remainingCount) {
  try {
    // Get some recent processing times (if available)
    // This is a simple estimate - you could make it more sophisticated
    const avgProcessingTime = 15; // seconds per record (rough estimate)
    
    if (remainingCount === 0) return null;
    
    const totalSeconds = remainingCount * avgProcessingTime;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    let estimate = '';
    if (hours > 0) {
      estimate += `~${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      estimate += `~${minutes}m`;
    } else {
      estimate += `~${Math.ceil(totalSeconds)}s`;
    }
    
    return `At ~15sec/record: ${estimate} remaining`;
    
  } catch (error) {
    return null;
  }
}

// Check skipped records if file exists
async function checkSkippedRecords() {
  try {
    const fileContent = await fs.readFile(SKIPPED_RECORDS_FILE, 'utf8');
    const skippedRecords = JSON.parse(fileContent);
    
    if (skippedRecords.length > 0) {
      console.log('');
      console.log('⏭️  SKIPPED RECORDS:');
      
      // Group by reason
      const byReason = {};
      skippedRecords.forEach(record => {
        if (!byReason[record.reason]) {
          byReason[record.reason] = 0;
        }
        byReason[record.reason]++;
      });
      
      Object.entries(byReason).forEach(([reason, count]) => {
        console.log(`   ${reason}: ${count} records`);
      });
      
      console.log(`   Total Skipped: ${skippedRecords.length}`);
    }
    
  } catch (error) {
    // No skipped records file or error reading it - that's fine
  }
}

// Detailed progress with breakdown by confidence ranges
async function checkDetailedProgress() {
  try {
    console.log('\n📊 DETAILED PROCESSING PROGRESS');
    console.log('='.repeat(60));
    
    // Get counts
    const totalCount = await FDA483.countDocuments();
    const processedCount = await FDA483.countDocuments({ parsedText: { $exists: true } });
    const unprocessedCount = totalCount - processedCount;
    
    // Confidence breakdowns
    const confidenceRanges = [
      { label: '90-100%', min: 90, max: 100 },
      { label: '80-89%', min: 80, max: 89 },
      { label: '70-79%', min: 70, max: 79 },
      { label: '60-69%', min: 60, max: 69 },
      { label: '50-59%', min: 50, max: 59 },
      { label: '0-49%', min: 0, max: 49 }
    ];
    
    console.log('📈 OVERALL SUMMARY:');
    console.log(`Total FDA 483 Records: ${totalCount.toLocaleString()}`);
    console.log(`Processed: ${processedCount.toLocaleString()}`);
    console.log(`Remaining: ${unprocessedCount.toLocaleString()}`);
    console.log(`Progress: ${((processedCount/totalCount)*100).toFixed(1)}%`);
    
    console.log('\n🎯 CONFIDENCE DISTRIBUTION:');
    
    for (const range of confidenceRanges) {
      const count = await FDA483.countDocuments({
        'parsedData.parsingConfidence.overall': { 
          $gte: range.min, 
          $lte: range.max 
        }
      });
      
      if (count > 0) {
        const percent = ((count / totalCount) * 100).toFixed(1);
        const bar = '█'.repeat(Math.floor(count / totalCount * 20));
        console.log(`${range.label.padEnd(8)} │${bar.padEnd(20)}│ ${count.toLocaleString()} (${percent}%)`);
      }
    }
    
    // Recent processing rate
    console.log('\n📅 RECENT ACTIVITY:');
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentlyProcessed = await FDA483.countDocuments({
      'parsedData': { $exists: true },
      // Add a timestamp field if you want to track when records were processed
    });
    
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error checking detailed progress:', error);
    throw error;
  }
}

// Quick status function - just the essentials
async function quickStatus() {
  try {
    const total = await FDA483.countDocuments();
    const processed = await FDA483.countDocuments({ parsedText: { $exists: true } });
    const remaining = total - processed;
    const percent = ((processed/total)*100).toFixed(1);
    
    console.log(`📊 Quick Status: ${processed.toLocaleString()}/${total.toLocaleString()} (${percent}%) | ${remaining.toLocaleString()} remaining`);
    
    return { total, processed, remaining, percent: parseFloat(percent) };
    
  } catch (error) {
    console.error('❌ Error getting quick status:', error);
    return null;
  }
}

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
          
          await startBatchProcessing({ limit, saveToDb, minConfidence });
          break;
        }
        case 'progress': {
  await checkProcessingProgress();
  break;
}

case 'progress-detailed': {
  await checkDetailedProgress();
  break;
}

case 'status': {
  await quickStatus();
  break;
}

        case 'batch-skip': {
          const limitIndex = args.indexOf('--limit');
          const limit = limitIndex > -1 ? parseInt(args[limitIndex + 1]) : 10;
          const saveToDb = args.includes('--save');
          const minConfIndex = args.indexOf('--min-conf');
          const minConfidence = minConfIndex > -1 ? parseInt(args[minConfIndex + 1]) : 70;
          
          await startBatchProcessingWithSkips({ limit, saveToDb, minConfidence });
          break;
        }
        
        case 'process-skipped': {
          const saveToDb = args.includes('--save');
          const minConfIndex = args.indexOf('--min-conf');
          const minConfidence = minConfIndex > -1 ? parseInt(args[minConfIndex + 1]) : 70;
          
          await processSkippedRecords({ saveToDb, minConfidence });
          break;
        }
        
        case 'skipped-summary': {
          await showSkippedSummary();
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
          const recordId = args[1];
          await testRealRecord(recordId);
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
  const PORT = 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 Process single: http://localhost:${PORT}/process/[recordId]`);
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
