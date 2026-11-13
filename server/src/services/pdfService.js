import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';
import { CompanySetting } from '../models/CompanySetting.js';
import { InspectionAttachment } from '../models/InspectionAttachment.js';
import { ApprovalHistory } from '../models/ApprovalHistory.js';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toISOString().slice(0, 10);
}

function formatDateTime(d) {
  if (!d) return '-';
  return new Date(d).toISOString().replace('T', ' ').slice(0, 16);
}

async function resolveAttachmentPath(attachmentId) {
  if (!attachmentId) return null;
  const att = await InspectionAttachment.findById(attachmentId).lean();
  if (!att || att.isArchived) return null;
  const abs = path.resolve(env.uploadDir, att.relativePath);
  if (!fs.existsSync(abs)) return null;
  return { abs, att };
}

function ensureSpace(doc, neededHeight = 80) {
  if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function drawSectionBanner(doc, title) {
  ensureSpace(doc, 32);
  const startY = doc.y;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.save();
  doc.rect(doc.page.margins.left, startY, width, 20).fill('#1e3a5f');
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .text(title, doc.page.margins.left + 8, startY + 5, { width: width - 16 });
  doc.restore();
  doc.y = startY + 25;
}

function drawKeyValueGrid(doc, pairs, cols = 2) {
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colW = width / cols;
  const rowH = 18;

  for (let i = 0; i < pairs.length; i += cols) {
    ensureSpace(doc, rowH + 4);
    const y = doc.y;
    for (let c = 0; c < cols; c += 1) {
      const pair = pairs[i + c];
      const x = doc.page.margins.left + c * colW;
      doc.save();
      doc.rect(x, y, colW, rowH).strokeColor('#cbd5e1').lineWidth(0.6).stroke();
      if (pair) {
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#475569')
          .text(`${pair[0]}:`, x + 5, y + 5, { width: 92, ellipsis: true });
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#0f172a')
          .text(String(pair[1] ?? '-'), x + 98, y + 5, { width: colW - 104, ellipsis: true });
      }
      doc.restore();
    }
    doc.y = y + rowH;
  }
  doc.y += 6;
}

function drawSimpleTable(doc, headers, rows, colWidths) {
  const startX = doc.page.margins.left;
  const headerH = 20;

  const drawHeaderRow = () => {
    ensureSpace(doc, headerH + 20);
    let x = startX;
    const y = doc.y;
    doc.save();
    headers.forEach((h, i) => {
      doc.rect(x, y, colWidths[i], headerH).fillAndStroke('#e2e8f0', '#94a3b8');
      doc
        .fillColor('#0f172a')
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(h, x + 4, y + 6, { width: colWidths[i] - 8, ellipsis: true });
      x += colWidths[i];
    });
    doc.restore();
    doc.y = y + headerH;
  };

  drawHeaderRow();

  for (const row of rows) {
    const heights = row.map((cell, i) =>
      doc.heightOfString(String(cell ?? ''), { width: colWidths[i] - 8, align: 'left' })
    );
    const rowH = Math.max(18, Math.max(...heights) + 8);
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeaderRow();
    }
    const y = doc.y;
    let x = startX;
    row.forEach((cell, i) => {
      doc.rect(x, y, colWidths[i], rowH).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#1e293b')
        .text(String(cell ?? ''), x + 4, y + 4, { width: colWidths[i] - 8 });
      x += colWidths[i];
    });
    doc.y = y + rowH;
  }
  doc.y += 8;
}

