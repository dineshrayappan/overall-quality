import mongoose from 'mongoose';

export const revisionEntrySchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    revisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    revisedByName: { type: String, default: '' },
    revisedAt: { type: Date, default: Date.now },
    reason: { type: String, default: '' },
  },
  { _id: false }
);

export const workflowStageSchema = new mongoose.Schema(
  {
    stage: { type: String, required: true },
    required: { type: Boolean, default: true },
    allowedRoles: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Returned for Correction'],
      default: 'Pending',
    },
    actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actionByName: { type: String, default: '' },
    actionByRole: { type: String, default: '' },
    actionAt: { type: Date, default: null },
    comments: { type: String, default: '' },
  },
  { _id: false }
);

export const commonInspectionFields = {
  reportNumber: { type: String, required: true, unique: true, trim: true, index: true },
  inspectionType: {
    type: String,
    required: true,
    enum: ['target_chart', 'size_set', 'seven_point', 'measurement', 'shrinkage', 'four_point', 'accessories'],
    index: true,
  },
  inspectionDate: { type: Date, required: true, index: true },
  inspectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  inspectorName: { type: String, required: true, trim: true },
  approvalStatus: {
    type: String,
    enum: ['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Returned for Correction'],
    default: 'Draft',
    index: true,
  },
  submissionToken: { type: String, sparse: true, unique: true },
  submittedAt: { type: Date, default: null },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  finalizedAt: { type: Date, default: null },
  finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  version: { type: Number, default: 1 },
  revisionHistory: { type: [revisionEntrySchema], default: [] },
  isArchived: { type: Boolean, default: false, index: true },
  archivedAt: { type: Date, default: null },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  archiveReason: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
};

