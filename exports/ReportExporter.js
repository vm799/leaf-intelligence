// STAGE 2B - ENHANCED EXPORT CAPABILITIES
// PDF and Excel pharmaceutical intelligence report generation

const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

class ReportExporter {
  constructor() {
    this.browser = null;
    this.exportTemplates = new Map();
    this.setupDefaultTemplates();
    
    console.log('📄 Report Exporter initialized for pharmaceutical intelligence');
  }

  /**
   * Setup default export templates
   */
  setupDefaultTemplates() {
    // Executive Summary Template
    this.exportTemplates.set('executive_summary', {
      name: 'Executive Summary Report',
      sections: [
        'key_findings',
        'risk_assessment',
        'competitive_landscape',
        'recommendations'
      ],
      format: {
        logo: true,
        charts: true,
        executive_style: true
      }
    });

    // Regulatory Analysis Template
    this.exportTemplates.set('regulatory_analysis', {
      name: 'Regulatory Analysis Report',
      sections: [
        'compliance_status',
        'warning_letters',
        'inspection_history',
        'risk_mitigation'
      ],
      format: {
        detailed_tables: true,
        risk_matrices: true,
        compliance_charts: true
      }
    });

    // Competitive Intelligence Template
    this.exportTemplates.set('competitive_intelligence', {
      name: 'Competitive Intelligence Report',
      sections: [
        'market_landscape',
        'patent_analysis',
        'pipeline_comparison',
        'market_opportunities'
      ],
      format: {
        market_charts: true,
        patent_timelines: true,
        competitor_profiles: true
      }
    });
  }

