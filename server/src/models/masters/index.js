import mongoose from 'mongoose';
import { createMasterSchema } from './masterFactory.js';

const buyerSchema = createMasterSchema(
  {
    name: { type: String, required: true, trim: true, index: true },
    contactPerson: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
  },
  'BUY'
);

const supplierSchema = createMasterSchema(
  {
    name: { type: String, required: true, trim: true, index: true },
    contactPerson: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    factoryLocation: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
  },
  'SUP'
);

const styleSchema = createMasterSchema(
  {
    styleNumber: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', default: null },
    season: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
  },
  'STY'
);

const fabricSchema = createMasterSchema(
  {
    name: { type: String, required: true, trim: true, index: true },
    composition: { type: String, trim: true, default: '' },
    construction: { type: String, trim: true, default: '' },
    width: { type: String, trim: true, default: '' },
  },
  'FAB'
);

const colourSchema = createMasterSchema(
  {
    name: { type: String, required: true, trim: true, index: true },
    pantoneCode: { type: String, trim: true, default: '' },
    hexCode: { type: String, trim: true, default: '' },
  },
  'COL'
);

const gsmSchema = createMasterSchema(
  {
    value: { type: Number, required: true, min: 1, index: true },
    name: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
  },
  'GSM'
);
gsmSchema.pre('validate', function syncGsmName() {
  if (!this.name && this.value != null) {
    this.name = `${this.value} GSM`;
  }
});

const sizeRangeSchema = createMasterSchema(
  {
    name: { type: String, required: true, trim: true, index: true },
    sizes: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'Size range must contain at least one size.',
      },
    },
  },
  'SIZ'
);

const orderSchema = createMasterSchema(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true, index: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', required: true, index: true },
    styleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Style', required: true, index: true },
    styleDescription: { type: String, trim: true, default: '' },
    orderQuantity: { type: Number, required: true, min: 1 },
    fabricId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fabric', default: null },
    gsmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gsm', default: null },
    colourId: { type: mongoose.Schema.Types.ObjectId, ref: 'Colour', default: null },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    sizeRangeId: { type: mongoose.Schema.Types.ObjectId, ref: 'SizeRange', default: null },
    deliveryDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['Open', 'In Production', 'Completed', 'Cancelled'],
      default: 'Open',
    },
  },
  'ORD'
);
orderSchema.index({ buyerId: 1, styleId: 1, status: 1 });

const departmentSchema = createMasterSchema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: '' },
  },
  'DEP'
);

const productionLineSchema = createMasterSchema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    floor: { type: String, trim: true, default: '' },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    capacity: { type: Number, default: 0, min: 0 },
  },
  'LIN'
);

const employeeSchema = createMasterSchema(
  {
    employeeCode: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    productionLineId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionLine', default: null },
    designation: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
  },
  'EMP'
);

