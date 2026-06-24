import React, { createContext, useContext, useEffect, useState } from 'react';
import type {
  Company, Customer, DeliveryOrder, Engineer, EngineerAvailability,
  Expense, Invoice, MarketingTask, Notification, Payment, Product,
  ScheduleEntry, ServicePart, ServicePhoto, ServiceReport, ServiceSignature,
  ServiceTicket, StockMovement, User, UserRole,
} from '@/constants/types';
import { getSupabase } from '@/lib/supabaseClient';
import { isProductionConfigured } from '@/lib/runtimeConfig';

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
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  updateTicketStatus: (ticketId: string, status: ServiceTicket['status']) => Promise<void>;
  startTravel: (ticketId: string) => Promise<void>;
  startWork: (ticketId: string) => Promise<void>;
  pauseWork: (ticketId: string) => void;
  resumeWork: (ticketId: string) => void;
  completeWork: (ticketId: string) => Promise<void>;
  addTicketPart: (ticketId: string, part: ServicePart) => Promise<void>;
  addTicketPhoto: (ticketId: string, photo: { uri: string; type: ServicePhoto['type'] }) => Promise<void>;
  saveSignature: (ticketId: string, sig: ServiceSignature) => Promise<void>;
  submitReport: (ticketId: string, report: ServiceReport) => Promise<void>;
  markNotificationRead: (notifId: string) => void;
  markAllNotificationsRead: () => void;
  updateDeliveryStatus: (id: string, status: DeliveryOrder['status']) => void;
  addScheduleEntry: (entry: Omit<ScheduleEntry, 'id'>) => Promise<void>;
  updateScheduleStatus: (id: string, status: ScheduleEntry['status']) => Promise<void>;
  updateEngineer: (id: string, patch: Partial<Engineer>) => Promise<void>;
  addUser: (user: Omit<User, 'id' | 'createdAt' | 'lastLogin'> & { temporaryPassword: string }) => Promise<void>;
  updateUser: (id: string, patch: Partial<User>) => Promise<void>;
  toggleUserActive: (id: string) => Promise<void>;
}

const EMPTY_COMPANY: Company = {
  companyName: 'COLORJET Bangladesh',
  address: '',
  hotline: '',
  email: '',
  website: '',
};

