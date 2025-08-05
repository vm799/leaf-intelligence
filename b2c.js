// // server.js
// const express = require('express');
// const cors = require('cors');
// const axios = require('axios');
// const NodeCache = require('node-cache');
// const rateLimit = require('express-rate-limit');
// require('dotenv').config();

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Initialize cache (TTL: 1 hour)
// const cache = new NodeCache({ stdTTL: 3600 });

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use(express.static('b2cpublic'));

// // Rate limiting
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100 // limit each IP to 100 requests per windowMs
// });
// app.use('/api/', limiter);

// // Helper function to safely extract nested data
// const safeGet = (obj, path, defaultValue = null) => {
//     return path.split('.').reduce((current, key) => 
//         current?.[key] ?? defaultValue, obj);
// };

// // Main drug search endpoint
// app.get('/api/drug/search/:drugName', async (req, res) => {
//     try {
//         const { drugName } = req.params;
//         const cacheKey = `drug_${drugName.toLowerCase()}`;
        
//         // Check cache first
//         const cachedData = cache.get(cacheKey);
//         if (cachedData) {
//             return res.json({ source: 'cache', data: cachedData });
//         }

//         console.log(`Searching for drug: ${drugName}`);

//         // Fetch data from all sources in parallel
//         const [fdaData, pubchemData, clinicalData, pubmedData, rxnormData] = await Promise.allSettled([
//             fetchFDAData(drugName),
//             fetchPubChemData(drugName),
//             fetchClinicalTrialsData(drugName),
//             fetchPubMedData(drugName),
//             fetchRxNormData(drugName)
//         ]);

//         // Process molecular structure
//         let molecularStructure = null;
//         if (pubchemData.status === 'fulfilled' && pubchemData.value) {
//             molecularStructure = await fetchMolecularStructure(pubchemData.value.cid);
//         }

//         const compiledData = {
//             overview: compileDrugOverview(
//                 fdaData.status === 'fulfilled' ? fdaData.value : null, 
//                 pubchemData.status === 'fulfilled' ? pubchemData.value : null,
//                 rxnormData.status === 'fulfilled' ? rxnormData.value : null
//             ),
//             efficacy: compileEfficacyData(
//                 clinicalData.status === 'fulfilled' ? clinicalData.value : null, 
//                 pubmedData.status === 'fulfilled' ? pubmedData.value : null
//             ),
//             safety: compileSafetyData(
//                 fdaData.status === 'fulfilled' ? fdaData.value : null
//             ),
//             chemicalData: compileChemicalData(
//                 pubchemData.status === 'fulfilled' ? pubchemData.value : null
//             ),
//             research: compileResearchData(
//                 pubmedData.status === 'fulfilled' ? pubmedData.value : null
//             ),
//             clinicalTrials: compileTrialsData(
//                 clinicalData.status === 'fulfilled' ? clinicalData.value : null
//             ),
//             molecularStructure: molecularStructure,
//             charts: generateChartData(
//                 fdaData.status === 'fulfilled' ? fdaData.value : null,
//                 clinicalData.status === 'fulfilled' ? clinicalData.value : null
//             ),
//             timestamp: new Date().toISOString()
//         };

//         // Cache the compiled data
//         cache.set(cacheKey, compiledData);

//         res.json({ source: 'api', data: compiledData });
//     } catch (error) {
//         console.error('Search error:', error);
//         res.status(500).json({ error: 'Failed to fetch drug information', details: error.message });
//     }
// });

// // FDA Data Fetching
// async function fetchFDAData(drugName) {
//     try {
//         const [labelData, eventsData, enforcementData] = await Promise.all([
//             fetchFDALabel(drugName),
//             fetchFDAAdverseEvents(drugName),
//             fetchFDAEnforcement(drugName)
//         ]);
        
//         return {
//             label: labelData,
//             adverseEvents: eventsData,
//             enforcement: enforcementData
//         };
//     } catch (error) {
//         console.error('FDA API error:', error.message);
//         throw error;
//     }
// }

// async function fetchFDALabel(drugName) {
//     try {
//         const response = await axios.get('https://api.fda.gov/drug/label.json', {
//             params: {
//                 search: `(openfda.brand_name:"${drugName}" OR openfda.generic_name:"${drugName}")`,
//                 limit: 1
//             }
//         });
//         return response.data;
//     } catch (error) {
//         console.error('FDA Label error:', error.message);
//         return null;
//     }
// }

// async function fetchFDAAdverseEvents(drugName) {
//     try {
//         const response = await axios.get('https://api.fda.gov/drug/event.json', {
//             params: {
//                 search: `(patient.drug.openfda.brand_name:"${drugName}" OR patient.drug.openfda.generic_name:"${drugName}")`,
//                 count: 'patient.reaction.reactionmeddrapt.exact',
//                 limit: 100
//             }
//         });
//         return response.data;
//     } catch (error) {
//         console.error('FDA Adverse Events error:', error.message);
//         return null;
//     }
// }

// async function fetchFDAEnforcement(drugName) {
//     try {
//         const response = await axios.get('https://api.fda.gov/drug/enforcement.json', {
//             params: {
//                 search: `(openfda.brand_name:"${drugName}" OR openfda.generic_name:"${drugName}")`,
//                 limit: 10
//             }
//         });
//         return response.data;
//     } catch (error) {
//         console.error('FDA Enforcement error:', error.message);
//         return null;
//     }
// }

// // PubChem Data Fetching
// async function fetchPubChemData(drugName) {
//     try {
//         // Get compound CID first
//         const cidResponse = await axios.get(
//             `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(drugName)}/cids/JSON`
//         );
        
//         if (!cidResponse.data.IdentifierList.CID.length) {
//             return null;
//         }
        
//         const cid = cidResponse.data.IdentifierList.CID[0];
        
