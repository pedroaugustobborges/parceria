/**
 * DashboardHeader Component
 *
 * Header section for the Dashboard page.
 */

import React from 'react';
import { Box, Typography, Chip, Button, CircularProgress } from '@mui/material';
import { Dashboard as DashboardIcon, Download, Refresh } from '@mui/icons-material';

export interface DashboardHeaderProps {
  loading: boolean;
  buscaRealizada: boolean;
  totalRegistros: number;
  onExportCSV: () => void;
  onRefresh: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  loading,
  buscaRealizada,
  totalRegistros,
  onExportCSV,
  onRefresh,
}) => {
  return (
    <Box sx={{ mb: 4 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DashboardIcon sx={{ color: 'white', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Dashboard de Acessos
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Acompanhamento de acessos e produtividade médica
            </Typography>
          </Box>
        </Box>

        {buscaRealizada && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={`${totalRegistros} registro${totalRegistros !== 1 ? 's' : ''}`}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />

            <Button
              variant="outlined"
              startIcon={loading ? <CircularProgress size={18} /> : <Refresh />}
              onClick={onRefresh}
              disabled={loading}
              size="small"
            >
              Atualizar
            </Button>

            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={onExportCSV}
              disabled={loading || totalRegistros === 0}
              size="small"
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #63397d 100%)',
                },
              }}
            >
              Exportar CSV
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default DashboardHeader;
