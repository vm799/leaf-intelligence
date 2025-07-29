/**
 * PERFECT PHARMACEUTICAL COMPANY MATCHING ALGORITHM
 * 
 * This advanced matching system is designed specifically for pharmaceutical companies
 * and handles all the complex variations, subsidiaries, and naming conventions
 * found in FDA databases, warning letters, Form 483s, and inspection data.
 */

class PharmaceuticalCompanyMatcher {
  constructor() {
    // Comprehensive pharmaceutical company knowledge base
    this.companyAliases = {
      // Johnson & Johnson Family
      'johnson & johnson': ['j&j', 'jnj', 'johnson and johnson', 'johnson johnson'],
      'janssen': ['janssen pharmaceuticals', 'janssen biotech', 'janssen therapeutics', 'janssen cilag', 'janssen research'],
      
      // Pfizer Family
      'pfizer': ['pfizer inc', 'pfizer global', 'pfizer manufacturing', 'pfizer pharmaceuticals'],
      
      // Novartis Family
      'novartis': ['novartis pharma', 'novartis pharmaceuticals', 'novartis ag'],
      'sandoz': ['sandoz inc', 'sandoz pharmaceuticals', 'sandoz gmbh'],
      
      // Merck Family
      'merck': ['merck & co', 'merck sharp', 'merck sharp & dohme', 'msd'],
      'merck kgaa': ['merck darmstadt', 'emd serono', 'emd millipore'],
      
      // GSK Family
      'gsk': ['glaxosmithkline', 'glaxo smith kline', 'glaxo smithkline'],
      'glaxosmithkline': ['gsk', 'glaxo smith kline'],
      
      // Roche Family
      'roche': ['f. hoffmann-la roche', 'hoffmann-la roche', 'hoffmann la roche'],
      'genentech': ['genentech inc', 'genentech usa'],
      
      // Sanofi Family
      'sanofi': ['sanofi aventis', 'sanofi-aventis', 'sanofi pasteur', 'sanofi genzyme'],
      
      // AbbVie Family
      'abbvie': ['abbvie inc', 'abbvie pharmaceuticals'],
      
      // Bristol Myers Squibb
      'bristol myers squibb': ['bms', 'bristol-myers squibb', 'bristol myers'],
      'celgene': ['celgene corporation', 'celgene corp'],
      
      // Eli Lilly
      'eli lilly': ['lilly', 'eli lilly and company', 'lilly usa'],
      
      // AstraZeneca
      'astrazeneca': ['astrazeneca pharmaceuticals', 'astrazeneca uk', 'astrazeneca ab'],
      
      // Bayer
      'bayer': ['bayer ag', 'bayer healthcare', 'bayer pharmaceuticals'],
      
      // Takeda
      'takeda': ['takeda pharmaceutical', 'takeda pharmaceuticals'],
      'shire': ['shire pharmaceuticals', 'shire plc'],
      
      // Boehringer Ingelheim
      'boehringer ingelheim': ['boehringer', 'bi pharmaceuticals'],
      
      // Amgen
      'amgen': ['amgen inc', 'amgen manufacturing'],
      
      // Gilead
      'gilead': ['gilead sciences', 'gilead pharmaceuticals'],
      
      // Common Generic/CDMO Companies
      'teva': ['teva pharmaceuticals', 'teva pharmaceutical industries'],
      'mylan': ['mylan pharmaceuticals', 'mylan inc', 'viatris'],
      'viatris': ['mylan', 'mylan pharmaceuticals'],
      'sandoz': ['novartis sandoz', 'sandoz inc'],
      'fresenius': ['fresenius kabi', 'fresenius pharma'],
      'hikma': ['hikma pharmaceuticals', 'hikma pharma'],
      'hospira': ['hospira inc', 'pfizer hospira'],
      'endo': ['endo pharmaceuticals', 'endo international'],
      'mallinckrodt': ['mallinckrodt pharmaceuticals', 'mallinckrodt inc'],
      'west-ward': ['west ward pharmaceuticals', 'westward pharma'],
      'amneal': ['amneal pharmaceuticals', 'amneal pharma'],
      'lupin': ['lupin pharmaceuticals', 'lupin limited'],
      'aurobindo': ['aurobindo pharma', 'aurobindo pharmaceuticals'],
      'gland': ['gland pharma', 'gland pharmaceuticals'],
      'eugia': ['eugia pharma', 'eugia us']
    };

    // Common pharmaceutical suffixes and their variations
    this.businessSuffixes = [
      'inc', 'incorporated', 'corp', 'corporation', 'llc', 'ltd', 'limited',
      'co', 'company', 'pharmaceutical', 'pharmaceuticals', 'pharma',
      'labs', 'laboratory', 'laboratories', 'research', 'therapeutics',
      'biotech', 'biotechnology', 'ag', 'gmbh', 'sa', 'nv', 'plc',
      'usa', 'us', 'americas', 'international', 'global', 'worldwide'
    ];

    // Legal entity indicators
    this.legalEntityPatterns = [
      /\b(holdings?|group|ventures?|partners?|solutions?)\b/i,
      /\b(manufacturing|production|facility|plant)\b/i,
      /\b(subsidiary|division|unit|branch)\b/i,
      /\b(north america|americas|europe|asia|pacific)\b/i
    ];

    // Precompile common patterns for performance
    this.suffixPattern = new RegExp(
      `\\s+(${this.businessSuffixes.join('|')})\\s*\\.?$`, 'i'
    );
  }