const EMPTY_STATE: AppState = {
  users: [], currentUser: null, customers: [], invoices: [], payments: [], tickets: [],
  products: [], stockMovements: [], deliveries: [], expenses: [], engineers: [], tasks: [],
  notifications: [], schedule: [], company: EMPTY_COMPANY, isLoading: true,
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

const priorityRoleCodes = ['owner', 'super_admin', 'admin', 'manager', 'service_manager', 'accounts', 'sales', 'commercial', 'store', 'engineer', 'viewer'];

function uiRole(roleCode?: string): UserRole {
  const alias: Record<string, UserRole> = {
    owner: 'admin', super_admin: 'admin', service_manager: 'service_control',
    commercial: 'sales', viewer: 'customer',
  };
  return (alias[roleCode ?? ''] || roleCode || 'customer') as UserRole;
}

function databaseRole(role: UserRole): string {
  const alias: Record<string, string> = {
    service_control: 'service_manager', marketing: 'sales', customer: 'viewer',
  };
  return alias[role] || role;
}

function asDate(value?: string | null): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function asNumber(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

async function rows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function maybeRows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  try { return await rows(query); } catch { return []; }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);

  const hydrate = async (userId: string) => {
    const supabase = getSupabase();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile || !profile.active) {
      await supabase.auth.signOut();
      setState({ ...EMPTY_STATE, isLoading: false });
      return;
    }

    const roleLinks = await maybeRows<any>(supabase.from('user_roles').select('role_id').eq('user_id', userId));
    const roleIds = roleLinks.map(link => link.role_id).filter(Boolean);
    const roles = roleIds.length
      ? await maybeRows<any>(supabase.from('roles').select('id,code,name').in('id', roleIds))
      : [];
    const roleCodes = roles.map(role => role.code as string);
    const primaryCode = priorityRoleCodes.find(code => roleCodes.includes(code)) || roleCodes[0] || 'viewer';

    const [profileRows, allRoleLinks, categoryRows, unitRows, warehouseRows, customerRows, customerLedgerRows,
      productRows, balanceRows, movementRows, invoiceRows, invoiceItemRows, paymentRows, ticketRows,
      engineerRows, scheduleRows, taskRows, expenseRows, expenseCategoryRows, companyRows] = await Promise.all([
      maybeRows<any>(supabase.from('profiles').select('*')),
      maybeRows<any>(supabase.from('user_roles').select('user_id,role_id')),
      maybeRows<any>(supabase.from('product_categories').select('id,name')),
      maybeRows<any>(supabase.from('units').select('id,code,name,symbol')),
      maybeRows<any>(supabase.from('warehouses').select('id,code,name')),
      maybeRows<any>(supabase.from('customers').select('*').order('created_at', { ascending: false })),
      maybeRows<any>(supabase.from('customer_ledger_entries').select('*')),
      maybeRows<any>(supabase.from('products').select('*').order('product_name')),
      maybeRows<any>(supabase.from('stock_balances').select('*')),
      maybeRows<any>(supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(500)),
      maybeRows<any>(supabase.from('invoices').select('*').order('invoice_date', { ascending: false })),
      maybeRows<any>(supabase.from('invoice_items').select('*')),
      maybeRows<any>(supabase.from('payments').select('*').order('payment_date', { ascending: false })),
      maybeRows<any>(supabase.from('service_tickets').select('*').order('created_at', { ascending: false })),
      maybeRows<any>(supabase.from('engineer_profiles').select('*')),
      maybeRows<any>(supabase.from('engineer_schedule').select('*').order('schedule_start')),
      maybeRows<any>(supabase.from('office_tasks').select('*').order('created_at', { ascending: false })),
      maybeRows<any>(supabase.from('expenses').select('*').order('expense_date', { ascending: false })),
      maybeRows<any>(supabase.from('expense_categories').select('id,name')),
      maybeRows<any>(supabase.from('company_settings').select('*').limit(1)),
    ]);

    const roleById = new Map(roles.map(role => [role.id, role.code]));
    const rolesByUser = new Map<string, string[]>();
    allRoleLinks.forEach(link => {
      const code = roleById.get(link.role_id);
      if (code) rolesByUser.set(link.user_id, [...(rolesByUser.get(link.user_id) || []), code]);
    });
    const profileById = new Map(profileRows.map(item => [item.id, item]));
    profileById.set(profile.id, profile);
    const customerById = new Map(customerRows.map(item => [item.id, item]));
    const categoryById = new Map(categoryRows.map(item => [item.id, item.name]));
    const unitById = new Map(unitRows.map(item => [item.id, item.symbol || item.code || item.name]));
    const productById = new Map(productRows.map(item => [item.id, item]));
    const expenseCategoryById = new Map(expenseCategoryRows.map(item => [item.id, item.name]));

    const dueByCustomer = new Map<string, number>();
    const paidByCustomer = new Map<string, number>();
    customerLedgerRows.forEach(entry => {
      dueByCustomer.set(entry.customer_id, (dueByCustomer.get(entry.customer_id) || 0) + asNumber(entry.debit) - asNumber(entry.credit));
      paidByCustomer.set(entry.customer_id, (paidByCustomer.get(entry.customer_id) || 0) + asNumber(entry.credit));
    });

    const users: User[] = profileRows.map(item => {
      const codes = rolesByUser.get(item.id) || (item.id === profile.id ? roleCodes : []);
      const code = priorityRoleCodes.find(value => codes.includes(value)) || codes[0] || 'viewer';
      return {
        id: item.id, name: item.full_name || item.email || 'Unnamed User', email: item.email || '',
        role: uiRole(code), phone: item.phone || undefined, department: item.department || undefined,
        employeeCode: item.employee_code || undefined, roleTitle: item.designation || undefined,
        isActive: Boolean(item.active), lastLogin: item.last_login_at || undefined, createdAt: item.created_at,
      };
    });
    if (!users.find(item => item.id === profile.id)) {
      users.push({ id: profile.id, name: profile.full_name || profile.email || 'Owner', email: profile.email || '', role: uiRole(primaryCode), phone: profile.phone || undefined, department: profile.department || undefined, employeeCode: profile.employee_code || undefined, roleTitle: profile.designation || undefined, isActive: true, lastLogin: profile.last_login_at || undefined, createdAt: profile.created_at });
    }

    const customers: Customer[] = customerRows.map(item => ({
      id: item.id, name: item.company_name || item.full_name || 'Customer', contactPerson: item.contact_person || '',
      phone: item.phone || '', whatsapp: item.alternate_phone || undefined, email: item.email || undefined,
      address: item.billing_address || item.delivery_address || '', district: item.district || '',
      customerType: item.customer_type === 'government' ? 'government' : item.customer_type === 'individual' ? 'retail' : 'corporate',
      creditLimit: asNumber(item.credit_limit), totalPaid: paidByCustomer.get(item.id) || 0,
      totalDue: Math.max(0, dueByCustomer.get(item.id) || asNumber(item.opening_balance)), createdAt: item.created_at,
    }));

    const products: Product[] = productRows.map(item => {
      const stock = balanceRows.filter(balance => balance.product_id === item.id).reduce((sum, balance) => sum + asNumber(balance.quantity), 0);
      return {
        id: item.id, sku: item.sku, name: item.product_name, categoryId: item.category_id || '',
        categoryName: categoryById.get(item.category_id) || 'Uncategorized',
        productType: item.product_type === 'spare_part' ? 'spare' : item.product_type,
        uom: unitById.get(item.unit_id) || 'pcs', costPrice: asNumber(item.standard_cost), salePrice: asNumber(item.selling_price),
        currentStock: stock, minStockQty: asNumber(item.reorder_level), isActive: Boolean(item.active),
      };
    });

    const invoiceItemsById = new Map<string, any[]>();
    invoiceItemRows.forEach(item => invoiceItemsById.set(item.invoice_id, [...(invoiceItemsById.get(item.invoice_id) || []), item]));
    const invoices: Invoice[] = invoiceRows.map(item => ({
      id: item.id, invoiceNo: item.invoice_no, customerId: item.customer_id,
      customerName: customerById.get(item.customer_id)?.company_name || customerById.get(item.customer_id)?.full_name || 'Customer',
      invoiceDate: asDate(item.invoice_date), dueDate: asDate(item.due_date || item.invoice_date),
      lines: (invoiceItemsById.get(item.id) || []).map(line => ({ id: line.id, productId: line.product_id || '', productName: productById.get(line.product_id)?.product_name || line.description, description: line.description, qty: asNumber(line.quantity), unitPrice: asNumber(line.unit_price), lineTotal: asNumber(line.line_total) })),
      totalAmount: asNumber(item.total_amount), totalPaid: asNumber(item.paid_amount), totalDue: asNumber(item.due_amount),
      status: item.status === 'issued' ? 'posted' : item.status === 'partially_paid' ? 'partial' : item.status,
      notes: item.note || undefined, createdBy: item.created_by || '', createdAt: item.created_at,
    }));

    const payments: Payment[] = paymentRows.map(item => ({
      id: item.id, customerId: item.customer_id,
      customerName: customerById.get(item.customer_id)?.company_name || customerById.get(item.customer_id)?.full_name || 'Customer',
      invoiceId: item.invoice_id || '', paymentDate: asDate(item.payment_date), amount: asNumber(item.amount),
      method: item.payment_method === 'bank_transfer' ? 'Bank Transfer' : item.payment_method === 'mobile_finance' ? 'bKash' : item.payment_method === 'cheque' ? 'Cheque' : item.payment_method === 'card' ? 'Card' : 'Cash',
      reference: item.reference_no || undefined, createdBy: item.received_by || '', createdAt: item.created_at,
    }));

    const tickets: ServiceTicket[] = ticketRows.map(item => {
      const customer = customerById.get(item.customer_id);
      const engineer = profileById.get(item.assigned_engineer_id);
      return {
        id: item.id, ticketNo: item.ticket_no, customerId: item.customer_id,
        customerName: customer?.company_name || customer?.full_name || 'Customer', customerPhone: customer?.phone || undefined,
        customerAddress: customer?.delivery_address || customer?.billing_address || undefined, area: customer?.district || undefined,
        title: item.subject, description: item.problem_description || '',
        status: item.status === 'new' ? 'pending' : item.status === 'scheduled' ? 'assigned' : item.status === 'en_route' ? 'on_the_way' : item.status,
        priority: item.priority === 'urgent' ? 'emergency' : item.priority,
        machineModel: item.product_id ? productById.get(item.product_id)?.model || productById.get(item.product_id)?.product_name : undefined,
        warrantyStatus: item.warranty_status === 'warranty' ? 'in_warranty' : 'out_warranty',
        assignedEngineerId: item.assigned_engineer_id || undefined, assignedEngineerName: engineer?.full_name || 'Unassigned',
        plannedDate: asDate(item.scheduled_at || item.created_at), completedDate: item.completed_at ? asDate(item.completed_at) : undefined,
        workStartAt: item.started_at || undefined, workEndAt: item.completed_at || undefined, usedParts: [], photos: [], createdAt: item.created_at,
      };
    });

    const engineers: Engineer[] = engineerRows.map(item => {
      const engineer = profileById.get(item.user_id) || {};
      return {
        id: item.user_id, userId: item.user_id, name: engineer.full_name || 'Engineer', phone: engineer.phone || '',
        area: engineer.department || undefined, roleTitle: engineer.designation || undefined,
        skills: item.skill_summary ? item.skill_summary.split(',').map((skill: string) => skill.trim()).filter(Boolean) : [],
        availability: item.active ? 'available' : 'offline', status: item.active ? 'available' : 'offline',
        completedJobs: 0, rating: 0, firstTimeFixPct: 0, lateJobs: 0, travelKm: 0, revenueContribution: 0,
      };
    });

    const schedule: ScheduleEntry[] = scheduleRows.map(item => {
      const ticket = tickets.find(value => value.id === item.ticket_id);
      const engineer = profileById.get(item.engineer_id);
      return {
        id: item.id, engineerId: item.engineer_id, engineerName: engineer?.full_name || 'Engineer',
        customerName: ticket?.customerName || '', area: ticket?.area, date: asDate(item.schedule_start),
        time: item.schedule_start ? new Date(item.schedule_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        priority: ticket?.priority || 'normal', status: item.status === 'confirmed' ? 'planned' : item.status, note: item.note || undefined,
      };
    });

    const tasks: MarketingTask[] = taskRows.map(item => ({
      id: item.id, taskNo: item.task_no, customerId: '', customerName: '', type: item.module === 'collection' ? 'collection' : item.module === 'delivery' ? 'delivery_support' : 'visit',
      status: item.status === 'new' ? 'pending' : item.status === 'completed' ? 'done' : item.status,
      assignedMarketingId: item.assigned_to || '', targetDate: asDate(item.due_at || item.created_at), purpose: item.title, notes: item.description || undefined, createdAt: item.created_at,
    }));

    const expenses: Expense[] = expenseRows.map(item => ({
      id: item.id, expenseDate: asDate(item.expense_date), category: expenseCategoryById.get(item.category_id) || 'Expense',
      description: item.purpose, amount: asNumber(item.amount), paidById: item.created_by || '', paidByName: profileById.get(item.created_by)?.full_name || '', paymentMethod: 'Cash', reference: item.reference_no || undefined, createdAt: item.created_at,
    }));

    const companyRow = companyRows[0];
    const company: Company = companyRow ? {
      companyName: companyRow.brand_name || companyRow.legal_name || 'COLORJET Bangladesh', address: companyRow.address || '',
      hotline: companyRow.phone || '', email: companyRow.email || '', website: companyRow.website || '',
    } : EMPTY_COMPANY;

    const stockMovements: StockMovement[] = movementRows.map(item => ({
      id: item.id, productId: item.product_id, productName: productById.get(item.product_id)?.product_name || 'Product',
      movementType: item.movement_type === 'purchase_receive' ? 'purchase_in' : item.movement_type === 'sales_delivery' ? 'sale_out' : item.movement_type === 'service_use' ? 'service_use' : 'adjustment',
      qty: asNumber(item.quantity), reference: item.reference_no || undefined, notes: item.note || undefined, createdBy: item.created_by || '', createdAt: item.created_at,
    }));

    setState({
      users, currentUser: users.find(item => item.id === profile.id) || null, customers, invoices, payments, tickets,
      products, stockMovements, deliveries: [], expenses, engineers, tasks, notifications: [], schedule, company, isLoading: false,
    });
  };

  const refresh = async () => {
    if (!isProductionConfigured()) {
      setState({ ...EMPTY_STATE, isLoading: false });
      return;
    }
    const supabase = getSupabase();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setState({ ...EMPTY_STATE, isLoading: false });
      return;
    }
    await hydrate(data.user.id);
  };

  useEffect(() => { void refresh(); }, []);

  const login = async (email: string, password: string) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) return false;
      await hydrate(data.user.id);
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    if (isProductionConfigured()) await getSupabase().auth.signOut();
    setState({ ...EMPTY_STATE, isLoading: false });
  };

  const requestPasswordReset = async (email: string) => {
    try {
      const redirectTo = process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT;
      const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo });
      return !error;
    } catch { return false; }
  };

  const perform = async (action: () => Promise<void>) => {
    try { await action(); await refresh(); } catch (error) { console.warn('COLORJET production action failed', error); }
  };

  const addPayment = async (payment: Omit<Payment, 'id' | 'createdAt'>) => perform(async () => {
    const supabase = getSupabase();
    const { data: account, error: accountError } = await supabase.from('cash_bank_accounts').select('id').eq('active', true).limit(1).maybeSingle();
    if (accountError || !account) throw new Error('No active cash or bank account is available.');
    const methodMap: Record<string, string> = { 'Bank Transfer': 'bank_transfer', bKash: 'mobile_finance', Nagad: 'mobile_finance', Card: 'card', Cheque: 'cheque', Cash: 'cash' };
    const { error } = await supabase.rpc('record_customer_payment', {
      p_customer_id: payment.customerId, p_invoice_id: payment.invoiceId, p_cash_bank_account_id: account.id,
      p_amount: payment.amount, p_payment_method: methodMap[payment.method] || 'cash', p_payment_date: payment.paymentDate,
      p_reference_no: payment.reference || null, p_note: null,
    });
    if (error) throw error;
  });

  const addExpense = async (expense: Omit<Expense, 'id' | 'createdAt'>) => perform(async () => {
    const supabase = getSupabase();
    const [{ data: account }, { data: category }] = await Promise.all([
      supabase.from('cash_bank_accounts').select('id').eq('active', true).limit(1).maybeSingle(),
      supabase.from('expense_categories').select('id').eq('active', true).limit(1).maybeSingle(),
    ]);
    if (!account || !category) throw new Error('Expense account or category is not configured.');
    const { error } = await supabase.rpc('record_expense', {
      p_expense_no: `EXP-${Date.now()}`, p_expense_date: expense.expenseDate, p_category_id: category.id,
      p_cash_bank_account_id: account.id, p_amount: expense.amount, p_purpose: expense.description,
      p_reference_no: expense.reference || null, p_voucher_path: null,
    });
    if (error) throw error;
  });

  const remoteTicketStatus = (status: ServiceTicket['status']) => ({
    pending: 'assigned', assigned: 'assigned', accepted: 'assigned', on_the_way: 'en_route', in_progress: 'in_progress',
    waiting_parts: 'waiting_parts', pending_customer: 'waiting_parts', revisit: 'waiting_parts', completed: 'completed', cancelled: 'cancelled',
  }[status]);

  const updateTicketStatus = async (ticketId: string, status: ServiceTicket['status']) => perform(async () => {
    const { error } = await getSupabase().rpc('update_service_ticket_status', { p_ticket_id: ticketId, p_new_status: remoteTicketStatus(status), p_note: null });
    if (error) throw error;
  });

  const startTravel = async (ticketId: string) => updateTicketStatus(ticketId, 'on_the_way');
  const startWork = async (ticketId: string) => updateTicketStatus(ticketId, 'in_progress');
  const completeWork = async (ticketId: string) => updateTicketStatus(ticketId, 'completed');
  const pauseWork = (ticketId: string) => setState(previous => ({ ...previous, tickets: previous.tickets.map(ticket => ticket.id === ticketId ? { ...ticket, isPaused: true, pauseStartedAt: new Date().toISOString() } : ticket) }));
  const resumeWork = (ticketId: string) => setState(previous => ({ ...previous, tickets: previous.tickets.map(ticket => ticket.id === ticketId ? { ...ticket, isPaused: false, pauseStartedAt: undefined } : ticket) }));

  const addTicketPart = async (ticketId: string, part: ServicePart) => perform(async () => {
    const supabase = getSupabase();
    const { data: warehouse, error: warehouseError } = await supabase.from('warehouses').select('id').eq('code', 'MAIN').maybeSingle();
    if (warehouseError || !warehouse) throw new Error('Main warehouse is not configured.');
    const { error } = await supabase.rpc('consume_service_part', {
      p_ticket_id: ticketId, p_product_id: part.productId, p_warehouse_id: warehouse.id, p_quantity: part.qty,
      p_unit_price: part.unitPrice || 0, p_note: part.billing || null,
    });
    if (error) throw error;
  });

  const addTicketPhoto = async (ticketId: string, photo: { uri: string; type: ServicePhoto['type'] }) => perform(async () => {
    const supabase = getSupabase();
    const blob = await (await fetch(photo.uri)).blob();
    const path = `tickets/${ticketId}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage.from('service-media').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (uploadError) throw uploadError;
    const kind: Record<ServicePhoto['type'], string> = { before: 'before', problem: 'during', parts: 'part', serial: 'machine_plate', after: 'after', other: 'other' };
    const { error } = await supabase.from('service_photos').insert({ ticket_id: ticketId, storage_bucket: 'service-media', storage_path: path, photo_type: kind[photo.type] });
    if (error) throw error;
  });

  const saveSignature = async (ticketId: string, signature: ServiceSignature) => perform(async () => {
    const supabase = getSupabase();
    const blob = await (await fetch(signature.signatureData)).blob();
    const path = `tickets/${ticketId}/signature-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage.from('service-media').upload(path, blob, { contentType: 'image/png', upsert: false });
    if (uploadError) throw uploadError;
    const { error } = await supabase.from('service_signatures').upsert({ ticket_id: ticketId, signer_name: signature.customerName, storage_bucket: 'service-media', storage_path: path });
    if (error) throw error;
  });

  const submitReport = async (ticketId: string, report: ServiceReport) => perform(async () => {
    const supabase = getSupabase();
    const { error } = await supabase.from('service_reports').upsert({ ticket_id: ticketId, findings: report.problemFound, work_performed: report.workDone, recommendation: report.pendingIssue || null, next_follow_up_date: null });
    if (error) throw error;
    const { error: statusError } = await supabase.rpc('update_service_ticket_status', { p_ticket_id: ticketId, p_new_status: report.revisitRequired ? 'waiting_parts' : 'completed', p_note: report.pendingIssue || null });
    if (statusError) throw statusError;
  });

  const addScheduleEntry = async (entry: Omit<ScheduleEntry, 'id'>) => perform(async () => {
    const [hours, minutes] = (entry.time || '09:00').split(':');
    const scheduleStart = new Date(`${entry.date}T${hours}:${minutes}:00`).toISOString();
    const { error } = await getSupabase().from('engineer_schedule').insert({ engineer_id: entry.engineerId, schedule_start: scheduleStart, status: 'planned', note: entry.note || null });
    if (error) throw error;
  });

  const updateScheduleStatus = async (id: string, status: ScheduleEntry['status']) => perform(async () => {
    const { error } = await getSupabase().from('engineer_schedule').update({ status }).eq('id', id);
    if (error) throw error;
  });

  const addUser = async (user: Omit<User, 'id' | 'createdAt' | 'lastLogin'> & { temporaryPassword: string }) => perform(async () => {
    const { error } = await getSupabase().functions.invoke('admin-users', { body: { action: 'create', fullName: user.name, email: user.email, phone: user.phone || null, role: databaseRole(user.role), employeeCode: user.employeeCode || null, department: user.department || null, designation: user.roleTitle || null, temporaryPassword: user.temporaryPassword } });
    if (error) throw error;
  });

  const updateUser = async (id: string, patch: Partial<User>) => perform(async () => {
    const { error } = await getSupabase().functions.invoke('admin-users', { body: { action: 'update', userId: id, fullName: patch.name, phone: patch.phone, employeeCode: patch.employeeCode, department: patch.department, designation: patch.roleTitle, role: patch.role ? databaseRole(patch.role) : undefined } });
    if (error) throw error;
  });

  const toggleUserActive = async (id: string) => perform(async () => {
    const target = state.users.find(item => item.id === id);
    if (!target) throw new Error('User not found.');
    const { error } = await getSupabase().functions.invoke('admin-users', { body: { action: 'set_active', userId: id, active: !target.isActive } });
    if (error) throw error;
  });

  const updateEngineer = async (_id: string, _patch: Partial<Engineer>) => { await refresh(); };
  const markNotificationRead = (id: string) => setState(previous => ({ ...previous, notifications: previous.notifications.map(item => item.id === id ? { ...item, isRead: true } : item) }));
  const markAllNotificationsRead = () => setState(previous => ({ ...previous, notifications: previous.notifications.map(item => ({ ...item, isRead: true })) }));
  const updateDeliveryStatus = (_id: string, _status: DeliveryOrder['status']) => undefined;

  return <AppContext.Provider value={{ ...state, login, logout, refresh, requestPasswordReset, addPayment, addExpense, updateTicketStatus, startTravel, startWork, pauseWork, resumeWork, completeWork, addTicketPart, addTicketPhoto, saveSignature, submitReport, markNotificationRead, markAllNotificationsRead, updateDeliveryStatus, addScheduleEntry, updateScheduleStatus, updateEngineer, addUser, updateUser, toggleUserActive }}>{children}</AppContext.Provider>;
}
