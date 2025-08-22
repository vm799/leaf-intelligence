// server.js - Complete Pharmaceutical Label Intelligence Backend
const express = require('express');
// const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cheerio = require('cheerio');
const xml2js = require('xml2js');
const crypto = require('crypto');
// const app = express();
// const port = 3000;
const stream = require('stream');
const util = require('util');
const router = express.Router();
// 
// app.use(express.json({ limit: '100mb' }));
// app.use(express.urlencoded({ limit: '100mb', extended: true }));
// Middleware
// app.use(cors());
// app.use(express.jsomncoded({ limit: '100mb', extended: true }));
// File upload configuration
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Create uploads directory if it doesn't exist
const ensureUploadsDir = async () => {
    try {
        await fs.mkdir('uploads', { recursive: true });
    } catch (error) {
        console.error('Error creating uploads directory:', error);
    }
};
ensureUploadsDir();

// API configurations
const APIs = {
    DRUGS_FDA: 'https://api.fda.gov/drug/drugsfda.json',
    DAILYMED: 'https://dailymed.nlm.nih.gov/dailymed',
    RXNORM: 'https://rxnav.nlm.nih.gov/REST',
    OPEN_FDA: 'https://api.fda.gov',
    NDC: 'https://api.fda.gov/drug/ndc.json',
    LABEL: 'https://api.fda.gov/drug/label.json'
};

// In-memory cache
const cache = new Map();
const CACHE_DURATION = 3600000; // 1 hour

// Cache helpers
function getCached(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}
const uploadedLabelsStore = new Map();
const uploadedLabelsStorage = new Map();


// ============================================
// ENHANCED LABEL FETCHING FROM FDA/DAILYMED
// ============================================
const pipeline = util.promisify(stream.pipeline);

class EnhancedSPLFetcher {
    constructor() {
        this.xmlParser = new xml2js.Parser({
            explicitArray: false,
            ignoreAttrs: false,
            mergeAttrs: false,
            normalize: true,
            normalizeTags: true,
            strict: false,
            trim: true,
            tagNameProcessors: [xml2js.processors.stripPrefix],
            attrNameProcessors: [xml2js.processors.stripPrefix]
        });
    }

    // Enhanced fetch function with streaming support for large files
    async fetchEnhancedLabelContent(labelId) {
        try {
            // Clean the label ID (remove 'label_' prefix if present)
            const cleanLabelId = labelId.replace(/^label_/, '');
            console.log(`📄 Fetching enhanced content for label: ${cleanLabelId}`);
            
            // Try different strategies
            const strategies = [
                () => this.fetchWithStreaming(cleanLabelId),
                () => this.fetchWithChunking(cleanLabelId),
                () => this.fetchDirectDownload(cleanLabelId),
                () => this.fetchFromFDAAPI(cleanLabelId)
            ];
            
            for (const strategy of strategies) {
                try {
                    const result = await strategy();
                    if (result && result.sections && Object.keys(result.sections).length > 0) {
                        console.log(`✅ Successfully parsed ${Object.keys(result.sections).length} sections`);
                        return result;
                    }
                } catch (error) {
                    console.log(`⚠️ Strategy failed: ${error.message}`);
                    continue;
                }
            }
            
            // If all strategies fail, return minimal data
            console.log(`❌ All strategies failed for ${cleanLabelId}`);
            return this.getMinimalLabelData(cleanLabelId);
            
        } catch (error) {
            console.error(`Failed to fetch label: ${labelId}`, error.message);
            return null;
        }
    }

    // Strategy 1: Fetch with streaming to handle large files
    // async fetchWithStreaming(labelId) {
    //     console.log(`🔍 Trying streaming approach for ${labelId}`);
        
    //     const url = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${labelId}.xml`;
        
    //     const response = await axios({
    //         method: 'GET',
    //         url: url,
    //         responseType: 'stream',
    //         timeout: 60000,
    //         maxContentLength: Infinity,
    //         maxBodyLength: Infinity,
    //         headers: {
    //             'Accept': 'application/xml, text/xml, */*',
    //             'User-Agent': 'PharmLabelSystem/2.0',
    //             'Accept-Encoding': 'gzip, deflate'
    //         }
    //     });
        
    //     // Collect the stream data
    //     let xmlData = '';
        
    //     return new Promise((resolve, reject) => {
    //         response.data.on('data', (chunk) => {
    //             xmlData += chunk.toString();
    //         });
            
    //         response.data.on('end', async () => {
    //             console.log(`✅ Received complete XML (${xmlData.length} characters)`);
                
    //             // Parse the complete XML
    //             try {
    //                 const parsed = await this.parseXMLSafely(xmlData);
    //                 resolve(parsed);
    //             } catch (error) {
    //                 console.error('Parse error:', error.message);
    //                 // Try regex fallback
    //                 resolve(this.regexExtraction(xmlData));
    //             }
    //         });
            
    //         response.data.on('error', (error) => {
    //             reject(error);
    //         });
    //     });
    // }

    // Fix for the fetchWithStreaming method in EnhancedSPLFetcher class
// Replace the existing fetchWithStreaming method with this one:

async fetchWithStreaming(labelId) {
    console.log(`🔍 Trying streaming approach for ${labelId}`);
    
    const url = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${labelId}.xml`;
    
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
            'Accept': 'application/xml, text/xml, */*',
            'User-Agent': 'PharmLabelSystem/2.0',
            'Accept-Encoding': 'gzip, deflate'
        }
    });
    
    // Collect the stream data
    let xmlData = '';
    
    return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
            xmlData += chunk.toString();
        });
        
        response.data.on('end', async () => {
            console.log(`✅ Received complete XML (${xmlData.length} characters)`);
            
            // Parse the complete XML
            try {
                const parsed = await this.parseXMLSafely(xmlData);
                // IMPORTANT: Add the raw XML to the result HERE
                const result = {
                    ...parsed,
                    rawXML: xmlData,
                    cleanedXML: parsed.cleanedXML || xmlData,
                    originalXML: parsed.originalXML || xmlData
                };
                console.log(`✅ Successfully parsed ${Object.keys(result.sections).length} sections`);
                console.log(`✅ XML included in result: ${result.rawXML ? result.rawXML.length : 0} characters`);
                resolve(result);
            } catch (error) {
                console.error('Parse error:', error.message);
                // Try regex fallback
                const regexResult = this.regexExtraction(xmlData);
                // Also add XML to regex result
                const result = {
                    ...regexResult,
                    rawXML: xmlData,
                    cleanedXML: xmlData,
                    originalXML: xmlData
                };
                console.log(`✅ Regex extraction complete, XML included: ${result.rawXML.length} characters`);
                resolve(result);
            }
        });
        
        response.data.on('error', (error) => {
            reject(error);
        });
    });
}

    // Strategy 2: Fetch with chunking
    async fetchWithChunking(labelId) {
        console.log(`🔍 Trying chunked download for ${labelId}`);
        
        const urls = [
            `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${labelId}.xml`,
            `https://dailymed.nlm.nih.gov/dailymed/getFile.cfm?setid=${labelId}&type=xml`
        ];
        
        for (const url of urls) {
            try {
                const response = await axios.get(url, {
                    timeout: 60000,
                    maxContentLength: 100 * 1024 * 1024, // 100MB
                    maxBodyLength: 100 * 1024 * 1024,
                    headers: {
                        'Accept': 'application/xml, text/xml, */*',
                        'User-Agent': 'PharmLabelSystem/2.0'
                    },
                    // Don't parse as JSON, get raw data
                    transformResponse: [(data) => data]
                });
                
                if (response.data) {
                    console.log(`✅ Retrieved XML data (${response.data.length} characters)`);
                    
                    // Ensure we have complete XML
                    const xmlContent = this.ensureCompleteXML(response.data);
                    
                    // Parse the XML
                    const parsed = await this.parseXMLSafely(xmlContent);
                    if (parsed && parsed.sections && Object.keys(parsed.sections).length > 0) {
                        return parsed;
                    }
                }
            } catch (error) {
                console.log(`❌ Failed to fetch from ${url}: ${error.message}`);
                continue;
            }
        }
        