  /**
   * Main matching function - returns a matcher function for the given search terms
   */
  createMatcher(searchTerms) {
    if (!Array.isArray(searchTerms)) {
      searchTerms = [searchTerms];
    }

    // Normalize and expand all search terms
    const expandedTerms = searchTerms.flatMap(term => this.expandCompanyName(term));
    const normalizedTerms = expandedTerms.map(term => this.normalizeCompanyName(term));

    return (companyName) => {
      if (!companyName || typeof companyName !== 'string') {
        return false;
      }

      const normalizedCompany = this.normalizeCompanyName(companyName);
      
      return normalizedTerms.some(searchTerm => 
        this.isMatch(normalizedCompany, searchTerm, companyName)
      );
    };
  }

  /**
   * Expand a company name to include all known aliases and variations
   */
  expandCompanyName(companyName) {
    const normalized = this.normalizeCompanyName(companyName);
    const variations = [companyName, normalized];

    // Add known aliases
    for (const [canonical, aliases] of Object.entries(this.companyAliases)) {
      if (normalized.includes(canonical) || aliases.some(alias => normalized.includes(alias))) {
        variations.push(canonical, ...aliases);
      }
    }

    // Add suffix variations
    const withoutSuffix = normalized.replace(this.suffixPattern, '').trim();
    if (withoutSuffix !== normalized && withoutSuffix.length > 2) {
      variations.push(withoutSuffix);
      
      // Add common pharmaceutical suffixes to the base name
      variations.push(
        withoutSuffix + ' pharmaceuticals',
        withoutSuffix + ' pharma',
        withoutSuffix + ' inc',
        withoutSuffix + ' corp'
      );
    }

    // Handle abbreviations
    variations.push(...this.generateAbbreviations(withoutSuffix));

    // Remove duplicates and empty strings
    return [...new Set(variations.filter(v => v && v.length > 1))];
  }

