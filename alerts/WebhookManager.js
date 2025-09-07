// STAGE 2B - REAL-TIME WEBHOOK ALERT SYSTEM
// Pharmaceutical intelligence real-time notification infrastructure

const EventEmitter = require('events');
const axios = require('axios');
const crypto = require('crypto');

class WebhookManager extends EventEmitter {
  constructor() {
    super();
    this.webhooks = new Map();
    this.alertRules = new Map();
    this.processingQueue = [];
    this.isProcessing = false;
    
    // FDA RSS feed endpoints for real-time monitoring
    this.fdaFeeds = {
      warnings: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds-fda-news-releases-topic/rss.xml',
      recalls: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds-fda-news-releases-topic/rss.xml',
      approvals: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds-fda-news-releases-topic/rss.xml'
    };
    
    this.monitoringInterval = null;
    this.lastCheck = new Date();
    
    console.log('📡 Webhook Manager initialized for real-time pharmaceutical alerts');
  }

  /**
   * Register a webhook endpoint for pharmaceutical alerts
   */
  registerWebhook(webhookId, config) {
    const webhook = {
      id: webhookId,
      url: config.url,
      secret: config.secret || this.generateSecret(),
      events: config.events || ['fda_warning', 'regulatory_change', 'competitive_alert'],
      active: true,
      created: new Date(),
      lastTriggered: null,
      triggerCount: 0
    };

    this.webhooks.set(webhookId, webhook);
    
    console.log(`🔗 Registered webhook ${webhookId} for events: ${webhook.events.join(', ')}`);
    
    return {
      webhook_id: webhookId,
      secret: webhook.secret,
      events: webhook.events
    };
  }

  /**
   * Create alert rule for automatic webhook triggering
   */
  createAlertRule(ruleId, criteria) {
    const rule = {
      id: ruleId,
      type: criteria.type, // 'fda_warning', 'patent_expiry', 'competitive_threat'
      conditions: criteria.conditions,
      webhooks: criteria.webhooks || [],
      priority: criteria.priority || 'medium',
      active: true,
      created: new Date(),
      triggerCount: 0,
      lastTriggered: null
    };

    this.alertRules.set(ruleId, rule);
    
    console.log(`⚠️  Created alert rule ${ruleId} for ${rule.type}`);
    return rule;
  }

  /**
   * Start real-time monitoring of FDA feeds
   */
  startMonitoring(intervalMinutes = 15) {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    console.log(`🔍 Starting FDA real-time monitoring (every ${intervalMinutes} minutes)`);
    
    this.monitoringInterval = setInterval(() => {
      this.checkFDAUpdates();
    }, intervalMinutes * 60 * 1000);

    // Initial check
    this.checkFDAUpdates();
  }

  /**
   * Check FDA feeds for new updates
   */
  async checkFDAUpdates() {
    try {
      console.log('🔍 Checking FDA feeds for updates...');
      const currentTime = new Date();
      
      // Simulate FDA feed checking - In production, parse actual RSS feeds
      const mockUpdates = [
        {
          type: 'fda_warning',
          title: 'FDA Issues Warning Letter to Pharmaceutical Company',
          description: 'Regulatory compliance violations identified in manufacturing facility',
          company: 'Example Pharma Corp',
          severity: 'high',
          published: currentTime,
          url: 'https://fda.gov/warning-letter-example'
        },
        {
          type: 'drug_approval',
          title: 'FDA Approves New Drug Application',
          description: 'Novel oncology treatment receives FDA approval',
          drug_name: 'ExampleDrug',
          severity: 'medium',
          published: currentTime,
          url: 'https://fda.gov/approval-example'
        }
      ];

      for (const update of mockUpdates) {
        await this.processAlert(update);
      }

      this.lastCheck = currentTime;
      console.log(`✅ FDA feed check completed at ${currentTime.toISOString()}`);

    } catch (error) {
      console.error('❌ FDA feed check failed:', error.message);
      this.emit('monitoring_error', { error: error.message, timestamp: new Date() });
    }
  }

  /**
   * Process and route pharmaceutical alerts
   */
  async processAlert(alertData) {
    try {
      // Check if alert matches any rules
      const matchingRules = this.findMatchingRules(alertData);
      
      if (matchingRules.length === 0) {
        return; // No rules match, skip
      }

      console.log(`🚨 Processing alert: ${alertData.title}`);
      
      // Enrich alert data
      const enrichedAlert = await this.enrichAlertData(alertData);
      
      // Trigger webhooks for matching rules
      for (const rule of matchingRules) {
        await this.triggerRuleWebhooks(rule, enrichedAlert);
        
        // Update rule statistics
        rule.triggerCount++;
        rule.lastTriggered = new Date();
        this.alertRules.set(rule.id, rule);
      }

      this.emit('alert_processed', {
        alert: enrichedAlert,
        rules_triggered: matchingRules.length,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('❌ Alert processing failed:', error.message);
      this.emit('alert_error', { alert: alertData, error: error.message });
    }
  }

  /**
   * Find alert rules that match the incoming data
   */
  findMatchingRules(alertData) {
    const matchingRules = [];
    
    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.active) continue;
      
      // Basic matching logic - can be extended
      if (rule.type === alertData.type) {
        // Check conditions
        let matches = true;
        
        if (rule.conditions.company && alertData.company) {
          matches = matches && alertData.company.toLowerCase().includes(rule.conditions.company.toLowerCase());
        }
        
        if (rule.conditions.severity) {
          matches = matches && this.checkSeverityMatch(alertData.severity, rule.conditions.severity);
        }
        
        if (matches) {
          matchingRules.push(rule);
        }
      }
    }
    
    return matchingRules;
  }

