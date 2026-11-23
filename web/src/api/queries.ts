import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, toQueryString } from './client';
import type {
  BreakdownDimension,
  BreakdownRow,
  ChangeReason,
  DistributionBucket,
  EmployeeDetail,
  EmployeeFilters,
  EmployeeSummary,
  Page,
  PayGapRow,
  PayOverview,
  ReferenceData,
} from './types';

export interface DirectoryQuery extends EmployeeFilters {
  page: number;
  pageSize: number;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
}

/** Reference data changes about once a year; there is no reason to refetch it. */
export const useReferenceData = () =>
  useQuery({
    queryKey: ['reference'],
    queryFn: () => apiRequest<ReferenceData>('/reference'),
    staleTime: Infinity,
  });

export const useEmployees = (query: DirectoryQuery) =>
  useQuery({
    queryKey: ['employees', query],
    queryFn: () =>
      apiRequest<Page<EmployeeSummary>>(`/employees${toQueryString({ ...query })}`),
    // Keeping the previous page on screen while the next one loads stops the table
    // from collapsing to an empty state on every keystroke.
    placeholderData: (previous) => previous,
  });

export const useEmployee = (id: number | null) =>
  useQuery({
    queryKey: ['employee', id],
    queryFn: () => apiRequest<EmployeeDetail>(`/employees/${id}`),
    enabled: id !== null,
  });

export interface SalaryChangeInput {
  employeeId: number;
  baseAmountMajor: number;
  currency: string;
  effectiveFrom: string;
  changeReason: ChangeReason;
  note?: string;
}

export function useRecordSalaryChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ employeeId, ...body }: SalaryChangeInput) =>
      apiRequest<EmployeeDetail>(`/employees/${employeeId}/salary`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (updated) => {
      // A raise moves the directory row, the dashboard totals and the person's own
      // history, so everything that reads salaries is invalidated.
      queryClient.setQueryData(['employee', updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export const useOverview = (filters: EmployeeFilters) =>
  useQuery({
    queryKey: ['analytics', 'overview', filters],
    queryFn: () => apiRequest<PayOverview>(`/analytics/overview${toQueryString({ ...filters })}`),
  });

export const useBreakdown = (dimension: BreakdownDimension, filters: EmployeeFilters) =>
  useQuery({
    queryKey: ['analytics', 'breakdown', dimension, filters],
    queryFn: () =>
      apiRequest<{ dimension: BreakdownDimension; rows: BreakdownRow[] }>(
        `/analytics/breakdown${toQueryString({ ...filters, dimension })}`,
      ),
  });

export const useDistribution = (filters: EmployeeFilters, bucketUsdMajor: number) =>
  useQuery({
    queryKey: ['analytics', 'distribution', filters, bucketUsdMajor],
    queryFn: () =>
      apiRequest<{ bucketUsd: number; buckets: DistributionBucket[] }>(
        `/analytics/distribution${toQueryString({ ...filters, bucketUsdMajor })}`,
      ),
  });

export const usePayGap = (filters: EmployeeFilters) =>
  useQuery({
    queryKey: ['analytics', 'pay-gap', filters],
    queryFn: () =>
      apiRequest<{ rows: PayGapRow[] }>(`/analytics/pay-gap${toQueryString({ ...filters })}`),
  });
