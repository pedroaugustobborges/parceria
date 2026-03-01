/**
 * Dashboard Feature Index
 *
 * Public exports for the Dashboard feature.
 */

// Types
export * from './types/dashboard.types';

// Utils
export * from './utils';

// Hooks
export * from './hooks';

// Services
export * from './services/dashboardService';

// Components - Dialogs
export * from './components/dialogs';

// Components - Filters
export { DashboardFilters } from './components/filters/DashboardFilters';

// Components - Tables
export { createHorasColumns } from './components/tables/horasColumns';

// Components - Header
export { DashboardHeader } from './components/header/DashboardHeader';
export type { DashboardHeaderProps } from './components/header/DashboardHeader';

// Components - Scorecards
export { DashboardScorecards } from './components/scorecards/DashboardScorecards';
export type { DashboardScorecardsProps, DashboardMetrics } from './components/scorecards/DashboardScorecards';

// Main Page
export { DashboardPage } from './components/DashboardPage';
export { default as DashboardPageDefault } from './components/DashboardPage';
