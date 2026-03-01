/**
 * ScheduleIndicatorsSection Component
 *
 * Displays punctuality and absenteeism indicators based on schedules.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  Paper,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Schedule,
  PersonOff,
  FilterList,
  ArrowBackIos,
  ArrowForwardIos,
} from '@mui/icons-material';
import type { PontualidadeItem, AbsenteismoItem } from '../../types/dashboard.types';

export interface ScheduleIndicatorsSectionProps {
  indicadoresEscalas: {
    pontualidade: PontualidadeItem[];
    absenteismo: AbsenteismoItem[];
  };
  pagePontualidade: number;
  setPagePontualidade: (page: number) => void;
  pageAbsenteismo: number;
  setPageAbsenteismo: (page: number) => void;
  itemsPerPage: number;
  onOpenPontualidadeModal: (cpf: string, nome: string) => void;
  onOpenAbsenteismoModal: (cpf: string, nome: string) => void;
  filtroNome: string[];
  filtroDataInicio: Date | null;
  filtroDataFim: Date | null;
}

interface PaginationControlsProps {
  currentPage: number;
  setPage: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  setPage,
  totalItems,
  itemsPerPage,
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage >= totalPages - 1;

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 2,
        mt: 2,
        pt: 2,
        borderTop: "1px solid #e5e7eb",
      }}
    >
      <IconButton
        onClick={() => setPage(Math.max(0, currentPage - 1))}
        disabled={isFirstPage}
        size="small"
        sx={{
          bgcolor: isFirstPage ? "#f3f4f6" : "#3b82f6",
          color: isFirstPage ? "#9ca3af" : "white",
          "&:hover": {
            bgcolor: isFirstPage ? "#f3f4f6" : "#2563eb",
          },
          "&:disabled": {
            bgcolor: "#f3f4f6",
            color: "#9ca3af",
          },
        }}
      >
        <ArrowBackIos sx={{ fontSize: 14, ml: 0.5 }} />
      </IconButton>
      <Typography variant="body2" fontWeight={600} color="text.secondary">
        {currentPage + 1} / {totalPages}
      </Typography>
      <IconButton
        onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
        disabled={isLastPage}
        size="small"
        sx={{
          bgcolor: isLastPage ? "#f3f4f6" : "#3b82f6",
          color: isLastPage ? "#9ca3af" : "white",
          "&:hover": {
            bgcolor: isLastPage ? "#f3f4f6" : "#2563eb",
          },
          "&:disabled": {
            bgcolor: "#f3f4f6",
            color: "#9ca3af",
          },
        }}
      >
        <ArrowForwardIos sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
};

export const ScheduleIndicatorsSection: React.FC<ScheduleIndicatorsSectionProps> = ({
  indicadoresEscalas,
  pagePontualidade,
  setPagePontualidade,
  pageAbsenteismo,
  setPageAbsenteismo,
  itemsPerPage,
  onOpenPontualidadeModal,
  onOpenAbsenteismoModal,
  filtroNome,
  filtroDataInicio,
  filtroDataFim,
}) => {
  const theme = useTheme();
  const hasActiveFilters = filtroNome.length > 0 || filtroDataInicio || filtroDataFim;

  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      {/* Índice de Pontualidade */}
      <Grid item xs={12} md={6}>
        <Card
          sx={{
            background: theme.palette.mode === 'dark'
              ? "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
              : "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
            borderRadius: 3,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            border: theme.palette.mode === 'dark'
              ? "1px solid rgba(59, 130, 246, 0.3)"
              : "1px solid #bae6fd",
            height: "100%",
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "12px",
                  bgcolor: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Schedule sx={{ color: "white", fontSize: 28 }} />
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  color={theme.palette.mode === 'dark' ? "#93c5fd" : "#1e40af"}
                >
                  Índice de Pontualidade
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Médicos com mais atrasos (acima de 10min)
                </Typography>
              </Box>
            </Box>

            {hasActiveFilters && (
              <Box sx={{ mb: 2 }}>
                <Chip
                  icon={<FilterList />}
                  label="Filtros ativos"
                  size="small"
                  sx={{
                    bgcolor: theme.palette.mode === 'dark'
                      ? "rgba(59, 130, 246, 0.2)"
                      : "rgba(59, 130, 246, 0.15)",
                    color: theme.palette.mode === 'dark' ? "#93c5fd" : "#1e40af",
                    fontWeight: 600,
                  }}
                />
              </Box>
            )}

            <Divider sx={{ mb: 2 }} />

            {indicadoresEscalas.pontualidade.length === 0 ? (
              <Box
                sx={{
                  textAlign: "center",
                  py: 4,
                  opacity: 0.6,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Sem dados de escalas no período
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                  {indicadoresEscalas.pontualidade
                    .slice(
                      pagePontualidade * itemsPerPage,
                      pagePontualidade * itemsPerPage + itemsPerPage
                    )
                    .map((item, index) => (
                      <Paper
                        key={item.cpf}
                        sx={{
                          p: 2,
                          mb: 1.5,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          "&:hover": {
                            transform: "translateX(4px)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            bgcolor: "info.50",
                          },
                        }}
                        onClick={() => onOpenPontualidadeModal(item.cpf, item.nome)}
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: "8px",
                                bgcolor: "#3b82f6",
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              {pagePontualidade * itemsPerPage + index + 1}
                            </Box>
                            <Box flex={1}>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                sx={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {item.nome}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Pontualidade: {item.indice}%
                              </Typography>
                            </Box>
                          </Box>
                          <Chip
                            label={`${item.atrasos} ${item.atrasos === 1 ? "atraso" : "atrasos"}`}
                            size="small"
                            sx={{
                              bgcolor: "#3b82f6",
                              color: "white",
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                      </Paper>
                    ))}
                </Box>
                {indicadoresEscalas.pontualidade.length > itemsPerPage && (
                  <PaginationControls
                    currentPage={pagePontualidade}
                    setPage={setPagePontualidade}
                    totalItems={indicadoresEscalas.pontualidade.length}
                    itemsPerPage={itemsPerPage}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Índice de Absenteísmo */}
      <Grid item xs={12} md={6}>
        <Card
          sx={{
            background: theme.palette.mode === 'dark'
              ? "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
              : "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
            borderRadius: 3,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            border: theme.palette.mode === 'dark'
              ? "1px solid rgba(59, 130, 246, 0.3)"
              : "1px solid #bae6fd",
            height: "100%",
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "12px",
                  bgcolor: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PersonOff sx={{ color: "white", fontSize: 28 }} />
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  color={theme.palette.mode === 'dark' ? "#93c5fd" : "#1e40af"}
                >
                  Índice de Absenteísmo
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Escalas sem registro de acesso
                </Typography>
              </Box>
            </Box>

            {hasActiveFilters && (
              <Box sx={{ mb: 2 }}>
                <Chip
                  icon={<FilterList />}
                  label="Filtros ativos"
                  size="small"
                  sx={{
                    bgcolor: theme.palette.mode === 'dark'
                      ? "rgba(59, 130, 246, 0.2)"
                      : "rgba(59, 130, 246, 0.15)",
                    color: theme.palette.mode === 'dark' ? "#93c5fd" : "#1e40af",
                    fontWeight: 600,
                  }}
                />
              </Box>
            )}

            <Divider sx={{ mb: 2 }} />

            {indicadoresEscalas.absenteismo.length === 0 ? (
              <Box
                sx={{
                  textAlign: "center",
                  py: 4,
                  opacity: 0.6,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Sem dados de escalas no período
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                  {indicadoresEscalas.absenteismo
                    .slice(
                      pageAbsenteismo * itemsPerPage,
                      pageAbsenteismo * itemsPerPage + itemsPerPage
                    )
                    .map((item, index) => (
                      <Paper
                        key={item.cpf}
                        sx={{
                          p: 2,
                          mb: 1.5,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          "&:hover": {
                            transform: "translateX(4px)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            bgcolor: "info.50",
                          },
                        }}
                        onClick={() => onOpenAbsenteismoModal(item.cpf, item.nome)}
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: "8px",
                                bgcolor: "#3b82f6",
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              {pageAbsenteismo * itemsPerPage + index + 1}
                            </Box>
                            <Box flex={1}>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                sx={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {item.nome}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Absenteísmo: {item.indice}%
                              </Typography>
                            </Box>
                          </Box>
                          <Chip
                            label={`${item.ausencias} ${item.ausencias === 1 ? "ausência" : "ausências"}`}
                            size="small"
                            sx={{
                              bgcolor: "#3b82f6",
                              color: "white",
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                      </Paper>
                    ))}
                </Box>
                {indicadoresEscalas.absenteismo.length > itemsPerPage && (
                  <PaginationControls
                    currentPage={pageAbsenteismo}
                    setPage={setPageAbsenteismo}
                    totalItems={indicadoresEscalas.absenteismo.length}
                    itemsPerPage={itemsPerPage}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default ScheduleIndicatorsSection;
