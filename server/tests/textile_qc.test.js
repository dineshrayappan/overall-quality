import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import {
  calculateShrinkageInspection,
  calculateFourPointInspection,
  calculateAccessoriesInspection,
} from '../src/services/calculationService.js';

const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/garment_qms_textile_test';

let server;
let baseUrl;
let disconnectDBFn;
let adminToken;
let buyerId;
let orderId;
let styleId;
let fabricId;
let colourId;
let gsmId;

async function api(path, { method = 'GET', token, body, isRaw = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (isRaw) {
    return { status: res.status, headers: res.headers, buffer: Buffer.from(await res.arrayBuffer()) };
  }
  const json = await res.json();
  return { status: res.status, headers: res.headers, json };
}

before(async () => {
  const [{ createApp }, { connectDB, disconnectDB }, { bootstrapSystemConfig }] = await Promise.all([
    import('../src/app.js'),
    import('../src/config/db.js'),
    import('../src/services/bootstrapService.js'),
  ]);
  disconnectDBFn = disconnectDB;

  await connectDB(TEST_MONGO_URI);
  await mongoose.connection.db.dropDatabase();
  await bootstrapSystemConfig();

  const app = createApp();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}/api`;

  // First time setup
  const setupRes = await api('/auth/setup', {
    method: 'POST',
    body: {
      fullName: 'Textile QA Admin',
      username: 'textileadmin',
      email: 'textile_qa@esstee.com',
      password: 'AdminPassword123!',
      companyName: 'ESSTEE EXPORTS INDIA PVT LTD',
    },
  });
  adminToken = setupRes.json.data.token;

  // Create base masters
  const bRes = await api('/masters/buyers', {
    method: 'POST',
    token: adminToken,
    body: { name: 'Marks & Spencer', contactPerson: 'John Smith', country: 'UK' },
  });
  buyerId = bRes.json.data._id;

  const sRes = await api('/masters/styles', {
    method: 'POST',
    token: adminToken,
    body: { styleNumber: 'ES-1001', name: 'Cotton Crew Neck Tee', buyerId },
  });
  styleId = sRes.json.data._id;

  const fRes = await api('/masters/fabrics', {
    method: 'POST',
    token: adminToken,
    body: { name: '100% Single Jersey Cotton', composition: '100% Cotton' },
  });
  fabricId = fRes.json.data._id;

  const cRes = await api('/masters/colours', {
    method: 'POST',
    token: adminToken,
    body: { name: 'Navy Blue', pantoneCode: '19-4024' },
  });
  colourId = cRes.json.data._id;

  const gRes = await api('/masters/gsms', {
    method: 'POST',
    token: adminToken,
    body: { value: 180, name: '180 GSM' },
  });
  gsmId = gRes.json.data._id;

  const ordRes = await api('/masters/orders', {
    method: 'POST',
    token: adminToken,
    body: {
      orderNumber: 'ORD-2026-001',
      buyerId,
      styleId,
      fabricId,
      colourId,
      gsmId,
      orderQuantity: 5000,
    },
  });
  orderId = ordRes.json.data._id;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.db.dropDatabase();
  if (disconnectDBFn) await disconnectDBFn();
});

test('1. Shrinkage calculation unit rules (Form QF-29)', () => {
  // Test 1: Within tolerance (+2% to -5%)
  // B.W. = 50, A.W. = 49.5 => Shrinkage % = ((50 - 49.5) / 50) * 100 = +1.0% (OK)
  // B.W. = 50, A.W. = 51 => Shrinkage % = ((50 - 51) / 50) * 100 = -2.0% (Growth, OK)
  const okData = {
    toleranceConfig: { minShrinkage: -5, maxShrinkage: 2, gsmTolerancePercent: 5, attachmentMinNewton: 70, spiralityMaxPercent: 4 },
    garmentMeasurements: [
      { point: 'CHEST', bw: 50, aw: 49.5 },
      { point: 'BOTTOM', bw: 50, aw: 51 },
    ],
    fabricMeasurements: [{ point: 'LENGTH', bw: 100, aw: 99 }],
    gsmTesting: { requiredGsm: 180, actualGsm: 182 },
    colourFastness: {
      changeInShade: { value: 4, requirement: 4 },
      stainingOnCotton: { value: 3.5, requirement: 3 },
      crockingFabricWet: { value: 3.5, requirement: 3 },
      crockingFabricDry: { value: 4, requirement: 4 },
      crockingArtworkWet: { value: 4, requirement: 4 },
      crockingArtworkDry: { value: 4, requirement: 4 },
    },
    processDetail: {
      attachmentTests: [
        { testNumber: 1, valueNewton: 75 },
        { testNumber: 2, valueNewton: 72 },
        { testNumber: 3, valueNewton: 70 },
      ],
    },
    spirality: { spiralityPercent: 2.5 },
  };

  const okResult = calculateShrinkageInspection(okData);
  assert.equal(okResult.garmentMeasurements[0].shrinkagePercent, 1);
  assert.equal(okResult.garmentMeasurements[0].result, 'OK');
  assert.equal(okResult.garmentMeasurements[1].shrinkagePercent, -2);
  assert.equal(okResult.garmentMeasurements[1].result, 'OK');
  assert.equal(okResult.summaryResults.shrinkageResult, 'OK');
  assert.equal(okResult.summaryResults.gsmResult, 'OK');
  assert.equal(okResult.summaryResults.colourFastnessResult, 'OK');
  assert.equal(okResult.summaryResults.overallResult, 'PASS');

  // Test 2: Failure scenario (Excessive shrinkage + low attachment strength)
  // B.W. = 50, A.W. = 47 => Shrinkage % = ((50 - 47) / 50) * 100 = 6% (Exceeds +2% limit => NOT OK)
  const failData = {
    ...okData,
    garmentMeasurements: [{ point: 'CHEST', bw: 50, aw: 47 }],
    processDetail: {
      attachmentTests: [{ testNumber: 1, valueNewton: 65 }], // 65 < 70 => FAIL
    },
  };
  const failResult = calculateShrinkageInspection(failData);
  assert.equal(failResult.garmentMeasurements[0].shrinkagePercent, 6);
  assert.equal(failResult.garmentMeasurements[0].result, 'NOT OK');
  assert.equal(failResult.summaryResults.shrinkageResult, 'NOT OK');
  assert.equal(failResult.processDetail.attachmentResult, 'NOT OK');
  assert.equal(failResult.summaryResults.overallResult, 'FAIL');
  assert.ok(failResult.summaryResults.failedParameters.includes('Shrinkage Measurement'));
  assert.ok(failResult.summaryResults.failedParameters.includes('Attachment Strength'));
});

test('2. Four-Point Fabric inspection unit rules (Form QF-30)', () => {
  // Formula: (Points * 3600) / (Dia * 2 * Inspected Yards) for tubular
  // Roll 1: Dia = 30", Inspected = 100 yds => Denominator = 30 * 2 * 100 = 6000
  // 5 defects up to 3" (5*1=5) + 2 defects 3-6" (2*2=4) = 9 points.
  // Points / 100 sq yds = (9 * 3600) / 6000 = 5.4 points/100 sq yds.
  // Roll limit is 28 => PASS.
  const fpData = {
    isTubularFabric: true,
    acceptanceCriteria: { rollMaxPointsPer100SqYds: 28, batchMaxPointsPer100SqYds: 20 },
    rolls: [
      {
        rollNo: 'R-01',
        diaInches: 30,
        inspectedYards: 100,
        defectsUpTo3Inches: 5,
        defects3To6Inches: 2,
        defects6To9Inches: 0,
        defectsOver9Inches: 0,
      },
    ],
  };

  const fpResult = calculateFourPointInspection(fpData);
  assert.equal(fpResult.rolls[0].totalDefectPoints, 9);
  assert.equal(fpResult.rolls[0].pointsPer100SqYds, 5.4);
  assert.equal(fpResult.rolls[0].rollResult, 'PASS');
  assert.equal(fpResult.batchSummary.finalBatchResult, 'PASS');

  // Excessive defects: 60 points => (60 * 3600) / 6000 = 36 pts/100 sq yds (> 28) => FAIL
  const failRoll = {
    ...fpData,
    rolls: [
      {
        rollNo: 'R-FAIL',
        diaInches: 30,
        inspectedYards: 100,
        defectsUpTo3Inches: 0,
        defectsOver9Inches: 15, // 15 * 4 = 60 points
      },
    ],
  };
  const failFpResult = calculateFourPointInspection(failRoll);
  assert.equal(failFpResult.rolls[0].totalDefectPoints, 60);
  assert.equal(failFpResult.rolls[0].pointsPer100SqYds, 36);
  assert.equal(failFpResult.rolls[0].rollResult, 'FAIL');
  assert.equal(failFpResult.batchSummary.finalBatchResult, 'FAIL');
});

test('3. Accessories inspection unit rules (Form QAD-5)', () => {
  const accData = {
    receivedQuantity: 10000,
    inspectedQuantity: 315,
    checklist: [
      { parameterKey: 'material', label: 'Material', isMandatory: true, status: 'OK' },
      { parameterKey: 'colour_matching', label: 'Colour matching', isMandatory: true, status: 'OK' },
      { parameterKey: 'size_material', label: 'Size of material', isMandatory: true, status: 'NOT OK' },
    ],
  };

  const accResult = calculateAccessoriesInspection(accData);
  assert.equal(accResult.inspectionPercentage, 3.15);
  assert.equal(accResult.calculations.notOkCount, 1);
  assert.equal(accResult.finalResult, 'REJECT'); // Mandatory failure triggers REJECT

  const passData = {
    receivedQuantity: 5000,
    inspectedQuantity: 200,
    checklist: [
      { parameterKey: 'material', label: 'Material', isMandatory: true, status: 'OK' },
      { parameterKey: 'colour_matching', label: 'Colour matching', isMandatory: true, status: 'OK' },
    ],
  };
  const passResult = calculateAccessoriesInspection(passData);
  assert.equal(passResult.finalResult, 'ACCEPT');
});

test('4. End-to-end API workflows: Specifications, QF-29, QF-30, QAD-5, PDF & Excel Exports', async () => {
  // A. Quality Specification CRUD
  const specRes = await api('/specifications', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'M&S Standard Textile Specs',
      buyerId,
      buyerName: 'Marks & Spencer',
      shrinkage: { allowedRangeMin: -5, allowedRangeMax: 2 },
      fourPoint: { rollPointsMax: 28, batchPointsMax: 20 },
    },
  });
  assert.equal(specRes.status, 201);
  assert.equal(specRes.json.success, true);
  const specId = specRes.json.data._id;

  // B. Resolve Specification
  const resolveRes = await api(`/specifications/resolve?buyerId=${buyerId}`, {
    method: 'GET',
    token: adminToken,
  });
  assert.equal(resolveRes.status, 200);
  assert.equal(resolveRes.json.data._id, specId);

  // C. Create QF-29 Shrinkage Report
  const shrinkRes = await api('/inspections/shrinkage', {
    method: 'POST',
    token: adminToken,
    body: {
      orderId,
      buyerId,
      styleId,
      fabricId,
      colourId,
      gsmId,
      specificationId: specId,
      inspectionDate: new Date().toISOString(),
      garmentMeasurements: [
        { point: 'CHEST', bw: 50, aw: 49.5 },
        { point: 'BOTTOM', bw: 50, aw: 50.2 },
      ],
      fabricMeasurements: [{ point: 'LENGTH', bw: 100, aw: 99.5 }],
      gsmTesting: { requiredGsm: 180, actualGsm: 182 },
      processDetail: {
        knitting: 'Single Jersey 28GG',
        dyeing: 'Reactive Dye',
        compacting: 'Tubular compactor',
        fabricBurstingStrength: '280 kPa',
        attachmentTests: [{ testNumber: 1, valueNewton: 75 }],
      },
    },
  });
  assert.equal(shrinkRes.status, 201);
  const shrinkReport = shrinkRes.json.data;
  assert.ok(shrinkReport.reportNumber.startsWith('QF29-'));
  assert.equal(shrinkReport.summaryResults.overallResult, 'PASS');

  // D. Create QF-30 Fabric Four-Point Report
  const fpRes = await api('/inspections/four-point', {
    method: 'POST',
    token: adminToken,
    body: {
      orderId,
      buyerId,
      styleId,
      fabricId,
      colourId,
      gsmId,
      inspectionDate: new Date().toISOString(),
      isTubularFabric: true,
      rolls: [
        {
          rollNo: 'ROLL-101',
          ropeNo: 'ROP-1',
          diaInches: 30,
          gsm: 180,
          rollWeight: 22.5,
          inspectedYards: 100,
          defectsUpTo3Inches: 4,
          defects3To6Inches: 1,
        },
      ],
    },
  });
  assert.equal(fpRes.status, 201);
  const fpReport = fpRes.json.data;
  assert.ok(fpReport.reportNumber.startsWith('QF30-'));
  assert.equal(fpReport.batchSummary.finalBatchResult, 'PASS');

  // E. Create QAD-5 Accessories Report
  const accRes = await api('/inspections/accessories', {
    method: 'POST',
    token: adminToken,
    body: {
      inOrNo: 'IN-5501',
      orderId,
      buyerId,
      styleId,
      inspectionDate: new Date().toISOString(),
      receivedQuantity: 5000,
      inspectedQuantity: 150,
      checklist: [
        { parameterKey: 'material', label: 'Material', isMandatory: true, status: 'OK' },
        { parameterKey: 'colour_matching', label: 'Colour matching', isMandatory: true, status: 'OK' },
        { parameterKey: 'design', label: 'Design', isMandatory: true, status: 'OK' },
      ],
    },
  });
  assert.equal(accRes.status, 201);
  const accReport = accRes.json.data;
  assert.ok(accReport.reportNumber.startsWith('QAD5-'));
  assert.equal(accReport.finalResult, 'ACCEPT');

  // F. Test PDF Export for QF-29, QF-30, and QAD-5
  const shrinkPdf = await api(`/exports/pdf/shrinkage/${shrinkReport._id}`, {
    method: 'GET',
    token: adminToken,
    isRaw: true,
  });
  assert.equal(shrinkPdf.status, 200);
  assert.ok(shrinkPdf.buffer.slice(0, 4).toString().includes('%PDF'));

  const fpPdf = await api(`/exports/pdf/four-point/${fpReport._id}`, {
    method: 'GET',
    token: adminToken,
    isRaw: true,
  });
  assert.equal(fpPdf.status, 200);
  assert.ok(fpPdf.buffer.slice(0, 4).toString().includes('%PDF'));

  const accPdf = await api(`/exports/pdf/accessories/${accReport._id}`, {
    method: 'GET',
    token: adminToken,
    isRaw: true,
  });
  assert.equal(accPdf.status, 200);
  assert.ok(accPdf.buffer.slice(0, 4).toString().includes('%PDF'));

  // G. Test Excel Export for QF-29, QF-30, and QAD-5
  const shrinkXlsx = await api(`/exports/excel/individual/shrinkage/${shrinkReport._id}`, {
    method: 'GET',
    token: adminToken,
    isRaw: true,
  });
  assert.equal(shrinkXlsx.status, 200);
  assert.ok(shrinkXlsx.buffer.length > 1000);

  const fpXlsx = await api(`/exports/excel/individual/four-point/${fpReport._id}`, {
    method: 'GET',
    token: adminToken,
    isRaw: true,
  });
  assert.equal(fpXlsx.status, 200);
  assert.ok(fpXlsx.buffer.length > 1000);

  const accXlsx = await api(`/exports/excel/individual/accessories/${accReport._id}`, {
    method: 'GET',
    token: adminToken,
    isRaw: true,
  });
  assert.equal(accXlsx.status, 200);
  assert.ok(accXlsx.buffer.length > 1000);

  // H. Test Dashboard Analytics
  const dashRes = await api('/dashboard/analytics', {
    method: 'GET',
    token: adminToken,
  });
  assert.equal(dashRes.status, 200);
  const cards = dashRes.json.data.summaryCards;
  assert.ok(cards.totalInspections >= 3);
  assert.ok(cards.fabricInspectionQuantity >= 100);
  assert.ok(cards.shrinkageTestQuantity >= 1);
  assert.ok(cards.accessoriesInspectionQuantity >= 150);
  assert.ok(cards.overallAcceptancePercentage > 0);
  assert.ok(dashRes.json.data.buyerPerformance.length > 0);
});
