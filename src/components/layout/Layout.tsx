import React, { useState } from "react";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useMediaQuery,
  useTheme,
  Chip,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Description,
  Logout,
  Handshake,
  Person,
  Brightness4,
  Brightness7,
  ChevronLeft,
  ChevronRight,
  Inventory,
  MedicalServices,
  Psychology,
  CorporateFare,
} from "@mui/icons-material";
import { useAuth } from "../../contexts/AuthContext";
import { useThemeMode } from "../../contexts/ThemeContext";
import { useNavigate, useLocation } from "react-router-dom";

const drawerWidth = 280;
const collapsedDrawerWidth = 72;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved === "true";
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { userProfile, signOut, isAdminAgir, isAdminAgirCorporativo } =
    useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const handleSidebarToggle = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", String(newState));
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const menuItems = [
    {
      text: "Dashboard",
      icon: <Dashboard />,
      path: "/dashboard",
      adminOnly: false,
    },
    {
      text: "Insights da IA",
      icon: <Psychology />,
      path: "/insights-ia",
      adminOnly: true,
    },
    { text: "Usuários", icon: <People />, path: "/usuarios", adminOnly: true },
    {
      text: "Unidades Hospitalares",
      icon: <CorporateFare />,
      path: "/unidades",
      adminOnly: true,
      corporativoOnly: true,
    },
    {
      text: "Parceiros",
      icon: <Handshake />,
      path: "/parceiros",
      adminOnly: true,
    },
    {
      text: "Contratos",
      icon: <Description />,
      path: "/contratos",
      adminOnly: true,
    },
    {
      text: "Itens de Contrato",
      icon: <MedicalServices />,
      path: "/itens",
      adminOnly: true,
    },
  ];

  const getRoleLabel = (tipo: string) => {
    const roles: Record<string, { label: string; color: any }> = {
      "administrador-agir-corporativo": {
        label: "Admin Corporativo",
        color: "primary",
      },
      "administrador-agir-planta": { label: "Admin Planta", color: "info" },
      "administrador-terceiro": { label: "Admin Terceiro", color: "secondary" },
      terceiro: { label: "Terceiro", color: "default" },
    };
    return roles[tipo] || { label: tipo, color: "default" };
  };

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          p: 3,
          background: "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1.5,
          color: "white",
        }}
      >
        {!sidebarCollapsed && (
          <>
            <Handshake sx={{ fontSize: 40 }} />
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h6" fontWeight={700}>
                Parcer
                <span style={{ fontWeight: 900, color: "#fbbf24" }}>IA</span>
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Gestão Inteligente de Acessos e Parcerias
              </Typography>
            </Box>
          </>
        )}
        {sidebarCollapsed && <Handshake sx={{ fontSize: 32 }} />}
      </Box>

      <List sx={{ flex: 1, p: 2 }}>
        {menuItems.map((item) => {
          if (item.adminOnly && !isAdminAgir) return null;
          if ((item as any).corporativoOnly && !isAdminAgirCorporativo)
            return null;

          const isActive = location.pathname === item.path;

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  backgroundColor: isActive ? "primary.main" : "transparent",
                  color: isActive ? "white" : "text.primary",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  "&:hover": {
                    backgroundColor: isActive ? "primary.dark" : "action.hover",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? "white" : "inherit",
                    minWidth: sidebarCollapsed ? 0 : 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!sidebarCollapsed && <ListItemText primary={item.text} />}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      {!sidebarCollapsed && (
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: "background.default",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Avatar sx={{ bgcolor: "primary.main" }}>
              {userProfile?.nome.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap fontWeight={600}>
                {userProfile?.nome}
              </Typography>
              <Chip
                label={getRoleLabel(userProfile?.tipo || "").label}
                color={getRoleLabel(userProfile?.tipo || "").color}
                size="small"
                sx={{ mt: 0.5, height: 20, fontSize: "0.7rem" }}
              />
            </Box>
          </Box>
        </Box>
      )}

      {sidebarCollapsed && (
        <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
          <Avatar sx={{ bgcolor: "primary.main" }}>
            {userProfile?.nome.charAt(0).toUpperCase()}
          </Avatar>
        </Box>
      )}

      <Divider />

      <Box sx={{ p: 1, display: "flex", justifyContent: "center" }}>
        <IconButton
          onClick={handleSidebarToggle}
          size="small"
          sx={{
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          {sidebarCollapsed ? <ChevronRight /> : <ChevronLeft />}
        </IconButton>
      </Box>
    </Box>
  );

  const currentDrawerWidth = sidebarCollapsed
    ? collapsedDrawerWidth
    : drawerWidth;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          ml: { md: `${currentDrawerWidth}px` },
          bgcolor: "background.paper",
          color: "text.primary",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          borderBottom: "1px solid",
          borderColor: "divider",
          transition: "width 0.3s ease, margin-left 0.3s ease",
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1 }} />

          <IconButton
            onClick={toggleTheme}
            color="inherit"
            sx={{
              mr: 1,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            {mode === "dark" ? <Brightness7 /> : <Brightness4 />}
          </IconButton>

          <IconButton onClick={handleMenuOpen} sx={{ ml: 1 }}>
            <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36 }}>
              {userProfile?.nome.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
          >
            <MenuItem disabled>
              <ListItemIcon>
                <Person fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={userProfile?.nome}
                secondary={userProfile?.email}
              />
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              <ListItemText>Sair</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: currentDrawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: currentDrawerWidth,
              transition: "width 0.3s ease",
              overflowX: "hidden",
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          bgcolor: "background.default",
          minHeight: "100vh",
          transition: "width 0.3s ease",
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