const processSchema = createMasterSchema(
  {
    name: { type: String, required: true, trim: true, index: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    description: { type: String, trim: true, default: '' },
  },
  'PRC'
);

const machineSchema = createMasterSchema(
  {
    machineNumber: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    machineType: { type: String, trim: true, default: '' },
    productionLineId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionLine', default: null },
  },
  'MCH'
);

const needleSchema = createMasterSchema(
  {
    needleNumber: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    needleType: { type: String, trim: true, default: '' },
    size: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
  },
  'NDL'
);

const measurementSpecSchema = createMasterSchema(
  {
    styleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Style', required: true, index: true },
    size: { type: String, required: true, trim: true, index: true },
    measurementPoint: { type: String, required: true, trim: true },
    measurementDescription: { type: String, trim: true, default: '' },
    unit: { type: String, enum: ['cm', 'inch', 'mm'], default: 'cm' },
    approvedSpec: { type: Number, required: true },
    upperTolerance: { type: Number, required: true },
    lowerTolerance: { type: Number, required: true },
    sortOrder: { type: Number, default: 0 },
  },
  'MSP'
);
measurementSpecSchema.index({ styleId: 1, size: 1, sortOrder: 1 });
measurementSpecSchema.index(
  { styleId: 1, size: 1, measurementPoint: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

const accessorySchema = createMasterSchema(
  {
    name: { type: String, required: true, trim: true, index: true },
    category: { type: String, trim: true, default: 'Trims' },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    approvedSpec: { type: String, trim: true, default: '' },
    unit: { type: String, trim: true, default: 'pcs' },
    remarks: { type: String, trim: true, default: '' },
  },
  'ACC'
);

const inspectionCheckpointSchema = createMasterSchema(
  {
    module: {
      type: String,
      required: true,
      enum: ['target_chart', 'size_set', 'seven_point'],
      index: true,
    },
    section: { type: String, required: true, trim: true, index: true },
    checkpointNumber: { type: Number, default: 0 },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    isCritical: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  'CHK'
);
inspectionCheckpointSchema.index({ module: 1, section: 1, sortOrder: 1 });

export const Buyer = mongoose.model('Buyer', buyerSchema, 'buyers');
export const Supplier = mongoose.model('Supplier', supplierSchema, 'suppliers');
export const Style = mongoose.model('Style', styleSchema, 'styles');
export const Fabric = mongoose.model('Fabric', fabricSchema, 'fabrics');
export const Colour = mongoose.model('Colour', colourSchema, 'colours');
export const Gsm = mongoose.model('Gsm', gsmSchema, 'gsms');
export const SizeRange = mongoose.model('SizeRange', sizeRangeSchema, 'sizeranges');
export const Order = mongoose.model('Order', orderSchema, 'orders');
export const Department = mongoose.model('Department', departmentSchema, 'departments');
export const ProductionLine = mongoose.model('ProductionLine', productionLineSchema, 'productionlines');
export const Employee = mongoose.model('Employee', employeeSchema, 'employees');
export const Process = mongoose.model('Process', processSchema, 'processes');
export const Machine = mongoose.model('Machine', machineSchema, 'machines');
export const Needle = mongoose.model('Needle', needleSchema, 'needles');
export const MeasurementSpec = mongoose.model(
  'MeasurementSpec',
  measurementSpecSchema,
  'measurementspecifications'
);
export const InspectionCheckpoint = mongoose.model(
  'InspectionCheckpoint',
  inspectionCheckpointSchema,
  'inspectioncheckpoints'
);
export const Accessory = mongoose.model('Accessory', accessorySchema, 'accessories');

export const MASTER_REGISTRY = {
  accessories: {
    model: Accessory,
    label: 'Accessories Master',
    searchFields: ['code', 'name', 'category', 'approvedSpec'],
    populates: [{ path: 'supplierId', select: 'code name' }],
  },
  buyers: {
    model: Buyer,
    label: 'Buyer Master',
    searchFields: ['code', 'name', 'contactPerson', 'country'],
    populates: [],
  },
  suppliers: {
    model: Supplier,
    label: 'Supplier Master',
    searchFields: ['code', 'name', 'contactPerson', 'factoryLocation'],
    populates: [],
  },
  styles: {
    model: Style,
    label: 'Style Master',
    searchFields: ['code', 'styleNumber', 'name', 'description', 'category'],
    populates: [{ path: 'buyerId', select: 'code name' }],
  },
  orders: {
    model: Order,
    label: 'Order Master',
    searchFields: ['code', 'orderNumber', 'styleDescription'],
    populates: [
      { path: 'buyerId', select: 'code name' },
      { path: 'styleId', select: 'code styleNumber name description' },
      { path: 'fabricId', select: 'code name composition' },
      { path: 'gsmId', select: 'code value name' },
      { path: 'colourId', select: 'code name hexCode' },
      { path: 'supplierId', select: 'code name factoryLocation' },
      { path: 'sizeRangeId', select: 'code name sizes' },
    ],
  },
  fabrics: {
    model: Fabric,
    label: 'Fabric Master',
    searchFields: ['code', 'name', 'composition', 'construction'],
    populates: [],
  },
  colours: {
    model: Colour,
    label: 'Colour Master',
    searchFields: ['code', 'name', 'pantoneCode'],
    populates: [],
  },
  gsms: {
    model: Gsm,
    label: 'GSM Master',
    searchFields: ['code', 'name', 'description'],
    populates: [],
  },
  'size-ranges': {
    model: SizeRange,
    label: 'Size Range Master',
    searchFields: ['code', 'name'],
    populates: [],
  },
  'production-lines': {
    model: ProductionLine,
    label: 'Production Line Master',
    searchFields: ['code', 'name', 'floor'],
    populates: [
      { path: 'departmentId', select: 'code name' },
      { path: 'supervisorId', select: 'username fullName role' },
    ],
  },
  departments: {
    model: Department,
    label: 'Department Master',
    searchFields: ['code', 'name'],
    populates: [],
  },
  employees: {
    model: Employee,
    label: 'Employee Master',
    searchFields: ['code', 'employeeCode', 'name', 'designation'],
    populates: [
      { path: 'departmentId', select: 'code name' },
      { path: 'productionLineId', select: 'code name' },
    ],
  },
  processes: {
    model: Process,
    label: 'Process Master',
    searchFields: ['code', 'name'],
    populates: [{ path: 'departmentId', select: 'code name' }],
  },
  machines: {
    model: Machine,
    label: 'Machine Master',
    searchField