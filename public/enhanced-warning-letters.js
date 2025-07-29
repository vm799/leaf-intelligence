// // Enhanced Warning Letter System - Complete JavaScript Integration
// // Add this to your inteltool.html or create a new file enhanced-warning-letters.js
// Enhanced Warning Letter System - FIXED VERSION
// Add this to your inteltool.html or replace your enhanced-warning-letters.js

window.enhancedWL = {
    // State management
    state: {
        companies: [],
        warningLetters: [],
        form483s: [],
        inspections: [],
        filters: {
            classification: '',
            dateRange: '',
            riskLevel: '',
            drugName: ''
        },
        currentSort: { field: 'name', direction: 'asc' },
        selectedCompanies: []
    },

    // Initialize the enhanced system
    init: function(companies) {
        console.log('Initializing Enhanced Warning Letter System with companies:', companies);
        this.state.selectedCompanies = companies;
        this.setupEventListeners();
        this.loadData();
    },

    // Setup event listeners
    setupEventListeners: function() {
        // Filter inputs - use optional chaining to prevent errors
        document.getElementById('enhancedClassificationFilter')?.addEventListener('change', (e) => {
            this.state.filters.classification = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('enhancedDateRangeFilter')?.addEventListener('change', (e) => {
            this.state.filters.dateRange = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('enhancedRiskLevelFilter')?.addEventListener('change', (e) => {
            this.state.filters.riskLevel = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('enhancedDrugSearch')?.addEventListener('input', (e) => {
            this.state.filters.drugName = e.target.value.toLowerCase();
            this.applyFilters();
        });
    },

    // Load all data
    loadData: async function() {
        try {
            this.showLoading(true);
            console.log('Loading data for companies:', this.state.selectedCompanies);
            
            // Reset counts if available
            if (window.regulatoryData) {
                window.regulatoryData.resetCounts(this.state.selectedCompanies);
            }

            // Fetch all data in parallel with error handling
            const results = await Promise.allSettled([
                this.fetchWarningLetters(),
                this.fetchInspectionData()
            ]);

            // Log results for debugging
            console.log('Data fetch results:', results);

            // Check for errors
            const warningLettersResult = results[0];
            const inspectionResult = results[1];

            if (warningLettersResult.status === 'rejected') {
                console.error('Warning letters fetch failed:', warningLettersResult.reason);
            }

            if (inspectionResult.status === 'rejected') {
                console.error('Inspection data fetch failed:', inspectionResult.reason);
            }

            // Process and display data
            this.processData();
            this.updateDisplay();
            
        } catch (error) {
            console.error('Error loading enhanced warning letter data:', error);
            this.showError('Failed to load regulatory data: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

fetchWarningLetters: async function() {
    const allLetters = [];
    
    console.log('Fetching warning letters for companies:', this.state.selectedCompanies);
    
    for (const company of this.state.selectedCompanies) {
        try {
            // FIXED: Try multiple search variations for each company
            const searchVariations = this.generateSearchVariations(company);
            let foundResults = false;
            
            for (const searchTerm of searchVariations) {
                if (foundResults) break; // Stop if we found results
                
                const params = new URLSearchParams({
                    term: searchTerm,
                    field: 'company',
                    page: 1,
                    perPage: 100
                });

                if (this.state.filters.dateRange) {
                    const daysAgo = parseInt(this.state.filters.dateRange);
                    const fromDate = new Date();
                    fromDate.setDate(fromDate.getDate() - daysAgo);
                    params.append('dateFrom', fromDate.toISOString().split('T')[0]);
                }

                const url = `/api/wl/search?${params}`;
                console.log(`Trying search term "${searchTerm}" for ${company}:`, url);
                
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.warn(`HTTP ${response.status} for ${searchTerm}`);
                    continue;
                }
                
                const data = await response.json();
                console.log(`Warning letters response for ${searchTerm}:`, data);
                
                if (data.results && Array.isArray(data.results) && data.results.length > 0) {
                    console.log(`✅ Found ${data.results.length} results for "${searchTerm}" (original: ${company})`);
                    data.results.forEach(letter => {
                        letter.sourceCompany = company; // FIXED: Always assign to original company
                        letter.matchedTerm = searchTerm; // Track which term matched
                        allLetters.push(letter);
                    });
                    foundResults = true;
                } else {
                    console.log(`No results for "${searchTerm}"`);
                }
            }
            
            if (!foundResults) {
                console.warn(`❌ No warning letters found for any variation of "${company}"`);
            }
            
        } catch (error) {
            console.error(`Error fetching warning letters for ${company}:`, error);
        }
    }

    console.log('Total warning letters fetched:', allLetters.length);
    this.state.warningLetters = allLetters;
    return allLetters;
},

// NEW: Generate search variations for better matching
generateSearchVariations: function(company) {
    const variations = [];
    
    // Original company name
    variations.push(company);
    
    // Remove common suffixes and prefixes
    let cleaned = company
        .replace(/\s+(INC|LLC|LTD|CORP|CORPORATION|COMPANY|CO|PHARMA|PHARMACEUTICALS|PHARMS|USA|OPERATIONS|MANUFACTURING|MFG)\.?$/i, '')
        .replace(/^(THE\s+)/i, '')
        .trim();
    
    if (cleaned !== company && cleaned.length > 2) {
        variations.push(cleaned);
    }
    
    // First word only (for compound names)
    const firstWord = company.split(/\s+/)[0].trim();
    if (firstWord.length > 3 && firstWord !== company) {
        variations.push(firstWord);
    }
    
    // Last word (for names ending with company identifiers)
    const words = company.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 1) {
        const lastWord = words[words.length - 1];
        if (!lastWord.match(/^(INC|LLC|LTD|CORP|USA|CO)$/i)) {
            variations.push(lastWord);
        }
    }
    
    // Remove duplicates and short terms
    const uniqueVariations = [...new Set(variations)]
        .filter(v => v && v.length > 2)
        .slice(0, 5); // Limit to 5 variations to avoid too many API calls
    
    console.log(`Search variations for "${company}":`, uniqueVariations);
    return uniqueVariations;
},

    // FIXED: Fetch inspection data with better error handling
// FIXED: Better inspection data fetching with debugging
fetchInspectionData: async function() {
    try {
        console.log('Fetching inspection data...');
        
        const response = await fetch('/api/inspection-data');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Raw inspection data received:', {
            recentInspections: data.recentInspections?.length || 0,
            historicalInspections: data.historicalInspections?.length || 0,
            sampleRecent: data.recentInspections?.[0],
            sampleHistorical: data.historicalInspections?.[0]
        });
        
        this.state.form483s = [];
        this.state.inspections = [];
        
        if (data.recentInspections && Array.isArray(data.recentInspections)) {
            // FIXED: Better Form 483 filtering and matching
            data.recentInspections.forEach(item => {
                if (!item) return;
                
                const legalName = (item["Legal Name"] || '').trim();
                const firmName = (item["Firm Name"] || '').trim();
                const recordType = (item["Record Type"] || '').trim();
                
                // Check if this is a Form 483
                if (recordType === "Form 483") {
                    // Try to match with any of our companies
                    const matchedCompany = this.findMatchingCompany(legalName, firmName);
                    if (matchedCompany) {
                        console.log(`✅ Matched Form 483: "${legalName}" → "${matchedCompany}"`);
                        item.matchedCompany = matchedCompany;
                        this.state.form483s.push(item);
                    }
                }
            });
        }

        if (data.historicalInspections && Array.isArray(data.historicalInspections)) {
            data.historicalInspections.forEach(item => {
                if (!item) return;
                
                const firmName = (item["Firm Name"] || '').trim();
                const legalName = (item["Legal Name"] || '').trim();
                
                const matchedCompany = this.findMatchingCompany(firmName, legalName);
                if (matchedCompany) {
                    console.log(`✅ Matched Historical Inspection: "${firmName}" → "${matchedCompany}"`);
                    item.matchedCompany = matchedCompany;
                    this.state.inspections.push(item);
                }
            });
        }

        console.log('Form 483s found:', this.state.form483s.length);
        console.log('Historical inspections found:', this.state.inspections.length);

        return { 
            form483s: this.state.form483s, 
            inspections: this.state.inspections 
        };
    } catch (error) {
        console.error('Error fetching inspection data:', error);
        return { form483s: [], inspections: [] };
    }
},

// NEW: Improved company matching function
findMatchingCompany: function(name1, name2 = '') {
    if (!name1 && !name2) return null;
    
    const names = [name1, name2].filter(n => n && n.length > 0);
    
    for (const name of names) {
        const nameLower = name.toLowerCase().trim();
        
        // Try exact match first
        for (const company of this.state.selectedCompanies) {
            if (nameLower === company.toLowerCase()) {
                return company;
            }
        }
        
        // Try fuzzy matching
        for (const company of this.state.selectedCompanies) {
            const companyLower = company.toLowerCase();
            
            // Generate variations for comparison
            const companyVariations = this.generateSearchVariations(company).map(v => v.toLowerCase());
            
            // Check if any variation matches
            for (const variation of companyVariations) {
                if (nameLower.includes(variation) || variation.includes(nameLower)) {
                    return company;
                }
            }
            
            // Additional fuzzy matching
            if (this.fuzzyMatch(nameLower, companyLower)) {
                return company;
            }
        }
    }
    
    return null;
},

// NEW: Fuzzy matching helper
fuzzyMatch: function(str1, str2, threshold = 0.6) {
    if (!str1 || !str2) return false;
    
    // Calculate similarity using simple word overlap
    const words1 = str1.split(/\s+/).filter(w => w.length > 2);
    const words2 = str2.split(/\s+/).filter(w => w.length > 2);
    
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

    // FIXED: Process data to build company profiles with null checks
processData: function() {
    console.log('Processing data...');
    const companyMap = new Map();

    // Initialize companies
    this.state.selectedCompanies.forEach(company => {
        companyMap.set(company, {
            name: company,
            warningLetters: [],
            form483s: [],
            inspections: [],
            drugMentions: new Set(),
            violations: new Set(),
            escalationPaths: [],
            escalationRate: 0,
            riskLevel: 'clean',
            timeline: []
        });
    });

    // FIXED: Assign warning letters using sourceCompany
    this.state.warningLetters.forEach(letter => {
        const assignedCompany = letter.sourceCompany; // Use the company we assigned during fetch
        
        if (assignedCompany && companyMap.has(assignedCompany)) {
            const companyData = companyMap.get(assignedCompany);
            companyData.warningLetters.push(letter);
            
            console.log(`✅ Assigned warning letter to ${assignedCompany}: ${letter.subject || 'No subject'}`);
            
            // Extract drug mentions and violations
            if (letter.subject) {
                this.extractDrugMentions(letter.subject, companyData.drugMentions);
                this.extractViolations(letter.subject, companyData.violations);
            }
            
            if (letter.fullContent || letter.excerpt) {
                const content = letter.fullContent || letter.excerpt || '';
                this.extractDrugMentions(content, companyData.drugMentions);
                this.extractViolations(content, companyData.violations);
            }
        } else {
            console.warn('Could not assign warning letter:', letter.companyName, '→ sourceCompany:', letter.sourceCompany);
        }
    });

    // FIXED: Assign Form 483s using matchedCompany
    this.state.form483s.forEach(f483 => {
        const assignedCompany = f483.matchedCompany;
        
        if (assignedCompany && companyMap.has(assignedCompany)) {
            companyMap.get(assignedCompany).form483s.push(f483);
            console.log(`✅ Assigned Form 483 to ${assignedCompany}: ${f483["Legal Name"]}`);
        }
    });

    // FIXED: Assign inspections using matchedCompany
    this.state.inspections.forEach(inspection => {
        const assignedCompany = inspection.matchedCompany;
        
        if (assignedCompany && companyMap.has(assignedCompany)) {
            companyMap.get(assignedCompany).inspections.push(inspection);
            console.log(`✅ Assigned inspection to ${assignedCompany}: ${inspection["Firm Name"]}`);
        }
    });

    // Calculate escalation paths and risk levels
    companyMap.forEach((companyData, companyName) => {
        companyData.escalationPaths = this.calculateEscalationPaths(companyData);
        companyData.escalationRate = this.calculateEscalationRate(companyData);
        companyData.riskLevel = this.determineRiskLevel(companyData);
        companyData.timeline = this.buildTimeline(companyData);
        
        console.log(`Company ${companyName} processed:`, {
            warningLetters: companyData.warningLetters.length,
            form483s: companyData.form483s.length,
            inspections: companyData.inspections.length,
            riskLevel: companyData.riskLevel
        });
    });

    this.state.companies = Array.from(companyMap.values());
    console.log('Processed companies:', this.state.companies);
},

// Add this debugging method
debugCompanyMatching: function() {
    console.log('=== DEBUGGING COMPANY MATCHING ===');
    
    console.log('Selected Companies:', this.state.selectedCompanies);
    console.log('Warning Letters Found:', this.state.warningLetters.length);
    console.log('Form 483s Found:', this.state.form483s.length);
    
    // Show which companies got data
    this.state.companies.forEach(company => {
        console.log(`${company.name}: WL=${company.warningLetters.length}, 483s=${company.form483s.length}, Inspections=${company.inspections.length}`);
    });
    
    // Show unmatched warning letters
    const unmatchedWLs = this.state.warningLetters.filter(wl => !wl.sourceCompany);
    if (unmatchedWLs.length > 0) {
        console.log('Unmatched Warning Letters:', unmatchedWLs.map(wl => wl.companyName));
    }
    
    return {
        selectedCompanies: this.state.selectedCompanies.length,
        warningLettersTotal: this.state.warningLetters.length,
        form483sTotal: this.state.form483s.length,
        companiesWithData: this.state.companies.filter(c => 
            c.warningLetters.length > 0 || c.form483s.length > 0 || c.inspections.length > 0
        ).length
    };
},

    // FIXED: Extract drug mentions with better patterns
    extractDrugMentions: function(text, drugSet) {
        if (!text) return;
        
        const drugPatterns = [
            /\b(\w+)\s+(tablet|capsule|injection|cream|ointment|solution|suspension|syrup|drops)\b/gi,
            /\b(generic|brand)\s+name[:\s]+([^,.\n]+)/gi,
            /\bactive\s+ingredient[:\s]+([^,.\n]+)/gi,
            /\bdrug\s+product[:\s]+([^,.\n]+)/gi
        ];
        
        drugPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                if (match[1] && match[1].length > 2) {
                    drugSet.add(match[1].trim());
                }
                if (match[2] && match[2].length > 2) {
                    drugSet.add(match[2].trim());
                }
            }
        });
    },

    // FIXED: Extract violations with common FDA terms
    extractViolations: function(text, violationSet) {
        if (!text) return;
        
        const violationTerms = [
            'data integrity', 'contamination', 'quality control', 'validation',
            'documentation', 'manufacturing practice', 'sterility', 'stability',
            'labeling', 'adverse event', 'CAPA', 'investigation', 'deviation',
            'specification', 'testing', 'raw material', 'finished product'
        ];
        
        const lowerText = text.toLowerCase();
        violationTerms.forEach(term => {
            if (lowerText.includes(term)) {
                violationSet.add(term);
            }
        });
    },

    // Calculate escalation paths (483 -> Warning Letter)
    calculateEscalationPaths: function(company) {
        const paths = [];
        
        company.warningLetters.forEach(wl => {
            const wlDate = new Date(wl.letterIssueDate);
            
            company.form483s.forEach(f483 => {
                const f483Date = new Date(f483["Record Date"]);
                const daysBetween = (wlDate - f483Date) / (1000 * 60 * 60 * 24);
                
                // Consider escalation if 483 came 30-365 days before warning letter
                if (daysBetween > 30 && daysBetween <= 365) {
                    paths.push({
                        f483: f483,
                        warningLetter: wl,
                        daysBetween: Math.round(daysBetween)
                    });
                }
            });
        });
        
        return paths;
    },

    // Calculate escalation rate
    calculateEscalationRate: function(company) {
        if (company.form483s.length === 0) return 0;
        return Math.round((company.escalationPaths.length / company.form483s.length) * 100);
    },

    // Determine risk level based on regulatory history
    determineRiskLevel: function(company) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const recentWLs = company.warningLetters.filter(wl => 
            new Date(wl.letterIssueDate) > sixMonthsAgo
        ).length;
        
        const recent483s = company.form483s.filter(f => 
            new Date(f["Record Date"]) > sixMonthsAgo
        ).length;
        
        if (company.warningLetters.length > 2 || 
            (recentWLs > 0 && recent483s > 0) ||
            company.escalationRate > 50) {
            return 'repeat';
        } else if (recentWLs > 0 || recent483s > 0) {
            return 'recent';
        } else if (company.warningLetters.length > 0 || company.form483s.length > 0) {
            return 'first';
        }
        
        return 'clean';
    },

    // Build regulatory timeline
    buildTimeline: function(company) {
        const events = [];
        
        // Add warning letters
        company.warningLetters.forEach(wl => {
            events.push({
                type: 'warning_letter',
                date: new Date(wl.letterIssueDate),
                data: wl,
                title: 'Warning Letter',
                color: 'red'
            });
        });
        
        // Add Form 483s
        company.form483s.forEach(f483 => {
            events.push({
                type: 'form_483',
                date: new Date(f483["Record Date"]),
                data: f483,
                title: 'Form 483',
                color: 'yellow'
            });
        });
        
        // Add inspections
        company.inspections.forEach(inspection => {
            events.push({
                type: 'inspection',
                date: new Date(inspection["Inspection End Date"]),
                data: inspection,
                title: 'Inspection',
                color: 'blue'
            });
        });
        
        // Sort by date (newest first)
        return events.sort((a, b) => b.date - a.date);
    },

    // FIXED: Update display with better error handling
    updateDisplay: function() {
        console.log('Updating display...');
        try {
            this.updateCompanyTable();
            this.updateSummaryStats();
        } catch (error) {
            console.error('Error updating display:', error);
            this.showError('Error updating display: ' + error.message);
        }
    },

    // Update company table
    updateCompanyTable: function() {
        const tbody = document.getElementById('enhancedCompanyTableBody');
        if (!tbody) {
            console.warn('Enhanced company table body not found');
            return;
        }

        // Filter companies
        const filteredCompanies = this.filterCompanies(this.state.companies);
        
        // Sort companies
        this.sortCompanies(filteredCompanies);
        
        if (filteredCompanies.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                        No companies found matching the current filters.
                        <br><small>Try adjusting your search criteria.</small>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredCompanies.map(company => {
            const riskColorClass = this.getRiskColorClass(company.riskLevel);
            
            return `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="font-medium text-gray-900">${company.name}</div>
                        <div class="text-sm text-gray-500">${company.inspections.length} facilities</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            ${company.warningLetters.length}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            ${company.form483s.length}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            ${company.inspections.length}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="${riskColorClass}">${company.riskLevel}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${company.escalationRate}%
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="window.enhancedWL.viewCompanyDetails('${company.name}')" 
                            class="text-blue-600 hover:text-blue-900 mr-3">
                            View Details
                        </button>
                        <button onclick="window.enhancedWL.downloadCompanyReport('${company.name}')" 
                            class="text-green-600 hover:text-green-900">
                            Download
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // Get risk level color class
    getRiskColorClass: function(riskLevel) {
        const colorMap = {
            'clean': 'text-green-600 font-medium',
            'first': 'text-yellow-600 font-medium',
            'recent': 'text-orange-600 font-medium',
            'repeat': 'text-red-600 font-medium'
        };
        return colorMap[riskLevel] || 'text-gray-600';
    },

    // Filter companies
    filterCompanies: function(companies) {
        return companies.filter(company => {
            // Classification filter
            if (this.state.filters.classification) {
                const hasClassification = Array.from(company.violations).some(v => 
                    v.toLowerCase().includes(this.state.filters.classification.toLowerCase())
                );
                if (!hasClassification) return false;
            }
            
            // Risk level filter
            if (this.state.filters.riskLevel && this.state.filters.riskLevel !== company.riskLevel) {
                return false;
            }
            
            // Drug name filter
            if (this.state.filters.drugName) {
                const hasDrug = Array.from(company.drugMentions).some(drug => 
                    drug.toLowerCase().includes(this.state.filters.drugName)
                );
                if (!hasDrug) return false;
            }
            
            // Date range filter
            if (this.state.filters.dateRange) {
                const daysAgo = parseInt(this.state.filters.dateRange);
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
                
                const hasRecentActivity = 
                    company.warningLetters.some(wl => new Date(wl.letterIssueDate) > cutoffDate) ||
                    company.form483s.some(f => new Date(f["Record Date"]) > cutoffDate);
                    
                if (!hasRecentActivity) return false;
            }
            
            return true;
        });
    },

    // Sort companies
    sortCompanies: function(companies) {
        companies.sort((a, b) => {
            let aVal, bVal;
            
            switch (this.state.currentSort.field) {
                case 'name':
                    aVal = a.name.toLowerCase();
                    bVal = b.name.toLowerCase();
                    break;
                case 'warningLetters':
                    aVal = a.warningLetters.length;
                    bVal = b.warningLetters.length;
                    break;
                case 'form483s':
                    aVal = a.form483s.length;
                    bVal = b.form483s.length;
                    break;
                case 'inspections':
                    aVal = a.inspections.length;
                    bVal = b.inspections.length;
                    break;
                case 'riskLevel':
                    const riskOrder = { 'clean': 0, 'first': 1, 'recent': 2, 'repeat': 3 };
                    aVal = riskOrder[a.riskLevel] || 0;
                    bVal = riskOrder[b.riskLevel] || 0;
                    break;
                default:
                    return 0;
            }
            
            if (this.state.currentSort.direction === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
        });
    },

    // Update summary statistics
    updateSummaryStats: function() {
        const totalCompanies = this.state.companies.length;
        const totalWLs = this.state.companies.reduce((sum, c) => sum + c.warningLetters.length, 0);
        const total483s = this.state.companies.reduce((sum, c) => sum + c.form483s.length, 0);
        const totalInspections = this.state.companies.reduce((sum, c) => sum + c.inspections.length, 0);

        // Update summary cards if they exist
        const summaryElements = {
            companies: document.getElementById('enhancedTotalCompanies'),
            warnings: document.getElementById('enhancedTotalWarnings'),
            form483s: document.getElementById('enhancedTotal483s'),
            inspections: document.getElementById('enhancedTotalInspections')
        };

        if (summaryElements.companies) summaryElements.companies.textContent = totalCompanies;
        if (summaryElements.warnings) summaryElements.warnings.textContent = totalWLs;
        if (summaryElements.form483s) summaryElements.form483s.textContent = total483s;
        if (summaryElements.inspections) summaryElements.inspections.textContent = totalInspections;
    },

    // View company details in modal
    viewCompanyDetails: function(companyName) {
        const company = this.state.companies.find(c => c.name === companyName);
        if (!company) return;

        const modalContent = document.getElementById('enhancedModalContent');
        if (!modalContent) return;

        let content = `
            <h3 class="text-xl font-bold mb-4">${company.name} - Regulatory Profile</h3>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-red-50 p-3 rounded-lg">
                    <div class="text-red-600 font-semibold">Warning Letters</div>
                    <div class="text-2xl font-bold text-red-700">${company.warningLetters.length}</div>
                </div>
                <div class="bg-yellow-50 p-3 rounded-lg">
                    <div class="text-yellow-600 font-semibold">Form 483s</div>
                    <div class="text-2xl font-bold text-yellow-700">${company.form483s.length}</div>
                </div>
                <div class="bg-blue-50 p-3 rounded-lg">
                    <div class="text-blue-600 font-semibold">Inspections</div>
                    <div class="text-2xl font-bold text-blue-700">${company.inspections.length}</div>
                </div>
                <div class="bg-purple-50 p-3 rounded-lg">
                    <div class="text-purple-600 font-semibold">Risk Level</div>
                    <div class="text-lg font-bold ${this.getRiskColorClass(company.riskLevel)}">${company.riskLevel}</div>
                </div>
            </div>
        `;

        // Warning Letters section
        if (company.warningLetters.length > 0) {
            content += `
                <div class="mb-6">
                    <h4 class="font-semibold text-lg mb-3 text-red-600">Warning Letters</h4>
                    <div class="space-y-3">
            `;
            
            company.warningLetters.forEach(wl => {
                const violations = Array.from(company.violations).filter(v => 
                    (wl.subject && wl.subject.toLowerCase().includes(v)) ||
                    (wl.fullContent && wl.fullContent.toLowerCase().includes(v))
                );
                
                // Enhanced Warning Letters - FIXED VERSION Part 2 (continuation)

                const drugs = Array.from(company.drugMentions).filter(d => 
                    (wl.subject && wl.subject.toLowerCase().includes(d.toLowerCase())) ||
                    (wl.fullContent && wl.fullContent.toLowerCase().includes(d.toLowerCase()))
                );
                
                content += `
                    <div class="border border-red-200 rounded-lg p-4 bg-red-50">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <span class="font-medium">${this.formatDate(wl.letterIssueDate)}</span>
                                <span class="text-sm text-gray-600 ml-2">${wl.issuingOffice || 'Unknown Office'}</span>
                            </div>
                            ${wl.companyUrl ? 
                                `<a href="${wl.companyUrl}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm">
                                    View on FDA →
                                </a>` : ''
                            }
                        </div>
                        <p class="text-sm text-gray-700 mb-2">${wl.subject || 'No subject provided'}</p>
                        ${violations.length > 0 ? 
                            `<div class="flex flex-wrap gap-1 mb-2">
                                ${violations.map(v => 
                                    `<span class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">${v}</span>`
                                ).join('')}
                            </div>` : ''
                        }
                        ${drugs.length > 0 ? 
                            `<div class="text-xs text-gray-600">
                                <span class="font-medium">Drugs mentioned:</span> ${drugs.join(', ')}
                            </div>` : ''
                        }
                        <button onclick="window.enhancedWL.viewLetterDetails('${wl.id || wl.letterId}')" 
                            class="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium">
                            View Full Letter →
                        </button>
                    </div>
                `;
            });
            
            content += '</div></div>';
        }
        
        // Form 483s section
        if (company.form483s.length > 0) {
            content += `
                <div class="mb-6">
                    <h4 class="font-semibold text-lg mb-3 text-yellow-600">Form 483s</h4>
                    <div class="space-y-3">
            `;
            
            company.form483s.forEach(f483 => {
                const isEscalated = company.escalationPaths.some(p => p.f483 === f483);
                
                content += `
                    <div class="border border-yellow-200 rounded-lg p-4 bg-yellow-50 ${isEscalated ? 'ring-2 ring-red-400' : ''}">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <span class="font-medium">${this.formatDate(f483["Record Date"])}</span>
                                <span class="text-sm text-gray-600 ml-2">FEI: ${f483["FEI Number"] || 'N/A'}</span>
                            </div>
                            ${isEscalated ? 
                                '<span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Escalated to WL</span>' : 
                                ''
                            }
                        </div>
                        ${f483["Download"] ? 
                            `<a href="${f483["Download"]}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm">
                                Download PDF →
                            </a>` : 
                            '<span class="text-gray-500 text-sm">No PDF available</span>'
                        }
                        ${isEscalated ?
                            '<div class="text-xs text-red-600 mt-2 font-medium">⚠️ This Form 483 escalated to a Warning Letter</div>' : 
                            ''
                        }
                    </div>
                `;
            });
            
            content += '</div></div>';
        }

        // Timeline section
        if (company.timeline.length > 0) {
            content += `
                <div class="mb-6">
                    <h4 class="font-semibold text-lg mb-3 text-gray-700">Regulatory Timeline</h4>
                    <div class="space-y-2 max-h-64 overflow-y-auto">
            `;
            
            company.timeline.forEach((event, index) => {
                const isEscalated = this.checkForEscalation(event, company.timeline, index);
                
                content += `
                    <div class="flex items-center p-3 rounded-lg ${event.color === 'red' ? 'bg-red-50' : event.color === 'yellow' ? 'bg-yellow-50' : 'bg-blue-50'} ${isEscalated ? 'ring-2 ring-red-400' : ''}">
                        <div class="flex-shrink-0 w-8 h-8 rounded-full ${event.color === 'red' ? 'bg-red-500' : event.color === 'yellow' ? 'bg-yellow-500' : 'bg-blue-500'} flex items-center justify-center text-white text-xs font-bold">
                            ${event.type === 'warning_letter' ? 'WL' : event.type === 'form_483' ? '483' : 'IN'}
                        </div>
                        <div class="ml-3 flex-1">
                            <div class="text-sm font-medium">${event.title}</div>
                            <div class="text-xs text-gray-600">${this.formatDate(event.date)}</div>
                            <div class="text-xs text-gray-500">${this.getEventDetails(event)}</div>
                        </div>
                        ${isEscalated ? 
                            '<div class="text-xs text-red-600 font-medium">⚠️ Escalated</div>' : 
                            ''
                        }
                    </div>
                `;
            });
            
            content += '</div></div>';
        }

        modalContent.innerHTML = content;
        document.getElementById('enhancedDetailModal').classList.remove('hidden');
    },

    // Check if event is part of escalation
    checkForEscalation: function(event, timeline, index) {
        if (event.type !== 'form_483') return false;
        
        // Look for warning letter within next year
        for (let i = index - 1; i >= 0; i--) {
            const nextEvent = timeline[i];
            if (nextEvent.type === 'warning_letter') {
                const daysDiff = (nextEvent.date - event.date) / (1000 * 60 * 60 * 24);
                if (daysDiff > 0 && daysDiff <= 365) {
                    return true;
                }
            }
        }
        
        return false;
    },

    // Get event details
    getEventDetails: function(event) {
        switch(event.type) {
            case 'warning_letter':
                return `${event.data.issuingOffice || 'Unknown Office'} - ${event.data.subject || 'No subject'}`;
            case 'form_483':
                return `FEI: ${event.data["FEI Number"] || 'N/A'} - ${event.data["Legal Name"] || 'Unknown'}`;
            case 'inspection':
                return `${event.data["Project Area"] || 'Unknown Area'} - ${event.data["Inspection Classification"] || 'N/A'}`;
            default:
                return 'Details not available';
        }
    },

    // View individual letter details
    viewLetterDetails: async function(letterId) {
        try {
            // Show loading modal
            const modalContent = document.getElementById('enhancedModalContent');
            modalContent.innerHTML = `
                <div class="flex justify-center items-center py-12">
                    <svg class="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="ml-2">Loading letter details...</span>
                </div>
            `;

            // FIXED: Use relative URL for letter details
            const response = await fetch(`/api/wl/letter/${letterId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const letter = await response.json();
            
            let content = `
                <h3 class="text-xl font-bold mb-4">Warning Letter Details</h3>
                
                <div class="bg-gray-50 p-4 rounded-lg mb-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span class="font-semibold">Company:</span> ${letter.companyName || 'N/A'}
                        </div>
                        <div>
                            <span class="font-semibold">Issue Date:</span> ${this.formatDate(letter.letterIssueDate)}
                        </div>
                        <div>
                            <span class="font-semibold">Issuing Office:</span> ${letter.issuingOffice || 'Unknown'}
                        </div>
                        <div>
                            <span class="font-semibold">Subject:</span> ${letter.subject || 'No subject provided'}
                        </div>
                    </div>
                </div>
                
                <div class="mb-4">
                    <h4 class="font-semibold mb-2">Letter Content:</h4>
                    <div class="bg-white border rounded-lg p-4 max-h-96 overflow-y-auto">
                        <div class="text-sm text-gray-700 whitespace-pre-wrap">${letter.fullContent || letter.excerpt || 'Content not available'}</div>
                    </div>
                </div>
            `;
            
            // Add FDA website link if available
            if (letter.companyUrl) {
                const actionBtn = document.getElementById('enhancedModalAction');
                actionBtn.textContent = 'View on FDA Website';
                actionBtn.onclick = () => window.open(letter.companyUrl, '_blank');
                actionBtn.classList.remove('hidden');
            }
            
            modalContent.innerHTML = content;
            document.getElementById('enhancedDetailModal').classList.remove('hidden');
            
        } catch (error) {
            console.error('Error loading letter details:', error);
            this.showError('Failed to load letter details');
        }
    },

    // Download company report
    downloadCompanyReport: function(companyName) {
        const company = this.state.companies.find(c => c.name === companyName);
        if (!company) return;
        
        let reportContent = `FDA REGULATORY INTELLIGENCE REPORT
=====================================
Generated: ${new Date().toLocaleString()}
Company: ${company.name}
Risk Level: ${company.riskLevel.toUpperCase()}
Escalation Rate: ${company.escalationRate}%

SUMMARY
=======
Total Warning Letters: ${company.warningLetters.length}
Total Form 483s: ${company.form483s.length}
Total Inspections: ${company.inspections.length}
Violation Types: ${Array.from(company.violations).join(', ') || 'None identified'}
Drug/Compound Mentions: ${Array.from(company.drugMentions).join(', ') || 'None identified'}

WARNING LETTERS
===============
${company.warningLetters.length > 0 ? 
    company.warningLetters.map(wl => 
        `Date: ${this.formatDate(wl.letterIssueDate)}
Issuing Office: ${wl.issuingOffice || 'Unknown'}
Subject: ${wl.subject || 'No subject provided'}
${wl.companyUrl ? `FDA URL: ${wl.companyUrl}` : ''}
`).join('\n----------\n') : 
    'No Warning Letters found.'
}

FORM 483s
=========
${company.form483s.length > 0 ? 
    company.form483s.map(f => 
        `Date: ${this.formatDate(f["Record Date"])}
FEI Number: ${f["FEI Number"] || 'N/A'}
Legal Name: ${f["Legal Name"] || 'N/A'}
${f["Download"] ? `Download: ${f["Download"]}` : ''}
`).join('\n----------\n') : 
    'No Form 483s found.'
}

ESCALATION ANALYSIS
==================
${company.escalationPaths.length > 0 ?
    company.escalationPaths.map(path => 
        `Form 483 (${this.formatDate(path.f483["Record Date"])}) → Warning Letter (${this.formatDate(path.warningLetter.letterIssueDate)})
Days between: ${path.daysBetween} days
`).join('\n') :
    'No escalation patterns identified.'
}

FACILITY INFORMATION
===================
${company.inspections.length > 0 ?
    [...new Set(company.inspections.map(i => 
        `${i["City"] || 'Unknown'}, ${i["State"] || ''} ${i["Country/Area"] || ''}`
    ))].join('\n') :
    'No facility information available.'
}

---
This report is generated from publicly available FDA data for regulatory intelligence purposes.
`;
        
        // Create and download file
        const blob = new Blob([reportContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FDA-Report-${company.name.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show success message
        if (window.WLshowToast) {
            window.WLshowToast('Report downloaded successfully!', 'success');
        }
    },

    // Apply filters
    applyFilters: function() {
        this.updateDisplay();
    },

    // Sort table
    sortTable: function(field) {
        if (this.state.currentSort.field === field) {
            this.state.currentSort.direction = 
                this.state.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.state.currentSort.field = field;
            this.state.currentSort.direction = 'asc';
        }
        
        this.updateCompanyTable();
    },

    // Refresh data
    refreshData: function() {
        this.loadData();
    },

    // Export data to CSV
    exportData: function() {
        const csvContent = this.generateCSV();
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FDA-Export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Generate CSV content
    generateCSV: function() {
        let csv = 'Company,Warning Letters,Form 483s,Inspections,Escalation Rate,Risk Level,Drug Mentions,Violations\n';
        
        this.state.companies.forEach(company => {
            csv += `"${company.name}",${company.warningLetters.length},${company.form483s.length},${company.inspections.length},${company.escalationRate}%,${company.riskLevel},"${Array.from(company.drugMentions).join('; ')}","${Array.from(company.violations).join('; ')}"\n`;
        });
        
        return csv;
    },

    // Close modal
    closeModal: function() {
        document.getElementById('enhancedDetailModal').classList.add('hidden');
        document.getElementById('enhancedModalAction').classList.add('hidden');
    },

    // Show loading state
    showLoading: function(show) {
        const loading = document.getElementById('enhancedTableLoading');
        const table = document.getElementById('enhancedCompanyTableBody')?.parentElement;
        
        if (show) {
            loading?.classList.remove('hidden');
            table?.classList.add('opacity-50');
        } else {
            loading?.classList.add('hidden');
            table?.classList.remove('opacity-50');
        }
    },

    // Show error message
    showError: function(message) {
        console.error('Enhanced WL Error:', message);
        
        // Try to show toast notification
        if (window.WLshowToast) {
            window.WLshowToast(message, 'error');
        } else if (window.showToast) {
            window.showToast(message, 'error');
        } else {
            // Fallback to alert
            alert('Error: ' + message);
        }
        
        // Also update the table to show error
        const tbody = document.getElementById('enhancedCompanyTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-red-600">
                        <div class="mb-2">⚠️ Error Loading Data</div>
                        <div class="text-sm">${message}</div>
                        <button onclick="window.enhancedWL.refreshData()" 
                            class="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                            Try Again
                        </button>
                    </td>
                </tr>
            `;
        }
    },

    // Format date helper
    formatDate: function(date) {
        if (!date) return 'Unknown Date';
        
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return date;
            
            return new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }).format(d);
        } catch (e) {
            return date;
        }
    },

    // DEBUGGING METHODS
    debugState: function() {
        console.log('=== Enhanced WL Debug State ===');
        console.log('Selected Companies:', this.state.selectedCompanies);
        console.log('Warning Letters:', this.state.warningLetters.length);
        console.log('Form 483s:', this.state.form483s.length);
        console.log('Inspections:', this.state.inspections.length);
        console.log('Processed Companies:', this.state.companies.length);
        console.log('Current Filters:', this.state.filters);
        
        // Show sample data
        if (this.state.companies.length > 0) {
            console.log('Sample Company Data:', this.state.companies[0]);
        }
        
        return {
            companies: this.state.companies,
            warningLetters: this.state.warningLetters,
            form483s: this.state.form483s,
            inspections: this.state.inspections
        };
    },

    // Test API endpoints
    testAPIs: async function() {
        console.log('=== Testing API Endpoints ===');
        
        // Test warning letters API
        try {
            console.log('Testing /api/wl/search...');
            const wlResponse = await fetch('/api/wl/search?term=test&page=1&perPage=5');
            console.log('Warning Letters API Status:', wlResponse.status);
            if (wlResponse.ok) {
                const wlData = await wlResponse.json();
                console.log('Warning Letters Sample:', wlData);
            }
        } catch (error) {
            console.error('Warning Letters API Error:', error);
        }
        
        // Test inspection data API
        try {
            console.log('Testing /api/inspection-data...');
            const inspResponse = await fetch('/api/inspection-data');
            console.log('Inspection Data API Status:', inspResponse.status);
            if (inspResponse.ok) {
                const inspData = await inspResponse.json();
                console.log('Inspection Data Sample:', {
                    recentInspections: inspData.recentInspections?.length || 0,
                    historicalInspections: inspData.historicalInspections?.length || 0
                });
            }
        } catch (error) {
            console.error('Inspection Data API Error:', error);
        }
    }
};

