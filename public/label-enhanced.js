// Complete PharmaLabellingModule integration
const PharmaLabellingModule = (function() {
    let currentLabels = [];
    let currentFilter = 'all';
    let currentPage = 1;
    const itemsPerPage = 12;

    // DOM Elements (all prefixed to avoid conflicts)
    const elements = {
        searchInput: document.getElementById('pharma-compound-search'),
        searchBtn: document.getElementById('pharma-search-btn'),
        loading: document.getElementById('pharma-loading'),
        summarySection: document.getElementById('pharma-summary-section'),
        resultsSection: document.getElementById('pharma-results-section'),
        emptyState: document.getElementById('pharma-empty-state'),
        labelsGrid: document.getElementById('pharma-labels-grid'),
        labelModal: document.getElementById('pharma-label-modal'),
        closeModal: document.getElementById('pharma-close-modal'),
        
        // Summary stats
        totalLabels: document.getElementById('pharma-total-labels'),
        fdaLabels: document.getElementById('pharma-fda-labels'),
        emaLabels: document.getElementById('pharma-ema-labels'),
        boxedWarnings: document.getElementById('pharma-boxed-warnings'),
        rxcui: document.getElementById('pharma-rxcui'),
        ndcCount: document.getElementById('pharma-ndc-count'),
        lastAnalyzed: document.getElementById('pharma-last-analyzed'),
        
        // Filter buttons
        filterAll: document.getElementById('pharma-filter-all'),
        filterFda: document.getElementById('pharma-filter-fda'),
        filterEma: document.getElementById('pharma-filter-ema'),
        filterWarnings: document.getElementById('pharma-filter-warnings'),
        
        // Pagination
        currentPageSpan: document.getElementById('pharma-current-page'),
        totalPagesSpan: document.getElementById('pharma-total-pages'),
        prevPage: document.getElementById('pharma-prev-page'),
        nextPage: document.getElementById('pharma-next-page'),
        
        // Modal elements
        modalTitle: document.getElementById('pharma-modal-title'),
        modalSubtitle: document.getElementById('pharma-modal-subtitle'),
        modalSourceBadge: document.getElementById('pharma-modal-source-badge'),
        modalContent: document.getElementById('pharma-modal-content')
    };

    // function init() {
    //     // Check if elements exist before adding listeners
    //     if (!elements.searchBtn || !elements.searchInput) {
    //         console.log('Pharma elements not ready, waiting...');
    //         return;
    //     }

    //     // Event Listeners
    //     elements.searchBtn.addEventListener('click', performSearch);
    //     elements.searchInput.addEventListener('keypress', (e) => {
    //         if (e.key === 'Enter') performSearch();
    //     });

    //     if (elements.closeModal) {
    //         elements.closeModal.addEventListener('click', () => {
    //             elements.labelModal.classList.add('hidden');
    //         });
    //     }

    //     // Filter buttons
    //     if (elements.filterAll) elements.filterAll.addEventListener('click', () => setFilter('all'));
    //     if (elements.filterFda) elements.filterFda.addEventListener('click', () => setFilter('fda'));
    //     if (elements.filterEma) elements.filterEma.addEventListener('click', () => setFilter('ema'));
    //     if (elements.filterWarnings) elements.filterWarnings.addEventListener('click', () => setFilter('warnings'));

    //     // Pagination
    //     if (elements.prevPage) elements.prevPage.addEventListener('click', () => changePage(-1));
    //     if (elements.nextPage) elements.nextPage.addEventListener('click', () => changePage(1));

    //     console.log('PharmaLabellingModule initialized successfully');
    // }

function init() {
    // Check if elements exist before adding listeners
    if (!elements.searchBtn || !elements.searchInput) {
        console.log('Pharma elements not ready, waiting...');
        return;
    }

    // Event Listeners for search functionality
    elements.searchBtn.addEventListener('click', performSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // Modal close functionality
    if (elements.closeModal) {
        elements.closeModal.addEventListener('click', () => {
            elements.labelModal.classList.add('hidden');
        });
    }

    // Filter button event listeners
    if (elements.filterAll) elements.filterAll.addEventListener('click', () => setFilter('all'));
    if (elements.filterFda) elements.filterFda.addEventListener('click', () => setFilter('fda'));
    if (elements.filterEma) elements.filterEma.addEventListener('click', () => setFilter('ema'));
    if (elements.filterWarnings) elements.filterWarnings.addEventListener('click', () => setFilter('warnings'));

    // Pagination event listeners
    if (elements.prevPage) elements.prevPage.addEventListener('click', () => changePage(-1));
    if (elements.nextPage) elements.nextPage.addEventListener('click', () => changePage(1));

    // 🔥 EMA DATA EVENT LISTENERS - OPTION 1 🔥
    
    // Listen for EMA data loaded event
    document.addEventListener('emaDataLoaded', function(event) {
        console.log('EMA data loaded event received:', event.detail);
        
        const { medicines, count, searchTerm } = event.detail;
        
        // Update the EMA count immediately
        if (elements.emaLabels) {
            elements.emaLabels.textContent = count || 0;
            console.log(`Updated EMA labels count to: ${count || 0}`);
        }
        
        // Update total labels count if we have other labels
        if (elements.totalLabels) {
            const currentFDA = parseInt(elements.fdaLabels?.textContent || 0);
            const newTotal = currentFDA + (count || 0);
            elements.totalLabels.textContent = newTotal;
        }
        
        // If labelling section is currently visible, refresh the display with EMA data
        const labellingSection = document.getElementById('LabellingSection');
        if (labellingSection && !labellingSection.classList.contains('hidden')) {
            console.log('Labelling section is visible, refreshing with EMA data...');
            refreshLabelsWithEMAData();
        }
        
        // Show the labelling section if it's hidden but we now have data
        if (labellingSection && labellingSection.classList.contains('hidden') && count > 0) {
            console.log('Showing labelling section due to EMA data...');
            labellingSection.classList.remove('hidden');
            refreshLabelsWithEMAData();
        }
    });
    
    // Listen for any general data updates that might include EMA data
    document.addEventListener('dataUpdated', function(event) {
        const { dataType, data } = event.detail;
        
        if (dataType === 'ema' && data?.medicines) {
            console.log('EMA data updated via dataUpdated event');
            
            // Update count
            if (elements.emaLabels) {
                elements.emaLabels.textContent = data.medicines.length;
            }
            
            // Refresh display if visible
            const labellingSection = document.getElementById('LabellingSection');
            if (labellingSection && !labellingSection.classList.contains('hidden')) {
                refreshLabelsWithEMAData();
            }
        }
    });

    // 🔥 CHECK FOR IMMEDIATE EMA DATA ON INITIALIZATION 🔥
    
    // Check if EMA data is already available when module initializes
    if (window.appState?.emaData?.medicines) {
        console.log('Found existing EMA data on initialization');
        const emaCount = window.appState.emaData.medicines.length;
        
        if (elements.emaLabels) {
            elements.emaLabels.textContent = emaCount;
            console.log(`Set initial EMA count to: ${emaCount}`);
        }
        
        // Update total if needed
        if (elements.totalLabels) {
            const currentFDA = parseInt(elements.fdaLabels?.textContent || 0);
            const newTotal = currentFDA + emaCount;
            elements.totalLabels.textContent = newTotal;
        }
    }
    
    // 🔥 PERIODIC CHECK FOR EMA DATA (FALLBACK) 🔥
    
    // Set up a periodic check in case events are missed (fallback mechanism)
    let lastEMACount = 0;
    const emaCheckInterval = setInterval(() => {
        if (window.appState?.emaData?.medicines) {
            const currentEMACount = window.appState.emaData.medicines.length;
            
            // Only update if count has changed
            if (currentEMACount !== lastEMACount) {
                console.log(`EMA count changed from ${lastEMACount} to ${currentEMACount} (periodic check)`);
                lastEMACount = currentEMACount;
                
                if (elements.emaLabels) {
                    elements.emaLabels.textContent = currentEMACount;
                }
                
                // Update total
                if (elements.totalLabels) {
                    const currentFDA = parseInt(elements.fdaLabels?.textContent || 0);
                    const newTotal = currentFDA + currentEMACount;
                    elements.totalLabels.textContent = newTotal;
                }
                
                // Refresh display if section is visible
                const labellingSection = document.getElementById('LabellingSection');
                if (labellingSection && !labellingSection.classList.contains('hidden')) {
                    refreshLabelsWithEMAData();
                }
            }
        }
    }, 2000); // Check every 2 seconds
    
    // Clear interval after 30 seconds to avoid infinite checking
    setTimeout(() => {
        clearInterval(emaCheckInterval);
        console.log('EMA periodic check interval cleared');
    }, 30000);

    console.log('PharmaLabellingModule initialized successfully with EMA event listeners');
}



async function performSearch() {
    const compound = elements.searchInput.value.trim();
    if (!compound) return;

    showLoading();
    
    try {
        // Call your actual API endpoint
        const response = await fetch(`/api/pharmaceutical-labels/search/${encodeURIComponent(compound)}`);
        
        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Add search term to data so EMA can use it
        data.searchTerm = compound;
        
        if (data.success) {
            displayResults(data);
        } else {
            showError(data.error || 'Search failed');
        }
    } catch (error) {
        console.error('Search error:', error);
        showError('Network error occurred: ' + error.message);
    }
}

    function showLoading() {
        if (elements.loading) elements.loading.classList.remove('hidden');
        if (elements.summarySection) elements.summarySection.classList.add('hidden');
        if (elements.resultsSection) elements.resultsSection.classList.add('hidden');
        if (elements.emptyState) elements.emptyState.classList.add('hidden');
    }

    // function displayResults(data) {
    //     if (elements.loading) elements.loading.classList.add('hidden');
    //     currentLabels = data.labels || [];
    //     currentPage = 1;
        
    //     // Update summary with real data
    //     if (elements.totalLabels) elements.totalLabels.textContent = data.summary.totalLabels || 0;
    //     if (elements.fdaLabels) elements.fdaLabels.textContent = data.summary.fdaLabels || 0;
    //     if (elements.emaLabels) elements.emaLabels.textContent = data.summary.emaLabels || 0;
    //     if (elements.boxedWarnings) elements.boxedWarnings.textContent = data.summary.withBoxedWarnings || 0;
    //     if (elements.rxcui) elements.rxcui.textContent = data.summary.rxcui || 'N/A';
    //     if (elements.ndcCount) elements.ndcCount.textContent = data.summary.ndcCount || 0;
    //     if (elements.lastAnalyzed) elements.lastAnalyzed.textContent = `Last analyzed: ${formatDateTime(data.summary.lastAnalyzed)}`;
        
    //     if (elements.summarySection) {
    //         elements.summarySection.classList.remove('hidden');
    //         elements.summarySection.classList.add('fade-in');
    //     }
        
    //     if (currentLabels.length > 0) {
    //         if (elements.resultsSection) {
    //             elements.resultsSection.classList.remove('hidden');
    //             elements.resultsSection.classList.add('fade-in');
    //         }
    //         if (elements.emptyState) elements.emptyState.classList.add('hidden');
    //         renderLabels();
    //     } else {
    //         if (elements.resultsSection) elements.resultsSection.classList.add('hidden');
    //         if (elements.emptyState) elements.emptyState.classList.remove('hidden');
    //     }
    // }
function displayResults(data) {
    if (elements.loading) elements.loading.classList.add('hidden');
    
    // Start with the original labels from your API
    currentLabels = data.labels || [];
    currentPage = 1;
    
    // 🔥 DIRECTLY FETCH EMA DATA 🔥
    fetchEMAMedicines(data.searchTerm || 'default');
    
    // Update summary with current data (EMA will be added when it loads)
    if (elements.totalLabels) elements.totalLabels.textContent = currentLabels.length;
    if (elements.fdaLabels) elements.fdaLabels.textContent = currentLabels.filter(l => l.type === 'FDA').length;
    if (elements.emaLabels) elements.emaLabels.textContent = 0; // Will be updated by fetchEMAMedicines
    if (elements.boxedWarnings) elements.boxedWarnings.textContent = currentLabels.filter(l => l.boxedWarning).length;
    if (elements.rxcui) elements.rxcui.textContent = data.summary?.rxcui || 'N/A';
    if (elements.ndcCount) elements.ndcCount.textContent = data.summary?.ndcCount || 0;
    if (elements.lastAnalyzed) elements.lastAnalyzed.textContent = `Last analyzed: ${formatDateTime(new Date())}`;
    
    // Show sections
    if (elements.summarySection) {
        elements.summarySection.classList.remove('hidden');
        elements.summarySection.classList.add('fade-in');
    }
    
    if (currentLabels.length > 0) {
        if (elements.resultsSection) {
            elements.resultsSection.classList.remove('hidden');
            elements.resultsSection.classList.add('fade-in');
        }
        if (elements.emptyState) elements.emptyState.classList.add('hidden');
        renderLabels();
    } else {
        if (elements.resultsSection) elements.resultsSection.classList.add('hidden');
        if (elements.emptyState) elements.emptyState.classList.remove('hidden');
    }
}

// 🔥 NEW FUNCTION TO DIRECTLY FETCH EMA MEDICINES 🔥
async function fetchEMAMedicines(searchTerm) {
    if (!searchTerm || searchTerm === 'default') return;
    
    try {
        console.log(`🔍 Fetching EMA medicines for: ${searchTerm}`);
        
        const response = await fetch(`/api/ema/search/${encodeURIComponent(searchTerm)}`);
        if (!response.ok) {
            console.warn(`EMA API returned ${response.status}`);
            return;
        }
        
        const emaData = await response.json();
        console.log('✅ EMA data received:', emaData);
        
        if (emaData.success && emaData.medicines && emaData.medicines.length > 0) {
            // Convert EMA medicines to label format
            const emaLabels = emaData.medicines.map(medicine => ({
                setid: medicine.id || `ema_${Date.now()}_${Math.random()}`,
                type: 'EMA',
                source: 'EMA Medicines Registry',
                productName: medicine.medicineName || medicine.name || 'Unknown Medicine',
                indication: medicine.therapeuticIndication || medicine.indication || 'Not specified',
                route: medicine.routeOfAdministration || 'Not specified',
                manufacturerName: medicine.marketingAuthorisationHolder || medicine.manufacturer || 'Not specified',
                lastUpdated: medicine.marketingAuthorisationDate || medicine.date || new Date().toISOString(),
                boxedWarning: false, // EMA doesn't use boxed warnings
                // EMA-specific fields
                authorizationStatus: medicine.authorisationStatus || 'Authorized',
                euNumber: medicine.euNumber || medicine.productNumber,
                atcCode: medicine.atcCode,
                dosageForm: medicine.pharmaceuticalForm || medicine.dosageForm
            }));
            
            // Add EMA labels to current labels
            currentLabels = [...currentLabels.filter(l => l.type !== 'EMA'), ...emaLabels];
            
            // Update counts
            const totalLabels = currentLabels.length;
            const fdaLabels = currentLabels.filter(l => l.type === 'FDA').length;
            const emaCount = emaLabels.length;
            const boxedWarnings = currentLabels.filter(l => l.boxedWarning).length;
            
            // Update UI
            if (elements.totalLabels) elements.totalLabels.textContent = totalLabels;
            if (elements.fdaLabels) elements.fdaLabels.textContent = fdaLabels;
            if (elements.emaLabels) elements.emaLabels.textContent = emaCount;
            if (elements.boxedWarnings) elements.boxedWarnings.textContent = boxedWarnings;
            
            console.log(`✅ Added ${emaCount} EMA medicines to labelling section`);
            
            // Re-render the labels to include EMA medicines
            renderLabels();
            
        } else {
            console.log('ℹ️ No EMA medicines found');
            if (elements.emaLabels) elements.emaLabels.textContent = 0;
        }
        
    } catch (error) {
        console.error('❌ Error fetching EMA medicines:', error);
        if (elements.emaLabels) elements.emaLabels.textContent = 0;
    }
}

    // function renderLabels() {
    //     const filteredLabels = currentLabels.filter(label => {
    //         if (currentFilter === 'all') return true;
    //         if (currentFilter === 'fda') return label.type === 'FDA';
    //         if (currentFilter === 'ema') return label.type === 'EMA';
    //         if (currentFilter === 'warnings') return label.boxedWarning;
    //         return true;
    //     });

    //     const totalPages = Math.ceil(filteredLabels.length / itemsPerPage);
    //     const startIndex = (currentPage - 1) * itemsPerPage;
    //     const endIndex = startIndex + itemsPerPage;
    //     const pageLabels = filteredLabels.slice(startIndex, endIndex);

    //     if (elements.labelsGrid) {
    //         elements.labelsGrid.innerHTML = pageLabels.map(label => createCleanLabelCard(label)).join('');
    //     }
        
    //     // Update pagination
    //     if (elements.currentPageSpan) elements.currentPageSpan.textContent = currentPage;
    //     if (elements.totalPagesSpan) elements.totalPagesSpan.textContent = totalPages;
    //     if (elements.prevPage) elements.prevPage.disabled = currentPage === 1;
    //     if (elements.nextPage) elements.nextPage.disabled = currentPage === totalPages;
    // }

    
//     function createCleanLabelCard(label) {
//     const isEMA = label.type === 'EMA';
//     const tagColor = isEMA ? 'bg-blue-600' : 'bg-red-600';
//     const warningBadge = label.boxedWarning ? 
//         '<span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">⚠ Warning</span>' : '';
    
//     const sourceText = label.source ? ` (${label.source})` : '';
    
//     // EMA-specific badges
//     const emaBadges = isEMA ? `
//         ${label.authorizationStatus ? `<span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">${label.authorizationStatus}</span>` : ''}
//         ${label.euNumber ? `<span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">EU ${label.euNumber}</span>` : ''}
//     ` : '';
    
//     return `
//         <div class="card-hover bg-white border border-gray-100 rounded-lg p-5">
//             <div class="flex items-start justify-between mb-4">
//                 <div class="flex items-center gap-2 flex-wrap">
//                     <span class="px-2 py-1 text-xs font-medium text-white ${tagColor} rounded">${label.type}${sourceText}</span>
//                     ${warningBadge}
//                     ${emaBadges}
//                 </div>
//                 <div class="text-xs text-secondary">
//                     ${formatDate(label.lastUpdated)}
//                 </div>
//             </div>
            
//             <h3 class="font-medium text-primary mb-3 text-sm leading-relaxed">${escapeHtml(label.productName)}</h3>
            
//             <div class="space-y-3 mb-4">
//                 <div>
//                     <div class="text-xs font-medium text-secondary mb-1">Indication</div>
//                     <p class="text-xs text-primary leading-relaxed">${truncateText(escapeHtml(label.indication), 120)}</p>
//                 </div>
                
//                 <div class="grid grid-cols-2 gap-3">
//                     <div>
//                         <div class="text-xs font-medium text-secondary mb-1">Route</div>
//                         <div class="text-xs text-primary">${escapeHtml(label.route)}</div>
//                     </div>
//                     <div>
//                         <div class="text-xs font-medium text-secondary mb-1">${isEMA ? 'MAH' : 'Manufacturer'}</div>
//                         <div class="text-xs text-primary">${truncateText(escapeHtml(label.manufacturerName || 'N/A'), 20)}</div>
//                     </div>
//                 </div>
                
//                 ${isEMA && (label.dosageForm || label.atcCode) ? `
//                 <div class="grid grid-cols-2 gap-3">
//                     ${label.dosageForm ? `
//                     <div>
//                         <div class="text-xs font-medium text-secondary mb-1">Dosage Form</div>
//                         <div class="text-xs text-primary">${escapeHtml(label.dosageForm)}</div>
//                     </div>
//                     ` : ''}
//                     ${label.atcCode ? `
//                     <div>
//                         <div class="text-xs font-medium text-secondary mb-1">ATC Code</div>
//                         <div class="text-xs text-primary">${escapeHtml(label.atcCode)}</div>
//                     </div>
//                     ` : ''}
//                 </div>
//                 ` : ''}
//             </div>
            
//             <button 
//                 onclick="PharmaLabellingModule.showFullLabel('${label.setid}')" 
//                 class="w-full px-4 py-2 bg-accent hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
//             >
//                 View ${isEMA ? 'EMA Details' : 'Complete Label'}
//             </button>
//         </div>
//     `;
// }

    // function showFullLabel(setid) {
    //     const label = currentLabels.find(l => l.setid === setid);
    //     if (!label) return;

    //     // Update modal header
    //     if (elements.modalTitle) elements.modalTitle.textContent = label.productName;
    //     if (elements.modalSubtitle) elements.modalSubtitle.textContent = `Last updated: ${formatDate(label.lastUpdated)}`;
        
    //     const isEMA = label.type === 'EMA';
    //     const sourceText = label.source ? ` (${label.source})` : '';
    //     if (elements.modalSourceBadge) {
    //         elements.modalSourceBadge.textContent = `${label.type} Label${sourceText}`;
    //         elements.modalSourceBadge.className = `px-2 py-1 text-xs font-medium rounded ${
    //             isEMA ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    //         }`;
    //     }

    //     // Create enhanced modal content with real data
    //     if (elements.modalContent) {
    //         elements.modalContent.innerHTML = `
    //             <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    //                 <!-- Left Column -->
    //                 <div class="space-y-6">
    //                     <div>
    //                         <h4 class="text-sm font-medium text-primary mb-3">Indication & Usage</h4>
    //                         <div class="text-sm text-secondary leading-relaxed">
    //                             ${formatTextContent(label.indication)}
    //                         </div>
    //                     </div>
                        
    //                     <div>
    //                         <h4 class="text-sm font-medium text-primary mb-3">Dosage & Administration</h4>
    //                         <div class="text-sm text-secondary leading-relaxed">
    //                             ${formatTextContent(label.dosage)}
    //                         </div>
    //                     </div>
                        
    //                     <div>
    //                         <h4 class="text-sm font-medium text-primary mb-3">Clinical Studies</h4>
    //                         <div class="text-sm text-secondary leading-relaxed">
    //                             ${formatTextContent(label.clinicalStudies)}
    //                         </div>
    //                     </div>
    //                 </div>

    //                 <!-- Right Column -->
    //                 <div class="space-y-6">
    //                     ${label.boxedWarning ? `
    //                     <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
    //                         <h4 class="text-sm font-medium text-orange-900 mb-2">⚠ Boxed Warning</h4>
    //                         <p class="text-sm text-orange-800">This medication carries FDA boxed warnings.</p>
    //                     </div>
    //                     ` : ''}
                        
    //                     <div>
    //                         <h4 class="text-sm font-medium text-primary mb-3">Warnings & Precautions</h4>
    //                         <div class="text-sm text-secondary leading-relaxed">
    //                             ${formatTextContent(label.warnings)}
    //                         </div>
    //                     </div>
                        
    //                     <div>
    //                         <h4 class="text-sm font-medium text-primary mb-3">Adverse Reactions</h4>
    //                         <div class="text-sm text-secondary leading-relaxed">
    //                             ${formatTextContent(label.adverseReactions)}
    //                         </div>
    //                     </div>
                        
    //                     <div class="bg-gray-50 rounded-lg p-4">
    //                         <h4 class="text-sm font-medium text-primary mb-3">Additional Information</h4>
    //                         <div class="space-y-2 text-xs">
    //                             <div class="flex justify-between">
    //                                 <span class="text-secondary">Set ID:</span>
    //                                 <span class="text-primary font-mono text-xs break-all">${label.setid}</span>
    //                             </div>
    //                             <div class="flex justify-between">
    //                                 <span class="text-secondary">Route:</span>
    //                                 <span class="text-primary">${escapeHtml(label.route)}</span>
    //                             </div>
    //                             ${label.manufacturerName && label.manufacturerName !== 'Not specified' ? `
    //                             <div class="flex justify-between">
    //                                 <span class="text-secondary">Manufacturer:</span>
    //                                 <span class="text-primary">${escapeHtml(label.manufacturerName)}</span>
    //                             </div>
    //                             ` : ''}
    //                             ${label.ndc && label.ndc.length > 0 ? `
    //                             <div class="flex justify-between">
    //                                 <span class="text-secondary">NDC Codes:</span>
    //                                 <span class="text-primary">${label.ndc.length} available</span>
    //                             </div>
    //                             ` : ''}
    //                             ${label.strength && label.strength !== 'Not specified' ? `
    //                             <div class="flex justify-between">
    //                                 <span class="text-secondary">Strength:</span>
    //                                 <span class="text-primary">${truncateText(escapeHtml(label.strength), 30)}</span>
    //                             </div>
    //                             ` : ''}
    //                         </div>
    //                     </div>
    //                 </div>
    //             </div>
    //         `;
    //     }
        
    //     if (elements.labelModal) elements.labelModal.classList.remove('hidden');
    // }

//     function showFullLabel(setid) {
//     const label = currentLabels.find(l => l.setid === setid);
//     if (!label) return;

//     // Update modal header
//     if (elements.modalTitle) elements.modalTitle.textContent = label.productName;
//     if (elements.modalSubtitle) elements.modalSubtitle.textContent = `Last updated: ${formatDate(label.lastUpdated)}`;
    
//     const isEMA = label.type === 'EMA';
//     const sourceText = label.source ? ` (${label.source})` : '';
    
//     if (elements.modalSourceBadge) {
//         elements.modalSourceBadge.textContent = `${label.type} ${isEMA ? 'Medicine' : 'Label'}${sourceText}`;
//         elements.modalSourceBadge.className = `px-2 py-1 text-xs font-medium rounded ${
//             isEMA ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
//         }`;
//     }

//     // Create enhanced modal content
//     if (elements.modalContent) {
//         if (isEMA) {
//             // EMA-specific modal content
//             elements.modalContent.innerHTML = `
//                 <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
//                     <!-- Left Column -->
//                     <div class="space-y-6">
//                         <div>
//                             <h4 class="text-sm font-medium text-primary mb-3">Medicine Information</h4>
//                             <div class="space-y-2 text-sm">
//                                 ${label.euNumber ? `<div><span class="font-medium">EU Number:</span> ${label.euNumber}</div>` : ''}
//                                 ${label.authorizationStatus ? `<div><span class="font-medium">Status:</span> ${label.authorizationStatus}</div>` : ''}
//                                 ${label.atcCode ? `<div><span class="font-medium">ATC Code:</span> ${label.atcCode}</div>` : ''}
//                                 ${label.dosageForm ? `<div><span class="font-medium">Dosage Form:</span> ${label.dosageForm}</div>` : ''}
//                             </div>
//                         </div>
                        
//                         <div>
//                             <h4 class="text-sm font-medium text-primary mb-3">Therapeutic Indication</h4>
//                             <div class="text-sm text-secondary leading-relaxed">
//                                 ${formatTextContent(label.indication)}
//                             </div>
//                         </div>
                        
//                         <div>
//                             <h4 class="text-sm font-medium text-primary mb-3">Marketing Authorization Holder</h4>
//                             <div class="text-sm text-secondary leading-relaxed">
//                                 ${formatTextContent(label.manufacturerName)}
//                             </div>
//                         </div>
//                     </div>

//                     <!-- Right Column -->
//                     <div class="space-y-6">
//                         <div>
//                             <h4 class="text-sm font-medium text-primary mb-3">Route of Administration</h4>
//                             <div class="text-sm text-secondary leading-relaxed">
//                                 ${formatTextContent(label.route)}
//                             </div>
//                         </div>
                        
//                         <div>
//                             <h4 class="text-sm font-medium text-primary mb-3">Authorization Date</h4>
//                             <div class="text-sm text-secondary leading-relaxed">
//                                 ${formatDate(label.lastUpdated)}
//                             </div>
//                         </div>
                        
//                         <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
//                             <h4 class="text-sm font-medium text-blue-800 mb-2">📋 EMA Information</h4>
//                             <p class="text-xs text-blue-600">
//                                 This medicine is authorized by the European Medicines Agency (EMA) for use in the European Union.
//                                 For complete prescribing information, please refer to the official EMA documentation.
//                             </p>
//                         </div>
//                     </div>
//                 </div>
                
//                 <div class="mt-8 pt-6 border-t border-gray-100">
//                     <p class="text-xs text-gray-500">
//                         Source: European Medicines Agency (EMA) - This information is for reference only and may not capture all details in the original documents.
//                     </p>
//                 </div>
//             `;
//         } else {
//             // Your existing FDA modal content
//             elements.modalContent.innerHTML = `
//                 <!-- Your existing FDA modal content here -->
//             `;
//         }
//     }

//     // Show modal
//     if (elements.labelModal) {
//         elements.labelModal.classList.remove('hidden');
//     }
// }


// Unified showFullLabel function that works for both FDA and EMA



// Improved createCleanLabelCard function with better UI design

function renderLabels() {
    // Check if user is Pro
    const isPro = window.leafIntelligenceFeatureBlocker ? window.leafIntelligenceFeatureBlocker.isPro : false;
    
    const filteredLabels = currentLabels.filter(label => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'fda') return label.type === 'FDA';
        if (currentFilter === 'ema') return label.type === 'EMA';
        
        if (currentFilter === 'warnings') return label.boxedWarning;
        return true;
    });

    // Sort by date (most recent first)
    const sortedLabels = [...filteredLabels].sort((a, b) => {
        const dateA = new Date(a.lastUpdated || 0);
        const dateB = new Date(b.lastUpdated || 0);
        return dateB - dateA;
    });

    // For free users, limit to top 3 most recent
    // const visibleLabels = isPro ? sortedLabels : sortedLabels.slice(0, 3);
    // const visibleLabels = sortedLabels.filter(label => label.type === 'FDA');
     const fdaOnlyLabels = sortedLabels.filter(label => label.type === 'FDA');
        visibleLabels = fdaOnlyLabels.slice(0, 3);
    const blockedCount = sortedLabels.length - visibleLabels.length;
    
    // For Pro users, use pagination normally
    let pageLabels = visibleLabels;
    if (isPro) {
        const totalPages = Math.ceil(visibleLabels.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        pageLabels = visibleLabels.slice(startIndex, endIndex);
        
        // Update pagination controls
        if (elements.currentPageSpan) elements.currentPageSpan.textContent = currentPage;
        if (elements.totalPagesSpan) elements.totalPagesSpan.textContent = totalPages;
        if (elements.prevPage) elements.prevPage.disabled = currentPage === 1;
        if (elements.nextPage) elements.nextPage.disabled = currentPage === totalPages;
    } else {
        // Hide pagination for free users
        const paginationContainer = document.querySelector('.pharma-pagination-container');
        if (paginationContainer) paginationContainer.style.display = 'none';
    }

    if (elements.labelsGrid) {
        // Render visible labels
        let gridHTML = pageLabels.map(label => createCleanLabelCard(label)).join('');
        
        // Add blocker section for free users
        if (!isPro && blockedCount > 0) {
            gridHTML += createLabelsBlocker(blockedCount, sortedLabels.length);
            
            // Add preview of next 2 blocked labels (blurred)
            if (sortedLabels.length > 3) {
                const previewLabels = sortedLabels.slice(3, 5);
                gridHTML += previewLabels.map(label => createBlurredLabelCard(label)).join('');
            }
        }
        
        elements.labelsGrid.innerHTML = gridHTML;
    }
    
    // Update the filter buttons to show counts
    updateFilterCounts(sortedLabels, isPro);
}
function updateFilterCounts(allLabels, isPro) {
    const visibleLabels = isPro ? allLabels : allLabels.slice(0, 3);
    
    const counts = {
        all: visibleLabels.length,
        fda: visibleLabels.filter(l => l.type === 'FDA').length,
        ema: visibleLabels.filter(l => l.type === 'EMA').length,
        warnings: visibleLabels.filter(l => l.boxedWarning).length
    };
    
    const totalCounts = {
        all: allLabels.length,
        fda: allLabels.filter(l => l.type === 'FDA').length,
        ema: allLabels.filter(l => l.type === 'EMA').length,
        warnings: allLabels.filter(l => l.boxedWarning).length
    };
    
    // Update filter button text to show counts
    if (!isPro) {
        if (elements.filterAll) {
            elements.filterAll.innerHTML = `All (${counts.all}/${totalCounts.all})`;
        }
        if (elements.filterFda) {
            elements.filterFda.innerHTML = `FDA (${counts.fda}/${totalCounts.fda})`;
        }
        if (elements.filterEma) {
            elements.filterEma.innerHTML = `EMA (${counts.ema}/${totalCounts.ema})`;
        }
        if (elements.filterWarnings) {
            elements.filterWarnings.innerHTML = `Warnings (${counts.warnings}/${totalCounts.warnings})`;
        }
    }
}

// Also update the summary section to show limited access for free users
function updateSummaryForFreeUsers(data) {
    const isPro = window.leafIntelligenceFeatureBlocker ? window.leafIntelligenceFeatureBlocker.isPro : false;
    
    if (!isPro && elements.summarySection) {
        // Add a banner to the summary section
        const banner = document.createElement('div');
        banner.className = 'mb-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4';
        banner.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                    </svg>
                    <span class="text-sm font-medium text-purple-800">
                        Showing 3 most recent labels • Upgrade to view all ${data.labels?.length || 0} labels
                    </span>
                </div>
                <button 
                    onclick="window.leafIntelligenceFeatureBlocker ? window.leafIntelligenceFeatureBlocker.showUpgradeModal() : alert('Upgrade to Pro')"
                    class="text-sm font-medium text-purple-600 hover:text-purple-800"
                >
                    Upgrade →
                </button>
            </div>
        `;
        
        // Insert banner at the beginning of summary section
        const firstChild = elements.summarySection.firstChild;
        if (firstChild) {
            elements.summarySection.insertBefore(banner, firstChild);
        } else {
            elements.summarySection.appendChild(banner);
        }
    }
}
// Create the blocker card that spans the full width
function createLabelsBlocker(blockedCount, totalCount) {
    return `
        <div class="col-span-full">
            <div class="relative mt-8 mb-4">
                <div class="absolute inset-0 bg-gradient-to-b from-transparent via-gray-50 to-gray-100 rounded-xl"></div>
                <div class="relative bg-white border-2 border-purple-200 rounded-xl p-8 text-center shadow-lg">
                    <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full mb-6">
                        <svg class="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                    </div>
                    
                    <h3 class="text-2xl font-bold text-gray-900 mb-3">
                        View All ${totalCount} Pharmaceutical Labels
                    </h3>
                    
                    <p class="text-gray-600 mb-6 max-w-md mx-auto">
                        Unlock access to ${blockedCount} more pharmaceutical labels including FDA and EMA data, 
                        boxed warnings, clinical information, and complete prescribing details.
                    </p>
                    
                    <div class="flex flex-wrap justify-center gap-3 mb-6">
                        <span class="inline-flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">
                            <svg class="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                            </svg>
                            Complete FDA Labels
                        </span>
                        <span class="inline-flex items-center px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">
                            <svg class="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                            </svg>
                            EMA Medicine Data
                        </span>
                        <span class="inline-flex items-center px-3 py-1 text-sm bg-orange-100 text-orange-800 rounded-full">
                            <svg class="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                            </svg>
                            Boxed Warnings
                        </span>
                        <span class="inline-flex items-center px-3 py-1 text-sm bg-purple-100 text-purple-800 rounded-full">
                            <svg class="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                            </svg>
                            Clinical Studies
                        </span>
                    </div>
                    
                    <button 
                        onclick="window.leafIntelligenceFeatureBlocker ? window.leafIntelligenceFeatureBlocker.showUpgradeModal() : alert('Upgrade to Pro')" 
                        class="inline-flex items-center px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-full hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 transition-all duration-300 shadow-lg"
                    >
                        <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
                        </svg>
                        Upgrade to Pro
                    </button>
                    
                    <p class="mt-4 text-sm text-gray-500">
                        Get unlimited access to all pharmaceutical labeling data
                    </p>
                </div>
            </div>
        </div>
    `;
}

// Create a blurred preview card
function createBlurredLabelCard(label) {
    const isEMA = label.type === 'EMA';
    const typeColor = isEMA ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800';
    
    return `
        <div class="relative group">
            <div class="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 rounded-xl"></div>
            <div class="opacity-40 pointer-events-none">
                <div class="bg-white border border-gray-200 rounded-xl p-6">
                    <div class="flex items-start justify-between mb-4">
                        <span class="inline-flex items-center px-3 py-1.5 text-xs font-semibold ${typeColor} border rounded-lg blur-sm">
                            ${label.type}
                        </span>
                        <div class="text-xs text-gray-500 font-medium blur-sm">
                            ${formatDate(label.lastUpdated)}
                        </div>
                    </div>
                    
                    <h3 class="font-semibold text-gray-900 mb-4 text-base blur-sm">
                        ${escapeHtml(label.productName)}
                    </h3>
                    
                    <div class="bg-gray-50 rounded-lg p-4 mb-4 blur-sm">
                        <div class="text-xs font-semibold text-gray-700 mb-2">INDICATION</div>
                        <p class="text-sm text-gray-800">••••••••••••••••••••••</p>
                    </div>
                    
                    <button class="w-full px-4 py-2.5 bg-gray-200 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed">
                        <span class="flex items-center justify-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                            </svg>
                            Pro Feature
                        </span>
                    </button>
                </div>
            </div>
        </div>
    `;
}


function createCleanLabelCard(label) {
    const isEMA = label.type === 'EMA';
    
    // Clean color scheme for badges
    const typeColor = isEMA ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-slate-100 text-slate-800 border-slate-200';
    
    // Warning badge with clean styling
    const warningBadge = label.boxedWarning ? 
        '<span class="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 rounded-full">⚠ Warning</span>' : '';
    
    const sourceText = label.source ? ` (${label.source})` : '';
    
    // EMA-specific badges with clean colors
    const emaBadges = isEMA ? `
        ${label.authorizationStatus ? `<span class="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full">${label.authorizationStatus}</span>` : ''}
        ${label.euNumber ? `<span class="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-violet-100 text-violet-800 border border-violet-200 rounded-full">EU ${label.euNumber}</span>` : ''}
    ` : '';
    
    const cardClasses = isEMA ? 
        'pro-feature ema-label-card group bg-white border border-gray-200 rounded-xl p-6 transition-all duration-300 hover:border-gray-300 hover:shadow-lg hover:-translate-y-0.5' : 
        'group bg-white border border-gray-200 rounded-xl p-6 transition-all duration-300 hover:border-gray-300 hover:shadow-lg hover:-translate-y-0.5';
    
    return `
        <div class="${cardClasses}">
        
        
            <!-- Header Section -->
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="inline-flex items-center px-3 py-1.5 text-xs font-semibold ${typeColor} border rounded-lg">
                        ${label.type}${sourceText}
                    </span>
                    ${warningBadge}
                    ${emaBadges}
                </div>
                <div class="text-xs text-gray-500 font-medium">
                    ${formatDate(label.lastUpdated)}
                </div>
            </div>
            
            <!-- Title -->
            <h3 class="font-semibold text-gray-900 mb-4 text-base leading-tight">
                ${escapeHtml(label.productName)}
            </h3>
            
            <!-- Content Section -->
            <div class="space-y-4 mb-6">
                
                <!-- Indication Box -->
                <div class="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <div class="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                        Indication
                    </div>
                    <p class="text-sm text-gray-800 leading-relaxed">
                        ${truncateText(escapeHtml(label.indication || 'Not specified'), 150)}
                    </p>
                </div>
                
                <!-- Details Grid -->
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div class="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
                            Route
                        </div>
                        <div class="text-sm text-gray-900 font-medium">
                            ${escapeHtml(label.route || 'Not specified')}
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div class="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
                            ${isEMA ? 'MAH' : 'Manufacturer'}
                        </div>
                        <div class="text-sm text-gray-900 font-medium" title="${escapeHtml(label.manufacturerName || 'Not specified')}">
                            ${truncateText(escapeHtml(label.manufacturerName || 'Not specified'), 25)}
                        </div>
                    </div>
                </div>
                
                <!-- EMA-specific additional information -->
                ${isEMA && (label.dosageForm || label.atcCode) ? `
                <div class="grid grid-cols-2 gap-3">
                    ${label.dosageForm ? `
                    <div class="bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <div class="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wider">
                            Dosage Form
                        </div>
                        <div class="text-sm text-blue-900 font-medium">
                            ${escapeHtml(label.dosageForm)}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${label.atcCode ? `
                    <div class="bg-violet-50 rounded-lg p-3 border border-violet-100">
                        <div class="text-xs font-semibold text-violet-700 mb-1 uppercase tracking-wider">
                            ATC Code
                        </div>
                        <div class="text-sm text-violet-900 font-medium font-mono">
                            ${escapeHtml(label.atcCode)}
                        </div>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
            </div>
            
            <!-- Clean Minimal Button -->
            <button 
                onclick="PharmaLabellingModule.showFullLabel('${label.setid || label.id}')" 
                class="w-full px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-all duration-200 hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-1"
                data-label-type="${label.type}"
                data-setid="${label.setid || label.id}"
            >
                <span class="flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    View ${isEMA ? 'EMA Details' : 'Complete Label'}
                </span>
            </button>
            
        </div>
    `;
}


function showFullLabel(setid) {
    const label = currentLabels.find(l => l.setid === setid);
    if (!label) {
        console.error('Label not found for setid:', setid);
        return;
    }

    console.log('Opening modal for label:', label);

    // Update modal header
    if (elements.modalTitle) {
        elements.modalTitle.textContent = label.productName;
    }
    if (elements.modalSubtitle) {
        elements.modalSubtitle.textContent = `Last updated: ${formatDate(label.lastUpdated)}`;
    }
    
    const isEMA = label.type === 'EMA';
    const sourceText = label.source ? ` (${label.source})` : '';
    
    if (elements.modalSourceBadge) {
        elements.modalSourceBadge.textContent = `${label.type} ${isEMA ? 'Medicine' : 'Label'}${sourceText}`;
        elements.modalSourceBadge.className = `px-2 py-1 text-xs font-medium rounded ${
            isEMA ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
        }`;
    }

    // Create modal content based on label type
    if (elements.modalContent) {
        if (isEMA) {
            // EMA-specific modal content (from your working commented version)
            elements.modalContent.innerHTML = createEMAModalContent(label);
        } else {
            // FDA-specific modal content (from your working uncommented version)
            elements.modalContent.innerHTML = createFDAModalContent(label);
        }
    }
    
    // Show modal
    if (elements.labelModal) {
        elements.labelModal.classList.remove('hidden');
    }
}

// Separate function for FDA modal content (based on your working uncommented version)
function createFDAModalContent(label) {
    return `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Left Column -->
            <div class="space-y-6">
                <div>
                    <h4 class="text-sm font-medium text-primary mb-3">Indication & Usage</h4>
                    <div class="text-sm text-secondary leading-relaxed">
                        ${formatTextContent(label.indication)}
                    </div>
                </div>
                
                <div>
                    <h4 class="text-sm font-medium text-primary mb-3">Dosage & Administration</h4>
                    <div class="text-sm text-secondary leading-relaxed">
                        ${formatTextContent(label.dosage)}
                    </div>
                </div>
                
                <div>
                    <h4 class="text-sm font-medium text-primary mb-3">Clinical Studies</h4>
                    <div class="text-sm text-secondary leading-relaxed">
                        ${formatTextContent(label.clinicalStudies)}
                    </div>
                </div>
            </div>

            <!-- Right Column -->
            <div class="space-y-6">
                ${label.boxedWarning ? `
                <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h4 class="text-sm font-medium text-orange-900 mb-2">⚠ Boxed Warning</h4>
                    <p class="text-sm text-orange-800">This medication carries FDA boxed warnings.</p>
                </div>
                ` : ''}
                
                <div>
                    <h4 class="text-sm font-medium text-primary mb-3">Warnings & Precautions</h4>
                    <div class="text-sm text-secondary leading-relaxed">
                        ${formatTextContent(label.warnings)}
                    </div>
                </div>
                
                <div>
                    <h4 class="text-sm font-medium text-primary mb-3">Adverse Reactions</h4>
                    <div class="text-sm text-secondary leading-relaxed">
                        ${formatTextContent(label.adverseReactions)}
                    </div>
                </div>
                
                <div class="bg-gray-50 rounded-lg p-4">
                    <h4 class="text-sm font-medium text-primary mb-3">Additional Information</h4>
                    <div class="space-y-2 text-xs">
                        <div class="flex justify-between">
                            <span class="text-secondary">Set ID:</span>
                            <span class="text-primary font-mono text-xs break-all">${label.setid}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-secondary">Route:</span>
                            <span class="text-primary">${escapeHtml(label.route)}</span>
                        </div>
                        ${label.manufacturerName && label.manufacturerName !== 'Not specified' ? `
                        <div class="flex justify-between">
                            <span class="text-secondary">Manufacturer:</span>
                            <span class="text-primary">${escapeHtml(label.manufacturerName)}</span>
                        </div>
                        ` : ''}
                        ${label.ndc && label.ndc.length > 0 ? `
                        <div class="flex justify-between">
                            <span class="text-secondary">NDC Codes:</span>
                            <span class="text-primary">${label.ndc.length} available</span>
                        </div>
                        ` : ''}
                        ${label.strength && label.strength !== 'Not specified' ? `
                        <div class="flex justify-between">
                            <span class="text-secondary">Strength:</span>
                            <span class="text-primary">${truncateText(escapeHtml(label.strength), 30)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Separate function for EMA modal content (based on your working commented version)
function createEMAModalContent(label) {
    return `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Left Column -->
            <div class="space-y-6">
                <div>
                    <h4 class="text-sm font-medium text-primary mb-3">Medicine Information</h4>
                    <div class="space-y-2 text-sm">
                        ${label.euNumber ? `<div><span class="font-medium">EU Number:</span> ${label.euNumber}</div>` : ''}
                        ${label.authorizationStatus ? `<div><span class="font-medium">Status:</span> ${label.authorizationStatus}</div>` : ''}
                        ${label.atcCode ? `<div><span class="font-medium">ATC Code:</span> ${label.atcCode}</div>` : ''}
                        ${label.dosageForm ? `<div><span class="font-medium">Dosage Form:</span> ${label.dosageForm}</div>` : ''}
                    </div>
                </div>
                
                <div>
                    <h4 class="text-sm font-medium text-primary mb-3">Therapeutic Indication</h4>
                    <div class="text-sm text-secondary leading-relaxed">
                        ${formatTextContent(label.indication)}
                    </div>
                </div>
                
                <div>
                    <h4 class="text-sm font-medium text-primary mb-3">Marketing Authorization Holder</h4>
                    <div class="text-sm text-secondary leading-relaxed">
                        ${formatTextContent(label.manufacturerName)}
                    </div>
                </div>
            </div>

            <!-- Right Column -->
            <div class="space-y-6">
                <div>
                    <h4 class="text-sm font-medium text-primary mb-3">Route of Administration</h4>
                    <div class="text-sm text-secondary leading-relaxed">
                        ${formatTextContent(label.route)}
                    </div>
                </div>
                
                <div>
                    <h4 class="text-sm font-medium text-primary mb-3">Authorization Date</h4>
                    <div class="text-sm text-secondary leading-relaxed">
                        ${formatDate(label.lastUpdated)}
                    </div>
                </div>
                
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 class="text-sm font-medium text-blue-800 mb-2">📋 EMA Information</h4>
                    <p class="text-xs text-blue-600">
                        This medicine is authorized by the European Medicines Agency (EMA) for use in the European Union.
                        For complete prescribing information, please refer to the official EMA documentation.
                    </p>
                </div>
            </div>
        </div>
        
        <div class="mt-8 pt-6 border-t border-gray-100">
            <p class="text-xs text-gray-500">
                Source: European Medicines Agency (EMA) - This information is for reference only and may not capture all details in the original documents.
            </p>
        </div>
    `;
}

// Helper functions (make sure these exist in your code)
function formatTextContent(content) {
    if (!content) return 'Not available';
    if (Array.isArray(content)) {
        content = content.join(' ');
    }
    if (typeof content === 'object') {
        content = JSON.stringify(content);
    }
    const text = String(content);
    const truncated = text.length > 500 ? text.slice(0, 500) + '...' : text;
    return escapeHtml(truncated);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function truncateText(text, maxLength) {
    if (!text) return '';
    const str = String(text);
    return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString();
    } catch (e) {
        return dateString;
    }
}

    function setFilter(filter) {
        currentFilter = filter;
        currentPage = 1;
        
        // Update button styles
        [elements.filterAll, elements.filterFda, elements.filterEma, elements.filterWarnings].forEach(btn => {
            if (btn) btn.className = 'px-3 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50 text-secondary';
        });
        
        const activeBtn = {
            'all': elements.filterAll,
            'fda': elements.filterFda,
            'ema': elements.filterEma,
            'warnings': elements.filterWarnings
        }[filter];
        
        if (activeBtn) {
            activeBtn.className = 'px-3 py-1 text-xs border rounded-md bg-accent text-white border-accent';
        }
        
        renderLabels();
    }

    function changePage(direction) {
        const filteredLabels = currentLabels.filter(label => {
            if (currentFilter === 'all') return true;
            if (currentFilter === 'fda') return label.type === 'FDA';
            if (currentFilter === 'ema') return label.type === 'EMA';
            if (currentFilter === 'warnings') return label.boxedWarning;
            return true;
        });
        
        const totalPages = Math.ceil(filteredLabels.length / itemsPerPage);
        const newPage = currentPage + direction;
        
        if (newPage >= 1 && newPage <= totalPages) {
            currentPage = newPage;
            renderLabels();
            const labellingSection = document.getElementById('LabellingSection');
            if (labellingSection) {
                labellingSection.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    function showError(message) {
        if (elements.loading) elements.loading.classList.add('hidden');
        console.error(message);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-sm z-50';
        errorDiv.innerHTML = `
            <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span class="text-sm">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-red-500 hover:text-red-700">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }

    // Utility functions
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function truncateText(text, length) {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    function formatDate(dateStr) {
        if (!dateStr || dateStr === 'Unknown') return 'Unknown';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateStr;
        }
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return 'Unknown';
        try {
            return new Date(dateStr).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    }

    function formatTextContent(text) {
        if (!text || text === 'Not specified' || text === 'See full labeling') {
            return '<em class="text-gray-400">Information available in full SPL document</em>';
        }
        
        const cleaned = text.replace(/<[^>]*>/g, '').trim();
        if (cleaned.length === 0) {
            return '<em class="text-gray-400">Information not available in current dataset</em>';
        }
        
        if (cleaned.length > 800) {
            const truncated = cleaned.substring(0, 800);
            return `<p>${truncated}... <span class="text-blue-500 cursor-pointer" onclick="this.style.display='none'; this.nextElementSibling.style.display='inline'">[Read More]</span><span style="display:none">${cleaned.substring(800)}</span></p>`;
        }
        
        return `<p>${cleaned}</p>`;
    }

    // Public API
    return {
        init: init,
        showFullLabel: showFullLabel,
        performSearch: performSearch
    };
})();

// Initialize when DOM is ready
// Initialize when DOM is ready - ALWAYS initialize to listen for events
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing PharmaLabellingModule...');
    
    // Always initialize to set up event listeners, regardless of visibility
    setTimeout(() => {
        try {
            PharmaLabellingModule.init();
            console.log('✅ PharmaLabellingModule initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize PharmaLabellingModule:', error);
            
            // Retry after a longer delay
            setTimeout(() => {
                try {
                    PharmaLabellingModule.init();
                    console.log('✅ PharmaLabellingModule initialized on retry');
                } catch (retryError) {
                    console.error('❌ PharmaLabellingModule initialization failed on retry:', retryError);
                }
            }, 2000);
        }
    }, 500);
});

// Also add a global function to manually test the event
window.testEMAEvent = function() {
    console.log('🧪 Testing EMA event dispatch...');
    const event = new CustomEvent('emaDataLoaded', {
        detail: {
            medicines: [{name: 'Test Medicine'}],
            count: 1,
            searchTerm: 'test'
        }
    });
    document.dispatchEvent(event);
};

// Make the module globally available
window.PharmaLabellingModule = PharmaLabellingModule;
// 🔥 EXPOSE HELPER FUNCTION FOR EXTERNAL ACCESS 🔥
// Make the refresh function available globally for debugging or manual calls
if (typeof window.PharmaLabellingModule === 'undefined') {
    window.PharmaLabellingModule = {};
}
// window.PharmaLabellingModule.refreshLabelsWithEMAData = PharmaLabellingModule.refreshLabelsWithEMAData;
