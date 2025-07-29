const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const router = express.Router();

// API Configuration
const APIS = {
    rxnorm: 'https://rxnav.nlm.nih.gov/REST',
    dailymed: 'https://dailymed.nlm.nih.gov/dailymed/services/v2',
    openfda: 'https://api.fda.gov/drug'
};

// Enhanced API call with better error handling
async function makeAPICall(url, params = {}, retries = 2) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get(url, { 
                params, 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Encoding': 'gzip, deflate, br'
                }
            });
            return response.data;
        } catch (error) {
            console.error(`API call attempt ${attempt} failed for ${url}:`, error.message);
            if (attempt === retries) return null;
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
    return null;
}

// RxNorm Integration
class RxNormService {
    static async getRxCUI(drugName) {
        try {
            console.log(`🔍 Looking up RxCUI for: "${drugName}"`);
            
            // Try exact name match first
            let data = await makeAPICall(`${APIS.rxnorm}/rxcui.json`, { name: drugName });
            let rxcui = data?.idGroup?.rxnormId?.[0] || null;
            
            if (rxcui) {
                console.log(`✅ Found exact match - RxCUI: ${rxcui} for "${drugName}"`);
                return rxcui;
            }
            
            // Try approximate match if exact fails
            console.log(`🔍 Trying approximate match for: "${drugName}"`);
            data = await makeAPICall(`${APIS.rxnorm}/approximateTerm.json`, { 
                term: drugName,
                maxEntries: 5
            });
            
            if (data?.approximateGroup?.candidate) {
                const candidates = Array.isArray(data.approximateGroup.candidate) 
                    ? data.approximateGroup.candidate 
                    : [data.approximateGroup.candidate];
                
                // Look for best match
                for (const candidate of candidates) {
                    const candidateName = candidate.term?.toLowerCase();
                    const searchName = drugName.toLowerCase();
                    
                    if (candidateName && candidateName.includes(searchName)) {
                        console.log(`✅ Found approximate match - RxCUI: ${candidate.rxcui} for term: "${candidate.term}"`);
                        return candidate.rxcui;
                    }
                }
                
                // If no perfect substring match, take first candidate
                if (candidates[0]?.rxcui) {
                    console.log(`⚠️ Using first approximate match - RxCUI: ${candidates[0].rxcui} for term: "${candidates[0].term}"`);
                    return candidates[0].rxcui;
                }
            }
            
            console.log(`❌ No RxCUI found for: "${drugName}"`);
            return null;
        } catch (error) {
            console.error('RxNorm getRxCUI error:', error.message);
            return null;
        }
    }

    static async getNDCs(rxcui) {
        try {
            console.log(`🔢 Fetching NDCs for RxCUI: ${rxcui}`);
            
            // Try the standard getNDCs endpoint first with better error handling
            try {
                let data = await makeAPICall(`${APIS.rxnorm}/rxcui/${rxcui}/ndcs.json`);
                
                if (data?.ndcGroup?.ndcList?.ndc && data.ndcGroup.ndcList.ndc.length > 0) {
                    console.log(`Found ${data.ndcGroup.ndcList.ndc.length} NDCs via standard endpoint`);
                    return data.ndcGroup.ndcList.ndc;
                }
            } catch (standardError) {
                console.log(`Standard NDC endpoint failed: ${standardError.message}`);
            }
            
            // Try historical NDCs if standard fails
            console.log(`No NDCs from standard endpoint, trying historical NDCs...`);
            try {
                const data = await makeAPICall(`${APIS.rxnorm}/rxcui/${rxcui}/allhistoricalndcs.json`, { history: 3 });
                
                if (data?.historicalNdcConcept?.historicalNdcTime) {
                    const allNDCs = [];
                    const historicalData = Array.isArray(data.historicalNdcConcept.historicalNdcTime) 
                        ? data.historicalNdcConcept.historicalNdcTime 
                        : [data.historicalNdcConcept.historicalNdcTime];
                    
                    historicalData.forEach(timeGroup => {
                        if (timeGroup.ndcTime) {
                            const ndcTimes = Array.isArray(timeGroup.ndcTime) ? timeGroup.ndcTime : [timeGroup.ndcTime];
                            ndcTimes.forEach(ndcTime => {
                                if (ndcTime.ndc && !allNDCs.includes(ndcTime.ndc)) {
                                    allNDCs.push(ndcTime.ndc);
                                }
                            });
                        }
                    });
                    
                    if (allNDCs.length > 0) {
                        console.log(`Found ${allNDCs.length} historical NDCs`);
                        return allNDCs;
                    }
                }
            } catch (historicalError) {
                console.log(`Historical NDC endpoint failed: ${historicalError.message}`);
            }
            
            // Final fallback - try to get some NDC info from properties
            console.log(`No historical NDCs found, trying NDC properties approach...`);
            try {
                const propData = await makeAPICall(`${APIS.rxnorm}/rxcui/${rxcui}/properties.json`);
                if (propData?.properties) {
                    console.log(`RxCUI ${rxcui} properties available, but no direct NDC mapping found`);
                }
            } catch (propError) {
                console.log(`Properties endpoint also failed: ${propError.message}`);
            }
            
            console.log(`⚠️ No RxNorm NDCs found for RxCUI ${rxcui} - will rely on FDA sources`);
            return [];
            
        } catch (error) {
            console.error('RxNorm getNDCs comprehensive error:', error.message);
            return [];
        }
    }

