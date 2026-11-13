import mongoose from 'mongoose';

const inspectionConfigSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
      unique: true,
      enum: ['target_chart', 'size_set', 'seven_point', 'measurement'],
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const InspectionConfig = mongoose.model(
  'InspectionConfig',
  inspectionConfigSchema,
  'inspectionconfigurations'
);

