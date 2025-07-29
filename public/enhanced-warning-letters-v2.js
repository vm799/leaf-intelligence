// ===================================================================
// COMPLETE ENHANCED WARNING LETTERS V2 - Full System with View Details Integration
// Replace your entire enhanced-warning-letters-v2.js with this complete version
// ===================================================================

window.enhancedWarningLettersFixed = {
  state: {
    selectedCompanies: [],
    warningLetters: [],
    form483s: [],
    inspections: [],
    companies: [],
    metrics: {},
    commonViolations: [],
    drugMentions: [],
    loading: false
  },

  // Initialize with companies
  init: function(companies) {
    console.log('🚀 Initializing COMPLETE Enhanced Warning Letters for:', companies);
    this.state.selectedCompanies = companies || [];
    this.setupUI();
    if (companies && companies.length > 0) {
      this.performSearch(companies);
    }
  },

  // Setup UI (ensures dashboard exists)
  setupUI: function() {
    let container = document.getElementById('enhancedWLContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'enhancedWLContainer';
      container.className = 'mt-6';
      
      // Try multiple insertion strategies
      const targets = [
        () => document.getElementById('warningLetters'),
        () => document.querySelector('.fda-data-section'),
        () => document.querySelector('#companySummarySection'),
        () => document.body
      ];
      
      for (const getTarget of targets) {
        const target = getTarget();
        if (target) {
          if (target.id === 'warningLetters') {
            target.innerHTML = '';
            target.appendChild(container);
          } else {
            target.appendChild(container);
          }
          break;
        }
      }
    }
    
    this.renderDashboard();
  },

  // Render complete dashboard
  renderDashboard: function() {
    const container = document.getElementById('enhancedWLContainer');
    if (!container) return;

    container.innerHTML = `
      <!-- Metrics Cards -->
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Warning Letters & 483s Intelligence Dashboard</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-600">Total Warning Letters</p>
                <p class="text-2xl font-bold text-gray-900" id="totalWarningLetters">0</p>
              </div>
              <div class="p-3 bg-red-100 rounded-full">
                <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-600">Companies Affected</p>
                <p class="text-2xl font-bold text-gray-900" id="companiesAffected">0</p>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-600">Total Form 483s</p>
                <p class="text-2xl font-bold text-gray-900" id="totalForm483s">0</p>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-600">Total Inspections</p>
                <p class="text-2xl font-bold text-gray-900" id="totalInspections">0</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Company Table -->
      <div class="bg-white rounded-lg shadow mb-6">
        <div class="p-6 border-b">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-semibold">Company Regulatory Analysis</h3>
            <button onclick="window.enhancedWarningLettersFixed.refreshData()" 
                    class="px-3 py-2 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
              Refresh
            </button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warning Letters</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form 483s</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inspections</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody id="companyTableBody" class="bg-white divide-y divide-gray-200">
              <!-- Dynamic content -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Violations and Drugs -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div class="bg-white rounded-lg shadow">
          <div class="p-6 border-b">
            <h3 class="text-lg font-semibold">Most Common Violations</h3>
          </div>
          <div class="p-6">
            <div id="commonViolations">
              <!-- Dynamic content -->
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow">
          <div class="p-6 border-b">
            <h3 class="text-lg font-semibold">Drug/Compound Mentions</h3>
          </div>
          <div class="p-6">
            <div id="drugMentions">
              <!-- Dynamic content -->
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Perform comprehensive search
  performSearch: async function(companies) {
    console.log('🔍 MAIN SEARCH: Performing comprehensive search for:', companies);
    
    this.state.loading = true;
    this.state.selectedCompanies = companies;
    this.showLoading(true);

    try {
        let data = null;
        let usedBackend = false;

        // STEP 1: Try the comprehensive backend endpoint
        try {
            console.log('📡 Trying comprehensive backend endpoint...');
            const response = await fetch('/api/fda/comprehensive-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companies })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    data = result.data;
                    usedBackend = true;
                    console.log('✅ Using backend comprehensive endpoint');
                }
            } else {
                console.log(`Backend endpoint failed: ${response.status}`);
            }
        } catch (error) {
            console.log('Backend endpoint not available:', error.message);
        }

        // STEP 2: If backend fails, use ENHANCED fallback
        if (!data) {
            console.log('🔄 Backend failed, using ENHANCED fallback search...');
            data = await this.performEnhancedFallbackSearch(companies);
        }

        // STEP 3: Update state with results
        this.state.companies = data.companies || [];
        this.state.warningLetters = data.warningLetters || [];
        this.state.form483s = data.form483s || [];
        this.state.inspections = data.inspections || [];
        this.state.metrics = data.metrics || {};
        this.state.commonViolations = data.commonViolations || [];
        this.state.drugMentions = data.drugMentions || [];

        // STEP 4: Update UI
        this.updateDashboard();
        
        // STEP 5: Show results
        const totalRecords = this.state.warningLetters.length + this.state.form483s.length + this.state.inspections.length;
        console.log(`✅ MAIN SEARCH completed: ${totalRecords} total records (Backend: ${usedBackend})`);
        
        if (totalRecords > 0) {
            this.showSuccess(`Found ${totalRecords} regulatory records using ${usedBackend ? 'backend' : 'enhanced fallback'} search`);
        } else {
            this.showInfo('No regulatory records found. Companies may be clean or use different naming conventions.');
        }

    } catch (error) {
        console.error('❌ MAIN SEARCH failed:', error);
        this.showError('Search failed: ' + error.message);
    } finally {
        this.state.loading = false;
        this.showLoading(false);
    }
  },

  // Enhanced fallback search with deep inspection
  performEnhancedFallbackSearch: async function(companies) {
    console.log('🔄 ENHANCED FALLBACK: Starting comprehensive search...');
    
    const data = {
        companies: [],
        warningLetters: [],
        form483s: [],
        inspections: [],
        metrics: {},
        commonViolations: [],
        drugMentions: []
    };

    // ENHANCED SEARCH VARIATIONS GENERATOR
    const generateEnhancedVariations = (company) => {
        const variations = new Set();
        const original = company.trim();
        
        // 1. Original name
        variations.add(original);
        
        // 2. Remove common business suffixes
        const withoutSuffixes = original.replace(/\s+(INC|LLC|LTD|CORP|CORPORATION|COMPANY|CO|PHARMA|PHARMACEUTICALS|PHARMS|USA|OPERATIONS|MANUFACTURING|MFG|LABS|LABORATORIES|LLABS|MEDICAL|HEALTHCARE|THERAPEUTICS)\.?$/i, '').trim();
        if (withoutSuffixes !== original && withoutSuffixes.length > 2) {
            variations.add(withoutSuffixes);
        }
        
        // 3. Individual significant words
        const words = original.split(/\s+/).filter(w => w.length > 3 && !w.match(/^(INC|LLC|LTD|CORP|USA|CO|THE|AND|OF|FOR)$/i));
        words.forEach(word => variations.add(word));
        
        // 4. First significant word
        if (words.length > 0) {
            variations.add(words[0]);
        }
        
        // 5. Last significant word (often the key identifier)
        if (words.length > 1) {
            const lastWord = words[words.length - 1];
            if (!lastWord.match(/^(INC|LLC|LTD|CORP|USA|CO)$/i)) {
                variations.add(lastWord);
            }
        }
        
        // 6. First two words
        if (words.length > 1) {
            variations.add(words.slice(0, 2).join(' '));
        }
        
        return Array.from(variations).filter(v => v.length > 2).slice(0, 8);
    };

    // 1. ENHANCED WARNING LETTERS SEARCH
    console.log('📄 Searching Warning Letters with enhanced patterns...');
    const searchedWLTerms = new Set();
    
    for (const company of companies) {
        const variations = generateEnhancedVariations(company);
        console.log(`WL variations for "${company}":`, variations);
        
        let foundWL = false;
        
        for (const variation of variations) {
            if (foundWL || searchedWLTerms.has(variation.toLowerCase())) continue;
            searchedWLTerms.add(variation.toLowerCase());
            
            try {
                const params = new URLSearchParams({
                    term: variation,
                    field: 'company',
                    page: 1,
                    perPage: 200
                });
                
                const response = await fetch(`/api/wl/search?${params}`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.results?.length > 0) {
                        console.log(`✅ WL: Found ${result.results.length} results for "${variation}" → ${company}`);
                        result.results.forEach(wl => {
                            wl.sourceCompany = company;
                            wl.matchedTerm = variation;
                            data.warningLetters.push(wl);
                        });
                        foundWL = true;
                    }
                }
                
                // Small delay to avoid overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 50));
                
            } catch (error) {
                console.warn(`WL search failed for ${variation}:`, error.message);
            }
        }
    }

    // 2. ENHANCED FORM 483 SEARCH - Multiple strategies
    console.log('📋 Searching Form 483s with multiple strategies...');
    const searchedF483Terms = new Set();
    
    for (const company of companies) {
        const variations = generateEnhancedVariations(company);
        console.log(`483 variations for "${company}":`, variations);
        
        let foundF483 = false;
        
        // Strategy A: Direct API search
        for (const variation of variations) {
            if (foundF483 || searchedF483Terms.has(variation.toLowerCase())) continue;
            searchedF483Terms.add(variation.toLowerCase());
            
            try {
                const params = new URLSearchParams({
                    term: variation,
                    field: 'legalName',
                    page: 1,
                    perPage: 200
                });
                
                const response = await fetch(`/api/form483/search?${params}`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.results?.length > 0) {
                        console.log(`✅ 483 API: Found ${result.results.length} results for "${variation}" → ${company}`);
                        result.results.forEach(f483 => {
                            f483.sourceCompany = company;
                            f483.matchedTerm = variation;
                            data.form483s.push(f483);
                        });
                        foundF483 = true;
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 50));
                
            } catch (error) {
                console.warn(`483 API search failed for ${variation}:`, error.message);
            }
        }
        
        // Strategy B: Inspection data mining (if API search fails)
        if (!foundF483) {
            try {
                const inspectionResponse = await fetch('/api/inspection-data');
                if (inspectionResponse.ok) {
                    const inspectionData = await inspectionResponse.json();
                    
                    if (inspectionData.recentInspections) {
                        const matching483s = inspectionData.recentInspections.filter(item => {
                            const legalName = (item["Legal Name"] || '').toLowerCase();
                            const recordType = (item["Record Type"] || '').toLowerCase();
                            
                            // Check if it's a Form 483
                            const is483 = recordType.includes('483') || recordType === 'form 483' || recordType === 'citation';
                            
                            if (is483) {
                                // Check if any variation matches
                                return variations.some(variation => {
                                    const varLower = variation.toLowerCase();
                                    return legalName.includes(varLower) || 
                                           varLower.includes(legalName.split(' ')[0] || '') ||
                                           this.fuzzyMatchStrings(legalName, varLower);
                                });
                            }
                            return false;
                        });
                        
                        if (matching483s.length > 0) {
                            console.log(`✅ 483 Inspection: Found ${matching483s.length} results for ${company}`);
                            matching483s.forEach(f483 => {
                                f483.sourceCompany = company;
                                f483.matchedTerm = 'inspection_data';
                                // Normalize fields
                                f483.legalName = f483["Legal Name"];
                                f483.recordDate = f483["Record Date"];
                                f483.feiNumber = f483["FEI Number"];
                                data.form483s.push(f483);
                            });
                            foundF483 = true;
                        }
                    }
                }
            } catch (error) {
                console.warn(`483 inspection mining failed for ${company}:`, error.message);
            }
        }
    }

    // 3. ENHANCED INSPECTION SEARCH
    console.log('🏭 Searching Historical Inspections...');
    try {
        const response = await fetch('/api/inspection-data');
        if (response.ok) {
            const inspectionData = await response.json();
            
            if (inspectionData.historicalInspections) {
                companies.forEach(company => {
                    const variations = generateEnhancedVariations(company);
                    
                    const companyInspections = inspectionData.historicalInspections.filter(inspection => {
                        const firmName = (inspection["Firm Name"] || '').toLowerCase();
                        const legalName = (inspection["Legal Name"] || '').toLowerCase();
                        
                        return variations.some(variation => {
                            const varLower = variation.toLowerCase();
                            return firmName.includes(varLower) || 
                                   legalName.includes(varLower) ||
                                   varLower.includes(firmName.split(' ')[0] || '') ||
                                   varLower.includes(legalName.split(' ')[0] || '') ||
                                   this.fuzzyMatchStrings(firmName, varLower) ||
                                   this.fuzzyMatchStrings(legalName, varLower);
                        });
                    });
                    
                    companyInspections.forEach(inspection => {
                        inspection.sourceCompany = company;
                        data.inspections.push(inspection);
                    });
                    
                    if (companyInspections.length > 0) {
                        console.log(`✅ Inspections: Found ${companyInspections.length} results for ${company}`);
                    }
                });
            }
        }
    } catch (error) {
        console.warn('Inspection search failed:', error);
    }

    // 4. ENHANCED VIOLATION EXTRACTION
    console.log('⚗️ Extracting violations from content...');
    const violationCounts = {};
    const violationPatterns = [
        { regex: /data\s+integrity/gi, name: 'Data Integrity' },
        { regex: /contamination/gi, name: 'Contamination Control' },
        { regex: /quality\s+control/gi, name: 'Quality Control' },
        { regex: /validation/gi, name: 'Process Validation' },
        { regex: /documentation/gi, name: 'Documentation' },
        { regex: /manufacturing\s+practice/gi, name: 'Manufacturing Practices' },
        { regex: /sterility/gi, name: 'Sterility Assurance' },
        { regex: /labeling|labelling/gi, name: 'Labeling' },
        { regex: /cgmp|gmp/gi, name: 'CGMP Compliance' },
        { regex: /investigation/gi, name: 'Investigation Procedures' },
        { regex: /capa/gi, name: 'CAPA System' },
        { regex: /deviation/gi, name: 'Deviation Handling' },
        { regex: /specification/gi, name: 'Specification Compliance' },
        { regex: /cleaning/gi, name: 'Cleaning Procedures' },
        { regex: /testing/gi, name: 'Testing Procedures' },
        { regex: /raw\s+material/gi, name: 'Raw Material Control' },
        { regex: /batch\s+record/gi, name: 'Batch Records' },
        { regex: /environmental\s+monitoring/gi, name: 'Environmental Monitoring' },
        { regex: /stability/gi, name: 'Stability Testing' },
        { regex: /microbiological/gi, name: 'Microbiological Control' },
        { regex: /corrective\s+action/gi, name: 'Corrective Actions' },
        { regex: /preventive\s+action/gi, name: 'Preventive Actions' },
        { regex: /out\s+of\s+specification/gi, name: 'Out of Specification' },
        { regex: /oos/gi, name: 'OOS Investigations' }
    ];

    const processedItems = [...data.warningLetters, ...data.form483s];
    processedItems.forEach(item => {
        // Collect all text content
        const textSources = [
            item.fullContent,
            item.subject,
            item.content,
            item.excerpt,
            item.description,
            Array.isArray(item.parsedObservations) ? item.parsedObservations.join(' ') : item.parsedObservations
        ].filter(text => text && typeof text === 'string' && text.length > 10);
        
        const combinedText = textSources.join(' ');
        
        violationPatterns.forEach(({ regex, name }) => {
            const matches = combinedText.match(regex);
            if (matches) {
                violationCounts[name] = (violationCounts[name] || 0) + matches.length;
            }
        });
    });

    // 5. ENHANCED DRUG EXTRACTION
    console.log('💊 Extracting drug mentions from content...');
    const drugCounts = {};
    const knownDrugs = [
        'ketamine', 'esketamine', 'fentanyl', 'morphine', 'oxycodone', 'hydrocodone', 'codeine', 'tramadol',
        'insulin', 'metformin', 'lisinopril', 'atorvastatin', 'amlodipine', 'losartan', 'simvastatin',
        'amoxicillin', 'azithromycin', 'ciprofloxacin', 'doxycycline', 'cephalexin', 'clindamycin',
        'ibuprofen', 'acetaminophen', 'aspirin', 'naproxen', 'diclofenac', 'celecoxib',
        'propofol', 'midazolam', 'lidocaine', 'bupivacaine', 'sevoflurane', 'isoflurane',
        'sertraline', 'fluoxetine', 'citalopram', 'paroxetine', 'escitalopram', 'duloxetine',
        'omeprazole', 'pantoprazole', 'lansoprazole', 'esomeprazole', 'famotidine',
        'warfarin', 'rivaroxaban', 'apixaban', 'dabigatran', 'enoxaparin',
        'levothyroxine', 'methylphenidate', 'amphetamine', 'adderall', 'dextroamphetamine',
        'alprazolam', 'lorazepam', 'clonazepam', 'diazepam', 'temazepam',
        'prednisone', 'prednisolone', 'hydrocortisone', 'methylprednisolone',
        'gabapentin', 'pregabalin', 'topiramate', 'lamotrigine', 'levetiracetam',
        'adalimumab', 'etanercept', 'infliximab', 'rituximab', 'bevacizumab',
        'montelukast', 'albuterol', 'budesonide', 'fluticasone', 'salmeterol'
    ];

    processedItems.forEach(item => {
        const textSources = [
            item.fullContent,
            item.subject,
            item.content,
            item.excerpt,
            Array.isArray(item.parsedObservations) ? item.parsedObservations.join(' ') : item.parsedObservations
        ].filter(text => text && typeof text === 'string' && text.length > 10);
        
        const combinedText = textSources.join(' ').toLowerCase();
        
        knownDrugs.forEach(drug => {
            const drugRegex = new RegExp(`\\b${drug}\\b`, 'gi');
            const matches = combinedText.match(drugRegex);
            if (matches) {
                drugCounts[drug] = (drugCounts[drug] || 0) + matches.length;
            }
        });
    });

    // 6. BUILD COMPANY RESULTS with Enhanced Risk Assessment
    data.companies = companies.map(company => {
        const companyWLs = data.warningLetters.filter(wl => wl.sourceCompany === company);
        const companyF483s = data.form483s.filter(f => f.sourceCompany === company);
        const companyInspections = data.inspections.filter(i => i.sourceCompany === company);
        
        // Enhanced risk calculation
        let riskLevel = 'low';
        const wlCount = companyWLs.length;
        const f483Count = companyF483s.length;
        const totalIssues = wlCount + f483Count;
        
        // Recent activity check (last 2 years)
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        
        const recentWLs = companyWLs.filter(wl => {
            const date = new Date(wl.letterIssueDate);
            return date > twoYearsAgo;
        }).length;
        
        const recent483s = companyF483s.filter(f => {
            const date = new Date(f.recordDate || f["Record Date"]);
            return date > twoYearsAgo;
        }).length;
        
        // Risk level determination
        if (wlCount > 3 || totalIssues > 8 || (recentWLs > 1 && recent483s > 2)) {
            riskLevel = 'high';
        } else if (wlCount > 0 || f483Count > 3 || totalIssues > 3 || recentWLs > 0 || recent483s > 1) {
            riskLevel = 'medium';
        }
        
        console.log(`📊 ${company}: WL=${wlCount}, 483s=${f483Count}, Inspections=${companyInspections.length}, Risk=${riskLevel} (Recent: WL=${recentWLs}, 483s=${recent483s})`);
        
        return {
            name: company,
            warningLetterCount: wlCount,
            form483Count: f483Count,
            inspectionCount: companyInspections.length,
            riskLevel
        };
    });

    // 7. FINAL METRICS CALCULATION
    data.metrics = {
        totalWarningLetters: data.warningLetters.length,
        totalForm483s: data.form483s.length,
        totalInspections: data.inspections.length,
        companiesAffected: companies.length,
        escalationRate: '0%'
    };

    data.commonViolations = Object.entries(violationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([type, count]) => ({ type, count }));

    data.drugMentions = Object.entries(drugCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([name, mentions]) => ({ name, mentions, category: 'Pharmaceutical' }));

    console.log('✅ ENHANCED FALLBACK completed:', {
        warningLetters: data.warningLetters.length,
        form483s: data.form483s.length,
        inspections: data.inspections.length,
        violations: data.commonViolations.length,
        drugs: data.drugMentions.length,
        companies: data.companies.length
    });

    return data;
  },

  // Fuzzy string matching
  fuzzyMatchStrings: function(str1, str2, threshold = 0.5) {
    if (!str1 || !str2) return false;
    
    const words1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const words2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return false;
    
    let matches = 0;
    for (const word1 of words1) {
        for (const word2 of words2) {
            if (word1.includes(word2) || word2.includes(word1)) {
                matches++;
                break;
            }
        }
    }
    
    const similarity = matches / Math.max(words1.length, words2.length);
    return similarity >= threshold;
  },

  // Update dashboard display
  updateDashboard: function() {
    console.log('🖥️ Updating dashboard display...');
    
    // Update metrics
    this.safeSetText('totalWarningLetters', this.state.metrics.totalWarningLetters || 0);
    this.safeSetText('companiesAffected', this.state.metrics.companiesAffected || 0);
    this.safeSetText('totalForm483s', this.state.metrics.totalForm483s || 0);
    this.safeSetText('totalInspections', this.state.metrics.totalInspections || 0);

    // Update company table
    this.updateCompanyTable();
    
    // Update violations
    this.updateViolations();
    
    // Update drug mentions
    this.updateDrugMentions();
  },

  // Safe text setting
  safeSetText: function(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    } else {
      console.warn(`Element ${id} not found`);
    }
  },

  // Update company table
  updateCompanyTable: function() {
    const tbody = document.getElementById('companyTableBody');
    if (!tbody) {
      console.warn('Company table body not found');
      return;
    }

    if (this.state.companies.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-8 text-center text-gray-500">
            No companies found. Try different search terms.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.state.companies.map(company => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          ${company.name}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            ${company.warningLetterCount}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            ${company.form483Count}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            ${company.inspectionCount}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          ${this.getRiskBadge(company.riskLevel)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <button onclick="window.enhancedWarningLettersFixed.viewCompanyDetails('${company.name}')" 
                  class="text-indigo-600 hover:text-indigo-900">
            View Details
          </button>
        </td>
      </tr>
    `).join('');
  },

  // Get risk badge
  getRiskBadge: function(riskLevel) {
    const badges = {
      'low': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Low Risk</span>',
      'medium': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Medium Risk</span>',
      'high': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">High Risk</span>'
    };
    return badges[riskLevel] || '<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Unknown</span>';
  },

  // Update violations display
  updateViolations: function() {
    const container = document.getElementById('commonViolations');
    if (!container) return;

    if (!this.state.commonViolations || this.state.commonViolations.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-sm">No violation data available</p>';
      return;
    }

    container.innerHTML = this.state.commonViolations.map(violation => `
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <span class="text-sm text-gray-700 capitalize">${violation.type}</span>
        <span class="text-sm font-medium text-gray-900">${violation.count}</span>
      </div>
    `).join('');
  },

  // Update drug mentions display
  updateDrugMentions: function() {
    const container = document.getElementById('drugMentions');
    if (!container) return;

    if (!this.state.drugMentions || this.state.drugMentions.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-sm">No drug mention data available</p>';
      return;
    }

    container.innerHTML = this.state.drugMentions.map(drug => `
      <div class="flex justify-between items-center py-2 border-b border-gray-200">
        <div>
          <span class="text-sm font-medium text-gray-900 capitalize">${drug.name}</span>
          <span class="text-xs text-gray-500 ml-2">${drug.category}</span>
        </div>
        <span class="text-sm font-medium text-gray-900">${drug.mentions}</span>
      </div>
    `).join('');
  },

  // ===================================================================
  // VIEW DETAILS MODAL - COMPREHENSIVE COMPANY PROFILE
  // ===================================================================

  // View company details with comprehensive modal
  viewCompanyDetails: async function(companyName) {
    console.log(`🔍 Loading comprehensive details for: ${companyName}`);
    
    // Show loading modal first
    this.showLoading();
    
    try {
        // Fetch all data for this company in parallel
        const [warningLetters, inspectionData] = await Promise.all([
            this.fetchWarningLettersForCompany(companyName),
            this.fetchInspectionDataForCompany(companyName)
        ]);

        console.log(`📊 Data loaded for ${companyName}:`, {
            warningLetters: warningLetters.length,
            recentInspections: inspectionData.recentInspections.length,
            historicalInspections: inspectionData.historicalInspections.length
        });

        // Hide loading and show comprehensive modal
        this.hideLoading();
        this.showComprehensiveCompanyModal(companyName, warningLetters, inspectionData);

    } catch (error) {
        console.error('❌ Error loading company details:', error);
        this.hideLoading();
        this.showError(`Failed to load details for ${companyName}: ${error.message}`);
    }
  },

  // Fetch warning letters for a specific company
  fetchWarningLettersForCompany: async function(companyName) {
    try {
        const apiBaseUrl = window.API_BASE_URL || '/api';
        const response = await fetch(`${apiBaseUrl}/wl/search?term=${encodeURIComponent(companyName)}&field=companyName`);
        
        if (!response.ok) {
            throw new Error(`Warning letters fetch failed: ${response.status}`);
        }
        
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.warn('Warning letters fetch failed:', error);
        return [];
    }
  },

  // Fetch inspection data for a specific company
  fetchInspectionDataForCompany: async function(companyName) {
    try {
        const response = await fetch(`/api/inspection-data?company=${encodeURIComponent(companyName)}`);
        
        if (!response.ok) {
            throw new Error(`Inspection data fetch failed: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.warn('Inspection data fetch failed:', error);
        return { recentInspections: [], historicalInspections: [], projectAreas: [] };
    }
  },

  // Show comprehensive company modal
  showComprehensiveCompanyModal: function(companyName, warningLetters, inspectionData) {
    const { recentInspections, historicalInspections, projectAreas } = inspectionData;
    
    // Calculate summary statistics
    const totalWarningLetters = warningLetters.length;
    const totalForm483s = recentInspections.length;
    const totalInspections = historicalInspections.length;
    
    // Get risk level
    const riskLevel = this.calculateCompanyRisk(totalWarningLetters, totalForm483s, totalInspections);

    // Create comprehensive modal content
    const modalContent = `
        <div class="max-w-6xl mx-auto bg-white rounded-lg overflow-hidden">
            <!-- Company Header -->
            <div class="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-6">
                <div class="flex justify-between items-start">
                    <div>
                        <h2 class="text-2xl font-bold mb-2">${companyName}</h2>
                        <p class="text-indigo-100">Comprehensive Regulatory Profile</p>
                    </div>
                    <div class="text-right">
                        <div class="flex items-center space-x-2">
                            <span class="px-3 py-1 rounded-full text-sm font-medium ${this.getRiskBadgeClasses(riskLevel)}">
                                ${riskLevel}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Summary Statistics -->
            <div class="bg-gray-50 p-6 border-b">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div class="text-center">
                        <div class="text-3xl font-bold text-red-600">${totalWarningLetters}</div>
                        <div class="text-sm text-gray-600">Warning Letters</div>
                    </div>
                    <div class="text-center">
                        <div class="text-3xl font-bold text-yellow-600">${totalForm483s}</div>
                        <div class="text-sm text-gray-600">Form 483s</div>
                    </div>
                    <div class="text-center">
                        <div class="text-3xl font-bold text-blue-600">${totalInspections}</div>
                        <div class="text-sm text-gray-600">Total Inspections</div>
                    </div>
                    <div class="text-center">
                        <div class="text-3xl font-bold text-green-600">${projectAreas.length}</div>
                        <div class="text-sm text-gray-600">Project Areas</div>
                    </div>
                </div>
            </div>

            <!-- Tabbed Content -->
            <div class="bg-white">
                <!-- Tab Navigation -->
                <div class="border-b border-gray-200">
                    <nav class="flex space-x-8 px-6" aria-label="Tabs">
                        <button onclick="window.enhancedWarningLettersFixed.switchDetailTab('warningLetters')" 
                                class="detail-tab-btn border-b-2 border-red-500 text-red-600 py-4 px-1 text-sm font-medium"
                                data-tab="warningLetters">
                            Warning Letters (${totalWarningLetters})
                        </button>
                        <button onclick="window.enhancedWarningLettersFixed.switchDetailTab('form483s')" 
                                class="detail-tab-btn border-b-2 border-transparent text-gray-500 hover:text-gray-700 py-4 px-1 text-sm font-medium"
                                data-tab="form483s">
                            Form 483s (${totalForm483s})
                        </button>
                        <button onclick="window.enhancedWarningLettersFixed.switchDetailTab('inspections')" 
                                class="detail-tab-btn border-b-2 border-transparent text-gray-500 hover:text-gray-700 py-4 px-1 text-sm font-medium"
                                data-tab="inspections">
                            Inspections (${totalInspections})
                        </button>
                        <button onclick="window.enhancedWarningLettersFixed.switchDetailTab('timeline')" 
                                class="detail-tab-btn border-b-2 border-transparent text-gray-500 hover:text-gray-700 py-4 px-1 text-sm font-medium"
                                data-tab="timeline">
                            Timeline
                        </button>
                    </nav>
                </div>

                <!-- Tab Content -->
                <div class="p-6" style="max-height: 600px; overflow-y: auto;">
                    <!-- Warning Letters Tab -->
                    <div id="warningLetters-detail-content" class="detail-tab-content">
                        ${this.createWarningLettersDetailHTML(warningLetters)}
                    </div>

                    <!-- Form 483s Tab -->
                    <div id="form483s-detail-content" class="detail-tab-content hidden">
                        ${this.createForm483sDetailHTML(recentInspections)}
                    </div>

                    <!-- Inspections Tab -->
                    <div id="inspections-detail-content" class="detail-tab-content hidden">
                        ${this.createInspectionsDetailHTML(historicalInspections)}
                    </div>

                    <!-- Timeline Tab -->
                    <div id="timeline-detail-content" class="detail-tab-content hidden">
                        ${this.createTimelineDetailHTML(warningLetters, recentInspections, historicalInspections)}
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
                <div class="text-sm text-gray-500">
                    Last updated: ${new Date().toLocaleDateString()}
                </div>
                <div class="flex space-x-3">
                    <button onclick="window.enhancedWarningLettersFixed.exportCompanyReport('${companyName}')" 
                            class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm">
                        Export Report
                    </button>
                    <button onclick="window.enhancedWarningLettersFixed.closeModal('comprehensiveCompanyModal')" 
                            class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;

    // Create and show modal
    const modal = document.createElement('div');
    modal.id = 'comprehensiveCompanyModal';
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
    
    modal.innerHTML = `
        <div class="relative min-h-screen flex items-center justify-center p-4">
            ${modalContent}
        </div>
    `;

    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            this.closeModal('comprehensiveCompanyModal');
        }
    });
  },

  // Switch detail tabs
  switchDetailTab: function(tabName) {
    // Update tab buttons
    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
        btn.className = btn.className.replace(/border-\w+-500 text-\w+-600/, 'border-transparent text-gray-500 hover:text-gray-700');
    });
    
    document.querySelector(`[data-tab="${tabName}"]`).className = 
        document.querySelector(`[data-tab="${tabName}"]`).className.replace(/border-transparent text-gray-500 hover:text-gray-700/, 'border-red-500 text-red-600');

    // Update content
    document.querySelectorAll('.detail-tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    document.getElementById(`${tabName}-detail-content`).classList.remove('hidden');
  },

  // Create warning letters detail HTML
  createWarningLettersDetailHTML: function(warningLetters) {
    if (warningLetters.length === 0) {
        return `
            <div class="text-center py-8 text-gray-500">
                <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <p class="text-lg font-medium">No Warning Letters Found</p>
                <p class="text-sm">This company has no warning letters in our database.</p>
            </div>
        `;
    }

    return `
        <div class="space-y-6">
            ${warningLetters.map(letter => `
                <div class="border border-gray-200 rounded-lg overflow-hidden">
                    <!-- Letter Header -->
                    <div class="bg-red-50 border-b border-red-100 px-6 py-4">
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="text-lg font-semibold text-gray-900">${letter.subject || 'Warning Letter'}</h4>
                                <div class="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span class="text-gray-500">Date:</span>
                                        <span class="font-medium ml-1">${this.formatDate(letter.letterIssueDate)}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-500">Letter ID:</span>
                                        <span class="font-medium ml-1">${letter.letterId || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-500">Office:</span>
                                        <span class="font-medium ml-1">${letter.issuingOffice || 'N/A'}</span>
                                    </div>
                                    <div>
                                        ${letter.companyUrl ? `
                                            <a href="${letter.companyUrl}" target="_blank" 
                                               class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                                View on FDA.gov →
                                            </a>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Letter Content -->
                    <div class="px-6 py-4">
                        <div class="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                            <h5 class="font-medium text-gray-900 mb-3">Letter Content:</h5>
                            <div class="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                                ${letter.fullContent || letter.excerpt || 'Content not available'}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
  },

  // Create Form 483s detail HTML
  createForm483sDetailHTML: function(form483s) {
    if (form483s.length === 0) {
        return `
            <div class="text-center py-8 text-gray-500">
                <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <p class="text-lg font-medium">No Form 483s Found</p>
                <p class="text-sm">This company has no recent Form 483 citations in our database.</p>
            </div>
        `;
    }

    return `
        <div class="overflow-x-auto">
            <table class="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
                <thead class="bg-yellow-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FEI Number</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Record Type</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Download</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${form483s.map(form483 => `
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                ${this.formatDate(form483["Record Date"])}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                ${form483["FEI Number"] || 'N/A'}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                                    ${form483["Record Type"] || 'Citation'}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                ${form483["Download"] ? `
                                    <a href="https://www.fda.gov/media/${form483["Download"]}" 
                                       target="_blank" 
                                       class="inline-flex items-center text-blue-600 hover:text-blue-800">
                                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                        </svg>
                                        Download PDF
                                    </a>
                                ` : '<span class="text-gray-400">N/A</span>'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
  },

  // Create inspections detail HTML
  createInspectionsDetailHTML: function(inspections) {
    if (inspections.length === 0) {
        return `
            <div class="text-center py-8 text-gray-500">
                <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-lg font-medium">No Historical Inspections Found</p>
                <p class="text-sm">This company has no historical inspection records in our database.</p>
            </div>
        `;
    }

    return `
        <div class="overflow-x-auto">
            <table class="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
                <thead class="bg-blue-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Area</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classification</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${inspections.slice(0, 50).map(inspection => `
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                ${this.formatDate(inspection["Inspection End Date"])}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                ${[inspection["City"], inspection["State"]].filter(Boolean).join(', ') || 'N/A'}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                    ${inspection["Project Area"] || 'Unknown'}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 py-1 text-xs font-medium rounded-full ${this.getClassificationColor(inspection["Inspection Classification"])}">
                                    ${inspection["Inspection Classification"] || 'N/A'}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${inspections.length > 50 ? `
                <div class="text-center py-4 text-sm text-gray-500">
                    Showing 50 of ${inspections.length} inspections
                </div>
            ` : ''}
        </div>
    `;
  },

  // Create timeline detail HTML
  createTimelineDetailHTML: function(warningLetters, form483s, inspections) {
    // Combine all events into timeline
    const timelineEvents = [];

    // Add warning letters
    warningLetters.forEach(wl => {
        timelineEvents.push({
            date: new Date(wl.letterIssueDate),
            type: 'warning-letter',
            title: 'Warning Letter Issued',
            description: wl.subject || 'Warning Letter',
            severity: 'high',
            details: wl
        });
    });

    // Add Form 483s
    form483s.forEach(f483 => {
        timelineEvents.push({
            date: new Date(f483["Record Date"]),
            type: 'form-483',
            title: 'Form 483 Citation',
            description: `FEI: ${f483["FEI Number"] || 'N/A'}`,
            severity: 'medium',
            details: f483
        });
    });

    // Add inspections (limit to recent ones)
    inspections.slice(0, 20).forEach(inspection => {
        timelineEvents.push({
            date: new Date(inspection["Inspection End Date"]),
            type: 'inspection',
            title: `Inspection - ${inspection["Inspection Classification"] || 'N/A'}`,
            description: `${inspection["Project Area"] || 'Unknown'} - ${inspection["City"] || ''}, ${inspection["State"] || ''}`,
            severity: inspection["Inspection Classification"] === 'OAI' ? 'high' : 
                      inspection["Inspection Classification"] === 'VAI' ? 'medium' : 'low',
            details: inspection
        });
    });

    // Sort by date (newest first)
    timelineEvents.sort((a, b) => b.date - a.date);

    if (timelineEvents.length === 0) {
        return `
            <div class="text-center py-8 text-gray-500">
                <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-lg font-medium">No Timeline Events</p>
                <p class="text-sm">No regulatory events found for this company.</p>
            </div>
        `;
    }

return `
        <div class="flow-root">
            <ul class="-mb-8">
                ${timelineEvents.map((event, index) => `
                    <li>
                        <div class="relative pb-8">
                            ${index < timelineEvents.length - 1 ? `
                                <span class="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                            ` : ''}
                            <div class="relative flex space-x-3">
                                <div>
                                    <span class="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${this.getEventColor(event.type, event.severity)}">
                                        ${this.getEventIcon(event.type)}
                                    </span>
                                </div>
                                <div class="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                    <div>
                                        <p class="text-sm font-medium text-gray-900">${event.title}</p>
                                        <p class="text-sm text-gray-500">${event.description}</p>
                                    </div>
                                    <div class="text-right text-sm whitespace-nowrap text-gray-500">
                                        ${this.formatDate(event.date)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
  },

  // ===================================================================
  // UTILITY FUNCTIONS FOR VIEW DETAILS MODAL
  // ===================================================================

  // Calculate company risk
  calculateCompanyRisk: function(warningLetters, form483s, inspections) {
    const score = (warningLetters * 3) + (form483s * 2) + (inspections * 0.1);
    
    if (score >= 10) return 'High Risk';
    if (score >= 5) return 'Medium Risk';
    return 'Low Risk';
  },

  // Get risk badge classes
  getRiskBadgeClasses: function(riskLevel) {
    switch (riskLevel.toLowerCase().replace(' risk', '')) {
        case 'high': return 'bg-red-100 text-red-800';
        case 'medium': return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-green-100 text-green-800';
    }
  },

  // Get classification color
  getClassificationColor: function(classification) {
    switch (classification?.toUpperCase()) {
        case 'OAI': return 'bg-red-100 text-red-800';
        case 'VAI': return 'bg-yellow-100 text-yellow-800';
        case 'NAI': return 'bg-green-100 text-green-800';
        default: return 'bg-gray-100 text-gray-800';
    }
  },

  // Get event color
  getEventColor: function(type, severity) {
    if (type === 'warning-letter') return 'bg-red-500';
    if (type === 'form-483') return 'bg-yellow-500';
    if (severity === 'high') return 'bg-red-500';
    if (severity === 'medium') return 'bg-yellow-500';
    return 'bg-green-500';
  },

  // Get event icon
  getEventIcon: function(type) {
    const iconClass = "h-5 w-5 text-white";
    
    if (type === 'warning-letter') {
        return `<svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>`;
    }
    
    if (type === 'form-483') {
        return `<svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>`;
    }
    
    return `<svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>`;
  },

  // Format date
  formatDate: function(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
  },

  // Export company report
  exportCompanyReport: function(companyName) {
    console.log(`Exporting report for ${companyName}`);
    this.showInfo(`Export functionality for ${companyName} will be implemented soon!`);
  },

  // Close modal
  closeModal: function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
  },

  // ===================================================================
  // COMPOUND PROFILE AND VIOLATION ANALYSIS
  // ===================================================================

  // View compound profile
  viewCompoundProfile: function(compoundName) {
    console.log(`🧪 Loading compound profile for: ${compoundName}`);
    
    // Filter mentions from current data
    const compoundMentions = [];
    
    // Search in warning letters
    this.state.warningLetters.forEach(wl => {
        const textSources = [
            wl.fullContent,
            wl.subject,
            wl.excerpt
        ].filter(text => text && typeof text === 'string');
        
        const combinedText = textSources.join(' ').toLowerCase();
        const compoundRegex = new RegExp(`\\b${compoundName.toLowerCase()}\\b`, 'gi');
        const matches = combinedText.match(compoundRegex);
        
        if (matches) {
            compoundMentions.push({
                type: 'Warning Letter',
                company: wl.sourceCompany || wl.companyName,
                date: wl.letterIssueDate,
                context: this.extractContext(combinedText, compoundName.toLowerCase()),
                document: wl
            });
        }
    });
    
    // Search in Form 483s
    this.state.form483s.forEach(f483 => {
        const textSources = [
            f483.content,
            f483.description,
            Array.isArray(f483.parsedObservations) ? f483.parsedObservations.join(' ') : f483.parsedObservations
        ].filter(text => text && typeof text === 'string');
        
        const combinedText = textSources.join(' ').toLowerCase();
        const compoundRegex = new RegExp(`\\b${compoundName.toLowerCase()}\\b`, 'gi');
        const matches = combinedText.match(compoundRegex);
        
        if (matches) {
            compoundMentions.push({
                type: 'Form 483',
                company: f483.sourceCompany || f483.legalName,
                date: f483.recordDate || f483["Record Date"],
                context: this.extractContext(combinedText, compoundName.toLowerCase()),
                document: f483
            });
        }
    });

    this.showCompoundModal(compoundName, compoundMentions);
  },

  // Extract context around compound mention
  extractContext: function(text, compound, contextLength = 100) {
    const index = text.toLowerCase().indexOf(compound.toLowerCase());
    if (index === -1) return 'No context available';
    
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + compound.length + contextLength);
    
    let context = text.substring(start, end);
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    // Highlight the compound
    const regex = new RegExp(`(${compound})`, 'gi');
    return context.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
  },

  // Show compound modal
  showCompoundModal: function(compoundName, mentions) {
    const modalContent = `
        <div class="max-w-4xl mx-auto bg-white rounded-lg overflow-hidden">
            <!-- Compound Header -->
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
                <div class="flex justify-between items-start">
                    <div>
                        <h2 class="text-2xl font-bold mb-2">${compoundName}</h2>
                        <p class="text-blue-100">Compound Regulatory Profile</p>
                    </div>
                    <div class="text-right">
                        <div class="text-3xl font-bold">${mentions.length}</div>
                        <div class="text-sm text-blue-100">Total Mentions</div>
                    </div>
                </div>
            </div>

            <!-- Summary Statistics -->
            <div class="bg-gray-50 p-6 border-b">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-red-600">${mentions.filter(m => m.type === 'Warning Letter').length}</div>
                        <div class="text-sm text-gray-600">Warning Letter Mentions</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-yellow-600">${mentions.filter(m => m.type === 'Form 483').length}</div>
                        <div class="text-sm text-gray-600">Form 483 Mentions</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-blue-600">${new Set(mentions.map(m => m.company)).size}</div>
                        <div class="text-sm text-gray-600">Companies Involved</div>
                    </div>
                </div>
            </div>

            <!-- Mentions List -->
            <div class="p-6" style="max-height: 500px; overflow-y: auto;">
                ${mentions.length > 0 ? `
                    <div class="space-y-4">
                        ${mentions.map(mention => `
                            <div class="border border-gray-200 rounded-lg p-4">
                                <div class="flex justify-between items-start mb-2">
                                    <div>
                                        <span class="px-2 py-1 text-xs font-medium rounded-full ${mention.type === 'Warning Letter' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
                                            ${mention.type}
                                        </span>
                                        <span class="ml-2 font-medium text-gray-900">${mention.company}</span>
                                    </div>
                                    <span class="text-sm text-gray-500">${this.formatDate(mention.date)}</span>
                                </div>
                                <div class="text-sm text-gray-700 mt-2">
                                    <strong>Context:</strong> ${mention.context}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="text-center py-8 text-gray-500">
                        <p class="text-lg font-medium">No Mentions Found</p>
                        <p class="text-sm">This compound was not found in the current regulatory documents.</p>
                    </div>
                `}
            </div>

            <!-- Action Buttons -->
            <div class="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
                <div class="text-sm text-gray-500">
                    Compound analysis based on current search results
                </div>
                <button onclick="window.enhancedWarningLettersFixed.closeModal('compoundModal')" 
                        class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm">
                    Close
                </button>
            </div>
        </div>
    `;

    // Create and show modal
    const modal = document.createElement('div');
    modal.id = 'compoundModal';
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
    
    modal.innerHTML = `
        <div class="relative min-h-screen flex items-center justify-center p-4">
            ${modalContent}
        </div>
    `;

    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            this.closeModal('compoundModal');
        }
    });
  },

  // ===================================================================
  // GENERAL UTILITY FUNCTIONS
  // ===================================================================

  // Refresh data
  refreshData: function() {
    if (this.state.selectedCompanies.length > 0) {
      this.performSearch(this.state.selectedCompanies);
    }
  },

  // Show loading state
  showLoading: function(show) {
    if (show) {
        // Create loading overlay if it doesn't exist
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            overlay.innerHTML = `
                <div class="bg-white rounded-lg p-6 text-center">
                    <svg class="animate-spin h-8 w-8 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p class="text-gray-600">Loading regulatory data...</p>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    } else {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
  },

  // Hide loading state  
  hideLoading: function() {
    this.showLoading(false);
  },

  // Show success message
  showSuccess: function(message) {
    console.log('✅', message);
    if (window.WLshowToast) {
      window.WLshowToast(message, 'success');
    } else {
      this.showNotification(message, 'success');
    }
  },

  // Show info message
  showInfo: function(message) {
    console.log('ℹ️', message);
    if (window.WLshowToast) {
      window.WLshowToast(message, 'info');
    } else {
      this.showNotification(message, 'info');
    }
  },

  // Show error message
  showError: function(message) {
    console.error('❌', message);
    if (window.WLshowToast) {
      window.WLshowToast(message, 'error');
    } else {
      this.showNotification(message, 'error');
    }
  },

  // Generic notification system (fallback)
  showNotification: function(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-md transform transition-all duration-300 ${
      type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
      type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
      'bg-blue-100 text-blue-800 border border-blue-200'
    }`;
    
    notification.innerHTML = `
      <div class="flex items-center">
        <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
          ${type === 'error' ? 
            '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>' :
            type === 'success' ?
            '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>' :
            '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>'
          }
        </svg>
        <span class="text-sm font-medium">${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-auto text-current opacity-70 hover:opacity-100">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.classList.add('opacity-0');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, 5000);
  }
};

// ===================================================================
// GLOBAL INTEGRATION AND INITIALIZATION
// ===================================================================

// Create global aliases for backward compatibility
window.enhancedWarningLetters = window.enhancedWarningLettersFixed;
window.enhancedWL = window.enhancedWarningLettersFixed;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('🎯 Enhanced Warning Letters v2 system loaded and ready');
  
  // Check for existing search functionality integration
  if (typeof searchWarningLetters === 'function') {
    console.log('✅ Found existing searchWarningLetters function - integrating...');
    
    // Override existing search function to use our enhanced system
    const originalSearchWarningLetters = window.searchWarningLetters;
    window.searchWarningLetters = function(companies) {
      console.log('🔄 Redirecting to enhanced warning letters system:', companies);
      
      if (Array.isArray(companies) && companies.length > 0) {
        window.enhancedWarningLettersFixed.init(companies);
      } else {
        console.warn('Invalid companies parameter:', companies);
      }
    };
  }
  
  // Check for existing searchCompanies function integration
  if (typeof searchCompanies === 'function') {
    console.log('✅ Found existing searchCompanies function - enhancing...');
    
    const originalSearchCompanies = window.searchCompanies;
    window.searchCompanies = async function() {
      // Call original function first
      await originalSearchCompanies();
      
      // Then enhance with our system
      const searchInput = document.getElementById('search-input');
      if (searchInput && searchInput.value.trim()) {
        const companies = searchInput.value.split(',')
          .map(company => company.trim())
          .filter(company => company.length > 0);
        
        if (companies.length > 0) {
          console.log('🔄 Enhancing search results with advanced warning letters system');
          window.enhancedWarningLettersFixed.init(companies);
        }
      }
    };
  }
  
  console.log('🎉 Enhanced Warning Letters v2 integration complete!');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.enhancedWarningLettersFixed;
}

console.log('✅ Enhanced Warning Letters v2 - Complete system loaded with:');
console.log('   📊 Comprehensive dashboard with metrics');
console.log('   🔍 Enhanced search with multiple strategies');
console.log('   📋 Full warning letter content display');
console.log('   📄 Form 483 integration with download links');
console.log('   🏭 Historical inspection data');
console.log('   📈 Timeline view of all regulatory events');
console.log('   💊 Drug/compound mention tracking');
console.log('   ⚗️ Common violations analysis');
console.log('   🎯 Risk assessment and classification');
console.log('   📱 Responsive design with modern UI');


// window.enhancedWarningLettersFixed = {
//   state: {
//     selectedCompanies: [],
//     warningLetters: [],
//     form483s: [],
//     inspections: [],
//     companies: [],
//     metrics: {},
//     commonViolations: [],
//     drugMentions: [],
//     loading: false
//   },

//   // Initialize with companies
//   init: function(companies) {
//     console.log('🚀 Initializing FIXED Enhanced Warning Letters for:', companies);
//     this.state.selectedCompanies = companies || [];
//     this.setupUI();
//     if (companies && companies.length > 0) {
//       this.performSearch(companies);
//     }
//   },

//   // Setup UI (ensures dashboard exists)
//   setupUI: function() {
//     let container = document.getElementById('enhancedWLContainer');
//     if (!container) {
//       container = document.createElement('div');
//       container.id = 'enhancedWLContainer';
//       container.className = 'mt-6';
      
//       // Try multiple insertion strategies
//       const targets = [
//         () => document.getElementById('warningLetters'),
//         () => document.querySelector('.fda-data-section'),
//         () => document.querySelector('#companySummarySection'),
//         () => document.body
//       ];
      
//       for (const getTarget of targets) {
//         const target = getTarget();
//         if (target) {
//           if (target.id === 'warningLetters') {
//             target.innerHTML = '';
//             target.appendChild(container);
//           } else {
//             target.appendChild(container);
//           }
//           break;
//         }
//       }
//     }
    
//     this.renderDashboard();
//   },

//   // Render complete dashboard
//   renderDashboard: function() {
//     const container = document.getElementById('enhancedWLContainer');
//     if (!container) return;

//     container.innerHTML = `
//       <!-- Metrics Cards -->
//       <div class="mb-6">
//         <h2 class="text-2xl font-bold text-gray-900 mb-4">Warning Letters & 483s Intelligence Dashboard</h2>
        
//         <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
//           <div class="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
//             <div class="flex items-center justify-between">
//               <div>
//                 <p class="text-sm font-medium text-gray-600">Total Warning Letters</p>
//                 <p class="text-2xl font-bold text-gray-900" id="totalWarningLetters">0</p>
//               </div>
//               <div class="p-3 bg-red-100 rounded-full">
//                 <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
//                 </svg>
//               </div>
//             </div>
//           </div>
          
//           <div class="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
//             <div class="flex items-center justify-between">
//               <div>
//                 <p class="text-sm font-medium text-gray-600">Companies Affected</p>
//                 <p class="text-2xl font-bold text-gray-900" id="companiesAffected">0</p>
//               </div>
//             </div>
//           </div>
          
//           <div class="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
//             <div class="flex items-center justify-between">
//               <div>
//                 <p class="text-sm font-medium text-gray-600">Total Form 483s</p>
//                 <p class="text-2xl font-bold text-gray-900" id="totalForm483s">0</p>
//               </div>
//             </div>
//           </div>
          
//           <div class="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
//             <div class="flex items-center justify-between">
//               <div>
//                 <p class="text-sm font-medium text-gray-600">Total Inspections</p>
//                 <p class="text-2xl font-bold text-gray-900" id="totalInspections">0</p>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       <!-- Company Table -->
//       <div class="bg-white rounded-lg shadow mb-6">
//         <div class="p-6 border-b">
//           <div class="flex justify-between items-center">
//             <h3 class="text-lg font-semibold">Company Regulatory Analysis</h3>
//             <button onclick="window.enhancedWarningLettersFixed.refreshData()" 
//                     class="px-3 py-2 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
//               Refresh
//             </button>
//           </div>
//         </div>
//         <div class="overflow-x-auto">
//           <table class="min-w-full divide-y divide-gray-200">
//             <thead class="bg-gray-50">
//               <tr>
//                 <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
//                 <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warning Letters</th>
//                 <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form 483s</th>
//                 <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inspections</th>
//                 <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Status</th>
//                 <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
//               </tr>
//             </thead>
//             <tbody id="companyTableBody" class="bg-white divide-y divide-gray-200">
//               <!-- Dynamic content -->
//             </tbody>
//           </table>
//         </div>
//       </div>

//       <!-- Violations and Drugs -->
//       <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
//         <div class="bg-white rounded-lg shadow">
//           <div class="p-6 border-b">
//             <h3 class="text-lg font-semibold">Most Common Violations</h3>
//           </div>
//           <div class="p-6">
//             <div id="commonViolations">
//               <!-- Dynamic content -->
//             </div>
//           </div>
//         </div>
        
//         <div class="bg-white rounded-lg shadow">
//           <div class="p-6 border-b">
//             <h3 class="text-lg font-semibold">Drug/Compound Mentions</h3>
//           </div>
//           <div class="p-6">
//             <div id="drugMentions">
//               <!-- Dynamic content -->
//             </div>
//           </div>
//         </div>
//       </div>
//     `;
//   },

//   // Perform comprehensive search
//   performSearch: async function(companies) {
//         console.log('🔍 MAIN SEARCH: Performing comprehensive search for:', companies);
        
//         this.state.loading = true;
//         this.state.selectedCompanies = companies;
//         this.showLoading(true);

//         try {
//             let data = null;
//             let usedBackend = false;

//             // STEP 1: Try the comprehensive backend endpoint
//             try {
//                 console.log('📡 Trying comprehensive backend endpoint...');
//                 const response = await fetch('/api/fda/comprehensive-search', {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({ companies })
//                 });
                
//                 if (response.ok) {
//                     const result = await response.json();
//                     if (result.success && result.data) {
//                         data = result.data;
//                         usedBackend = true;
//                         console.log('✅ Using backend comprehensive endpoint');
//                     }
//                 } else {
//                     console.log(`Backend endpoint failed: ${response.status}`);
//                 }
//             } catch (error) {
//                 console.log('Backend endpoint not available:', error.message);
//             }

//             // STEP 2: If backend fails, use ENHANCED fallback
//             if (!data) {
//                 console.log('🔄 Backend failed, using ENHANCED fallback search...');
//                 data = await this.performEnhancedFallbackSearch(companies);
//             }

//             // STEP 3: Update state with results
//             this.state.companies = data.companies || [];
//             this.state.warningLetters = data.warningLetters || [];
//             this.state.form483s = data.form483s || [];
//             this.state.inspections = data.inspections || [];
//             this.state.metrics = data.metrics || {};
//             this.state.commonViolations = data.commonViolations || [];
//             this.state.drugMentions = data.drugMentions || [];

//             // STEP 4: Update UI
//             this.updateDashboard();
            
//             // STEP 5: Show results
//             const totalRecords = this.state.warningLetters.length + this.state.form483s.length + this.state.inspections.length;
//             console.log(`✅ MAIN SEARCH completed: ${totalRecords} total records (Backend: ${usedBackend})`);
            
//             if (totalRecords > 0) {
//                 this.showSuccess(`Found ${totalRecords} regulatory records using ${usedBackend ? 'backend' : 'enhanced fallback'} search`);
//             } else {
//                 this.showInfo('No regulatory records found. Companies may be clean or use different naming conventions.');
//             }

//         } catch (error) {
//             console.error('❌ MAIN SEARCH failed:', error);
//             this.showError('Search failed: ' + error.message);
//         } finally {
//             this.state.loading = false;
//             this.showLoading(false);
//         }
//     },

//     performEnhancedFallbackSearch : async function(companies) {
//         console.log('🔄 ENHANCED FALLBACK: Starting comprehensive search...');
        
//         const data = {
//             companies: [],
//             warningLetters: [],
//             form483s: [],
//             inspections: [],
//             metrics: {},
//             commonViolations: [],
//             drugMentions: []
//         };

//         // ENHANCED SEARCH VARIATIONS GENERATOR
//         const generateEnhancedVariations = (company) => {
//             const variations = new Set();
//             const original = company.trim();
            
//             // 1. Original name
//             variations.add(original);
            
//             // 2. Remove common business suffixes
//             const withoutSuffixes = original.replace(/\s+(INC|LLC|LTD|CORP|CORPORATION|COMPANY|CO|PHARMA|PHARMACEUTICALS|PHARMS|USA|OPERATIONS|MANUFACTURING|MFG|LABS|LABORATORIES|LLABS|MEDICAL|HEALTHCARE|THERAPEUTICS)\.?$/i, '').trim();
//             if (withoutSuffixes !== original && withoutSuffixes.length > 2) {
//                 variations.add(withoutSuffixes);
//             }
            
//             // 3. Individual significant words
//             const words = original.split(/\s+/).filter(w => w.length > 3 && !w.match(/^(INC|LLC|LTD|CORP|USA|CO|THE|AND|OF|FOR)$/i));
//             words.forEach(word => variations.add(word));
            
//             // 4. First significant word
//             if (words.length > 0) {
//                 variations.add(words[0]);
//             }
            
//             // 5. Last significant word (often the key identifier)
//             if (words.length > 1) {
//                 const lastWord = words[words.length - 1];
//                 if (!lastWord.match(/^(INC|LLC|LTD|CORP|USA|CO)$/i)) {
//                     variations.add(lastWord);
//                 }
//             }
            
//             // 6. First two words
//             if (words.length > 1) {
//                 variations.add(words.slice(0, 2).join(' '));
//             }
            
//             return Array.from(variations).filter(v => v.length > 2).slice(0, 8);
//         };

//         // 1. ENHANCED WARNING LETTERS SEARCH
//         console.log('📄 Searching Warning Letters with enhanced patterns...');
//         const searchedWLTerms = new Set();
        
//         for (const company of companies) {
//             const variations = generateEnhancedVariations(company);
//             console.log(`WL variations for "${company}":`, variations);
            
//             let foundWL = false;
            
//             for (const variation of variations) {
//                 if (foundWL || searchedWLTerms.has(variation.toLowerCase())) continue;
//                 searchedWLTerms.add(variation.toLowerCase());
                
//                 try {
//                     const params = new URLSearchParams({
//                         term: variation,
//                         field: 'company',
//                         page: 1,
//                         perPage: 200
//                     });
                    
//                     const response = await fetch(`/api/wl/search?${params}`);
//                     if (response.ok) {
//                         const result = await response.json();
//                         if (result.results?.length > 0) {
//                             console.log(`✅ WL: Found ${result.results.length} results for "${variation}" → ${company}`);
//                             result.results.forEach(wl => {
//                                 wl.sourceCompany = company;
//                                 wl.matchedTerm = variation;
//                                 data.warningLetters.push(wl);
//                             });
//                             foundWL = true;
//                         }
//                     }
                    
//                     // Small delay to avoid overwhelming the API
//                     await new Promise(resolve => setTimeout(resolve, 50));
                    
//                 } catch (error) {
//                     console.warn(`WL search failed for ${variation}:`, error.message);
//                 }
//             }
//         }

//         // 2. ENHANCED FORM 483 SEARCH - Multiple strategies
//         console.log('📋 Searching Form 483s with multiple strategies...');
//         const searchedF483Terms = new Set();
        
//         for (const company of companies) {
//             const variations = generateEnhancedVariations(company);
//             console.log(`483 variations for "${company}":`, variations);
            
//             let foundF483 = false;
            
//             // Strategy A: Direct API search
//             for (const variation of variations) {
//                 if (foundF483 || searchedF483Terms.has(variation.toLowerCase())) continue;
//                 searchedF483Terms.add(variation.toLowerCase());
                
//                 try {
//                     const params = new URLSearchParams({
//                         term: variation,
//                         field: 'legalName',
//                         page: 1,
//                         perPage: 200
//                     });
                    
//                     const response = await fetch(`/api/form483/search?${params}`);
//                     if (response.ok) {
//                         const result = await response.json();
//                         if (result.results?.length > 0) {
//                             console.log(`✅ 483 API: Found ${result.results.length} results for "${variation}" → ${company}`);
//                             result.results.forEach(f483 => {
//                                 f483.sourceCompany = company;
//                                 f483.matchedTerm = variation;
//                                 data.form483s.push(f483);
//                             });
//                             foundF483 = true;
//                         }
//                     }
                    
//                     await new Promise(resolve => setTimeout(resolve, 50));
                    
//                 } catch (error) {
//                     console.warn(`483 API search failed for ${variation}:`, error.message);
//                 }
//             }
            
//             // Strategy B: Inspection data mining (if API search fails)
//             if (!foundF483) {
//                 try {
//                     const inspectionResponse = await fetch('/api/inspection-data');
//                     if (inspectionResponse.ok) {
//                         const inspectionData = await inspectionResponse.json();
                        
//                         if (inspectionData.recentInspections) {
//                             const matching483s = inspectionData.recentInspections.filter(item => {
//                                 const legalName = (item["Legal Name"] || '').toLowerCase();
//                                 const recordType = (item["Record Type"] || '').toLowerCase();
                                
//                                 // Check if it's a Form 483
//                                 const is483 = recordType.includes('483') || recordType === 'form 483';
                                
//                                 if (is483) {
//                                     // Check if any variation matches
//                                     return variations.some(variation => {
//                                         const varLower = variation.toLowerCase();
//                                         return legalName.includes(varLower) || 
//                                                varLower.includes(legalName.split(' ')[0] || '') ||
//                                                this.fuzzyMatchStrings(legalName, varLower);
//                                     });
//                                 }
//                                 return false;
//                             });
                            
//                             if (matching483s.length > 0) {
//                                 console.log(`✅ 483 Inspection: Found ${matching483s.length} results for ${company}`);
//                                 matching483s.forEach(f483 => {
//                                     f483.sourceCompany = company;
//                                     f483.matchedTerm = 'inspection_data';
//                                     // Normalize fields
//                                     f483.legalName = f483["Legal Name"];
//                                     f483.recordDate = f483["Record Date"];
//                                     f483.feiNumber = f483["FEI Number"];
//                                     data.form483s.push(f483);
//                                 });
//                                 foundF483 = true;
//                             }
//                         }
//                     }
//                 } catch (error) {
//                     console.warn(`483 inspection mining failed for ${company}:`, error.message);
//                 }
//             }
//         }

//         // 3. ENHANCED INSPECTION SEARCH
//         console.log('🏭 Searching Historical Inspections...');
//         try {
//             const response = await fetch('/api/inspection-data');
//             if (response.ok) {
//                 const inspectionData = await response.json();
                
//                 if (inspectionData.historicalInspections) {
//                     companies.forEach(company => {
//                         const variations = generateEnhancedVariations(company);
                        
//                         const companyInspections = inspectionData.historicalInspections.filter(inspection => {
//                             const firmName = (inspection["Firm Name"] || '').toLowerCase();
//                             const legalName = (inspection["Legal Name"] || '').toLowerCase();
                            
//                             return variations.some(variation => {
//                                 const varLower = variation.toLowerCase();
//                                 return firmName.includes(varLower) || 
//                                        legalName.includes(varLower) ||
//                                        varLower.includes(firmName.split(' ')[0] || '') ||
//                                        varLower.includes(legalName.split(' ')[0] || '') ||
//                                        this.fuzzyMatchStrings(firmName, varLower) ||
//                                        this.fuzzyMatchStrings(legalName, varLower);
//                             });
//                         });
                        
//                         companyInspections.forEach(inspection => {
//                             inspection.sourceCompany = company;
//                             data.inspections.push(inspection);
//                         });
                        
//                         if (companyInspections.length > 0) {
//                             console.log(`✅ Inspections: Found ${companyInspections.length} results for ${company}`);
//                         }
//                     });
//                 }
//             }
//         } catch (error) {
//             console.warn('Inspection search failed:', error);
//         }

//         // 4. ENHANCED VIOLATION EXTRACTION
//         console.log('⚗️ Extracting violations from content...');
//         const violationCounts = {};
//         const violationPatterns = [
//             { regex: /data\s+integrity/gi, name: 'Data Integrity' },
//             { regex: /contamination/gi, name: 'Contamination Control' },
//             { regex: /quality\s+control/gi, name: 'Quality Control' },
//             { regex: /validation/gi, name: 'Process Validation' },
//             { regex: /documentation/gi, name: 'Documentation' },
//             { regex: /manufacturing\s+practice/gi, name: 'Manufacturing Practices' },
//             { regex: /sterility/gi, name: 'Sterility Assurance' },
//             { regex: /labeling|labelling/gi, name: 'Labeling' },
//             { regex: /cgmp|gmp/gi, name: 'CGMP Compliance' },
//             { regex: /investigation/gi, name: 'Investigation Procedures' },
//             { regex: /capa/gi, name: 'CAPA System' },
//             { regex: /deviation/gi, name: 'Deviation Handling' },
//             { regex: /specification/gi, name: 'Specification Compliance' },
//             { regex: /cleaning/gi, name: 'Cleaning Procedures' },
//             { regex: /testing/gi, name: 'Testing Procedures' },
//             { regex: /raw\s+material/gi, name: 'Raw Material Control' },
//             { regex: /batch\s+record/gi, name: 'Batch Records' },
//             { regex: /environmental\s+monitoring/gi, name: 'Environmental Monitoring' }
//         ];

//         const processedItems = [...data.warningLetters, ...data.form483s];
//         processedItems.forEach(item => {
//             // Collect all text content
//             const textSources = [
//                 item.fullContent,
//                 item.subject,
//                 item.content,
//                 item.excerpt,
//                 item.description,
//                 Array.isArray(item.parsedObservations) ? item.parsedObservations.join(' ') : item.parsedObservations
//             ].filter(text => text && typeof text === 'string' && text.length > 10);
            
//             const combinedText = textSources.join(' ');
            
//             violationPatterns.forEach(({ regex, name }) => {
//                 const matches = combinedText.match(regex);
//                 if (matches) {
//                     violationCounts[name] = (violationCounts[name] || 0) + matches.length;
//                 }
//             });
//         });

//         // 5. ENHANCED DRUG EXTRACTION
//         console.log('💊 Extracting drug mentions from content...');
//         const drugCounts = {};
//         const knownDrugs = [
//             'ketamine', 'fentanyl', 'morphine', 'oxycodone', 'hydrocodone', 'codeine', 'tramadol',
//             'insulin', 'metformin', 'lisinopril', 'atorvastatin', 'amlodipine', 'losartan',
//             'amoxicillin', 'azithromycin', 'ciprofloxacin', 'doxycycline', 'cephalexin',
//             'ibuprofen', 'acetaminophen', 'aspirin', 'naproxen', 'diclofenac',
//             'propofol', 'midazolam', 'lidocaine', 'bupivacaine', 'sevoflurane',
//             'sertraline', 'fluoxetine', 'citalopram', 'paroxetine', 'escitalopram',
//             'omeprazole', 'pantoprazole', 'lansoprazole', 'esomeprazole',
//             'warfarin', 'rivaroxaban', 'apixaban', 'dabigatran',
//             'levothyroxine', 'methylphenidate', 'amphetamine', 'adderall'
//         ];

//         processedItems.forEach(item => {
//             const textSources = [
//                 item.fullContent,
//                 item.subject,
//                 item.content,
//                 item.excerpt,
//                 Array.isArray(item.parsedObservations) ? item.parsedObservations.join(' ') : item.parsedObservations
//             ].filter(text => text && typeof text === 'string' && text.length > 10);
            
//             const combinedText = textSources.join(' ').toLowerCase();
            
//             knownDrugs.forEach(drug => {
//                 const drugRegex = new RegExp(`\\b${drug}\\b`, 'gi');
//                 const matches = combinedText.match(drugRegex);
//                 if (matches) {
//                     drugCounts[drug] = (drugCounts[drug] || 0) + matches.length;
//                 }
//             });
//         });

//         // 6. BUILD COMPANY RESULTS with Enhanced Risk Assessment
//         data.companies = companies.map(company => {
//             const companyWLs = data.warningLetters.filter(wl => wl.sourceCompany === company);
//             const companyF483s = data.form483s.filter(f => f.sourceCompany === company);
//             const companyInspections = data.inspections.filter(i => i.sourceCompany === company);
            
//             // Enhanced risk calculation
//             let riskLevel = 'low';
//             const wlCount = companyWLs.length;
//             const f483Count = companyF483s.length;
//             const totalIssues = wlCount + f483Count;
            
//             // Recent activity check (last 2 years)
//             const twoYearsAgo = new Date();
//             twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
            
//             const recentWLs = companyWLs.filter(wl => {
//                 const date = new Date(wl.letterIssueDate);
//                 return date > twoYearsAgo;
//             }).length;
            
//             const recent483s = companyF483s.filter(f => {
//                 const date = new Date(f.recordDate || f["Record Date"]);
//                 return date > twoYearsAgo;
//             }).length;
            
//             // Risk level determination
//             if (wlCount > 3 || totalIssues > 8 || (recentWLs > 1 && recent483s > 2)) {
//                 riskLevel = 'high';
//             } else if (wlCount > 0 || f483Count > 3 || totalIssues > 3 || recentWLs > 0 || recent483s > 1) {
//                 riskLevel = 'medium';
//             }
            
//             console.log(`📊 ${company}: WL=${wlCount}, 483s=${f483Count}, Inspections=${companyInspections.length}, Risk=${riskLevel} (Recent: WL=${recentWLs}, 483s=${recent483s})`);
            
//             return {
//                 name: company,
//                 warningLetterCount: wlCount,
//                 form483Count: f483Count,
//                 inspectionCount: companyInspections.length,
//                 riskLevel
//             };
//         });

//         // 7. FINAL METRICS CALCULATION
//         data.metrics = {
//             totalWarningLetters: data.warningLetters.length,
//             totalForm483s: data.form483s.length,
//             totalInspections: data.inspections.length,
//             companiesAffected: companies.length,
//             escalationRate: '0%'
//         };

//         data.commonViolations = Object.entries(violationCounts)
//             .sort((a, b) => b[1] - a[1])
//             .slice(0, 15)
//             .map(([type, count]) => ({ type, count }));

//         data.drugMentions = Object.entries(drugCounts)
//             .sort((a, b) => b[1] - a[1])
//             .slice(0, 20)
//             .map(([name, mentions]) => ({ name, mentions, category: 'Pharmaceutical' }));

//         console.log('✅ ENHANCED FALLBACK completed:', {
//             warningLetters: data.warningLetters.length,
//             form483s: data.form483s.length,
//             inspections: data.inspections.length,
//             violations: data.commonViolations.length,
//             drugs: data.drugMentions.length,
//             companies: data.companies.length
//         });

//         return data;
//     },

//   // Fallback search using individual APIs
//   performFallbackSearch: async function(companies) {
//     console.log('🔄 Performing fallback search...');
    
//     const data = {
//       companies: [],
//       warningLetters: [],
//       form483s: [],
//       inspections: [],
//       metrics: {},
//       commonViolations: [],
//       drugMentions: []
//     };

//     // Search Warning Letters
//     for (const company of companies) {
//       const searchVariations = this.generateSearchVariations(company);
      
//       for (const variation of searchVariations) {
//         try {
//           const params = new URLSearchParams({
//             term: variation,
//             field: 'company',
//             page: 1,
//             perPage: 50
//           });
          
//           const response = await fetch(`/api/wl/search?${params}`);
//           if (response.ok) {
//             const result = await response.json();
//             if (result.results?.length > 0) {
//               result.results.forEach(wl => {
//                 wl.sourceCompany = company;
//                 data.warningLetters.push(wl);
//               });
//               break; // Found results for this company
//             }
//           }
//         } catch (error) {
//           console.warn(`Warning letter search failed for ${variation}:`, error);
//         }
//       }
//     }

//     // Search Form 483s
//     for (const company of companies) {
//       const searchVariations = this.generateSearchVariations(company);
      
//       for (const variation of searchVariations) {
//         try {
//           const params = new URLSearchParams({
//             term: variation,
//             field: 'legalName',
//             page: 1,
//             perPage: 50
//           });
          
//           const response = await fetch(`/api/form483/search?${params}`);
//           if (response.ok) {
//             const result = await response.json();
//             if (result.results?.length > 0) {
//               result.results.forEach(f483 => {
//                 f483.sourceCompany = company;
//                 data.form483s.push(f483);
//               });
//               break; // Found results for this company
//             }
//           }
//         } catch (error) {
//           console.warn(`Form 483 search failed for ${variation}:`, error);
//         }
//       }
//     }

//     // Get Inspection Data
//     try {
//       const response = await fetch('/api/inspection-data');
//       if (response.ok) {
//         const inspectionData = await response.json();
        
//         if (inspectionData.historicalInspections) {
//           companies.forEach(company => {
//             const searchVariations = this.generateSearchVariations(company);
            
//             const companyInspections = inspectionData.historicalInspections.filter(inspection => {
//               const firmName = (inspection["Firm Name"] || '').toLowerCase();
//               return searchVariations.some(variation => 
//                 firmName.includes(variation.toLowerCase()) || 
//                 variation.toLowerCase().includes(firmName)
//               );
//             });
            
//             companyInspections.forEach(inspection => {
//               inspection.sourceCompany = company;
//               data.inspections.push(inspection);
//             });
//           });
//         }
//       }
//     } catch (error) {
//       console.warn('Inspection data fetch failed:', error);
//     }

//     // Build company results
//     data.companies = companies.map(company => {
//       const companyWLs = data.warningLetters.filter(wl => wl.sourceCompany === company);
//       const companyF483s = data.form483s.filter(f => f.sourceCompany === company);
//       const companyInspections = data.inspections.filter(i => i.sourceCompany === company);
      
//       let riskLevel = 'low';
//       if (companyWLs.length > 2) {
//         riskLevel = 'high';
//       } else if (companyWLs.length > 0 || companyF483s.length > 2) {
//         riskLevel = 'medium';
//       }
      
//       return {
//         name: company,
//         warningLetterCount: companyWLs.length,
//         form483Count: companyF483s.length,
//         inspectionCount: companyInspections.length,
//         riskLevel
//       };
//     });

//     // Calculate metrics
//     data.metrics = {
//       totalWarningLetters: data.warningLetters.length,
//       totalForm483s: data.form483s.length,
//       totalInspections: data.inspections.length,
//       companiesAffected: companies.length,
//       escalationRate: '0%'
//     };

//     console.log('✅ Fallback search completed:', {
//       warningLetters: data.warningLetters.length,
//       form483s: data.form483s.length,
//       inspections: data.inspections.length
//     });

//     return data;
//   },


//   fuzzyMatchStrings : function(str1, str2, threshold = 0.5) {
//         if (!str1 || !str2) return false;
        
//         const words1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
//         const words2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        
//         if (words1.length === 0 || words2.length === 0) return false;
        
//         let matches = 0;
//         for (const word1 of words1) {
//             for (const word2 of words2) {
//                 if (word1.includes(word2) || word2.includes(word1)) {
//                     matches++;
//                     break;
//                 }
//             }
//         }
        
//         const similarity = matches / Math.max(words1.length, words2.length);
//         return similarity >= threshold;
//     },

//   // Generate search variations for better matching
//   generateSearchVariations: function(company) {
//     const variations = new Set();
    
//     // Original
//     variations.add(company);
    
//     // Remove common suffixes
//     const cleaned = company.replace(/\s+(INC|LLC|LTD|CORP|CORPORATION|COMPANY|CO|PHARMA|PHARMACEUTICALS|PHARMS|USA|OPERATIONS|MANUFACTURING|MFG|LABS|LABORATORIES)\.?$/i, '').trim();
//     if (cleaned !== company && cleaned.length > 2) {
//       variations.add(cleaned);
//     }
    
//     // Individual significant words
//     const words = company.split(/\s+/).filter(w => w.length > 3);
//     words.forEach(word => {
//       if (!word.match(/^(INC|LLC|LTD|CORP|USA|CO|THE|AND|OF)$/i)) {
//         variations.add(word);
//       }
//     });
    
//     // First two words
//     if (words.length > 1) {
//       variations.add(words.slice(0, 2).join(' '));
//     }
    
//     return Array.from(variations).filter(v => v.length > 2).slice(0, 5);
//   },

//   // Update dashboard display
//   updateDashboard: function() {
//     console.log('🖥️ Updating dashboard display...');
    
//     // Update metrics
//     this.safeSetText('totalWarningLetters', this.state.metrics.totalWarningLetters || 0);
//     this.safeSetText('companiesAffected', this.state.metrics.companiesAffected || 0);
//     this.safeSetText('totalForm483s', this.state.metrics.totalForm483s || 0);
//     this.safeSetText('totalInspections', this.state.metrics.totalInspections || 0);

//     // Update company table
//     this.updateCompanyTable();
    
//     // Update violations
//     this.updateViolations();
    
//     // Update drug mentions
//     this.updateDrugMentions();
//   },

//   // Safe text setting
//   safeSetText: function(id, value) {
//     const element = document.getElementById(id);
//     if (element) {
//       element.textContent = value;
//     } else {
//       console.warn(`Element ${id} not found`);
//     }
//   },

//   // Update company table
//   updateCompanyTable: function() {
//     const tbody = document.getElementById('companyTableBody');
//     if (!tbody) {
//       console.warn('Company table body not found');
//       return;
//     }

//     if (this.state.companies.length === 0) {
//       tbody.innerHTML = `
//         <tr>
//           <td colspan="6" class="px-6 py-8 text-center text-gray-500">
//             No companies found. Try different search terms.
//           </td>
//         </tr>
//       `;
//       return;
//     }

//     tbody.innerHTML = this.state.companies.map(company => `
//       <tr class="hover:bg-gray-50">
//         <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
//           ${company.name}
//         </td>
//         <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//           <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
//             ${company.warningLetterCount}
//           </span>
//         </td>
//         <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//           <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
//             ${company.form483Count}
//           </span>
//         </td>
//         <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//           <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
//             ${company.inspectionCount}
//           </span>
//         </td>
//         <td class="px-6 py-4 whitespace-nowrap">
//           ${this.getRiskBadge(company.riskLevel)}
//         </td>
//         <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
//           <button onclick="window.enhancedWarningLettersFixed.viewCompanyDetails('${company.name}')" 
//                   class="text-indigo-600 hover:text-indigo-900">
//             View Details
//           </button>
//         </td>
//       </tr>
//     `).join('');
//   },

//   // Get risk badge
//   getRiskBadge: function(riskLevel) {
//     const badges = {
//       'low': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Low Risk</span>',
//       'medium': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Medium Risk</span>',
//       'high': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">High Risk</span>'
//     };
//     return badges[riskLevel] || '<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Unknown</span>';
//   },

//   // Update violations display
//   updateViolations: function() {
//     const container = document.getElementById('commonViolations');
//     if (!container) return;

//     if (!this.state.commonViolations || this.state.commonViolations.length === 0) {
//       container.innerHTML = '<p class="text-gray-500 text-sm">No violation data available</p>';
//       return;
//     }

//     container.innerHTML = this.state.commonViolations.map(violation => `
//       <div class="flex justify-between items-center py-2 border-b border-gray-200">
//         <span class="text-sm text-gray-700 capitalize">${violation.type}</span>
//         <span class="text-sm font-medium text-gray-900">${violation.count}</span>
//       </div>
//     `).join('');
//   },

//   // Update drug mentions display
//   updateDrugMentions: function() {
//     const container = document.getElementById('drugMentions');
//     if (!container) return;

//     if (!this.state.drugMentions || this.state.drugMentions.length === 0) {
//       container.innerHTML = '<p class="text-gray-500 text-sm">No drug mention data available</p>';
//       return;
//     }

//     container.innerHTML = this.state.drugMentions.map(drug => `
//       <div class="flex justify-between items-center py-2 border-b border-gray-200">
//         <div>
//           <span class="text-sm font-medium text-gray-900 capitalize">${drug.name}</span>
//           <span class="text-xs text-gray-500 ml-2">${drug.category}</span>
//         </div>
//         <span class="text-sm font-medium text-gray-900">${drug.mentions}</span>
//       </div>
//     `).join('');
//   },

//   // View company details
// viewCompanyDetails : async function(companyName) {
//     console.log(`🔍 Loading comprehensive details for: ${companyName}`);
    
//     // Show loading modal first using your existing showLoading method
//     this.showLoading();
    
//     try {
//         // Fetch all data for this company in parallel
//         const [warningLetters, inspectionData] = await Promise.all([
//             this.fetchWarningLettersForCompany(companyName),
//             this.fetchInspectionDataForCompany(companyName)
//         ]);

//         console.log(`📊 Data loaded for ${companyName}:`, {
//             warningLetters: warningLetters.length,
//             recentInspections: inspectionData.recentInspections.length,
//             historicalInspections: inspectionData.historicalInspections.length
//         });

//         // Hide loading and show comprehensive modal
//         this.hideLoading();
//         this.showComprehensiveCompanyModal(companyName, warningLetters, inspectionData);

//     } catch (error) {
//         console.error('❌ Error loading company details:', error);
//         this.hideLoading();
//         this.showError(`Failed to load details for ${companyName}: ${error.message}`);
//     }
// },

//   // Refresh data
//   refreshData: function() {
//     if (this.state.selectedCompanies.length > 0) {
//       this.performSearch(this.state.selectedCompanies);
//     }
//   },

//   // Utility functions
//   showLoading: function(show) {
//     // Visual loading indicator
//   },

//   showSuccess: function(message) {
//     console.log('✅', message);
//     if (window.WLshowToast) {
//       window.WLshowToast(message, 'success');
//     }
//   },

//   showInfo: function(message) {
//     console.log('ℹ️', message);
//     if (window.WLshowToast) {
//       window.WLshowToast(message, 'info');
//     }
//   },

//   showError: function(message) {
//     console.error('❌', message);
//     if (window.WLshowToast) {
//       window.WLshowToast(message, 'error');
//     }
//   }
// };