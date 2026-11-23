import { Button, Select, Space } from 'antd';
import { useReferenceData } from '../api/queries';
import type { EmployeeFilters, EmployeeStatus } from '../api/types';

const STATUS_OPTIONS: Array<{ value: EmployeeStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On leave' },
  { value: 'TERMINATED', label: 'Terminated' },
];

interface FilterBarProps {
  filters: EmployeeFilters;
  onChange: (filters: EmployeeFilters) => void;
  /** The directory offers a band filter; the dashboard does not. */
  showBandFilter?: boolean;
}

/**
 * One filter bar shared by the directory and the dashboard, so a question asked on
 * one screen can be carried to the other without being re-typed.
 */
export function FilterBar({ filters, onChange, showBandFilter = false }: FilterBarProps) {
  const { data: reference } = useReferenceData();
  const update = (patch: Partial<EmployeeFilters>) => onChange({ ...filters, ...patch });
  const isFiltered = Object.values(filters).some(
    (value) => value !== undefined && (!Array.isArray(value) || value.length > 0),
  );

  return (
    <Space wrap size="small">
      <Select
        mode="multiple"
        allowClear
        style={{ minWidth: 200 }}
        placeholder="Department"
        value={filters.departmentIds}
        onChange={(departmentIds) => update({ departmentIds })}
        options={reference?.departments.map((item) => ({ value: item.id, label: item.name }))}
        maxTagCount="responsive"
      />
      <Select
        mode="multiple"
        allowClear
        style={{ minWidth: 200 }}
        placeholder="Country"
        value={filters.countryIds}
        onChange={(countryIds) => update({ countryIds })}
        options={reference?.countries.map((item) => ({ value: item.id, label: item.name }))}
        maxTagCount="responsive"
      />
      <Select
        mode="multiple"
        allowClear
        style={{ minWidth: 180 }}
        placeholder="Level"
        value={filters.jobLevelIds}
        onChange={(jobLevelIds) => update({ jobLevelIds })}
        options={reference?.jobLevels.map((item) => ({
          value: item.id,
          label: `${item.code} · ${item.name}`,
        }))}
        maxTagCount="responsive"
      />
      <Select
        mode="multiple"
        allowClear
        style={{ minWidth: 160 }}
        placeholder="Status"
        value={filters.statuses}
        onChange={(statuses) => update({ statuses })}
        options={STATUS_OPTIONS}
        maxTagCount="responsive"
      />
      {showBandFilter && (
        <Select
          mode="multiple"
          allowClear
          style={{ minWidth: 200 }}
          placeholder="Band position"
          value={filters.bandPositions}
          onChange={(bandPositions) => update({ bandPositions })}
          options={[
            { value: 'BELOW_BAND', label: 'Below band' },
            { value: 'LOWER_HALF', label: 'Lower half' },
            { value: 'UPPER_HALF', label: 'Upper half' },
            { value: 'ABOVE_BAND', label: 'Above band' },
          ]}
          maxTagCount="responsive"
        />
      )}
      {isFiltered && (
        <Button type="link" onClick={() => onChange({ search: filters.search })}>
          Clear
        </Button>
      )}
    </Space>
  );
}
