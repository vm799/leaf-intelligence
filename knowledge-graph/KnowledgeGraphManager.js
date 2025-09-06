// KNOWLEDGE GRAPH MANAGER
// High-level interface for pharmaceutical knowledge graph operations

const { MongoClient } = require('mongodb');
const { mongoSchema, collections, relationshipTypes } = require('./schema.js');
const { createIndexes, validateIndexPerformance } = require('./indexes.js');

class KnowledgeGraphManager {
  constructor(connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017', databaseName = 'leaf_intelligence_kg') {
    this.connectionString = connectionString;
    this.databaseName = databaseName;
    this.client = null;
    this.db = null;
    this.isConnected = false;
    
    // Connection options optimized for pharmaceutical data operations
    this.connectionOptions = {
      maxPoolSize: 50,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      useNewUrlParser: true,
      useUnifiedTopology: true
    };

    console.log('📊 Knowledge Graph Manager initialized');
  }

  /**
   * Connect to MongoDB and initialize the knowledge graph
   */
  async connect() {
    try {
      console.log('🔗 Connecting to MongoDB knowledge graph...');
      
      this.client = new MongoClient(this.connectionString, this.connectionOptions);
      await this.client.connect();
      
      this.db = this.client.db(this.databaseName);
      this.isConnected = true;
      
      console.log(`✅ Connected to knowledge graph database: ${this.databaseName}`);
      
      // Validate connection with a simple operation
      await this.db.admin().ping();
      
      return {
        success: true,
        message: 'Knowledge graph connection established',
        database: this.databaseName
      };
      
    } catch (error) {
      console.error('❌ Failed to connect to knowledge graph:', error.message);
      throw error;
    }
  }

