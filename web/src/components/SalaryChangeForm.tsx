import { App, Alert, Button, DatePicker, Form, Input, InputNumber, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useRecordSalaryChange } from '../api/queries';
import { ApiError } from '../api/client';
import { formatMoney, toMajor } from '../lib/format';
import type { ChangeReason, EmployeeDetail } from '../api/types';

const REASONS: Array<{ value: ChangeReason; label: string }> = [
  { value: 'MERIT_INCREASE', label: 'Merit increase' },
  { value: 'PROMOTION', label: 'Promotion' },
  { value: 'MARKET_ADJUSTMENT', label: 'Market adjustment' },
  { value: 'ROLE_CHANGE', label: 'Role change' },
  { value: 'CORRECTION', label: 'Correction' },
];

interface FormValues {
  baseAmountMajor: number;
  effectiveFrom: Dayjs;
  changeReason: ChangeReason;
  note?: string;
}

/**
 * Records a new salary. The server owns the rules, so this form stays thin: it
 * collects four fields and renders whatever the server refused and why.
 */
export function SalaryChangeForm({
  employee,
  onDone,
}: {
  employee: EmployeeDetail;
  onDone: () => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();
  const mutation = useRecordSalaryChange();

  const currency = employee.currentSalary.currency;
  const currentMajor = toMajor(employee.currentSalary.baseAmount);
  const proposed = Form.useWatch('baseAmountMajor', form);
  const changePercent =
    typeof proposed === 'number' && currentMajor > 0
      ? ((proposed - currentMajor) / currentMajor) * 100
      : null;

  const violations = mutation.error instanceof ApiError ? mutation.error.violations : [];
  const otherError =
    mutation.error instanceof ApiError && violations.length === 0
      ? mutation.error.message
      : null;

  return (
    <Form<FormValues>
      form={form}
      layout="vertical"
      initialValues={{
        baseAmountMajor: currentMajor,
        effectiveFrom: dayjs().add(1, 'month').startOf('month'),
        changeReason: 'MERIT_INCREASE',
      }}
      onFinish={(values) => {
        mutation.mutate(
          {
            employeeId: employee.id,
            baseAmountMajor: values.baseAmountMajor,
            currency,
            effectiveFrom: values.effectiveFrom.format('YYYY-MM-DD'),
            changeReason: values.changeReason,
            note: values.note?.trim() || undefined,
          },
          {
            onSuccess: () => {
              message.success(`${employee.firstName}'s salary has been updated.`);
              onDone();
            },
          },
        );
      }}
    >
      {violations.length > 0 && (
        <Alert
          type="error"
          style={{ marginBottom: 16 }}
          message="This change was not recorded"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {violations.map((violation) => (
                <li key={violation.code}>{violation.message}</li>
              ))}
            </ul>
          }
        />
      )}
      {otherError && <Alert type="error" style={{ marginBottom: 16 }} message={otherError} />}

      <Form.Item
        name="baseAmountMajor"
        label={`New annual base (${currency})`}
        extra={
          changePercent === null
            ? `Currently ${formatMoney(employee.currentSalary.baseAmount, currency)}.`
            : `${changePercent >= 0 ? 'Increase' : 'Decrease'} of ${Math.abs(
                changePercent,
              ).toFixed(2)}% on ${formatMoney(employee.currentSalary.baseAmount, currency)}.`
        }
        rules={[{ required: true, message: 'Enter the new annual base salary.' }]}
      >
        <InputNumber<number>
          style={{ width: '100%' }}
          min={1}
          step={1000}
          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(value) => Number((value ?? '').replace(/,/g, ''))}
        />
      </Form.Item>

      <Form.Item
        name="effectiveFrom"
        label="Effective from"
        rules={[{ required: true, message: 'Pick the date the new salary starts.' }]}
      >
        <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
      </Form.Item>

      <Form.Item name="changeReason" label="Reason" rules={[{ required: true }]}>
        <Select options={REASONS} />
      </Form.Item>

      <Form.Item
        name="note"
        label="Note"
        extra="Required for a correction or a role change."
      >
        <Input.TextArea rows={2} maxLength={500} />
      </Form.Item>

      <Button type="primary" htmlType="submit" loading={mutation.isPending} block>
        Record change
      </Button>
    </Form>
  );
}
