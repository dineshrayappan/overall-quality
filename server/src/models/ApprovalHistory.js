import mongoose from 'mongoose';

const approvalHistorySchema = new mongoose.Schema(
  {
    inspectionType: {
      type: String,
      required: true,
      enum: ['target_chart', 'size_set', 'seven_point', 'measurement'],
      index: true,
    },
    inspectionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    reportNumber: { type: String, required: true, index: true },
    stage: { type: String, default: '' },
    action: {
      type: String,
      required: true,
      enum: [
        'Submitted',
        'Approved',
        'Rejected',
        'Returned for Correction',
        'Finalized',
        'Revised',
        'Archived',
        'Restored',
      ],
    },
    decision: { type: String, default: '' },
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approverName: { type: String, required: true },
    approverRole: { type: String, required: true },
    comments: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

approvalHistorySchema.index({ inspectionType: 1, inspectionId: 1, timestamp: -1 });

export const ApprovalHistory = mongoose.model(
  'ApprovalHistory',
  approvalHistorySchema,
  'approvalhistory'
);

