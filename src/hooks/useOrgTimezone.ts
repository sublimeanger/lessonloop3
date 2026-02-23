import { useCallback } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { formatDateForOrg, formatTimeForOrg, formatDateTimeForOrg } from '@/lib/utils';

const DEFAULT_TZ = 'Europe/London';

export function useOrgTimezone() {
  const { currentOrg } = useOrg();
  const timezone = currentOrg?.timezone || DEFAULT_TZ;

  const formatDate = useCallback(
    (date: Date | string, formatStr?: string) => formatDateForOrg(date, timezone, formatStr),
    [timezone],
  );

  const formatTime = useCallback(
    (date: Date | string) => formatTimeForOrg(date, timezone),
    [timezone],
  );

  const formatDateTime = useCallback(
    (date: Date | string) => formatDateTimeForOrg(date, timezone),
    [timezone],
  );

  return { timezone, formatDate, formatTime, formatDateTime } as const;
}
