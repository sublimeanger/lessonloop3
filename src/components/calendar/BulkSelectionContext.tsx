import { createContext, useContext } from 'react';

interface BulkSelectionContextValue {
  selectionMode: boolean;
  selectedIds: Set<string>;
}

const BulkSelectionContext = createContext<BulkSelectionContextValue>({
  selectionMode: false,
  selectedIds: new Set(),
});

export const BulkSelectionProvider = BulkSelectionContext.Provider;
export const useBulkSelection = () => useContext(BulkSelectionContext);
