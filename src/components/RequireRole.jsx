import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function RequireRole({ role, children }) {
  const { session, profile, busy } = useAuth();
  const location = useLocation();
  const allowed = Array.isArray(role) ? role : [role];
  if (busy) return <p className="page muted">Đang tải...</p>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile)
    return <p className="page error">Không tìm thấy hồ sơ tài khoản. Hãy đăng xuất và đăng ký lại.</p>;
  if (profile.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  if (!allowed.includes(profile.role)) return <Navigate to="/app" replace />;
  return children;
}