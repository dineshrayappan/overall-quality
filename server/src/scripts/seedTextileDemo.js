import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { RolePermission } from '../models/RolePermission.js';
import { CompanySetting } from '../models/CompanySetting.js';
import { InspectionConfig } from '../models/InspectionConfig.js';
import { QualitySpecification } from '../models/QualitySpecification.js';
import {
  Buyer,
  Supplier,
  Style,
  Fabric,
  Colour,
  Gsm,
  SizeRange,
  Order,
  Accessory,
} from '../models/masters/index.js';
import { ShrinkageInspection } from '../models/inspections/ShrinkageInspection.js';
import { FourPointInspection } from '../models/inspections/FourPointInspection.js';
import { AccessoriesInspection } from '../models/inspections/AccessoriesInspection.js';
import {
  calculateShrinkageInspection,
  calculateFourPointInspection,
  calculateAccessoriesInspection,
} from '../services/calculationService.js';
import { nextMasterCode, nextReportNumber } from '../utils/counter.js';
import { bootstrapSystemConfig } from '../services/bootstrapService.js';

export async function seedTextileQC() {
  await connectDB(env.mongoUri);
  console.log('Connected to MongoDB for Textile QC seeding...');

  // 1. Ensure Roles & System Config are up to date with new permissions
  await bootstrapSystemConfig();

  // Explicitly ensure role permissions in DB have all new modules
  const allRoles = await RolePermission.find({});
  for (const roleDoc of allRoles) {
    let changed = false;
    const p = roleDoc.permissions || {};

    if (!p.shrinkage) {
      p.shrinkage = {
        view: true,
        create: roleDoc.roleName !== 'Supervisor',
        edit: roleDoc.roleName !== 'Supervisor',
        submit: roleDoc.roleName !== 'Supervisor',
        approve: ['Admin', 'Quality Manager', 'Supervisor'].includes(roleDoc.roleName),
        reject: ['Admin', 'Quality Manager', 'Supervisor'].includes(roleDoc.roleName),
        archive: roleDoc.roleName === 'Admin',
        scopeAllLines: ['Admin', 'Quality Manager'].includes(roleDoc.roleName),
        approvalStages: ['IC LAB', 'IC QAD', 'Received By'],
      };
      changed = true;
    }
    if (!p.fourPoint) {
      p.fourPoint = {
        view: true,
        create: roleDoc.roleName !== 'Supervisor',
        edit: roleDoc.roleName !== 'Supervisor',
        submit: roleDoc.roleName !== 'Supervisor',
        approve: ['Admin', 'Quality Manager', 'Supervisor'].includes(roleDoc.roleName),
        reject: ['Admin', 'Quality Manager', 'Supervisor'].includes(roleDoc.roleName),
        archive: roleDoc.roleName === 'Admin',
        scopeAllLines: ['Admin', 'Quality Manager'].includes(roleDoc.roleName),
        approvalStages: ['Inspector', 'Checker', 'Lab IC'],
      };
      changed = true;
    }
    if (!p.accessories) {
      p.accessories = {
        view: true,
        create: roleDoc.roleName !== 'Supervisor',
        edit: roleDoc.roleName !== 'Supervisor',
        submit: roleDoc.roleName !== 'Supervisor',
        approve: ['Admin', 'Quality Manager', 'Supervisor'].includes(roleDoc.roleName),
        reject: ['Admin', 'Quality Manager', 'Supervisor'].includes(roleDoc.roleName),
        archive: roleDoc.roleName === 'Admin',
        scopeAllLines: ['Admin', 'Quality Manager'].includes(roleDoc.roleName),
        approvalStages: ['Inspected by', 'Verified by', 'Approved by'],
      };
      changed = true;
    }
    if (!p.specifications) {
      p.specifications = {
        view: true,
        create: ['Admin', 'Quality Manager'].includes(roleDoc.roleName),
        edit: ['Admin', 'Quality Manager'].includes(roleDoc.roleName),
        archive: roleDoc.roleName === 'Admin',
      };
      changed = true;
    }

    if (changed) {
      roleDoc.markModified('permissions');
      await roleDoc.save();
      console.log(`Updated permissions for role: ${roleDoc.roleName}`);
    }
  }

  // Set Company header
  await CompanySetting.findOneAndUpdate(
    { key: 'default' },
    {
      $set: {
        companyName: 'ESSTEE EXPORTS INDIA PVT LTD',
        companyAddress: 'Tirupur, Tamil Nadu, India',
        companyPhone: '+91-421-2223456',
        companyEmail: 'qa.lab@essteeexports.com',
      },
    },
    { upsert: true }
  );

  const admin = await User.findOne({ username: 'admin' });
  const qc = await User.findOne({ username: 'qc1' }) || admin;
  const qam = await User.findOne({ username: 'qam' }) || admin;

  // 2. Seed Accessories Master
  const accessoryItems = [
    { name: '4-Hole Polyester Button (18L / 24L)', category: 'Button', uom: 'Gross', approvedSuppliers: 'Vanguard Trim' },
    { name: 'YKK #5 Metal Zipper Antique Brass', category: 'Zipper', uom: 'Pcs', approvedSuppliers: 'YKK India' },
    { name: 'High-Density Woven Main Label', category: 'Label', uom: 'Pcs', approvedSuppliers: 'Avery Dennison' },
    { name: 'Printed Satin Wash Care Label', category: 'Label', uom: 'Pcs', approvedSuppliers: 'Avery Dennison' },
    { name: 'Heat Transfer Tagless Neck Label', category: 'Label', uom: 'Pcs', approvedSuppliers: 'Paxar' },
    { name: 'FSC Certified Paper Hangtag with Cotton Cord', category: 'Tag', uom: 'Pcs', approvedSuppliers: 'Trim World' },
    { name: 'Biodegradable Polybag 14x18" with Warning', category: 'Polybag', uom: 'Pcs', approvedSuppliers: 'EcoPack India' },
    { name: '100% Spun Polyester Sewing Thread 40/2', category: 'Thread', uom: 'Cones', approvedSuppliers: 'Coats India' },
    { name: 'Knitted Jacquard Elastic 1.5"', category: 'Elastic', uom: 'Mtr', approvedSuppliers: 'Stretchline' },
    { name: 'Recycled Plastic Coat Hanger 16"', category: 'Hanger', uom: 'Pcs', approvedSuppliers: 'Mainetti' },
  ];

  for (const item of accessoryItems) {
    const existing = await Accessory.findOne({ name: item.name });
    if (!existing) {
      const code = await nextMasterCode('ACC');
      await Accessory.create({
        code,
        name: item.name,
        category: item.category,
        uom: item.uom,
        approvedSuppliers: item.approvedSuppliers,
        specifications: 'Meets Oeko-Tex Standard 100 Class I specifications.',
        createdBy: admin._id,
      });
    }
  }

  // 3. Find or Create Reference Master Entities matching uploaded factory documents
  let buyerNext = await Buyer.findOne({ name: /next/i });
  if (!buyerNext) {
    const code = await nextMasterCode('BUY');
    buyerNext = await Buyer.create({
      code,
      name: 'NEXT UK',
      contactPerson: 'David Miller',
      email: 'qa.compliance@next.co.uk',
      country: 'United Kingdom',
      createdBy: admin._id,
    });
  }

  let buyerMS = await Buyer.findOne({ name: /m&s|marks/i });
  if (!buyerMS) {
    const code = await nextMasterCode('BUY');
    buyerMS = await Buyer.create({
      code,
      name: 'Marks & Spencer (M&S)',
      contactPerson: 'Sarah Jenkins',
      email: 'textiles.qa@marks-and-spencer.com',
      country: 'United Kingdom',
      createdBy: admin._id,
    });
  }

  let supplierEsstee = await Supplier.findOne({ name: /esstee/i });
  if (!supplierEsstee) {
    const code = await nextMasterCode('SUP');
    supplierEsstee = await Supplier.create({
      code,
      name: 'Esstee Processing Mills Unit II',
      contactPerson: 'R. Soundararajan',
      phone: '+91-421-2244888',
      factoryLocation: 'Perundurai SIPCOT, Erode',
      createdBy: admin._id,
    });
  }

  let fabricJersey = await Fabric.findOne({ name: /jersey/i });
  if (!fabricJersey) {
    const code = await nextMasterCode('FAB');
    fabricJersey = await Fabric.create({
      code,
      name: '100% Combed Cotton Single Jersey',
      construction: '30s Combed Cotton 24 Gauge Single Jersey',
      composition: '100% Cotton',
      weightGsm: 180,
      widthCm: 76,
      createdBy: admin._id,
    });
  }

  let fabricPique = await Fabric.findOne({ name: /pique/i });
  if (!fabricPique) {
    const code = await nextMasterCode('FAB');
    fabricPique = await Fabric.create({
      code,
      name: '100% Cotton Honeycomb Pique',
      construction: '26s Semi-combed 20 Gauge Pique',
      composition: '100% Cotton',
      weightGsm: 220,
      widthCm: 80,
      createdBy: admin._id,
    });
  }

  let colNavy = await Colour.findOne({ name: /navy/i });
  if (!colNavy) {
    const code = await nextMasterCode('COL');
    colNavy = await Colour.create({ code, name: 'Navy Blue', hexCode: '#000080', pantoneCode: '19-4024 TCX', createdBy: admin._id });
  }

  let gsm180 = await Gsm.findOne({ value: 180 });
  if (!gsm180) {
    const code = await nextMasterCode('GSM');
    gsm180 = await Gsm.create({ code, name: '180 GSM', value: 180, description: '180 GSM Single Jersey', createdBy: admin._id });
  }

  let sizeRange = await SizeRange.findOne({});
  if (!sizeRange) {
    const code = await nextMasterCode('SIZ');
    sizeRange = await SizeRange.create({ code, name: 'S-XL', sizes: ['S', 'M', 'L', 'XL'], createdBy: admin._id });
  }

  let styleTee = await Style.findOne({ styleNumber: 'ST-2024-TEE' });
  if (!styleTee) {
    const code = await nextMasterCode('STY');
    styleTee = await Style.create({
      code,
      styleNumber: 'ST-2024-TEE',
      name: 'Men Crew Neck Bio-Wash Tee',
      description: 'Short sleeve enzyme washed round neck t-shirt',
      buyerId: buyerNext._id,
      season: 'SS26',
      category: 'T-Shirt',
      createdBy: admin._id,
    });
  }

  let order25550 = await Order.findOne({ orderNumber: 'OR-25550' });
  if (!order25550) {
    const code = await nextMasterCode('ORD');
    order25550 = await Order.create({
      code,
      orderNumber: 'OR-25550',
      buyerId: buyerNext._id,
      styleId: styleTee._id,
      styleDescription: styleTee.description,
      orderQuantity: 12500,
      fabricId: fabricJersey._id,
      gsmId: gsm180._id,
      colourId: colNavy._id,
      supplierId: supplierEsstee._id,
      sizeRangeId: sizeRange._id,
      deliveryDate: new Date(Date.now() + 25 * 86400000),
      status: 'In Production',
      createdBy: admin._id,
    });
  }

  let order25551 = await Order.findOne({ orderNumber: 'OR-25551' });
  if (!order25551) {
    const code = await nextMasterCode('ORD');
    order25551 = await Order.create({
      code,
      orderNumber: 'OR-25551',
      buyerId: buyerMS._id,
      styleId: styleTee._id,
      styleDescription: styleTee.description,
      orderQuantity: 8000,
      fabricId: fabricPique._id,
      gsmId: gsm180._id,
      colourId: colNavy._id,
      supplierId: supplierEsstee._id,
      sizeRangeId: sizeRange._id,
      deliveryDate: new Date(Date.now() + 15 * 86400000),
      status: 'In Production',
      createdBy: admin._id,
    });
  }

  // 4. Seed Quality Specifications
  let specNext = await QualitySpecification.findOne({ buyerId: buyerNext._id, isLatest: true });
  if (!specNext) {
    const code = await nextMasterCode('SPC');
    specNext = await QualitySpecification.create({
      code,
      title: 'NEXT Standard Apparel Testing & QC Specification',
      buyerId: buyerNext._id,
      version: 1,
      isLatest: true,
      shrinkage: {
        allowedRangeMin: -5,
        allowedRangeMax: 2,
        spiralityMaxPercent: 4,
        burstingStrengthMinKpa: 250,
        attachmentTestMinNewton: 70,
      },
      gsm: {
        tolerancePercent: 5,
      },
      fourPoint: {
        rollPointsMax: 28,
        batchPointsMax: 20,
      },
      colourFastness: {
        changeInShadeMin: 4,
        stainingOnCottonMin: 3,
        crockingFabricWetMin: 3,
        crockingFabricDryMin: 4,
        crockingArtworkDryMin: 4,
      },
      createdBy: admin._id,
    });
  }

  // 5. Seed Shrinkage Test Reports (Form QF-29)
  const existingShrinkageCount = await ShrinkageInspection.countDocuments();
  if (existingShrinkageCount === 0) {
    // QF-29 Report 1: PASS matching reference photo Form QF-29
    const gRows1 = [
      { point: 'CHEST', bw: 52, aw: 51, kDia: '30"', fid: '28"', actualGsm: 182, spec: '+2% to -5%' },
      { point: 'BOTTOM', bw: 50, aw: 49, kDia: '30"', fid: '28"', actualGsm: 182, spec: '+2% to -5%' },
      { point: 'CBL', bw: 70, aw: 68, kDia: '30"', fid: '28"', actualGsm: 182, spec: '+2% to -5%' },
      { point: 'HPS', bw: 72, aw: 70, kDia: '30"', fid: '28"', actualGsm: 182, spec: '+2% to -5%' },
      { point: 'S.LENGTH', bw: 22, aw: 21.5, kDia: '30"', fid: '28"', actualGsm: 182, spec: '+2% to -5%' },
    ];
    const fRows1 = [
      { point: 'CHEST', bw: 52, aw: 51.2, kDia: '30"', fid: '28"', actualGsm: 180, spec: '+2% to -5%' },
      { point: 'BOTTOM', bw: 50, aw: 49.3, kDia: '30"', fid: '28"', actualGsm: 180, spec: '+2% to -5%' },
      { point: 'CBL', bw: 70, aw: 68.4, kDia: '30"', fid: '28"', actualGsm: 180, spec: '+2% to -5%' },
      { point: 'HPS', bw: 72, aw: 70.1, kDia: '30"', fid: '28"', actualGsm: 180, spec: '+2% to -5%' },
      { point: 'S.LENGTH', bw: 22, aw: 21.6, kDia: '30"', fid: '28"', actualGsm: 180, spec: '+2% to -5%' },
    ];

    const calc1 = calculateShrinkageInspection({
      toleranceConfig: { minShrinkage: -5, maxShrinkage: 2, gsmTolerancePercent: 5, attachmentMinNewton: 70, spiralityMaxPercent: 4 },
      garmentMeasurements: gRows1,
      fabricMeasurements: fRows1,
      gsmTesting: { requiredGsm: 180, actualGsm: 182 },
      colourFastness: {
        changeInShade: { value: 4.5, requirement: 4 },
        stainingOnCotton: { value: 4, requirement: 3 },
        crockingFabricWet: { value: 3.5, requirement: 3 },
        crockingFabricDry: { value: 4.5, requirement: 4 },
        crockingArtworkDry: { value: 4, requirement: 4 },
      },
      processDetail: {
        knitting: 'Mayer & Cie 24G',
        dyeing: 'Soft Flow Jet',
        compacting: 'Ferraro Tubular Compactor',
        fabricBurstingStrength: 285,
        attachmentTest1: 76,
        attachmentTest2: 82,
        attachmentTest3: 79,
      },
      spirality: { spiralityPercent: 2.1 },
      headerSnapshot: { requiredGsm: 180 },
    });

    const reportNum1 = await nextReportNumber('QF29');
    await ShrinkageInspection.create({
      reportNumber: reportNum1,
      inspectionType: 'shrinkage',
      inspectorId: qc._id,
      inspectorName: qc.fullName || 'Hina Saeed (QC)',
      orderId: order25550._id,
      buyerId: buyerNext._id,
      styleId: styleTee._id,
      fabricId: fabricJersey._id,
      supplierId: supplierEsstee._id,
      colourId: colNavy._id,
      gsmId: gsm180._id,
      specificationId: specNext._id,
      inspectionDate: new Date(),
      headerSnapshot: {
        orderNumber: 'OR-25550',
        buyerName: 'NEXT UK',
        styleNumber: 'ST-2024-TEE',
        fabricName: '100% Combed Cotton Single Jersey',
        supplierName: 'Esstee Processing Mills Unit II',
        colourName: 'Navy Blue',
        requiredGsm: 180,
        lotNumber: 'LOT-ES-25550',
        sampleIdentification: 'SAMPLE-1A',
        allowedShrinkage: '+2% -5%',
      },
      toleranceConfig: { minShrinkage: -5, maxShrinkage: 2, gsmTolerancePercent: 5, burstingStrengthMin: 250, attachmentMinNewton: 70, spiralityMaxPercent: 4 },
      garmentMeasurements: calc1.garmentMeasurements,
      fabricMeasurements: calc1.fabricMeasurements,
      gsmTesting: calc1.gsmTesting,
      colourFastness: calc1.colourFastness,
      processDetail: calc1.processDetail,
      spirality: calc1.spirality,
      summaryResults: calc1.summaryResults,
      remarks: 'All parameters conform strictly to NEXT specifications. Fabric approved for cutting.',
      approvalStatus: 'Approved',
      version: 1,
      icLabSignature: 'M. Senthil (IC Lab)',
      icQadSignature: 'K. Rajan (IC QAD)',
      receivedBySignature: 'V. Murugan (Cutting Dept)',
      createdBy: qc._id,
      updatedBy: qam._id,
    });

    // QF-29 Report 2: Draft / Pending report for quick user edit
    const reportNum2 = await nextReportNumber('QF29');
    const calc2 = calculateShrinkageInspection({
      toleranceConfig: { minShrinkage: -5, maxShrinkage: 2, gsmTolerancePercent: 5, attachmentMinNewton: 70, spiralityMaxPercent: 4 },
      garmentMeasurements: gRows1.map(r => ({ ...r, bw: 50, aw: 47 })),
      fabricMeasurements: fRows1.map(r => ({ ...r, bw: 50, aw: 47 })),
      gsmTesting: { requiredGsm: 180, actualGsm: 178 },
      colourFastness: {
        changeInShade: { value: 4, requirement: 4 },
        stainingOnCotton: { value: 3.5, requirement: 3 },
        crockingFabricWet: { value: 3, requirement: 3 },
        crockingFabricDry: { value: 4, requirement: 4 },
        crockingArtworkDry: { value: 4, requirement: 4 },
      },
      processDetail: {
        knitting: 'Pailung 24G',
        dyeing: 'Thies Eco Master',
        compacting: 'Tubetex',
        fabricBurstingStrength: 260,
        attachmentTest1: 72,
        attachmentTest2: 74,
        attachmentTest3: 71,
      },
      spirality: { spiralityPercent: 2.8 },
      headerSnapshot: { requiredGsm: 180 },
    });

    await ShrinkageInspection.create({
      reportNumber: reportNum2,
      inspectionType: 'shrinkage',
      inspectorId: qc._id,
      inspectorName: qc.fullName || 'Hina Saeed (QC)',
      orderId: order25551._id,
      buyerId: buyerMS._id,
      styleId: styleTee._id,
      fabricId: fabricPique._id,
      supplierId: supplierEsstee._id,
      colourId: colNavy._id,
      gsmId: gsm180._id,
      inspectionDate: new Date(),
      headerSnapshot: {
        orderNumber: 'OR-25551',
        buyerName: 'Marks & Spencer (M&S)',
        styleNumber: 'ST-2024-TEE',
        fabricName: '100% Cotton Honeycomb Pique',
        supplierName: 'Esstee Processing Mills Unit II',
        colourName: 'Navy Blue',
        requiredGsm: 180,
        lotNumber: 'LOT-ES-25551',
        sampleIdentification: 'SAMPLE-2B',
        allowedShrinkage: '+2% -5%',
      },
      toleranceConfig: { minShrinkage: -5, maxShrinkage: 2, gsmTolerancePercent: 5, burstingStrengthMin: 250, attachmentMinNewton: 70, spiralityMaxPercent: 4 },
      garmentMeasurements: calc2.garmentMeasurements,
      fabricMeasurements: calc2.fabricMeasurements,
      gsmTesting: calc2.gsmTesting,
      colourFastness: calc2.colourFastness,
      processDetail: calc2.processDetail,
      spirality: calc2.spirality,
      summaryResults: calc2.summaryResults,
      remarks: 'Draft shrinkage test - initial washing cycle completed.',
      approvalStatus: 'Draft',
      version: 1,
      createdBy: qc._id,
      updatedBy: qc._id,
    });

    console.log('Seeded Shrinkage Reports (Form QF-29)');
  }

  // 6. Seed Fabric Four-Point Inspection Reports (Form QF-30)
  const existingFourPointCount = await FourPointInspection.countDocuments();
  if (existingFourPointCount === 0) {
    const rolls1 = [
      {
        rollNo: 'R-01', ropeNo: 'A1', widthCm: 76, diaInches: 30, gsm: 180, rollWeight: 24.5, inspectedYards: 100,
        defectsUpTo3Inches: 2, defects3To6Inches: 1, defects6To9Inches: 0, defectsOver9Inches: 0,
        defects: { dyeSpots: 1, knittingHoles: 1 }, remarks: 'Pass'
      },
      {
        rollNo: 'R-02', ropeNo: 'A2', widthCm: 76, diaInches: 30, gsm: 182, rollWeight: 26.0, inspectedYards: 100,
        defectsUpTo3Inches: 1, defects3To6Inches: 2, defects6To9Inches: 1, defectsOver9Inches: 0,
        defects: { unevenDyeingPatches: 1, cutsJoints: 1 }, remarks: 'Pass'
      },
      {
        rollNo: 'R-03', ropeNo: 'B1', widthCm: 76, diaInches: 30, gsm: 179, rollWeight: 23.8, inspectedYards: 100,
        defectsUpTo3Inches: 3, defects3To6Inches: 1, defects6To9Inches: 0, defectsOver9Inches: 0,
        defects: { oilStains: 1 }, remarks: 'Pass'
      },
      {
        rollNo: 'R-04', ropeNo: 'B2', widthCm: 76, diaInches: 30, gsm: 181, rollWeight: 25.2, inspectedYards: 100,
        defectsUpTo3Inches: 2, defects3To6Inches: 0, defects6To9Inches: 1, defectsOver9Inches: 0,
        defects: { softenerStains: 1 }, remarks: 'Pass'
      },
    ];

    const calc4pt1 = calculateFourPointInspection({
      acceptanceCriteria: { rollMaxPointsPer100SqYds: 28, batchMaxPointsPer100SqYds: 20 },
      isTubularFabric: true,
      rolls: rolls1,
    });

    const rep4pt1 = await nextReportNumber('QF30');
    await FourPointInspection.create({
      reportNumber: rep4pt1,
      inspectionType: 'four_point',
      inspectorId: qc._id,
      inspectorName: qc.fullName || 'Hina Saeed (QC)',
      orderId: order25550._id,
      buyerId: buyerNext._id,
      styleId: styleTee._id,
      fabricId: fabricJersey._id,
      supplierId: supplierEsstee._id,
      colourId: colNavy._id,
      gsmId: gsm180._id,
      inspectionDate: new Date(),
      headerSnapshot: {
        orderNumber: 'OR-25550',
        buyerName: 'NEXT UK',
        styleNumber: 'ST-2024-TEE',
        fabricDescription: '100% Combed Cotton Single Jersey 30s',
        colourName: 'Navy Blue',
        requiredGsm: 180,
        yarnMill: 'Super Spinning Mills',
        knittingName: 'Esstee Knitting Unit',
        countDia: '30s / 30" Dia',
        dcNumber: 'DC-88902',
        rollNumberSummary: 'R-01 to R-04',
        totalReceivedWeight: 99.5,
        inspectionQuantityYards: 400,
      },
      isTubularFabric: true,
      acceptanceCriteria: { rollMaxPointsPer100SqYds: 28, batchMaxPointsPer100SqYds: 20 },
      rolls: calc4pt1.rolls,
      batchSummary: calc4pt1.batchSummary,
      approvalStatus: 'Approved',
      version: 1,
      inspectorRemarks: 'All 4 rolls inspected under daylight D65 viewing booth. Batch accepted.',
      checkerSignature: 'P. Karuppasamy (QC Checker)',
      labIcSignature: 'M. Senthil (Lab IC)',
      createdBy: qc._id,
      updatedBy: qam._id,
    });

    // Form QF-30 Report 2: Draft
    const rep4pt2 = await nextReportNumber('QF30');
    const calc4pt2 = calculateFourPointInspection({
      acceptanceCriteria: { rollMaxPointsPer100SqYds: 28, batchMaxPointsPer100SqYds: 20 },
      isTubularFabric: true,
      rolls: rolls1.slice(0, 2),
    });

    await FourPointInspection.create({
      reportNumber: rep4pt2,
      inspectionType: 'four_point',
      inspectorId: qc._id,
      inspectorName: qc.fullName || 'Hina Saeed (QC)',
      orderId: order25551._id,
      buyerId: buyerMS._id,
      styleId: styleTee._id,
      fabricId: fabricPique._id,
      supplierId: supplierEsstee._id,
      colourId: colNavy._id,
      gsmId: gsm180._id,
      inspectionDate: new Date(),
      headerSnapshot: {
        orderNumber: 'OR-25551',
        buyerName: 'Marks & Spencer (M&S)',
        styleNumber: 'ST-2024-TEE',
        fabricDescription: '100% Cotton Pique',
        colourName: 'Navy Blue',
        requiredGsm: 220,
        yarnMill: 'Vardhman',
        knittingName: 'Esstee Unit 1',
        countDia: '26s / 30" Dia',
        dcNumber: 'DC-88990',
        rollNumberSummary: 'R-01, R-02',
        totalReceivedWeight: 50.5,
        inspectionQuantityYards: 200,
      },
      isTubularFabric: true,
      acceptanceCriteria: { rollMaxPointsPer100SqYds: 28, batchMaxPointsPer100SqYds: 20 },
      rolls: calc4pt2.rolls,
      batchSummary: calc4pt2.batchSummary,
      approvalStatus: 'Draft',
      version: 1,
      inspectorRemarks: 'Initial 2 rolls inspected.',
      createdBy: qc._id,
      updatedBy: qc._id,
    });

    console.log('Seeded Fabric Four-Point Reports (Form QF-30)');
  }

  // 7. Seed Accessories Inspection Reports (Form QAD-5)
  const existingAccessoriesCount = await AccessoriesInspection.countDocuments();
  if (existingAccessoriesCount === 0) {
    const fullChecklistOK = [
      { parameterKey: 'material', label: 'Material', isMandatory: true, status: 'OK', comments: '100% Polyester meets spec' },
      { parameterKey: 'colour_matching', label: 'Colour matching', isMandatory: true, status: 'OK', comments: 'Matches approved master swatch' },
      { parameterKey: 'content_text', label: 'Content / Text', isMandatory: true, status: 'OK', comments: 'Correct font and layout' },
      { parameterKey: 'design', label: 'Design', isMandatory: true, status: 'OK', comments: 'Matches buyer technical pack' },
      { parameterKey: 'position_design', label: 'Position of design', isMandatory: false, status: 'OK', comments: 'Centered' },
      { parameterKey: 'size_material', label: 'Size of material', isMandatory: true, status: 'OK', comments: '35mm x 45mm accurate' },
      { parameterKey: 'uniformity', label: 'Uniformity', isMandatory: false, status: 'OK', comments: 'Consistent weave' },
      { parameterKey: 'fibre_composition', label: 'Fibre composition details', isMandatory: true, status: 'OK', comments: '100% Cotton confirmed' },
      { parameterKey: 'wash_care_symbol', label: 'Wash care symbol marking', isMandatory: true, status: 'OK', comments: 'Symbols comply with ISO 3758' },
      { parameterKey: 'weight_material', label: 'Weight of material (GSM or thickness)', isMandatory: false, status: 'OK', comments: 'Thickness within +/- 5%' },
      { parameterKey: 'breaking_strength', label: 'Breaking strength (if hanger)', isMandatory: false, status: 'N/A', comments: 'Not applicable for woven label' },
      { parameterKey: 'physical_testing', label: 'Physical testing, if any', isMandatory: false, status: 'OK', comments: 'Rub resistance verified' },
      { parameterKey: 'lab_testing', label: 'Lab testing, if required', isMandatory: false, status: 'OK', comments: 'Oeko-Tex certified' },
    ];

    const calcAcc1 = calculateAccessoriesInspection({
      receivedQuantity: 5000,
      inspectedQuantity: 200,
      checklist: fullChecklistOK,
    });

    const repAcc1 = await nextReportNumber('QAD5');
    await AccessoriesInspection.create({
      reportNumber: repAcc1,
      inspectionType: 'accessories',
      inspectorId: qc._id,
      inspectorName: qc.fullName || 'Hina Saeed (QC)',
      orderId: order25550._id,
      buyerId: buyerNext._id,
      styleId: styleTee._id,
      supplierId: supplierEsstee._id,
      inspectionDate: new Date(),
      inOrNo: 'IN-OR-25550',
      headerSnapshot: {
        orderNumber: 'OR-25550',
        buyerName: 'NEXT UK',
        styleNumber: 'ST-2024-TEE',
        supplierName: 'Avery Dennison India',
        accessoryDescription: 'High-Density Woven Neck Label with Satin Finish',
        poNumber: 'PO-NEXT-7741',
        dcNumber: 'DC-TRIM-1029',
      },
      receivedDate: new Date(),
      receivedQuantity: 5000,
      inspectedQuantity: 200,
      checklist: calcAcc1.checklist,
      summary: calcAcc1.summary,
      approvalStatus: 'Approved',
      version: 1,
      inspectedBy: 'Hina Saeed (QC)',
      verifiedBy: 'Imran Yusuf (Supervisor)',
      approvedBy: 'Zainab Malik (QAM)',
      remarks: 'All quality checklist parameters verified against approved golden seal sample. Lot accepted.',
      createdBy: qc._id,
      updatedBy: qam._id,
    });

    // Form QAD-5 Report 2: Draft
    const repAcc2 = await nextReportNumber('QAD5');
    const calcAcc2 = calculateAccessoriesInspection({
      receivedQuantity: 10000,
      inspectedQuantity: 315,
      checklist: fullChecklistOK,
    });

    await AccessoriesInspection.create({
      reportNumber: repAcc2,
      inspectionType: 'accessories',
      inspectorId: qc._id,
      inspectorName: qc.fullName || 'Hina Saeed (QC)',
      orderId: order25551._id,
      buyerId: buyerMS._id,
      styleId: styleTee._id,
      supplierId: supplierEsstee._id,
      inspectionDate: new Date(),
      inOrNo: 'IN-OR-25551',
      headerSnapshot: {
        orderNumber: 'OR-25551',
        buyerName: 'Marks & Spencer (M&S)',
        styleNumber: 'ST-2024-TEE',
        supplierName: 'YKK India Pvt Ltd',
        accessoryDescription: '#5 Metal Zipper Antique Brass 18cm',
        poNumber: 'PO-MS-9921',
        dcNumber: 'DC-ZIP-4410',
      },
      receivedDate: new Date(),
      receivedQuantity: 10000,
      inspectedQuantity: 315,
      checklist: calcAcc2.checklist,
      summary: calcAcc2.summary,
      approvalStatus: 'Draft',
      version: 1,
      inspectedBy: 'Hina Saeed (QC)',
      remarks: 'Sampling in progress.',
      createdBy: qc._id,
      updatedBy: qc._id,
    });

    console.log('Seeded Accessories Reports (Form QAD-5)');
  }

  console.log('Textile QC Demo seeding complete!');
  await disconnectDB();
}

// Execute if run directly
if (process.argv[1]?.endsWith('seedTextileDemo.js')) {
  seedTextileQC().catch((err) => {
    console.error('Textile QC seed failed:', err);
    process.exit(1);
  });
}
