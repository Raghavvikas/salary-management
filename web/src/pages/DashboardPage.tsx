import { Alert, Card, Col, Row, Segmented, Space, Statistic, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useBreakdown, useDistribution, useOverview, usePayGap } from '../api/queries';
import { FilterBar } from '../components/FilterBar';
import { formatUsd, formatUsdCompact } from '../lib/format';
import type {
  BreakdownDimension,
  BreakdownRow,
  EmployeeFilters,
  PayGapRow,
} from '../api/types';

const BUCKET_USD_MAJOR = 10_000;

/**
 * The screen that answers "how does this org pay people" — cost, spread, where the
 * money sits by dimension, and the two fairness questions an HR manager is asked
 * most: who is outside their band, and does the gap by gender look wrong.
 */
export function DashboardPage() {
  const [filters, setFilters] = useState<EmployeeFilters>({ statuses: ['ACTIVE'] });
  const [dimension, setDimension] = useState<BreakdownDimension>('department');

  const { data: overview, isLoading: loadingOverview } = useOverview(filters);
  const { data: breakdown, isLoading: loadingBreakdown } = useBreakdown(dimension, filters);
  const { data: distribution } = useDistribution(filters, BUCKET_USD_MAJOR);
  const { data: payGap } = usePayGap(filters);

  const breakdownColumns: ColumnsType<BreakdownRow> = [
    { title: 'Group', key: 'name', render: (_, row) => row.key.name },
    { title: 'Headcount', dataIndex: 'headcount', align: 'right' },
    {
      title: 'Annual cost',
      key: 'total',
      align: 'right',
      render: (_, row) => formatUsdCompact(row.totalUsd),
    },
    { title: 'p25', key: 'p25', align: 'right', render: (_, row) => formatUsd(row.p25Usd) },
    {
      title: 'Median',
      key: 'median',
      align: 'right',
      render: (_, row) => <strong>{formatUsd(row.medianUsd)}</strong>,
    },
    { title: 'p75', key: 'p75', align: 'right', render: (_, row) => formatUsd(row.p75Usd) },
    {
      title: 'Avg compa-ratio',
      key: 'compa',
      align: 'right',
      render: (_, row) => (
        <Typography.Text type={row.averageCompaRatio < 0.9 ? 'warning' : undefined}>
          {row.averageCompaRatio.toFixed(2)}
        </Typography.Text>
      ),
    },
  ];

  const payGapColumns: ColumnsType<PayGapRow> = [
    {
      title: 'Level',
      key: 'level',
      render: (_, row) => `${row.jobLevel.code} · ${row.jobLevel.name}`,
    },
    {
      title: 'Women',
      key: 'female',
      align: 'right',
      render: (_, row) =>
        row.medianByGender.FEMALE
          ? `${formatUsd(row.medianByGender.FEMALE)} (${row.countByGender.FEMALE})`
          : '—',
    },
    {
      title: 'Men',
      key: 'male',
      align: 'right',
      render: (_, row) =>
        row.medianByGender.MALE
          ? `${formatUsd(row.medianByGender.MALE)} (${row.countByGender.MALE})`
          : '—',
    },
    {
      title: 'Gap',
      key: 'gap',
      align: 'right',
      render: (_, row) =>
        row.gapPercent === null ? (
          <Typography.Text type="secondary">not comparable</Typography.Text>
        ) : (
          <Typography.Text type={row.gapPercent < -5 ? 'danger' : undefined}>
            {`${row.gapPercent > 0 ? '+' : ''}${row.gapPercent.toFixed(1)}%`}
          </Typography.Text>
        ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <FilterBar filters={filters} onChange={setFilters} />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Headcount"
              value={overview?.headcount ?? 0}
              loading={loadingOverview}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Annual base payroll"
              value={overview ? formatUsdCompact(overview.annualPayrollUsd) : '—'}
              loading={loadingOverview}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Tooltip
              title={
                overview
                  ? `p25 ${formatUsd(overview.p25Usd)} · p75 ${formatUsd(overview.p75Usd)}`
                  : undefined
              }
            >
              <Statistic
                title="Median salary"
                value={overview ? formatUsd(overview.medianUsd) : '—'}
                loading={loadingOverview}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Outside their band"
              value={
                overview ? `${overview.belowBandCount} under / ${overview.aboveBandCount} over` : '—'
              }
              loading={loadingOverview}
            />
          </Card>
        </Col>
      </Row>

      {overview && overview.belowBandCount > 0 && (
        <Alert
          type="info"
          showIcon
          message={`Bringing the ${overview.belowBandCount.toLocaleString()} people below their band up to the minimum would add ${formatUsdCompact(
            overview.costToFixBelowBandUsd,
          )} to annual payroll.`}
        />
      )}

      <Card title={`Salary distribution (USD, ${BUCKET_USD_MAJOR.toLocaleString()} buckets)`}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={(distribution?.buckets ?? []).map((bucket) => ({
              label: formatUsdCompact(bucket.fromUsd),
              count: bucket.count,
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <ChartTooltip formatter={(value) => [`${value} employees`, 'Headcount']} />
            <Bar dataKey="count" fill="#1d4ed8" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card
        title="How pay is spread"
        extra={
          <Segmented
            value={dimension}
            onChange={(value) => setDimension(value as BreakdownDimension)}
            options={[
              { label: 'Department', value: 'department' },
              { label: 'Country', value: 'country' },
              { label: 'Level', value: 'jobLevel' },
            ]}
          />
        }
        bodyStyle={{ padding: 0 }}
      >
        <Table<BreakdownRow>
          rowKey={(row) => row.key.id}
          size="small"
          loading={loadingBreakdown}
          columns={breakdownColumns}
          dataSource={breakdown?.rows ?? []}
          pagination={false}
        />
      </Card>

      <Card
        title="Median pay by gender, within each level"
        extra={
          <Typography.Text type="secondary">
            Comparing like with like; levels with one side missing are not compared.
          </Typography.Text>
        }
        bodyStyle={{ padding: 0 }}
      >
        <Table<PayGapRow>
          rowKey={(row) => row.jobLevel.id}
          size="small"
          columns={payGapColumns}
          dataSource={payGap?.rows ?? []}
          pagination={false}
        />
      </Card>
    </Space>
  );
}
