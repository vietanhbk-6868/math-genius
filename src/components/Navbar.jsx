import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { supabase } from "../supabase";

export default function Navbar() {
  const { session, profile, signOut } = useAuth();
  const location = useLocation();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");
  const uid = session?.user?.id;
  const role = profile?.role;
  const staff = role === "teacher" || role === "admin";

  // Đổi trang thì đóng menu
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Bấm ra ngoài thì đóng menu
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // Học sinh đăng nhập lần đầu trong ngày thì tự được điểm danh nhận xu
  useEffect(() => {
    if (!uid || role !== "student") return;
    supabase.rpc("claim_daily_checkin").then(({ data }) => {
      if (data?.claimed) {
        setToast(`Điểm danh thành công: +${data.coins} xu (chuỗi ${data.streak} ngày liên tiếp)`);
        setTimeout(() => setToast(""), 6000);
      }
    });
  }, [uid, role]);

  return (
    <>
      <nav className="nav" ref={ref}>
        <Link to="/" className="brand">MathGenius</Link>

        <button
          type="button"
          className="burger"
          aria-label={open ? "Đóng menu" : "Mở menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "✕" : "☰"}
        </button>

        <div className={`navlinks ${open ? "open" : ""}`}>
          {staff && (
            <>
              <NavLink to="/teacher" end>Câu hỏi</NavLink>
              <NavLink to="/teacher/dashboard">Tổng quan</NavLink>
              <NavLink to="/teacher/assignments">Giao bài</NavLink>
              <NavLink to="/teacher/grades">Bảng điểm</NavLink>
              <NavLink to="/teacher/accounts">Tài khoản</NavLink>
              <NavLink to="/teacher/leaderboard">Xếp hạng</NavLink>
              <NavLink to="/teacher/rewards">Quà tặng</NavLink>
            </>
          )}
          {role === "admin" && <NavLink to="/admin">Quản trị</NavLink>}

          {role === "student" && (
            <>
              <NavLink to="/student" end>Làm bài</NavLink>
              <NavLink to="/student/assignments">Bài tập</NavLink>
              <NavLink to="/student/ai">Luyện AI</NavLink>
              <NavLink to="/student/report">Báo cáo</NavLink>
              <NavLink to="/student/leaderboard">Xếp hạng</NavLink>
              <NavLink to="/student/rewards">Quà và xu</NavLink>
            </>
          )}

          <span className="spacer" />
          {session ? (
            <>
              <span className="muted">
                {profile?.full_name}{profile?.class_name ? ` · ${profile.class_name}` : ""}
              </span>
              <NavLink to="/change-password">Đổi mật khẩu</NavLink>
              <button className="ghost" onClick={signOut}>Đăng xuất</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Đăng nhập</NavLink>
              <NavLink to="/register">Đăng ký</NavLink>
            </>
          )}
        </div>
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}