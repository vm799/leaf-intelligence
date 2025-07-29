// Complete ema-mongo-routes.js - Enhanced EMA MongoDB Routes
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Database connection function for medicines_database
function getDB() {
  // Use the specific medicines_database instead of the default connection
  return mongoose.connection.client.db('medicines_database');
}

// Enhanced compound search query builder
function buildCompoundSearchQuery(compound) {
  const searchTerm = compound.trim();
  const regexPattern = new RegExp(searchTerm.split(/\s+/).join('|'), 'i');
  
  return {
    $or: [
      // Medicine names and active substances
      { 'Name of medicine': { $regex: regexPattern } },
      { '﻿Name of medicine': { $regex: regexPattern } }, // Handle BOM character
      { 'Active substance': { $regex: regexPattern } },
      { 'Active substances': { $regex: regexPattern } },
      { 'International non-proprietary name (INN) / common name': { $regex: regexPattern } },
      
      // Therapeutic areas and indications
      { 'Therapeutic area (MeSH)': { $regex: regexPattern } },
      { 'Therapeutic area': { $regex: regexPattern } },
      { 'Therapeutic indication': { $regex: regexPattern } },
      { 'Pharmacotherapeutic group\n(human)': { $regex: regexPattern } },
      { 'Pharmacotherapeutic group\n(veterinary)': { $regex: regexPattern } },
      
      // Manufacturer and sponsor information
      { 'Marketing authorisation developer / applicant / holder': { $regex: regexPattern } },
      { 'Opinion holder': { $regex: regexPattern } },
      { 'sponsor_name': { $regex: regexPattern } },
      
      // For herbal medicines
      { 'Latin name': { $regex: regexPattern } },
      { 'English common name': { $regex: regexPattern } },
      { 'Botanical name': { $regex: regexPattern } },
      
      // For orphan designations
      { 'Medicine name': { $regex: regexPattern } },
      { 'Intended use': { $regex: regexPattern } },
      
      // For referrals and procedures
      { 'Referral name': { $regex: regexPattern } },
      { 'Associated names (centrally authorised medicines)': { $regex: regexPattern } },
      { 'Associated names (non-centrally authorised medicines)': { $regex: regexPattern } },
      
      // For PSUSA assessments
      { 'activeSubstancesInScope': { $regex: regexPattern } },
      { 'activeSubstanceRaw': { $regex: regexPattern } },
      
      // Additional product identifiers
      { 'EMA product number': { $regex: regexPattern } },
      { 'EU designation number': { $regex: regexPattern } },
      { 'PIP number': { $regex: regexPattern } },
      { 'Reference number': { $regex: regexPattern } },
      { 'Procedure number': { $regex: regexPattern } }
    ]
  };
}

// Enhanced mapping functions for each collection type

function mapMedicineData(item) {
  return {
    id: item._id,
    medicineName: item['Name of medicine'] || item['﻿Name of medicine'] || 'N/A',
    activeSubstance: item['Active substance'] || 'N/A',
    inn: item['International non-proprietary name (INN) / common name'] || 'N/A',
    therapeuticArea: item['Therapeutic area (MeSH)'] || 'N/A',
    therapeuticIndication: item['Therapeutic indication'] || 'N/A',
    medicineStatus: item['Medicine status'] || 'N/A',
    category: item['Category'] || item['﻿Category'] || 'N/A',
    productNumber: item['EMA product number'] || 'N/A',
    developer: item['Marketing authorisation developer / applicant / holder'] || 'N/A',
    authDate: item['Marketing authorisation date'] || item['European Commission decision date'] || null,
    opinionDate: item['Opinion adopted date'] || null,
    medicineUrl: item['Medicine URL'] || null,
    atcCode: item['ATC code (human)'] || 'N/A',
    pharmacotherapeuticGroup: item['Pharmacotherapeutic group\n(human)'] || 'N/A',
    biosimilar: item['Biosimilar'] || false,
    orphanMedicine: item['Orphan medicine'] || false,
    conditionalApproval: item['Conditional approval'] || false,
    additionalMonitoring: item['Additional monitoring'] || false,
    acceleratedAssessment: item['Accelerated assessment'] || false,
    advancedTherapy: item['Advanced therapy'] || false,
    genericOrHybrid: item['Generic or hybrid'] || false,
    primeStatus: item['PRIME: priority medicine'] || false,
    exceptionalCircumstances: item['Exceptional circumstances'] || false,
    startEvaluationDate: item['Start of evaluation date'] || null,
    startRollingReviewDate: item['Start of rolling review date'] || null,
    withdrawalDate: item['Withdrawal of application date'] || null,
    refusalDate: item['Refusal of marketing authorisation date'] || null,
    suspensionDate: item['Suspension of marketing authorisation date'] || null,
    revisionNumber: item['Revision number'] ? (item['Revision number'].$numberInt || item['Revision number']) : null,
    firstPublishedDate: item['First published date'] || null,
    lastUpdatedDate: item['Last updated date'] || null
  };
}

