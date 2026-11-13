import mongoose from 'mongoose';
import { commonInspectionFields } from './baseFields.js';

const indicatorSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true, min: 1, max: 15 },
    code: { type: String, trim: true, default: '' },
    name: { type: String, required: true, trim: true },
    unit: { type: String, trim: true, default: 'pcs' },
    isActive: { type: Boolean, default: true },
    targetValue: { type: Number, default: 0, min: 0 },
    actualValue: { type: Number, default: 0, min: 0 },
    achievementPercentage: { type: Number, default: 0 },
    levelReached: {
      type: String,
      enum: ['No Target', 'Below 50%', '50%+', '75%+', '100%+'],
      default: 'No Target',
    },
    remarks: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const targetChartSchema = new mongoose.Schema(
  {
    ...commonInspectionFields,
    inspectionType: { type: String, default: 'target_chart', immutable: true },
    productionLineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductionLine',
      required: true,
      index: true,
    },
    productionLineName: { type: String, required: true, trim: true },
    shift: { type: String, trim: true, default: 'General' },
    indicators: {
      type: [indicatorSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 15,
        message: 'Target chart must contain exactly 15 circular indicators (3x5 grid).',
      },
    },
    summary: {
      totalIndicators: { type: Number, default: 15 },
      activeIndicators: { type: Number, default: 15 },
      achievedIndicators: { type: Number, default: 0 },
      pendingIndicators: { type: Number, default: 0 },
      totalTarget: { type: Number, default: 0 },
      totalAchieved: { type: Number, default: 0 },
      totalPending: { type: Number, default: 0 },
      achievementPercentage: { type: Number, default: 0 },
    },
    remarks: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

targetChartSchema.index({ productionLineId: 1, inspectionDate: -1 });
targetChartSchema.index({ inspectionDate: -1, isArchived: 1, approvalStatus: 1 });

export const TargetChart = mongoose.model('TargetChart', targetChartSchema, 'targetcharts');

