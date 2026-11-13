import mongoose from 'mongoose';

const companySettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    companyName: { type: String, required: true, default: 'Garment Quality Management System' },
    companyAddress: { type: String, default: '' },
    companyPhone: { type: String, default: '' },
    companyEmail: { type: String, default: '' },
    logoAttachmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'InspectionAttachment', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const CompanySetting = mongoose.model('CompanySetting', companySettingSchema);

