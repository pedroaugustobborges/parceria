/**
 * InconsistenciesSection Component
 *
 * Displays productivity without access and access without productivity inconsistencies.
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
  Warning,
  AccessTime,
  FilterList,
  ArrowBackIos,
  ArrowForwardIos,
} from '@mui/icons-material';
import type { InconsistenciaItem } from '../../types/dashboard.types';

export interface InconsistenciesSectionProps {
  inconsistencias: {
    prodSemAcesso: InconsistenciaItem[];
    acessoSemProd: InconsistenciaItem[];
  };
  pageProdSemAcesso: number;
  setPageProdSemAcesso: (page: number) => void;
  pageAcessoSemProd: number;
  setPageAcessoSemProd: (page: number) => void;
  itemsPerPage: number;
  onOpenInconsistenciaModal: (
    nome: string,
    tipo: 'prodSemAcesso' | 'acessoSemProd',
    datas: string[]
  ) => void;
  filtroNome: string[];
  filtroDataInicio: Date | null;
  filtroDataFim: Date | null;
}

export const InconsistenciesSection: React.FC<InconsistenciesSectionProps> = ({
  inconsistencias,
  pageProdSemAcesso,
  setPageProdSemAcesso,
  pageAcessoSemProd,
  setPageAcessoSemProd,
  itemsPerPage,
  onOpenInconsistenciaModal,
  filtroNome,
  filtroDataInicio,
  filtroDataFim,
}) => {
  const theme = useTheme();
  const hasActiveFilters = filtroNome.length > 0 || filtroDataInicio || filtroDataFim;

  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      {/* Produtividade sem Acesso */}
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
                <Warning sx={{ color: "white", fontSize: 28 }} />
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  color={theme.palette.mode === 'dark' ? "#93c5fd" : "#1e40af"}
                >
                  Produtividade sem Acesso
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Registros de produção sem entrada/saída
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

            {inconsistencias.prodSemAcesso.length === 0 ? (
              <Box
                sx={{
                  textAlign: "center",
                  py: 4,
                  opacity: 0.6,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Nenhuma inconsistência encontrada
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                  {inconsistencias.prodSemAcesso
                    .slice(
                      pageProdSemAcesso * itemsPerPage,
                      pageProdSemAcesso * itemsPerPage + itemsPerPage
                    )
                    .map((item, index) => (
                      <Paper
                        key={index}
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
                        onClick={() =>
                          onOpenInconsistenciaModal(
                            item.nome,
                            "prodSemAcesso",
                            item.datas
                          )
                        }
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1.5}
                          >
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
                              {pageProdSemAcesso * itemsPerPage + index + 1}
                            </Box>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{
                                maxWidth: 200,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.nome}
                            </Typography>
                          </Box>
                          <Chip
                            label={`${item.count} ${item.count === 1 ? "dia" : "dias"}`}
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
                {inconsistencias.prodSemAcesso.length > itemsPerPage && (
                  <PaginationControls
                    currentPage={pageProdSemAcesso}
                    setPage={setPageProdSemAcesso}
                    totalItems={inconsistencias.prodSemAcesso.length}
                    itemsPerPage={itemsPerPage}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Acesso sem Produtividade */}
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
                <AccessTime sx={{ color: "white", fontSize: 28 }} />
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  color={theme.palette.mode === 'dark' ? "#93c5fd" : "#1e40af"}
                >
                  Acesso sem Produtividade
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Entrada/saída sem registro de produção
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

            {inconsistencias.acessoSemProd.length === 0 ? (
              <Box
                sx={{
                  textAlign: "center",
                  py: 4,
                  opacity: 0.6,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Nenhuma inconsistência encontrada
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                  {inconsistencias.acessoSemProd
                    .slice(
                      pageAcessoSemProd * itemsPerPage,
                      pageAcessoSemProd * itemsPerPage + itemsPerPage
                    )
                    .map((item, index) => (
                      <Paper
                        key={index}
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
                        onClick={() =>
                          onOpenInconsistenciaModal(
                            item.nome,
                            "acessoSemProd",
                            item.datas
                          )
                        }
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1.5}
                          >
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
                              {pageAcessoSemProd * itemsPerPage + index + 1}
                            </Box>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{
                                maxWidth: 200,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.nome}
                            </Typography>
                          </Box>
                          <Chip
                            label={`${item.count} ${item.count === 1 ? "dia" : "dias"}`}
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
                {inconsistencias.acessoSemProd.length > itemsPerPage && (
                  <PaginationControls
                    currentPage={pageAcessoSemProd}
                    setPage={setPageAcessoSemProd}
                    totalItems={inconsistencias.acessoSemProd.length}
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

export default InconsistenciesSection;
