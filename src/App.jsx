import { HashRouter, Routes, Route, NavLink, Link, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import RequireRole from "./components/RequireRole";
import Home from "./pages/Home";
import AuthPage from "./pages/AuthPage";
import TeacherQuestionBank from "./pages/TeacherQuestionBank";
import StudentTest from "./pages/StudentTest";
import StudentReport from "./pages/StudentReport";
import TeacherDashboard from "./pages/TeacherDashboard";
import AdminPage from "./pages/AdminPage";
import StudentAIPractice from "./pages/StudentAIPractice";
import TeacherAssignments from "./pages/TeacherAssignments";
import TeacherGrades from "./pages/TeacherGrades";
import StudentAssignments from "./pages/StudentAssignments";
import TeacherAccounts from "./pages/TeacherAccounts";
import ChangePassword from "./pages/ChangePassword";
function Navbar() {
  const { session, profile, signOut } = useAuth();
  return (
    <nav className="nav">
      <Link to="/" className="brand">MathGenius</Link>
      {(profile?.role === "teacher" || profile?.role === "admin") && (
  <>
    <NavLink to="/teacher" end>Ngân hàng câu hỏi</NavLink>
    <NavLink to="/teacher/dashboard">Tổng quan lớp</NavLink>
    <NavLink to="/teacher/assignments">Giao bài</NavLink>
    <NavLink to="/teacher/grades">Bảng điểm</NavLink>
    <NavLink to="/teacher/accounts">Tạo tài khoản</NavLink>
  </>
)}
{profile?.role === "admin" && <NavLink to="/admin">Quản trị</NavLink>}
      {profile?.role === "student" && (
  <>
    <NavLink to="/student" end>Làm bài</NavLink>
    <NavLink to="/student/report">Báo cáo</NavLink>
    <NavLink to="/student/ai">Luyện với AI</NavLink>
    <NavLink to="/student/assignments">Bài tập</NavLink>
  </>
)}
      <span className="spacer" />
      {session ? (
        <>
          <span className="muted">{profile?.full_name}</span>
          <NavLink to="/change-password">Đổi mật khẩu</NavLink>
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
  return <Navigate to={profile.role === "admin" ? "/admin": profile.role === "teacher" ? "/teacher" : "/student"} replace />;
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
  <Route path="/student" element={<RequireRole role="student"><StudentTest /></RequireRole>} />
  <Route path="/student/report" element={<RequireRole role="student"><StudentReport /></RequireRole>} />
  <Route path="/student/ai" element={<RequireRole role="student"><StudentAIPractice /></RequireRole>} />
  <Route path="/teacher" element={<RequireRole role={["teacher", "admin"]}><TeacherQuestionBank /></RequireRole>} />
  <Route path="/teacher/dashboard" element={<RequireRole role={["teacher", "admin"]}><TeacherDashboard /></RequireRole>} />
  <Route path="/admin" element={<RequireRole role="admin"><AdminPage /></RequireRole>} />
  <Route path="/teacher/assignments" element={<RequireRole role={["teacher", "admin"]}><TeacherAssignments /></RequireRole>} />
<Route path="/teacher/grades" element={<RequireRole role={["teacher", "admin"]}><TeacherGrades /></RequireRole>} />
<Route path="/teacher/accounts" element={<RequireRole role={["teacher", "admin"]}><TeacherAccounts /></RequireRole>} />
<Route path="/change-password" element={<RequireRole role={["student", "teacher", "admin"]}><ChangePassword /></RequireRole>} />
<Route path="/student/assignments" element={<RequireRole role="student"><StudentAssignments /></RequireRole>} />
</Routes>
      </AuthProvider>
    </HashRouter>
  );
}