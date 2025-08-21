
// ============================================
// ENHANCED LABEL FETCHING FROM FDA/DAILYMED
// ============================================

async function fetchEnhancedLabelContent(labelId) {
    try {
        console.log(`📄 Fetching enhanced content for label: ${labelId}`);
        
        // Check if it's an uploaded label first
        if (labelId.startsWith('upload_')) {
            const uploadedLabel = uploadedLabelsStorage.get(labelId);
            if (uploadedLabel) {
                return {
                    sections: uploadedLabel.sections,
                    metadata: uploadedLabel.metadata,
                    productInfo: uploadedLabel.productInfo,
                    source: 'upload'
                };
            }
        }
        
        // Try multiple sources for comprehensive data
        const labelData = await fetchFromMultipleSources(labelId);
        
        return labelData;
    } catch (error) {
        console.error('Error fetching enhanced label content:', error);
        throw error;
    }
}

async function fetchFromMultipleSources(labelId) {
    let combinedData = {
        sections: {},
        metadata: {},
        productInfo: {},
        sources: []
    };
    
    // 1. Try FDA Label API with comprehensive search
    try {
        const fdaData = await fetchFDALabelData(labelId);
        if (fdaData) {
            combinedData = mergeLabeLData(combinedData, fdaData);
            combinedData.sources.push('FDA');
        }
    } catch (error) {
        console.log('FDA fetch failed:', error.message);
    }
    
    // 2. Try DailyMed XML API
    try {
        const dailyMedData = await fetchDailyMedXML(labelId);
        if (dailyMedData) {
            combinedData = mergeLabeLData(combinedData, dailyMedData);
            combinedData.sources.push('DailyMed');
        }
    } catch (error) {
        console.log('DailyMed fetch failed:', error.message);
    }
    
    // 3. Try DailyMed REST API v2
    try {
        const dailyMedV2Data = await fetchDailyMedV2(labelId);
        if (dailyMedV2Data) {
            combinedData = mergeLabeLData(combinedData, dailyMedV2Data);
            combinedData.sources.push('DailyMed-v2');
        }
    } catch (error) {
        console.log('DailyMed v2 fetch failed:', error.message);
    }
    
    return combinedData;
}

async function fetchFDALabelData(labelId) {
    // Try multiple search strategies
    const searchStrategies = [
        { search: `id:"${labelId}"` },
        { search: `set_id:"${labelId}"` },
        { search: `spl_id:"${labelId}"` },
        { search: `openfda.spl_id:"${labelId}"` },
        { search: `openfda.spl_set_id:"${labelId}"` }
    ];
    
    for (const strategy of searchStrategies) {
        try {
            const response = await axios.get(`${APIs.LABEL}`, {
                params: {
                    ...strategy,
                    limit: 1
                },
                timeout: 10000
            });
            
            if (response.data?.results?.[0]) {
                return parseFDALabel(response.data.results[0]);
            }
        } catch (error) {
            continue; // Try next strategy
        }
    }
    
    return null;
}