//         // Get comprehensive compound data
//         const [propertyData, descriptionData, pharmacologyData] = await Promise.all([
//             axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,InChIKey,IUPACName,XLogP,TPSA,Complexity,HBondDonorCount,HBondAcceptorCount,RotatableBondCount/JSON`),
//             axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON`),
//             axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/assaysummary/JSON`)
//         ]);
        
//         return {
//             cid,
//             properties: propertyData.data.PropertyTable.Properties[0],
//             description: descriptionData.data,
//             pharmacology: pharmacologyData.data
//         };
//     } catch (error) {
//         console.error('PubChem API error:', error.message);
//         return null;
//     }
// }

// // Fetch molecular structure (3D/2D)
// async function fetchMolecularStructure(cid) {
//     if (!cid) return null;
    
//     try {
//         // Try to get 3D structure first
//         const conformerResponse = await axios.get(
//             `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/conformers/JSON`,
//             { params: { record_type: '3d' } }
//         ).catch(() => null);
        
//         if (conformerResponse?.data) {
//             return {
//                 type: '3d',
//                 conformer: conformerResponse.data,
//                 imageUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG`,
//                 image3DUrl: `https://pubchem.ncbi.nlm.nih.gov/image/img3d.cgi?cid=${cid}&t=l`
//             };
//         }
        
//         // Fallback to 2D
//         return {
//             type: '2d',
//             imageUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG`,
//             sdfUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF`
//         };
//     } catch (error) {
//         console.error('Molecular structure error:', error.message);
//         return null;
//     }
// }

// // Clinical Trials Data
// async function fetchClinicalTrialsData(drugName) {
//     try {
//         const response = await axios.get('https://clinicaltrials.gov/api/query/study_fields', {
//             params: {
//                 expr: drugName,
//                 fields: 'NCTId,BriefTitle,Condition,InterventionName,Phase,EnrollmentCount,PrimaryCompletionDate,StudyType,OverallStatus,StartDate,CompletionDate,StudyResults,OutcomeMeasure',
//                 min_rnk: 1,
//                 max_rnk: 100,
//                 fmt: 'json'
//             }
//         });
//         return response.data;
//     } catch (error) {
//         console.error('ClinicalTrials API error:', error.message);
//         return null;
//     }
// }

// // PubMed Data
// async function fetchPubMedData(drugName) {
//     try {
//         // Search for articles
//         const searchResponse = await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi', {
//             params: {
//                 db: 'pubmed',
//                 term: `${drugName}[Title/Abstract] AND (efficacy OR safety OR "clinical trial" OR "systematic review")`,
//                 retmax: 20,
//                 retmode: 'json',
//                 sort: 'relevance'
//             }
//         });
        
//         if (!searchResponse.data.esearchresult.idlist.length) {
//             return null;
//         }
        
//         // Fetch article details
//         const ids = searchResponse.data.esearchresult.idlist.join(',');
//         const summaryResponse = await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi', {
//             params: {
//                 db: 'pubmed',
//                 id: ids,
//                 retmode: 'json'
//             }
//         });
        
//         // Get abstracts for top articles
//         const abstractResponse = await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi', {
//             params: {
//                 db: 'pubmed',
//                 id: searchResponse.data.esearchresult.idlist.slice(0, 5).join(','),
//                 retmode: 'xml',
//                 rettype: 'abstract'
//             }
//         });
        
//         return {
//             count: searchResponse.data.esearchresult.count,
//             articles: summaryResponse.data.result,
//             abstracts: abstractResponse.data
//         };
//     } catch (error) {
//         console.error('PubMed API error:', error.message);
//         return null;
//     }
// }

// // RxNorm Data
// async function fetchRxNormData(drugName) {
//     try {
//         const response = await axios.get(`https://rxnav.nlm.nih.gov/REST/drugs.json`, {
//             params: {
//                 name: drugName
//             }
//         });
        
//         if (response.data.drugGroup?.conceptGroup) {
//             const rxcui = response.data.drugGroup.conceptGroup[0]?.conceptProperties?.[0]?.rxcui;
//             if (rxcui) {
//                 const [interactionData, relatedData] = await Promise.all([
//                     axios.get(`https://rxnav.nlm.nih.gov/REST/interaction/interaction.json?rxcui=${rxcui}`),
//                     axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=SBD+SCD`)
//                 ]);
                
//                 return {
//                     rxcui,
//                     interactions: interactionData.data,
//                     related: relatedData.data
//                 };
//             }
//         }
//         return null;
//     } catch (error) {
//         console.error('RxNorm API error:', error.message);
//         return null;
//     }
// }

// // Data Compilation Functions
// function compileDrugOverview(fdaData, pubchemData, rxnormData) {
//     const overview = {
//         genericName: '',
//         brandNames: [],
//         drugClass: '',
//         fdaApproval: '',
//         manufacturer: '',
//         activeIngredient: '',
//         rxcui: '',
//         chemicalName: ''
//     };
    
//     if (fdaData?.label?.results?.[0]) {
//         const label = fdaData.label.results[0];
//         overview.genericName = safeGet(label, 'openfda.generic_name.0', '');
//         overview.brandNames = safeGet(label, 'openfda.brand_name', []);
//         overview.drugClass = safeGet(label, 'openfda.pharm_class_epc.0', '');
//         overview.manufacturer = safeGet(label, 'openfda.manufacturer_name.0', '');
//         overview.activeIngredient = safeGet(label, 'active_ingredient.0', '');
//     }
    
//     if (pubchemData?.properties) {
//         overview.chemicalName = pubchemData.properties.IUPACName || '';
//     }
    
//     if (rxnormData?.rxcui) {
//         overview.rxcui = rxnormData.rxcui;
//     }
    
//     return overview;
// }