function mapDhpcData(item) {
  return {
    id: item._id,
    medicineName: item['Name of medicine'] || 'N/A',
    activeSubstances: item['Active substances'] || 'N/A',
    dhpcType: item['DHPC type'] || 'N/A',
    disseminationDate: item['Dissemination date'] || null,
    therapeuticArea: item['Therapeutic area (MeSH)'] || 'N/A',
    outcome: item['Regulatory outcome'] || 'N/A',
    dhpcUrl: item['DHPC URL'] || null,
    procedureNumber: item['Procedure number'] || 'N/A',
    referralName: item['Referral name'] || 'N/A',
    category: item['Category'] || 'N/A',
    species: item['Species'] || 'N/A',
    atcCode: item['ATC code (human)'] || 'N/A',
    atcVetCode: item['ATCvet code (veterinary)'] || 'N/A',
    otherRelatedMedicines: item['Other related medicines\n(nationally authorised)'] || 'N/A',
    firstPublishedDate: item['First published date'] || null,
    lastUpdatedDate: item['Last updated date'] || null
  };
}

function mapHerbalData(item) {
  return {
    id: item._id,
    latinName: item['Latin name'] || 'N/A',
    commonName: item['English common name'] || 'N/A',
    botanicalName: item['Botanical name'] || 'N/A',
    therapeuticArea: item['Therapeutic area'] || 'N/A',
    status: item['Status'] || 'N/A',
    outcome: item['Outcome of European assessment'] || 'N/A',
    combination: item['Combination'] || 'N/A',
    herbalUrl: item['Herbal medicine URL'] || null,
    additionalInformation: item['Additional information'] || 'N/A',
    dateAddedInventory: item['Date added to the inventory'] || null,
    dateAddedPriority: item['Date added to the priority list'] || null,
    firstPublishedDate: item['First published date'] || null,
    lastUpdatedDate: item['Last updated date'] || null
  };
}

function mapOrphanData(item) {
  return {
    id: item._id,
    designationNumber: item['EU designation number'] || 'N/A',
    activeSubstance: Array.isArray(item['Active substance']) 
      ? item['Active substance'].join(', ') 
      : (item['Active substance'] || 'N/A'),
    intendedUse: item['Intended use'] || 'N/A',
    medicineName: item['Medicine name'] || 'N/A',
    status: item['Status'] || 'N/A',
    designationDate: item['Date of designation / refusal'] || null,
    orphanUrl: item['Orphan designation URL'] || null,
    relatedProductNumber: item['Related EMA product number'] || 'N/A',
    firstPublishedDate: item['First published date'] || null,
    lastUpdatedDate: item['Last updated date'] || null
  };
}

function mapPsusaData(item) {
  return {
    id: item._id,
    activeSubstances: item.activeSubstancesInScope || item.activeSubstanceRaw || 'N/A',
    activeSubstanceArray: item.activeSubstances || [],
    procedureNumber: item.procedureNumber || 'N/A',
    regulatoryOutcome: item.regulatoryOutcome || 'N/A',
    year: item.year ? (item.year.$numberInt || item.year) : 'N/A',
    period: item.period ? (item.period.$numberInt || item.period) : 'N/A',
    psusaId: item.psusaId || 'N/A',
    periodCode: item.periodCode || 'N/A',
    category: item.category || 'N/A',
    relatedMedicines: item.relatedMedicines || 'N/A',
    psusaUrl: item.psusaUrl || null,
    dataSource: item.dataSource || 'N/A',
    recordType: item.recordType || 'N/A',
    uploadBatch: item.uploadBatch || null,
    firstPublishedDate: item.firstPublishedDate || item.firstPublishedDateRaw || null,
    lastUpdatedDate: item.lastUpdatedDate || item.lastUpdatedDateRaw || null,
    uploadedAt: item.uploadedAt || null
  };
}

