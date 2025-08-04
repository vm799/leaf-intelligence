// ===================================================================
// FIXED ENHANCED WARNING LETTERS V2 - Complete Working Version
// ===================================================================

window.enhancedWarningLettersFixed = {
  state: {
    selectedCompanies: [],
    warningLetters: [],
    form483s: [],
    inspections: [],
    citations: [],
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

  // Setup UI
  setupUI: function() {
    let container = document.getElementById('enhancedWLContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'enhancedWLContainer';
      container.className = 'mt-6';
      
      const warningLettersDiv = document.getElementById('warningLetters');
      if (warningLettersDiv) {
        warningLettersDiv.innerHTML = '';
        warningLettersDiv.appendChild(container);
      } else {
        document.body.appendChild(container);
      }
    }
    
    this.renderDashboard();
  },

  // Show loading state
  showLoading: function(show) {
    const loadingDiv = document.getElementById('wl-loading');
    if (loadingDiv) {
      loadingDiv.style.display = show ? 'flex' : 'none';
    }
  },

  // Render dashboard
  renderDashboard: function() {
    const container = document.getElementById('enhancedWLContainer');
    if (!container) return;

    container.innerHTML = `
      <!-- Dashboard Header -->
      <div class="mb-8">
        <div class="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-6 rounded-lg shadow-lg">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="text-2xl font-bold mb-2">FDA Regulatory Intelligence Dashboard</h2>
              <p class="text-indigo-100">Comprehensive Warning Letters & Form 483 Analysis</p>
            </div>
            <button onclick="window.enhancedWarningLettersFixed.refreshData()" 
                    class="bg-white text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div id="wl-loading" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div class="mt-3 text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <h3 class="text-lg leading-6 font-medium text-gray-900 mt-4">Analyzing FDA Data...</h3>
            <p class="text-sm text-gray-500 mt-2">This may take a moment</p>
          </div>
        </div>
      </div>

      <!-- Metrics Overview -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Warning Letters</p>
              <p class="text-2xl font-bold text-gray-900" id="wl-count">0</p>
            </div>
            <div class="text-red-500">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Form 483s</p>
              <p class="text-2xl font-bold text-gray-900" id="f483-count">0</p>
            </div>
            <div class="text-yellow-500">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Inspections</p>
              <p class="text-2xl font-bold text-gray-900" id="inspection-count">0</p>
            </div>
            <div class="text-blue-500">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Risk Score</p>
              <p class="text-2xl font-bold text-gray-900" id="risk-score">Low</p>
            </div>
            <div class="text-green-500">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="border-b border-gray-200 mb-6">
        <nav class="-mb-px flex space-x-8">
          <button onclick="window.enhancedWarningLettersFixed.switchTab('timeline')" 
                  data-tab="timeline" 
                  class="tab-btn border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
            Timeline View
          </button>
          <button onclick="window.enhancedWarningLettersFixed.switchTab('violations')" 
                  data-tab="violations" 
                  class="tab-btn border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
            Violations Analysis
          </button>
          <button onclick="window.enhancedWarningLettersFixed.switchTab('details')" 
                  data-tab="details" 
                  class="tab-btn border-indigo-500 text-indigo-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
            Detailed Records
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      <div id="timeline-content" class="tab-content hidden"></div>
      <div id="violations-content" class="tab-content hidden"></div>
      <div id="details-content" class="tab-content">
        <div id="wl-results-container">
          <p class="text-gray-500 text-center py-8">No data loaded yet. Search for companies to view results.</p>
        </div>
      </div>
    `;
  },

  // Perform search with proper async handling
  performSearch: async function(companies) {
    console.log('🔍 Starting search for:', companies);
    this.state.loading = true;
    this.showLoading(true);

    try {
      // Clear previous results
      this.state.warningLetters = [];
      this.state.form483s = [];
      this.state.inspections = [];
      this.state.citations = [];

      // Search Warning Letters
      console.log('📋 Searching Warning Letters...');
      for (const company of companies) {
        try {
          const wlResponse = await fetch(`/api/wl/search?term=${encodeURIComponent(company)}&field=company&page=1&perPage=100`);
          if (wlResponse.ok) {
            const wlData = await wlResponse.json();
            if (wlData.results && Array.isArray(wlData.results)) {
              this.state.warningLetters.push(...wlData.results);
            }
          }
        } catch (error) {
          console.error(`Error fetching warning letters for ${company}:`, error);
        }
      }

      // Search Form 483s
      console.log('📄 Searching Form 483s...');
      for (const company of companies) {
        try {
          const f483Response = await fetch(`/api/form483/search?term=${encodeURIComponent(company)}&field=company&page=1&perPage=100`);
          if (f483Response.ok) {
            const f483Data = await f483Response.json();
            if (f483Data.results && Array.isArray(f483Data.results)) {
              this.state.form483s.push(...f483Data.results);
            }
          }
        } catch (error) {
          console.error(`Error fetching Form 483s for ${company}:`, error);
        }
      }

      // Search Inspections
      console.log('🔍 Searching Inspections...');
      for (const company of companies) {
        try {
          const inspResponse = await fetch(`/api/inspection-data?company=${encodeURIComponent(company)}`);
          if (inspResponse.ok) {
            const inspData = await inspResponse.json();
            if (inspData.recentInspections && Array.isArray(inspData.recentInspections)) {
              this.state.inspections.push(...inspData.recentInspections);
            }
          }
        } catch (error) {
          console.error(`Error fetching inspections for ${company}:`, error);
        }
      }

      console.log('✅ Search complete:', {
        warningLetters: this.state.warningLetters.length,
        form483s: this.state.form483s.length,
        inspections: this.state.inspections.length
      });

      // Update UI
      this.updateMetrics();
      this.renderResults();

    } catch (error) {
      console.error('❌ Search failed:', error);
      this.showError('Search failed: ' + error.message);
    } finally {
      this.state.loading = false;
      this.showLoading(false);
    }
  },

  // Update metrics
  updateMetrics: function() {
    document.getElementById('wl-count').textContent = this.state.warningLetters.length;
    document.getElementById('f483-count').textContent = this.state.form483s.length;
    document.getElementById('inspection-count').textContent = this.state.inspections.length;
    
    // Calculate risk score
    const totalIssues = this.state.warningLetters.length + this.state.form483s.length;
    let riskLevel = 'Low';
    if (totalIssues > 10) riskLevel = 'High';
    else if (totalIssues > 5) riskLevel = 'Medium';
    
    document.getElementById('risk-score').textContent = riskLevel;
  },

  // Render results
  renderResults: function() {
    const container = document.getElementById('wl-results-container');
    if (!container) return;

    let html = '';

    // Warning Letters Section
    if (this.state.warningLetters.length > 0) {
      html += `
        <div class="mb-8">
          <h3 class="text-xl font-bold mb-4 text-gray-800">Warning Letters (${this.state.warningLetters.length})</h3>
          <div class="space-y-4">
            ${this.state.warningLetters.map(letter => this.createWarningLetterCard(letter)).join('')}
          </div>
        </div>
      `;
    }

    // Form 483s Section
    if (this.state.form483s.length > 0) {
      html += `
        <div class="mb-8">
          <h3 class="text-xl font-bold mb-4 text-gray-800">Form 483s (${this.state.form483s.length})</h3>
          <div class="space-y-4">
            ${this.state.form483s.map(form => this.createForm483Card(form)).join('')}
          </div>
        </div>
      `;
    }

    // Inspections Section
    if (this.state.inspections.length > 0) {
      html += `
        <div class="mb-8">
          <h3 class="text-xl font-bold mb-4 text-gray-800">Inspections (${this.state.inspections.length})</h3>
          <div class="space-y-4">
            ${this.state.inspections.map(inspection => this.createInspectionCard(inspection)).join('')}
          </div>
        </div>
      `;
    }

    if (html === '') {
      html = '<p class="text-gray-500 text-center py-8">No FDA regulatory data found for the selected companies.</p>';
    }

    container.innerHTML = html;
  },

  // Create warning letter card
  createWarningLetterCard: function(letter) {
    return `
      <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-red-50">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h4 class="font-semibold text-gray-900">${letter.companyName || 'Unknown Company'}</h4>
            <p class="text-sm text-gray-600 mt-1">${letter.subject || 'No subject'}</p>
            <div class="flex gap-4 mt-2 text-sm text-gray-500">
              <span>📅 ${this.formatDate(letter.letterIssueDate)}</span>
              <span>🏢 ${letter.issuingOffice || 'FDA'}</span>
            </div>
          </div>
          ${letter.pdfUrl ? `
            <a href="${letter.pdfUrl}" target="_blank" class="text-blue-600 hover:text-blue-800">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </a>
          ` : ''}
        </div>
      </div>
    `;
  },

  // Create Form 483 card
  createForm483Card: function(form) {
    return `
      <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-yellow-50">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h4 class="font-semibold text-gray-900">${form.legalName || 'Unknown Company'}</h4>
            <p class="text-sm text-gray-600 mt-1">Form 483 Observations</p>
            <div class="flex gap-4 mt-2 text-sm text-gray-500">
              <span>📅 ${this.formatDate(form.recordDate)}</span>
              <span>📍 ${form.city || 'Unknown'}, ${form.state || ''}</span>
            </div>
          </div>
          ${form.downloadUrl ? `
            <a href="${form.downloadUrl}" target="_blank" class="text-blue-600 hover:text-blue-800">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </a>
          ` : ''}
        </div>
      </div>
    `;
  },

  // Create inspection card
  createInspectionCard: function(inspection) {
    const classificationColor = {
      'NAI': 'text-green-600',
      'VAI': 'text-yellow-600',
      'OAI': 'text-red-600'
    };

    return `
      <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h4 class="font-semibold text-gray-900">${inspection['Legal Name'] || inspection['Firm Name'] || 'Unknown Company'}</h4>
            <p class="text-sm text-gray-600 mt-1">${inspection['Project Area'] || 'General Inspection'}</p>
            <div class="flex gap-4 mt-2 text-sm text-gray-500">
              <span>📅 ${this.formatDate(inspection['Inspection End Date'])}</span>
              <span class="${classificationColor[inspection['Inspection Classification']] || 'text-gray-600'}">
                ${inspection['Inspection Classification'] || 'Pending'}
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Format date
  formatDate: function(dateString) {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (error) {
      return dateString;
    }
  },

  // Switch tabs
  switchTab: function(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('border-indigo-500', 'text-indigo-600');
      btn.classList.add('border-transparent', 'text-gray-500');
    });
    
    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeTab) {
      activeTab.classList.remove('border-transparent', 'text-gray-500');
      activeTab.classList.add('border-indigo-500', 'text-indigo-600');
    }

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    
    const activeContent = document.getElementById(`${tabName}-content`);
    if (activeContent) {
      activeContent.classList.remove('hidden');
    }
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

  // Show error message
  showError: function(message) {
    console.error('❌', message);
    alert('Error: ' + message);
  },

  // Show info message
  showInfo: function(message) {
    console.log('ℹ️', message);
    alert('Info: ' + message);
  }
};

// Create aliases for backward compatibility
window.enhancedWarningLetters = window.enhancedWarningLettersFixed;
window.enhancedWL = window.enhancedWarningLettersFixed;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('🎯 Enhanced Warning Letters v2 FIXED system loaded and ready');
  
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
  
  console.log('🎉 Enhanced Warning Letters v2 FIXED integration complete!');
  console.log('💡 To use: window.enhancedWarningLettersFixed.init(["Company Name"])');
});


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