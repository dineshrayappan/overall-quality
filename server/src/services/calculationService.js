import { AppError } from '../utils/errors.js';

export function roundTo(num, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(num) + Number.EPSILON) * factor) / factor;
}

export function calculateTargetChart(rawIndicators = []) {
  if (!Array.isArray(rawIndicators) || rawIndicators.length !== 15) {
    throw new AppError('Production Line Target Chart requires exactly 15 indicators (3x5 layout).', 400);
  }

  let activeIndicators = 0;
  let achievedIndicators = 0;
  let pendingIndicators = 0;
  let totalTarget = 0;
  let totalAchieved = 0;
  let totalPending = 0;

  const indicators = rawIndicators.map((item, idx) => {
    const targetValue = Number(item.targetValue ?? 0);
    const actualValue = Number(item.actualValue ?? 0);
    if (!Number.isFinite(targetValue) || targetValue < 0) {
      throw new AppError(`Indicator ${idx + 1}: Target value must be a non-negative number.`, 400);
    }
    if (!Number.isFinite(actualValue) || actualValue < 0) {
      throw new AppError(`Indicator ${idx + 1}: Actual achievement must be a non-negative number.`, 400);
    }

    const isActive = item.isActive !== false;
    const achievementPercentage = targetValue > 0 ? roundTo((actualValue / targetValue) * 100, 2) : 0;

    let levelReached = 'No Target';
    if (targetValue > 0) {
      if (achievementPercentage >= 100) levelReached = '100%+';
      else if (achievementPercentage >= 75) levelReached = '75%+';
      else if (achievementPercentage >= 50) levelReached = '50%+';
      else levelReached = 'Below 50%';
    }

    if (isActive) {
      activeIndicators += 1;
      totalTarget += targetValue;
      totalAchieved += actualValue;
      totalPending += Math.max(targetValue - actualValue, 0);
      if (targetValue > 0 && achievementPercentage >= 100) {
        achievedIndicators += 1;
      } else if (targetValue > 0) {
        pendingIndicators += 1;
      }
    }

    return {
      index: Number(item.index || idx + 1),
      code: String(item.code || `IND-${String(idx + 1).padStart(2, '0')}`),
      name: String(item.name || `Target Indicator ${idx + 1}`).trim(),
      unit: String(item.unit || 'pcs').trim(),
      isActive,
      targetValue,
      actualValue,
      achievementPercentage,
      levelReached,
      remarks: String(item.remarks || '').trim(),
    };
  });

  const overallPct = totalTarget > 0 ? roundTo((totalAchieved / totalTarget) * 100, 2) : 0;

  return {
    indicators,
    summary: {
      totalIndicators: 15,
      activeIndicators,
      achievedIndicators,
      pendingIndicators,
      totalTarget: roundTo(totalTarget, 2),
      totalAchieved: roundTo(totalAchieved, 2),
      totalPending: roundTo(totalPending, 2),
      achievementPercentage: overallPct,
    },
  };
}

function computeSectionStats(items = []) {
  const totalItems = items.length;
  let okItems = 0;
  let notOkItems = 0;
  let naItems = 0;
  let pendingItems = 0;

  for (const item of items) {
    if (item.status === 'OK') okItems += 1;
    else if (item.status === 'Not OK') notOkItems += 1;
    else if (item.status === 'N/A') naItems += 1;
    else pendingItems += 1;
  }

  const applicableItems = totalItems - naItems;
  const inspectedItems = okItems + notOkItems;
  const okPercentage = inspectedItems > 0 ? roundTo((okItems / inspectedItems) * 100, 2) : 0;
  const notOkPercentage = inspectedItems > 0 ? roundTo((notOkItems / inspectedItems) * 100, 2) : 0;

  return {
    totalItems,
    applicableItems,
    inspectedItems,
    okItems,
    notOkItems,
    naItems,
    pendingItems,
    okPercentage,
    notOkPercentage,
  };
}

