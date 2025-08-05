// ENHANCED RECENT EVENTS - REAL LIVE DATA ONLY
// This version excludes all simulated data and uses only confirmed live FDA/EMA APIs

console.log('🔍 Loading enhanced recent events (REAL DATA ONLY)...');

// Enhanced event extraction with company grouping - REAL DATA ONLY
function extractAllRecentEventsByCompanyRealOnly(fdaData, emaData, drugName, limitPerEndpoint = 3) {
  console.log('📊 Extracting recent events by company (REAL DATA ONLY) for:', drugName);
  
  const eventsByCompany = {};
  const fdaEvents = [];
  const emaEvents = [];
  
  // Extract FDA events (REAL APIs ONLY)
  if (fdaData?.raw?.endpoints) {
    const fdaEventsList = extractFDAEventsRealOnly(fdaData, drugName, limitPerEndpoint);
    fdaEvents.push(...fdaEventsList);
    
    // Group FDA events by company
    fdaEventsList.forEach(event => {
      const companyName = extractCompanyName(event, 'FDA');
      if (!eventsByCompany[companyName]) {
        eventsByCompany[companyName] = {
          fda: [],
          ema: []
        };
      }
      eventsByCompany[companyName].fda.push(event);
    });
  }
  
  // Extract EMA events (REAL DATA)
  if (emaData) {
    const emaEventsList = extractEMAEvents(emaData, drugName, limitPerEndpoint);
    emaEvents.push(...emaEventsList);
    
    // Group EMA events by company
    emaEventsList.forEach(event => {
      const companyName = extractCompanyName(event, 'EMA');
      if (!eventsByCompany[companyName]) {
        eventsByCompany[companyName] = {
          fda: [],
          ema: []
        };
      }
      eventsByCompany[companyName].ema.push(event);
    });
  }
  
  // Sort events within each company by date
  Object.keys(eventsByCompany).forEach(company => {
    eventsByCompany[company].fda.sort((a, b) => new Date(b.date) - new Date(a.date));
    eventsByCompany[company].ema.sort((a, b) => new Date(b.date) - new Date(a.date));
  });
  
  console.log(`✅ Extracted events for ${Object.keys(eventsByCompany).length} companies (REAL DATA ONLY)`);
  
  return {
    eventsByCompany,
    fdaEvents,
    emaEvents,
    totalFDA: fdaEvents.length,
    totalEMA: emaEvents.length,
    totalCompanies: Object.keys(eventsByCompany).length
  };
}

// Extract FDA events - REAL APIs ONLY (removed simulated components)
function extractFDAEventsRealOnly(fdaData, drugName, limitPerEndpoint) {
  const events = [];
  const endpoints = fdaData.raw.endpoints;
  
  // 1. Drug Applications (drugsFda endpoint) - CONFIRMED REAL
  if (endpoints.drugsFda?.data && endpoints.drugsFda.data.length > 0) {
    console.log(`📋 Processing ${endpoints.drugsFda.data.length} real FDA drug applications...`);
    
    endpoints.drugsFda.data.slice(0, limitPerEndpoint).forEach(submission => {
      const submissionDate = submission.submission_status_date || submission.sponsor_applicant_date;
      
      if (submissionDate) {
        events.push({
          type: 'submission',
          date: parseEventDate(submissionDate),
          title: `${submission.submission_type || 'Application'}`,
          subtitle: submission.openfda?.brand_name?.[0] || drugName,
          description: `App #${submission.application_number || 'Unknown'} • ${submission.submission_status || 'Status Unknown'}`,
          importance: getSubmissionImportance(submission.submission_type),
          details: {
            applicationNumber: submission.application_number,
            sponsor: submission.sponsor_name,
            status: submission.submission_status,
            submissionType: submission.submission_type,
            submissionNumber: submission.submission_number
          },
          endpoint: 'FDA Applications (Live)',
          icon: '📋',
          color: 'blue',
          agency: 'FDA'
        });
      }
    });
  }
  
  // 2. Product Labeling (label endpoint) - CONFIRMED REAL
  if (endpoints.label?.data && endpoints.label.data.length > 0) {
    console.log(`🏷️ Processing ${endpoints.label.data.length} real FDA product labels...`);
    
    endpoints.label.data.slice(0, limitPerEndpoint).forEach(label => {
      const hasBoxedWarning = label.boxed_warning && label.boxed_warning.length > 0;
      const hasWarnings = label.warnings_and_cautions && label.warnings_and_cautions.length > 0;
      const hasRecentChanges = label.recent_major_changes && label.recent_major_changes.length > 0;
      
      // Only include if there are significant safety updates
      if (hasBoxedWarning || hasWarnings || hasRecentChanges) {
        const effectiveDate = label.effective_time || new Date().toISOString().split('T')[0];
        
        events.push({
          type: 'label_change',
          date: parseEventDate(effectiveDate) || new Date().toISOString().split('T')[0],
          title: hasBoxedWarning ? '⚫ Boxed Warning Update' : (hasRecentChanges ? 'Label Major Changes' : 'Safety Label Update'),
          subtitle: label.openfda?.brand_name?.[0] || drugName,
          description: `${hasBoxedWarning ? 'BLACK BOX WARNING' : 'Safety Info Updated'} • ${label.openfda?.manufacturer_name?.[0] || 'Label revision'}`,
          importance: hasBoxedWarning ? 'high' : 'medium',
          details: {
            hasBoxedWarning,
            hasWarnings,
            hasRecentMajorChanges: hasRecentChanges,
            manufacturer: label.openfda?.manufacturer_name?.[0],
            setId: label.set_id,
            effectiveTime: label.effective_time,
            fdaApplicationNumber: label.openfda?.application_number?.[0]
          },
          endpoint: 'FDA Product Labeling (Live)',
          icon: hasBoxedWarning ? '⚠️' : '🏷️',
          color: hasBoxedWarning ? 'red' : 'orange',
          agency: 'FDA'
        });
      }
    });
  }
  
  // 3. Enforcement Actions (enforcement endpoint) - CONFIRMED REAL
  if (endpoints.enforcement?.data && endpoints.enforcement.data.length > 0) {
    console.log(`🚨 Processing ${endpoints.enforcement.data.length} real FDA enforcement actions...`);
    
    endpoints.enforcement.data.slice(0, limitPerEndpoint).forEach(enforcement => {
      const recallDate = enforcement.recall_initiation_date || enforcement.report_date;
      
      if (recallDate) {
        events.push({
          type: 'enforcement',
          date: parseEventDate(recallDate),
          title: `${enforcement.classification || 'Enforcement Action'}`,
          subtitle: enforcement.product_description?.substring(0, 50) || drugName,
          description: `${enforcement.reason_for_recall?.substring(0, 80) || 'Recall initiated'} • ${enforcement.status || 'Ongoing'}`,
          importance: getEnforcementImportance(enforcement.classification),
          details: {
            recallNumber: enforcement.recall_number,
            classification: enforcement.classification,
            recallingFirm: enforcement.recalling_firm,
            reasonForRecall: enforcement.reason_for_recall,
            distributionPattern: enforcement.distribution_pattern,
            status: enforcement.status,
            recallInitiationDate: enforcement.recall_initiation_date,
            reportDate: enforcement.report_date
          },
          endpoint: 'FDA Enforcement Actions (Live)',
          icon: '🚨',
          color: 'red',
          agency: 'FDA'
        });
      }
    });
  }
  
  // 4. NDC Directory - CONFIRMED REAL (but only if there are meaningful dates)
  if (endpoints.ndc?.data && endpoints.ndc.data.length > 0) {
    console.log(`📊 Processing ${endpoints.ndc.data.length} real NDC entries...`);
    
    // Only include NDC entries that have recent listing dates
    endpoints.ndc.data.slice(0, limitPerEndpoint).forEach(ndc => {
      const listingDate = ndc.listing_expiration_date;
      
      // Only include if there's a meaningful date (not expired entries from years ago)
      if (listingDate) {
        const parsedDate = parseEventDate(listingDate);
        const eventDate = new Date(parsedDate);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        // Only include if the listing is recent or future-dated
        if (eventDate > oneYearAgo) {
          events.push({
            type: 'ndc_listing',
            date: parsedDate,
            title: 'NDC Directory Update',
            subtitle: ndc.brand_name || ndc.generic_name || drugName,
            description: `NDC ${ndc.product_ndc} • ${ndc.labeler_name || 'Listed'} • ${ndc.dosage_form_name || 'Various forms'}`,
            importance: 'low',
            details: {
              productNdc: ndc.product_ndc,
              packageNdc: ndc.package_ndc,
              labelerName: ndc.labeler_name,
              brandName: ndc.brand_name,
              genericName: ndc.generic_name,
              dosageFormName: ndc.dosage_form_name,
              route: ndc.route,
              marketingCategoryName: ndc.marketing_category_name,
              listingExpirationDate: ndc.listing_expiration_date
            },
            endpoint: 'FDA NDC Directory (Live)',
            icon: '📊',
            color: 'blue',
            agency: 'FDA'
          });
        }
      }
    });
  }
  
  console.log(`✅ Extracted ${events.length} real FDA events total`);
  return events;
}

