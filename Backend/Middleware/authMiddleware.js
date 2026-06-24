import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import BrokerModel from '../Model/BrokerModel.js';
import CustomerModel from '../Model/CustomerModel.js';
import { isBlacklisted } from '../Controllers/AuthController.js';

// protect middleware: verifies bearer token, checks blacklist, loads user
const protect = asyncHandler(async (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not authorized' });

  if (typeof isBlacklisted === 'function') {
    if (isBlacklisted(token)) return res.status(401).json({ message: 'Session expired. Please login again.' });
  }

  if (token === 'super-broker-local-token') {
    // Grant Super Admin Access for the local Super Broker
    req.user = {
      _id: '000000000000009999912345', // Valid 24-char hex ObjectId
      name: 'Super Broker',
      role: 'admin',
      login_id: '9999912345', // Keep the original 10-digit ID as login_id
      organization_name: 'Super Broker'
    };
    req.role = 'admin';
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded expected shape: { id, role }
    if (!decoded || !decoded.id) return res.status(401).json({ message: 'Token invalid' });

    if (decoded.role === 'broker') {
      req.user = await BrokerModel.findById(decoded.id).select('-password');
    } else if (decoded.role === 'customer') {
      req.user = await CustomerModel.findById(decoded.id).select('-password');
    } else {
      // fallback: try to find either
      req.user = await BrokerModel.findById(decoded.id).select('-password') || await CustomerModel.findById(decoded.id).select('-password');
    }

    if (!req.user) return res.status(401).json({ message: 'User not found in database' });

    req.role = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid' });
  }
});

// adminOnly middleware: checks if user has admin role
// must be used AFTER protect middleware
const adminOnly = (req, res, next) => {
  if (req.role !== 'admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden: Admin access only' });
  }
  next();
};

export { protect, adminOnly };