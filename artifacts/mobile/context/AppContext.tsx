import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import type {
  Company, Customer, DeliveryOrder, Engineer, EngineerAvailability,
  Expense, Invoice, MarketingTask, Notification, Payment, Product,
  ScheduleEntry, ServicePart, ServicePhoto, ServiceReport, ServiceSignature,
  ServiceTicket, StockMovement, User, UserRole,
} from '@/constants/types';

const STORAGE_KEY = 'colorjet_erp_data_v2';

interface AppState {
  users: User[];
  currentUser: User | null;
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  tickets: ServiceTicket[];
  products: Product[];
  stockMovements: StockMovement[];
  deliveries: DeliveryOrder[];
  expenses: Expense[];
  engineers: Engineer[];
  tasks: MarketingTask[];
  notifications: Notification[];
  schedule: ScheduleEntry[];
  company: Company;
  isLoading: boolean;
}

interface AppContextValue extends AppState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => void;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  updateTicketStatus: (ticketId: string, status: ServiceTicket['status']) => void;
  startTravel: (ticketId: string) => void;
  startWork: (ticketId: string) => void;
  pauseWork: (ticketId: string) => void;
  resumeWork: (ticketId: string) => void;
  completeWork: (ticketId: string) => void;
  addTicketPart: (ticketId: string, part: ServicePart) => void;
  addTicketPhoto: (ticketId: string, photo: { uri: string; type: ServicePhoto['type'] }) => void;
  saveSignature: (ticketId: string, sig: ServiceSignature) => void;
  submitReport: (ticketId: string, report: ServiceReport) => void;
  markNotificationRead: (notifId: string) => void;
  markAllNotificationsRead: () => void;
  updateDeliveryStatus: (id: string, status: DeliveryOrder['status']) => void;
  addScheduleEntry: (entry: Omit<ScheduleEntry, 'id'>) => void;
  updateScheduleStatus: (id: string, status: ScheduleEntry['status']) => void;
  updateEngineer: (id: string, patch: Partial<Engineer>) => void;
  updateUser: (id: string, patch: Partial<User>) => void;
  toggleUserActive: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