// function compileEfficacyData(clinicalData, pubmedData) {
//     const efficacy = {
//         overallRate: null,
//         clinicalTrials: 0,
//         completedTrials: 0,
//         activeTrials: 0,
//         totalPatients: 0,
//         publicationCount: 0,
//         phases: {
//             'Phase 1': 0,
//             'Phase 2': 0,
//             'Phase 3': 0,
//             'Phase 4': 0,
//             'Not Applicable': 0
//         },
//         conditions: {},
//         successRate: 0
//     };
    
//     if (clinicalData?.StudyFieldsResponse?.StudyFields) {
//         const studies = clinicalData.StudyFieldsResponse.StudyFields;
//         efficacy.clinicalTrials = studies.length;
        
//         studies.forEach(study => {
//             const status = study.OverallStatus?.[0];
//             const phase = study.Phase?.[0] || 'Not Applicable';
//             const enrollment = parseInt(study.EnrollmentCount?.[0]) || 0;
//             const conditions = study.Condition || [];
            
//             if (status === 'Completed') efficacy.completedTrials++;
//             if (status === 'Active, not recruiting' || status === 'Recruiting') efficacy.activeTrials++;
            
//             efficacy.totalPatients += enrollment;
            
//             if (efficacy.phases[phase] !== undefined) {
//                 efficacy.phases[phase]++;
//             }
            
//             // Track conditions
//             conditions.forEach(condition => {
//                 efficacy.conditions[condition] = (efficacy.conditions[condition] || 0) + 1;
//             });
//         });
        
//         // Calculate success rate
//         if (efficacy.completedTrials > 0) {
//             const successfulTrials = studies.filter(s => 
//                 s.OverallStatus?.[0] === 'Completed' && 
//                 !s.WhyStopped?.[0]
//             ).length;
//             efficacy.successRate = Math.round((successfulTrials / efficacy.completedTrials) * 100);
//         }
//     }
    
//     if (pubmedData?.count) {
//         efficacy.publicationCount = parseInt(pubmedData.count);
//     }
    
//     return efficacy;
// }

// function compileSafetyData(fdaData) {
//     const safety = {
//         commonSideEffects: [],
//         seriousAdverseEvents: 0,
//         blackBoxWarning: false,
//         warnings: [],
//         contraindications: [],
//         totalReports: 0,
//         deathReports: 0,
//         hospitalizationReports: 0,
//         recalls: []
//     };
    
//     if (fdaData?.adverseEvents?.results) {
//         const events = fdaData.adverseEvents.results;
//         safety.totalReports = events.reduce((sum, event) => sum + (event.count || 0), 0);
        
//         // Get top side effects with percentages
//         safety.commonSideEffects = events
//             .slice(0, 20)
//             .map(event => ({
//                 effect: event.term,
//                 count: event.count,
//                 percentage: ((event.count / safety.totalReports) * 100).toFixed(2)
//             }));
        
//         // Count serious events
//         events.forEach(event => {
//             const term = event.term.toLowerCase();
//             if (term.includes('death')) safety.deathReports += event.count;
//             if (term.includes('hospitalisation') || term.includes('hospitalization')) {
//                 safety.hospitalizationReports += event.count;
//             }
//         });
        
//         safety.seriousAdverseEvents = safety.deathReports + safety.hospitalizationReports;
//     }
    
//     if (fdaData?.label?.results?.[0]) {
//         const label = fdaData.label.results[0];
//         safety.blackBoxWarning = !!label.boxed_warning;
//         safety.warnings = Array.isArray(label.warnings) ? label.warnings : [label.warnings].filter(Boolean);
//         safety.contraindications = Array.isArray(label.contraindications) ? 
//             label.contraindications : [label.contraindications].filter(Boolean);
//     }
    
//     if (fdaData?.enforcement?.results) {
//         safety.recalls = fdaData.enforcement.results.map(recall => ({
//             date: recall.recall_initiation_date,
//             reason: recall.reason_for_recall,
//             classification: recall.classification,
//             status: recall.status
//         }));
//     }
    
//     return safety;
// }

// function compileChemicalData(pubchemData) {
//     const chemical = {
//         formula: '',
//         molecularWeight: '',
//         inchiKey: '',
//         cid: '',
//         synonyms: [],
//         description: '',
//         properties: {
//             xlogp: '',
//             tpsa: '',
//             complexity: '',
//             hBondDonor: '',
//             hBondAcceptor: '',
//             rotatable: ''
//         }
//     };
    
//     if (pubchemData?.properties) {
//         const props = pubchemData.properties;
//         chemical.formula = props.MolecularFormula || '';
//         chemical.molecularWeight = props.MolecularWeight || '';
//         chemical.inchiKey = props.InChIKey || '';
//         chemical.cid = pubchemData.cid || '';
        
//         chemical.properties = {
//             xlogp: props.XLogP || '',
//             tpsa: props.TPSA || '',
//             complexity: props.Complexity || '',
//             hBondDonor: props.HBondDonorCount || '',
//             hBondAcceptor: props.HBondAcceptorCount || '',
//             rotatable: props.RotatableBondCount || ''
//         };
//     }
    
//     if (pubchemData?.description?.Record?.Section) {
//         const sections = pubchemData.description.Record.Section;
//         const namesSection = sections.find(s => s.TOCHeading === "Names and Identifiers");
//         if (namesSection?.Section) {
//             const synonymSection = namesSection.Section.find(s => s.TOCHeading === "Synonyms");
//             if (synonymSection?.Information?.[0]?.Value?.StringWithMarkup) {
//                 chemical.synonyms = synonymSection.Information[0].Value.StringWithMarkup
//                     .slice(0, 10)
//                     .map(s => s.String);
//             }
//         }
//     }
    
//     return chemical;
// }

// function compileResearchData(pubmedData) {
//     const research = {
//         totalPublications: 0,
//         recentArticles: [],
//         publicationTrend: [],
//         topJournals: {}
//     };
    
//     if (pubmedData) {
//         research.totalPublications = parseInt(pubmedData.count) || 0;
        