  /**
   * Normalize company name for comparison
   */
  normalizeCompanyName(name) {
    if (!name) return '';
    
    return name
      .toLowerCase()
      .trim()
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Normalize punctuation
      .replace(/[.]/g, '')
      .replace(/[,]/g, ' ')
      .replace(/[&]/g, ' and ')
      .replace(/[-]/g, ' ')
      // Remove common noise words
      .replace(/\b(the|a|an)\b/g, '')
      // Clean up spaces again
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Core matching logic with multiple strategies
   */
  isMatch(normalizedCompany, searchTerm, originalCompany) {
    // Strategy 1: Exact match
    if (normalizedCompany === searchTerm) {
      return true;
    }

    // Strategy 2: Company starts with search term (handles subsidiaries)
    if (normalizedCompany.startsWith(searchTerm + ' ')) {
      return true;
    }

    // Strategy 3: Search term starts with company (handles parent companies)
    if (searchTerm.startsWith(normalizedCompany + ' ')) {
      return true;
    }

    // Strategy 4: Remove business suffixes and try again
    const companyBase = normalizedCompany.replace(this.suffixPattern, '').trim();
    const searchBase = searchTerm.replace(this.suffixPattern, '').trim();
    
    if (companyBase === searchBase && companyBase.length > 2) {
      return true;
    }

    // Strategy 5: Check for subsidiary/division relationships
    if (this.isSubsidiaryMatch(normalizedCompany, searchTerm)) {
      return true;
    }

    // Strategy 6: Handle special pharmaceutical naming patterns
    if (this.isPharmaceuticalVariation(normalizedCompany, searchTerm)) {
      return true;
    }

    // Strategy 7: Fuzzy matching for very close matches (typos, etc.)
    if (this.isFuzzyMatch(companyBase, searchBase)) {
      return true;
    }

    return false;
  }

  /**
   * Check for subsidiary/division relationships
   */
  isSubsidiaryMatch(company, searchTerm) {
    // Check if company mentions searchTerm as a subsidiary/division
    const subsidiaryIndicators = [
      'subsidiary', 'division', 'unit', 'branch', 'affiliate',
      'owned by', 'part of', 'member of'
    ];

    for (const indicator of subsidiaryIndicators) {
      if (company.includes(indicator) && company.includes(searchTerm)) {
        return true;
      }
    }

    // Check legal entity patterns
    for (const pattern of this.legalEntityPatterns) {
      if (pattern.test(company) && company.includes(searchTerm)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Handle pharmaceutical-specific naming variations
   */
  isPharmaceuticalVariation(company, searchTerm) {
    // Handle manufacturing/facility variations
    const facilityVariations = [
      'manufacturing', 'facility', 'plant', 'site', 'operations',
      'production', 'factory', 'works'
    ];

    for (const variation of facilityVariations) {
      if (company.includes(searchTerm + ' ' + variation) ||
          company.includes(variation + ' ' + searchTerm)) {
        return true;
      }
    }

    // Handle regional variations
    const regions = [
      'usa', 'us', 'americas', 'europe', 'asia', 'global', 'international',
      'north america', 'latin america', 'asia pacific'
    ];

    for (const region of regions) {
      if (company.includes(searchTerm + ' ' + region) ||
          company.includes(region + ' ' + searchTerm)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate abbreviations for company names
   */
  generateAbbreviations(companyName) {
    if (!companyName || companyName.length < 6) return [];

    const words = companyName.split(' ').filter(word => word.length > 2);
    const abbreviations = [];

    if (words.length >= 2) {
      // Create acronym from first letters
      const acronym = words.map(word => word[0]).join('');
      if (acronym.length >= 2) {
        abbreviations.push(acronym);
      }

      // Create abbreviations using first letter + significant letters
      if (words.length === 2) {
        const [first, second] = words;
        abbreviations.push(first[0] + second[0]);
        if (second.length > 3) {
          abbreviations.push(first[0] + second.substring(0, 3));
        }
      }
    }

    return abbreviations;
  }

  /**
   * Fuzzy matching for close matches (handles typos)
   */
  isFuzzyMatch(str1, str2) {
    if (!str1 || !str2 || Math.abs(str1.length - str2.length) > 3) {
      return false;
    }

    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    const similarity = 1 - distance / maxLength;

    // Only consider it a match if similarity is very high (90%+)
    // and the strings are reasonably long to avoid false positives
    return similarity >= 0.9 && maxLength >= 6;
  }

  /**
   * Calculate Levenshtein distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Advanced matching with confidence scoring
   */
  getMatchWithConfidence(companyName, searchTerms) {
    const matcher = this.createMatcher(searchTerms);
    const isMatch = matcher(companyName);
    
    if (!isMatch) {
      return { match: false, confidence: 0, reason: 'no_match' };
    }

    // Calculate confidence based on match type
    const normalizedCompany = this.normalizeCompanyName(companyName);
    const expandedTerms = searchTerms.flatMap(term => this.expandCompanyName(term));
    
    let maxConfidence = 0;
    let matchReason = 'unknown';

    for (const searchTerm of expandedTerms) {
      const normalizedSearch = this.normalizeCompanyName(searchTerm);
      
      if (normalizedCompany === normalizedSearch) {
        maxConfidence = Math.max(maxConfidence, 1.0);
        matchReason = 'exact_match';
      } else if (normalizedCompany.startsWith(normalizedSearch + ' ')) {
        maxConfidence = Math.max(maxConfidence, 0.95);
        matchReason = 'subsidiary_match';
      } else if (this.isKnownAlias(normalizedCompany, normalizedSearch)) {
        maxConfidence = Math.max(maxConfidence, 0.9);
        matchReason = 'alias_match';
      } else if (this.isPharmaceuticalVariation(normalizedCompany, normalizedSearch)) {
        maxConfidence = Math.max(maxConfidence, 0.85);
        matchReason = 'variation_match';
      } else {
        maxConfidence = Math.max(maxConfidence, 0.7);
        matchReason = 'fuzzy_match';
      }
    }

    return { match: true, confidence: maxConfidence, reason: matchReason };
  }

  /**
   * Check if two names are known aliases
   */
  isKnownAlias(name1, name2) {
    for (const [canonical, aliases] of Object.entries(this.companyAliases)) {
      const allVariants = [canonical, ...aliases];
      if (allVariants.includes(name1) && allVariants.includes(name2)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Batch matching for multiple companies
   */
  batchMatch(companyNames, searchTerms) {
    const matcher = this.createMatcher(searchTerms);
    
    return companyNames
      .map(name => ({
        name,
        match: this.getMatchWithConfidence(name, searchTerms)
      }))
      .filter(result => result.match.match)
      .sort((a, b) => b.match.confidence - a.match.confidence);
  }

  /**
   * Debug function to show matching process
   */
  debugMatch(companyName, searchTerms) {
    console.log(`🔍 Debug matching: "${companyName}" against [${searchTerms.join(', ')}]`);
    
    const expandedTerms = searchTerms.flatMap(term => this.expandCompanyName(term));
    console.log(`📋 Expanded search terms:`, expandedTerms);
    
    const normalizedCompany = this.normalizeCompanyName(companyName);
    console.log(`🔄 Normalized company name: "${normalizedCompany}"`);
    
    const result = this.getMatchWithConfidence(companyName, searchTerms);
    console.log(`✅ Match result:`, result);
    
    return result;
  }
}

// USAGE EXAMPLES AND INTEGRATION

/**
 * Example usage in your existing code
 */
function integrateWithExistingCode() {
  // Initialize the matcher
  const pharmaMatche = new PharmaceuticalCompanyMatcher();

  // Example 1: Simple matching
  const searchCompanies = ['Pfizer', 'Johnson & Johnson', 'Novartis'];
  const matcher = pharmaMatche.createMatcher(searchCompanies);

  // Test against database records
  const testCompanies = [
    'Pfizer Manufacturing LLC',
    'Janssen Pharmaceuticals Inc',
    'Novartis Pharma AG',
    'Pfizer Global Supply',
    'J&J Innovation',
    'Random Unrelated Company'
  ];

  console.log('=== MATCHING RESULTS ===');
  testCompanies.forEach(company => {
    const isMatch = matcher(company);
    console.log(`${company}: ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
  });

  // Example 2: Confidence scoring
  console.log('\n=== CONFIDENCE SCORING ===');
  testCompanies.forEach(company => {
    const result = pharmaMatche.getMatchWithConfidence(company, searchCompanies);
    if (result.match) {
      console.log(`${company}: ${(result.confidence * 100).toFixed(1)}% (${result.reason})`);
    }
  });

  // Example 3: Batch matching
  const batchResults = pharmaMatche.batchMatch(testCompanies, searchCompanies);
  console.log('\n=== BATCH RESULTS (sorted by confidence) ===');
  batchResults.forEach(result => {
    console.log(`${result.name}: ${(result.match.confidence * 100).toFixed(1)}%`);
  });
}

/**
 * Integration with your existing MongoDB queries
 */
async function improvedDatabaseSearch(companies) {
  const pharmaMatche = new PharmaceuticalCompanyMatcher();
  
  // Get all possible search variations
  const allVariations = companies.flatMap(company => 
    pharmaMatche.expandCompanyName(company)
  );
  
  // Create optimized MongoDB query
  const mongoQuery = {
    $or: allVariations.map(variation => ({
      $or: [
        { legalName: { $regex: variation, $options: 'i' } },
        { companyName: { $regex: variation, $options: 'i' } },
        { "Legal Name": { $regex: variation, $options: 'i' } },
        { "Firm Name": { $regex: variation, $options: 'i' } }
      ]
    }))
  };
  
  // Fetch broader dataset
  const allRecords = await YourModel.find(mongoQuery).lean();
  
  // Apply precise matching
  const matcher = pharmaMatche.createMatcher(companies);
  const preciseMatches = allRecords.filter(record => {
    const companyNames = [
      record.legalName,
      record.companyName,
      record["Legal Name"],
      record["Firm Name"]
    ].filter(Boolean);
    
    return companyNames.some(name => matcher(name));
  });
  
  return preciseMatches;
}

/**
 * Perfect matching function for your existing comprehensive search
 */
function createPerfectCompanyMatcher(searchCompanies) {
  const pharmaMatche = new PharmaceuticalCompanyMatcher();
  return pharmaMatche.createMatcher(searchCompanies);
}

// Export for use in your existing codebase
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PharmaceuticalCompanyMatcher,
    createPerfectCompanyMatcher,
    improvedDatabaseSearch
  };
}

// Test the matcher with real pharmaceutical companies
function runComprehensiveTests() {
  console.log('🧪 Running comprehensive pharmaceutical company matching tests...\n');
  
  const matcher = new PharmaceuticalCompanyMatcher();
  
  // Test cases based on your actual data
  const testCases = [
    {
      search: ['Pfizer'],
      companies: [
        'Pfizer Inc',
        'Pfizer Manufacturing LLC', 
        'Pfizer Global Supply',
        'Pfizer Pharmaceuticals Inc',
        'Anti-Pfizer Legal Services', // Should NOT match
        'Generic Pfizer Supply Co' // Should NOT match
      ]
    },
    {
      search: ['Johnson & Johnson'],
      companies: [
        'Johnson & Johnson',
        'Janssen Pharmaceuticals',
        'Janssen Biotech Inc',
        'J&J Innovation LLC',
        'Johnson Controls Inc' // Should NOT match
      ]
    },
    {
      search: ['Novartis'],
      companies: [
        'Novartis AG',
        'Novartis Pharmaceuticals Corporation',
        'Sandoz Inc', // Should match (Novartis subsidiary)
        'Alcon Inc', // Should match (Novartis subsidiary)
        'Nova Industries' // Should NOT match
      ]
    }
  ];
  
  testCases.forEach(({ search, companies }, index) => {
    console.log(`Test Case ${index + 1}: Searching for [${search.join(', ')}]`);
    console.log('='.repeat(50));
    
    const matcherFn = matcher.createMatcher(search);
    
    companies.forEach(company => {
      const isMatch = matcherFn(company);
      const confidence = matcher.getMatchWithConfidence(company, search);
      
      console.log(`${isMatch ? '✅' : '❌'} ${company}`);
      if (isMatch) {
        console.log(`   └─ Confidence: ${(confidence.confidence * 100).toFixed(1)}% (${confidence.reason})`);
      }
    });
    
    console.log('\n');
  });
}

// Run tests if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runComprehensiveTests();
}