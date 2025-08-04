// ===================================================================
// COMPLETE ENHANCED WARNING LETTERS V2 - Full System with Modern UI
// Replace your entire enhanced-warning-letters-v2.js with this complete version
// ===================================================================

window.enhancedWarningLettersFixed = {
  state: {
    selectedCompanies: [],
    warningLetters: [],
    form483s: [],
    inspections: [],
    citations: [],  // Added for recent citations
    companies: [],
    metrics: {},
    commonViolations: [],
    drugMentions: [],
    loading: false
  },

  // Initialize with companies
  init: function(companies) {
    console.log('🚀 Initializing Enhanced Warning Letters for:', companies);
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

  // Render complete dashboard with modern UI
  renderDashboard: function() {
    const container = document.getElementById('enhancedWLContainer');
    if (!container) return;

    container.innerHTML = `
      <!-- Modern Dashboard Header -->
      <div class="mb-8">
        <div class="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <h2 class="text-2xl font-bold mb-2">FDA Regulatory Intelligence Dashboard</h2>
          <p class="text-indigo-100">Comprehensive analysis of Warning Letters, Form 483s, and Inspections</p>
        </div>
      </div>
      
      <!-- Metrics Cards with Modern Design -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow-md p-6 border-t-4 border-red-500 transform hover:scale-105 transition-transform">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Warning Letters</p>
              <p class="text-3xl font-bold text-gray-900 mt-1" id="totalWarningLetters">0</p>
            </div>
            <div class="p-3 bg-red-100 rounded-full">
              <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6 border-t-4 border-yellow-500 transform hover:scale-105 transition-transform">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Form 483s</p>
              <p class="text-3xl font-bold text-gray-900 mt-1" id="totalForm483s">0</p>
            </div>
            <div class="p-3 bg-yellow-100 rounded-full">
              <svg class="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6 border-t-4 border-blue-500 transform hover:scale-105 transition-transform">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Citations</p>
              <p class="text-3xl font-bold text-gray-900 mt-1" id="totalCitations">0</p>
            </div>
            <div class="p-3 bg-blue-100 rounded-full">
              <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6 border-t-4 border-purple-500 transform hover:scale-105 transition-transform">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Total Inspections</p>
              <p class="text-3xl font-bold text-gray-900 mt-1" id="totalInspections">0</p>
            </div>
            <div class="p-3 bg-purple-100 rounded-full">
              <svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Company Analysis Table with Modern Design -->
      <div class="bg-white rounded-lg shadow-lg mb-6 overflow-hidden">
        <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-semibold text-gray-800">Company Regulatory Analysis</h3>
            <button onclick="window.enhancedWarningLettersFixed.refreshData()" 
                    class="px-4 py-2 text-sm bg-white text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors flex items-center">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Refresh Data
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
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Citations</th>
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

      <!-- Analytics Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <!-- Common Violations Card -->
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
          <div class="bg-gradient-to-r from-orange-50 to-orange-100 px-6 py-4 border-b">
            <h3 class="text-lg font-semibold text-gray-800">Most Common Violations</h3>
          </div>
          <div class="p-6">
            <div id="commonViolations" class="space-y-3">
              <!-- Dynamic content -->
            </div>
          </div>
        </div>
        
        <!-- Drug Mentions Card -->
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
          <div class="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 border-b">
            <h3 class="text-lg font-semibold text-gray-800">Drug/Compound Mentions</h3>
          </div>
          <div class="p-6">
            <div id="drugMentions" class="space-y-3">
              <!-- Dynamic content -->
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Perform comprehensive search using proper backend endpoints
  performSearch: async function(companies) {
    console.log('🔍 Performing comprehensive search for:', companies);
    
    this.state.loading = true;
    this.state.selectedCompanies = companies;
    this.showLoading(true);

    try {
      // Fetch all data types in parallel using proper endpoints
      const [warningLettersData, form483Data, inspectionData] = await Promise.all([
        this.fetchWarningLetters(companies),
        // this.fetchForm483s(companies),
        this.fetchInspections(companies)
      ]);

      // Process and store results
      this.state.warningLetters = warningLettersData || [];
      this.state.form483s = form483Data || [];
      this.state.citations = inspectionData.recentInspections || [];
      this.state.inspections = inspectionData.historicalInspections || [];

      // Process analytics
      this.processViolations();
      this.processDrugMentions();
      this.buildCompanyMetrics();

      // Update UI
      this.updateDashboard();
      
      // Show results summary
      const totalRecords = this.state.warningLetters.length + 
                          this.state.form483s.length + 
                          this.state.citations.length + 
                          this.state.inspections.length;
      
      console.log(`✅ Search completed: ${totalRecords} total records found`);
      
      if (totalRecords > 0) {
        this.showSuccess(`Found ${totalRecords} regulatory records for ${companies.length} companies`);
      } else {
        this.showInfo('No regulatory records found. Try using different company name variations.');
      }

    } catch (error) {
      console.error('❌ Search failed:', error);
      this.showError('Search failed: ' + error.message);
    } finally {
      this.state.loading = false;
      this.showLoading(false);
    }
  },

  // Fetch warning letters using backend endpoint
  fetchWarningLetters: async function(companies) {
    try {
      console.log('📄 Fetching warning letters...');
      const allLetters = [];
      
      // Search for each company
      for (const company of companies) {
        const response = await fetch('/api/search-wl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: company,
            limit: 100
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.results && Array.isArray(data.results)) {
            // Add source company for tracking
            data.results.forEach(letter => {
              letter.sourceCompany = company;
            });
            allLetters.push(...data.results);
          }
        }
      }
      
      console.log(`Found ${allLetters.length} warning letters`);
      return allLetters;
    } catch (error) {
      console.error('Error fetching warning letters:', error);
      return [];
    }
  },

  // Fetch Form 483s using backend endpoint
  fetchForm483s: async function(companies) {
    try {
      console.log('📋 Fetching Form 483s...');
      const allForm483s = [];
      
      // Search for each company using multiple search strategies
      for (const company of companies) {
        // Try different search fields
        const searchFields = ['company', 'legalName'];
        
        for (const field of searchFields) {
          const params = new URLSearchParams({
            term: company,
            field: field,
            page: 1,
            perPage: 200
          });
          
          const response = await fetch(`/api/form483/search?${params}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.results && Array.isArray(data.results)) {
              // Add source company for tracking
              data.results.forEach(form483 => {
                form483.sourceCompany = company;
              });
              allForm483s.push(...data.results);
            }
          }
        }
      }
      
      // Remove duplicates based on ID
      const uniqueForm483s = Array.from(
        new Map(allForm483s.map(item => [item._id || item.id, item])).values()
      );
      
      console.log(`Found ${uniqueForm483s.length} Form 483s`);
      return uniqueForm483s;
    } catch (error) {
      console.error('Error fetching Form 483s:', error);
      return [];
    }
  },

  // Fetch inspections using backend endpoint
  fetchInspections: async function(companies) {
  try {
    console.log('🏭 Fetching inspections for companies:', companies);
    const allInspections = {
      recentInspections: [],
      historicalInspections: []
    };
    
    // FIX: Use company parameter for each company
    for (const company of companies) {
      console.log(`  🔍 Fetching inspections for: ${company}`);
      
      // Use the company parameter your backend supports
      const response = await fetch(`/api/inspection-data?company=${encodeURIComponent(company)}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Add source company for tracking
        if (data.recentInspections) {
          data.recentInspections.forEach(inspection => {
            inspection.sourceCompany = company;
          });
          allInspections.recentInspections.push(...data.recentInspections);
        }
        
        if (data.historicalInspections) {
          data.historicalInspections.forEach(inspection => {
            inspection.sourceCompany = company;
          });
          allInspections.historicalInspections.push(...data.historicalInspections);
        }
        
        console.log(`    ✅ Found ${data.recentInspections?.length || 0} recent + ${data.historicalInspections?.length || 0} historical for ${company}`);
      } else {
        console.warn(`    ⚠️ Failed to fetch inspections for ${company}: ${response.status}`);
      }
    }
    
    console.log(`🎯 Total: ${allInspections.recentInspections.length} citations and ${allInspections.historicalInspections.length} historical inspections`);
    return allInspections;
  } catch (error) {
    console.error('Error fetching inspections:', error);
    return { recentInspections: [], historicalInspections: [] };
  }
},

  // Process violations from all data
  processViolations: function() {
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
      { regex: /deviation/gi, name: 'Deviation Handling' }
    ];

    // Process all documents
    const allDocuments = [
      ...this.state.warningLetters,
      ...this.state.form483s
    ];

    allDocuments.forEach(doc => {
      const textContent = [
        doc.fullContent,
        doc.subject,
        doc.content,
        doc.excerpt,
        doc.description,
        doc.ShortDescription,
        doc.LongDescription
      ].filter(text => text && typeof text === 'string').join(' ');
      
      violationPatterns.forEach(({ regex, name }) => {
        const matches = textContent.match(regex);
        if (matches) {
          violationCounts[name] = (violationCounts[name] || 0) + matches.length;
        }
      });
    });

    this.state.commonViolations = Object.entries(violationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));
  },

  // Process drug mentions from all data
  processDrugMentions: function() {
    const drugCounts = {};
    const commonDrugs = [
      'ketamine', 'esketamine', 'fentanyl', 'morphine', 'oxycodone',
      'insulin', 'metformin', 'lisinopril', 'atorvastatin', 'amlodipine',
      'amoxicillin', 'azithromycin', 'ciprofloxacin', 'doxycycline',
      'ibuprofen', 'acetaminophen', 'aspirin', 'omeprazole', 'pantoprazole',
      'sertraline', 'fluoxetine', 'warfarin', 'rivaroxaban', 'gabapentin'
    ];

    const allDocuments = [
      ...this.state.warningLetters,
      ...this.state.form483s
    ];

    allDocuments.forEach(doc => {
      const textContent = [
        doc.fullContent,
        doc.subject,
        doc.content,
        doc.excerpt
      ].filter(text => text && typeof text === 'string').join(' ').toLowerCase();
      
      commonDrugs.forEach(drug => {
        const drugRegex = new RegExp(`\\b${drug}\\b`, 'gi');
        const matches = textContent.match(drugRegex);
        if (matches) {
          drugCounts[drug] = (drugCounts[drug] || 0) + matches.length;
        }
      });
    });

    this.state.drugMentions = Object.entries(drugCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, mentions]) => ({ name, mentions, category: 'Pharmaceutical' }));
  },

  // Build company metrics
  buildCompanyMetrics: function() {
    this.state.companies = this.state.selectedCompanies.map(company => {
      const warningLetters = this.state.warningLetters.filter(wl => 
        wl.sourceCompany === company || this.isRelatedCompany(wl.companyName, company)
      );
      
      const form483s = this.state.form483s.filter(f => 
        f.sourceCompany === company || this.isRelatedCompany(f.companyName || f.legalName, company)
      );
      
      const citations = this.state.citations.filter(c => 
        c.sourceCompany === company || this.isRelatedCompany(c["Legal Name"], company)
      );
      
      const inspections = this.state.inspections.filter(i => 
        i.sourceCompany === company || this.isRelatedCompany(i["Firm Name"], company)
      );
      
      // Calculate risk level
      const totalIssues = warningLetters.length + form483s.length + citations.length;
      let riskLevel = 'low';
      
      if (warningLetters.length > 2 || totalIssues > 10) {
        riskLevel = 'high';
      } else if (warningLetters.length > 0 || totalIssues > 5) {
        riskLevel = 'medium';
      }
      
      return {
        name: company,
        warningLetterCount: warningLetters.length,
        form483Count: form483s.length,
        citationCount: citations.length,
        inspectionCount: inspections.length,
        riskLevel
      };
    });

    // Update metrics
    this.state.metrics = {
      totalWarningLetters: this.state.warningLetters.length,
      totalForm483s: this.state.form483s.length,
      totalCitations: this.state.citations.length,
      totalInspections: this.state.inspections.length,
      companiesAffected: this.state.selectedCompanies.length
    };
  },

  // Check if company names are related
  isRelatedCompany: function(name1, name2) {
    if (!name1 || !name2) return false;
    
    const normalize = (str) => str.toLowerCase()
      .replace(/[,.\s]+/g, ' ')
      .replace(/\b(inc|llc|ltd|corp|corporation|company|co|pharma|pharmaceuticals)\b/gi, '')
      .trim();
    
    const normalized1 = normalize(name1);
    const normalized2 = normalize(name2);
    
    return normalized1.includes(normalized2) || normalized2.includes(normalized1);
  },

  // Update dashboard display
  updateDashboard: function() {
    console.log('🖥️ Updating dashboard display...');
    
    // Update metrics
    this.safeSetText('totalWarningLetters', this.state.metrics.totalWarningLetters || 0);
    this.safeSetText('totalForm483s', this.state.metrics.totalForm483s || 0);
    this.safeSetText('totalCitations', this.state.metrics.totalCitations || 0);
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
    }
  },

  // Update company table
  updateCompanyTable: function() {
    const tbody = document.getElementById('companyTableBody');
    if (!tbody) return;

    if (this.state.companies.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-8 text-center text-gray-500">
            No companies found. Try different search terms.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.state.companies.map(company => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900">${company.name}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            company.warningLetterCount > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
          }">
            ${company.warningLetterCount}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            company.form483Count > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
          }">
            ${company.form483Count}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            company.citationCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
          }">
            ${company.citationCount}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            company.inspectionCount > 0 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
          }">
            ${company.inspectionCount}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          ${this.getRiskBadge(company.riskLevel)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <button onclick="window.enhancedWarningLettersFixed.viewCompanyDetails('${company.name}')" 
                  class="text-indigo-600 hover:text-indigo-900 font-medium">
            View Details
          </button>
        </td>
      </tr>
    `).join('');
  },

  // Get risk badge
  getRiskBadge: function(riskLevel) {
    const badges = {
      'low': '<span class="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Low Risk</span>',
      'medium': '<span class="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Medium Risk</span>',
      'high': '<span class="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">High Risk</span>'
    };
    return badges[riskLevel] || '<span class="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Unknown</span>';
  },

  // Update violations display
  updateViolations: function() {
    const container = document.getElementById('commonViolations');
    if (!container) return;

    if (!this.state.commonViolations || this.state.commonViolations.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-sm">No violation data available</p>';
      return;
    }

    container.innerHTML = this.state.commonViolations.map((violation, index) => `
      <div class="flex items-center justify-between py-3 ${index < this.state.commonViolations.length - 1 ? 'border-b border-gray-100' : ''}">
        <div class="flex items-center">
          <div class="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
          <span class="text-sm text-gray-700">${violation.type}</span>
        </div>
        <span class="text-sm font-semibold text-gray-900">${violation.count}</span>
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

    container.innerHTML = this.state.drugMentions.map((drug, index) => `
      <div class="flex items-center justify-between py-3 ${index < this.state.drugMentions.length - 1 ? 'border-b border-gray-100' : ''}">
        <div class="flex items-center">
          <div class="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
          <span class="text-sm font-medium text-gray-900 capitalize">${drug.name}</span>
        </div>
        <span class="text-sm font-semibold text-gray-900">${drug.mentions}</span>
      </div>
    `).join('');
  },

  // ===================================================================
  // VIEW DETAILS MODAL - Modern Design
  // ===================================================================

  // View company details with modern modal
  viewCompanyDetails: async function(companyName) {
    console.log(`🔍 Loading details for: ${companyName}`);
    
    // Show loading modal
    this.showLoadingModal();
    
    try {
      // Get filtered data for this company
      const companyData = {
        warningLetters: this.state.warningLetters.filter(wl => 
          wl.sourceCompany === companyName || this.isRelatedCompany(wl.companyName, companyName)
        ),
        form483s: this.state.form483s.filter(f => 
          f.sourceCompany === companyName || this.isRelatedCompany(f.companyName || f.legalName, companyName)
        ),
        citations: this.state.citations.filter(c => 
          c.sourceCompany === companyName || this.isRelatedCompany(c["Legal Name"], companyName)
        ),
        inspections: this.state.inspections.filter(i => 
          i.sourceCompany === companyName || this.isRelatedCompany(i["Firm Name"], companyName)
        )
      };

      // Hide loading and show modal
      this.hideLoadingModal();
      this.showCompanyDetailsModal(companyName, companyData);

    } catch (error) {
      console.error('❌ Error loading company details:', error);
      this.hideLoadingModal();
      this.showError(`Failed to load details for ${companyName}`);
    }
  },

  // Show modern company details modal
  showCompanyDetailsModal: function(companyName, data) {
    const { warningLetters, form483s, citations, inspections } = data;
    
    // Calculate risk assessment
    const riskScore = this.calculateRiskScore(data);
    
    // Create modal HTML with modern design
    const modalHtml = `
      <div class="fixed inset-0 z-50 overflow-y-auto" id="companyDetailsModal">
        <!-- Backdrop with blur -->
        <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"></div>
        
        <!-- Modal Container -->
        <div class="flex min-h-screen items-center justify-center p-4">
          <div class="relative w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
            
            <!-- Modal Header with Gradient -->
            <div class="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 px-8 py-6 text-white">
              <div class="flex items-start justify-between">
                <div>
                  <h2 class="text-3xl font-bold">${companyName}</h2>
                  <p class="mt-2 text-indigo-100">Comprehensive Regulatory Profile</p>
                </div>
                <button onclick="window.enhancedWarningLettersFixed.closeModal('companyDetailsModal')" 
                        class="rounded-lg bg-white bg-opacity-20 p-2 hover:bg-opacity-30 transition-colors">
                  <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>
            
            <!-- Risk Assessment Bar -->
            <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                  <span class="text-sm font-medium text-gray-700">Risk Assessment:</span>
                  <div class="flex items-center space-x-2">
                    ${this.getRiskIndicators(riskScore)}
                  </div>
                </div>
                <span class="text-sm text-gray-600">Based on ${warningLetters.length + form483s.length + citations.length + inspections.length} regulatory records</span>
              </div>
            </div>
            
            <!-- Statistics Cards -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-8 bg-gray-50">
              <div class="bg-white rounded-xl p-4 text-center shadow-sm">
                <div class="text-3xl font-bold text-red-600">${warningLetters.length}</div>
                <div class="text-sm text-gray-600 mt-1">Warning Letters</div>
              </div>
              <div class="bg-white rounded-xl p-4 text-center shadow-sm">
                <div class="text-3xl font-bold text-yellow-600">${form483s.length}</div>
                <div class="text-sm text-gray-600 mt-1">Form 483s</div>
              </div>
              <div class="bg-white rounded-xl p-4 text-center shadow-sm">
                <div class="text-3xl font-bold text-blue-600">${citations.length}</div>
                <div class="text-sm text-gray-600 mt-1">Citations</div>
              </div>
              <div class="bg-white rounded-xl p-4 text-center shadow-sm">
                <div class="text-3xl font-bold text-purple-600">${inspections.length}</div>
                <div class="text-sm text-gray-600 mt-1">Inspections</div>
              </div>
            </div>
            
            <!-- Tabbed Content -->
            <div class="bg-white">
              <!-- Tab Navigation -->
              <div class="border-b border-gray-200">
                <nav class="flex space-x-8 px-8" aria-label="Tabs">
                  <button onclick="window.enhancedWarningLettersFixed.switchTab('warningLetters')" 
                          class="tab-btn border-b-2 border-indigo-500 text-indigo-600 py-4 px-1 text-sm font-medium"
                          data-tab="warningLetters">
                    Warning Letters
                  </button>
                  <button onclick="window.enhancedWarningLettersFixed.switchTab('form483s')" 
                          class="tab-btn border-b-2 border-transparent text-gray-500 hover:text-gray-700 py-4 px-1 text-sm font-medium"
                          data-tab="form483s">
                    Form 483s
                  </button>
                  <button onclick="window.enhancedWarningLettersFixed.switchTab('citations')" 
                          class="tab-btn border-b-2 border-transparent text-gray-500 hover:text-gray-700 py-4 px-1 text-sm font-medium"
                          data-tab="citations">
                    Citations
                  </button>
                  <button onclick="window.enhancedWarningLettersFixed.switchTab('inspections')" 
                          class="tab-btn border-b-2 border-transparent text-gray-500 hover:text-gray-700 py-4 px-1 text-sm font-medium"
                          data-tab="inspections">
                    Inspections
                  </button>
                  <button onclick="window.enhancedWarningLettersFixed.switchTab('timeline')" 
                          class="tab-btn border-b-2 border-transparent text-gray-500 hover:text-gray-700 py-4 px-1 text-sm font-medium"
                          data-tab="timeline">
                    Timeline
                  </button>
                </nav>
              </div>
              
              <!-- Tab Content -->
              <div class="p-8" style="max-height: 600px; overflow-y: auto;">
                <!-- Warning Letters Tab -->
                <div id="warningLetters-content" class="tab-content">
                  ${this.createWarningLettersContent(warningLetters)}
                </div>
                
                <!-- Form 483s Tab -->
                <div id="form483s-content" class="tab-content hidden">
                  ${this.createForm483sContent(form483s)}
                </div>
                
                <!-- Citations Tab -->
                <div id="citations-content" class="tab-content hidden">
                  ${this.createCitationsContent(citations)}
                </div>
                
                <!-- Inspections Tab -->
                <div id="inspections-content" class="tab-content hidden">
                  ${this.createInspectionsContent(inspections)}
                </div>
                
                <!-- Timeline Tab -->
                <div id="timeline-content" class="tab-content hidden">
                  ${this.createTimelineContent(warningLetters, form483s, citations, inspections)}
                </div>
              </div>
            </div>
            
            <!-- Modal Footer -->
            <div class="bg-gray-50 px-8 py-4 border-t flex justify-between items-center">
              <div class="text-sm text-gray-500">
                Last updated: ${new Date().toLocaleDateString()}
              </div>
              <div class="flex space-x-3">
                <button onclick="window.enhancedWarningLettersFixed.exportCompanyData('${companyName}')" 
                        class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                  Export Report
                </button>
                <button onclick="window.enhancedWarningLettersFixed.closeModal('companyDetailsModal')" 
                        class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm font-medium">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Add click outside to close
    document.getElementById('companyDetailsModal').addEventListener('click', function(e) {
      if (e.target === this) {
        window.enhancedWarningLettersFixed.closeModal('companyDetailsModal');
      }
    });

    // Add escape key to close
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        window.enhancedWarningLettersFixed.closeModal('companyDetailsModal');
      }
    });
  },

  // Calculate risk score
  calculateRiskScore: function(data) {
    const { warningLetters, form483s, citations, inspections } = data;
    
    // Weight different factors
    const score = (warningLetters.length * 10) + 
                 (form483s.length * 5) + 
                 (citations.length * 3) + 
                 (inspections.length * 1);
    
    if (score >= 50) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
  },

  // Get risk indicators
  getRiskIndicators: function(riskScore) {
    const indicators = {
      low: `
        <div class="flex items-center space-x-1">
          <div class="w-3 h-3 bg-green-500 rounded-full"></div>
          <div class="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div class="w-3 h-3 bg-gray-300 rounded-full"></div>
          <span class="ml-2 text-sm font-medium text-green-700">Low Risk</span>
        </div>
      `,
      medium: `
        <div class="flex items-center space-x-1">
          <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div class="w-3 h-3 bg-gray-300 rounded-full"></div>
          <span class="ml-2 text-sm font-medium text-yellow-700">Medium Risk</span>
        </div>
      `,
      high: `
        <div class="flex items-center space-x-1">
          <div class="w-3 h-3 bg-red-500 rounded-full"></div>
          <div class="w-3 h-3 bg-red-500 rounded-full"></div>
          <div class="w-3 h-3 bg-red-500 rounded-full"></div>
          <span class="ml-2 text-sm font-medium text-red-700">High Risk</span>
        </div>
      `
    };
    
    return indicators[riskScore] || indicators.low;
  },

  // Switch tabs
  switchTab: function(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('border-indigo-500', 'text-indigo-600');
      btn.classList.add('border-transparent', 'text-gray-500');
    });
    
    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    activeTab.classList.remove('border-transparent', 'text-gray-500');
    activeTab.classList.add('border-indigo-500', 'text-indigo-600');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    
    document.getElementById(`${tabName}-content`).classList.remove('hidden');
  },

  // Create warning letters content
  createWarningLettersContent: function(warningLetters) {
    if (warningLetters.length === 0) {
      return this.createEmptyState('Warning Letters', 'No warning letters found for this company');
    }

    return `
      <div class="space-y-4">
        ${warningLetters.map(letter => `
          <div class="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            <div class="bg-red-50 px-6 py-4 border-b border-red-100">
              <div class="flex justify-between items-start">
                <div>
                  <h4 class="text-lg font-semibold text-gray-900">${letter.subject || 'Warning Letter'}</h4>
                  <div class="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                    <span>📅 ${this.formatDate(letter.letterIssueDate)}</span>
                    <span>🏢 ${letter.issuingOffice || 'FDA Office'}</span>
                    <span>📄 ${letter.letterId || 'No ID'}</span>
                  </div>
                </div>
                ${letter.pdfUrl ? `
                  <a href="${letter.pdfUrl}" target="_blank" 
                     class="inline-flex items-center px-3 py-1 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                    </svg>
                    View PDF
                  </a>
                ` : ''}
              </div>
            </div>
            <div class="px-6 py-4">
              <div class="text-sm text-gray-700 line-clamp-4">
                ${letter.excerpt || letter.fullContent || 'No content available'}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  // Create Form 483s content
  createForm483sContent: function(form483s) {
    if (form483s.length === 0) {
      return this.createEmptyState('Form 483s', 'No Form 483s found for this company');
    }

    return `
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Date</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FEI Number</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issuing Office</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${form483s.map(form483 => `
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  ${this.formatDate(form483.issueDate || form483.recordDate || form483["Record Date"])}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${form483.feiNumber || form483["FEI Number"] || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${form483.issuingOffice || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  ${form483.pdfUrl ? `
                    <a href="${form483.pdfUrl}" target="_blank" 
                       class="text-indigo-600 hover:text-indigo-900 font-medium">
                      View PDF
                    </a>
                  ` : '<span class="text-gray-400">No PDF</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // Create citations content
  createCitationsContent: function(citations) {
    if (citations.length === 0) {
      return this.createEmptyState('Citations', 'No citations found for this company');
    }

    return `
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Legal Name</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${citations.map(citation => `
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  ${this.formatDate(citation["Record Date"])}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${citation["Legal Name"] || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                    ${citation["Record Type"] || 'Citation'}
                  </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                  ${citation["Description"] || citation["ShortDescription"] || 'N/A'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // Create inspections content
  createInspectionsContent: function(inspections) {
    if (inspections.length === 0) {
      return this.createEmptyState('Inspections', 'No historical inspections found for this company');
    }

    return `
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Area</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classification</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${inspections.slice(0, 50).map(inspection => `
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  ${this.formatDate(inspection["Inspection End Date"])}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${[inspection["City"], inspection["State"]].filter(Boolean).join(', ') || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${inspection["Project Area"] || 'Unknown'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  ${this.getClassificationBadge(inspection["Inspection Classification"])}
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



  // Get classification color
  getClassificationColor: function(classification) {
    switch (classification?.toUpperCase()) {
      case 'OAI': return 'red';
      case 'VAI': return 'yellow';
      case 'NAI': return 'green';
      default: return 'gray';
    }
  },

  // Get classification badge
  getClassificationBadge: function(classification) {
    const colors = {
      'OAI': 'bg-red-100 text-red-800',
      'VAI': 'bg-yellow-100 text-yellow-800',
      'NAI': 'bg-green-100 text-green-800'
    };
    
    const color = colors[classification?.toUpperCase()] || 'bg-gray-100 text-gray-800';
    
    return `
      <span class="px-2 py-1 text-xs font-medium rounded-full ${color}">
        ${classification || 'N/A'}
      </span>
    `;
  },

  // Create empty state
  createEmptyState: function(title, message) {
    return `
      <div class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">${title}</h3>
        <p class="mt-1 text-sm text-gray-500">${message}</p>
      </div>
    `;
  },

  // ===================================================================
  // UTILITY FUNCTIONS
  // ===================================================================

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

  // Show loading modal
  showLoadingModal: function() {
    // const loadingHtml = `
    //   <div class="fixed inset-0 z-50 flex items-center justify-center" id="loadingModal">
    //     <div class="fixed inset-0 bg-black bg-opacity-50"></div>
    //     <div class="relative bg-white rounded-lg p-8 text-center">
    //       <div class="loading-spinner mx-auto mb-4"></div>
    //       <p class="text-gray-600">Loading regulatory data...</p>
    //     </div>
    //   </div>
    // `;
    // document.body.insertAdjacentHTML('beforeend', loadingHtml);
  },

// Hide loading modal
  hideLoadingModal: function() {
    // const modal = document.getElementById('loadingModal');
    // if (modal) {
    //   modal.remove();
    // }
  },



  // Close modal
  closeModal: function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.remove();
    }
  },

  // Export company data
  exportCompanyData: function(companyName) {
    console.log(`Exporting data for ${companyName}`);
    
    // Gather data for export
    const exportData = {
      company: companyName,
      exportDate: new Date().toISOString(),
      warningLetters: this.state.warningLetters.filter(wl => 
        wl.sourceCompany === companyName || this.isRelatedCompany(wl.companyName, companyName)
      ),
      form483s: this.state.form483s.filter(f => 
        f.sourceCompany === companyName || this.isRelatedCompany(f.companyName || f.legalName, companyName)
      ),
      citations: this.state.citations.filter(c => 
        c.sourceCompany === companyName || this.isRelatedCompany(c["Legal Name"], companyName)
      ),
      inspections: this.state.inspections.filter(i => 
        i.sourceCompany === companyName || this.isRelatedCompany(i["Firm Name"], companyName)
      )
    };

    // Create CSV content
    let csvContent = this.createCSVReport(exportData);
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${companyName.replace(/[^a-z0-9]/gi, '_')}_regulatory_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.showSuccess(`Report exported for ${companyName}`);
  },

  // Create CSV report
  createCSVReport: function(data) {
    let csv = [];
    
    // Header
    csv.push(`Regulatory Report for ${data.company}`);
    csv.push(`Generated on: ${new Date().toLocaleDateString()}`);
    csv.push('');
    
    // Summary
    csv.push('SUMMARY');
    csv.push(`Total Warning Letters,${data.warningLetters.length}`);
    csv.push(`Total Form 483s,${data.form483s.length}`);
    csv.push(`Total Citations,${data.citations.length}`);
    csv.push(`Total Inspections,${data.inspections.length}`);
    csv.push('');
    
    // Warning Letters
    csv.push('WARNING LETTERS');
    csv.push('Issue Date,Subject,Issuing Office,Letter ID');
    data.warningLetters.forEach(wl => {
      csv.push(`${wl.letterIssueDate},"${wl.subject || 'N/A'}","${wl.issuingOffice || 'N/A'}","${wl.letterId || 'N/A'}"`);
    });
    csv.push('');
    
    // Form 483s
    csv.push('FORM 483s');
    csv.push('Issue Date,FEI Number,Issuing Office');
    data.form483s.forEach(f483 => {
      csv.push(`${f483.issueDate || f483.recordDate || 'N/A'},"${f483.feiNumber || f483["FEI Number"] || 'N/A'}","${f483.issuingOffice || 'N/A'}"`);
    });
    csv.push('');
    
    // Citations
    csv.push('CITATIONS');
    csv.push('Date,Legal Name,Type,Description');
    data.citations.forEach(citation => {
      csv.push(`${citation["Record Date"]},"${citation["Legal Name"] || 'N/A'}","${citation["Record Type"] || 'Citation'}","${citation["Description"] || 'N/A'}"`);
    });
    csv.push('');
    
    // Inspections
    csv.push('INSPECTIONS');
    csv.push('End Date,Location,Project Area,Classification');
    data.inspections.forEach(inspection => {
      const location = [inspection["City"], inspection["State"]].filter(Boolean).join(', ') || 'N/A';
      csv.push(`${inspection["Inspection End Date"]},"${location}","${inspection["Project Area"] || 'N/A'}","${inspection["Inspection Classification"] || 'N/A'}"`);
    });
    
    return csv.join('\n');
  },

  // Refresh data
  refreshData: function() {
    if (this.state.selectedCompanies.length > 0) {
      console.log('🔄 Refreshing data...');
      this.performSearch(this.state.selectedCompanies);
    } else {
      this.showInfo('No companies selected to refresh');
    }
  },

  // Show success message
  showSuccess: function(message) {
    console.log('✅', message);
    this.showNotification(message, 'success');
  },

  // Show info message
  showInfo: function(message) {
    console.log('ℹ️', message);
    this.showNotification(message, 'info');
  },

  // Show error message
  showError: function(message) {
    console.error('❌', message);
    this.showNotification(message, 'error');
  },

  // Show notification with modern design
  showNotification: function(message, type = 'info') {
    // Remove any existing notifications
    const existingNotification = document.getElementById('notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    const icons = {
      success: `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      `,
      error: `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      `,
      info: `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      `
    };
    
    const colors = {
      success: 'bg-green-50 text-green-800 border-green-200',
      error: 'bg-red-50 text-red-800 border-red-200',
      info: 'bg-blue-50 text-blue-800 border-blue-200'
    };
    
    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = `fixed top-4 right-4 max-w-md p-4 rounded-lg shadow-lg border transform transition-all duration-300 z-50 ${colors[type]}`;
    notification.style.transform = 'translateX(400px)';
    
    notification.innerHTML = `
      <div class="flex items-start">
        <div class="flex-shrink-0">
          ${icons[type]}
        </div>
        <div class="ml-3 flex-1">
          <p class="text-sm font-medium">${message}</p>
        </div>
        <div class="ml-4 flex-shrink-0">
          <button onclick="document.getElementById('notification').remove()" 
                  class="inline-flex text-current opacity-70 hover:opacity-100">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(400px)';
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
  if (typeof window.searchWarningLetters === 'function') {
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
  
  // Check for existing searchCompanies function
  if (typeof window.searchCompanies === 'function') {
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
  
  // Also integrate with the checkbox-based company selection if it exists
  if (typeof window.getSelectedCompanies === 'function') {
    console.log('✅ Found getSelectedCompanies function - ready for integration');
  }
  
  console.log('🎉 Enhanced Warning Letters v2 integration complete!');
  console.log('📝 Features:');
  console.log('   ✅ Modern UI with gradient headers and smooth animations');
  console.log('   ✅ Proper backend endpoint integration');
  console.log('   ✅ Comprehensive company details modal');
  console.log('   ✅ Citations properly separated from Form 483s');
  console.log('   ✅ Risk assessment and analytics');
  console.log('   ✅ Timeline view of all regulatory events');
  console.log('   ✅ Export functionality');
  console.log('   ✅ Real-time data refresh');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.enhancedWarningLettersFixed;
}

// Add required styles if not already present
if (!document.getElementById('enhanced-wl-styles')) {
  const style = document.createElement('style');
  style.id = 'enhanced-wl-styles';
  style.textContent = `
    .loading-spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3b82f6;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .line-clamp-4 {
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    /* Modern scrollbar styles */
    .overflow-y-auto::-webkit-scrollbar {
      width: 8px;
    }
    
    .overflow-y-auto::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }
    
    .overflow-y-auto::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 4px;
    }
    
    .overflow-y-auto::-webkit-scrollbar-thumb:hover {
      background: #555;
    }
  `;
  document.head.appendChild(style);
}

// Enhanced dynamic search function for the frontend
// Add this to your enhanced-warning-letters-v2.js
// 4. ENHANCED: Main search function with better error handling
window.enhancedWarningLettersFixed.performEnhancedSearch = async function(companies) {
  console.log('🔍 Starting enhanced search for:', companies);
  
  this.state.loading = true;
  this.state.selectedCompanies = companies;
  this.showLoading(true);

  // Generate smart variations for any company name
  const generateSmartVariations = (company) => {
    const variations = new Set();
    const base = company.trim();
    
    // Always include original
    variations.add(base);
    
    // Clean version without common suffixes
    const cleanName = base
      .replace(/\s+(INC\.?|LLC|LTD|CORP\.?|CORPORATION|COMPANY|CO\.?|PHARMA|PHARMACEUTICALS?|PHARMS?|USA|INTERNATIONAL|GLOBAL|GROUP|HOLDINGS|LABS?|LABORATORIES)\.?$/gi, '')
      .trim();
    
    if (cleanName !== base && cleanName.length > 2) {
      variations.add(cleanName);
    }
    
    // First word (often the main identifier)
    const words = cleanName.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      variations.add(words[0]);
    }
    
    // Handle common abbreviations
    if (base.includes('PHARMS')) {
      variations.add(base.replace(/PHARMS/gi, 'PHARMACEUTICALS'));
    }
    
    return Array.from(variations).slice(0, 5); // Limit variations
  };

  try {
    const allResults = {
      warningLetters: [],
      form483s: [],
      citations: [],
      inspections: []
    };

    // Track which endpoints are available
    const endpointStatus = {
      warningLetters: true,
      form483s: true,
      inspections: true
    };

    // Search for each company
    for (const company of companies) {
      const variations = generateSmartVariations(company);
      console.log(`Searching variations for "${company}":`, variations);

      // 1. Search Warning Letters (if endpoint is available)
      if (endpointStatus.warningLetters) {
        try {
          const wlResults = await this.searchWarningLettersWithVariations(company, variations);
          allResults.warningLetters.push(...wlResults);
        } catch (error) {
          console.error('Warning Letters search failed:', error);
          endpointStatus.warningLetters = false;
        }
      }

      // 2. Search Form 483s (if endpoint is available)
      if (endpointStatus.form483s) {
        try {
          const form483Results = await this.searchForm483sWithVariations(company, variations);
          allResults.form483s.push(...form483Results);
        } catch (error) {
          console.error('Form 483s search failed:', error);
          endpointStatus.form483s = false;
        }
      }

      // 3. Search Inspections (including citations)
      if (endpointStatus.inspections) {
        try {
          const inspectionResults = await this.searchInspectionsWithVariations(company, variations);
          allResults.citations.push(...(inspectionResults.citations || []));
          allResults.inspections.push(...(inspectionResults.inspections || []));
        } catch (error) {
          console.error('Inspections search failed:', error);
          endpointStatus.inspections = false;
        }
      }
    }

    // Remove duplicates and update state - with error handling
    try {
      this.state.warningLetters = this.deduplicateResults(allResults.warningLetters, 'letterId') || [];
      this.state.form483s = this.deduplicateResults(allResults.form483s, '_id') || [];
      this.state.citations = this.deduplicateResults(allResults.citations, 'CitationID') || [];
      this.state.inspections = this.deduplicateResults(allResults.inspections, 'InspectionID') || [];
    } catch (dedupeError) {
      console.error('Deduplication error:', dedupeError);
      // Use raw results if deduplication fails
      this.state.warningLetters = allResults.warningLetters || [];
      this.state.form483s = allResults.form483s || [];
      this.state.citations = allResults.citations || [];
      this.state.inspections = allResults.inspections || [];
    }

    // Process analytics (with error handling)
    try {
      this.processViolations();
      this.processDrugMentions();
      this.buildCompanyMetrics();
    } catch (analyticsError) {
      console.error('Analytics processing error:', analyticsError);
    }

    // Update UI
    this.updateDashboard();
    
    // Show results
    const totalRecords = this.state.warningLetters.length + 
                        this.state.form483s.length + 
                        this.state.citations.length + 
                        this.state.inspections.length;
    
    console.log(`✅ Search completed: ${totalRecords} total records found`);
    
    // Check endpoint availability
    const unavailableEndpoints = [];
    if (!endpointStatus.warningLetters) unavailableEndpoints.push('Warning Letters');
    if (!endpointStatus.form483s) unavailableEndpoints.push('Form 483s');
    if (!endpointStatus.inspections) unavailableEndpoints.push('Inspections');
    
    if (unavailableEndpoints.length > 0) {
      console.warn(`⚠️ Some endpoints were unavailable: ${unavailableEndpoints.join(', ')}`);
    }
    
    if (totalRecords > 0) {
      this.showSuccess(`Found ${totalRecords} regulatory records`);
    } else {
      this.showInfo('No records found. This could mean:\n- The company has a clean record\n- The company uses different naming in FDA databases\n- Some search endpoints may be unavailable');
    }

  } catch (error) {
    console.error('❌ Search failed:', error);
    this.showError('Search failed: ' + error.message);
  } finally {
    this.state.loading = false;
    this.showLoading(false);
  }
};

window.enhancedWarningLettersFixed.searchWarningLettersWithVariations = async function(company, variations) {
  const results = [];
  
  for (const variation of variations) {
    try {
      // CORRECT ENDPOINT: /api/wl/search with GET method and query params
      const params = new URLSearchParams({
        term: variation,
        field: 'company',
        page: 1,
        perPage: 100
      });
      
      const response = await fetch(`/api/wl/search?${params}`, {
        method: 'GET' // Changed from POST to GET
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          
          // The response structure includes results array
          if (data.results && data.results.length > 0) {
            console.log(`  ✅ Found ${data.results.length} warning letters for "${variation}"`);
            data.results.forEach(letter => {
              letter.sourceCompany = company;
              letter.matchedVariation = variation;
            });
            results.push(...data.results);
            break; // Found results, no need to try other variations
          }
        }
      } else if (response.status === 404) {
        console.error('Warning Letters endpoint not found. Check if /api/wl/search exists in your backend.');
        break;
      }
    } catch (error) {
      console.warn(`Warning letter search failed for ${variation}:`, error.message);
    }
  }
  
  return results;
};






// Deduplicate results
window.enhancedWarningLettersFixed.deduplicateResults = function(array, key) {
  const seen = new Set(); // This was correct, but let's make it more robust
  
  if (!Array.isArray(array)) {
    console.warn('deduplicateResults: Input is not an array', array);
    return [];
  }
  
  return array.filter(item => {
    if (!item) return false;
    
    // Get the unique identifier
    const value = key && item[key] ? item[key] : JSON.stringify(item);
    
    if (!seen.has(value)) {
      seen.add(value);
      return true;
    }
    return false;
  });
};


// 3. Enhanced Matching Helper Functions
window.enhancedWarningLettersFixed.isRelaxedMatch = function(companyName, recordName, searchTerm) {
  if (!recordName) return false;
  
  const company = companyName.toLowerCase();
  const record = recordName.toLowerCase();
  const term = searchTerm.toLowerCase();
  
  // Direct matches
  if (record.includes(company) || company.includes(record)) return true;
  if (record.includes(term) || term.includes(record)) return true;
  
  // Word-based matching
  const companyWords = company.split(/\s+/).filter(w => w.length > 2);
  const recordWords = record.split(/\s+/).filter(w => w.length > 2);
  
  // Check if major words match
  let matchingWords = 0;
  for (const cWord of companyWords) {
    for (const rWord of recordWords) {
      if (cWord.includes(rWord) || rWord.includes(cWord)) {
        matchingWords++;
        break;
      }
    }
  }
  
  // Require at least 1 significant word match
  return matchingWords > 0 && matchingWords >= Math.min(companyWords.length * 0.5, 2);
};
window.enhancedWarningLettersFixed.showCompanyDetailsModal = function(companyName, data) {
  const { warningLetters, form483s, citations, inspections } = data;
  
  // Calculate risk assessment
  const riskScore = this.calculateRiskScore(data);
  
  // Create modal HTML with modern design
  const modalHtml = `
    <div class="fixed inset-0 z-50 overflow-y-auto" id="companyDetailsModal">
      <!-- Backdrop with blur -->
      <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"></div>
      
      <!-- Modal Container -->
      <div class="flex min-h-screen items-center justify-center p-4">
        <div class="relative w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
          
          <!-- Modal Header with Gradient -->
          <div class="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 px-8 py-6 text-white">
            <div class="flex items-start justify-between">
              <div>
                <h2 class="text-3xl font-bold">${companyName}</h2>
                <p class="mt-2 text-indigo-100">Comprehensive Regulatory Profile</p>
              </div>
              <button onclick="window.enhancedWarningLettersFixed.closeModal('companyDetailsModal')" 
                      class="rounded-lg bg-white bg-opacity-20 p-2 hover:bg-opacity-30 transition-colors">
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>
          
          <!-- Risk Assessment Bar -->
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-4">
                <span class="text-sm font-medium text-gray-700">Risk Assessment:</span>
                <div class="flex items-center space-x-2">
                  ${this.getRiskIndicators(riskScore)}
                </div>
              </div>
              <span class="text-sm text-gray-600">Based on ${warningLetters.length + citations.length + inspections.length} regulatory records</span>
            </div>
          </div>
          
          <!-- Statistics Cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-8 bg-gray-50">
            <div class="bg-white rounded-xl p-4 text-center shadow-sm">
              <div class="text-3xl font-bold text-red-600">${warningLetters.length}</div>
              <p class="text-sm text-gray-600 mt-1">Warning Letters</p>
            </div>
            <div class="bg-white rounded-xl p-4 text-center shadow-sm">
              <div class="text-3xl font-bold text-gray-400">—</div>
              <p class="text-sm text-gray-600 mt-1">Form 483s</p>
              <p class="text-xs text-gray-400">Temporarily Disabled</p>
            </div>
            <div class="bg-white rounded-xl p-4 text-center shadow-sm">
              <div class="text-3xl font-bold text-yellow-600">${citations.length}</div>
              <p class="text-sm text-gray-600 mt-1">Citations</p>
            </div>
            <div class="bg-white rounded-xl p-4 text-center shadow-sm">
              <div class="text-3xl font-bold text-blue-600">${inspections.length}</div>
              <p class="text-sm text-gray-600 mt-1">Inspections</p>
            </div>
          </div>
          
          <!-- Modal Body with Tabs -->
          <div class="p-8">
            <!-- Tab Navigation -->
            <div class="border-b border-gray-200 mb-6">
              <nav class="-mb-px flex space-x-8">
                <button onclick="window.enhancedWarningLettersFixed.switchModalTab('details')" 
                        data-modal-tab="details" 
                        class="modal-tab-btn border-indigo-500 text-indigo-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                  Detailed Records
                </button>
                <button onclick="window.enhancedWarningLettersFixed.switchModalTab('timeline')" 
                        data-modal-tab="timeline" 
                        class="modal-tab-btn border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                  Timeline View
                </button>
                <button onclick="window.enhancedWarningLettersFixed.switchModalTab('analytics')" 
                        data-modal-tab="analytics" 
                        class="modal-tab-btn border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                  Analytics
                </button>
              </nav>
            </div>
            
            <!-- Tab Content -->
            <div class="modal-tab-content">
              <!-- Details Tab -->
              <div id="modal-details-content" class="modal-tab-pane">
                ${this.createDetailedRecordsContent(warningLetters, citations, inspections)}
              </div>
              
              <!-- Timeline Tab -->
              <div id="modal-timeline-content" class="modal-tab-pane hidden">
                ${this.createTimelineContent(warningLetters, citations, inspections)}
              </div>
              
              <!-- Analytics Tab -->
              <div id="modal-analytics-content" class="modal-tab-pane hidden">
                ${this.createAnalyticsContent(warningLetters, citations, inspections)}
              </div>
            </div>
          </div>
          
          <!-- Modal Footer -->
          <div class="bg-gray-50 px-8 py-4 border-t border-gray-200">
            <div class="flex justify-end space-x-3">
              <button onclick="window.enhancedWarningLettersFixed.exportCompanyData('${companyName}')" 
                      class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                Export Report
              </button>
              <button onclick="window.enhancedWarningLettersFixed.closeModal('companyDetailsModal')" 
                      class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Remove any existing modal
  this.closeModal('companyDetailsModal');
  
  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Add event listeners
  const modal = document.getElementById('companyDetailsModal');
  
  // Click outside to close
  modal.addEventListener('click', function(e) {
    if (e.target === this || e.target.classList.contains('fixed')) {
      window.enhancedWarningLettersFixed.closeModal('companyDetailsModal');
    }
  });

  // Escape key to close
  const escapeHandler = function(e) {
    if (e.key === 'Escape') {
      window.enhancedWarningLettersFixed.closeModal('companyDetailsModal');
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
};

// Create detailed records content for modal
window.enhancedWarningLettersFixed.createDetailedRecordsContent = function(warningLetters, citations, inspections) {
  let html = '<div class="space-y-6">';
  
  // Warning Letters Section
  if (warningLetters.length > 0) {
    html += `
      <div>
        <h3 class="text-lg font-semibold text-gray-900 mb-3">Warning Letters (${warningLetters.length})</h3>
        <div class="space-y-3">
          ${warningLetters.map(letter => `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <p class="font-medium text-gray-900">${letter.subject || 'Warning Letter'}</p>
                  <p class="text-sm text-gray-600 mt-1">Issued: ${this.formatDate(letter.letterIssueDate)}</p>
                  <p class="text-sm text-gray-600">Office: ${letter.issuingOffice || 'FDA'}</p>
                </div>
                ${letter.pdfUrl ? `
                  <a href="${letter.pdfUrl}" target="_blank" 
                     class="ml-4 text-red-600 hover:text-red-800">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </a>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Citations Section
  if (citations.length > 0) {
    html += `
      <div>
        <h3 class="text-lg font-semibold text-gray-900 mb-3">Citations (${citations.length})</h3>
        <div class="space-y-3">
          ${citations.slice(0, 10).map(citation => `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p class="font-medium text-gray-900">${citation['ShortDescription'] || 'FDA Citation'}</p>
              <p class="text-sm text-gray-600 mt-1">Date: ${this.formatDate(citation['Record Date'] || citation['InspectionEndDate'])}</p>
              ${citation['LongDescription'] ? `
                <p class="text-sm text-gray-700 mt-2">${citation['LongDescription'].substring(0, 200)}${citation['LongDescription'].length > 200 ? '...' : ''}</p>
              ` : ''}
            </div>
          `).join('')}
          ${citations.length > 10 ? `
            <p class="text-sm text-gray-500 text-center">... and ${citations.length - 10} more citations</p>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  // Inspections Section
  if (inspections.length > 0) {
    html += `
      <div>
        <h3 class="text-lg font-semibold text-gray-900 mb-3">Inspections (${inspections.length})</h3>
        <div class="space-y-3">
          ${inspections.slice(0, 10).map(inspection => `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex justify-between items-start">
                <div>
                  <p class="font-medium text-gray-900">${inspection['Project Area'] || 'General Inspection'}</p>
                  <p class="text-sm text-gray-600 mt-1">Date: ${this.formatDate(inspection['Inspection End Date'])}</p>
                  <p class="text-sm text-gray-600">Location: ${inspection['City'] || 'N/A'}, ${inspection['State'] || 'N/A'}</p>
                </div>
                <span class="px-2 py-1 text-xs font-medium rounded-full ${
                  inspection['Inspection Classification'] === 'NAI' ? 'bg-green-100 text-green-800' :
                  inspection['Inspection Classification'] === 'VAI' ? 'bg-yellow-100 text-yellow-800' :
                  inspection['Inspection Classification'] === 'OAI' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }">
                  ${inspection['Inspection Classification'] || 'Pending'}
                </span>
              </div>
            </div>
          `).join('')}
          ${inspections.length > 10 ? `
            <p class="text-sm text-gray-500 text-center">... and ${inspections.length - 10} more inspections</p>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  if (warningLetters.length === 0 && citations.length === 0 && inspections.length === 0) {
    html += '<p class="text-center text-gray-500 py-8">No regulatory records found for this company.</p>';
  }
  
  html += '</div>';
  return html;
};

// Create timeline content
window.enhancedWarningLettersFixed.createTimelineContent = function(warningLetters, citations, inspections) {
  // Combine all records with dates
  const allRecords = [
    ...warningLetters.map(wl => ({
      type: 'warning',
      date: wl.letterIssueDate,
      title: 'Warning Letter',
      description: wl.subject || 'FDA Warning Letter',
      severity: 'high'
    })),
    ...citations.map(c => ({
      type: 'citation',
      date: c['Record Date'] || c['InspectionEndDate'],
      title: 'Citation',
      description: c['ShortDescription'] || 'FDA Citation',
      severity: 'medium'
    })),
    ...inspections.map(i => ({
      type: 'inspection',
      date: i['Inspection End Date'],
      title: `Inspection - ${i['Inspection Classification'] || 'N/A'}`,
      description: i['Project Area'] || 'General Inspection',
      severity: i['Inspection Classification'] === 'OAI' ? 'high' : 
               i['Inspection Classification'] === 'VAI' ? 'medium' : 'low'
    }))
  ].filter(r => r.date).sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (allRecords.length === 0) {
    return '<p class="text-center text-gray-500 py-8">No timeline data available.</p>';
  }
  
  return `
    <div class="relative">
      <div class="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>
      <div class="space-y-6">
        ${allRecords.map((record, index) => `
          <div class="relative flex items-start">
            <div class="absolute left-8 w-0.5 ${index === allRecords.length - 1 ? 'h-8' : 'h-full'} bg-gray-300"></div>
            <div class="relative z-10 flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-md">
              <div class="w-8 h-8 rounded-full ${
                record.severity === 'high' ? 'bg-red-500' :
                record.severity === 'medium' ? 'bg-yellow-500' :
                'bg-green-500'
              }"></div>
            </div>
            <div class="ml-6 flex-1">
              <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div class="flex items-center justify-between">
                  <h4 class="font-medium text-gray-900">${record.title}</h4>
                  <span class="text-sm text-gray-500">${this.formatDate(record.date)}</span>
                </div>
                <p class="text-sm text-gray-600 mt-1">${record.description}</p>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
};

// Create analytics content
window.enhancedWarningLettersFixed.createAnalyticsContent = function(warningLetters, citations, inspections) {
  // Calculate analytics
  const totalRecords = warningLetters.length + citations.length + inspections.length;
  
  // Group by year
  const recordsByYear = {};
  const allRecords = [
    ...warningLetters.map(w => ({ date: w.letterIssueDate, type: 'warning' })),
    ...citations.map(c => ({ date: c['Record Date'] || c['InspectionEndDate'], type: 'citation' })),
    ...inspections.map(i => ({ date: i['Inspection End Date'], type: 'inspection' }))
  ];
  
  allRecords.forEach(record => {
    if (record.date) {
      const year = new Date(record.date).getFullYear();
      if (!recordsByYear[year]) {
        recordsByYear[year] = { warning: 0, citation: 0, inspection: 0 };
      }
      recordsByYear[year][record.type]++;
    }
  });
  
  // Inspection classifications
  const classificationCounts = {};
  inspections.forEach(i => {
    const classification = i['Inspection Classification'] || 'Unknown';
    classificationCounts[classification] = (classificationCounts[classification] || 0) + 1;
  });
  
  return `
    <div class="space-y-6">
      <!-- Summary Stats -->
      <div class="bg-gray-50 rounded-lg p-6">
        <h4 class="font-semibold text-gray-900 mb-4">Summary Statistics</h4>
        <div class="grid grid-cols-3 gap-4 text-center">
          <div>
            <p class="text-2xl font-bold text-gray-900">${totalRecords}</p>
            <p class="text-sm text-gray-600">Total Records</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">${Object.keys(recordsByYear).length}</p>
            <p class="text-sm text-gray-600">Years Covered</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">${Math.round(totalRecords / Object.keys(recordsByYear).length) || 0}</p>
            <p class="text-sm text-gray-600">Avg Records/Year</p>
          </div>
        </div>
      </div>
      
      <!-- Records by Year -->
      <div>
        <h4 class="font-semibold text-gray-900 mb-4">Records by Year</h4>
        <div class="space-y-2">
          ${Object.entries(recordsByYear).sort((a, b) => b[0] - a[0]).map(([year, counts]) => `
            <div class="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
              <span class="font-medium text-gray-900">${year}</span>
              <div class="flex items-center space-x-4">
                <span class="text-sm text-red-600">WL: ${counts.warning}</span>
                <span class="text-sm text-yellow-600">Citations: ${counts.citation}</span>
                <span class="text-sm text-blue-600">Inspections: ${counts.inspection}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Inspection Classifications -->
      ${Object.keys(classificationCounts).length > 0 ? `
        <div>
          <h4 class="font-semibold text-gray-900 mb-4">Inspection Classifications</h4>
          <div class="space-y-2">
            ${Object.entries(classificationCounts).map(([classification, count]) => `
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-700">${classification}</span>
                <div class="flex items-center space-x-2">
                  <div class="w-32 bg-gray-200 rounded-full h-2">
                    <div class="h-2 rounded-full ${
                      classification === 'NAI' ? 'bg-green-500' :
                      classification === 'VAI' ? 'bg-yellow-500' :
                      classification === 'OAI' ? 'bg-red-500' :
                      'bg-gray-500'
                    }" style="width: ${(count / inspections.length) * 100}%"></div>
                  </div>
                  <span class="text-sm font-medium text-gray-900 w-12 text-right">${count}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
};

// Switch modal tabs
window.enhancedWarningLettersFixed.switchModalTab = function(tabName) {
  // Update tab buttons
  document.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.classList.remove('border-indigo-500', 'text-indigo-600');
    btn.classList.add('border-transparent', 'text-gray-500');
  });
  
  const activeTab = document.querySelector(`[data-modal-tab="${tabName}"]`);
  if (activeTab) {
    activeTab.classList.remove('border-transparent', 'text-gray-500');
    activeTab.classList.add('border-indigo-500', 'text-indigo-600');
  }
  
  // Update content
  document.querySelectorAll('.modal-tab-pane').forEach(pane => {
    pane.classList.add('hidden');
  });
  
  const activePane = document.getElementById(`modal-${tabName}-content`);
  if (activePane) {
    activePane.classList.remove('hidden');
  }
};

// Risk score calculation with proper weighting
window.enhancedWarningLettersFixed.calculateRiskScore = function(data) {
  const { warningLetters, citations, inspections } = data;
  
  // Count OAI inspections (Official Action Indicated - highest risk)
  const oaiCount = inspections.filter(i => 
    i['Inspection Classification'] === 'OAI'
  ).length;
  
  // Count VAI inspections (Voluntary Action Indicated - medium risk)
  const vaiCount = inspections.filter(i => 
    i['Inspection Classification'] === 'VAI'
  ).length;
  
  // Weight different factors
  const score = 
    (warningLetters.length * 10) +    // Warning letters are highest risk
    (oaiCount * 8) +                   // OAI inspections are very high risk
    (citations.length * 3) +           // Citations are medium risk
    (vaiCount * 2) +                   // VAI inspections are lower risk
    (inspections.length * 0.5);        // General inspections are lowest risk
  
  if (score >= 50) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
};

// Loading modal functions
window.enhancedWarningLettersFixed.showLoadingModal = function() {
  const loadingHtml = `
    <div id="loadingModal" class="hidden fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-black bg-opacity-50"></div>
      <div class="flex min-h-screen items-center justify-center p-4">
        <div class="bg-white rounded-lg p-6 shadow-xl">
          <div class="flex flex-col items-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p class="mt-4 text-gray-600">Loading company details...</p>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', loadingHtml);
};

window.enhancedWarningLettersFixed.hideLoadingModal = function() {
  const modal = document.getElementById('loadingModal');
  if (modal) modal.remove();
};

// Close modal function
window.enhancedWarningLettersFixed.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
  }
};

// Export data function
window.enhancedWarningLettersFixed.exportCompanyData = function(companyName) {
  const data = {
    company: companyName,
    exportDate: new Date().toISOString(),
    warningLetters: this.state.warningLetters.filter(wl => 
      wl.sourceCompany === companyName || this.isRelatedCompany(wl.companyName, companyName)
    ),
    citations: this.state.citations.filter(c => 
      c.sourceCompany === companyName || this.isRelatedCompany(c["Legal Name"], companyName)
    ),
    inspections: this.state.inspections.filter(i => 
      i.sourceCompany === companyName || this.isRelatedCompany(i["Legal Name"] || i["Firm Name"], companyName)
    )
  };
  
  // Convert to CSV
  const csv = this.convertToCSV(data);
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${companyName.replace(/[^a-z0-9]/gi, '_')}_FDA_Report_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  
  this.showSuccess('Report exported successfully!');
};
window.enhancedWarningLettersFixed.calculateMatchScore = function(companyName, recordName) {
  if (!recordName) return 0;
  
  const company = companyName.toLowerCase();
  const record = recordName.toLowerCase();
  
  // Exact match = 1.0
  if (company === record) return 1.0;
  
  // Substring matches
  if (record.includes(company)) return 0.9;
  if (company.includes(record)) return 0.8;
  
  // Word-based scoring
  const companyWords = company.split(/\s+/).filter(w => w.length > 2);
  const recordWords = record.split(/\s+/).filter(w => w.length > 2);
  
  let totalScore = 0;
  let matches = 0;
  
  for (const cWord of companyWords) {
    let bestMatch = 0;
    for (const rWord of recordWords) {
      if (cWord === rWord) bestMatch = Math.max(bestMatch, 1.0);
      else if (cWord.includes(rWord) || rWord.includes(cWord)) bestMatch = Math.max(bestMatch, 0.7);
    }
    if (bestMatch > 0) {
      totalScore += bestMatch;
      matches++;
    }
  }
  
  return matches > 0 ? (totalScore / companyWords.length) * 0.7 : 0;
};

window.enhancedWarningLettersFixed.generatePartialMatches = function(company) {
  const partials = [];
  const cleaned = company.replace(/\s+(INC|LLC|LTD|CORP|CORPORATION|CO|USA|INTERNATIONAL|PHARMACEUTICALS?|PHARMA)\.?$/gi, '').trim();
  
  if (cleaned !== company) partials.push(cleaned.toLowerCase());
  
  const words = cleaned.split(/\s+/).filter(w => w.length > 3);
  
  // Add first word if significant
  if (words.length > 0) partials.push(words[0].toLowerCase());
  
  // Add first two words if available
  if (words.length > 1) partials.push(`${words[0]} ${words[1]}`.toLowerCase());
  
  return partials;
};

window.enhancedWarningLettersFixed.calculateInspectionMatchScore = function(searchTerms, recordFields, originalCompany) {
  let maxScore = 0;
  
  for (const term of searchTerms) {
    for (const field of recordFields) {
      if (!field) continue;
      
      let score = 0;
      
      // Exact match
      if (field === term) score = 1.0;
      // Contains term
      else if (field.includes(term)) score = 0.8;
      // Term contains field (shorter company name in field)
      else if (term.includes(field) && field.length > 3) score = 0.6;
      // Word overlap
      else {
        const termWords = term.split(/\s+/);
        const fieldWords = field.split(/\s+/);
        const overlap = termWords.filter(tw => fieldWords.some(fw => fw.includes(tw) || tw.includes(fw)));
        if (overlap.length > 0) score = (overlap.length / termWords.length) * 0.5;
      }
      
      maxScore = Math.max(maxScore, score);
    }
  }
  
  return maxScore;
};

// 4. Configuration Override for Search Parameters
window.enhancedWarningLettersFixed.SEARCH_CONFIG = {
  form483: {
    maxResults: 50,
    minTermLength: 3, // Reduced from default
    strictFiltering: false,
    relevanceThreshold: 0.3
  },
  inspections: {
    maxCitations: 20, // Limit citations
    maxInspections: 50, // Limit inspections  
    relevanceThreshold: 0.3,
    enableScoring: true
  },
  warningLetters: {
    maxResults: 100,
    relevanceThreshold: 0.4
  }
};


// 3. Override the main performSearch to use correct endpoints
// window.enhancedWarningLettersFixed.performSearch = async function(companies) {
//   console.log('🔍 Starting search for:', companies);
  
//   this.state.loading = true;
//   this.state.selectedCompanies = companies;
//   this.showLoading(true);

//   try {
//     const allResults = {
//       warningLetters: [],
//       form483s: [],
//       citations: [],
//       inspections: []
//     };

//     // Generate smart variations for any company name
//     const generateSmartVariations = (company) => {
//       const variations = new Set();
//       const base = company.trim();
      
//       variations.add(base);
      
//       // Clean version without common suffixes
//       const cleanName = base
//         .replace(/\s+(INC\.?|LLC|LTD|CORP\.?|CORPORATION|COMPANY|CO\.?|PHARMA|PHARMACEUTICALS?|PHARMS?|USA|INTERNATIONAL|GLOBAL|GROUP|HOLDINGS|LABS?|LABORATORIES)\.?$/gi, '')
//         .trim();
      
//       if (cleanName !== base && cleanName.length > 2) {
//         variations.add(cleanName);
//       }
      
//       // First word (often the main identifier)
//       const words = cleanName.split(/\s+/).filter(w => w.length > 2);
//       if (words.length > 0) {
//         variations.add(words[0]);
//       }
      
//       // Handle common pharma abbreviations
//       if (base.includes('PHARMS')) {
//         variations.add(base.replace(/PHARMS/gi, 'PHARMACEUTICALS'));
//       }
//       if (base.includes('PHARMA')) {
//         variations.add(base.replace(/PHARMA/gi, 'PHARMACEUTICALS'));
//       }
      
//       return Array.from(variations).slice(0, 5);
//     };

//     // Search for each company
//     for (const company of companies) {
//       const variations = generateSmartVariations(company);
//       console.log(`Searching variations for "${company}":`, variations);

//       // 1. Search Warning Letters
//       try {
//         const wlResults = await this.searchWarningLettersWithVariations(company, variations);
//         allResults.warningLetters.push(...wlResults);
//       } catch (error) {
//         console.error('Warning Letters search failed:', error);
//       }

//       // 2. Search Form 483s
//       try {
//         const form483Results = await this.searchForm483sWithVariations(company, variations);
//         allResults.form483s.push(...form483Results);
//       } catch (error) {
//         console.error('Form 483s search failed:', error);
//       }

//       // 3. Search Inspections (this is working based on your logs)
//       try {
//         const inspectionResults = await this.searchInspectionsWithVariations(company, variations);
//         allResults.citations.push(...(inspectionResults.citations || []));
//         allResults.inspections.push(...(inspectionResults.inspections || []));
//       } catch (error) {
//         console.error('Inspections search failed:', error);
//       }
//     }

//     // Remove duplicates and update state
//     this.state.warningLetters = this.deduplicateResults(allResults.warningLetters, 'letterId') || [];
//     this.state.form483s = this.deduplicateResults(allResults.form483s, '_id') || [];
//     this.state.citations = this.deduplicateResults(allResults.citations, 'CitationID') || [];
//     this.state.inspections = this.deduplicateResults(allResults.inspections, 'InspectionID') || [];

//     // Process analytics
//     try {
//       this.processViolations();
//       this.processDrugMentions();
//       this.buildCompanyMetrics();
//     } catch (analyticsError) {
//       console.error('Analytics processing error:', analyticsError);
//     }

//     // Update UI
//     this.updateDashboard();
    
//     // Show results
//     const totalRecords = this.state.warningLetters.length + 
//                         this.state.form483s.length + 
//                         this.state.citations.length + 
//                         this.state.inspections.length;
    
//     console.log(`✅ Search completed: ${totalRecords} total records found`);
//     console.log(`  - Warning Letters: ${this.state.warningLetters.length}`);
//     console.log(`  - Form 483s: ${this.state.form483s.length}`);
//     console.log(`  - Citations: ${this.state.citations.length}`);
//     console.log(`  - Inspections: ${this.state.inspections.length}`);
    
//     if (totalRecords > 0) {
//       this.showSuccess(`Found ${totalRecords} regulatory records`);
//     } else {
//       this.showInfo('No records found. This could mean the company has a clean record or uses different naming in FDA databases.');
//     }

//   } catch (error) {
//     console.error('❌ Search failed:', error);
//     this.showError('Search failed: ' + error.message);
//   } finally {
//     this.state.loading = false;
//     this.showLoading(false);
//   }
// };
// Override the performSearch function to skip Form 483s
window.enhancedWarningLettersFixed.performSearch = async function(companies) {
  console.log('🔍 Starting search for:', companies);
  
  this.state.loading = true;
  this.state.selectedCompanies = companies;
  this.showLoading(true);

  try {
    const allResults = {
      warningLetters: [],
      form483s: [], // Keep empty - skip Form 483 search
      citations: [],
      inspections: []
    };

    // Generate smart variations for any company name
    const generateSmartVariations = (company) => {
      const variations = new Set();
      const base = company.trim();
      
      variations.add(base);
      
      // Clean version without common suffixes
      const cleanName = base
        .replace(/\s+(INC\.?|LLC|LTD|CORP\.?|CORPORATION|COMPANY|CO\.?|PHARMA|PHARMACEUTICALS?|PHARMS?|USA|INTERNATIONAL|GLOBAL|GROUP|HOLDINGS|LABS?|LABORATORIES)\.?$/gi, '')
        .trim();
      
      if (cleanName !== base && cleanName.length > 2) {
        variations.add(cleanName);
      }
      
      // First word (often the main identifier)
      const words = cleanName.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 0) {
        variations.add(words[0]);
      }
      
      // Handle common pharma abbreviations
      if (base.includes('PHARMS')) {
        variations.add(base.replace(/PHARMS/gi, 'PHARMACEUTICALS'));
      }
      if (base.includes('PHARMA')) {
        variations.add(base.replace(/PHARMA/gi, 'PHARMACEUTICALS'));
      }
      
      return Array.from(variations).slice(0, 5);
    };

    // Search for each company
    for (const company of companies) {
      const variations = generateSmartVariations(company);
      console.log(`Searching variations for "${company}":`, variations);

      // 1. Search Warning Letters
      try {
        const wlResults = await this.searchWarningLettersWithVariations(company, variations);
        allResults.warningLetters.push(...wlResults);
      } catch (error) {
        console.error('Warning Letters search failed:', error);
      }

      // 2. SKIP Form 483s - commented out to avoid loading issues
      // console.log('📋 Skipping Form 483s search (temporarily disabled)');
      /*
      try {
        const form483Results = await this.searchForm483sWithVariations(company, variations);
        allResults.form483s.push(...form483Results);
      } catch (error) {
        console.error('Form 483s search failed:', error);
      }
      */

      // 3. Search Inspections
      try {
        const inspectionResults = await this.searchInspectionsWithVariations(company, variations);
        allResults.citations.push(...(inspectionResults.citations || []));
        allResults.inspections.push(...(inspectionResults.inspections || []));
      } catch (error) {
        console.error('Inspections search failed:', error);
      }
    }

    // Remove duplicates and update state
    this.state.warningLetters = this.deduplicateResults(allResults.warningLetters, 'letterId') || [];
    this.state.form483s = []; // Keep empty
    this.state.citations = this.deduplicateResults(allResults.citations, 'CitationID') || [];
    this.state.inspections = this.deduplicateResults(allResults.inspections, 'InspectionID') || [];

    // Process analytics
    try {
      this.processViolations();
      this.processDrugMentions();
      this.buildCompanyMetrics();
    } catch (analyticsError) {
      console.error('Analytics processing error:', analyticsError);
    }

    // Update UI
    this.updateDashboard();
    
    // Show results
    const totalRecords = this.state.warningLetters.length + 
                        this.state.citations.length + 
                        this.state.inspections.length;
    
    console.log(`✅ Search completed: ${totalRecords} total records found`);
    console.log(`  - Warning Letters: ${this.state.warningLetters.length}`);
    console.log(`  - Form 483s: Skipped (temporarily disabled)`);
    console.log(`  - Citations: ${this.state.citations.length}`);
    console.log(`  - Inspections: ${this.state.inspections.length}`);
    
    if (totalRecords > 0) {
      this.showSuccess(`Found ${totalRecords} regulatory records (Form 483s temporarily disabled)`);
    } else {
      this.showInfo('No records found. This could mean the company has a clean record or uses different naming in FDA databases.');
    }

  } catch (error) {
    console.error('❌ Search failed:', error);
    this.showError('Search failed: ' + error.message);
  } finally {
    this.state.loading = false;
    this.showLoading(false);
  }
};


// Fix the showLoading function to use overlay instead of replacing content
window.enhancedWarningLettersFixed.showLoading = function(show) {
  const container = document.getElementById('enhancedWLContainer');
  if (!container) return;

  if (show) {
    // Create overlay instead of replacing content
    let loadingOverlay = document.getElementById('wl-loading-overlay');
    if (!loadingOverlay) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'wl-loading-overlay';
      loadingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      `;
      
      loadingOverlay.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
          <div style="text-align: center;">
            <div style="width: 50px; height: 50px; border: 3px solid #e5e7eb; border-top-color: #4f46e5; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            <h3 style="margin-top: 1rem; font-size: 1.125rem; font-weight: 600;">Searching FDA Databases...</h3>
            <p style="margin-top: 0.5rem; color: #6b7280;">This may take a moment</p>
          </div>
        </div>
        <style>
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      `;
      
      document.body.appendChild(loadingOverlay);
    }
    loadingOverlay.style.display = 'flex';
  } else {
    // Hide the overlay
    const loadingOverlay = document.getElementById('wl-loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
      // Optionally remove it completely
      loadingOverlay.remove();
    }
  }
  
  console.log(`📊 Loading state: ${show ? 'SHOWING' : 'HIDDEN'}`);
};


// Override createForm483Content to show disabled message
window.enhancedWarningLettersFixed.createForm483Content = function(form483s) {
  return `
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
      <p class="text-yellow-800">Form 483 search is temporarily disabled to improve loading performance.</p>
    </div>
  `;
};
// 4. OPTIONAL: Test function to verify endpoints
window.testFDAEndpoints = async function() {
  console.log('🧪 Testing FDA endpoints...');
  
  // Test Warning Letters
  try {
    const wlResponse = await fetch('/api/wl/search?term=test&field=company&page=1&perPage=1');
    console.log('✅ Warning Letters endpoint:', wlResponse.ok ? `Working (${wlResponse.status})` : `Error ${wlResponse.status}`);
    if (wlResponse.ok) {
      const data = await wlResponse.json();
      console.log('   Sample response:', data);
    }
  } catch (error) {
    console.log('❌ Warning Letters endpoint: Failed -', error.message);
  }
  
  // Test Form 483
  try {
    const f483Response = await fetch('/api/form483/search?term=test&field=company&page=1&perPage=1');
    console.log('✅ Form 483 endpoint:', f483Response.ok ? `Working (${f483Response.status})` : `Error ${f483Response.status}`);
    if (f483Response.ok) {
      const data = await f483Response.json();
      console.log('   Sample response:', data);
    }
  } catch (error) {
    console.log('❌ Form 483 endpoint: Failed -', error.message);
  }
  
  // Test Inspection
  try {
    const inspResponse = await fetch('/api/inspection-data?company=test');
    console.log('✅ Inspection endpoint:', inspResponse.ok ? `Working (${inspResponse.status})` : `Error ${inspResponse.status}`);
    if (inspResponse.ok) {
      const data = await inspResponse.json();
      console.log('   Sample response:', data);
    }
  } catch (error) {
    console.log('❌ Inspection endpoint: Failed -', error.message);
  }
  
  console.log('\n💡 Run window.testFDAEndpoints() to test your endpoints');
};


// Enhanced Company Matching Logic with Intelligent Search Strategies
// This replaces the existing matching functions in enhanced-warning-letters-v2.js

// 1. Smart Company Matcher with configurable strictness
window.enhancedWarningLettersFixed.createSmartCompanyMatcher = function(searchTerm, options = {}) {
  const {
    strictness = 'balanced', // 'strict', 'balanced', 'loose'
    requireWordBoundary = true,
    minWordLength = 3
  } = options;
  
  // Normalize the search term
  const normalizedSearch = searchTerm.trim().toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ');
  
  // Extract significant words (excluding common suffixes)
  const commonSuffixes = ['inc', 'llc', 'ltd', 'corp', 'corporation', 'company', 'co', 
                         'pharma', 'pharmaceutical', 'pharmaceuticals', 'pharms', 
                         'usa', 'international', 'global', 'group', 'holdings', 
                         'labs', 'lab', 'laboratories', 'laboratory'];
  
  const searchWords = normalizedSearch.split(' ')
    .filter(word => word.length >= minWordLength && !commonSuffixes.includes(word));
  
  return function(targetString) {
    if (!targetString) return false;
    
    const normalizedTarget = targetString.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
      .replace(/\s+/g, ' ');
    
    const targetWords = normalizedTarget.split(' ')
      .filter(word => word.length >= minWordLength);
    
    // Strict mode: Exact match or all significant words must match
    if (strictness === 'strict') {
      // Check for exact match first
      if (normalizedTarget === normalizedSearch) return true;
      
      // All search words must be present as whole words
      return searchWords.every(searchWord => {
        if (requireWordBoundary) {
          const regex = new RegExp(`\\b${searchWord}\\b`, 'i');
          return regex.test(normalizedTarget);
        }
        return targetWords.some(targetWord => targetWord === searchWord);
      });
    }
    
    // Balanced mode: Smart matching with word boundaries
    if (strictness === 'balanced') {
      // If search term is a single word, require it to be a whole word match
      if (searchWords.length === 1) {
        const searchWord = searchWords[0];
        if (requireWordBoundary) {
          // For single words, match as whole word or at the beginning of a word
          const regex = new RegExp(`\\b${searchWord}(?:\\b|\\w*)`, 'i');
          return regex.test(normalizedTarget);
        }
        return targetWords.some(targetWord => 
          targetWord === searchWord || targetWord.startsWith(searchWord)
        );
      }
      
      // For multi-word searches, require majority of words to match
      const matchThreshold = Math.ceil(searchWords.length * 0.6);
      let matchCount = 0;
      
      for (const searchWord of searchWords) {
        if (targetWords.some(targetWord => 
          targetWord === searchWord || 
          (targetWord.startsWith(searchWord) && searchWord.length >= 4)
        )) {
          matchCount++;
        }
      }
      
      return matchCount >= matchThreshold;
    }
    
    // Loose mode: Any significant word match
    if (strictness === 'loose') {
      return searchWords.some(searchWord => {
        return targetWords.some(targetWord => 
          targetWord.includes(searchWord) || searchWord.includes(targetWord)
        );
      });
    }
    
    return false;
  };
};

// 2. Enhanced variation generator with better logic
window.enhancedWarningLettersFixed.generateIntelligentVariations = function(company, options = {}) {
  const {
    maxVariations = 8,
    includeAbbreviations = true,
    includeAcronyms = true
  } = options;
  
  const variations = new Set();
  const original = company.trim();
  
  // Always include original
  variations.add(original);
  
  // Common pharma abbreviation mappings
  const abbreviationMap = {
    'PHARMACEUTICAL': ['PHARMA', 'PHARM'],
    'PHARMACEUTICALS': ['PHARMA', 'PHARMS'],
    'LABORATORIES': ['LABS', 'LAB'],
    'LABORATORY': ['LAB'],
    'CORPORATION': ['CORP'],
    'INCORPORATED': ['INC'],
    'LIMITED': ['LTD'],
    'COMPANY': ['CO']
  };
  
  // Remove common suffixes to get base name
  const suffixPattern = /\s+(INC\.?|LLC|LTD|CORP\.?|CORPORATION|COMPANY|CO\.?|PHARMA|PHARMACEUTICALS?|PHARMS?|USA|INTERNATIONAL|GLOBAL|GROUP|HOLDINGS|LABS?|LABORATORIES?|LABORATORY|MEDICAL|HEALTHCARE|THERAPEUTICS|OPERATIONS?|MANUFACTURING|MFG)\.?$/gi;
  
  const baseName = original.replace(suffixPattern, '').trim();
  if (baseName !== original && baseName.length > 2) {
    variations.add(baseName);
  }
  
  // Extract meaningful words
  const words = baseName.split(/\s+/).filter(word => 
    word.length >= 3 && 
    !['THE', 'AND', 'OF', 'FOR', 'IN', 'AT', 'BY'].includes(word.toUpperCase())
  );
  
  // Add individual significant words (but not common ones)
  if (words.length > 1) {
    // First word (often the primary identifier)
    variations.add(words[0]);
    
    // Last meaningful word if different from first
    const lastWord = words[words.length - 1];
    if (lastWord !== words[0] && lastWord.length >= 4) {
      variations.add(lastWord);
    }
    
    // First two words combined
    if (words.length >= 2) {
      variations.add(words.slice(0, 2).join(' '));
    }
  }
  
  // Generate abbreviation variations
  if (includeAbbreviations) {
    const currentVariations = Array.from(variations);
    for (const variation of currentVariations) {
      // Expand abbreviations
      for (const [full, abbrevs] of Object.entries(abbreviationMap)) {
        if (variation.toUpperCase().includes(full)) {
          for (const abbrev of abbrevs) {
            const abbreviated = variation.replace(new RegExp(full, 'gi'), abbrev);
            if (abbreviated !== variation) {
              variations.add(abbreviated);
            }
          }
        }
      }
      
      // Contract to abbreviations
      for (const [full, abbrevs] of Object.entries(abbreviationMap)) {
        for (const abbrev of abbrevs) {
          if (variation.toUpperCase().includes(abbrev) && !variation.toUpperCase().includes(full)) {
            const expanded = variation.replace(new RegExp(abbrev, 'gi'), full);
            if (expanded !== variation) {
              variations.add(expanded);
            }
          }
        }
      }
    }
  }
  
  // Generate acronym if multi-word
  if (includeAcronyms && words.length > 1) {
    const acronym = words.map(w => w[0]).join('').toUpperCase();
    if (acronym.length >= 2 && acronym.length <= 5) {
      variations.add(acronym);
    }
  }
  
  // Remove duplicates and limit
  return Array.from(variations)
    .filter(v => v.length >= 2)
    .slice(0, maxVariations);
};

// 3. Updated search functions with intelligent matching
window.enhancedWarningLettersFixed.searchWarningLettersWithVariations = async function(company, variations) {
  const results = [];
  const searchedTerms = new Set();
  
  // Use balanced matching for warning letters
  const matcher = this.createSmartCompanyMatcher(company, { strictness: 'balanced' });
  
  for (const variation of variations) {
    if (searchedTerms.has(variation.toLowerCase())) continue;
    searchedTerms.add(variation.toLowerCase());
    
    try {
      const params = new URLSearchParams({
        term: variation,
        field: 'company',
        page: 1,
        perPage: 100,
        _t: Date.now()
      });
      
      const response = await fetch(`/api/wl/search?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          // Filter results using smart matcher
          const filteredResults = data.results.filter(wl => 
            matcher(wl.companyName) || matcher(wl.company)
          );
          
          if (filteredResults.length > 0) {
            console.log(`✅ Found ${filteredResults.length} relevant Warning Letters for "${variation}"`);
            filteredResults.forEach(wl => {
              wl.sourceCompany = company;
              wl.matchedVariation = variation;
            });
            results.push(...filteredResults);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning letter search failed for ${variation}:`, error.message);
    }
  }
  
  return results;
};
window.enhancedWarningLettersFixed.searchInspectionsWithVariations = async function(company, variations) {
  const results = { citations: [], inspections: [] };
  
  console.log(`🏭 Enhanced Inspections Search for: ${company}`);
  
  try {
    const response = await fetch(`/api/inspection-data?company=${encodeURIComponent(company)}`);
    
    if (!response.ok) {
      throw new Error(`Inspection API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`  📊 Retrieved ${data.recentInspections?.length || 0} inspection records for ${company}`);
    
    if (!data.recentInspections || data.recentInspections.length === 0) {
      console.log(`  ℹ️ No inspection data found for ${company}`);
      return results;
    }
    
    // Process records - separate by actual type
    for (const record of data.recentInspections) {
      // Add metadata
      record.sourceCompany = company;
      
      // Check if it's a citation based on various indicators
      const isCitation = 
        record["CitationID"] || 
        record["ShortDescription"] || 
        record["LongDescription"] ||
        (record["Record Type"] && record["Record Type"].toLowerCase().includes('citation'));
      
      // Check if it's a Form 483 (should be skipped for now)
      const isForm483 = 
        (record["Record Type"] && record["Record Type"].toLowerCase().includes('form 483')) ||
        record["Form483ID"];
      
      if (isForm483) {
        // Skip Form 483s as they're disabled
        continue;
      } else if (isCitation) {
        // It's a citation
        results.citations.push(record);
      } else {
        // It's a regular inspection
        results.inspections.push(record);
      }
    }
    
    console.log(`  ✅ Found ${results.citations.length} citations and ${results.inspections.length} inspections for ${company}`);
    return results;
    
  } catch (error) {
    console.error(`Inspection search failed for ${company}:`, error);
    return results;
  }
};

// 4. Main search function with new matching logic
window.enhancedWarningLettersFixed.performEnhancedSearch = async function(companies) {
  console.log('🔍 Starting enhanced search with intelligent matching for:', companies);
  
  this.state.loading = true;
  this.state.selectedCompanies = companies;
  this.showLoading(true);

  try {
    const allResults = {
      warningLetters: [],
      form483s: [],
      citations: [],
      inspections: []
    };

    // Search for each company
    for (const company of companies) {
      const variations = this.generateIntelligentVariations(company, {
        maxVariations: 8,
        includeAbbreviations: true,
        includeAcronyms: true
      });
      
      console.log(`Generated intelligent variations for "${company}":`, variations);

      // 1. Search Warning Letters with smart matching
      try {
        const wlResults = await this.searchWarningLettersWithVariations(company, variations);
        allResults.warningLetters.push(...wlResults);
      } catch (error) {
        console.error('Warning Letters search failed:', error);
      }

      // 2. Search Form 483s with flexible matching
      try {
        const form483Results = await this.searchForm483sWithVariations(company, variations);
        allResults.form483s.push(...form483Results);
      } catch (error) {
        console.error('Form 483s search failed:', error);
      }

      // 3. Search Inspections
      try {
        const inspectionResults = await this.searchInspectionsWithVariations(company, variations);
        allResults.citations.push(...(inspectionResults.citations || []));
        allResults.inspections.push(...(inspectionResults.inspections || []));
      } catch (error) {
        console.error('Inspections search failed:', error);
      }
    }

    // Remove duplicates
    this.state.warningLetters = this.deduplicateResults(allResults.warningLetters, 'letterId');
    this.state.form483s = this.deduplicateResults(allResults.form483s, '_id');
    this.state.citations = this.deduplicateResults(allResults.citations, 'CitationID');
    this.state.inspections = this.deduplicateResults(allResults.inspections, 'InspectionID');

    // Process analytics
    try {
      this.processViolations();
      this.processDrugMentions();
      this.buildCompanyMetrics();
    } catch (analyticsError) {
      console.error('Analytics processing error:', analyticsError);
    }

    // Update UI
    this.updateDashboard();
    
    // Show results summary
    const totalRecords = this.state.warningLetters.length + 
                        this.state.form483s.length + 
                        this.state.citations.length + 
                        this.state.inspections.length;
    
    console.log(`✅ Search completed: ${totalRecords} total records found`);
    console.log(`  - Warning Letters: ${this.state.warningLetters.length}`);
    console.log(`  - Form 483s: ${this.state.form483s.length}`);
    console.log(`  - Citations: ${this.state.citations.length}`);
    console.log(`  - Inspections: ${this.state.inspections.length}`);
    
    if (totalRecords > 0) {
      this.showSuccess(`Found ${totalRecords} regulatory records`);
    } else {
      this.showInfo('No records found. Try adjusting the company name or check for alternative names.');
    }

  } catch (error) {
    console.error('❌ Search failed:', error);
    this.showError('Search failed: ' + error.message);
  } finally {
    this.state.loading = false;
    this.showLoading(false);
  }
};


// ===================================================================
// PROFESSIONAL INLINE LOADING SYSTEM - Enhanced Warning Letters
// Clean, minimal, and enterprise-grade loading experience
// ===================================================================



// Professional loading animation with realistic progress
window.enhancedWarningLettersFixed.startProfessionalLoadingAnimation = function() {
  const statusMessages = [
    "Establishing secure connection to FDA databases...",
    "Authenticating API credentials...",
    "Querying Warning Letters database...",
    "Processing enforcement actions...",
    "Analyzing Form 483 observations...",
    "Cross-referencing inspection records...",
    "Extracting violation patterns...",
    "Calculating compliance metrics...",
    "Generating risk assessment...",
    "Finalizing regulatory intelligence report..."
  ];
  
  const steps = [
    { id: 'step-wl', duration: 3000, name: 'Warning Letters' },
    { id: 'step-483', duration: 3500, name: 'Form 483s' },
    { id: 'step-insp', duration: 2500, name: 'Inspections' },
    { id: 'step-analytics', duration: 2000, name: 'Analytics' }
  ];
  
  let currentStep = 0;
  let messageIndex = 0;
  let totalProgress = 0;
  
  // Update status message
  const updateStatus = () => {
    const statusElement = document.getElementById('loadingStatus');
    const progressElement = document.getElementById('loadingProgress');
    
    if (statusElement && messageIndex < statusMessages.length) {
      statusElement.textContent = statusMessages[messageIndex];
      messageIndex++;
      
      totalProgress = Math.min(95, (messageIndex / statusMessages.length) * 100);
      if (progressElement) {
        progressElement.textContent = Math.round(totalProgress) + '%';
      }
    }
  };
  
  // Process each step
  const processStep = (stepIndex) => {
    if (stepIndex >= steps.length || !this.state.loading) return;
    
    const step = steps[stepIndex];
    const stepElement = document.getElementById(step.id);
    
    if (stepElement) {
      // Start step
      const indicator = stepElement.querySelector('.step-indicator');
      const status = stepElement.querySelector('.step-status');
      const progress = stepElement.querySelector('.step-progress');
      
      // Update to processing state
      indicator.innerHTML = `
        <div class="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      `;
      indicator.className = 'w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center step-indicator';
      status.textContent = 'Processing...';
      status.className = 'text-sm text-indigo-600 step-status font-medium';
      
      // Animate progress bar
      let stepProgress = 0;
      const progressInterval = setInterval(() => {
        stepProgress += 2;
        if (progress) {
          progress.style.width = Math.min(stepProgress, 100) + '%';
          progress.className = 'bg-indigo-600 h-1.5 rounded-full transition-all duration-300 step-progress';
        }
        
        if (stepProgress >= 100) {
          clearInterval(progressInterval);
          
          // Complete step
          indicator.innerHTML = `
            <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          `;
          indicator.className = 'w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center step-indicator';
          status.textContent = 'Complete';
          status.className = 'text-sm text-green-600 step-status font-medium';
          
          // Move to next step
          setTimeout(() => processStep(stepIndex + 1), 300);
        }
      }, step.duration / 50);
    }
  };
  
  // Start animations
  this.statusInterval = setInterval(updateStatus, 1000);
  setTimeout(() => processStep(0), 500);
  
  updateStatus(); // Initial status
};

// Stop professional loading animation
window.enhancedWarningLettersFixed.stopProfessionalLoadingAnimation = function() {
  if (this.statusInterval) {
    clearInterval(this.statusInterval);
    this.statusInterval = null;
  }
};

// Clean up old loading functions
window.enhancedWarningLettersFixed.showLoadingModal = function() {
  console.log('Using professional inline loading');
};

window.enhancedWarningLettersFixed.hideLoadingModal = function() {
  console.log('Professional loading complete');
};

// Enhanced CSS for professional loading
if (!document.getElementById('professional-loading-styles')) {
  const style = document.createElement('style');
  style.id = 'professional-loading-styles';
  style.textContent = `
    /* Professional loading animations */
    .step-indicator {
      transition: all 0.3s ease-in-out;
    }
    
    .step-progress {
      transition: width 0.3s ease-in-out;
    }
    
    .group:hover .step-indicator {
      transform: translateX(2px);
    }
    
    /* Smooth progress transitions */
    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    .animate-slide-in {
      animation: slideInRight 0.3s ease-out;
    }
    
    /* Enhanced spinner */
    @keyframes professional-spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
    
    /* Pulse effect for pending states */
    .animate-pulse-professional {
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: .7;
      }
    }
  `;
  document.head.appendChild(style);
}

console.log('✅ Professional Loading System initialized');
console.log('📋 Features:');
console.log('   • Clean, enterprise-grade design');
console.log('   • Step-by-step progress visualization');
console.log('   • Realistic status messaging');
console.log('   • Professional color scheme');
console.log('   • Smooth animations and transitions');


window.enhancedWarningLettersFixed.searchForm483sWithVariations = async function(company, variations) {
  const results = [];
  const searchedTerms = new Set();
  
  console.log(`🔍 Enhanced Form 483 Search for: ${company}`);
  
  // RELAXED search strategies - try multiple approaches
  const searchStrategies = [
    // Strategy 1: Exact company name with multiple fields
    {
      terms: [company],
      fields: ['legalName', 'Legal_Name', 'company', 'companyName', 'firm_name'],
      description: 'Exact match - multiple fields',
      strict: false
    },
    // Strategy 2: Partial matches without common suffixes
    {
      terms: [
        company.replace(/\s+(INC|LLC|LTD|CORP|CORPORATION|CO|USA|INTERNATIONAL|PHARMACEUTICALS?|PHARMA)\.?$/gi, '').trim()
      ].filter(term => term && term.length > 3),
      fields: ['legalName', 'Legal_Name'],
      description: 'Without business suffixes',
      strict: false
    },
    // Strategy 3: First significant word (often brand name)
    {
      terms: (() => {
        const words = company.split(/\s+/).filter(w => 
          w.length > 3 && !['INC', 'LLC', 'LTD', 'CORP', 'USA', 'THE', 'AND'].includes(w.toUpperCase())
        );
        return words.slice(0, 2); // Try first 1-2 significant words
      })(),
      fields: ['legalName', 'Legal_Name'],
      description: 'Key word search',
      strict: false
    },
    // Strategy 4: Fuzzy matching with shorter terms
    {
      terms: variations.filter(v => v.length >= 4), // Accept shorter terms
      fields: ['legalName', 'Legal_Name', 'company'],
      description: 'All variations - relaxed',
      strict: false
    }
  ];

  // Try each strategy
  for (const strategy of searchStrategies) {
    console.log(`  📋 Strategy: ${strategy.description}`);
    
    for (const searchTerm of strategy.terms) {
      if (!searchTerm || searchedTerms.has(searchTerm.toLowerCase())) continue;
      searchedTerms.add(searchTerm.toLowerCase());
      
      for (const field of strategy.fields) {
        try {
          const params = new URLSearchParams({
            term: searchTerm,
            field: field,
            page: 1,
            perPage: 50, // Smaller batches for faster processing
            _t: Date.now()
          });
          
          const response = await fetch(`/api/form483/search?${params}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
              console.log(`    ✅ Found ${data.results.length} Form 483s for "${searchTerm}" in ${field}`);
              
              // RELAXED relevance filtering
              data.results.forEach(f483 => {
                const recordCompanyName = (
                  f483.legalName || 
                  f483.Legal_Name || 
                  f483.companyName || 
                  f483.company || 
                  ''
                ).trim().toLowerCase();
                
                // More lenient matching - check for partial matches
                const isRelevant = this.isRelaxedMatch(company.toLowerCase(), recordCompanyName, searchTerm.toLowerCase());
                
                if (isRelevant) {
                  f483.sourceCompany = company;
                  f483.matchedVariation = searchTerm;
                  f483.matchStrategy = strategy.description;
                  f483.matchField = field;
                  f483.normalizedCompanyName = recordCompanyName;
                  f483.relevanceScore = this.calculateMatchScore(company, recordCompanyName);
                  results.push(f483);
                } else {
                  console.log(`    ⚠️ Weak match filtered: "${recordCompanyName}"`);
                }
              });
              
              // Don't break on first success - collect from all strategies
            }
          }
        } catch (error) {
          console.warn(`    ❌ Form 483 search error for ${searchTerm}:`, error.message);
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
  
  // Remove duplicates and sort by relevance
  const uniqueResults = this.deduplicateResults(results, '_id');
  const sortedResults = uniqueResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  
  console.log(`  📋 Form 483 Final: ${sortedResults.length} relevant results for ${company}`);
  return sortedResults;
};





// Override createForm483Content to show disabled message
window.enhancedWarningLettersFixed.createForm483Content = function(form483s) {
  return `
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
      <p class="text-yellow-800">Form 483 search is temporarily disabled to improve loading performance.</p>
    </div>
  `;
};


// Also update the dashboard to hide Form 483 UI elements
window.enhancedWarningLettersFixed.updateDashboard = function() {
  console.log('🖥️ Updating dashboard with data...');
  console.log('Current state:', {
    warningLetters: this.state.warningLetters.length,
    citations: this.state.citations.length,
    inspections: this.state.inspections.length
  });

  // Update the metric cards in the dashboard
  const updateMetric = (selector, value) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      if (el) el.textContent = value;
    });
  };

  // Update metrics - look for multiple possible selectors
  updateMetric('#totalWarningLetters, #wl-count, [data-metric="warning-letters"]', this.state.warningLetters.length);
  updateMetric('#totalForm483s, #f483-count, [data-metric="form-483s"]', '—');
  updateMetric('#totalCitations, [data-metric="citations"]', this.state.citations.length);
  updateMetric('#totalInspections, [data-metric="inspections"]', this.state.inspections.length);

  // Update company table if it exists
  const tbody = document.querySelector('#companyTableBody, tbody[data-table="companies"]');
  if (tbody) {
    // Build company metrics first
    this.buildCompanyMetrics();
    
    if (this.state.companies && this.state.companies.length > 0) {
      tbody.innerHTML = this.state.companies.map(company => `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-medium text-gray-900">${company.name}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              company.warningLetterCount > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
            }">
              ${company.warningLetterCount}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              —
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              company.citationCount > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
            }">
              ${company.citationCount}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              company.inspectionCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
            }">
              ${company.inspectionCount}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            ${this.getRiskIndicator(company.riskLevel)}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button onclick="window.enhancedWarningLettersFixed.viewCompanyDetails('${company.name}')" 
                    class="text-indigo-600 hover:text-indigo-900">
              View Details
            </button>
          </td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-8 text-center text-gray-500">
            No data to display. Data fetched but no matching companies found in results.
          </td>
        </tr>
      `;
    }
  }

  // Update violations if the element exists
  this.updateViolations();
  
  // Update drug mentions if the element exists
  this.updateDrugMentions();
};


// Build company metrics from the fetched data
window.enhancedWarningLettersFixed.buildCompanyMetrics = function() {
  console.log('📊 Building company metrics...');
  
  // Create a map of companies with their data
  const companyMap = new Map();
  
  // Process warning letters
  this.state.warningLetters.forEach(wl => {
    const companyName = wl.companyName || wl.company || 'Unknown';
    if (!companyMap.has(companyName)) {
      companyMap.set(companyName, {
        name: companyName,
        warningLetters: [],
        form483s: [],
        citations: [],
        inspections: []
      });
    }
    companyMap.get(companyName).warningLetters.push(wl);
  });
  
  // Process citations
  this.state.citations.forEach(citation => {
    const companyName = citation['Legal Name'] || citation.legalName || 'Unknown';
    if (!companyMap.has(companyName)) {
      companyMap.set(companyName, {
        name: companyName,
        warningLetters: [],
        form483s: [],
        citations: [],
        inspections: []
      });
    }
    companyMap.get(companyName).citations.push(citation);
  });
  
  // Process inspections
  this.state.inspections.forEach(inspection => {
    const companyName = inspection['Legal Name'] || inspection['Firm Name'] || 'Unknown';
    if (!companyMap.has(companyName)) {
      companyMap.set(companyName, {
        name: companyName,
        warningLetters: [],
        form483s: [],
        citations: [],
        inspections: []
      });
    }
    companyMap.get(companyName).inspections.push(inspection);
  });
  
  // Convert to array and calculate risk levels
  this.state.companies = Array.from(companyMap.values()).map(company => {
    const warningLetterCount = company.warningLetters.length;
    const citationCount = company.citations.length;
    const inspectionCount = company.inspections.length;
    
    // Calculate risk level
    let riskLevel = 'low';
    if (warningLetterCount > 2 || (warningLetterCount > 0 && citationCount > 5)) {
      riskLevel = 'high';
    } else if (warningLetterCount > 0 || citationCount > 3) {
      riskLevel = 'medium';
    }
    
    return {
      ...company,
      warningLetterCount,
      form483Count: 0, // Disabled
      citationCount,
      inspectionCount,
      riskLevel
    };
  });
  
  // Update metrics
  this.state.metrics = {
    totalWarningLetters: this.state.warningLetters.length,
    totalForm483s: 0,
    totalCitations: this.state.citations.length,
    totalInspections: this.state.inspections.length,
    companiesAffected: this.state.companies.length
  };
  
  console.log('📊 Company metrics built:', this.state.companies);
};

// Get risk indicator HTML
window.enhancedWarningLettersFixed.getRiskIndicator = function(riskLevel) {
  const indicators = {
    low: `
      <div class="flex items-center justify-center space-x-1">
        <div class="w-2 h-2 bg-green-500 rounded-full"></div>
        <span class="text-xs font-medium text-green-700">Low Risk</span>
      </div>
    `,
    medium: `
      <div class="flex items-center justify-center space-x-1">
        <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
        <span class="text-xs font-medium text-yellow-700">Medium Risk</span>
      </div>
    `,
    high: `
      <div class="flex items-center justify-center space-x-1">
        <div class="w-2 h-2 bg-red-500 rounded-full"></div>
        <span class="text-xs font-medium text-red-700">High Risk</span>
      </div>
    `
  };
  
  return indicators[riskLevel] || indicators.low;
};

// Update violations display
window.enhancedWarningLettersFixed.updateViolations = function() {
  const container = document.querySelector('#violationsContainer, [data-section="violations"]');
  if (!container) return;
  
  // Process violations from warning letters
  const violationCounts = {};
  
  this.state.warningLetters.forEach(wl => {
    // Extract violations from content
    const content = wl.fullContent || wl.content || wl.subject || '';
    const commonViolations = [
      'CGMP', 'GMP', 'adulterated', 'misbranded', 'quality system', 
      'validation', 'contamination', 'sterility', 'documentation'
    ];
    
    commonViolations.forEach(violation => {
      if (content.toLowerCase().includes(violation.toLowerCase())) {
        violationCounts[violation] = (violationCounts[violation] || 0) + 1;
      }
    });
  });
  
  const sortedViolations = Object.entries(violationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  if (sortedViolations.length > 0) {
    container.innerHTML = sortedViolations.map(([violation, count]) => `
      <div class="flex items-center justify-between py-2">
        <span class="text-sm text-gray-700">${violation}</span>
        <span class="text-sm font-medium text-gray-900">${count}</span>
      </div>
    `).join('');
  } else {
    container.innerHTML = '<p class="text-sm text-gray-500">No violations found</p>';
  }
};

// Update drug mentions display
window.enhancedWarningLettersFixed.updateDrugMentions = function() {
  const container = document.querySelector('#drugMentionsContainer, [data-section="drugs"]');
  if (!container) return;
  
  // This would require more complex drug name extraction
  // For now, just show a placeholder
  container.innerHTML = '<p class="text-sm text-gray-500">Drug analysis not available</p>';
};

// View company details
window.enhancedWarningLettersFixed.viewCompanyDetails = function(companyName) {
  console.log('Viewing details for:', companyName);
  // This would open a modal or navigate to details
  alert(`Detailed view for ${companyName} - Feature coming soon!`);
};

// Override createForm483Content to show disabled message
window.enhancedWarningLettersFixed.createForm483Content = function(form483s) {
  return `
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
      <p class="text-yellow-800">Form 483 search is temporarily disabled to improve loading performance.</p>
    </div>
  `;
};

console.log('✅ Minimal fix applied - Form 483s disabled');

// Override the main performSearch
// window.enhancedWarningLettersFixed.performSearch = window.enhancedWarningLettersFixed.performEnhancedSearch;

console.log('✅ Enhanced Company Matching Logic loaded successfully!');

// Override the main performSearch to use enhanced version
// window.enhancedWarningLettersFixed.performSearch = window.enhancedWarningLettersFixed.performEnhancedSearch;

console.log('✅ Enhanced Warning Letters System v2 - Complete version loaded successfully!');

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