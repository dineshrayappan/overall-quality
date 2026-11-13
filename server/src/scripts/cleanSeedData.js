import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { Counter } from '../models/Counter.js';
import { ApprovalHistory } from '../models/ApprovalHistory.js';
import { InspectionAttachment } from '../models/InspectionAttachment.js';
import { AuditLog } from '../models/AuditLog.js';
import {
  Buyer,
  Supplier,
  Style,
  Fabric,
  Colour,
  Gsm,
  SizeRange,
  Order,
  Department,
  ProductionLine,
  Employee,
  Process,
  Machine,
  Needle,
  Accessory,
  MeasurementSpec,
  InspectionCheckpoint,
} from '../models/masters/index.js';
import { QualitySpecification } from '../models/QualitySpecification.js';
import { TargetChart } from '../models/inspections/TargetChart.js';
import { SizeSetInspection } from '../models/inspections/SizeSetInspection.js';
import { SevenPointInspection } from '../models/inspections/SevenPointInspection.js';
import { MeasurementInspection } from '../models/inspections/MeasurementInspection.js';
import { ShrinkageInspection } from '../models/inspections/ShrinkageInspection.js';
import { FourPointInspection } from '../models/inspections/FourPointInspection.js';
import { AccessoriesInspection } from '../models/inspections/AccessoriesInspection.js';

export async function cleanSeedData({ includeMasterData = false } = {}) {
  await connectDB(env.mongoUri);
  console.log('Connected to MongoDB for data cleanup...');
  console.log(`Mode: ${includeMasterData ? 'FULL CLEAN (Inspections + Demo Master Data)' : 'INSPECTIONS CLEAN (Reports & Logs Only)'}`);
  console.log('Preserving: User accounts (admin, qam, supervisor1, qc1), Role Permissions, Company Settings, Inspection Configs.');

  // Always delete all inspection reports and test history
  const inspectionDeletions = await Promise.all([
    TargetChart.deleteMany({}),
    SizeSetInspection.deleteMany({}),
    SevenPointInspection.deleteMany({}),
    MeasurementInspection.deleteMany({}),
    ShrinkageInspection.deleteMany({}),
    FourPointInspection.deleteMany({}),
    AccessoriesInspection.deleteMany({}),
    ApprovalHistory.deleteMany({}),
    InspectionAttachment.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);

  console.log('Cleared all inspection reports, approval history, audit logs, and attachments.');

  if (includeMasterData) {
    await Promise.all([
      Order.deleteMany({}),
      Style.deleteMany({}),
      Buyer.deleteMany({}),
      Supplier.deleteMany({}),
      Fabric.deleteMany({}),
      Colour.deleteMany({}),
      Gsm.deleteMany({}),
      SizeRange.deleteMany({}),
      Department.deleteMany({}),
      ProductionLine.deleteMany({}),
      Employee.deleteMany({}),
      Process.deleteMany({}),
      Machine.deleteMany({}),
      Needle.deleteMany({}),
      Accessory.deleteMany({}),
      MeasurementSpec.deleteMany({}),
      QualitySpecification.deleteMany({}),
      InspectionCheckpoint.deleteMany({}),
      Counter.deleteMany({}),
    ]);
    console.log('Cleared all demo master data records (Orders, Styles, Buyers, Fabrics, Lines, etc.).');
  } else {
    // Reset report numbering counters so new reports start at 00001
    await Counter.deleteMany({
      prefix: { $in: ['TC', 'SS', '7P', 'MS', 'QF29', 'QF30', 'QAD5'] },
    });
    console.log('Reset report counters (TC, SS, 7P, MS, QF29, QF30, QAD5).');
  }

  console.log('Cleanup completed successfully. Login accounts and system configuration remain intact.');
  await disconnectDB();
}

if (process.argv[1]?.endsWith('cleanSeedData.js')) {
  const includeMasterData = process.argv.includes('--all') || process.argv.includes('--include-master');
  cleanSeedData({ includeMasterData }).catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });
}

