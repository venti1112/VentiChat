const path = require('path');
const fs = require('fs').promises;
const jwt = require('jsonwebtoken');
const config = require('../config/config.json');
const models = require('../models');
const redisClient = require('../utils/redisClient');

/**
 * Admin page authentication middleware
 * Checks if user is authenticated to access admin panel pages
 */
async function adminPageAuthMiddleware(req, res, next) {
    // Only apply to /admin path and sub-paths
    if (req.path.startsWith('/admin') && req.path !== '/admin' && req.path !== '/admin/403.png') {
        // Check if user has valid session/token
        const token = req.cookies.token;
        
        if (!token) {
            // Return 403.html if not authenticated
            try {
                const filePath = path.join(__dirname, '../public/admin/403.html');
                const data = await fs.readFile(filePath, 'utf8');
                return res.status(403).send(data);
            } catch (err) {
                return res.status(403).send('<h1>403 Forbidden</h1><p>Access denied to admin panel.</p>');
            }
        }
        
        try {
            // Verify JWT token
            const decoded = jwt.verify(token, config.encryptionKey);
            
            // Check if token exists in Redis
            const storedToken = await redisClient.validateToken(token);
            if (!storedToken) {
                // Return 403.html if token is not valid
                try {
                    const filePath = path.join(__dirname, '../public/admin/403.html');
                    const data = await fs.readFile(filePath, 'utf8');
                    return res.status(403).send(data);
                } catch (err) {
                    return res.status(403).send('<h1>403 Forbidden</h1><p>Access denied to admin panel.</p>');
                }
            }
            
            // Find user in database
            const user = await models.User.findByPk(decoded.id || decoded.userId);
            
            // If user doesn't exist or is not admin
            if (!user || !user.isAdmin) {
                // Return 403.html if user is not admin
                try {
                    const filePath = path.join(__dirname, '../public/admin/403.html');
                    const data = await fs.readFile(filePath, 'utf8');
                    return res.status(403).send(data);
                } catch (err) {
                    return res.status(403).send('<h1>403 Forbidden</h1><p>Access denied to admin panel.</p>');
                }
            }
            
            // If user is authenticated and is admin, continue
            next();
        } catch (error) {
            // Return 403.html if token verification fails
            try {
                const filePath = path.join(__dirname, '../public/admin/403.html');
                const data = await fs.readFile(filePath, 'utf8');
                return res.status(403).send(data);
            } catch (err) {
                return res.status(403).send('<h1>403 Forbidden</h1><p>Access denied to admin panel.</p>');
            }
        }
    } else {
        // For all other paths, continue normally
        next();
    }
}

module.exports = adminPageAuthMiddleware;