//         // Process articles
//         const articles = Object.values(pubmedData.articles || {})
//             .filter(article => article.uid);
            
//         research.recentArticles = articles.slice(0, 10).map(article => ({
//             title: article.title || '',
//             authors: (article.authors || []).map(a => a.name).slice(0, 3).join(', ') + 
//                      (article.authors?.length > 3 ? ' et al.' : ''),
//             journal: article.source || '',
//             pubDate: article.pubdate || '',
//             pmid: article.uid || '',
//             doi: article.elocationid || ''
//         }));
        
//         // Count publications by journal
//         articles.forEach(article => {
//             if (article.source) {
//                 research.topJournals[article.source] = (research.topJournals[article.source] || 0) + 1;
//             }
//         });
//     }
    
//     return research;
// }

// function compileTrialsData(clinicalData) {
//     const trials = {
//         total: 0,
//         byPhase: {},
//         byStatus: {},
//         recent: [],
//         timeline: [],
//         locations: {}
//     };
    
//     if (clinicalData?.StudyFieldsResponse?.StudyFields) {
//         const studies = clinicalData.StudyFieldsResponse.StudyFields;
//         trials.total = studies.length;
        
//         studies.forEach(study => {
//             const phase = study.Phase?.[0] || 'Not Applicable';
//             const status = study.OverallStatus?.[0] || 'Unknown';
            
//             trials.byPhase[phase] = (trials.byPhase[phase] || 0) + 1;
//             trials.byStatus[status] = (trials.byStatus[status] || 0) + 1;
//         });
        
//         // Get recent trials with more details
//         trials.recent = studies
//             .sort((a, b) => {
//                 const dateA = new Date(a.StartDate?.[0] || 0);
//                 const dateB = new Date(b.StartDate?.[0] || 0);
//                 return dateB - dateA;
//             })
//             .slice(0, 10)
//             .map(study => ({
//                 nctId: study.NCTId?.[0] || '',
//                 title: study.BriefTitle?.[0] || '',
//                 phase: study.Phase?.[0] || '',
//                 status: study.OverallStatus?.[0] || '',
//                 enrollment: study.EnrollmentCount?.[0] || 'N/A',
//                 startDate: study.StartDate?.[0] || '',
//                 completionDate: study.CompletionDate?.[0] || '',
//                 conditions: study.Condition || [],
//                 interventions: study.InterventionName || []
//             }));
        
//         // Create timeline data
//         const yearCounts = {};
//         studies.forEach(study => {
//             const year = new Date(study.StartDate?.[0]).getFullYear();
//             if (year > 2000 && year <= new Date().getFullYear()) {
//                 yearCounts[year] = (yearCounts[year] || 0) + 1;
//             }
//         });
        
//         trials.timeline = Object.entries(yearCounts)
//             .map(([year, count]) => ({ year: parseInt(year), count }))
//             .sort((a, b) => a.year - b.year);
//     }
    
//     return trials;
// }

// function generateChartData(fdaData, clinicalData) {
//     const charts = {
//         adverseEventsChart: {
//             labels: [],
//             data: [],
//             total: 0
//         },
//         trialsTimelineChart: {
//             labels: [],
//             data: []
//         },
//         phaseDistributionChart: {
//             labels: [],
//             data: []
//         },
//         safetyScoreGauge: {
//             score: 0,
//             level: 'unknown'
//         }
//     };
    
//     // Adverse events chart data
//     if (fdaData?.adverseEvents?.results) {
//         const topEvents = fdaData.adverseEvents.results.slice(0, 10);
//         charts.adverseEventsChart.labels = topEvents.map(e => e.term);
//         charts.adverseEventsChart.data = topEvents.map(e => e.count);
//         charts.adverseEventsChart.total = fdaData.adverseEvents.results
//             .reduce((sum, e) => sum + e.count, 0);
        
//         // Calculate safety score
//         const seriousEvents = fdaData.adverseEvents.results
//             .filter(e => ['death', 'hospitalization', 'disability', 'life-threatening']
//                 .some(term => e.term.toLowerCase().includes(term)))
//             .reduce((sum, e) => sum + e.count, 0);
        
//         const totalEvents = charts.adverseEventsChart.total;
//         const seriousPercentage = totalEvents > 0 ? (seriousEvents / totalEvents) * 100 : 0;
        
//         if (seriousPercentage < 5) {
//             charts.safetyScoreGauge.score = 90;
//             charts.safetyScoreGauge.level = 'excellent';
//         } else if (seriousPercentage < 10) {
//             charts.safetyScoreGauge.score = 70;
//             charts.safetyScoreGauge.level = 'good';
//         } else if (seriousPercentage < 20) {
//             charts.safetyScoreGauge.score = 50;
//             charts.safetyScoreGauge.level = 'moderate';
//         } else {
//             charts.safetyScoreGauge.score = 30;
//             charts.safetyScoreGauge.level = 'poor';
//         }
//     }
    
//     // Clinical trials timeline
//     if (clinicalData?.StudyFieldsResponse?.StudyFields) {
//         const yearCounts = {};
//         clinicalData.StudyFieldsResponse.StudyFields.forEach(study => {
//             const year = new Date(study.StartDate?.[0]).getFullYear();
//             if (year > 2010 && year <= new Date().getFullYear()) {
//                 yearCounts[year] = (yearCounts[year] || 0) + 1;
//             }
//         });
        
//         const sortedYears = Object.entries(yearCounts).sort((a, b) => a[0] - b[0]);
//         charts.trialsTimelineChart.labels = sortedYears.map(([year]) => year);
//         charts.trialsTimelineChart.data = sortedYears.map(([, count]) => count);
        
//         // Phase distribution
//         const phaseCounts = {};
//         clinicalData.StudyFieldsResponse.StudyFields.forEach(study => {
//             const phase = study.Phase?.[0] || 'Not Applicable';
//             phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
//         });
        
