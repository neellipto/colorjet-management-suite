import { getSupabase } from '@/lib/supabaseClient';
import type { Holiday, PayrollEntry, PayrollPeriod } from '@/lib/v13BusinessOperations';

export interface SalaryProfile {
  id: string;
  employee_id: string;
  basic_salary: number;
  house_rent: number;
  medical_allowance: number;
  conveyance_allowance: number;
  mobile_allowance: number;
  other_allowance: number;
  overtime_rate_hourly: number;
  late_deduction_rate: number;
  absent_deduction_daily: number;
  bank_account_name?: string | null;
  bank_account_no?: string | null;
  bank_name?: string | null;
  mobile_finance_no?: string | null;
  active: boolean;
  effective_from: string;
  created_at: string;
  updated_at: string;
}

function ensure<T>(data: T | null, error: { message: string } | null, fallback: string): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error(fallback);
  return data;
}

export async function listSalaryProfiles(): Promise<SalaryProfile[]> {
  const { data, error } = await getSupabase()
    .from('v13_employee_salary_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SalaryProfile[];
}

export async function upsertSalaryProfile(input: {
  employeeId: string;
  basicSalary: number;
  houseRent?: number;
  medicalAllowance?: number;
  conveyanceAllowance?: number;
  mobileAllowance?: number;
  otherAllowance?: number;
  overtimeRateHourly?: number;
  lateDeductionRate?: number;
  absentDeductionDaily?: number;
  bankAccountName?: string;
  bankAccountNo?: string;
  bankName?: string;
  mobileFinanceNo?: string;
  effectiveFrom?: string;
}): Promise<SalaryProfile> {
  const { data, error } = await getSupabase()
    .from('v13_employee_salary_profiles')
    .upsert({
      employee_id: input.employeeId,
      basic_salary: input.basicSalary,
      house_rent: input.houseRent ?? 0,
      medical_allowance: input.medicalAllowance ?? 0,
      conveyance_allowance: input.conveyanceAllowance ?? 0,
      mobile_allowance: input.mobileAllowance ?? 0,
      other_allowance: input.otherAllowance ?? 0,
      overtime_rate_hourly: input.overtimeRateHourly ?? 0,
      late_deduction_rate: input.lateDeductionRate ?? 0,
      absent_deduction_daily: input.absentDeductionDaily ?? 0,
      bank_account_name: input.bankAccountName?.trim() || null,
      bank_account_no: input.bankAccountNo?.trim() || null,
      bank_name: input.bankName?.trim() || null,
      mobile_finance_no: input.mobileFinanceNo?.trim() || null,
      effective_from: input.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      active: true,
    }, { onConflict: 'employee_id' })
    .select('*')
    .single();
  return ensure(data as SalaryProfile | null, error, 'Salary profile could not be saved.');
}

export async function createHoliday(input: {
  date: string;
  name: string;
  type: Holiday['holiday_type'];
  region?: string;
  paid?: boolean;
}): Promise<Holiday> {
  const { data, error } = await getSupabase()
    .from('v13_holidays')
    .insert({
      holiday_date: input.date,
      name: input.name.trim(),
      holiday_type: input.type,
      region: input.region?.trim() || null,
      paid: input.paid ?? true,
      active: true,
    })
    .select('*')
    .single();
  return ensure(data as Holiday | null, error, 'Holiday could not be created.');
}

export async function createPayrollPeriod(input: {
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  payDate?: string;
}): Promise<PayrollPeriod> {
  const { data, error } = await getSupabase().rpc('v13_create_payroll_period', {
    p_period_code: input.code.trim().toUpperCase(),
    p_period_name: input.name.trim(),
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_pay_date: input.payDate ?? null,
  });
  return ensure(data as PayrollPeriod | null, error, 'Payroll period could not be created.');
}

export async function calculatePayrollPeriod(input: {
  payrollPeriodId: string;
  entries: Array<{
    employeeId: string;
    workingDays: number;
    presentDays: number;
    paidLeaveDays?: number;
    unpaidLeaveDays?: number;
    absentDays?: number;
    lateCount?: number;
    overtimeHours?: number;
    bonusAmount?: number;
    advanceDeduction?: number;
    loanDeduction?: number;
    taxDeduction?: number;
    otherDeduction?: number;
    note?: string;
  }>;
}): Promise<number> {
  const { data, error } = await getSupabase().rpc('v13_calculate_payroll_period', {
    p_payroll_period_id: input.payrollPeriodId,
    p_entries: input.entries.map(item => ({
      employee_id: item.employeeId,
      working_days: item.workingDays,
      present_days: item.presentDays,
      paid_leave_days: item.paidLeaveDays ?? 0,
      unpaid_leave_days: item.unpaidLeaveDays ?? 0,
      absent_days: item.absentDays ?? 0,
      late_count: item.lateCount ?? 0,
      overtime_hours: item.overtimeHours ?? 0,
      bonus_amount: item.bonusAmount ?? 0,
      advance_deduction: item.advanceDeduction ?? 0,
      loan_deduction: item.loanDeduction ?? 0,
      tax_deduction: item.taxDeduction ?? 0,
      other_deduction: item.otherDeduction ?? 0,
      note: item.note ?? null,
    })),
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function approvePayrollPeriod(periodId: string): Promise<PayrollPeriod> {
  const { data, error } = await getSupabase().rpc('v13_approve_payroll_period', {
    p_payroll_period_id: periodId,
  });
  return ensure(data as PayrollPeriod | null, error, 'Payroll period could not be approved.');
}

export async function markPayrollPaid(input: {
  payrollEntryId: string;
  paymentMethod: string;
  paymentReference: string;
  note?: string;
}): Promise<PayrollEntry> {
  const { data, error } = await getSupabase().rpc('v13_mark_payroll_paid', {
    p_payroll_entry_id: input.payrollEntryId,
    p_payment_method: input.paymentMethod.trim(),
    p_payment_reference: input.paymentReference.trim(),
    p_note: input.note?.trim() || null,
  });
  return ensure(data as PayrollEntry | null, error, 'Payroll payment could not be posted.');
}
