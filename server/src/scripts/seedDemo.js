import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { CompanySetting } from '../models/CompanySetting.js';
import { Counter } from '../models/Counter.js';
import { User } from '../models/User.js';
import { RolePermission } from '../models/RolePermission.js';
import { InspectionConfig } from '../models/InspectionConfig.js';
import { ApprovalHistory } from '../models/ApprovalHistory.js';
import { InspectionAttachment } from '../models/InspectionAttachment.js';
import { AuditLog } from '../models/AuditLog.js';
import {
  Buyer,
  Colour,
  Department,
  Employee,
  Fabric,
  Gsm,
  InspectionCheckpoint,
  Machine,
  MeasurementSpec,
  Needle,
  Order,
  Process,
  ProductionLine,
  SizeRange,
  Style,
  Supplier,
} from '../models/masters/index.js';
import { TargetChart } from '../models/inspections/TargetChart.js';
import { SizeSetInspection } from '../models/inspections/SizeSetInspection.js';
import { SevenPointInspection } from '../models/inspections/SevenPointInspection.js';
import { MeasurementInspection } from '../models/inspections/MeasurementInspection.js';
import { bootstrapSystemConfig } from '../services/bootstrapService.js';
import {
  calculateMeasurementRows,
  calculateSevenPoint,
  calculateSizeSet,
  calculateTargetChart,
} from '../services/calculationService.js';
import { nextMasterCode, nextReportNumber } from '../utils/counter.js';

const RESET_FLAG = process.argv.includes('--reset');

function daysAgo(days, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 15, 0, 0);
  return d;
}

/**
 * Generates a valid 48x48 PNG swatch image programmatically (using zlib, no external deps)
 * so demo defect photo thumbnails and PDF embeddings work offline without external URLs.
 */
function createSampleDefectPng(r = 195, g = 55, b = 55) {
  const width = 48;
  const height = 48;
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      const border = x < 3 || y < 3 || x >= width - 3 || y >= height - 3;
      const cross = Math.abs(x - y) < 3 || Math.abs(x + y - (width - 1)) < 3;
      if (border) {
        raw[px] = 30;
        raw[px + 1] = 41;
        raw[px + 2] = 59;
      } else if (cross) {
        raw[px] = r;
        raw[px + 1] = g;
        raw[px + 2] = b;
      } else {
        raw[px] = 241;
        raw[px + 1] = 245;
        raw[px + 2] = 249;
      }
      raw[px + 3] = 255;
    }
  }

  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

async function upsertMaster(Model, prefix, filter, fields, userId) {
  const existing = await Model.findOne(filter);
  if (existing) {
    Object.assign(existing, fields, { isActive: true, updatedBy: userId });
    await existing.save();
    return existing;
  }
  const code = await nextMasterCode(prefix);
  return Model.create({
    ...fields,
    code,
    isActive: true,
    createdBy: userId,
    updatedBy: userId,
  });
}

async function upsertUser({ username, fullName, email, passwordHash, role, assignedLines = [], departmentId = null, employeeId = null }) {
  const existing = await User.findOne({ username });
  if (existing) return existing;
  return User.create({
    username,
    fullName,
    email,
    passwordHash,
    role,
    assignedLines,
    departmentId,
    employeeId,
    isActive: true,
  });
}

