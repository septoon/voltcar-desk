import { Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ClientSearchPage } from "./pages/ClientSearchPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { OrdersHistoryPage } from "./pages/OrdersHistoryPage";
import { RevenuePage } from "./pages/RevenuePage";
import { ServicesPage } from "./pages/ServicesPage";
import { CompaniesPage } from "./pages/CompaniesPage";
import { WorkOrderPage } from "./pages/WorkOrderPage";
import { PendingPaymentsPage } from "./pages/PendingPaymentsPage";

const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/" element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="orders/history" element={<OrdersHistoryPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="pending-payments" element={<PendingPaymentsPage />} />
        <Route path="clients/search" element={<ClientSearchPage />} />
        <Route path="reports/revenue" element={<RevenuePage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="orders/:id" element={<WorkOrderPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
