import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 50,
    },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      unique: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      required: true,
      default: 'QC Inspector',
      trim: true,
    },
    assignedLines: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProductionLine' }],
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, isActive: 1 });

export const User = mongoose.model('User', userSchema);