        throw new Error('Chunking strategy failed');
    }

    // Strategy 3: Direct file download
    async fetchDirectDownload(labelId) {
        console.log(`🔍 Trying direct file download for ${labelId}`);
        
        const downloadUrl = `https://dailymed.nlm.nih.gov/dailymed/downloadzipfile.cfm?setId=${labelId}`;
        
        try {
            // First, try to get the XML directly
            const xmlUrl = `https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXml.cfm?setid=${labelId}&type=display`;
            
            const response = await axios.get(xmlUrl, {
                timeout: 60000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                responseType: 'text'
            });
            
            if (response.data) {
                console.log(`✅ Downloaded XML (${response.data.length} characters)`);
                return await this.parseXMLSafely(response.data);
            }
        } catch (error) {
            console.log(`❌ Direct download failed: ${error.message}`);
        }
        
        throw new Error('Direct download strategy failed');
    }

    // Strategy 4: FDA API fallback
    async fetchFromFDAAPI(labelId) {
        console.log(`🔍 Trying FDA OpenFDA API for ${labelId}`);
        
        try {
            const response = await axios.get('https://api.fda.gov/drug/label.json', {
                params: {
                    search: `openfda.spl_set_id:"${labelId}" OR openfda.spl_id:"${labelId}" OR id:"${labelId}"`,
                    limit: 1
                },
                timeout: 30000
            });
            
            if (response.data?.results?.[0]) {
                const fdaLabel = response.data.results[0];
                return this.convertFDAToStandardFormat(fdaLabel);
            }
        } catch (error) {
            console.log(`❌ FDA API failed: ${error.message}`);
        }
        
        throw new Error('FDA API strategy failed');
    }

    // Ensure XML is complete
    ensureCompleteXML(xmlContent) {
        // Check if XML ends properly
        const hasClosingTag = xmlContent.includes('</document>') || 
                             xmlContent.includes('</clinicalDocument>') ||
                             xmlContent.includes('</structuredBody>');
        
        if (!hasClosingTag) {
            console.warn('⚠️ XML appears incomplete, attempting to fix...');
            
            // Find all open tags
            const openTags = [];
            const tagRegex = /<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
            let match;
            
            while ((match = tagRegex.exec(xmlContent)) !== null) {
                const tagName = match[1];
                const closeTag = `</${tagName}>`;
                
                // Check if this tag is closed
                const openCount = (xmlContent.match(new RegExp(`<${tagName}[^>]*>`, 'g')) || []).length;
                const closeCount = (xmlContent.match(new RegExp(closeTag, 'g')) || []).length;
                
                if (openCount > closeCount) {
                    for (let i = 0; i < openCount - closeCount; i++) {
                        openTags.push(tagName);
                    }
                }
            }
            
            // Close unclosed tags in reverse order
            for (let i = openTags.length - 1; i >= 0; i--) {
                xmlContent += `</${openTags[i]}>`;
            }
            
            console.log(`✅ Added ${openTags.length} closing tags`);
        }
        
        return xmlContent;
    }

    // Safe XML parsing with multiple attempts
    async parseXMLSafely(xmlContent) {
        // First, ensure the XML is complete
        xmlContent = this.ensureCompleteXML(xmlContent);
        
        try {
            // Try parsing with xml2js
            const result = await this.xmlParser.parseStringPromise(xmlContent);
            return this.extractFromParsedXML(result);
        } catch (error) {
            console.log(`⚠️ XML parsing failed: ${error.message}, trying regex extraction`);
            // Fall back to regex extraction
            return this.regexExtraction(xmlContent);
        }
    }

    // Extract data from parsed XML
    extractFromParsedXML(parsedXML) {
        const sections = {};
        const metadata = {};
        const productInfo = {};
        
        // Navigate through the XML structure
        const document = this.findNode(parsedXML, ['document', 'clinicaldocument', 'structureddocument']);
        
        if (document) {
            // Extract metadata
            metadata.setId = this.extractValue(this.findNode(document, ['setid', 'id']));
            metadata.versionNumber = this.extractValue(this.findNode(document, ['versionnumber'])) || '1.0';
            metadata.effectiveDate = this.extractValue(this.findNode(document, ['effectivetime']));
            metadata.title = this.extractValue(this.findNode(document, ['title']));
            
            // Extract sections from structuredBody
            const structuredBody = this.findNode(document, ['structuredbody', 'component']);
            if (structuredBody) {
                this.extractSections(structuredBody, sections);
            }
        }
        
        return { sections, metadata, productInfo };
    }

    // Find a node in the XML tree
    findNode(obj, possibleNames) {
        if (!obj) return null;
        
        for (const name of possibleNames) {
            if (obj[name]) return obj[name];
            
            // Check nested
            for (const key in obj) {
                if (typeof obj[key] === 'object') {
                    const found = this.findNode(obj[key], [name]);
                    if (found) return found;
                }
            }
        }
        
        return null;
    }

    // Extract sections recursively
    extractSections(node, sections) {
        if (!node) return;
        
        // Look for section nodes
        if (node.section) {
            const sectionList = Array.isArray(node.section) ? node.section : [node.section];
            
            for (const section of sectionList) {
                const title = this.extractValue(section.title);
                const text = this.extractValue(section.text);
                
                if (title && text && text.length > 10) {
                    sections[title] = text;
                }
                
                // Check for nested sections
                if (section.component) {
                    this.extractSections(section.component, sections);
                }
            }
        }
        
        // Check component nodes
        if (node.component) {
            const components = Array.isArray(node.component) ? node.component : [node.component];
            for (const component of components) {
                this.extractSections(component, sections);
            }
        }
    }

    // Extract value from a node
    extractValue(node) {
        if (!node) return '';
        if (typeof node === 'string') return node;
        
        if (node._) return node._;
        if (node['#text']) return node['#text'];
        if (node.$ && node.$.value) return node.$.value;
        if (node.$ && node.$.root) return node.$.root;
        
        // Try to find any text content
        for (const key in node) {
            if (typeof node[key] === 'string') {
                return node[key];
            }
        }
        
        return '';
    }

    // Regex extraction as fallback
    regexExtraction(xmlContent) {
        console.log('📝 Using regex extraction fallback');
        
        const sections = {};
        
        // Extract sections using regex
        const sectionPatterns = [
            { name: 'Indications and Usage', pattern: /<title[^>]*>.*?INDICATIONS?\s*(?:AND\s*)?USAGE?.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i },
            { name: 'Dosage and Administration', pattern: /<title[^>]*>.*?DOSAGE\s*(?:AND\s*)?ADMIN.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i },
            { name: 'Warnings and Precautions', pattern: /<title[^>]*>.*?WARNINGS?\s*(?:AND\s*)?PRECAUTIONS?.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i },
            { name: 'Contraindications', pattern: /<title[^>]*>.*?CONTRAINDICATIONS?.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i },
            { name: 'Adverse Reactions', pattern: /<title[^>]*>.*?ADVERSE\s*REACTIONS?.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i },
            { name: 'Drug Interactions', pattern: /<title[^>]*>.*?DRUG\s*INTERACTIONS?.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i },
            { name: 'Description', pattern: /<title[^>]*>.*?DESCRIPTION.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i }
        ];
        
        for (const { name, pattern } of sectionPatterns) {
            const match = xmlContent.match(pattern);
            if (match && match[1]) {
                sections[name] = this.cleanText(match[1]);
            }
        }
        
        // Extract metadata
        const metadata = {
            setId: this.extractWithRegex(xmlContent, /<setId[^>]*root="([^"]+)"/i),
            versionNumber: this.extractWithRegex(xmlContent, /<versionNumber[^>]*>([^<]+)</i) || '1.0',
            effectiveDate: this.extractWithRegex(xmlContent, /<effectiveTime[^>]*value="([^"]+)"/i),
            title: this.extractWithRegex(xmlContent, /<title[^>]*>([^<]+)</i)
        };
        
        return { sections, metadata, productInfo: {} };
    }

    extractWithRegex(content, pattern) {
        const match = content.match(pattern);
        return match ? match[1] : '';
    }

    cleanText(text) {
        return text
            .replace(/<[^>]*>/g, ' ')
            .replace(/&[a-z]+;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Convert FDA format to standard format
    convertFDAToStandardFormat(fdaLabel) {
        const sections = {};
        const metadata = {};
        
        // Map FDA fields to standard sections
        const fieldMappings = {
            'indications_and_usage': 'Indications and Usage',
            'dosage_and_administration': 'Dosage and Administration',
            'warnings_and_precautions': 'Warnings and Precautions',
            'contraindications': 'Contraindications',
            'adverse_reactions': 'Adverse Reactions',
            'drug_interactions': 'Drug Interactions',
            'description': 'Description',
            'clinical_pharmacology': 'Clinical Pharmacology',
            'how_supplied': 'How Supplied'
        };
        
        for (const [fdaField, sectionName] of Object.entries(fieldMappings)) {
            if (fdaLabel[fdaField]) {
                sections[sectionName] = Array.isArray(fdaLabel[fdaField]) 
                    ? fdaLabel[fdaField].join('\n\n')
                    : fdaLabel[fdaField];
            }
        }
        
        // Extract metadata
        if (fdaLabel.openfda) {
            metadata.manufacturer = fdaLabel.openfda.manufacturer_name?.[0] || '';
            metadata.brandName = fdaLabel.openfda.brand_name?.[0] || '';
            metadata.setId = fdaLabel.openfda.spl_set_id?.[0] || '';
            metadata.versionNumber = fdaLabel.version || '1.0';
        }
        
        metadata.effectiveDate = fdaLabel.effective_time || '';
        metadata.title = metadata.brandName || 'Unknown Product';
        
        return { sections, metadata, productInfo: {} };
    }

    // Get minimal label data when all else fails
    getMinimalLabelData(labelId) {
        return {
            sections: {},
            metadata: {
                setId: labelId,
                title: 'Label data unavailable',
                versionNumber: 'Unknown',
                effectiveDate: '',
                manufacturer: 'Unknown'
            },
            productInfo: {},
            error: 'Unable to fetch complete label data'
        };
    }
}

async function fetchEnhancedLabelContent(labelId) {
    const fetcher = new EnhancedSPLFetcher();
    return await fetcher.fetchEnhancedLabelContent(labelId);
}

// async function fetchEnhancedLabelContent(labelId) {
//     try {
//         console.log(`📄 Fetching enhanced content for label: ${labelId}`);
        
//         // Check if it's an uploaded label first
//         if (labelId.startsWith('upload_')) {
//             const uploadedLabel = uploadedLabelsStorage.get(labelId);
//             if (uploadedLabel) {
//                 return {
//                     sections: uploadedLabel.sections,
//                     metadata: uploadedLabel.metadata,
//                     productInfo: uploadedLabel.productInfo,
//                     source: 'upload'
//                 };
//             }
//         }
        
//         // Try multiple sources for comprehensive data
//         const labelData = await fetchFromMultipleSources(labelId);
        
//         return labelData;
//     } catch (error) {
//         console.error('Error fetching enhanced label content:', error);
//         throw error;
//     }
// }
router.get('/compare/:label1/:label2', async (req, res) => {
    try {
        const { label1: labelId1, label2: labelId2 } = req.params;
        
        console.log(`🔄 Enhanced comparison: ${labelId1} vs ${labelId2}`);
        
        // Fetch both labels with error handling
        const [labelData1, labelData2] = await Promise.allSettled([
            fetchEnhancedLabelContent(labelId1),
            fetchEnhancedLabelContent(labelId2)
        ]);
        
        // Handle fetch failures
        if (labelData1.status === 'rejected' || !labelData1.value) {
            console.error(`Failed to fetch label1: ${labelId1}`);
            return res.status(404).json({ 
                error: `Could not fetch label ${labelId1}`,
                suggestion: 'This label may not be available or the ID may be incorrect'
            });
        }
        
        if (labelData2.status === 'rejected' || !labelData2.value) {
            console.error(`Failed to fetch label2: ${labelId2}`);
            return res.status(404).json({ 
                error: `Could not fetch label ${labelId2}`,
                suggestion: 'This label may not be available or the ID may be incorrect'
            });
        }
        
        // Perform comparison
        const comparison = compareLabels(labelData1.value, labelData2.value);
        
        res.json({
            comparison,
            label1: {
                id: labelId1,
                metadata: labelData1.value.metadata || {},
                sectionsFound: Object.keys(labelData1.value.sections || {}).length
            },
            label2: {
                id: labelId2,
                metadata: labelData2.value.metadata || {},
                sectionsFound: Object.keys(labelData2.value.sections || {}).length
            }
        });
        
    } catch (error) {
        console.error('Comparison error:', error);
        res.status(500).json({ 
            error: 'Failed to compare labels',
            message: error.message
        });
    }
});
function compareLabels(label1, label2) {
    const comparison = {
        stats: {
            added: 0,
            removed: 0,
            modified: 0,
            unchanged: 0
        },
        sections: []
    };
    
    const sections1 = label1?.sections || {};
    const sections2 = label2?.sections || {};
    
    const allSectionKeys = new Set([
        ...Object.keys(sections1),
        ...Object.keys(sections2)
    ]);
    
    for (const sectionKey of allSectionKeys) {
        const content1 = sections1[sectionKey] || '';
        const content2 = sections2[sectionKey] || '';
        
        let status = 'unchanged';
        if (!content1 && content2) {
            status = 'added';
            comparison.stats.added++;
        } else if (content1 && !content2) {
            status = 'removed';
            comparison.stats.removed++;
        } else if (content1 !== content2) {
            status = 'modified';
            comparison.stats.modified++;
        } else {
            comparison.stats.unchanged++;
        }
        
        comparison.sections.push({
            name: sectionKey,
            status,
            content1: content1.substring(0, 500),
            content2: content2.substring(0, 500)
        });
    }
    
    return comparison;
}



// Enhanced fetch function with better error handling and retry logic
async function fetchEnhancedLabelContent(labelId) {
    try {
        console.log(`📄 Fetching enhanced content for label: ${labelId}`);
        
        const parser = new EnhancedSPLParser();
        
        // Try different URL patterns with increased timeout and streaming support
        const urlPatterns = [
            {
                url: `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${labelId}.xml`,
                description: 'DailyMed v2 XML API'
            },
            {
                url: `https://dailymed.nlm.nih.gov/dailymed/getFile.cfm?setid=${labelId}&type=xml`,
                description: 'DailyMed Direct XML File'
            },
            {
                url: `https://dailymed.nlm.nih.gov/dailymed/services/v1/spls/${labelId}.xml`,
                description: 'DailyMed v1 XML API'
            }
        ];
        
        for (const pattern of urlPatterns) {
            try {
                console.log(`🔍 Trying: ${pattern.description}`);
                
                const response = await axios.get(pattern.url, {
                    timeout: 30000, // Increased timeout to 30 seconds
                    maxContentLength: 50 * 1024 * 1024, // Allow up to 50MB
                    maxBodyLength: 50 * 1024 * 1024,
                    headers: {
                        'Accept': 'application/xml, text/xml, */*',
                        'User-Agent': 'PharmLabelSystem/2.0',
                        'Accept-Encoding': 'gzip, deflate', // Enable compression
                    },
                    responseType: 'text', // Ensure we get text response
                    validateStatus: function (status) {
                        return status >= 200 && status < 300; // Only accept 2xx responses
                    }
                });
                
                if (response.data) {
                    console.log(`✅ Retrieved XML data (${response.data.length} characters)`);
                    
                    // Check if we got a complete XML document
                    const xmlContent = response.data;
                    if (xmlContent.length < 1000) {
                        console.warn('⚠️ XML content seems too short, trying next source...');
                        continue;
                    }
                    
                    const parsed = await parser.parseXMLLabel(xmlContent);
                    
                    // Check if we got valid data
                    if (parsed && parsed.sections && Object.keys(parsed.sections).length > 0) {
                        console.log(`✅ Successfully parsed ${Object.keys(parsed.sections).length} sections`);
                        parsed.source = pattern.description;
                        return parsed;
                    } else {
                        console.warn('⚠️ No sections extracted, trying next source...');
                    }
                }
            } catch (error) {
                console.log(`❌ Failed with ${pattern.description}: ${error.message}`);
                
                // If it's a timeout error, try with even longer timeout
                if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                    console.log('🔄 Retrying with extended timeout...');
                    try {
                        const retryResponse = await axios.get(pattern.url, {
                            timeout: 60000, // 60 second timeout for retry
                            maxContentLength: 100 * 1024 * 1024,
                            maxBodyLength: 100 * 1024 * 1024,
                            headers: {
                                'Accept': 'application/xml, text/xml, */*',
                                'User-Agent': 'PharmLabelSystem/2.0'
                            }
                        });
                        
                        if (retryResponse.data) {
                            const parsed = await parser.parseXMLLabel(retryResponse.data);
                            if (parsed && parsed.sections && Object.keys(parsed.sections).length > 0) {
                                console.log(`✅ Retry successful!`);
                                parsed.source = pattern.description + ' (retry)';
                                return parsed;
                            }
                        }
                    } catch (retryError) {
                        console.log(`❌ Retry also failed: ${retryError.message}`);
                    }
                }
                
                continue;
            }
        }
        
        // If all patterns fail, try to get basic info from FDA API
        console.log('🔄 Falling back to FDA API...');
        try {
            const fdaResponse = await axios.get(
                'https://api.fda.gov/drug/label.json',
                {
                    params: {
                        search: `openfda.spl_set_id:"${labelId}"`,
                        limit: 1
                    },
                    timeout: 15000
                }
            );
            
            if (fdaResponse.data?.results?.[0]) {
                const fdaLabel = fdaResponse.data.results[0];
                return {
                    sections: {
                        'Indications and Usage': fdaLabel.indications_and_usage?.[0] || '',
                        'Dosage and Administration': fdaLabel.dosage_and_administration?.[0] || '',
                        'Warnings and Precautions': fdaLabel.warnings_and_precautions?.[0] || '',
                        'Adverse Reactions': fdaLabel.adverse_reactions?.[0] || '',
                        'Drug Interactions': fdaLabel.drug_interactions?.[0] || '',
                        'Contraindications': fdaLabel.contraindications?.[0] || '',
                        'Description': fdaLabel.description?.[0] || ''
                    },
                    metadata: {
                        title: fdaLabel.openfda?.brand_name?.[0] || 'Unknown',
                        manufacturer: fdaLabel.openfda?.manufacturer_name?.[0] || '',
                        setId: labelId,
                        versionNumber: fdaLabel.version || '1.0'
                    },
                    productInfo: {
                        ndc: fdaLabel.openfda?.product_ndc || [],
                        route: fdaLabel.openfda?.route || [],
                        dosageForm: fdaLabel.openfda?.dosage_form || []
                    },
                    source: 'FDA OpenFDA API (fallback)',
                    parseStatus: 'fda-fallback'
                };
            }
        } catch (fdaError) {
            console.log(`❌ FDA fallback also failed: ${fdaError.message}`);
        }
        
        // Return null if all attempts fail
        console.error(`❌ Failed to fetch label content for ${labelId} from all sources`);
        return null;
    } catch (error) {
        console.error(`Failed to fetch label: ${labelId}`, error.message);
        return null;
    }
}


async function fetchFromMultipleSources(labelId) {
    let combinedData = {
        sections: {},
        metadata: {},
        productInfo: {},
        sources: []
    };
    
    // 1. Try FDA Label API with comprehensive search
    try {
        const fdaData = await fetchFDALabelData(labelId);
        if (fdaData) {
            combinedData = mergeLabeLData(combinedData, fdaData);
            combinedData.sources.push('FDA');
        }
    } catch (error) {
        console.log('FDA fetch failed:', error.message);
    }
    
    // 2. Try DailyMed XML API
    try {
        const dailyMedData = await fetchDailyMedXML(labelId);
        if (dailyMedData) {
            combinedData = mergeLabeLData(combinedData, dailyMedData);
            combinedData.sources.push('DailyMed');
        }
    } catch (error) {
        console.log('DailyMed fetch failed:', error.message);
    }
    
    // 3. Try DailyMed REST API v2
    try {
        const dailyMedV2Data = await fetchDailyMedV2(labelId);
        if (dailyMedV2Data) {
            combinedData = mergeLabeLData(combinedData, dailyMedV2Data);
            combinedData.sources.push('DailyMed-v2');
        }
    } catch (error) {
        console.log('DailyMed v2 fetch failed:', error.message);
    }
    
    return combinedData;
}

async function fetchFDALabelData(labelId) {
    // Try multiple search strategies
    const searchStrategies = [
        { search: `id:"${labelId}"` },
        { search: `set_id:"${labelId}"` },
        { search: `spl_id:"${labelId}"` },
        { search: `openfda.spl_id:"${labelId}"` },
        { search: `openfda.spl_set_id:"${labelId}"` }
    ];
    
    for (const strategy of searchStrategies) {
        try {
            const response = await axios.get(`${APIs.LABEL}`, {
                params: {
                    ...strategy,
                    limit: 1
                },
                timeout: 10000
            });
            
            if (response.data?.results?.[0]) {
                return parseFDALabel(response.data.results[0]);
            }
        } catch (error) {
            continue; // Try next strategy
        }
    }
    
    return null;
}

function parseFDALabel(fdaLabel) {
    const sections = {};
    const metadata = {};
    const productInfo = {};
    
    // Extract all available sections
    const sectionMappings = {
        'boxed_warning': 'Boxed Warning',
        'warnings': 'Warnings',
        'warnings_and_precautions': 'Warnings and Precautions',
        'indications_and_usage': 'Indications and Usage',
        'dosage_and_administration': 'Dosage and Administration',
        'dosage_forms_and_strengths': 'Dosage Forms and Strengths',
        'contraindications': 'Contraindications',
        'adverse_reactions': 'Adverse Reactions',
        'drug_interactions': 'Drug Interactions',
        'use_in_specific_populations': 'Use in Specific Populations',
        'drug_abuse_and_dependence': 'Drug Abuse and Dependence',
        'overdosage': 'Overdosage',
        'description': 'Description',
        'clinical_pharmacology': 'Clinical Pharmacology',
        'nonclinical_toxicology': 'Nonclinical Toxicology',
        'clinical_studies': 'Clinical Studies',
        'references': 'References',
        'how_supplied': 'How Supplied/Storage and Handling',
        'patient_counseling_information': 'Patient Counseling Information',
        'medication_guide': 'Medication Guide',
        'instructions_for_use': 'Instructions for Use',
        'package_label_principal_display_panel': 'Principal Display Panel',
        'spl_patient_package_insert': 'Patient Package Insert',
        'information_for_patients': 'Information for Patients',
        'pregnancy': 'Pregnancy',
        'pediatric_use': 'Pediatric Use',
        'geriatric_use': 'Geriatric Use',
        'mechanism_of_action': 'Mechanism of Action',
        'pharmacokinetics': 'Pharmacokinetics',
        'pharmacodynamics': 'Pharmacodynamics',
        'microbiology': 'Microbiology',
        'recent_major_changes': 'Recent Major Changes',
        'warnings_and_cautions': 'Warnings and Cautions',
        'general_precautions': 'General Precautions',
        'laboratory_tests': 'Laboratory Tests',
        'carcinogenesis_mutagenesis_impairment_of_fertility': 'Carcinogenesis, Mutagenesis, Impairment of Fertility'
    };
    
    // Extract each section
    for (const [apiField, displayName] of Object.entries(sectionMappings)) {
        if (fdaLabel[apiField]) {
            sections[displayName] = Array.isArray(fdaLabel[apiField]) 
                ? fdaLabel[apiField].join('\n\n')
                : fdaLabel[apiField];
        }
    }
    
    // Extract metadata
    if (fdaLabel.openfda) {
        metadata.manufacturer = fdaLabel.openfda.manufacturer_name?.[0] || '';
        metadata.brandName = fdaLabel.openfda.brand_name?.[0] || '';
        metadata.genericName = fdaLabel.openfda.generic_name?.[0] || '';
        metadata.applicationNumber = fdaLabel.openfda.application_number?.[0] || '';
        metadata.splSetId = fdaLabel.openfda.spl_set_id?.[0] || '';
        metadata.splId = fdaLabel.openfda.spl_id?.[0] || '';
    }
    
    metadata.effectiveDate = fdaLabel.effective_time || '';
    metadata.version = fdaLabel.version || '1.0';
    
    // Extract product info
    productInfo.ndc = fdaLabel.openfda?.product_ndc || [];
    productInfo.route = fdaLabel.openfda?.route || [];
    productInfo.dosageForm = fdaLabel.openfda?.dosage_form || [];
    productInfo.productType = fdaLabel.openfda?.product_type || [];
    productInfo.substanceName = fdaLabel.openfda?.substance_name || [];
    
    return { sections, metadata, productInfo };
}

