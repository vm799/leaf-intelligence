// FDA Manufacturers Module
const FDAManufacturers = (function() {
  let currentResults = null;
  let currentModalData = null;
  let activeTab = 'overview';
  let expandedRows = new Set();

  const terms = ['ketamine', 'ibuprofen', 'acetaminophen', 'insulin', 'metformin'];

  // Initialize module
  function init() {
    // Set up popular searches
    const popularSearches = document.getElementById('fda-popular-searches');
    if (popularSearches) {
      popularSearches.innerHTML = `
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-gray-600">Popular searches:</span>
          ${terms.map(ex => `
            <button 
              class="text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition"
              onclick="document.getElementById('fda-compound').value='${ex}'; FDAManufacturers.performSearch()"
            >
              ${ex}
            </button>
          `).join('')}
        </div>
      `;
    }

    // Set up event listeners
    const compoundInput = document.getElementById('fda-compound');
    if (compoundInput) {
      compoundInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
      });
    }
  }

  async function performSearch() {
    const compound = document.getElementById('fda-compound').value.trim();
    const includeGeneric = document.getElementById('fda-includeGeneric').checked;
    const includeBrand = document.getElementById('fda-includeBrand').checked;
    const fetchCompliance = document.getElementById('fda-fetchCompliance').checked;
    
    if (!compound) {
      showNotification('Please enter a drug compound name', 'error');
      return;
    }

    // Reset UI
    document.getElementById('fda-loading').classList.remove('hidden');
    document.getElementById('fda-results').innerHTML = '';
    document.getElementById('fda-stats').classList.add('hidden');
    document.getElementById('fda-exportBtn').classList.add('hidden');
    expandedRows.clear();
    
    if (fetchCompliance) {
      document.getElementById('fda-loadingStatus').textContent = 'Fetching compliance data for all facilities...';
    }

    try {
      const params = new URLSearchParams({
        compound: compound,
        includeGeneric: includeGeneric,
        includeBrand: includeBrand,
        fetchCompliance: fetchCompliance
      });

      const response = await fetch(`/api/fei/drug-compound/manufacturers?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch data');
      }

      currentResults = data;
      displayResults(data);

    } catch (error) {
      document.getElementById('fda-loading').classList.add('hidden');
      document.getElementById('fda-results').innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-xl p-6">
          <div class="flex items-center gap-3">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <p class="font-semibold text-red-900">Error</p>
              <p class="text-red-700">${error.message}</p>
            </div>
          </div>
        </div>
      `;
    }
  }

  function searchWithCompound(compound) {
    const compoundInput = document.getElementById('fda-compound');
    if (compoundInput) {
        compoundInput.value = compound;
    }
    performSearch();
}

  function displayResults(data) {
    document.getElementById('fda-loading').classList.add('hidden');
    
    if (data.total_manufacturers === 0) {
      document.getElementById('fda-results').innerHTML = `
        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div class="flex items-center gap-3">
            <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <div>
              <p class="font-semibold text-yellow-900">No manufacturers found</p>
              <p class="text-yellow-700">No manufacturers were found for "${data.compound}". Try searching with different spelling or check if it's a brand name.</p>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Update stats
    document.getElementById('fda-totalManufacturers').textContent = data.total_manufacturers;
    document.getElementById('fda-withFEI').textContent = data.manufacturers_with_fei;
    document.getElementById('fda-totalFEI').textContent = data.total_fei_numbers || 0;
    document.getElementById('fda-withoutFEI').textContent = data.total_manufacturers - data.manufacturers_with_fei;
    document.getElementById('fda-stats').classList.remove('hidden');
    document.getElementById('fda-exportBtn').classList.remove('hidden');

    // Separate manufacturers with and without FEI
    const withFEI = data.manufacturers.filter(m => m.fei_establishments && m.fei_establishments.length > 0);
    const withoutFEI = data.manufacturers.filter(m => !m.fei_establishments || m.fei_establishments.length === 0);

    // Display results
    const resultsHtml = `
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900">
          Search Results for "${data.compound}"
        </h2>
        <p class="text-gray-600 mt-1">
          ${data.dashboard_api_available ? 'Full compliance data available' : 'Limited data - configure FDA Dashboard API for complete results'}
        </p>
      </div>

      ${withFEI.length > 0 ? `
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="p-6 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Manufacturers with FEI Numbers
            </h3>
          </div>
          
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manufacturer</th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">FEI Count</th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Products</th>
                  ${data.compliance_data_fetched ? `
                    <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Classifications</th>
                    <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Citations</th>
                    <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Refusals</th>
                  ` : ''}
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${withFEI.map((manufacturer, mIndex) => {
                  const totalCompliance = manufacturer.fei_establishments.reduce((acc, est) => {
                    const comp = est.compliance_data || {};
                    return {
                      classifications: acc.classifications + (comp.inspections_classifications?.length || 0),
                      citations: acc.citations + (comp.inspections_citations?.length || 0),
                      actions: acc.actions + (comp.compliance_actions?.length || 0),
                      refusals: acc.refusals + (comp.import_refusals?.length || 0)
                    };
                  }, { classifications: 0, citations: 0, actions: 0, refusals: 0 });
                  
                  const totalProducts = manufacturer.products.length + manufacturer.ndc_products.length;
                  
                  return `
                    <tr class="hover:bg-gray-50">
                      <td class="px-6 py-4">
                        <div class="text-sm font-medium text-gray-900">${manufacturer.manufacturer_name}</div>
                        ${manufacturer.duns_number ? `
                          <div class="text-xs text-gray-500">DUNS: ${manufacturer.duns_number}</div>
                        ` : ''}
                      </td>
                      <td class="px-6 py-4 text-center">
                        <span class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ${manufacturer.fei_establishments.length}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-center">
                        <span class="text-sm text-gray-900">${totalProducts}</span>
                      </td>
                      ${data.compliance_data_fetched ? `
                        <td class="px-6 py-4 text-center">
                          <span class="text-sm ${totalCompliance.classifications > 0 ? 'text-purple-600 font-medium' : 'text-gray-400'}">${totalCompliance.classifications}</span>
                        </td>
                        <td class="px-6 py-4 text-center">
                          <span class="text-sm ${totalCompliance.citations > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}">${totalCompliance.citations}</span>
                        </td>
                        <td class="px-6 py-4 text-center">
                          <span class="text-sm ${totalCompliance.actions > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}">${totalCompliance.actions}</span>
                        </td>
                        <td class="px-6 py-4 text-center">
                          <span class="text-sm ${totalCompliance.refusals > 0 ? 'text-yellow-600 font-medium' : 'text-gray-400'}">${totalCompliance.refusals}</span>
                        </td>
                      ` : ''}
                      <td class="px-6 py-4 text-center">
                        <button 
                          onclick="FDAManufacturers.toggleManufacturerDetails(${mIndex})"
                          class="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          <svg class="w-5 h-5 inline-block transition-transform duration-200 ${expandedRows.has(mIndex) ? 'transform rotate-90' : ''}" 
                               id="fda-expand-icon-${mIndex}" 
                               fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                          </svg>
                          Details
                        </button>
                      </td>
                    </tr>
                    <tr id="fda-details-${mIndex}" class="hidden">
                      <td colspan="${data.compliance_data_fetched ? '8' : '5'}" class="px-6 py-4 bg-gray-50">
                        ${renderManufacturerDetails(manufacturer, mIndex, data)}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
      
      ${withoutFEI.length > 0 ? `
        <div class="mt-8">
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div class="p-6 border-b border-gray-200">
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Manufacturers without FEI Numbers (${withoutFEI.length})
                </h3>
                <button 
                  onclick="FDAManufacturers.toggleNoFEISection()"
                  class="text-sm text-gray-600 hover:text-gray-800"
                >
                  <span id="fda-noFEI-toggle-text">Hide</span>
                  <svg class="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
              </div>
              <p class="text-sm text-gray-600 mt-1">These manufacturers were found in NDC listings but FEI numbers couldn't be located</p>
            </div>
            
            <div id="fda-noFEI-content" class="p-6">
              <div class="space-y-4">
                ${withoutFEI.map((manufacturer, index) => `
                  <div class="bg-gray-50 rounded-lg p-4">
                    <h4 class="font-medium text-gray-900 mb-2">${manufacturer.manufacturer_name}</h4>
                    <p class="text-sm text-gray-600">
                      ${manufacturer.ndc_products.length} NDC Listed Products
                    </p>
                  </div>
                `).join('')}
              </div>
              
              <div class="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p class="text-sm font-medium text-amber-900 mb-2">
                  <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  How to find FEI numbers:
                </p>
                <ul class="text-sm text-amber-800 space-y-1">
                  <li>• Check FDA's <a href="https://www.fda.gov/drugs/drug-approvals-and-databases/drug-establishments-current-registration-site-file" target="_blank" class="text-amber-600 hover:text-amber-700 underline">establishment registration database</a></li>
                  <li>• Search <a href="https://www.accessdata.fda.gov/scripts/cder/daf/" target="_blank" class="text-amber-600 hover:text-amber-700 underline">FDA's Drug Approval database</a></li>
                  <li>• Look up <a href="https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts" target="_blank" class="text-amber-600 hover:text-amber-700 underline">FDA recalls or enforcement actions</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ` : ''}
    `;
    
    document.getElementById('fda-results').innerHTML = resultsHtml;
  }

  function renderManufacturerDetails(manufacturer, mIndex, data) {
    return `
      <div class="space-y-4">
        <!-- FEI Establishments -->
        <div>
          <h5 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Facility Establishments</h5>
          ${manufacturer.fei_establishments.map((est, estIndex) => {
            const complianceTotal = 
              (est.compliance_data?.inspections_classifications?.length || 0) +
              (est.compliance_data?.inspections_citations?.length || 0) +
              (est.compliance_data?.compliance_actions?.length || 0) +
              (est.compliance_data?.import_refusals?.length || 0);
            
            return `
              <div class="bg-white rounded-lg p-4 mb-3 border border-gray-200 compliance-card hover:border-blue-300" 
                   onclick="FDAManufacturers.showComplianceModal(${mIndex}, ${estIndex})">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <div class="flex items-center gap-3">
                      <span class="font-mono font-bold text-lg text-gray-900">FEI: ${est.fei_number}</span>
                      ${complianceTotal > 0 ? `
                        <span class="status-badge text-blue-600">
                          ${complianceTotal} compliance records
                        </span>
                      ` : `
                        <span class="status-badge text-gray-400">
                          No compliance records
                        </span>
                      `}
                    </div>
                    ${est.firm_name && est.firm_name !== manufacturer.manufacturer_name ? 
                      `<p class="text-sm text-gray-700 mt-1 font-medium">${est.firm_name}</p>` : ''
                    }
                    ${est.address ? `
                      <p class="text-sm text-gray-600 mt-2">
                        <svg class="w-4 h-4 inline mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        ${est.address}${est.city ? `, ${est.city}` : ''}${est.state ? `, ${est.state}` : ''}
                        ${est.zip ? ` ${est.zip}` : ''}${est.country ? `, ${est.country}` : ''}
                      </p>
                    ` : ''}
                    <p class="text-xs text-gray-500 mt-2">${est.source}</p>
                  </div>
                  <svg class="w-5 h-5 text-gray-400 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
                
                ${data.compliance_data_fetched && complianceTotal > 0 ? `
                  <div class="mt-3 pt-3 border-t border-gray-200">
                    <div class="grid grid-cols-4 gap-2 text-xs">
                      ${est.compliance_data?.inspections_classifications?.length > 0 ? `
                        <div class="text-center">
                          <p class="font-semibold text-purple-600">${est.compliance_data.inspections_classifications.length}</p>
                          <p class="text-gray-500">Classifications</p>
                        </div>
                      ` : ''}
                      ${est.compliance_data?.inspections_citations?.length > 0 ? `
                        <div class="text-center">
                          <p class="font-semibold text-red-600">${est.compliance_data.inspections_citations.length}</p>
                          <p class="text-gray-500">Citations</p>
                        </div>
                      ` : ''}
                      ${est.compliance_data?.compliance_actions?.length > 0 ? `
                        <div class="text-center">
                          <p class="font-semibold text-orange-600">${est.compliance_data.compliance_actions.length}</p>
                          <p class="text-gray-500">Actions</p>
                        </div>
                      ` : ''}
                      ${est.compliance_data?.import_refusals?.length > 0 ? `
                        <div class="text-center">
                          <p class="font-semibold text-yellow-600">${est.compliance_data.import_refusals.length}</p>
                          <p class="text-gray-500">Refusals</p>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
        
        <!-- Products -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          ${manufacturer.products.length > 0 ? `
            <div>
              <h5 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">
                FDA Approved Products (${manufacturer.products.length})
              </h5>
              <div class="bg-blue-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                ${manufacturer.products.slice(0, 5).map(prod => `
                  <div class="text-sm mb-2 pb-2 border-b border-blue-100 last:border-0">
                    <p class="font-medium text-gray-900">${prod.brand_name || prod.generic_name}</p>
                    ${prod.dosage_form ? `<p class="text-gray-600">${prod.dosage_form}${prod.strength ? ` - ${prod.strength}` : ''}</p>` : ''}
                    ${prod.application_number ? `<p class="text-xs text-gray-500">App: ${prod.application_number}</p>` : ''}
                  </div>
                `).join('')}
                ${manufacturer.products.length > 5 ? `
                  <p class="text-xs text-gray-500 italic mt-2">+ ${manufacturer.products.length - 5} more products</p>
                ` : ''}
              </div>
            </div>
          ` : ''}
          
          ${manufacturer.ndc_products.length > 0 ? `
            <div>
              <h5 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">
                NDC Listed Products (${manufacturer.ndc_products.length})
              </h5>
              <div class="bg-purple-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                ${manufacturer.ndc_products.slice(0, 5).map(prod => {
                  const productName = prod.proprietary_name || prod.nonproprietary_name || 'Generic Product';
                  return `
                    <div class="text-sm mb-2 pb-2 border-b border-purple-100 last:border-0">
                      <p class="font-medium text-gray-900">${productName}</p>
                      <p class="text-xs text-gray-600">NDC: ${prod.product_ndc}</p>
                      ${prod.active_ingredients ? `
                        <p class="text-xs text-gray-500">${prod.active_ingredients.map(i => `${i.name} ${i.strength || ''}`).join(', ')}</p>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
                ${manufacturer.ndc_products.length > 5 ? `
                  <p class="text-xs text-gray-500 italic mt-2">+ ${manufacturer.ndc_products.length - 5} more products</p>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function toggleManufacturerDetails(mIndex) {
    const detailsRow = document.getElementById(`fda-details-${mIndex}`);
    const icon = document.getElementById(`fda-expand-icon-${mIndex}`);
    
    if (expandedRows.has(mIndex)) {
      expandedRows.delete(mIndex);
      detailsRow.classList.add('hidden');
      icon.classList.remove('transform', 'rotate-90');
    } else {
      expandedRows.add(mIndex);
      detailsRow.classList.remove('hidden');
      icon.classList.add('transform', 'rotate-90');
    }
  }

  function toggleNoFEISection() {
    const content = document.getElementById('fda-noFEI-content');
    const toggleText = document.getElementById('fda-noFEI-toggle-text');
    
    if (content.classList.contains('hidden')) {
      content.classList.remove('hidden');
      toggleText.textContent = 'Hide';
    } else {
      content.classList.add('hidden');
      toggleText.textContent = 'Show';
    }
  }

  function createComplianceModal() {
    // Remove existing modal if any
    const existingModal = document.getElementById('fda-complianceModal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal HTML
    const modalHtml = `
      <div id="fda-complianceModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 hidden">
        <div class="relative top-20 mx-auto p-5 border w-11/12 max-w-7xl shadow-lg rounded-md bg-white">
          <!-- Modal Header -->
          <div class="gradient-bg text-white p-6 -m-5 mb-0 rounded-t-md">
            <div class="flex justify-between items-start">
              <div>
                <h2 class="text-2xl font-bold" id="fda-modalTitle">Compliance Details</h2>
                <p class="text-purple-100 mt-1" id="fda-modalSubtitle"></p>
              </div>
              <button onclick="FDAManufacturers.closeModal()" class="text-white hover:text-gray-200 transition p-2 hover:bg-white/10 rounded-lg">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>
          
          <!-- Modal Body -->
          <div class="bg-gray-50 -mx-5 mt-0">
            <!-- Overview Stats -->
            <div id="fda-modalOverview" class="bg-white px-6 py-4 border-b border-gray-200"></div>
            
            <!-- Tabs -->
            <div class="bg-white border-b border-gray-200 px-6">
              <div class="flex overflow-x-auto" id="fda-modalTabs">
                <!-- Dynamic tabs will be inserted here -->
              </div>
            </div>
            
            <!-- Tab Content -->
            <div class="p-6 overflow-y-auto" style="max-height: calc(90vh - 300px)">
              <div id="fda-modalContent">
                <!-- Dynamic content will be inserted here -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  function showComplianceModal(mIndex, estIndex) {
    // Create modal if it doesn't exist
    if (!document.getElementById('fda-complianceModal')) {
      createComplianceModal();
    }

    const manufacturer = currentResults.manufacturers[mIndex];
    const establishment = manufacturer.fei_establishments[estIndex];
    
    currentModalData = { manufacturer, establishment };
    activeTab = 'overview';
    
    document.getElementById('fda-modalTitle').textContent = `FEI ${establishment.fei_number}`;
    document.getElementById('fda-modalSubtitle').textContent = manufacturer.manufacturer_name;
    
    // Calculate compliance stats
    const complianceData = establishment.compliance_data || {};
    const stats = {
      classifications: complianceData.inspections_classifications?.length || 0,
      citations: complianceData.inspections_citations?.length || 0,
      actions: complianceData.compliance_actions?.length || 0,
      refusals: complianceData.import_refusals?.length || 0
    };
    const totalCompliance = Object.values(stats).reduce((a, b) => a + b, 0);
    
    // Create overview
    const overviewHtml = `
      <div class="modal-overview">
        <div class="overview-card">
          <div class="overview-number text-purple-600">${stats.classifications}</div>
          <div class="overview-label">Classifications</div>
        </div>
        <div class="overview-card">
          <div class="overview-number text-red-600">${stats.citations}</div>
          <div class="overview-label">Citations</div>
        </div>
        <div class="overview-card">
          <div class="overview-number text-orange-600">${stats.actions}</div>
          <div class="overview-label">Actions</div>
        </div>
        <div class="overview-card">
          <div class="overview-number text-yellow-600">${stats.refusals}</div>
          <div class="overview-label">Import Refusals</div>
        </div>
        <div class="overview-card">
          <div class="overview-number text-blue-600">${totalCompliance}</div>
          <div class="overview-label">Total Records</div>
        </div>
      </div>
    `;
    document.getElementById('fda-modalOverview').innerHTML = overviewHtml;
    
    // Create tabs
    const tabs = [
      { id: 'overview', label: 'Overview', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
      { id: 'classifications', label: 'Inspection Classifications', count: stats.classifications, color: 'purple' },
      { id: 'citations', label: 'Citations', count: stats.citations, color: 'red' },
      { id: 'actions', label: 'Compliance Actions', count: stats.actions, color: 'orange' },
      { id: 'refusals', label: 'Import Refusals', count: stats.refusals, color: 'yellow' }
    ];
    
    const tabsHtml = tabs.map(tab => `
      <button 
        class="tab-button ${activeTab === tab.id ? 'active' : ''}" 
        onclick="FDAManufacturers.switchTab('${tab.id}')"
        id="fda-tab-${tab.id}"
      >
        ${tab.icon ? `
          <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${tab.icon}"></path>
          </svg>
        ` : ''}
        ${tab.label}
        ${tab.count !== undefined ? `<span class="tab-count">${tab.count}</span>` : ''}
      </button>
    `).join('');
    
    document.getElementById('fda-modalTabs').innerHTML = tabsHtml;
    
    // Show initial content
    updateModalContent();
    
    // Show modal
    const modal = document.getElementById('fda-complianceModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = document.getElementById('fda-complianceModal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = 'auto';
    }
  }

  function switchTab(tabId) {
    activeTab = tabId;
    
    // Update active tab styling
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById(`fda-tab-${tabId}`).classList.add('active');
    
    updateModalContent();
  }

  function updateModalContent() {
    const { establishment, manufacturer } = currentModalData;
    const complianceData = establishment.compliance_data || {};
    
    let content = '';
    
    switch (activeTab) {
      case 'overview':
        content = renderOverviewTab(establishment, manufacturer);
        // Trigger warning letter search after rendering
        setTimeout(() => {
          searchAndDisplayCompanyWarningLetters(manufacturer.manufacturer_name);
        }, 100);
        break;
      case 'classifications':
        content = renderComplianceTab(
          'Inspection Classifications',
          complianceData.inspections_classifications || [],
          'purple',
          getClassificationExplanation()
        );
        break;
      case 'citations':
        content = renderComplianceTab(
          'Inspection Citations',
          complianceData.inspections_citations || [],
          'red',
          getCitationExplanation()
        );
        break;
      case 'actions':
        content = renderComplianceTab(
          'Compliance Actions',
          complianceData.compliance_actions || [],
          'orange',
          getActionExplanation()
        );
        break;
      case 'refusals':
        content = renderComplianceTab(
          'Import Refusals',
          complianceData.import_refusals || [],
          'yellow',
          getRefusalExplanation()
        );
        break;
    }
    
    document.getElementById('fda-modalContent').innerHTML = content;
  }

  function renderOverviewTab(establishment, manufacturer) {
    return `
      <div class="space-y-6">
        <!-- Facility Information -->
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Facility Information</h3>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">FEI Number</div>
              <div class="info-value font-mono">${establishment.fei_number}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Manufacturer</div>
              <div class="info-value">${manufacturer.manufacturer_name}</div>
            </div>
            ${establishment.firm_name ? `
              <div class="info-item">
                <div class="info-label">Firm Name</div>
                <div class="info-value">${establishment.firm_name}</div>
              </div>
            ` : ''}
            <div class="info-item">
              <div class="info-label">Data Source</div>
              <div class="info-value">${establishment.source}</div>
            </div>
          </div>
          
          ${establishment.address ? `
            <div class="mt-4 pt-4 border-t border-gray-200">
              <div class="info-label mb-2">Facility Address</div>
              <p class="text-gray-700">
                ${establishment.address}${establishment.city ? `, ${establishment.city}` : ''}${establishment.state ? `, ${establishment.state}` : ''}
                ${establishment.zip ? ` ${establishment.zip}` : ''}${establishment.country ? `, ${establishment.country}` : ''}
              </p>
            </div>
          ` : ''}
        </div>
        
        <!-- Compliance Summary -->
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Compliance Summary</h3>
          ${currentResults.compliance_data_fetched ? `
            <div class="space-y-4">
              ${renderComplianceSummaryItem('Inspection Classifications', establishment.compliance_data?.inspections_classifications || [], 'purple')}
              ${renderComplianceSummaryItem('Inspection Citations', establishment.compliance_data?.inspections_citations || [], 'red')}
              ${renderComplianceSummaryItem('Compliance Actions', establishment.compliance_data?.compliance_actions || [], 'orange')}
              ${renderComplianceSummaryItem('Import Refusals', establishment.compliance_data?.import_refusals || [], 'yellow')}
            </div>
          ` : `
            <div class="text-center py-8 text-gray-500">
              <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
              <p>Compliance data not fetched</p>
              <p class="text-sm mt-2">Enable "Fetch compliance data" option to see detailed information</p>
            </div>
          `}
        </div>
        
        <!-- Products -->
        <div class="bg-white rounded-lg p-6 border border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Associated Products</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="info-item">
              <div class="info-label">FDA Approved Products</div>
              <div class="info-value text-2xl">${manufacturer.products.length}</div>
            </div>
            <div class="info-item">
              <div class="info-label">NDC Listed Products</div>
              <div class="info-value text-2xl">${manufacturer.ndc_products.length}</div>
            </div>
          </div>
        </div>
        
        <!-- Company Warning Letters -->
        <div class="bg-white rounded-lg p-6 border border-gray-200 mt-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Company Warning Letters</h3>
          <div id="fda-company-warning-letters">
            <div class="text-center py-4">
              <div class="loading-spinner mx-auto mb-2" style="width: 24px; height: 24px;"></div>
              <p class="text-sm text-gray-600">Searching for warning letters...</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderComplianceSummaryItem(title, data, color) {
    const colorMap = {
      purple: 'bg-purple-100 text-purple-800',
      red: 'bg-red-100 text-red-800',
      orange: 'bg-orange-100 text-orange-800',
      yellow: 'bg-yellow-100 text-yellow-800'
    };
    
    const mostRecent = data.length > 0 ? 
      data.sort((a, b) => {
        const dateA = new Date(a.InspectionEndDate || a.ActionTakenDate || a.RefusalDate || 0);
        const dateB = new Date(b.InspectionEndDate || b.ActionTakenDate || b.RefusalDate || 0);
        return dateB - dateA;
      })[0] : null;
    
    const recentDate = mostRecent ? 
      (mostRecent.InspectionEndDate || mostRecent.ActionTakenDate || mostRecent.RefusalDate) : null;
    
    return `
      <div class="flex items-center justify-between p-3 rounded-lg ${colorMap[color].split(' ')[0]}">
        <div>
          <p class="font-medium text-gray-900">${title}</p>
          ${recentDate ? `
            <p class="text-sm text-gray-600 mt-1">Most recent: ${formatDate(recentDate)}</p>
          ` : ''}
        </div>
        <span class="text-2xl font-bold ${colorMap[color].split(' ')[1]}">${data.length}</span>
      </div>
    `;
  }

  function renderComplianceTab(title, data, color, explanation) {
    if (!currentResults.compliance_data_fetched) {
      return `
        <div class="empty-state">
          <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
          </svg>
          <p class="text-lg font-medium text-gray-700">Compliance data not available</p>
          <p class="text-sm text-gray-500 mt-2">Enable "Fetch compliance data" when searching to see this information</p>
        </div>
      `;
    }
    
    if (!data || data.length === 0) {
      return `
        <div class="empty-state">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p class="text-lg font-medium text-gray-700">No ${title.toLowerCase()} found</p>
          <p class="text-sm text-gray-500 mt-2">This facility has no recorded ${title.toLowerCase()} in the FDA database</p>
        </div>
      `;
    }
    
    const sortedData = [...data].sort((a, b) => {
      const dateA = new Date(a.InspectionEndDate || a.ActionTakenDate || a.RefusalDate || 0);
      const dateB = new Date(b.InspectionEndDate || b.ActionTakenDate || b.RefusalDate || 0);
      return dateB - dateA;
    });
    
    return `
      <div class="space-y-6">
        ${explanation}
        
        <div class="timeline-indicator">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          Showing ${sortedData.length} record${sortedData.length !== 1 ? 's' : ''} in chronological order
        </div>
        
        <div class="space-y-4">
          ${sortedData.map((item, index) => renderComplianceItem(item, index, title, color)).join('')}
        </div>
      </div>
    `;
  }

  function renderComplianceItem(item, index, type, color) {
    const severityClass = `severity-${color === 'red' ? 'high' : color === 'orange' ? 'medium' : color === 'yellow' ? 'low' : 'info'}`;
    const date = item.InspectionEndDate || item.ActionTakenDate || item.RefusalDate;
    
    return `
      <div class="compliance-item">
        <div class="${severityClass} severity-indicator"></div>
        
        <div class="compliance-item-header">
          <div class="flex-1">
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-500">#${index + 1}</span>
              ${date ? `
                <span class="text-sm text-gray-600">
                  <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  ${formatDate(date)}
                </span>
              ` : ''}
              ${renderSpecialBadges(item)}
            </div>
            <button 
              onclick="FDAManufacturers.toggleRawData('${activeTab}', ${index})" 
              class="text-xs text-blue-600 hover:text-blue-800 mt-2"
            >
              <svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
              </svg>
              View Raw Data
            </button>
          </div>
        </div>
        
        <div class="mt-4" id="fda-details-${activeTab}-${index}">
          ${renderItemDetails(item, type)}
        </div>
        
        <div class="mt-4 hidden" id="fda-raw-${activeTab}-${index}">
          <div class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
            <pre class="text-xs"><code>${JSON.stringify(item, null, 2)}</code></pre>
          </div>
        </div>
      </div>
    `;
  }

  function renderSpecialBadges(item) {
    let badges = '';
    
    // Classification badges
    if (item.Classification) {
      const classMap = {
        'OAI': 'Official Action Indicated',
        'VAI': 'Voluntary Action Indicated',
        'NAI': 'No Action Indicated'
      };
      badges += `<span class="classification-badge classification-${item.Classification}">${item.Classification} - ${classMap[item.Classification] || item.Classification}</span>`;
    }
    
    // Action type badges
    if (item.ActionType) {
      const actionClass = item.ActionType.toLowerCase().includes('warning') ? 'warning' : 
                        item.ActionType.toLowerCase().includes('seizure') ? 'seizure' : 'injunction';
      badges += `<span class="action-badge action-${actionClass}">${item.ActionType}</span>`;
    }
    
    return badges;
  }

  function renderItemDetails(item, type) {
    const fieldLabels = {
      // Common fields
      FEINumber: 'FEI Number',
      
      // Inspection Classification fields
      InspectionID: 'Inspection ID',
      InspectionStartDate: 'Inspection Start Date',
      InspectionEndDate: 'Inspection End Date',
      Classification: 'Classification Code',
      ClassificationDescription: 'Classification Description',
      
      // Citation fields
      CitationID: 'Citation ID',
      CitationDescription: 'Citation Description',
      
      // Compliance Action fields
      ActionType: 'Action Type',
      ActionTakenDate: 'Action Taken Date',
      CaseNumber: 'Case Number',
      ProductCategory: 'Product Category',
      CaseStatus: 'Case Status',
      RecallNumber: 'Recall Number',
      VoluntaryMandated: 'Voluntary/Mandated',
      InitialFirmNotificationDate: 'Initial Firm Notification',
      DistributionPattern: 'Distribution Pattern',
      
      // Import Refusal fields
      ShipmentID: 'Shipment ID',
      RefusalDate: 'Refusal Date',
      ProductCodeDescription: 'Product Code Description',
      RefusalCharges: 'Refusal Charges',
      FDASampleAnalysis: 'FDA Sample Analysis',
      PrivateLabAnalysis: 'Private Lab Analysis',
      ShipmentDescription: 'Shipment Description',
      ManufacturerName: 'Manufacturer Name',
      ShipperName: 'Shipper Name',
      ConsigneeName: 'Consignee Name',
      CountryCode: 'Country Code',
      EntryNumber: 'Entry Number',
      LineNumber: 'Line Number',
      PortOfEntry: 'Port of Entry',
      Quantity: 'Quantity',
      QuantityUnit: 'Quantity Unit',
      Value: 'Value'
    };
    
    const fullWidthFields = [
      'ClassificationDescription',
      'CitationDescription',
      'RefusalCharges',
      'ProductCodeDescription',
      'ShipmentDescription',
      'ReasonDescription',
      'DistributionPattern'
    ];
    
    const importantFields = [
      'InspectionID',
      'Classification',
      'CitationID',
      'ActionType',
      'ShipmentID',
      'CaseNumber',
      'RecallNumber'
    ];
    
    const allFields = Object.entries(item)
      .filter(([key, value]) => key !== 'FEINumber' && value !== null && value !== undefined && value !== '')
      .map(([key, value]) => ({
        key,
        value,
        label: fieldLabels[key] || key.replace(/([A-Z])/g, ' $1').trim(),
        isFullWidth: fullWidthFields.includes(key),
        isImportant: importantFields.includes(key)
      }));
    
    const regularFields = allFields.filter(f => !f.isFullWidth);
    const fullWidth = allFields.filter(f => f.isFullWidth);
    
    return `
      <div class="info-grid">
        ${regularFields.map(field => `
          <div class="info-item">
            <div class="info-label">${field.label}</div>
            <div class="info-value ${field.isImportant ? 'font-semibold text-gray-900' : ''}">${field.value}</div>
          </div>
        `).join('')}
      </div>
      
      ${fullWidth.length > 0 ? `
        <div class="mt-6">
          <h5 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Detailed Information</h5>
          ${fullWidth.map(field => `
            <div class="mt-4 p-4 bg-gray-50 rounded-lg">
              <div class="info-label mb-2">${field.label}</div>
              <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">${field.value}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  function getClassificationExplanation() {
    return `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 class="font-semibold text-blue-900 mb-2">Understanding Inspection Classifications</h4>
        <div class="space-y-2 text-sm text-blue-800">
          <div class="flex gap-2">
            <span class="font-semibold">OAI (Official Action Indicated):</span>
            <span>Significant violations found requiring regulatory action</span>
          </div>
          <div class="flex gap-2">
            <span class="font-semibold">VAI (Voluntary Action Indicated):</span>
            <span>Minor violations found that should be corrected voluntarily</span>
          </div>
          <div class="flex gap-2">
            <span class="font-semibold">NAI (No Action Indicated):</span>
            <span>No significant violations observed during inspection</span>
          </div>
        </div>
      </div>
    `;
  }

  function getCitationExplanation() {
    return `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <h4 class="font-semibold text-red-900 mb-2">About Inspection Citations</h4>
        <p class="text-sm text-red-800">
          Citations are specific violations of FDA regulations identified during facility inspections. 
          Each citation references the specific regulation violated and describes the nature of the violation.
        </p>
      </div>
    `;
  }

  function getActionExplanation() {
    return `
      <div class="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
        <h4 class="font-semibold text-orange-900 mb-2">Types of Compliance Actions</h4>
        <div class="space-y-1 text-sm text-orange-800">
          <p><span class="font-semibold">Warning Letters:</span> Official correspondence outlining violations</p>
          <p><span class="font-semibold">Seizures:</span> Physical removal of violative products</p>
          <p><span class="font-semibold">Injunctions:</span> Court orders to stop violations</p>
          <p><span class="font-semibold">Consent Decrees:</span> Binding agreements to correct violations</p>
        </div>
      </div>
    `;
  }

  function getRefusalExplanation() {
    return `
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h4 class="font-semibold text-yellow-900 mb-2">Import Refusal Information</h4>
        <p class="text-sm text-yellow-800">
          Import refusals occur when FDA examination finds that imported products appear to violate FDA regulations. 
          Products may be refused for various reasons including contamination, labeling issues, or manufacturing concerns.
        </p>
      </div>
    `;
  }

  function toggleRawData(tab, index) {
    const detailsEl = document.getElementById(`fda-details-${tab}-${index}`);
    const rawEl = document.getElementById(`fda-raw-${tab}-${index}`);
    
    if (detailsEl.classList.contains('hidden')) {
      detailsEl.classList.remove('hidden');
      rawEl.classList.add('hidden');
    } else {
      detailsEl.classList.add('hidden');
      rawEl.classList.remove('hidden');
    }
  }

  // Warning letter functions
  async function searchAndDisplayCompanyWarningLetters(companyName) {
    const container = document.getElementById('fda-company-warning-letters');
    if (!container) return;
    
    const warningLetters = await searchWarningLettersByCompany(companyName);
    
    if (warningLetters.length > 0) {
      container.innerHTML = `
        <div class="space-y-3">
          ${warningLetters.map(letter => `
            <div class="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition cursor-pointer" 
                 onclick="FDAManufacturers.showWarningLetterModal('${letter.letterId}')">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <p class="text-sm font-semibold text-gray-900">
                    ${letter.subject || 'Warning Letter'}
                  </p>
                  <div class="flex items-center gap-4 mt-1">
                    <p class="text-xs text-gray-600">
                      <svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                      ${formatDate(letter.letterIssueDate)}
                    </p>
                    <p class="text-xs text-gray-600">
                      Letter ID: ${letter.letterId}
                    </p>
                  </div>
                  <p class="text-xs text-gray-700 mt-2">${letter.issuingOffice}</p>
                  ${letter.excerpt ? `
                    <p class="text-xs text-gray-600 mt-2 italic">${letter.excerpt}</p>
                  ` : ''}
                </div>
                <svg class="w-5 h-5 text-gray-400 ml-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a10 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <p>No warning letters found for ${companyName}</p>
        </div>
      `;
    }
  }

  async function searchWarningLettersByCompany(companyName) {
    try {
      const params = new URLSearchParams({
        term: companyName,
        field: 'company',
        perPage: 100
      });
      
      const response = await fetch(`/api/wl/search?${params}`);
      if (!response.ok) {
        throw new Error('Failed to search warning letters');
      }
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error searching warning letters:', error);
      return [];
    }
  }

  async function showWarningLetterModal(letterId) {
    const letterData = await fetchWarningLetterDetails(letterId);
    
    if (!letterData) {
      showNotification('Warning letter not found', 'error');
      return;
    }
    
    // Just display the link instead of full modal
    const modalHtml = `
      <div id="fda-warningLetterModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <!-- Modal Header -->
          <div class="bg-red-600 text-white p-6 -m-5 mb-0 rounded-t-md">
            <div class="flex justify-between items-start">
              <div>
                <h2 class="text-2xl font-bold">FDA Warning Letter</h2>
                <p class="text-red-100 mt-1">${letterData.companyName}</p>
              </div>
              <button onclick="FDAManufacturers.closeWarningLetterModal()" class="text-white hover:text-gray-200 transition p-2 hover:bg-white/10 rounded-lg">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>
          
          <!-- Modal Body -->
          <div class="p-6 -mx-5 mt-0">
            <!-- Letter Metadata -->
            <div class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase">Letter ID</p>
                  <p class="text-sm text-gray-900 mt-1">${letterData.letterId}</p>
                </div>
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase">Issue Date</p>
                  <p class="text-sm text-gray-900 mt-1">${formatDate(letterData.letterIssueDate)}</p>
                </div>
              </div>
              
              <div>
                <p class="text-xs font-semibold text-gray-500 uppercase">Issuing Office</p>
                <p class="text-sm text-gray-900 mt-1">${letterData.issuingOffice}</p>
              </div>
              
              ${letterData.subject ? `
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase">Subject</p>
                  <p class="text-sm text-gray-900 mt-1">${letterData.subject}</p>
                </div>
              ` : ''}
              
              <!-- Warning Letter Link -->
              <div class="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p class="text-sm font-semibold text-blue-900 mb-2">View Full Warning Letter</p>
                ${letterData.companyUrl ? `
                  <a href="${letterData.companyUrl}" target="_blank" 
                     class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                    Open on FDA Website
                  </a>
                  <p class="text-xs text-gray-600 mt-2">Link: ${letterData.companyUrl}</p>
                ` : `
                  <p class="text-sm text-gray-600">No direct link available for this warning letter</p>
                `}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.body.style.overflow = 'hidden';
  }

  function closeWarningLetterModal() {
    const modal = document.getElementById('fda-warningLetterModal');
    if (modal) {
      modal.remove();
      document.body.style.overflow = 'auto';
    }
  }

  async function fetchWarningLetterDetails(letterId) {
    try {
      const response = await fetch(`/api/wl/letter/${letterId}`);
      if (!response.ok) {
        throw new Error('Warning letter not found');
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching warning letter:', error);
      return null;
    }
  }

  function exportResults() {
    if (!currentResults) return;
    
    let csv = 'Manufacturer Name,FEI Number,Facility Name,Address,City,State,Country,Source,Classifications,Citations,Actions,Refusals,Products\n';
    
    currentResults.manufacturers.forEach(m => {
      if (m.fei_establishments && m.fei_establishments.length > 0) {
        m.fei_establishments.forEach(est => {
          const classifications = est.compliance_data?.inspections_classifications?.length || 0;
          const citations = est.compliance_data?.inspections_citations?.length || 0;
          const actions = est.compliance_data?.compliance_actions?.length || 0;
          const refusals = est.compliance_data?.import_refusals?.length || 0;
          
          csv += `"${m.manufacturer_name}","${est.fei_number}","${est.firm_name || ''}","${est.address || ''}","${est.city || ''}","${est.state || ''}","${est.country || ''}","${est.source}","${classifications}","${citations}","${actions}","${refusals}","${m.products.length + m.ndc_products.length}"\n`;
        });
      } else {
        csv += `"${m.manufacturer_name}","N/A","","","","","","No FEI Found","0","0","0","0","${m.products.length + m.ndc_products.length}"\n`;
      }
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentResults.compound}_manufacturers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showNotification('Export completed successfully', 'success');
  }

  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
      type === 'error' ? 'bg-red-500' : 'bg-green-500'
    } text-white`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    const complianceModal = document.getElementById('fda-complianceModal');
    const warningLetterModal = document.getElementById('fda-warningLetterModal');
    
    if (event.target === complianceModal) {
      closeModal();
    } else if (event.target === warningLetterModal) {
      closeWarningLetterModal();
    }
  });

  // Public API
  return {
    init,
    performSearch,
     searchWithCompound,
    toggleManufacturerDetails,
    toggleNoFEISection,
    showComplianceModal,
    switchTab,
    closeModal,
    exportResults,
    toggleRawData,
    showWarningLetterModal,
    closeWarningLetterModal
  };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', FDAManufacturers.init);
} else {
  FDAManufacturers.init();
}
// // FDA Manufacturers Module
// const FDAManufacturers = (function() {
//   let currentResults = null;
//   let currentModalData = null;
//   let activeTab = 'overview';
//   let expandedRows = new Set();

//   const terms = ['ketamine', 'ibuprofen', 'acetaminophen', 'insulin', 'metformin'];

//   // Initialize module
//   function init() {
//     // Set up popular searches
//     const popularSearches = document.getElementById('fda-popular-searches');
//     if (popularSearches) {
//       popularSearches.innerHTML = `
//         <div class="flex flex-wrap items-center gap-2">
//           <span class="text-sm text-gray-600">Popular searches:</span>
//           ${terms.map(ex => `
//             <button 
//               class="text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition"
//               onclick="document.getElementById('fda-compound').value='${ex}'; FDAManufacturers.performSearch()"
//             >
//               ${ex}
//             </button>
//           `).join('')}
//         </div>
//       `;
//     }

//     // Set up event listeners
//     const compoundInput = document.getElementById('fda-compound');
//     if (compoundInput) {
//       compoundInput.addEventListener('keypress', (e) => {
//         if (e.key === 'Enter') performSearch();
//       });
//     }
//   }

//   async function performSearch() {
//     const compound = document.getElementById('fda-compound').value.trim();
//     const includeGeneric = document.getElementById('fda-includeGeneric').checked;
//     const includeBrand = document.getElementById('fda-includeBrand').checked;
//     const fetchCompliance = document.getElementById('fda-fetchCompliance').checked;
    
//     if (!compound) {
//       showNotification('Please enter a drug compound name', 'error');
//       return;
//     }

//     // Reset UI
//     document.getElementById('fda-loading').classList.remove('hidden');
//     document.getElementById('fda-results').innerHTML = '';
//     document.getElementById('fda-stats').classList.add('hidden');
//     document.getElementById('fda-exportBtn').classList.add('hidden');
//     expandedRows.clear();
    
//     if (fetchCompliance) {
//       document.getElementById('fda-loadingStatus').textContent = 'Fetching compliance data for all facilities...';
//     }

//     try {
//       const params = new URLSearchParams({
//         compound: compound,
//         includeGeneric: includeGeneric,
//         includeBrand: includeBrand,
//         fetchCompliance: fetchCompliance
//       });

//       const response = await fetch(`/api/fei/drug-compound/manufacturers?${params}`);
//       const data = await response.json();

//       if (!response.ok) {
//         throw new Error(data.error || 'Failed to fetch data');
//       }

//       currentResults = data;
//       displayResults(data);

//     } catch (error) {
//       document.getElementById('fda-loading').classList.add('hidden');
//       document.getElementById('fda-results').innerHTML = `
//         <div class="bg-red-50 border border-red-200 rounded-xl p-6">
//           <div class="flex items-center gap-3">
//             <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
//             </svg>
//             <div>
//               <p class="font-semibold text-red-900">Error</p>
//               <p class="text-red-700">${error.message}</p>
//             </div>
//           </div>
//         </div>
//       `;
//     }
//   }

//   function displayResults(data) {
//     document.getElementById('fda-loading').classList.add('hidden');
    
//     if (data.total_manufacturers === 0) {
//       document.getElementById('fda-results').innerHTML = `
//         <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
//           <div class="flex items-center gap-3">
//             <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
//             </svg>
//             <div>
//               <p class="font-semibold text-yellow-900">No manufacturers found</p>
//               <p class="text-yellow-700">No manufacturers were found for "${data.compound}". Try searching with different spelling or check if it's a brand name.</p>
//             </div>
//           </div>
//         </div>
//       `;
//       return;
//     }

//     // Update stats
//     document.getElementById('fda-totalManufacturers').textContent = data.total_manufacturers;
//     document.getElementById('fda-withFEI').textContent = data.manufacturers_with_fei;
//     document.getElementById('fda-totalFEI').textContent = data.total_fei_numbers || 0;
//     document.getElementById('fda-withoutFEI').textContent = data.total_manufacturers - data.manufacturers_with_fei;
//     document.getElementById('fda-stats').classList.remove('hidden');
//     document.getElementById('fda-exportBtn').classList.remove('hidden');

//     // Separate manufacturers with and without FEI
//     const withFEI = data.manufacturers.filter(m => m.fei_establishments && m.fei_establishments.length > 0);
//     const withoutFEI = data.manufacturers.filter(m => !m.fei_establishments || m.fei_establishments.length === 0);

//     // Display results
//     const resultsHtml = `
//       <div class="mb-6">
//         <h2 class="text-2xl font-bold text-gray-900">
//           Search Results for "${data.compound}"
//         </h2>
//         <p class="text-gray-600 mt-1">
//           ${data.dashboard_api_available ? 'Full compliance data available' : 'Limited data - configure FDA Dashboard API for complete results'}
//         </p>
//       </div>

//       ${withFEI.length > 0 ? `
//         <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
//           <div class="p-6 border-b border-gray-200">
//             <h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
//               <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
//               </svg>
//               Manufacturers with FEI Numbers
//             </h3>
//           </div>
          
//           <div class="overflow-x-auto">
//             <table class="w-full">
//               <thead class="bg-gray-50 border-b border-gray-200">
//                 <tr>
//                   <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manufacturer</th>
//                   <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">FEI Count</th>
//                   <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Products</th>
//                   ${data.compliance_data_fetched ? `
//                     <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Classifications</th>
//                     <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Citations</th>
//                     <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
//                     <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Refusals</th>
//                   ` : ''}
//                   <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
//                 </tr>
//               </thead>
//               <tbody class="bg-white divide-y divide-gray-200">
//                 ${withFEI.map((manufacturer, mIndex) => {
//                   const totalCompliance = manufacturer.fei_establishments.reduce((acc, est) => {
//                     const comp = est.compliance_data || {};
//                     return {
//                       classifications: acc.classifications + (comp.inspections_classifications?.length || 0),
//                       citations: acc.citations + (comp.inspections_citations?.length || 0),
//                       actions: acc.actions + (comp.compliance_actions?.length || 0),
//                       refusals: acc.refusals + (comp.import_refusals?.length || 0)
//                     };
//                   }, { classifications: 0, citations: 0, actions: 0, refusals: 0 });
                  
//                   const totalProducts = manufacturer.products.length + manufacturer.ndc_products.length;
                  
//                   return `
//                     <tr class="hover:bg-gray-50">
//                       <td class="px-6 py-4">
//                         <div class="text-sm font-medium text-gray-900">${manufacturer.manufacturer_name}</div>
//                         ${manufacturer.duns_number ? `
//                           <div class="text-xs text-gray-500">DUNS: ${manufacturer.duns_number}</div>
//                         ` : ''}
//                       </td>
//                       <td class="px-6 py-4 text-center">
//                         <span class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
//                           ${manufacturer.fei_establishments.length}
//                         </span>
//                       </td>
//                       <td class="px-6 py-4 text-center">
//                         <span class="text-sm text-gray-900">${totalProducts}</span>
//                       </td>
//                       ${data.compliance_data_fetched ? `
//                         <td class="px-6 py-4 text-center">
//                           <span class="text-sm ${totalCompliance.classifications > 0 ? 'text-purple-600 font-medium' : 'text-gray-400'}">${totalCompliance.classifications}</span>
//                         </td>
//                         <td class="px-6 py-4 text-center">
//                           <span class="text-sm ${totalCompliance.citations > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}">${totalCompliance.citations}</span>
//                         </td>
//                         <td class="px-6 py-4 text-center">
//                           <span class="text-sm ${totalCompliance.actions > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}">${totalCompliance.actions}</span>
//                         </td>
//                         <td class="px-6 py-4 text-center">
//                           <span class="text-sm ${totalCompliance.refusals > 0 ? 'text-yellow-600 font-medium' : 'text-gray-400'}">${totalCompliance.refusals}</span>
//                         </td>
//                       ` : ''}
//                       <td class="px-6 py-4 text-center">
//                         <button 
//                           onclick="FDAManufacturers.toggleManufacturerDetails(${mIndex})"
//                           class="text-blue-600 hover:text-blue-800 text-sm font-medium"
//                         >
//                           <svg class="w-5 h-5 inline-block transition-transform duration-200 ${expandedRows.has(mIndex) ? 'transform rotate-90' : ''}" 
//                                id="fda-expand-icon-${mIndex}" 
//                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
//                           </svg>
//                           Details
//                         </button>
//                       </td>
//                     </tr>
//                     <tr id="fda-details-${mIndex}" class="hidden">
//                       <td colspan="${data.compliance_data_fetched ? '8' : '5'}" class="px-6 py-4 bg-gray-50">
//                         ${renderManufacturerDetails(manufacturer, mIndex, data)}
//                       </td>
//                     </tr>
//                   `;
//                 }).join('')}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       ` : ''}
      
//       ${withoutFEI.length > 0 ? `
//         <div class="mt-8">
//           <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
//             <div class="p-6 border-b border-gray-200">
//               <div class="flex items-center justify-between">
//                 <h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
//                   <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
//                   </svg>
//                   Manufacturers without FEI Numbers (${withoutFEI.length})
//                 </h3>
//                 <button 
//                   onclick="FDAManufacturers.toggleNoFEISection()"
//                   class="text-sm text-gray-600 hover:text-gray-800"
//                 >
//                   <span id="fda-noFEI-toggle-text">Hide</span>
//                   <svg class="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
//                   </svg>
//                 </button>
//               </div>
//               <p class="text-sm text-gray-600 mt-1">These manufacturers were found in NDC listings but FEI numbers couldn't be located</p>
//             </div>
            
//             <div id="fda-noFEI-content" class="p-6">
//               <div class="space-y-4">
//                 ${withoutFEI.map((manufacturer, index) => `
//                   <div class="bg-gray-50 rounded-lg p-4">
//                     <h4 class="font-medium text-gray-900 mb-2">${manufacturer.manufacturer_name}</h4>
//                     <p class="text-sm text-gray-600">
//                       ${manufacturer.ndc_products.length} NDC Listed Products
//                     </p>
//                   </div>
//                 `).join('')}
//               </div>
              
//               <div class="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
//                 <p class="text-sm font-medium text-amber-900 mb-2">
//                   <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
//                   </svg>
//                   How to find FEI numbers:
//                 </p>
//                 <ul class="text-sm text-amber-800 space-y-1">
//                   <li>• Check FDA's <a href="https://www.fda.gov/drugs/drug-approvals-and-databases/drug-establishments-current-registration-site-file" target="_blank" class="text-amber-600 hover:text-amber-700 underline">establishment registration database</a></li>
//                   <li>• Search <a href="https://www.accessdata.fda.gov/scripts/cder/daf/" target="_blank" class="text-amber-600 hover:text-amber-700 underline">FDA's Drug Approval database</a></li>
//                   <li>• Look up <a href="https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts" target="_blank" class="text-amber-600 hover:text-amber-700 underline">FDA recalls or enforcement actions</a></li>
//                 </ul>
//               </div>
//             </div>
//           </div>
//         </div>
//       ` : ''}
//     `;
    
//     document.getElementById('fda-results').innerHTML = resultsHtml;
//   }

//   function renderManufacturerDetails(manufacturer, mIndex, data) {
//     return `
//       <div class="space-y-4">
//         <!-- FEI Establishments -->
//         <div>
//           <h5 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Facility Establishments</h5>
//           ${manufacturer.fei_establishments.map((est, estIndex) => {
//             const complianceTotal = 
//               (est.compliance_data?.inspections_classifications?.length || 0) +
//               (est.compliance_data?.inspections_citations?.length || 0) +
//               (est.compliance_data?.compliance_actions?.length || 0) +
//               (est.compliance_data?.import_refusals?.length || 0);
            
//             return `
//               <div class="bg-white rounded-lg p-4 mb-3 border border-gray-200 compliance-card hover:border-blue-300" 
//                    onclick="FDAManufacturers.showComplianceModal(${mIndex}, ${estIndex})">
//                 <div class="flex justify-between items-start">
//                   <div class="flex-1">
//                     <div class="flex items-center gap-3">
//                       <span class="font-mono font-bold text-lg text-gray-900">FEI: ${est.fei_number}</span>
//                       ${complianceTotal > 0 ? `
//                         <span class="status-badge text-blue-600">
//                           ${complianceTotal} compliance records
//                         </span>
//                       ` : `
//                         <span class="status-badge text-gray-400">
//                           No compliance records
//                         </span>
//                       `}
//                     </div>
//                     ${est.firm_name && est.firm_name !== manufacturer.manufacturer_name ? 
//                       `<p class="text-sm text-gray-700 mt-1 font-medium">${est.firm_name}</p>` : ''
//                     }
//                     ${est.address ? `
//                       <p class="text-sm text-gray-600 mt-2">
//                         <svg class="w-4 h-4 inline mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
//                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
//                         </svg>
//                         ${est.address}${est.city ? `, ${est.city}` : ''}${est.state ? `, ${est.state}` : ''}
//                         ${est.zip ? ` ${est.zip}` : ''}${est.country ? `, ${est.country}` : ''}
//                       </p>
//                     ` : ''}
//                     <p class="text-xs text-gray-500 mt-2">${est.source}</p>
//                   </div>
//                   <svg class="w-5 h-5 text-gray-400 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
//                   </svg>
//                 </div>
                
//                 ${data.compliance_data_fetched && complianceTotal > 0 ? `
//                   <div class="mt-3 pt-3 border-t border-gray-200">
//                     <div class="grid grid-cols-4 gap-2 text-xs">
//                       ${est.compliance_data?.inspections_classifications?.length > 0 ? `
//                         <div class="text-center">
//                           <p class="font-semibold text-purple-600">${est.compliance_data.inspections_classifications.length}</p>
//                           <p class="text-gray-500">Classifications</p>
//                         </div>
//                       ` : ''}
//                       ${est.compliance_data?.inspections_citations?.length > 0 ? `
//                         <div class="text-center">
//                           <p class="font-semibold text-red-600">${est.compliance_data.inspections_citations.length}</p>
//                           <p class="text-gray-500">Citations</p>
//                         </div>
//                       ` : ''}
//                       ${est.compliance_data?.compliance_actions?.length > 0 ? `
//                         <div class="text-center">
//                           <p class="font-semibold text-orange-600">${est.compliance_data.compliance_actions.length}</p>
//                           <p class="text-gray-500">Actions</p>
//                         </div>
//                       ` : ''}
//                       ${est.compliance_data?.import_refusals?.length > 0 ? `
//                         <div class="text-center">
//                           <p class="font-semibold text-yellow-600">${est.compliance_data.import_refusals.length}</p>
//                           <p class="text-gray-500">Refusals</p>
//                         </div>
//                       ` : ''}
//                     </div>
//                   </div>
//                 ` : ''}
//               </div>
//             `;
//           }).join('')}
//         </div>
        
//         <!-- Products -->
//         <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
//           ${manufacturer.products.length > 0 ? `
//             <div>
//               <h5 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">
//                 FDA Approved Products (${manufacturer.products.length})
//               </h5>
//               <div class="bg-blue-50 rounded-lg p-3 max-h-40 overflow-y-auto">
//                 ${manufacturer.products.slice(0, 5).map(prod => `
//                   <div class="text-sm mb-2 pb-2 border-b border-blue-100 last:border-0">
//                     <p class="font-medium text-gray-900">${prod.brand_name || prod.generic_name}</p>
//                     ${prod.dosage_form ? `<p class="text-gray-600">${prod.dosage_form}${prod.strength ? ` - ${prod.strength}` : ''}</p>` : ''}
//                     ${prod.application_number ? `<p class="text-xs text-gray-500">App: ${prod.application_number}</p>` : ''}
//                   </div>
//                 `).join('')}
//                 ${manufacturer.products.length > 5 ? `
//                   <p class="text-xs text-gray-500 italic mt-2">+ ${manufacturer.products.length - 5} more products</p>
//                 ` : ''}
//               </div>
//             </div>
//           ` : ''}
          
//           ${manufacturer.ndc_products.length > 0 ? `
//             <div>
//               <h5 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">
//                 NDC Listed Products (${manufacturer.ndc_products.length})
//               </h5>
//               <div class="bg-purple-50 rounded-lg p-3 max-h-40 overflow-y-auto">
//                 ${manufacturer.ndc_products.slice(0, 5).map(prod => {
//                   const productName = prod.proprietary_name || prod.nonproprietary_name || 'Generic Product';
//                   return `
//                     <div class="text-sm mb-2 pb-2 border-b border-purple-100 last:border-0">
//                       <p class="font-medium text-gray-900">${productName}</p>
//                       <p class="text-xs text-gray-600">NDC: ${prod.product_ndc}</p>
//                       ${prod.active_ingredients ? `
//                         <p class="text-xs text-gray-500">${prod.active_ingredients.map(i => `${i.name} ${i.strength || ''}`).join(', ')}</p>
//                       ` : ''}
//                     </div>
//                   `;
//                 }).join('')}
//                 ${manufacturer.ndc_products.length > 5 ? `
//                   <p class="text-xs text-gray-500 italic mt-2">+ ${manufacturer.ndc_products.length - 5} more products</p>
//                 ` : ''}
//               </div>
//             </div>
//           ` : ''}
//         </div>
//       </div>
//     `;
//   }

//   function toggleManufacturerDetails(mIndex) {
//     const detailsRow = document.getElementById(`fda-details-${mIndex}`);
//     const icon = document.getElementById(`fda-expand-icon-${mIndex}`);
    
//     if (expandedRows.has(mIndex)) {
//       expandedRows.delete(mIndex);
//       detailsRow.classList.add('hidden');
//       icon.classList.remove('transform', 'rotate-90');
//     } else {
//       expandedRows.add(mIndex);
//       detailsRow.classList.remove('hidden');
//       icon.classList.add('transform', 'rotate-90');
//     }
//   }

//   function toggleNoFEISection() {
//     const content = document.getElementById('fda-noFEI-content');
//     const toggleText = document.getElementById('fda-noFEI-toggle-text');
    
//     if (content.classList.contains('hidden')) {
//       content.classList.remove('hidden');
//       toggleText.textContent = 'Hide';
//     } else {
//       content.classList.add('hidden');
//       toggleText.textContent = 'Show';
//     }
//   }

//   function showComplianceModal(mIndex, estIndex) {
//     const manufacturer = currentResults.manufacturers[mIndex];
//     const establishment = manufacturer.fei_establishments[estIndex];
    
//     currentModalData = { manufacturer, establishment };
//     activeTab = 'overview';
    
//     document.getElementById('fda-modalTitle').textContent = `FEI ${establishment.fei_number}`;
//     document.getElementById('fda-modalSubtitle').textContent = manufacturer.manufacturer_name;
    
//     // Calculate compliance stats
//     const complianceData = establishment.compliance_data || {};
//     const stats = {
//       classifications: complianceData.inspections_classifications?.length || 0,
//       citations: complianceData.inspections_citations?.length || 0,
//       actions: complianceData.compliance_actions?.length || 0,
//       refusals: complianceData.import_refusals?.length || 0
//     };
//     const totalCompliance = Object.values(stats).reduce((a, b) => a + b, 0);
    
//     // Create overview
//     const overviewHtml = `
//       <div class="modal-overview">
//         <div class="overview-card">
//           <div class="overview-number text-purple-600">${stats.classifications}</div>
//           <div class="overview-label">Classifications</div>
//         </div>
//         <div class="overview-card">
//           <div class="overview-number text-red-600">${stats.citations}</div>
//           <div class="overview-label">Citations</div>
//         </div>
//         <div class="overview-card">
//           <div class="overview-number text-orange-600">${stats.actions}</div>
//           <div class="overview-label">Actions</div>
//         </div>
//         <div class="overview-card">
//           <div class="overview-number text-yellow-600">${stats.refusals}</div>
//           <div class="overview-label">Import Refusals</div>
//         </div>
//         <div class="overview-card">
//           <div class="overview-number text-blue-600">${totalCompliance}</div>
//           <div class="overview-label">Total Records</div>
//         </div>
//       </div>
//     `;
//     document.getElementById('fda-modalOverview').innerHTML = overviewHtml;
    
//     // Create tabs
//     const tabs = [
//       { id: 'overview', label: 'Overview', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
//       { id: 'classifications', label: 'Inspection Classifications', count: stats.classifications, color: 'purple' },
//       { id: 'citations', label: 'Citations', count: stats.citations, color: 'red' },
//       { id: 'actions', label: 'Compliance Actions', count: stats.actions, color: 'orange' },
//       { id: 'refusals', label: 'Import Refusals', count: stats.refusals, color: 'yellow' }
//     ];
    
//     const tabsHtml = tabs.map(tab => `
//       <button 
//         class="tab-button ${activeTab === tab.id ? 'active' : ''}" 
//         onclick="FDAManufacturers.switchTab('${tab.id}')"
//         id="fda-tab-${tab.id}"
//       >
//         ${tab.icon ? `
//           <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${tab.icon}"></path>
//           </svg>
//         ` : ''}
//         ${tab.label}
//         ${tab.count !== undefined ? `<span class="tab-count">${tab.count}</span>` : ''}
//       </button>
//     `).join('');
    
//     document.getElementById('fda-modalTabs').innerHTML = tabsHtml;
    
//     // Show initial content
//     updateModalContent();
    
//     document.getElementById('fda-complianceModal').classList.add('active');
//     document.body.style.overflow = 'hidden';
//   }

//   function switchTab(tabId) {
//     activeTab = tabId;
    
//     // Update active tab styling
//     document.querySelectorAll('.tab-button').forEach(btn => {
//       btn.classList.remove('active');
//     });
//     document.getElementById(`fda-tab-${tabId}`).classList.add('active');
    
//     updateModalContent();
//   }

//   function updateModalContent() {
//     const { establishment, manufacturer } = currentModalData;
//     const complianceData = establishment.compliance_data || {};
    
//     let content = '';
    
//     switch (activeTab) {
//       case 'overview':
//         content = renderOverviewTab(establishment, manufacturer);
//         // Trigger warning letter search after rendering
//         setTimeout(() => {
//           searchAndDisplayCompanyWarningLetters(manufacturer.manufacturer_name);
//         }, 100);
//         break;
//       case 'classifications':
//         content = renderComplianceTab(
//           'Inspection Classifications',
//           complianceData.inspections_classifications || [],
//           'purple',
//           getClassificationExplanation()
//         );
//         break;
//       case 'citations':
//         content = renderComplianceTab(
//           'Inspection Citations',
//           complianceData.inspections_citations || [],
//           'red',
//           getCitationExplanation()
//         );
//         break;
//       case 'actions':
//         content = renderComplianceTab(
//           'Compliance Actions',
//           complianceData.compliance_actions || [],
//           'orange',
//           getActionExplanation()
//         );
//         break;
//       case 'refusals':
//         content = renderComplianceTab(
//           'Import Refusals',
//           complianceData.import_refusals || [],
//           'yellow',
//           getRefusalExplanation()
//         );
//         break;
//     }
    
//     document.getElementById('fda-modalContent').innerHTML = content;
//   }

//   function renderOverviewTab(establishment, manufacturer) {
//     return `
//       <div class="space-y-6">
//         <!-- Facility Information -->
//         <div class="bg-white rounded-lg p-6 border border-gray-200">
//           <h3 class="text-lg font-semibold text-gray-900 mb-4">Facility Information</h3>
//           <div class="info-grid">
//             <div class="info-item">
//               <div class="info-label">FEI Number</div>
//               <div class="info-value font-mono">${establishment.fei_number}</div>
//             </div>
//             <div class="info-item">
//               <div class="info-label">Manufacturer</div>
//               <div class="info-value">${manufacturer.manufacturer_name}</div>
//             </div>
//             ${establishment.firm_name ? `
//               <div class="info-item">
//                 <div class="info-label">Firm Name</div>
//                 <div class="info-value">${establishment.firm_name}</div>
//               </div>
//             ` : ''}
//             <div class="info-item">
//               <div class="info-label">Data Source</div>
//               <div class="info-value">${establishment.source}</div>
//             </div>
//           </div>
          
//           ${establishment.address ? `
//             <div class="mt-4 pt-4 border-t border-gray-200">
//               <div class="info-label mb-2">Facility Address</div>
//               <p class="text-gray-700">
//                 ${establishment.address}${establishment.city ? `, ${establishment.city}` : ''}${establishment.state ? `, ${establishment.state}` : ''}
//                 ${establishment.zip ? ` ${establishment.zip}` : ''}${establishment.country ? `, ${establishment.country}` : ''}
//               </p>
//             </div>
//           ` : ''}
//         </div>
        
//         <!-- Compliance Summary -->
//         <div class="bg-white rounded-lg p-6 border border-gray-200">
//           <h3 class="text-lg font-semibold text-gray-900 mb-4">Compliance Summary</h3>
//           ${currentResults.compliance_data_fetched ? `
//             <div class="space-y-4">
//               ${renderComplianceSummaryItem('Inspection Classifications', establishment.compliance_data?.inspections_classifications || [], 'purple')}
//               ${renderComplianceSummaryItem('Inspection Citations', establishment.compliance_data?.inspections_citations || [], 'red')}
//               ${renderComplianceSummaryItem('Compliance Actions', establishment.compliance_data?.compliance_actions || [], 'orange')}
//               ${renderComplianceSummaryItem('Import Refusals', establishment.compliance_data?.import_refusals || [], 'yellow')}
//             </div>
//           ` : `
//             <div class="text-center py-8 text-gray-500">
//               <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
//               </svg>
//               <p>Compliance data not fetched</p>
//               <p class="text-sm mt-2">Enable "Fetch compliance data" option to see detailed information</p>
//             </div>
//           `}
//         </div>
        
//         <!-- Products -->
//         <div class="bg-white rounded-lg p-6 border border-gray-200">
//           <h3 class="text-lg font-semibold text-gray-900 mb-4">Associated Products</h3>
//           <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
//             <div class="info-item">
//               <div class="info-label">FDA Approved Products</div>
//               <div class="info-value text-2xl">${manufacturer.products.length}</div>
//             </div>
//             <div class="info-item">
//               <div class="info-label">NDC Listed Products</div>
//               <div class="info-value text-2xl">${manufacturer.ndc_products.length}</div>
//             </div>
//           </div>
//         </div>
        
//         <!-- Company Warning Letters -->
//         <div class="bg-white rounded-lg p-6 border border-gray-200 mt-6">
//           <h3 class="text-lg font-semibold text-gray-900 mb-4">Company Warning Letters</h3>
//           <div id="fda-company-warning-letters">
//             <div class="text-center py-4">
//               <div class="loading-spinner mx-auto mb-2" style="width: 24px; height: 24px;"></div>
//               <p class="text-sm text-gray-600">Searching for warning letters...</p>
//             </div>
//           </div>
//         </div>
//       </div>
//     `;
//   }

//   function renderComplianceSummaryItem(title, data, color) {
//     const colorMap = {
//       purple: 'bg-purple-100 text-purple-800',
//       red: 'bg-red-100 text-red-800',
//       orange: 'bg-orange-100 text-orange-800',
//       yellow: 'bg-yellow-100 text-yellow-800'
//     };
    
//     const mostRecent = data.length > 0 ? 
//       data.sort((a, b) => {
//         const dateA = new Date(a.InspectionEndDate || a.ActionTakenDate || a.RefusalDate || 0);
//         const dateB = new Date(b.InspectionEndDate || b.ActionTakenDate || b.RefusalDate || 0);
//         return dateB - dateA;
//       })[0] : null;
    
//     const recentDate = mostRecent ? 
//       (mostRecent.InspectionEndDate || mostRecent.ActionTakenDate || mostRecent.RefusalDate) : null;
    
//     return `
//       <div class="flex items-center justify-between p-3 rounded-lg ${colorMap[color].split(' ')[0]}">
//         <div>
//           <p class="font-medium text-gray-900">${title}</p>
//           ${recentDate ? `
//             <p class="text-sm text-gray-600 mt-1">Most recent: ${formatDate(recentDate)}</p>
//           ` : ''}
//         </div>
//         <span class="text-2xl font-bold ${colorMap[color].split(' ')[1]}">${data.length}</span>
//       </div>
//     `;
//   }

//   function renderComplianceTab(title, data, color, explanation) {
//     if (!currentResults.compliance_data_fetched) {
//       return `
//         <div class="empty-state">
//           <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
//           </svg>
//           <p class="text-lg font-medium text-gray-700">Compliance data not available</p>
//           <p class="text-sm text-gray-500 mt-2">Enable "Fetch compliance data" when searching to see this information</p>
//         </div>
//       `;
//     }
    
//     if (!data || data.length === 0) {
//       return `
//         <div class="empty-state">
//           <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
//           </svg>
//           <p class="text-lg font-medium text-gray-700">No ${title.toLowerCase()} found</p>
//           <p class="text-sm text-gray-500 mt-2">This facility has no recorded ${title.toLowerCase()} in the FDA database</p>
//         </div>
//       `;
//     }
    
//     const sortedData = [...data].sort((a, b) => {
//       const dateA = new Date(a.InspectionEndDate || a.ActionTakenDate || a.RefusalDate || 0);
//       const dateB = new Date(b.InspectionEndDate || b.ActionTakenDate || b.RefusalDate || 0);
//       return dateB - dateA;
//     });
    
//     return `
//       <div class="space-y-6">
//         ${explanation}
        
//         <div class="timeline-indicator">
//           <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
//           </svg>
//           Showing ${sortedData.length} record${sortedData.length !== 1 ? 's' : ''} in chronological order
//         </div>
        
//         <div class="space-y-4">
//           ${sortedData.map((item, index) => renderComplianceItem(item, index, title, color)).join('')}
//         </div>
//       </div>
//     `;
//   }

//   function renderComplianceItem(item, index, type, color) {
//     const severityClass = `severity-${color === 'red' ? 'high' : color === 'orange' ? 'medium' : color === 'yellow' ? 'low' : 'info'}`;
//     const date = item.InspectionEndDate || item.ActionTakenDate || item.RefusalDate;
    
//     return `
//       <div class="compliance-item">
//         <div class="${severityClass} severity-indicator"></div>
        
//         <div class="compliance-item-header">
//           <div class="flex-1">
//             <div class="flex items-center gap-3">
//               <span class="text-sm font-medium text-gray-500">#${index + 1}</span>
//               ${date ? `
//                 <span class="text-sm text-gray-600">
//                   <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
//                   </svg>
//                   ${formatDate(date)}
//                 </span>
//               ` : ''}
//               ${renderSpecialBadges(item)}
//             </div>
//             <button 
//               onclick="FDAManufacturers.toggleRawData('${activeTab}', ${index})" 
//               class="text-xs text-blue-600 hover:text-blue-800 mt-2"
//             >
//               <svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
//               </svg>
//               View Raw Data
//             </button>
//           </div>
//         </div>
        
//         <div class="mt-4" id="fda-details-${activeTab}-${index}">
//           ${renderItemDetails(item, type)}
//         </div>
        
//         <div class="mt-4 hidden" id="fda-raw-${activeTab}-${index}">
//           <div class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
//             <pre class="text-xs"><code>${JSON.stringify(item, null, 2)}</code></pre>
//           </div>
//         </div>
//       </div>
//     `;
//   }

//   function renderSpecialBadges(item) {
//     let badges = '';
    
//     // Classification badges
//     if (item.Classification) {
//       const classMap = {
//         'OAI': 'Official Action Indicated',
//         'VAI': 'Voluntary Action Indicated',
//         'NAI': 'No Action Indicated'
//       };
//       badges += `<span class="classification-badge classification-${item.Classification}">${item.Classification} - ${classMap[item.Classification] || item.Classification}</span>`;
//     }
    
//     // Action type badges
//     if (item.ActionType) {
//       const actionClass = item.ActionType.toLowerCase().includes('warning') ? 'warning' : 
//                         item.ActionType.toLowerCase().includes('seizure') ? 'seizure' : 'injunction';
//       badges += `<span class="action-badge action-${actionClass}">${item.ActionType}</span>`;
//     }
    
//     return badges;
//   }

//   function renderItemDetails(item, type) {
//     const fieldLabels = {
//       // Common fields
//       FEINumber: 'FEI Number',
      
//       // Inspection Classification fields
//       InspectionID: 'Inspection ID',
//       InspectionStartDate: 'Inspection Start Date',
//       InspectionEndDate: 'Inspection End Date',
//       Classification: 'Classification Code',
//       ClassificationDescription: 'Classification Description',
      
//       // Citation fields
//       CitationID: 'Citation ID',
//       CitationDescription: 'Citation Description',
      
//       // Compliance Action fields
//       ActionType: 'Action Type',
//       ActionTakenDate: 'Action Taken Date',
//       CaseNumber: 'Case Number',
//       ProductCategory: 'Product Category',
//       CaseStatus: 'Case Status',
//       RecallNumber: 'Recall Number',
//       VoluntaryMandated: 'Voluntary/Mandated',
//       InitialFirmNotificationDate: 'Initial Firm Notification',
//       DistributionPattern: 'Distribution Pattern',
      
//       // Import Refusal fields
//       ShipmentID: 'Shipment ID',
//       RefusalDate: 'Refusal Date',
//       ProductCodeDescription: 'Product Code Description',
//       RefusalCharges: 'Refusal Charges',
//       FDASampleAnalysis: 'FDA Sample Analysis',
//       PrivateLabAnalysis: 'Private Lab Analysis',
//       ShipmentDescription: 'Shipment Description',
//       ManufacturerName: 'Manufacturer Name',
//       ShipperName: 'Shipper Name',
//       ConsigneeName: 'Consignee Name',
//       CountryCode: 'Country Code',
//       EntryNumber: 'Entry Number',
//       LineNumber: 'Line Number',
//       PortOfEntry: 'Port of Entry',
//       Quantity: 'Quantity',
//       QuantityUnit: 'Quantity Unit',
//       Value: 'Value'
//     };
    
//     const fullWidthFields = [
//       'ClassificationDescription',
//       'CitationDescription',
//       'RefusalCharges',
//       'ProductCodeDescription',
//       'ShipmentDescription',
//       'ReasonDescription',
//       'DistributionPattern'
//     ];
    
//     const importantFields = [
//       'InspectionID',
//       'Classification',
//       'CitationID',
//       'ActionType',
//       'ShipmentID',
//       'CaseNumber',
//       'RecallNumber'
//     ];
    
//     const allFields = Object.entries(item)
//       .filter(([key, value]) => key !== 'FEINumber' && value !== null && value !== undefined && value !== '')
//       .map(([key, value]) => ({
//         key,
//         value,
//         label: fieldLabels[key] || key.replace(/([A-Z])/g, ' $1').trim(),
//         isFullWidth: fullWidthFields.includes(key),
//         isImportant: importantFields.includes(key)
//       }));
    
//     const regularFields = allFields.filter(f => !f.isFullWidth);
//     const fullWidth = allFields.filter(f => f.isFullWidth);
    
//     return `
//       <div class="info-grid">
//         ${regularFields.map(field => `
//           <div class="info-item">
//             <div class="info-label">${field.label}</div>
//             <div class="info-value ${field.isImportant ? 'font-semibold text-gray-900' : ''}">${field.value}</div>
//           </div>
//         `).join('')}
//       </div>
      
//       ${fullWidth.length > 0 ? `
//         <div class="mt-6">
//           <h5 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Detailed Information</h5>
//           ${fullWidth.map(field => `
//             <div class="mt-4 p-4 bg-gray-50 rounded-lg">
//               <div class="info-label mb-2">${field.label}</div>
//               <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">${field.value}</div>
//             </div>
//           `).join('')}
//         </div>
//       ` : ''}
//     `;
//   }

//   function getClassificationExplanation() {
//     return `
//       <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
//         <h4 class="font-semibold text-blue-900 mb-2">Understanding Inspection Classifications</h4>
//         <div class="space-y-2 text-sm text-blue-800">
//           <div class="flex gap-2">
//             <span class="font-semibold">OAI (Official Action Indicated):</span>
//             <span>Significant violations found requiring regulatory action</span>
//           </div>
//           <div class="flex gap-2">
//             <span class="font-semibold">VAI (Voluntary Action Indicated):</span>
//             <span>Minor violations found that should be corrected voluntarily</span>
//           </div>
//           <div class="flex gap-2">
//             <span class="font-semibold">NAI (No Action Indicated):</span>
//             <span>No significant violations observed during inspection</span>
//           </div>
//         </div>
//       </div>
//     `;
//   }

//   function getCitationExplanation() {
//     return `
//       <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
//         <h4 class="font-semibold text-red-900 mb-2">About Inspection Citations</h4>
//         <p class="text-sm text-red-800">
//           Citations are specific violations of FDA regulations identified during facility inspections. 
//           Each citation references the specific regulation violated and describes the nature of the violation.
//         </p>
//       </div>
//     `;
//   }

//   function getActionExplanation() {
//     return `
//       <div class="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
//         <h4 class="font-semibold text-orange-900 mb-2">Types of Compliance Actions</h4>
//         <div class="space-y-1 text-sm text-orange-800">
//           <p><span class="font-semibold">Warning Letters:</span> Official correspondence outlining violations</p>
//           <p><span class="font-semibold">Seizures:</span> Physical removal of violative products</p>
//           <p><span class="font-semibold">Injunctions:</span> Court orders to stop violations</p>
//           <p><span class="font-semibold">Consent Decrees:</span> Binding agreements to correct violations</p>
//         </div>
//       </div>
//     `;
//   }

//   function getRefusalExplanation() {
//     return `
//       <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
//         <h4 class="font-semibold text-yellow-900 mb-2">Import Refusal Information</h4>
//         <p class="text-sm text-yellow-800">
//           Import refusals occur when FDA examination finds that imported products appear to violate FDA regulations. 
//           Products may be refused for various reasons including contamination, labeling issues, or manufacturing concerns.
//         </p>
//       </div>
//     `;
//   }

//   function toggleRawData(tab, index) {
//     const detailsEl = document.getElementById(`fda-details-${tab}-${index}`);
//     const rawEl = document.getElementById(`fda-raw-${tab}-${index}`);
    
//     if (detailsEl.classList.contains('hidden')) {
//       detailsEl.classList.remove('hidden');
//       rawEl.classList.add('hidden');
//     } else {
//       detailsEl.classList.add('hidden');
//       rawEl.classList.remove('hidden');
//     }
//   }

//   // Warning letter functions
//   async function searchAndDisplayCompanyWarningLetters(companyName) {
//     const container = document.getElementById('fda-company-warning-letters');
//     if (!container) return;
    
//     const warningLetters = await searchWarningLettersByCompany(companyName);
    
//     if (warningLetters.length > 0) {
//       container.innerHTML = `
//         <div class="space-y-3">
//           ${warningLetters.map(letter => `
//             <div class="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition cursor-pointer" 
//                  onclick="FDAManufacturers.showWarningLetterModal('${letter.letterId}')">
//               <div class="flex justify-between items-start">
//                 <div class="flex-1">
//                   <p class="text-sm font-semibold text-gray-900">
//                     ${letter.subject || 'Warning Letter'}
//                   </p>
//                   <div class="flex items-center gap-4 mt-1">
//                     <p class="text-xs text-gray-600">
//                       <svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
//                       </svg>
//                       ${formatDate(letter.letterIssueDate)}
//                     </p>
//                     <p class="text-xs text-gray-600">
//                       Letter ID: ${letter.letterId}
//                     </p>
//                   </div>
//                   <p class="text-xs text-gray-700 mt-2">${letter.issuingOffice}</p>
//                   ${letter.excerpt ? `
//                     <p class="text-xs text-gray-600 mt-2 italic">${letter.excerpt}</p>
//                   ` : ''}
//                 </div>
//                 <svg class="w-5 h-5 text-gray-400 ml-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
//                 </svg>
//               </div>
//             </div>
//           `).join('')}
//         </div>
//       `;
//     } else {
//       container.innerHTML = `
//         <div class="text-center py-8 text-gray-500">
//           <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
//           </svg>
//           <p>No warning letters found for ${companyName}</p>
//         </div>
//       `;
//     }
//   }

//   async function searchWarningLettersByCompany(companyName) {
//     try {
//       const params = new URLSearchParams({
//         term: companyName,
//         field: 'company',
//         perPage: 100
//       });
      
//       const response = await fetch(`/api/wl/search?${params}`);
//       if (!response.ok) {
//         throw new Error('Failed to search warning letters');
//       }
//       const data = await response.json();
//       return data.results || [];
//     } catch (error) {
//       console.error('Error searching warning letters:', error);
//       return [];
//     }
//   }

//   async function showWarningLetterModal(letterId) {
//     const letterData = await fetchWarningLetterDetails(letterId);
    
//     if (!letterData) {
//       showNotification('Warning letter not found', 'error');
//       return;
//     }
    
//     // Create warning letter modal HTML...
//     // (This would be the same as in your original code)
//   }

//   async function fetchWarningLetterDetails(letterId) {
//     try {
//       const response = await fetch(`/api/wl/letter/${letterId}`);
//       if (!response.ok) {
//         throw new Error('Warning letter not found');
//       }
//       const data = await response.json();
//       return data;
//     } catch (error) {
//       console.error('Error fetching warning letter:', error);
//       return null;
//     }
//   }

//   function closeModal() {
//     document.getElementById('fda-complianceModal').classList.remove('active');
//     document.body.style.overflow = 'auto';
//   }

//   function exportResults() {
//     if (!currentResults) return;
    
//     let csv = 'Manufacturer Name,FEI Number,Facility Name,Address,City,State,Country,Source,Classifications,Citations,Actions,Refusals,Products\n';
    
//     currentResults.manufacturers.forEach(m => {
//       if (m.fei_establishments && m.fei_establishments.length > 0) {
//         m.fei_establishments.forEach(est => {
//           const classifications = est.compliance_data?.inspections_classifications?.length || 0;
//           const citations = est.compliance_data?.inspections_citations?.length || 0;
//           const actions = est.compliance_data?.compliance_actions?.length || 0;
//           const refusals = est.compliance_data?.import_refusals?.length || 0;
          
//           csv += `"${m.manufacturer_name}","${est.fei_number}","${est.firm_name || ''}","${est.address || ''}","${est.city || ''}","${est.state || ''}","${est.country || ''}","${est.source}","${classifications}","${citations}","${actions}","${refusals}","${m.products.length + m.ndc_products.length}"\n`;
//         });
//       } else {
//         csv += `"${m.manufacturer_name}","N/A","","","","","","No FEI Found","0","0","0","0","${m.products.length + m.ndc_products.length}"\n`;
//       }
//     });
    
//     const blob = new Blob([csv], { type: 'text/csv' });
//     const url = window.URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `${currentResults.compound}_manufacturers_${new Date().toISOString().split('T')[0]}.csv`;
//     a.click();
//     window.URL.revokeObjectURL(url);
    
//     showNotification('Export completed successfully', 'success');
//   }

//   function showNotification(message, type = 'info') {
//     const notification = document.createElement('div');
//     notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
//       type === 'error' ? 'bg-red-500' : 'bg-green-500'
//     } text-white`;
//     notification.textContent = message;
//     document.body.appendChild(notification);
    
//     setTimeout(() => {
//       notification.remove();
//     }, 3000);
//   }

//   function formatDate(dateString) {
//     if (!dateString) return '';
//     const date = new Date(dateString);
//     return date.toLocaleDateString('en-US', { 
//       year: 'numeric', 
//       month: 'short', 
//       day: 'numeric' 
//     });
//   }

//   // Public API
//   return {
//     init,
//     performSearch,
//     toggleManufacturerDetails,
//     toggleNoFEISection,
//     showComplianceModal,
//     switchTab,
//     closeModal,
//     exportResults,
//     toggleRawData,
//     showWarningLetterModal
//   };
// })();

// // Initialize when DOM is ready
// if (document.readyState === 'loading') {
//   document.addEventListener('DOMContentLoaded', FDAManufacturers.init);
// } else {
//   FDAManufacturers.init();
// }