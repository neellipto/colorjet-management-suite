export function getLocalDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalMonthKey(now = new Date()): string {
  return getLocalDateKey(now).slice(0, 7);
}

export function getLocalMonthPeriod(now = new Date()): { month: string; label: string } {
  return {
    month: getLocalMonthKey(now),
    label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  };
}
