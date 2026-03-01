/**
 * EscalasHeader Component
 *
 * Header section with title and action buttons.
 */

import React from 'react';
import { Box, Button, Tooltip, Typography } from '@mui/material';
import {
  Add,
  FileDownload,
  PictureAsPdf,
  Analytics,
  Refresh,
} from '@mui/icons-material';

// ============================================
// Props
// ============================================

export interface EscalasHeaderProps {
  // Export actions
  onExportCSV: () => void;
  onExportPDF: () => void;
  canExport: boolean;

  // Status recalculation
  onRecalcularStatus: () => void;
  recalculando: boolean;
  showRecalcular: boolean;

  // New escala
  onNewEscala: () => void;
  canCreateEscala: boolean;
}

// ============================================
// Component
// ============================================

export const EscalasHeader: React.FC<EscalasHeaderProps> = ({
  onExportCSV,
  onExportPDF,
  canExport,
  onRecalcularStatus,
  recalculando,
  showRecalcular,
  onNewEscala,
  canCreateEscala,
}) => {
  return (
    <Box
      sx={{
        mb: 4,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Escalas Médicas
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Gerencie as escalas médicas por contrato
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        {/* CSV Export */}
        <Tooltip title="Exportar dados filtrados em CSV">
          <span>
            <Button
              variant="outlined"
              startIcon={<FileDownload />}
              onClick={onExportCSV}
              disabled={!canExport}
              sx={{
                height: 42,
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': {
                  borderColor: 'primary.dark',
                  bgcolor: 'primary.50',
                },
              }}
            >
              CSV
            </Button>
          </span>
        </Tooltip>

        {/* PDF Export */}
        <Tooltip title="Exportar dados filtrados em PDF">
          <span>
            <Button
              variant="outlined"
              startIcon={<PictureAsPdf />}
              onClick={onExportPDF}
              disabled={!canExport}
              sx={{
                height: 42,
                borderColor: 'error.main',
                color: 'error.main',
                '&:hover': {
                  borderColor: 'error.dark',
                  bgcolor: 'error.50',
                },
              }}
            >
              PDF
            </Button>
          </span>
        </Tooltip>

        {/* Recalculate Status */}
        {showRecalcular && (
          <Tooltip title="Recalcular status automaticamente baseado nos registros de acesso">
            <span>
              <Button
                variant="outlined"
                startIcon={
                  recalculando ? (
                    <Refresh
                      sx={{
                        animation: 'spin 1s linear infinite',
                        '@keyframes spin': {
                          '0%': { transform: 'rotate(0deg)' },
                          '100%': { transform: 'rotate(360deg)' },
                        },
                      }}
                    />
                  ) : (
                    <Analytics />
                  )
                }
                onClick={onRecalcularStatus}
                disabled={recalculando}
                sx={{
                  height: 42,
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.dark',
                    bgcolor: 'primary.50',
                  },
                }}
              >
                {recalculando ? 'Recalculando...' : 'Recalcular Status'}
              </Button>
            </span>
          </Tooltip>
        )}

        {/* New Escala */}
        {canCreateEscala && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={onNewEscala}
            sx={{
              height: 42,
              background: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)',
              color: 'white',
              '&:hover': {
                background: 'linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)',
              },
            }}
          >
            Nova Escala
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default EscalasHeader;
