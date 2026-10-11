import { HashRouter, Routes, Route, NavLink, Link, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import RequireRole from "./components/RequireRole";
import Home from "./pages/Home";
import AuthPage from "./pages/AuthPage";
import TeacherQuestionBank from "./pages/TeacherQuestionBank";
import StudentTest from "./pages/StudentTest";
import StudentReport from "./pages/StudentReport";
import TeacherDashboard from "./pages/TeacherDashboard";
function Navbar() {
  const { session, profile, signOut } = useAuth();
  return (
    <nav className="nav">
      <Link to="/" className="brand">MathGenius</Link>
      {profile?.role === "teacher" && (
  <>
    <NavLink to="/teacher" end>Ngân hàng câu hỏi</NavLink>
    <NavLink to="/teacher/dashboard">Tổng quan lớp</NavLink>
  </>
)}
      {profile?.role === "student" && (
  <>
    <NavLink to="/student" end>Làm bài</NavLink>
    <NavLink to="/student/report">Báo cáo</NavLink>
  </>
)}
      <span className="spacer" />
      {session ? (
        <>
          <span className="muted">{profile?.full_name}</span>
          <button className="ghost" onClick={signOut}>Đăng xuất</button>
        </>
      ) : (
        <>
          <NavLink to="/login">Đăng nhập</NavLink>
          <NavLink to="/register">Đăng ký</NavLink>
        </>
      )}
    </nav>
  );
}

function RoleRedirect() {
  const { session, profile, busy } = useAuth();
  if (busy) return <p className="page muted">Đang tải...</p>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <p className="page error">Không tìm thấy hồ sơ tài khoản.</p>;
  return <Navigate to={profile.role === "teacher" ? "/teacher" : "/student"} replace />;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/app" element={<RoleRedirect />} />
          <Route path="/teacher" element={<RequireRole role="teacher"><TeacherQuestionBank /></RequireRole>} />
          <Route path="/teacher/dashboard" element={<RequireRole role="teacher"><TeacherDashboard /></RequireRole>} />
          <Route path="/student" element={<RequireRole role="student"><StudentTest /></RequireRole>} />
          <Route path="/student/report" element={<RequireRole role="student"><StudentReport /></RequireRole>} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}