//         charts.phaseDistributionChart.labels = Object.keys(phaseCounts);
//         charts.phaseDistributionChart.data = Object.values(phaseCounts);
//     }
    
//     return charts;
// }

// // Health check endpoint
// app.get('/health', (req, res) => {
//     res.json({ 
//         status: 'online',
//         timestamp: new Date().toISOString(),
//         uptime: process.uptime()
//     });
// });

// // Error handling middleware
// app.use((err, req, res, next) => {
//     console.error(err.stack);
//     res.status(500).json({ 
//         error: 'Internal server error',
//         message: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
// });

// // Start server
// app.listen(PORT, () => {
//     console.log(`PHARMA-SCAN Backend running on port ${PORT}`);
//     console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
//     console.log(`Access the API at: http://localhost:${PORT}`);
// });

// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize cache (TTL: 1 hour)
const cache = new NodeCache({ stdTTL: 3600 });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('b2cpublic'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Helper function to safely extract nested data
const safeGet = (obj, path, defaultValue = null) => {
    return path.split('.').reduce((current, key) => 
        current?.[key] ?? defaultValue, obj);
};

// Main drug search endpoint
app.get('/api/drug/search/:drugName', async (req, res) => {
    try {
        const { drugName } = req.params;
        const cacheKey = `drug_${drugName.toLowerCase()}`;
        
        // Check cache first
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            return res.json({ source: 'cache', data: cachedData });
        }

        console.log(`Searching for drug: ${drugName}`);

        // Fetch data from all sources in parallel
        const [fdaData, pubchemData, clinicalData, pubmedData, rxnormData] = await Promise.allSettled([
            fetchFDAData(drugName),
            fetchPubChemData(drugName),
            fetchClinicalTrialsData(drugName),
            fetchPubMedData(drugName),
            fetchRxNormData(drugName)
        ]);

        // Process molecular structure
        let molecularStructure = null;
        if (pubchemData.status === 'fulfilled' && pubchemData.value) {
            molecularStructure = await fetchMolecularStructure(pubchemData.value.cid);
        }

        const compiledData = {
            overview: compileDrugOverview(
                fdaData.status === 'fulfilled' ? fdaData.value : null, 
                pubchemData.status === 'fulfilled' ? pubchemData.value : null,
                rxnormData.status === 'fulfilled' ? rxnormData.value : null
            ),
            efficacy: compileEfficacyData(
                clinicalData.status === 'fulfilled' ? clinicalData.value : null, 
                pubmedData.status === 'fulfilled' ? pubmedData.value : null
            ),
            safety: compileSafetyData(
                fdaData.status === 'fulfilled' ? fdaData.value : null
            ),
            chemicalData: compileChemicalData(
                pubchemData.status === 'fulfilled' ? pubchemData.value : null
            ),
            research: compileResearchData(
                pubmedData.status === 'fulfilled' ? pubmedData.value : null
            ),
            clinicalTrials: compileTrialsData(
                clinicalData.status === 'fulfilled' ? clinicalData.value : null
            ),
            molecularStructure: molecularStructure,
            charts: generateChartData(
                fdaData.status === 'fulfilled' ? fdaData.value : null,
                clinicalData.status === 'fulfilled' ? clinicalData.value : null
            ),
            timestamp: new Date().toISOString()
        };

        // Cache the compiled data
        cache.set(cacheKey, compiledData);

        res.json({ source: 'api', data: compiledData });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to fetch drug information', details: error.message });
    }
});

// FDA Data Fetching
async function fetchFDAData(drugName) {
    try {
        const [labelData, eventsData, enforcementData] = await Promise.all([
            fetchFDALabel(drugName),
            fetchFDAAdverseEvents(drugName),
            fetchFDAEnforcement(drugName)
        ]);
        
        return {
            label: labelData,
            adverseEvents: eventsData,
            enforcement: enforcementData
        };
    } catch (error) {
        console.error('FDA API error:', error.message);
        throw error;
    }
}

async function fetchFDALabel(drugName) {
    try {
        const response = await axios.get('https://api.fda.gov/drug/label.json', {
            params: {
                search: `(openfda.brand_name:"${drugName}" OR openfda.generic_name:"${drugName}")`,
                limit: 1
            }
        });
        return response.data;
    } catch (error) {
        console.error('FDA Label error:', error.message);
        return null;
    }
}

async function fetchFDAAdverseEvents(drugName) {
    try {
        const response = await axios.get('https://api.fda.gov/drug/event.json', {
            params: {
                search: `(patient.drug.openfda.brand_name:"${drugName}" OR patient.drug.openfda.generic_name:"${drugName}")`,
                count: 'patient.reaction.reactionmeddrapt.exact',
                limit: 100
            }
        });
        return response.data;
    } catch (error) {
        console.error('FDA Adverse Events error:', error.message);
        return null;
    }
}
async function fetchFDAEnforcement(drugName) {
    try {
        const response = await axios.get('https://api.fda.gov/drug/enforcement.json', {
            params: {
                search: `product_description:"${drugName}"`,
                limit: 10
            }
        });
        return response.data;
    } catch (error) {
        // Enforcement data may not exist for many drugs
        if (error.response?.status === 404) {
            return null;
        }
        console.error('FDA Enforcement error:', error.message);
        return null;
    }
}

// PubChem Data Fetching
async function fetchPubChemData(drugName) {
    try {
        // Get compound CID first
        const cidResponse = await axios.get(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(drugName)}/cids/JSON`
        );
        
        if (!cidResponse.data.IdentifierList.CID.length) {
            return null;
        }
        
        const cid = cidResponse.data.IdentifierList.CID[0];
        
        // Get comprehensive compound data
        const [propertyData, descriptionData, pharmacologyData] = await Promise.all([
            axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,InChIKey,IUPACName,XLogP,TPSA,Complexity,HBondDonorCount,HBondAcceptorCount,RotatableBondCount/JSON`),
            axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON`),
            axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/assaysummary/JSON`)
        ]);
        
        return {
            cid,
            properties: propertyData.data.PropertyTable.Properties[0],
            description: descriptionData.data,
            pharmacology: pharmacologyData.data
        };
    } catch (error) {
        console.error('PubChem API error:', error.message);
        return null;
    }
}

