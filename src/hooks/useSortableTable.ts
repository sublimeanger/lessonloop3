import { useState, useMemo } from 'react';

export type SortDir = 'asc' | 'desc';

export interface SortState<F extends string> {
  field: F;
  dir: SortDir;
}

export function useSortableTable<T, F extends string>(
  data: T[],
  defaultField: F,
  defaultDir: SortDir = 'asc',
  comparators: Record<F, (a: T, b: T) => number>
) {
  const [sort, setSort] = useState<SortState<F>>({ field: defaultField, dir: defaultDir });

  const toggle = (field: F) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' }
    );
  };

  const sorted = useMemo(() => {
    const cmp = comparators[sort.field];
    if (!cmp) return data;
    const result = [...data].sort(cmp);
    return sort.dir === 'desc' ? result.reverse() : result;
  }, [data, sort, comparators]);

  return { sorted, sort, toggle } as const;
}
