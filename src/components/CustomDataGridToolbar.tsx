/**
 * CustomDataGridToolbar Component
 *
 * A modern, styled toolbar for MUI DataGrid that replaces the default CSV export
 * with XLSX (Excel) export while maintaining all other toolbar features.
 * Supports dark mode.
 */

import React from 'react';
import {
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarQuickFilter,
  useGridApiContext,
} from '@mui/x-data-grid';
import { Button, Box, Tooltip, Chip, alpha, useTheme } from '@mui/material';
import { FileDownload, TableChart } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface CustomDataGridToolbarProps {
  showQuickFilter?: boolean;
  quickFilterProps?: {
    debounceMs?: number;
  };
  fileName?: string;
  sheetName?: string;
}

export const CustomDataGridToolbar: React.FC<CustomDataGridToolbarProps> = ({
  showQuickFilter = true,
  quickFilterProps = { debounceMs: 500 },
  fileName = 'dados',
  sheetName = 'Dados',
}) => {
  const apiRef = useGridApiContext();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleExportXLSX = () => {
    // Get all rows (respecting current filtering/sorting)
    const filteredSortedRows = apiRef.current.getSortedRowIds();
    const columns = apiRef.current.getVisibleColumns();

    // Get headers (excluding __check__ column for selection)
    const headers = columns
      .filter((col) => col.field !== '__check__')
      .map((col) => col.headerName || col.field);

    // Get data rows
    const rows = filteredSortedRows.map((rowId) => {
      const row = apiRef.current.getRow(rowId);
      return columns
        .filter((col) => col.field !== '__check__')
        .map((col) => {
          const value = row[col.field];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value);
          return value;
        });
    });

    // Create worksheet data
    const data = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Auto-adjust column widths
    const colWidths = headers.map((header, colIndex) => {
      const maxLength = Math.max(
        String(header).length,
        ...rows.map((row) => String(row[colIndex] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
    });
    worksheet['!cols'] = colWidths;

    // Create workbook and download
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    XLSX.writeFile(workbook, `${fileName}_${timestamp}.xlsx`);
  };

  const totalRows = apiRef.current.getRowsCount();
  const filteredRows = apiRef.current.getSortedRowIds().length;
  const isFiltered = filteredRows !== totalRows;

  // Blue color matching the Pontualidade/Absenteísmo sections
  const blueColor = '#3b82f6';
  const blueLightBg = isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)';

  return (
    <GridToolbarContainer
      sx={{
        p: 2,
        gap: 2,
        borderBottom: '1px solid',
        borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'divider',
        background: isDark
          ? 'linear-gradient(180deg, rgba(59, 130, 246, 0.1) 0%, transparent 100%)'
          : `linear-gradient(180deg, ${blueLightBg} 0%, transparent 100%)`,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <GridToolbarColumnsButton
          slotProps={{
            button: {
              size: 'small',
              sx: {
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 500,
                color: isDark ? '#93c5fd' : 'text.secondary',
                '&:hover': {
                  bgcolor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'action.hover',
                  color: blueColor,
                },
              },
            },
          }}
        />
        <GridToolbarFilterButton
          slotProps={{
            button: {
              size: 'small',
              sx: {
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 500,
                color: isDark ? '#93c5fd' : 'text.secondary',
                '&:hover': {
                  bgcolor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'action.hover',
                  color: blueColor,
                },
              },
            },
          }}
        />
        <GridToolbarDensitySelector
          slotProps={{
            button: {
              size: 'small',
              sx: {
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 500,
                color: isDark ? '#93c5fd' : 'text.secondary',
                '&:hover': {
                  bgcolor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'action.hover',
                  color: blueColor,
                },
              },
            },
          }}
        />
        <Tooltip title="Exportar para Excel (.xlsx)">
          <Button
            size="small"
            startIcon={<FileDownload />}
            onClick={handleExportXLSX}
            sx={{
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 500,
              color: isDark ? '#93c5fd' : 'text.secondary',
              '&:hover': {
                bgcolor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'success.50',
                color: isDark ? '#6ee7b7' : 'success.main',
              },
            }}
          >
            Exportar
          </Button>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 'auto' }}>
        {isFiltered && (
          <Chip
            icon={<TableChart sx={{ fontSize: 16 }} />}
            label={`${filteredRows} de ${totalRows} registros`}
            size="small"
            sx={{
              fontWeight: 500,
              borderRadius: 1.5,
              bgcolor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
              color: isDark ? '#93c5fd' : blueColor,
              border: '1px solid',
              borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.3)',
              '& .MuiChip-icon': {
                color: isDark ? '#93c5fd' : blueColor,
              },
            }}
          />
        )}
        {showQuickFilter && (
          <GridToolbarQuickFilter
            {...quickFilterProps}
            placeholder="Buscar..."
            sx={{
              minWidth: 220,
              '& .MuiInputBase-root': {
                bgcolor: isDark ? 'rgba(30, 41, 59, 0.8)' : 'background.paper',
                borderRadius: 2,
                border: '1px solid',
                borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'divider',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: blueColor,
                },
                '&.Mui-focused': {
                  borderColor: blueColor,
                  boxShadow: `0 0 0 3px ${isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'}`,
                },
                '& .MuiInputBase-input': {
                  py: 1,
                  px: 1.5,
                  fontSize: '0.875rem',
                  color: isDark ? '#e2e8f0' : 'text.primary',
                },
              },
              '& .MuiSvgIcon-root': {
                color: isDark ? '#93c5fd' : 'text.secondary',
              },
            }}
          />
        )}
      </Box>
    </GridToolbarContainer>
  );
};

export default CustomDataGridToolbar;