async function drawHeader(doc, company, reportTitle, reportNumber, status) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startY = doc.y;

  let textX = left;
  if (company?.logoAttachmentId) {
    const resolved = await resolveAttachmentPath(company.logoAttachmentId);
    if (resolved) {
      try {
        doc.image(resolved.abs, left, startY, { fit: [48, 48] });
        textX = left + 56;
      } catch {
        // Fallback silently if image fails to decode
      }
    }
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor('#0f172a')
    .text(company?.companyName || 'Garment Quality Management System', textX, startY, {
      width: width - 170,
    });

  if (company?.companyAddress) {
    doc.font('Helvetica').fontSize(8).fillColor('#475569').text(company.companyAddress, textX);
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#1e3a5f')
    .text(reportTitle, textX, Math.max(doc.y + 2, startY + 22));

  // Right badge
  const badgeX = left + width - 155;
  doc.save();
  doc.rect(badgeX, startY, 155, 44).fillAndStroke('#f8fafc', '#94a3b8');
  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#0f172a')
    .text(`Report #: ${reportNumber}`, badgeX + 6, startY + 6, { width: 143 });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#334155')
    .text(`Status: ${status}`, badgeX + 6, startY + 20, { width: 143 });
  doc.restore();

  doc.y = Math.max(doc.y, startY + 50);
  doc
    .moveTo(left, doc.y)
    .lineTo(left + width, doc.y)
    .strokeColor('#1e3a5f')
    .lineWidth(1.5)
    .stroke();
  doc.y += 10;
}

async function drawApprovalFooter(doc, inspectionType, reportDoc, history) {
  drawSectionBanner(doc, 'APPROVAL & AUDIT TRAIL');
  drawKeyValueGrid(doc, [
    ['Approval Status', reportDoc.approvalStatus],
    ['Version', `v${reportDoc.version || 1}`],
    ['Inspector', reportDoc.inspectorName],
    ['Submitted At', formatDateTime(reportDoc.submittedAt)],
    ['Finalized At', formatDateTime(reportDoc.finalizedAt)],
    ['Archived', reportDoc.isArchived ? `Yes (${reportDoc.archiveReason})` : 'No'],
  ]);

  if (Array.isArray(reportDoc.workflowStages) && reportDoc.workflowStages.length > 0) {
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    drawSimpleTable(
      doc,
      ['Stage', 'Required', 'Status', 'Approver', 'Role', 'Timestamp', 'Comments'],
      reportDoc.workflowStages.map((s) => [
        s.stage,
        s.required ? 'Yes' : 'Optional',
        s.status,
        s.actionByName || '-',
        s.actionByRole || '-',
        formatDateTime(s.actionAt),
        s.comments || '-',
      ]),
      [60, 50, 75, 90, 70, 80, width - 425]
    );
  }

  if (history.length > 0) {
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    drawSimpleTable(
      doc,
      ['Timestamp', 'Stage', 'Action', 'By', 'Role', 'Comments'],
      history.slice(0, 10).map((h) => [
        formatDateTime(h.timestamp),
        h.stage || '-',
        h.action,
        h.approverName,
        h.approverRole,
        h.comments || '-',
      ]),
      [85, 70, 75, 95, 75, width - 400]
    );
  }
}

export async function generateInspectionPdfBuffer(inspectionType, reportDoc) {
  const company = await CompanySetting.findOne({ key: 'default' }).lean();
  const history = await ApprovalHistory.find({
    inspectionType,
    inspectionId: reportDoc._id,
  })
    .sort({ timestamp: -1 })
    .lean();

  const isLandscape = inspectionType === 'seven_point' || inspectionType === 'measurement';
  const doc = new PDFDocument({
    size: 'A4',
    layout: isLandscape ? 'landscape' : 'portrait',
    margin: 32,
  });

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const titles = {
    target_chart: 'PRODUCTION LINE TARGET CHART REPORT',
    size_set: `${String(reportDoc.inspectionStage || 'SIZE SET').toUpperCase()} INSPECTION REPORT`,
    seven_point: '7 POINT PRODUCTION QUALITY INSPECTION REPORT',
    measurement: 'GARMENT MEASUREMENT INSPECTION REPORT',
  };

  await drawHeader(
    doc,
    company,
    titles[inspectionType] || 'QUALITY INSPECTION REPORT',
    reportDoc.reportNumber,
    reportDoc.approvalStatus
  );

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  if (inspectionType === 'target_chart') {
    drawKeyValueGrid(doc, [
      ['Production Line', reportDoc.productionLineName],
      ['Inspection Date', formatDate(reportDoc.inspectionDate)],
      ['Shift', reportDoc.shift],
      ['Overall Achievement', `${reportDoc.summary?.achievementPercentage ?? 0}%`],
      ['Total Target', reportDoc.summary?.totalTarget ?? 0],
      ['Total Achieved / Pending', `${reportDoc.summary?.totalAchieved ?? 0} / ${reportDoc.summary?.totalPending ?? 0}`],
    ]);

    drawSectionBanner(doc, '15 CONCENTRIC TARGET INDICATORS (50% / 75% / 100% LEVELS)');
    const cols = 3;
    const cellW = pageWidth / cols;
    const cellH = 96;
    const indicators = reportDoc.indicators || [];

    for (let row = 0; row < 5; row += 1) {
      ensureSpace(doc, cellH + 8);
      const rowY = doc.y;
      for (let col = 0; col < cols; col += 1) {
        const ind = indicators[row * cols + col];
        if (!ind) continue;
        const boxX = doc.page.margins.left + col * cellW;
        doc.save();
        doc.dash(3, { space: 2 }).rect(boxX, rowY, cellW, cellH).strokeColor('#334155').lineWidth(0.7).stroke();

        const cx = boxX + 38;
        const cy = rowY + 48;
        // 100% Outer dashed, 75% inner dashed, 50% center dot (matching paper form)
        doc.dash(2.5, { space: 2 }).circle(cx, cy, 28).strokeColor('#1e293b').lineWidth(0.9).stroke();
        doc.dash(2.5, { space: 2 }).circle(cx, cy, 18).strokeColor('#1e293b').lineWidth(0.8).stroke();
        doc.undash();

        const pct = Math.min(100, Math.max(0, Number(ind.achievementPercentage || 0)));
        if (Number(ind.actualValue || 0) > 0) {
          const fillR = Math.max(3, (pct / 100) * 28);
          const fillColor = pct >= 100 ? '#16a34a' : pct >= 75 ? '#2563eb' : pct >= 50 ? '#d97706' : '#dc2626';
          doc.circle(cx, cy, fillR).fillOpacity(0.2).fill(fillColor);
          doc.fillOpacity(1).circle(cx, cy, fillR).strokeColor(fillColor).lineWidth(1.4).stroke();
        }
        doc.circle(cx, cy, 2.2).fill('#0f172a');

        doc
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor('#1e293b')
          .text('50%', cx + 4, cy - 8)
          .text('75%', cx + 12, cy - 18)
          .text('100%', cx + 21, cy - 28);

        const infoX = boxX + 74;
        const infoW = cellW - 80;
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#0f172a')
          .text(`${ind.index}. ${ind.name}`, infoX, rowY + 8, { width: infoW, ellipsis: true });
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#334155')
          .text(`Target: ${ind.targetValue} ${ind.unit}`, infoX, rowY + 26, { width: infoW })
          .text(`Actual: ${ind.actualValue} ${ind.unit}`, infoX, rowY + 38, { width: infoW })
          .text(`Achievement: ${ind.achievementPercentage ?? 0}%`, infoX, rowY + 50, { width: infoW })
          .text(`Level: ${ind.levelReached}`, infoX, rowY + 62, { width: infoW });
        doc.restore();
      }
      doc.y = rowY + cellH;
    }
    doc.y += 8;
    if (reportDoc.remarks) {
      drawKeyValueGrid(doc, [['Remarks', reportDoc.remarks]], 1);
    }
  } else if (inspectionType === 'size_set') {
    const h = reportDoc.headerSnapshot || {};
    drawKeyValueGrid(doc, [
      ['Form Code', 'QF - 40'],
      ['Buyer', h.buyerName],
      ['Inspection Date', formatDate(reportDoc.inspectionDate)],
      ['Fabric', h.fabricName],
      ['Description', h.description],
      ['GSM', h.gsmLabel],
      ['Style No.', h.styleNumber],
      ['Order Qty', h.orderQuantity],
      ['Order No.', h.orderNumber],
      ['Colour', h.colourName],
      ['Supplier', h.supplierName],
      ['Size Range', h.sizeRangeName],
    ]);

    // Unified QF-40 3-column sheet
    const photoIds = [];
    const acc = reportDoc.accessories || [];
    const wrk = reportDoc.workmanship || [];
    const lbl = reportDoc.labelling || [];
    const totalRows = Math.max(acc.length + 2, wrk.length, lbl.length);

    acc.forEach((i) => (i.attachmentIds || []).forEach((id) => photoIds.push({ id, caption: `Accessories: ${i.label}` })));
    wrk.forEach((i) => (i.attachmentIds || []).forEach((id) => photoIds.push({ id, caption: `Workmanship: ${i.label}` })));
    lbl.forEach((i) => (i.attachmentIds || []).forEach((id) => photoIds.push({ id, caption: `Labelling: ${i.label}` })));

    const groupW = pageWidth / 3;
    const itemColW = groupW - 56;
    const triWidths = [itemColW, 28, 28, itemColW, 28, 28, itemColW, 28, 28];
    const triHeaders = [
      '1. ACCESSORIES', 'OK', 'N/OK',
      '2. WORKMANSHIP', 'OK', 'N/OK',
      '3. LABELING', 'OK', 'N/OK',
    ];
    const triRows = Array.from({ length: totalRows }, (_, idx) => {
      const a = acc[idx];
      const w = wrk[idx];
      const l = lbl[idx];

      let aCells = ['', '', ''];
      if (a) {
        aCells = [`1.${idx + 1} ${a.label}${a.remarks ? ` (${a.remarks})` : ''}`, a.status === 'OK' ? 'OK' : a.status === 'N/A' ? 'N/A' : '', a.status === 'Not OK' ? 'X' : ''];
      } else if (idx === acc.length) {
        aCells = [`Approval Status: ${reportDoc.approvalStatus}`, '', ''];
      } else if (idx === acc.length + 1) {
        aCells = [`PPS/TOP: ${reportDoc.ppsTopStatus || '-'}`, '', ''];
      }

      const wCells = w
        ? [`2.${idx + 1} ${w.label}${w.remarks ? ` (${w.remarks})` : ''}`, w.status === 'OK' ? 'OK' : w.status === 'N/A' ? 'N/A' : '', w.status === 'Not OK' ? 'X' : '']
        : ['', '', ''];
      const lCells = l
        ? [`3.${idx + 1} ${l.label}${l.remarks ? ` (${l.remarks})` : ''}`, l.status === 'OK' ? 'OK' : l.status === 'N/A' ? 'N/A' : '', l.status === 'Not OK' ? 'X' : '']
        : ['', '', ''];

      return [...aCells, ...wCells, ...lCells];
    });
    drawSimpleTable(doc, triHeaders, triRows, triWidths);

    const c = reportDoc.calculations || {};
    drawKeyValueGrid(doc, [
      ['Production Status', reportDoc.productionStatus || '-'],
      ['Final Decision', `${reportDoc.finalDecision || 'Pending'} (ACCEPTED [${reportDoc.finalDecision === 'Accepted' ? 'X' : ' '}]  RE WORK [${reportDoc.finalDecision === 'Rework' ? 'X' : ' '}]  HOLD [${reportDoc.finalDecision === 'Hold' ? 'X' : ' '}])`],
      ['Applicable / OK / Not OK / N/A', `${c.totalApplicableItems ?? 0} / ${c.totalOkItems ?? 0} / ${c.totalNotOkItems ?? 0} / ${c.totalNaItems ?? 0}`],
      ['Completion % / OK % / Not OK %', `${c.completionPercentage ?? 0}% / ${c.overallOkPercentage ?? 0}% / ${c.overallNotOkPercentage ?? 0}%`],
      ['Comments', reportDoc.comments || '-'],
      ['Signatures', `FACTORY: ${h.supplierName || '-'}   |   QC: ${reportDoc.inspectorName || '-'}   |   QAM: ${reportDoc.approvalStatus}`],
    ]);

    if (photoIds.length > 0) {
      drawSectionBanner(doc, 'ATTACHED DEFECT PHOTOGRAPHS');
      for (const p of photoIds.slice(0, 8)) {
        const resolved = await resolveAttachmentPath(p.id);
        if (!resolved) continue;
        ensureSpace(doc, 130);
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text(p.caption);
        try {
          doc.image(resolved.abs, doc.page.margins.left, doc.y + 4, { fit: [180, 110] });
          doc.y += 120;
        } catch {
          doc.font('Helvetica').fontSize(8).text('[Image could not be rendered]');
        }
      }
    }
  } else if (inspectionType === 'seven_point') {
    const h = reportDoc.headerSnapshot || {};
    drawKeyValueGrid(
      doc,
      [
        ['LINE NO', h.productionLineName || '-'],
        ['STYLE NO', h.styleNumber],
        ['FABRIC', h.fabricName],
        ['DATE', formatDate(reportDoc.inspectionDate)],
        ['QC', reportDoc.qcName],
        ['STYLE NAME', h.styleName],
        ['COLOUR', h.colourName],
        ['ORDER QTY', h.orderQuantity],
      ],
      4
    );

    const cpDefs = reportDoc.checkpointDefinitions || [];
    const fixedCols = [24, 92, 46, 68, 56, 44, 38];
    const fixedSum = fixedCols.reduce((a, b) => a + b, 0);
    const tailSum = 120; // Chk/OK/Rwk/Rej/Oil
    const cpCount = Math.max(1, cpDefs.length);
    const cpW = Math.max(22, Math.floor((pageWidth - fixedSum - tailSum) / cpCount));
    const widths = [...fixedCols, ...cpDefs.map(() => cpW), 24, 24, 24, 24, 24];
    const headers = [
      'S.NO',
      'NAME',
      'ID NO',
      'PROCESS',
      'MACHINE',
      'NEEDLE',
      'NDL TM',
      ...cpDefs.map((d) => String(d.checkpointNumber)),
      'CHK',
      'OK',
      'R/W',
      'OIL',
      'REJ',
    ];

    const startX = doc.page.margins.left;
    const headerH = 20;
    const draw7pHead = () => {
      ensureSpace(doc, headerH + 22);
      let x = startX;
      const y = doc.y;
      doc.save();
      headers.forEach((hd, i) => {
        doc.rect(x, y, widths[i], headerH).fillAndStroke('#e2e8f0', '#334155');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.8).text(hd, x + 2, y + 6, { width: widths[i] - 4, align: i >= 7 ? 'center' : 'left' });
        x += widths[i];
      });
      doc.restore();
      doc.y = y + headerH;
    };
    draw7pHead();

    const cpStartIdx = 7;
    const cpEndIdx = 7 + cpCount - 1;
    for (const e of reportDoc.entries || []) {
      const rowH = 22;
      if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        draw7pHead();
      }
      const rowY = doc.y;
      let x = startX;
      const cells = [
        e.serialNumber,
        e.employeeName,
        e.employeeCode || '-',
        e.processName,
        e.machineNumber || e.machineName || '-',
        e.needleNumber || '-',
        e.needleChangeTime || '-',
        ...cpDefs.map((d) => {
          const cp = (e.checkpoints || []).find((c) => c.checkpointNumber === d.checkpointNumber);
          return cp?.status || 'Pass';
        }),
        e.piecesChecked,
        e.okPieces,
        e.reworkPieces,
        e.oilDefectCount,
        e.rejectedPieces,
      ];
      cells.forEach((val, idx) => {
        const w = widths[idx];
        doc.save();
        doc.rect(x, rowY, w, rowH).strokeColor('#334155').lineWidth(0.5).stroke();
        if (idx >= cpStartIdx && idx <= cpEndIdx) {
          // Draw diagonal slash matching paper 7-Point form
          doc.moveTo(x + w, rowY).lineTo(x, rowY + rowH).strokeColor('#64748b').lineWidth(0.5).stroke();
          if (val === 'Fail') {
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#dc2626').text('X', x + w - 10, rowY + rowH - 10);
          } else if (val === 'N/A') {
            doc.font('Helvetica').fontSize(6).fillColor('#64748b').text('N/A', x + 2, rowY + 7);
          } else {
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#15803d').text('OK', x + 2, rowY + 3);
          }
        } else {
          doc.font('Helvetica').fontSize(7).fillColor('#0f172a').text(String(val ?? ''), x + 3, rowY + 6, { width: w - 6, ellipsis: true });
        }
        doc.restore();
        x += w;
      });
      doc.y = rowY + rowH;
    }
    doc.y += 6;

    const t = reportDoc.totals || {};
    drawKeyValueGrid(
      doc,
      [
        ['TTL NO CHECKED PCS', t.totalPiecesChecked ?? 0],
        ['OK PCS', `${t.okPieces ?? 0} (${t.okPercentage ?? 0}%)`],
        ['REWORK / R/W %', `${t.reworkPieces ?? 0} (${t.reworkPercentage ?? 0}%)`],
        ['OIL / OIL %', `${t.oilDefectCount ?? 0} (${t.oilPercentage ?? 0}%)`],
        ['REJECTION / REJ %', `${t.rejectedPieces ?? 0} (${t.rejectionPercentage ?? 0}%)`],
        ['REMARKS', reportDoc.remarks || '-'],
      ],
      3
    );
  } else if (inspectionType === 'measurement') {
    const h = reportDoc.headerSnapshot || {};
    drawKeyValueGrid(
      doc,
      [
        ['ORDER No.', h.orderNumber || '-'],
        ['FABRIC / GSM / COLOUR', `${h.fabricName || '-'} / ${h.gsmLabel || '-'} / ${h.colourName || '-'}`],
        ['ORDER QTY', h.orderQuantity],
        ['STYLE No.', h.styleNumber],
        ['BUYER', h.buyerName],
        ['SUPPLIER', h.supplierName || '-'],
        ['STYLE DESCRIPTION', h.styleDescription],
        ['STAGE', reportDoc.inspectionStage],
        ['DATE', formatDate(reportDoc.inspectionDate)],
      ],
      3
    );

    drawSectionBanner(doc, `SIZE / SPEC / DIFFERENCE MATRIX — ${String(reportDoc.inspectionStage || '').toUpperCase()}`);
    const rows = reportDoc.rows || [];
    const sizes = [...new Set(rows.map((r) => r.size))];
    const pointMap = new Map();
    for (const r of rows) {
      const key = `${r.measurementPoint}||${r.unit}`;
      if (!pointMap.has(key)) {
        pointMap.set(key, {
          label: `${r.measurementPoint} (${r.unit}, ${r.lowerTolerance}/+${r.upperTolerance})`,
          byKey: new Map(),
          specBySize: new Map(),
        });
      }
      const pt = pointMap.get(key);
      if (!pt.specBySize.has(r.size)) pt.specBySize.set(r.size, r.approvedSpec);
      pt.byKey.set(`${r.size}__${Number(r.sampleIndex || 1)}`, r);
    }

    const headers = ['MEASUREMENT POINT'];
    const widths = [145];
    const sizeSamples = {};
    const remainingW = pageWidth - 145;
    let totalCols = 0;
    for (const sz of sizes) {
      const sNums = [...new Set(rows.filter((r) => r.size === sz).map((r) => Number(r.sampleIndex || 1)))].sort((a, b) => a - b);
      sizeSamples[sz] = sNums;
      totalCols += 1 + sNums.length;
    }
    const perSubCol = totalCols > 0 ? Math.max(36, Math.floor(remainingW / totalCols)) : 60;
    for (const sz of sizes) {
      headers.push(`${sz} SPEC`);
      widths.push(perSubCol);
      for (const sn of sizeSamples[sz]) {
        headers.push(`${sz} #${sn} DIFF`);
        widths.push(perSubCol);
      }
    }

    const matrixTableRows = [...pointMap.values()].map((pt) => {
      const out = [pt.label];
      for (const sz of sizes) {
        const sp = pt.specBySize.get(sz);
        out.push(sp !== undefined ? String(sp) : '-');
        for (const sn of sizeSamples[sz]) {
          const cell = pt.byKey.get(`${sz}__${sn}`);
          if (!cell) {
            out.push('-');
          } else {
            const d = cell.difference > 0 ? `+${cell.difference}` : String(cell.difference);
            out.push(`${cell.actualMeasurement} (${d}) ${cell.withinTolerance ? 'OK' : 'FAIL'}`);
          }
        }
      }
      return out;
    });
    drawSimpleTable(doc, headers, matrixTableRows, widths);

    const s = reportDoc.summary || {};
    drawKeyValueGrid(doc, [
      ['Total Points Checked', s.totalPointsChecked ?? 0],
      ['Passed / Failed / Pass %', `${s.passedPoints ?? 0} / ${s.failedPoints ?? 0} (${s.passPercentage ?? 0}%)`],
      ['REMARKS', reportDoc.remarks || '-'],
      ['SPECIAL COMMENTS', reportDoc.specialComments || '-'],
      ['SIGNATURES', `Q.C.: ${reportDoc.inspectorName || '-'}   |   IC.Q.A.D: ${reportDoc.approvalStatus}   |   SUPPLIER: ${h.supplierName || '-'}`],
    ]);
  }

  await drawApprovalFooter(doc, inspectionType, reportDoc, history);
  doc.end();
  return done;
}

