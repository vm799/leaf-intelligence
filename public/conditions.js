
        let currentResults = null;
        let allCharts = {};
        // const API_BASE= 'http://localhost:4000';

        function handleKeyPress(event) {
            if (event.key === 'Enter') {
                searchCondition();
            }
        }

        function quickSearch(condition) {
            document.getElementById('searchInput').value = condition;
            searchCondition();
        }

        // async function searchCondition() {
        //     const condition = document.getElementById('searchInput').value.trim();
        //     if (!condition) return;

        //     showState('loading');
            
        //     // Clear all existing charts
        //     Object.values(allCharts).forEach(chart => {
        //         if (chart) chart.destroy();
        //     });
        //     allCharts = {};

        //     try {
        //         const response = await fetch(`${API_BASE_URL}/condition/condition/${encodeURIComponent(condition)}`);
        //         const data = await response.json();

        //         if (data.success && data.results) {
        //             currentResults = data.results;
        //             displayResults();
        //         } else {
        //             showState('noResults');
        //         }
        //     } catch (error) {
        //         console.error('Search error:', error);
        //         showState('noResults');
        //     }
        // }


async function searchCondition() {
    const condition = document.getElementById('searchInput').value.trim();
    if (!condition) return;

    showState('loading');
    
    // Clear all existing charts
    Object.values(allCharts).forEach(chart => {
        if (chart) chart.destroy();
    });
    allCharts = {};

    try {
        const response = await fetch(`${API_BASE_URL}/condition/condition/${encodeURIComponent(condition)}`);
        const data = await response.json();

        if (data.success && data.results) {
            currentResults = data.results;
            displayResults();
        } else {
            showState('noResults');
        }
    } catch (error) {
        console.error('Search error:', error);
        showState('noResults');
    }
}