export function calculateSizeSet({ accessories = [], workmanship = [], labelling = [] }, config = {}) {
  const accStats = computeSectionStats(accessories);
  const wrkStats = computeSectionStats(workmanship);
  const lblStats = computeSectionStats(labelling);

  const totalItems = accStats.totalItems + wrkStats.totalItems + lblStats.totalItems;
  const totalApplicableItems =
    accStats.applicableItems + wrkStats.applicableItems + lblStats.applicableItems;
  const totalInspectedItems =
    accStats.inspectedItems + wrkStats.inspectedItems + lblStats.inspectedItems;
  const totalOkItems = accStats.okItems + wrkStats.okItems + lblStats.okItems;
  const totalNotOkItems = accStats.notOkItems + wrkStats.notOkItems + lblStats.notOkItems;
  const totalNaItems = accStats.naItems + wrkStats.naItems + lblStats.naItems;
  const totalPendingItems = accStats.pendingItems + wrkStats.pendingItems + lblStats.pendingItems;

  const completionPercentage =
    totalApplicableItems > 0 ? roundTo((totalInspectedItems / totalApplicableItems) * 100, 2) : 100;
  const overallOkPercentage =
    totalInspectedItems > 0 ? roundTo((totalOkItems / totalInspectedItems) * 100, 2) : 0;
  const overallNotOkPercentage =
    totalInspectedItems > 0 ? roundTo((totalNotOkItems / totalInspectedItems) * 100, 2) : 0;

  const rules = config.acceptanceRules || {
    minOkPercentageForAccept: 95,
    blockAcceptIfAnyNotOk: true,
    blockAcceptIfCriticalNotOk: true,
    requireAllApplicableInspected: true,
  };

  const allItems = [...accessories, ...workmanship, ...labelling];
  const criticalFailures = allItems.filter((i) => i.isCritical && i.status === 'Not OK');
  const failedRules = [];

  if (rules.requireAllApplicableInspected && totalPendingItems > 0) {
    failedRules.push(`${totalPendingItems} applicable checklist item(s) are still pending.`);
  }
  if (rules.blockAcceptIfCriticalNotOk && criticalFailures.length > 0) {
    failedRules.push(
      `Critical checklist failure(s): ${criticalFailures.map((c) => c.label).join(', ')}.`
    );
  }
  if (rules.blockAcceptIfAnyNotOk && totalNotOkItems > 0) {
    failedRules.push(`${totalNotOkItems} item(s) marked Not OK.`);
  }
  if (overallOkPercentage < Number(rules.minOkPercentageForAccept ?? 95)) {
    failedRules.push(
      `OK percentage (${overallOkPercentage}%) is below configured threshold (${rules.minOkPercentageForAccept}%).`
    );
  }

  let suggestedDecision = 'Accepted';
  if (criticalFailures.length > 0 || (rules.requireAllApplicableInspected && totalPendingItems > 0)) {
    suggestedDecision = 'Hold';
  } else if (failedRules.length > 0) {
    suggestedDecision = 'Rework';
  }

  return {
    totalItems,
    totalApplicableItems,
    totalInspectedItems,
    totalOkItems,
    totalNotOkItems,
    totalNaItems,
    totalPendingItems,
    completionPercentage,
    overallOkPercentage,
    overallNotOkPercentage,
    sectionStats: {
      accessories: accStats,
      workmanship: wrkStats,
      labelling: lblStats,
    },
    acceptanceRuleEvaluation: {
      meetsConfiguredRules: failedRules.length === 0,
      suggestedDecision,
      failedRules,
    },
  };
}