function mapReferralData(item) {
  return {
    id: item._id,
    inn: item['International non-proprietary name (INN) / common name'] || 'N/A',
    referralName: item['Referral name'] || 'N/A',
    associatedNamesCentrally: item['Associated names (centrally authorised medicines)'] || 'N/A',
    associatedNamesNationally: item['Associated names (non-centrally authorised medicines)'] || 'N/A',
    authModel: item['Authorisation model'] || 'N/A',
    category: item['Category'] || 'N/A',
    currentStatus: item['Current status'] || 'N/A',
    class: item['Class'] || 'N/A',
    ecDecisionDate: item['European Commission decision date'] || null,
    procedureStartDate: item['Procedure start date'] || null,
    chmpCvmpOpinionDate: item['CHMP/CVMP opinion date'] || null,
    cmdhPositionDate: item['CMDh position date'] || null,
    pracRecommendationDate: item['PRAC recommendation date'] || null,
    pracRecommendation: item['PRAC recommendation'] || 'N/A',
    pracDecisionMakingModel: item['PRAC decision making model'] || 'N/A',
    nonPracDecisionMakingModel: item['Non-PRAC decision making model'] || 'N/A',
    referenceNumber: item['Reference number'] || 'N/A',
    referralType: item['Referral type'] || 'N/A',
    safetyReferral: item['Safety referral?'] || 'N/A',
    referralUrl: item['Referral URL'] || null,
    firstPublishedDate: item['First published date'] || null,
    lastUpdatedDate: item['Last updated date'] || null
  };
}

function mapPostAuthData(item) {
  return {
    id: item._id,
    medicineName: item['Name of medicine'] || 'N/A',
    activeSubstance: item['Active substance'] || 'N/A',
    category: item['Category'] || 'N/A',
    productNumber: item['EMA product number'] || 'N/A',
    postAuthUrl: item['Medicine post-authorisation procedure URL'] || null,
    postAuthOpinionDate: item['Post-authorisation opinion date'] || null,
    postAuthOpinionStatus: item['Post-authorisation opinion status'] || 'N/A',
    postAuthProcedureStatus: item['Post-authorisation procedure status'] || 'N/A',
    species: item['Species\n(veterinary)'] || 'N/A',
    inn: item['International non-proprietary name (INN) / common name'] || 'N/A',
    therapeuticArea: item['Therapeutic area (MeSH)'] || 'N/A',
    atcCode: item['ATC code (human)'] || 'N/A',
    atcVetCode: item['ATCvet code (veterinary)'] || 'N/A',
    acceleratedAssessment: item['Accelerated assessment'] || 'No',
    additionalMonitoring: item['Additional monitoring'] || 'No',
    advancedTherapy: item['Advanced therapy'] || 'No',
    biosimilar: item['Biosimilar'] || 'No',
    conditionalApproval: item['Conditional approval'] || 'No',
    exceptionalCircumstances: item['Exceptional circumstances'] || 'No',
    genericOrHybrid: item['Generic or hybrid'] || 'No',
    orphanMedicine: item['Orphan medicine'] || 'No',
    primeStatus: item['PRIME: priority medicine'] || 'No',
    marketingAuthDate: item['Marketing authorisation date'] || null,
    marketingAuthDeveloper: item['Marketing authorisation developer / applicant / holder'] || 'N/A',
    withdrawalDate: item['Withdrawal of application date'] || null,
    firstPublishedDate: item['First published date'] || null,
    lastUpdatedDate: item['Last updated date'] || null
  };
}

