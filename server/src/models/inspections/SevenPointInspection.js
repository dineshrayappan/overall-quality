import mongoose from 'mongoose';
import { commonInspectionFields, workflowStageSchema } from './baseFields.js';

const checkpointResultSchema = new mongoose.Schema(
  {
    checkpointNumber: { type: Number, required: true, min: 1 },
    label: { type: String, trim: true, default: '' },
    result: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['Pass', 'Fail', 'N/A'],
      default: 'Pass',
    },
    defectDetails: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    inspectionTime: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const sevenPointEntrySchema = new mongoose.Schema(
  {
    serialNumber: { type: Number, required: true, min: 1 },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    employeeCode: { type: String, default: '' },
    employeeName: { type: String, required: true, trim: true },
    processId: { type: mongoose.Schema.Types.ObjectId, ref: 'Process', required: true },
    processName: { type: String, required: true, trim: true },
    machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', default: null },
    machineNumber: { type: String, default: '' },
    machineName: { type: String, default: '' },
    needleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Needle', default: null },
    needleNumber: { type: String, trim: true, default: '' },
    needleChangeTime: { type: String, trim: true, default: '' },
    checkpoints: { type: [checkpointResultSchema], default: [] },
    piecesChecked: { type: Number, default: 0, min: 0 },
    okPieces: { type: Number, default: 0, min: 0 },
    reworkPieces: { type: Number, default: 0, min: 0 },
    rejectedPieces: { type: Number, default: 0, min: 0 },
    oilDefectCount: { type: Number, default: 0, min: 0 },
    attachmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InspectionAttachment' }],
  },
  { _id: false }
);

const sevenPointInspectionSchema = new mongoose.Schema(
  {
    ...commonInspectionFields,
    inspectionType: { type: String, default: 'seven_point', immutable: true },
    sNo: { type: String, trim: true, default: '' },
    qcUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    qcName: { type: String, trim: true, default: '' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', required: true, index: true },
    styleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Style', required: true, index: true },
    fabricId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fabric', default: null },
    colourId: { type: mongoose.Schema.Types.ObjectId, ref: 'Colour', default: null },
    productionLineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductionLine',
      default: null,
      index: true,
    },
    headerSnapshot: {
      styleNumber: { type: String, default: '' },
      styleName: { type: String, default: '' },
      fabricName: { type: String, default: '' },
      colourName: { type: String, default: '' },
      orderNumber: { type: String, default: '' },
      buyerName: { type: String, default: '' },
      orderQuantity: { type: Number, default: 0 },
      productionLineName: { type: String, default: '' },
    },
    configuredCheckpointCount: { type: Number, default: 10, min: 1 },
    checkpointDefinitions: [
      {
        checkpointNumber: { type: Number, required: true },
        label: { type: String, required: true },
        description: { type: String, default: '' },
      },
    ],
    entries: { type: [sevenPointEntrySchema], default: [] },
    totals: {
      totalPiecesChecked: { type: Number, default: 0 },
      okPieces: { type: Number, default: 0 },
      reworkPieces: { type: Number, default: 0 },
      rejectedPieces: { type: Number, default: 0 },
      oilDefectCount: { type: Number, default: 0 },
      okPercentage: { type: Number, default: 0 },
      reworkPercentage: { type: Number, default: 0 },
      oilPercentage: { type: Number, default: 0 },
      rejectionPercentage: { type: Number, default: 0 },
      sumValidationPassed: { type: Boolean, default: true },
      validationMessage: { type: String, default: '' },
    },
    remarks: { type: String, trim: true, default: '' },
    workflowStages: { type: [workflowStageSchema], default: [] },
    currentStageIndex: { type: Number, default: 0 },
  },
  { timestamps: true }
);

sevenPointInspectionSchema.index({ inspectionDate: -1, styleId: 1, orderId: 1, productionLineId: 1 });

export const SevenPointInspection = mongoose.model(
  'SevenPointInspection',
  sevenPointInspectionSchema,
  'sevenpointinspections'
);