function uid(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const SEED_COMPANY: Company = {
  companyName: 'COLORJET Bangladesh',
  address: 'House 45, Road 11, Banani, Dhaka-1213, Bangladesh',
  hotline: '01700-000000',
  email: 'service@colorjet.com.bd',
  website: 'www.colorjet.com.bd',
};

const SEED_USERS: User[] = [
  { id: 'u1', name: 'Sabbir Ahmed', email: 'admin@colorjet.com', password: 'admin123', role: 'admin', phone: '01711000001', department: 'Management', employeeCode: 'CJ-001', roleTitle: 'Managing Director', isActive: true, createdAt: '2024-01-01' },
  { id: 'u2', name: 'Rakib Hassan', email: 'engineer@colorjet.com', password: 'eng123', role: 'engineer', phone: '01711000002', department: 'Service', employeeCode: 'CJ-002', roleTitle: 'Senior Engineer', isActive: true, createdAt: '2024-01-01' },
  { id: 'u3', name: 'Nasrin Akter', email: 'accounts@colorjet.com', password: 'acc123', role: 'accounts', phone: '01711000003', department: 'Finance', employeeCode: 'CJ-003', roleTitle: 'Accounts Manager', isActive: true, createdAt: '2024-01-01' },
  { id: 'u4', name: 'Karim Hossain', email: 'marketing@colorjet.com', password: 'mkt123', role: 'marketing', phone: '01711000004', department: 'Sales', employeeCode: 'CJ-004', roleTitle: 'Marketing Executive', isActive: true, createdAt: '2024-01-01' },
  { id: 'u5', name: 'Reza Khan', email: 'store@colorjet.com', password: 'store123', role: 'store', phone: '01711000005', department: 'Warehouse', employeeCode: 'CJ-005', roleTitle: 'Store Manager', isActive: true, createdAt: '2024-01-01' },
  { id: 'u6', name: 'Mitu Begum', email: 'service@colorjet.com', password: 'svc123', role: 'service_control', phone: '01711000006', department: 'Service', employeeCode: 'CJ-006', roleTitle: 'Service Coordinator', isActive: true, createdAt: '2024-01-01' },
  { id: 'u7', name: 'ABC Prints Ltd', email: 'customer@abcprints.com', password: 'cust123', role: 'customer', phone: '01811000001', isActive: true, createdAt: '2024-01-15' },
];

const SEED_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'ABC Prints Ltd', contactPerson: 'Arif Billah', phone: '01811000001', whatsapp: '01811000001', email: 'arif@abcprints.com', address: '12 Tejgaon Industrial Area', district: 'Dhaka', customerType: 'corporate', creditLimit: 500000, totalPaid: 850000, totalDue: 45000, createdAt: '2023-06-01' },
  { id: 'c2', name: 'Star Advertising', contactPerson: 'Farida Islam', phone: '01822000002', whatsapp: '01822000002', address: '45 Gulshan Avenue', district: 'Dhaka', customerType: 'corporate', creditLimit: 300000, totalPaid: 420000, totalDue: 80000, createdAt: '2023-08-10' },
  { id: 'c3', name: 'Comilla Graphics', contactPerson: 'Jahangir Hossain', phone: '01933000003', address: '23 Tomsom Bridge Road', district: 'Comilla', customerType: 'retail', creditLimit: 200000, totalPaid: 180000, totalDue: 30000, createdAt: '2024-01-15' },
  { id: 'c4', name: 'National Signage Co.', contactPerson: 'Shafiq Alam', phone: '01744000004', email: 'info@nationalsign.com', address: '67 Motijheel Commercial Area', district: 'Dhaka', customerType: 'corporate', creditLimit: 800000, totalPaid: 1200000, totalDue: 125000, createdAt: '2022-11-20' },
  { id: 'c5', name: 'Chattogram Printers', contactPerson: 'Momtaz Ahmed', phone: '01855000005', address: '89 Agrabad Commercial Area', district: 'Chattogram', customerType: 'retail', creditLimit: 150000, totalPaid: 95000, totalDue: 0, createdAt: '2024-03-05' },
];

const SEED_PRODUCTS: Product[] = [
  { id: 'p1', sku: 'CJ-M001', name: 'COLORJET Vega 1300S', categoryId: 'cat1', categoryName: 'Machines', productType: 'machine', uom: 'pcs', costPrice: 450000, salePrice: 580000, currentStock: 3, minStockQty: 1, isActive: true },
  { id: 'p2', sku: 'CJ-I001', name: 'Eco Solvent Ink - Cyan 1L', categoryId: 'cat2', categoryName: 'Inks', productType: 'ink', uom: 'bottle', costPrice: 1200, salePrice: 1800, currentStock: 45, minStockQty: 20, isActive: true },
  { id: 'p3', sku: 'CJ-I002', name: 'Eco Solvent Ink - Magenta 1L', categoryId: 'cat2', categoryName: 'Inks', productType: 'ink', uom: 'bottle', costPrice: 1200, salePrice: 1800, currentStock: 38, minStockQty: 20, isActive: true },
  { id: 'p4', sku: 'CJ-I003', name: 'Eco Solvent Ink - Yellow 1L', categoryId: 'cat2', categoryName: 'Inks', productType: 'ink', uom: 'bottle', costPrice: 1200, salePrice: 1800, currentStock: 12, minStockQty: 20, isActive: true },
  { id: 'p5', sku: 'CJ-I004', name: 'Eco Solvent Ink - Black 1L', categoryId: 'cat2', categoryName: 'Inks', productType: 'ink', uom: 'bottle', costPrice: 1100, salePrice: 1650, currentStock: 55, minStockQty: 20, isActive: true },
  { id: 'p6', sku: 'CJ-S001', name: 'Printhead DX5', categoryId: 'cat3', categoryName: 'Spare Parts', productType: 'spare', uom: 'pcs', costPrice: 8500, salePrice: 12000, currentStock: 4, minStockQty: 5, isActive: true },
  { id: 'p7', sku: 'CJ-S002', name: 'Capping Station', categoryId: 'cat3', categoryName: 'Spare Parts', productType: 'spare', uom: 'pcs', costPrice: 2200, salePrice: 3500, currentStock: 8, minStockQty: 3, isActive: true },
  { id: 'p8', sku: 'CJ-S003', name: 'Wiper Blade', categoryId: 'cat3', categoryName: 'Spare Parts', productType: 'spare', uom: 'pcs', costPrice: 350, salePrice: 600, currentStock: 2, minStockQty: 10, isActive: true },
  { id: 'p9', sku: 'CJ-C001', name: 'Vinyl Roll 1.37m x 50m', categoryId: 'cat4', categoryName: 'Consumables', productType: 'consumable', uom: 'roll', costPrice: 2800, salePrice: 3800, currentStock: 15, minStockQty: 5, isActive: true },
];