async function seedDemo() {
  await connectDB(env.mongoUri);

  if (RESET_FLAG) {
    console.log('Resetting database collections for clean demo seed...');
    await Promise.all([
      User.deleteMany({}),
      RolePermission.deleteMany({}),
      CompanySetting.deleteMany({}),
      InspectionConfig.deleteMany({}),
      Counter.deleteMany({}),
      ApprovalHistory.deleteMany({}),
      InspectionAttachment.deleteMany({}),
      AuditLog.deleteMany({}),
      Buyer.deleteMany({}),
      Supplier.deleteMany({}),
      Style.deleteMany({}),
      Fabric.deleteMany({}),
      Colour.deleteMany({}),
      Gsm.deleteMany({}),
      SizeRange.deleteMany({}),
      Order.deleteMany({}),
      Department.deleteMany({}),
      ProductionLine.deleteMany({}),
      Employee.deleteMany({}),
      Process.deleteMany({}),
      Machine.deleteMany({}),
      Needle.deleteMany({}),
      MeasurementSpec.deleteMany({}),
      InspectionCheckpoint.deleteMany({}),
      TargetChart.deleteMany({}),
      SizeSetInspection.deleteMany({}),
      SevenPointInspection.deleteMany({}),
      MeasurementInspection.deleteMany({}),
    ]);
  }

  await bootstrapSystemConfig();

  await CompanySetting.findOneAndUpdate(
    { key: 'default' },
    { $set: { companyName: 'Meridian Apparel Quality Control' } },
    { upsert: true }
  );

  const demoPasswordHash = await bcrypt.hash('Demo@1234', 10);

  // 1. Seed initial Admin first so audit/createdBy references resolve cleanly
  const adminUser = await upsertUser({
    username: 'admin',
    fullName: 'Farhan Siddiqui (Admin)',
    email: 'admin@meridianqms.demo',
    passwordHash: demoPasswordHash,
    role: 'Admin',
  });

  // 2. Seed all 16 Master Data collections
  const buyerNordic = await upsertMaster(
    Buyer,
    'BUY',
    { name: 'Nordic Casuals AB' },
    {
      name: 'Nordic Casuals AB',
      contactPerson: 'Soren Lindqvist',
      email: 'qa@nordiccasuals.demo',
      phone: '+46-8-555-0142',
      country: 'Sweden',
      address: 'Sveavagen 44, Stockholm',
    },
    adminUser._id
  );
  const buyerAtlas = await upsertMaster(
    Buyer,
    'BUY',
    { name: 'Atlas Retail UK' },
    {
      name: 'Atlas Retail UK',
      contactPerson: 'Claire Bennett',
      email: 'sourcing@atlasretail.demo',
      phone: '+44-20-7946-0921',
      country: 'United Kingdom',
      address: '21 King Street, Manchester',
    },
    adminUser._id
  );
  const buyerPacific = await upsertMaster(
    Buyer,
    'BUY',
    { name: 'Pacific Apparel Inc.' },
    {
      name: 'Pacific Apparel Inc.',
      contactPerson: 'Daniel Park',
      email: 'compliance@pacificapparel.demo',
      phone: '+1-213-555-0188',
      country: 'United States',
      address: '740 S Los Angeles St, Los Angeles',
    },
    adminUser._id
  );

  const supApex = await upsertMaster(
    Supplier,
    'SUP',
    { name: 'Apex Knitwear Mills' },
    {
      name: 'Apex Knitwear Mills',
      contactPerson: 'Tariq Mahmood',
      email: 'dispatch@apexmills.demo',
      phone: '+92-42-555-0190',
      factoryLocation: 'Industrial Estate Sector C',
      address: 'Plot 14, Industrial Estate',
    },
    adminUser._id
  );
  const supCrescent = await upsertMaster(
    Supplier,
    'SUP',
    { name: 'Crescent Dyeing & Finishing' },
    {
      name: 'Crescent Dyeing & Finishing',
      contactPerson: 'Nadia Qureshi',
      email: 'lab@crescentdye.demo',
      phone: '+92-41-555-0115',
      factoryLocation: 'Textile Park Phase II',
      address: 'Mill Road Unit 8',
    },
    adminUser._id
  );
  const supVanguard = await upsertMaster(
    Supplier,
    'SUP',
    { name: 'Vanguard Trim & Thread' },
    {
      name: 'Vanguard Trim & Thread',
      contactPerson: 'Kamran Raza',
      email: 'sales@vanguardtrims.demo',
      phone: '+92-21-555-0166',
      factoryLocation: 'SITE Export Zone',
      address: 'Block B-9',
    },
    adminUser._id
  );

  const deptSewing = await upsertMaster(
    Department,
    'DEP',
    { name: 'Sewing Floor 1' },
    { name: 'Sewing Floor 1', description: 'Primary knit & woven assembly lines' },
    adminUser._id
  );
  const deptFinishing = await upsertMaster(
    Department,
    'DEP',
    { name: 'Finishing & Packing' },
    { name: 'Finishing & Packing', description: 'Ironing, metal detection, folding & carton packing' },
    adminUser._id
  );
  const deptQA = await upsertMaster(
    Department,
    'DEP',
    { name: 'Quality Assurance' },
    { name: 'Quality Assurance', description: 'In-line, mid-line, size set & measurement audits' },
    adminUser._id
  );

  const lineA = await upsertMaster(
    ProductionLine,
    'LIN',
    { name: 'Line A - Polo & Knitwear' },
    { name: 'Line A - Polo & Knitwear', floor: 'Floor 1', departmentId: deptSewing._id, capacity: 1200 },
    adminUser._id
  );
  const lineB = await upsertMaster(
    ProductionLine,
    'LIN',
    { name: 'Line B - Casual Tees' },
    { name: 'Line B - Casual Tees', floor: 'Floor 1', departmentId: deptSewing._id, capacity: 1500 },
    adminUser._id
  );
  const lineC = await upsertMaster(
    ProductionLine,
    'LIN',
    { name: 'Line C - Woven & Outerwear' },
    { name: 'Line C - Woven & Outerwear', floor: 'Floor 2', departmentId: deptSewing._id, capacity: 900 },
    adminUser._id
  );

  const qamUser = await upsertUser({
    username: 'qam',
    fullName: 'Zainab Malik (QAM)',
    email: 'qam@meridianqms.demo',
    passwordHash: demoPasswordHash,
    role: 'Quality Manager',
    departmentId: deptQA._id,
  });
  const supUser = await upsertUser({
    username: 'supervisor1',
    fullName: 'Imran Yusuf (Supervisor)',
    email: 'supervisor1@meridianqms.demo',
    passwordHash: demoPasswordHash,
    role: 'Supervisor',
    assignedLines: [lineA._id, lineB._id],
    departmentId: deptSewing._id,
  });
  const qcUser = await upsertUser({
    username: 'qc1',
    fullName: 'Hina Saeed (QC)',
    email: 'qc1@meridianqms.demo',
    passwordHash: demoPasswordHash,
    role: 'QC Inspector',
    assignedLines: [lineA._id, lineB._id, lineC._id],
    departmentId: deptQA._id,
  });

  await ProductionLine.updateOne({ _id: lineA._id }, { $set: { supervisorId: supUser._id } });

  const fabPique = await upsertMaster(
    Fabric,
    'FAB',
    { name: '100% Combed Cotton Pique' },
    { name: '100% Combed Cotton Pique', composition: '100% Cotton', construction: 'Lacoste Pique', width: '60"' },
    adminUser._id
  );
  const fabJersey = await upsertMaster(
    Fabric,
    'FAB',
    { name: 'Cotton-Elastane Single Jersey' },
    { name: 'Cotton-Elastane Single Jersey', composition: '95% Cotton / 5% Elastane', construction: 'Single Jersey', width: '64"' },
    adminUser._id
  );
  const fabTwill = await upsertMaster(
    Fabric,
    'FAB',
    { name: 'Twill Peach Finish 2/1' },
    { name: 'Twill Peach Finish 2/1', composition: '100% Ring-Spun Cotton', construction: '2/1 Twill', width: '58"' },
    adminUser._id
  );

  const colNavy = await upsertMaster(
    Colour,
    'COL',
    { name: 'Midnight Navy' },
    { name: 'Midnight Navy', pantoneCode: '19-4024 TCX', hexCode: '#172554' },
    adminUser._id
  );
  const colCharcoal = await upsertMaster(
    Colour,
    'COL',
    { name: 'Heather Charcoal' },
    { name: 'Heather Charcoal', pantoneCode: '18-0201 TCX', hexCode: '#475569' },
    adminUser._id
  );
  const colCrimson = await upsertMaster(
    Colour,
    'COL',
    { name: 'Crimson Red' },
    { name: 'Crimson Red', pantoneCode: '19-1763 TCX', hexCode: '#b91c1c' },
    adminUser._id
  );
  await upsertMaster(
    Colour,
    'COL',
    { name: 'Optic White' },
    { name: 'Optic White', pantoneCode: '11-0601 TCX', hexCode: '#f8fafc' },
    adminUser._id
  );

  const gsm180 = await upsertMaster(Gsm, 'GSM', { value: 180 }, { value: 180, name: '180 GSM', description: 'Lightweight summer jersey' }, adminUser._id);
  const gsm220 = await upsertMaster(Gsm, 'GSM', { value: 220 }, { value: 220, name: '220 GSM', description: 'Medium weight pique polo fabric' }, adminUser._id);
  const gsm260 = await upsertMaster(Gsm, 'GSM', { value: 260 }, { value: 260, name: '260 GSM', description: 'Heavy woven twill' }, adminUser._id);

  const sizeSXL = await upsertMaster(SizeRange, 'SIZ', { name: 'S-XL' }, { name: 'S-XL', sizes: ['S', 'M', 'L', 'XL'] }, adminUser._id);
  const sizeXSXXL = await upsertMaster(SizeRange, 'SIZ', { name: 'XS-XXL' }, { name: 'XS-XXL', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] }, adminUser._id);
  const sizeWoven = await upsertMaster(SizeRange, 'SIZ', { name: '30-36' }, { name: '30-36', sizes: ['30', '32', '34', '36'] }, adminUser._id);

  const stylePolo = await upsertMaster(
    Style,
    'STY',
    { styleNumber: 'NW-2040' },
    {
      styleNumber: 'NW-2040',
      name: 'Essential Pique Polo',
      description: '2-button placket pique polo with rib collar & cuff',
      buyerId: buyerNordic._id,
      season: 'SS26',
      category: 'Knit Polo',
    },
    adminUser._id
  );
  const styleTee = await upsertMaster(
    Style,
    'STY',
    { styleNumber: 'AT-1180' },
    {
      styleNumber: 'AT-1180',
      name: 'Crew Neck Slub Tee',
      description: 'Short sleeve crew neck tee with neck tape',
      buyerId: buyerAtlas._id,
      season: 'SS26',
      category: 'T-Shirt',
    },
    adminUser._id
  );
  const styleShirt = await upsertMaster(
    Style,
    'STY',
    { styleNumber: 'PA-3095' },
    {
      styleNumber: 'PA-3095',
      name: 'Utility Overshirt',
      description: 'Twin chest flap pocket woven utility overshirt',
      buyerId: buyerPacific._id,
      season: 'AW26',
      category: 'Woven Shirt',
    },
    adminUser._id
  );

  const order101 = await upsertMaster(
    Order,
    'ORD',
    { orderNumber: 'PO-2026-101' },
    {
      orderNumber: 'PO-2026-101',
      buyerId: buyerNordic._id,
      styleId: stylePolo._id,
      styleDescription: stylePolo.description,
      orderQuantity: 5000,
      fabricId: fabPique._id,
      gsmId: gsm220._id,
      colourId: colNavy._id,
      supplierId: supApex._id,
      sizeRangeId: sizeSXL._id,
      deliveryDate: daysAgo(-20),
      status: 'In Production',
    },
    adminUser._id
  );
  const order102 = await upsertMaster(
    Order,
    'ORD',
    { orderNumber: 'PO-2026-102' },
    {
      orderNumber: 'PO-2026-102',
      buyerId: buyerAtlas._id,
      styleId: styleTee._id,
      styleDescription: styleTee.description,
      orderQuantity: 8500,
      fabricId: fabJersey._id,
      gsmId: gsm180._id,
      colourId: colCharcoal._id,
      supplierId: supCrescent._id,
      sizeRangeId: sizeXSXXL._id,
      deliveryDate: daysAgo(-32),
      status: 'In Production',
    },
    adminUser._id
  );
  const order103 = await upsertMaster(
    Order,
    'ORD',
    { orderNumber: 'PO-2026-103' },
    {
      orderNumber: 'PO-2026-103',
      buyerId: buyerPacific._id,
      styleId: styleShirt._id,
      styleDescription: styleShirt.description,
      orderQuantity: 3200,
      fabricId: fabTwill._id,
      gsmId: gsm260._id,
      colourId: colCrimson._id,
      supplierId: supVanguard._id,
      sizeRangeId: sizeWoven._id,
      deliveryDate: daysAgo(-45),
      status: 'Open',
    },
    adminUser._id
  );

  const empRaza = await upsertMaster(
    Employee,
    'EMP',
    { employeeCode: 'EMP-101' },
    { employeeCode: 'EMP-101', name: 'Raza Khan', departmentId: deptSewing._id, productionLineId: lineA._id, designation: 'Senior Operator' },
    adminUser._id
  );
  const empAyesha = await upsertMaster(
    Employee,
    'EMP',
    { employeeCode: 'EMP-102' },
    { employeeCode: 'EMP-102', name: 'Ayesha Bibi', departmentId: deptSewing._id, productionLineId: lineA._id, designation: 'Placket Operator' },
    adminUser._id
  );
  const empKamran = await upsertMaster(
    Employee,
    'EMP',
    { employeeCode: 'EMP-103' },
    { employeeCode: 'EMP-103', name: 'Kamran Ali', departmentId: deptSewing._id, productionLineId: lineB._id, designation: 'Overlock Operator' },
    adminUser._id
  );
  const empSadia = await upsertMaster(
    Employee,
    'EMP',
    { employeeCode: 'EMP-201' },
    { employeeCode: 'EMP-201', name: 'Sadia Tariq', departmentId: deptFinishing._id, productionLineId: lineB._id, designation: 'Hemming Operator' },
    adminUser._id
  );
  const empBilal = await upsertMaster(
    Employee,
    'EMP',
    { employeeCode: 'EMP-301' },
    { employeeCode: 'EMP-301', name: 'Bilal Ahmed', departmentId: deptSewing._id, productionLineId: lineC._id, designation: 'Single Needle Operator' },
    adminUser._id
  );

  const procCollar = await upsertMaster(Process, 'PRC', { name: 'Collar Attach' }, { name: 'Collar Attach', departmentId: deptSewing._id, description: 'Attach rib collar cleanly without puckering' }, adminUser._id);
  const procPlacket = await upsertMaster(Process, 'PRC', { name: 'Placket Lockstitch' }, { name: 'Placket Lockstitch', departmentId: deptSewing._id, description: 'Front box placket topstitching' }, adminUser._id);
  const procOverlock = await upsertMaster(Process, 'PRC', { name: 'Side Seam Overlock' }, { name: 'Side Seam Overlock', departmentId: deptSewing._id, description: '4-thread side seam safety stitch' }, adminUser._id);
  const procHem = await upsertMaster(Process, 'PRC', { name: 'Sleeve & Bottom Hem' }, { name: 'Sleeve & Bottom Hem', departmentId: deptSewing._id, description: 'Double needle coverstitch hem' }, adminUser._id);
  const procBartack = await upsertMaster(Process, 'PRC', { name: 'Button & Bartack' }, { name: 'Button & Bartack', departmentId: deptFinishing._id, description: 'Placket bartack and button attach' }, adminUser._id);

  const machSnls = await upsertMaster(Machine, 'MCH', { machineNumber: 'JUKI-SNLS-01' }, { machineNumber: 'JUKI-SNLS-01', name: 'Single Needle Lockstitch', machineType: 'Juki DDL-8700', productionLineId: lineA._id }, adminUser._id);
  const machOl = await upsertMaster(Machine, 'MCH', { machineNumber: 'JUKI-OL4T-04' }, { machineNumber: 'JUKI-OL4T-04', name: '4-Thread Overlock', machineType: 'Juki MO-6714', productionLineId: lineA._id }, adminUser._id);
  const machFl = await upsertMaster(Machine, 'MCH', { machineNumber: 'PEGA-FL-02' }, { machineNumber: 'PEGA-FL-02', name: 'Flatlock Coverstitch', machineType: 'Pegasus W562', productionLineId: lineB._id }, adminUser._id);
  const machBt = await upsertMaster(Machine, 'MCH', { machineNumber: 'BROT-BH-03' }, { machineNumber: 'BROT-BH-03', name: 'Bartack & Buttonhole', machineType: 'Brother KE-430F', productionLineId: lineB._id }, adminUser._id);
  const machTw = await upsertMaster(Machine, 'MCH', { machineNumber: 'SIRUBA-5T-07' }, { machineNumber: 'SIRUBA-5T-07', name: '5-Thread Safety Stitch', machineType: 'Siruba 757F', productionLineId: lineC._id }, adminUser._id);

  const ndlDb11 = await upsertMaster(Needle, 'NDL', { needleNumber: 'DBx1-11' }, { needleNumber: 'DBx1-11', name: 'Ball Point #11 (Light Knit)', needleType: 'SES Ball Point', size: '75/11' }, adminUser._id);
  const ndlDb14 = await upsertMaster(Needle, 'NDL', { needleNumber: 'DBx1-14' }, { needleNumber: 'DBx1-14', name: 'Medium Sharp #14 (Woven)', needleType: 'Regular Point', size: '90/14' }, adminUser._id);
  const ndlDc11 = await upsertMaster(Needle, 'NDL', { needleNumber: 'DCx27-11' }, { needleNumber: 'DCx27-11', name: 'Overlock #11', needleType: 'Ball Point', size: '75/11' }, adminUser._id);
  const ndlUy12 = await upsertMaster(Needle, 'NDL', { needleNumber: 'UYx128-12' }, { needleNumber: 'UYx128-12', name: 'Flatlock #12', needleType: 'Light Ball Point', size: '80/12' }, adminUser._id);

  const specSeeds = [
    { styleId: stylePolo._id, size: 'S', measurementPoint: 'Chest Width', measurementDescription: '1" below armhole across chest', unit: 'cm', approvedSpec: 49.0, upperTolerance: 0.5, lowerTolerance: -0.5, sortOrder: 1 },
    { styleId: stylePolo._id, size: 'S', measurementPoint: 'Body Length HPS', measurementDescription: 'High point shoulder to bottom hem', unit: 'cm', approvedSpec: 68.5, upperTolerance: 1.0, lowerTolerance: -0.5, sortOrder: 2 },
    { styleId: stylePolo._id, size: 'M', measurementPoint: 'Chest Width', measurementDescription: '1" below armhole across chest', unit: 'cm', approvedSpec: 52.0, upperTolerance: 0.5, lowerTolerance: -0.5, sortOrder: 1 },
    { styleId: stylePolo._id, size: 'M', measurementPoint: 'Body Length HPS', measurementDescription: 'High point shoulder to bottom hem', unit: 'cm', approvedSpec: 71.0, upperTolerance: 1.0, lowerTolerance: -0.5, sortOrder: 2 },
    { styleId: stylePolo._id, size: 'M', measurementPoint: 'Across Shoulder', measurementDescription: 'Shoulder seam to shoulder seam', unit: 'cm', approvedSpec: 44.5, upperTolerance: 0.5, lowerTolerance: -0.3, sortOrder: 3 },
    { styleId: stylePolo._id, size: 'M', measurementPoint: 'Sleeve Length', measurementDescription: 'Shoulder seam to sleeve cuff edge', unit: 'cm', approvedSpec: 22.0, upperTolerance: 0.5, lowerTolerance: -0.5, sortOrder: 4 },
    { styleId: stylePolo._id, size: 'L', measurementPoint: 'Chest Width', measurementDescription: '1" below armhole across chest', unit: 'cm', approvedSpec: 55.0, upperTolerance: 0.8, lowerTolerance: -0.5, sortOrder: 1 },
    { styleId: stylePolo._id, size: 'L', measurementPoint: 'Body Length HPS', measurementDescription: 'High point shoulder to bottom hem', unit: 'cm', approvedSpec: 73.5, upperTolerance: 1.0, lowerTolerance: -0.5, sortOrder: 2 },
    { styleId: styleTee._id, size: 'S', measurementPoint: 'Chest Width', measurementDescription: '1" below armhole across chest', unit: 'cm', approvedSpec: 48.0, upperTolerance: 0.5, lowerTolerance: -0.5, sortOrder: 1 },
    { styleId: styleTee._id, size: 'S', measurementPoint: 'Body Length HPS', measurementDescription: 'High point shoulder to bottom hem', unit: 'cm', approvedSpec: 67.0, upperTolerance: 1.0, lowerTolerance: -0.5, sortOrder: 2 },
    { styleId: styleTee._id, size: 'M', measurementPoint: 'Chest Width', measurementDescription: '1" below armhole across chest', unit: 'cm', approvedSpec: 51.0, upperTolerance: 0.5, lowerTolerance: -0.5, sortOrder: 1 },
    { styleId: styleTee._id, size: 'M', measurementPoint: 'Body Length HPS', measurementDescription: 'High point shoulder to bottom hem', unit: 'cm', approvedSpec: 69.5, upperTolerance: 1.0, lowerTolerance: -0.5, sortOrder: 2 },
    { styleId: styleTee._id, size: 'M', measurementPoint: 'Bottom Hem Opening', measurementDescription: 'Sweep straight across hem', unit: 'cm', approvedSpec: 50.5, upperTolerance: 0.6, lowerTolerance: -0.4, sortOrder: 3 },
    { styleId: styleTee._id, size: 'L', measurementPoint: 'Chest Width', measurementDescription: '1" below armhole across chest', unit: 'cm', approvedSpec: 54.0, upperTolerance: 0.5, lowerTolerance: -0.5, sortOrder: 1 },
    { styleId: styleTee._id, size: 'L', measurementPoint: 'Body Length HPS', measurementDescription: 'High point shoulder to bottom hem', unit: 'cm', approvedSpec: 72.0, upperTolerance: 1.0, lowerTolerance: -0.5, sortOrder: 2 },
    { styleId: styleShirt._id, size: '30', measurementPoint: 'Chest Width', measurementDescription: '1" below armhole across chest', unit: 'cm', approvedSpec: 50.0, upperTolerance: 0.5, lowerTolerance: -0.5, sortOrder: 1 },
    { styleId: styleShirt._id, size: '30', measurementPoint: 'Body Length HPS', measurementDescription: 'High point shoulder to bottom hem', unit: 'cm', approvedSpec: 70.0, upperTolerance: 1.0, lowerTolerance: -0.5, sortOrder: 2 },
    { styleId: styleShirt._id, size: '32', measurementPoint: 'Chest Width', measurementDescription: '1" below armhole across chest', unit: 'cm', approvedSpec: 52.0, upperTolerance: 0.5, lowerTolerance: -0.5, sortOrder: 1 },
    { styleId: styleShirt._id, size: '32', measurementPoint: 'Body Length HPS', measurementDescription: 'High point shoulder to bottom hem', unit: 'cm', approvedSpec: 72.0, upperTolerance: 1.0, lowerTolerance: -0.5, sortOrder: 2 },
    { styleId: styleShirt._id, size: '32', measurementPoint: 'Across Shoulder', measurementDescription: 'Shoulder seam to shoulder seam', unit: 'cm', approvedSpec: 45.0, upperTolerance: 0.5, lowerTolerance: -0.3, sortOrder: 3 },
    { styleId: styleShirt._id, size: '32', measurementPoint: 'Sleeve Length', measurementDescription: 'Shoulder seam to cuff edge', unit: 'cm', approvedSpec: 62.0, upperTolerance: 0.5, lowerTolerance: -0.5, sortOrder: 4 },
    { styleId: styleShirt._id, size: '34', measurementPoint: 'Chest Width', measurementDescription: '1" below armhole across chest', unit: 'cm', approvedSpec: 54.0, upperTolerance: 0.5, lowerTolerance: -0.5, sortOrder: 1 },
    { styleId: styleShirt._id, size: '34', measurementPoint: 'Body Length HPS', measurementDescription: 'High point shoulder to bottom hem', unit: 'cm', approvedSpec: 74.0, upperTolerance: 1.0, lowerTolerance: -0.5, sortOrder: 2 },
    { styleId: styleShirt._id, size: '36', measurementPoint: 'Chest Width', measurementDescription: '1" below armhole across chest', unit: 'cm', approvedSpec: 56.5, upperTolerance: 0.8, lowerTolerance: -0.5, sortOrder: 1 },
    { styleId: styleShirt._id, size: '36', measurementPoint: 'Body Length HPS', measurementDescription: 'High point shoulder to bottom hem', unit: 'cm', approvedSpec: 76.0, upperTolerance: 1.0, lowerTolerance: -0.5, sortOrder: 2 },
  ];

  const specDocs = [];
  for (const s of specSeeds) {
    specDocs.push(
      await upsertMaster(
        MeasurementSpec,
        'MSP',
        { styleId: s.styleId, size: s.size, measurementPoint: s.measurementPoint, isActive: true },
        s,
        adminUser._id
      )
    );
  }

  for (let i = 1; i <= 10; i++) {
    await upsertMaster(
      InspectionCheckpoint,
      'CHK',
      { module: 'seven_point', section: '7 Point Inspection', checkpointNumber: i },
      {
        module: 'seven_point',
        section: '7 Point Inspection',
        checkpointNumber: i,
        name: `Checkpoint ${i}`,
        description: `Standard inline quality checkpoint column ${i}`,
        isCritical: i <= 3,
        sortOrder: i,
      },
      adminUser._id
    );
  }

  // 3. Create sample defect image attachment (real PNG stored in uploadDir)
  let defectAttachment = await InspectionAttachment.findOne({ storedName: 'demo-stitch-defect.png' });
  if (!defectAttachment) {
    const relDir = path.join('inspections', 'demo');
    const absDir = path.join(env.uploadDir, relDir);
    fs.mkdirSync(absDir, { recursive: true });
    const absFile = path.join(absDir, 'demo-stitch-defect.png');
    const pngBuf = createSampleDefectPng();
    fs.writeFileSync(absFile, pngBuf);
    defectAttachment = await InspectionAttachment.create({
      originalName: 'collar-placket-defect-sample.png',
      storedName: 'demo-stitch-defect.png',
      relativePath: path.posix.join('inspections', 'demo', 'demo-stitch-defect.png'),
      mimeType: 'image/png',
      sizeBytes: pngBuf.length,
      module: 'size_set',
      itemKey: 'wrk_stitching',
      uploadedBy: qcUser._id,
      uploadedByName: qcUser.fullName,
    });
  }

  const [tcCfgDoc, ssCfgDoc, spCfgDoc] = await Promise.all([
    InspectionConfig.findOne({ module: 'target_chart' }).lean(),
    InspectionConfig.findOne({ module: 'size_set' }).lean(),
    InspectionConfig.findOne({ module: 'seven_point' }).lean(),
  ]);
  const tcCfg = tcCfgDoc?.config || {};
  const ssCfg = ssCfgDoc?.config || {};
  const spCfg = spCfgDoc?.config || {};

  // Helper to seed audit + approval entries cleanly per report
  async function logReportWorkflow(inspectionType, doc, stages = []) {
    await AuditLog.create({
      entityType: inspectionType,
      entityId: doc._id,
      entityIdentifier: doc.reportNumber,
      action: 'CREATE',
      actorId: doc.inspectorId,
      actorUsername: qcUser.username,
      actorName: doc.inspectorName,
      actorRole: 'QC Inspector',
      summary: `Seeded demo ${inspectionType} report ${doc.reportNumber}`,
      timestamp: doc.submittedAt || doc.inspectionDate,
    });
    for (const st of stages) {
      await ApprovalHistory.create({
        inspectionType,
        inspectionId: doc._id,
        reportNumber: doc.reportNumber,
        stage: st.stage,
        action: st.action,
        decision: st.decision || '',
        approverId: st.user._id,
        approverName: st.user.fullName,
        approverRole: st.user.role,
        timestamp: st.at,
        comments: st.comments || '',
      });
    }
  }

  // 4. Module 1: Target Charts (4 reports across lines & days)
  const tcTemplates = [
    {
      token: 'demo-tc-lineA-d4',
      line: lineA,
      days: 4,
      shift: 'Day Shift',
      status: 'Approved',
      actualPattern: (i) => (i < 9 ? 100 : i < 13 ? 82 : 60),
      remarks: 'Strong collar & placket output; slight bottleneck on button attach.',
    },
    {
      token: 'demo-tc-lineB-d3',
      line: lineB,
      days: 3,
      shift: 'Day Shift',
      status: 'Approved',
      actualPattern: (i) => (i < 11 ? 104 : i < 14 ? 78 : 55),
      remarks: 'Line B met daily efficiency target across jersey styles.',
    },
    {
      token: 'demo-tc-lineC-d1',
      line: lineC,
      days: 1,
      shift: 'General',
      status: 'Pending Approval',
      actualPattern: (i) => (i < 5 ? 95 : i < 10 ? 72 : 42),
      remarks: 'Style changeover reduced early-shift indicators below 50%.',
    },
    {
      token: 'demo-tc-lineA-d0',
      line: lineA,
      days: 0,
      shift: 'Day Shift',
      status: 'Approved',
      actualPattern: (i) => (i < 10 ? 100 : i < 14 ? 85 : 70),
      remarks: 'Inline balance stabilized after needle gauge check.',
    },
  ];

  for (const t of tcTemplates) {
    if (await TargetChart.findOne({ submissionToken: t.token })) continue;
    const baseInds = tcCfg.indicators || [];
    const rawInds = Array.from({ length: 15 }, (_, idx) => ({
      index: idx + 1,
      code: baseInds[idx]?.code || `IND-${String(idx + 1).padStart(2, '0')}`,
      name: baseInds[idx]?.name || `Target Indicator ${idx + 1}`,
      unit: baseInds[idx]?.unit || 'pcs',
      isActive: true,
      targetValue: 100,
      actualValue: t.actualPattern(idx),
      remarks: t.actualPattern(idx) < 75 ? 'Monitor hourly inline balance' : '',
    }));
    const calc = calculateTargetChart(rawInds);
    const reportNumber = await nextReportNumber('TC');
    const date = daysAgo(t.days, 11);
    const doc = await TargetChart.create({
      reportNumber,
      inspectionType: 'target_chart',
      submissionToken: t.token,
      inspectionDate: date,
      inspectorId: qcUser._id,
      inspectorName: qcUser.fullName,
      productionLineId: t.line._id,
      productionLineName: t.line.name,
      shift: t.shift,
      indicators: calc.indicators,
      summary: calc.summary,
      approvalStatus: t.status,
      submittedAt: date,
      submittedBy: qcUser._id,
      finalizedAt: t.status === 'Approved' ? date : null,
      finalizedBy: t.status === 'Approved' ? qamUser._id : null,
      remarks: t.remarks,
      createdBy: qcUser._id,
      updatedBy: qamUser._id,
    });
    await logReportWorkflow('target_chart', doc, [
      { stage: 'Submission', action: 'Submitted', user: qcUser, at: date, comments: 'Target chart logged' },
      ...(t.status === 'Approved'
        ? [{ stage: 'Final Approval', action: 'Approved', user: qamUser, at: date, comments: 'Verified against floor board.' }]
        : []),
    ]);
  }

  // 5. Module 2: Size Set / Pilot Run / In-line / Mid-line (4 reports)
  function buildChecklist(defs = [], notOkKeys = [], naKeys = [], defectImgId = null) {
    return defs
      .filter((d) => d.isActive !== false)
      .map((d) => {
        const isNa = naKeys.includes(d.itemKey);
        const isNotOk = notOkKeys.includes(d.itemKey);
        return {
          itemKey: d.itemKey,
          label: d.label,
          isCritical: Boolean(d.isCritical),
          status: isNa ? 'N/A' : isNotOk ? 'Not OK' : 'OK',
          remarks: isNotOk ? 'Thread tension / finishing variance observed; rework advised.' : isNa ? 'Not applicable for this style' : '',
          attachmentIds: isNotOk && defectImgId ? [defectImgId] : [],
        };
      });
  }

  const ssTemplates = [
    {
      token: 'demo-ss-polo-sizeset',
      stage: 'Size Set',
      order: order101,
      buyer: buyerNordic,
      style: stylePolo,
      supplier: supApex,
      fabric: fabPique,
      gsm: gsm220,
      colour: colNavy,
      sizeRange: sizeSXL,
      line: lineA,
      days: 5,
      notOk: [],
      na: ['acc_zipper', 'acc_buckle', 'acc_hook', 'wrk_embroidery'],
      approvalStatus: 'Approved',
      finalDecision: 'Accepted',
      ppsTopStatus: 'Approved',
      productionStatus: 'Cleared for Bulk',
      comments: 'All size set samples S-XL approved cleanly prior to cutting bulk.',
    },
    {
      token: 'demo-ss-tee-pilot',
      stage: 'Pilot Run',
      order: order102,
      buyer: buyerAtlas,
      style: styleTee,
      supplier: supCrescent,
      fabric: fabJersey,
      gsm: gsm180,
      colour: colCharcoal,
      sizeRange: sizeXSXXL,
      line: lineB,
      days: 3,
      notOk: [],
      na: ['acc_button', 'acc_zipper', 'acc_snaps', 'acc_hook', 'acc_buckle'],
      approvalStatus: 'Approved',
      finalDecision: 'Accepted',
      ppsTopStatus: 'TOP Approved',
      productionStatus: 'In Bulk Running',
      comments: 'Pilot run 50 pcs verified; shrinkage and neck binding stable.',
    },
    {
      token: 'demo-ss-polo-inline',
      stage: 'In-line',
      order: order101,
      buyer: buyerNordic,
      style: stylePolo,
      supplier: supApex,
      fabric: fabPique,
      gsm: gsm220,
      colour: colNavy,
      sizeRange: sizeSXL,
      line: lineA,
      days: 1,
      notOk: ['wrk_stitching', 'acc_button'],
      na: ['acc_zipper', 'acc_buckle'],
      approvalStatus: 'Pending Approval',
      finalDecision: 'Rework',
      ppsTopStatus: 'Approved',
      productionStatus: 'Hold Pending Placket Rework',
      comments: 'Attached sample defect image for placket stitching & loose button shank.',
      attachDefect: true,
    },
    {
      token: 'demo-ss-shirt-midline',
      stage: 'Mid-line',
      order: order103,
      buyer: buyerPacific,
      style: styleShirt,
      supplier: supVanguard,
      fabric: fabTwill,
      gsm: gsm260,
      colour: colCrimson,
      sizeRange: sizeWoven,
      line: lineC,
      days: 0,
      notOk: ['wrk_iron'],
      na: ['acc_zipper'],
      approvalStatus: 'Draft',
      finalDecision: 'Pending',
      ppsTopStatus: 'Pending TOP',
      productionStatus: 'Mid-line Check In Progress',
      comments: 'Draft mid-line report pending final carton & strapping check.',
      attachDefect: true,
    },
  ];

  for (const s of ssTemplates) {
    if (await SizeSetInspection.findOne({ submissionToken: s.token })) continue;
    const acc = buildChecklist(ssCfg.accessoriesChecklist, s.notOk, s.na, s.attachDefect ? defectAttachment._id : null);
    const wrk = buildChecklist(ssCfg.workmanshipChecklist, s.notOk, s.na, s.attachDefect ? defectAttachment._id : null);
    const lbl = buildChecklist(ssCfg.labellingChecklist, s.notOk, s.na, null);
    const calc = calculateSizeSet({ accessories: acc, workmanship: wrk, labelling: lbl }, ssCfg);
    const reportNumber = await nextReportNumber('SS');
    const date = daysAgo(s.days, 12);

    const doc = await SizeSetInspection.create({
      reportNumber,
      inspectionType: 'size_set',
      submissionToken: s.token,
      inspectionStage: s.stage,
      inspectionDate: date,
      inspectorId: qcUser._id,
      inspectorName: qcUser.fullName,
      orderId: s.order._id,
      buyerId: s.buyer._id,
      styleId: s.style._id,
      supplierId: s.supplier._id,
      fabricId: s.fabric._id,
      gsmId: s.gsm._id,
      colourId: s.colour._id,
      sizeRangeId: s.sizeRange._id,
      productionLineId: s.line._id,
      headerSnapshot: {
        buyerName: s.buyer.name,
        description: s.style.description,
        styleNumber: s.style.styleNumber,
        orderNumber: s.order.orderNumber,
        supplierName: s.supplier.name,
        fabricName: s.fabric.name,
        gsmLabel: s.gsm.name,
        orderQuantity: s.order.orderQuantity,
        colourName: s.colour.name,
        sizeRangeName: s.sizeRange.name,
        productionLineName: s.line.name,
      },
      accessories: acc,
      workmanship: wrk,
      labelling: lbl,
      calculations: calc,
      ppsTopStatus: s.ppsTopStatus,
      productionStatus: s.productionStatus,
      finalDecision: s.finalDecision,
      approvalStatus: s.approvalStatus,
      submittedAt: s.approvalStatus !== 'Draft' ? date : null,
      submittedBy: s.approvalStatus !== 'Draft' ? qcUser._id : null,
      finalizedAt: s.approvalStatus === 'Approved' ? date : null,
      finalizedBy: s.approvalStatus === 'Approved' ? qamUser._id : null,
      comments: s.comments,
      createdBy: qcUser._id,
      updatedBy: qcUser._id,
    });

    if (s.approvalStatus !== 'Draft') {
      await logReportWorkflow('size_set', doc, [
        { stage: 'Submission', action: 'Submitted', user: qcUser, at: date, comments: `${s.stage} report submitted.` },
        ...(s.approvalStatus === 'Approved'
          ? [{ stage: 'Final Approval', action: 'Approved', decision: s.finalDecision, user: qamUser, at: date, comments: s.comments }]
          : []),
      ]);
    }
  }

  // 6. Module 3: 7 Point Inspections (4 reports across days & approval states)
  const spDefs = (spCfg.checkpoints || []).slice(0, Number(spCfg.checkpointCount || 10)).map((c, idx) => ({
    checkpointNumber: c.checkpointNumber || idx + 1,
    label: c.label || `Point ${idx + 1}`,
    description: c.description || '',
  }));

  function buildEntries(rows) {
    return rows.map((r, idx) => ({
      serialNumber: idx + 1,
      employeeId: r.emp._id,
      employeeCode: r.emp.employeeCode,
      employeeName: r.emp.name,
      processId: r.proc._id,
      processName: r.proc.name,
      machineId: r.mach._id,
      machineNumber: r.mach.machineNumber,
      machineName: r.mach.name,
      needleId: r.ndl._id,
      needleNumber: r.ndl.needleNumber,
      needleChangeTime: r.needleChangeTime,
      checkpoints: spDefs.map((d) => {
        const fail = (r.failPoints || []).find((f) => f.num === d.checkpointNumber);
        return {
          checkpointNumber: d.checkpointNumber,
          label: d.label,
          result: fail ? 'Defect' : 'OK',
          status: fail ? 'Fail' : 'Pass',
          defectDetails: fail ? fail.defect : '',
          remarks: fail ? fail.remark : '',
          inspectionTime: fail ? fail.time : '10:30 AM',
        };
      }),
      piecesChecked: r.checked,
      okPieces: r.ok,
      reworkPieces: r.rework,
      rejectedPieces: r.rejected,
      oilDefectCount: r.oil,
    }));
  }

  function makeSpStages(state, date) {
    const base = ['QC', 'Supervisor', 'QAM', 'PM', 'FM'];
    return base.map((st, idx) => {
      let status = 'Pending';
      let actor = null;
      let comment = '';
      if (state === 'Approved') {
        status = 'Approved';
        actor = idx === 0 ? qcUser : idx === 1 ? supUser : qamUser;
        comment = `${st} approved cleanly.`;
      } else if (state === 'Stage3' && idx < 2) {
        status = 'Approved';
        actor = idx === 0 ? qcUser : supUser;
        comment = `${st} verified inline pieces.`;
      } else if (state === 'Returned') {
        if (idx === 0) {
          status = 'Approved';
          actor = qcUser;
          comment = 'QC initial inspection logged.';
        } else if (idx === 1) {
          status = 'Returned for Correction';
          actor = supUser;
          comment = 'Verify needle change timestamp on JUKI-OL4T-04 and re-submit.';
        }
      }
      return {
        stage: st,
        required: true,
        allowedRoles: st === 'QC' ? ['QC Inspector', 'Admin'] : st === 'Supervisor' ? ['Supervisor', 'Admin'] : ['Quality Manager', 'Admin'],
        status,
        actionBy: actor?._id || null,
        actionByName: actor?.fullName || '',
        actionByRole: actor?.role || '',
        actionAt: actor ? date : null,
        comments: comment,
      };
    });
  }

  const spTemplates = [
    {
      token: 'demo-sp-lineA-d5',
      sNo: '7P-001',
      days: 5,
      order: order101,
      buyer: buyerNordic,
      style: stylePolo,
      fabric: fabPique,
      colour: colNavy,
      line: lineA,
      state: 'Approved',
      approvalStatus: 'Approved',
      currentStageIndex: 5,
      remarks: 'Daily inline 7-point audit passed all 5 management sign-offs.',
      rows: [
        { emp: empRaza, proc: procCollar, mach: machSnls, ndl: ndlDb11, needleChangeTime: '08:45 AM', checked: 80, ok: 76, rework: 3, rejected: 1, oil: 1, failPoints: [{ num: 3, defect: 'Skipped stitch at collar point', remark: 'Adjusted feed dog', time: '09:40 AM' }] },
        { emp: empAyesha, proc: procPlacket, mach: machSnls, ndl: ndlDb11, needleChangeTime: '09:10 AM', checked: 70, ok: 68, rework: 2, rejected: 0, oil: 0, failPoints: [{ num: 5, defect: 'Uneven placket bar width', remark: 'Rechecked folder guide', time: '10:15 AM' }] },
      ],
    },
    {
      token: 'demo-sp-lineB-d2',
      sNo: '7P-002',
      days: 2,
      order: order102,
      buyer: buyerAtlas,
      style: styleTee,
      fabric: fabJersey,
      colour: colCharcoal,
      line: lineB,
      state: 'Stage3',
      approvalStatus: 'Pending Approval',
      currentStageIndex: 2,
      remarks: 'Awaiting QAM sign-off after Supervisor clearance.',
      rows: [
        { emp: empKamran, proc: procOverlock, mach: machOl, ndl: ndlDc11, needleChangeTime: '08:30 AM', checked: 100, ok: 95, rework: 4, rejected: 1, oil: 2, failPoints: [{ num: 2, defect: 'Minor oil spot near armhole', remark: 'Wiped & sent to spot cleaning', time: '11:05 AM' }] },
        { emp: empSadia, proc: procHem, mach: machFl, ndl: ndlUy12, needleChangeTime: '09:00 AM', checked: 90, ok: 88, rework: 2, rejected: 0, oil: 0, failPoints: [] },
      ],
    },
    {
      token: 'demo-sp-lineA-d1',
      sNo: '7P-003',
      days: 1,
      order: order101,
      buyer: buyerNordic,
      style: stylePolo,
      fabric: fabPique,
      colour: colNavy,
      line: lineA,
      state: 'Returned',
      approvalStatus: 'Returned for Correction',
      currentStageIndex: 1,
      remarks: 'Returned by floor supervisor to verify machine needle log.',
      rows: [
        { emp: empRaza, proc: procCollar, mach: machOl, ndl: ndlDc11, needleChangeTime: '11:20 AM', checked: 60, ok: 54, rework: 5, rejected: 1, oil: 2, failPoints: [{ num: 4, defect: 'Broken chain stitch', remark: 'Needle tip burred', time: '11:18 AM' }] },
      ],
    },
    {
      token: 'demo-sp-lineC-d0',
      sNo: '7P-004',
      days: 0,
      order: order103,
      buyer: buyerPacific,
      style: styleShirt,
      fabric: fabTwill,
      colour: colCrimson,
      line: lineC,
      state: 'Pending',
      approvalStatus: 'Pending Approval',
      currentStageIndex: 0,
      remarks: 'Morning shift inline inspection awaiting QC stage confirmation.',
      rows: [
        { emp: empBilal, proc: procBartack, mach: machTw, ndl: ndlDb14, needleChangeTime: '08:15 AM', checked: 50, ok: 48, rework: 2, rejected: 0, oil: 0, failPoints: [{ num: 7, defect: 'Bartack thread tail', remark: 'Trimmed cleanly', time: '09:50 AM' }] },
      ],
    },
  ];

  for (const sp of spTemplates) {
    if (await SevenPointInspection.findOne({ submissionToken: sp.token })) continue;
    const entries = buildEntries(sp.rows);
    const totals = calculateSevenPoint(entries, spCfg);
    const reportNumber = await nextReportNumber('7P');
    const date = daysAgo(sp.days, 14);
    const stages = makeSpStages(sp.state, date);

    const doc = await SevenPointInspection.create({
      reportNumber,
      inspectionType: 'seven_point',
      submissionToken: sp.token,
      sNo: sp.sNo,
      qcUserId: qcUser._id,
      qcName: qcUser.fullName,
      inspectorId: qcUser._id,
      inspectorName: qcUser.fullName,
      inspectionDate: date,
      orderId: sp.order._id,
      buyerId: sp.buyer._id,
      styleId: sp.style._id,
      fabricId: sp.fabric._id,
      colourId: sp.colour._id,
      productionLineId: sp.line._id,
      headerSnapshot: {
        styleNumber: sp.style.styleNumber,
        styleName: sp.style.name,
        fabricName: sp.fabric.name,
        colourName: sp.colour.name,
        orderNumber: sp.order.orderNumber,
        buyerName: sp.buyer.name,
        orderQuantity: sp.order.orderQuantity,
        productionLineName: sp.line.name,
      },
      configuredCheckpointCount: spDefs.length,
      checkpointDefinitions: spDefs,
      entries,
      totals,
      workflowStages: stages,
      currentStageIndex: sp.currentStageIndex,
      approvalStatus: sp.approvalStatus,
      submittedAt: date,
      submittedBy: qcUser._id,
      finalizedAt: sp.approvalStatus === 'Approved' ? date : null,
      finalizedBy: sp.approvalStatus === 'Approved' ? qamUser._id : null,
      remarks: sp.remarks,
      createdBy: qcUser._id,
      updatedBy: qcUser._id,
    });

    await logReportWorkflow('seven_point', doc, [
      { stage: 'Submission', action: 'Submitted', user: qcUser, at: date, comments: '7 Point inline report submitted' },
      ...stages
        .filter((st) => st.status !== 'Pending')
        .map((st) => ({
          stage: st.stage,
          action: st.status,
          user: st.status === 'Approved' ? (st.stage === 'QC' ? qcUser : st.stage === 'Supervisor' ? supUser : qamUser) : supUser,
          at: date,
          comments: st.comments,
        })),
    ]);
  }

  // 7. Module 4: Measurement Inspections (4 reports across styles, stages, tolerances)
  const specMap = new Map(
    specDocs.map((s) => [`${s.styleId.toString()}|${s.size}|${s.measurementPoint}`, s])
  );

  function buildMeasRows(items) {
    const hydrated = items.map((it) => {
      const sp = specMap.get(`${it.styleId.toString()}|${it.size}|${it.point}`);
      return {
        specId: sp?._id || null,
        size: it.size,
        sampleLabel: it.sampleLabel || 'Sample 1',
        measurementPoint: sp?.measurementPoint || it.point,
        measurementDescription: sp?.measurementDescription || '',
        unit: sp?.unit || 'cm',
        approvedSpec: sp ? sp.approvedSpec : it.spec,
        upperTolerance: sp ? sp.upperTolerance : it.up,
        lowerTolerance: sp ? sp.lowerTolerance : it.low,
        actualMeasurement: it.actual,
        remarks: it.remarks || '',
      };
    });
    return calculateMeasurementRows(hydrated);
  }

  function makeMeasStages(state, date) {
    return [
      { stage: 'QC', required: true, allowedRoles: ['QC Inspector', 'Admin'] },
      { stage: 'IC.Q.A.D', required: true, allowedRoles: ['Quality Manager', 'Admin'] },
      { stage: 'Supplier', required: true, allowedRoles: ['Quality Manager', 'Admin'] },
    ].map((st, idx) => {
      if (state === 'Approved') {
        return {
          ...st,
          status: 'Approved',
          actionBy: idx === 0 ? qcUser._id : qamUser._id,
          actionByName: idx === 0 ? qcUser.fullName : qamUser.fullName,
          actionByRole: idx === 0 ? qcUser.role : qamUser.role,
          actionAt: date,
          comments: `${st.stage} measurement sign-off complete.`,
        };
      }
      if (state === 'IC_Wait' && idx === 0) {
        return {
          ...st,
          status: 'Approved',
          actionBy: qcUser._id,
          actionByName: qcUser.fullName,
          actionByRole: qcUser.role,
          actionAt: date,
          comments: 'QC measurements logged cleanly.',
        };
      }
      return { ...st, status: 'Pending', actionBy: null, actionByName: '', actionByRole: '', actionAt: null, comments: '' };
    });
  }

  const measTemplates = [
    {
      token: 'demo-ms-polo-sizeset',
      stage: 'Size Set',
      days: 4,
      order: order101,
      buyer: buyerNordic,
      style: stylePolo,
      supplier: supApex,
      fabric: fabPique,
      gsm: gsm220,
      colour: colNavy,
      line: lineA,
      state: 'Approved',
      approvalStatus: 'Approved',
      currentStageIndex: 3,
      remarks: 'All Size Set specs within tolerance prior to pattern release.',
      specialComments: 'Steamed and conditioned 2 hours before table measurement.',
      rows: [
        { styleId: stylePolo._id, size: 'S', sampleLabel: 'Sample 1', point: 'Chest Width', actual: 49.2 },
        { styleId: stylePolo._id, size: 'S', sampleLabel: 'Sample 1', point: 'Body Length HPS', actual: 68.5 },
        { styleId: stylePolo._id, size: 'M', sampleLabel: 'Sample 1', point: 'Chest Width', actual: 52.3 },
        { styleId: stylePolo._id, size: 'M', sampleLabel: 'Sample 1', point: 'Body Length HPS', actual: 71.4 },
        { styleId: stylePolo._id, size: 'M', sampleLabel: 'Sample 1', point: 'Across Shoulder', actual: 44.3 },
        { styleId: stylePolo._id, size: 'M', sampleLabel: 'Sample 1', point: 'Sleeve Length', actual: 22.2 },
      ],
    },
    {
      token: 'demo-ms-polo-inline-fail',
      stage: 'In-line',
      days: 2,
      order: order101,
      buyer: buyerNordic,
      style: stylePolo,
      supplier: supApex,
      fabric: fabPique,
      gsm: gsm220,
      colour: colNavy,
      line: lineA,
      state: 'IC_Wait',
      approvalStatus: 'Pending Approval',
      currentStageIndex: 1,
      remarks: 'Large size body length exceeded lower tolerance (-0.9 cm vs -0.5 cm limit).',
      specialComments: 'Alerted cutting/sewing supervisor to adjust bottom hem allowance on Size L.',
      rows: [
        { styleId: stylePolo._id, size: 'M', sampleLabel: 'Sample 1', point: 'Chest Width', actual: 52.0 },
        { styleId: stylePolo._id, size: 'M', sampleLabel: 'Sample 2', point: 'Chest Width', actual: 52.4 },
        { styleId: stylePolo._id, size: 'L', sampleLabel: 'Sample 1', point: 'Chest Width', actual: 55.3 },
        { styleId: stylePolo._id, size: 'L', sampleLabel: 'Sample 1', point: 'Body Length HPS', actual: 72.6, remarks: 'Short hem intake' },
      ],
    },
    {
      token: 'demo-ms-tee-midline',
      stage: 'Mid-line',
      days: 1,
      order: order102,
      buyer: buyerAtlas,
      style: styleTee,
      supplier: supCrescent,
      fabric: fabJersey,
      gsm: gsm180,
      colour: colCharcoal,
      line: lineB,
      state: 'Approved',
      approvalStatus: 'Approved',
      currentStageIndex: 3,
      remarks: 'Mid-line pull test & chest/hem dimensions passed across random bundle.',
      specialComments: 'Coverstitch hem stretch recovery within Atlas UK protocol.',
      rows: [
        { styleId: styleTee._id, size: 'M', sampleLabel: 'Sample 1', point: 'Chest Width', actual: 51.2 },
        { styleId: styleTee._id, size: 'M', sampleLabel: 'Sample 2', point: 'Chest Width', actual: 50.8 },
        { styleId: styleTee._id, size: 'M', sampleLabel: 'Sample 1', point: 'Bottom Hem Opening', actual: 50.6 },
      ],
    },
    {
      token: 'demo-ms-polo-final',
      stage: 'Final',
      days: 0,
      order: order101,
      buyer: buyerNordic,
      style: stylePolo,
      supplier: supApex,
      fabric: fabPique,
      gsm: gsm220,
      colour: colNavy,
      line: lineA,
      state: 'Pending',
      approvalStatus: 'Pending Approval',
      currentStageIndex: 0,
      remarks: 'Finished packed garments sampled cleanly across cartons.',
      specialComments: 'Ready for QC & IC.Q.A.D sign-off.',
      rows: [
        { styleId: stylePolo._id, size: 'M', sampleLabel: 'Sample 1', point: 'Chest Width', actual: 52.1 },
        { styleId: stylePolo._id, size: 'M', sampleLabel: 'Sample 1', point: 'Body Length HPS', actual: 71.2 },
        { styleId: stylePolo._id, size: 'M', sampleLabel: 'Sample 1', point: 'Across Shoulder', actual: 44.6 },
      ],
    },
  ];

  for (const m of measTemplates) {
    if (await MeasurementInspection.findOne({ submissionToken: m.token })) continue;
    const calc = buildMeasRows(m.rows);
    const reportNumber = await nextReportNumber('MS');
    const date = daysAgo(m.days, 15);
    const stages = makeMeasStages(m.state, date);
    const selectedSizes = [...new Set(calc.rows.map((r) => r.size))];

    const doc = await MeasurementInspection.create({
      reportNumber,
      inspectionType: 'measurement',
      submissionToken: m.token,
      inspectionStage: m.stage,
      inspectionDate: date,
      inspectorId: qcUser._id,
      inspectorName: qcUser.fullName,
      orderId: m.order._id,
      buyerId: m.buyer._id,
      styleId: m.style._id,
      supplierId: m.supplier._id,
      fabricId: m.fabric._id,
      gsmId: m.gsm._id,
      colourId: m.colour._id,
      productionLineId: m.line._id,
      headerSnapshot: {
        styleNumber: m.style.styleNumber,
        styleDescription: m.style.description,
        fabricName: m.fabric.name,
        gsmLabel: m.gsm.name,
        colourName: m.colour.name,
        orderQuantity: m.order.orderQuantity,
        orderNumber: m.order.orderNumber,
        buyerName: m.buyer.name,
        supplierName: m.supplier.name,
        productionLineName: m.line.name,
      },
      selectedSizes,
      rows: calc.rows,
      summary: calc.summary,
      remarks: m.remarks,
      specialComments: m.specialComments,
      workflowStages: stages,
      currentStageIndex: m.currentStageIndex,
      approvalStatus: m.approvalStatus,
      submittedAt: date,
      submittedBy: qcUser._id,
      finalizedAt: m.approvalStatus === 'Approved' ? date : null,
      finalizedBy: m.approvalStatus === 'Approved' ? qamUser._id : null,
      createdBy: qcUser._id,
      updatedBy: qcUser._id,
    });

    await logReportWorkflow('measurement', doc, [
      { stage: 'Submission', action: 'Submitted', user: qcUser, at: date, comments: `${m.stage} measurement report submitted.` },
      ...stages
        .filter((st) => st.status !== 'Pending')
        .map((st) => ({
          stage: st.stage,
          action: st.status,
          user: st.stage === 'QC' ? qcUser : qamUser,
          at: date,
          comments: st.comments,
        })),
    ]);
  }

  console.log('\nDemo QMS data seeded successfully!\n');
  console.log('Demo Accounts (password for all: Demo@1234):');
  console.log('  - Admin           : admin       / Demo@1234');
  console.log('  - Quality Manager : qam         / Demo@1234');
  console.log('  - Supervisor      : supervisor1 / Demo@1234');
  console.log('  - QC Inspector    : qc1         / Demo@1234\n');

  await disconnectDB();
}

seedDemo().catch(async (err) => {
  console.error('Demo seed failed:', err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