// Integration with your existing system
window.initializeEnhancedWarningLetters = function(companies) {
    console.log('Initializing enhanced warning letters for:', companies);
    
    // Validate companies input
    if (!companies || !Array.isArray(companies) || companies.length === 0) {
        console.error('Invalid companies provided to enhanced warning letters');
        return;
    }
    
    // Initialize the enhanced system
    try {
        window.enhancedWL.init(companies);
    } catch (error) {
        console.error('Error initializing enhanced warning letters:', error);
        
        // Show fallback error in UI
        const tbody = document.getElementById('enhancedCompanyTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-red-600">
                        <div class="mb-2">❌ Initialization Failed</div>
                        <div class="text-sm">Unable to initialize the enhanced warning letters system.</div>
                        <div class="text-xs text-gray-500 mt-2">Check console for details.</div>
                    </td>
                </tr>
            `;
        }
    }
};

// Debug helper - call this from console to troubleshoot
window.debugEnhancedWL = function() {
    if (window.enhancedWL) {
        return window.enhancedWL.debugState();
    } else {
        console.error('Enhanced WL system not initialized');
        return null;
    }
};

// Test helper - call this from console to test APIs
window.testEnhancedWLAPIs = function() {
    if (window.enhancedWL) {
        return window.enhancedWL.testAPIs();
    } else {
        console.error('Enhanced WL system not initialized');
        return null;
    }
};

console.log('Enhanced Warning Letters System v2.0 Loaded Successfully');
console.log('Debug: window.debugEnhancedWL() | Test APIs: window.testEnhancedWLAPIs()');

// window.enhancedWL = {
//     // State management
//     state: {
//         companies: [],
//         warningLetters: [],
//         form483s: [],
//         inspections: [],
//         filters: {
//             classification: '',
//             dateRange: '',
//             riskLevel: '',
//             drugName: ''
//         },
//         currentSort: { field: 'name', direction: 'asc' },
//         selectedCompanies: []
//     },

//     // Initialize the enhanced system
//     init: function(companies) {
//         console.log('Initializing Enhanced Warning Letter System with companies:', companies);
//         this.state.selectedCompanies = companies;
//         this.setupEventListeners();
//         this.loadData();
//     },

//     // Setup event listeners
//     setupEventListeners: function() {
//         // Filter inputs
//         document.getElementById('enhancedClassificationFilter')?.addEventListener('change', (e) => {
//             this.state.filters.classification = e.target.value;
//         });
        
//         document.getElementById('enhancedDateRangeFilter')?.addEventListener('change', (e) => {
//             this.state.filters.dateRange = e.target.value;
//         });
        
//         document.getElementById('enhancedRiskLevelFilter')?.addEventListener('change', (e) => {
//             this.state.filters.riskLevel = e.target.value;
//         });
        
//         document.getElementById('enhancedDrugSearch')?.addEventListener('input', (e) => {
//             this.state.filters.drugName = e.target.value.toLowerCase();
//         });
//     },

//     // Load all data
//     loadData: async function() {
//         try {
//             this.showLoading(true);
            
//             // Reset counts
//             if (window.regulatoryData) {
//                 window.regulatoryData.resetCounts(this.state.selectedCompanies);
//             }

//             // Fetch all data in parallel
//             const [warningLetters, inspections] = await Promise.all([
//                 this.fetchWarningLetters(),
//                 this.fetchInspectionData()
//             ]);

//             // Process and display data
//             this.processData();
//             this.updateDisplay();
            
//         } catch (error) {
//             console.error('Error loading enhanced warning letter data:', error);
//             this.showError('Failed to load regulatory data');
//         } finally {
//             this.showLoading(false);
//         }
//     },

//     // Fetch warning letters using your existing API
//     fetchWarningLetters: async function() {
//         const allLetters = [];
        
//         for (const company of this.state.selectedCompanies) {
//             try {
//                 const params = new URLSearchParams({
//                     term: company,
//                     field: 'company',
//                     page: 1,
//                     perPage: 100
//                 });

//                 if (this.state.filters.dateRange) {
//                     const daysAgo = parseInt(this.state.filters.dateRange);
//                     const fromDate = new Date();
//                     fromDate.setDate(fromDate.getDate() - daysAgo);
//                     params.append('dateFrom', fromDate.toISOString().split('T')[0]);
//                 }

//                 const response = await fetch(`${API_BASE_URL}/wl/search?${params}`);
//                 const data = await response.json();
                
//                 if (data.results) {
//                     data.results.forEach(letter => {
//                         letter.sourceCompany = company;
//                         allLetters.push(letter);
//                     });
//                 }
//             } catch (error) {
//                 console.error(`Error fetching warning letters for ${company}:`, error);
//             }
//         }

//         this.state.warningLetters = allLetters;
//         return allLetters;
//     },

//     // Fetch inspection data (483s and inspections)
//     fetchInspectionData: async function() {
//         try {
//             const response = await fetch(`${API_BASE_URL}/fda/inspection-data`);
//             const data = await response.json();
            
//             // Filter for selected companies
//             const companyPatterns = this.state.selectedCompanies.map(company => 
//                 new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
//             );

//             // Separate Form 483s from inspections
//             this.state.form483s = data.recentInspections.filter(item => 
//                 item["Record Type"] === "Form 483" &&
//                 companyPatterns.some(pattern => pattern.test(item["Legal Name"] || ''))
//             );

//             this.state.inspections = data.historicalInspections.filter(item =>
//                 companyPatterns.some(pattern => pattern.test(item["Firm Name"] || ''))
//             );

//             return { form483s: this.state.form483s, inspections: this.state.inspections };
//         } catch (error) {
//             console.error('Error fetching inspection data:', error);
//             return { form483s: [], inspections: [] };
//         }
//     },

//     // Process data to build company profiles
//     processData: function() {
//         const companyMap = new Map();

//         // Initialize companies
//         this.state.selectedCompanies.forEach(company => {
//             companyMap.set(company, {
//                 name: company,
//                 warningLetters: [],
//                 form483s: [],
//                 inspections: [],
//                 drugMentions: new Set(),
//                 violations: new Set(),
//                 escalationRate: 0,
//                 riskLevel: 'low',
//                 timeline: [],
//                 escalationPaths: []
//             });
//         });

//         // Process warning letters
//         this.state.warningLetters.forEach(wl => {
//             const company = companyMap.get(wl.sourceCompany);
//             if (company) {
//                 company.warningLetters.push(wl);
                
//                 // Extract drug mentions
//                 const drugs = this.extractDrugMentions(wl);
//                 drugs.forEach(drug => company.drugMentions.add(drug));
                
//                 // Extract violations
//                 const violations = this.detectViolations(wl);
//                 violations.forEach(v => company.violations.add(v));
//             }
//         });

//         // Process Form 483s
//         this.state.form483s.forEach(f483 => {
//             const matchingCompany = Array.from(companyMap.keys()).find(name => 
//                 f483["Legal Name"]?.toLowerCase().includes(name.toLowerCase())
//             );
            
//             if (matchingCompany) {
//                 const company = companyMap.get(matchingCompany);
//                 company.form483s.push(f483);
                
//                 // Track in regulatory data
//                 if (window.regulatoryData) {
//                     window.regulatoryData.form483Counts[matchingCompany] = 
//                         (window.regulatoryData.form483Counts[matchingCompany] || 0) + 1;
//                 }
//             }
//         });

//         // Process inspections
//         this.state.inspections.forEach(inspection => {
//             const matchingCompany = Array.from(companyMap.keys()).find(name => 
//                 inspection["Firm Name"]?.toLowerCase().includes(name.toLowerCase())
//             );
            
//             if (matchingCompany) {
//                 const company = companyMap.get(matchingCompany);
//                 company.inspections.push(inspection);
//             }
//         });

//         // Calculate metrics for each company
//         companyMap.forEach(company => {
//             company.escalationRate = this.calculateEscalationRate(company);
//             company.riskLevel = this.determineRiskLevel(company);
//             company.timeline = this.buildTimeline(company);
//             company.escalationPaths = this.identifyEscalationPaths(company);
//         });

//         this.state.companies = Array.from(companyMap.values());
//     },

//     // Extract drug mentions from content
//     extractDrugMentions: function(item) {
//         const drugs = new Set();
//         const content = (item.fullContent || item.subject || '').toLowerCase();
        
//         // Common drug patterns and specific drug names
//         const drugPatterns = [
//             /\b([a-z]+(?:mab|nib|cept|tide|vir|stat|pril|olol|azole|mycin|sone|zole|ine))\b/gi,
//             /\b(ketamine|fentanyl|morphine|oxycodone|hydrocodone|insulin|heparin|epinephrine|lidocaine|propofol|midazolam)\b/gi,
//             /\b(acetaminophen|ibuprofen|aspirin|metformin|atorvastatin|simvastatin|levothyroxine|lisinopril)\b/gi
//         ];
        
//         drugPatterns.forEach(pattern => {
//             const matches = content.match(pattern);
//             if (matches) {
//                 matches.forEach(match => drugs.add(match.toLowerCase()));
//             }
//         });
        
//         return Array.from(drugs);
//     },

//     // Detect violation types from content
//     detectViolations: function(item) {
//         const violations = new Set();
//         const content = (item.fullContent || item.subject || '').toLowerCase();
        
//         const violationKeywords = {
//             'CGMP': ['cgmp', 'current good manufacturing', 'manufacturing practice', '21 cfr 211'],
//             'Data Integrity': ['data integrity', 'data falsification', 'data manipulation', 'audit trail'],
//             'Misbranding': ['misbranding', 'misbrand', 'labeling violation', 'false or misleading'],
//             'Adulteration': ['adulteration', 'adulterated', 'contamination', 'impurity'],
//             'Sterility': ['sterility', 'sterile', 'aseptic', 'microbial', 'endotoxin'],
//             'Quality Control': ['quality control', 'quality assurance', 'qc failure', 'out of specification'],
//             'Documentation': ['documentation', 'record keeping', 'batch record', 'incomplete records']
//         };
        
//         Object.entries(violationKeywords).forEach(([violation, keywords]) => {
//             if (keywords.some(keyword => content.includes(keyword))) {
//                 violations.add(violation);
//             }
//         });
        
//         return Array.from(violations);
//     },

//     // Calculate escalation rate for a company
//     calculateEscalationRate: function(company) {
//         if (company.form483s.length === 0) return 0;
        
//         let escalations = 0;
//         company.form483s.forEach(f483 => {
//             const f483Date = new Date(f483["Record Date"]);
            
//             const hasEscalation = company.warningLetters.some(wl => {
//                 const wlDate = new Date(wl.letterIssueDate);
//                 const daysDiff = (wlDate - f483Date) / (1000 * 60 * 60 * 24);
//                 return daysDiff > 0 && daysDiff <= 365;
//             });
            
//             if (hasEscalation) escalations++;
//         });
        
//         return Math.round((escalations / company.form483s.length) * 100);
//     },

//     // Identify escalation paths (483 -> WL -> Recall)
//     identifyEscalationPaths: function(company) {
//         const paths = [];
        
//         company.form483s.forEach(f483 => {
//             const f483Date = new Date(f483["Record Date"]);
            
//             // Find related warning letter
//             const relatedWL = company.warningLetters.find(wl => {
//                 const wlDate = new Date(wl.letterIssueDate);
//                 const daysDiff = (wlDate - f483Date) / (1000 * 60 * 60 * 24);
//                 return daysDiff > 0 && daysDiff <= 365;
//             });
            
//             if (relatedWL) {
//                 paths.push({
//                     type: 'escalation',
//                     from: '483',
//                     to: 'WL',
//                     f483: f483,
//                     warningLetter: relatedWL,
//                     daysBetween: Math.round((new Date(relatedWL.letterIssueDate) - f483Date) / (1000 * 60 * 60 * 24))
//                 });
//             }
//         });
        
//         return paths;
//     },

//     // Determine risk level based on regulatory history
//     determineRiskLevel: function(company) {
//         const sixMonthsAgo = new Date();
//         sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
//         const recentWLs = company.warningLetters.filter(wl => 
//             new Date(wl.letterIssueDate) > sixMonthsAgo
//         ).length;
        
//         const recent483s = company.form483s.filter(f => 
//             new Date(f["Record Date"]) > sixMonthsAgo
//         ).length;
        
//         // Multiple violations or high escalation rate = repeat offender
//         if (company.warningLetters.length > 2 || 
//             (recentWLs > 0 && recent483s > 0) ||
//             company.escalationRate > 50) {
//             return 'repeat';
//         } 
//         // Recent violations = recent
//         else if (recentWLs > 0 || recent483s > 0) {
//             return 'recent';
//         } 
//         // Any violations = first-time
//         else if (company.warningLetters.length > 0 || company.form483s.length > 0) {
//             return 'first';
//         }
//         // Has escalated from 483 to WL
//         else if (company.escalationPaths.length > 0) {
//             return 'escalated';
//         }
        
//         return 'first';
//     },

//     // Build regulatory timeline
//     buildTimeline: function(company) {
//         const events = [];
        
//         // Add warning letters
//         company.warningLetters.forEach(wl => {
//             events.push({
//                 type: 'warning_letter',
//                 date: new Date(wl.letterIssueDate),
//                 data: wl,
//                 title: 'Warning Letter',
//                 color: 'red',
//                 icon: '⚠️'
//             });
//         });
        
//         // Add Form 483s
//         company.form483s.forEach(f483 => {
//             events.push({
//                 type: 'form_483',
//                 date: new Date(f483["Record Date"]),
//                 data: f483,
//                 title: 'Form 483',
//                 color: 'yellow',
//                 icon: '📋'
//             });
//         });
        
//         // Add inspections
//         company.inspections.forEach(inspection => {
//             events.push({
//                 type: 'inspection',
//                 date: new Date(inspection["Inspection End Date"]),
//                 data: inspection,
//                 title: `Inspection (${inspection["Inspection Classification"] || 'N/A'})`,
//                 color: 'blue',
//                 icon: '🔍'
//             });
//         });
        
//         // Sort by date (newest first)
//         return events.sort((a, b) => b.date - a.date);
//     },

//     // Filter companies based on current filters
//     filterCompanies: function(companies) {
//         return companies.filter(company => {
//             // Classification filter
//             if (this.state.filters.classification) {
//                 const hasClassification = Array.from(company.violations).some(v => 
//                     v.toLowerCase().includes(this.state.filters.classification.toLowerCase())
//                 );
//                 if (!hasClassification) return false;
//             }
            
//             // Date range filter
//             if (this.state.filters.dateRange) {
//                 const daysAgo = parseInt(this.state.filters.dateRange);
//                 const cutoffDate = new Date();
//                 cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
                
//                 const hasRecentActivity = 
//                     company.warningLetters.some(wl => new Date(wl.letterIssueDate) > cutoffDate) ||
//                     company.form483s.some(f => new Date(f["Record Date"]) > cutoffDate);
                
//                 if (!hasRecentActivity) return false;
//             }
            
//             // Risk level filter
//             if (this.state.filters.riskLevel) {
//                 if (company.riskLevel !== this.state.filters.riskLevel) return false;
//             }
            
//             // Drug name filter
//             if (this.state.filters.drugName) {
//                 const hasDrug = Array.from(company.drugMentions).some(drug => 
//                     drug.toLowerCase().includes(this.state.filters.drugName)
//                 );
//                 if (!hasDrug) return false;
//             }
            
//             return true;
//         });
//     },

//     // Sort companies
//     sortCompanies: function(companies) {
//         const { field, direction } = this.state.currentSort;
        
//         return companies.sort((a, b) => {
//             let aVal, bVal;
            
//             switch(field) {
//                 case 'name':
//                     aVal = a.name.toLowerCase();
//                     bVal = b.name.toLowerCase();
//                     break;
//                 case 'wl':
//                     aVal = a.warningLetters.length;
//                     bVal = b.warningLetters.length;
//                     break;
//                 case 'f483':
//                     aVal = a.form483s.length;
//                     bVal = b.form483s.length;
//                     break;
//                 case 'inspections':
//                     aVal = a.inspections.length;
//                     bVal = b.inspections.length;
//                     break;
//                 default:
//                     return 0;
//             }
            
//             if (direction === 'asc') {
//                 return aVal > bVal ? 1 : -1;
//             } else {
//                 return aVal < bVal ? 1 : -1;
//             }
//         });
//     },

//     // Update all display elements
//     updateDisplay: function() {
//         this.updateSummaryPanel();
//         this.updateCompanyTable();
//         this.updateViolationsChart();
//         this.updateDrugMentions();
//     },

//     // Update summary panel
//     updateSummaryPanel: function() {
//         const totalWL = this.state.warningLetters.length;
//         const total483 = this.state.form483s.length;
//         const companiesAffected = this.state.companies.filter(c => 
//             c.warningLetters.length > 0 || c.form483s.length > 0
//         ).length;
        
//         let overallEscalationRate = 0;
//         if (total483 > 0) {
//             const escalations = this.state.companies.reduce((sum, c) => 
//                 sum + Math.round(c.form483s.length * c.escalationRate / 100), 0
//             );
//             overallEscalationRate = Math.round((escalations / total483) * 100);
//         }
        
//         document.getElementById('enhancedTotalWL').textContent = totalWL;
//         document.getElementById('enhancedCompaniesAffected').textContent = companiesAffected;
//         document.getElementById('enhancedTotal483s').textContent = total483;
//         document.getElementById('enhancedEscalationRate').textContent = overallEscalationRate + '%';
//     },

//     // Update company table
//     updateCompanyTable: function() {
//         const tbody = document.getElementById('enhancedCompanyTableBody');
//         tbody.innerHTML = '';
        
//         // Apply filters
//         let filteredCompanies = this.filterCompanies(this.state.companies);
        
//         // Sort companies
//         filteredCompanies = this.sortCompanies(filteredCompanies);
        
//         // Render rows
//         filteredCompanies.forEach(company => {
//             const row = this.createCompanyRow(company);
//             tbody.appendChild(row);
//         });
        
//         // Show message if no companies
//         if (filteredCompanies.length === 0) {
//             tbody.innerHTML = `
//                 <tr>
//                     <td colspan="7" class="px-6 py-8 text-center text-gray-500">
//                         No companies match the current filters
//                     </td>
//                 </tr>
//             `;
//         }
//     },

//     // Create company table row
//     createCompanyRow: function(company) {
//         const row = document.createElement('tr');
//         row.className = 'hover:bg-gray-50 transition-colors';
        
//         // Risk badges
//         const riskBadges = {
//             'repeat': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-red-600 text-white">Repeat Offender</span>',
//             'recent': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-orange-600 text-white">Recent WL</span>',
//             'first': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-600 text-white">First-Time</span>',
//             'escalated': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-yellow-600 text-white">Escalated</span>'
//         };
        
//         // Escalation pathway visual
//         let escalationPath = '';
//         if (company.escalationPaths.length > 0) {
//             escalationPath = `
//                 <div class="flex items-center justify-center gap-1">
//                     <span class="text-yellow-600">483</span>
//                     <span class="text-gray-400">→</span>
//                     <span class="text-red-600">WL</span>
//                     ${company.escalationPaths.some(p => p.recall) ? 
//                         '<span class="text-gray-400">→</span><span class="text-purple-600">Recall</span>' : 
//                         ''
//                     }
//                 </div>
//             `;
//         } else {
//             escalationPath = '<span class="text-gray-400">-</span>';
//         }
        
//         // Drug mentions preview
//         const drugPreview = company.drugMentions.size > 0 ? 
//             `<div class="text-xs text-gray-500 mt-1">
//                 Drugs: ${Array.from(company.drugMentions).slice(0, 3).join(', ')}
//                 ${company.drugMentions.size > 3 ? ` (+${company.drugMentions.size - 3})` : ''}
//             </div>` : '';
        
//         row.innerHTML = `
//             <td class="px-6 py-4 whitespace-nowrap">
//                 <div>
//                     <div class="text-sm font-medium text-gray-900">${company.name}</div>
//                     ${drugPreview}
//                 </div>
//             </td>
//             <td class="px-6 py-4 whitespace-nowrap text-center">
//                 <span class="text-lg font-semibold text-red-600">${company.warningLetters.length}</span>
//             </td>
//             <td class="px-6 py-4 whitespace-nowrap text-center">
//                 <div>
//                     <span class="text-lg font-semibold text-yellow-600">${company.form483s.length}</span>
//                     ${company.escalationRate > 0 ? 
//                         `<div class="text-xs text-gray-500">${company.escalationRate}% → WL</div>` : 
//                         ''
//                     }
//                 </div>
//             </td>
//             <td class="px-6 py-4 whitespace-nowrap text-center">
//                 <span class="text-sm text-gray-600">${company.inspections.length}</span>
//             </td>
//             <td class="px-6 py-4 whitespace-nowrap text-center">
//                 ${escalationPath}
//             </td>
//             <td class="px-6 py-4 whitespace-nowrap text-center">
//                 ${riskBadges[company.riskLevel]}
//             </td>
//             <td class="px-6 py-4 whitespace-nowrap text-center">
//                 <div class="flex items-center justify-center gap-2">
//                     <button onclick="window.enhancedWL.viewCompanyDetails('${company.name}')" 
//                         class="text-blue-600 hover:text-blue-800 text-sm font-medium">
//                         Details
//                     </button>
//                     <button onclick="window.enhancedWL.showTimeline('${company.name}')" 
//                         class="text-purple-600 hover:text-purple-800 text-sm font-medium">
//                         Timeline
//                     </button>
//                     <button onclick="window.enhancedWL.downloadCompanyReport('${company.name}')" 
//                         class="text-gray-600 hover:text-gray-800 text-sm font-medium">
//                         Report
//                     </button>
//                 </div>
//             </td>
//         `;
        
//         return row;
//     },

//     // Update violations chart
//     updateViolationsChart: function() {
//         const violationCounts = {};
        
//         // Count violations across all companies
//         this.state.companies.forEach(company => {
//             company.violations.forEach(violation => {
//                 violationCounts[violation] = (violationCounts[violation] || 0) + 1;
//             });
//         });
        
//         // Sort by count
//         const sortedViolations = Object.entries(violationCounts)
//             .sort((a, b) => b[1] - a[1])
//             .slice(0, 8);
        
//         const chartContainer = document.getElementById('enhancedViolationsChart');
//         chartContainer.innerHTML = '';
        
//         if (sortedViolations.length === 0) {
//             chartContainer.innerHTML = '<p class="text-gray-500 text-sm">No violations detected</p>';
//             return;
//         }
        
//         const maxCount = Math.max(...sortedViolations.map(v => v[1]));
        
//         sortedViolations.forEach(([violation, count]) => {
//             const percentage = (count / maxCount) * 100;
            
//             const bar = document.createElement('div');
//             bar.className = 'mb-3';
//             bar.innerHTML = `
//                 <div class="flex justify-between text-sm mb-1">
//                     <span class="font-medium">${violation}</span>
//                     <span class="text-gray-600">${count} ${count === 1 ? 'case' : 'cases'}</span>
//                 </div>
//                 <div class="w-full bg-gray-200 rounded-full h-2">
//                     <div class="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500" 
//                          style="width: ${percentage}%"></div>
//                 </div>
//             `;
            
//             chartContainer.appendChild(bar);
//         });
//     },

//     // Update drug mentions
//     updateDrugMentions: function() {
//         const drugCounts = {};
        
//         // Count drug mentions across all companies
//         this.state.companies.forEach(company => {
//             company.drugMentions.forEach(drug => {
//                 drugCounts[drug] = (drugCounts[drug] || 0) + 1;
//             });
//         });
        
//         // Sort by count
//         const sortedDrugs = Object.entries(drugCounts)
//             .sort((a, b) => b[1] - a[1])
//             .slice(0, 10);
        
//         const container = document.getElementById('enhancedDrugMentions');
//         container.innerHTML = '';
        
//         if (sortedDrugs.length === 0) {
//             container.innerHTML = '<p class="text-gray-500 text-sm">No drug mentions found</p>';
//             return;
//         }
        
//         sortedDrugs.forEach(([drug, count]) => {
//             const item = document.createElement('div');
//             item.className = 'flex items-center justify-between py-2 border-b border-gray-100 last:border-0';
//             item.innerHTML = `
//                 <span class="text-sm font-medium capitalize">${drug}</span>
//                 <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
//                     ${count} ${count === 1 ? 'mention' : 'mentions'}
//                 </span>
//             `;
            
//             container.appendChild(item);
//         });
//     },

//     // View company details
//     viewCompanyDetails: function(companyName) {
//         const company = this.state.companies.find(c => c.name === companyName);
//         if (!company) return;
        
//         const modalTitle = document.getElementById('enhancedModalTitle');
//         const modalSubtitle = document.getElementById('enhancedModalSubtitle');
//         const modalContent = document.getElementById('enhancedModalContent');
        
//         modalTitle.textContent = company.name;
//         modalSubtitle.textContent = `Risk Level: ${company.riskLevel.toUpperCase()} | Escalation Rate: ${company.escalationRate}%`;
        
//         let content = '<div class="space-y-6">';
        
//         // Summary section
//         content += `
//             <div class="bg-gray-50 rounded-lg p-4">
//                 <h4 class="font-semibold text-lg mb-3">Regulatory Summary</h4>
//                 <div class="grid grid-cols-3 gap-4">
//                     <div class="text-center">
//                         <div class="text-2xl font-bold text-red-600">${company.warningLetters.length}</div>
//                         <div class="text-sm text-gray-600">Warning Letters</div>
//                     </div>
//                     <div class="text-center">
//                         <div class="text-2xl font-bold text-yellow-600">${company.form483s.length}</div>
//                         <div class="text-sm text-gray-600">Form 483s</div>
//                     </div>
//                     <div class="text-center">
//                         <div class="text-2xl font-bold text-blue-600">${company.inspections.length}</div>
//                         <div class="text-sm text-gray-600">Inspections</div>
//                     </div>
//                 </div>
//             </div>
//         `;
        
//         // Warning Letters section
//         if (company.warningLetters.length > 0) {
//             content += `
//                 <div>
//                     <h4 class="font-semibold text-lg mb-3 text-red-600">Warning Letters</h4>
//                     <div class="space-y-3">
//             `;
            
//             company.warningLetters.forEach(wl => {
//                 const violations = this.detectViolations(wl);
//                 const drugs = this.extractDrugMentions(wl);
                
//                 content += `
//                     <div class="border border-red-200 rounded-lg p-4 bg-red-50">
//                         <div class="flex justify-between items-start mb-2">
//                             <div>
//                                 <span class="font-medium">${this.formatDate(wl.letterIssueDate)}</span>
//                                 <span class="text-sm text-gray-600 ml-2">${wl.issuingOffice || 'Unknown Office'}</span>
//                             </div>
//                             ${wl.companyUrl ?
//                                 `<a href="${wl.companyUrl}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm">
//                                     View on FDA →
//                                 </a>` : ''
//                             }
//                         </div>
//                         <p class="text-sm text-gray-700 mb-2">${wl.subject || 'No subject provided'}</p>
//                         ${violations.length > 0 ? 
//                             `<div class="flex flex-wrap gap-1 mb-2">
//                                 ${violations.map(v => 
//                                     `<span class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">${v}</span>`
//                                 ).join('')}
//                             </div>` : ''
//                         }
//                         ${drugs.length > 0 ? 
//                             `<div class="text-xs text-gray-600">
//                                 <span class="font-medium">Drugs mentioned:</span> ${drugs.join(', ')}
//                             </div>` : ''
//                         }
//                         <button onclick="window.enhancedWL.viewLetterDetails('${wl.id || wl.letterId}')" 
//                             class="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium">
//                             View Full Letter →
//                         </button>
//                     </div>
//                 `;
//             });
            
//             content += '</div></div>';
//         }
        
//         // Form 483s section
//         if (company.form483s.length > 0) {
//             content += `
//                 <div>
//                     <h4 class="font-semibold text-lg mb-3 text-yellow-600">Form 483s</h4>
//                     <div class="space-y-3">
//             `;
            
//             company.form483s.forEach(f483 => {
//                 const isEscalated = company.escalationPaths.some(p => p.f483 === f483);
                
//                 content += `
//                     <div class="border border-yellow-200 rounded-lg p-4 bg-yellow-50 ${isEscalated ? 'ring-2 ring-red-400' : ''}">
//                         <div class="flex justify-between items-start mb-2">
//                             <div>
//                                 <span class="font-medium">${this.formatDate(f483["Record Date"])}</span>
//                                 <span class="text-sm text-gray-600 ml-2">FEI: ${f483["FEI Number"] || 'N/A'}</span>
//                             </div>
//                             ${isEscalated ? 
//                                 '<span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Escalated to WL</span>' : 
//                                 ''
//                             }
//                         </div>
//                         ${f483["Download"] ? 
//                             `<a href="${f483["Download"]}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm">
//                                 Download Form 483 →
//                             </a>` : 
//                             '<span class="text-sm text-gray-500">No download available</span>'
//                         }
//                     </div>
//                 `;
//             });
            
//             content += '</div></div>';
//         }
        
//         // Facility/Location Information
//         if (company.inspections.length > 0) {
//             const facilities = new Set();
//             company.inspections.forEach(insp => {
//                 if (insp["City"] && insp["State"]) {
//                     facilities.add(`${insp["City"]}, ${insp["State"]} ${insp["Country/Area"] || ''}`);
//                 }
//             });
            
//             if (facilities.size > 0) {
//                 content += `
//                     <div>
//                         <h4 class="font-semibold text-lg mb-3">Facility Locations</h4>
//                         <div class="space-y-1">
//                             ${Array.from(facilities).map(location => 
//                                 `<div class="text-sm text-gray-600">📍 ${location.trim()}</div>`
//                             ).join('')}
//                         </div>
//                     </div>
//                 `;
//             }
//         }
        
//         // Drug/Compound Profile
//         if (company.drugMentions.size > 0) {
//             content += `
//                 <div>
//                     <h4 class="font-semibold text-lg mb-3">Drug/Compound Profile</h4>
//                     <div class="flex flex-wrap gap-2">
//                         ${Array.from(company.drugMentions).map(drug => 
//                             `<span class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm capitalize">
//                                 ${drug}
//                             </span>`
//                         ).join('')}
//                     </div>
//                 </div>
//             `;
//         }
        
//         content += '</div>';
        
//         modalContent.innerHTML = content;
//         document.getElementById('enhancedDetailModal').classList.remove('hidden');
//     },
    
//     // Show timeline view
//     showTimeline: function(companyName) {
//         const company = this.state.companies.find(c => c.name === companyName);
//         if (!company) return;
        
//         const modalTitle = document.getElementById('enhancedModalTitle');
//         const modalSubtitle = document.getElementById('enhancedModalSubtitle');
//         const modalContent = document.getElementById('enhancedModalContent');
        
//         modalTitle.textContent = `${company.name} - Regulatory Timeline`;
//         modalSubtitle.textContent = `${company.timeline.length} regulatory events`;
        
//         let content = '<div class="relative">';
        
//         // Timeline line
//         content += '<div class="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-300"></div>';
        
//         // Timeline events
//         company.timeline.forEach((event, index) => {
//             const isEscalation = this.checkForEscalation(event, company.timeline, index);
            
//             content += `
//                 <div class="relative flex items-start mb-6 ${isEscalation ? 'bg-red-50 p-4 rounded-lg -ml-4' : ''}">
//                     <div class="absolute left-6 w-3 h-3 bg-white border-2 border-${event.color}-500 rounded-full -ml-1.5"></div>
//                     <div class="ml-12 flex-grow">
//                         <div class="flex items-center gap-3 mb-1">
//                             <span class="text-2xl">${event.icon}</span>
//                             <span class="font-medium text-sm">${event.title}</span>
//                             <span class="text-sm text-gray-500">${this.formatDate(event.date)}</span>
//                         </div>
//                         <div class="text-sm text-gray-600">
//                             ${this.getEventDetails(event)}
//                         </div>
//                         ${isEscalation ? 
//                             '<div class="text-xs text-red-600 mt-2 font-medium">⚠️ This Form 483 escalated to a Warning Letter</div>' : 
//                             ''
//                         }
//                     </div>
//                 </div>
//             `;
//         });
        
//         content += '</div>';
        
//         modalContent.innerHTML = content;
//         document.getElementById('enhancedDetailModal').classList.remove('hidden');
//     },
    
//     // Check if event is part of escalation
//     checkForEscalation: function(event, timeline, index) {
//         if (event.type !== 'form_483') return false;
        
//         // Look for warning letter within next year
//         for (let i = index - 1; i >= 0; i--) {
//             const nextEvent = timeline[i];
//             if (nextEvent.type === 'warning_letter') {
//                 const daysDiff = (nextEvent.date - event.date) / (1000 * 60 * 60 * 24);
//                 if (daysDiff > 0 && daysDiff <= 365) {
//                     return true;
//                 }
//             }
//         }
        
//         return false;
//     },
    
//     // Get event details
//     getEventDetails: function(event) {
//         switch(event.type) {
//             case 'warning_letter':
//                 return `${event.data.issuingOffice || 'Unknown Office'} - ${event.data.subject || 'No subject'}`;
//             case 'form_483':
//                 return `FEI: ${event.data["FEI Number"] || 'N/A'} - ${event.data["Legal Name"] || 'Unknown'}`;
//             case 'inspection':
//                 return `${event.data["Project Area"] || 'Unknown Area'} - Classification: ${event.data["Inspection Classification"] || 'N/A'}`;
//             default:
//                 return '';
//         }
//     },
    
//     // View full letter details
//     viewLetterDetails: async function(letterId) {
//         try {
//             const response = await fetch(`${API_BASE_URL}/wl/letter/${letterId}`);
//             const letter = await response.json();
            
//             const modalTitle = document.getElementById('enhancedModalTitle');
//             const modalSubtitle = document.getElementById('enhancedModalSubtitle');
//             const modalContent = document.getElementById('enhancedModalContent');
            
//             modalTitle.textContent = letter.companyName || 'Warning Letter';
//             modalSubtitle.textContent = `Issue Date: ${this.formatDate(letter.letterIssueDate)}`;
            
//             let content = '<div class="space-y-4">';
            
//             // Letter metadata
//             content += `
//                 <div class="bg-gray-50 rounded-lg p-4">
//                     <div class="grid grid-cols-2 gap-4 text-sm">
//                         <div>
//                             <span class="text-gray-600">Letter ID:</span>
//                             <span class="font-medium ml-2">${letter.letterId || 'N/A'}</span>
//                         </div>
//                         <div>
//                             <span class="text-gray-600">Issuing Office:</span>
//                             <span class="font-medium ml-2">${letter.issuingOffice || 'Unknown'}</span>
//                         </div>
//                     </div>
//                 </div>
//             `;
            
//             // Subject
//             if (letter.subject) {
//                 content += `
//                     <div>
//                         <h4 class="font-semibold mb-2">Subject</h4>
//                         <p class="text-sm text-gray-700">${letter.subject}</p>
//                     </div>
//                 `;
//             }
            
//             // Full content with drug highlighting
//             if (letter.fullContent) {
//                 let highlightedContent = letter.fullContent;
                
//                 // Highlight drug mentions
//                 const drugs = this.extractDrugMentions(letter);
//                 drugs.forEach(drug => {
//                     const regex = new RegExp(`\\b${drug}\\b`, 'gi');
//                     highlightedContent = highlightedContent.replace(regex, 
//                         `<span class="bg-yellow-200 px-1 rounded">${drug}</span>`
//                     );
//                 });
                
//                 content += `
//                     <div>
//                         <h4 class="font-semibold mb-2">Letter Content</h4>
//                         <div class="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto text-sm whitespace-pre-wrap">
//                             ${highlightedContent}
//                         </div>
//                     </div>
//                 `;
//             }
            
//             content += '</div>';
            
//             // Add action button for FDA link
//             if (letter.companyUrl) {
//                 const actionBtn = document.getElementById('enhancedModalAction');
//                 actionBtn.textContent = 'View on FDA Website';
//                 actionBtn.onclick = () => window.open(letter.companyUrl, '_blank');
//                 actionBtn.classList.remove('hidden');
//             }
            
//             modalContent.innerHTML = content;
//             document.getElementById('enhancedDetailModal').classList.remove('hidden');
            
//         } catch (error) {
//             console.error('Error loading letter details:', error);
//             this.showError('Failed to load letter details');
//         }
//     },
    
//     // Download company report
//     downloadCompanyReport: function(companyName) {
//         const company = this.state.companies.find(c => c.name === companyName);
//         if (!company) return;
        
//         let reportContent = `FDA REGULATORY INTELLIGENCE REPORT
// =====================================
// Generated: ${new Date().toLocaleString()}
// Company: ${company.name}
// Risk Level: ${company.riskLevel.toUpperCase()}
// Escalation Rate: ${company.escalationRate}%

// SUMMARY
// =======
// Total Warning Letters: ${company.warningLetters.length}
// Total Form 483s: ${company.form483s.length}
// Total Inspections: ${company.inspections.length}
// Companies with Violations: ${Array.from(company.violations).join(', ') || 'None identified'}
// Drug/Compound Mentions: ${Array.from(company.drugMentions).join(', ') || 'None identified'}

// WARNING LETTERS
// ===============
// ${company.warningLetters.length > 0 ? 
//     company.warningLetters.map(wl => 
//         `Date: ${this.formatDate(wl.letterIssueDate)}
// Issuing Office: ${wl.issuingOffice || 'Unknown'}
// Subject: ${wl.subject || 'No subject provided'}
// ${wl.companyUrl ? `FDA URL: ${wl.companyUrl}` : ''}
// `).join('\n----------\n') : 
//     'No Warning Letters found.'
// }

// FORM 483s
// =========
// ${company.form483s.length > 0 ? 
//     company.form483s.map(f => 
//         `Date: ${this.formatDate(f["Record Date"])}
// FEI Number: ${f["FEI Number"] || 'N/A'}
// Legal Name: ${f["Legal Name"] || 'N/A'}
// ${f["Download"] ? `Download: ${f["Download"]}` : ''}
// `).join('\n----------\n') : 
//     'No Form 483s found.'
// }

// ESCALATION ANALYSIS
// ==================
// ${company.escalationPaths.length > 0 ?
//     company.escalationPaths.map(path => 
//         `Form 483 (${this.formatDate(path.f483["Record Date"])}) → Warning Letter (${this.formatDate(path.warningLetter.letterIssueDate)})
// Days between: ${path.daysBetween} days
// `).join('\n') :
//     'No escalation patterns identified.'
// }

// FACILITY INFORMATION
// ===================
// ${company.inspections.length > 0 ?
//     [...new Set(company.inspections.map(i => 
//         `${i["City"] || 'Unknown'}, ${i["State"] || ''} ${i["Country/Area"] || ''}`
//     ))].join('\n') :
//     'No facility information available.'
// }

// ---
// This report is generated from publicly available FDA data for regulatory intelligence purposes.
// `;
        
//         // Create and download file
//         const blob = new Blob([reportContent], { type: 'text/plain' });
//         const url = URL.createObjectURL(blob);
//         const a = document.createElement('a');
//         a.href = url;
//         a.download = `FDA-Report-${company.name.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.txt`;
//         document.body.appendChild(a);
//         a.click();
//         document.body.removeChild(a);
//         URL.revokeObjectURL(url);
        
//         // Show success message
//         if (window.WLshowToast) {
//             window.WLshowToast('Report downloaded successfully!', 'success');
//         }
//     },
    
//     // Apply filters
//     applyFilters: function() {
//         this.updateDisplay();
//     },
    
//     // Sort table
//     sortTable: function(field) {
//         if (this.state.currentSort.field === field) {
//             this.state.currentSort.direction = 
//                 this.state.currentSort.direction === 'asc' ? 'desc' : 'asc';
//         } else {
//             this.state.currentSort.field = field;
//             this.state.currentSort.direction = 'asc';
//         }
        
//         this.updateCompanyTable();
//     },
    
//     // Refresh data
//     refreshData: function() {
//         this.loadData();
//     },
    
//     // Export data
//     exportData: function() {
//         const csvContent = this.generateCSV();
        
//         const blob = new Blob([csvContent], { type: 'text/csv' });
//         const url = URL.createObjectURL(blob);
//         const a = document.createElement('a');
//         a.href = url;
//         a.download = `FDA-Export-${new Date().toISOString().split('T')[0]}.csv`;
//         document.body.appendChild(a);
//         a.click();
//         document.body.removeChild(a);
//         URL.revokeObjectURL(url);
//     },
    
//     // Generate CSV content
//     generateCSV: function() {
//         let csv = 'Company,Warning Letters,Form 483s,Inspections,Escalation Rate,Risk Level,Drug Mentions,Violations\n';
        
//         this.state.companies.forEach(company => {
//             csv += `"${company.name}",${company.warningLetters.length},${company.form483s.length},${company.inspections.length},${company.escalationRate}%,${company.riskLevel},"${Array.from(company.drugMentions).join('; ')}","${Array.from(company.violations).join('; ')}"\n`;
//         });
        
//         return csv;
//     },
    
//     // Close modal
//     closeModal: function() {
//         document.getElementById('enhancedDetailModal').classList.add('hidden');
//         document.getElementById('enhancedModalAction').classList.add('hidden');
//     },
    
//     // Show loading state
//     showLoading: function(show) {
//         const loading = document.getElementById('enhancedTableLoading');
//         const table = document.getElementById('enhancedCompanyTableBody').parentElement;
        
//         if (show) {
//             loading?.classList.remove('hidden');
//             table?.classList.add('opacity-50');
//         } else {
//             loading?.classList.add('hidden');
//             table?.classList.remove('opacity-50');
//         }
//     },
    
//     // Show error message
//     showError: function(message) {
//         if (window.WLshowToast) {
//             window.WLshowToast(message, 'error');
//         } else {
//             alert(message);
//         }
//     },
    
//     // Format date helper
//     formatDate: function(date) {
//         return new Intl.DateTimeFormat('en-US', {
//             year: 'numeric',
//             month: 'short',
//             day: 'numeric'
//         }).format(new Date(date));
//     }
// };

// // Integration with your existing searchCompanies function
// // Replace your existing warning letter section initialization with this:
// window.initializeEnhancedWarningLetters = function(companies) {
//     console.log('Initializing enhanced warning letters for:', companies);
//     window.enhancedWL.init(companies);
// };

// // Make sure to call this when companies are selected
// // In your existing searchCompanies function, replace the warning letter section with:
// // window.initializeEnhancedWarningLetters(companies);