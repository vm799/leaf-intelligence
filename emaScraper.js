const cheerio = require('cheerio');
const axios = require('axios');
const pdf = require('pdf-parse');
const OpenAI = require('openai');

/**
 * Complete EMA Drug Information Scraper - FIXED VERSION
 * Extracts all drug data, document links, and labeling information from PDFs
 * Optionally provides AI summaries of all content
 */
class EMACompleteScraper {
  constructor(config = {}) {
    this.baseUrl = 'https://www.ema.europa.eu';
    this.timeout = config.timeout || 60000;
    
    // OpenAI configuration for summaries
    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey
      });
      this.aiModel = config.aiModel || 'gpt-4-turbo-preview';
    }
    
    // User agent for requests
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
  }

  /**
   * Main entry point - accepts drug name or URL
   * @param {string} input - Drug name or full EMA URL
   * @param {Object} options - Options including AI summary
   * @returns {Object} Complete drug information with all data
   */
  async scrapeDrug(input, options = {}) {
    try {
      // Determine if input is URL or drug name
      let url;
      if (input.startsWith('http')) {
        url = input;
      } else {
        // Convert drug name to URL (basic approach - might need search in production)
        const drugName = input.toLowerCase().replace(/\s+/g, '-');
        url = `${this.baseUrl}/en/medicines/human/EPAR/${drugName}`;
      }

      console.log(`Fetching drug information from: ${url}`);

      // Fetch the main page with better error handling
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: this.headers,
        validateStatus: function (status) {
          return status < 500; // Resolve only if the status code is less than 500
        }
      });

      if (response.status === 404) {
        throw new Error(`Drug page not found: ${url}`);
      }

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Load HTML with Cheerio
      let $;
      try {
        $ = cheerio.load(response.data);
      } catch (cheerioError) {
        console.error('Cheerio loading error:', cheerioError);
        throw new Error(`Failed to parse HTML: ${cheerioError.message}`);
      }

      // Extract all information
      const drugData = {
        url: url,
        scrapedAt: new Date().toISOString(),
        basic: this.extractBasicInfo($),
        overview: this.extractOverview($),
        productDetails: this.extractProductDetails($),
        authorizationDetails: this.extractAuthorizationDetails($),
        documents: await this.extractAllDocuments($),
        assessmentHistory: this.extractAssessmentHistory($),
        relatedNews: this.extractRelatedNews($),
        relatedMedicines: this.extractRelatedMedicines($),
        timeline: this.extractTimeline($),
        labeling: null,
        aiSummary: null
      };

      // Extract labeling information from Product Information PDF
      console.log('Extracting labeling information from Product Information PDF...');
      drugData.labeling = await this.extractLabelingFromPDF(drugData.documents);

      // Generate AI summary if requested
      if (options.generateAISummary && this.openai) {
        console.log('Generating AI summary of all documents...');
        drugData.aiSummary = await this.generateAISummary(drugData);
      }

      return drugData;

    } catch (error) {
      console.error('Scraping error:', error);
      throw new Error(`Failed to scrape drug information: ${error.message}`);
    }
  }

  /**
   * Extract basic drug information
   */
  extractBasicInfo($) {
    try {
      return {
        name: $('.content-banner-title').text().trim() || 'Unknown',
        activeSubstance: $('.card-content-wrapper .fst-italic').text().trim() || 'Unknown',
        status: $('.medicine-status .status-title').text().trim() || 'Unknown',
        statusColor: $('.medicine-status').attr('data-medicine-color') || '',
        statusMessage: $('.medicine-status .status-message').text().trim() || '',
        category: $('.ema-bg-category').text().trim() || 'Unknown',
        type: $('.bundle-name').text().trim() || 'Unknown'
      };
    } catch (error) {
      console.error('Error extracting basic info:', error);
      return {
        name: 'Unknown',
        activeSubstance: 'Unknown',
        status: 'Unknown',
        statusColor: '',
        statusMessage: '',
        category: 'Unknown',
        type: 'Unknown'
      };
    }
  }

  /**
   * Extract overview with all accordion sections
   */
  extractOverview($) {
    try {
      const overview = {
        summary: $('#overview').nextAll('p').first().text().trim() || 'No summary available',
        sections: []
      };

      $('#accordion-bcl-accordion .accordion-item').each((i, item) => {
        try {
          const $item = $(item);
          const section = {
            title: $item.find('.accordion-button span').text().trim() || `Section ${i + 1}`,
            content: $item.find('.accordion-body').text().trim() || 'No content available',
            htmlContent: $item.find('.accordion-body').html()?.trim() || ''
          };
          overview.sections.push(section);
        } catch (sectionError) {
          console.error(`Error extracting section ${i}:`, sectionError);
        }
      });

      return overview;
    } catch (error) {
      console.error('Error extracting overview:', error);
      return {
        summary: 'Error extracting overview',
        sections: []
      };
    }
  }

  /**
   * Extract product details
   */
  extractProductDetails($) {
    try {
      const details = {};

      $('#product-details dl').find('dt').each((i, dt) => {
        try {
          const $dt = $(dt);
          const key = $dt.text().trim();
          const value = $dt.next('dd').text().trim();
          if (key && value) {
            details[this.normalizeKey(key)] = value;
          }
        } catch (detailError) {
          console.error(`Error extracting product detail ${i}:`, detailError);
        }
      });

      // Additional subsections
      try {
        details.pharmacotherapeuticGroup = $('.subsection h3:contains("Pharmacotherapeutic group")')
          .parent().text().replace('Pharmacotherapeutic group', '').trim() || 'Not available';
        
        details.therapeuticIndication = $('.subsection h3:contains("Therapeutic indication")')
          .next('p').text().trim() || 'Not available';
      } catch (subError) {
        console.error('Error extracting subsections:', subError);
      }

      return details;
    } catch (error) {
      console.error('Error extracting product details:', error);
      return {};
    }
  }

  /**
   * Extract authorization details
   */
  extractAuthorizationDetails($) {
    try {
      const auth = {};

      $('#authorisation-details dl').find('dt').each((i, dt) => {
        try {
          const $dt = $(dt);
          const key = $dt.text().trim();
          const value = $dt.next('dd').text().trim();
          if (key && value) {
            auth[this.normalizeKey(key)] = value;
          }
        } catch (authError) {
          console.error(`Error extracting authorization detail ${i}:`, authError);
        }
      });

      return auth;
    } catch (error) {
      console.error('Error extracting authorization details:', error);
      return {};
    }
  }

  /**
   * Extract all documents with complete metadata
   */
  async extractAllDocuments($) {
    try {
      const documents = {
        overview: [],
        productInformation: [],
        riskManagement: [],
        assessmentReports: [],
        allPresentations: [],
        conditions: [],
        proceduralStepsAfter: [],
        scientificConclusion: [],
        variationReport: [],
        smop: [],
        smopInitial: [],
        other: []
      };

      const self = this; // Store reference for use in callbacks

      $('.bcl-file').each((i, elem) => {
        try {
          const $file = $(elem);
          const doc = self.extractDocumentInfo($file, $); // Pass $ as second parameter
          
          if (!doc || !doc.title) {
            console.warn(`Skipping document ${i} - no title found`);
            return;
          }
          
          // Categorize by type using data-ema-document-type attribute
          const docType = $file.attr('data-ema-document-type') || '';
          const title = doc.title.toLowerCase();

          // Categorize based on the data-ema-document-type attribute first, then fallback to title matching
          switch (docType) {
            case 'overview':
              documents.overview.push(doc);
              break;
            case 'product-information':
              documents.productInformation.push(doc);
              break;
            case 'rmp':
              documents.riskManagement.push(doc);
              break;
            case 'assessment-report':
              documents.assessmentReports.push(doc);
              break;
            case 'all-authorised-presentations':
              documents.allPresentations.push(doc);
              break;
            case 'conditions-member-states':
              documents.conditions.push(doc);
              break;
            case 'procedural-steps-after':
              documents.proceduralStepsAfter.push(doc);
              break;
            case 'scientific-conclusion':
              documents.scientificConclusion.push(doc);
              break;
            case 'variation-report':
              documents.variationReport.push(doc);
              break;
            case 'smop':
              documents.smop.push(doc);
              break;
            case 'smop-initial':
              documents.smopInitial.push(doc);
              break;
            default:
              // Fallback to title-based categorization
              if (title.includes('overview')) {
                documents.overview.push(doc);
              } else if (title.includes('product information')) {
                documents.productInformation.push(doc);
              } else if (title.includes('risk') || title.includes('rmp')) {
                documents.riskManagement.push(doc);
              } else if (title.includes('assessment')) {
                documents.assessmentReports.push(doc);
              } else if (title.includes('procedural steps')) {
                documents.proceduralStepsAfter.push(doc);
              } else if (title.includes('scientific conclusion')) {
                documents.scientificConclusion.push(doc);
              } else if (title.includes('variation')) {
                documents.variationReport.push(doc);
              } else if (title.includes('summary') && title.includes('positive opinion')) {
                if (title.includes('post-authorisation')) {
                  documents.smop.push(doc);
                } else {
                  documents.smopInitial.push(doc);
                }
              } else {
                documents.other.push(doc);
              }
              break;
          }
        } catch (docError) {
          console.error(`Error extracting document ${i}:`, docError);
        }
      });

      return documents;
    } catch (error) {
      console.error('Error extracting documents:', error);
      return {
        overview: [],
        productInformation: [],
        riskManagement: [],
        assessmentReports: [],
        allPresentations: [],
        conditions: [],
        proceduralStepsAfter: [],
        scientificConclusion: [],
        variationReport: [],
        smop: [],
        smopInitial: [],
        other: []
      };
    }
  }

  /**
   * Extract detailed document information - FIXED VERSION
   */
  extractDocumentInfo($file, $) {
    try {
      const doc = {
        title: $file.find('.file-title').text().trim() || 'Unknown Document',
        type: $file.attr('data-ema-document-type') || 'unknown',
        referenceNumber: $file.find('.reference-number .value').text().trim() || 'N/A',
        status: $file.find('.file-metadata-row .value').first().text().trim() || 'Unknown',
        mainFile: {
          language: 'EN',
          languageCode: 'en',
          size: $file.find('.file-language-links .fw-normal').first().text().trim() || 'Unknown size',
          format: 'PDF',
          url: this.makeAbsoluteUrl($file.find('.file-language-links a.standalone').first().attr('href')),
          firstPublished: this.extractDate($file.find('.first-published')),
          lastUpdated: this.extractDate($file.find('.last-updated'))
        },
        availableLanguages: [],
        allFiles: []
      };

      // Add main file to allFiles
      if (doc.mainFile.url) {
        doc.allFiles.push({
          ...doc.mainFile,
          isPrimary: true
        });
      }

      // Extract all language versions - FIXED: Use cheerio.load instead of $file.constructor
      $file.find('.file-translations .py-3').each((i, trans) => {
        try {
          const $trans = $(trans); // Use the passed $ object directly
          const langText = $trans.find('.language-meta').text().trim();
          const langMatch = langText.match(/(.+?)\s*\(([A-Z]{2})\)/);
          
          if (langMatch) {
            const langFile = {
              language: langMatch[1].trim(),
              languageCode: langMatch[2],
              size: $trans.find('.fw-normal').text().trim() || 'Unknown size',
              format: 'PDF',
              url: this.makeAbsoluteUrl($trans.find('a.standalone').attr('href')),
              firstPublished: $trans.find('.first-published .value').text().trim() || 'Unknown',
              lastUpdated: $trans.find('.last-updated .value').text().trim() || 'Unknown',
              isPrimary: false
            };

            doc.availableLanguages.push(langFile.languageCode);
            doc.allFiles.push(langFile);
          }
        } catch (transError) {
          console.error(`Error extracting translation ${i}:`, transError);
        }
      });

      return doc;
    } catch (error) {
      console.error('Error extracting document info:', error);
      return {
        title: 'Error extracting document',
        type: 'unknown',
        referenceNumber: 'N/A',
        status: 'Unknown',
        mainFile: {
          language: 'EN',
          languageCode: 'en',
          size: 'Unknown',
          format: 'PDF',
          url: '',
          firstPublished: 'Unknown',
          lastUpdated: 'Unknown'
        },
        availableLanguages: [],
        allFiles: []
      };
    }
  }

  /**
   * Extract labeling information from Product Information PDF
   */
  async extractLabelingFromPDF(documents) {
    try {
      // Find the Product Information document
      const productInfoDoc = documents.productInformation.find(doc => 
        doc.title.includes('Product Information') && doc.mainFile.url
      );

      if (!productInfoDoc) {
        console.log('Product Information document not found');
        return {
          error: 'Product Information document not found',
          source: 'None'
        };
      }

      console.log(`Downloading Product Information PDF from: ${productInfoDoc.mainFile.url}`);

      // Download the PDF with better error handling
      const pdfResponse = await axios.get(productInfoDoc.mainFile.url, {
        responseType: 'arraybuffer',
        timeout: this.timeout,
        headers: this.headers,
        validateStatus: function (status) {
          return status < 500;
        }
      });

      if (pdfResponse.status >= 400) {
        throw new Error(`Failed to download PDF: HTTP ${pdfResponse.status}`);
      }

      // Parse PDF
      const pdfData = await pdf(pdfResponse.data);
      
      // Extract labeling section
      const labelingData = this.extractLabelingSectionFromText(pdfData.text);

      return {
        source: productInfoDoc.title,
        url: productInfoDoc.mainFile.url,
        extractedAt: new Date().toISOString(),
        fullText: labelingData.fullText,
        sections: labelingData.sections,
        structured: this.parseStructuredLabeling(labelingData.fullText)
      };

    } catch (error) {
      console.error('Error extracting labeling:', error.message);
      return {
        error: error.message,
        source: 'Product Information PDF'
      };
    }
  }

  /**
   * Extract labeling section from PDF text
   */
  extractLabelingSectionFromText(fullText) {
    try {
      const lines = fullText.split('\n');
      let inLabelingSection = false;
      let labelingText = '';
      const sections = [];
      let currentSection = null;

      // Look for different labeling section patterns
      const labelingPatterns = [
        /^ANNEX\s+III[AB]?[\s\S]*?LABELLING/i,
        /^A\.\s*LABELLING/i,
        /^LABELLING/i,
        /PARTICULARS TO APPEAR ON/i
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check for LABELLING section start with various patterns
        let foundLabelingStart = false;
        for (const pattern of labelingPatterns) {
          if (line.match(pattern)) {
            inLabelingSection = true;
            foundLabelingStart = true;
            currentSection = {
              title: 'LABELLING',
              content: []
            };
            sections.push(currentSection);
            break;
          }
        }

        if (foundLabelingStart) continue;

        // Check for section end patterns
        if (inLabelingSection && (
          line.match(/^B\.\s*PACKAGE LEAFLET/i) ||
          line.match(/^ANNEX\s+IV/i) ||
          line.match(/^4\.\s*CLINICAL PARTICULARS/i) ||
          (line.match(/^ANNEX/) && !line.match(/III/))
        )) {
          break;
        }

        // Collect labeling content
        if (inLabelingSection) {
          labelingText += line + '\n';
          
          // Look for specific labeling subsections
          if (line.match(/^[A-Z\s]+(?:OUTER|INNER|BLISTER|VIAL|AMPOULE|SYRINGE)/i) ||
              line.match(/PARTICULARS TO APPEAR ON/i) ||
              line.match(/^\d+\.\s*[A-Z]/)) {
            
            if (currentSection && currentSection.content.length > 0) {
              currentSection = {
                title: line,
                content: []
              };
              sections.push(currentSection);
            } else if (currentSection) {
              currentSection.title = line;
            }
          } else if (line && currentSection) {
            currentSection.content.push(line);
          }
        }
      }

      return {
        fullText: labelingText.trim(),
        sections: sections
      };
    } catch (error) {
      console.error('Error extracting labeling section:', error);
      return {
        fullText: 'Error extracting labeling text',
        sections: []
      };
    }
  }

  /**
   * Parse structured labeling information
   */
  parseStructuredLabeling(labelingText) {
    try {
      const structured = {
        outerPackaging: {},
        innerPackaging: {},
        blisters: {},
        vials: {},
        syringes: {},
        rawSections: []
      };

      // Enhanced labeling fields patterns
      const patterns = {
        productName: /(?:NAME OF THE MEDICINAL PRODUCT|TRADE NAME)[\s\S]*?\n\s*(.+?)(?:\n|$)/i,
        activeSubstance: /(?:STATEMENT OF ACTIVE SUBSTANCE|ACTIVE SUBSTANCE)[\s\S]*?\n\s*(.+?)(?:\n|$)/i,
        pharmaceuticalForm: /(?:PHARMACEUTICAL FORM AND CONTENTS|STRENGTH AND PHARMACEUTICAL FORM)[\s\S]*?\n\s*(.+?)(?:\n|$)/i,
        administration: /(?:METHOD AND ROUTE|ROUTE OF ADMINISTRATION)[\s\S]*?\n\s*(.+?)(?:\n|$)/i,
        marketingHolder: /(?:NAME AND ADDRESS OF THE MARKETING|MARKETING AUTHORISATION HOLDER)[\s\S]*?\n\s*([\s\S]+?)(?:\n\d+\.|$)/i,
        storageWarning: /(?:SPECIAL WARNING|WARNING).*?(?:CHILDREN|OUT OF REACH)[\s\S]*?\n\s*(.+?)(?:\n|$)/i,
        expiryDate: /EXPIRY DATE[\s\S]*?\n\s*(.+?)(?:\n|$)/i,
        batchNumber: /(?:BATCH NUMBER|LOT)[\s\S]*?\n\s*(.+?)(?:\n|$)/i,
        uniqueIdentifier: /UNIQUE IDENTIFIER[\s\S]*?\n\s*(.+?)(?:\n|$)/i,
        instructions: /(?:SPECIAL PRECAUTIONS|INSTRUCTIONS FOR USE)[\s\S]*?\n\s*(.+?)(?:\n|$)/i
      };

      // Extract structured data for outer packaging
      for (const [field, pattern] of Object.entries(patterns)) {
        try {
          const match = labelingText.match(pattern);
          if (match) {
            structured.outerPackaging[field] = match[1].trim();
          }
        } catch (patternError) {
          console.error(`Error matching pattern for ${field}:`, patternError);
        }
      }

      // Extract sections by packaging type
      try {
        const packagingSections = labelingText.match(/PARTICULARS TO APPEAR ON (.+?)\n([\s\S]+?)(?=PARTICULARS TO APPEAR ON|$)/gi);
        if (packagingSections) {
          packagingSections.forEach(section => {
            structured.rawSections.push(section.trim());
            
            // Categorize by packaging type
            const sectionLower = section.toLowerCase();
            if (sectionLower.includes('outer') || sectionLower.includes('carton')) {
              structured.outerPackaging.fullSection = section.trim();
            } else if (sectionLower.includes('inner') || sectionLower.includes('immediate')) {
              structured.innerPackaging.fullSection = section.trim();
            } else if (sectionLower.includes('blister')) {
              structured.blisters.fullSection = section.trim();
            } else if (sectionLower.includes('vial')) {
              structured.vials.fullSection = section.trim();
            } else if (sectionLower.includes('syringe')) {
              structured.syringes.fullSection = section.trim();
            }
          });
        }
      } catch (sectionError) {
        console.error('Error extracting packaging sections:', sectionError);
      }

      // Look for specific labeling elements
      try {
        const strengthMatch = labelingText.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|%|units?))/gi);
        if (strengthMatch) {
          structured.outerPackaging.strength = strengthMatch[0];
        }

        const packSizeMatch = labelingText.match(/(\d+(?:\s*x\s*\d+)*)\s*(?:tablets?|capsules?|vials?|ampoules?|ml)/gi);
        if (packSizeMatch) {
          structured.outerPackaging.packSize = packSizeMatch[0];
        }
      } catch (parseError) {
        console.error('Error parsing specific elements:', parseError);
      }

      return structured;
    } catch (error) {
      console.error('Error parsing structured labeling:', error);
      return {
        outerPackaging: {},
        innerPackaging: {},
        blisters: {},
        vials: {},
        syringes: {},
        rawSections: []
      };
    }
  }

  /**
   * Generate AI summary of all documents
   */
  async generateAISummary(drugData) {
    if (!this.openai) {
      return { error: 'OpenAI API key not configured' };
    }

    try {
      console.log('Collecting content from all PDFs for AI summary...');
      
      // Collect all PDF content
      const allContent = [];
      
      // Add basic drug information
      allContent.push(`Drug Name: ${drugData.basic.name}`);
      allContent.push(`Active Substance: ${drugData.basic.activeSubstance}`);
      allContent.push(`Status: ${drugData.basic.status}`);
      allContent.push(`\nOverview: ${drugData.overview.summary}`);
      
      // Add overview sections
      drugData.overview.sections.forEach(section => {
        allContent.push(`\n${section.title}:\n${section.content}`);
      });

      // Add labeling if extracted
      if (drugData.labeling && drugData.labeling.fullText) {
        allContent.push(`\nLabeling Information:\n${drugData.labeling.fullText}`);
      }

      // Create prompt for AI
      const prompt = `Please provide a comprehensive clinical summary of the following drug information:

${allContent.join('\n\n')}

Please structure your summary with the following sections:
1. Drug Overview (name, active substance, indication)
2. Mechanism of Action
3. Clinical Efficacy
4. Safety Profile and Adverse Effects
5. Dosing and Administration
6. Special Populations and Contraindications
7. Key Clinical Considerations

Keep the summary concise but comprehensive, focusing on clinically relevant information.`;

      const completion = await this.openai.chat.completions.create({
        model: this.aiModel,
        messages: [
          {
            role: 'system',
            content: 'You are a clinical pharmacist providing drug information summaries for healthcare professionals.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      return {
        summary: completion.choices[0].message.content,
        model: this.aiModel,
        generatedAt: new Date().toISOString(),
        contentLength: allContent.join('\n\n').length
      };

    } catch (error) {
      console.error('Error generating AI summary:', error.message);
      return {
        error: error.message,
        generatedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Extract assessment history
   */
  extractAssessmentHistory($) {
    try {
      const history = {
        changesAfterAuthorization: [],
        initialAuthorization: [],
        proceduralStepsAfter: [],
        scientificConclusions: [],
        variationReports: [],
        smops: [],
        smopInitials: []
      };

      const self = this; // Store reference for callbacks

      $('#assessment-history .accordion-item').each((i, item) => {
        try {
          const $item = $(item);
          const title = $item.find('.accordion-button').text().trim();
          const documents = [];

          $item.find('.bcl-file').each((j, file) => {
            try {
              const doc = self.extractDocumentInfo($(file), $);
              if (doc && doc.title) {
                documents.push(doc);
                
                // Also categorize by document type for assessment history
                const docType = $(file).attr('data-ema-document-type') || '';
                const docTitle = doc.title.toLowerCase();
                
                if (docType === 'procedural-steps-after' || docTitle.includes('procedural steps')) {
                  history.proceduralStepsAfter.push(doc);
                } else if (docType === 'scientific-conclusion' || docTitle.includes('scientific conclusion')) {
                  history.scientificConclusions.push(doc);
                } else if (docType === 'variation-report' || docTitle.includes('variation') || docTitle.includes('assessment report')) {
                  history.variationReports.push(doc);
                } else if (docType === 'smop' || (docTitle.includes('summary') && docTitle.includes('positive opinion') && docTitle.includes('post-authorisation'))) {
                  history.smops.push(doc);
                } else if (docType === 'smop-initial' || (docTitle.includes('summary') && docTitle.includes('positive opinion') && !docTitle.includes('post-authorisation'))) {
                  history.smopInitials.push(doc);
                }
              }
            } catch (fileError) {
              console.error(`Error extracting assessment file ${j}:`, fileError);
            }
          });

          if (title.includes('Changes since initial')) {
            history.changesAfterAuthorization = documents;
          } else if (title.includes('Initial marketing')) {
            history.initialAuthorization = documents;
          }
        } catch (itemError) {
          console.error(`Error extracting assessment item ${i}:`, itemError);
        }
      });

      return history;
    } catch (error) {
      console.error('Error extracting assessment history:', error);
      return {
        changesAfterAuthorization: [],
        initialAuthorization: [],
        proceduralStepsAfter: [],
        scientificConclusions: [],
        variationReports: [],
        smops: [],
        smopInitials: []
      };
    }
  }

  /**
   * Extract timeline
   */
  extractTimeline($) {
    try {
      const timeline = [];
      $('.ema-statuses-timeline .status').each((i, status) => {
        try {
          const $status = $(status);
          timeline.push({
            step: $status.text().trim() || `Step ${i + 1}`,
            isCompleted: $status.hasClass('checked'),
            isCurrent: $status.hasClass('current')
          });
        } catch (statusError) {
          console.error(`Error extracting timeline status ${i}:`, statusError);
        }
      });
      return timeline;
    } catch (error) {
      console.error('Error extracting timeline:', error);
      return [];
    }
  }

  /**
   * Extract related news
   */
  extractRelatedNews($) {
    try {
      const news = [];
      $('.related-news .views-row').each((i, row) => {
        try {
          const $row = $(row);
          const title = $row.find('.views-field-title a').text().trim();
          const url = this.makeAbsoluteUrl($row.find('.views-field-title a').attr('href'));
          const date = $row.find('time').attr('datetime') || $row.find('.views-field-field-ema-public-date').text().trim();
          
          if (title || url) {
            news.push({
              title: title || 'No title',
              url: url || '',
              date: date || 'No date'
            });
          }
        } catch (newsError) {
          console.error(`Error extracting news item ${i}:`, newsError);
        }
      });
      return news;
    } catch (error) {
      console.error('Error extracting related news:', error);
      return [];
    }
  }

  /**
   * Extract related medicines
   */
  extractRelatedMedicines($) {
    try {
      const medicines = [];
      $('#related-medicines ul li').each((i, item) => {
        try {
          const $link = $(item).find('a');
          const title = $link.text().trim();
          const url = this.makeAbsoluteUrl($link.attr('href'));
          
          if (title || url) {
            medicines.push({
              title: title || 'No title',
              url: url || ''
            });
          }
        } catch (medicineError) {
          console.error(`Error extracting medicine ${i}:`, medicineError);
        }
      });
      return medicines;
    } catch (error) {
      console.error('Error extracting related medicines:', error);
      return [];
    }
  }

  /**
   * Helper functions
   */
  normalizeKey(key) {
    return key.toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  makeAbsoluteUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return this.baseUrl + url;
  }

  extractDate($element) {
    try {
      if ($element.length === 0) return 'Unknown date';
      
      // Look for time element with datetime attribute first
      const datetime = $element.find('time').attr('datetime');
      if (datetime) return datetime;
      
      // Look for .value class
      const valueText = $element.find('.value').text().trim();
      if (valueText) return valueText;
      
      // Try direct time element
      const timeText = $element.find('time').text().trim();
      if (timeText) return timeText;
      
      // Fallback to element text
      const elementText = $element.text().trim();
      if (elementText) return elementText;
      
      return 'Unknown date';
    } catch (error) {
      return 'Unknown date';
    }
  }
}

/**
 * Command-line interface
 */
if (require.main === module) {
  const scraper = new EMACompleteScraper({
    openaiApiKey: process.env.OPENAI_API_KEY // Set this in your environment
  });

  const args = process.argv.slice(2);
  const input = args[0];
  const options = {
    generateAISummary: args.includes('--ai-summary')
  };

  if (!input) {
    console.log(`
Usage: node ema-complete-scraper.js <drug-name-or-url> [options]

Options:
  --ai-summary    Generate AI summary of all documents (requires OPENAI_API_KEY env var)

Examples:
  node ema-complete-scraper.js spravato
  node ema-complete-scraper.js "https://www.ema.europa.eu/en/medicines/human/EPAR/spravato"
  node ema-complete-scraper.js orserdu --ai-summary
`);
    process.exit(1);
  }

  scraper.scrapeDrug(input, options)
    .then(data => {
      // Save to file
      const filename = `${data.basic.name.toLowerCase().replace(/\s+/g, '_')}_complete_data.json`;
      require('fs').writeFileSync(filename, JSON.stringify(data, null, 2));
      console.log(`\nComplete data saved to: ${filename}`);
      
      // Display summary
      console.log('\n=== Summary ===');
      console.log(`Drug: ${data.basic.name}`);
      console.log(`Active Substance: ${data.basic.activeSubstance}`);
      console.log(`Status: ${data.basic.status}`);
      
      // Count all documents
      const totalDocs = Object.values(data.documents).flat().length;
      console.log(`Total Documents: ${totalDocs}`);
      
      // Show breakdown by document type
      console.log('\n=== Document Breakdown ===');
      Object.entries(data.documents).forEach(([type, docs]) => {
        if (docs.length > 0) {
          console.log(`${type}: ${docs.length} documents`);
        }
      });
      
      if (data.labeling) {
        if (data.labeling.error) {
          console.log(`\nLabeling Extraction Error: ${data.labeling.error}`);
        } else {
          console.log(`\nLabeling Extracted: ${data.labeling.sections ? data.labeling.sections.length : 0} sections`);
          console.log(`Labeling Text Length: ${data.labeling.fullText ? data.labeling.fullText.length : 0} characters`);
        }
      }
      
      if (data.aiSummary && data.aiSummary.summary) {
        console.log('\n=== AI Summary ===');
        console.log(data.aiSummary.summary);
      }
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

module.exports = EMACompleteScraper;