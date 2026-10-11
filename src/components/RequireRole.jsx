import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function RequireRole({ role, children }) {
  const { session, profile, busy } = useAuth();
  if (busy) return <p className="page muted">Đang tải...</p>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile)
    return <p className="page error">Không tìm thấy hồ sơ tài khoản. Hãy đăng xuất và đăng ký lại.</p>;
  if (profile.role !== role) return <Navigate to="/app" replace />;
  return children;
}