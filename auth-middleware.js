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
        // Invalid token format
      }
    }
    
    // Check session
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
    
    // Attach to request - use consistent property names
    req.userId = userId;  // This fixes the line 7 error
    req.user = user;
    req.user._id = user._id; // Ensure _id is available
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid authentication' });
  }
};

module.exports = authMiddleware;