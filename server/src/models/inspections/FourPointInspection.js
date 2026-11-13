import mongoose from 'mongoose';
import { commonInspectionFields, workflowStageSchema } from './baseFields.js';

const rollDefectsSchema = new mongoose.Schema(
  {
    unevenDyeingPatches: { type: Number, default: 0 },
    migration: { type: Number, default: 0 },
    dyeSpots: { type: Number, default: 0 },
    softenerStains: { type: Number, default: 0 },
    cutsJoints: { type: Number, default: 0 },
    stains: { type: Number, default: 0 },
    knittingHoles: { type: Number, default: 0 },
    processingHoles: { type: Number, default: 0 },
    compactingStorageMarks: { type: Number, default: 0 },
    stenterStopperMarks: { type: Number, default: 0 },
    layerToLayerShadeVariation: { type: Number, default: 0 },
    abrasionMarks: { type: Number, default: 0 },
    oilStains: { type: Number, default: 0 },
    whiteMarks: { type: Number, default: 0 },
    otherDefects: { type: Number, default: 0 },
  },
  { _id: false }
);

const rollItemSchema = new mongoose.Schema(
  {
    rollNo: { type: String, required: true, trim: true },
    ropeNo: { type: String, trim: true, default: '' },
    widthCm: { type: Number, default: 0 },
    diaInches: { type: Number, default: 30 },
    gsm: { type: Number, default: 0 },
    rollWeight: { type: Number, default: 0 }, // kg
    inspectedYards: { type: Number, default: 100 },
    
    // Four-Point Scoring Counts
    defectsUpTo3Inches: { type: Number, default: 0 }, // 1 pt each
    defects3To6Inches: { type: Number, default: 0 },  // 2 pts each
    defects6To9Inches: { type: Number, default: 0 },  // 3 pts each
    defectsOver9Inches: { type: Number, default: 0 }, // 4 pts each

    defects: { type: rollDefectsSchema, default: () => ({}) },

    totalDefectPoints: { type: Number, default: 0 },
    pointsPer100SqYds: { type: Number, default: 0 },
    rollResult: { type: String, enum: ['PASS', 'FAIL', 'HOLD'], default: 'PASS' },
    remarks: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const fourPointInspectionSchema = new mongoose.Schema(
  {
    ...commonInspectionFields,
    inspectionType: { type: String, default: 'four_point', immutable: true },

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
      styleNumber: { type: String, default: '' },
      fabricDescription: { type: String, default: '' },
      colourName: { type: String, default: '' },
      requiredGsm: { type: Number, default: 0 },
      yarnMill: { type: String, default: '' },
      knittingName: { type: String, default: '' },
      countDia: { type: String, default: '' },
      dcNumber: { type: String, default: '' },
      rollNumberSummary: { type: String, default: '' },
      totalReceivedWeight: { type: Number, default: 0 },
      inspectionQuantityYards: { type: Number, default: 0 },
    },

    // Formula & Criteria settings
    isTubularFabric: { type: Boolean, default: true }, // If true, formula is Dia * 2
    acceptanceCriteria: {
      rollMaxPointsPer100SqYds: { type: Number, default: 28 },
      batchMaxPointsPer100SqYds: { type: Number, default: 20 },
    },

    // Dynamic list of rolls
    rolls: { type: [rollItemSchema], default: [] },

    // Batch-wise Calculated Summary
    batchSummary: {
      totalRolls: { type: Number, default: 0 },
      totalInspectedYards: { type: Number, default: 0 },
      totalAcceptedRolls: { type: Number, default: 0 },
      totalRejectedRolls: { type: Number, default: 0 },
      totalDefectPoints: { type: Number, default: 0 },
      averagePointsPer100SqYds: { type: Number, default: 0 },
      finalBatchResult: { type: String, enum: ['PASS', 'FAIL', 'HOLD'], default: 'PASS' },
    },

    // Retesting
    retestRequired: { type: Boolean, default: false },
    retestOfReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'FourPointInspection', default: null },

    // Signatures & Remarks
    inspectorRemarks: { type: String, trim: true, default: '' },
    checkerSignature: { type: String, trim: true, default: '' },
    labIcSignature: { type: String, trim: true, default: '' },

    approvalWorkflow: { type: [workflowStageSchema], default: [] },
  },
  { timestamps: true }
);

fourPointInspectionSchema.index({ inspectionDate: -1, buyerId: 1, orderId: 1 });

export const FourPointInspection = mongoose.model(
  'FourPointInspection',
  fourPointInspectionSchema,
  'fourpointinspections'
);

