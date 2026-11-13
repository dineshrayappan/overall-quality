import mongoose from 'mongoose';

const modulePermSchema = new mongoose.Schema(
  {
    view: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    submit: { type: Boolean, default: false },
    approve: { type: Boolean, default: false },
    reject: { type: Boolean, default: false },
    archive: { type: Boolean, default: false },
    markNA: { type: Boolean, default: false },
    scopeAllLines: { type: Boolean, default: false },
    approvalStages: { type: [String], default: [] },
  },
  { _id: false }
);

const rolePermissionSchema = new mongoose.Schema(
  {
    roleName: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: '' },
    isSystem: { type: Boolean, default: false },
    permissions: {
      masterData: {
        view: { type: Boolean, default: true },
        create: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
        archive: { type: Boolean, default: false },
      },
      configuration: {
        view: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
      },
      users: {
        view: { type: Boolean, default: false },
        create: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
      },
      targetChart: { type: modulePermSchema, default: () => ({}) },
      sizeSet: { type: modulePermSchema, default: () => ({}) },
      sevenPoint: { type: modulePermSchema, default: () => ({}) },
      measurement: { type: modulePermSchema, default: () => ({}) },
      shrinkage: { type: modulePermSchema, default: () => ({}) },
      fourPoint: { type: modulePermSchema, default: () => ({}) },
      accessories: { type: modulePermSchema, default: () => ({}) },
      specifications: {
        view: { type: Boolean, default: true },
        create: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
        archive: { type: Boolean, default: false },
      },
      dashboard: {
        view: { type: Boolean, default: true },
      },
      exports: {
        pdf: { type: Boolean, default: true },
        excel: { type: Boolean, default: false },
      },
      auditLogs: {
        view: { type: Boolean, default: false },
      },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const RolePermission = mongoose.model('RolePermission', rolePermissionSchema);