function parseFDALabel(fdaLabel) {
    const sections = {};
    const metadata = {};
    const productInfo = {};
    
    // Extract all available sections
    const sectionMappings = {
        'boxed_warning': 'Boxed Warning',
        'warnings': 'Warnings',
        'warnings_and_precautions': 'Warnings and Precautions',
        'indications_and_usage': 'Indications and Usage',
        'dosage_and_administration': 'Dosage and Administration',
        'dosage_forms_and_strengths': 'Dosage Forms and Strengths',
        'contraindications': 'Contraindications',
        'adverse_reactions': 'Adverse Reactions',
        'drug_interactions': 'Drug Interactions',
        'use_in_specific_populations': 'Use in Specific Populations',
        'drug_abuse_and_dependence': 'Drug Abuse and Dependence',
        'overdosage': 'Overdosage',
        'description': 'Description',
        'clinical_pharmacology': 'Clinical Pharmacology',
        'nonclinical_toxicology': 'Nonclinical Toxicology',
        'clinical_studies': 'Clinical Studies',
        'references': 'References',
        'how_supplied': 'How Supplied/Storage and Handling',
        'patient_counseling_information': 'Patient Counseling Information',
        'medication_guide': 'Medication Guide',
        'instructions_for_use': 'Instructions for Use',
        'package_label_principal_display_panel': 'Principal Display Panel',
        'spl_patient_package_insert': 'Patient Package Insert',
        'information_for_patients': 'Information for Patients',
        'pregnancy': 'Pregnancy',
        'pediatric_use': 'Pediatric Use',
        'geriatric_use': 'Geriatric Use',
        'mechanism_of_action': 'Mechanism of Action',
        'pharmacokinetics': 'Pharmacokinetics',
        'pharmacodynamics': 'Pharmacodynamics',
        'microbiology': 'Microbiology',
        'recent_major_changes': 'Recent Major Changes',
        'warnings_and_cautions': 'Warnings and Cautions',
        'general_precautions': 'General Precautions',
        'laboratory_tests': 'Laboratory Tests',
        'carcinogenesis_mutagenesis_impairment_of_fertility': 'Carcinogenesis, Mutagenesis, Impairment of Fertility'
    };
    
    // Extract each section
    for (const [apiField, displayName] of Object.entries(sectionMappings)) {
        if (fdaLabel[apiField]) {
            sections[displayName] = Array.isArray(fdaLabel[apiField]) 
                ? fdaLabel[apiField].join('\n\n')
                : fdaLabel[apiField];
        }
    }
    
    // Extract metadata
    if (fdaLabel.openfda) {
        metadata.manufacturer = fdaLabel.openfda.manufacturer_name?.[0] || '';
        metadata.brandName = fdaLabel.openfda.brand_name?.[0] || '';
        metadata.genericName = fdaLabel.openfda.generic_name?.[0] || '';
        metadata.applicationNumber = fdaLabel.openfda.application_number?.[0] || '';
        metadata.splSetId = fdaLabel.openfda.spl_set_id?.[0] || '';
        metadata.splId = fdaLabel.openfda.spl_id?.[0] || '';
    }
    
    metadata.effectiveDate = fdaLabel.effective_time || '';
    metadata.version = fdaLabel.version || '1.0';
    
    // Extract product info
    productInfo.ndc = fdaLabel.openfda?.product_ndc || [];
    productInfo.route = fdaLabel.openfda?.route || [];
    productInfo.dosageForm = fdaLabel.openfda?.dosage_form || [];
    productInfo.productType = fdaLabel.openfda?.product_type || [];
    productInfo.substanceName = fdaLabel.openfda?.substance_name || [];
    
    return { sections, metadata, productInfo };
}