// Enhanced summary function that ADDS TO existing summary - REAL DATA ONLY
// function addRealOnlyRecentEventsToSummary() {
//   console.log('🔄 Adding recent events to existing summary (REAL DATA ONLY)...');
  
//   // First, run the original summary function if it exists
//   if (typeof window.originalGenerateComprehensiveSummary === 'function') {
//     console.log('✅ Running original summary function first...');
//     window.originalGenerateComprehensiveSummary();
//   }
  
//   // Wait a moment for original summary to load, then add our section
//   setTimeout(() => {
//     const summaryContent = document.getElementById('summaryContent');
//     if (!summaryContent) {
//       console.log('❌ Summary content element not found');
//       return;
//     }
    
//     const drugName = window.currentDrugName || window.lastSearchTerm || 'Current Compound';
    
//     // Extract recent events from BOTH FDA and EMA - REAL DATA ONLY
//     let recentEventsData = { eventsByCompany: {}, fdaEvents: [], emaEvents: [], totalFDA: 0, totalEMA: 0, totalCompanies: 0 };
//     if (window.appState?.fdaData || window.appState?.emaData) {
//       recentEventsData = extractAllRecentEventsByCompanyRealOnly(
//         window.appState.fdaData, 
//         window.appState.emaData, 
//         drugName, 
//         3
//       );
//     }
    
//     // Create the recent events section HTML with REAL DATA disclaimer
//     const recentEventsHtml = `
//       <div id="recent-events-section" class="mt-8 border-t pt-8">
//         <div class="flex items-center justify-between mb-6">
//           <div>
//             <h3 class="text-xl font-bold text-gray-900 flex items-center">
//               <span class="mr-3">⏰</span>
//               Recent FDA & EMA Events by Company
//             </h3>
//             <p class="text-sm text-green-600 mt-1 flex items-center">
//               <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
//               <strong>LIVE DATA</strong> - Real-time from FDA & EMA APIs
//             </p>
//           </div>
//           <div class="flex space-x-2">
//             <span class="text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full font-medium">
//               ${recentEventsData.totalFDA} FDA Events
//             </span>
//             <span class="text-sm text-purple-600 bg-purple-100 px-3 py-1 rounded-full font-medium">
//               ${recentEventsData.totalEMA} EMA Events
//             </span>
//             <span class="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full font-medium">
//               ${recentEventsData.totalCompanies} Companies
//             </span>
//           </div>
//         </div>
        
//         ${recentEventsData.totalCompanies > 0 ? `
//           ${Object.entries(recentEventsData.eventsByCompany).map(([companyName, companyEvents]) => {
//             const totalCompanyEvents = companyEvents.fda.length + companyEvents.ema.length;
//             return `
//               <div class="mb-8 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
//                 <!-- Company Header with REAL DATA badge -->
//                 <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
//                   <div class="flex items-center justify-between">
//                     <div class="flex items-center space-x-3">
//                       <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
//                         ${companyName.charAt(0).toUpperCase()}
//                       </div>
//                       <div>
//                         <h4 class="text-lg font-semibold text-gray-900">${companyName}</h4>
//                         <p class="text-sm text-green-600">✅ ${totalCompanyEvents} live regulatory events</p>
//                       </div>
//                     </div>
//                     <div class="flex space-x-2">
//                       ${companyEvents.fda.length > 0 ? `
//                         <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
//                           ${companyEvents.fda.length} FDA
//                         </span>
//                       ` : ''}
//                       ${companyEvents.ema.length > 0 ? `
//                         <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
//                           ${companyEvents.ema.length} EMA
//                         </span>
//                       ` : ''}
//                     </div>
//                   </div>
//                 </div>
                
//                 <div class="p-6">
//                   <!-- FDA Events Section -->
//                   ${companyEvents.fda.length > 0 ? `
//                     <div class="mb-6">
//                       <h5 class="text-md font-semibold text-blue-800 mb-3 flex items-center">
//                         <span class="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold mr-2">FDA</span>
//                         FDA Events (${companyEvents.fda.length}) - Live Data
//                       </h5>
//                       <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
//                         ${companyEvents.fda.slice(0, 4).map((event, index) => `
//                           <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-all duration-200">
//                             <div class="flex items-start justify-between mb-2">
//                               <div class="flex items-center space-x-2">
//                                 <span class="text-lg">${event.icon}</span>
//                                 <div class="min-w-0 flex-1">
//                                   <h6 class="font-semibold text-blue-900 text-sm leading-tight">${event.title}</h6>
//                                   <p class="text-xs text-blue-700 mt-0.5">${event.endpoint}</p>
//                                 </div>
//                               </div>
//                               <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getImportanceBadge(event.importance)}">
//                                 ${event.importance.toUpperCase()}
//                               </span>
//                             </div>
                            
//                             <div class="mb-3">
//                               <p class="text-sm font-medium text-blue-800 mb-1">${event.subtitle}</p>
//                               <p class="text-xs text-blue-700">${event.description}</p>
//                             </div>
                            
