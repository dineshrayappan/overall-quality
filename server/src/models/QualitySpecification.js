import mongoose from 'mongoose';

const qualitySpecificationSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', required: true, index: true },
    buyerName: { type: String, trim: true, default: '' },
    fabricId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fabric', default: null },
    fabricName: { type: String, trim: true, default: '' },
    styleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Style', default: null },
    styleNumber: { type: String, trim: true, default: '' },
    version: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
    effectiveDate: { type: Date, default: Date.now },
    shrinkage: {
      allowedRangeMin: { type: Number, default: -5 },
      allowedRangeMax: { type: Number, default: 2 },
      spiralityMaxPercent: { type: Number, default: 4 },
    },
    gsmTolerance: {
      tolerancePercent: { type: Number, default: 5 },
    },
    colourFastness: {
      changeInShadeMin: { type: Number, default: 4 },
      stainingOnCottonMin: { type: Number, default: 3 },
      crockingFabricWetMin: { type: Number, default: 3 },
      crockingFabricDryMin: { type: Number, default: 4 },
      crockingArtworkWetMin: { type: Number, default: 4 },
      crockingArtworkDryMin: { type: Number, default: 4 },
    },
    physicalTesting: {
      attachmentMinNewton: { type: Number, default: 70 },
      burstingStrengthMinKpa: { type: Number, default: 250 },
    },
    fourPoint: {
      rollPointsMax: { type: Number, default: 28 },
      batchPointsMax: { type: Number, default: 20 },
    },
    accessories: {
      maxAllowedDefects: { type: Number, default: 0 },
    },
    remarks: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

qualitySpecificationSchema.index({ buyerId: 1, fabricId: 1, styleId: 1, isActive: 1 });

export const QualitySpecification = mongoose.model(
  'QualitySpecification',
  qualitySpecificationSchema,
  'qualityspecifications'
);

