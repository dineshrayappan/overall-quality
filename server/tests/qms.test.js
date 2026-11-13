import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import {
  calculateMeasurementRows,
  calculateSevenPoint,
  calculateSizeSet,
  calculateTargetChart,
} from '../src/services/calculationService.js';

const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/garment_qms_test';

let server;
let baseUrl;
let disconnectDBFn;
let testUploadDir;
let adminToken;
let qcToken;
let managerToken;
let line1Id;
let line2Id;
let orderId;
let styleId;
let buyerId;
let empId;
let procId;
let machId;
let needleId;
let specId;
let uploadedAttachmentId;

async function api(path, { method = 'GET', token, body, isRaw = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });
  if (isRaw) {
    return { status: res.status, headers: res.headers, buffer: Buffer.from(await res.arrayBuffer()) };
  }
  const json = await res.json();
  return { status: res.status, headers: res.headers, json };
}

before(async () => {
  process.env.UPLOAD_DIR = 'uploads_test';
  const [{ createApp }, { connectDB, disconnectDB }, { env }, { bootstrapSystemConfig }] = await Promise.all([
    import('../src/app.js'),
    import('../src/config/db.js'),
    import('../src/config/env.js'),
    import('../src/services/bootstrapService.js'),
  ]);
  disconnectDBFn = disconnectDB;
  testUploadDir = env.uploadDir;

  await connectDB(TEST_MONGO_URI);
  await mongoose.connection.db.dropDatabase();
  await bootstrapSystemConfig();

  const app = createApp();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}/api`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.db.dropDatabase();
  if (disconnectDBFn) {
    await disconnectDBFn();
  }
  if (testUploadDir && fs.existsSync(testUploadDir)) {
    fs.rmSync(testUploadDir, { recursive: true, force: true });
  }
});

test('1. Calculation unit rules across all 4 modules', () => {
  // Module 1: Target Chart
  const indicators = Array.from({ length: 15 }, (_, idx) => ({
    index: idx + 1,
    name: `Indicator ${idx + 1}`,
    unit: 'pcs',
    targetValue: 100,
    actualValue: idx < 5 ? 100 : idx < 10 ? 75 : 50,
  }));
  const tc = calculateTargetChart(indicators);
  assert.equal(tc.indicators[0].levelReached, '100%+');
  assert.equal(tc.indicators[5].levelReached, '75%+');
  assert.equal(tc.indicators[10].levelReached, '50%+');
  assert.equal(tc.summary.totalTarget, 1500);
  assert.equal(tc.summary.totalAchieved, 1125);
  assert.equal(tc.summary.achievementPercentage, 75);

  // Module 2: Size Set (N/A excluded from denominator)
  const ss = calculateSizeSet({
    accessories: [
      { itemKey: 'a1', label: 'Button', status: 'OK', isCritical: false },
      { itemKey: 'a2', label: 'Zipper', status: 'N/A', isCritical: false },
    ],
    workmanship: [
      { itemKey: 'w1', label: 'Stitching', status: 'Not OK', isCritical: true },
    ],
    labelling: [
      { itemKey: 'l1', label: 'Main Label', status: 'OK', isCritical: true },
    ],
  });
  assert.equal(ss.totalApplicableItems, 3);
  assert.equal(ss.totalOkItems, 2);
  assert.equal(ss.totalNotOkItems, 1);
  assert.equal(ss.totalNaItems, 1);
  assert.equal(ss.overallOkPercentage, 66.67);
  assert.equal(ss.acceptanceRuleEvaluation.meetsConfiguredRules, false);
  assert.equal(ss.acceptanceRuleEvaluation.suggestedDecision, 'Hold');

  // Module 3: 7 Point sum validation & percentages
  assert.throws(
    () =>
      calculateSevenPoint([
        {
          employeeName: 'Test Op',
          piecesChecked: 100,
          okPieces: 90,
          reworkPieces: 5,
          rejectedPieces: 2,
          oilDefectCount: 1,
        },
      ]),
    /must equal Pieces Checked/
  );
  const sp = calculateSevenPoint([
    {
      employeeName: 'Test Op',
      piecesChecked: 100,
      okPieces: 90,
      reworkPieces: 7,
      rejectedPieces: 3,
      oilDefectCount: 2,
    },
  ]);
  assert.equal(sp.reworkPercentage, 7);
  assert.equal(sp.oilPercentage, 2);
  assert.equal(sp.rejectionPercentage, 3);
  assert.equal(sp.sumValidationPassed, true);

  // Module 4: Measurement difference & per-point tolerance
  const ms = calculateMeasurementRows([
    {
      size: 'M',
      measurementPoint: 'Chest',
      unit: 'cm',
      approvedSpec: 30,
      upperTolerance: 1,
      lowerTolerance: -1,
      actualMeasurement: 31,
    },
    {
      size: 'M',
      measurementPoint: 'Length',
      unit: 'cm',
      approvedSpec: 70,
      upperTolerance: 0.5,
      lowerTolerance: -0.5,
      actualMeasurement: 69,
    },
  ]);
  assert.equal(ms.rows[0].difference, 1);
  assert.equal(ms.rows[0].result, 'Pass');
  assert.equal(ms.rows[0].toleranceLabel, 'Within Tolerance');
  assert.equal(ms.rows[1].difference, -1);
  assert.equal(ms.rows[1].result, 'Fail');
  assert.equal(ms.summary.overallResult, 'Fail');
});

test('2. First-time setup & RBAC user creation', async () => {
  const statusRes = await api('/auth/setup-status');
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.json.data.needsSetup, true);

  const setupRes = await api('/auth/setup', {
    method: 'POST',
    body: {
      fullName: 'System Admin',
      username: 'sysadmin',
      email: 'admin@factory.test',
      password: 'Password123!',
      companyName: 'Test Textile Mills',
    },
  });
  assert.equal(setupRes.status, 201);
  adminToken = setupRes.json.data.token;

  // Second setup attempt must fail
  const blockedSetup = await api('/auth/setup', {
    method: 'POST',
    body: { fullName: 'Hacker', username: 'hacker', password: 'Password123!' },
  });
  assert.equal(blockedSetup.status, 403);
});

test('3. Master data CRUD, order auto-fill, and RBAC restriction', async () => {
  const buyer = (await api('/masters/buyers', { method: 'POST', token: adminToken, body: { name: 'Buyer Alpha' } })).json.data;
  buyerId = buyer._id;
  const supplier = (await api('/masters/suppliers', { method: 'POST', token: adminToken, body: { name: 'Supplier Beta' } })).json.data;
  const style = (await api('/masters/styles', { method: 'POST', token: adminToken, body: { styleNumber: 'STY-101', name: 'Polo Shirt', description: 'Pique Polo', buyerId } })).json.data;
  styleId = style._id;
  const fabric = (await api('/masters/fabrics', { method: 'POST', token: adminToken, body: { name: '100% Cotton Pique' } })).json.data;
  const colour = (await api('/masters/colours', { method: 'POST', token: adminToken, body: { name: 'Navy Blue' } })).json.data;
  const gsm = (await api('/masters/gsms', { method: 'POST', token: adminToken, body: { value: 210 } })).json.data;
  const sizeRange = (await api('/masters/size-ranges', { method: 'POST', token: adminToken, body: { name: 'S-XL', sizes: ['S', 'M', 'L', 'XL'] } })).json.data;
  const dept = (await api('/masters/departments', { method: 'POST', token: adminToken, body: { name: 'Sewing' } })).json.data;
  const line1 = (await api('/masters/production-lines', { method: 'POST', token: adminToken, body: { name: 'Line 1', departmentId: dept._id } })).json.data;
  const line2 = (await api('/masters/production-lines', { method: 'POST', token: adminToken, body: { name: 'Line 2', departmentId: dept._id } })).json.data;
  line1Id = line1._id;
  line2Id = line2._id;

  const emp = (await api('/masters/employees', { method: 'POST', token: adminToken, body: { employeeCode: 'E-001', name: 'Operator One', productionLineId: line1Id } })).json.data;
  empId = emp._id;
  const proc = (await api('/masters/processes', { method: 'POST', token: adminToken, body: { name: 'Collar Attach' } })).json.data;
  procId = proc._id;
  const mach = (await api('/masters/machines', { method: 'POST', token: adminToken, body: { machineNumber: 'SNLS-12', name: 'Single Needle Lockstitch', productionLineId: line1Id } })).json.data;
  machId = mach._id;
  const needle = (await api('/masters/needles', { method: 'POST', token: adminToken, body: { needleNumber: 'DBx1-14', name: 'Ball Point #14' } })).json.data;
  needleId = needle._id;
  const spec = (await api('/masters/measurement-specs', {
    method: 'POST',
    token: adminToken,
    body: {
      styleId,
      size: 'M',
      measurementPoint: 'Chest Width',
      unit: 'cm',
      approvedSpec: 52,
      upperTolerance: 0.5,
      lowerTolerance: -0.5,
    },
  })).json.data;
  specId = spec._id;

  const order = (await api('/masters/orders', {
    method: 'POST',
    token: adminToken,
    body: {
      orderNumber: 'ORD-2026-01',
      buyerId,
      styleId,
      orderQuantity: 5000,
      fabricId: fabric._id,
      gsmId: gsm._id,
      colourId: colour._id,
      supplierId: supplier._id,
      sizeRangeId: sizeRange._id,
    },
  })).json.data;
  orderId = order._id;

  const populated = await api(`/masters/orders/${orderId}/populated`, { token: adminToken });
  assert.equal(populated.status, 200);
  assert.equal(populated.json.data.autoFilled.buyerName, 'Buyer Alpha');
  assert.equal(populated.json.data.autoFilled.styleNumber, 'STY-101');
  assert.equal(populated.json.data.autoFilled.gsmValue, 210);
  assert.deepEqual(populated.json.data.autoFilled.sizes, ['S', 'M', 'L', 'XL']);

  // Create QC Inspector (assigned to Line 1) and Quality Manager
  await api('/users', {
    method: 'POST',
    token: adminToken,
    body: {
      username: 'qc1',
      fullName: 'Inspector One',
      password: 'Password123!',
      role: 'QC Inspector',
      assignedLines: [line1Id],
    },
  });
  await api('/users', {
    method: 'POST',
    token: adminToken,
    body: {
      username: 'qam1',
      fullName: 'Manager One',
      password: 'Password123!',
      role: 'Quality Manager',
    },
  });

  qcToken = (await api('/auth/login', { method: 'POST', body: { identifier: 'qc1', password: 'Password123!' } })).json.data.token;
  managerToken = (await api('/auth/login', { method: 'POST', body: { identifier: 'qam1', password: 'Password123!' } })).json.data.token;

  // QC Inspector cannot modify Master Data
  const blockedMasterEdit = await api('/masters/buyers', {
    method: 'POST',
    token: qcToken,
    body: { name: 'Unauthorized Buyer' },
  });
  assert.equal(blockedMasterEdit.status, 403);
});

test('4. Image upload persistence, 4 inspection workflows, exports & dashboard', async () => {
  // Upload a tiny valid 1x1 PNG
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const fd = new FormData();
  fd.append('module', 'size_set');
  fd.append('itemKey', 'acc_button');
  fd.append('file', new Blob([pngBytes], { type: 'image/png' }), 'defect.png');

  const uploadRes = await api('/attachments/upload', { method: 'POST', token: qcToken, body: fd });
  assert.equal(uploadRes.status, 201);
  uploadedAttachmentId = uploadRes.json.data._id;

  const fetchedImg = await api(`/attachments/${uploadedAttachmentId}/file`, { token: managerToken, isRaw: true });
  assert.equal(fetchedImg.status, 200);
  assert.equal(fetchedImg.buffer.length, pngBytes.length);

  // Module 1: Target Chart + line scoping test
  const line2Tc = await api('/inspections/target-charts', {
    method: 'POST',
    token: adminToken,
    body: {
      productionLineId: line2Id,
      inspectionDate: '2026-11-12',
      indicators: Array.from({ length: 15 }, (_, idx) => ({
        index: idx + 1,
        name: `KPI ${idx + 1}`,
        targetValue: 100,
        actualValue: 80,
      })),
    },
  });
  assert.equal(line2Tc.status, 201);

  // QC assigned only to Line 1 cannot view Line 2 Target Chart
  const scopedOut = await api(`/inspections/target-charts/${line2Tc.json.data._id}`, { token: qcToken });
  assert.equal(scopedOut.status, 403);

  // Module 2: Size Set (QC cannot mark N/A by default; duplicate submissionToken deduplicates)
  const naBlocked = await api('/inspections/size-sets', {
    method: 'POST',
    token: qcToken,
    body: {
      orderId,
      inspectionStage: 'Size Set',
      inspectionDate: '2026-11-12',
      productionLineId: line1Id,
      accessories: [{ itemKey: 'acc_button', label: 'Button / Button Holes', status: 'N/A' }],
    },
  });
  assert.equal(naBlocked.status, 403);

  const ssToken = 'idemp-ss-001';
  const ssCreate = await api('/inspections/size-sets', {
    method: 'POST',
    token: qcToken,
    body: {
      submissionToken: ssToken,
      orderId,
      inspectionStage: 'Size Set',
      inspectionDate: '2026-11-12',
      productionLineId: line1Id,
      accessories: [
        {
          itemKey: 'acc_button',
          label: 'Button / Button Holes',
          status: 'OK',
          attachmentIds: [uploadedAttachmentId],
        },
      ],
      workmanship: [{ itemKey: 'wrk_stitching', label: 'Stitching', status: 'OK', isCritical: true }],
      labelling: [{ itemKey: 'lbl_main_label', label: 'Main Label', status: 'OK', isCritical: true }],
      ppsTopStatus: 'Approved',
      productionStatus: 'Cleared',
      submitImmediately: true,
    },
  });
  assert.equal(ssCreate.status, 201);
  const ssId = ssCreate.json.data._id;

  // Duplicate submissionToken returns existing doc without creating a second one
  const ssDup = await api('/inspections/size-sets', {
    method: 'POST',
    token: qcToken,
    body: { submissionToken: ssToken, orderId, inspectionStage: 'Size Set', inspectionDate: '2026-11-12' },
  });
  assert.equal(ssDup.json.deduplicated, true);
  assert.equal(ssDup.json.data._id, ssId);

  // Quality Manager approves Size Set
  const ssApprove = await api(`/inspections/size-sets/${ssId}/approve`, {
    method: 'POST',
    token: managerToken,
    body: { decision: 'Accepted', comments: 'All checks passed.' },
  });
  assert.equal(ssApprove.status, 200);
  assert.equal(ssApprove.json.data.approvalStatus, 'Approved');

  // Cannot overwrite Approved report without revision
  const overwriteBlocked = await api(`/inspections/size-sets/${ssId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { orderId, inspectionStage: 'Size Set', inspectionDate: '2026-11-12' },
  });
  assert.equal(overwriteBlocked.status, 409);

  // Controlled Revision works
  const revised = await api(`/inspections/size-sets/${ssId}/revise`, {
    method: 'POST',
    token: adminToken,
    body: { reason: 'Correcting remarks' },
  });
  assert.equal(revised.status, 200);
  assert.equal(revised.json.data.version, 2);
  assert.equal(revised.json.data.revisionHistory.length, 1);

  // Module 3: 7 Point sequential workflow
  const spCreate = await api('/inspections/seven-points', {
    method: 'POST',
    token: qcToken,
    body: {
      orderId,
      inspectionDate: '2026-11-12',
      productionLineId: line1Id,
      entries: [
        {
          serialNumber: 1,
          employeeId: empId,
          processId: procId,
          machineId: machId,
          needleId,
          piecesChecked: 50,
          okPieces: 46,
          reworkPieces: 3,
          rejectedPieces: 1,
          oilDefectCount: 1,
        },
      ],
      submitImmediately: true,
    },
  });
  assert.equal(spCreate.status, 201);
  const spId = spCreate.json.data._id;
  assert.equal(spCreate.json.data.totals.reworkPercentage, 6);

  // QAM cannot skip QC and Supervisor stages when sequential approval is enforced
  const skipBlocked = await api(`/inspections/seven-points/${spId}/approve`, {
    method: 'POST',
    token: managerToken,
    body: { stage: 'QAM', comments: 'Skipping ahead' },
  });
  assert.equal(skipBlocked.status, 400);

  // Module 4: Measurement Inspection
  const msCreate = await api('/inspections/measurements', {
    method: 'POST',
    token: qcToken,
    body: {
      orderId,
      buyerId,
      styleId,
      productionLineId: line1Id,
      inspectionDate: '2026-11-12',
      inspectionStage: 'In-line',
      rows: [
        {
          specId,
          size: 'M',
          actualMeasurement: 52.3,
          remarks: 'Good',
        },
      ],
      submitImmediately: true,
    },
  });
  assert.equal(msCreate.status, 201);
  const msId = msCreate.json.data._id;
  assert.equal(msCreate.json.data.rows[0].difference, 0.3);
  assert.equal(msCreate.json.data.rows[0].result, 'Pass');

  const line2TcId = line2Tc.json.data._id;

  // Target Chart Analytics endpoint
  const tcAnalytics = await api('/inspections/target-charts/analytics', { token: adminToken });
  assert.equal(tcAnalytics.status, 200);
  assert.ok(tcAnalytics.json.data.totals.totalTargets >= 15);
  assert.ok(tcAnalytics.json.data.lineWise.length >= 1);
  assert.ok(tcAnalytics.json.data.dateWise.length >= 1);

  // Return for Correction -> edit -> re-submit lifecycle on 7 Point report
  const qcStageApprove = await api(`/inspections/seven-points/${spId}/approve`, {
    method: 'POST',
    token: adminToken,
    body: { stage: 'QC', comments: 'QC verified' },
  });
  assert.equal(qcStageApprove.status, 200);
  const returned = await api(`/inspections/seven-points/${spId}/reject`, {
    method: 'POST',
    token: adminToken,
    body: { stage: 'Supervisor', returnForCorrection: true, comments: 'Recheck machine #12' },
  });
  assert.equal(returned.status, 200);
  assert.equal(returned.json.data.approvalStatus, 'Returned for Correction');

  const spEdited = await api(`/inspections/seven-points/${spId}`, {
    method: 'PATCH',
    token: qcToken,
    body: {
      orderId,
      inspectionDate: '2026-11-12',
      productionLineId: line1Id,
      remarks: 'Corrected needle change log',
      entries: [
        {
          serialNumber: 1,
          employeeId: empId,
          processId: procId,
          machineId: machId,
          needleId,
          piecesChecked: 50,
          okPieces: 47,
          reworkPieces: 2,
          rejectedPieces: 1,
          oilDefectCount: 0,
        },
      ],
    },
  });
  assert.equal(spEdited.status, 200);
  assert.equal(spEdited.json.data.totals.reworkPercentage, 4);

  const spResubmit = await api(`/inspections/seven-points/${spId}/submit`, {
    method: 'POST',
    token: qcToken,
  });
  assert.equal(spResubmit.status, 200);
  assert.equal(spResubmit.json.data.approvalStatus, 'Pending Approval');

  // PDF & Individual Excel exports for all 4 modules
  for (const [mod, recId] of [
    ['target-charts', line2TcId],
    ['size-sets', ssId],
    ['seven-points', spId],
    ['measurements', msId],
  ]) {
    const pdfRes = await api(`/exports/pdf/${mod}/${recId}`, { token: adminToken, isRaw: true });
    assert.equal(pdfRes.status, 200, `PDF export failed for ${mod}`);
    assert.equal(pdfRes.buffer.subarray(0, 4).toString(), '%PDF');

    const indivXlRes = await api(`/exports/excel/individual/${mod}/${recId}`, { token: adminToken, isRaw: true });
    assert.equal(indivXlRes.status, 200, `Individual Excel export failed for ${mod}`);
    const indivWb = new ExcelJS.Workbook();
    await indivWb.xlsx.load(indivXlRes.buffer);
    assert.ok(indivWb.worksheets.length >= 1);
    assert.ok(indivWb.worksheets[0].rowCount >= 2);
  }

  const xlRes = await api('/exports/excel?reportType=monthly', { token: managerToken, isRaw: true });
  assert.equal(xlRes.status, 200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlRes.buffer);
  assert.equal(wb.worksheets.length, 1); // Monthly report in a single worksheet
  assert.ok(wb.worksheets[0].rowCount >= 4);

  // Dashboard analytics
  const dash = await api('/dashboard/analytics', { token: managerToken });
  assert.equal(dash.status, 200);
  assert.equal(dash.json.data.summaryCards.totalInspections, 4);
  assert.ok(dash.json.data.charts.dailyTrend.length >= 1);
  assert.ok(dash.json.data.charts.employeeProcessAnalysis.length >= 1);

  // Archive & Restore lifecycle (no permanent delete)
  const archived = await api(`/inspections/measurements/${msId}/archive`, {
    method: 'PATCH',
    token: adminToken,
    body: { isArchived: true, reason: 'Archived during verification' },
  });
  assert.equal(archived.status, 200);
  assert.equal(archived.json.data.isArchived, true);

  const restored = await api(`/inspections/measurements/${msId}/archive`, {
    method: 'PATCH',
    token: adminToken,
    body: { isArchived: false, reason: 'Restored after check' },
  });
  assert.equal(restored.status, 200);
  assert.equal(restored.json.data.isArchived, false);

  // Audit Logs API
  const auditRes = await api('/audit-logs?limit=20', { token: adminToken });
  assert.equal(auditRes.status, 200);
  assert.ok(auditRes.json.data.length >= 5);
});
