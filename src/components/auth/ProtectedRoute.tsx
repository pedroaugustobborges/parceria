import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireAdminAgir?: boolean;
  requireAdminAgirCorporativo?: boolean;
  requireAdminAgirAny?: boolean; // corporativo OR planta
  allowEscalasAccess?: boolean;
  allowAllAuthenticated?: boolean;
  allowContratosAccess?: boolean; // Allows admins and administrador-terceiro (read-only for partners)
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requireAdminAgir = false,
  requireAdminAgirCorporativo = false,
  requireAdminAgirAny = false,
  allowEscalasAccess = false,
  allowAllAuthenticated = false,
  allowContratosAccess = false,
}) => {
  const { user, userProfile, loading, isAdmin, isAdminAgir, isAdminAgirCorporativo, isAdminTerceiro, isTerceiro } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)',
        }}
      >
        <CircularProgress sx={{ color: 'white' }} size={60} />
      </Box>
    );
  }

  if (!user || !userProfile) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdminAgirCorporativo && !isAdminAgirCorporativo) {
    return <Navigate to="/escalas" replace />;
  }

  if (requireAdminAgirAny && !isAdminAgir) {
    return <Navigate to="/escalas" replace />;
  }

  if (requireAdminAgir && !isAdminAgir) {
    return <Navigate to="/escalas" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/escalas" replace />;
  }

  // For Escalas Médicas: allow admin, admin-terceiro, and terceiro users
  if (allowEscalasAccess && !isAdminAgir && !isAdminTerceiro && !isTerceiro) {
    return <Navigate to="/dashboard" replace />;
  }

  // For Contratos: allow admins and administrador-terceiro (read-only)
  if (allowContratosAccess && !isAdminAgir && !isAdminTerceiro) {
    return <Navigate to="/escalas" replace />;
  }

  // Block administrador-terceiro from accessing pages except Escalas, Contratos, and allowed pages
  if (isAdminTerceiro && !allowEscalasAccess && !allowContratosAccess && !allowAllAuthenticated) {
    return <Navigate to="/escalas" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
