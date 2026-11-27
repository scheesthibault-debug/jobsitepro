import type { Employee, Job, TimeEntry } from '../../types/domain.js';

export interface WagepointHoursRow {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  job_code: string;
  job_name: string;
  date: string;
  regular_hours: number;
  overtime_hours: number;
  cost_center: string;
  notes: string;
}

export function splitRegularOt(hours: number, dailyThreshold = 8) {
  const regular = Math.min(hours, dailyThreshold);
  const overtime = Math.max(0, hours - dailyThreshold);
  return { regular, overtime };
}

export function mapTimeEntryToWagepointRow(
  entry: TimeEntry,
  employee?: Employee,
  job?: Job,
): WagepointHoursRow | null {
  if (!entry.clock_out) return null;
  const mins = Number(entry.duration_min || 0);
  if (mins <= 0) return null;
  const hours = Math.round((mins / 60) * 100) / 100;
  const { regular, overtime } = splitRegularOt(hours);
  const emp = employee || entry.expand?.employee;
  const site = job || entry.expand?.site;
  return {
    employee_id: entry.employee,
    employee_name: emp?.name || entry.employee,
    employee_email: emp?.email || '',
    job_code: site?.id?.slice(0, 8) || '',
    job_name: site?.name || '',
    date: (entry.clock_in || '').slice(0, 10),
    regular_hours: regular,
    overtime_hours: overtime,
    cost_center: site?.name || 'GENERAL',
    notes: `JobsitePro ${entry.id}`,
  };
}