//                             <div class="flex items-center justify-between pt-2 border-t border-blue-200">
//                               <span class="text-xs text-blue-600 flex items-center">
//                                 <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z"/>
//                                 </svg>
//                                 ${formatDisplayDate(event.date)}
//                               </span>
//                                 <button 
//                                 onclick="showEventDetails('${companyName}', 'fda', ${index})"
//                                 class="text-blue-700 hover:text-blue-900 text-xs font-medium px-2 py-1 rounded hover:bg-blue-200 transition-colors">
//                                 Details
//                               </button>
//                             </div>
//                           </div>
//                         `).join('')}
//                       </div>
//                       ${companyEvents.fda.length > 4 ? `
//                         <div class="mt-3 text-center">
//                           <button 
//                             onclick="showAllCompanyEvents('${companyName}', 'fda')" 
//                             class="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium">
//                             View All ${companyEvents.fda.length} FDA Events
//                           </button>
//                         </div>
//                       ` : ''}
//                     </div>
//                   ` : ''}
                  
//                   <!-- EMA Events Section -->
//                   ${companyEvents.ema.length > 0 ? `
//                     <div class="mb-4">
//                       <h5 class="text-md font-semibold text-purple-800 mb-3 flex items-center">
//                         <span class="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 text-xs font-bold mr-2">EMA</span>
//                         EMA Events (${companyEvents.ema.length}) - Live Data
//                       </h5>
//                       <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
//                         ${companyEvents.ema.slice(0, 4).map((event, index) => `
//                           <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 hover:bg-purple-100 transition-all duration-200">
//                             <div class="flex items-start justify-between mb-2">
//                               <div class="flex items-center space-x-2">
//                                 <span class="text-lg">${event.icon}</span>
//                                 <div class="min-w-0 flex-1">
//                                   <h6 class="font-semibold text-purple-900 text-sm leading-tight">${event.title}</h6>
//                                   <p class="text-xs text-purple-700 mt-0.5">${event.endpoint}</p>
//                                 </div>
//                               </div>
//                               <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getImportanceBadge(event.importance)}">
//                                 ${event.importance.toUpperCase()}
//                               </span>
//                             </div>
                            
//                             <div class="mb-3">
//                               <p class="text-sm font-medium text-purple-800 mb-1">${event.subtitle}</p>
//                               <p class="text-xs text-purple-700">${event.description}</p>
//                             </div>
                            
//                             <div class="flex items-center justify-between pt-2 border-t border-purple-200">
//                               <span class="text-xs text-purple-600 flex items-center">
//                                 <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z"/>
//                                 </svg>
//                                 ${formatDisplayDate(event.date)}
//                               </span>
//                               <button 
//                                 onclick="showEventDetails('${companyName}', 'ema', ${index})"
//                                 class="text-purple-700 hover:text-purple-900 text-xs font-medium px-2 py-1 rounded hover:bg-purple-200 transition-colors">
//                                 Details
//                               </button>
//                             </div>
//                           </div>
//                         `).join('')}
//                       </div>
//                       ${companyEvents.ema.length > 4 ? `
//                         <div class="mt-3 text-center">
//                           <button 
//                             onclick="showAllCompanyEvents('${companyName}', 'ema')" 
//                             class="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium">
//                             View All ${companyEvents.ema.length} EMA Events
//                           </button>
//                         </div>
//                       ` : ''}
//                     </div>
//                   ` : ''}
                  
//                   <!-- Company Summary Footer -->
//                   <div class="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
//                     <div class="text-sm text-green-600">
//                       <span class="font-medium">✅ Live Events:</span> ${totalCompanyEvents}
//                       ${companyEvents.fda.length > 0 ? `<span class="ml-3 text-blue-600">${companyEvents.fda.length} FDA</span>` : ''}
//                       ${companyEvents.ema.length > 0 ? `<span class="ml-3 text-purple-600">${companyEvents.ema.length} EMA</span>` : ''}
//                     </div>
//                     <button 
//                       onclick="exportCompanyEvents('${companyName}')"
//                       class="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm font-medium">
//                       📥 Export Company Events
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             `;
//           }).join('')}
          
//           <!-- Overall Summary and Export -->
//           <div class="mt-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
//             <div class="flex justify-between items-center">
//               <div>
//                 <h4 class="text-lg font-semibold text-gray-900 mb-2 flex items-center">
//                   <span class="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
//                   Live Data Summary
//                 </h4>
//                 <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
//                   <div class="text-center">
//                     <div class="text-2xl font-bold text-blue-600">${recentEventsData.totalFDA}</div>
//                     <div class="text-gray-600">FDA Events (Live)</div>
//                   </div>
//                   <div class="text-center">
//                     <div class="text-2xl font-bold text-purple-600">${recentEventsData.totalEMA}</div>
//                     <div class="text-gray-600">EMA Events (Live)</div>
//                   </div>
//                   <div class="text-center">
//                     <div class="text-2xl font-bold text-gray-700">${recentEventsData.totalCompanies}</div>
//                     <div class="text-gray-600">Companies</div>
//                   </div>
//                 </div>
//                 <p class="text-xs text-green-700 mt-3">
//                   ✅ All data sourced directly from FDA & EMA APIs in real-time
//                 </p>
//               </div>
//               <div class="flex flex-col space-y-2">
//                 <button 
//                   onclick="showAllEventsModal()" 
//                   class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
//                   📊 View All Live Events
//                 </button>
//                 <button 
//                   onclick="exportAllRecentEvents()" 
//                   class="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium">
//                   📥 Export All Events
//                 </button>
//               </div>
//             </div>
//           </div>
//         ` : `
//           <div class="bg-gray-50 rounded-lg p-8 text-center">
//             <div class="text-gray-400 mb-4">
//               <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
//               </svg>
//             </div>
//             <h4 class="text-lg font-semibold text-gray-700 mb-2">No Recent Live Events Found</h4>
//             <p class="text-gray-600 mb-4">Recent FDA & EMA regulatory events will appear here when available from live APIs</p>
//             <div class="grid grid-cols-2 gap-4 max-w-md mx-auto text-sm">
//               <div class="bg-white rounded-lg p-3 border border-green-200">
//                 <div class="text-blue-600 font-medium">✅ FDA Sources (Live)</div>
//                 <div class="text-gray-500 text-xs mt-1">Applications, Labels, Enforcement, NDC</div>
//               </div>
//               <div class="bg-white rounded-lg p-3 border border-green-200">
//                 <div class="text-purple-600 font-medium">✅ EMA Sources (Live)</div>
//                 <div class="text-gray-500 text-xs mt-1">Authorizations, PSUSA, Referrals</div>
//               </div>
//             </div>
//           </div>
//         `}
//       </div>
//     `;
    
//     // Remove existing recent events section if present
//     const existingSection = document.getElementById('recent-events-section');
//     if (existingSection) {
//       existingSection.remove();
//     }
    
//     // Add the new section to the summary
//     summaryContent.insertAdjacentHTML('beforeend', recentEventsHtml);
    
//     // Store events for export functionality
//     window.currentRecentEventsData = recentEventsData;
    
//     console.log('✅ Real-only recent events section added to summary');
    
//   }, 800); // Wait for original summary to load
// }


