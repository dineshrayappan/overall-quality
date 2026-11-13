import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { RolePermission } from '../models/RolePermission.js';
import { CompanySetting } from '../models/CompanySetting.js';
import { authenticate } from '../middleware/auth.js';
import { recordAudit } from '../services/auditService.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = express.Router();

const setupSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required.'),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username can contain letters, numbers, dot, underscore, or hyphen.'),
  email: z.string().trim().email('Valid email address is required.').optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  companyName: z.string().trim().min(2).optional(),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Username or email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

async function buildAuthPayload(userDoc) {
  const roleDoc = await RolePermission.findOne({ roleName: userDoc.role }).lean();
  const company = await CompanySetting.findOne({ key: 'default' }).lean();
  return {
    token: signToken(userDoc),
    user: {
      _id: userDoc._id,
      username: userDoc.username,
      fullName: userDoc.fullName,
      email: userDoc.email || '',
      role: userDoc.role,
      assignedLines: userDoc.assignedLines || [],
      isActive: userDoc.isActive,
    },
    permissions: roleDoc?.permissions || {},
    company: company || null,
  };
}

router.get(
  '/setup-status',
  asyncHandler(async (_req, res) => {
    const userCount = await User.countDocuments();
    const company = await CompanySetting.findOne({ key: 'default' })
      .select('companyName logoAttachmentId')
      .lean();
    res.json({
      success: true,
      data: {
        needsSetup: userCount === 0,
        companyName: company?.companyName || 'Garment Quality Management System',
      },
    });
  })
);

router.post(
  '/setup',
  asyncHandler(async (req, res) => {
    const existingCount = await User.countDocuments();
    if (existingCount > 0) {
      throw new AppError(
        'Initial setup is already completed. Please sign in or ask an Admin to create accounts.',
        403
      );
    }

    const parsed = setupSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(parsed.password, 10);

    const adminUser = await User.create({
      fullName: parsed.fullName,
      username: parsed.username.toLowerCase(),
      email: parsed.email ? parsed.email.toLowerCase() : undefined,
      passwordHash,
      role: 'Admin',
      isActive: true,
      lastLoginAt: new Date(),
    });

    if (parsed.companyName) {
      await CompanySetting.updateOne(
        { key: 'default' },
        { $set: { companyName: parsed.companyName, updatedBy: adminUser._id } },
        { upsert: true }
      );
    }

    await recordAudit({
      entityType: 'user',
      entityId: adminUser._id,
      entityIdentifier: adminUser.username,
      action: 'CREATE',
      user: adminUser,
      summary: `Initial system Admin '${adminUser.username}' created via first-time setup.`,
      req,
    });

    const payload = await buildAuthPayload(adminUser);
    res.status(201).json({ success: true, data: payload });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { identifier, password } = loginSchema.parse(req.body);
    const needle = identifier.toLowerCase();

    const user = await User.findOne({
      $or: [{ username: needle }, { email: needle }],
    }).select('+passwordHash');

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError('Invalid credentials.', 401);
    }
    if (!user.isActive) {
      throw new AppError('Account is deactivated. Contact an administrator.', 403);
    }

    user.lastLoginAt = new Date();
    await user.save();

    await recordAudit({
      entityType: 'auth',
      entityId: user._id,
      entityIdentifier: user.username,
      action: 'LOGIN',
      user,
      summary: `User '${user.username}' signed in.`,
      req,
    });

    const payload = await buildAuthPayload(user);
    res.json({ success: true, data: payload });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const company = await CompanySetting.findOne({ key: 'default' }).lean();
    res.json({
      success: true,
      data: {
        user: req.user,
        permissions: req.permissions,
        company: company || null,
      },
    });
  })
);

router.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
    });
    const { currentPassword, newPassword } = schema.parse(req.body);

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError('Current password is incorrect.', 400);
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.updatedBy = req.user._id;
    await user.save();

    await recordAudit({
      entityType: 'user',
      entityId: user._id,
      entityIdentifier: user.username,
      action: 'UPDATE',
      user: req.user,
      summary: `User '${user.username}' updated their password.`,
      req,
    });

    res.json({ success: true, message: 'Password updated successfully.' });
  })
);

export default router;