async function fetchDailyMedXML(setId) {
    try {
        const xmlUrl = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${setId}.xml`;
        const response = await axios.get(xmlUrl, {
            timeout: 15000,
            headers: {
                'Accept': 'application/xml, text/xml, */*',
                'User-Agent': 'PharmLabelSystem/2.0'
            }
        });
        
        if (response.data) {
            const parser = new EnhancedSPLParser();
            return await parser.parseXMLLabel(response.data);
        }
    } catch (error) {
        console.log('DailyMed XML fetch error:', error.message);
    }
    
    return null;
}

async function fetchDailyMedV2(setId) {
    try {
        // Try the v2 REST API
        const response = await axios.get(
            `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${setId}.json`,
            { timeout: 10000 }
        );
        
        if (response.data?.data) {
            return parseDailyMedV2Response(response.data.data);
        }
    } catch (error) {
        console.log('DailyMed v2 fetch error:', error.message);
    }
    
    return null;
}

function parseDailyMedV2Response(data) {
    const sections = {};
    const metadata = {};
    const productInfo = {};
    
    // Parse sections from the response
    if (data.sections) {
        for (const section of data.sections) {
            if (section.title && section.text) {
                sections[section.title] = section.text;
            }
        }
    }
    
    // Parse metadata
    metadata.title = data.title || '';
    metadata.setId = data.setid || '';
    metadata.versionNumber = data.version || '1.0';
    metadata.effectiveDate = data.effective_time || '';
    
    // Parse product info
    if (data.products) {
        productInfo.products = data.products;
    }
    
    return { sections, metadata, productInfo };
}

function mergeLabeLData(existing, newData) {
    // Merge sections (prefer non-empty values)
    for (const [key, value] of Object.entries(newData.sections || {})) {
        if (value && (!existing.sections[key] || value.length > existing.sections[key].length)) {
            existing.sections[key] = value;
        }
    }
    
    // Merge metadata
    for (const [key, value] of Object.entries(newData.metadata || {})) {
        if (value && !existing.metadata[key]) {
            existing.metadata[key] = value;
        }
    }
    
    // Merge product info
    for (const [key, value] of Object.entries(newData.productInfo || {})) {
        if (value && !existing.productInfo[key]) {
            existing.productInfo[key] = value;
        }
    }
    
    return existing;
}


// Enhanced XML parser for SPL labels
// class SPLParser {
//     constructor() {
//         // Configure xml2js with more lenient settings to handle malformed XML
//         this.xmlParser = new xml2js.Parser({
//             explicitArray: false,
//             ignoreAttrs: true,
//             normalize: true,
//             normalizeTags: true,
//             strict: false, // This is important - allows parsing of malformed XML
//             trim: true,
//             tagNameProcessors: [xml2js.processors.stripPrefix],
//             validator: null // Disable validation to handle malformed XML
//         });
//     }

//     async parseXMLLabel(xmlContent) {
//         try {
//             // Pre-process XML to fix common issues
//             let cleanedXML = xmlContent;
            
//             // Fix unescaped ampersands (common issue in FDA XML)
//             cleanedXML = cleanedXML.replace(/&(?!(?:amp|lt|gt|quot|apos);)/gi, '&amp;');
            
//             // Fix unescaped equals signs in attributes
//             cleanedXML = cleanedXML.replace(/(\w+)=([^"'\s>]+)(?=\s|>)/g, '$1="$2"');
            
//             // Remove any invalid characters
//             cleanedXML = cleanedXML.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
            
//             // Parse the cleaned XML
//             const result = await this.xmlParser.parseStringPromise(cleanedXML);
            
//             return this.extractLabelSections(result);
//         } catch (error) {
//             console.error('XML parsing error:', error.message);
//             // Fallback to regex extraction if XML parsing fails
//             return this.fallbackRegexExtraction(xmlContent);
//         }
//     }

//     extractLabelSections(parsedXML) {
//         const sections = {};
        
//         try {
//             // Navigate through the parsed XML structure
//             const document = parsedXML.document || parsedXML.structuredbody || parsedXML;
            
//             // Extract common sections
//             const sectionMappings = {
//                 'indicationsandusage': 'Indications and Usage',
//                 'dosageandadministration': 'Dosage and Administration',
//                 'warningsandprecautions': 'Warnings and Precautions',
//                 'adversereactions': 'Adverse Reactions',
//                 'druginteractions': 'Drug Interactions',
//                 'clinicalstudies': 'Clinical Studies',
//                 'howsupplied': 'How Supplied',
//                 'contraindications': 'Contraindications',
//                 'description': 'Description'
//             };

//             // Recursively search for sections
//             this.findSections(document, sections, sectionMappings);
            
//         } catch (error) {
//             console.error('Section extraction error:', error.message);
//         }
        
//         return sections;
//     }

//     findSections(obj, sections, mappings) {
//         if (!obj) return;
        
//         if (typeof obj === 'object') {
//             for (const key in obj) {
//                 const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');
                
//                 if (mappings[normalizedKey]) {
//                     sections[mappings[normalizedKey]] = this.extractText(obj[key]);
//                 }
                
//                 if (typeof obj[key] === 'object') {
//                     this.findSections(obj[key], sections, mappings);
//                 }
//             }
//         }
//     }

//     extractText(node) {
//         if (typeof node === 'string') {
//             return node.trim();
//         }
        
//         if (typeof node === 'object') {
//             let text = '';
            
//             if (node._ !== undefined) {
//                 text = node._;
//             } else if (node.text) {
//                 text = this.extractText(node.text);
//             } else if (node.paragraph) {
//                 text = this.extractText(node.paragraph);
//             } else if (Array.isArray(node)) {
//                 text = node.map(n => this.extractText(n)).join(' ');
//             } else {
//                 for (const key in node) {
//                     if (typeof node[key] === 'string') {
//                         text += ' ' + node[key];
//                     } else if (typeof node[key] === 'object') {
//                         text += ' ' + this.extractText(node[key]);
//                     }
//                 }
//             }
            
//             return text.trim();
//         }
        
//         return '';
//     }

//     fallbackRegexExtraction(xmlContent) {
//         const sections = {};
        
//         const patterns = {
//             'Indications and Usage': /<title[^>]*>.*?INDICATIONS AND USAGE.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i,
//             'Dosage and Administration': /<title[^>]*>.*?DOSAGE AND ADMINISTRATION.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i,
//             'Warnings and Precautions': /<title[^>]*>.*?WARNINGS AND PRECAUTIONS.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i,
//             'Adverse Reactions': /<title[^>]*>.*?ADVERSE REACTIONS.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i,
//             'Contraindications': /<title[^>]*>.*?CONTRAINDICATIONS.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i
//         };
        
//         for (const [sectionName, pattern] of Object.entries(patterns)) {
//             const match = xmlContent.match(pattern);
//             if (match && match[1]) {
//                 sections[sectionName] = match[1]
//                     .replace(/<[^>]*>/g, ' ')
//                     .replace(/\s+/g, ' ')
//                     .trim()
//                     .substring(0, 2000);
//             }
//         }
        
//         return sections;
//     }
// }

// ============================================
// ENHANCED SPL XML PARSER WITH FULL EXTRACTION
// ============================================
// Advanced SPL XML Parser with better object/image handling


class AdvancedSPLParser {
    constructor() {
        this.xmlParser = new xml2js.Parser({
            explicitArray: false,
            ignoreAttrs: false,
            mergeAttrs: false,  // Keep attributes separate for better control
            normalize: true,
            normalizeTags: true,
            strict: false,
            trim: true,
            tagNameProcessors: [xml2js.processors.stripPrefix],
            attrNameProcessors: [xml2js.processors.stripPrefix],
            preserveChildrenOrder: true
        });
    }

    async parseXMLLabel(xmlContent) {
        try {
            // Save raw XML for display
            const rawXML = xmlContent;
            
            // Validate XML content
            if (!xmlContent || xmlContent.length < 100) {
                console.error('XML content too short or empty');
                return this.getEmptyLabelStructure();
            }

            // Pre-process XML to handle common issues
            let cleanedXML = this.preprocessXML(xmlContent);
            
            // Parse the XML
            const result = await this.xmlParser.parseStringPromise(cleanedXML);
            
            // Extract all sections with enhanced logic
            const sections = this.extractAllSections(result);
            const metadata = this.extractMetadata(result);
            const productInfo = this.extractProductInfo(result);
            const images = this.extractImages(xmlContent); // Extract images from raw XML
            
            return {
                sections,
                metadata,
                productInfo,
                images,
                rawXML: this.formatXMLForDisplay(rawXML),
                parseStatus: 'success'
            };
        } catch (error) {
            console.error('XML parsing error:', error.message);
            // Fallback to comprehensive regex extraction
            return this.comprehensiveRegexExtraction(xmlContent);
        }
    }

    preprocessXML(xmlContent) {
        let cleaned = xmlContent;
        
        // Fix unescaped ampersands
        cleaned = cleaned.replace(/&(?!(?:amp|lt|gt|quot|apos|#x?[0-9a-fA-F]+);)/gi, '&amp;');
        
        // Fix unescaped less-than and greater-than in content
        cleaned = cleaned.replace(/(<[^>]+>)([^<]+)(<)/g, (match, tag1, content, tag2) => {
            const fixedContent = content
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            return tag1 + fixedContent + tag2;
        });
        
        // Remove invalid control characters
        cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        // Fix malformed attributes
        cleaned = cleaned.replace(/(\w+)=([^"'\s>]+)(?=\s|>)/g, '$1="$2"');
        
        return cleaned;
    }

    extractAllSections(parsedXML) {
        const sections = {};
        
        // Define comprehensive section mappings with LOINC codes
        const sectionMappings = {
            'indicationsandusage': 'Indications and Usage',
            'dosageandadministration': 'Dosage and Administration',
            'dosageformsandstrengths': 'Dosage Forms and Strengths',
            'contraindications': 'Contraindications',
            'warningsandprecautions': 'Warnings and Precautions',
            'adversereactions': 'Adverse Reactions',
            'druginteractions': 'Drug Interactions',
            'useinspecificpopulations': 'Use in Specific Populations',
            'drugabuseandependence': 'Drug Abuse and Dependence',
            'overdosage': 'Overdosage',
            'description': 'Description',
            'clinicalpharmacology': 'Clinical Pharmacology',
            'nonclinicaltoxicology': 'Nonclinical Toxicology',
            'clinicalstudies': 'Clinical Studies',
            'referencesection': 'References',
            'howsupplied': 'How Supplied/Storage and Handling',
            'patientcounselinginformation': 'Patient Counseling Information',
            'boxedwarning': 'Boxed Warning',
            'medicationguide': 'Medication Guide',
            'spl': 'Full Prescribing Information',
            'pharmacokinetics': 'Pharmacokinetics',
            'microbiology': 'Microbiology',
            'pregnancy': 'Pregnancy',
            'lactation': 'Lactation',
            'pediatricuse': 'Pediatric Use',
            'geriatricuse': 'Geriatric Use',
            'lacticacidosis': 'Lactic Acidosis'
        };

        // LOINC code mappings
        const loincMappings = {
            '34066-1': 'Boxed Warning',
            '34067-9': 'Indications and Usage',
            '34068-7': 'Dosage and Administration',
            '34069-5': 'How Supplied',
            '34070-3': 'Contraindications',
            '34071-1': 'Warnings and Precautions',
            '34072-9': 'General Precautions',
            '34073-7': 'Drug Interactions',
            '34074-5': 'Drug and Laboratory Test Interactions',
            '34075-2': 'Laboratory Tests',
            '34076-0': 'References',
            '34077-8': 'Teratogenic Effects',
            '34078-6': 'Nonteratogenic Effects',
            '34079-4': 'Labor and Delivery',
            '34080-2': 'Nursing Mothers',
            '34081-0': 'Pediatric Use',
            '34082-8': 'Geriatric Use',
            '34083-6': 'Carcinogenesis, Mutagenesis, Impairment of Fertility',
            '34084-4': 'Adverse Reactions',
            '34085-1': 'Controlled Substance',
            '34086-9': 'Abuse',
            '34087-7': 'Dependence',
            '34088-5': 'Overdosage',
            '34089-3': 'Description',
            '34090-1': 'Clinical Pharmacology',
            '34091-9': 'Pharmacokinetics',
            '34092-7': 'Clinical Studies',
            '43684-0': 'Use in Specific Populations',
            '43685-7': 'Warnings and Precautions'
        };

        // Navigate through the document structure
        const document = this.findDocumentRoot(parsedXML);
        
        if (document) {
            const structuredBody = this.findStructuredBody(document);
            
            if (structuredBody) {
                this.extractSectionsFromStructuredBody(structuredBody, sections, sectionMappings, loincMappings);
            }
            
            this.recursivelyExtractSections(document, sections, sectionMappings, loincMappings);
        }
        
        return sections;
    }

    extractSectionsFromStructuredBody(structuredBody, sections, mappings, loincMappings) {
        if (structuredBody.component) {
            const components = Array.isArray(structuredBody.component) 
                ? structuredBody.component 
                : [structuredBody.component];
            
            for (const component of components) {
                if (component.section) {
                    this.extractSectionContent(component.section, sections, mappings, loincMappings);
                }
            }
        }
        
        if (structuredBody.section) {
            const sectionList = Array.isArray(structuredBody.section) 
                ? structuredBody.section 
                : [structuredBody.section];
            
            for (const section of sectionList) {
                this.extractSectionContent(section, sections, mappings, loincMappings);
            }
        }
    }

    extractSectionContent(section, sections, mappings, loincMappings) {
        if (!section) return;
        
        // Extract section identification
        const title = this.extractTitle(section);
        const code = this.extractCode(section);
        const loincCode = this.extractLoincCode(section);
        
        // Extract complete text content
        const text = this.extractCompleteText(section);
        
        // Determine section name
        let sectionName = '';
        
        // First, try LOINC code mapping
        if (loincCode && loincMappings[loincCode]) {
            sectionName = loincMappings[loincCode];
        }
        
        // Then try title/code matching
        if (!sectionName) {
            const normalizedTitle = String(title || '').toLowerCase().replace(/[^a-z]/g, '');
            const normalizedCode = String(code || '').toLowerCase().replace(/[^a-z]/g, '');
            
            for (const [key, displayName] of Object.entries(mappings)) {
                if (normalizedTitle.includes(key) || normalizedCode.includes(key)) {
                    sectionName = displayName;
                    break;
                }
            }
        }
        
        // Default to title if no match
        if (!sectionName && title) {
            sectionName = title;
        }
        
        // Store the section if we have content
        if (text && sectionName) {
            // If section already exists, append content
            if (sections[sectionName]) {
                sections[sectionName] += '\n\n' + text;
            } else {
                sections[sectionName] = text;
            }
        }
        
        // Process subsections
        if (section.component) {
            const components = Array.isArray(section.component) 
                ? section.component 
                : [section.component];
            
            for (const component of components) {
                if (component.section) {
                    this.extractSectionContent(component.section, sections, mappings, loincMappings);
                }
            }
        }
    }

    extractTitle(section) {
        if (section.title) {
            if (typeof section.title === 'string') return section.title;
            if (section.title._) return section.title._;
            if (section.title['#text']) return section.title['#text'];
            if (section.title.content) return section.title.content;
            
            // Handle nested structure
            return this.extractTextFromNode(section.title);
        }
        
        if (section.$ && section.$.title) return section.$.title;
        if (section.code && section.code.$ && section.code.$.displayName) return section.code.$.displayName;
        
        return '';
    }

    extractCode(section) {
        if (section.code) {
            if (typeof section.code === 'string') return section.code;
            if (section.code.$ && section.code.$.code) return section.code.$.code;
            if (section.code.$ && section.code.$.displayName) return section.code.$.displayName;
        }
        
        if (section.$ && section.$.id) return section.$.id;
        if (section.id) return typeof section.id === 'string' ? section.id : '';
        
        return '';
    }

    extractLoincCode(section) {
        if (section.code && section.code.$ && section.code.$.code) {
            return section.code.$.code;
        }
        return '';
    }

    extractCompleteText(section) {
        let text = '';
        
        // Extract from text node
        if (section.text) {
            text = this.extractTextFromNode(section.text);
        }
        
        // Also check for content in other places
        if (section.paragraph) {
            const paragraphText = this.extractTextFromNode(section.paragraph);
            if (paragraphText) {
                text += (text ? '\n\n' : '') + paragraphText;
            }
        }
        
        if (section.list) {
            const listText = this.extractListContent(section.list);
            if (listText) {
                text += (text ? '\n\n' : '') + listText;
            }
        }
        
        if (section.table) {
            const tableText = this.extractTableContent(section.table);
            if (tableText) {
                text += (text ? '\n\n' : '') + tableText;
            }
        }
        
        if (section.content) {
            const contentText = this.extractTextFromNode(section.content);
            if (contentText) {
                text += (text ? '\n\n' : '') + contentText;
            }
        }
        
        return text.trim();
    }

    extractTextFromNode(node) {
        if (!node) return '';
        
        if (typeof node === 'string') {
            return node;
        }
        
        if (Array.isArray(node)) {
            return node.map(n => this.extractTextFromNode(n))
                      .filter(t => t)
                      .join('\n');
        }
        
        let text = '';
        
        // Check for direct text content
        if (node._) text += node._;
        if (node['#text']) text += node['#text'];
        if (node.content) text += this.extractTextFromNode(node.content);
        
        // Handle paragraph content
        if (node.paragraph) {
            const paragraphs = Array.isArray(node.paragraph) ? node.paragraph : [node.paragraph];
            const paragraphTexts = paragraphs.map(p => this.extractTextFromNode(p)).filter(t => t);
            if (paragraphTexts.length > 0) {
                text += (text ? '\n\n' : '') + paragraphTexts.join('\n\n');
            }
        }
        
        // Handle list items
        if (node.item) {
            const items = Array.isArray(node.item) ? node.item : [node.item];
            const itemTexts = items.map(item => '• ' + this.extractTextFromNode(item)).filter(t => t.length > 2);
            if (itemTexts.length > 0) {
                text += (text ? '\n' : '') + itemTexts.join('\n');
            }
        }
        
        // Handle tables
        if (node.table) {
            const tableText = this.extractTableContent(node.table);
            if (tableText) {
                text += (text ? '\n\n' : '') + tableText;
            }
        }
        
        // Handle lists
        if (node.list) {
            const listText = this.extractListContent(node.list);
            if (listText) {
                text += (text ? '\n\n' : '') + listText;
            }
        }
        
        // Handle line breaks
        if (node.br) {
            text += '\n';
        }
        
        // Handle renderMultiMedia references (images/media)
        if (node.renderMultiMedia) {
            const mediaRef = this.extractMediaReference(node.renderMultiMedia);
            if (mediaRef) {
                text += (text ? '\n' : '') + `[Image: ${mediaRef}]`;
            }
        }
        
        // If still no text, try to extract from any string properties
        if (!text) {
            for (const key in node) {
                if (key !== '$' && key !== 'code' && key !== 'id' && typeof node[key] === 'string') {
                    text += (text ? ' ' : '') + node[key];
                } else if (key !== '$' && key !== 'code' && typeof node[key] === 'object') {
                    const subText = this.extractTextFromNode(node[key]);
                    if (subText) {
                        text += (text ? ' ' : '') + subText;
                    }
                }
            }
        }
        
        return text.trim();
    }

    extractListContent(list) {
        if (!list) return '';
        
        const lists = Array.isArray(list) ? list : [list];
        let content = '';
        
        for (const l of lists) {
            if (l.item) {
                const items = Array.isArray(l.item) ? l.item : [l.item];
                for (const item of items) {
                    const itemText = this.extractTextFromNode(item);
                    if (itemText) {
                        content += '• ' + itemText + '\n';
                    }
                }
            }
        }
        
        return content.trim();
    }

    extractTableContent(table) {
        if (!table) return '';
        
        const tables = Array.isArray(table) ? table : [table];
        let content = '';
        
        for (const t of tables) {
            content += '\n[Table]\n';
            
            // Extract caption
            if (t.caption) {
                content += 'Caption: ' + this.extractTextFromNode(t.caption) + '\n';
            }
            
            // Extract headers
            if (t.thead && t.thead.tr) {
                const headers = this.extractTableRow(t.thead.tr);
                if (headers.length > 0) {
                    content += headers.join(' | ') + '\n';
                    content += headers.map(() => '---').join(' | ') + '\n';
                }
            }
            
            // Extract body rows
            if (t.tbody && t.tbody.tr) {
                const rows = Array.isArray(t.tbody.tr) ? t.tbody.tr : [t.tbody.tr];
                for (const row of rows) {
                    const cells = this.extractTableRow(row);
                    if (cells.length > 0) {
                        content += cells.join(' | ') + '\n';
                    }
                }
            }
            
            // Extract tfoot if present
            if (t.tfoot && t.tfoot.tr) {
                content += '---\n';
                const footers = this.extractTableRow(t.tfoot.tr);
                if (footers.length > 0) {
                    content += 'Footer: ' + footers.join(' | ') + '\n';
                }
            }
            
            content += '\n';
        }
        
        return content.trim();
    }

    extractTableRow(row) {
        if (!row) return [];
        
        const cells = [];
        
        // Extract th cells
        if (row.th) {
            const thCells = Array.isArray(row.th) ? row.th : [row.th];
            for (const cell of thCells) {
                cells.push(this.extractTextFromNode(cell).replace(/\n/g, ' '));
            }
        }
        
        // Extract td cells
        if (row.td) {
            const tdCells = Array.isArray(row.td) ? row.td : [row.td];
            for (const cell of tdCells) {
                cells.push(this.extractTextFromNode(cell).replace(/\n/g, ' '));
            }
        }
        
        return cells;
    }

    extractMediaReference(renderMultiMedia) {
        if (!renderMultiMedia) return '';
        
        if (renderMultiMedia.$ && renderMultiMedia.$.referencedObject) {
            return renderMultiMedia.$.referencedObject;
        }
        
        if (typeof renderMultiMedia === 'string') {
            return renderMultiMedia;
        }
        
        return 'media reference';
    }

    extractImages(xmlContent) {
        const images = [];
        
        // Extract observationMedia elements (images in SPL)
        const mediaPattern = /<observationMedia[^>]*>[\s\S]*?<\/observationMedia>/gi;
        const mediaMatches = xmlContent.match(mediaPattern) || [];
        
        for (const mediaMatch of mediaMatches) {
            // Extract ID
            const idMatch = mediaMatch.match(/ID[^>]*root="([^"]+)"/i);
            const id = idMatch ? idMatch[1] : '';
            
            // Extract value/reference
            const valueMatch = mediaMatch.match(/<value[^>]*>/i);
            const mediaTypeMatch = mediaMatch.match(/mediaType="([^"]+)"/i);
            const referenceMatch = mediaMatch.match(/<reference[^>]*value="([^"]+)"/i);
            
            if (id || referenceMatch) {
                images.push({
                    id: id,
                    mediaType: mediaTypeMatch ? mediaTypeMatch[1] : 'image',
                    reference: referenceMatch ? referenceMatch[1] : '',
                    type: 'observationMedia'
                });
            }
        }
        
        // Extract renderMultiMedia references
        const renderPattern = /<renderMultiMedia[^>]*referencedObject="([^"]+)"[^>]*\/>/gi;
        let renderMatch;
        while ((renderMatch = renderPattern.exec(xmlContent)) !== null) {
            images.push({
                id: renderMatch[1],
                type: 'renderMultiMedia',
                usage: 'inline'
            });
        }
        
        // Extract image references from text
        const imgPattern = /img_[a-f0-9\-]+/gi;
        let imgMatch;
        const foundIds = new Set();
        while ((imgMatch = imgPattern.exec(xmlContent)) !== null) {
            if (!foundIds.has(imgMatch[0])) {
                foundIds.add(imgMatch[0]);
                images.push({
                    id: imgMatch[0],
                    type: 'reference',
                    url: `https://dailymed.nlm.nih.gov/dailymed/image.cfm?name=${imgMatch[0]}.jpg`
                });
            }
        }
        
        return images;
    }

    formatXMLForDisplay(xmlContent) {
        // Format XML for display with proper indentation
        let formatted = xmlContent;
        let indent = 0;
        
        formatted = formatted.replace(/></g, '>\n<');
        const lines = formatted.split('\n');
        const formattedLines = [];
        
        for (let line of lines) {
            line = line.trim();
            
            if (line.startsWith('</')) {
                indent--;
            }
            
            formattedLines.push('  '.repeat(Math.max(0, indent)) + line);
            
            if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>') && !line.includes('</')) {
                indent++;
            }
        }
        
        return formattedLines.join('\n');
    }

    findDocumentRoot(obj) {
        if (!obj) return null;
        
        const possibleRoots = ['document', 'clinicaldocument', 'structureddocument', 'root'];
        
        for (const root of possibleRoots) {
            if (obj[root]) return obj[root];
        }
        
        return obj;
    }

    findStructuredBody(document) {
        if (!document) return null;
        
        if (document.structuredbody) return document.structuredbody;
        if (document.structuredBody) return document.structuredBody;
        if (document.component && document.component.structuredbody) return document.component.structuredbody;
        if (document.component && document.component.structuredBody) return document.component.structuredBody;
        
        const result = this.deepSearch(document, 'structuredbody') || this.deepSearch(document, 'structuredBody');
        if (result) return result;
        
        return null;
    }

    recursivelyExtractSections(obj, sections, mappings, loincMappings) {
        if (!obj || typeof obj !== 'object') return;
        
        for (const key in obj) {
            if (key === '$' || key === 'code') continue;
            
            const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');
            
            // Check if this key matches a section
            for (const [mapKey, displayName] of Object.entries(mappings)) {
                if (normalizedKey.includes(mapKey) && !sections[displayName]) {
                    const text = this.extractTextFromNode(obj[key]);
                    if (text && text.length > 50) {
                        sections[displayName] = text;
                    }
                }
            }
            
            // Recurse into nested objects
            if (typeof obj[key] === 'object') {
                this.recursivelyExtractSections(obj[key], sections, mappings, loincMappings);
            }
        }
    }

    deepSearch(obj, targetKey) {
        if (!obj || typeof obj !== 'object') return null;
        
        const normalizedTarget = targetKey.toLowerCase();
        
        for (const key in obj) {
            if (key.toLowerCase() === normalizedTarget) {
                return obj[key];
            }
            
            if (typeof obj[key] === 'object') {
                const result = this.deepSearch(obj[key], targetKey);
                if (result) return result;
            }
        }
        
        return null;
    }

    extractMetadata(parsedXML) {
        const metadata = {};
        const document = this.findDocumentRoot(parsedXML);
        
        if (document) {
            // Version
            metadata.versionNumber = this.findValue(document, ['versionNumber', 'versionnumber', 'releaseddate']) || '1.0';
            
            // Effective date
            const effectiveTime = this.findValue(document, ['effectiveTime', 'effectivetime', 'effectivedate']);
            if (effectiveTime) {
                if (typeof effectiveTime === 'object' && effectiveTime.$) {
                    metadata.effectiveDate = effectiveTime.$.value || '';
                } else {
                    metadata.effectiveDate = effectiveTime;
                }
            }
            
            // Author/Manufacturer
            const author = this.deepSearch(document, 'author') || 
                          this.deepSearch(document, 'custodian') ||
                          this.deepSearch(document, 'manufacturer') ||
                          this.deepSearch(document, 'representedOrganization');
            
            if (author) {
                metadata.manufacturer = this.extractOrganizationName(author);
            }
            
            // Set ID
            const setId = this.findValue(document, ['setId', 'setid', 'id']);
            if (setId) {
                if (typeof setId === 'object' && setId.$) {
                    metadata.setId = setId.$.root || setId.$.extension || '';
                } else {
                    metadata.setId = setId;
                }
            }
            
            // Title
            metadata.title = this.findValue(document, ['title']) || 'Pharmaceutical Product Label';
        }
        
        return metadata;
    }

    findValue(obj, keys) {
        for (const key of keys) {
            const value = this.deepSearch(obj, key);
            if (value) return value;
        }
        return null;
    }

    extractOrganizationName(org) {
        if (!org) return '';
        
        // Look for name in various places
        const name = this.deepSearch(org, 'name');
        if (name) {
            return this.extractTextFromNode(name);
        }
        
        // Try representedOrganization
        const repOrg = this.deepSearch(org, 'representedOrganization');
        if (repOrg) {
            const repName = this.deepSearch(repOrg, 'name');
            if (repName) {
                return this.extractTextFromNode(repName);
            }
        }
        
        return this.extractTextFromNode(org);
    }

    extractProductInfo(parsedXML) {
        const productInfo = {};
        const document = this.findDocumentRoot(parsedXML);
        
        if (document) {
            // Product name
            const manufacturedProduct = this.deepSearch(document, 'manufacturedProduct') || 
                                       this.deepSearch(document, 'manufacturedproduct');
            
            if (manufacturedProduct) {
                productInfo.name = this.extractTextFromNode(this.deepSearch(manufacturedProduct, 'name'));
                
                // Active ingredients
                const ingredients = this.deepSearch(manufacturedProduct, 'ingredient');
                if (ingredients) {
                    productInfo.activeIngredients = this.extractIngredients(ingredients);
                }
                
                // Form code
                const formCode = this.deepSearch(manufacturedProduct, 'formCode');
                if (formCode) {
                    productInfo.dosageForm = this.extractCodeValue(formCode);
                }
            }
            
            // NDC codes
            const ndcNode = this.deepSearch(document, 'code') || 
                          this.deepSearch(document, 'containerPackagedProduct');
            if (ndcNode) {
                productInfo.ndc = this.extractCodeValue(ndcNode);
            }
            
            // Route of administration
            const routeNode = this.deepSearch(document, 'routeCode');
            if (routeNode) {
                productInfo.route = this.extractCodeValue(routeNode);
            }
        }
        
        return productInfo;
    }

    extractCodeValue(codeNode) {
        if (!codeNode) return '';
        
        if (typeof codeNode === 'string') return codeNode;
        
        if (codeNode.$ && codeNode.$.code) return codeNode.$.code;
        if (codeNode.$ && codeNode.$.displayName) return codeNode.$.displayName;
        
        return this.extractTextFromNode(codeNode);
    }

    extractIngredients(ingredientNode) {
        if (!ingredientNode) return [];
        
        const ingredients = Array.isArray(ingredientNode) ? ingredientNode : [ingredientNode];
        const result = [];
        
        for (const ing of ingredients) {
            const ingredient = {};
            
            // Get ingredient substance
            const substance = this.deepSearch(ing, 'ingredientSubstance');
            if (substance) {
                const name = this.deepSearch(substance, 'name');
                ingredient.name = name ? this.extractTextFromNode(name) : '';
                
                const code = this.deepSearch(substance, 'code');
                if (code) {
                    ingredient.code = this.extractCodeValue(code);
                }
                
                // Get strength
                const strength = this.deepSearch(substance, 'strength');
                if (strength) {
                    const numerator = this.deepSearch(strength, 'numerator');
                    const denominator = this.deepSearch(strength, 'denominator');
                    
                    if (numerator && denominator) {
                        const numValue = this.extractQuantity(numerator);
                        const denValue = this.extractQuantity(denominator);
                        ingredient.strength = `${numValue}/${denValue}`;
                    }
                }
            }
            
            if (ingredient.name) {
                result.push(ingredient);
            }
        }
        
        return result;
    }

    extractQuantity(quantityNode) {
        if (!quantityNode) return '';
        
        let value = '';
        let unit = '';
        
        if (quantityNode.$ && quantityNode.$.value) {
            value = quantityNode.$.value;
        }
        
        if (quantityNode.$ && quantityNode.$.unit) {
            unit = quantityNode.$.unit;
        }
        
        return value && unit ? `${value} ${unit}` : value || unit || '';
    }

    comprehensiveRegexExtraction(xmlContent) {
        const sections = {};
        
        // Save raw XML
        const rawXML = this.formatXMLForDisplay(xmlContent);
        
        // Enhanced regex patterns for all SPL sections
        const patterns = {
            'Boxed Warning': [
                /<title[^>]*>.*?BOX(?:ED)?\s*WARNING.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i,
                /<section[^>]*>[\s\S]*?<code[^>]*code="34066-1"[^>]*>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i
            ],
            'Indications and Usage': [
                /<title[^>]*>.*?INDICATIONS?\s*(?:AND\s*)?USAGE?.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i,
                /<section[^>]*>[\s\S]*?<code[^>]*code="34067-9"[^>]*>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i
            ],
            'Dosage and Administration': [
                /<title[^>]*>.*?DOSAGE\s*(?:AND\s*)?ADMIN.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i,
                /<section[^>]*>[\s\S]*?<code[^>]*code="34068-7"[^>]*>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i
            ],
            'Warnings and Precautions': [
                /<title[^>]*>.*?WARNINGS?\s*(?:AND\s*)?PRECAUTIONS?.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i,
                /<section[^>]*>[\s\S]*?<code[^>]*code="34071-1"[^>]*>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i
            ],
            'Adverse Reactions': [
                /<title[^>]*>.*?ADVERSE\s*REACTIONS?.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i,
                /<section[^>]*>[\s\S]*?<code[^>]*code="34084-4"[^>]*>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i
            ],
            'Drug Interactions': [
                /<title[^>]*>.*?DRUG\s*INTERACTIONS?.*?<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i,
                /<section[^>]*>[\s\S]*?<code[^>]*code="34073-7"[^>]*>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/i
            ]
        };
        
        for (const [sectionName, patternList] of Object.entries(patterns)) {
            for (const pattern of patternList) {
                const match = xmlContent.match(pattern);
                if (match && match[1]) {
                    sections[sectionName] = this.cleanExtractedText(match[1]);
                    break;
                }
            }
        }
        
        // Extract metadata
        const metadata = {
            versionNumber: this.extractWithRegex(xmlContent, /<versionNumber[^>]*>([^<]+)<\/versionNumber>/i),
            effectiveDate: this.extractWithRegex(xmlContent, /<effectiveTime[^>]*value="([^"]+)"[^>]*\/>/i),
            manufacturer: this.extractWithRegex(xmlContent, /<representedOrganization>[\s\S]*?<name>([^<]+)<\/name>/i),
            setId: this.extractWithRegex(xmlContent, /<setId[^>]*root="([^"]+)"[^>]*\/>/i)
        };
        
        // Extract images
        const images = this.extractImages(xmlContent);
        
        return { 
            sections, 
            metadata, 
            productInfo: {},
            images,
            rawXML,
            parseStatus: 'regex-fallback' 
        };
    }

    extractWithRegex(content, pattern) {
        const match = content.match(pattern);
        return match ? match[1] : '';
    }

    cleanExtractedText(text) {
        return text
            .replace(/<[^>]*>/g, ' ')
            .replace(/&[a-z]+;/gi, ' ')
            .replace(/\[object Object\]/g, '[Data]')
            .replace(/\s+/g, ' ')
            .trim();
    }

    getEmptyLabelStructure() {
        return {
            sections: {},
            metadata: {
                title: 'Label parsing failed',
                versionNumber: '1.0',
                effectiveDate: new Date().toISOString()
            },
            productInfo: {},
            images: [],
            rawXML: '',
            parseStatus: 'failed'
        };
    }
}