export function calculateSevenPoint(entries = [], config = {}, overrideReason = '') {
  const countingRules = config.countingRules || {
    enforceSumEqualsTotal: true,
    oilTrackedAsDefectAttribute: true,
    allowSumOverrideWithRemarks: false,
  };

  let totalPiecesChecked = 0;
  let okPieces = 0;
  let reworkPieces = 0;
  let rejectedPieces = 0;
  let oilDefectCount = 0;

  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    const checked = Number(e.piecesChecked ?? 0);
    const ok = Number(e.okPieces ?? 0);
    const rework = Number(e.reworkPieces ?? 0);
    const rejected = Number(e.rejectedPieces ?? 0);
    const oil = Number(e.oilDefectCount ?? 0);

    if ([checked, ok, rework, rejected, oil].some((v) => !Number.isFinite(v) || v < 0)) {
      throw new AppError(`Entry #${i + 1}: Piece counts must be non-negative numbers.`, 400);
    }

    if (countingRules.enforceSumEqualsTotal && ok + rework + rejected !== checked) {
      if (!(countingRules.allowSumOverrideWithRemarks && overrideReason)) {
        throw new AppError(
          `Entry #${i + 1} (${e.employeeName || 'Employee'}): OK (${ok}) + Rework (${rework}) + Rejected (${rejected}) must equal Pieces Checked (${checked}).`,
          400
        );
      }
    }

    totalPiecesChecked += checked;
    okPieces += ok;
    reworkPieces += rework;
    rejectedPieces += rejected;
    oilDefectCount += oil;
  }

  const sumMatches = okPieces + reworkPieces + rejectedPieces === totalPiecesChecked;
  let validationMessage = 'Totals validated: OK + Rework + Rejected = Total Pieces Checked.';
  if (!sumMatches) {
    validationMessage = `Count mismatch: OK (${okPieces}) + Rework (${reworkPieces}) + Rejected (${rejectedPieces}) = ${
      okPieces + reworkPieces + rejectedPieces
    }, whereas Total Pieces Checked = ${totalPiecesChecked}.`;
    if (countingRules.enforceSumEqualsTotal && !(countingRules.allowSumOverrideWithRemarks && overrideReason)) {
      throw new AppError(validationMessage, 400);
    }
  }

  return {
    totalPiecesChecked,
    okPieces,
    reworkPieces,
    rejectedPieces,
    oilDefectCount,
    okPercentage: totalPiecesChecked > 0 ? roundTo((okPieces / totalPiecesChecked) * 100, 2) : 0,
    reworkPercentage: totalPiecesChecked > 0 ? roundTo((reworkPieces / totalPiecesChecked) * 100, 2) : 0,
    oilPercentage: totalPiecesChecked > 0 ? roundTo((oilDefectCount / totalPiecesChecked) * 100, 2) : 0,
    rejectionPercentage:
      totalPiecesChecked > 0 ? roundTo((rejectedPieces / totalPiecesChecked) * 100, 2) : 0,
    sumValidationPassed: sumMatches,
    validationMessage,
  };
}

export function calculateMeasurementRows(rawRows = []) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new AppError('At least one measurement entry row is required.', 400);
  }

  const sizeMap = new Map();
  let passedPoints = 0;
  let failedPoints = 0;

  const rows = rawRows.map((row, idx) => {
    const approvedSpec = Number(row.approvedSpec);
    const upperTolerance = Number(row.upperTolerance);
    const lowerTolerance = Number(row.lowerTolerance);
    const actualMeasurement = Number(row.actualMeasurement);

    if (
      [approvedSpec, upperTolerance, lowerTolerance, actualMeasurement].some(
        (n) => !Number.isFinite(n)
      )
    ) {
      throw new AppError(
        `Measurement row #${idx + 1} (${row.measurementPoint || 'Unknown'}): All numeric measurement and tolerance values are required.`,
        400
      );
    }

    if (lowerTolerance > upperTolerance) {
      throw new AppError(
        `Measurement row #${idx + 1} (${row.measurementPoint}): Lower tolerance (${lowerTolerance}) cannot exceed Upper tolerance (${upperTolerance}).`,
        400
      );
    }

    const difference = roundTo(actualMeasurement - approvedSpec, 3);
    const withinTolerance = difference >= lowerTolerance && difference <= upperTolerance;
    const result = withinTolerance ? 'Pass' : 'Fail';
    const toleranceLabel = withinTolerance ? 'Within Tolerance' : 'Fail';

    if (withinTolerance) passedPoints += 1;
    else failedPoints += 1;

    const sizeKey = String(row.size || '').trim();
    if (!sizeMap.has(sizeKey)) {
      sizeMap.set(sizeKey, { size: sizeKey, total: 0, passed: 0, failed: 0 });
    }
    const bucket = sizeMap.get(sizeKey);
    bucket.total += 1;
    if (withinTolerance) bucket.passed += 1;
    else bucket.failed += 1;

    return {
      specId: row.specId || null,
      size: sizeKey,
      sampleIndex: Number(row.sampleIndex || 1),
      measurementPoint: String(row.measurementPoint || '').trim(),
      measurementDescription: String(row.measurementDescription || '').trim(),
      unit: row.unit || 'cm',
      approvedSpec,
      upperTolerance,
      lowerTolerance,
      actualMeasurement,
      difference,
      withinTolerance,
      result,
      toleranceLabel,
      remarks: String(row.remarks || '').trim(),
    };
  });

  const totalPointsChecked = rows.length;
  const passPercentage =
    totalPointsChecked > 0 ? roundTo((passedPoints / totalPointsChecked) * 100, 2) : 0;

  const sizeSummaries = Array.from(sizeMap.values()).map((s) => ({
    ...s,
    passPercentage: s.total > 0 ? roundTo((s.passed / s.total) * 100, 2) : 0,
    result: s.failed === 0 ? 'Pass' : 'Fail',
  }));

  return {
    rows,
    summary: {
      totalPointsChecked,
      passedPoints,
      failedPoints,
      passPercentage,
      overallResult: failedPoints === 0 ? 'Pass' : 'Fail',
      sizeSummaries,
    },
  };
}

