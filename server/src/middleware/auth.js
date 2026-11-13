import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { RolePermission } from '../models/RolePermission.js';
import { AppError } from '../utils/errors.js';

export async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication token is required.', 401);
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError('Authentication token is empty.', 401);
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.sub).lean();
    if (!user || !user.isActive) {
      throw new AppError('Account is inactive or no longer exists.', 401);
    }

    const roleDoc = await RolePermission.findOne({ roleName: user.role }).lean();
    req.user = user;
    req.permissions = roleDoc?.permissions || {};
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Invalid or expired authentication token.', 401));
  }
}