function mapPipData(item) {
  return {
    id: item._id,
    pipNumber: item['PIP number'] || 'N/A',
    activeSubstance: item['Active substance'] || 'N/A',
    condition: item['Condition / indication'] || 'N/A',
    inventedName: item['Invented name'] || 'N/A',
    decisionDate: item['Decision date'] || null,
    decisionNumber: item['Decision number'] || 'N/A',
    decisionType: item['Decision type'] || 'N/A',
    pipUrl: item['PIP URL'] || null,
    pharmaceuticalForms: item['Pharmaceutical forms'] || 'N/A',
    routesOfAdministration: item['Routes of administration'] || 'N/A',
    therapeuticArea: item['Therapeutic area'] || 'N/A',
    complianceOpinionDate: item['Compliance opinion date'] || null,
    complianceOutcome: item['Compliance outcome'] || 'N/A',
    complianceProcedureNumber: item['Compliance procedure number'] || 'N/A',
    contactCompany: item['Contact for public enquiries'] ? item['Contact for public enquiries'].company : 'N/A',
    contactEmail: item['Contact for public enquiries'] ? item['Contact for public enquiries'].email : 'N/A',
    contactPhone: item['Contact for public enquiries'] ? item['Contact for public enquiries'].phone : 'N/A',
    firstPublishedDate: item['First published date'] || null,
    lastUpdatedDate: item['Last updated date'] || null
  };
}

function mapOutsideEuData(item) {
  return {
    id: item._id,
    medicineName: item['Name of medicine'] || 'N/A',
    activeSubstance: item['Active substance'] || 'N/A',
    inn: item['International non-proprietary name (INN) / common name'] || 'N/A',
    therapeuticArea: item['Therapeutic area (MeSH)'] || 'N/A',
    atcCode: item['ATC code (human)'] || 'N/A',
    opinionDate: item['Date of opinion'] || null,
    outcomeDate: item['Date of outcome'] || null,
    opinionNumber: item['EMA opinion number'] || 'N/A',
    opinionStatus: item['EMA opinion status'] || 'N/A',
    opinionHolder: item['Opinion holder'] || 'N/A',
    pharmacotherapeuticGroup: item['Pharmacotherapeutic group\n(human)'] || 'N/A',
    therapeuticIndication: item['Therapeutic indication'] || 'N/A',
    latestProcedure: item['Latest procedure affecting product information'] || 'N/A',
    outsideEuUrl: item['Opinion on medicines for use outside EU URL'] || null,
    firstPublishedDate: item['First published date'] || null,
    lastUpdatedDate: item['Last updated date'] || null
  };
}

function mapProductUrlData(item) {
  return {
    id: item._id,
    productName: item['ProductName'] || 'N/A',
    productNumber: item['ProductNumber'] || 'N/A',
    domain: item['Domain'] || 'N/A',
    languageCode: item['LanguageCode'] || 'N/A',
    oldUrl: item['URL(oldwebsite)'] || null,
    currentUrl: item['URL(currentwebsite)'] || null
  };
}

