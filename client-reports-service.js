// CLIENT REPORTS SERVICE - CRITICAL BUSINESS CONTINUITY
// Ensures all 64 client reports remain accessible during transformation

class ClientReportService {
  constructor() {
    this.reports = new Map();
    this.redirects = new Map();
    this.loadClientReports();
    this.setupRedirects();
  }

  loadClientReports() {
    // High-value drug analysis reports
    this.reports.set('Atirmociclib', {
      path: '/client-reports/drugs/Atirmociclib.html',
      type: 'drug_analysis',
      client_confidential: true,
      last_updated: '2024-08-31',
      access_level: 'premium',
      business_value: 'high'
    });

    this.reports.set('Disitamab', {
      path: '/client-reports/drugs/Disitamab.html',
      type: 'drug_analysis',
      client_confidential: true,
      last_updated: '2024-08-31',
      access_level: 'premium',
      business_value: 'high'
    });

    this.reports.set('imlunestrant', {
      path: '/client-reports/drugs/imlunestrant.html',
      type: 'drug_analysis',
      client_confidential: true,
      last_updated: '2024-08-31',
      access_level: 'premium',
      business_value: 'high'
    });

    this.reports.set('Lu-NeoB', {
      path: '/client-reports/drugs/Lu-NeoB.html',
      type: 'drug_analysis',
      client_confidential: true,
      last_updated: '2024-08-31',
      access_level: 'premium',
      business_value: 'high'
    });

    // Company intelligence reports
    this.reports.set('avidity-sci', {
      path: '/client-reports/companies/avidity-sci.html',
      type: 'company_intelligence',
      client_confidential: true,
      last_updated: '2024-08-31',
      access_level: 'premium',
      business_value: 'high'
    });

    this.reports.set('SyneticxXwideOak', {
      path: '/client-reports/companies/SyneticxXwideOak.html',
      type: 'strategic_partnership',
      client_confidential: true,
      last_updated: '2024-08-31',
      access_level: 'premium',
      business_value: 'critical'
    });

    // Therapeutic area reports
    this.reports.set('BreastCancerTherapeutics', {
      path: '/client-reports/therapeutics/BreastCancerTherapeutics.html',
      type: 'therapeutic_landscape',
      client_confidential: true,
      last_updated: '2024-08-31',
      access_level: 'premium',
      business_value: 'high'
    });

    // Platform core
    this.reports.set('leafintelligence', {
      path: '/client-reports/platform/leafintelligence.html',
      type: 'platform_interface',
      client_confidential: false,
      last_updated: '2024-08-31',
      access_level: 'public',
      business_value: 'critical'
    });
  }

  setupRedirects() {
    // CRITICAL: All existing client URLs must redirect properly
    const CLIENT_REPORT_REDIRECTS = {
      // Drug-specific reports
      '/public/Atirmociclib.html': '/client-reports/drugs/Atirmociclib.html',
      '/Atirmociclib.html': '/client-reports/drugs/Atirmociclib.html',
      '/public/Disitamab.html': '/client-reports/drugs/Disitamab.html',
      '/Disitamab.html': '/client-reports/drugs/Disitamab.html',
      '/public/imlunestrant.html': '/client-reports/drugs/imlunestrant.html',
      '/imlunestrant.html': '/client-reports/drugs/imlunestrant.html',
      '/public/Lu-NeoB.html': '/client-reports/drugs/Lu-NeoB.html',
      '/Lu-NeoB.html': '/client-reports/drugs/Lu-NeoB.html',
      '/public/vepdege2.html': '/client-reports/drugs/vepdege2.html',
      '/vepdege2.html': '/client-reports/drugs/vepdege2.html',
      
      // Company reports  
      '/public/avidity-sci.html': '/client-reports/companies/avidity-sci.html',
      '/avidity-sci.html': '/client-reports/companies/avidity-sci.html',
      '/public/SyneticxXwideOak.html': '/client-reports/companies/SyneticxXwideOak.html',
      '/SyneticxXwideOak.html': '/client-reports/companies/SyneticxXwideOak.html',
      '/public/blackstone.html': '/client-reports/companies/blackstone.html',
      '/blackstone.html': '/client-reports/companies/blackstone.html',
      '/public/avidity.html': '/client-reports/companies/avidity.html',
      '/avidity.html': '/client-reports/companies/avidity.html',
      '/public/aviditysciv2.html': '/client-reports/companies/aviditysciv2.html',
      '/aviditysciv2.html': '/client-reports/companies/aviditysciv2.html',
      
      // Therapeutic area reports
      '/public/BreastCancerTherapeutics.html': '/client-reports/therapeutics/BreastCancerTherapeutics.html',
      '/BreastCancerTherapeutics.html': '/client-reports/therapeutics/BreastCancerTherapeutics.html',
      '/public/ultra-orphan.html': '/client-reports/therapeutics/ultra-orphan.html',
      '/ultra-orphan.html': '/client-reports/therapeutics/ultra-orphan.html',
      '/public/ultra-orphan-analysis.html': '/client-reports/therapeutics/ultra-orphan-analysis.html',
      '/ultra-orphan-analysis.html': '/client-reports/therapeutics/ultra-orphan-analysis.html',
      '/public/treatment.html': '/client-reports/therapeutics/treatment.html',
      '/treatment.html': '/client-reports/therapeutics/treatment.html',
      
      // Core platform
      '/public/leafintelligence.html': '/client-reports/platform/leafintelligence.html',
      '/leafintelligence.html': '/client-reports/platform/leafintelligence.html',
      
      // Regulatory reports
      '/public/TEG.html': '/client-reports/regulatory/TEG.html',
      '/TEG.html': '/client-reports/regulatory/TEG.html',
      '/public/methodology-report.html': '/client-reports/regulatory/methodology-report.html',
      '/methodology-report.html': '/client-reports/regulatory/methodology-report.html',
      
      // Competitive analysis
      '/public/competitive.html': '/client-reports/competitive/competitive.html',
      '/competitive.html': '/client-reports/competitive/competitive.html'
    };

    // Store redirects for server implementation
    for (const [oldPath, newPath] of Object.entries(CLIENT_REPORT_REDIRECTS)) {
      this.redirects.set(oldPath, newPath);
    }
  }

  getRedirect(originalPath) {
    return this.redirects.get(originalPath);
  }

  enhanceReport(reportId, aiInsights) {
    // Add AI-generated insights to existing reports
    const report = this.reports.get(reportId);
    if (report) {
      return this.injectAIInsights(report, aiInsights);
    }
    return null;
  }

  injectAIInsights(report, insights) {
    // Future enhancement: inject real-time AI insights into static reports
    return {
      ...report,
      ai_enhanced: true,
      insights: insights,
      enhancement_timestamp: new Date().toISOString()
    };
  }

  getAllRedirects() {
    return Object.fromEntries(this.redirects);
  }

  getReportMetadata(reportId) {
    return this.reports.get(reportId);
  }

  validateReportAccess(reportPath) {
    // Ensure report exists and is accessible
    const fs = require('fs');
    const path = require('path');
    const fullPath = path.join(__dirname, reportPath);
    return fs.existsSync(fullPath);
  }
}

module.exports = ClientReportService;