  /**
   * Enrich alert data with additional pharmaceutical intelligence
   */
  async enrichAlertData(alertData) {
    return {
      ...alertData,
      alert_id: this.generateAlertId(),
      processed_at: new Date(),
      risk_score: this.calculateRiskScore(alertData),
      business_impact: this.assessBusinessImpact(alertData),
      recommended_actions: this.generateRecommendations(alertData)
    };
  }

  /**
   * Trigger webhooks for a specific rule
   */
  async triggerRuleWebhooks(rule, alertData) {
    const webhooksToTrigger = rule.webhooks.length > 0 ? 
      rule.webhooks : 
      Array.from(this.webhooks.keys()); // All webhooks if none specified

    for (const webhookId of webhooksToTrigger) {
      const webhook = this.webhooks.get(webhookId);
      if (!webhook || !webhook.active) continue;
      
      try {
        await this.sendWebhook(webhook, alertData, rule);
        
        // Update webhook statistics
        webhook.triggerCount++;
        webhook.lastTriggered = new Date();
        this.webhooks.set(webhookId, webhook);
        
      } catch (error) {
        console.error(`❌ Webhook ${webhookId} failed:`, error.message);
        this.emit('webhook_error', { 
          webhook_id: webhookId, 
          error: error.message,
          alert: alertData 
        });
      }
    }
  }

  /**
   * Send webhook HTTP request
   */
  async sendWebhook(webhook, alertData, rule) {
    const payload = {
      event_type: alertData.type,
      alert_id: alertData.alert_id,
      rule_id: rule.id,
      timestamp: new Date().toISOString(),
      data: alertData
    };

    const signature = this.generateSignature(webhook.secret, JSON.stringify(payload));

    const response = await axios.post(webhook.url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Leaf-Signature': signature,
        'X-Leaf-Event': alertData.type,
        'User-Agent': 'Leaf-Intelligence-Webhooks/1.0'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log(`✅ Webhook ${webhook.id} delivered successfully (${response.status})`);
    
    return response.status;
  }

  /**
   * Calculate risk score for pharmaceutical alert
   */
  calculateRiskScore(alertData) {
    let score = 0;
    
    // Base score by alert type
    const typeScores = {
      'fda_warning': 80,
      'drug_recall': 90,
      'patent_expiry': 60,
      'competitive_threat': 50,
      'regulatory_change': 70
    };
    
    score = typeScores[alertData.type] || 30;
    
    // Adjust by severity
    const severityMultipliers = {
      'critical': 1.2,
      'high': 1.1,
      'medium': 1.0,
      'low': 0.8
    };
    
    score *= severityMultipliers[alertData.severity] || 1.0;
    
    return Math.min(100, Math.round(score));
  }

  /**
   * Assess business impact of alert
   */
  assessBusinessImpact(alertData) {
    const impacts = [];
    
    if (alertData.type === 'fda_warning') {
      impacts.push('Regulatory compliance risk');
      impacts.push('Potential stock price impact');
      impacts.push('Investigation required');
    }
    
    if (alertData.type === 'patent_expiry') {
      impacts.push('Generic competition threat');
      impacts.push('Revenue protection needed');
      impacts.push('Market share vulnerability');
    }
    
    return impacts;
  }

  /**
   * Generate action recommendations
   */
  generateRecommendations(alertData) {
    const recommendations = [];
    
    if (alertData.type === 'fda_warning') {
      recommendations.push('Review regulatory compliance procedures');
      recommendations.push('Assess manufacturing quality systems');
      recommendations.push('Prepare stakeholder communications');
    }
    
    return recommendations;
  }

  /**
   * Utility functions
   */
  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateAlertId() {
    return 'alert_' + crypto.randomBytes(16).toString('hex');
  }

  generateSignature(secret, payload) {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  checkSeverityMatch(alertSeverity, ruleSeverity) {
    const severityLevels = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };
    
    return severityLevels[alertSeverity] >= severityLevels[ruleSeverity];
  }

  /**
   * Management functions
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('⏹️  FDA monitoring stopped');
    }
  }

  getStatus() {
    return {
      monitoring_active: !!this.monitoringInterval,
      webhooks_registered: this.webhooks.size,
      alert_rules: this.alertRules.size,
      last_check: this.lastCheck,
      processing_queue_size: this.processingQueue.length
    };
  }

  listWebhooks() {
    return Array.from(this.webhooks.entries()).map(([id, webhook]) => ({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      trigger_count: webhook.triggerCount,
      last_triggered: webhook.lastTriggered
    }));
  }

  listAlertRules() {
    return Array.from(this.alertRules.entries()).map(([id, rule]) => ({
      id: rule.id,
      type: rule.type,
      priority: rule.priority,
      active: rule.active,
      trigger_count: rule.triggerCount,
      last_triggered: rule.lastTriggered
    }));
  }
}

module.exports = WebhookManager;