// MAIN COMBINED SEARCH ROUTE
router.get('/search/:compound', async (req, res) => {
  try {
    const database = getDB();
    const searchQuery = buildCompoundSearchQuery(req.params.compound);
    
    console.log('EMA Search Query for compound:', req.params.compound);
    console.log('Search Query:', JSON.stringify(searchQuery, null, 2));
    
    // Search all collections in parallel with proper error handling
    const searchPromises = [
      database.collection('dhpc_medicines').find(searchQuery).limit(20).toArray().catch(err => {
        console.error('DHPC search error:', err);
        return [];
      }),
      database.collection('herbal_medicines').find(searchQuery).limit(20).toArray().catch(err => {
        console.error('Herbal search error:', err);
        return [];
      }),
      database.collection('medicines').find(searchQuery).limit(20).toArray().catch(err => {
        console.error('Medicines search error:', err);
        return [];
      }),
      database.collection('orphan_designations').find(searchQuery).limit(20).toArray().catch(err => {
        console.error('Orphan search error:', err);
        return [];
      }),
      database.collection('outside_eu_medicines').find(searchQuery).limit(20).toArray().catch(err => {
        console.error('Outside EU search error:', err);
        return [];
      }),
      database.collection('pip_medicines').find(searchQuery).limit(20).toArray().catch(err => {
        console.error('PIP search error:', err);
        return [];
      }),
      database.collection('post_authorisation_medicines').find(searchQuery).limit(20).toArray().catch(err => {
        console.error('Post-auth search error:', err);
        return [];
      }),
      database.collection('psusa_assesments').find(searchQuery).limit(20).toArray().catch(err => {
        console.error('PSUSA search error:', err);
        return [];
      }),
      database.collection('referrals_medicines').find(searchQuery).limit(20).toArray().catch(err => {
        console.error('Referrals search error:', err);
        return [];
      }),
      database.collection('shortage_medicines').find(searchQuery).limit(20).toArray().catch(err => {
        console.error('Shortages search error:', err);
        return [];
      }),
      database.collection('product_urls').find(searchQuery).limit(10).toArray().catch(err => {
        console.error('Product URLs search error:', err);
        return [];
      })
    ];

    const [
      dhpcResults,
      herbalResults, 
      medicinesResults,
      orphanResults,
      outsideEuResults,
      pipResults,
      postAuthResults,
      psusaResults,
      referralsResults,
      shortagesResults,
      productUrlResults
    ] = await Promise.all(searchPromises);

    console.log('Search Results Summary:', {
      dhpc: dhpcResults.length,
      herbal: herbalResults.length,
      medicines: medicinesResults.length,
      orphan: orphanResults.length,
      outsideEu: outsideEuResults.length,
      pip: pipResults.length,
      postAuth: postAuthResults.length,
      psusa: psusaResults.length,
      referrals: referralsResults.length,
      shortages: shortagesResults.length,
      productUrls: productUrlResults.length
    });

    // Map the results using the proper field mapping functions
    const mappedResults = {
      success: true,
      totalCount: dhpcResults.length + herbalResults.length + medicinesResults.length + 
                 orphanResults.length + outsideEuResults.length + pipResults.length + 
                 postAuthResults.length + psusaResults.length + referralsResults.length + 
                 shortagesResults.length,
      
      // Main medicines (including centrally authorised and outside EU)
      medicines: [
        ...medicinesResults.map(mapMedicineData),
        ...outsideEuResults.map(item => ({
          ...mapOutsideEuData(item),
          category: 'Outside EU'
        }))
      ],
      
      // Safety communications (DHPC)
      safety: dhpcResults.map(mapDhpcData),
      
      // Herbal medicines
      herbal: herbalResults.map(mapHerbalData),
      
      // Orphan designations
      orphans: orphanResults.map(mapOrphanData),
      
      // PSUSA assessments
      psusa: psusaResults.map(mapPsusaData),
      
      // Referrals
      referrals: referralsResults.map(mapReferralData),
      
      // Shortages (using referral mapping as structure is similar)
      shortages: shortagesResults.map(mapReferralData),
      
      // Post-authorisation procedures
      postAuth: postAuthResults.map(mapPostAuthData),
      
      // Paediatric Investigation Plans
      pip: pipResults.map(mapPipData),
      
      // Product URLs
      productUrls: productUrlResults.map(mapProductUrlData),
      
      searchTerm: req.params.compound,
      timestamp: new Date().toISOString()
    };

    console.log('Mapped results total count:', mappedResults.totalCount);
    
    res.json(mappedResults);

  } catch (error) {
    console.error('EMA combined search error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search EMA data',
      details: error.message,
      totalCount: 0
    });
  }
});

// INDIVIDUAL COLLECTION ROUTES