const SEED_INVOICES: Invoice[] = [
  {
    id: 'inv1', invoiceNo: 'INV-2024-001', customerId: 'c1', customerName: 'ABC Prints Ltd',
    invoiceDate: '2024-06-01', dueDate: '2024-07-01',
    lines: [
      { id: 'l1', productId: 'p1', productName: 'COLORJET Vega 1300S', qty: 1, unitPrice: 580000, lineTotal: 580000 },
      { id: 'l2', productId: 'p2', productName: 'Eco Solvent Ink - Cyan 1L', qty: 10, unitPrice: 1800, lineTotal: 18000 },
    ],
    totalAmount: 598000, totalPaid: 553000, totalDue: 45000, status: 'partial',
    createdBy: 'u1', createdAt: '2024-06-01',
  },
  {
    id: 'inv2', invoiceNo: 'INV-2024-002', customerId: 'c2', customerName: 'Star Advertising',
    invoiceDate: '2024-06-05', dueDate: '2024-07-05',
    lines: [
      { id: 'l3', productId: 'p2', productName: 'Eco Solvent Ink - Cyan 1L', qty: 20, unitPrice: 1800, lineTotal: 36000 },
      { id: 'l4', productId: 'p4', productName: 'Eco Solvent Ink - Black 1L', qty: 20, unitPrice: 1650, lineTotal: 33000 },
      { id: 'l5', productId: 'p9', productName: 'Vinyl Roll 1.37m x 50m', qty: 5, unitPrice: 3800, lineTotal: 19000 },
    ],
    totalAmount: 88000, totalPaid: 8000, totalDue: 80000, status: 'partial',
    createdBy: 'u1', createdAt: '2024-06-05',
  },
  {
    id: 'inv3', invoiceNo: 'INV-2024-003', customerId: 'c3', customerName: 'Comilla Graphics',
    invoiceDate: '2024-06-10', dueDate: '2024-07-10',
    lines: [
      { id: 'l6', productId: 'p6', productName: 'Printhead DX5', qty: 2, unitPrice: 12000, lineTotal: 24000 },
      { id: 'l7', productId: 'p7', productName: 'Capping Station', qty: 2, unitPrice: 3500, lineTotal: 7000 },
    ],
    totalAmount: 31000, totalPaid: 1000, totalDue: 30000, status: 'partial',
    createdBy: 'u1', createdAt: '2024-06-10',
  },
  {
    id: 'inv4', invoiceNo: 'INV-2024-004', customerId: 'c4', customerName: 'National Signage Co.',
    invoiceDate: '2024-06-12', dueDate: '2024-07-12',
    lines: [
      { id: 'l8', productId: 'p1', productName: 'COLORJET Vega 1300S', qty: 1, unitPrice: 580000, lineTotal: 580000 },
    ],
    totalAmount: 580000, totalPaid: 455000, totalDue: 125000, status: 'partial',
    createdBy: 'u1', createdAt: '2024-06-12',
  },
  {
    id: 'inv5', invoiceNo: 'INV-2024-005', customerId: 'c5', customerName: 'Chattogram Printers',
    invoiceDate: '2024-06-15', dueDate: '2024-07-15',
    lines: [
      { id: 'l9', productId: 'p3', productName: 'Eco Solvent Ink - Magenta 1L', qty: 12, unitPrice: 1800, lineTotal: 21600 },
      { id: 'l10', productId: 'p5', productName: 'Eco Solvent Ink - Black 1L', qty: 10, unitPrice: 1650, lineTotal: 16500 },
    ],
    totalAmount: 38100, totalPaid: 38100, totalDue: 0, status: 'paid',
    createdBy: 'u1', createdAt: '2024-06-15',
  },
];

