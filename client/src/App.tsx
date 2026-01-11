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
import { TicketsPage } from "./pages/TicketsPage";
import { WorkOrderPage } from "./pages/WorkOrderPage";

const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/" element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="orders/history" element={<OrdersHistoryPage />} />
        <Route path="tickets" element={<TicketsPage />} />
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