async function fetchDailyMedXML(setId) {
    try {
        const xmlUrl = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${setId}.xml`;
        const response = await axios.get(xmlUrl, {
            timeout: 15000,
            headers: {
                'Accept': 'application/xml, text/xml, */*',
                'User-Agent': 'PharmLabelSystem/2.0'
            }
        });
        
        if (response.data) {
            const parser = new EnhancedSPLParser();
            return await parser.parseXMLLabel(response.data);
        }
    } catch (error) {
        console.log('DailyMed XML fetch error:', error.message);
    }
    
    return null;
}

async function fetchDailyMedV2(setId) {
    try {
        // Try the v2 REST API
        const response = await axios.get(
            `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${setId}.json`,
            { timeout: 10000 }
        );
        
        if (response.data?.data) {
            return parseDailyMedV2Response(response.data.data);
        }
    } catch (error) {
        console.log('DailyMed v2 fetch error:', error.message);
    }
    
    return null;
}

function parseDailyMedV2Response(data) {
    const sections = {};
    const metadata = {};
    const productInfo = {};
    
    // Parse sections from the response
    if (data.sections) {
        for (const section of data.sections) {
            if (section.title && section.text) {
                sections[section.title] = section.text;
            }
        }
    }
    
    // Parse metadata
    metadata.title = data.title || '';
    metadata.setId = data.setid || '';
    metadata.versionNumber = data.version || '1.0';
    metadata.effectiveDate = data.effective_time || '';
    
    // Parse product info
    if (data.products) {
        productInfo.products = data.products;
    }
    
    return { sections, metadata, productInfo };
}

function mergeLabeLData(existing, newData) {
    // Merge sections (prefer non-empty values)
    for (const [key, value] of Object.entries(newData.sections || {})) {
        if (value && (!existing.sections[key] || value.length > existing.sections[key].length)) {
            existing.sections[key] = value;
        }
    }
    
    // Merge metadata
    for (const [key, value] of Object.entries(newData.metadata || {})) {
        if (value && !existing.metadata[key]) {
            existing.metadata[key] = value;
        }
    }
    
    // Merge product info
    for (const [key, value] of Object.entries(newData.productInfo || {})) {
        if (value && !existing.productInfo[key]) {
            existing.productInfo[key] = value;
        }
    }
    
    return existing;
}

// ============================================
// UPDATED ENDPOINTS FOR SERVER.JS
// ============================================

// Replace the existing SPLParser with EnhancedSPLParser
const splParser = new EnhancedSPLParser();

// Updated upload endpoint with enhanced parsing
app.post('/api/upload-xml-label', upload.single('file'), async (req, res) => {
    try {
        const { name, description } = req.body;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        console.log(`📤 Processing XML label: ${name || file.originalname}`);
        
        // Read file content
        const xmlContent = await fs.readFile(file.path, 'utf-8');
        
        // Parse with enhanced parser
        const parsedData = await splParser.parseXMLLabel(xmlContent);
        
        // Generate unique ID
        const labelId = `upload_${crypto.randomBytes(8).toString('hex')}`;
        
        // Clean up uploaded file
        await fs.unlink(file.path).catch(() => {});
        
        // Create label object with all extracted data
        const label = {
            id: labelId,
            name: name || file.originalname,
            description: description || '',
            sections: parsedData.sections,
            sectionsAvailable: Object.keys(parsedData.sections).reduce((acc, key) => {
                acc[key] = parsedData.sections[key] ? true : false;
                return acc;
            }, {}),
            sectionsCount: Object.keys(parsedData.sections).length,
            metadata: parsedData.metadata,
            productInfo: parsedData.productInfo,
            uploadDate: new Date().toISOString(),
            source: 'upload',
            raw: parsedData.raw // Keep for debugging if needed
        };
        
        // Store in memory
        uploadedLabelsStorage.set(labelId, label);
        
        console.log(`✅ Successfully parsed ${label.sectionsCount} sections from XML`);
        
        res.json({ 
            success: true, 
            label: label,
            message: `Successfully extracted ${label.sectionsCount} sections from XML label`
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        
        // Clean up file if exists
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        
        res.status(500).json({ 
            error: 'Failed to process XML label', 
            message: error.message 
        });
    }
});

// Enhanced label content endpoint
app.get('/api/label-content/:labelId', async (req, res) => {
    try {
        const { labelId } = req.params;
        console.log(`📄 Getting enhanced label content for: ${labelId}`);
        
        const labelData = await fetchEnhancedLabelContent(labelId);
        
        if (labelData && Object.keys(labelData.sections).length > 0) {
            res.json(labelData);
        } else {
            res.status(404).json({ 
                error: 'Label not found or no content available',
                labelId: labelId 
            });
        }
    } catch (error) {
        console.error('Error fetching label content:', error);
        res.status(500).json({ 
            error: 'Failed to fetch label content',
            message: error.message 
        });
    }
});

// Export the enhanced parser for use in other modules
module.exports = { EnhancedSPLParser, fetchEnhancedLabelContent };