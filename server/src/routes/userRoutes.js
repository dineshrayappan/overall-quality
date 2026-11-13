import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { RolePermission } from '../models/RolePermission.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { recordAudit } from '../services/auditService.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = express.Router();
router.use(authenticate);

const createUserSchema = z.object({
  username: z.string().trim().min(3).max(50),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().optional().or(z.literal('')),
  password: z.string().min(8),
  role: z.string().trim().min(2),
  assignedLines: z.array(z.string()).optional().default([]),
  departmentId: z.string().nullable().optional(),
  employeeId: z.string().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  password: z.string().min(8).optional().or(z.literal('')),
  role: z.string().trim().min(2).optional(),
  assignedLines: z.array(z.string()).optional(),
  departmentId: z.string().nullable().optional(),
  employeeId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

router.get(
  '/',
  requirePermission('users', 'view'),
  asyncHandler(async (req, res) => {
    const { search = '', role = '', activeOnly = '' } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (activeOnly === 'true') filter.isActive = true;
    if (search) {
      const rx = new RegExp(search.trim(), 'i');
      filter.$or = [{ username: rx }, { fullName: rx }, { email: rx }];
    }

    const users = await User.find(filter)
      .populate('assignedLines', 'code name')
      .populate('departmentId', 'code name')
      .populate('employeeId', 'employeeCode name')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: users });
  })
);

router.post(
  '/',
  requirePermission('users', 'create'),
  asyncHandler(async (req, res) => {
    const data = createUserSchema.parse(req.body);
    const roleExists = await RolePermission.findOne({ roleName: data.role }).lean();
    if (!roleExists) {
      throw new AppError(`Role '${data.role}' does not exist in role permissions.`, 400);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await User.create({
      username: data.username.toLowerCase(),
      fullName: data.fullName,
      email: data.email ? data.email.toLowerCase() : undefined,
      passwordHash,
      role: data.role,
      assignedLines: data.assignedLines,
      departmentId: data.departmentId || null,
      employeeId: data.employeeId || null,
      isActive: data.isActive,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await recordAudit({
      entityType: 'user',
      entityId: user._id,
      entityIdentifier: user.username,
      action: 'CREATE',
      user: req.user,
      newValues: { username: user.username, fullName: user.fullName, role: user.role },
      summary: `Created user '${user.username}' with role '${user.role}'.`,
      req,
    });

    const created = await User.findById(user._id)
      .populate('assignedLines', 'code name')
      .lean();
    res.status(201).json({ success: true, data: created });
  })
);

router.patch(
  '/:id',
  requirePermission('users', 'edit'),
  asyncHandler(async (req, res) => {
    const data = updateUserSchema.parse(req.body);
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError('User not found.', 404);

    if (data.role) {
      const roleExists = await RolePermission.findOne({ roleName: data.role }).lean();
      if (!roleExists) {
        throw new AppError(`Role '${data.role}' does not exist.`, 400);
      }
    }

    const previousValues = {
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      assignedLines: user.assignedLines,
    };

    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.email !== undefined) user.email = data.email ? data.email.toLowerCase() : undefined;
    if (data.role !== undefined) user.role = data.role;
    if (data.assignedLines !== undefined) user.assignedLines = data.assignedLines;
    if (data.departmentId !== undefined) user.departmentId = data.departmentId || null;
    if (data.employeeId !== undefined) user.employeeId = data.employeeId || null;
    if (data.isActive !== undefined) {
      if (user._id.toString() === req.user._id.toString() && !data.isActive) {
        throw new AppError('You cannot deactivate your own active Admin account.', 400);
      }
      user.isActive = data.isActive;
    }
    if (data.password) {
      user.passwordHash = await bcrypt.hash(data.password, 10);
    }
    user.updatedBy = req.user._id;
    await user.save();

    await recordAudit({
      entityType: 'user',
      entityId: user._id,
      entityIdentifier: user.username,
      action: 'UPDATE',
      user: req.user,
      previousValues,
      newValues: {
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        assignedLines: user.assignedLines,
      },
      summary: `Updated user '${user.username}'.`,
      req,
    });

    const updated = await User.findById(user._id)
      .populate('assignedLines', 'code name')
      .lean();
    res.json({ success: true, data: updated });
  })
);

export default router;