export function calculateShrinkageInspection(data = {}) {
  const minShrinkage = Number(data.toleranceConfig?.minShrinkage ?? -5);
  const maxShrinkage = Number(data.toleranceConfig?.maxShrinkage ?? 2);
  const gsmTol = Number(data.toleranceConfig?.gsmTolerancePercent ?? 5);
  const spiralityMax = Number(data.toleranceConfig?.spiralityMaxPercent ?? 4);
  const attachmentMin = Number(data.toleranceConfig?.attachmentMinNewton ?? 70);

  const processRow = (row) => {
    const bw = Number(row.bw ?? 0);
    const aw = Number(row.aw ?? 0);
    const shrinkagePercent = bw > 0 ? roundTo(((bw - aw) / bw) * 100, 2) : 0;
    const ok = shrinkagePercent >= minShrinkage && shrinkagePercent <= maxShrinkage;
    const result = bw > 0 ? (ok ? 'OK' : 'NOT OK') : '-';
    return {
      point: String(row.point || '').trim(),
      bw,
      aw,
      shrinkagePercent,
      kDia: String(row.kDia || '').trim(),
      fid: String(row.fid || '').trim(),
      actualGsm: Number(row.actualGsm ?? 0),
      spec: String(row.spec || `+${maxShrinkage}% ${minShrinkage}%`).trim(),
      result,
    };
  };

  const garmentMeasurements = (data.garmentMeasurements || []).map(processRow);
  const fabricMeasurements = (data.fabricMeasurements || []).map(processRow);

  const allRows = [...garmentMeasurements, ...fabricMeasurements];
  const hasShrinkageFailure = allRows.some((r) => r.result === 'NOT OK');
  const shrinkageEvaluated = allRows.some((r) => r.result === 'OK' || r.result === 'NOT OK');
  const shrinkageResult = !shrinkageEvaluated ? 'Pending' : hasShrinkageFailure ? 'NOT OK' : 'OK';

  // GSM
  const reqGsm = Number(data.gsmTesting?.requiredGsm || data.headerSnapshot?.requiredGsm || 0);
  const actGsm = Number(data.gsmTesting?.actualGsm ?? 0);
  const gsmDev = roundTo(actGsm - reqGsm, 2);
  const gsmDevPct = reqGsm > 0 ? roundTo((gsmDev / reqGsm) * 100, 2) : 0;
  const gsmOk = reqGsm > 0 ? Math.abs(gsmDevPct) <= gsmTol : true;
  const gsmResult = actGsm > 0 ? (gsmOk ? 'OK' : 'NOT OK') : 'Pending';

  // Colour Fastness
  const cf = data.colourFastness || {};
  const evalCfField = (fld, defaultMin) => {
    const val = Number(fld?.value ?? defaultMin);
    const req = Number(fld?.requirement ?? defaultMin);
    return {
      value: val,
      requirement: req,
      result: val >= req ? 'OK' : 'NOT OK',
    };
  };

  const changeInShade = evalCfField(cf.changeInShade, 4);
  const stainingOnCotton = evalCfField(cf.stainingOnCotton, 3);
  const crockingFabricWet = evalCfField(cf.crockingFabricWet, 3);
  const crockingFabricDry = evalCfField(cf.crockingFabricDry, 4);
  const crockingArtworkWet = evalCfField(cf.crockingArtworkWet, 4);
  const crockingArtworkDry = evalCfField(cf.crockingArtworkDry, 4);

  const cfOk =
    changeInShade.result === 'OK' &&
    stainingOnCotton.result === 'OK' &&
    crockingFabricWet.result === 'OK' &&
    crockingFabricDry.result === 'OK' &&
    crockingArtworkWet.result === 'OK' &&
    crockingArtworkDry.result === 'OK';

  const colourFastnessResult = cfOk ? 'OK' : 'NOT OK';

  // Attachment test
  const tests = (data.processDetail?.attachmentTests || [
    { testNumber: 1, valueNewton: 70 },
    { testNumber: 2, valueNewton: 70 },
    { testNumber: 3, valueNewton: 70 },
  ]).map((t, i) => {
    const v = Number(t.valueNewton ?? 70);
    return {
      testNumber: t.testNumber || i + 1,
      valueNewton: v,
      result: v >= attachmentMin ? 'OK' : 'NOT OK',
    };
  });
  const attachmentOk = tests.every((t) => t.result === 'OK');
  const attachmentResult = attachmentOk ? 'OK' : 'NOT OK';

  // Spirality
  const spiralityVal = Number(data.spirality?.spiralityPercent ?? 0);
  const spiralityOk = Math.abs(spiralityVal) <= spiralityMax;
  const spiralityResult = spiralityOk ? 'OK' : 'NOT OK';

  // Summary
  const failedParameters = [];
  if (shrinkageResult === 'NOT OK') failedParameters.push('Shrinkage Measurement');
  if (gsmResult === 'NOT OK') failedParameters.push('GSM Deviation');
  if (colourFastnessResult === 'NOT OK') failedParameters.push('Colour Fastness');
  if (attachmentResult === 'NOT OK') failedParameters.push('Attachment Strength');
  if (spiralityResult === 'NOT OK') failedParameters.push('Spirality');

  let overallResult = 'PENDING';
  if (failedParameters.length > 0) {
    overallResult = 'FAIL';
  } else if (shrinkageResult === 'OK' && gsmResult === 'OK') {
    overallResult = 'PASS';
  }

  return {
    garmentMeasurements,
    fabricMeasurements,
    gsmTesting: {
      requiredGsm: reqGsm,
      actualGsm: actGsm,
      deviation: gsmDev,
      deviationPercent: gsmDevPct,
      tolerancePercent: gsmTol,
      result: gsmResult,
    },
    colourFastness: {
      temperature: cf.temperature || '60°C',
      changeInShade,
      stainingOnCotton,
      crockingFabricWet,
      crockingFabricDry,
      crockingArtworkWet,
      crockingArtworkDry,
      overallResult: colourFastnessResult,
    },
    processDetail: {
      ...(data.processDetail || {}),
      attachmentTests: tests,
      attachmentRequirement: attachmentMin,
      attachmentResult,
    },
    spirality: {
      spiralityPercent: spiralityVal,
      maxAllowedPercent: spiralityMax,
      result: spiralityResult,
    },
    summaryResults: {
      shrinkageResult,
      gsmResult,
      colourFastnessResult,
      spiralityResult,
      overallResult,
      failedParameters,
    },
  };
}

