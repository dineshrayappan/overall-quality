import { RolePermission } from '../models/RolePermission.js';
import { CompanySetting } from '../models/CompanySetting.js';
import { InspectionConfig } from '../models/InspectionConfig.js';

export const DEFAULT_ROLE_PERMISSIONS = [
  {
    roleName: 'Admin',
    description: 'Full system access: master data, configurations, users, reports, approvals, and exports.',
    isSystem: true,
    permissions: {
      masterData: { view: true, create: true, edit: true, archive: true },
      configuration: { view: true, edit: true },
      users: { view: true, create: true, edit: true },
      targetChart: {
        view: true, create: true, edit: true, submit: true, approve: true, reject: true, archive: true, scopeAllLines: true,
      },
      sizeSet: {
        view: true, create: true, edit: true, submit: true, approve: true, reject: true, markNA: true, archive: true, scopeAllLines: true,
      },
      sevenPoint: {
        view: true, create: true, edit: true, submit: true, approve: true, reject: true, archive: true, scopeAllLines: true,
        approvalStages: ['QC', 'Supervisor', 'QAM', 'PM', 'FM'],
      },
      measurement: {
        view: true, create: true, edit: true, submit: true, approve: true, reject: true, archive: true, scopeAllLines: true,
        approvalStages: ['QC', 'IC.Q.A.D', 'Supplier'],
      },
      shrinkage: {
        view: true, create: true, edit: true, submit: true, approve: true, reject: true, archive: true, scopeAllLines: true,
        approvalStages: ['IC LAB', 'IC QAD', 'Received By'],
      },
      fourPoint: {
        view: true, create: true, edit: true, submit: true, approve: true, reject: true, archive: true, scopeAllLines: true,
        approvalStages: ['Inspector', 'Checker', 'Lab IC'],
      },
      accessories: {
        view: true, create: true, edit: true, submit: true, approve: true, reject: true, archive: true, scopeAllLines: true,
        approvalStages: ['Inspected by', 'Verified by', 'Approved by'],
      },
      specifications: { view: true, create: true, edit: true, archive: true },
      dashboard: { view: true },
      exports: { pdf: true, excel: true },
      auditLogs: { view: true },
    },
  },
  {
    roleName: 'Quality Manager',
    description: 'Review and approve reports across all lines, view dashboards, and export PDF/Excel.',
    isSystem: true,
    permissions: {
      masterData: { view: true, create: false, edit: false, archive: false },
      configuration: { view: true, edit: false },
      users: { view: false, create: false, edit: false },
      targetChart: {
        view: true, create: false, edit: false, submit: false, approve: true, reject: true, archive: false, scopeAllLines: true,
      },
      sizeSet: {
        view: true, create: true, edit: true, submit: true, approve: true, reject: true, markNA: true, archive: false, scopeAllLines: true,
      },
      sevenPoint: {
        view: true, create: false, edit: false, submit: false, approve: true, reject: true, archive: false, scopeAllLines: true,
        approvalStages: ['QAM', 'PM', 'FM'],
      },
      measurement: {
        view: true, create: false, edit: false, submit: false, approve: true, reject: true, archive: false, scopeAllLines: true,
        approvalStages: ['IC.Q.A.D', 'Supplier'],
      },
      shrinkage: {
        view: true, create: true, edit: true, submit: true, approve: true, reject: true, archive: false, scopeAllLines: true,
        approvalStages: ['IC QAD'],
      },
      fourPoint: {
        view: true, create: true, edit: true, submit: true, approve: true, reject: true, archive: false, scopeAllLines: true,
        approvalStages: ['Lab IC'],
      },
      accessories: {
        view: true, create: true, edit: true, submit: true, approve: true, reject: true, archive: false, scopeAllLines: true,
        approvalStages: ['Approved by'],
      },
      specifications: { view: true, create: true, edit: true, archive: false },
      dashboard: { view: true },
      exports: { pdf: true, excel: true },
      auditLogs: { view: true },
    },
  },
  {
    roleName: 'QC Inspector',
    description: 'Create and edit draft inspection reports, upload photos, and submit for approval.',
    isSystem: true,
    permissions: {
      masterData: { view: true, create: false, edit: false, archive: false },
      configuration: { view: false, edit: false },
      users: { view: false, create: false, edit: false },
      targetChart: {
        view: true, create: true, edit: true, submit: true, approve: false, reject: false, archive: false, scopeAllLines: false,
      },
      sizeSet: {
        view: true, create: true, edit: true, submit: true, approve: false, reject: false, markNA: false, archive: false, scopeAllLines: false,
      },
      sevenPoint: {
        view: true, create: true, edit: true, submit: true, approve: true, reject: false, archive: false, scopeAllLines: false,
        approvalStages: ['QC'],
      },
      measurement: {
        view: true, create: true, edit: true, submit: true, approve: true, reject: false, archive: false, scopeAllLines: false,
        approvalStages: ['QC'],
      },
      shrinkage: {
        view: true, create: true, edit: true, submit: true, approve: false, reject: false, archive: false, scopeAllLines: false,
        approvalStages: ['IC LAB'],
      },
      fourPoint: {
        view: true, create: true, edit: true, submit: true, approve: false, reject: false, archive: false, scopeAllLines: false,
        approvalStages: ['Inspector'],
      },
      accessories: {
        view: true, create: true, edit: true, submit: true, approve: false, reject: false, archive: false, scopeAllLines: false,
        approvalStages: ['Inspected by'],
      },
      specifications: { view: true, create: false, edit: false, archive: false },
      dashboard: { view: true },
      exports: { pdf: true, excel: false },
      auditLogs: { view: false },
    },
  },
  {
    roleName: 'Supervisor',
    description: 'View assigned production line reports, review results, and approve or return reports.',
    isSystem: true,
    permissions: {
      masterData: { view: true, create: false, edit: false, archive: false },
      configuration: { view: false, edit: false },
      users: { view: false, create: false, edit: false },
      targetChart: {
        view: true, create: true, edit: true, submit: true, approve: true, reject: true, archive: false, scopeAllLines: false,
      },
      sizeSet: {
        view: true, create: false, edit: false, submit: false, approve: true, reject: true, markNA: false, archive: false, scopeAllLines: false,
      },
      sevenPoint: {
        view: true, create: false, edit: false, submit: false, approve: true, reject: true, archive: false, scopeAllLines: false,
        approvalStages: ['Supervisor'],
      },
      measurement: {
        view: true, create: false, edit: false, submit: false, approve: false, reject: false, archive: false, scopeAllLines: false,
        approvalStages: [],
      },
      shrinkage: {
        view: true, create: false, edit: false, submit: false, approve: true, reject: true, archive: false, scopeAllLines: false,
        approvalStages: ['IC LAB'],
      },
      fourPoint: {
        view: true, create: false, edit: false, submit: false, approve: true, reject: true, archive: false, scopeAllLines: false,
        approvalStages: ['Checker'],
      },
      accessories: {
        view: true, create: false, edit: false, submit: false, approve: true, reject: true, archive: false, scopeAllLines: false,
        approvalStages: ['Verified by'],
      },
      specifications: { view: true, create: false, edit: false, archive: false },
      dashboard: { view: true },
      exports: { pdf: true, excel: true },
      auditLogs: { view: false },
    },
  },
];

