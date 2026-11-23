import { Card, Input, Space, Table, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';
import { useMemo, useState } from 'react';
import { useEmployees, type DirectoryQuery } from '../api/queries';
import { BandPositionTag } from '../components/BandPositionTag';
import { EmployeeDrawer } from '../components/EmployeeDrawer';
import { FilterBar } from '../components/FilterBar';
import { formatDate, formatMoney, formatUsd, titleCase } from '../lib/format';
import type { EmployeeFilters, EmployeeSummary } from '../api/types';

const PAGE_SIZE = 25;

/** Ant Design's sorter keys, mapped to the sort fields the API accepts. */
const SORT_FIELDS: Record<string, DirectoryQuery['sortBy']> = {
  name: 'name',
  employeeCode: 'employeeCode',
  salary: 'salaryUsd',
  compaRatio: 'compaRatio',
  hireDate: 'hireDate',
};

export function DirectoryPage() {
  const [filters, setFilters] = useState<EmployeeFilters>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ by: DirectoryQuery['sortBy']; direction: 'asc' | 'desc' }>({
    by: 'name',
    direction: 'asc',
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const query: DirectoryQuery = useMemo(
    () => ({
      ...filters,
      search: search.trim() || undefined,
      page,
      pageSize: PAGE_SIZE,
      sortBy: sort.by,
      sortDirection: sort.direction,
    }),
    [filters, search, page, sort],
  );

  const { data, isFetching } = useEmployees(query);

  const columns: ColumnsType<EmployeeSummary> = [
    {
      title: 'Employee',
      key: 'name',
      sorter: true,
      render: (_, employee) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{`${employee.firstName} ${employee.lastName}`}</Typography.Text>
          <Typography.Text type="secondary">
            {`${employee.employeeCode} · ${employee.jobTitle}`}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Department',
      key: 'department',
      render: (_, employee) => employee.department.name,
    },
    {
      title: 'Country',
      key: 'country',
      render: (_, employee) => `${employee.country.name}`,
    },
    {
      title: 'Level',
      key: 'level',
      render: (_, employee) => employee.jobLevel.code,
    },
    {
      title: 'Annual base',
      key: 'salary',
      align: 'right',
      sorter: true,
      render: (_, employee) => (
        <Space direction="vertical" size={0} style={{ textAlign: 'right' }}>
          <Typography.Text>
            {formatMoney(employee.currentSalary.baseAmount, employee.currentSalary.currency)}
          </Typography.Text>
          {employee.currentSalary.currency !== 'USD' && (
            <Typography.Text type="secondary">
              {formatUsd(employee.currentSalary.amountUsd)}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Band',
      key: 'compaRatio',
      sorter: true,
      render: (_, employee) => (
        <BandPositionTag
          position={employee.bandPosition}
          band={employee.band}
          compaRatio={employee.compaRatio}
        />
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, employee) => titleCase(employee.status),
    },
    {
      title: 'Hired',
      key: 'hireDate',
      sorter: true,
      render: (_, employee) => formatDate(employee.hireDate),
    },
  ];

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: unknown,
    sorter: SorterResult<EmployeeSummary> | SorterResult<EmployeeSummary>[],
  ) => {
    const active = Array.isArray(sorter) ? sorter[0] : sorter;
    const field = SORT_FIELDS[String(active?.columnKey ?? 'name')] ?? 'name';
    setSort({ by: field, direction: active?.order === 'descend' ? 'desc' : 'asc' });
    setPage(pagination.current ?? 1);
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder="Search by name, email or employee code"
            style={{ maxWidth: 420 }}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <FilterBar
            filters={filters}
            showBandFilter
            onChange={(next) => {
              setFilters(next);
              setPage(1);
            }}
          />
        </Space>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Table<EmployeeSummary>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isFetching}
          onChange={handleTableChange}
          rowClassName="table-row-clickable"
          onRow={(employee) => ({ onClick: () => setSelectedId(employee.id) })}
          // The table scrolls inside its own card rather than widening the page,
          // which is what was pushing the drawer out of view on narrow windows.
          scroll={{ x: 'max-content' }}
          pagination={{
            current: data?.page ?? page,
            pageSize: PAGE_SIZE,
            total: data?.total ?? 0,
            showSizeChanger: false,
            showTotal: (total) => `${total.toLocaleString()} employees`,
          }}
        />
      </Card>

      <EmployeeDrawer employeeId={selectedId} onClose={() => setSelectedId(null)} />
    </Space>
  );
}
