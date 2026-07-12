import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import {
  type Holiday,
  type LeaveRequest,
  type LeaveType,
  type PayrollEntry,
  type PayrollPeriod,
  approveLeaveRequest,
  listHolidays,
  listLeaveRequests,
  listLeaveTypes,
  listPayrollEntries,
  listPayrollPeriods,
  submitLeaveRequest,
} from '@/lib/v13BusinessOperations';
import {
  type SalaryProfile,
  approvePayrollPeriod,
  calculatePayrollPeriod,
  createHoliday,
  createPayrollPeriod,
  listSalaryProfiles,
  markPayrollPaid,
  upsertSalaryProfile,
} from '@/lib/v13HrOperations';

const STATUS_COLOR: Record<string, string> = { submitted: '#007AFF', manager_approved: '#5856D6', approved: '#34C759', rejected: '#C62828', cancelled: '#8E8E93', taken: '#1A237E', closed: '#2E7D32', draft: '#8E8E93', calculated: '#30B0C7', reviewed: '#5856D6', paid: '#2E7D32', attendance_locked: '#FF9500' };

function fmt(value?: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function HrOperationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, users } = useApp();
  const [tab, setTab] = useState<'leave' | 'payroll' | 'holidays'>('leave');
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [salaryProfiles, setSalaryProfiles] = useState<SalaryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [leaveModal, setLeaveModal] = useState(false);
  const [holidayModal, setHolidayModal] = useState(false);
  const [salaryModal, setSalaryModal] = useState(false);
  const [periodModal, setPeriodModal] = useState(false);
  const [calculateModal, setCalculateModal] = useState(false);
  const [payEntry, setPayEntry] = useState<PayrollEntry | null>(null);
  const [leaveForm, setLeaveForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', totalDays: '1', reason: '', emergencyContact: '', handoverTo: '', handoverNote: '' });
  const [holidayForm, setHolidayForm] = useState({ date: '', name: '', type: 'company' as Holiday['holiday_type'], region: '' });
  const [salaryForm, setSalaryForm] = useState({ employeeId: '', basic: '0', house: '0', medical: '0', conveyance: '0', mobile: '0', other: '0', overtimeRate: '0', lateDeduction: '0', absentDeduction: '0', bankName: '', accountNo: '', mobileFinanceNo: '' });
  const [periodForm, setPeriodForm] = useState({ code: '', name: '', startDate: '', endDate: '', payDate: '' });
  const [calcForm, setCalcForm] = useState({ periodId: '', employeeId: '', workingDays: '26', presentDays: '26', paidLeave: '0', unpaidLeave: '0', absent: '0', late: '0', overtime: '0', bonus: '0', advanceDeduction: '0', loanDeduction: '0', taxDeduction: '0', otherDeduction: '0' });
  const [payForm, setPayForm] = useState({ method: 'Bank', reference: '', note: '' });

  const role = currentUser?.role ?? 'customer';
  const canApproveLeave = ['admin', 'manager', 'service_control', 'accounts'].includes(role);
  const canManagePayroll = ['admin', 'accounts'].includes(role);
  const pb = insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 26;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [typeRows, leaveRows, holidayRows, periodRows, entryRows, salaryRows] = await Promise.all([
        listLeaveTypes(), listLeaveRequests(), listHolidays(), listPayrollPeriods(), listPayrollEntries(), listSalaryProfiles(),
      ]);
      setLeaveTypes(typeRows); setLeaveRequests(leaveRows); setHolidays(holidayRows); setPeriods(periodRows); setEntries(entryRows); setSalaryProfiles(salaryRows);
      setLeaveForm(p => ({ ...p, leaveTypeId: p.leaveTypeId || typeRows[0]?.id || '' }));
    } catch (error) { Alert.alert('HR Operations', error instanceof Error ? error.message : 'HR data could not be loaded.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleLeave = useMemo(() => canApproveLeave ? leaveRequests : leaveRequests.filter(item => item.employee_id === currentUser?.id), [canApproveLeave, currentUser?.id, leaveRequests]);
  const visibleEntries = useMemo(() => canManagePayroll ? entries : entries.filter(item => item.employee_id === currentUser?.id), [canManagePayroll, currentUser?.id, entries]);
  const stats = useMemo(() => ({ pendingLeave: leaveRequests.filter(item => ['submitted', 'manager_approved'].includes(item.status)).length, approvedLeave: leaveRequests.filter(item => item.status === 'approved').length, payrollDue: entries.filter(item => item.payment_status !== 'paid').reduce((sum, item) => sum + Number(item.net_salary || 0), 0), holidays: holidays.filter(item => item.active).length }), [entries, holidays, leaveRequests]);

  const submitLeave = async () => {
    if (!leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason.trim()) return Alert.alert('Required', 'Leave type, dates and reason are required.');
    setWorkingId('leave');
    try {
      await submitLeaveRequest({ leaveTypeId: leaveForm.leaveTypeId, startDate: leaveForm.startDate, endDate: leaveForm.endDate, totalDays: Number(leaveForm.totalDays), reason: leaveForm.reason, emergencyContact: leaveForm.emergencyContact || undefined, handoverTo: leaveForm.handoverTo || undefined, handoverNote: leaveForm.handoverNote || undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setLeaveModal(false); await load();
    } catch (error) { Alert.alert('Leave Request', error instanceof Error ? error.message : 'Leave could not be submitted.'); }
    finally { setWorkingId(null); }
  };

  const approveLeave = async (item: LeaveRequest, action: 'approve' | 'reject') => {
    setWorkingId(item.id);
    try { await approveLeaveRequest(item.id, action, `${action} from HR mobile UI`); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); await load(); }
    catch (error) { Alert.alert('Leave Approval', error instanceof Error ? error.message : 'Leave action failed.'); }
    finally { setWorkingId(null); }
  };

  const submitHoliday = async () => {
    if (!holidayForm.date || !holidayForm.name.trim()) return Alert.alert('Required', 'Holiday date and name are required.');
    setWorkingId('holiday');
    try { await createHoliday({ date: holidayForm.date, name: holidayForm.name, type: holidayForm.type, region: holidayForm.region || undefined }); setHolidayModal(false); await load(); }
    catch (error) { Alert.alert('Holiday', error instanceof Error ? error.message : 'Holiday could not be created.'); }
    finally { setWorkingId(null); }
  };

  const submitSalary = async () => {
    if (!salaryForm.employeeId || Number(salaryForm.basic) < 0) return Alert.alert('Required', 'Employee and valid basic salary are required.');
    setWorkingId('salary');
    try { await upsertSalaryProfile({ employeeId: salaryForm.employeeId, basicSalary: Number(salaryForm.basic), houseRent: Number(salaryForm.house), medicalAllowance: Number(salaryForm.medical), conveyanceAllowance: Number(salaryForm.conveyance), mobileAllowance: Number(salaryForm.mobile), otherAllowance: Number(salaryForm.other), overtimeRateHourly: Number(salaryForm.overtimeRate), lateDeductionRate: Number(salaryForm.lateDeduction), absentDeductionDaily: Number(salaryForm.absentDeduction), bankName: salaryForm.bankName || undefined, bankAccountNo: salaryForm.accountNo || undefined, mobileFinanceNo: salaryForm.mobileFinanceNo || undefined }); setSalaryModal(false); await load(); }
    catch (error) { Alert.alert('Salary Profile', error instanceof Error ? error.message : 'Salary profile could not be saved.'); }
    finally { setWorkingId(null); }
  };

  const submitPeriod = async () => {
    if (!periodForm.code || !periodForm.name || !periodForm.startDate || !periodForm.endDate) return Alert.alert('Required', 'Period code, name and dates are required.');
    setWorkingId('period');
    try { const period = await createPayrollPeriod({ code: periodForm.code, name: periodForm.name, startDate: periodForm.startDate, endDate: periodForm.endDate, payDate: periodForm.payDate || undefined }); setPeriodModal(false); setCalcForm(p => ({ ...p, periodId: period.id })); await load(); }
    catch (error) { Alert.alert('Payroll Period', error instanceof Error ? error.message : 'Payroll period could not be created.'); }
    finally { setWorkingId(null); }
  };

  const calculateOne = async () => {
    if (!calcForm.periodId || !calcForm.employeeId) return Alert.alert('Required', 'Payroll period and employee are required.');
    setWorkingId('calculate');
    try { await calculatePayrollPeriod({ payrollPeriodId: calcForm.periodId, entries: [{ employeeId: calcForm.employeeId, workingDays: Number(calcForm.workingDays), presentDays: Number(calcForm.presentDays), paidLeaveDays: Number(calcForm.paidLeave), unpaidLeaveDays: Number(calcForm.unpaidLeave), absentDays: Number(calcForm.absent), lateCount: Number(calcForm.late), overtimeHours: Number(calcForm.overtime), bonusAmount: Number(calcForm.bonus), advanceDeduction: Number(calcForm.advanceDeduction), loanDeduction: Number(calcForm.loanDeduction), taxDeduction: Number(calcForm.taxDeduction), otherDeduction: Number(calcForm.otherDeduction) }] }); setCalculateModal(false); await load(); }
    catch (error) { Alert.alert('Payroll Calculation', error instanceof Error ? error.message : 'Payroll calculation failed.'); }
    finally { setWorkingId(null); }
  };

  const approvePeriod = async (period: PayrollPeriod) => { setWorkingId(period.id); try { await approvePayrollPeriod(period.id); await load(); } catch (error) { Alert.alert('Payroll Approval', error instanceof Error ? error.message : 'Approval failed.'); } finally { setWorkingId(null); } };
  const payPayroll = async () => { if (!payEntry || !payForm.reference.trim()) return Alert.alert('Required', 'Payment reference is required.'); setWorkingId(payEntry.id); try { await markPayrollPaid({ payrollEntryId: payEntry.id, paymentMethod: payForm.method, paymentReference: payForm.reference, note: payForm.note || undefined }); setPayEntry(null); await load(); } catch (error) { Alert.alert('Payroll Payment', error instanceof Error ? error.message : 'Payment posting failed.'); } finally { setWorkingId(null); } };

  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: Platform.OS === 'web' ? 24 : 12, paddingBottom: pb + 72, gap: 13 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { backgroundColor: colors.primary }]}><View style={{ flex: 1 }}><Text style={styles.heroEyebrow}>COLORJET PEOPLE OPERATIONS</Text><Text style={styles.heroTitle}>Leave, Payroll & Holidays</Text><Text style={styles.heroSub}>Approval workflow, salary calculation and payment audit</Text></View><Feather name="users" size={30} color="#fff" /></View>
      <View style={styles.kpiGrid}>{[['Pending Leave', stats.pendingLeave], ['Approved Leave', stats.approvedLeave], ['Payroll Due', `৳${Math.round(stats.payrollDue).toLocaleString()}`], ['Holidays', stats.holidays]].map(([label, value]) => <View key={String(label)} style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.kpiValue, { color: colors.foreground }]}>{String(value)}</Text><Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{String(label)}</Text></View>)}</View>
      <View style={styles.tabs}>{(['leave', 'payroll', 'holidays'] as const).map(value => <TouchableOpacity key={value} style={[styles.tab, { backgroundColor: tab === value ? colors.primary : colors.card, borderColor: tab === value ? colors.primary : colors.border }]} onPress={() => setTab(value)}><Text style={[styles.tabText, { color: tab === value ? '#fff' : colors.foreground }]}>{value === 'leave' ? 'Leave' : value === 'payroll' ? 'Payroll' : 'Holidays'}</Text></TouchableOpacity>)}</View>
      {tab === 'leave' ? visibleLeave.map(item => { const employee = users.find(u => u.id === item.employee_id); const type = leaveTypes.find(t => t.id === item.leave_type_id); const color = STATUS_COLOR[item.status] || colors.primary; return <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.top}><View style={{ flex: 1 }}><Text style={[styles.code, { color: colors.mutedForeground }]}>{item.request_no}</Text><Text style={[styles.title, { color: colors.foreground }]}>{employee?.name || 'Employee'} · {type?.name || 'Leave'}</Text><Text style={[styles.sub, { color: colors.mutedForeground }]}>{item.start_date} → {item.end_date} · {item.total_days} days</Text></View><Badge label={item.status} color={color} /></View><Text style={[styles.description, { color: colors.mutedForeground }]}>{item.reason}</Text>{canApproveLeave && ['submitted', 'manager_approved'].includes(item.status) ? <View style={styles.actions}><Action icon="check" label="Approve" onPress={() => void approveLeave(item, 'approve')} colors={colors} disabled={workingId !== null} /><TouchableOpacity style={[styles.reject, { borderColor: '#C62828' }]} onPress={() => void approveLeave(item, 'reject')} disabled={workingId !== null}><Feather name="x" size={14} color="#C62828" /><Text style={styles.rejectText}>Reject</Text></TouchableOpacity></View> : null}</View>; }) : tab === 'payroll' ? <><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payroll Periods</Text>{periods.map(period => <View key={period.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.top}><View style={{ flex: 1 }}><Text style={[styles.code, { color: colors.mutedForeground }]}>{period.period_code}</Text><Text style={[styles.title, { color: colors.foreground }]}>{period.period_name}</Text><Text style={[styles.sub, { color: colors.mutedForeground }]}>{period.start_date} → {period.end_date} · Pay {period.pay_date || 'Not set'}</Text></View><Badge label={period.status} color={STATUS_COLOR[period.status] || colors.primary} /></View>{canManagePayroll ? <View style={styles.actions}><Action icon="calculator" label="Calculate Employee" onPress={() => { setCalcForm(p => ({ ...p, periodId: period.id })); setCalculateModal(true); }} colors={colors} disabled={workingId !== null} />{['calculated', 'reviewed'].includes(period.status) ? <Action icon="check-circle" label="Approve Period" onPress={() => void approvePeriod(period)} colors={colors} disabled={workingId !== null} /> : null}</View> : null}</View>)}<Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payroll Entries</Text>{visibleEntries.map(item => { const employee = users.find(u => u.id === item.employee_id); return <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.top}><View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.foreground }]}>{employee?.name || 'Employee'}</Text><Text style={[styles.sub, { color: colors.mutedForeground }]}>Gross ৳{Number(item.gross_salary).toLocaleString()} · Net ৳{Number(item.net_salary).toLocaleString()}</Text></View><Badge label={item.payment_status} color={item.payment_status === 'paid' ? '#2E7D32' : '#FF9500'} /></View><Text style={[styles.sub, { color: colors.mutedForeground }]}>Present {item.present_days} · Absent {item.absent_days} · Late {item.late_count} · OT {item.overtime_hours}h</Text>{canManagePayroll && item.payment_status === 'approved' ? <Action icon="credit-card" label="Post Payment" onPress={() => setPayEntry(item)} colors={colors} disabled={workingId !== null} /> : null}</View>; })}</> : holidays.map(item => <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.top}><View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.foreground }]}>{item.name}</Text><Text style={[styles.sub, { color: colors.mutedForeground }]}>{item.holiday_date} · {item.holiday_type} · {item.paid ? 'Paid' : 'Unpaid'}</Text></View><Feather name="calendar" size={20} color={colors.primary} /></View></View>)}
    </ScrollView>
    <View style={[styles.fabs, { bottom: pb }]}>{tab === 'leave' ? <Fab onPress={() => setLeaveModal(true)} colors={colors} /> : tab === 'payroll' && canManagePayroll ? <View style={{ gap: 9 }}><SmallFab icon="dollar-sign" onPress={() => setSalaryModal(true)} /><SmallFab icon="calendar" onPress={() => setPeriodModal(true)} /><Fab onPress={() => setCalculateModal(true)} colors={colors} /></View> : tab === 'holidays' && canApproveLeave ? <Fab onPress={() => setHolidayModal(true)} colors={colors} /> : null}</View>
    <FormModal visible={leaveModal} title="Submit Leave Request" onClose={() => setLeaveModal(false)} colors={colors} pb={pb}><Choice label="Leave Type" items={leaveTypes.map(i => ({ id: i.id, label: i.name }))} selected={leaveForm.leaveTypeId} onSelect={id => setLeaveForm(p => ({ ...p, leaveTypeId: id }))} colors={colors} /><View style={styles.twoCol}><Field label="Start Date" value={leaveForm.startDate} onChange={v => setLeaveForm(p => ({ ...p, startDate: v }))} placeholder="YYYY-MM-DD" colors={colors} /><Field label="End Date" value={leaveForm.endDate} onChange={v => setLeaveForm(p => ({ ...p, endDate: v }))} placeholder="YYYY-MM-DD" colors={colors} /></View><Field label="Total Days" value={leaveForm.totalDays} onChange={v => setLeaveForm(p => ({ ...p, totalDays: v }))} placeholder="1" colors={colors} keyboard="decimal-pad" /><Field label="Reason" value={leaveForm.reason} onChange={v => setLeaveForm(p => ({ ...p, reason: v }))} placeholder="Leave reason" colors={colors} multiline /><Save label={workingId === 'leave' ? 'Submitting…' : 'Submit Leave'} onPress={() => void submitLeave()} disabled={workingId !== null} colors={colors} /></FormModal>
    <FormModal visible={holidayModal} title="Add Holiday" onClose={() => setHolidayModal(false)} colors={colors} pb={pb}><Field label="Date" value={holidayForm.date} onChange={v => setHolidayForm(p => ({ ...p, date: v }))} placeholder="YYYY-MM-DD" colors={colors} /><Field label="Name" value={holidayForm.name} onChange={v => setHolidayForm(p => ({ ...p, name: v }))} placeholder="Holiday name" colors={colors} /><Choice label="Type" items={['government', 'company', 'optional', 'regional'].map(v => ({ id: v, label: v }))} selected={holidayForm.type} onSelect={v => setHolidayForm(p => ({ ...p, type: v as Holiday['holiday_type'] }))} colors={colors} /><Save label="Add Holiday" onPress={() => void submitHoliday()} disabled={workingId !== null} colors={colors} /></FormModal>
    <FormModal visible={salaryModal} title="Salary Profile" onClose={() => setSalaryModal(false)} colors={colors} pb={pb}><Choice label="Employee" items={users.map(i => ({ id: i.id, label: i.name }))} selected={salaryForm.employeeId} onSelect={id => { const profile = salaryProfiles.find(p => p.employee_id === id); setSalaryForm(p => ({ ...p, employeeId: id, basic: String(profile?.basic_salary ?? 0), house: String(profile?.house_rent ?? 0), medical: String(profile?.medical_allowance ?? 0), conveyance: String(profile?.conveyance_allowance ?? 0), mobile: String(profile?.mobile_allowance ?? 0), other: String(profile?.other_allowance ?? 0), overtimeRate: String(profile?.overtime_rate_hourly ?? 0), lateDeduction: String(profile?.late_deduction_rate ?? 0), absentDeduction: String(profile?.absent_deduction_daily ?? 0) })); }} colors={colors} /><View style={styles.twoCol}><Field label="Basic Salary" value={salaryForm.basic} onChange={v => setSalaryForm(p => ({ ...p, basic: v }))} placeholder="0" colors={colors} keyboard="decimal-pad" /><Field label="House Rent" value={salaryForm.house} onChange={v => setSalaryForm(p => ({ ...p, house: v }))} placeholder="0" colors={colors} keyboard="decimal-pad" /></View><View style={styles.twoCol}><Field label="Medical" value={salaryForm.medical} onChange={v => setSalaryForm(p => ({ ...p, medical: v }))} placeholder="0" colors={colors} keyboard="decimal-pad" /><Field label="Conveyance" value={salaryForm.conveyance} onChange={v => setSalaryForm(p => ({ ...p, conveyance: v }))} placeholder="0" colors={colors} keyboard="decimal-pad" /></View><View style={styles.twoCol}><Field label="OT Rate/Hour" value={salaryForm.overtimeRate} onChange={v => setSalaryForm(p => ({ ...p, overtimeRate: v }))} placeholder="0" colors={colors} keyboard="decimal-pad" /><Field label="Absent Deduction/Day" value={salaryForm.absentDeduction} onChange={v => setSalaryForm(p => ({ ...p, absentDeduction: v }))} placeholder="0" colors={colors} keyboard="decimal-pad" /></View><Save label="Save Salary Profile" onPress={() => void submitSalary()} disabled={workingId !== null} colors={colors} /></FormModal>
    <FormModal visible={periodModal} title="Create Payroll Period" onClose={() => setPeriodModal(false)} colors={colors} pb={pb}><View style={styles.twoCol}><Field label="Period Code" value={periodForm.code} onChange={v => setPeriodForm(p => ({ ...p, code: v }))} placeholder="2026-07" colors={colors} /><Field label="Period Name" value={periodForm.name} onChange={v => setPeriodForm(p => ({ ...p, name: v }))} placeholder="July 2026" colors={colors} /></View><View style={styles.twoCol}><Field label="Start Date" value={periodForm.startDate} onChange={v => setPeriodForm(p => ({ ...p, startDate: v }))} placeholder="YYYY-MM-DD" colors={colors} /><Field label="End Date" value={periodForm.endDate} onChange={v => setPeriodForm(p => ({ ...p, endDate: v }))} placeholder="YYYY-MM-DD" colors={colors} /></View><Field label="Pay Date" value={periodForm.payDate} onChange={v => setPeriodForm(p => ({ ...p, payDate: v }))} placeholder="YYYY-MM-DD" colors={colors} /><Save label="Create Period" onPress={() => void submitPeriod()} disabled={workingId !== null} colors={colors} /></FormModal>
    <FormModal visible={calculateModal} title="Calculate Employee Payroll" onClose={() => setCalculateModal(false)} colors={colors} pb={pb}><Choice label="Payroll Period" items={periods.map(i => ({ id: i.id, label: i.period_name }))} selected={calcForm.periodId} onSelect={id => setCalcForm(p => ({ ...p, periodId: id }))} colors={colors} /><Choice label="Employee" items={users.map(i => ({ id: i.id, label: i.name }))} selected={calcForm.employeeId} onSelect={id => setCalcForm(p => ({ ...p, employeeId: id }))} colors={colors} /><View style={styles.twoCol}><Field label="Working Days" value={calcForm.workingDays} onChange={v => setCalcForm(p => ({ ...p, workingDays: v }))} placeholder="26" colors={colors} keyboard="decimal-pad" /><Field label="Present Days" value={calcForm.presentDays} onChange={v => setCalcForm(p => ({ ...p, presentDays: v }))} placeholder="26" colors={colors} keyboard="decimal-pad" /></View><View style={styles.twoCol}><Field label="Absent Days" value={calcForm.absent} onChange={v => setCalcForm(p => ({ ...p, absent: v }))} placeholder="0" colors={colors} keyboard="decimal-pad" /><Field label="Late Count" value={calcForm.late} onChange={v => setCalcForm(p => ({ ...p, late: v }))} placeholder="0" colors={colors} keyboard="decimal-pad" /></View><View style={styles.twoCol}><Field label="Overtime Hours" value={calcForm.overtime} onChange={v => setCalcForm(p => ({ ...p, overtime: v }))} placeholder="0" colors={colors} keyboard="decimal-pad" /><Field label="Bonus" value={calcForm.bonus} onChange={v => setCalcForm(p => ({ ...p, bonus: v }))} placeholder="0" colors={colors} keyboard="decimal-pad" /></View><Save label="Calculate / Update" onPress={() => void calculateOne()} disabled={workingId !== null} colors={colors} /></FormModal>
    <FormModal visible={Boolean(payEntry)} title="Post Payroll Payment" onClose={() => setPayEntry(null)} colors={colors} pb={pb}><Field label="Payment Method" value={payForm.method} onChange={v => setPayForm(p => ({ ...p, method: v }))} placeholder="Bank/MFS/Cash" colors={colors} /><Field label="Payment Reference" value={payForm.reference} onChange={v => setPayForm(p => ({ ...p, reference: v }))} placeholder="Transaction reference" colors={colors} /><Save label="Mark Paid" onPress={() => void payPayroll()} disabled={workingId !== null} colors={colors} /></FormModal>
  </View>;
}

