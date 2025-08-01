// auth-middleware.js
const { User } = require('./db');

const authMiddleware = async (req, res, next) => {
  try {
    // First check for userId in body (your current pattern)
    let userId = req.body.userId || req.query.userId;
    
    // If not in body, check headers for token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      // Simple decode - in production use JWT
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        userId = decoded.userId;
      } catch (e) {
        // Invalid token format
      }
    }
    
    // If still no userId, check session
    if (!userId && req.session) {
      userId = req.session.userId;
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Attach to request
    req.userId = userId;
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid authentication' });
  }
};

module.exports = authMiddleware;