// Enhanced XML parser for SPL labels with robust error handling
class ComprehensiveSPLParser {
    constructor() {
        this.xmlParser = new xml2js.Parser({
            explicitArray: false,
            ignoreAttrs: false,
            mergeAttrs: false,
            normalize: true,
            normalizeTags: true,
            strict: false,
            trim: true,
            tagNameProcessors: [xml2js.processors.stripPrefix],
            attrNameProcessors: [xml2js.processors.stripPrefix]
        });
        
        // Track all found sections for debugging
        this.foundSections = new Set();
    }

    async parseXMLLabel(xmlContent) {
        try {
            console.log(`📊 Parsing XML of ${xmlContent.length} characters`);
            
            // First, try structured parsing
            const result = await this.xmlParser.parseStringPromise(xmlContent);
            
            // Extract sections using multiple strategies
            const sections = {};
            const metadata = {};
            const productInfo = {};
            
            // Strategy 1: Deep recursive extraction
            this.deepExtractSections(result, sections);
            
            // Strategy 2: Direct section/component search
            this.extractFromComponents(result, sections);
            
            // Strategy 3: Regex extraction for any missed sections
            this.regexExtractAllSections(xmlContent, sections);
            
            // Extract metadata
            this.extractMetadata(result, metadata, xmlContent);
            
            // Extract product info
            this.extractProductInfo(result, productInfo, xmlContent);
            
            console.log(`✅ Extracted ${Object.keys(sections).length} sections`);
            console.log(`📋 Section names:`, Object.keys(sections));
            
            return {
                sections,
                metadata,
                productInfo,
                parseStatus: 'success',
                totalSections: Object.keys(sections).length
            };
            
        } catch (error) {
            console.error('XML parsing error:', error.message);
            // Fallback to pure regex extraction
            return this.pureRegexExtraction(xmlContent);
        }
    }