// Fetch molecular structure (3D/2D)
async function fetchMolecularStructure(cid) {
    if (!cid) return null;
    
    try {
        // Check if 3D conformer exists
        const has3D = await axios.get(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/conformers/JSON?record_type=3d`
        ).then(() => true).catch(() => false);
        
        return {
            type: has3D ? '3d' : '2d',
            cid: cid,
            imageUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG`,
            image3DUrl: has3D ? `https://pubchem.ncbi.nlm.nih.gov/image/img3d.cgi?cid=${cid}&t=l` : null,
            sdfUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/record/SDF/?record_type=${has3D ? '3d' : '2d'}&response_type=display`
        };
    } catch (error) {
        console.error('Molecular structure error:', error.message);
        return {
            type: '2d',
            cid: cid,
            imageUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG`,
            sdfUrl: null
        };
    }
}

// Clinical Trials Data
async function fetchClinicalTrialsData(drugName) {
    try {
        const response = await axios.get('https://clinicaltrials.gov/api/v2/studies', {
            params: {
                'query.cond': drugName,
                'query.intr': drugName,
                'format': 'json',
                'pageSize': 100,
                'fields': 'NCTId,BriefTitle,Condition,InterventionName,InterventionType,Phase,EnrollmentCount,EnrollmentType,StudyType,OverallStatus,StartDate,CompletionDate,StudyFirstPostDate,LastUpdatePostDate,ResponsiblePartyInvestigatorFullName,LeadSponsorName,LocationCity,LocationCountry'
            }
        });
        return response.data;
    } catch (error) {
        console.error('ClinicalTrials API error:', error.message);
        return null;
    }
}

// PubMed Data
async function fetchPubMedData(drugName) {
    try {
        // Search for articles
        const searchResponse = await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi', {
            params: {
                db: 'pubmed',
                term: `${drugName}[Title/Abstract] AND (efficacy OR safety OR "clinical trial" OR "systematic review")`,
                retmax: 20,
                retmode: 'json',
                sort: 'relevance'
            }
        });
        
        if (!searchResponse.data.esearchresult.idlist.length) {
            return null;
        }
        
        // Fetch article details
        const ids = searchResponse.data.esearchresult.idlist.join(',');
        const summaryResponse = await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi', {
            params: {
                db: 'pubmed',
                id: ids,
                retmode: 'json'
            }
        });
        
        // Get abstracts for top articles
        const abstractResponse = await axios.get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi', {
            params: {
                db: 'pubmed',
                id: searchResponse.data.esearchresult.idlist.slice(0, 5).join(','),
                retmode: 'xml',
                rettype: 'abstract'
            }
        });
        
        return {
            count: searchResponse.data.esearchresult.count,
            articles: summaryResponse.data.result,
            abstracts: abstractResponse.data
        };
    } catch (error) {
        console.error('PubMed API error:', error.message);
        return null;
    }
}

