import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Navbar from "./components/Navbar";
import RequireRole from "./components/RequireRole";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import AuthPage from "./pages/AuthPage";
import ChangePassword from "./pages/ChangePassword";
import TeacherQuestionBank from "./pages/TeacherQuestionBank";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherAssignments from "./pages/TeacherAssignments";
import TeacherGrades from "./pages/TeacherGrades";
import TeacherAccounts from "./pages/TeacherAccounts";
import ManageRewards from "./pages/ManageRewards";
import AdminPage from "./pages/AdminPage";
import StudentTest from "./pages/StudentTest";
import StudentReport from "./pages/StudentReport";
import StudentAIPractice from "./pages/StudentAIPractice";
import StudentAssignments from "./pages/StudentAssignments";
import StudentRewards from "./pages/StudentRewards";
import Leaderboard from "./pages/Leaderboard";

function RoleRedirect() {
  const { session, profile, busy } = useAuth();
  if (busy) return <p className="page muted">Đang tải...</p>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <p className="page error">Không tìm thấy hồ sơ tài khoản.</p>;
  return (
    <Navigate
      to={profile.role === "admin" ? "/admin" : profile.role === "teacher" ? "/teacher" : "/student"}
      replace
    />
  );
}

const STAFF = ["teacher", "admin"];

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Navbar />
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/app" element={<RoleRedirect />} />
            <Route path="/change-password" element={<RequireRole role={["student", "teacher", "admin"]}><ChangePassword /></RequireRole>} />

            <Route path="/student" element={<RequireRole role="student"><StudentTest /></RequireRole>} />
            <Route path="/student/report" element={<RequireRole role="student"><StudentReport /></RequireRole>} />
            <Route path="/student/ai" element={<RequireRole role="student"><StudentAIPractice /></RequireRole>} />
            <Route path="/student/assignments" element={<RequireRole role="student"><StudentAssignments /></RequireRole>} />
            <Route path="/student/leaderboard" element={<RequireRole role="student"><Leaderboard /></RequireRole>} />
            <Route path="/student/rewards" element={<RequireRole role="student"><StudentRewards /></RequireRole>} />

            <Route path="/teacher" element={<RequireRole role={STAFF}><TeacherQuestionBank /></RequireRole>} />
            <Route path="/teacher/dashboard" element={<RequireRole role={STAFF}><TeacherDashboard /></RequireRole>} />
            <Route path="/teacher/assignments" element={<RequireRole role={STAFF}><TeacherAssignments /></RequireRole>} />
            <Route path="/teacher/grades" element={<RequireRole role={STAFF}><TeacherGrades /></RequireRole>} />
            <Route path="/teacher/accounts" element={<RequireRole role={STAFF}><TeacherAccounts /></RequireRole>} />
            <Route path="/teacher/leaderboard" element={<RequireRole role={STAFF}><Leaderboard /></RequireRole>} />
            <Route path="/teacher/rewards" element={<RequireRole role={STAFF}><ManageRewards /></RequireRole>} />

            <Route path="/admin" element={<RequireRole role="admin"><AdminPage /></RequireRole>} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </HashRouter>
  );
}