    // Deep recursive extraction - get EVERYTHING
    deepExtractSections(obj, sections, path = '') {
        if (!obj || typeof obj !== 'object') return;
        
        // Look for section-like structures
        if (obj.section || obj.Section) {
            const sectionObj = obj.section || obj.Section;
            const sectionArray = Array.isArray(sectionObj) ? sectionObj : [sectionObj];
            
            for (const section of sectionArray) {
                this.processSectionNode(section, sections);
            }
        }
        
        // Look for components with sections
        if (obj.component || obj.Component) {
            const componentObj = obj.component || obj.Component;
            const components = Array.isArray(componentObj) ? componentObj : [componentObj];
            
            for (const component of components) {
                if (component.section || component.Section) {
                    const componentSection = component.section || component.Section;
                    this.processSectionNode(componentSection, sections);
                }
                // Recurse into component
                this.deepExtractSections(component, sections, path + '/component');
            }
        }
        
        // Look for structuredBody
        if (obj.structuredBody || obj.structuredbody) {
            const body = obj.structuredBody || obj.structuredbody;
            this.deepExtractSections(body, sections, path + '/structuredBody');
        }
        
        // Recurse through all properties
        for (const key in obj) {
            if (key !== '$' && typeof obj[key] === 'object') {
                this.deepExtractSections(obj[key], sections, path + '/' + key);
            }
        }
    }

    // Process a section node
    processSectionNode(section, sections) {
        if (!section) return;
        
        // Extract title
        let title = this.extractTitle(section);
        
        // Extract code and LOINC
        const code = this.extractCode(section);
        const loincCode = this.extractLoincCode(section);
        
        // If no title, try to use code or LOINC
        if (!title) {
            title = this.getNameFromLoincCode(loincCode) || 
                   this.getNameFromCode(code) || 
                   `Section_${Object.keys(sections).length + 1}`;
        }
        
        // Extract all text content
        const text = this.extractAllText(section);
        
        // Store if we have content
        if (text && text.length > 10) {
            // If section already exists, append
            if (sections[title]) {
                sections[title] += '\n\n--- Additional Content ---\n\n' + text;
            } else {
                sections[title] = text;
            }
            this.foundSections.add(title);
        }
        
        // Process nested sections
        if (section.component) {
            const components = Array.isArray(section.component) ? section.component : [section.component];
            for (const component of components) {
                if (component.section) {
                    this.processSectionNode(component.section, sections);
                }
            }
        }
    }

    // Extract title from various possible locations
    extractTitle(section) {
        // Direct title
        if (section.title) {
            return this.extractTextFromNode(section.title);
        }
        
        // Code displayName
        if (section.code && section.code.$) {
            if (section.code.$.displayName) return section.code.$.displayName;
            if (section.code.$.originalText) return section.code.$.originalText;
        }
        
        // ID as fallback
        if (section.id && section.id.$) {
            if (section.id.$.root) return `Section ${section.id.$.root}`;
        }
        
        return '';
    }

    // Extract all text from a section
    extractAllText(section) {
        let allText = '';
        
        // Get text node
        if (section.text) {
            allText += this.extractTextFromNode(section.text);
        }
        
        // Get paragraph content
        if (section.paragraph) {
            const paragraphs = Array.isArray(section.paragraph) ? section.paragraph : [section.paragraph];
            for (const p of paragraphs) {
                const pText = this.extractTextFromNode(p);
                if (pText) allText += '\n\n' + pText;
            }
        }
        
        // Get list content
        if (section.list) {
            const lists = Array.isArray(section.list) ? section.list : [section.list];
            for (const list of lists) {
                const listText = this.extractListContent(list);
                if (listText) allText += '\n\n' + listText;
            }
        }
        
        // Get table content
        if (section.table) {
            const tables = Array.isArray(section.table) ? section.table : [section.table];
            for (const table of tables) {
                const tableText = this.extractTableContent(table);
                if (tableText) allText += '\n\n' + tableText;
            }
        }
        
        // Get subsection content
        if (section.section) {
            const subsections = Array.isArray(section.section) ? section.section : [section.section];
            for (const subsection of subsections) {
                const subText = this.extractAllText(subsection);
                if (subText) allText += '\n\n' + subText;
            }
        }
        
        // Get any other text content
        for (const key in section) {
            if (key !== '$' && key !== 'code' && key !== 'id' && key !== 'title' && 
                !['text', 'paragraph', 'list', 'table', 'section', 'component'].includes(key)) {
                const additionalText = this.extractTextFromNode(section[key]);
                if (additionalText && additionalText.length > 20) {
                    allText += '\n\n' + additionalText;
                }
            }
        }
        
        return allText.trim();
    }

    // Extract from component structure
    extractFromComponents(obj, sections) {
        // Find all component nodes
        const components = this.findAllNodes(obj, ['component', 'Component']);
        
        for (const component of components) {
            if (component.section) {
                this.processSectionNode(component.section, sections);
            }
            
            // Also check for structuredBody in component
            if (component.structuredBody || component.structuredbody) {
                const body = component.structuredBody || component.structuredbody;
                if (body.component) {
                    this.extractFromComponents(body, sections);
                }
            }
        }
    }

    // Comprehensive regex extraction
    regexExtractAllSections(xmlContent, sections) {
        // Extract any section with a title tag
        const titlePattern = /<title[^>]*>(.*?)<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>/gi;
        let match;
        
        while ((match = titlePattern.exec(xmlContent)) !== null) {
            const title = this.cleanText(match[1]);
            const content = this.cleanText(match[2]);
            
            if (title && content && content.length > 20) {
                if (!sections[title]) {
                    sections[title] = content;
                    this.foundSections.add(title + ' (regex)');
                }
            }
        }
        
        // Extract sections with code attributes
        const codePattern = /<section[^>]*>[\s\S]*?<code[^>]*(?:displayName|originalText)="([^"]+)"[^>]*>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>[\s\S]*?<\/section>/gi;
        
        while ((match = codePattern.exec(xmlContent)) !== null) {
            const title = this.cleanText(match[1]);
            const content = this.cleanText(match[2]);
            
            if (title && content && content.length > 20) {
                if (!sections[title]) {
                    sections[title] = content;
                    this.foundSections.add(title + ' (code regex)');
                }
            }
        }
        
        // Extract any paragraph with substantial content
        const paragraphPattern = /<paragraph[^>]*>([\s\S]{100,}?)<\/paragraph>/gi;
        let paragraphCount = 0;
        
        while ((match = paragraphPattern.exec(xmlContent)) !== null) {
            const content = this.cleanText(match[1]);
            if (content && content.length > 100) {
                const title = `Additional Information ${++paragraphCount}`;
                if (!sections[title]) {
                    sections[title] = content;
                }
            }
        }
    }

    // Get LOINC code
    extractLoincCode(section) {
        if (section.code && section.code.$) {
            return section.code.$.code || '';
        }
        return '';
    }

    // Get name from LOINC code
    getNameFromLoincCode(loincCode) {
        const loincMappings = {
            '34066-1': 'BOXED WARNING',
            '34067-9': 'INDICATIONS AND USAGE',
            '34068-7': 'DOSAGE AND ADMINISTRATION',
            '34069-5': 'HOW SUPPLIED',
            '34070-3': 'CONTRAINDICATIONS',
            '34071-1': 'WARNINGS AND PRECAUTIONS',
            '34072-9': 'GENERAL PRECAUTIONS',
            '34073-7': 'DRUG INTERACTIONS',
            '34074-5': 'DRUG AND LABORATORY TEST INTERACTIONS',
            '34075-2': 'LABORATORY TESTS',
            '34076-0': 'REFERENCES',
            '34077-8': 'TERATOGENIC EFFECTS',
            '34078-6': 'NONTERATOGENIC EFFECTS',
            '34079-4': 'LABOR AND DELIVERY',
            '34080-2': 'NURSING MOTHERS',
            '34081-0': 'PEDIATRIC USE',
            '34082-8': 'GERIATRIC USE',
            '34083-6': 'CARCINOGENESIS, MUTAGENESIS, IMPAIRMENT OF FERTILITY',
            '34084-4': 'ADVERSE REACTIONS',
            '34085-1': 'CONTROLLED SUBSTANCE',
            '34086-9': 'ABUSE',
            '34087-7': 'DEPENDENCE',
            '34088-5': 'OVERDOSAGE',
            '34089-3': 'DESCRIPTION',
            '34090-1': 'CLINICAL PHARMACOLOGY',
            '34091-9': 'PHARMACOKINETICS',
            '34092-7': 'CLINICAL STUDIES',
            '43684-0': 'USE IN SPECIFIC POPULATIONS',
            '43685-7': 'WARNINGS AND PRECAUTIONS',
            '50565-1': 'DRUG ABUSE AND DEPENDENCE',
            '50566-9': 'NONCLINICAL TOXICOLOGY',
            '50567-7': 'PATIENT COUNSELING INFORMATION',
            '50568-5': 'MEDICATION GUIDE',
            '50569-3': 'CLINICAL TRIALS EXPERIENCE',
            '50570-1': 'DOSAGE FORMS AND STRENGTHS'
        };
        
        return loincMappings[loincCode] || '';
    }

    // Extract code value
    extractCode(section) {
        if (section.code) {
            if (section.code.$ && section.code.$.code) return section.code.$.code;
            if (section.code.$ && section.code.$.displayName) return section.code.$.displayName;
            if (typeof section.code === 'string') return section.code;
        }
        return '';
    }

    // Get name from code
    getNameFromCode(code) {
        if (!code) return '';
        
        // Clean up the code
        const cleaned = code.replace(/[^a-zA-Z\s]/g, ' ').trim();
        if (cleaned.length > 3) {
            return cleaned;
        }
        
        return '';
    }

    // Find all nodes of certain types
    findAllNodes(obj, nodeNames, found = []) {
        if (!obj || typeof obj !== 'object') return found;
        
        for (const nodeName of nodeNames) {
            if (obj[nodeName]) {
                const nodes = Array.isArray(obj[nodeName]) ? obj[nodeName] : [obj[nodeName]];
                found.push(...nodes);
            }
        }
        
        for (const key in obj) {
            if (key !== '$' && typeof obj[key] === 'object') {
                this.findAllNodes(obj[key], nodeNames, found);
            }
        }
        
        return found;
    }

    // Extract text from any node type
    extractTextFromNode(node) {
        if (!node) return '';
        if (typeof node === 'string') return node;
        
        let text = '';
        
        // Direct text content
        if (node._) text += node._;
        if (node['#text']) text += node['#text'];
        
        // Paragraph content
        if (node.paragraph) {
            const paragraphs = Array.isArray(node.paragraph) ? node.paragraph : [node.paragraph];
            for (const p of paragraphs) {
                text += '\n' + this.extractTextFromNode(p);
            }
        }
        
        // Content nodes
        if (node.content) {
            text += this.extractTextFromNode(node.content);
        }
        
        // List items
        if (node.item) {
            const items = Array.isArray(node.item) ? node.item : [node.item];
            for (const item of items) {
                text += '\n• ' + this.extractTextFromNode(item);
            }
        }
        
        // Tables
        if (node.table) {
            text += '\n' + this.extractTableContent(node.table);
        }
        
        // Any other text
        for (const key in node) {
            if (key !== '$' && key !== 'code' && typeof node[key] === 'string') {
                const val = node[key].trim();
                if (val && val.length > 10) {
                    text += '\n' + val;
                }
            } else if (typeof node[key] === 'object' && !['paragraph', 'content', 'item', 'table'].includes(key)) {
                const subText = this.extractTextFromNode(node[key]);
                if (subText) text += '\n' + subText;
            }
        }
        
        return text.trim();
    }

    // Extract list content
    extractListContent(list) {
        if (!list) return '';
        
        let content = '';
        
        if (list.item) {
            const items = Array.isArray(list.item) ? list.item : [list.item];
            for (const item of items) {
                content += '• ' + this.extractTextFromNode(item) + '\n';
            }
        }
        
        return content;
    }

    // Extract table content
    extractTableContent(table) {
        if (!table) return '';
        
        let content = '[Table]\n';
        
        // Caption
        if (table.caption) {
            content += 'Caption: ' + this.extractTextFromNode(table.caption) + '\n';
        }
        
        // Headers
        if (table.thead && table.thead.tr) {
            const headerRow = table.thead.tr;
            const headers = this.extractTableRow(headerRow);
            content += headers.join(' | ') + '\n';
        }
        
        // Body
        if (table.tbody && table.tbody.tr) {
            const rows = Array.isArray(table.tbody.tr) ? table.tbody.tr : [table.tbody.tr];
            for (const row of rows) {
                const cells = this.extractTableRow(row);
                content += cells.join(' | ') + '\n';
            }
        }
        
        return content;
    }

    // Extract table row
    extractTableRow(row) {
        const cells = [];
        
        if (row.th) {
            const headers = Array.isArray(row.th) ? row.th : [row.th];
            for (const h of headers) {
                cells.push(this.extractTextFromNode(h));
            }
        }
        
        if (row.td) {
            const data = Array.isArray(row.td) ? row.td : [row.td];
            for (const d of data) {
                cells.push(this.extractTextFromNode(d));
            }
        }
        
        return cells;
    }

    // Extract metadata
    extractMetadata(parsedXML, metadata, xmlContent) {
        // Try structured extraction first
        const document = this.findDocumentRoot(parsedXML);
        
        if (document) {
            metadata.title = this.extractTextFromNode(this.deepSearch(document, 'title')) || '';
            metadata.setId = this.extractValue(this.deepSearch(document, 'setId')) || '';
            metadata.versionNumber = this.extractTextFromNode(this.deepSearch(document, 'versionNumber')) || '';
            metadata.effectiveDate = this.extractValue(this.deepSearch(document, 'effectiveTime')) || '';
            
            const author = this.deepSearch(document, 'author') || this.deepSearch(document, 'manufacturedOrganization');
            if (author) {
                metadata.manufacturer = this.extractOrganizationName(author);
            }
        }
        
        // Regex fallback for metadata
        if (!metadata.title) {
            const titleMatch = xmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) metadata.title = this.cleanText(titleMatch[1]);
        }
        
        if (!metadata.setId) {
            const setIdMatch = xmlContent.match(/<setId[^>]*root="([^"]+)"/i);
            if (setIdMatch) metadata.setId = setIdMatch[1];
        }
        
        if (!metadata.versionNumber) {
            const versionMatch = xmlContent.match(/<versionNumber[^>]*(?:value="([^"]+)"|>([^<]+)<)/i);
            if (versionMatch) metadata.versionNumber = versionMatch[1] || versionMatch[2];
        }
    }

    // Extract product info
    extractProductInfo(parsedXML, productInfo, xmlContent) {
        const document = this.findDocumentRoot(parsedXML);
        
        if (document) {
            const product = this.deepSearch(document, 'manufacturedProduct');
            if (product) {
                productInfo.name = this.extractTextFromNode(this.deepSearch(product, 'name'));
                productInfo.dosageForm = this.extractTextFromNode(this.deepSearch(product, 'formCode'));
                productInfo.route = this.extractTextFromNode(this.deepSearch(product, 'routeCode'));
            }
        }
        
        // NDC extraction
        const ndcMatch = xmlContent.match(/<containerPackagedProduct>[\s\S]*?<code[^>]*code="([^"]+)"/i);
        if (ndcMatch) productInfo.ndc = ndcMatch[1];
    }

    // Find document root
    findDocumentRoot(obj) {
        if (!obj) return null;
        
        const possibleRoots = ['document', 'clinicalDocument', 'structuredDocument', 'ClinicalDocument'];
        
        for (const root of possibleRoots) {
            if (obj[root]) return obj[root];
        }
        
        // Check first level keys
        const keys = Object.keys(obj);
        if (keys.length === 1 && typeof obj[keys[0]] === 'object') {
            return obj[keys[0]];
        }
        
        return obj;
    }

    // Deep search for a key
    deepSearch(obj, targetKey) {
        if (!obj || typeof obj !== 'object') return null;
        
        const normalizedTarget = targetKey.toLowerCase();
        
        for (const key in obj) {
            if (key.toLowerCase() === normalizedTarget) {
                return obj[key];
            }
            
            if (typeof obj[key] === 'object') {
                const result = this.deepSearch(obj[key], targetKey);
                if (result) return result;
            }
        }
        
        return null;
    }

    // Extract value helper
    extractValue(node) {
        if (!node) return '';
        if (typeof node === 'string') return node;
        if (node.$ && node.$.value) return node.$.value;
        if (node.$ && node.$.root) return node.$.root;
        if (node._) return node._;
        return '';
    }

    // Extract organization name
    extractOrganizationName(org) {
        const name = this.deepSearch(org, 'name');
        if (name) {
            const text = this.extractTextFromNode(name);
            // Clean OIDs and codes
            return text.replace(/[\d.]+/g, '').replace(/MANU/g, '').trim();
        }
        return '';
    }

    // Clean text helper
    cleanText(text) {
        if (!text) return '';
        
        return text
            .replace(/<[^>]*>/g, ' ')     // Remove tags
            .replace(/&[a-z]+;/gi, ' ')    // Remove entities
            .replace(/\s+/g, ' ')          // Normalize whitespace
            .trim();
    }

    // Pure regex extraction fallback
    pureRegexExtraction(xmlContent) {
        console.log('📝 Using pure regex extraction');
        
        const sections = {};
        
        // Extract ALL sections with title and text
        const patterns = [
            /<section[^>]*>[\s\S]*?<title[^>]*>(.*?)<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>[\s\S]*?<\/section>/gi,
            /<component>[\s\S]*?<section[^>]*>[\s\S]*?<title[^>]*>(.*?)<\/title>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>[\s\S]*?<\/section>[\s\S]*?<\/component>/gi,
            /<paragraph[^>]*>([\s\S]{200,}?)<\/paragraph>/gi
        ];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(xmlContent)) !== null) {
                const title = this.cleanText(match[1] || `Section ${Object.keys(sections).length + 1}`);
                const content = this.cleanText(match[2] || match[1]);
                
                if (content && content.length > 50) {
                    sections[title] = content;
                }
            }
        }
        
        return { sections, metadata: {}, productInfo: {} };
    }
}