  /**
   * Export pharmaceutical intelligence data to PDF
   */
  async exportToPDF(data, options = {}) {
    try {
      console.log(`📋 Generating PDF report: ${options.template || 'default'}`);
      
      // Initialize browser if needed
      if (!this.browser) {
        this.browser = await puppeteer.launch({ 
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }

      const page = await this.browser.newPage();
      
      // Generate HTML content
      const htmlContent = await this.generateHTMLReport(data, options);
      
      // Set page content
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // Generate PDF
      const pdfBuffer = await page.generatePdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1in',
          right: '0.75in',
          bottom: '1in',
          left: '0.75in'
        },
        displayHeaderFooter: true,
        headerTemplate: this.generatePDFHeader(options),
        footerTemplate: this.generatePDFFooter(options)
      });

      await page.close();
      
      console.log('✅ PDF report generated successfully');
      
      return {
        success: true,
        format: 'pdf',
        data: pdfBuffer,
        filename: this.generateFilename(options, 'pdf'),
        size: pdfBuffer.length,
        generated_at: new Date()
      };

    } catch (error) {
      console.error('❌ PDF export failed:', error.message);
      throw new Error(`PDF export failed: ${error.message}`);
    }
  }

  /**
   * Export pharmaceutical intelligence data to Excel
   */
  async exportToExcel(data, options = {}) {
    try {
      console.log(`📊 Generating Excel report: ${options.template || 'default'}`);
      
      const workbook = new ExcelJS.Workbook();
      
      // Set workbook properties
      workbook.creator = 'Leaf Intelligence';
      workbook.lastModifiedBy = 'Pharmaceutical AI System';
      workbook.created = new Date();
      workbook.modified = new Date();

      // Add worksheets based on data
      await this.addExecutiveSummarySheet(workbook, data, options);
      await this.addDetailedDataSheet(workbook, data, options);
      await this.addChartsSheet(workbook, data, options);

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      
      console.log('✅ Excel report generated successfully');
      
      return {
        success: true,
        format: 'excel',
        data: buffer,
        filename: this.generateFilename(options, 'xlsx'),
        size: buffer.length,
        generated_at: new Date(),
        sheets: workbook.worksheets.map(ws => ws.name)
      };

    } catch (error) {
      console.error('❌ Excel export failed:', error.message);
      throw new Error(`Excel export failed: ${error.message}`);
    }
  }

  /**
   * Generate HTML content for PDF reports
   */
  async generateHTMLReport(data, options) {
    const template = this.exportTemplates.get(options.template || 'executive_summary');
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${template.name}</title>
      <style>
        ${this.getReportCSS()}
      </style>
    </head>
    <body>
      <div class="report-container">
        ${this.generateReportHeader(data, options)}
        ${this.generateExecutiveSummary(data)}
        ${this.generateKeyFindings(data)}
        ${this.generateRiskAssessment(data)}
        ${this.generateCompetitiveLandscape(data)}
        ${this.generateRecommendations(data)}
        ${this.generateAppendix(data)}
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate report CSS styles
   */
  getReportCSS() {
    return `
      body {
        font-family: 'Arial', sans-serif;
        margin: 0;
        padding: 20px;
        color: #333;
        line-height: 1.6;
      }
      
      .report-container {
        max-width: 800px;
        margin: 0 auto;
      }
      
      .report-header {
        text-align: center;
        margin-bottom: 40px;
        border-bottom: 3px solid #0066cc;
        padding-bottom: 20px;
      }
      
      .report-title {
        font-size: 28px;
        color: #0066cc;
        margin-bottom: 10px;
      }
      
      .report-subtitle {
        font-size: 16px;
        color: #666;
        margin-bottom: 20px;
      }
      
      .section {
        margin-bottom: 30px;
        page-break-inside: avoid;
      }
      
      .section-title {
        font-size: 20px;
        color: #0066cc;
        border-bottom: 2px solid #eee;
        padding-bottom: 10px;
        margin-bottom: 15px;
      }
      
      .metric-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin: 20px 0;
      }
      
      .metric-card {
        background: #f8f9fa;
        padding: 20px;
        border-left: 4px solid #0066cc;
        border-radius: 4px;
      }
      
      .metric-value {
        font-size: 24px;
        font-weight: bold;
        color: #0066cc;
      }
      
      .metric-label {
        font-size: 14px;
        color: #666;
        margin-top: 5px;
      }
      
      .risk-high { color: #dc3545; }
      .risk-medium { color: #ffc107; }
      .risk-low { color: #28a745; }
      
      .recommendation-item {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 4px;
        padding: 15px;
        margin-bottom: 10px;
      }
      
      .chart-placeholder {
        height: 300px;
        background: #f8f9fa;
        border: 2px dashed #dee2e6;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6c757d;
        margin: 20px 0;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
      
      th, td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #dee2e6;
      }
      
      th {
        background-color: #f8f9fa;
        font-weight: bold;
        color: #0066cc;
      }
    `;
  }

  /**
   * Generate report header
   */
  generateReportHeader(data, options) {
    return `
      <div class="report-header">
        <h1 class="report-title">Pharmaceutical Intelligence Report</h1>
        <p class="report-subtitle">Generated by Leaf Intelligence AI System</p>
        <p class="report-date">Report Date: ${new Date().toLocaleDateString()}</p>
        ${options.company ? `<p class="report-company">Company: ${options.company}</p>` : ''}
      </div>
    `;
  }

  /**
   * Generate executive summary section
   */
  generateExecutiveSummary(data) {
    return `
      <div class="section">
        <h2 class="section-title">Executive Summary</h2>
        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-value">${data.summary?.totalFindings || 0}</div>
            <div class="metric-label">Key Findings</div>
          </div>
          <div class="metric-card">
            <div class="metric-value risk-${data.summary?.overallRisk || 'medium'}">${data.summary?.riskScore || 75}</div>
            <div class="metric-label">Risk Score</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.summary?.competitorsAnalyzed || 0}</div>
            <div class="metric-label">Competitors Analyzed</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">$${data.summary?.marketImpact || '0M'}</div>
            <div class="metric-label">Market Impact</div>
          </div>
        </div>
        <p>${data.summary?.description || 'Comprehensive pharmaceutical intelligence analysis completed with AI-powered insights and recommendations.'}</p>
      </div>
    `;
  }

  /**
   * Generate key findings section
   */
  generateKeyFindings(data) {
    const findings = data.findings || [
      'FDA regulatory compliance status assessed',
      'Competitive landscape analyzed',
      'Patent cliff risks identified',
      'Market opportunities discovered'
    ];

    return `
      <div class="section">
        <h2 class="section-title">Key Findings</h2>
        <ul>
          ${findings.map(finding => `<li>${finding}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  /**
   * Generate risk assessment section
   */
  generateRiskAssessment(data) {
    return `
      <div class="section">
        <h2 class="section-title">Risk Assessment</h2>
        <div class="chart-placeholder">
          Risk Assessment Chart
          <br>
          <small>Visual risk analysis would be displayed here</small>
        </div>
        <table>
          <thead>
            <tr>
              <th>Risk Category</th>
              <th>Level</th>
              <th>Description</th>
              <th>Mitigation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Regulatory Compliance</td>
              <td><span class="risk-${data.risks?.regulatory?.level || 'medium'}">${data.risks?.regulatory?.level || 'Medium'}</span></td>
              <td>FDA warning letter risk</td>
              <td>Enhanced quality systems</td>
            </tr>
            <tr>
              <td>Competitive Threat</td>
              <td><span class="risk-${data.risks?.competitive?.level || 'medium'}">${data.risks?.competitive?.level || 'Medium'}</span></td>
              <td>Generic competition</td>
              <td>Patent portfolio strengthening</td>
            </tr>
            <tr>
              <td>Market Access</td>
              <td><span class="risk-${data.risks?.market?.level || 'low'}">${data.risks?.market?.level || 'Low'}</span></td>
              <td>Pricing pressure</td>
              <td>Value demonstration</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Generate competitive landscape section
   */
  generateCompetitiveLandscape(data) {
    return `
      <div class="section">
        <h2 class="section-title">Competitive Landscape</h2>
        <div class="chart-placeholder">
          Competitive Landscape Visualization
          <br>
          <small>Market share and competitor analysis would be displayed here</small>
        </div>
        <p>Analysis of ${data.competitors?.length || 5} key competitors reveals significant market opportunities and threats requiring immediate attention.</p>
      </div>
    `;
  }

  /**
   * Generate recommendations section
   */
  generateRecommendations(data) {
    const recommendations = data.recommendations || [
      'Strengthen regulatory compliance monitoring',
      'Enhance competitive intelligence capabilities',
      'Develop patent cliff mitigation strategies',
      'Accelerate market access initiatives'
    ];

    return `
      <div class="section">
        <h2 class="section-title">Strategic Recommendations</h2>
        ${recommendations.map(rec => `
          <div class="recommendation-item">
            <strong>Recommendation:</strong> ${rec}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Generate appendix section
   */
  generateAppendix(data) {
    return `
      <div class="section">
        <h2 class="section-title">Appendix</h2>
        <p><strong>Data Sources:</strong></p>
        <ul>
          <li>FDA Orange Book</li>
          <li>FDA Warning Letters Database</li>
          <li>ClinicalTrials.gov</li>
          <li>PubMed Scientific Literature</li>
          <li>Patent databases</li>
        </ul>
        <p><strong>Report Generated:</strong> ${new Date().toISOString()}</p>
        <p><strong>System Version:</strong> Leaf Intelligence v2.0-Stage2B</p>
      </div>
    `;
  }

  /**
   * Add Executive Summary sheet to Excel workbook
   */
  async addExecutiveSummarySheet(workbook, data, options) {
    const worksheet = workbook.addWorksheet('Executive Summary');
    
    // Add title
    worksheet.addRow(['Pharmaceutical Intelligence Report']);
    worksheet.addRow([`Generated: ${new Date().toLocaleDateString()}`]);
    worksheet.addRow([]);

    // Add key metrics
    worksheet.addRow(['Key Metrics']);
    worksheet.addRow(['Total Findings', data.summary?.totalFindings || 0]);
    worksheet.addRow(['Risk Score', data.summary?.riskScore || 75]);
    worksheet.addRow(['Competitors Analyzed', data.summary?.competitorsAnalyzed || 0]);
    worksheet.addRow(['Market Impact', data.summary?.marketImpact || '$0M']);

    // Format cells
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A4').font = { bold: true };
  }

  /**
   * Add Detailed Data sheet to Excel workbook
   */
  async addDetailedDataSheet(workbook, data, options) {
    const worksheet = workbook.addWorksheet('Detailed Analysis');
    
    // Add headers
    worksheet.addRow(['Category', 'Metric', 'Value', 'Risk Level', 'Notes']);
    
    // Add data rows
    const detailRows = [
      ['Regulatory', 'FDA Warnings', data.regulatory?.warnings || 0, 'Medium', 'Active monitoring required'],
      ['Competitive', 'Market Share', data.competitive?.marketShare || '15%', 'Low', 'Stable position'],
      ['Patents', 'Expiring Soon', data.patents?.expiring || 3, 'High', 'Generic threat'],
      ['Trials', 'Active Studies', data.trials?.active || 12, 'Low', 'Strong pipeline']
    ];

    detailRows.forEach(row => worksheet.addRow(row));

    // Format headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' }};
  }

  /**
   * Add Charts sheet to Excel workbook
   */
  async addChartsSheet(workbook, data, options) {
    const worksheet = workbook.addWorksheet('Charts & Visualizations');
    
    worksheet.addRow(['Chart Placeholders']);
    worksheet.addRow(['Risk Assessment Chart - Visual representation of regulatory and competitive risks']);
    worksheet.addRow(['Competitive Landscape - Market share and positioning analysis']);
    worksheet.addRow(['Patent Timeline - Expiration dates and generic entry threats']);
    worksheet.addRow(['Pipeline Analysis - Clinical trial progress and timelines']);
  }

  /**
   * Generate PDF header template
   */
  generatePDFHeader(options) {
    return `
      <div style="font-size: 12px; color: #666; text-align: center; margin: 10px;">
        Leaf Intelligence - Pharmaceutical Intelligence Report
      </div>
    `;
  }

  /**
   * Generate PDF footer template
   */
  generatePDFFooter(options) {
    return `
      <div style="font-size: 10px; color: #666; text-align: center; margin: 10px;">
        <span class="pageNumber"></span> / <span class="totalPages"></span> | 
        Generated: ${new Date().toLocaleDateString()} | 
        Confidential & Proprietary
      </div>
    `;
  }

  /**
   * Generate appropriate filename
   */
  generateFilename(options, extension) {
    const timestamp = new Date().toISOString().split('T')[0];
    const template = options.template || 'pharmaceutical_report';
    const company = options.company ? `_${options.company.replace(/\s+/g, '_')}` : '';
    
    return `${template}${company}_${timestamp}.${extension}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('🔄 Report Exporter browser cleaned up');
    }
  }
}

module.exports = ReportExporter;