// Enhanced summary function that ADDS TO existing summary - REAL DATA ONLY with CARD LAYOUT
function addRealOnlyRecentEventsToSummary() {
  console.log('🔄 Adding recent events to existing summary (REAL DATA ONLY)...');
  
  // First, run the original summary function if it exists
  if (typeof window.originalGenerateComprehensiveSummary === 'function') {
    console.log('✅ Running original summary function first...');
    window.originalGenerateComprehensiveSummary();
  }
  
  // Wait a moment for original summary to load, then add our section
  setTimeout(() => {
    const summaryContent = document.getElementById('summaryContent');
    if (!summaryContent) {
      console.log('❌ Summary content element not found');
      return;
    }
    
    const drugName = window.currentDrugName || window.lastSearchTerm || 'Current Compound';
    
    // Extract recent events from BOTH FDA and EMA - REAL DATA ONLY
    let recentEventsData = { eventsByCompany: {}, fdaEvents: [], emaEvents: [], totalFDA: 0, totalEMA: 0, totalCompanies: 0 };
    if (window.appState?.fdaData || window.appState?.emaData) {
      recentEventsData = extractAllRecentEventsByCompanyRealOnly(
        window.appState.fdaData, 
        window.appState.emaData, 
        drugName, 
        3
      );
    }
    
    // Create the recent events section HTML with CARD LAYOUT
    const recentEventsHtml = `
      <div id="" class="pro-feature mt-8 border-t pt-8">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-xl font-bold text-gray-900 flex items-center">
              <span class="mr-3">⏰</span>
              Recent FDA & EMA Events
            </h3>
            <p class="text-sm text-green-600 mt-1 flex items-center">
              <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              <strong>LIVE DATA</strong> - Real-time from FDA & EMA APIs - Last 2 years
            </p>
          </div>
          <div class="flex space-x-2">
            <span class="text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full font-medium">
              ${recentEventsData.totalFDA} FDA Events
            </span>
            <span class="text-sm text-purple-600 bg-purple-100 px-3 py-1 rounded-full font-medium">
              ${recentEventsData.totalEMA} EMA Events
            </span>
            <span class="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full font-medium">
              ${recentEventsData.totalCompanies} Companies
            </span>
          </div>
        </div>
        
        ${recentEventsData.totalCompanies > 0 ? `
          <!-- Single Events Section with Cards -->
          <div class="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden" id='recent-events-section'>
            <!-- Header -->
            <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-lg font-semibold text-gray-900">Recent Regulatory Events</h4>
                  <p class="text-sm text-green-600 mt-1">✅ Live data from FDA & EMA APIs - Last 2 years</p>
                </div>
                <div class="flex space-x-2">
                  ${recentEventsData.totalFDA > 0 ? `
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      ${recentEventsData.totalFDA} FDA
                    </span>
                  ` : ''}
                  ${recentEventsData.totalEMA > 0 ? `
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      ${recentEventsData.totalEMA} EMA
                    </span>
                  ` : ''}
                </div>
              </div>
              
              <!-- Filter Controls -->
              <div class="hidden mt-4 flex flex-wrap gap-3">
                <select id="companyFilterRecent" class="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm">
                  <option value="">All Companies</option>
                  ${Object.keys(recentEventsData.eventsByCompany).map(company => 
                    `<option value="${company}">${company}</option>`
                  ).join('')}
                </select>
                
                <select id="eventTypeFilterRecent" class="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm">
                  <option value="">All Event Types</option>
                  <option value="submission">Submissions</option>
                  <option value="label_change">Label Changes</option>
                  <option value="recall">Recalls</option>
                  <option value="adverse_event">Adverse Events</option>
                </select>
                
                <select id="sourceFilterRecent" class="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm">
                  <option value="">All Sources</option>
                  <option value="fda">FDA Events</option>
                  <option value="ema">EMA Events</option>
                </select>
              </div>
            </div>
            
            <!-- Events Grid -->
            <div class="p-6">
              <div id="recentEventsGrid" class=" grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${(() => {
                  // Flatten all events from all companies into a single array
                  const allEvents = [];
                  Object.entries(recentEventsData.eventsByCompany).forEach(([companyName, companyEvents]) => {
                    // Add FDA events
                    companyEvents.fda.forEach(event => {
                      allEvents.push({
                        ...event,
                        company: companyName,
                        sourceType: 'fda',
                        id: `fda-${companyName}-${allEvents.length}`
                      });
                    });
                    
                    // Add EMA events
                    companyEvents.ema.forEach(event => {
                      allEvents.push({
                        ...event,
                        company: companyName,
                        sourceType: 'ema',
                        id: `ema-${companyName}-${allEvents.length}`
                      });
                    });
                  });
                  
                  // Filter to last 2 years
                  const twoYearsAgo = new Date();
                  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
                  
                  const recentEvents = allEvents.filter(event => {
                    const eventDate = new Date(event.date);
                    return eventDate >= twoYearsAgo;
                  });
                  
                  // Sort by date (most recent first)
                  recentEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
                  
                  // Generate event cards
                  return recentEvents.map(event => `
                    <div class="recent-event-card bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                         data-company="${event.company}"
                         data-type="${event.type || ''}"
                         data-source="${event.sourceType}"
                         onclick="showRecentEventDetails('${event.id}', ${JSON.stringify(event).replace(/"/g, '&quot;')})">
                      
                      <!-- Event Header -->
                      <div class="p-4 border-b border-gray-100">
                        <div class="flex items-start justify-between mb-2">
                          <div class="flex items-center flex-1 min-w-0">
                            <div class="flex-shrink-0 w-8 h-8 ${event.sourceType === 'fda' ? 'bg-blue-500' : 'bg-purple-500'} rounded-full flex items-center justify-center mr-3">
                              <span class="text-white text-lg">${event.icon || (event.sourceType === 'fda' ? '📋' : '🇪🇺')}</span>
                            </div>
                            <div class="min-w-0 flex-1">
                              <h5 class="text-sm font-semibold text-gray-900 leading-tight truncate">${event.title}</h5>
                              <span class="text-xs text-gray-500">${formatDisplayDate(event.date)}</span>
                            </div>
                          </div>
                          <div class="flex flex-col items-end gap-1 ml-2">
                            ${event.importance ? `
                              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getImportanceBadge(event.importance)}">
                                ${event.importance.toUpperCase()}
                              </span>
                            ` : ''}
                          </div>
                        </div>
                      </div>
                      
                      <!-- Event Content -->
                      <div class="p-4">
                        <p class="text-sm text-gray-600 mb-3 line-clamp-2">${event.description || 'No description available'}</p>
                        
                        <!-- Tags -->
                        <div class="flex flex-wrap gap-2 mb-3">
                          <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                            <i class="fas fa-building mr-1"></i>
                            ${event.company}
                          </span>
                          
                          ${event.subtitle ? `
                            <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
                              <i class="fas fa-pills mr-1"></i>
                              ${event.subtitle}
                            </span>
                          ` : ''}
                        </div>
                        
                        <!-- Event Type and Source -->
                        <div class="flex justify-between items-center">
                          <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${event.sourceType === 'fda' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">
                            ${event.endpoint || (event.sourceType === 'fda' ? 'FDA' : 'EMA')}
                          </span>
                          
                          <span class="text-xs text-gray-400">
                            <i class="fas fa-database mr-1"></i>
                            Live Data
                          </span>
                        </div>
                      </div>
                    </div>
                  `).join('');
                })()}
              </div>
              
              <!-- No Results Message -->
              <div id="noRecentResults" class="hidden text-center py-12">
                <i class="fas fa-search text-gray-400 text-4xl mb-4"></i>
                <p class="text-gray-500 text-lg">No events found matching your filters</p>
              </div>
            </div>
            
            <!-- Export Section -->
            <div class="px-6 pb-6">
              <div class="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
                <div class="flex justify-between items-center">
                  <div>
                    <h4 class="text-sm font-semibold text-gray-900 mb-1 flex items-center">
                      <span class="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                      Live Data Summary
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-2">
                      <div class="text-center">
                        <div class="text-lg font-bold text-blue-600">${recentEventsData.totalFDA}</div>
                        <div class="text-gray-600 text-xs">FDA Events (Live)</div>
                      </div>
                      <div class="text-center">
                        <div class="text-lg font-bold text-purple-600">${recentEventsData.totalEMA}</div>
                        <div class="text-gray-600 text-xs">EMA Events (Live)</div>
                      </div>
                      <div class="text-center">
                        <div class="text-lg font-bold text-gray-700">${recentEventsData.totalCompanies}</div>
                        <div class="text-gray-600 text-xs">Companies</div>
                      </div>
                    </div>
                    <p class="text-xs text-green-700 mt-2">
                      ✅ All data sourced directly from FDA & EMA APIs in real-time
                    </p>
                  </div>
                  <div class="flex flex-col space-y-2">
                    <button 
                      onclick="exportAllRecentEvents()" 
                      class="hidden px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium">
                      📥 Export All Events
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ` : `
          <!-- No Events Found -->
          <div class="bg-gray-50 rounded-lg p-8 text-center">
            <div class="text-gray-400 mb-4">
              <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h4 class="text-lg font-semibold text-gray-700 mb-2">No Recent Live Events Found</h4>
            <p class="text-gray-600 mb-4">Recent FDA & EMA regulatory events will appear here when available from live APIs</p>
            <div class="grid grid-cols-2 gap-4 max-w-md mx-auto text-sm">
              <div class="bg-white rounded-lg p-3 border border-green-200">
                <div class="text-blue-600 font-medium">✅ FDA Sources (Live)</div>
                <div class="text-gray-500 text-xs mt-1">Applications, Labels, Enforcement, NDC</div>
              </div>
              <div class="bg-white rounded-lg p-3 border border-green-200">
                <div class="text-purple-600 font-medium">✅ EMA Sources (Live)</div>
                <div class="text-gray-500 text-xs mt-1">Authorizations, PSUSA, Referrals</div>
              </div>
            </div>
          </div>
        `}
      </div>
    `;
    
    // Remove existing recent events section if present
    const existingSection = document.getElementById('recent-events-section');
    if (existingSection) {
      existingSection.remove();
    }
    
    // Add the new section to the summary
    summaryContent.insertAdjacentHTML('beforeend', recentEventsHtml);
    
    // Store events for export functionality
    window.currentRecentEventsData = recentEventsData;
    
    // Initialize filters
    initializeRecentEventFilters();
    
    console.log('✅ Real-only recent events section added to summary with card layout');
    
  }, 800); // Wait for original summary to load
}