const splParser = new AdvancedSPLParser();
// 3. Replace the upload endpoint (around line 348 where the error occurs):
router.post('/upload-xml-label', upload.single('file'), async (req, res) => {
    try {
        const { name, description } = req.body;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        console.log(`📤 Processing XML label: ${name || file.originalname}`);
        
        // Read file content
        const xmlContent = await fs.readFile(file.path, 'utf-8');
        
        // Parse with enhanced parser
        const parsedData = await splParser.parseXMLLabel(xmlContent);
        
        // Generate unique ID
        const labelId = `upload_${crypto.randomBytes(8).toString('hex')}`;
        
        // Clean up uploaded file
        await fs.unlink(file.path).catch(() => {});
        
        // Create label object with all extracted data
        const label = {
            id: labelId,
            name: name || file.originalname,
            description: description || '',
            sections: parsedData.sections,
            sectionsAvailable: Object.keys(parsedData.sections).reduce((acc, key) => {
                acc[key] = parsedData.sections[key] ? true : false;
                return acc;
            }, {}),
            sectionsCount: Object.keys(parsedData.sections).length,
            metadata: parsedData.metadata,
            productInfo: parsedData.productInfo,
            uploadDate: new Date().toISOString(),
            source: 'upload',
            raw: parsedData.raw // Keep for debugging if needed
        };
        
        // Store in memory
        uploadedLabelsStorage.set(labelId, label);
        
        console.log(`✅ Successfully parsed ${label.sectionsCount} sections from XML`);
        
        res.json({ 
            success: true, 
            label: label,
            message: `Successfully extracted ${label.sectionsCount} sections from XML label`
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        
        // Clean up file if exists
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        
        res.status(500).json({ 
            error: 'Failed to process XML label', 
            message: error.message 
        });
    }
});

// Get all uploaded labels
router.get('/uploaded-labels', (req, res) => {
    try {
        const labels = Array.from(uploadedLabelsStorage.values());
        res.json({ labels });
    } catch (error) {
        console.error('Error fetching uploaded labels:', error);
        res.status(500).json({ error: 'Failed to fetch uploaded labels' });
    }
});


// 4. Add endpoint to get single uploaded label:
router.get('/uploaded-label/:labelId', (req, res) => {
    try {
        const { labelId } = req.params;
        const label = uploadedLabelsStorage.get(labelId);
        
        if (!label) {
            return res.status(404).json({ error: 'Label not found' });
        }
        
        res.json({ label });
    } catch (error) {
        console.error('Error fetching label:', error);
        res.status(500).json({ error: 'Failed to fetch label' });
    }
});

// 5. Add endpoint to delete uploaded label:
router.delete('/uploaded-label/:labelId', (req, res) => {
    try {
        const { labelId } = req.params;
        
        if (!uploadedLabelsStorage.has(labelId)) {
            return res.status(404).json({ error: 'Label not found' });
        }
        
        uploadedLabelsStorage.delete(labelId);
        res.json({ success: true, message: 'Label deleted successfully' });
    } catch (error) {
        console.error('Error deleting label:', error);
        res.status(500).json({ error: 'Failed to delete label' });
    }
});



// 6. Fixed enhanced comparison endpoint:
router.post('/compare-labels-enhanced', async (req, res) => {
    try {
        const { label1Id, label2Id } = req.body;
        console.log(`🔄 Enhanced comparison: ${label1Id} vs ${label2Id}`);
        
        let label1 = null;
        let label2 = null;
        
        // Get first label with error handling
        if (label1Id.startsWith('upload_')) {
            label1 = uploadedLabelsStorage.get(label1Id);
            if (!label1) {
                return res.status(404).json({ error: `Uploaded label not found: ${label1Id}` });
            }
        } else {
            try {
                const response = await axios.get(`http://localhost:${port}/api/label-content/${label1Id}`);
                if (response.data && response.data.sections) {
                    label1 = {
                        id: label1Id,
                        name: `FDA Label ${label1Id.substring(0, 20)}...`,
                        sections: response.data.sections,
                        metadata: { versionNumber: 'FDA' }
                    };
                }
            } catch (error) {
                console.error(`Failed to fetch label1: ${label1Id}`, error.message);
                // Create a placeholder label if FDA fetch fails
                label1 = {
                    id: label1Id,
                    name: `Label ${label1Id.substring(0, 20)}...`,
                    sections: {},
                    metadata: { versionNumber: 'N/A' }
                };
            }
        }
        
        // Get second label with error handling
        if (label2Id.startsWith('upload_')) {
            label2 = uploadedLabelsStorage.get(label2Id);
            if (!label2) {
                return res.status(404).json({ error: `Uploaded label not found: ${label2Id}` });
            }
        } else {
            try {
                const response = await axios.get(`http://localhost:${port}/api/label-content/${label2Id}`);
                if (response.data && response.data.sections) {
                    label2 = {
                        id: label2Id,
                        name: `FDA Label ${label2Id.substring(0, 20)}...`,
                        sections: response.data.sections,
                        metadata: { versionNumber: 'FDA' }
                    };
                }
            } catch (error) {
                console.error(`Failed to fetch label2: ${label2Id}`, error.message);
                // Create a placeholder label if FDA fetch fails
                label2 = {
                    id: label2Id,
                    name: `Label ${label2Id.substring(0, 20)}...`,
                    sections: {},
                    metadata: { versionNumber: 'N/A' }
                };
            }
        }
        
        // Perform comparison even with empty sections
        const comparison = performDetailedComparison(label1, label2);
        res.json(comparison);
        
    } catch (error) {
        console.error('Enhanced comparison error:', error);
        res.status(500).json({ 
            error: 'Failed to compare labels', 
            message: error.message,
            details: error.stack
        });
    }
});
async function makeAPICall(url, params = {}) {
    try {
        const response = await axios.get(url, { 
            params,
            timeout: 10000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'PharmLabelSystem/1.0'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`API call failed for ${url}:`, error.message);
        return null;
    }
}
// Helper function to get label data from various sources
async function getLabelData(labelId) {
    // Check if it's an uploaded label
    if (labelId.startsWith('upload_')) {
        return uploadedLabelsStore.get(labelId);
    }
    
    // Otherwise fetch from FDA/DailyMed
    try {
        const response = await axios.get(`${APIs.DAILYMED}/spls/${labelId}.xml`);
        const parsedLabel = await splParser.parseXMLLabel(response.data);
        return {
            id: labelId,
            sections: parsedLabel.sections,
            metadata: parsedLabel.metadata,
            productInfo: parsedLabel.productInfo
        };
    } catch (error) {
        console.error(`Failed to fetch label ${labelId}:`, error.message);
        return null;
    }
}

// Helper functions to extract metadata
function extractVersion(sections) {
    // Try to extract version from sections if available
    for (const section in sections) {
        const content = sections[section];
        const versionMatch = content.match(/version\s*[:\s]?\s*(\d+\.?\d*)/i);
        if (versionMatch) {
            return versionMatch[1];
        }
    }
    return '1.0';
}

function extractManufacturer(sections) {
    // Try to extract manufacturer from sections
    for (const section in sections) {
        const content = sections[section];
        const mfgMatch = content.match(/manufactured by[:\s]+([^,\n]+)/i);
        if (mfgMatch) {
            return mfgMatch[1].trim();
        }
    }
    return 'Unknown';
}

// Detailed comparison function
function performDetailedComparison(label1, label2) {
    const comparison = {
        label1: {
            id: label1.id,
            name: label1.name,
            version: label1.metadata?.versionNumber || 'N/A'
        },
        label2: {
            id: label2.id,
            name: label2.name,
            version: label2.metadata?.versionNumber || 'N/A'
        },
        stats: {
            added: 0,
            removed: 0,
            modified: 0,
            unchanged: 0
        },
        sections: []
    };
    
    const sections1 = label1.sections || {};
    const sections2 = label2.sections || {};
    
    // Get all unique section names
    const allSections = new Set([
        ...Object.keys(sections1),
        ...Object.keys(sections2)
    ]);
    
    // Compare each section
    for (const sectionName of allSections) {
        const content1 = sections1[sectionName] || '';
        const content2 = sections2[sectionName] || '';
        
        let status;
        if (!content1 && content2) {
            status = 'added';
            comparison.stats.added++;
        } else if (content1 && !content2) {
            status = 'removed';
            comparison.stats.removed++;
        } else if (content1 !== content2) {
            status = 'modified';
            comparison.stats.modified++;
        } else {
            status = 'unchanged';
            comparison.stats.unchanged++;
        }
        
        comparison.sections.push({
            name: sectionName,
            status: status,
            content1: content1 ? { text: content1.substring(0, 1000) } : null,
            content2: content2 ? { text: content2.substring(0, 1000) } : null,
            diff: generateDiff(content1, content2, status)
        });
    }
    
    return comparison;
}

// Compare sections with detailed diff
function compareSections(sections1, sections2) {
    const allSectionKeys = new Set([
        ...Object.keys(sections1 || {}),
        ...Object.keys(sections2 || {})
    ]);
    
    const comparedSections = [];
    
    allSectionKeys.forEach(key => {
        const section1 = sections1?.[key];
        const section2 = sections2?.[key];
        
        if (!section1 && section2) {
            // Section added in label2
            comparedSections.push({
                key,
                name: formatSectionName(key),
                status: 'added',
                content1: null,
                content2: {
                    title: section2.title,
                    text: section2.text,
                    subsections: section2.subsections
                },
                differences: []
            });
        } else if (section1 && !section2) {
            // Section removed from label2
            comparedSections.push({
                key,
                name: formatSectionName(key),
                status: 'removed',
                content1: {
                    title: section1.title,
                    text: section1.text,
                    subsections: section1.subsections
                },
                content2: null,
                differences: []
            });
        } else if (section1 && section2) {
            // Both have the section - check for modifications
            const differences = findTextDifferences(section1.text, section2.text);
            const status = differences.length > 0 ? 'modified' : 'unchanged';
            
            comparedSections.push({
                key,
                name: formatSectionName(key),
                status,
                content1: {
                    title: section1.title,
                    text: section1.text,
                    subsections: section1.subsections
                },
                content2: {
                    title: section2.title,
                    text: section2.text,
                    subsections: section2.subsections
                },
                differences
            });
        }
    });
    
    return comparedSections;
}

// Find specific text differences
function findTextDifferences(text1, text2) {
    if (!text1 || !text2) return [];
    if (text1 === text2) return [];
    
    const differences = [];
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    
    // Simple line-by-line comparison
    const maxLines = Math.max(lines1.length, lines2.length);
    
    for (let i = 0; i < maxLines; i++) {
        const line1 = lines1[i] || '';
        const line2 = lines2[i] || '';
        
        if (line1 !== line2) {
            differences.push({
                lineNumber: i + 1,
                type: !line1 ? 'added' : !line2 ? 'removed' : 'modified',
                content1: line1,
                content2: line2
            });
        }
    }
    
    return differences;
}

// Compare product info
function compareProductInfo(info1, info2) {
    const comparison = {
        ndcCodes: {
            label1: info1?.ndcCodes || [],
            label2: info2?.ndcCodes || [],
            status: 'unchanged'
        },
        dosageForm: {
            label1: info1?.dosageForm,
            label2: info2?.dosageForm,
            status: 'unchanged'
        },
        route: {
            label1: info1?.route || [],
            label2: info2?.route || [],
            status: 'unchanged'
        },
        strength: {
            label1: info1?.strength,
            label2: info2?.strength,
            status: 'unchanged'
        }
    };
    
    // Determine status for each field
    Object.keys(comparison).forEach(key => {
        const field = comparison[key];
        if (JSON.stringify(field.label1) !== JSON.stringify(field.label2)) {
            field.status = 'modified';
        }
    });
    
    return comparison;
}

// Format section names
function formatSectionName(key) {
    const nameMap = {
        indicationsAndUsage: 'Indications and Usage',
        dosageAndAdministration: 'Dosage and Administration',
        contraindications: 'Contraindications',
        warningsAndPrecautions: 'Warnings and Precautions',
        adverseReactions: 'Adverse Reactions',
        drugInteractions: 'Drug Interactions',
        useInSpecificPopulations: 'Use in Specific Populations',
        description: 'Description',
        clinicalPharmacology: 'Clinical Pharmacology',
        clinicalStudies: 'Clinical Studies',
        howSupplied: 'How Supplied',
        patientCounseling: 'Patient Counseling Information',
        recentMajorChanges: 'Recent Major Changes',
        splListing: 'SPL Product Data Elements'
    };
    
    return nameMap[key] || key.replace(/([A-Z])/g, ' $1').trim();
}
// Comprehensive search endpoint - Main entry point
router.get('/comprehensive-search/:searchTerm', async (req, res) => {
    try {
        const { searchTerm } = req.params;
        console.log(`🔍 Comprehensive search for: ${searchTerm}`);
        
        const cacheKey = `comprehensive_${searchTerm}`;
        const cached = getCached(cacheKey);
        if (cached) {
            console.log('📦 Returning cached results');
            return res.json(cached);
        }

        // Parallel API calls for better performance
        const [
            rxcui,
            drugsfdaData,
            labelData,
            ndcData,
            dailymedData
        ] = await Promise.all([
            getRxCUI(searchTerm),
            searchDrugsFDA(searchTerm),
            searchFDALabels(searchTerm),
            searchNDC(searchTerm),
            searchDailyMed(searchTerm)
        ]);

        console.log(`✅ Found: ${drugsfdaData.applications.length} applications, ${labelData.labels.length} labels`);

        // Combine and process all data
        const result = {
            searchTerm,
            rxcui,
            applications: drugsfdaData.applications || [],
            labels: mergeLabels(labelData.labels, dailymedData.labels),
            ndcCodes: ndcData || [],
            companies: extractCompanies(drugsfdaData.applications, labelData.labels),
            timeline: generateTimeline(drugsfdaData.applications, labelData.labels),
            orangeBook: drugsfdaData.orangeBook || []
        };

        setCache(cacheKey, result);
        res.json(result);

    } catch (error) {
        console.error('❌ Comprehensive search error:', error);
        res.status(500).json({ 
            error: 'Failed to search drug data', 
            details: error.message 
        });
    }
});

// Get RxCUI from RxNorm
async function getRxCUI(drugName) {
    try {
        console.log(`🔍 Getting RxCUI for: ${drugName}`);
        const response = await axios.get(`${APIs.RXNORM}/rxcui.json`, {
            params: { 
                name: drugName, 
                search: 2 // Exact or normalized search
            },
            timeout: 5000
        });
        
        if (response.data?.idGroup?.rxnormId?.[0]) {
            const rxcui = response.data.idGroup.rxnormId[0];
            console.log(`✅ RxCUI found: ${rxcui}`);
            return rxcui;
        }
        
        console.log('⚠️ No RxCUI found');
        return null;
    } catch (error) {
        console.error('❌ RxNorm error:', error.message);
        return null;
    }
}

// Search FDA Drugs@FDA database
async function searchDrugsFDA(drugName) {
    try {
        console.log(`🔍 Searching Drugs@FDA for: ${drugName}`);
        
        // Try multiple search strategies
        const searchQueries = [
            `openfda.brand_name:"${drugName}"`,
            `openfda.generic_name:"${drugName}"`,
            `openfda.substance_name:"${drugName}"`,
            `products.brand_name:"${drugName}"`
        ];

        let allResults = [];
        
        for (const query of searchQueries) {
            try {
                const response = await axios.get(APIs.DRUGS_FDA, {
                    params: {
                        search: query,
                        limit: 50
                    },
                    timeout: 5000
                });
                
                if (response.data?.results) {
                    allResults = [...allResults, ...response.data.results];
                }
            } catch (e) {
                // Continue with other queries if one fails
            }
        }

        // Deduplicate and format applications
        const uniqueApps = new Map();
        
        allResults.forEach(app => {
            const key = app.application_number;
            if (!uniqueApps.has(key)) {
                uniqueApps.set(key, {
                    applicationNumber: app.application_number,
                    productName: app.products?.[0]?.brand_name || app.openfda?.brand_name?.[0] || drugName,
                    genericName: app.products?.[0]?.active_ingredients?.[0]?.name || app.openfda?.generic_name?.[0],
                    sponsorName: app.sponsor_name || app.openfda?.manufacturer_name?.[0] || 'Unknown',
                    approvalDate: extractApprovalDate(app),
                    status: app.products?.[0]?.marketing_status || 'Unknown',
                    dosageForm: app.products?.[0]?.dosage_form,
                    route: app.products?.[0]?.route,
                    strength: app.products?.[0]?.active_ingredients?.[0]?.strength,
                    products: app.products || []
                });
            }
        });

        const applications = Array.from(uniqueApps.values());
        console.log(`✅ Found ${applications.length} unique applications`);

        return {
            applications,
            orangeBook: await getOrangeBookData(drugName)
        };

    } catch (error) {
        console.error('❌ Drugs@FDA error:', error.message);
        return { applications: [], orangeBook: [] };
    }
}

// Search FDA Labels
async function searchFDALabels(drugName) {
    try {
        console.log(`🔍 Searching FDA Labels for: ${drugName}`);
        
        const response = await axios.get(APIs.LABEL, {
            params: {
                search: `openfda.brand_name:"${drugName}" OR openfda.generic_name:"${drugName}"`,
                limit: 100
            },
            timeout: 10000
        });

        const labels = response.data?.results?.map((label, index) => ({
            id: label.set_id || `fda_${Date.now()}_${index}`,
            productName: label.openfda?.brand_name?.[0] || label.openfda?.generic_name?.[0] || drugName,
            version: label.version || extractVersion(label),
            effectiveDate: formatDate(label.effective_time),
            manufacturerName: label.openfda?.manufacturer_name?.[0] || 'Unknown',
            applicationNumber: label.openfda?.application_number?.[0],
            splId: label.set_id,
            sections: {
                boxedWarning: label.boxed_warning?.[0],
                indicationsAndUsage: label.indications_and_usage?.[0],
                dosageAndAdministration: label.dosage_and_administration?.[0],
                contraindications: label.contraindications?.[0],
                warningsAndPrecautions: label.warnings_and_precautions?.[0],
                adverseReactions: label.adverse_reactions?.[0],
                drugInteractions: label.drug_interactions?.[0],
                useInSpecificPopulations: label.use_in_specific_populations?.[0],
                clinicalStudies: label.clinical_studies?.[0],
                howSupplied: label.how_supplied?.[0],
                patientCounseling: label.patient_counseling_information?.[0]
            }
        })) || [];

        console.log(`✅ Found ${labels.length} FDA labels`);
        return { labels };

    } catch (error) {
        console.error('❌ FDA Label search error:', error.message);
        return { labels: [] };
    }
}

// Search DailyMed
async function searchDailyMed(drugName) {
    try {
        console.log(`🔍 Searching DailyMed for: ${drugName}`);
        
        // DailyMed REST API
        const searchUrl = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json`;
        const response = await axios.get(searchUrl, {
            params: {
                drug_name: drugName,
                page: 1,
                pagesize: 20
            },
            timeout: 10000
        });

        const spls = response.data?.data || [];
        
        const labels = spls.map(spl => ({
            id: spl.setid,
            productName: spl.title,
            version: spl.document_version || '1.0',
            effectiveDate: formatDate(spl.published_date),
            manufacturerName: spl.labeler_name,
            splId: spl.setid,
            pdfUrl: `https://dailymed.nlm.nih.gov/dailymed/getFile.cfm?setid=${spl.setid}&type=pdf`,
            xmlUrl: `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${spl.setid}.xml`
        }));

        console.log(`✅ Found ${labels.length} DailyMed labels`);
        return { labels };

    } catch (error) {
        console.error('❌ DailyMed error:', error.message);
        return { labels: [] };
    }
}

