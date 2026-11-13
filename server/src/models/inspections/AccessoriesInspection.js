import mongoose from 'mongoose';
import { commonInspectionFields, workflowStageSchema } from './baseFields.js';

const accessoryParameterSchema = new mongoose.Schema(
  {
    parameterKey: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    isMandatory: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['OK', 'NOT OK', 'NOT APPLICABLE', 'N/A', 'Pending'],
      default: 'OK',
    },
    comments: { type: String, trim: true, default: '' },
    attachmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InspectionAttachment' }],
  },
  { _id: false }
);

const accessoriesInspectionSchema = new mongoose.Schema(
  {
    ...commonInspectionFields,
    inspectionType: { type: String, default: 'accessories', immutable: true },

    inOrNo: { type: String, trim: true, default: '' }, // IN.OR.NO
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', default: null, index: true },
    styleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Style', default: null, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    accessoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Accessory', default: null },
    specificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'QualitySpecification', default: null },

    headerSnapshot: {
      orderNumber: { type: String, default: '' },
      buyerName: { type: String, default: '' },
      styleNumber: { type: String, default: '' },
      supplierName: { type: String, default: '' },
      accessoryDescription: { type: String, default: '' },
      poNumber: { type: String, default: '' },
      dcNumber: { type: String, default: '' },
    },

    receivedDate: { type: Date, default: Date.now },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    inspectedQuantity: { type: Number, default: 0, min: 0 },
    acceptedQuantity: { type: Number, default: 0, min: 0 },
    rejectedQuantity: { type: Number, default: 0, min: 0 },
    inspectionPercentage: { type: Number, default: 0 },

    // 13 Checklist items
    checklist: { type: [accessoryParameterSchema], default: [] },

    // Calculation results
    calculations: {
      totalParameters: { type: Number, default: 13 },
      okCount: { type: Number, default: 0 },
      notOkCount: { type: Number, default: 0 },
      naCount: { type: Number, default: 0 },
      failedParameters: { type: [String], default: [] },
    },

    finalResult: {
      type: String,
      enum: ['ACCEPT', 'REJECT', 'HOLD', 'Pending'],
      default: 'ACCEPT',
      index: true,
    },

    // Retesting
    retestRequired: { type: Boolean, default: false },
    retestOfReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccessoriesInspection', default: null },

    // Signatures & Remarks
    inspectedBy: { type: String, trim: true, default: '' },
    verifiedBy: { type: String, trim: true, default: '' },
    approvedBy: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    correctiveAction: { type: String, trim: true, default: '' },

    approvalWorkflow: { type: [workflowStageSchema], default: [] },
  },
  { timestamps: true }
);

accessoriesInspectionSchema.index({ inspectionDate: -1, buyerId: 1, orderId: 1 });

export const AccessoriesInspection = mongoose.model(
  'AccessoriesInspection',
  accessoriesInspectionSchema,
  'accessoriesinspections'
);