    static async getDrugProperties(rxcui) {
        try {
            const data = await makeAPICall(`${APIS.rxnorm}/rxcui/${rxcui}/properties.json`);
            return data?.properties || {};
        } catch (error) {
            console.error('RxNorm getDrugProperties error:', error.message);
            return {};
        }
    }
}

// FDA Data Service
class FDAService {
    static async getDailyMedLabels(drugName) {
        try {
            console.log(`🏛️ Searching DailyMed for: ${drugName}`);
            
            const allLabels = [];
            let skip = 0;
            const limit = 100;
            let hasMoreResults = true;
            
            // Paginate through ALL DailyMed results
            while (hasMoreResults && skip < 500) { // Safety limit of 500 total
                const searchData = await makeAPICall(`${APIS.dailymed}/spls.json`, { 
                    drug_name: drugName,
                    limit: limit,
                    skip: skip
                });

                if (!searchData?.data || searchData.data.length === 0) {
                    hasMoreResults = false;
                    break;
                }

                console.log(`Found ${searchData.data.length} DailyMed results (batch ${Math.floor(skip/limit) + 1})`);
                
                // Process ALL results in this batch
                for (const spl of searchData.data) {
                    try {
                        const label = this.createLabelFromSearchResult(spl, drugName);
                        if (label) {
                            allLabels.push(label);
                        }
                        
                        // Small delay to be respectful to API
                        if (allLabels.length % 10 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                    } catch (error) {
                        console.error(`Error processing SPL ${spl.setid}:`, error.message);
                        // Continue with next SPL instead of failing completely
                    }
                }
                
                // Check if we should continue
                if (searchData.data.length < limit) {
                    hasMoreResults = false; // Last page
                } else {
                    skip += limit;
                    // Add delay between pagination requests
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            console.log(`Successfully processed ${allLabels.length} DailyMed labels total`);
            return allLabels;
        } catch (error) {
            console.error('DailyMed service error:', error.message);
            return [];
        }
    }

    static createLabelFromSearchResult(spl, drugName) {
        return {
            type: 'FDA',
            source: 'DailyMed',
            setid: spl.setid,
            productName: spl.title || drugName,
            indication: spl.generic_medicine?.[0] || 'See full labeling for indication details',
            route: 'See full labeling for route information',
            boxedWarning: false, // Cannot determine from search results
            lastUpdated: spl.published_date || new Date().toISOString().split('T')[0],
            dosage: 'Refer to full prescribing information for dosage and administration',
            warnings: 'Refer to full prescribing information for warnings and precautions',
            adverseReactions: 'Refer to full prescribing information for adverse reactions',
            clinicalStudies: 'Refer to full prescribing information for clinical studies',
            ndc: [],
            manufacturerName: spl.author || 'See full labeling',
            strength: 'See full labeling for strength information'
        };
    }

    static async getOpenFDALabels(drugName) {
        try {
            console.log(`🏛️ Searching OpenFDA for: ${drugName}`);
            
            const allResults = [];
            let skip = 0;
            const limit = 100;
            let hasMoreResults = true;
            
            // Paginate through ALL OpenFDA results
            while (hasMoreResults && skip < 1000) { // Safety limit of 1000 total
                const data = await makeAPICall(`${APIS.openfda}/label.json`, {
                    search: `openfda.brand_name:"${drugName}" OR openfda.generic_name:"${drugName}"`,
                    limit: limit,
                    skip: skip
                });

                if (!data?.results || data.results.length === 0) {
                    hasMoreResults = false;
                    break;
                }

                console.log(`Found ${data.results.length} OpenFDA results (batch ${Math.floor(skip/limit) + 1})`);
                allResults.push(...data.results);
                
                // Check if we should continue
                if (data.results.length < limit) {
                    hasMoreResults = false; // Last page
                } else {
                    skip += limit;
                    // Add delay between pagination requests to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            console.log(`Found ${allResults.length} total OpenFDA results`);
            return allResults.map(result => this.processOpenFDALabel(result));
        } catch (error) {
            console.error('OpenFDA service error:', error.message);
            return [];
        }
    }

    static processOpenFDALabel(result) {
        return {
            type: 'FDA',
            source: 'OpenFDA',
            setid: result.set_id || 'OpenFDA-' + Math.random().toString(36).substr(2, 9),
            productName: result.openfda?.brand_name?.[0] || result.openfda?.generic_name?.[0] || 'Unknown Product',
            indication: this.cleanText(result.indications_and_usage?.[0] || 'Not specified'),
            route: result.openfda?.route?.[0] || 'Not specified',
            boxedWarning: !!(result.boxed_warning || result.black_box_warning),
            lastUpdated: this.formatDate(result.effective_time) || new Date().toISOString().split('T')[0],
            dosage: this.cleanText(result.dosage_and_administration?.[0] || 'Not specified'),
            warnings: this.cleanText(result.warnings_and_precautions?.[0] || result.warnings?.[0] || 'Not specified'),
            adverseReactions: this.cleanText(result.adverse_reactions?.[0] || 'Not specified'),
            clinicalStudies: this.cleanText(result.clinical_studies?.[0] || 'Not specified'),
            ndc: result.openfda?.product_ndc || [],
            manufacturerName: result.openfda?.manufacturer_name?.[0] || 'Not specified',
            strength: result.openfda?.substance_name?.join(', ') || 'Not specified'
        };
    }

    static formatDate(dateStr) {
        if (!dateStr) return null;
        try {
            // Handle various date formats from OpenFDA
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return null;
            return date.toISOString().split('T')[0];
        } catch {
            return null;
        }
    }

    static cleanText(text) {
        if (!text) return 'Not specified';
        if (Array.isArray(text)) text = text[0];
        return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 1000);
    }
}

// AI Analysis Service
class AIAnalysisService {
    static analyzeLabels(labels, compound) {
        const analysis = {
            compound: compound,
            timestamp: new Date().toISOString(),
            summary: this.generateSummary(labels),
            riskAssessment: this.assessRisks(labels),
            complianceAnalysis: this.analyzeCompliance(labels),
            therapeuticInsights: this.generateTherapeuticInsights(labels),
            regulatoryComparison: this.compareRegulatory(labels),
            dataQuality: this.assessDataQuality(labels)
        };
        
        return analysis;
    }

    static generateSummary(labels) {
        const fdaLabels = labels.filter(l => l.type === 'FDA');
        const emaLabels = labels.filter(l => l.type === 'EMA');
        const boxedWarnings = labels.filter(l => l.boxedWarning);
        
        return {
            totalLabels: labels.length,
            fdaLabels: fdaLabels.length,
            emaLabels: emaLabels.length,
            boxedWarnings: boxedWarnings.length,
            uniqueManufacturers: [...new Set(labels.map(l => l.manufacturerName).filter(Boolean))].length,
            averageDataCompleteness: this.calculateDataCompleteness(labels),
            lastUpdatedRange: this.getDateRange(labels)
        };
    }

    static assessRisks(labels) {
        const risks = {
            high: [],
            medium: [],
            low: []
        };

        labels.forEach(label => {
            if (label.boxedWarning) {
                risks.high.push(`${label.productName}: Contains boxed warning (${label.type})`);
            }
            
            const warningsText = (label.warnings || '').toLowerCase();
            if (warningsText.includes('death') || warningsText.includes('fatal')) {
                risks.high.push(`${label.productName}: Contains mortality warnings`);
            }
            
            if (label.adverseReactions && label.adverseReactions.length > 500) {
                risks.medium.push(`${label.productName}: Extensive adverse reaction profile`);
            }

            // Default to low risk if no high/medium risks found
            const hasHighRisk = risks.high.some(risk => risk.includes(label.productName));
            const hasMediumRisk = risks.medium.some(risk => risk.includes(label.productName));
            
            if (!hasHighRisk && !hasMediumRisk) {
                risks.low.push(`${label.productName}: Standard risk profile`);
            }
        });

        return risks;
    }

    static analyzeCompliance(labels) {
        const fdaLabels = labels.filter(l => l.type === 'FDA');
        const emaLabels = labels.filter(l => l.type === 'EMA');
        
        return {
            fdaCompliance: {
                labelsFound: fdaLabels.length,
                status: fdaLabels.length > 0 ? 'FDA Data Available' : 'No FDA Data Found',
                dataCompleteness: this.calculateDataCompleteness(fdaLabels)
            },
            emaCompliance: {
                labelsFound: emaLabels.length,
                status: 'EMA Feature Temporarily Disabled',
                dataCompleteness: 0
            },
            crossRegionalConsistency: fdaLabels.length > 0 ? 'FDA data available' : 'Limited data available'
        };
    }

    static generateTherapeuticInsights(labels) {
        const routes = [...new Set(labels.map(l => l.route).filter(r => r && r !== 'Not specified'))];
        const indications = labels.map(l => l.indication).filter(Boolean);
        
        return {
            routesOfAdministration: routes.length > 0 ? routes : ['See individual labels'],
            commonIndications: this.extractCommonTerms(indications),
            therapeuticClasses: this.inferTherapeuticClasses(labels),
            dosageVariations: this.analyzeDosageVariations(labels)
        };
    }

    static compareRegulatory(labels) {
        const fdaLabels = labels.filter(l => l.type === 'FDA');
        
        return {
            regulatoryAlignment: fdaLabels.length > 0 ? 'FDA data available' : 'No regulatory data found',
            warningDiscrepancies: {
                fdaBoxedWarnings: fdaLabels.filter(l => l.boxedWarning).length,
                emaBoxedWarnings: 0,
                consistency: 'EMA comparison unavailable'
            },
            approvalTimelines: this.compareApprovalDates(fdaLabels, [])
        };
    }

    static assessDataQuality(labels) {
        if (labels.length === 0) {
            return {
                overallScore: 0,
                dataCompleteness: 'No Data',
                missingDataFields: [],
                recommendations: ['No data available for analysis']
            };
        }

        let totalScore = 0;
        let scores = [];

        labels.forEach(label => {
            let score = 0;
            const fields = ['productName', 'indication', 'route', 'dosage', 'warnings', 'adverseReactions'];
            
            fields.forEach(field => {
                if (label[field] && label[field] !== 'Not specified' && label[field].length > 10) {
                    score += 1;
                }
            });
            
            scores.push(score / fields.length);
        });

        const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

        return {
            overallScore: Math.round(averageScore * 100),
            dataCompleteness: averageScore > 0.7 ? 'Good' : averageScore > 0.4 ? 'Fair' : 'Limited',
            missingDataFields: this.identifyMissingFields(labels),
            recommendations: this.generateDataRecommendations(averageScore)
        };
    }

    // Helper methods
    static calculateDataCompleteness(labels) {
        if (labels.length === 0) return 0;
        const completenessScores = labels.map(label => {
            const requiredFields = ['productName', 'indication', 'route', 'dosage', 'warnings'];
            const completedFields = requiredFields.filter(field => 
                label[field] && label[field] !== 'Not specified' && label[field].length > 5
            );
            return completedFields.length / requiredFields.length;
        });
        return Math.round((completenessScores.reduce((a, b) => a + b, 0) / completenessScores.length) * 100);
    }

    static getDateRange(labels) {
        const dates = labels.map(l => l.lastUpdated).filter(Boolean);
        if (dates.length === 0) return 'No dates available';
        
        const sortedDates = dates.sort();
        return {
            earliest: sortedDates[0],
            latest: sortedDates[sortedDates.length - 1]
        };
    }

    static extractCommonTerms(texts) {
        const words = texts.join(' ').toLowerCase().split(/\W+/);
        const frequency = {};
        words.forEach(word => {
            if (word.length > 4) {
                frequency[word] = (frequency[word] || 0) + 1;
            }
        });
        
        return Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([word, count]) => ({ term: word, frequency: count }));
    }

    static inferTherapeuticClasses(labels) {
        const classKeywords = {
            'Anesthetic': ['anesthesia', 'anesthetic', 'ketamine', 'propofol'],
            'Cardiovascular': ['heart', 'cardiac', 'blood pressure', 'hypertension', 'cholesterol'],
            'Diabetes': ['diabetes', 'blood sugar', 'glucose', 'insulin'],
            'Neurological': ['seizure', 'epilepsy', 'depression', 'anxiety', 'pain'],
            'Infectious Disease': ['infection', 'bacterial', 'antibiotic', 'antiviral']
        };
        
        const identifiedClasses = [];
        const allText = labels.map(l => `${l.indication} ${l.productName}`).join(' ').toLowerCase();
        
        Object.entries(classKeywords).forEach(([className, keywords]) => {
            if (keywords.some(keyword => allText.includes(keyword))) {
                identifiedClasses.push(className);
            }
        });
        
        return identifiedClasses.length > 0 ? identifiedClasses : ['Classification requires manual review'];
    }

    static analyzeDosageVariations(labels) {
        const dosages = labels.map(l => l.dosage).filter(d => d && d !== 'Not specified');
        return {
            uniqueDosageForms: dosages.length,
            variationLevel: dosages.length > 3 ? 'High variation' : dosages.length > 1 ? 'Moderate variation' : 'Low variation'
        };
    }

    static compareApprovalDates(fdaLabels, emaLabels) {
        const fdaDates = fdaLabels.map(l => l.lastUpdated).filter(Boolean);
        
        return {
            fdaLatest: fdaDates.length > 0 ? fdaDates.sort().pop() : null,
            emaLatest: null,
            comparison: 'EMA comparison unavailable'
        };
    }

    static identifyMissingFields(labels) {
        const fields = ['productName', 'indication', 'route', 'dosage', 'warnings', 'adverseReactions', 'clinicalStudies'];
        const missingCounts = {};
        
        fields.forEach(field => {
            missingCounts[field] = labels.filter(l => !l[field] || l[field] === 'Not specified').length;
        });
        
        return Object.entries(missingCounts)
            .filter(([, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([field, count]) => ({ field, missingCount: count, percentage: Math.round((count / labels.length) * 100) }));
    }

    static generateDataRecommendations(score) {
        if (score > 0.7) {
            return ['Good data quality achieved', 'Consider monitoring for updates'];
        } else if (score > 0.4) {
            return ['Fair data quality', 'Some information may require manual verification'];
        } else {
            return ['Limited data available', 'Manual research recommended', 'Consider alternative data sources'];
        }
    }
}
// Working DailyMed Service that actually gets real data
class WorkingDailyMedService {
    static async getDailyMedLabels(drugName) {
        try {
            console.log(`🏛️ Searching DailyMed for: ${drugName}`);
            
            const allLabels = [];
            let skip = 0;
            const limit = 50;
            let hasMoreResults = true;
            
            // Step 1: Get SPL search results
            while (hasMoreResults && skip < 200) {
                const searchData = await makeAPICall(`${APIS.dailymed}/spls.json`, { 
                    drug_name: drugName,
                    limit: limit,
                    skip: skip
                });

                if (!searchData?.data || searchData.data.length === 0) {
                    hasMoreResults = false;
                    break;
                }

                console.log(`Found ${searchData.data.length} DailyMed results (batch ${Math.floor(skip/limit) + 1})`);
                
                // Step 2: For each SPL, try to get real data using the correct approach
                for (const spl of searchData.data) {
                    try {
                        console.log(`📄 Processing SPL: ${spl.setid}`);
                        
                        // Approach 1: Use XML endpoint (JSON is giving 415 errors)
                        const xmlLabel = await this.tryXMLExtraction(spl);
                        if (xmlLabel && !this.isPlaceholderData(xmlLabel)) {
                            allLabels.push(xmlLabel);
                            continue;
                        }
                        
                        // Approach 2: Extract from OpenFDA if available
                        const fdaLabel = await this.tryOpenFDAForSPL(spl);
                        if (fdaLabel && !this.isPlaceholderData(fdaLabel)) {
                            allLabels.push(fdaLabel);
                            continue;
                        }
                        
                        // Approach 3: Create enhanced label from search metadata
                        const enhancedLabel = this.createRealEnhancedLabel(spl, drugName);
                        if (enhancedLabel) {
                            allLabels.push(enhancedLabel);
                        }
                        
                        // Respectful delay
                        if (allLabels.length % 10 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 800));
                        }
                        
                    } catch (error) {
                        console.error(`Error processing SPL ${spl.setid}:`, error.message);
                        // Still create a basic label so we don't lose the result
                        const basicLabel = this.createBasicLabel(spl, drugName);
                        if (basicLabel) {
                            allLabels.push(basicLabel);
                        }
                    }
                }
                
                if (searchData.data.length < limit) {
                    hasMoreResults = false;
                } else {
                    skip += limit;
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
            
            console.log(`Successfully processed ${allLabels.length} DailyMed labels total`);
            return allLabels;
        } catch (error) {
            console.error('DailyMed service error:', error.message);
            return [];
        }
    }

    static async tryXMLExtraction(spl) {
        try {
            console.log(`🔍 Trying XML extraction for: ${spl.setid}`);
            
            // Try XML endpoint since JSON gives 415 errors
            const xmlUrl = `${APIS.dailymed}/spls/${spl.setid}.xml`;
            
            const response = await axios.get(xmlUrl, {
                timeout: 10000,
                headers: {
                    'Accept': 'application/xml, text/xml, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.data && response.data.length > 100) {
                console.log(`✅ Got XML data for: ${spl.setid}`);
                return this.parseXMLToLabel(response.data, spl);
            }
            
            return null;
        } catch (error) {
            console.log(`❌ XML extraction failed for ${spl.setid}: ${error.message}`);
            return null;
        }
    }

    static parseXMLToLabel(xmlData, spl) {
        try {
            // Simple regex-based extraction since we don't have a full XML parser
            const extractSection = (sectionName) => {
                const patterns = [
                    new RegExp(`<${sectionName}[^>]*>([\\s\\S]*?)<\\/${sectionName}>`, 'i'),
                    new RegExp(`<section[^>]*${sectionName}[^>]*>([\\s\\S]*?)<\\/section>`, 'i'),
                    new RegExp(`<text[^>]*>([\\s\\S]*?${sectionName}[\\s\\S]*?)<\\/text>`, 'i')
                ];
                
                for (const pattern of patterns) {
                    const match = xmlData.match(pattern);
                    if (match && match[1]) {
                        let content = match[1]
                            .replace(/<[^>]*>/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim();
                        
                        if (content.length > 50) {
                            return content.substring(0, 1500);
                        }
                    }
                }
                return null;
            };

            const indication = extractSection('indicationsAndUsage') || 
                             extractSection('indications') ||
                             'Complete indication information in full SPL document';
                             
            const dosage = extractSection('dosageAndAdministration') || 
                          extractSection('dosage') ||
                          'Complete dosage information in full SPL document';
                          
            const warnings = extractSection('warningsAndPrecautions') || 
                            extractSection('warnings') ||
                            'Complete warnings information in full SPL document';
                            
            const adverse = extractSection('adverseReactions') || 
                           'Complete adverse reactions information in full SPL document';
                           
            const clinical = extractSection('clinicalStudies') || 
                            extractSection('clinicalPharmacology') ||
                            'Complete clinical studies information in full SPL document';

            return {
                type: 'FDA',
                source: 'DailyMed (XML)',
                setid: spl.setid,
                productName: spl.title || 'Product Name from XML',
                indication: indication,
                route: this.extractRouteFromSearch(spl),
                boxedWarning: xmlData.toLowerCase().includes('boxed warning') || xmlData.toLowerCase().includes('black box'),
                lastUpdated: spl.published_date || new Date().toISOString().split('T')[0],
                dosage: dosage,
                warnings: warnings,
                adverseReactions: adverse,
                clinicalStudies: clinical,
                ndc: spl.product_ndc || [],
                manufacturerName: spl.author || 'See full labeling',
                strength: 'See full labeling'
            };
            
        } catch (error) {
            console.error('XML parsing error:', error.message);
            return null;
        }
    }

    static async tryOpenFDAForSPL(spl) {
        try {
            // If we have NDCs from the SPL, try to get OpenFDA data
            if (spl.product_ndc && spl.product_ndc.length > 0) {
                const ndc = spl.product_ndc[0];
                console.log(`🔍 Trying OpenFDA lookup for NDC: ${ndc}`);
                
                const fdaData = await makeAPICall(`${APIS.openfda}/label.json`, {
                    search: `openfda.product_ndc:"${ndc}"`,
                    limit: 1
                });
                
                if (fdaData?.results && fdaData.results.length > 0) {
                    console.log(`✅ Found OpenFDA data for NDC: ${ndc}`);
                    return FDAService.processOpenFDALabel(fdaData.results[0]);
                }
            }
            
            return null;
        } catch (error) {
            console.log(`❌ OpenFDA lookup failed: ${error.message}`);
            return null;
        }
    }

    static createRealEnhancedLabel(spl, drugName) {
        console.log(`📋 Creating real enhanced label for: ${spl.setid}`);
        
        // Extract any real information available from the search result
        const indication = this.extractRealIndication(spl, drugName);
        const route = this.extractRouteFromSearch(spl);
        const manufacturer = spl.author || 'Manufacturer information in full SPL';
        
        return {
            type: 'FDA',
            source: 'DailyMed (Enhanced)',
            setid: spl.setid,
            productName: spl.title || `${drugName} - Pharmaceutical Product`,
            indication: indication,
            route: route,
            boxedWarning: false, // Cannot determine from search data
            lastUpdated: spl.published_date || new Date().toISOString().split('T')[0],
            dosage: this.createInformativeText('dosage', spl.setid),
            warnings: this.createInformativeText('warnings', spl.setid),
            adverseReactions: this.createInformativeText('adverse reactions', spl.setid),
            clinicalStudies: this.createInformativeText('clinical studies', spl.setid),
            ndc: spl.product_ndc || [],
            manufacturerName: manufacturer,
            strength: spl.active_ingredient ? spl.active_ingredient.join(', ') : 'See full labeling'
        };
    }

    static extractRealIndication(spl, drugName) {
        // Try to build a meaningful indication from available data
        const parts = [];
        
        if (spl.generic_medicine && spl.generic_medicine.length > 0) {
            parts.push(`Generic form of: ${spl.generic_medicine.join(', ')}`);
        }
        
        if (spl.product_type) {
            parts.push(`Product type: ${spl.product_type}`);
        }
        
        if (spl.marketing_category) {
            parts.push(`Marketing category: ${spl.marketing_category}`);
        }
        
        if (spl.dosage_form && spl.dosage_form.length > 0) {
            parts.push(`Dosage form: ${spl.dosage_form.join(', ')}`);
        }
        
        if (parts.length > 0) {
            return parts.join('. ') + '. Complete indication details available in full SPL document.';
        }
        
        return `${drugName} pharmaceutical product. Complete indication information available in full SPL document.`;
    }

    static extractRouteFromSearch(spl) {
        if (spl.route && spl.route.length > 0) {
            return spl.route[0];
        }
        
        if (spl.dosage_form && spl.dosage_form.length > 0) {
            const form = spl.dosage_form[0].toLowerCase();
            if (form.includes('oral') || form.includes('tablet') || form.includes('capsule')) {
                return 'Oral';
            }
            if (form.includes('injection') || form.includes('injectable')) {
                return 'Injection';
            }
            if (form.includes('topical') || form.includes('cream') || form.includes('ointment')) {
                return 'Topical';
            }
            return spl.dosage_form[0];
        }
        
        return 'Route information in full SPL document';
    }

    static createInformativeText(sectionType, setid) {
        return `Complete ${sectionType} information is available in the full FDA SPL document. ` +
               `This includes detailed prescribing information, safety data, and clinical guidance. ` +
               `For comprehensive ${sectionType} details, reference SPL document ${setid}.`;
    }

    static createBasicLabel(spl, drugName) {
        return {
            type: 'FDA',
            source: 'DailyMed (Basic)',
            setid: spl.setid,
            productName: spl.title || `${drugName} Product`,
            indication: `${drugName} pharmaceutical product - complete indication in full SPL document`,
            route: this.extractRouteFromSearch(spl),
            boxedWarning: false,
            lastUpdated: spl.published_date || new Date().toISOString().split('T')[0],
            dosage: 'Complete dosage information available in full SPL document',
            warnings: 'Complete warnings information available in full SPL document',
            adverseReactions: 'Complete adverse reactions information available in full SPL document',
            clinicalStudies: 'Complete clinical studies information available in full SPL document',
            ndc: spl.product_ndc || [],
            manufacturerName: spl.author || 'See full labeling',
            strength: 'See full labeling'
        };
    }

    static isPlaceholderData(label) {
        if (!label) return true;
        
        const realContentIndicators = [
            label.indication && label.indication.length > 100 && 
                !label.indication.includes('complete indication information available'),
            label.dosage && label.dosage.length > 100 && 
                !label.dosage.includes('complete dosage information available'),
            label.warnings && label.warnings.length > 100 && 
                !label.warnings.includes('complete warnings information available')
        ];
        
        // If any section has real content, it's not placeholder
        return !realContentIndicators.some(indicator => indicator);
    }
}
// Utility function to deduplicate labels (FIXED - was missing)
function deduplicateLabels(labels) {
    const seen = new Map();
    return labels.filter(label => {
        const key = `${label.type}-${label.productName}-${label.setid}`;
        if (seen.has(key)) return false;
        seen.set(key, true);
        return true;
    });
}

// Main search endpoint - completely rewritten to avoid variable issues
router.get('/search/:compound', async (req, res) => {
    try {
        const compound = req.params.compound.trim();
        console.log(`🔍 Comprehensive search for: ${compound}`);
        
        // Step 1: Get RxNorm data
        const rxcui = await RxNormService.getRxCUI(compound);
        let rxnormProperties = {};
        
        if (rxcui) {
            try {
                rxnormProperties = await RxNormService.getDrugProperties(rxcui);
                const rxnormName = rxnormProperties.name || '';
                console.log(`🔍 RxCUI ${rxcui} maps to: "${rxnormName}"`);
                
                if (rxnormName && !rxnormName.toLowerCase().includes(compound.toLowerCase())) {
                    console.log(`⚠️ WARNING: RxCUI mismatch! Searched "${compound}" but got "${rxnormName}"`);
                }
            } catch (propError) {
                console.error('Error getting drug properties:', propError.message);
                rxnormProperties = {}; // Ensure it's always an object
            }
        }
        
        // Step 2: Get FDA data from multiple sources with error handling
        const [dailyMedLabels, openFDALabels] = await Promise.all([
            WorkingDailyMedService.getDailyMedLabels(compound),
            FDAService.getOpenFDALabels(compound).catch(error => {
                console.error('OpenFDA service failed:', error.message);
                return []; // Return empty array instead of undefined
            })
        ]);
        
        // Step 3: Get RxNorm NDCs with error handling
        const rxnormNDCs = rxcui ? await RxNormService.getNDCs(rxcui).catch(error => {
            console.error('RxNorm NDC fetch failed:', error.message);
            return []; // Return empty array on error
        }) : [];
        
        // Step 4: Combine and deduplicate labels with safety checks
        const combinedLabels = [
            ...(Array.isArray(dailyMedLabels) ? dailyMedLabels : []),
            ...(Array.isArray(openFDALabels) ? openFDALabels : [])
        ];
        const uniqueLabels = deduplicateLabels(combinedLabels);
        
        // Step 5: Extract NDCs from FDA labels with safety checks
        const fdaNDCs = new Set(Array.isArray(rxnormNDCs) ? rxnormNDCs : []);
        
        if (Array.isArray(uniqueLabels)) {
            uniqueLabels.forEach(label => {
                if (label && label.ndc && Array.isArray(label.ndc)) {
                    label.ndc.forEach(ndc => {
                        if (ndc && typeof ndc === 'string') {
                            fdaNDCs.add(ndc);
                        }
                    });
                }
            });
        }
        
        const totalNDCs = Array.from(fdaNDCs);
        console.log(`Total NDCs found: ${totalNDCs.length} (${rxnormNDCs.length} from RxNorm, ${totalNDCs.length - rxnormNDCs.length} from FDA)`);
        console.log(`Found ${uniqueLabels.length} unique labels`);
        
        // Step 6: Generate AI analysis with error handling
        let aiAnalysis;
        try {
            aiAnalysis = AIAnalysisService.analyzeLabels(uniqueLabels, compound);
        } catch (analysisError) {
            console.error('AI analysis failed:', analysisError.message);
            aiAnalysis = {
                dataQuality: { overallScore: 0 },
                summary: {},
                riskAssessment: { high: [], medium: [], low: [] }
            };
        }
        
        // Step 7: Create response
        const responseData = {
            success: true,
            compound,
            summary: {
                totalLabels: uniqueLabels.length,
                fdaLabels: uniqueLabels.filter(l => l.type === 'FDA').length,
                emaLabels: 0,
                withBoxedWarnings: uniqueLabels.filter(l => l.boxedWarning).length,
                rxcui: rxcui,
                ndcCount: totalNDCs.length,
                dataQualityScore: aiAnalysis.dataQuality.overallScore,
                lastAnalyzed: new Date().toISOString()
            },
            labels: uniqueLabels,
            rxnorm: {
                rxcui,
                ndcs: totalNDCs.slice(0, 50),
                properties: rxnormProperties
            },
            aiAnalysis,
            searchMetadata: {
                timestamp: new Date().toISOString(),
                sources: ['RxNorm', 'DailyMed', 'OpenFDA'],
                totalAPICalls: 3 + uniqueLabels.length,
                note: 'EMA integration temporarily disabled',
                rxnormNDCStatus: rxnormNDCs.length > 0 ? 'Found via RxNorm' : 'Retrieved from FDA sources only'
            }
        };
        
        res.json(responseData);
        
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search compound data',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Enhanced label detail endpoint
router.get('/:setid', async (req, res) => {
    try {
        const setid = req.params.setid;
        
        // For now, return basic info since detailed SPL calls are failing
        res.json({
            success: true,
            label: {
                setid,
                note: 'Detailed label information available through main search results',
                message: 'Individual SPL detail calls are temporarily limited due to API restrictions'
            }
        });
        
    } catch (error) {
        console.error('Label detail error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch label detail'
        });
    }
});



module.exports = router;