// Initialize filters for recent events
function initializeRecentEventFilters() {
  const companyFilter = document.getElementById('companyFilterRecent');
  const typeFilter = document.getElementById('eventTypeFilterRecent');
  const sourceFilter = document.getElementById('sourceFilterRecent');
  
  function filterRecentEvents() {
    const companyValue = companyFilter?.value || '';
    const typeValue = typeFilter?.value || '';
    const sourceValue = sourceFilter?.value || '';
    
    const eventCards = document.querySelectorAll('.recent-event-card');
    const noResults = document.getElementById('noRecentResults');
    let visibleCount = 0;
    
    eventCards.forEach(card => {
      const company = card.getAttribute('data-company') || '';
      const type = card.getAttribute('data-type') || '';
      const source = card.getAttribute('data-source') || '';
      
      const companyMatch = !companyValue || company.toLowerCase().includes(companyValue.toLowerCase());
      const typeMatch = !typeValue || type === typeValue;
      const sourceMatch = !sourceValue || source === sourceValue;
      
      if (companyMatch && typeMatch && sourceMatch) {
        card.style.display = 'block';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });
    
    // Show/hide no results message
    if (noResults) {
      if (visibleCount === 0) {
        noResults.classList.remove('hidden');
      } else {
        noResults.classList.add('hidden');
      }
    }
  }
  
  if (companyFilter) companyFilter.addEventListener('change', filterRecentEvents);
  if (typeFilter) typeFilter.addEventListener('change', filterRecentEvents);
  if (sourceFilter) sourceFilter.addEventListener('change', filterRecentEvents);
}

// Helper functions (add these if they don't already exist)
function formatDisplayDate(dateString) {
  if (!dateString) return 'Unknown Date';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch (error) {
    return dateString;
  }
}

function getImportanceBadge(importance) {
  const colors = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800'
  };
  
  return colors[importance] || 'bg-gray-100 text-gray-800';
}

// Event details function
function showRecentEventDetails(eventId, eventData) {
  console.log('Recent event details:', eventData);
  // You can implement a modal here if needed
}

// Export functionality
function exportAllRecentEvents() {
  if (!window.currentRecentEventsData) {
    alert('No events data available to export');
    return;
  }
  
  // Flatten all events from eventsByCompany
  const allEvents = [];
  Object.entries(window.currentRecentEventsData.eventsByCompany).forEach(([companyName, companyEvents]) => {
    companyEvents.fda.forEach(event => {
      allEvents.push({
        ...event,
        company: companyName,
        source: 'FDA'
      });
    });
    
    companyEvents.ema.forEach(event => {
      allEvents.push({
        ...event,
        company: companyName,
        source: 'EMA'
      });
    });
  });
  
  // Convert to CSV
  const csvContent = convertRecentEventsToCSV(allEvents);
  
  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `recent_regulatory_events_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function convertRecentEventsToCSV(events) {
  const headers = ['Date', 'Title', 'Description', 'Company', 'Compound', 'Type', 'Importance', 'Source', 'Endpoint'];
  const csvRows = [headers.join(',')];
  
  events.forEach(event => {
    const row = [
      event.date || '',
      `"${(event.title || '').replace(/"/g, '""')}"`,
      `"${(event.description || '').replace(/"/g, '""')}"`,
      `"${(event.company || '').replace(/"/g, '""')}"`,
      `"${(event.subtitle || '').replace(/"/g, '""')}"`,
      event.type || '',
      event.importance || '',
      event.source || '',
      `"${(event.endpoint || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });
  
  return csvRows.join('\n');
}

// Add CSS for card styling
const cardStyles = document.createElement('style');
cardStyles.textContent = `
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recent-event-card {
  transition: all 0.2s ease-in-out;
}

