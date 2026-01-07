import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getToken } from "../auth/token";

export const ProtectedRoute = () => {
  const token = getToken();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};
