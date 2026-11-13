import mongoose from 'mongoose';
import { commonInspectionFields, workflowStageSchema } from './baseFields.js';

const shrinkageRowSchema = new mongoose.Schema(
  {
    point: { type: String, required: true, trim: true },
    bw: { type: Number, default: 0 }, // Before Washing
    aw: { type: Number, default: 0 }, // After Washing
    shrinkagePercent: { type: Number, default: 0 }, // ((bw - aw) / bw) * 100
    kDia: { type: String, trim: true, default: '' },
    fid: { type: String, trim: true, default: '' },
    actualGsm: { type: Number, default: 0 },
    spec: { type: String, trim: true, default: '+2% to -5%' },
    result: { type: String, enum: ['OK', 'NOT OK', '-'], default: '-' },
  },
  { _id: false }
);

const shrinkageInspectionSchema = new mongoose.Schema(
  {
    ...commonInspectionFields,
    inspectionType: { type: String, default: 'shrinkage', immutable: true },

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', default: null, index: true },
    styleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Style', default: null, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    fabricId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fabric', default: null },
    colourId: { type: mongoose.Schema.Types.ObjectId, ref: 'Colour', default: null },
    gsmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gsm', default: null },
    specificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'QualitySpecification', default: null },

    headerSnapshot: {
      orderNumber: { type: String, default: '' },
      buyerName: { type: String, default: '' },
      fabricName: { type: String, default: '' },
      supplierName: { type: String, default: '' },
      colourName: { type: String, default: '' },
      styleNumber: { type: String, default: '' },
      requiredGsm: { type: Number, default: 0 },
      lotNumber: { type: String, default: '' },
      sampleIdentification: { type: String, default: '' },
      allowedShrinkage: { type: String, default: '+2% -5%' },
    },

    // Allowable tolerances
    toleranceConfig: {
      minShrinkage: { type: Number, default: -5 }, // -5% (growth)
      maxShrinkage: { type: Number, default: 2 },  // +2% (shrinkage)
      gsmTolerancePercent: { type: Number, default: 5 },
      burstingStrengthMin: { type: Number, default: 250 },
      attachmentMinNewton: { type: Number, default: 70 },
      spiralityMaxPercent: { type: Number, default: 4 },
    },

    // Two measurement blocks (Garment Section / Fabric Section or Sample 1 / Sample 2)
    garmentMeasurements: { type: [shrinkageRowSchema], default: [] },
    fabricMeasurements: { type: [shrinkageRowSchema], default: [] },

    // GSM Testing
    gsmTesting: {
      requiredGsm: { type: Number, default: 0 },
      actualGsm: { type: Number, default: 0 },
      deviation: { type: Number, default: 0 }, // actualGsm - requiredGsm
      deviationPercent: { type: Number, default: 0 },
      tolerancePercent: { type: Number, default: 5 },
      result: { type: String, enum: ['OK', 'NOT OK', 'Pending'], default: 'Pending' },
    },

    // Colour Fastness
    colourFastness: {
      temperature: { type: String, default: '60°C' },
      changeInShade: {
        value: { type: Number, default: 4 },
        requirement: { type: Number, default: 4 },
        result: { type: String, enum: ['OK', 'NOT OK', '-'], default: 'OK' },
      },
      stainingOnCotton: {
        value: { type: Number, default: 3 },
        requirement: { type: Number, default: 3 },
        result: { type: String, enum: ['OK', 'NOT OK', '-'], default: 'OK' },
      },
      crockingFabricWet: {
        value: { type: Number, default: 3 },
        requirement: { type: Number, default: 3 },
        result: { type: String, enum: ['OK', 'NOT OK', '-'], default: 'OK' },
      },
      crockingFabricDry: {
        value: { type: Number, default: 4 },
        requirement: { type: Number, default: 4 },
        result: { type: String, enum: ['OK', 'NOT OK', '-'], default: 'OK' },
      },
      crockingArtworkWet: {
        value: { type: Number, default: 4 },
        requirement: { type: Number, default: 4 },
        result: { type: String, enum: ['OK', 'NOT OK', '-'], default: 'OK' },
      },
      crockingArtworkDry: {
        value: { type: Number, default: 4 },
        requirement: { type: Number, default: 4 },
        result: { type: String, enum: ['OK', 'NOT OK', '-'], default: 'OK' },
      },
      overallResult: { type: String, enum: ['OK', 'NOT OK', 'Pending'], default: 'OK' },
    },

    // Process Detail
    processDetail: {
      knitting: { type: String, trim: true, default: '' },
      dyeing: { type: String, trim: true, default: '' },
      compacting: { type: String, trim: true, default: '' },
      fabricBurstingStrength: { type: String, trim: true, default: '' },
      attachmentTests: [
        {
          testNumber: { type: Number, default: 1 },
          valueNewton: { type: Number, default: 70 },
          result: { type: String, enum: ['OK', 'NOT OK', '-'], default: 'OK' },
        },
      ],
      attachmentRequirement: { type: Number, default: 70 },
      attachmentResult: { type: String, enum: ['OK', 'NOT OK', 'Pending'], default: 'OK' },
    },

    // Spirality
    spirality: {
      spiralityPercent: { type: Number, default: 0 },
      maxAllowedPercent: { type: Number, default: 4 },
      result: { type: String, enum: ['OK', 'NOT OK', 'Pending'], default: 'OK' },
    },

    // Summary evaluation
    summaryResults: {
      shrinkageResult: { type: String, enum: ['OK', 'NOT OK', 'Pending'], default: 'Pending' },
      gsmResult: { type: String, enum: ['OK', 'NOT OK', 'Pending'], default: 'Pending' },
      colourFastnessResult: { type: String, enum: ['OK', 'NOT OK', 'Pending'], default: 'Pending' },
      spiralityResult: { type: String, enum: ['OK', 'NOT OK', 'Pending'], default: 'Pending' },
      overallResult: { type: String, enum: ['PASS', 'FAIL', 'PENDING'], default: 'PENDING' },
      failedParameters: { type: [String], default: [] },
    },

    // Result Override
    isOverridden: { type: Boolean, default: false },
    overrideReason: { type: String, default: '' },
    overrideBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    overrideAt: { type: Date, default: null },

    // Retesting
    retestRequired: { type: Boolean, default: false },
    retestOfReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShrinkageInspection', default: null },
    retestReason: { type: String, default: '' },

    // Signatures & Remarks
    remarks: { type: String, trim: true, default: '' },
    correctiveAction: { type: String, trim: true, default: '' },
    icLabSignature: { type: String, trim: true, default: '' },
    icQadSignature: { type: String, trim: true, default: '' },
    receivedBySignature: { type: String, trim: true, default: '' },

    approvalWorkflow: { type: [workflowStageSchema], default: [] },
  },
  { timestamps: true }
);

shrinkageInspectionSchema.index({ inspectionDate: -1, buyerId: 1, styleId: 1, orderId: 1 });

export const ShrinkageInspection = mongoose.model(
  'ShrinkageInspection',
  shrinkageInspectionSchema,
  'shrinkageinspections'
);

