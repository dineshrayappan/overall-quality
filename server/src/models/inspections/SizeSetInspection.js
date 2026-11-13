import mongoose from 'mongoose';
import { commonInspectionFields } from './baseFields.js';

const checklistItemSchema = new mongoose.Schema(
  {
    itemKey: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['OK', 'Not OK', 'N/A', 'Pending'],
      default: 'Pending',
    },
    isCritical: { type: Boolean, default: false },
    remarks: { type: String, trim: true, default: '' },
    attachmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InspectionAttachment' }],
  },
  { _id: false }
);

const sectionStatSchema = new mongoose.Schema(
  {
    totalItems: { type: Number, default: 0 },
    applicableItems: { type: Number, default: 0 },
    inspectedItems: { type: Number, default: 0 },
    okItems: { type: Number, default: 0 },
    notOkItems: { type: Number, default: 0 },
    naItems: { type: Number, default: 0 },
    pendingItems: { type: Number, default: 0 },
    okPercentage: { type: Number, default: 0 },
    notOkPercentage: { type: Number, default: 0 },
  },
  { _id: false }
);

const sizeSetInspectionSchema = new mongoose.Schema(
  {
    ...commonInspectionFields,
    inspectionType: { type: String, default: 'size_set', immutable: true },
    inspectionStage: {
      type: String,
      enum: ['Size Set', 'Pilot Run', 'In-line', 'Mid-line'],
      required: true,
      index: true,
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', required: true, index: true },
    styleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Style', required: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    fabricId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fabric', default: null },
    gsmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gsm', default: null },
    colourId: { type: mongoose.Schema.Types.ObjectId, ref: 'Colour', default: null },
    sizeRangeId: { type: mongoose.Schema.Types.ObjectId, ref: 'SizeRange', default: null },
    productionLineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductionLine',
      default: null,
      index: true,
    },
    headerSnapshot: {
      buyerName: { type: String, default: '' },
      description: { type: String, default: '' },
      styleNumber: { type: String, default: '' },
      orderNumber: { type: String, default: '' },
      supplierName: { type: String, default: '' },
      fabricName: { type: String, default: '' },
      gsmLabel: { type: String, default: '' },
      orderQuantity: { type: Number, default: 0 },
      colourName: { type: String, default: '' },
      sizeRangeName: { type: String, default: '' },
      productionLineName: { type: String, default: '' },
    },
    accessories: { type: [checklistItemSchema], default: [] },
    workmanship: { type: [checklistItemSchema], default: [] },
    labelling: { type: [checklistItemSchema], default: [] },
    calculations: {
      totalItems: { type: Number, default: 0 },
      totalApplicableItems: { type: Number, default: 0 },
      totalInspectedItems: { type: Number, default: 0 },
      totalOkItems: { type: Number, default: 0 },
      totalNotOkItems: { type: Number, default: 0 },
      totalNaItems: { type: Number, default: 0 },
      totalPendingItems: { type: Number, default: 0 },
      completionPercentage: { type: Number, default: 0 },
      overallOkPercentage: { type: Number, default: 0 },
      overallNotOkPercentage: { type: Number, default: 0 },
      sectionStats: {
        accessories: { type: sectionStatSchema, default: () => ({}) },
        workmanship: { type: sectionStatSchema, default: () => ({}) },
        labelling: { type: sectionStatSchema, default: () => ({}) },
      },
      acceptanceRuleEvaluation: {
        meetsConfiguredRules: { type: Boolean, default: false },
        suggestedDecision: {
          type: String,
          enum: ['Accepted', 'Rework', 'Hold'],
          default: 'Hold',
        },
        failedRules: { type: [String], default: [] },
      },
    },
    ppsTopStatus: { type: String, trim: true, default: '' },
    productionStatus: { type: String, trim: true, default: '' },
    finalDecision: {
      type: String,
      enum: ['Pending', 'Accepted', 'Rework', 'Hold'],
      default: 'Pending',
      index: true,
    },
    comments: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

sizeSetInspectionSchema.index({ inspectionDate: -1, buyerId: 1, styleId: 1, inspectionStage: 1 });
sizeSetInspectionSchema.index({ orderId: 1, inspectionStage: 1, isArchived: 1 });

export const SizeSetInspection = mongoose.model(
  'SizeSetInspection',
  sizeSetInspectionSchema,
  'sizesetinspections'
);