function Badge({ label, color }: { label: string; color: string }) { return <View style={[styles.badge, { backgroundColor: `${color}20` }]}><Text style={[styles.badgeText, { color }]}>{label.replaceAll('_', ' ')}</Text></View>; }
function Action({ icon, label, onPress, colors, disabled }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; colors: ReturnType<typeof useColors>; disabled: boolean }) { return <TouchableOpacity style={[styles.action, { backgroundColor: colors.primary, opacity: disabled ? 0.6 : 1 }]} onPress={onPress} disabled={disabled}><Feather name={icon} size={14} color="#fff" /><Text style={styles.actionText}>{label}</Text></TouchableOpacity>; }
function Fab({ onPress, colors }: { onPress: () => void; colors: ReturnType<typeof useColors> }) { return <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={onPress}><Feather name="plus" size={24} color="#fff" /></TouchableOpacity>; }
function SmallFab({ icon, onPress }: { icon: keyof typeof Feather.glyphMap; onPress: () => void }) { return <TouchableOpacity style={styles.smallFab} onPress={onPress}><Feather name={icon} size={18} color="#fff" /></TouchableOpacity>; }
function FormModal({ visible, title, onClose, colors, pb, children }: { visible: boolean; title: string; onClose: () => void; colors: ReturnType<typeof useColors>; pb: number; children: React.ReactNode }) { return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBg}><View style={[styles.modalCard, { backgroundColor: colors.card, paddingBottom: pb }]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text><TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity></View><ScrollView contentContainerStyle={{ gap: 11 }} keyboardShouldPersistTaps="handled">{children}</ScrollView></View></View></Modal>; }
function Field({ label, value, onChange, placeholder, colors, keyboard, multiline }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; colors: ReturnType<typeof useColors>; keyboard?: 'default' | 'decimal-pad'; multiline?: boolean }) { return <View style={{ flex: 1, gap: 5 }}><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><TextInput style={[styles.input, multiline && styles.multiline, { color: colors.foreground, borderColor: colors.border }]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} keyboardType={keyboard || 'default'} multiline={multiline} /></View>; }
function Choice({ label, items, selected, onSelect, colors }: { label: string; items: Array<{ id: string; label: string }>; selected: string; onSelect: (id: string) => void; colors: ReturnType<typeof useColors> }) { return <View style={{ gap: 6 }}><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{items.map(item => <TouchableOpacity key={item.id} style={[styles.choice, { backgroundColor: selected === item.id ? colors.primary : colors.background, borderColor: selected === item.id ? colors.primary : colors.border }]} onPress={() => onSelect(item.id)}><Text style={[styles.choiceText, { color: selected === item.id ? '#fff' : colors.foreground }]}>{item.label}</Text></TouchableOpacity>)}</ScrollView></View>; }
function Save({ label, onPress, disabled, colors }: { label: string; onPress: () => void; disabled: boolean; colors: ReturnType<typeof useColors> }) { return <TouchableOpacity style={[styles.save, { backgroundColor: colors.primary, opacity: disabled ? 0.6 : 1 }]} onPress={onPress} disabled={disabled}><Feather name="save" size={17} color="#fff" /><Text style={styles.saveText}>{label}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({ hero: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }, heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 }, heroTitle: { color: '#fff', fontSize: 21, fontFamily: 'Inter_700Bold', marginTop: 4 }, heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 }, kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, kpi: { width: '48.5%', borderWidth: 1, borderRadius: 11, padding: 11 }, kpiValue: { fontSize: 16, fontFamily: 'Inter_700Bold' }, kpiLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', marginTop: 2 }, tabs: { flexDirection: 'row', gap: 6 }, tab: { flex: 1, borderWidth: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center' }, tabText: { fontSize: 10, fontFamily: 'Inter_700Bold' }, sectionTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' }, card: { borderWidth: 1, borderRadius: 13, padding: 13, gap: 10 }, top: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, code: { fontSize: 9, fontFamily: 'Inter_600SemiBold' }, title: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 2 }, sub: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 }, description: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 }, badge: { borderRadius: 11, paddingHorizontal: 8, paddingVertical: 5 }, badgeText: { fontSize: 8, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, action: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 }, actionText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' }, reject: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }, rejectText: { color: '#C62828', fontSize: 10, fontFamily: 'Inter_700Bold' }, fabs: { position: 'absolute', right: 20 }, fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 }, smallFab: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2E7D32', elevation: 3 }, modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }, modalCard: { maxHeight: '95%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 17 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }, modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' }, label: { fontSize: 10, fontFamily: 'Inter_600SemiBold' }, input: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 12, fontFamily: 'Inter_400Regular' }, multiline: { minHeight: 70, textAlignVertical: 'top' }, choice: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 }, choiceText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' }, twoCol: { flexDirection: 'row', gap: 9 }, save: { borderRadius: 11, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, saveText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' } });
