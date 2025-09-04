


const express = require('express');
const axios = require('axios');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// API Configuration
const APIS = {
    FDA: 'https://api.fda.gov',
    CLINICALTRIALS: 'https://clinicaltrials.gov/api/v2',
    MESH: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
    RXNORM: 'https://rxnav.nlm.nih.gov',
    PUBCHEM: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug',
    OPENFDA: 'https://api.fda.gov/drug',
    NIH_REPORTER: 'https://api.reporter.nih.gov/v2/projects/search'
};

// Cache configuration
const cache = new Map();
const CACHE_DURATION = 10 * 60 * 1000;

// Default pagination settings
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 1000;

function getCacheKey(type, query, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
    return `${type}:${query.toLowerCase()}:${page}:${pageSize}`;
}

function getFromCache(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    cache.delete(key);
    return null;
}

function setCache(key, data) {
    cache.set(key, {
        data,
        timestamp: Date.now()
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse pagination parameters from request
 */
function getPaginationParams(req) {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.pageSize) || DEFAULT_PAGE_SIZE));
    const offset = (page - 1) * pageSize;
    
    return { page, pageSize, offset };
}

/**
 * MAIN SEARCH FUNCTION WITH PAGINATION
 */
async function searchConditionData(condition, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
    const cacheKey = getCacheKey('condition', condition, page, pageSize);
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
        console.log(`Returning cached data for: ${condition} (page ${page})`);
        return cachedData;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Starting comprehensive regulatory search for: ${condition}`);
    console.log(`📄 Page: ${page}, Page Size: ${pageSize}`);
    console.log(`${'='.repeat(60)}\n`);

    const results = {
        condition: condition,
        timestamp: new Date().toISOString(),
        pagination: {
            current_page: page,
            page_size: pageSize,
            total_pages: {},
            total_counts: {}
        },
        sources: {
            fda_drugs: { data: [], count: 0, total: 0, error: null },
            clinical_trials: { data: [], count: 0, total: 0, error: null },
            failed_drugs: { data: [], count: 0, total: 0, error: null },
            mesh_terms: { data: [], count: 0, total: 0, error: null },
            rxnorm_drugs: { data: [], count: 0, total: 0, error: null },
            pubchem_compounds: { data: [], count: 0, total: 0, error: null },
            pubmed_articles: { data: [], count: 0, total: 0, error: null },
            drug_interactions: { data: [], count: 0, total: 0, error: null },
            adverse_events: { data: [], count: 0, total: 0, error: null },
            fda_recalls: { data: [], count: 0, total: 0, error: null },
            orange_book: { data: [], count: 0, total: 0, error: null },
            purple_book: { data: [], count: 0, total: 0, error: null },
            nih_grants: { data: [], count: 0, total: 0, error: null, total_funding: 0 },
            patents: { data: [], count: 0, total: 0, error: null },
            cms_payments: { data: [], count: 0, total: 0, error: null, total_amount: 0, top_recipients: [] },
            sec_filings: { data: [], count: 0, total: 0, error: null },
            medicare_spending: { data: [], count: 0, total: 0, error: null, total_spending: 0 },
            dailymed_labels: { data: [], count: 0, total: 0, error: null },
            ema_approvals: { data: [], count: 0, total: 0, error: null },
            who_trials: { data: [], count: 0, total: 0, error: null }
        },
        analytics: {
            regulatory_risk_score: null,
            market_opportunity: null,
            competitive_landscape: null,
            patent_landscape: null,
            financial_metrics: null,
            approval_probability: null,
            key_opinion_leaders: null,
            investment_thesis: null
        },
        summary: {
            total_drugs: 0,
            active_trials: 0,
            failed_drugs: 0,
            research_articles: 0,
            compounds_identified: 0,
            patents_found: 0,
            total_nih_funding: 0,
            recalls_count: 0,
            drug_names: [],
            related_conditions: [],
            key_compounds: [],
            safety_concerns: [],
            key_dates: {},
            regulatory_milestones: []
        }
    };

    const offset = (page - 1) * pageSize;

    try {
        // PHASE 1: Core searches with pagination
        console.log('📊 Phase 1: Core drug and trial searches...');
        await Promise.allSettled([
            searchFDADrugs(condition, results, offset, pageSize),
            searchClinicalTrials(condition, results, offset, pageSize),
            searchFailedDrugs(condition, results, offset, pageSize),
            searchMeSHTerms(condition, results, offset, pageSize),
            searchRxNormDrugs(condition, results, offset, pageSize),
            searchFDARecalls(condition, results, offset, pageSize)
        ]);
        
        await delay(200);

        // PHASE 2: Drug-dependent searches
        console.log('📊 Phase 2: Drug-dependent searches...');
        await Promise.allSettled([
            searchPubChemCompounds(condition, results, offset, pageSize),
            searchDrugInteractions(condition, results, offset, pageSize),
            searchAdverseEvents(condition, results, offset, pageSize),
            searchOrangeBook(results, offset, pageSize),
            searchPurpleBook(condition, results, offset, pageSize)
        ]);
        
        await delay(200);

        // PHASE 3: Research searches
        console.log('📊 Phase 3: Research and financial searches...');
        await Promise.allSettled([
            searchNIHGrants(condition, results, offset, pageSize),
            searchPubMedArticles(condition, results, offset, pageSize)
        ]);

        // PHASE 4: Analytics
        console.log('📊 Phase 4: Generating analytics...');
        generateAnalytics(results);
        updateEnhancedSummary(results);
        
        // Calculate total pages for each source
        for (const [key, source] of Object.entries(results.sources)) {
            if (source.total > 0) {
                results.pagination.total_pages[key] = Math.ceil(source.total / pageSize);
                results.pagination.total_counts[key] = source.total;
            }
        }
        
        setCache(cacheKey, results);
        console.log(`\n✅ Search completed successfully!\n`);
        
    } catch (error) {
        console.error('Error in comprehensive search:', error);
    }

    return results;
}

/**
 * FDA DRUG SEARCH WITH PAGINATION
 */
// async function searchFDADrugs(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
//     try {
//         const searchQuery = condition.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '+');
        
//         // First get total count
//         const countUrl = `${APIS.FDA}/drug/label.json`;
//         const countParams = {
//             search: `(indications_and_usage:"${searchQuery}") OR (medical_condition:"${searchQuery}")`,
//             limit: 1,
//             count: 'openfda.brand_name.exact'
//         };

//         const countResponse = await axios.get(countUrl, {
//             params: countParams,
//             timeout: 10000,
//             headers: { 'Accept': 'application/json' }
//         });

//         const totalCount = countResponse.data?.meta?.results?.total || 0;
        
//         // Then get paginated results
//         const labelUrl = `${APIS.FDA}/drug/label.json`;
//         const labelParams = {
//             search: `(indications_and_usage:"${searchQuery}") OR (medical_condition:"${searchQuery}")`,
//             skip: offset,
//             limit: Math.min(limit, 100) // FDA API max is 100 per request
//         };

//         const response = await axios.get(labelUrl, {
//             params: labelParams,
//             timeout: 10000,
//             headers: { 
//                 'User-Agent': 'Regulatory-Intelligence-API/5.0',
//                 'Accept': 'application/json'
//             }
//         });

//         const fdaResults = [];
        
//         if (response.data?.results) {
//             // For limits > 100, we need multiple requests
//             const allResults = [response.data.results];
            
//             if (limit > 100) {
//                 const additionalRequests = Math.ceil((limit - 100) / 100);
//                 for (let i = 1; i <= additionalRequests; i++) {
//                     const additionalParams = {
//                         ...labelParams,
//                         skip: offset + (i * 100),
//                         limit: Math.min(100, limit - (i * 100))
//                     };
                    
//                     try {
//                         const additionalResponse = await axios.get(labelUrl, {
//                             params: additionalParams,
//                             timeout: 10000,
//                             headers: { 'Accept': 'application/json' }
//                         });
                        
//                         if (additionalResponse.data?.results) {
//                             allResults.push(additionalResponse.data.results);
//                         }
//                     } catch (err) {
//                         console.error(`Error fetching additional FDA page ${i}:`, err.message);
//                     }
                    
//                     await delay(100); // Rate limiting
//                 }
//             }
            
//             // Flatten all results
//             const flatResults = allResults.flat();
            
//             flatResults.forEach(item => {
//                 const drugName = item.openfda?.brand_name?.[0] || 
//                                item.openfda?.generic_name?.[0];
                
//                 if (drugName && drugName !== 'Unknown Drug') {
//                     fdaResults.push({
//                         drug_name: drugName,
//                         brand_name: item.openfda?.brand_name?.[0] || null,
//                         generic_name: item.openfda?.generic_name?.[0] || null,
//                         manufacturer: item.openfda?.manufacturer_name?.[0] || null,
//                         dosage_form: item.dosage_form || item.openfda?.dosage_form?.[0] || null,
//                         route: item.openfda?.route?.[0] || null,
//                         substance: item.openfda?.substance_name?.[0] || null,
//                         ndc: item.openfda?.product_ndc?.[0] || null,
//                         application_number: item.openfda?.application_number?.[0] || null,
//                         approval_date: item.effective_time || null,
//                         indications: item.indications_and_usage || null,
//                         warnings: item.warnings || item.boxed_warning || null,
//                         contraindications: item.contraindications || null,
//                         adverse_reactions: item.adverse_reactions || null,
//                         drug_interactions: item.drug_interactions || null,
//                         spl_id: item.id || null,
//                         set_id: item.set_id || null
//                     });
//                 }
//             });
//         }

//         // Remove duplicates by drug name
//         const uniqueDrugs = Array.from(
//             new Map(fdaResults.map(drug => [drug.drug_name.toLowerCase(), drug])).values()
//         );

//         results.sources.fda_drugs.data = uniqueDrugs;
//         results.sources.fda_drugs.count = uniqueDrugs.length;
//         results.sources.fda_drugs.total = totalCount;
//         console.log(`✅ Found ${uniqueDrugs.length} FDA drugs (Total: ${totalCount})`);

//     } catch (error) {
//         console.error('FDA drugs search error:', error.message);
//         results.sources.fda_drugs.error = 'Unable to fetch FDA drug data';
//     }
// }
async function searchFDADrugs(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
    try {
        const searchTerms = condition.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
        
        // Create multiple search strategies
        const searchQueries = [
            // Primary search - broader field coverage
            `(indications_and_usage:(${searchTerms.join(' AND ')}) OR indications_and_usage:(${searchTerms.join(' OR ')}))`,
            
            // Secondary search - generic/brand names and descriptions
            `(openfda.generic_name:(${searchTerms.join(' OR ')}) OR openfda.brand_name:(${searchTerms.join(' OR ')}) OR description:(${searchTerms.join(' OR ')}))`,
            
            // Tertiary search - broader indications
            `(indications_and_usage:${condition} OR description:${condition} OR purpose:${condition})`
        ];

        let allDrugs = new Map(); // Use Map to deduplicate by drug name
        
        for (const searchQuery of searchQueries) {
            try {
                // Get total count for this search
                const countUrl = `${APIS.FDA}/drug/label.json`;
                const countParams = {
                    search: searchQuery,
                    limit: 1
                };

                const countResponse = await axios.get(countUrl, {
                    params: countParams,
                    timeout: 10000,
                    headers: { 'Accept': 'application/json' }
                });

                const totalForThisSearch = countResponse.data?.meta?.results?.total || 0;
                
                if (totalForThisSearch > 0) {
                    // Get actual results
                    const labelUrl = `${APIS.FDA}/drug/label.json`;
                    const labelParams = {
                        search: searchQuery,
                        skip: 0, // Start from beginning for each search
                        limit: Math.min(500, totalForThisSearch) // Get more results per search
                    };

                    const response = await axios.get(labelUrl, {
                        params: labelParams,
                        timeout: 15000,
                        headers: { 
                            'User-Agent': 'Regulatory-Intelligence-API/5.0',
                            'Accept': 'application/json'
                        }
                    });

                    if (response.data?.results) {
                        response.data.results.forEach(item => {
                            const drugName = item.openfda?.brand_name?.[0] || 
                                           item.openfda?.generic_name?.[0] ||
                                           item.openfda?.substance_name?.[0];
                            
                            if (drugName && drugName !== 'Unknown Drug' && !allDrugs.has(drugName.toLowerCase())) {
                                allDrugs.set(drugName.toLowerCase(), {
                                    drug_name: drugName,
                                    brand_name: item.openfda?.brand_name?.[0] || null,
                                    generic_name: item.openfda?.generic_name?.[0] || null,
                                    manufacturer: item.openfda?.manufacturer_name?.[0] || null,
                                    dosage_form: item.dosage_form || item.openfda?.dosage_form?.[0] || null,
                                    route: item.openfda?.route?.[0] || null,
                                    substance: item.openfda?.substance_name?.[0] || null,
                                    ndc: item.openfda?.product_ndc?.[0] || null,
                                    application_number: item.openfda?.application_number?.[0] || null,
                                    approval_date: item.effective_time || null,
                                    indications: item.indications_and_usage || null,
                                    warnings: item.warnings || item.boxed_warning || null,
                                    contraindications: item.contraindications || null,
                                    adverse_reactions: item.adverse_reactions || null,
                                    drug_interactions: item.drug_interactions || null,
                                    spl_id: item.id || null,
                                    set_id: item.set_id || null,
                                    // Additional fields you were missing
                                    dosage_and_administration: item.dosage_and_administration || null,
                                    clinical_pharmacology: item.clinical_pharmacology || null,
                                    mechanism_of_action: item.mechanism_of_action || null,
                                    pharmacokinetics: item.pharmacokinetics || null,
                                    pediatric_use: item.pediatric_use || null,
                                    geriatric_use: item.geriatric_use || null,
                                    pregnancy: item.pregnancy || null,
                                    nursing_mothers: item.nursing_mothers || null
                                });
                            }
                        });
                    }
                }
                
                await delay(300); // Rate limiting between searches
                
            } catch (searchError) {
                console.log(`Search query failed: ${searchQuery.substring(0, 50)}... - ${searchError.message}`);
                continue; // Continue with next search strategy
            }
        }
        
        // Convert Map to Array and apply pagination
        const allDrugsArray = Array.from(allDrugs.values());
        const paginatedDrugs = allDrugsArray.slice(offset, offset + limit);

        results.sources.fda_drugs.data = paginatedDrugs;
        results.sources.fda_drugs.count = paginatedDrugs.length;
        results.sources.fda_drugs.total = allDrugsArray.length;
        
        console.log(`✅ Found ${paginatedDrugs.length} FDA drugs from ${allDrugsArray.length} total unique drugs`);

    } catch (error) {
        console.error('FDA drugs search error:', error.message);
        results.sources.fda_drugs.error = 'Unable to fetch FDA drug data';
    }
}
/**
 * CLINICAL TRIALS SEARCH WITH PAGINATION
 */
// async function searchClinicalTrials(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
//     try {
//         // ClinicalTrials.gov API v2 uses pageSize and pageToken for pagination
//         // First request to get total count
//         const queryParams = new URLSearchParams({
//             'query.cond': condition,
//             'countTotal': 'true',
//             'pageSize': Math.min(limit, 1000), // Max 1000 per page
//             'format': 'json'
//         });

//         const url = `${APIS.CLINICALTRIALS}/studies?${queryParams.toString()}`;
        
//         const response = await axios.get(url, {
//             timeout: 15000,
//             headers: {
//                 'Accept': 'application/json',
//                 'User-Agent': 'Regulatory-Intelligence-API/5.0'
//             }
//         });

//         const trials = [];
//         let totalCount = response.data?.totalCount || 0;
        
//         if (response.data?.studies) {
//             trials.push(...response.data.studies);
//         }
        
//         // If we need more results and there's a nextPageToken
//         if (limit > 1000 && response.data?.nextPageToken) {
//             let nextPageToken = response.data.nextPageToken;
//             let remainingLimit = limit - 1000;
            
//             while (nextPageToken && remainingLimit > 0) {
//                 const nextParams = new URLSearchParams({
//                     'query.cond': condition,
//                     'pageSize': Math.min(remainingLimit, 1000),
//                     'pageToken': nextPageToken,
//                     'format': 'json'
//                 });
                
//                 try {
//                     const nextResponse = await axios.get(`${APIS.CLINICALTRIALS}/studies?${nextParams.toString()}`, {
//                         timeout: 15000,
//                         headers: { 'Accept': 'application/json' }
//                     });
                    
//                     if (nextResponse.data?.studies) {
//                         trials.push(...nextResponse.data.studies);
//                     }
                    
//                     nextPageToken = nextResponse.data?.nextPageToken;
//                     remainingLimit -= 1000;
                    
//                     await delay(100); // Rate limiting
//                 } catch (err) {
//                     console.error('Error fetching additional trial page:', err.message);
//                     break;
//                 }
//             }
//         }
        
//         // Process trials for offset (since API doesn't support skip)
//         const paginatedTrials = trials.slice(offset, offset + limit);
        
//         const processedTrials = paginatedTrials.map(study => {
//             const protocol = study.protocolSection || {};
//             const identification = protocol.identificationModule || {};
//             const status = protocol.statusModule || {};
//             const design = protocol.designModule || {};
//             const conditions = protocol.conditionsModule || {};
//             const interventions = protocol.armsInterventionsModule || {};
//             const sponsors = protocol.sponsorCollaboratorsModule || {};
//             const outcomes = protocol.outcomesModule || {};
//             const eligibility = protocol.eligibilityModule || {};
            
//             return {
//                 nct_id: identification.nctId,
//                 title: identification.briefTitle,
//                 official_title: identification.officialTitle,
//                 status: status.overallStatus,
//                 why_stopped: status.whyStopped,
//                 start_date: status.startDateStruct?.date,
//                 completion_date: status.primaryCompletionDateStruct?.date,
//                 last_update: status.lastUpdateSubmitDate,
//                 phase: design.phases?.[0],
//                 study_type: design.studyType,
//                 enrollment: design.enrollmentInfo?.count,
//                 allocation: design.designInfo?.allocation,
//                 intervention_model: design.designInfo?.interventionModel,
//                 primary_purpose: design.designInfo?.primaryPurpose,
//                 masking: design.designInfo?.maskingInfo?.masking,
//                 conditions: conditions.conditions || [],
//                 interventions: interventions.interventions?.map(i => ({
//                     type: i.type,
//                     name: i.name,
//                     description: i.description
//                 })) || [],
//                 lead_sponsor: sponsors.leadSponsor?.name,
//                 sponsor: sponsors.leadSponsor?.name,
//                 collaborators: sponsors.collaborators?.map(c => c.name) || [],
//                 primary_outcomes: outcomes.primaryOutcomes?.map(o => ({
//                     measure: o.measure,
//                     time_frame: o.timeFrame,
//                     description: o.description
//                 })) || [],
//                 secondary_outcomes: outcomes.secondaryOutcomes?.map(o => ({
//                     measure: o.measure,
//                     time_frame: o.timeFrame
//                 })) || [],
//                 min_age: eligibility.minimumAge,
//                 max_age: eligibility.maximumAge,
//                 gender: eligibility.sex,
//                 healthy_volunteers: eligibility.healthyVolunteers,
//                 eligibility_criteria: eligibility.eligibilityCriteria
//             };
//         });

//         results.sources.clinical_trials.data = processedTrials;
//         results.sources.clinical_trials.count = processedTrials.length;
//         results.sources.clinical_trials.total = totalCount;
//         console.log(`✅ Found ${processedTrials.length} clinical trials (Total: ${totalCount})`);

//     } catch (error) {
//         console.error('Clinical Trials error:', error.message);
//         results.sources.clinical_trials.error = 'Unable to fetch clinical trials';
//     }
// }
// Replace the searchClinicalTrials function in newconditions.js
async function searchClinicalTrials(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
    try {
        // Multiple search strategies to catch all relevant trials
        const searchQueries = [
            // Primary condition search
            `query.cond=${encodeURIComponent(condition)}`,
            
            // Intervention/treatment search
            `query.intr=${encodeURIComponent(condition)}`,
            
            // Title/keyword search
            `query.titles=${encodeURIComponent(condition)}`,
            
            // Advanced search combining multiple fields
            `query.advanced=(AREA[Condition]${condition}) OR (AREA[InterventionName]${condition}) OR (AREA[Keyword]${condition})`
        ];

        let allTrials = new Map();
        let maxTotalCount = 0;

        for (const searchQuery of searchQueries) {
            try {
                // Get total count first
                const countParams = `${searchQuery}&countTotal=true&pageSize=1&format=json`;
                const countUrl = `${APIS.CLINICALTRIALS}/studies?${countParams}`;
                
                const countResponse = await axios.get(countUrl, {
                    timeout: 15000,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Regulatory-Intelligence-API/5.0'
                    }
                });

                const totalCount = countResponse.data?.totalCount || 0;
                maxTotalCount = Math.max(maxTotalCount, totalCount);
                
                if (totalCount > 0) {
                    // Get actual results - fetch more to avoid missing trials
                    const queryParams = `${searchQuery}&pageSize=1000&format=json`;
                    const url = `${APIS.CLINICALTRIALS}/studies?${queryParams}`;
                    
                    const response = await axios.get(url, {
                        timeout: 20000,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Regulatory-Intelligence-API/5.0'
                        }
                    });
                    
                    if (response.data?.studies) {
                        response.data.studies.forEach(study => {
                            const nctId = study.protocolSection?.identificationModule?.nctId;
                            if (nctId && !allTrials.has(nctId)) {
                                const protocol = study.protocolSection || {};
                                const identification = protocol.identificationModule || {};
                                const status = protocol.statusModule || {};
                                const design = protocol.designModule || {};
                                const conditions = protocol.conditionsModule || {};
                                const interventions = protocol.armsInterventionsModule || {};
                                const sponsors = protocol.sponsorCollaboratorsModule || {};
                                const outcomes = protocol.outcomesModule || {};
                                const eligibility = protocol.eligibilityModule || {};
                                const contacts = protocol.contactsLocationsModule || {};
                                
                                allTrials.set(nctId, {
                                    nct_id: nctId,
                                    title: identification.briefTitle,
                                    official_title: identification.officialTitle,
                                    status: status.overallStatus,
                                    why_stopped: status.whyStopped,
                                    start_date: status.startDateStruct?.date,
                                    completion_date: status.primaryCompletionDateStruct?.date,
                                    study_completion_date: status.completionDateStruct?.date,
                                    last_update: status.lastUpdateSubmitDate,
                                    phase: design.phases?.[0],
                                    study_type: design.studyType,
                                    enrollment: design.enrollmentInfo?.count,
                                    allocation: design.designInfo?.allocation,
                                    intervention_model: design.designInfo?.interventionModel,
                                    primary_purpose: design.designInfo?.primaryPurpose,
                                    masking: design.designInfo?.maskingInfo?.masking,
                                    conditions: conditions.conditions || [],
                                    keywords: conditions.keywords || [],
                                    interventions: interventions.interventions?.map(i => ({
                                        type: i.type,
                                        name: i.name,
                                        description: i.description,
                                        other_names: i.otherNames || []
                                    })) || [],
                                    lead_sponsor: sponsors.leadSponsor?.name,
                                    lead_sponsor_class: sponsors.leadSponsor?.class,
                                    sponsor: sponsors.leadSponsor?.name,
                                    collaborators: sponsors.collaborators?.map(c => ({
                                        name: c.name,
                                        class: c.class
                                    })) || [],
                                    primary_outcomes: outcomes.primaryOutcomes?.map(o => ({
                                        measure: o.measure,
                                        time_frame: o.timeFrame,
                                        description: o.description
                                    })) || [],
                                    secondary_outcomes: outcomes.secondaryOutcomes?.map(o => ({
                                        measure: o.measure,
                                        time_frame: o.timeFrame,
                                        description: o.description
                                    })) || [],
                                    min_age: eligibility.minimumAge,
                                    max_age: eligibility.maximumAge,
                                    gender: eligibility.sex,
                                    healthy_volunteers: eligibility.healthyVolunteers,
                                    eligibility_criteria: eligibility.eligibilityCriteria,
                                    // Additional fields you were missing
                                    study_first_posted: status.studyFirstPostDateStruct?.date,
                                    last_update_posted: status.lastUpdatePostDateStruct?.date,
                                    results_first_posted: status.resultsFirstPostDateStruct?.date,
                                    has_expanded_access: design.hasExpandedAccess,
                                    locations: contacts.locations?.map(loc => ({
                                        facility: loc.facility,
                                        city: loc.city,
                                        state: loc.state,
                                        country: loc.country,
                                        status: loc.status
                                    })) || [],
                                    responsible_party: sponsors.responsibleParty
                                });
                            }
                        });
                    }
                }
                
                await delay(300); // Rate limiting between searches
                
            } catch (searchError) {
                console.log(`Clinical trial search failed for query: ${searchQuery} - ${searchError.message}`);
                continue;
            }
        }
        
        // Convert to array and apply pagination
        const allTrialsArray = Array.from(allTrials.values());
        const paginatedTrials = allTrialsArray.slice(offset, offset + limit);

        results.sources.clinical_trials.data = paginatedTrials;
        results.sources.clinical_trials.count = paginatedTrials.length;
        results.sources.clinical_trials.total = Math.max(maxTotalCount, allTrialsArray.length);
        
        console.log(`✅ Found ${paginatedTrials.length} clinical trials from ${allTrialsArray.length} total unique trials (Max API total: ${maxTotalCount})`);

    } catch (error) {
        console.error('Clinical Trials error:', error.message);
        results.sources.clinical_trials.error = 'Unable to fetch clinical trials';
    }
}
// async function searchClinicalTrials(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
//     try {
//         // Calculate how many pages we need to skip
//         const pageSize = Math.min(1000, limit); // ClinicalTrials.gov max is 1000
//         const pagesToSkip = Math.floor(offset / pageSize);
        
//         // First, get the total count
//         const countParams = new URLSearchParams({
//             'query.cond': condition,
//             'countTotal': 'true',
//             'pageSize': 1, // Just need count
//             'format': 'json'
//         });

//         const countUrl = `${APIS.CLINICALTRIALS}/studies?${countParams.toString()}`;
//         const countResponse = await axios.get(countUrl, {
//             timeout: 15000,
//             headers: {
//                 'Accept': 'application/json',
//                 'User-Agent': 'Regulatory-Intelligence-API/5.0'
//             }
//         });

//         const totalCount = countResponse.data?.totalCount || 0;
        
//         // Now get the actual page we need
//         const queryParams = new URLSearchParams({
//             'query.cond': condition,
//             'pageSize': pageSize,
//             'format': 'json'
//         });

//         // If we need to skip pages, use pageToken navigation
//         let currentPageToken = null;
//         let trials = [];
        
//         // Skip to the right page by iterating through pageTokens
//         if (pagesToSkip > 0) {
//             let skipCount = 0;
//             let nextToken = null;
            
//             // Navigate to the correct page
//             for (let i = 0; i < pagesToSkip; i++) {
//                 const skipParams = new URLSearchParams({
//                     'query.cond': condition,
//                     'pageSize': pageSize,
//                     'format': 'json'
//                 });
                
//                 if (nextToken) {
//                     skipParams.append('pageToken', nextToken);
//                 }
                
//                 const skipResponse = await axios.get(
//                     `${APIS.CLINICALTRIALS}/studies?${skipParams.toString()}`,
//                     {
//                         timeout: 15000,
//                         headers: { 'Accept': 'application/json' }
//                     }
//                 );
                
//                 nextToken = skipResponse.data?.nextPageToken;
//                 skipCount++;
                
//                 if (!nextToken) break; // No more pages
                
//                 await delay(100); // Rate limiting
//             }
            
//             currentPageToken = nextToken;
//         }
        
//         // Now fetch the actual page we want
//         if (currentPageToken) {
//             queryParams.append('pageToken', currentPageToken);
//         }
        
//         const url = `${APIS.CLINICALTRIALS}/studies?${queryParams.toString()}`;
//         const response = await axios.get(url, {
//             timeout: 15000,
//             headers: {
//                 'Accept': 'application/json',
//                 'User-Agent': 'Regulatory-Intelligence-API/5.0'
//             }
//         });
        
//         if (response.data?.studies) {
//             trials = response.data.studies;
//         }
        
//         // Handle remainder if offset isn't aligned with pageSize
//         const remainderOffset = offset % pageSize;
//         if (remainderOffset > 0) {
//             trials = trials.slice(remainderOffset);
//         }
        
//         // Trim to exact limit requested
//         trials = trials.slice(0, limit);
        
//         // If we need more results and there's a nextPageToken, fetch additional pages
//         if (trials.length < limit && response.data?.nextPageToken) {
//             let nextPageToken = response.data.nextPageToken;
//             let remainingLimit = limit - trials.length;
            
//             while (nextPageToken && remainingLimit > 0) {
//                 const nextParams = new URLSearchParams({
//                     'query.cond': condition,
//                     'pageSize': Math.min(remainingLimit, pageSize),
//                     'pageToken': nextPageToken,
//                     'format': 'json'
//                 });
                
//                 try {
//                     const nextResponse = await axios.get(
//                         `${APIS.CLINICALTRIALS}/studies?${nextParams.toString()}`,
//                         {
//                             timeout: 15000,
//                             headers: { 'Accept': 'application/json' }
//                         }
//                     );
                    
//                     if (nextResponse.data?.studies) {
//                         const additionalTrials = nextResponse.data.studies.slice(0, remainingLimit);
//                         trials.push(...additionalTrials);
//                         remainingLimit -= additionalTrials.length;
//                     }
                    
//                     nextPageToken = nextResponse.data?.nextPageToken;
                    
//                     if (!nextPageToken || nextResponse.data?.studies?.length === 0) break;
                    
//                     await delay(100); // Rate limiting
//                 } catch (err) {
//                     console.error('Error fetching additional trial page:', err.message);
//                     break;
//                 }
//             }
//         }
        
//         // Process the trials
//         const processedTrials = trials.map(study => {
//             const protocol = study.protocolSection || {};
//             const identification = protocol.identificationModule || {};
//             const status = protocol.statusModule || {};
//             const design = protocol.designModule || {};
//             const conditions = protocol.conditionsModule || {};
//             const interventions = protocol.armsInterventionsModule || {};
//             const sponsors = protocol.sponsorCollaboratorsModule || {};
//             const outcomes = protocol.outcomesModule || {};
//             const eligibility = protocol.eligibilityModule || {};
            
//             return {
//                 nct_id: identification.nctId,
//                 title: identification.briefTitle,
//                 official_title: identification.officialTitle,
//                 status: status.overallStatus,
//                 why_stopped: status.whyStopped,
//                 start_date: status.startDateStruct?.date,
//                 completion_date: status.primaryCompletionDateStruct?.date,
//                 last_update: status.lastUpdateSubmitDate,
//                 phase: design.phases?.[0],
//                 study_type: design.studyType,
//                 enrollment: design.enrollmentInfo?.count,
//                 allocation: design.designInfo?.allocation,
//                 intervention_model: design.designInfo?.interventionModel,
//                 primary_purpose: design.designInfo?.primaryPurpose,
//                 masking: design.designInfo?.maskingInfo?.masking,
//                 conditions: conditions.conditions || [],
//                 interventions: interventions.interventions?.map(i => ({
//                     type: i.type,
//                     name: i.name,
//                     description: i.description
//                 })) || [],
//                 lead_sponsor: sponsors.leadSponsor?.name,
//                 sponsor: sponsors.leadSponsor?.name,
//                 collaborators: sponsors.collaborators?.map(c => c.name) || [],
//                 primary_outcomes: outcomes.primaryOutcomes?.map(o => ({
//                     measure: o.measure,
//                     time_frame: o.timeFrame,
//                     description: o.description
//                 })) || [],
//                 secondary_outcomes: outcomes.secondaryOutcomes?.map(o => ({
//                     measure: o.measure,
//                     time_frame: o.timeFrame
//                 })) || [],
//                 min_age: eligibility.minimumAge,
//                 max_age: eligibility.maximumAge,
//                 gender: eligibility.sex,
//                 healthy_volunteers: eligibility.healthyVolunteers,
//                 eligibility_criteria: eligibility.eligibilityCriteria
//             };
//         });

//         results.sources.clinical_trials.data = processedTrials;
//         results.sources.clinical_trials.count = processedTrials.length;
//         results.sources.clinical_trials.total = totalCount;
        
//         console.log(`✅ Found ${processedTrials.length} clinical trials (Total: ${totalCount}, Page offset: ${offset})`);

//     } catch (error) {
//         console.error('Clinical Trials error:', error.message);
//         results.sources.clinical_trials.error = 'Unable to fetch clinical trials';
//     }
// }
/**
 * NIH GRANTS SEARCH WITH PAGINATION
 */
async function searchNIHGrants(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
    try {
        const url = APIS.NIH_REPORTER;
        const currentYear = new Date().getFullYear();
        const payload = {
            criteria: {
                text_search: {
                    operator: "and",
                    terms: [condition]
                },
                fiscal_years: [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear],
                exclude_subprojects: false
            },
            limit: limit,
            offset: offset
        };

        const response = await axios.post(url, payload, {
            timeout: 15000,
            headers: { 
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        const grants = [];
        let totalFunding = 0;
        
        if (response.data?.results) {
            response.data.results.forEach(grant => {
                const grantData = {
                    project_number: grant.project_number,
                    project_title: grant.project_title,
                    abstract_text: grant.abstract_text,
                    principal_investigator: grant.principal_investigators?.[0]?.full_name,
                    organization: grant.organization?.org_name,
                    organization_city: grant.organization?.org_city,
                    organization_state: grant.organization?.org_state,
                    fiscal_year: grant.fiscal_year,
                    award_amount: grant.award_amount || 0,
                    total_cost: grant.total_cost || grant.award_amount || 0,
                    project_start_date: grant.project_start_date,
                    project_end_date: grant.project_end_date,
                    funding_mechanism: grant.funding_mechanism,
                    activity_code: grant.activity_code,
                    is_clinical_trial: grant.is_clinical_trial,
                    clinicaltrials_ids: grant.clinicaltrials_ids || [],
                    pubmed_ids: grant.pubmed_ids || []
                };
                
                grants.push(grantData);
                totalFunding += grantData.total_cost;
            });
        }

        results.sources.nih_grants.data = grants;
        results.sources.nih_grants.count = grants.length;
        results.sources.nih_grants.total = response.data?.meta?.total || grants.length;
        results.sources.nih_grants.total_funding = totalFunding;
        console.log(`✅ Found ${grants.length} NIH grants totaling $${totalFunding.toLocaleString()}`);
        
    } catch (error) {
        console.error('NIH Grants error:', error.message);
        results.sources.nih_grants.data = [];
        results.sources.nih_grants.count = 0;
        results.sources.nih_grants.total = 0;
        results.sources.nih_grants.total_funding = 0;
    }
}

/**
 * PUBMED ARTICLES SEARCH WITH PAGINATION
 */
async function searchPubMedArticles(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
    try {
        const currentYear = new Date().getFullYear();
        const fiveYearsAgo = currentYear - 5;
        
        // First get total count
        const searchParams = new URLSearchParams({
            db: 'pubmed',
            term: `${condition}[Title/Abstract] AND (${fiveYearsAgo}:${currentYear}[DP])`,
            retmode: 'json',
            retmax: 0 // Just get count
        });

        const countUrl = `${APIS.MESH}/esearch.fcgi?${searchParams.toString()}`;
        const countResponse = await axios.get(countUrl, {
            timeout: 10000,
            headers: { 'Accept': 'application/json' }
        });
        
        const totalCount = parseInt(countResponse.data?.esearchresult?.count) || 0;
        
        // Now get actual results with pagination
        const searchParamsWithResults = new URLSearchParams({
            db: 'pubmed',
            term: `${condition}[Title/Abstract] AND (${fiveYearsAgo}:${currentYear}[DP])`,
            retmode: 'json',
            retstart: offset,
            retmax: limit,
            sort: 'relevance'
        });

        const searchUrl = `${APIS.MESH}/esearch.fcgi?${searchParamsWithResults.toString()}`;
        
        const searchResponse = await axios.get(searchUrl, {
            timeout: 10000,
            headers: { 'Accept': 'application/json' }
        });
        
        if (searchResponse.data?.esearchresult?.idlist?.length > 0) {
            const pmids = searchResponse.data.esearchresult.idlist;
            
            // Get summaries for all PMIDs
            const summaryParams = new URLSearchParams({
                db: 'pubmed',
                id: pmids.join(','),
                retmode: 'json'
            });

            const summaryUrl = `${APIS.MESH}/esummary.fcgi?${summaryParams.toString()}`;
            
            const summaryResponse = await axios.get(summaryUrl, {
                timeout: 10000,
                headers: { 'Accept': 'application/json' }
            });

            const articles = [];
            
            if (summaryResponse.data?.result) {
                for (const pmid of pmids) {
                    const article = summaryResponse.data.result[pmid];
                    if (article && article.title) {
                        articles.push({
                            pmid: pmid,
                            title: article.title,
                            authors: article.authors?.map(a => a.name).join(', '),
                            journal: article.source,
                            publication_date: article.pubdate,
                            publication_type: article.pubtype?.join(', '),
                            doi: article.elocationid,
                            has_abstract: article.hasabstract === 1,
                            pubmed_url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
                            pmc_id: article.pmcrefcount > 0 ? `PMC available` : null
                        });
                    }
                }
            }

            results.sources.pubmed_articles.data = articles;
            results.sources.pubmed_articles.count = articles.length;
            results.sources.pubmed_articles.total = totalCount;
            console.log(`✅ Found ${totalCount} PubMed articles (showing ${articles.length})`);
        }
    } catch (error) {
        console.error('PubMed articles error:', error.message);
        results.sources.pubmed_articles.data = [];
        results.sources.pubmed_articles.count = 0;
        results.sources.pubmed_articles.total = 0;
    }
}

// Other search functions updated similarly...
async function searchFailedDrugs(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
    try {
        const queryParams = new URLSearchParams({
            'query.cond': condition,
            'query.term': 'AREA[OverallStatus](TERMINATED OR WITHDRAWN OR SUSPENDED)',
            'pageSize': Math.min(limit, 1000),
            'format': 'json'
        });

        const url = `${APIS.CLINICALTRIALS}/studies?${queryParams.toString()}`;
        
        const response = await axios.get(url, {
            timeout: 10000,
            headers: { 'Accept': 'application/json' }
        });

        const failedTrials = [];
        
        if (response.data?.studies) {
            // Process with offset since API doesn't support skip
            const paginatedStudies = response.data.studies.slice(offset, offset + limit);
            
            paginatedStudies.forEach(study => {
                const protocol = study.protocolSection || {};
                const status = protocol.statusModule || {};
                const identification = protocol.identificationModule || {};
                const design = protocol.designModule || {};
                const sponsors = protocol.sponsorCollaboratorsModule || {};
                const interventions = protocol.armsInterventionsModule || {};
                
                failedTrials.push({
                    nct_id: identification.nctId,
                    drug_name: identification.briefTitle,
                    status: status.overallStatus,
                    why_stopped: status.whyStopped || 'Reason not provided',
                    phase: design.phases?.[0],
                    sponsor: sponsors.leadSponsor?.name,
                    start_date: status.startDateStruct?.date,
                    stop_date: status.completionDateStruct?.date,
                    enrollment: design.enrollmentInfo?.count || 0,
                    intervention: interventions.interventions?.[0]?.name
                });
            });
        }

        results.sources.failed_drugs.data = failedTrials;
        results.sources.failed_drugs.count = failedTrials.length;
        results.sources.failed_drugs.total = response.data?.totalCount || failedTrials.length;
        console.log(`✅ Found ${failedTrials.length} failed/terminated trials (Total: ${results.sources.failed_drugs.total})`);
        
    } catch (error) {
        console.error('Failed drugs search error:', error.message);
        results.sources.failed_drugs.error = 'Unable to fetch failed trials';
    }
}

async function searchMeSHTerms(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
    try {
        const searchParams = new URLSearchParams({
            db: 'mesh',
            term: condition,
            retmode: 'json',
            retstart: offset,
            retmax: limit
        });

        const searchUrl = `${APIS.MESH}/esearch.fcgi?${searchParams.toString()}`;
        
        const searchResponse = await axios.get(searchUrl, { 
            timeout: 10000,
            headers: { 'Accept': 'application/json' }
        });
        
        if (searchResponse.data?.esearchresult?.idlist?.length > 0) {
            const meshIds = searchResponse.data.esearchresult.idlist;
            
            const summaryParams = new URLSearchParams({
                db: 'mesh',
                id: meshIds.join(','),
                retmode: 'json'
            });

            const summaryUrl = `${APIS.MESH}/esummary.fcgi?${summaryParams.toString()}`;
            
            const summaryResponse = await axios.get(summaryUrl, { 
                timeout: 10000,
                headers: { 'Accept': 'application/json' }
            });

            if (summaryResponse.data?.result) {
                const meshTerms = [];
                
                for (const [key, value] of Object.entries(summaryResponse.data.result)) {
                    if (key !== 'uids' && value.uid) {
                        meshTerms.push({
                            mesh_id: value.uid,
                            term: value.ds_meshterms?.[0] || value.title || condition,
                            scope_note: value.ds_scopenote,
                            tree_numbers: value.ds_idxlinks || []
                        });
                    }
                }

                results.sources.mesh_terms.data = meshTerms;
                results.sources.mesh_terms.count = meshTerms.length;
                results.sources.mesh_terms.total = parseInt(searchResponse.data.esearchresult.count) || meshTerms.length;
                console.log(`✅ Found ${meshTerms.length} MeSH terms (Total: ${results.sources.mesh_terms.total})`);
            }
        }

    } catch (error) {
        console.error('MeSH Terms error:', error.message);
        results.sources.mesh_terms.data = [];
        results.sources.mesh_terms.count = 0;
        results.sources.mesh_terms.total = 0;
    }
}

async function searchRxNormDrugs(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
    try {
        const searchUrl = `${APIS.RXNORM}/REST/drugs.json`;
        const params = { name: condition };

        const response = await axios.get(searchUrl, {
            params,
            timeout: 10000,
            headers: { 'Accept': 'application/json' }
        });

        if (response.data?.drugGroup?.conceptGroup) {
            const drugs = [];
            let totalCount = 0;
            
            for (const group of response.data.drugGroup.conceptGroup) {
                if (group.conceptProperties) {
                    totalCount += group.conceptProperties.length;
                    
                    // Apply pagination
                    const paginatedDrugs = group.conceptProperties.slice(offset, offset + limit);
                    
                    for (const drug of paginatedDrugs) {
                        drugs.push({
                            rxcui: drug.rxcui,
                            name: drug.name,
                            synonym: drug.synonym,
                            tty: drug.tty,
                            language: drug.language,
                            suppress: drug.suppress,
                            umlscui: drug.umlscui
                        });
                    }
                }
            }

            results.sources.rxnorm_drugs.data = drugs;
            results.sources.rxnorm_drugs.count = drugs.length;
            results.sources.rxnorm_drugs.total = totalCount;
            console.log(`✅ Found ${drugs.length} RxNorm drugs (Total: ${totalCount})`);
        }
    } catch (error) {
        console.error('RxNorm search error:', error.message);
        results.sources.rxnorm_drugs.data = [];
        results.sources.rxnorm_drugs.count = 0;
        results.sources.rxnorm_drugs.total = 0;
    }
}

async function searchFDARecalls(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
    try {
        const url = `${APIS.FDA}/drug/enforcement.json`;
        const params = {
            search: `reason_for_recall:"${condition}" OR product_description:"${condition}"`,
            skip: offset,
            limit: Math.min(limit, 100)
        };

        const response = await axios.get(url, {
            params,
            timeout: 10000,
            headers: { 'Accept': 'application/json' }
        });

        const recalls = [];
        
        if (response.data?.results) {
            response.data.results.forEach(recall => {
                recalls.push({
                    recall_number: recall.recall_number,
                    status: recall.status,
                    product_description: recall.product_description,
                    reason_for_recall: recall.reason_for_recall,
                    recall_initiation_date: recall.recall_initiation_date,
                    classification: recall.classification,
                    recalling_firm: recall.recalling_firm,
                    voluntary_mandated: recall.voluntary_mandated,
                    distribution_pattern: recall.distribution_pattern,
                    product_quantity: recall.product_quantity,
                    code_info: recall.code_info,
                    event_id: recall.event_id
                });
            });
        }

        results.sources.fda_recalls.data = recalls;
        results.sources.fda_recalls.count = recalls.length;
        results.sources.fda_recalls.total = response.data?.meta?.results?.total || recalls.length;
        console.log(`✅ Found ${recalls.length} FDA recalls (Total: ${results.sources.fda_recalls.total})`);
        
    } catch (error) {
        if (error.response?.status !== 404) {
            console.error('FDA Recalls error:', error.message);
        }
        results.sources.fda_recalls.data = [];
        results.sources.fda_recalls.count = 0;
        results.sources.fda_recalls.total = 0;
    }
}

async function searchPubChemCompounds(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
    try {
        const drugs = results.sources.fda_drugs.data.filter(d => d.generic_name || d.substance);
        const compounds = [];
        
        // Apply pagination to drug list
        const paginatedDrugs = drugs.slice(offset, Math.min(offset + limit, drugs.length));

        for (const drug of paginatedDrugs) {
            const compoundName = drug.generic_name || drug.substance;
            
            if (compoundName) {
                try {
                    const searchUrl = `${APIS.PUBCHEM}/compound/name/${encodeURIComponent(compoundName)}/property/MolecularFormula,MolecularWeight,IUPACName,InChIKey,CanonicalSMILES,IsomericSMILES/JSON`;
                    
                    const response = await axios.get(searchUrl, {
                        timeout: 5000,
                        headers: { 'Accept': 'application/json' }
                    });

                    if (response.data?.PropertyTable?.Properties?.[0]) {
                        const prop = response.data.PropertyTable.Properties[0];
                        
                        compounds.push({
                            drug_name: compoundName,
                            cid: prop.CID,
                            molecular_formula: prop.MolecularFormula,
                            molecular_weight: prop.MolecularWeight,
                            iupac_name: prop.IUPACName,
                            inchi_key: prop.InChIKey,
                            canonical_smiles: prop.CanonicalSMILES,
                            isomeric_smiles: prop.IsomericSMILES,
                            pubchem_url: `https://pubchem.ncbi.nlm.nih.gov/compound/${prop.CID}`,
                            structure_image: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${prop.CID}/PNG`
                        });
                    }
                } catch (compoundError) {
                    // Skip if compound not found
                }
                
                await delay(200);
            }
        }

        results.sources.pubchem_compounds.data = compounds;
        results.sources.pubchem_compounds.count = compounds.length;
        results.sources.pubchem_compounds.total = drugs.length; // Total possible compounds
        console.log(`✅ Found ${compounds.length} PubChem compounds`);
    } catch (error) {
        console.error('PubChem search error:', error.message);
        results.sources.pubchem_compounds.data = [];
        results.sources.pubchem_compounds.count = 0;
        results.sources.pubchem_compounds.total = 0;
    }
}

async function searchDrugInteractions(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
    try {
        const topDrugs = results.sources.fda_drugs.data.filter(d => d.drug_name);
        const paginatedDrugs = topDrugs.slice(offset, Math.min(offset + limit, topDrugs.length));
        const interactions = [];

        for (const drug of paginatedDrugs) {
            try {
                const rxcuiUrl = `${APIS.RXNORM}/REST/rxcui.json?name=${encodeURIComponent(drug.drug_name)}`;
                const rxcuiResponse = await axios.get(rxcuiUrl, {
                    timeout: 5000,
                    headers: { 'Accept': 'application/json' }
                });

                if (rxcuiResponse.data?.idGroup?.rxnormId?.[0]) {
                    const rxcui = rxcuiResponse.data.idGroup.rxnormId[0];
                    
                    const interactionUrl = `${APIS.RXNORM}/REST/interaction/interaction.json?rxcui=${rxcui}`;
                    const response = await axios.get(interactionUrl, {
                        timeout: 5000,
                        headers: { 'Accept': 'application/json' }
                    });

                    if (response.data?.interactionTypeGroup) {
                        for (const group of response.data.interactionTypeGroup) {
                            if (group.interactionType) {
                                for (const interaction of group.interactionType) {
                                    if (interaction.interactionPair) {
                                        for (const pair of interaction.interactionPair) {
                                            interactions.push({
                                                drug1: drug.drug_name,
                                                drug2: pair.interactionConcept?.[1]?.minConceptItem?.name,
                                                severity: pair.severity || 'Unknown',
                                                description: pair.description,
                                                source: group.sourceName
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (interactionError) {
                // Skip if no interactions found
            }
            
            await delay(200);
        }

        results.sources.drug_interactions.data = interactions;
        results.sources.drug_interactions.count = interactions.length;
        results.sources.drug_interactions.total = topDrugs.length; // Approximate total
        console.log(`✅ Found ${interactions.length} drug interactions`);
    } catch (error) {
        console.error('Drug interactions error:', error.message);
        results.sources.drug_interactions.data = [];
        results.sources.drug_interactions.count = 0;
        results.sources.drug_interactions.total = 0;
    }
}

async function searchAdverseEvents(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
    try {
        const topDrugs = results.sources.fda_drugs.data.filter(d => d.drug_name);
        const paginatedDrugs = topDrugs.slice(offset, Math.min(offset + Math.ceil(limit / 5), topDrugs.length));
        const adverseEvents = [];

        for (const drug of paginatedDrugs) {
            try {
                const aeUrl = `${APIS.OPENFDA}/event.json`;
                const params = {
                    search: `patient.drug.medicinalproduct.exact:"${drug.drug_name}"`,
                    limit: Math.min(100, limit), // Get more events per drug
                    count: 'patient.reaction.reactionmeddrapt.exact'
                };

                const response = await axios.get(aeUrl, {
                    params,
                    timeout: 5000,
                    headers: { 'Accept': 'application/json' }
                });

                if (response.data?.results) {
                    for (const event of response.data.results) {
                        adverseEvents.push({
                            drug_name: drug.drug_name,
                            reaction: event.term,
                            count: event.count,
                            frequency: event.count < 10 ? 'Very Rare' : 
                                      event.count < 100 ? 'Rare' : 
                                      event.count < 1000 ? 'Uncommon' : 
                                      event.count < 10000 ? 'Common' : 'Very Common',
                            severity_category: categorizeAdverseSeverity(event.term)
                        });
                    }
                }
            } catch (aeError) {
                // Skip if no adverse events found
            }
            
            await delay(200);
        }

        results.sources.adverse_events.data = adverseEvents;
        results.sources.adverse_events.count = adverseEvents.length;
        results.sources.adverse_events.total = topDrugs.length * 20; // Approximate
        console.log(`✅ Found ${adverseEvents.length} adverse events`);
    } catch (error) {
        console.error('Adverse events error:', error.message);
        results.sources.adverse_events.data = [];
        results.sources.adverse_events.count = 0;
        results.sources.adverse_events.total = 0;
    }
}

async function searchOrangeBook(results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
    try {
        const drugs = results.sources.fda_drugs.data;
        const paginatedDrugs = drugs.slice(offset, Math.min(offset + limit, drugs.length));
        const orangeBookData = [];

        for (const drug of paginatedDrugs) {
            if (drug.application_number) {
                try {
                    const url = `${APIS.FDA}/drug/drugsfda.json`;
                    const params = {
                        search: `openfda.application_number:"${drug.application_number}"`,
                        limit: 1
                    };

                    const response = await axios.get(url, {
                        params,
                        timeout: 5000,
                        headers: { 'Accept': 'application/json' }
                    });

                    if (response.data?.results?.[0]) {
                        const item = response.data.results[0];
                        
                        orangeBookData.push({
                            drug_name: drug.drug_name,
                            application_number: drug.application_number,
                            approval_date: item.submissions?.[0]?.submission_status_date,
                            sponsor_name: item.sponsor_name,
                            products: item.products?.map(p => ({
                                brand_name: p.brand_name,
                                active_ingredients: p.active_ingredients,
                                dosage_form: p.dosage_form,
                                route: p.route,
                                marketing_status: p.marketing_status,
                                te_code: p.te_code,
                                reference_drug: p.reference_drug,
                                reference_standard: p.reference_standard
                            })),
                            submissions: item.submissions?.map(s => ({
                                submission_type: s.submission_type,
                                submission_number: s.submission_number,
                                submission_status: s.submission_status,
                                submission_status_date: s.submission_status_date
                            }))
                        });
                    }
                } catch (error) {
                    // Skip individual errors
                }
                
                await delay(100);
            }
        }

        results.sources.orange_book.data = orangeBookData;
        results.sources.orange_book.count = orangeBookData.length;
        results.sources.orange_book.total = drugs.filter(d => d.application_number).length;
        console.log(`✅ Found ${orangeBookData.length} Orange Book entries`);
        
    } catch (error) {
        console.error('Orange Book error:', error.message);
        results.sources.orange_book.data = [];
        results.sources.orange_book.count = 0;
        results.sources.orange_book.total = 0;
    }
}

async function searchPurpleBook(condition, results, offset = 0, limit = DEFAULT_PAGE_SIZE) {
    try {
        const url = `${APIS.FDA}/drug/drugsfda.json`;
        const params = {
            search: `products.dosage_form:(INJECTION OR INFUSION) AND _exists_:products.te_code`,
            skip: offset,
            limit: Math.min(limit, 100)
        };

        const response = await axios.get(url, {
            params,
            timeout: 10000,
            headers: { 'Accept': 'application/json' }
        });

        if (response.data?.results) {
            const purpleBookData = response.data.results.map(item => ({
                product_name: item.products?.[0]?.brand_name,
                proper_name: item.products?.[0]?.active_ingredients?.[0]?.name,
                bla_number: item.application_number,
                approval_date: item.submissions?.[0]?.submission_status_date,
                reference_product: item.products?.[0]?.reference_drug === '1',
                biosimilar: item.products?.[0]?.te_code === 'BX',
                interchangeable: item.products?.[0]?.te_code === 'BP',
                sponsor: item.sponsor_name,
                dosage_form: item.products?.[0]?.dosage_form,
                strength: item.products?.[0]?.active_ingredients?.[0]?.strength,
                route: item.products?.[0]?.route
            })).filter(item => item.product_name);

            results.sources.purple_book.data = purpleBookData;
            results.sources.purple_book.count = purpleBookData.length;
            results.sources.purple_book.total = response.data?.meta?.results?.total || purpleBookData.length;
            console.log(`✅ Found ${purpleBookData.length} Purple Book entries`);
        }
    } catch (error) {
        if (error.response?.status !== 404) {
            console.error('Purple Book error:', error.message);
        }
        results.sources.purple_book.data = [];
        results.sources.purple_book.count = 0;
        results.sources.purple_book.total = 0;
    }
}

// Keep existing helper and analytics functions unchanged
function categorizeAdverseSeverity(reaction) {
    const severe = ['death', 'hospitalization', 'disability', 'life-threatening', 'congenital', 'fatal'];
    const moderate = ['bleeding', 'infection', 'allergic', 'breathing', 'cardiac', 'stroke'];
    
    const reactionLower = reaction.toLowerCase();
    
    if (severe.some(term => reactionLower.includes(term))) return 'Severe';
    if (moderate.some(term => reactionLower.includes(term))) return 'Moderate';
    return 'Mild';
}

// Keep all existing analytics functions unchanged
function generateAnalytics(results) {
    results.analytics.regulatory_risk_score = calculateRegulatoryRisk(results);
    results.analytics.market_opportunity = calculateMarketOpportunity(results);
    results.analytics.competitive_landscape = analyzeCompetitiveLandscape(results);
    results.analytics.patent_landscape = analyzePatentLandscape(results);
    results.analytics.financial_metrics = calculateFinancialMetrics(results);
    results.analytics.approval_probability = predictApprovalProbability(results);
    results.analytics.key_opinion_leaders = identifyKOLs(results);
    results.analytics.investment_thesis = generateInvestmentThesis(results);
}

// Include all existing analytics calculation functions unchanged...
// function calculateRegulatoryRisk(results) {
//     let riskScore = 50;
//     const factors = {};
    
//     if (results.sources.failed_drugs.count > 0) {
//         factors.failed_drugs = results.sources.failed_drugs.count * 2;
//         riskScore += factors.failed_drugs;
//     }
    
//     const severeEvents = results.sources.adverse_events.data.filter(ae => ae.severity_category === 'Severe').length;
//     if (severeEvents > 0) {
//         factors.severe_adverse_events = severeEvents * 5;
//         riskScore += factors.severe_adverse_events;
//     }
    
//     if (results.sources.fda_recalls.count > 0) {
//         factors.recalls = results.sources.fda_recalls.count * 3;
//         riskScore += factors.recalls;
//     }
    
//     if (results.sources.clinical_trials.count > 0) {
//         factors.active_trials = -Math.min(results.sources.clinical_trials.count, 20);
//         riskScore += factors.active_trials;
//     }
    
//     if (results.sources.fda_drugs.count > 5) {
//         factors.approved_drugs = -10;
//         riskScore += factors.approved_drugs;
//     }
    
//     riskScore = Math.max(0, Math.min(100, riskScore));
    
//     return {
//         score: riskScore,
//         level: riskScore < 30 ? 'Low' : riskScore < 70 ? 'Moderate' : 'High',
//         factors: factors,
//         interpretation: riskScore < 30 ? 'Low regulatory risk. Favorable development environment.' :
//                        riskScore < 70 ? 'Moderate regulatory risk. Standard development considerations apply.' :
//                        'High regulatory risk. Significant safety or efficacy concerns identified.'
//     };
// }

// // Include all other existing analytics functions unchanged...
// function calculateMarketOpportunity(results) {
//     const avgEnrollment = results.sources.clinical_trials.data
//         .filter(t => t.enrollment)
//         .reduce((sum, t, _, arr) => sum + t.enrollment / arr.length, 0) || 0;
    
//     const nihFunding = results.sources.nih_grants.total_funding || 0;
    
//     return {
//         estimated_patient_population: Math.round(avgEnrollment * 100),
//         current_nih_funding: nihFunding,
//         total_addressable_market: nihFunding * 10,
//         serviceable_obtainable_market: nihFunding * 1.5,
//         market_growth_rate: '7-10% annually',
//         competitive_drugs: results.sources.fda_drugs.count,
//         pipeline_drugs: results.sources.clinical_trials.count
//     };
// }


function calculateRegulatoryRisk(results) {
    let riskScore = 30; // Start with lower baseline
    const factors = {};
    
    // Failed trials factor (your logic was too harsh)
    const totalTrials = results.sources.clinical_trials.count + results.sources.failed_drugs.count;
    if (totalTrials > 0) {
        const failureRate = results.sources.failed_drugs.count / totalTrials;
        if (failureRate > 0.7) {
            factors.high_failure_rate = 25;
            riskScore += 25;
        } else if (failureRate > 0.5) {
            factors.moderate_failure_rate = 15;
            riskScore += 15;
        } else if (failureRate > 0.3) {
            factors.some_failures = 8;
            riskScore += 8;
        }
    }
    
    // Severe adverse events (more nuanced)
    const totalAEs = results.sources.adverse_events.count;
    const severeEvents = results.sources.adverse_events.data.filter(ae => ae.severity_category === 'Severe').length;
    if (totalAEs > 0) {
        const severeRate = severeEvents / totalAEs;
        if (severeRate > 0.3) {
            factors.high_severe_ae_rate = 20;
            riskScore += 20;
        } else if (severeRate > 0.1) {
            factors.moderate_severe_ae_rate = 10;
            riskScore += 10;
        }
    }
    
    // Recalls factor (more precise)
    const recentRecalls = results.sources.fda_recalls.data.filter(recall => {
        const recallYear = new Date(recall.recall_initiation_date).getFullYear();
        return recallYear >= new Date().getFullYear() - 3;
    }).length;
    
    if (recentRecalls > 5) {
        factors.recent_recalls = 15;
        riskScore += 15;
    } else if (recentRecalls > 2) {
        factors.some_recalls = 8;
        riskScore += 8;
    }
    
    // Positive factors
    if (results.sources.fda_drugs.count > 5) {
        factors.established_market = -10;
        riskScore -= 10;
    }
    
    // Late-stage trials reduce risk
    const lateStageTrials = results.sources.clinical_trials.data.filter(t => 
        t.phase === 'PHASE3' || t.phase === 'Phase 3' || t.phase === 'PHASE4' || t.phase === 'Phase 4'
    ).length;
    
    if (lateStageTrials > 0) {
        factors.late_stage_trials = -Math.min(15, lateStageTrials * 3);
        riskScore += factors.late_stage_trials;
    }
    
    // Active recruiting trials reduce risk
    const activeTrials = results.sources.clinical_trials.data.filter(t => 
        t.status === 'RECRUITING' || t.status === 'NOT_YET_RECRUITING'
    ).length;
    
    if (activeTrials > 10) {
        factors.active_pipeline = -8;
        riskScore -= 8;
    }
    
    riskScore = Math.max(5, Math.min(95, riskScore));
    
    return {
        score: riskScore,
        level: riskScore < 35 ? 'Low' : riskScore < 65 ? 'Moderate' : 'High',
        factors: factors,
        calculation_details: {
            total_trials: totalTrials,
            failure_rate: totalTrials > 0 ? (results.sources.failed_drugs.count / totalTrials).toFixed(2) : 0,
            severe_ae_rate: totalAEs > 0 ? (severeEvents / totalAEs).toFixed(2) : 0,
            recent_recalls: recentRecalls,
            late_stage_trials: lateStageTrials,
            active_trials: activeTrials
        },
        interpretation: riskScore < 35 ? 'Low regulatory risk. Favorable development environment with good success rates.' :
                       riskScore < 65 ? 'Moderate regulatory risk. Standard development considerations with some challenges.' :
                       'High regulatory risk. Significant safety, efficacy, or regulatory concerns identified.'
    };
}

function calculateMarketOpportunity(results) {
    // More sophisticated market sizing
    const activeTrials = results.sources.clinical_trials.data.filter(t => 
        t.status === 'RECRUITING' || t.status === 'NOT_YET_RECRUITING' || t.status === 'ACTIVE_NOT_RECRUITING'
    );
    
    const totalEnrollment = activeTrials.reduce((sum, t) => sum + (t.enrollment || 0), 0);
    const avgEnrollment = activeTrials.length > 0 ? totalEnrollment / activeTrials.length : 0;
    
    // Better prevalence estimation
    const estimatedPrevalence = Math.max(avgEnrollment * 500, totalEnrollment * 100, 50000);
    
    const nihFunding = results.sources.nih_grants.total_funding || 0;
    
    // Phase-based market potential
    const phaseBreakdown = {
        'PHASE1': 0,
        'PHASE2': 0, 
        'PHASE3': 0,
        'PHASE4': 0
    };
    
    results.sources.clinical_trials.data.forEach(trial => {
        const phase = trial.phase;
        if (phaseBreakdown.hasOwnProperty(phase)) {
            phaseBreakdown[phase]++;
        }
    });
    
    // Market maturity score
    const approvedDrugs = results.sources.fda_drugs.count;
    let maturityScore = 'Emerging';
    if (approvedDrugs > 20) maturityScore = 'Mature';
    else if (approvedDrugs > 5) maturityScore = 'Developing';
    
    return {
        estimated_patient_population: estimatedPrevalence,
        current_nih_funding: nihFunding,
        total_addressable_market: estimatedPrevalence * 1000, // $1k per patient estimate
        serviceable_obtainable_market: Math.round(estimatedPrevalence * 150), // 15% capture at $1k
        market_maturity: maturityScore,
        phase_distribution: phaseBreakdown,
        market_growth_indicators: {
            active_trials: activeTrials.length,
            funding_trend: nihFunding > 10000000 ? 'High' : nihFunding > 1000000 ? 'Moderate' : 'Low',
            competitive_intensity: approvedDrugs > 10 ? 'High' : approvedDrugs > 3 ? 'Moderate' : 'Low'
        },
        key_metrics: {
            total_enrollment_current_trials: totalEnrollment,
            average_trial_size: Math.round(avgEnrollment),
            trials_in_late_stage: phaseBreakdown['PHASE3'] + phaseBreakdown['PHASE4'],
            approved_competitors: approvedDrugs
        }
    };
}

function predictApprovalProbability(results) {
    let baseProb = 40; // More conservative baseline
    const factors = {};
    const details = {};
    
    // Phase-based probability adjustments
    const phases = {
        'PHASE1': { count: 0, weight: 5 },
        'PHASE2': { count: 0, weight: 15 },
        'PHASE3': { count: 0, weight: 30 },
        'PHASE4': { count: 0, weight: 10 }
    };
    
    results.sources.clinical_trials.data.forEach(trial => {
        const phase = trial.phase;
        if (phases[phase]) {
            phases[phase].count++;
        }
    });
    
    // Calculate phase-weighted score
    let phaseScore = 0;
    let totalPhaseTrials = 0;
    for (const [phase, data] of Object.entries(phases)) {
        if (data.count > 0) {
            phaseScore += data.count * data.weight;
            totalPhaseTrials += data.count;
        }
    }
    
    if (totalPhaseTrials > 0) {
        const avgPhaseWeight = phaseScore / totalPhaseTrials;
        factors.phase_weighted_score = Math.round(avgPhaseWeight - 15); // Adjust to factors scale
        baseProb += factors.phase_weighted_score;
    }
    
    // Market precedent
    if (results.sources.fda_drugs.count > 3) {
        factors.market_precedent = 15;
        baseProb += 15;
        details.market_precedent = `${results.sources.fda_drugs.count} approved drugs indicate established regulatory pathway`;
    }
    
    // Failure rate impact
    const totalTrials = results.sources.clinical_trials.count + results.sources.failed_drugs.count;
    if (totalTrials > 5) {
        const failureRate = results.sources.failed_drugs.count / totalTrials;
        if (failureRate > 0.6) {
            factors.high_historical_failure = -25;
            baseProb -= 25;
        } else if (failureRate < 0.3) {
            factors.low_historical_failure = 10;
            baseProb += 10;
        }
        details.failure_rate = `${(failureRate * 100).toFixed(1)}% historical failure rate`;
    }
    
    // Safety profile
    const severeAEs = results.sources.adverse_events.data.filter(ae => ae.severity_category === 'Severe').length;
    const totalAEs = results.sources.adverse_events.count;
    
    if (totalAEs > 0) {
        const severeRate = severeAEs / totalAEs;
        if (severeRate > 0.3) {
            factors.safety_concerns = -20;
            baseProb -= 20;
        } else if (severeRate < 0.1) {
            factors.good_safety_profile = 10;
            baseProb += 10;
        }
        details.safety_profile = `${(severeRate * 100).toFixed(1)}% severe adverse events`;
    }
    
    // Regulatory precedent
    if (results.sources.fda_recalls.count > 5) {
        factors.regulatory_scrutiny = -15;
        baseProb -= 15;
    }
    
    // Recent activity boost
    const recentTrials = results.sources.clinical_trials.data.filter(trial => {
        const startYear = new Date(trial.start_date).getFullYear();
        return startYear >= new Date().getFullYear() - 2;
    }).length;
    
    if (recentTrials > 3) {
        factors.recent_activity = 8;
        baseProb += 8;
    }
    
    baseProb = Math.max(10, Math.min(90, baseProb));
    
    return {
        probability: baseProb,
        confidence: totalTrials > 10 ? 'High' : totalTrials > 5 ? 'Moderate' : 'Low',
        factors: factors,
        details: details,
        phase_analysis: phases,
        recommendation: baseProb > 65 ? 'Favorable - High approval likelihood' : 
                       baseProb > 45 ? 'Neutral - Moderate approval likelihood' : 
                       'Unfavorable - Low approval likelihood',
        key_assumptions: [
            'Based on historical phase success rates',
            'Market precedent indicates regulatory feasibility', 
            'Safety profile from adverse event data',
            'Recent trial activity suggests continued investment'
        ]
    };
}

function analyzeCompetitiveLandscape(results) {
    const companies = {};
    
    results.sources.fda_drugs.data.forEach(drug => {
        const company = drug.manufacturer;
        if (company) {
            if (!companies[company]) {
                companies[company] = {
                    name: company,
                    approved_drugs: [],
                    clinical_trials: []
                };
            }
            companies[company].approved_drugs.push(drug.drug_name);
        }
    });
    
    results.sources.clinical_trials.data.forEach(trial => {
        const sponsor = trial.lead_sponsor;
        if (sponsor) {
            if (!companies[sponsor]) {
                companies[sponsor] = {
                    name: sponsor,
                    approved_drugs: [],
                    clinical_trials: []
                };
            }
            companies[sponsor].clinical_trials.push(trial.nct_id);
        }
    });
    
    return {
        total_competitors: Object.keys(companies).length,
        market_leaders: Object.values(companies)
            .sort((a, b) => b.approved_drugs.length - a.approved_drugs.length)
            .slice(0, 5)
    };
}

function analyzePatentLandscape(results) {
    return {
        total_patents: 0,
        expiring_soon: [],
        key_patent_holders: {},
        patent_cliff_risk: 'Unknown - Patent data requires USPTO authentication'
    };
}

function calculateFinancialMetrics(results) {
    return {
        total_market_value: results.sources.nih_grants.total_funding * 10,
        nih_funding_total: results.sources.nih_grants.total_funding,
        investment_attractiveness: results.sources.nih_grants.total_funding > 50000000 ? 'High' : 
                                  results.sources.nih_grants.total_funding > 10000000 ? 'Medium' : 'Low'
    };
}

// function predictApprovalProbability(results) {
//     let baseProb = 50;
//     const factors = {};
    
//     if (results.sources.fda_drugs.count > 5) {
//         factors.established_market = 15;
//         baseProb += 15;
//     }
    
//     if (results.sources.clinical_trials.data.some(t => t.phase === 'PHASE3' || t.phase === 'Phase 3')) {
//         factors.phase3_active = 20;
//         baseProb += 20;
//     }
    
//     const failureRate = results.sources.failed_drugs.count / 
//         (results.sources.clinical_trials.count + results.sources.failed_drugs.count + 0.01);
    
//     if (failureRate > 0.5) {
//         factors.high_failure_rate = -25;
//         baseProb -= 25;
//     }
    
//     baseProb = Math.max(5, Math.min(95, baseProb));
    
//     return {
//         probability: baseProb,
//         confidence: 'Moderate',
//         factors: factors,
//         recommendation: baseProb > 60 ? 'Favorable' : baseProb > 40 ? 'Neutral' : 'Unfavorable'
//     };
// }

function identifyKOLs(results) {
    const kols = [];
    
    if (results.sources.nih_grants?.data) {
        const grantsByPI = {};
        results.sources.nih_grants.data.forEach(grant => {
            const pi = grant.principal_investigator;
            if (pi) {
                if (!grantsByPI[pi]) {
                    grantsByPI[pi] = {
                        name: pi,
                        organization: grant.organization,
                        total_funding: 0,
                        grant_count: 0,
                        type: 'Research Leader'
                    };
                }
                grantsByPI[pi].total_funding += grant.total_cost || 0;
                grantsByPI[pi].grant_count++;
            }
        });
        
        kols.push(...Object.values(grantsByPI)
            .sort((a, b) => b.total_funding - a.total_funding)
            .slice(0, 10));
    }
    
    return kols;
}

function generateInvestmentThesis(results) {
    const thesis = {
        recommendation: 'Hold',
        score: 50,
        strengths: [],
        weaknesses: [],
        opportunities: [],
        threats: []
    };
    
    if (results.sources.fda_drugs.count > 10) {
        thesis.strengths.push('Established market with multiple approved therapies');
    }
    if (results.sources.nih_grants?.total_funding > 50000000) {
        thesis.strengths.push('Strong research funding indicates continued innovation');
    }
    if (results.sources.clinical_trials.count > 20) {
        thesis.strengths.push('Active development pipeline');
    }
    
    if (results.sources.failed_drugs.count > 15) {
        thesis.weaknesses.push('High historical failure rate');
    }
    if (results.sources.adverse_events.data.filter(ae => ae.severity_category === 'Severe').length > 5) {
        thesis.weaknesses.push('Significant safety concerns with existing therapies');
    }
    
    if (results.sources.clinical_trials.data.some(t => t.phase === 'PHASE3' || t.phase === 'Phase 3')) {
        thesis.opportunities.push('Late-stage trials may lead to near-term approvals');
    }
    
    if (results.sources.fda_recalls?.count > 5) {
        thesis.threats.push('Regulatory scrutiny due to recalls');
    }
    
    thesis.score = 50 + 
        (thesis.strengths.length * 10) - 
        (thesis.weaknesses.length * 10) + 
        (thesis.opportunities.length * 5) - 
        (thesis.threats.length * 5);
    
    thesis.score = Math.max(0, Math.min(100, thesis.score));
    
    if (thesis.score > 70) {
        thesis.recommendation = 'Buy/Invest';
    } else if (thesis.score < 40) {
        thesis.recommendation = 'Avoid/Divest';
    }
    
    return thesis;
}

function updateEnhancedSummary(results) {
    const drugNames = new Set();
    
    results.sources.fda_drugs.data.forEach(drug => {
        if (drug.drug_name) {
            drugNames.add(drug.drug_name);
        }
    });
    
    results.sources.rxnorm_drugs.data.forEach(drug => {
        if (drug.name) {
            drugNames.add(drug.name);
        }
    });
    
    const activeTrials = results.sources.clinical_trials.data.filter(trial => {
        const status = trial.status?.toUpperCase() || '';
        return ['RECRUITING', 'NOT_YET_RECRUITING', 'ENROLLING_BY_INVITATION'].includes(status);
    }).length;

    const keyCompounds = results.sources.pubchem_compounds.data.map(c => ({
        name: c.drug_name,
        formula: c.molecular_formula,
        cid: c.cid
    }));

    const safetyConcerns = results.sources.adverse_events.data
        .filter(ae => ae.severity_category === 'Severe')
        .map(ae => ({
            drug: ae.drug_name,
            reaction: ae.reaction,
            frequency: ae.frequency
        }));

    results.summary = {
        total_drugs: drugNames.size,
        active_trials: activeTrials,
        failed_drugs: results.sources.failed_drugs.count,
        research_articles: results.sources.pubmed_articles.count,
        compounds_identified: results.sources.pubchem_compounds.count,
        patents_found: 0,
        total_nih_funding: results.sources.nih_grants.total_funding,
        recalls_count: results.sources.fda_recalls.count,
        drug_names: Array.from(drugNames),
        related_conditions: results.sources.mesh_terms.data.map(t => t.term),
        key_compounds: keyCompounds,
        safety_concerns: safetyConcerns
    };
}

// API ROUTES with pagination
router.get('/condition/:condition', async (req, res) => {
    try {
        const { condition } = req.params;
        const { page, pageSize, offset } = getPaginationParams(req);
        
        if (!condition || condition.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Condition parameter is required'
            });
        }

        console.log(`\n🔍 Search request for: ${condition}`);
        console.log(`📄 Pagination - Page: ${page}, Size: ${pageSize}`);
        const startTime = Date.now();
        
        const results = await searchConditionData(condition.trim(), page, pageSize);
        
        const duration = Date.now() - startTime;
        console.log(`✅ Search completed in ${duration}ms\n`);
        
        res.json({
            success: true,
            duration_ms: duration,
            pagination: {
                current_page: page,
                page_size: pageSize,
                total_pages: results.pagination.total_pages,
                total_counts: results.pagination.total_counts
            },
            results
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Health check endpoint (unchanged)
router.get('/health', async (req, res) => {
    const healthChecks = {
        fda: false,
        clinicalTrials: false,
        mesh: false,
        rxnorm: false,
        pubchem: false,
        nih: false
    };

    await Promise.allSettled([
        axios.get(`${APIS.FDA}/drug/label.json?limit=1`, { timeout: 3000 })
            .then(() => { healthChecks.fda = true; })
            .catch(() => {}),
        
        axios.get(`${APIS.CLINICALTRIALS}/studies?pageSize=1&format=json`, { timeout: 3000 })
            .then(() => { healthChecks.clinicalTrials = true; })
            .catch(() => {}),
        axios.get(`${APIS.MESH}/esearch.fcgi?db=mesh&term=test&retmode=json&retmax=1`, { timeout: 3000 })
            .then(() => { healthChecks.mesh = true; })
            .catch(() => {}),
        
        axios.get(`${APIS.RXNORM}/REST/version.json`, { timeout: 3000 })
            .then(() => { healthChecks.rxnorm = true; })
            .catch(() => {}),
        
        axios.get(`${APIS.PUBCHEM}/compound/name/aspirin/property/MolecularFormula/JSON`, { timeout: 3000 })
            .then(() => { healthChecks.pubchem = true; })
            .catch(() => {})
    ]);

    const allHealthy = Object.values(healthChecks).every(status => status === true);
    
    res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        checks: healthChecks
    });
});

router.get('/sources', (req, res) => {
    res.json({
        success: true,
        sources: [
            { name: 'FDA Drug Database', status: 'active', real_data: true, supports_pagination: true },
            { name: 'ClinicalTrials.gov', status: 'active', real_data: true, supports_pagination: true },
            { name: 'PubMed', status: 'active', real_data: true, supports_pagination: true },
            { name: 'RxNorm', status: 'active', real_data: true, supports_pagination: true },
            { name: 'PubChem', status: 'active', real_data: true, supports_pagination: true },
            { name: 'NIH Reporter', status: 'active', real_data: true, supports_pagination: true },
            { name: 'MeSH Terms', status: 'active', real_data: true, supports_pagination: true },
            { name: 'FDA Adverse Events', status: 'active', real_data: true, supports_pagination: true },
            { name: 'FDA Recalls', status: 'active', real_data: true, supports_pagination: true },
            { name: 'Orange Book', status: 'active', real_data: true, supports_pagination: true },
            { name: 'Purple Book', status: 'limited', real_data: true, supports_pagination: true }
        ],
        pagination_info: {
            default_page_size: DEFAULT_PAGE_SIZE,
            max_page_size: MAX_PAGE_SIZE,
            parameters: {
                page: 'Page number (default: 1)',
                pageSize: `Results per page (default: ${DEFAULT_PAGE_SIZE}, max: ${MAX_PAGE_SIZE})`
            }
        }
    });
});

router.get('/', (req, res) => {
    res.json({
        message: '🏥 Regulatory Intelligence API - REAL DATA ONLY',
        version: '7.0',
        status: 'operational',
        data_policy: 'This API returns only REAL data from official sources with full pagination support.',
        pagination: {
            enabled: true,
            default_page_size: DEFAULT_PAGE_SIZE,
            max_page_size: MAX_PAGE_SIZE,
            usage: 'Add ?page=1&pageSize=100 to any endpoint'
        },
        endpoints: {
            '/api/condition/:condition': 'Search comprehensive real data for a medical condition',
            '/api/condition/:condition?page=X&pageSize=Y': 'Search with pagination',
            '/api/health': 'Check health status of all integrated services',
            '/api/sources': 'List all available data sources'
        },
        examples: [
            '/api/condition/diabetes',
            '/api/condition/diabetes?page=1&pageSize=500',
            '/api/condition/hypertension?page=2&pageSize=100'
        ]
    });
});

// Export router
module.exports = router;

// ============================================
// USAGE EXAMPLE FOR STANDALONE SERVER
// ============================================
/*
const express = require('express');
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    if (req.query.page || req.query.pageSize) {
        console.log(`  Pagination: page=${req.query.page}, pageSize=${req.query.pageSize}`);
    }
    next();
});

// Mount the router
app.use('/api', router);

// Start server
const server = app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏥 Regulatory Intelligence API v7.0 - REAL DATA WITH PAGINATION`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 Base URL: http://localhost:${PORT}`);
    console.log(`\n✅ Full pagination support enabled`);
    console.log(`📄 Default page size: ${DEFAULT_PAGE_SIZE}`);
    console.log(`📄 Maximum page size: ${MAX_PAGE_SIZE}`);
    console.log(`\nExample requests:`);
    console.log(`  GET http://localhost:${PORT}/api/condition/diabetes`);
    console.log(`  GET http://localhost:${PORT}/api/condition/diabetes?page=1&pageSize=500`);
    console.log(`  GET http://localhost:${PORT}/api/condition/cancer?page=2&pageSize=100`);
    console.log(`${'='.repeat(60)}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = app;
*/