import mongoose from 'mongoose';
import { commonInspectionFields, workflowStageSchema } from './baseFields.js';

const measurementRowSchema = new mongoose.Schema(
  {
    specId: { type: mongoose.Schema.Types.ObjectId, ref: 'MeasurementSpec', default: null },
    size: { type: String, required: true, trim: true },
    sampleIndex: { type: Number, default: 1, min: 1 },
    measurementPoint: { type: String, required: true, trim: true },
    measurementDescription: { type: String, trim: true, default: '' },
    unit: { type: String, enum: ['cm', 'inch', 'mm'], default: 'cm' },
    approvedSpec: { type: Number, required: true },
    upperTolerance: { type: Number, required: true },
    lowerTolerance: { type: Number, required: true },
    actualMeasurement: { type: Number, required: true },
    difference: { type: Number, required: true },
    withinTolerance: { type: Boolean, required: true },
    result: { type: String, enum: ['Pass', 'Fail'], required: true },
    toleranceLabel: {
      type: String,
      enum: ['Within Tolerance', 'Pass', 'Fail'],
      default: 'Within Tolerance',
    },
    remarks: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const sizeSummarySchema = new mongoose.Schema(
  {
    size: { type: String, required: true },
    total: { type: Number, default: 0 },
    passed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    passPercentage: { type: Number, default: 0 },
    result: { type: String, enum: ['Pass', 'Fail'], default: 'Pass' },
  },
  { _id: false }
);

const measurementInspectionSchema = new mongoose.Schema(
  {
    ...commonInspectionFields,
    inspectionType: { type: String, default: 'measurement', immutable: true },
    inspectionStage: { type: String, required: true, trim: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', required: true, index: true },
    styleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Style', required: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    fabricId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fabric', default: null },
    gsmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gsm', default: null },
    colourId: { type: mongoose.Schema.Types.ObjectId, ref: 'Colour', default: null },
    productionLineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductionLine',
      default: null,
      index: true,
    },
    headerSnapshot: {
      styleNumber: { type: String, default: '' },
      styleDescription: { type: String, default: '' },
      fabricName: { type: String, default: '' },
      gsmLabel: { type: String, default: '' },
      colourName: { type: String, default: '' },
      orderQuantity: { type: Number, default: 0 },
      orderNumber: { type: String, default: '' },
      buyerName: { type: String, default: '' },
      supplierName: { type: String, default: '' },
      productionLineName: { type: String, default: '' },
    },
    selectedSizes: { type: [String], default: [] },
    rows: { type: [measurementRowSchema], default: [] },
    summary: {
      totalPointsChecked: { type: Number, default: 0 },
      passedPoints: { type: Number, default: 0 },
      failedPoints: { type: Number, default: 0 },
      passPercentage: { type: Number, default: 0 },
      overallResult: { type: String, enum: ['Pass', 'Fail'], default: 'Pass' },
      sizeSummaries: { type: [sizeSummarySchema], default: [] },
    },
    remarks: { type: String, trim: true, default: '' },
    specialComments: { type: String, trim: true, default: '' },
    attachmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InspectionAttachment' }],
    workflowStages: { type: [workflowStageSchema], default: [] },
    currentStageIndex: { type: Number, default: 0 },
  },
  { timestamps: true }
);

measurementInspectionSchema.index({ inspectionDate: -1, styleId: 1, buyerId: 1, inspectionStage: 1 });

export const MeasurementInspection = mongoose.model(
  'MeasurementInspection',
  measurementInspectionSchema,
  'measurementinspections'
);