  /**
   * Initialize the knowledge graph schema and indexes
   */
  async initialize() {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      console.log('🏗️  Initializing knowledge graph schema and indexes...');
      
      // Create optimized indexes
      const indexResult = await createIndexes(this.db);
      
      // Create collections if they don't exist
      const existingCollections = await this.db.listCollections().toArray();
      const existingNames = existingCollections.map(c => c.name);
      
      const collectionsToCreate = Object.values(collections).filter(name => 
        !existingNames.includes(name)
      );
      
      for (const collectionName of collectionsToCreate) {
        await this.db.createCollection(collectionName);
        console.log(`📋 Created collection: ${collectionName}`);
      }
      
      // Validate index performance
      const performanceResults = await validateIndexPerformance(this.db);
      
      console.log('✅ Knowledge graph initialized successfully');
      
      return {
        success: true,
        message: 'Knowledge graph schema and indexes initialized',
        indexes_created: indexResult.indexes_created,
        collections_created: collectionsToCreate,
        performance_validation: performanceResults
      };
      
    } catch (error) {
      console.error('❌ Failed to initialize knowledge graph:', error.message);
      throw error;
    }
  }

  /**
   * Insert or update a drug entity
   */
  async upsertDrug(drugData) {
    this.validateConnection();
    
    try {
      const collection = this.db.collection(collections.DRUGS);
      
      const filter = drugData.nda_numbers?.length > 0 
        ? { nda_numbers: { $in: drugData.nda_numbers } }
        : { name: drugData.name };
      
      const updateData = {
        ...drugData,
        updated_at: new Date()
      };
      
      if (!updateData.created_at) {
        updateData.created_at = new Date();
      }

      const result = await collection.updateOne(
        filter,
        { $set: updateData },
        { upsert: true }
      );

      console.log(`💊 ${result.upsertedCount > 0 ? 'Inserted' : 'Updated'} drug: ${drugData.name}`);
      
      return {
        success: true,
        drug_id: result.upsertedId || result.matchedCount > 0,
        operation: result.upsertedCount > 0 ? 'insert' : 'update'
      };
      
    } catch (error) {
      console.error(`❌ Failed to upsert drug ${drugData.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Insert or update a company entity
   */
  async upsertCompany(companyData) {
    this.validateConnection();
    
    try {
      const collection = this.db.collection(collections.COMPANIES);
      
      const filter = companyData.ticker_symbol 
        ? { ticker_symbol: companyData.ticker_symbol }
        : { name: companyData.name };
      
      const updateData = {
        ...companyData,
        updated_at: new Date()
      };
      
      if (!updateData.created_at) {
        updateData.created_at = new Date();
      }

      const result = await collection.updateOne(
        filter,
        { $set: updateData },
        { upsert: true }
      );

      console.log(`🏢 ${result.upsertedCount > 0 ? 'Inserted' : 'Updated'} company: ${companyData.name}`);
      
      return {
        success: true,
        company_id: result.upsertedId || result.matchedCount > 0,
        operation: result.upsertedCount > 0 ? 'insert' : 'update'
      };
      
    } catch (error) {
      console.error(`❌ Failed to upsert company ${companyData.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Create a relationship between two entities
   */
  async createRelationship(fromEntity, toEntity, relationshipType, relationshipData = {}) {
    this.validateConnection();
    
    try {
      // Validate relationship type
      if (!relationshipTypes.includes(relationshipType)) {
        throw new Error(`Invalid relationship type: ${relationshipType}`);
      }

      const collection = this.db.collection(collections.RELATIONSHIPS);
      
      const relationship = {
        relationship_type: relationshipType,
        from_entity: fromEntity,
        to_entity: toEntity,
        relationship_data: {
          strength: relationshipData.strength || 0.8,
          confidence: relationshipData.confidence || 0.9,
          context: relationshipData.context || '',
          date_established: new Date(),
          status: 'active',
          ...relationshipData
        },
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = await collection.insertOne(relationship);
      
      console.log(`🔗 Created relationship: ${fromEntity.entity_name} ${relationshipType} ${toEntity.entity_name}`);
      
      return {
        success: true,
        relationship_id: result.insertedId,
        relationship: relationship
      };
      
    } catch (error) {
      console.error(`❌ Failed to create relationship:`, error.message);
      throw error;
    }
  }

  /**
   * Find drugs by various criteria
   */
  async findDrugs(query = {}, options = {}) {
    this.validateConnection();
    
    try {
      const collection = this.db.collection(collections.DRUGS);
      
      // Build MongoDB query
      let mongoQuery = {};
      
      if (query.name) {
        mongoQuery.$or = [
          { name: { $regex: query.name, $options: 'i' } },
          { generic_name: { $regex: query.name, $options: 'i' } }
        ];
      }
      
      if (query.therapeutic_areas) {
        mongoQuery.therapeutic_areas = { $in: Array.isArray(query.therapeutic_areas) ? query.therapeutic_areas : [query.therapeutic_areas] };
      }
      
      if (query.nda) {
        mongoQuery.nda_numbers = query.nda;
      }
      
      if (query.risk_score_min) {
        mongoQuery['ai_insights.risk_score'] = { $gte: query.risk_score_min };
      }
      
      if (query.patent_expiry_before) {
        mongoQuery['patents.expiry_date'] = { $lte: new Date(query.patent_expiry_before) };
      }

      const cursor = collection.find(mongoQuery);
      
      if (options.sort) {
        cursor.sort(options.sort);
      }
      
      if (options.limit) {
        cursor.limit(options.limit);
      }
      
      const results = await cursor.toArray();
      
      return {
        success: true,
        count: results.length,
        drugs: results
      };
      
    } catch (error) {
      console.error('❌ Failed to find drugs:', error.message);
      throw error;
    }
  }

  /**
   * Find companies by various criteria
   */
  async findCompanies(query = {}, options = {}) {
    this.validateConnection();
    
    try {
      const collection = this.db.collection(collections.COMPANIES);
      
      let mongoQuery = {};
      
      if (query.name) {
        mongoQuery.name = { $regex: query.name, $options: 'i' };
      }
      
      if (query.company_type) {
        mongoQuery.company_type = query.company_type;
      }
      
      if (query.market_cap_min) {
        mongoQuery['financial_data.market_cap'] = { $gte: query.market_cap_min };
      }
      
      if (query.compliance_score_max) {
        mongoQuery['competitive_intelligence.regulatory_compliance_score'] = { $lte: query.compliance_score_max };
      }

      const cursor = collection.find(mongoQuery);
      
      if (options.sort) {
        cursor.sort(options.sort);
      }
      
      if (options.limit) {
        cursor.limit(options.limit);
      }
      
      const results = await cursor.toArray();
      
      return {
        success: true,
        count: results.length,
        companies: results
      };
      
    } catch (error) {
      console.error('❌ Failed to find companies:', error.message);
      throw error;
    }
  }

  /**
   * Find relationships between entities
   */
  async findRelationships(query = {}, options = {}) {
    this.validateConnection();
    
    try {
      const collection = this.db.collection(collections.RELATIONSHIPS);
      
      let mongoQuery = {};
      
      if (query.from_entity_id) {
        mongoQuery['from_entity.entity_id'] = query.from_entity_id;
      }
      
      if (query.to_entity_id) {
        mongoQuery['to_entity.entity_id'] = query.to_entity_id;
      }
      
      if (query.relationship_type) {
        mongoQuery.relationship_type = query.relationship_type;
      }
      
      if (query.min_strength) {
        mongoQuery['relationship_data.strength'] = { $gte: query.min_strength };
      }

      const cursor = collection.find(mongoQuery);
      
      if (options.sort) {
        cursor.sort(options.sort);
      } else {
        cursor.sort({ 'relationship_data.strength': -1 });
      }
      
      if (options.limit) {
        cursor.limit(options.limit);
      }
      
      const results = await cursor.toArray();
      
      return {
        success: true,
        count: results.length,
        relationships: results
      };
      
    } catch (error) {
      console.error('❌ Failed to find relationships:', error.message);
      throw error;
    }
  }

  /**
   * Perform complex graph traversal query
   */
  async traverseGraph(startEntityId, relationshipTypes = [], maxDepth = 2) {
    this.validateConnection();
    
    try {
      const collection = this.db.collection(collections.RELATIONSHIPS);
      
      const pipeline = [
        {
          $match: {
            $or: [
              { 'from_entity.entity_id': startEntityId },
              { 'to_entity.entity_id': startEntityId }
            ],
            relationship_type: { $in: relationshipTypes.length > 0 ? relationshipTypes : relationshipTypes }
          }
        },
        {
          $graphLookup: {
            from: 'relationships',
            startWith: '$to_entity.entity_id',
            connectFromField: 'to_entity.entity_id',
            connectToField: 'from_entity.entity_id',
            as: 'connected_entities',
            maxDepth: maxDepth - 1
          }
        },
        {
          $project: {
            relationship_type: 1,
            from_entity: 1,
            to_entity: 1,
            relationship_data: 1,
            connected_entities: 1
          }
        }
      ];

      const results = await collection.aggregate(pipeline).toArray();
      
      return {
        success: true,
        traversal_results: results,
        start_entity: startEntityId,
        max_depth: maxDepth
      };
      
    } catch (error) {
      console.error('❌ Failed to traverse graph:', error.message);
      throw error;
    }
  }

  /**
   * Get knowledge graph statistics
   */
  async getStatistics() {
    this.validateConnection();
    
    try {
      const stats = {};
      
      // Count documents in each collection
      for (const [key, collectionName] of Object.entries(collections)) {
        const count = await this.db.collection(collectionName).countDocuments();
        stats[key.toLowerCase()] = count;
      }
      
      // Relationship type distribution
      const relationshipStats = await this.db.collection(collections.RELATIONSHIPS).aggregate([
        { $group: { _id: '$relationship_type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();
      
      stats.relationship_types = relationshipStats;
      
      // Recent activity (last 24 hours)
      const yesterday = new Date(Date.now() - 24*60*60*1000);
      const recentDrugs = await this.db.collection(collections.DRUGS).countDocuments({ 
        updated_at: { $gte: yesterday } 
      });
      const recentCompanies = await this.db.collection(collections.COMPANIES).countDocuments({ 
        updated_at: { $gte: yesterday } 
      });
      
      stats.recent_activity = {
        drugs_updated: recentDrugs,
        companies_updated: recentCompanies
      };
      
      return {
        success: true,
        statistics: stats,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('❌ Failed to get statistics:', error.message);
      throw error;
    }
  }

  /**
   * Validate connection
   */
  validateConnection() {
    if (!this.isConnected) {
      throw new Error('Knowledge graph not connected. Call connect() first.');
    }
  }

  /**
   * Close connection
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log('🔌 Disconnected from knowledge graph');
    }
  }
}

module.exports = KnowledgeGraphManager;