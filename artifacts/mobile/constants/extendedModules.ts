export type ExtendedFieldKind = 'text' | 'number' | 'date' | 'multiline' | 'select';

export interface ExtendedField {
  key: string;
  label: string;
  kind: ExtendedFieldKind;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
}

export interface ExtendedModuleDefinition {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
  section: 'operations' | 'commercial' | 'accounts' | 'hr' | 'admin';
  statuses: string[];
  fields: ExtendedField[];
}

export const EXTENDED_MODULES: ExtendedModuleDefinition[] = [
  {
    id: 'warranty',
    title: 'Warranty Registration',
    subtitle: 'Machine warranty, covered parts and claim tracking',
    icon: 'shield',
    accent: '#2E7D32',
    section: 'operations',
    statuses: ['Registered', 'Active', 'Claim Open', 'Resolved', 'Expired'],
    fields: [
      { key: 'warrantyNo', label: 'Warranty No.', kind: 'text', required: true },
      { key: 'customerName', label: 'Customer / Company', kind: 'text', required: true },
      { key: 'phone', label: 'Phone', kind: 'text' },
      { key: 'machineModel', label: 'Machine Model', kind: 'text', required: true },
      { key: 'serialNumber', label: 'Serial Number', kind: 'text', required: true },
      { key: 'installDate', label: 'Installation Date', kind: 'date' },
      { key: 'expiryDate', label: 'Warranty Expiry Date', kind: 'date' },
      { key: 'coveredParts', label: 'Covered Parts', kind: 'multiline', defaultValue: 'Mainboard, Headboard, Servo Motor, Driver' },
      { key: 'notes', label: 'Terms / Notes', kind: 'multiline' },
    ],
  },
  {
    id: 'spare-parts-logistics',
    title: 'Spare Parts Logistics',
    subtitle: 'Request, approval, dispatch, tracking and delivery',
    icon: 'package',
    accent: '#F57C00',
    section: 'operations',
    statuses: ['Requested', 'Approved', 'Packed', 'Dispatched', 'Delivered', 'Returned'],
    fields: [
      { key: 'requestNo', label: 'Request No.', kind: 'text', required: true },
      { key: 'ticketNo', label: 'Service Ticket No.', kind: 'text' },
      { key: 'customerName', label: 'Customer / Engineer', kind: 'text', required: true },
      { key: 'partName', label: 'Part Name', kind: 'text', required: true },
      { key: 'partNumber', label: 'Part / SKU No.', kind: 'text' },
      { key: 'quantity', label: 'Quantity', kind: 'number', required: true, defaultValue: '1' },
      { key: 'source', label: 'Source Warehouse / Supplier', kind: 'text' },
      { key: 'destination', label: 'Delivery Destination', kind: 'text' },
      { key: 'dispatchMode', label: 'Dispatch Mode', kind: 'select', options: ['Office Pickup', 'Courier', 'Bus', 'Air', 'Door to Door', 'Shipment'] },
      { key: 'trackingNo', label: 'Tracking / Challan No.', kind: 'text' },
      { key: 'notes', label: 'Notes', kind: 'multiline' },
    ],
  },
  {
    id: 'suppliers',
    title: 'Suppliers & Purchase',
    subtitle: 'Supplier, PI/PO, payment and purchase status',
    icon: 'briefcase',
    accent: '#1565C0',
    section: 'commercial',
    statuses: ['Draft', 'Confirmed', 'Advance Paid', 'Production', 'Ready', 'Closed'],
    fields: [
      { key: 'supplierName', label: 'Supplier Name', kind: 'text', required: true },
      { key: 'purchaseType', label: 'Purchase Type', kind: 'select', required: true, options: ['Cash Purchase', 'TT', 'LC', 'Warranty Repair', 'Replacement'] },
      { key: 'piNo', label: 'PI No.', kind: 'text' },
      { key: 'poNo', label: 'PO No.', kind: 'text' },
      { key: 'currency', label: 'Currency', kind: 'select', options: ['USD', 'CNY', 'BDT'] },
      { key: 'totalValue', label: 'Purchase Value', kind: 'number' },
      { key: 'advancePaid', label: 'Advance Paid', kind: 'number' },
      { key: 'balanceDue', label: 'Balance Due', kind: 'number' },
      { key: 'expectedReadyDate', label: 'Expected Ready Date', kind: 'date' },
      { key: 'notes', label: 'Purchase Notes', kind: 'multiline' },
    ],
  },
  {
    id: 'lc-tt-shipment',
    title: 'LC / TT & Shipment',
    subtitle: 'Foreign payment, production, shipment and trucking',
    icon: 'truck',
    accent: '#7B1FA2',
    section: 'commercial',
    statuses: ['Draft', 'Payment Pending', 'Production', 'Ready to Ship', 'In Transit', 'Port / Customs', 'Trucking', 'Received', 'Closed'],
    fields: [
      { key: 'supplierName', label: 'Supplier', kind: 'text', required: true },
      { key: 'purchaseRef', label: 'PI / Purchase Reference', kind: 'text', required: true },
      { key: 'paymentType', label: 'Payment Type', kind: 'select', options: ['LC', 'TT', 'Cash', 'No Charge / Warranty'] },
      { key: 'lcTtNo', label: 'LC / TT No.', kind: 'text' },
      { key: 'bankName', label: 'Bank', kind: 'text' },
      { key: 'shipmentMethod', label: 'Shipment Method', kind: 'select', options: ['Sea', 'Air', 'Door to Door', 'With Machine', 'Courier'] },
      { key: 'etd', label: 'ETD', kind: 'date' },
      { key: 'eta', label: 'ETA', kind: 'date' },
      { key: 'port', label: 'Port / Airport', kind: 'text' },
      { key: 'containerAwb', label: 'Container / BL / AWB', kind: 'text' },
      { key: 'truckingRef', label: 'Trucking / CNF Reference', kind: 'text' },
      { key: 'notes', label: 'Shipment Notes', kind: 'multiline' },
    ],
  },
  {
    id: 'landed-cost',
    title: 'Landed Cost',
    subtitle: 'Purchase, freight, duty and product-wise unit cost',
    icon: 'calculator',
    accent: '#C62828',
    section: 'accounts',
    statuses: ['Draft', 'Calculated', 'Approved', 'Posted'],
    fields: [
      { key: 'shipmentRef', label: 'Shipment / LC Reference', kind: 'text', required: true },
      { key: 'productName', label: 'Product / Item', kind: 'text', required: true },
      { key: 'quantity', label: 'Quantity', kind: 'number', required: true, defaultValue: '1' },
      { key: 'purchaseValue', label: 'Purchase Value (BDT)', kind: 'number' },
      { key: 'freight', label: 'Freight / Shipping', kind: 'number' },
      { key: 'customsDuty', label: 'Customs Duty', kind: 'number' },
      { key: 'cnf', label: 'CNF / Clearing', kind: 'number' },
      { key: 'transport', label: 'Transport / Labour', kind: 'number' },
      { key: 'bankCharge', label: 'Bank / LC Charge', kind: 'number' },
      { key: 'otherCost', label: 'Other Cost', kind: 'number' },
      { key: 'totalLandedCost', label: 'Total Landed Cost', kind: 'number' },
      { key: 'unitLandedCost', label: 'Unit Landed Cost', kind: 'number' },
      { key: 'notes', label: 'Allocation Notes', kind: 'multiline' },
    ],
  },
  {
    id: 'agreements',
    title: 'Sales Agreements',
    subtitle: 'Machine agreement, down payment and EMI schedule',
    icon: 'file-text',
    accent: '#00695C',
    section: 'accounts',
    statuses: ['Draft', 'Signed', 'Active', 'Completed', 'Cancelled'],
    fields: [
      { key: 'agreementNo', label: 'Agreement No.', kind: 'text', required: true },
      { key: 'customerName', label: 'Customer Name', kind: 'text', required: true },
      { key: 'phone', label: 'Phone', kind: 'text' },
      { key: 'nid', label: 'NID No.', kind: 'text' },
      { key: 'machineModel', label: 'Machine Model', kind: 'text', required: true },
      { key: 'serialNumber', label: 'Serial Number', kind: 'text' },
      { key: 'cashPrice', label: 'Cash Price', kind: 'number' },
      { key: 'downPayment', label: 'Down Payment', kind: 'number' },
      { key: 'remainingAmount', label: 'Remaining Amount', kind: 'number' },
      { key: 'emiMonths', label: 'EMI Months', kind: 'number' },
      { key: 'monthlyAmount', label: 'Monthly EMI', kind: 'number' },
      { key: 'firstDueDate', label: 'First Due Date', kind: 'date' },
      { key: 'specialTerms', label: 'Special Terms', kind: 'multiline' },
    ],
  },
  {
    id: 'supplier-ledger',
    title: 'Supplier Ledger',
    subtitle: 'Debit, credit, payment and running balance records',
    icon: 'book-open',
    accent: '#455A64',
    section: 'accounts',
    statuses: ['Open', 'Verified', 'Settled'],
    fields: [
      { key: 'supplierName', label: 'Supplier Name', kind: 'text', required: true },
      { key: 'entryDate', label: 'Entry Date', kind: 'date', required: true },
      { key: 'reference', label: 'Reference', kind: 'text' },
      { key: 'entryType', label: 'Entry Type', kind: 'select', options: ['Purchase', 'Advance', 'Payment', 'Bank Charge', 'Freight', 'Adjustment'] },
      { key: 'debit', label: 'Debit / OUT', kind: 'number' },
      { key: 'credit', label: 'Credit / IN', kind: 'number' },
      { key: 'runningBalance', label: 'Running Balance', kind: 'number' },
      { key: 'notes', label: 'Particulars / Notes', kind: 'multiline' },
    ],
  },
  {
    id: 'leave-payroll',
    title: 'Leave, Payroll & Holiday',
    subtitle: 'Leave approval, salary payable and holiday workflow',
    icon: 'calendar',
    accent: '#AD1457',
    section: 'hr',
    statuses: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Paid'],
    fields: [
      { key: 'employeeName', label: 'Employee Name', kind: 'text', required: true },
      { key: 'employeeCode', label: 'Employee Code', kind: 'text' },
      { key: 'recordType', label: 'Record Type', kind: 'select', options: ['Leave', 'Payroll', 'Holiday', 'Overtime', 'Deduction'] },
      { key: 'leaveType', label: 'Leave Type', kind: 'select', options: ['Casual', 'Sick', 'Earned', 'Unpaid', 'Official Duty'] },
      { key: 'fromDate', label: 'From Date', kind: 'date' },
      { key: 'toDate', label: 'To Date', kind: 'date' },
      { key: 'grossSalary', label: 'Gross Salary', kind: 'number' },
      { key: 'deduction', label: 'Deduction', kind: 'number' },
      { key: 'payable', label: 'Net Payable', kind: 'number' },
      { key: 'reason', label: 'Reason / Details', kind: 'multiline' },
    ],
  },
  {
    id: 'biometric',
    title: 'Biometric Connectors',
    subtitle: 'Attendance device configuration and sync status',
    icon: 'cpu',
    accent: '#EF6C00',
    section: 'admin',
    statuses: ['Not Configured', 'Configured', 'Online', 'Offline', 'Sync Error'],
    fields: [
      { key: 'deviceName', label: 'Device Name', kind: 'text', required: true },
      { key: 'brand', label: 'Brand', kind: 'select', options: ['ZKTeco', 'Hikvision', 'Suprema', 'Realtime', 'Other'] },
      { key: 'model', label: 'Model', kind: 'text' },
      { key: 'serialNumber', label: 'Serial Number', kind: 'text' },
      { key: 'ipAddress', label: 'IP Address', kind: 'text' },
      { key: 'port', label: 'Port', kind: 'number', defaultValue: '4370' },
      { key: 'location', label: 'Office Location', kind: 'text' },
      { key: 'syncMode', label: 'Sync Mode', kind: 'select', options: ['Push', 'Pull', 'Cloud API', 'Manual Import'] },
      { key: 'lastSync', label: 'Last Sync', kind: 'text' },
      { key: 'notes', label: 'Connector Notes', kind: 'multiline' },
    ],
  },
];

export function getExtendedModule(id?: string | string[]): ExtendedModuleDefinition | undefined {
  const moduleId = Array.isArray(id) ? id[0] : id;
  return EXTENDED_MODULES.find(item => item.id === moduleId);
}