// Search NDC
async function searchNDC(drugName) {
    try {
        console.log(`🔍 Searching NDC for: ${drugName}`);
        
        const response = await axios.get(APIs.NDC, {
            params: {
                search: `brand_name:"${drugName}" OR generic_name:"${drugName}"`,
                limit: 100
            },
            timeout: 5000
        });

        const ndcCodes = response.data?.results?.map(ndc => ({
            ndcCode: ndc.product_ndc,
            productName: ndc.brand_name,
            genericName: ndc.generic_name,
            labelerName: ndc.labeler_name,
            packageDescription: ndc.package_ndc,
            dosageForm: ndc.dosage_form,
            route: ndc.route,
            marketingCategory: ndc.marketing_category,
            startDate: ndc.marketing_start_date,
            endDate: ndc.marketing_end_date
        })) || [];

        console.log(`✅ Found ${ndcCodes.length} NDC codes`);
        return ndcCodes;

    } catch (error) {
        console.error('❌ NDC error:', error.message);
        return [];
    }
}

// Get Orange Book data
async function getOrangeBookData(drugName) {
    try {
        console.log(`🔍 Getting Orange Book data for: ${drugName}`);
        
        // Orange Book is part of FDA API
        const response = await axios.get(`${APIs.OPEN_FDA}/drug/label.json`, {
            params: {
                search: `openfda.brand_name:"${drugName}"`,
                limit: 10
            },
            timeout: 5000
        });

        const results = response.data?.results || [];
        
        return results.map(item => ({
            applicationNumber: item.openfda?.application_number?.[0],
            teCode: item.openfda?.te_code?.[0],
            rld: item.openfda?.rld?.[0],
            patents: item.openfda?.spl_product_data_elements || [],
            exclusivity: item.openfda?.exclusivity || []
        }));

    } catch (error) {
        console.error('❌ Orange Book error:', error.message);
        return [];
    }
}

router.get('/label-content/:labelId', async (req, res) => {
    try {
        const { labelId } = req.params;
        console.log(`Fetching label content for: ${labelId}`);
        
        // CHECK FOR UPLOADED LABELS FIRST
        if (labelId.startsWith('upload_')) {
            console.log(`Retrieving uploaded label: ${labelId}`);
            const uploadedLabel = uploadedLabelsStorage.get(labelId);
            
            if (uploadedLabel) {
                console.log(`Found uploaded label: ${uploadedLabel.name}`);
                
                // Return the uploaded label data in the same format as fetched labels
                const response = {
                    success: true,
                    labelId: labelId,
                    data: {
                        sections: uploadedLabel.sections || {},
                        metadata: uploadedLabel.metadata || {
                            title: uploadedLabel.name || 'Uploaded Label',
                            setId: uploadedLabel.id || labelId,
                            versionNumber: uploadedLabel.metadata?.versionNumber || uploadedLabel.metadata?.version || '1.0',
                            effectiveDate: uploadedLabel.metadata?.effectiveDate || uploadedLabel.uploadDate || '',
                            manufacturer: uploadedLabel.metadata?.manufacturer || uploadedLabel.metadata?.manufacturerName || 'Not specified'
                        },
                        productInfo: uploadedLabel.productInfo || {}
                    },
                    xml: {
                        raw: uploadedLabel.rawXML || uploadedLabel.raw || uploadedLabel.originalXML || null,
                        cleaned: uploadedLabel.cleanedXML || null,
                        original: uploadedLabel.originalXML || uploadedLabel.raw || null,
                        hasXML: !!(uploadedLabel.rawXML || uploadedLabel.raw || uploadedLabel.originalXML)
                    }
                };
                
                console.log('Sending uploaded label response with XML:', {
                    hasXML: response.xml.hasXML,
                    xmlLength: response.xml.raw ? response.xml.raw.length : 0,
                    sectionsCount: Object.keys(response.data.sections).length
                });
                
                return res.json(response);
            } else {
                console.error(`Uploaded label not found: ${labelId}`);
                return res.status(404).json({
                    success: false,
                    error: 'Uploaded label not found',
                    labelId: labelId,
                    details: 'The uploaded label may have been deleted or the session expired'
                });
            }
        }
        
        // NOT AN UPLOADED LABEL - Proceed with normal fetching from FDA/DailyMed
        console.log(`Fetching external label: ${labelId}`);
        
        const fetcher = new EnhancedSPLFetcher();
        const labelData = await fetcher.fetchEnhancedLabelContent(labelId);
        
        console.log('Label data received:', {
            hasSections: !!labelData?.sections,
            sectionCount: labelData?.sections ? Object.keys(labelData.sections).length : 0,
            hasRawXML: !!labelData?.rawXML,
            xmlLength: labelData?.rawXML ? labelData.rawXML.length : 0,
            hasMetadata: !!labelData?.metadata
        });
        
        if (labelData && Object.keys(labelData.sections).length > 0) {
            // Successfully fetched and parsed label data
            const response = {
                success: true,
                labelId: labelId,
                data: {
                    sections: labelData.sections,
                    metadata: labelData.metadata,
                    productInfo: labelData.productInfo
                },
                xml: {
                    raw: labelData.rawXML || null,
                    cleaned: labelData.cleanedXML || null,
                    original: labelData.originalXML || null,
                    hasXML: !!labelData.rawXML
                }
            };
            
            console.log('Sending response with XML:', {
                hasXML: !!response.xml.raw,
                xmlLength: response.xml.raw ? response.xml.raw.length : 0
            });
            
            res.json(response);
        } else {
            // No content found, but still return available data
            res.status(404).json({
                success: false,
                error: 'Label not found or no content available',
                labelId: labelId,
                details: labelData?.error || 'No sections could be extracted',
                xml: {
                    raw: labelData?.rawXML || null,
                    cleaned: labelData?.cleanedXML || null,
                    original: labelData?.originalXML || null,
                    hasXML: !!labelData?.rawXML
                },
                metadata: labelData?.metadata || {},
                source: labelData?.rawXML ? 'XML' : (labelData?.rawJSON ? 'FDA_API' : 'FAILED')
            });
        }
    } catch (error) {
        console.error('Error fetching label content:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch label content',
            message: error.message,
            labelId: req.params.labelId
        });
    }
});

// router.get('/label-content/:labelId', async (req, res) => {
//     try {
//         const { labelId } = req.params;
//         console.log(`Fetching label content for: ${labelId}`);
        
//         const fetcher = new EnhancedSPLFetcher();
//         const labelData = await fetcher.fetchEnhancedLabelContent(labelId);
        
//         console.log('Label data received:', {
//             hasSections: !!labelData?.sections,
//             sectionCount: labelData?.sections ? Object.keys(labelData.sections).length : 0,
//             hasRawXML: !!labelData?.rawXML,
//             xmlLength: labelData?.rawXML ? labelData.rawXML.length : 0,
//             hasMetadata: !!labelData?.metadata
//         });
        
//         if (labelData && Object.keys(labelData.sections).length > 0) {
//             // Successfully fetched and parsed label data
//             const response = {
//                 success: true,
//                 labelId: labelId,
//                 data: {
//                     sections: labelData.sections,
//                     metadata: labelData.metadata,
//                     productInfo: labelData.productInfo
//                 },
//                 xml: {
//                     raw: labelData.rawXML || null,
//                     cleaned: labelData.cleanedXML || null,
//                     original: labelData.originalXML || null,
//                     hasXML: !!labelData.rawXML
//                 }
//             };
            
//             // Log what we're sending
//             console.log('Sending response with XML:', {
//                 hasXML: !!response.xml.raw,
//                 xmlLength: response.xml.raw ? response.xml.raw.length : 0
//             });
            
//             res.json(response);
//         } else {
//             // No content found, but still return available data
//             res.status(404).json({
//                 success: false,
//                 error: 'Label not found or no content available',
//                 labelId: labelId,
//                 details: labelData?.error || 'No sections could be extracted',
//                 xml: {
//                     raw: labelData?.rawXML || null,
//                     cleaned: labelData?.cleanedXML || null,
//                     original: labelData?.originalXML || null,
//                     hasXML: !!labelData?.rawXML
//                 },
//                 metadata: labelData?.metadata || {},
//                 source: labelData?.rawXML ? 'XML' : (labelData?.rawJSON ? 'FDA_API' : 'FAILED')
//             });
//         }
//     } catch (error) {
//         console.error('Error fetching label content:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to fetch label content',
//             message: error.message,
//             labelId: req.params.labelId
//         });
//     }
// });