function showState(state) {
    // Hide all states
    document.getElementById('fdaLoadingState').classList.add('hidden');
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('noResultsState').classList.add('hidden');

    if (state === 'loading') {
        document.getElementById('fdaLoadingState').classList.remove('hidden');
    } else if (state === 'results') {
        document.getElementById('resultsSection').classList.remove('hidden');
    } else if (state === 'noResults') {
        document.getElementById('noResultsState').classList.remove('hidden');
    }
}



        // function showState(state) {
        //     document.getElementById('loadingState').classList.add('hidden');
        //     document.getElementById('resultsSection').classList.add('hidden');
        //     document.getElementById('noResultsState').classList.add('hidden');

        //     if (state === 'loading') {
        //         document.getElementById('loadingState').classList.remove('hidden');
        //     } else if (state === 'results') {
        //         document.getElementById('resultsSection').classList.remove('hidden');
        //     } else if (state === 'noResults') {
        //         document.getElementById('noResultsState').classList.remove('hidden');
        //     }
        // }

        function displayResults() {
            if (!currentResults) return;

            displayExecutiveSummary();
            displayKeyMetrics();
            displayRegulatoryOverview();
            displayClinicalTrials();
            displaySafetyProfile();
            displayChemistry();
            displayLiterature();
            displayFailedDrugs();
            
            // Update last updated time
            document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
            
            showState('results');
        }

        function displayExecutiveSummary() {
            const summary = currentResults.summary;
            const summaryHtml = `
                <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                    <div class="flex items-start justify-between">
                        <div>
                            <h2 class="text-2xl font-bold text-gray-900 mb-2">
                                ${currentResults.condition.toUpperCase()} - Regulatory Intelligence Report
                            </h2>
                            <p class="text-gray-600">
                                Comprehensive analysis from ${Object.keys(currentResults.sources).length} regulatory and scientific databases
                            </p>
                            <div class="mt-4 flex space-x-6">
                                <div class="flex items-center">
                                    <svg class="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span class="text-sm"><strong>${summary.total_drugs}</strong> Approved Drugs</span>
                                </div>
                                <div class="flex items-center">
                                    <svg class="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"></path>
                                    </svg>
                                    <span class="text-sm"><strong>${summary.research_articles}</strong> Research Articles</span>
                                </div>
                                <div class="flex items-center">
                                    <svg class="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span class="text-sm"><strong>${summary.failed_drugs}</strong> Failed/Withdrawn</span>
                                </div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-3xl font-bold text-blue-600">${summary.total_drugs + summary.active_trials}</div>
                            <div class="text-sm text-gray-600">Total Regulatory Items</div>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('executiveSummary').innerHTML = summaryHtml;
        }

        function displayKeyMetrics() {
            const summary = currentResults.summary;
            const sources = currentResults.sources;
            
            const metrics = [
                {
                    label: 'FDA Drugs',
                    value: sources.fda_drugs.count,
                    icon: '💊',
                    color: 'blue'
                },
                {
                    label: 'Active Trials',
                    value: summary.active_trials,
                    icon: '🔬',
                    color: 'green'
                },
                {
                    label: 'Failed/Withdrawn',
                    value: summary.failed_drugs,
                    icon: '⚠️',
                    color: 'red'
                },
                {
                    label: 'Publications',
                    value: sources.pubmed_articles.count,
                    icon: '📚',
                    color: 'purple'
                },
                {
                    label: 'Compounds',
                    value: summary.compounds_identified,
                    icon: '🧪',
                    color: 'indigo'
                },
                {
                    label: 'Safety Events',
                    value: sources.adverse_events.count,
                    icon: '🚨',
                    color: 'yellow'
                }
            ];

            const metricsHtml = metrics.map(metric => `
                <div class="metric-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="metric-value">${metric.value.toLocaleString()}</div>
                            <div class="metric-label">${metric.label}</div>
                        </div>
                        <div class="text-2xl opacity-50">${metric.icon}</div>
                    </div>
                </div>
            `).join('');

            document.getElementById('keyMetrics').innerHTML = metricsHtml;
        }

        function displayRegulatoryOverview() {
            const drugs = currentResults.sources.fda_drugs.data.slice(0, 10);
            const dailymed = currentResults.sources.dailymed_labels.data.slice(0, 5);
            const rxnorm = currentResults.sources.rxnorm_drugs.data.slice(0, 5);
            
            // FDA Drugs Table
            const drugsTableHtml = drugs.length > 0 ? `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Drug Name</th>
                            <th>Manufacturer</th>
                            <th>Type</th>
                            <th>Route</th>
                            <th>Status</th>
                            <th>NDC</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${drugs.map(drug => `
                            <tr>
                                <td class="font-medium">${drug.drug_name || 'N/A'}</td>
                                <td class="text-gray-600">${drug.manufacturer || 'Unknown'}</td>
                                <td><span class="badge badge-info">${drug.dosage_form || 'N/A'}</span></td>
                                <td>${drug.route || 'N/A'}</td>
                                <td><span class="badge badge-success">Approved</span></td>
                                <td class="font-mono text-xs">${drug.ndc || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p class="text-gray-500">No FDA drug data available</p>';
            
            document.getElementById('fdaDrugsTable').innerHTML = drugsTableHtml;
            
            // Regulatory Timeline
            const timelineHtml = [...dailymed, ...rxnorm].slice(0, 5).map(item => `
                <div class="timeline-item">
                    <div class="card p-3">
                        <h4 class="font-medium text-sm">${item.drug_name || item.name || item.title || 'Unknown'}</h4>
                        <p class="text-xs text-gray-600 mt-1">${item.labeler || item.manufacturer || 'Unknown Manufacturer'}</p>
                        ${item.last_updated ? `<p class="text-xs text-gray-500 mt-1">Updated: ${new Date(item.last_updated).toLocaleDateString()}</p>` : ''}
                    </div>
                </div>
            `).join('') || '<p class="text-gray-500">No timeline data available</p>';
            
            document.getElementById('regulatoryTimeline').innerHTML = timelineHtml;
            
            // Create approval chart
            if (drugs.length > 0) {
                const ctx = document.getElementById('approvalChart');
                if (ctx) {
                    allCharts.approval = new Chart(ctx.getContext('2d'), {
                        type: 'doughnut',
                        data: {
                            labels: ['Prescription', 'OTC', 'Other'],
                            datasets: [{
                                data: [
                                    drugs.filter(d => d.route?.includes('ORAL')).length,
                                    drugs.filter(d => d.route?.includes('TOPICAL')).length,
                                    drugs.filter(d => !d.route?.includes('ORAL') && !d.route?.includes('TOPICAL')).length
                                ],
                                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b']
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            plugins: {
                                legend: {
                                    position: 'bottom',
                                    labels: {
                                        padding: 10,
                                        font: { size: 11 }
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }

        function displayClinicalTrials() {
            const trials = currentResults.sources.clinical_trials.data;
            
            // Calculate counts
            const recruiting = trials.filter(t => t.status === 'RECRUITING').length;
            const active = trials.filter(t => t.status === 'ACTIVE_NOT_RECRUITING').length;
            const completed = trials.filter(t => t.status === 'COMPLETED').length;
            
            // Update counts
            document.getElementById('recruitingCount').textContent = recruiting;
            document.getElementById('activeCount').textContent = active;
            document.getElementById('completedCount').textContent = completed;
            document.getElementById('totalTrialsCount').textContent = trials.length;
            
            // Trials table
            const trialsTableHtml = trials.length > 0 ? `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>NCT ID</th>
                            <th>Title</th>
                            <th>Phase</th>
                            <th>Status</th>
                            <th>Sponsor</th>
                            <th>Enrollment</th>
                            <th>Start Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trials.slice(0, 15).map(trial => `
                            <tr>
                                <td>
                                    <a href="https://clinicaltrials.gov/study/${trial.nct_id}" target="_blank" class="text-blue-600 hover:underline font-medium">
                                        ${trial.nct_id}
                                    </a>
                                </td>
                                <td class="max-w-xs truncate" title="${trial.title}">${trial.title}</td>
                                <td><span class="badge badge-info">${trial.phase || 'N/A'}</span></td>
                                <td><span class="badge badge-${getStatusBadgeClass(trial.status)}">${trial.status}</span></td>
                                <td>${trial.sponsor}</td>
                                <td>${trial.enrollment || 'N/A'}</td>
                                <td>${trial.start_date || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p class="text-gray-500">No clinical trials data available</p>';
            
            document.getElementById('clinicalTrialsTable').innerHTML = trialsTableHtml;
            
            // Phase distribution chart
            const phaseCtx = document.getElementById('phaseChart');
            if (phaseCtx && trials.length > 0) {
                const phaseCounts = {
                    'Phase 1': trials.filter(t => t.phase?.includes('1')).length,
                    'Phase 2': trials.filter(t => t.phase?.includes('2')).length,
                    'Phase 3': trials.filter(t => t.phase?.includes('3')).length,
                    'Phase 4': trials.filter(t => t.phase?.includes('4')).length,
                    'N/A': trials.filter(t => !t.phase || t.phase === 'N/A').length
                };
                
                allCharts.phase = new Chart(phaseCtx.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: Object.keys(phaseCounts),
                        datasets: [{
                            label: 'Trials',
                            data: Object.values(phaseCounts),
                            backgroundColor: '#3b82f6'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { stepSize: 1 }
                            }
                        }
                    }
                });
            }
            
            // Enrollment chart
            const enrollCtx = document.getElementById('enrollmentChart');
            if (enrollCtx && trials.length > 0) {
                const enrollmentData = trials
                    .filter(t => t.enrollment)
                    .slice(0, 10)
                    .map(t => ({
                        label: t.nct_id,
                        value: t.enrollment
                    }));
                
                if (enrollmentData.length > 0) {
                    allCharts.enrollment = new Chart(enrollCtx.getContext('2d'), {
                        type: 'line',
                        data: {
                            labels: enrollmentData.map(d => d.label),
                            datasets: [{
                                label: 'Enrollment',
                                data: enrollmentData.map(d => d.value),
                                borderColor: '#10b981',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                tension: 0.4
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            plugins: {
                                legend: { display: false }
                            },
                            scales: {
                                y: { beginAtZero: true }
                            }
                        }
                    });
                }
            }
        }

        function displaySafetyProfile() {
            const adverseEvents = currentResults.sources.adverse_events.data;
            const interactions = currentResults.sources.drug_interactions.data;
            
            // Safety alerts
            const safetyAlertsHtml = adverseEvents.filter(ae => ae.severity_category === 'Severe').length > 0 ? `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="flex items-start">
                        <svg class="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                        </svg>
                        <div>
                            <h3 class="text-sm font-semibold text-red-900">Critical Safety Signals Detected</h3>
                            <p class="text-sm text-red-700 mt-1">
                                ${adverseEvents.filter(ae => ae.severity_category === 'Severe').length} severe adverse events reported.
                                Review required for regulatory compliance.
                            </p>
                        </div>
                    </div>
                </div>
            ` : '';
            
            document.getElementById('safetyAlerts').innerHTML = safetyAlertsHtml;
            
            // Adverse Events Chart
            if (adverseEvents.length > 0) {
                const aeCtx = document.getElementById('aeChart');
                if (aeCtx) {
                    const aeData = adverseEvents.slice(0, 10);
                    
                    allCharts.ae = new Chart(aeCtx.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: aeData.map(ae => ae.reaction.substring(0, 30)),
                            datasets: [{
                                label: 'Reported Events',
                                data: aeData.map(ae => ae.count),
                                backgroundColor: aeData.map(ae => 
                                    ae.severity_category === 'Severe' ? 'rgba(239, 68, 68, 0.5)' :
                                    ae.severity_category === 'Moderate' ? 'rgba(251, 191, 36, 0.5)' :
                                    'rgba(34, 197, 94, 0.5)'
                                ),
                                borderColor: aeData.map(ae => 
                                    ae.severity_category === 'Severe' ? 'rgba(239, 68, 68, 1)' :
                                    ae.severity_category === 'Moderate' ? 'rgba(251, 191, 36, 1)' :
                                    'rgba(34, 197, 94, 1)'
                                ),
                                borderWidth: 1
                            }]
                        },
                        options: {
                             indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: true,
                             plugins: {
                                legend: { display: false }
                            },
                            scales: {
                                x: {
                                    beginAtZero: true
                                }
                            }
                        }
                    });
                }
            }
            
            // Adverse Events List
            const aeListHtml = adverseEvents.length > 0 ? `
                <div class="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 class="font-semibold text-sm mb-3">Top Adverse Events by Category</h4>
                    <div class="space-y-2">
                        ${adverseEvents.slice(0, 5).map(ae => `
                            <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div>
                                    <span class="text-sm font-medium">${ae.drug_name}</span>
                                    <span class="text-xs text-gray-600 ml-2">${ae.reaction}</span>
                                </div>
                                <span class="badge badge-${ae.severity_category === 'Severe' ? 'danger' : ae.severity_category === 'Moderate' ? 'warning' : 'success'}">
                                    ${ae.frequency}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : '';
            
            document.getElementById('adverseEventsList').innerHTML = aeListHtml;
            
            // Drug Interactions Table
            const interactionsHtml = interactions.length > 0 ? `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Drug 1</th>
                            <th>Drug 2</th>
                            <th>Severity</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${interactions.slice(0, 10).map(interaction => `
                            <tr>
                                <td class="font-medium">${interaction.drug1}</td>
                                <td>${interaction.drug2}</td>
                                <td>
                                    <span class="risk-indicator risk-${
                                        interaction.severity?.toLowerCase() === 'high' ? 'high' :
                                        interaction.severity?.toLowerCase() === 'moderate' ? 'medium' : 'low'
                                    }">
                                        ${interaction.severity || 'Unknown'}
                                    </span>
                                </td>
                                <td class="text-xs">${interaction.description || 'Interaction detected'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p class="text-gray-500">No drug interaction data available</p>';
            
            document.getElementById('drugInteractionsTable').innerHTML = interactionsHtml;
            
            // Severity Distribution Chart
            const severityCtx = document.getElementById('severityChart');
            if (severityCtx && adverseEvents.length > 0) {
                const severityCounts = {
                    'Severe': adverseEvents.filter(ae => ae.severity_category === 'Severe').length,
                    'Moderate': adverseEvents.filter(ae => ae.severity_category === 'Moderate').length,
                    'Mild': adverseEvents.filter(ae => ae.severity_category === 'Mild').length
                };
                
                allCharts.severity = new Chart(severityCtx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(severityCounts),
                        datasets: [{
                            data: Object.values(severityCounts),
                            backgroundColor: ['#ef4444', '#f59e0b', '#10b981']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 10,
                                    font: { size: 11 }
                                }
                            }
                        }
                    }
                });
            }
        }

// REPLACE the displayChemistry() function in your fdaconditions.html file

function displayChemistry() {
    const compounds = currentResults.sources.pubchem_compounds.data;
    const rxnorm = currentResults.sources.rxnorm_drugs.data.slice(0, 5);
    const dailymed = currentResults.sources.dailymed_labels.data.slice(0, 5);
    
    // Enhanced Compounds Display with Visualization
    const compoundsHtml = compounds.length > 0 ? `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            ${compounds.map(compound => `
                <div class="card p-4 card-hover">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h4 class="font-semibold text-lg">${compound.drug_name}</h4>
                            <p class="text-xs text-gray-500">PubChem CID: ${compound.cid}</p>
                        </div>
                        <a href="${compound.pubchem_url}" target="_blank" 
                           class="text-blue-600 hover:text-blue-800">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                            </svg>
                        </a>
                    </div>
                    
                    <!-- Structure Image -->
                    <div class="bg-gray-50 rounded-lg p-3 mb-3">
                        <img src="${compound.structure_image}" 
                             alt="${compound.drug_name} structure" 
                             class="w-full h-48 object-contain"
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5TdHJ1Y3R1cmUgTm90IEF2YWlsYWJsZTwvdGV4dD48L3N2Zz4='">
                    </div>
                    
                    <!-- Chemical Properties -->
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div class="bg-blue-50 rounded p-2">
                            <span class="text-gray-600">Formula:</span>
                            <span class="font-mono font-semibold block">${compound.molecular_formula}</span>
                        </div>
                        <div class="bg-green-50 rounded p-2">
                            <span class="text-gray-600">MW:</span>
                            <span class="font-semibold block">${compound.molecular_weight}</span>
                        </div>
                        ${compound.xlogp !== 'N/A' ? `
                        <div class="bg-purple-50 rounded p-2">
                            <span class="text-gray-600">XLogP:</span>
                            <span class="font-semibold block">${compound.xlogp}</span>
                        </div>
                        ` : ''}
                        ${compound.tpsa !== 'N/A' ? `
                        <div class="bg-yellow-50 rounded p-2">
                            <span class="text-gray-600">TPSA:</span>
                            <span class="font-semibold block">${compound.tpsa} Ų</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- InChI Key -->
                    <div class="mt-3 p-2 bg-gray-50 rounded">
                        <span class="text-xs text-gray-500">InChI Key:</span>
                        <div class="font-mono text-xs break-all mt-1">${compound.inchi_key}</div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="mt-3 flex space-x-2">
                        <a href="${compound.pubchem_url}" target="_blank" 
                           class="text-blue-600 hover:underline text-xs">
                            View in PubChem →
                        </a>
                        <a href="${compound.structure_3d}" target="_blank" 
                           class="text-purple-600 hover:underline text-xs">
                            View 3D Structure →
                        </a>
                    </div>
                </div>
            `).join('')}
        </div>
        
        ${compounds.length > 2 ? `
        <div class="mt-6">
            <h4 class="text-sm font-semibold text-gray-700 mb-3">Structural Comparison</h4>
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="grid grid-cols-2 md:grid-cols-${Math.min(compounds.length, 4)} gap-4">
                    ${compounds.slice(0, 4).map(c => `
                        <div class="text-center">
                            <img src="${c.structure_image}" 
                                 alt="${c.drug_name}" 
                                 class="w-full h-32 object-contain mb-2">
                            <p class="text-xs font-medium">${c.drug_name}</p>
                            <p class="text-xs text-gray-500">${c.molecular_formula}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        ` : ''}
    ` : `
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p class="text-yellow-800">No chemical compound data available. This may be because:</p>
            <ul class="list-disc list-inside text-sm text-yellow-700 mt-2">
                <li>The condition name doesn't match specific drug compounds</li>
                <li>PubChem API is temporarily unavailable</li>
                <li>Try searching for a specific drug name instead</li>
            </ul>
        </div>
    `;
    
    document.getElementById('compoundsTable').innerHTML = compoundsHtml;
    
    // Manufacturing Info - Enhanced Display
    const manufacturingHtml = `
        <div class="space-y-4">
            ${rxnorm.length > 0 ? `
                <h4 class="text-sm font-semibold text-gray-700">RxNorm Drug Products</h4>
                ${rxnorm.map(drug => `
                    <div class="card p-4 card-hover">
                        <h5 class="font-medium mb-2">${drug.name}</h5>
                        <div class="text-xs space-y-1 text-gray-600">
                            <div class="flex justify-between">
                                <span class="font-semibold">RxCUI:</span>
                                <span class="font-mono">${drug.rxcui}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="font-semibold">Type:</span>
                                <span>${drug.tty}</span>
                            </div>
                            ${drug.dose_form ? `
                            <div class="flex justify-between">
                                <span class="font-semibold">Form:</span>
                                <span>${drug.dose_form}</span>
                            </div>
                            ` : ''}
                            ${drug.strength ? `
                            <div class="flex justify-between">
                                <span class="font-semibold">Strength:</span>
                                <span>${drug.strength}</span>
                            </div>
                            ` : ''}
                        </div>
                        <a href="${drug.rxnorm_url}" target="_blank" 
                           class="text-blue-600 hover:underline text-xs mt-2 inline-block">
                            View in RxNorm →
                        </a>
                    </div>
                `).join('')}
            ` : ''}
            
            ${dailymed.length > 0 ? `
                <h4 class="text-sm font-semibold text-gray-700 mt-4">Product Labels</h4>
                ${dailymed.map(label => `
                    <div class="card p-4 card-hover">
                        <h5 class="font-medium mb-2">${label.drug_name}</h5>
                        <div class="text-xs space-y-1 text-gray-600">
                            <div class="flex justify-between">
                                <span class="font-semibold">Labeler:</span>
                                <span>${label.labeler}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="font-semibold">Status:</span>
                                <span class="badge badge-success">${label.marketing_status}</span>
                            </div>
                            ${label.dosage_form ? `
                            <div class="flex justify-between">
                                <span class="font-semibold">Form:</span>
                                <span>${label.dosage_form}</span>
                            </div>
                            ` : ''}
                            ${label.route ? `
                            <div class="flex justify-between">
                                <span class="font-semibold">Route:</span>
                                <span>${label.route}</span>
                            </div>
                            ` : ''}
                        </div>
                        ${label.label_url !== '#' ? `
                            <a href="${label.label_url}" target="_blank" 
                               class="text-blue-600 hover:underline text-xs mt-2 inline-block">
                                View Label →
                            </a>
                        ` : ''}
                    </div>
                `).join('')}
            ` : ''}
            
            ${rxnorm.length === 0 && dailymed.length === 0 ? `
                <p class="text-gray-500">No manufacturing data available</p>
            ` : ''}
        </div>
    `;
    
    document.getElementById('manufacturingInfo').innerHTML = manufacturingHtml;
    
    // Dosage Form Chart - Enhanced
    const dosageCtx = document.getElementById('dosageFormChart');
    if (dosageCtx) {
        const allDrugs = [...currentResults.sources.fda_drugs.data, ...dailymed];
        const dosageForms = {};
        
        allDrugs.forEach(drug => {
            const form = drug.dosage_form || 'Other';
            // Clean up the form name
            const cleanForm = form.split(',')[0].split(';')[0].trim();
            dosageForms[cleanForm] = (dosageForms[cleanForm] || 0) + 1;
        });
        
        const topForms = Object.entries(dosageForms)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);
        
        if (topForms.length > 0) {
            if (allCharts.dosage) allCharts.dosage.destroy();
            
            allCharts.dosage = new Chart(dosageCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: topForms.map(f => f[0]),
                    datasets: [{
                        data: topForms.map(f => f[1]),
                        backgroundColor: [
                            '#3b82f6', '#10b981', '#f59e0b', 
                            '#ef4444', '#8b5cf6', '#ec4899'
                        ],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 10,
                                font: { size: 11 },
                                generateLabels: function(chart) {
                                    const data = chart.data;
                                    return data.labels.map((label, i) => ({
                                        text: `${label} (${data.datasets[0].data[i]})`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: false,
                                        index: i
                                    }));
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }
}

        function displayLiterature() {
            const articles = currentResults.sources.pubmed_articles.data;
            
            // Calculate metrics
            const totalPubs = currentResults.sources.pubmed_articles.count || articles.length;
            const avgCitations = articles.length > 0 
                ? Math.round(articles.reduce((sum, a) => sum + (a.citation_count || 0), 0) / articles.length)
                : 0;
            const recentArticles = articles.filter(a => {
                const pubYear = new Date(a.publication_date).getFullYear();
                const currentYear = new Date().getFullYear();
                return currentYear - pubYear <= 1;
            }).length;
            
            // Update metrics
            document.getElementById('totalPublications').textContent = totalPubs;
            document.getElementById('avgCitations').textContent = avgCitations;
            document.getElementById('recentArticles').textContent = recentArticles;
            
            // Publications table
            const articlesHtml = articles.length > 0 ? `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Authors</th>
                            <th>Journal</th>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Citations</th>
                            <th>PMID</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${articles.map(article => `
                            <tr>
                                <td class="max-w-md">
                                    <a href="${article.pubmed_url}" target="_blank" class="text-blue-600 hover:underline">
                                        ${article.title}
                                    </a>
                                </td>
                                <td class="text-xs text-gray-600">${article.authors || 'Unknown'}</td>
                                <td class="text-xs">${article.journal}</td>
                                <td class="text-xs">${article.publication_date}</td>
                                <td>
                                    <span class="badge badge-info">
                                        ${article.publication_type || 'Research'}
                                    </span>
                                </td>
                                <td class="text-center">${article.citation_count || 0}</td>
                                <td class="font-mono text-xs">${article.pmid}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p class="text-gray-500">No literature data available</p>';
            
            document.getElementById('publicationsTable').innerHTML = articlesHtml;
        }

        function displayFailedDrugs() {
            const failed = currentResults.sources.failed_drugs.data;
            
            // Categorize failures
            const categorizeFailure = (reason) => {
                const reasonLower = (reason || '').toLowerCase();
                if (reasonLower.includes('safety') || reasonLower.includes('adverse') || reasonLower.includes('death')) {
                    return 'safety';
                } else if (reasonLower.includes('enrollment') || reasonLower.includes('recruitment')) {
                    return 'enrollment';
                } else if (reasonLower.includes('funding') || reasonLower.includes('financial')) {
                    return 'funding';
                } else if (reasonLower.includes('business')) {
                    return 'business';
                } else {
                    return 'other';
                }
            };
            
            const failureCategories = {
                safety: 0,
                enrollment: 0,
                funding: 0,
                business: 0,
                other: 0
            };
            
            failed.forEach(trial => {
                const category = categorizeFailure(trial.why_stopped);
                failureCategories[category]++;
            });
            
            // Update metrics
            document.getElementById('totalFailedCount').textContent = failed.length;
            document.getElementById('safetyFailureCount').textContent = failureCategories.safety;
            document.getElementById('enrollmentFailureCount').textContent = failureCategories.enrollment;
            document.getElementById('businessFailureCount').textContent = failureCategories.business;
            
            // Safety alert for failed drugs
            const safetyFailures = failed.filter(t => categorizeFailure(t.why_stopped) === 'safety');
            if (safetyFailures.length > 0) {
                const alertHtml = `
                    <div>
                        <h3 class="text-sm font-semibold text-red-900">Regulatory Alert: Safety-Related Terminations</h3>
                        ${safetyFailures.slice(0, 2).map(trial => `
                            <p class="text-sm text-red-700 mt-2">
                                <strong>${trial.nct_id}</strong> (${trial.drug_name}) - 
                                ${trial.phase} terminated: "${trial.why_stopped}"
                            </p>
                        `).join('')}
                    </div>
                `;
                document.getElementById('safetyAlertContent').innerHTML = alertHtml;
            }
            
            // Failure reasons chart
            const failureCtx = document.getElementById('failureReasonsChart');
            if (failureCtx && failed.length > 0) {
                allCharts.failureReasons = new Chart(failureCtx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: ['Safety', 'Enrollment', 'Funding', 'Business', 'Other'],
                        datasets: [{
                            data: Object.values(failureCategories),
                            backgroundColor: ['#ef4444', '#3b82f6', '#f59e0b', '#a855f7', '#9ca3af']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 10,
                                    font: { size: 11 }
                                }
                            }
                        }
                    }
                });
            }
            
            // Failed phase chart
            const failedPhaseCtx = document.getElementById('failedPhaseChart');
            if (failedPhaseCtx && failed.length > 0) {
                const phaseCounts = {
                    'Phase 1': failed.filter(t => t.phase?.includes('1')).length,
                    'Phase 2': failed.filter(t => t.phase?.includes('2')).length,
                    'Phase 3': failed.filter(t => t.phase?.includes('3')).length,
                    'Phase 4': failed.filter(t => t.phase?.includes('4')).length,
                    'N/A': failed.filter(t => !t.phase || t.phase === 'Unknown').length
                };
                
                allCharts.failedPhase = new Chart(failedPhaseCtx.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: Object.keys(phaseCounts),
                        datasets: [{
                            label: 'Failed Trials',
                            data: Object.values(phaseCounts),
                            backgroundColor: '#ef4444'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { stepSize: 1 }
                            }
                        }
                    }
                });
            }
            
            // Sponsor risk analysis
            const sponsorCounts = {};
            failed.forEach(trial => {
                const sponsor = trial.sponsor || 'Unknown';
                sponsorCounts[sponsor] = (sponsorCounts[sponsor] || 0) + 1;
            });
            
            const topSponsors = Object.entries(sponsorCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            const sponsorHtml = topSponsors.map(([sponsor, count]) => `
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span class="text-sm font-medium">${sponsor}</span>
                    <div class="flex items-center space-x-2">
                        <span class="text-xs text-gray-600">${count} failures</span>
                        <span class="risk-indicator risk-${count > 2 ? 'high' : count > 1 ? 'medium' : 'low'}">
                            ${count > 2 ? 'HIGH' : count > 1 ? 'MEDIUM' : 'LOW'}
                        </span>
                    </div>
                </div>
            `).join('');
            
            document.getElementById('sponsorRiskAnalysis').innerHTML = sponsorHtml || '<p class="text-gray-500 text-sm">No sponsor data available</p>';
            
            // Failed drugs table
            const failedHtml = failed.length > 0 ? `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>NCT ID</th>
                            <th>Drug/Study</th>
                            <th>Phase</th>
                            <th>Status</th>
                            <th>Sponsor</th>
                            <th>Reason for Termination</th>
                            <th>Risk</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${failed.map(trial => {
                            const category = categorizeFailure(trial.why_stopped);
                            const categoryClass = `failure-category-${category}`;
                            const risk = category === 'safety' ? 'high' : 
                                        category === 'enrollment' ? 'medium' : 'low';
                            
                            return `
                                <tr>
                                    <td>
                                        <span class="px-2 py-1 text-xs font-medium ${categoryClass} rounded">
                                            ${category.charAt(0).toUpperCase() + category.slice(1)}
                                        </span>
                                    </td>
                                    <td>
                                        <a href="https://clinicaltrials.gov/study/${trial.nct_id}" 
                                           target="_blank" 
                                           class="text-blue-600 hover:underline font-medium">
                                            ${trial.nct_id}
                                        </a>
                                    </td>
                                    <td class="max-w-xs truncate" title="${trial.drug_name}">
                                        ${trial.drug_name}
                                    </td>
                                    <td>
                                        <span class="badge badge-info">${trial.phase || 'N/A'}</span>
                                    </td>
                                    <td>
                                        <span class="badge badge-danger">${trial.status}</span>
                                    </td>
                                    <td>${trial.sponsor}</td>
                                    <td class="max-w-md">
                                        <span class="${category === 'safety' ? 'text-red-600 font-medium' : ''}">
                                            ${trial.why_stopped || 'Not specified'}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="risk-indicator risk-${risk}">${risk.toUpperCase()}</span>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            ` : '<p class="text-gray-500">No failed/withdrawn trials found</p>';
            
            document.getElementById('failedDrugsTable').innerHTML = failedHtml;
        }

        function switchTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.add('hidden');
            });
            
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab content
            document.getElementById(`content-${tabName}`).classList.remove('hidden');
            
            // Add active class to selected tab
            document.getElementById(`tab-${tabName}`).classList.add('active');
        }

        function filterTrials() {
            // Implementation for filtering trials by phase
            const filter = document.getElementById('trialPhaseFilter').value;
            // Re-display trials based on filter
            displayClinicalTrials();
        }

        function getStatusBadgeClass(status) {
            const statusMap = {
                'RECRUITING': 'success',
                'ACTIVE_NOT_RECRUITING': 'info',
                'COMPLETED': 'warning',
                'TERMINATED': 'danger',
                'WITHDRAWN': 'danger',
                'SUSPENDED': 'warning',
                'ENROLLING_BY_INVITATION': 'info'
            };
            return statusMap[status] || 'info';
        }

        function clearSearch() {
            document.getElementById('searchInput').value = '';
            currentResults = null;
            // Clear all charts
            Object.values(allCharts).forEach(chart => {
                if (chart) chart.destroy();
            });
            allCharts = {};
            showState('');
        }

        function exportReport() {
            if (!currentResults) {
                alert('No data to export. Please perform a search first.');
                return;
            }
            
            // Create comprehensive report
            const report = {
                metadata: {
                    condition: currentResults.condition,
                    generated: new Date().toISOString(),
                    version: '2.0',
                    sources: Object.keys(currentResults.sources).length
                },
                executive_summary: currentResults.summary,
                regulatory_data: {
                    fda_drugs: {
                        count: currentResults.sources.fda_drugs.count,
                        drugs: currentResults.sources.fda_drugs.data.slice(0, 20)
                    },
                    clinical_trials: {
                        total: currentResults.sources.clinical_trials.count,
                        active: currentResults.summary.active_trials,
                        data: currentResults.sources.clinical_trials.data.slice(0, 20)
                    },
                    failed_withdrawn: {
                        total: currentResults.sources.failed_drugs.count,
                        safety_concerns: currentResults.sources.failed_drugs.data.filter(d => 
                            d.why_stopped?.toLowerCase().includes('safety')).length,
                        data: currentResults.sources.failed_drugs.data
                    }
                },
                safety_profile: {
                    adverse_events: currentResults.sources.adverse_events.data,
                    drug_interactions: currentResults.sources.drug_interactions.data
                },
                chemistry: {
                    compounds: currentResults.sources.pubchem_compounds.data,
                    rxnorm: currentResults.sources.rxnorm_drugs.data
                },
                literature: {
                    total_articles: currentResults.sources.pubmed_articles.count,
                    recent_articles: currentResults.sources.pubmed_articles.data
                }
            };
            
            // Download as JSON
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `regulatory-report-${currentResults.condition}-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Show success message
            const successDiv = document.createElement('div');
            successDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50';
            successDiv.innerHTML = 'Report exported successfully!';
            document.body.appendChild(successDiv);
            setTimeout(() => successDiv.remove(), 3000);
        }

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('searchInput').focus();
            
            // Add keyboard shortcuts
            document.addEventListener('keydown', function(e) {
                // Ctrl/Cmd + K to focus search
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                    e.preventDefault();
                    document.getElementById('searchInput').focus();
                }
                
                // Ctrl/Cmd + E to export
                if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                    e.preventDefault();
                    exportReport();
                }
            });
        });


        window.quickSearch = quickSearch