export function calculateFourPointInspection(data = {}) {
  const rollMax = Number(data.acceptanceCriteria?.rollMaxPointsPer100SqYds ?? 28);
  const batchMax = Number(data.acceptanceCriteria?.batchMaxPointsPer100SqYds ?? 20);
  const isTubular = data.isTubularFabric !== false;

  let totalDefectPoints = 0;
  let totalInspectedYards = 0;
  let totalAcceptedRolls = 0;
  let totalRejectedRolls = 0;

  const rolls = (data.rolls || []).map((roll, idx) => {
    const inspectedYards = Number(roll.inspectedYards || 100);
    const diaInches = Number(roll.diaInches || roll.widthInches || 30);
    const d1 = Number(roll.defectsUpTo3Inches || 0);
    const d2 = Number(roll.defects3To6Inches || 0);
    const d3 = Number(roll.defects6To9Inches || 0);
    const d4 = Number(roll.defectsOver9Inches || 0);

    const sizePoints = d1 * 1 + d2 * 2 + d3 * 3 + d4 * 4;

    const defectsObj = roll.defects || {};
    const catTotal = Object.values(defectsObj).reduce((acc, v) => acc + (Number(v) || 0), 0);

    // If size points entered, use size points; if not but category defects entered, use category count
    const rollPoints = sizePoints > 0 ? sizePoints : catTotal;

    // 4 Point Formula: (Points * 3600) / (Width * Inspected Yards)
    // If tubular, open width is Dia * 2
    const openWidthInches = isTubular ? diaInches * 2 : diaInches;
    const denominator = openWidthInches * inspectedYards;
    const pointsPer100SqYds = denominator > 0 ? roundTo((rollPoints * 3600) / denominator, 2) : 0;

    const rollResult = pointsPer100SqYds <= rollMax ? 'PASS' : 'FAIL';
    if (rollResult === 'PASS') totalAcceptedRolls += 1;
    else totalRejectedRolls += 1;

    totalDefectPoints += rollPoints;
    totalInspectedYards += inspectedYards;

    return {
      rollNo: String(roll.rollNo || `Roll-${idx + 1}`).trim(),
      ropeNo: String(roll.ropeNo || '').trim(),
      widthCm: Number(roll.widthCm || 0),
      diaInches,
      gsm: Number(roll.gsm || 0),
      rollWeight: Number(roll.rollWeight || 0),
      inspectedYards,
      defectsUpTo3Inches: d1,
      defects3To6Inches: d2,
      defects6To9Inches: d3,
      defectsOver9Inches: d4,
      defects: defectsObj,
      totalDefectPoints: rollPoints,
      pointsPer100SqYds,
      rollResult,
      remarks: String(roll.remarks || '').trim(),
    };
  });

  const avgPoints =
    totalInspectedYards > 0
      ? roundTo((totalDefectPoints * 3600) / (60 * totalInspectedYards), 2)
      : rolls.length > 0
      ? roundTo(rolls.reduce((sum, r) => sum + r.pointsPer100SqYds, 0) / rolls.length, 2)
      : 0;

  const finalBatchResult =
    rolls.length > 0 && avgPoints <= batchMax && totalRejectedRolls === 0 ? 'PASS' : 'FAIL';

  return {
    rolls,
    batchSummary: {
      totalRolls: rolls.length,
      totalInspectedYards,
      totalAcceptedRolls,
      totalRejectedRolls,
      totalDefectPoints,
      averagePointsPer100SqYds: avgPoints,
      finalBatchResult,
    },
  };
}