// 1. DHPC Route (Safety Communications)
router.get('/dhpc/:compound', async (req, res) => {
  try {
    const database = getDB();
    const collection = database.collection('dhpc_medicines');
    const searchQuery = buildCompoundSearchQuery(req.params.compound);
    
    const results = await collection.find(searchQuery).limit(100).toArray();
    
    res.json({
      success: true,
      count: results.length,
      data: results.map(mapDhpcData)
    });
  } catch (error) {
    console.error('DHPC search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Herbal Medicines Route
router.get('/herbal/:compound', async (req, res) => {
  try {
    const database = getDB();
    const collection = database.collection('herbal_medicines');
    const searchQuery = buildCompoundSearchQuery(req.params.compound);
    
    const results = await collection.find(searchQuery).limit(100).toArray();
    
    res.json({
      success: true,
      count: results.length,
      data: results.map(mapHerbalData)
    });
  } catch (error) {
    console.error('Herbal medicines search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Medicines Route (Main medicines)
router.get('/medicines/:compound', async (req, res) => {
  try {
    const database = getDB();
    const collection = database.collection('medicines');
    const searchQuery = buildCompoundSearchQuery(req.params.compound);
    
    const results = await collection.find(searchQuery).limit(100).toArray();
    
    res.json({
      success: true,
      count: results.length,
      data: results.map(mapMedicineData)
    });
  } catch (error) {
    console.error('Medicines search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Orphan Designations Route
router.get('/orphan/:compound', async (req, res) => {
  try {
    const database = getDB();
    const collection = database.collection('orphan_designations');
    const searchQuery = buildCompoundSearchQuery(req.params.compound);
    
    const results = await collection.find(searchQuery).limit(100).toArray();
    
    res.json({
      success: true,
      count: results.length,
      data: results.map(mapOrphanData)
    });
  } catch (error) {
    console.error('Orphan designations search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Outside EU Medicines Route
router.get('/outside-eu/:compound', async (req, res) => {
  try {
    const database = getDB();
    const collection = database.collection('outside_eu_medicines');
    const searchQuery = buildCompoundSearchQuery(req.params.compound);
    
    const results = await collection.find(searchQuery).limit(100).toArray();
    
    res.json({
      success: true,
      count: results.length,
      data: results.map(mapOutsideEuData)
    });
  } catch (error) {
    console.error('Outside EU medicines search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. PIP Medicines Route
router.get('/pip/:compound', async (req, res) => {
  try {
    const database = getDB();
    const collection = database.collection('pip_medicines');
    const searchQuery = buildCompoundSearchQuery(req.params.compound);
    
    const results = await collection.find(searchQuery).limit(100).toArray();
    
    res.json({
      success: true,
      count: results.length,
      data: results.map(mapPipData)
    });
  } catch (error) {
    console.error('PIP medicines search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Post-Authorisation Medicines Route
router.get('/post-auth/:compound', async (req, res) => {
  try {
    const database = getDB();
    const collection = database.collection('post_authorisation_medicines');
    const searchQuery = buildCompoundSearchQuery(req.params.compound);
    
    const results = await collection.find(searchQuery).limit(100).toArray();
    
    res.json({
      success: true,
      count: results.length,
      data: results.map(mapPostAuthData)
    });
  } catch (error) {
    console.error('Post-authorisation search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. PSUSA Assessments Route
router.get('/psusa/:compound', async (req, res) => {
  try {
    const database = getDB();
    const collection = database.collection('psusa_assesments');
    const searchQuery = buildCompoundSearchQuery(req.params.compound);
    
    const results = await collection.find(searchQuery).limit(100).toArray();
    
    res.json({
      success: true,
      count: results.length,
      data: results.map(mapPsusaData)
    });
  } catch (error) {
    console.error('PSUSA search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Referrals Route
router.get('/referrals/:compound', async (req, res) => {
  try {
    const database = getDB();
    const collection = database.collection('referrals_medicines');
    const searchQuery = buildCompoundSearchQuery(req.params.compound);
    
    const results = await collection.find(searchQuery).limit(100).toArray();
    
    res.json({
      success: true,
      count: results.length,
      data: results.map(mapReferralData)
    });
  } catch (error) {
    console.error('Referrals search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. Shortage Medicines Route
router.get('/shortages/:compound', async (req, res) => {
  try {
    const database = getDB();
    const collection = database.collection('shortage_medicines');
    const searchQuery = buildCompoundSearchQuery(req.params.compound);
    
    const results = await collection.find(searchQuery).limit(100).toArray();
    
    res.json({
      success: true,
      count: results.length,
      data: results.map(mapReferralData) // Uses same structure as referrals
    });
  } catch (error) {
    console.error('Shortages search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. Product URLs Route
router.get('/product-urls/:compound', async (req, res) => {
  try {
    const database = getDB();
    const collection = database.collection('product_urls');
    const searchQuery = buildCompoundSearchQuery(req.params.compound);
    
    const results = await collection.find(searchQuery).limit(100).toArray();
    
    res.json({
      success: true,
      count: results.length,
      data: results.map(mapProductUrlData)
    });
  } catch (error) {
    console.error('Product URLs search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SPECIALIZED SEARCH ROUTES

// Enhanced drug-specific search route
router.get('/drug/:compound', async (req, res) => {
  try {
    const database = getDB();
    const searchQuery = buildCompoundSearchQuery(req.params.compound);
    
    console.log('EMA Drug search for:', req.params.compound);
    
    // Search specific collections most relevant for drug searches
    const searchPromises = [
      database.collection('medicines').find(searchQuery).limit(50).toArray(),
      database.collection('dhpc_medicines').find(searchQuery).limit(20).toArray(),
      database.collection('orphan_designations').find(searchQuery).limit(20).toArray(),
      database.collection('outside_eu_medicines').find(searchQuery).limit(20).toArray(),
      database.collection('post_authorisation_medicines').find(searchQuery).limit(20).toArray(),
      database.collection('pip_medicines').find(searchQuery).limit(10).toArray()
    ];

    const [
      medicinesResults,
      dhpcResults,
      orphanResults,
      outsideEuResults,
      postAuthResults,
      pipResults
    ] = await Promise.all(searchPromises);

    const result = {
      success: true,
      totalCount: medicinesResults.length + dhpcResults.length + orphanResults.length + 
                 outsideEuResults.length + postAuthResults.length + pipResults.length,
      
      medicines: medicinesResults.map(mapMedicineData),
      safety: dhpcResults.map(mapDhpcData),
      orphans: orphanResults.map(mapOrphanData),
      outsideEu: outsideEuResults.map(mapOutsideEuData),
      postAuth: postAuthResults.map(mapPostAuthData),
      pip: pipResults.map(mapPipData),
      
      searchTerm: req.params.compound,
      searchType: 'drug',
      timestamp: new Date().toISOString()
    };

    console.log('Drug search results:', result.totalCount, 'total items found');
    res.json(result);

  } catch (error) {
    console.error('EMA drug search error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search EMA drug data',
      details: error.message 
    });
  }
});

// Enhanced condition-specific search route
router.get('/condition/:condition', async (req, res) => {
  try {
    const database = getDB();
    const conditionQuery = buildCompoundSearchQuery(req.params.condition);
    
    console.log('EMA Condition search for:', req.params.condition);
    
    // Search collections most relevant for condition searches
    const searchPromises = [
      database.collection('medicines').find(conditionQuery).limit(30).toArray(),
      database.collection('orphan_designations').find(conditionQuery).limit(30).toArray(),
      database.collection('herbal_medicines').find(conditionQuery).limit(20).toArray(),
      database.collection('dhpc_medicines').find(conditionQuery).limit(20).toArray(),
      database.collection('pip_medicines').find(conditionQuery).limit(15).toArray()
    ];

    const [
      medicinesResults,
      orphanResults,
      herbalResults,
      dhpcResults,
      pipResults
    ] = await Promise.all(searchPromises);

    const result = {
      success: true,
      totalCount: medicinesResults.length + orphanResults.length + 
                 herbalResults.length + dhpcResults.length + pipResults.length,
      
      medicines: medicinesResults.map(mapMedicineData),
      orphans: orphanResults.map(mapOrphanData),
      herbal: herbalResults.map(mapHerbalData),
      safety: dhpcResults.map(mapDhpcData),
      pip: pipResults.map(mapPipData),
      
      searchTerm: req.params.condition,
      searchType: 'condition',
      timestamp: new Date().toISOString()
    };

    console.log('Condition search results:', result.totalCount, 'total items found');
    res.json(result);

  } catch (error) {
    console.error('EMA condition search error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search EMA condition data',
      details: error.message 
    });
  }
});

// Database status and health check route
router.get('/status', async (req, res) => {
  try {
    const database = getDB();
    
    // Check collection stats
    const collections = [
      'dhpc_medicines',
      'herbal_medicines', 
      'medicines',
      'orphan_designations',
      'outside_eu_medicines',
      'pip_medicines',
      'post_authorisation_medicines',
      'psusa_assesments',
      'referrals_medicines',
      'shortage_medicines',
      'product_urls'
    ];

    const stats = {};
    for (const collectionName of collections) {
      try {
        const count = await database.collection(collectionName).countDocuments();
        stats[collectionName] = count;
      } catch (error) {
        stats[collectionName] = `Error: ${error.message}`;
      }
    }

    res.json({
      success: true,
      status: 'EMA Database Online',
      collections: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('EMA status check error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check EMA database status',
      details: error.message 
    });
  }
});

// Export the router
module.exports = router;