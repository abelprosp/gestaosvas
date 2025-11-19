import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/Dashboard/DashboardPage";
import { ClientsPage } from "./pages/Clients/ClientsPage";
import { ContractsPage } from "./pages/Contracts/ContractsPage";
import { TemplatesPage } from "./pages/Templates/TemplatesPage";
import { ServicesPage } from "./pages/Services/ServicesPage";
import { LoginPage } from "./pages/Auth/LoginPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { GuidePage } from "./pages/Guide/GuidePage";
import { AdminUsersPage } from "./pages/Admin/AdminUsersPage";
import { Outlet } from "react-router-dom";
import { UsersPage } from "./pages/Users/UsersPage";
import { CloudUsersPage } from "./pages/CloudUsers/CloudUsersPage";
import { HubUsersPage } from "./pages/CloudUsers/HubUsersPage";
import { TeleUsersPage } from "./pages/CloudUsers/TeleUsersPage";
import { ServiceReportsPage } from "./pages/Reports/ServiceReportsPage";
import { ProfilePage } from "./pages/Profile/ProfilePage";

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/contratos" element={<ContractsPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/servicos" element={<ServicesPage />} />
        <Route path="/usuarios" element={<UsersPage />} />
        <Route path="/usuarios-cloud" element={<CloudUsersPage />} />
        <Route path="/usuarios-hub" element={<HubUsersPage />} />
        <Route path="/usuarios-tele" element={<TeleUsersPage />} />
        <Route path="/guia" element={<GuidePage />} />
        <Route path="/admin/usuarios" element={<AdminUsersPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/relatorios/servicos" element={<ServiceReportsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
