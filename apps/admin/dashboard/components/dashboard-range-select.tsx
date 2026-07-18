"use client";

import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import type { DashboardDateRange } from "../lib/dashboard-analytics";

const rangeOptions: Array<{ value: DashboardDateRange; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

interface DashboardRangeSelectProps {
  value: DashboardDateRange;
  onChange: (value: DashboardDateRange) => void;
  className?: string;
}

export function DashboardRangeSelect({ value, onChange, className }: DashboardRangeSelectProps) {
  return (
    <AdminSelect
      className={className}
      value={value}
      onChange={(event) => onChange(event.target.value as DashboardDateRange)}
      aria-label="Dashboard date range"
    >
      {rangeOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </AdminSelect>
  );
}
