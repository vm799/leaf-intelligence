// auth-middleware.js - Fixed version
const { User } = require('./db');

const authMiddleware = async (req, res, next) => {
  try {
    // Check for userId in multiple places
    let userId = req.body.userId || req.query.userId || req.params.userId;
    
    // Check headers for token
    const authHeader = req.headers.authorization;
    if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        userId = decoded.userId;
      } catch (e) {
        console.error('Invalid token format:', e);
      }
    }
    
    // Check session
    if (!userId && req.session && req.session.userId) {
      userId = req.session.userId;
    }
    
    // Log what we found
    console.log('Auth middleware - userId found:', userId ? 'Yes' : 'No');
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required - no userId found' });
    }
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Attach to request
    req.userId = userId;
    req.user = user;
    
    console.log('Auth middleware - User authenticated:', user.username || user.email);
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid authentication' });
  }
};

module.exports = authMiddleware;