const SEED_PAYMENTS: Payment[] = [
  { id: 'pay1', customerId: 'c1', customerName: 'ABC Prints Ltd', invoiceId: 'inv1', paymentDate: '2024-06-03', amount: 300000, method: 'Bank Transfer', reference: 'TXN-001', createdBy: 'u3', createdAt: '2024-06-03' },
  { id: 'pay2', customerId: 'c1', customerName: 'ABC Prints Ltd', invoiceId: 'inv1', paymentDate: '2024-06-15', amount: 253000, method: 'Bank Transfer', reference: 'TXN-002', createdBy: 'u3', createdAt: '2024-06-15' },
  { id: 'pay3', customerId: 'c2', customerName: 'Star Advertising', invoiceId: 'inv2', paymentDate: '2024-06-08', amount: 8000, method: 'Cash', createdBy: 'u3', createdAt: '2024-06-08' },
  { id: 'pay4', customerId: 'c5', customerName: 'Chattogram Printers', invoiceId: 'inv5', paymentDate: '2024-06-16', amount: 38100, method: 'bKash', reference: 'BKS-12345', createdBy: 'u3', createdAt: '2024-06-16' },
];

const SEED_TICKETS: ServiceTicket[] = [
  {
    id: 't1', ticketNo: 'TK-2024-001', customerId: 'c1', customerName: 'ABC Prints Ltd',
    customerPhone: '01811000001', customerAddress: '12 Tejgaon Industrial Area', area: 'Tejgaon',
    title: 'Printhead clogging - Color banding issue', description: 'Machine showing color banding on prints. Printhead likely needs cleaning or replacement.',
    status: 'in_progress', priority: 'high', machineModel: 'Vega 1300S', machineSerial: 'VG13-2023-0421',
    warrantyStatus: 'out_warranty', assignedEngineerId: 'u2', assignedEngineerName: 'Rakib Hassan',
    plannedDate: '2024-06-20', workStartAt: new Date(Date.now() - 3600000).toISOString(),
    usedParts: [], photos: [], createdAt: '2024-06-19',
  },
  {
    id: 't2', ticketNo: 'TK-2024-002', customerId: 'c2', customerName: 'Star Advertising',
    customerPhone: '01822000002', customerAddress: '45 Gulshan Avenue', area: 'Gulshan',
    title: 'Machine not turning on', description: 'Power board failure suspected. Machine completely unresponsive.',
    status: 'assigned', priority: 'emergency', machineModel: 'Vega 1800', machineSerial: 'VG18-2022-0312',
    warrantyStatus: 'in_warranty', assignedEngineerId: 'u2', assignedEngineerName: 'Rakib Hassan',
    plannedDate: '2024-06-21', usedParts: [], photos: [], createdAt: '2024-06-20',
  },
  {
    id: 't3', ticketNo: 'TK-2024-003', customerId: 'c3', customerName: 'Comilla Graphics',
    customerPhone: '01933000003', area: 'Comilla City',
    title: 'Regular maintenance service', description: 'Scheduled preventive maintenance - cleaning, alignment, firmware update.',
    status: 'pending', priority: 'normal', machineModel: 'Vega 1300S', machineSerial: 'VG13-2023-0055',
    warrantyStatus: 'in_warranty', assignedEngineerName: 'Unassigned',
    plannedDate: '2024-06-25', usedParts: [], photos: [], createdAt: '2024-06-20',
  },
  {
    id: 't4', ticketNo: 'TK-2024-004', customerId: 'c4', customerName: 'National Signage Co.',
    customerPhone: '01744000004', area: 'Motijheel',
    title: 'Ink system leaking', description: 'Ink sub-tank seal broken, causing ink to leak onto platen.',
    status: 'waiting_parts', priority: 'high', machineModel: 'Vega 2500', machineSerial: 'VG25-2021-0089',
    warrantyStatus: 'out_warranty', assignedEngineerId: 'u2', assignedEngineerName: 'Rakib Hassan',
    plannedDate: '2024-06-22', usedParts: [], photos: [], createdAt: '2024-06-18',
  },
  {
    id: 't5', ticketNo: 'TK-2024-005', customerId: 'c5', customerName: 'Chattogram Printers',
    area: 'Agrabad',
    title: 'Media sensor not detecting', description: 'Media detection sensor failing intermittently.',
    status: 'completed', priority: 'normal', machineModel: 'Vega 1300S',
    warrantyStatus: 'in_warranty', assignedEngineerId: 'u2', assignedEngineerName: 'Rakib Hassan',
    plannedDate: '2024-06-10', completedDate: '2024-06-11',
    usedParts: [{ productId: 'p7', productName: 'Capping Station', qty: 1, billing: 'warranty', unitPrice: 0 }],
    photos: [], createdAt: '2024-06-08',
  },
];

