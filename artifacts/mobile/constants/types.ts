export type UserRole =
  | 'admin'
  | 'manager'
  | 'service_control'
  | 'engineer'
  | 'marketing'
  | 'sales'
  | 'accounts'
  | 'store'
  | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  department?: string;
  employeeCode?: string;
  roleTitle?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address: string;
  district: string;
  customerType: 'corporate' | 'retail' | 'government';
  creditLimit: number;
  totalPaid: number;
  totalDue: number;
  createdAt: string;
}

export interface InvoiceLine {
  id: string;
  productId: string;
  productName: string;
  description?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  lines: InvoiceLine[];
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
  status: 'draft' | 'posted' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  invoiceId: string;
  paymentDate: string;
  amount: number;
  method: 'Cash' | 'Bank Transfer' | 'bKash' | 'Nagad' | 'Card' | 'Cheque';
  reference?: string;
  createdBy: string;
  createdAt: string;
}

export interface ServicePart {
  productId: string;
  productName: string;
  qty: number;
  billing?: 'warranty' | 'free' | 'chargeable';
  unitPrice?: number;
}

export interface ServicePhoto {
  id: string;
  uri: string;
  type: 'before' | 'problem' | 'parts' | 'serial' | 'after' | 'other';
  capturedAt: string;
}

export interface ServiceSignature {
  customerName: string;
  signatureData: string;
  rating?: number;
  comment?: string;
  confirmed: boolean;
  capturedAt?: string;
}

export interface ServiceReport {
  problemFound: string;
  workDone: string;
  pendingIssue?: string;
  revisitRequired: boolean;
  submittedById: string;
  submittedByName: string;
  submittedAt?: string;
}

export type TicketStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'on_the_way'
  | 'in_progress'
  | 'waiting_parts'
  | 'pending_customer'
  | 'revisit'
  | 'completed'
  | 'cancelled';

export interface ServiceTicket {
  id: string;
  ticketNo: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  area?: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: 'emergency' | 'high' | 'normal' | 'low';
  machineModel?: string;
  machineSerial?: string;
  warrantyStatus?: 'in_warranty' | 'out_warranty';
  assignedEngineerId?: string;
  assignedEngineerName: string;
  plannedDate: string;
  completedDate?: string;
  scheduledTime?: string;
  travelStartAt?: string;
  workStartAt?: string;
  workEndAt?: string;
  totalTravelMs?: number;
  totalWorkMs?: number;
  pausedMs?: number;
  isPaused?: boolean;
  pauseStartedAt?: string;
  usedParts?: ServicePart[];
  photos?: ServicePhoto[];
  signature?: ServiceSignature;
  report?: ServiceReport;
  workNotes?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  productType: 'machine' | 'ink' | 'spare' | 'consumable';
  uom: string;
  costPrice: number;
  salePrice: number;
  currentStock: number;
  minStockQty: number;
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  movementType: 'purchase_in' | 'sale_out' | 'service_use' | 'adjustment';
  qty: number;
  reference?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface DeliveryOrderItem {
  productId?: string;
  productName?: string;
  qty?: number;
}

export interface DeliveryOrder {
  id: string;
  doNo: string;
  customerId: string;
  customerName: string;
  deliveryDate: string;
  status: 'pending' | 'out_for_delivery' | 'delivered' | 'failed';
  items: string[];
  receiverName: string;
  receiverPhone: string;
  deliveredByName: string;
  vehicleNo?: string;
  assignedTo?: string;
  address: string;
  notes?: string;
}

export interface Expense {
  id: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  paidById: string;
  paidByName: string;
  paymentMethod: string;
  reference?: string;
  createdAt: string;
}

export type EngineerAvailability = 'available' | 'on_job' | 'busy' | 'leave' | 'offline';

export interface Engineer {
  id: string;
  userId: string;
  name: string;
  phone: string;
  area?: string;
  roleTitle?: string;
  skills: string[];
  areas?: string[];
  availability: EngineerAvailability;
  status?: EngineerAvailability;
  completedJobs: number;
  rating: number;
  firstTimeFixPct: number;
  lateJobs: number;
  travelKm: number;
  revenueContribution: number;
  permissions?: Record<string, boolean>;
}

export interface ScheduleEntry {
  id: string;
  engineerId: string;
  engineerName: string;
  customerName: string;
  area?: string;
  date: string;
  time: string;
  priority: 'low' | 'normal' | 'high' | 'emergency';
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  note?: string;
}

export interface MarketingTask {
  id: string;
  taskNo: string;
  customerId: string;
  customerName: string;
  type: 'visit' | 'collection' | 'delivery_support';
  status: 'pending' | 'in_progress' | 'done' | 'cancelled';
  assignedMarketingId: string;
  targetDate: string;
  purpose: string;
  collectedAmount?: number;
  notes?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId?: string;
  title: string;
  message: string;
  type: 'ticket_update' | 'payment_received' | 'stock_warning' | 'due_warning' | 'general' | 'new_ticket' | 'status_change' | 'payment' | 'job_assigned' | 'complaint';
  isRead: boolean;
  createdAt: string;
}

export interface Company {
  companyName: string;
  address: string;
  hotline: string;
  email: string;
  website?: string;
  taxId?: string;
}