// RxNorm Data
async function fetchRxNormData(drugName) {
    try {
        const response = await axios.get(`https://rxnav.nlm.nih.gov/REST/drugs.json`, {
            params: {
                name: drugName
            }
        });
        
        if (response.data.drugGroup?.conceptGroup) {
            const rxcui = response.data.drugGroup.conceptGroup[0]?.conceptProperties?.[0]?.rxcui;
            if (rxcui) {
                const [interactionData, relatedData] = await Promise.all([
                    axios.get(`https://rxnav.nlm.nih.gov/REST/interaction/interaction.json?rxcui=${rxcui}`),
                    axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=SBD+SCD`)
                ]);
                
                return {
                    rxcui,
                    interactions: interactionData.data,
                    related: relatedData.data
                };
            }
        }
        return null;
    } catch (error) {
        console.error('RxNorm API error:', error.message);
        return null;
    }
}

// Data Compilation Functions
function compileDrugOverview(fdaData, pubchemData, rxnormData) {
    const overview = {
        genericName: '',
        brandNames: [],
        drugClass: '',
        fdaApproval: '',
        manufacturer: '',
        activeIngredient: '',
        rxcui: '',
        chemicalName: ''
    };
    
    if (fdaData?.label?.results?.[0]) {
        const label = fdaData.label.results[0];
        overview.genericName = safeGet(label, 'openfda.generic_name.0', '');
        overview.brandNames = safeGet(label, 'openfda.brand_name', []);
        overview.drugClass = safeGet(label, 'openfda.pharm_class_epc.0', '');
        overview.manufacturer = safeGet(label, 'openfda.manufacturer_name.0', '');
        overview.activeIngredient = safeGet(label, 'active_ingredient.0', '');
    }
    
    if (pubchemData?.properties) {
        overview.chemicalName = pubchemData.properties.IUPACName || '';
    }
    
    if (rxnormData?.rxcui) {
        overview.rxcui = rxnormData.rxcui;
    }
    
    return overview;
}

function compileEfficacyData(clinicalData, pubmedData) {
    const efficacy = {
        overallRate: null,
        clinicalTrials: 0,
        completedTrials: 0,
        activeTrials: 0,
        totalPatients: 0,
        publicationCount: 0,
        phases: {
            'PHASE1': 0,
            'PHASE2': 0,
            'PHASE3': 0,
            'PHASE4': 0,
            'NA': 0
        },
        conditions: {},
        successRate: 0
    };
    
    if (clinicalData?.studies) {
        const studies = clinicalData.studies;
        efficacy.clinicalTrials = studies.length;
        
        studies.forEach(study => {
            const protocolSection = study.protocolSection || {};
            const statusModule = protocolSection.statusModule || {};
            const designModule = protocolSection.designModule || {};
            const status = statusModule.overallStatus;
            const phase = designModule.phases?.[0] || 'NA';
            const enrollment = designModule.enrollmentInfo?.count || 0;
            const conditions = protocolSection.conditionsModule?.conditions || [];
            
            if (status === 'COMPLETED') efficacy.completedTrials++;
            if (status === 'ACTIVE_NOT_RECRUITING' || status === 'RECRUITING') efficacy.activeTrials++;
            
            efficacy.totalPatients += enrollment;
            
            if (efficacy.phases[phase] !== undefined) {
                efficacy.phases[phase]++;
            }
            
            // Track conditions
            conditions.forEach(condition => {
                efficacy.conditions[condition] = (efficacy.conditions[condition] || 0) + 1;
            });
        });
        
        // Calculate success rate
        if (efficacy.completedTrials > 0) {
            efficacy.successRate = Math.round((efficacy.completedTrials / efficacy.clinicalTrials) * 100);
        }
    }
    
    if (pubmedData?.count) {
        efficacy.publicationCount = parseInt(pubmedData.count);
    }
    
    return efficacy;
}

function compileSafetyData(fdaData) {
    const safety = {
        commonSideEffects: [],
        seriousAdverseEvents: 0,
        blackBoxWarning: false,
        warnings: [],
        contraindications: [],
        totalReports: 0,
        deathReports: 0,
        hospitalizationReports: 0,
        recalls: []
    };
    
    if (fdaData?.adverseEvents?.results) {
        const events = fdaData.adverseEvents.results;
        safety.totalReports = events.reduce((sum, event) => sum + (event.count || 0), 0);
        
        // Get top side effects with percentages
        safety.commonSideEffects = events
            .slice(0, 20)
            .map(event => ({
                effect: event.term,
                count: event.count,
                percentage: ((event.count / safety.totalReports) * 100).toFixed(2)
            }));
        
        // Count serious events
        events.forEach(event => {
            const term = event.term.toLowerCase();
            if (term.includes('death')) safety.deathReports += event.count;
            if (term.includes('hospitalisation') || term.includes('hospitalization')) {
                safety.hospitalizationReports += event.count;
            }
        });
        
        safety.seriousAdverseEvents = safety.deathReports + safety.hospitalizationReports;
    }
    
    if (fdaData?.label?.results?.[0]) {
        const label = fdaData.label.results[0];
        safety.blackBoxWarning = !!label.boxed_warning;
        safety.warnings = Array.isArray(label.warnings) ? label.warnings : [label.warnings].filter(Boolean);
        safety.contraindications = Array.isArray(label.contraindications) ? 
            label.contraindications : [label.contraindications].filter(Boolean);
    }
    
    if (fdaData?.enforcement?.results) {
        safety.recalls = fdaData.enforcement.results.map(recall => ({
            date: recall.recall_initiation_date,
            reason: recall.reason_for_recall,
            classification: recall.classification,
            status: recall.status
        }));
    }
    
    return safety;
}

function compileChemicalData(pubchemData) {
    const chemical = {
        formula: '',
        molecularWeight: '',
        inchiKey: '',
        cid: '',
        synonyms: [],
        description: '',
        properties: {
            xlogp: '',
            tpsa: '',
            complexity: '',
            hBondDonor: '',
            hBondAcceptor: '',
            rotatable: ''
        }
    };
    
    if (pubchemData?.properties) {
        const props = pubchemData.properties;
        chemical.formula = props.MolecularFormula || '';
        chemical.molecularWeight = props.MolecularWeight || '';
        chemical.inchiKey = props.InChIKey || '';
        chemical.cid = pubchemData.cid || '';
        
        chemical.properties = {
            xlogp: props.XLogP || '',
            tpsa: props.TPSA || '',
            complexity: props.Complexity || '',
            hBondDonor: props.HBondDonorCount || '',
            hBondAcceptor: props.HBondAcceptorCount || '',
            rotatable: props.RotatableBondCount || ''
        };
    }
    
    if (pubchemData?.description?.Record?.Section) {
        const sections = pubchemData.description.Record.Section;
        const namesSection = sections.find(s => s.TOCHeading === "Names and Identifiers");
        if (namesSection?.Section) {
            const synonymSection = namesSection.Section.find(s => s.TOCHeading === "Synonyms");
            if (synonymSection?.Information?.[0]?.Value?.StringWithMarkup) {
                chemical.synonyms = synonymSection.Information[0].Value.StringWithMarkup
                    .slice(0, 10)
                    .map(s => s.String);
            }
        }
    }
    
    return chemical;
}

function compileResearchData(pubmedData) {
    const research = {
        totalPublications: 0,
        recentArticles: [],
        publicationTrend: [],
        topJournals: {}
    };
    
    if (pubmedData) {
        research.totalPublications = parseInt(pubmedData.count) || 0;
        
        // Process articles
        const articles = Object.values(pubmedData.articles || {})
            .filter(article => article.uid);
            
        research.recentArticles = articles.slice(0, 10).map(article => ({
            title: article.title || '',
            authors: (article.authors || []).map(a => a.name).slice(0, 3).join(', ') + 
                     (article.authors?.length > 3 ? ' et al.' : ''),
            journal: article.source || '',
            pubDate: article.pubdate || '',
            pmid: article.uid || '',
            doi: article.elocationid || ''
        }));
        
        // Count publications by journal
        articles.forEach(article => {
            if (article.source) {
                research.topJournals[article.source] = (research.topJournals[article.source] || 0) + 1;
            }
        });
    }
    
    return research;
}

function compileTrialsData(clinicalData) {
    const trials = {
        total: 0,
        byPhase: {},
        byStatus: {},
        recent: [],
        timeline: [],
        locations: {}
    };
    
    if (clinicalData?.studies) {
        const studies = clinicalData.studies;
        trials.total = studies.length;
        
        studies.forEach(study => {
            const protocolSection = study.protocolSection || {};
            const identificationModule = protocolSection.identificationModule || {};
            const statusModule = protocolSection.statusModule || {};
            const designModule = protocolSection.designModule || {};
            const phase = designModule.phases?.[0] || 'NA';
            const status = statusModule.overallStatus || 'UNKNOWN';
            
            trials.byPhase[phase] = (trials.byPhase[phase] || 0) + 1;
            trials.byStatus[status] = (trials.byStatus[status] || 0) + 1;
        });
        
        // Get recent trials with more details
        trials.recent = studies
            .sort((a, b) => {
                const dateA = new Date(a.protocolSection?.statusModule?.startDateStruct?.date || 0);
                const dateB = new Date(b.protocolSection?.statusModule?.startDateStruct?.date || 0);
                return dateB - dateA;
            })
            .slice(0, 10)
            .map(study => {
                const ps = study.protocolSection || {};
                return {
                    nctId: ps.identificationModule?.nctId || '',
                    title: ps.identificationModule?.briefTitle || '',
                    phase: ps.designModule?.phases?.[0] || '',
                    status: ps.statusModule?.overallStatus || '',
                    enrollment: ps.designModule?.enrollmentInfo?.count || 'N/A',
                    startDate: ps.statusModule?.startDateStruct?.date || '',
                    completionDate: ps.statusModule?.completionDateStruct?.date || '',
                    conditions: ps.conditionsModule?.conditions || [],
                    interventions: ps.armsInterventionsModule?.interventions?.map(i => i.name) || []
                };
            });
        
        // Create timeline data
        const yearCounts = {};
        studies.forEach(study => {
            const dateStr = study.protocolSection?.statusModule?.startDateStruct?.date;
            if (dateStr) {
                const year = new Date(dateStr).getFullYear();
                if (year > 2000 && year <= new Date().getFullYear()) {
                    yearCounts[year] = (yearCounts[year] || 0) + 1;
                }
            }
        });
        
        trials.timeline = Object.entries(yearCounts)
            .map(([year, count]) => ({ year: parseInt(year), count }))
            .sort((a, b) => a.year - b.year);
    }
    
    return trials;
}

function generateChartData(fdaData, clinicalData) {
    const charts = {
        adverseEventsChart: {
            labels: [],
            data: [],
            total: 0
        },
        trialsTimelineChart: {
            labels: [],
            data: []
        },
        phaseDistributionChart: {
            labels: [],
            data: []
        },
        safetyScoreGauge: {
            score: 0,
            level: 'unknown'
        }
    };
    
    // Adverse events chart data
    if (fdaData?.adverseEvents?.results) {
        const topEvents = fdaData.adverseEvents.results.slice(0, 10);
        charts.adverseEventsChart.labels = topEvents.map(e => e.term);
        charts.adverseEventsChart.data = topEvents.map(e => e.count);
        charts.adverseEventsChart.total = fdaData.adverseEvents.results
            .reduce((sum, e) => sum + e.count, 0);
        
        // Calculate safety score
        const seriousEvents = fdaData.adverseEvents.results
            .filter(e => ['death', 'hospitalization', 'disability', 'life-threatening']
                .some(term => e.term.toLowerCase().includes(term)))
            .reduce((sum, e) => sum + e.count, 0);
        
        const totalEvents = charts.adverseEventsChart.total;
        const seriousPercentage = totalEvents > 0 ? (seriousEvents / totalEvents) * 100 : 0;
        
        if (seriousPercentage < 5) {
            charts.safetyScoreGauge.score = 90;
            charts.safetyScoreGauge.level = 'excellent';
        } else if (seriousPercentage < 10) {
            charts.safetyScoreGauge.score = 70;
            charts.safetyScoreGauge.level = 'good';
        } else if (seriousPercentage < 20) {
            charts.safetyScoreGauge.score = 50;
            charts.safetyScoreGauge.level = 'moderate';
        } else {
            charts.safetyScoreGauge.score = 30;
            charts.safetyScoreGauge.level = 'poor';
        }
    }
    
    // Clinical trials timeline
    if (clinicalData?.studies) {
        const yearCounts = {};
        clinicalData.studies.forEach(study => {
            const dateStr = study.protocolSection?.statusModule?.startDateStruct?.date;
            if (dateStr) {
                const year = new Date(dateStr).getFullYear();
                if (year > 2010 && year <= new Date().getFullYear()) {
                    yearCounts[year] = (yearCounts[year] || 0) + 1;
                }
            }
        });
        
        const sortedYears = Object.entries(yearCounts).sort((a, b) => a[0] - b[0]);
        charts.trialsTimelineChart.labels = sortedYears.map(([year]) => year);
        charts.trialsTimelineChart.data = sortedYears.map(([, count]) => count);
        
        // Phase distribution
        const phaseCounts = {};
        clinicalData.studies.forEach(study => {
            const phase = study.protocolSection?.designModule?.phases?.[0] || 'NA';
            phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
        });
        
        // Map phase names for display
        const phaseMapping = {
            'PHASE1': 'Phase 1',
            'PHASE2': 'Phase 2',
            'PHASE3': 'Phase 3',
            'PHASE4': 'Phase 4',
            'NA': 'Not Applicable',
            'EARLY_PHASE1': 'Early Phase 1',
            'PHASE1_PHASE2': 'Phase 1/2',
            'PHASE2_PHASE3': 'Phase 2/3'
        };
        
        charts.phaseDistributionChart.labels = Object.keys(phaseCounts).map(p => phaseMapping[p] || p);
        charts.phaseDistributionChart.data = Object.values(phaseCounts);
    }
    
    return charts;
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(3000, () => {
    console.log(`PHARMA-SCAN Backend running on port ${3000}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Access the API at: http://localhost:${3000}`);
});