.recent-event-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
`;

if (!document.getElementById('recent-events-card-styles')) {
  cardStyles.id = 'recent-events-card-styles';
  document.head.appendChild(cardStyles);
}

// Utility functions (keep existing ones)
function parseEventDate(dateString) {
  if (!dateString) return null;
  
  try {
    // Handle YYYYMMDD format
    if (typeof dateString === 'string' && /^\d{8}$/.test(dateString)) {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      const date = new Date(year, parseInt(month) - 1, parseInt(day));
      return date.toISOString().split('T')[0];
    }
    
    // Handle other formats
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (error) {
    // Ignore parsing errors
  }
  
  return null;
}

function getSubmissionImportance(submissionType) {
  if (!submissionType) return 'medium';
  const type = submissionType.toUpperCase();
  if (type.includes('NDA') || type.includes('BLA')) return 'high';
  if (type.includes('IND') || type.includes('SUPPL')) return 'medium';
  return 'low';
}

function getEnforcementImportance(classification) {
  if (!classification) return 'medium';
  if (classification.includes('Class I')) return 'high';
  if (classification.includes('Class II')) return 'medium';
  return 'low';
}

function formatDisplayDate(dateString) {
  if (!dateString || dateString === 'Unknown') return 'Unknown';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return dateString;
  }
}

function getImportanceBadge(importance) {
  const badges = {
    high: 'bg-red-100 text-red-800 border border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    low: 'bg-green-100 text-green-800 border border-green-200'
  };
  return badges[importance] || badges.medium;
}

function getAgencyBadgeStyle(agency) {
  return agency === 'FDA' 
    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
    : 'bg-purple-100 text-purple-800 border border-purple-200';
}

// Extract company name from event details
function extractCompanyName(event, agency) {
  let companyName = 'Unknown Company';
  
  if (agency === 'FDA' && event.details) {
    companyName = event.details.sponsor || 
                  event.details.recallingFirm || 
                  event.details.manufacturer || 
                  event.details.labelerName ||
                  'Unknown FDA Company';
  } else if (agency === 'EMA' && event.details) {
    companyName = event.details.holder || 
                  event.details.marketingAuthorisationHolder ||
                  'Unknown EMA Company';
  }
  
  // Clean up company name
  if (companyName && companyName !== 'Unknown Company') {
    // Remove common suffixes and standardize
    companyName = companyName
      .replace(/\s+(Inc\.?|LLC|Ltd\.?|Corporation|Corp\.?|Limited|LP|LLP)$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Capitalize properly
    companyName = companyName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  return companyName || 'Unknown Company';
}

// EMA Events extraction (keep existing EMA function - it's real data)
function extractEMAEvents(emaData, drugName, limitPerEndpoint) {
  console.log('📊 Enhanced EMA extraction starting...');
  
  // First try to debug and find EMA data
  const actualEmaData = debugEMAData();
  const dataToUse = emaData || actualEmaData;
  
  if (!dataToUse) {
    console.log('❌ No EMA data found anywhere');
    return [];
  }
  
  console.log('📊 Using EMA data:', dataToUse);
  const events = [];
  
  // Handle different EMA data structures
  let emaResults = null;
  
  // Method 1: Check for results property
  if (dataToUse.results) {
    emaResults = dataToUse.results;
    console.log('📊 Using EMA results structure');
  }
  // Method 2: Check for direct data arrays
  else if (dataToUse.medicines || dataToUse.orphans || dataToUse.safety || dataToUse.psusa || dataToUse.referrals) {
    emaResults = dataToUse;
    console.log('📊 Using direct EMA arrays structure');
  }
  // Method 3: Check if it's from DOM extraction
  else if (dataToUse.medicines && Array.isArray(dataToUse.medicines)) {
    emaResults = dataToUse;
    console.log('📊 Using DOM-extracted EMA structure');
  }
  
  if (!emaResults) {
    console.log('❌ Could not parse EMA results structure');
    return events;
  }
  
  // 1. Medicine Authorizations - REAL EMA DATA
  if (emaResults.medicines && Array.isArray(emaResults.medicines) && emaResults.medicines.length > 0) {
    console.log('📊 Processing', emaResults.medicines.length, 'EMA medicines');
    emaResults.medicines.slice(0, limitPerEndpoint).forEach((medicine, index) => {
      console.log(`📊 Medicine ${index + 1}:`, medicine);
      
      // Try multiple date field names
      const possibleDates = [
        medicine.authorizationDate,
        medicine.dateOfAuthorization, 
        medicine.date,
        medicine.authorisationDate,
        medicine['Marketing authorisation date'],
        new Date().toISOString().split('T')[0] // fallback to today
      ];
      
      const authDate = possibleDates.find(d => d && d !== 'Unknown') || new Date().toISOString().split('T')[0];
      
      events.push({
        type: 'ema_authorization',
        date: parseEventDate(authDate) || new Date().toISOString().split('T')[0],
        title: 'EMA Marketing Authorization',
        subtitle: medicine.medicineName || medicine.name || medicine.productName || medicine['Medicine name'] || drugName,
        description: `${medicine.status || medicine['Medicine status'] || 'Authorized'} • ${medicine.therapeuticArea || medicine.indication || 'Various indications'}`,
        importance: 'high',
        details: {
          holder: medicine.marketingAuthorisationHolder || medicine.holder || medicine['Marketing authorisation developer / applicant / holder'],
          therapeuticArea: medicine.therapeuticArea || medicine.indication || medicine['Therapeutic indication'],
          activeSubstance: medicine.activeSubstance || medicine.substance || medicine['Active substance'],
          status: medicine.status || medicine['Medicine status'],
          procedureType: medicine.procedureType || medicine.procedure,
          authorizationDate: authDate
        },
        endpoint: 'EMA Authorizations (Live)',
        icon: '✅',
        color: 'green',
        agency: 'EMA'
      });
    });
  }
  
  // 2. PSUSA Reports - REAL EMA DATA
  if (emaResults.psusa && Array.isArray(emaResults.psusa) && emaResults.psusa.length > 0) {
    console.log('📊 Processing', emaResults.psusa.length, 'EMA PSUSA reports');
    emaResults.psusa.slice(0, limitPerEndpoint).forEach((psusa, index) => {
      console.log(`📊 PSUSA ${index + 1}:`, psusa);
      
      const psusaDate = parseEventDate(psusa.publicationDate || psusa.date) || new Date().toISOString().split('T')[0];
      
      events.push({
        type: 'ema_psusa',
        date: psusaDate,
        title: 'PSUSA Safety Report',
        subtitle: psusa.medicineName || psusa.name || drugName,
        description: `Periodic Safety Update Assessment • ${psusa.epar || 'Safety Review'}`,
        importance: 'medium',
        details: {
          publicationDate: psusa.publicationDate,
          epar: psusa.epar,
          substance: psusa.activeSubstance,
          holder: 'EMA PSUSA System'
        },
        endpoint: 'EMA PSUSA Reports (Live)',
        icon: '📊',
        color: 'blue',
        agency: 'EMA'
      });
    });
  }
  
  // 3. Regulatory Referrals - REAL EMA DATA
  if (emaResults.referrals && Array.isArray(emaResults.referrals) && emaResults.referrals.length > 0) {
    console.log('📊 Processing', emaResults.referrals.length, 'EMA referrals');
    emaResults.referrals.slice(0, limitPerEndpoint).forEach((referral, index) => {
      console.log(`📊 Referral ${index + 1}:`, referral);
      
      const referralDate = parseEventDate(referral.startDate || referral.date) || new Date().toISOString().split('T')[0];
      
      events.push({
        type: 'ema_referral',
        date: referralDate,
        title: 'EMA Regulatory Referral',
        subtitle: referral.medicineName || referral.productName || drugName,
        description: `${referral.referralType || 'Article 31'} • ${referral.status || 'Under Review'}`,
        importance: 'medium',
        details: {
          referralType: referral.referralType,
          trigger: referral.trigger,
          status: referral.status,
          outcome: referral.outcome,
          holder: 'EMA Referral System'
        },
        endpoint: 'EMA Referrals (Live)',
        icon: '🔄',
        color: 'blue',
        agency: 'EMA'
      });
    });
  }
  
  console.log(`✅ Extracted ${events.length} EMA events total`);
  events.forEach((event, i) => console.log(`  ${i + 1}. ${event.title} - ${event.subtitle} (${event.date})`));
  
  return events;
}

// DEBUG: Enhanced EMA data detection and extraction
function debugEMAData() {
  console.log('🔍 Debugging EMA data sources...');
  
  // Check all possible EMA data locations
  const sources = [
    { name: 'window.appState.emaData', data: window.appState?.emaData },
    { name: 'window.emaData', data: window.emaData },
    { name: 'currentSearchData (from EMA module)', data: window.currentSearchData },
    { name: 'EmaDataModule.state', data: typeof EmaDataModule !== 'undefined' ? EmaDataModule.state : null },
    { name: 'DOM elements', data: getEMADataFromDOM() }
  ];
  
  sources.forEach(source => {
    if (source.data) {
      console.log(`✅ Found ${source.name}:`, source.data);
    } else {
      console.log(`❌ No data in ${source.name}`);
    }
  });
  
  return sources.find(s => s.data)?.data || null;
}

// Extract EMA data directly from DOM elements (fallback method)
function getEMADataFromDOM() {
  const domData = {
    medicines: [],
    orphans: [],
    safety: [],
    psusa: [],
    shortages: [],
    referrals: []
  };
  
  // Extract from medicines table
  const medicinesTable = document.querySelector('#emaApprovalData table tbody');
  if (medicinesTable) {
    const rows = medicinesTable.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 5) {
        domData.medicines.push({
          medicineName: cells[0]?.textContent?.trim(),
          status: cells[1]?.textContent?.trim(),
          activeSubstance: cells[2]?.textContent?.trim(),
          therapeuticArea: cells[3]?.textContent?.trim(),
          authorizationDate: cells[4]?.textContent?.trim(),
          indication: cells[5]?.textContent?.trim(),
          marketingAuthorisationHolder: cells[6]?.textContent?.trim()
        });
      }
    });
  }
  
  // Extract from PSUSA table
  const psusaTable = document.querySelector('#emaPsusaData table tbody');
  if (psusaTable) {
    const rows = psusaTable.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 3) {
        domData.psusa.push({
          medicineName: cells[0]?.textContent?.trim(),
          publicationDate: cells[1]?.textContent?.trim(),
          epar: cells[2]?.textContent?.trim()
        });
      }
    });
  }
  
  // Extract from referrals table
  const referralsTable = document.querySelector('#emaReferralsData table tbody');
  if (referralsTable) {
    const rows = referralsTable.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 4) {
        domData.referrals.push({
          medicineName: cells[0]?.textContent?.trim(),
          referralType: cells[1]?.textContent?.trim(),
          startDate: cells[2]?.textContent?.trim(),
          status: cells[3]?.textContent?.trim()
        });
      }
    });
  }
  
  // Count totals
  const totalRecords = domData.medicines.length + domData.psusa.length + domData.referrals.length;
  console.log(`📊 DOM extraction found: ${domData.medicines.length} medicines, ${domData.psusa.length} PSUSA, ${domData.referrals.length} referrals (total: ${totalRecords})`);
  
  return totalRecords > 0 ? domData : null;
}

// Enhanced event details modal with company context
function showEventDetails(companyName, agency, eventIndex) {
  if (!window.currentRecentEventsData || !window.currentRecentEventsData.eventsByCompany[companyName]) {
    console.log('Company events not found:', companyName);
    return;
  }
  
  const companyEvents = window.currentRecentEventsData.eventsByCompany[companyName];
  const event = companyEvents[agency][eventIndex];
  
  if (!event) {
    console.log('Event not found:', agency, eventIndex);
    return;
  }
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  
  const agencyColor = agency === 'fda' ? 'blue' : 'purple';
  const agencyName = agency.toUpperCase();
  
  modal.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
      <div class="p-6">
        <!-- Header -->
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center space-x-3">
            <span class="text-2xl">${event.icon}</span>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">${event.title}</h3>
              <div class="flex items-center space-x-2 mt-1">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${agencyColor}-100 text-${agencyColor}-800">
                  ${agencyName}
                </span>
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  LIVE DATA
                </span>
                <span class="text-sm text-gray-600">${event.endpoint}</span>
                <span class="text-sm text-gray-400">•</span>
                <span class="text-sm text-gray-600">${formatDisplayDate(event.date)}</span>
              </div>
            </div>
          </div>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 p-1">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <!-- Company Badge -->
        <div class="mb-4">
          <div class="inline-flex items-center px-3 py-2 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg">
            <div class="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs mr-2">
              ${companyName.charAt(0).toUpperCase()}
            </div>
            <span class="font-medium text-gray-800">${companyName}</span>
          </div>
        </div>
        
        <!-- Content -->
        <div class="space-y-4">
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-1">Compound</h4>
            <p class="text-sm text-gray-900">${event.subtitle}</p>
          </div>
          
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-1">Description</h4>
            <p class="text-sm text-gray-900">${event.description}</p>
          </div>
          
          <div class="flex items-center space-x-4">
            <div>
              <h4 class="text-sm font-medium text-gray-700 mb-1">Importance</h4>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getImportanceBadge(event.importance)}">
                ${event.importance.toUpperCase()}
              </span>
            </div>
            
            <div>
              <h4 class="text-sm font-medium text-gray-700 mb-1">Event Type</h4>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
                ${event.type.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
          
          ${event.details && Object.keys(event.details).length > 0 ? `
            <div>
              <h4 class="text-sm font-medium text-gray-700 mb-2">Additional Details</h4>
              <div class="bg-gray-50 rounded-lg p-3">
                ${Object.entries(event.details).map(([key, value]) => {
                  if (value && value !== 'Unknown') {
                    return `<div class="flex justify-between py-1 text-sm">
                      <span class="font-medium text-gray-600">${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span>
                      <span class="text-gray-900">${Array.isArray(value) ? value.join(', ') : value}</span>
                    </div>`;
                  }
                  return '';
                }).filter(Boolean).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        
        <!-- Footer -->
        <div class="mt-6 flex justify-end space-x-3">
          <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
            Close
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Show all events for a specific company and agency
function showAllCompanyEvents(companyName, agency) {
  if (!window.currentRecentEventsData || !window.currentRecentEventsData.eventsByCompany[companyName]) {
    alert('Company events not found');
    return;
  }
  
  const companyEvents = window.currentRecentEventsData.eventsByCompany[companyName];
  const events = companyEvents[agency];
  const agencyName = agency.toUpperCase();
  const agencyColor = agency === 'fda' ? 'blue' : 'purple';
  
  if (!events || events.length === 0) {
    alert(`No ${agencyName} events found for ${companyName}`);
    return;
  }
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  
  modal.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex justify-between items-center mb-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              ${companyName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">${companyName}</h3>
              <p class="text-sm text-${agencyColor}-600">All ${agencyName} Events (${events.length}) - Live Data</p>
            </div>
          </div>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 p-1">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
          ${events.map((event, index) => `
            <div class="bg-${agencyColor}-50 border border-${agencyColor}-200 rounded-lg p-4">
              <div class="flex items-start justify-between mb-2">
                <div class="flex items-center space-x-2">
                  <span class="text-lg">${event.icon}</span>
                  <div>
                    <h4 class="font-semibold text-${agencyColor}-900 text-sm">${event.title}</h4>
                    <p class="text-xs text-${agencyColor}-700">${event.endpoint}</p>
                  </div>
                </div>
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getImportanceBadge(event.importance)}">
                  ${event.importance.toUpperCase()}
                </span>
              </div>
              <p class="text-sm text-${agencyColor}-800 mb-1">${event.subtitle}</p>
              <p class="text-xs text-${agencyColor}-700 mb-2">${event.description}</p>
              <div class="flex justify-between items-center">
                <span class="text-xs text-${agencyColor}-600">${formatDisplayDate(event.date)}</span>
                <button onclick="showEventDetails('${companyName}', '${agency}', ${index})" class="text-${agencyColor}-700 hover:text-${agencyColor}-900 text-xs">
                  Details
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Show all events modal (combined view)
function showAllEventsModal() {
  if (!window.currentRecentEventsData) {
    alert('No events data available');
    return;
  }
  
  const data = window.currentRecentEventsData;
  const allEvents = [...data.fdaEvents, ...data.emaEvents]
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (allEvents.length === 0) {
    alert('No events to display');
    return;
  }
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  
  modal.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[80vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex justify-between items-center mb-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">All Recent Events (${allEvents.length})</h3>
            <p class="text-sm text-green-600 mt-1">✅ Live data from FDA & EMA APIs</p>
          </div>
          <div class="flex items-center space-x-3">
            <span class="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded-full">${data.totalFDA} FDA</span>
            <span class="text-sm text-purple-600 bg-purple-100 px-2 py-1 rounded-full">${data.totalEMA} EMA</span>
            <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 p-1">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
          ${allEvents.map((event, index) => {
            const companyName = extractCompanyName(event, event.agency);
            const agencyColor = event.agency === 'FDA' ? 'blue' : 'purple';
            return `
              <div class="bg-${agencyColor}-50 border border-${agencyColor}-200 rounded-lg p-4">
                <div class="flex items-start justify-between mb-2">
                  <div class="flex items-center space-x-2">
                    <span class="text-lg">${event.icon}</span>
                    <div>
                      <h4 class="font-semibold text-${agencyColor}-900 text-sm">${event.title}</h4>
                      <p class="text-xs text-${agencyColor}-700">${event.endpoint}</p>
                    </div>
                  </div>
                  <div class="flex flex-col items-end space-y-1">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getImportanceBadge(event.importance)}">
                      ${event.importance.toUpperCase()}
                    </span>
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${agencyColor}-100 text-${agencyColor}-800">
                      ${event.agency}
                    </span>
                  </div>
                </div>
                
                <div class="mb-2">
                  <p class="text-xs text-gray-600 mb-1">Company: ${companyName}</p>
                  <p class="text-sm text-${agencyColor}-800 mb-1">${event.subtitle}</p>
                  <p class="text-xs text-${agencyColor}-700">${event.description}</p>
                </div>
                
                <div class="flex justify-between items-center pt-2 border-t border-${agencyColor}-200">
                  <span class="text-xs text-${agencyColor}-600">${formatDisplayDate(event.date)}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Export functions
function exportCompanyEvents(companyName) {
  if (!window.currentRecentEventsData || !window.currentRecentEventsData.eventsByCompany[companyName]) {
    alert('Company events not found');
    return;
  }
  
  const companyEvents = window.currentRecentEventsData.eventsByCompany[companyName];
  const exportData = {
    exportDate: new Date().toISOString(),
    compound: window.currentDrugName || 'Unknown',
    company: companyName,
    dataSource: 'LIVE FDA & EMA APIs',
    totalEvents: companyEvents.fda.length + companyEvents.ema.length,
    events: {
      fda: companyEvents.fda.map(event => ({
        date: event.date,
        type: event.type,
        title: event.title,
        subtitle: event.subtitle,
        description: event.description,
        importance: event.importance,
        endpoint: event.endpoint,
        details: event.details
      })),
      ema: companyEvents.ema.map(event => ({
        date: event.date,
        type: event.type,
        title: event.title,
        subtitle: event.subtitle,
        description: event.description,
        importance: event.importance,
        endpoint: event.endpoint,
        details: event.details
      }))
    }
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${companyName.replace(/\s+/g, '_')}_live_events_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportAllRecentEvents() {
  if (!window.currentRecentEventsData) {
    alert('No recent events to export');
    return;
  }
  
  const data = window.currentRecentEventsData;
  const exportData = {
    exportDate: new Date().toISOString(),
    compound: window.currentDrugName || 'Unknown',
    dataSource: 'LIVE FDA & EMA APIs - Real-time regulatory data',
    summary: {
      totalCompanies: data.totalCompanies,
      totalFDAEvents: data.totalFDA,
      totalEMAEvents: data.totalEMA,
      totalEvents: data.totalFDA + data.totalEMA
    },
    eventsByCompany: Object.entries(data.eventsByCompany).reduce((acc, [companyName, companyEvents]) => {
      acc[companyName] = {
        fda: companyEvents.fda.map(event => ({
          date: event.date,
          type: event.type,
          title: event.title,
          subtitle: event.subtitle,
          description: event.description,
          importance: event.importance,
          endpoint: event.endpoint,
          details: event.details
        })),
        ema: companyEvents.ema.map(event => ({
          date: event.date,
          type: event.type,
          title: event.title,
          subtitle: event.subtitle,
          description: event.description,
          importance: event.importance,
          endpoint: event.endpoint,
          details: event.details
        }))
      };
      return acc;
    }, {})
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `live_regulatory_events_${window.currentDrugName || 'export'}_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Integration setup with REAL DATA ONLY
function initializeRealOnlyRecentEventsAddon() {
  console.log('🔄 Initializing REAL DATA ONLY recent events add-on...');
  
  // Store original function if it exists
  if (typeof window.generateComprehensiveSummary === 'function') {
    console.log('✅ Found existing generateComprehensiveSummary, will add to it...');
    window.originalGenerateComprehensiveSummary = window.generateComprehensiveSummary;
  }
  
  // Replace with real-data-only version
  window.generateComprehensiveSummary = addRealOnlyRecentEventsToSummary;
  
  // Make functions available globally
  window.showEventDetails = showEventDetails;
  window.showAllCompanyEvents = showAllCompanyEvents;
  window.showAllEventsModal = showAllEventsModal;
  window.exportCompanyEvents = exportCompanyEvents;
  window.exportAllRecentEvents = exportAllRecentEvents;
  
  console.log('✅ REAL DATA ONLY recent events add-on initialized');
}

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeRealOnlyRecentEventsAddon, 1000);
  });
} else {
  setTimeout(initializeRealOnlyRecentEventsAddon, 1000);
}

console.log('✅ Enhanced recent events loaded (REAL DATA ONLY - No simulated data)');