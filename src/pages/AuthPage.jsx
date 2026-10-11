import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { supabase } from "../supabase";
function viMessage(msg) {
  if (msg.includes("Invalid login credentials")) return "Sai email hoặc mật khẩu.";
  if (msg.includes("already registered")) return "Email này đã được đăng ký.";
  if (msg.includes("at least 6")) return "Mật khẩu cần tối thiểu 6 ký tự.";
  if (msg.includes("Database error saving new user")) return "Mã giáo viên hoặc lớp không hợp lệ.";
  return msg;
}

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ fullName: "", email: "", password: "", role: "student", teacherCode: "", classroom: "" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [classes, setClasses] = useState([]);

useEffect(() => {
  if (!isRegister) return;
  supabase
    .from("classes")
    .select("name")
    .order("name")
    .then(({ data }) => setClasses((data || []).map((c) => c.name)));
}, [isRegister]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    const res = isRegister
  ? await signUp({
      ...f,
      teacherCode: f.role === "teacher" ? f.teacherCode.trim() : "",
      classroom: f.role === "student" ? f.classroom.trim() : "",
    })
  : await signIn(f.email, f.password);
    setBusy(false);
    if (res.error) return setError(viMessage(res.error.message));
    if (isRegister && !res.data.session) {
      return setInfo("Đăng ký thành công. Hãy kiểm tra email để xác nhận rồi đăng nhập.");
    }
    navigate("/app");
  }

  return (
    <div className="page narrow">
      <h1>{isRegister ? "Đăng ký tài khoản" : "Đăng nhập"}</h1>
      <form className="card stack" onSubmit={submit}>
        {isRegister && (
          <>
            <label>
              Họ và tên
              <input
                required
                placeholder="Ví dụ: Nguyễn Văn An"
                value={f.fullName}
                onChange={(e) => setF({ ...f, fullName: e.target.value })}
              />
            </label>
            <div className="roles">
              <label className={`choice ${f.role === "student" ? "picked" : ""}`}>
                <input type="radio" checked={f.role === "student"} onChange={() => setF({ ...f, role: "student" })} />
                Học sinh
              </label>
              <label className={`choice ${f.role === "teacher" ? "picked" : ""}`}>
                <input type="radio" checked={f.role === "teacher"} onChange={() => setF({ ...f, role: "teacher" })} />
                Giáo viên
              </label>
            </div>
            {f.role === "student" && (
  <label>
    Lớp
    <select
      required
      value={f.classroom}
      onChange={(e) => setF({ ...f, classroom: e.target.value })}
    >
      <option value="" disabled>{classes.length ? "Chọn lớp" : "Chưa có lớp nào"}</option>
      {classes.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
    {classes.length === 0 && (
      <span className="muted small">Hãy liên hệ quản trị viên để thêm lớp.</span>
    )}
  </label>
)}
            {f.role === "teacher" && (
              <label>
                Mã giáo viên
                <input
                  required
                  value={f.teacherCode}
                  onChange={(e) => setF({ ...f, teacherCode: e.target.value })}
                />
              </label>
            )}
          </>
        )}
        <label>
          Email
          <input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            required
            minLength={6}
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
          />
        </label>
        {error && <p className="error">{error}</p>}
        {info && <p className="ok">{info}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Đang xử lý..." : isRegister ? "Đăng ký" : "Đăng nhập"}
        </button>
        <p className="muted">
          {isRegister ? (
            <>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></>
          ) : (
            <>Chưa có tài khoản? <Link to="/register">Đăng ký</Link></>
          )}
        </p>
      </form>
    </div>
  );
}