const SEED_ENGINEERS: Engineer[] = [
  {
    id: 'e1', userId: 'u2', name: 'Rakib Hassan', phone: '01711000002', area: 'Dhaka',
    roleTitle: 'Senior Field Engineer',
    skills: ['Printhead replacement', 'Ink system', 'Electronics', 'Firmware'],
    areas: ['Dhaka', 'Comilla', 'Chattogram'],
    availability: 'on_job', status: 'on_job',
    completedJobs: 147, rating: 4.8, firstTimeFixPct: 82,
    lateJobs: 12, travelKm: 3250, revenueContribution: 850000,
    permissions: { viewAllJobs: true, editParts: true, closeTickets: true, viewReports: false, manageSchedule: true },
  },
];

const SEED_DELIVERIES: DeliveryOrder[] = [
  {
    id: 'd1', doNo: 'DO-2024-001', customerId: 'c2', customerName: 'Star Advertising',
    deliveryDate: '2024-06-22', status: 'out_for_delivery',
    items: ['Eco Solvent Ink - Cyan 1L x20'],
    receiverName: 'Farida Islam', receiverPhone: '01822000002',
    deliveredByName: 'Karim Hossain', vehicleNo: 'DH-11-1234',
    assignedTo: 'u4', address: '45 Gulshan Avenue, Dhaka', notes: 'Call before delivery',
  },
  {
    id: 'd2', doNo: 'DO-2024-002', customerId: 'c3', customerName: 'Comilla Graphics',
    deliveryDate: '2024-06-25', status: 'pending',
    items: ['Printhead DX5 x2'],
    receiverName: 'Jahangir Hossain', receiverPhone: '01933000003',
    deliveredByName: 'Karim Hossain',
    address: '23 Tomsom Bridge Road, Comilla',
  },
];

