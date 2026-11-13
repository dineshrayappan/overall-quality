import mongoose from 'mongoose';
import { nextMasterCode } from '../../utils/counter.js';

export function createMasterSchema(specificFields, codePrefix, extraOptions = {}) {
  const schema = new mongoose.Schema(
    {
      code: {
        type: String,
        unique: true,
        trim: true,
        uppercase: true,
      },
      ...specificFields,
      isActive: { type: Boolean, default: true, index: true },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true, ...extraOptions }
  );

  schema.pre('save', async function assignCode() {
    if (!this.code) {
      this.code = await nextMasterCode(codePrefix);
    }
  });

  return schema;
}