export const DEFAULT_INSPECTION_CONFIGS = [
  {
    module: 'target_chart',
    config: {
      percentageLevels: [50, 75, 100],
      indicators: Array.from({ length: 15 }, (_, idx) => ({
        index: idx + 1,
        code: `IND-${String(idx + 1).padStart(2, '0')}`,
        name: `Target Indicator ${idx + 1}`,
        unit: 'pcs',
        defaultTarget: 100,
        isActive: true,
      })),
    },
  },
  {
    module: 'size_set',
    config: {
      allowNAForRoles: ['Admin', 'Quality Manager'],
      acceptanceRules: {
        minOkPercentageForAccept: 95,
        blockAcceptIfAnyNotOk: true,
        blockAcceptIfCriticalNotOk: true,
        requireAllApplicableInspected: true,
      },
      accessoriesChecklist: [
        { itemKey: 'acc_button', label: 'Button / Button Holes', isActive: true, isCritical: false, sortOrder: 1 },
        { itemKey: 'acc_zipper', label: 'Zipper', isActive: true, isCritical: false, sortOrder: 2 },
        { itemKey: 'acc_lining', label: 'Lining', isActive: true, isCritical: false, sortOrder: 3 },
        { itemKey: 'acc_snaps', label: 'Snaps', isActive: true, isCritical: false, sortOrder: 4 },
        { itemKey: 'acc_hook', label: 'Hook', isActive: true, isCritical: false, sortOrder: 5 },
        { itemKey: 'acc_buckle', label: 'Buckle', isActive: true, isCritical: false, sortOrder: 6 },
        { itemKey: 'acc_elastic', label: 'Elastic', isActive: true, isCritical: false, sortOrder: 7 },
        { itemKey: 'acc_thread', label: 'Thread', isActive: true, isCritical: false, sortOrder: 8 },
        { itemKey: 'acc_eyelet', label: 'Eyelet', isActive: true, isCritical: false, sortOrder: 9 },
        { itemKey: 'acc_poly_bag', label: 'Poly Bag', isActive: true, isCritical: false, sortOrder: 10 },
        { itemKey: 'acc_size_ring', label: 'Size Ring', isActive: true, isCritical: false, sortOrder: 11 },
        { itemKey: 'acc_hanger', label: 'Hanger', isActive: true, isCritical: false, sortOrder: 12 },
      ],
      workmanshipChecklist: [
        { itemKey: 'wrk_stitching', label: 'Stitching', isActive: true, isCritical: true, sortOrder: 1 },
        { itemKey: 'wrk_checking', label: 'Checking', isActive: true, isCritical: false, sortOrder: 2 },
        { itemKey: 'wrk_iron', label: 'Iron', isActive: true, isCritical: false, sortOrder: 3 },
        { itemKey: 'wrk_packing', label: 'Packing', isActive: true, isCritical: false, sortOrder: 4 },
        { itemKey: 'wrk_assortment_packing', label: 'Assortment Packing', isActive: true, isCritical: false, sortOrder: 5 },
        { itemKey: 'wrk_soild_packing', label: 'Soild Packing', isActive: true, isCritical: false, sortOrder: 6 },
        { itemKey: 'wrk_carton_box', label: 'Carton Box', isActive: true, isCritical: false, sortOrder: 7 },
        { itemKey: 'wrk_carton_marking', label: 'Carton Marking', isActive: true, isCritical: false, sortOrder: 8 },
        { itemKey: 'wrk_strapping', label: 'Strapping', isActive: true, isCritical: false, sortOrder: 9 },
        { itemKey: 'wrk_embroidery', label: 'Embroidery', isActive: true, isCritical: false, sortOrder: 10 },
        { itemKey: 'wrk_printing', label: 'Printing', isActive: true, isCritical: false, sortOrder: 11 },
        { itemKey: 'wrk_washing', label: 'Washing', isActive: true, isCritical: false, sortOrder: 12 },
      ],
      labellingChecklist: [
        { itemKey: 'lbl_main_label', label: 'Main Label', isActive: true, isCritical: true, sortOrder: 1 },
        { itemKey: 'lbl_care_label', label: 'Care Label', isActive: true, isCritical: true, sortOrder: 2 },
        { itemKey: 'lbl_size_label', label: 'Size Label', isActive: true, isCritical: true, sortOrder: 3 },
        { itemKey: 'lbl_tab_label', label: 'Tab Label', isActive: true, isCritical: false, sortOrder: 4 },
        { itemKey: 'lbl_price_tag', label: 'Price Tag', isActive: true, isCritical: false, sortOrder: 5 },
        { itemKey: 'lbl_special_hang_tag', label: 'Special Hang Tag', isActive: true, isCritical: false, sortOrder: 6 },
      ],
    },
  },
  {
    module: 'seven_point',
    config: {
      checkpointCount: 10,
      checkpoints: Array.from({ length: 10 }, (_, idx) => ({
        checkpointNumber: idx + 1,
        label: `Point ${idx + 1}`,
        description: `Configurable inspection checkpoint ${idx + 1}`,
        isActive: true,
      })),
      countingRules: {
        enforceSumEqualsTotal: true,
        oilTrackedAsDefectAttribute: true,
        allowSumOverrideWithRemarks: false,
        maxReworkPercentageForPass: 5,
        maxRejectionPercentageForPass: 2,
      },
      approvalWorkflow: [
        { stage: 'QC', required: true, allowedRoles: ['QC Inspector', 'Admin', 'Quality Manager'] },
        { stage: 'Supervisor', required: true, allowedRoles: ['Supervisor', 'Admin', 'Quality Manager'] },
        { stage: 'QAM', required: true, allowedRoles: ['Quality Manager', 'Admin'] },
        { stage: 'PM', required: false, allowedRoles: ['Quality Manager', 'Admin'] },
        { stage: 'FM', required: false, allowedRoles: ['Quality Manager', 'Admin'] },
      ],
      enforceSequentialApproval: true,
    },
  },
  {
    module: 'measurement',
    config: {
      requireAllPointsPassForAccept: true,
      allowMultipleSamplesPerSize: true,
      defaultSampleCountPerSize: 1,
      approvalWorkflow: [
        { stage: 'QC', required: true, allowedRoles: ['QC Inspector', 'Admin', 'Quality Manager'] },
        { stage: 'IC.Q.A.D', required: true, allowedRoles: ['Quality Manager', 'Admin'] },
        { stage: 'Supplier', required: false, allowedRoles: ['Quality Manager', 'Admin'] },
      ],
      enforceSequentialApproval: true,
    },
  },
  {
    module: 'shrinkage',
    config: {
      allowedShrinkage: { min: -5, max: 2 },
      gsmTolerancePercent: 5,
      colourFastness: {
        changeInShadeMin: 4,
        stainingOnCottonMin: 3,
        crockingFabricWetMin: 3,
        crockingFabricDryMin: 4,
        crockingArtworkMin: 4,
      },
      attachmentMinNewton: 70,
      spiralityMaxPercent: 4,
      approvalWorkflow: [
        { stage: 'IC LAB', required: true, allowedRoles: ['QC Inspector', 'Admin', 'Quality Manager'] },
        { stage: 'IC QAD', required: true, allowedRoles: ['Quality Manager', 'Supervisor', 'Admin'] },
        { stage: 'Received By', required: false, allowedRoles: ['Quality Manager', 'Admin'] },
      ],
      enforceSequentialApproval: false,
    },
  },
  {
    module: 'four_point',
    config: {
      rollMaxPointsPer100SqYds: 28,
      batchMaxPointsPer100SqYds: 20,
      scoring: { upTo3Inches: 1, from3To6Inches: 2, from6To9Inches: 3, over9Inches: 4 },
      approvalWorkflow: [
        { stage: 'Inspector', required: true, allowedRoles: ['QC Inspector', 'Admin', 'Quality Manager'] },
        { stage: 'Checker', required: true, allowedRoles: ['Supervisor', 'Admin', 'Quality Manager'] },
        { stage: 'Lab IC', required: false, allowedRoles: ['Quality Manager', 'Admin'] },
      ],
      enforceSequentialApproval: false,
    },
  },
  {
    module: 'accessories',
    config: {
      standardParameters: [
        { key: 'material', label: 'Material', isMandatory: true },
        { key: 'colour_matching', label: 'Colour matching', isMandatory: true },
        { key: 'content_text', label: 'Content / Text', isMandatory: true },
        { key: 'design', label: 'Design', isMandatory: true },
        { key: 'position_design', label: 'Position of design', isMandatory: false },
        { key: 'size_material', label: 'Size of material', isMandatory: true },
        { key: 'uniformity', label: 'Uniformity', isMandatory: false },
        { key: 'fibre_composition', label: 'Fibre composition details', isMandatory: true },
        { key: 'wash_care_symbol', label: 'Wash care symbol marking', isMandatory: true },
        { key: 'weight_material', label: 'Weight of material (GSM or thickness)', isMandatory: false },
        { key: 'breaking_strength', label: 'Breaking strength (if hanger)', isMandatory: false },
        { key: 'physical_testing', label: 'Physical testing, if any', isMandatory: false },
        { key: 'lab_testing', label: 'Lab testing, if required', isMandatory: false },
      ],
      approvalWorkflow: [
        { stage: 'Inspected by', required: true, allowedRoles: ['QC Inspector', 'Admin', 'Quality Manager'] },
        { stage: 'Verified by', required: true, allowedRoles: ['Supervisor', 'Admin', 'Quality Manager'] },
        { stage: 'Approved by', required: false, allowedRoles: ['Quality Manager', 'Admin'] },
      ],
      enforceSequentialApproval: false,
    },
  },
];

export async function bootstrapSystemConfig() {
  for (const role of DEFAULT_ROLE_PERMISSIONS) {
    await RolePermission.updateOne(
      { roleName: role.roleName },
      {
        $set: {
          permissions: role.permissions,
          description: role.description,
          isSystem: role.isSystem,
        },
      },
      { upsert: true }
    );
  }

  await CompanySetting.updateOne(
    { key: 'default' },
    {
      $setOnInsert: {
        key: 'default',
        companyName: 'Garment Quality Management System',
        companyAddress: '',
        companyPhone: '',
        companyEmail: '',
      },
    },
    { upsert: true }
  );

  for (const cfg of DEFAULT_INSPECTION_CONFIGS) {
    await InspectionConfig.updateOne(
      { module: cfg.module },
      { $setOnInsert: cfg },
      { upsert: true }
    );
  }
}