const SEED_EXPENSES: Expense[] = [
  { id: 'exp1', expenseDate: '2024-06-01', category: 'Salary', description: 'June salary - engineering staff', amount: 55000, paidById: 'u3', paidByName: 'Nasrin Akter', paymentMethod: 'Bank Transfer', createdAt: '2024-06-01' },
  { id: 'exp2', expenseDate: '2024-06-05', category: 'Transport', description: 'Field visit - Comilla trip', amount: 3500, paidById: 'u2', paidByName: 'Rakib Hassan', paymentMethod: 'Cash', createdAt: '2024-06-05' },
  { id: 'exp3', expenseDate: '2024-06-10', category: 'Rent', description: 'Office rent - June 2024', amount: 35000, paidById: 'u3', paidByName: 'Nasrin Akter', paymentMethod: 'Bank Transfer', createdAt: '2024-06-10' },
  { id: 'exp4', expenseDate: '2024-06-12', category: 'Utility', description: 'Electricity and internet', amount: 8500, paidById: 'u3', paidByName: 'Nasrin Akter', paymentMethod: 'Cash', createdAt: '2024-06-12' },
  { id: 'exp5', expenseDate: '2024-06-15', category: 'Entertainment', description: 'Client lunch - National Signage meeting', amount: 4200, paidById: 'u1', paidByName: 'Sabbir Ahmed', paymentMethod: 'Cash', createdAt: '2024-06-15' },
];

const SEED_TASKS: MarketingTask[] = [
  { id: 'mt1', taskNo: 'MT-001', customerId: 'c2', customerName: 'Star Advertising', type: 'collection', status: 'pending', assignedMarketingId: 'u4', targetDate: '2024-06-22', purpose: 'Collect overdue payment ৳80,000', createdAt: '2024-06-20' },
  { id: 'mt2', taskNo: 'MT-002', customerId: 'c3', customerName: 'Comilla Graphics', type: 'visit', status: 'in_progress', assignedMarketingId: 'u4', targetDate: '2024-06-23', purpose: 'Upsell ink subscription package', createdAt: '2024-06-19' },
];

const SEED_NOTIFICATIONS: Notification[] = [
  { id: 'n1', userId: 'u1', title: 'Low Stock Alert', message: 'Wiper Blade (CJ-S003) is below minimum stock level (2/10).', type: 'stock_warning', isRead: false, createdAt: '2024-06-20' },
  { id: 'n2', userId: 'u1', title: 'Overdue Payment', message: 'National Signage Co. has ৳125,000 overdue payment.', type: 'due_warning', isRead: false, createdAt: '2024-06-19' },
  { id: 'n3', userId: 'u2', title: 'New Ticket Assigned', message: 'Emergency ticket TK-2024-002 assigned to you - Star Advertising.', type: 'job_assigned', isRead: false, createdAt: '2024-06-20' },
  { id: 'n4', userId: 'u1', title: 'Payment Received', message: 'ABC Prints Ltd paid ৳253,000 via Bank Transfer.', type: 'payment', isRead: true, createdAt: '2024-06-15' },
];

const SEED_SCHEDULE: ScheduleEntry[] = [
  { id: 'sch1', engineerId: 'e1', engineerName: 'Rakib Hassan', customerName: 'ABC Prints Ltd', area: 'Tejgaon', date: '2024-06-20', time: '09:00', priority: 'high', status: 'in_progress' },
  { id: 'sch2', engineerId: 'e1', engineerName: 'Rakib Hassan', customerName: 'Star Advertising', area: 'Gulshan', date: '2024-06-21', time: '11:00', priority: 'emergency', status: 'planned' },
  { id: 'sch3', engineerId: 'e1', engineerName: 'Rakib Hassan', customerName: 'Comilla Graphics', area: 'Comilla', date: '2024-06-25', time: '09:30', priority: 'normal', status: 'planned', note: 'Full day trip - bring PM toolkit' },
];

