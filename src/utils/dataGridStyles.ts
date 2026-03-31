/**
 * DataGrid Styles Utility
 *
 * Shared styling for MUI DataGrid components with dark mode support.
 * Uses the same blue color (#3b82f6) as the Pontualidade/Absenteísmo sections.
 */

import { SxProps, Theme } from '@mui/material';

// Blue color matching the Pontualidade/Absenteísmo sections
const BLUE_PRIMARY = '#3b82f6';
const BLUE_LIGHT = '#93c5fd';
const BLUE_DARK = '#1e40af';

/**
 * Get DataGrid styles with dark mode support
 */
export const getDataGridStyles = (isDark: boolean): SxProps<Theme> => ({
  border: 'none',
  borderRadius: 2,

  // Column headers with blue background
  '& .MuiDataGrid-columnHeaders': {
    bgcolor: isDark ? 'rgba(59, 130, 246, 0.15)' : BLUE_PRIMARY,
    borderRadius: '8px 8px 0 0',
    borderBottom: isDark ? `2px solid ${BLUE_PRIMARY}` : 'none',
  },
  '& .MuiDataGrid-columnHeader': {
    bgcolor: 'transparent',
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    fontWeight: 700,
    color: isDark ? BLUE_LIGHT : 'white',
  },
  '& .MuiDataGrid-columnSeparator': {
    color: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.3)',
  },
  '& .MuiDataGrid-sortIcon': {
    color: isDark ? BLUE_LIGHT : 'white',
  },
  '& .MuiDataGrid-menuIconButton': {
    color: isDark ? BLUE_LIGHT : 'white',
  },

  // Cells
  '& .MuiDataGrid-cell': {
    borderColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'grey.100',
  },
  '& .MuiDataGrid-cell:focus': {
    outline: 'none',
  },
  '& .MuiDataGrid-cell:focus-within': {
    outline: 'none',
  },

  // Rows
  '& .MuiDataGrid-row': {
    transition: 'background-color 0.15s ease-in-out',
  },
  '& .MuiDataGrid-row:hover': {
    bgcolor: isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.04)',
  },
  '& .MuiDataGrid-row.Mui-selected': {
    bgcolor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)',
    '&:hover': {
      bgcolor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.12)',
    },
  },
  '& .MuiDataGrid-row:nth-of-type(even)': {
    bgcolor: isDark ? 'rgba(30, 41, 59, 0.3)' : 'rgba(59, 130, 246, 0.02)',
  },

  // Footer
  '& .MuiDataGrid-footerContainer': {
    borderTop: '1px solid',
    borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'grey.200',
  },

  // Pagination
  '& .MuiTablePagination-root': {
    color: isDark ? '#e2e8f0' : 'text.secondary',
  },
  '& .MuiTablePagination-selectIcon': {
    color: isDark ? BLUE_LIGHT : 'text.secondary',
  },

  // Virtual scroller (for scrollbar styling)
  '& .MuiDataGrid-virtualScroller': {
    bgcolor: isDark ? 'transparent' : 'background.paper',
  },

  // No rows overlay
  '& .MuiDataGrid-overlay': {
    bgcolor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)',
  },
});

/**
 * Get table header cell styles for dialogs
 */
export const getTableHeaderStyles = (isDark: boolean): SxProps<Theme> => ({
  fontWeight: 700,
  bgcolor: isDark ? 'rgba(59, 130, 246, 0.15)' : BLUE_PRIMARY,
  color: isDark ? BLUE_LIGHT : 'white',
  borderBottom: isDark ? `2px solid ${BLUE_PRIMARY}` : 'none',
  whiteSpace: 'nowrap',
});

/**
 * Get table row styles for dialogs
 */
export const getTableRowStyles = (isDark: boolean): SxProps<Theme> => ({
  transition: 'background-color 0.15s',
  '&:hover': {
    bgcolor: isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.04)',
  },
  '&:last-child td': { border: 0 },
  '&:nth-of-type(even)': {
    bgcolor: isDark ? 'rgba(30, 41, 59, 0.3)' : 'rgba(59, 130, 246, 0.02)',
  },
});

/**
 * Get table container styles for dialogs
 */
export const getTableContainerStyles = (isDark: boolean): SxProps<Theme> => ({
  border: '1px solid',
  borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'divider',
  borderRadius: 2,
  overflow: 'hidden',
});
