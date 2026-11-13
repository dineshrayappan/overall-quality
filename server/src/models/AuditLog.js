import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    entityIdentifier: { type: String, default: '', index: true },
    action: { type: String, required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorUsername: { type: String, default: '' },
    actorName: { type: String, default: '' },
    actorRole: { type: String, default: '' },
    summary: { type: String, required: true },
    previousValues: { type: mongoose.Schema.Types.Mixed, default: null },
    newValues: { type: mongoose.Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema, 'auditlogs');