const INITIAL_STATE: Omit<AppState, 'isLoading'> = {
  users: SEED_USERS,
  currentUser: null,
  customers: SEED_CUSTOMERS,
  invoices: SEED_INVOICES,
  payments: SEED_PAYMENTS,
  tickets: SEED_TICKETS,
  products: SEED_PRODUCTS,
  stockMovements: [],
  deliveries: SEED_DELIVERIES,
  expenses: SEED_EXPENSES,
  engineers: SEED_ENGINEERS,
  tasks: SEED_TASKS,
  notifications: SEED_NOTIFICATIONS,
  schedule: SEED_SCHEDULE,
  company: SEED_COMPANY,
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({ ...INITIAL_STATE, isLoading: true });

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState(s => ({ ...s, ...parsed, isLoading: false }));
      } else {
        setState(s => ({ ...s, isLoading: false }));
      }
    } catch {
      setState(s => ({ ...s, isLoading: false }));
    }
  };

  const persist = async (newState: Partial<AppState>) => {
    try {
      const { isLoading, ...toSave } = newState as AppState;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {}
  };

  const update = (updater: (prev: AppState) => Partial<AppState>) => {
    setState(prev => {
      const patch = updater(prev);
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const user = state.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.isActive);
    if (!user) return false;
    update(() => ({ currentUser: user }));
    return true;
  };

  const logout = () => {
    update(() => ({ currentUser: null }));
  };

  const addPayment = (payment: Omit<Payment, 'id' | 'createdAt'>) => {
    update(prev => {
      const newPayment: Payment = { ...payment, id: uid(), createdAt: new Date().toISOString() };
      const updatedInvoices = prev.invoices.map(inv => {
        if (inv.id !== payment.invoiceId) return inv;
        const newPaid = inv.totalPaid + payment.amount;
        const newDue = Math.max(0, inv.totalAmount - newPaid);
        return { ...inv, totalPaid: newPaid, totalDue: newDue, status: newDue === 0 ? 'paid' as const : 'partial' as const };
      });
      const updatedCustomers = prev.customers.map(c => {
        if (c.id !== payment.customerId) return c;
        return { ...c, totalPaid: c.totalPaid + payment.amount, totalDue: Math.max(0, c.totalDue - payment.amount) };
      });
      return { payments: [...prev.payments, newPayment], invoices: updatedInvoices, customers: updatedCustomers };
    });
  };

  const addExpense = (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    update(prev => ({
      expenses: [...prev.expenses, { ...expense, id: uid(), createdAt: new Date().toISOString() }],
    }));
  };

  const updateTicketStatus = (ticketId: string, status: ServiceTicket['status']) => {
    update(prev => ({
      tickets: prev.tickets.map(t => t.id === ticketId ? { ...t, status } : t),
    }));
  };

  const startTravel = (ticketId: string) => {
    update(prev => ({
      tickets: prev.tickets.map(t => t.id === ticketId
        ? { ...t, status: 'on_the_way' as const, travelStartAt: new Date().toISOString() }
        : t),
    }));
  };

  const startWork = (ticketId: string) => {
    update(prev => ({
      tickets: prev.tickets.map(t => {
        if (t.id !== ticketId) return t;
        const now = new Date().toISOString();
        let totalTravelMs = t.totalTravelMs ?? 0;
        if (t.travelStartAt) {
          totalTravelMs += Date.now() - new Date(t.travelStartAt).getTime();
        }
        return { ...t, status: 'in_progress' as const, workStartAt: now, totalTravelMs, isPaused: false, pausedMs: 0 };
      }),
    }));
  };

  const pauseWork = (ticketId: string) => {
    update(prev => ({
      tickets: prev.tickets.map(t => t.id === ticketId
        ? { ...t, isPaused: true, pauseStartedAt: new Date().toISOString() }
        : t),
    }));
  };

  const resumeWork = (ticketId: string) => {
    update(prev => ({
      tickets: prev.tickets.map(t => {
        if (t.id !== ticketId || !t.pauseStartedAt) return t;
        const extraPaused = Date.now() - new Date(t.pauseStartedAt).getTime();
        return { ...t, isPaused: false, pauseStartedAt: undefined, pausedMs: (t.pausedMs ?? 0) + extraPaused };
      }),
    }));
  };

  const completeWork = (ticketId: string) => {
    update(prev => ({
      tickets: prev.tickets.map(t => {
        if (t.id !== ticketId) return t;
        const now = new Date().toISOString();
        let totalWorkMs = 0;
        if (t.workStartAt) {
          totalWorkMs = Date.now() - new Date(t.workStartAt).getTime() - (t.pausedMs ?? 0);
        }
        return { ...t, status: 'completed' as const, workEndAt: now, completedDate: now.split('T')[0], totalWorkMs, isPaused: false };
      }),
    }));
  };

  const addTicketPart = (ticketId: string, part: ServicePart) => {
    update(prev => ({
      tickets: prev.tickets.map(t => t.id === ticketId
        ? { ...t, usedParts: [...(t.usedParts ?? []), part] }
        : t),
    }));
  };

  const addTicketPhoto = (ticketId: string, photo: { uri: string; type: ServicePhoto['type'] }) => {
    const newPhoto: ServicePhoto = { id: uid(), uri: photo.uri, type: photo.type, capturedAt: new Date().toISOString() };
    update(prev => ({
      tickets: prev.tickets.map(t => t.id === ticketId
        ? { ...t, photos: [...(t.photos ?? []), newPhoto] }
        : t),
    }));
  };

  const saveSignature = (ticketId: string, sig: ServiceSignature) => {
    update(prev => ({
      tickets: prev.tickets.map(t => t.id === ticketId
        ? { ...t, signature: { ...sig, capturedAt: new Date().toISOString() } }
        : t),
    }));
  };

  const submitReport = (ticketId: string, report: ServiceReport) => {
    update(prev => ({
      tickets: prev.tickets.map(t => {
        if (t.id !== ticketId) return t;
        const status = report.revisitRequired ? 'revisit' as const : 'completed' as const;
        return { ...t, report: { ...report, submittedAt: new Date().toISOString() }, status };
      }),
    }));
  };

  const markNotificationRead = (notifId: string) => {
    update(prev => ({
      notifications: prev.notifications.map(n => n.id === notifId ? { ...n, isRead: true } : n),
    }));
  };

  const markAllNotificationsRead = () => {
    update(prev => ({
      notifications: prev.notifications.map(n => ({ ...n, isRead: true })),
    }));
  };

  const updateDeliveryStatus = (id: string, status: DeliveryOrder['status']) => {
    update(prev => ({
      deliveries: prev.deliveries.map(d => d.id === id ? { ...d, status } : d),
    }));
  };

  const addScheduleEntry = (entry: Omit<ScheduleEntry, 'id'>) => {
    update(prev => ({
      schedule: [...prev.schedule, { ...entry, id: uid() }],
    }));
  };

  const updateScheduleStatus = (id: string, status: ScheduleEntry['status']) => {
    update(prev => ({
      schedule: prev.schedule.map(s => s.id === id ? { ...s, status } : s),
    }));
  };

  const updateEngineer = (id: string, patch: Partial<Engineer>) => {
    update(prev => ({
      engineers: prev.engineers.map(e => e.id === id ? { ...e, ...patch } : e),
    }));
  };

  const updateUser = (id: string, patch: Partial<User>) => {
    update(prev => ({
      users: prev.users.map(u => u.id === id ? { ...u, ...patch } : u),
    }));
  };

  const toggleUserActive = (id: string) => {
    update(prev => ({
      users: prev.users.map(u => u.id === id ? { ...u, isActive: !u.isActive } : u),
    }));
  };

  return (
    <AppContext.Provider value={{
      ...state,
      login, logout, addPayment, addExpense,
      updateTicketStatus, startTravel, startWork, pauseWork, resumeWork, completeWork,
      addTicketPart, addTicketPhoto, saveSignature, submitReport,
      markNotificationRead, markAllNotificationsRead,
      updateDeliveryStatus, addScheduleEntry, updateScheduleStatus,
      updateEngineer, updateUser, toggleUserActive,
    }}>
      {children}
    </AppContext.Provider>
  );
}
