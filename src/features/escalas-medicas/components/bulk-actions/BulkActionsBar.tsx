/**
 * BulkActionsBar Component
 *
 * Toolbar for bulk selection and status update actions.
 */

import React from 'react';
import { Box, Button, Chip } from '@mui/material';
import {
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank,
  IndeterminateCheckBox,
  DoneAll,
  ThumbDown,
  Edit,
  DeleteForever,
} from '@mui/icons-material';

// ============================================
// Props
// ============================================

export interface BulkActionsBarProps {
  selectedCount: number;
  totalSelectableCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onApproveSelected: () => void;
  onRejectSelected: () => void;
  onDeleteSelected: () => void;
  onChangeStatus: () => void;
  isAdminAgir: boolean;
  isAdminTerceiro?: boolean;
  isTerceiro?: boolean;
}

// ============================================
// Component
// ============================================

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  totalSelectableCount,
  onSelectAll,
  onDeselectAll,
  onApproveSelected,
  onRejectSelected,
  onDeleteSelected,
  onChangeStatus,
  isAdminAgir,
  isAdminTerceiro = false,
  isTerceiro = false,
}) => {
  const isAllSelected = selectedCount === totalSelectableCount && totalSelectableCount > 0;

  const getSelectIcon = () => {
    if (selectedCount === 0) return <CheckBoxOutlineBlank />;
    if (isAllSelected) return <CheckBoxIcon />;
    return <IndeterminateCheckBox />;
  };

  const handleSelectToggle = () => {
    if (isAllSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  };

  return (
    <Box
      sx={{
        mb: 3,
        display: 'flex',
        gap: 2,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      {/* Select All / Deselect Button */}
      <Button
        variant={selectedCount === 0 ? 'outlined' : 'contained'}
        startIcon={getSelectIcon()}
        onClick={handleSelectToggle}
        size="small"
      >
        {isAllSelected
          ? 'Desselecionar Todos'
          : `Selecionar Todos (${totalSelectableCount})`}
      </Button>

      {/* Selected Count Chip & Actions */}
      {selectedCount > 0 && (
        <>
          <Chip
            label={`${selectedCount} selecionada${selectedCount > 1 ? 's' : ''}`}
            color="primary"
            onDelete={onDeselectAll}
          />

          {/* Admin-Agir only actions */}
          {isAdminAgir && (
            <>
              <Button
                variant="contained"
                color="success"
                startIcon={<DoneAll />}
                onClick={onApproveSelected}
                size="small"
              >
                Aprovar Selecionadas
              </Button>

              <Button
                variant="contained"
                color="error"
                startIcon={<ThumbDown />}
                onClick={onRejectSelected}
                size="small"
              >
                Reprovar Selecionadas
              </Button>
            </>
          )}

          {/* Delete action - available for Admin-Agir, Admin-Terceiro, and Terceiro */}
          {(isAdminAgir || isAdminTerceiro || isTerceiro) && (
            <Button
              variant="contained"
              startIcon={<DeleteForever />}
              onClick={onDeleteSelected}
              size="small"
              sx={{
                bgcolor: '#64748b',
                '&:hover': {
                  bgcolor: '#475569',
                },
              }}
            >
              Excluir Selecionadas
            </Button>
          )}

          {/* Change status action - Admin-Agir only */}
          {isAdminAgir && (
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={onChangeStatus}
              size="small"
            >
              Alterar Status
            </Button>
          )}
        </>
      )}
    </Box>
  );
};

export default BulkActionsBar;