// Compare labels endpoint
router.post('/compare-labels', async (req, res) => {
    try {
        const { label1, label2 } = req.body;
        console.log(`🔄 Comparing labels: ${label1} vs ${label2}`);
        
        let content1 = { sections: {} };
        let content2 = { sections: {} };
        
        // Get content for first label
        if (label1.startsWith('upload_')) {
            const uploadedLabel = uploadedLabelsStorage.get(label1);
            if (uploadedLabel) {
                content1 = { sections: uploadedLabel.sections };
            }
        } else {
            try {
                const response = await axios.get(`http://localhost:${port}/api/label-content/${label1}`);
                content1 = response.data;
            } catch (error) {
                console.error('Error fetching label1:', error.message);
            }
        }
        
        // Get content for second label
        if (label2.startsWith('upload_')) {
            const uploadedLabel = uploadedLabelsStorage.get(label2);
            if (uploadedLabel) {
                content2 = { sections: uploadedLabel.sections };
            }
        } else {
            try {
                const response = await axios.get(`http://localhost:${port}/api/label-content/${label2}`);
                content2 = response.data;
            } catch (error) {
                console.error('Error fetching label2:', error.message);
            }
        }
        
        // Perform detailed comparison
        const comparison = {
            sections: {},
            stats: {
                added: 0,
                removed: 0,
                modified: 0,
                unchanged: 0
            }
        };
        
        // Get all section names from both labels
        const allSections = new Set([
            ...Object.keys(content1.sections || {}),
            ...Object.keys(content2.sections || {})
        ]);
        
        // Compare each section
        for (const section of allSections) {
            const text1 = content1.sections[section] || '';
            const text2 = content2.sections[section] || '';
            
            if (!text1 && text2) {
                // Section added in label2
                comparison.sections[section] = {
                    status: 'added',
                    content1: '',
                    content2: text2,
                    diff: `<div class="diff-added">${text2.substring(0, 500)}...</div>`
                };
                comparison.stats.added++;
            } else if (text1 && !text2) {
                // Section removed in label2
                comparison.sections[section] = {
                    status: 'removed',
                    content1: text1,
                    content2: '',
                    diff: `<div class="diff-removed">${text1.substring(0, 500)}...</div>`
                };
                comparison.stats.removed++;
            } else if (text1 !== text2) {
                // Section modified
                comparison.sections[section] = {
                    status: 'modified',
                    content1: text1,
                    content2: text2,
                    diff: createSimpleDiff(text1, text2)
                };
                comparison.stats.modified++;
            } else {
                // Section unchanged
                comparison.sections[section] = {
                    status: 'unchanged',
                    content1: text1,
                    content2: text2,
                    diff: text1.substring(0, 500)
                };
                comparison.stats.unchanged++;
            }
        }
        
        res.json(comparison);
        
    } catch (error) {
        console.error('❌ Comparison error:', error);
        res.status(500).json({ error: 'Failed to compare labels', message: error.message });
    }
});

// Helper function for simple diff
function createSimpleDiff(text1, text2) {
    const lines1 = text1.substring(0, 1000).split('\n');
    const lines2 = text2.substring(0, 1000).split('\n');
    let diff = '';
    
    const maxLines = Math.max(lines1.length, lines2.length);
    
    for (let i = 0; i < Math.min(maxLines, 10); i++) {
        const line1 = lines1[i] || '';
        const line2 = lines2[i] || '';
        
        if (line1 !== line2) {
            if (line1 && !line2) {
                diff += `<div class="diff-removed">${line1}</div>`;
            } else if (!line1 && line2) {
                diff += `<div class="diff-added">${line2}</div>`;
            } else {
                diff += `<div class="diff-modified">${line2}</div>`;
            }
        } else if (line1) {
            diff += `<div>${line1}</div>`;
        }
    }
    
    return diff || 'No differences found in preview';
}


// Upload label endpoint
router.post('/upload-label', upload.single('file'), async (req, res) => {
    try {
        const { name } = req.body;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        console.log(`📤 Uploading label: ${name || file.originalname}`);
        
        // Read file content
        const content = await fs.readFile(file.path, 'utf-8');
        
        // Clean up
        await fs.unlink(file.path).catch(() => {});
        
        res.json({
            success: true,
            id: `upload_${Date.now()}`,
            name: name || file.originalname,
            content: content.substring(0, 1000) // Return first 1000 chars as preview
        });
        
    } catch (error) {
        console.error('❌ Upload error:', error.message);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Download label endpoint
router.get('/download-label/:labelId', async (req, res) => {
    try {
        const { labelId } = req.params;
        console.log(`📥 Downloading label: ${labelId}`);
        
        // Try DailyMed PDF first
        const pdfUrl = `https://dailymed.nlm.nih.gov/dailymed/getFile.cfm?setid=${labelId}&type=pdf`;
        
        // Redirect to PDF
        res.redirect(pdfUrl);
        
    } catch (error) {
        console.error('❌ Download error:', error.message);
        res.status(500).json({ error: 'Failed to download label' });
    }
});

// Helper functions

// function extractApprovalDate(app) {
//     // Try multiple fields for approval date
//     if (app.products?.[0]?.marketing_status_date) {
//         return app.products[0].marketing_status_date;
//     }
//     if (app.approval_date) {
//         return app.approval_date;
//     }
//     if (app.submissions) {
//         const approval = app.submissions.find(s => 
//             s.submission_type === 'ORIG' && 
//             s.submission_status === 'AP'
//         );
//         if (approval?.submission_status_date) {
//             return approval.submission_status_date;
//         }
//     }
//     return null;
// }
function extractApprovalDate(app) {
    // Try multiple fields for approval date
    
    // Check products array for marketing start date
    if (app.products && app.products.length > 0) {
        for (const product of app.products) {
            if (product.marketing_start_date) {
                return formatDate(product.marketing_start_date);
            }
        }
    }
    
    // Check submissions for approval
    if (app.submissions && app.submissions.length > 0) {
        // Look for original approval
        const approval = app.submissions.find(s => 
            (s.submission_type === 'ORIG' || s.submission_type === 'NDA' || s.submission_type === 'ANDA') && 
            (s.submission_status === 'AP' || s.submission_status === 'TA')
        );
        if (approval?.submission_status_date) {
            return formatDate(approval.submission_status_date);
        }
        
        // If no ORIG, take the earliest approval
        const approvals = app.submissions
            .filter(s => s.submission_status === 'AP' && s.submission_status_date)
            .sort((a, b) => new Date(a.submission_status_date) - new Date(b.submission_status_date));
        
        if (approvals.length > 0) {
            return formatDate(approvals[0].submission_status_date);
        }
    }
    
    // Check openfda fields
    if (app.openfda?.approval_date && app.openfda.approval_date.length > 0) {
        return formatDate(app.openfda.approval_date[0]);
    }
    
    // Direct approval_date field
    if (app.approval_date) {
        return formatDate(app.approval_date);
    }
    
    // Check products for any date
    if (app.products && app.products.length > 0) {
        if (app.products[0].marketing_status_date) {
            return formatDate(app.products[0].marketing_status_date);
        }
    }
    
    // Last resort - check effective_time
    if (app.effective_time) {
        return formatDate(app.effective_time);
    }
    
    return null;
}


function formatDate(dateString) {
    if (!dateString) return null;
    
    // Handle YYYYMMDD format
    if (/^\d{8}$/.test(dateString)) {
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        return `${year}-${month}-${day}`;
    }
    
    // Handle YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
        return dateString.split('T')[0];
    }
    
    // Handle MM/DD/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
        const parts = dateString.split('/');
        return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
    
    // Handle other date formats by attempting to parse
    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    } catch (e) {
        // Invalid date
    }
    
    return dateString;
}

function mergeLabels(fdaLabels, dailymedLabels) {
    const labelMap = new Map();
    
    // Add FDA labels
    fdaLabels.forEach(label => {
        const key = label.splId || label.id;
        labelMap.set(key, label);
    });
    
    // Merge DailyMed labels
    dailymedLabels.forEach(label => {
        const key = label.splId || label.id;
        if (!labelMap.has(key)) {
            labelMap.set(key, label);
        } else {
            // Merge additional data from DailyMed
            const existing = labelMap.get(key);
            labelMap.set(key, {
                ...existing,
                pdfUrl: label.pdfUrl || existing.pdfUrl,
                xmlUrl: label.xmlUrl || existing.xmlUrl
            });
        }
    });
    
    return Array.from(labelMap.values());
}

// function extractCompanies(applications, labels) {
//     const companies = new Set();
    
//     applications.forEach(app => {
//         if (app.sponsorName && app.sponsorName !== 'Unknown') {
//             companies.add(app.sponsorName);
//         }
//     });
    
//     labels.forEach(label => {
//         if (label.manufacturerName && label.manufacturerName !== 'Unknown') {
//             companies.add(label.manufacturerName);
//         }
//     });
    
//     return Array.from(companies);
// }

function extractCompanies(applications, labels) {
    const companies = new Map();
    
    // First, collect all unique company names
    applications.forEach(app => {
        const name = normalizeCompanyName(app.sponsorName || 'Unknown');
        companies.set(name, name);
    });
    
    labels.forEach(label => {
        const name = normalizeCompanyName(label.manufacturerName || 'Unknown');
        companies.set(name, name);
    });
    
    // Try to match similar company names
    const companyGroups = new Map();
    
    companies.forEach(company => {
        let matched = false;
        // Check if this company matches an existing group
        companyGroups.forEach((group, key) => {
            if (areCompaniesSimilar(company, key)) {
                group.add(company);
                matched = true;
            }
        });
        
        if (!matched) {
            companyGroups.set(company, new Set([company]));
        }
    });
    
    return Array.from(companyGroups.keys());
}

function normalizeCompanyName(name) {
    if (!name) return 'Unknown';
    
    // Remove common suffixes and normalize
    return name
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .replace(/,?\s*(INC\.?|LLC\.?|LTD\.?|CORP\.?|CORPORATION|PHARMACEUTICALS?|PHARMA?|LABS?|LABORATORIES)\.?$/gi, '')
        .replace(/[.,]/g, '')
        .trim();
}

function areCompaniesSimilar(name1, name2) {
    const normalized1 = normalizeCompanyName(name1);
    const normalized2 = normalizeCompanyName(name2);
    
    // Exact match after normalization
    if (normalized1 === normalized2) return true;
    
    // Check if one contains the other (for subsidiaries)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return true;
    
    // Check for common pharmaceutical company variations
    const commonVariations = [
        ['AUROBINDO', 'AUROBINDO PHARMA'],
        ['LUPIN', 'LUPIN PHARMACEUTICALS'],
        ['TEVA', 'TEVA PHARMACEUTICALS'],
        // Add more known variations
    ];
    
    for (const [variant1, variant2] of commonVariations) {
        if ((normalized1.includes(variant1) && normalized2.includes(variant2)) ||
            (normalized1.includes(variant2) && normalized2.includes(variant1))) {
            return true;
        }
    }
    
    return false;
}

function generateTimeline(applications, labels) {
    const events = [];
    
    // Add approval events
    applications.forEach(app => {
        if (app.approvalDate) {
            events.push({
                date: app.approvalDate,
                type: 'approval',
                title: 'FDA Approval',
                description: `${app.productName} (${app.applicationNumber}) approved by FDA`,
                data: app
            });
        }
    });
    
    // Add label events
    labels.forEach(label => {
        if (label.effectiveDate) {
            events.push({
                date: label.effectiveDate,
                type: 'label',
                title: `Label Update v${label.version}`,
                description: `${label.productName} label updated`,
                data: label,
                changes: extractLabelChanges(label)
            });
        }
    });
    
    // Sort by date (newest first)
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return events;
}

function extractLabelChanges(label) {
    const changes = [];
    
    if (label.sections?.boxedWarning) {
        changes.push('Boxed warning added or updated');
    }
    if (label.sections?.contraindications) {
        changes.push('Contraindications updated');
    }
    if (label.sections?.warningsAndPrecautions) {
        changes.push('Warnings and precautions modified');
    }
    if (label.sections?.adverseReactions) {
        changes.push('Adverse reactions section updated');
    }
    
    return changes.length > 0 ? changes : ['General label update'];
}

function compareLabelSections(sections1, sections2) {
    const allSections = new Set([
        ...Object.keys(sections1 || {}),
        ...Object.keys(sections2 || {})
    ]);
    
    const stats = {
        added: 0,
        removed: 0,
        modified: 0,
        unchanged: 0
    };
    
    const sections = [];
    
    allSections.forEach(sectionName => {
        const content1 = sections1?.[sectionName] || '';
        const content2 = sections2?.[sectionName] || '';
        
        if (!content1 && content2) {
            stats.added++;
            sections.push({
                name: sectionName,
                status: 'added',
                content: truncateText(content2, 500)
            });
        } else if (content1 && !content2) {
            stats.removed++;
            sections.push({
                name: sectionName,
                status: 'removed',
                content: truncateText(content1, 500)
            });
        } else if (content1 !== content2) {
            stats.modified++;
            sections.push({
                name: sectionName,
                status: 'modified',
                content: generateDiff(content1, content2)
            });
        } else if (content1 && content2) {
            stats.unchanged++;
            sections.push({
                name: sectionName,
                status: 'unchanged',
                content: truncateText(content1, 200)
            });
        }
    });
    
    return { stats, sections };
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function generateDiff(text1, text2, status) {
    if (status === 'added') {
        return `<div class="bg-green-50 p-2 border-l-4 border-green-500">${text2.substring(0, 500)}</div>`;
    } else if (status === 'removed') {
        return `<div class="bg-red-50 p-2 border-l-4 border-red-500 line-through">${text1.substring(0, 500)}</div>`;
    } else if (status === 'modified') {
        return `
            <div class="space-y-2">
                <div class="bg-red-50 p-2 border-l-4 border-red-500 line-through opacity-75">
                    <span class="text-xs text-red-700 font-semibold">OLD:</span><br>
                    ${text1.substring(0, 300)}
                </div>
                <div class="bg-green-50 p-2 border-l-4 border-green-500">
                    <span class="text-xs text-green-700 font-semibold">NEW:</span><br>
                    ${text2.substring(0, 300)}
                </div>
            </div>
        `;
    } else {
        return `<div class="bg-gray-50 p-2">${text1.substring(0, 500)}</div>`;
    }
}

// // Error handling middleware
// app.use((err, req, res, next) => {
//     console.error('❌ Server error:', err);
//     res.status(500).json({ 
//         error: 'Internal server error', 
//         message: err.message 
//     });
// });

// // Start server
// app.listen(port, () => {
//     console.log(`
//     🚀 Pharmaceutical Label Intelligence API Server
//     ================================================
//     Running on: http://localhost:${port}
    
//     Available Endpoints:
//     • GET  /api/comprehensive-search/:searchTerm
//     • GET  /api/label-content/:labelId
//     • POST /api/compare-labels
//     • POST /api/upload-label
//     • GET  /api/download-label/:labelId
    
//     Connected APIs:
//     ✓ FDA Drugs@FDA
//     ✓ FDA Labels
//     ✓ DailyMed
//     ✓ RxNorm
//     ✓ NDC Directory
//     ✓ Orange Book
    
//     Ready to serve requests...
//     ================================================
//     `);
// });

// // Package.json for the project
// const packageJson = {
//     "name": "pharma-label-intelligence",
//     "version": "1.0.0",
//     "description": "Comprehensive pharmaceutical label intelligence system",
//     "main": "server.js",
//     "scripts": {
//         "start": "node server.js",
//         "dev": "nodemon server.js"
//     },
//     "dependencies": {
//         "express": "^4.18.2",
//         "cors": "^2.8.5",
//         "axios": "^1.4.0",
//         "multer": "^1.4.5-lts.1",
//         "cheerio": "^1.0.0-rc.12",
//         "xml2js": "^0.6.0"
//     },
//     "devDependencies": {
//         "nodemon": "^3.0.1"
//     }
// };

// // Setup instructions
// const setupInstructions = `
// SETUP INSTRUCTIONS:
// ===================

// 1. Create a new directory for your project:
//    mkdir pharma-label-system
//    cd pharma-label-system

// 2. Create package.json:
//    Copy the package.json content above into a new file

// 3. Install dependencies:
//    npm install

// 4. Create the server.js file:
//    Copy all the server code into server.js

// 5. Create the index.html file:
//    Copy the frontend HTML code into index.html

// 6. Start the backend server:
//    npm start
//    (Server will run on http://localhost:3000)

// 7. Open the frontend:
//    Open index.html in your browser
//    Or serve it with a local server:
//    npx serve .

// 8. Start using the system:
//    - Search for drugs like "lisinopril", "metformin", etc.
//    - View timelines, compare labels, analyze companies
//    - Upload your own labels for comparison

// FEATURES:
// =========
// ✓ Comprehensive drug search across FDA, DailyMed, RxNorm, NDC
// ✓ Interactive timeline of label changes and approvals
// ✓ Side-by-side label comparison with diff highlighting
// ✓ Company analysis and competitive landscape
// ✓ Label upload and comparison
// ✓ PDF download of labels
// ✓ Real-time data from official FDA APIs
// ✓ Responsive, modern UI with smooth animations

// TROUBLESHOOTING:
// ================
// - If APIs are slow, be patient - FDA APIs can take a few seconds
// - Some drugs may not have complete data in all databases
// - CORS issues: Make sure the backend is running on port 3000
// - For production, add error handling and rate limiting
// `;

// console.log(setupInstructions);

// module.exports = app;

module.exports = router;




