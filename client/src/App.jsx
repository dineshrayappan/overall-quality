import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/common/Layout.jsx';
import { FirstTimeSetupPage, LoginPage } from './pages/AuthPages.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import TargetChartPage from './pages/TargetChartPage.jsx';
import SizeSetPage from './pages/SizeSetPage.jsx';
import SevenPointPage from './pages/SevenPointPage.jsx';
import MeasurementPage from './pages/MeasurementPage.jsx';
import ShrinkagePage from './pages/ShrinkagePage.jsx';
import FourPointPage from './pages/FourPointPage.jsx';
import AccessoriesPage from './pages/AccessoriesPage.jsx';
import SpecificationPage from './pages/SpecificationPage.jsx';
import MasterDataPage from './pages/MasterDataPage.jsx';
import ExcelExportPage from './pages/ExcelExportPage.jsx';
import ConfigurationPage from './pages/ConfigurationPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import AuditLogsPage from './pages/AuditLogsPage.jsx';

function ProtectedRoute({ section, action = 'view', children }) {
  const { hasPerm } = useAuth();
  if (section && !hasPerm(section, action)) {
    return (
      <div className="card">
        <h2 className="card-title">Access Denied</h2>
        <p className="muted">You do not have permission to access this module.</p>
      </div>
    );
  }
  return children;
}

function AppRoutes() {
  const { user, needsSetup, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minBlockSize: '100dvh' }}>
        <p className="muted">Loading Digital Garment QMS...</p>
      </div>
    );
  }

  if (needsSetup) {
    return <FirstTimeSetupPage />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          path="/"
          element={
            <ProtectedRoute section="dashboard">
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/target-charts"
          element={
            <ProtectedRoute section="targetChart">
              <TargetChartPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/target-charts/:id"
          element={
            <ProtectedRoute section="targetChart">
              <TargetChartPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/size-sets"
          element={
            <ProtectedRoute section="sizeSet">
              <SizeSetPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/size-sets/:id"
          element={
            <ProtectedRoute section="sizeSet">
              <SizeSetPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/seven-points"
          element={
            <ProtectedRoute section="sevenPoint">
              <SevenPointPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/seven-points/:id"
          element={
            <ProtectedRoute section="sevenPoint">
              <SevenPointPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/measurements"
          element={
            <ProtectedRoute section="measurement">
              <MeasurementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/measurements/:id"
          element={
            <ProtectedRoute section="measurement">
              <MeasurementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/shrinkage"
          element={
            <ProtectedRoute section="shrinkage">
              <ShrinkagePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/shrinkage/:id"
          element={
            <ProtectedRoute section="shrinkage">
              <ShrinkagePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/four-point"
          element={
            <ProtectedRoute section="fourPoint">
              <FourPointPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/four-point/:id"
          element={
            <ProtectedRoute section="fourPoint">
              <FourPointPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/accessories"
          element={
            <ProtectedRoute section="accessories">
              <AccessoriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections/accessories/:id"
          element={
            <ProtectedRoute section="accessories">
              <AccessoriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/specifications"
          element={
            <ProtectedRoute section="specifications">
              <SpecificationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/export"
          element={
            <ProtectedRoute section="exports" action="excel">
              <ExcelExportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/masters"
          element={
            <ProtectedRoute section="masterData">
              <MasterDataPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/configuration"
          element={
            <ProtectedRoute section="configuration">
              <ConfigurationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute section="users">
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute section="auditLogs">
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

