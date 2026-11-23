import {
  Alert,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import { useState } from 'react';
import { useEmployee } from '../api/queries';
import { formatDate, formatMoney, formatPercent, formatUsd, titleCase } from '../lib/format';
import { BandPositionTag } from './BandPositionTag';
import { SalaryChangeForm } from './SalaryChangeForm';

/**
 * Everything about one person: who they are, what they earn today, where that sits
 * in their band, and how it got there.
 */
export function EmployeeDrawer({
  employeeId,
  onClose,
}: {
  employeeId: number | null;
  onClose: () => void;
}) {
  const { data: employee, isLoading } = useEmployee(employeeId);
  const [isEditing, setEditing] = useState(false);

  return (
    <Drawer
      width={560}
      open={employeeId !== null}
      onClose={() => {
        setEditing(false);
        onClose();
      }}
      title={employee ? `${employee.firstName} ${employee.lastName}` : 'Employee'}
      extra={
        employee &&
        employee.status !== 'TERMINATED' && (
          <Button type="primary" onClick={() => setEditing((editing) => !editing)}>
            {isEditing ? 'Cancel' : 'Change salary'}
          </Button>
        )
      }
    >
      {isLoading || !employee ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          <Space size="large" wrap style={{ marginBottom: 16, display: 'flex' }}>
            <Statistic
              title="Annual base"
              value={formatMoney(employee.currentSalary.baseAmount, employee.currentSalary.currency)}
            />
            {employee.currentSalary.currency !== 'USD' && (
              <Statistic title="In USD" value={formatUsd(employee.currentSalary.amountUsd)} />
            )}
            <Statistic title="Compa-ratio" value={employee.compaRatio.toFixed(2)} />
          </Space>

          <Space wrap style={{ marginBottom: 16, display: 'flex' }}>
            <BandPositionTag
              position={employee.bandPosition}
              band={employee.band}
              compaRatio={employee.compaRatio}
            />
            <Tag>{`${employee.jobLevel.code} · ${employee.jobLevel.name}`}</Tag>
            <Tag color={employee.status === 'ACTIVE' ? 'green' : 'default'}>
              {titleCase(employee.status)}
            </Tag>
          </Space>

          {employee.bandPosition === 'BELOW_BAND' && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={`Paid below the ${employee.jobLevel.code} band for ${employee.country.name}, which starts at ${formatUsd(employee.band.minUsd)}.`}
            />
          )}

          {isEditing && (
            <>
              <SalaryChangeForm employee={employee} onDone={() => setEditing(false)} />
              <Divider />
            </>
          )}

          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Employee code">{employee.employeeCode}</Descriptions.Item>
            <Descriptions.Item label="Email">{employee.email}</Descriptions.Item>
            <Descriptions.Item label="Title">{employee.jobTitle}</Descriptions.Item>
            <Descriptions.Item label="Department">{employee.department.name}</Descriptions.Item>
            <Descriptions.Item label="Country">
              {`${employee.country.name} (${employee.country.currency})`}
            </Descriptions.Item>
            <Descriptions.Item label="Manager">
              {employee.manager ? employee.manager.name : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Hired">{formatDate(employee.hireDate)}</Descriptions.Item>
          </Descriptions>

          <Divider orientation="left">Salary history</Divider>
          {employee.salaryHistory.length === 0 ? (
            <Empty description="No salary records" />
          ) : (
            <Timeline
              items={employee.salaryHistory.map((entry) => ({
                color: entry.effectiveTo === null ? 'blue' : 'gray',
                children: (
                  <Space direction="vertical" size={0}>
                    <Typography.Text strong>
                      {formatMoney(entry.baseAmount, entry.currency)}
                      {entry.changePercent !== null && (
                        <Typography.Text
                          type={entry.changePercent >= 0 ? 'success' : 'danger'}
                          style={{ marginLeft: 8 }}
                        >
                          {formatPercent(entry.changePercent)}
                        </Typography.Text>
                      )}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {titleCase(entry.changeReason)} · from {formatDate(entry.effectiveFrom)}
                      {entry.effectiveTo ? ` to ${formatDate(entry.effectiveTo)}` : ' (current)'}
                    </Typography.Text>
                    {entry.currency !== 'USD' && (
                      <Typography.Text type="secondary">
                        {formatUsd(entry.amountUsd)} at {entry.usdRate}
                      </Typography.Text>
                    )}
                    {entry.note && <Typography.Text italic>{entry.note}</Typography.Text>}
                  </Space>
                ),
              }))}
            />
          )}
        </>
      )}
    </Drawer>
  );
}
