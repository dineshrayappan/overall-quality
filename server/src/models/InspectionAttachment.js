import mongoose from 'mongoose';

const inspectionAttachmentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    relativePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    module: {
      type: String,
      enum: ['target_chart', 'size_set', 'seven_point', 'measurement', 'branding'],
      default: 'size_set',
      index: true,
    },
    inspectionId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    itemKey: { type: String, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedByName: { type: String, default: '' },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const InspectionAttachment = mongoose.model(
  'InspectionAttachment',
  inspectionAttachmentSchema,
  'inspectionattachments'
);