export function calculateAccessoriesInspection(data = {}) {
  const rcvQty = Number(data.receivedQuantity || 0);
  const inspQty = Number(data.inspectedQuantity || 0);
  const inspectionPercentage = rcvQty > 0 ? roundTo((inspQty / rcvQty) * 100, 2) : 0;

  const checklist = (data.checklist || []).map((item) => ({
    parameterKey: String(item.parameterKey || '').trim(),
    label: String(item.label || '').trim(),
    isMandatory: item.isMandatory !== false,
    status: item.status || 'OK',
    comments: String(item.comments || '').trim(),
    attachmentIds: item.attachmentIds || [],
  }));

  let okCount = 0;
  let notOkCount = 0;
  let naCount = 0;
  let pendingCount = 0;
  const failedParameters = [];

  for (const item of checklist) {
    if (item.status === 'OK') okCount += 1;
    else if (item.status === 'NOT OK') {
      notOkCount += 1;
      failedParameters.push(item.label || item.parameterKey);
    } else if (item.status === 'NOT APPLICABLE' || item.status === 'N/A') naCount += 1;
    else pendingCount += 1;
  }

  let finalResult = 'ACCEPT';
  if (notOkCount > 0) finalResult = 'REJECT';
  else if (pendingCount > 0 || checklist.length === 0) finalResult = 'HOLD';

  const acceptedQuantity = finalResult === 'ACCEPT' ? rcvQty : 0;
  const rejectedQuantity = finalResult === 'REJECT' ? rcvQty : 0;

  return {
    inspectionPercentage,
    acceptedQuantity,
    rejectedQuantity,
    checklist,
    calculations: {
      totalParameters: checklist.length,
      okCount,
      notOkCount,
      naCount,
      failedParameters,
    },
    finalResult,
  };
}


