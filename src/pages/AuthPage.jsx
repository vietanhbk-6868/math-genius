import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { supabase } from "../supabase";
import { sortClassNames } from "../sortClasses";
function viMessage(msg) {
  if (msg.includes("Invalid login credentials"))
    return "Sai tên tài khoản hoặc mật khẩu.";
  if (msg.includes("at least 6")) return "Mật khẩu cần tối thiểu 6 ký tự.";
  return msg;
}

const cleanName = (v) => v.toLowerCase().replace(/\s/g, "");

function PasswordInput({ value, onChange, show, onToggle, autoComplete }) {
  return (
    <div className="pw">
      <input
        type={show ? "text" : "password"}
        required
        minLength={6}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        className="eye"
        onClick={onToggle}
        aria-label="Hiện hoặc ẩn mật khẩu"
      >
        {show ? "Ẩn" : "Hiện"}
      </button>
    </div>
  );
}

export default function AuthPage({ mode }) {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(mode === "register");
  const [f, setF] = useState({
    fullName: "",
    username: "",
    password: "",
    role: "student",
    teacherCode: "",
    classroom: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [classes, setClasses] = useState([]);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    setIsRegister(mode === "register");
    setError("");
  }, [mode]);

  useEffect(() => {
    supabase
      .from("classes")
      .select("name")
      .order("name")
      .then(({ data }) => setClasses(sortClassNames((data || []).map((c) => c.name))));
  }, []);

  function flip(toRegister) {
    setIsRegister(toRegister);
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = isRegister
      ? await signUp({
          ...f,
          teacherCode: f.role === "teacher" ? f.teacherCode.trim() : "",
          classroom: f.role === "student" ? f.classroom : "",
        })
      : await signIn(f.username, f.password);
    setBusy(false);
    if (res.error) return setError(viMessage(res.error.message));
    navigate("/app");
  }

  return (
    <div className="auth-bg">
      <div className="neon">
        <div className={`flip ${isRegister ? "is-register" : ""}`}>
          <div className="flip-inner">
            {/* Mặt đăng nhập */}
            <form className="face front" onSubmit={submit}>
              <h2 className="neon-title">CHÀO MỪNG</h2>
              <p className="auth-sub">Đăng nhập vào tài khoản của bạn</p>
              <label>
                Tên tài khoản
                <input
                  required
                  autoComplete="username"
                  placeholder="Ví dụ: nguyenvanan"
                  value={f.username}
                  onChange={(e) =>
                    setF({ ...f, username: cleanName(e.target.value) })
                  }
                />
              </label>
              <label>
                Mật khẩu
                <PasswordInput
                  autoComplete="current-password"
                  value={f.password}
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                  show={showPw}
                  onToggle={() => setShowPw(!showPw)}
                />
              </label>
              {!isRegister && error && <p className="error">{error}</p>}
              <button type="submit" className="neon-btn" disabled={busy}>
                {busy ? "Đang xử lý..." : "Đăng nhập"}
              </button>
              <p className="auth-switch">
                Chưa có tài khoản?{" "}
                <button
                  type="button"
                  className="linkbtn"
                  onClick={() => flip(true)}
                >
                  Đăng ký
                </button>
              </p>
              <p className="muted small" style={{ textAlign: "center" }}>
                Quên mật khẩu? Hãy nhờ giáo viên đặt lại cho bạn.
              </p>
            </form>

            {/* Mặt đăng ký */}
            <form className="face back" onSubmit={submit}>
              <h2 className="neon-title">TẠO TÀI KHOẢN</h2>
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
                <label
                  className={`choice ${f.role === "student" ? "picked" : ""}`}
                >
                  <input
                    type="radio"
                    checked={f.role === "student"}
                    onChange={() => setF({ ...f, role: "student" })}
                  />
                  Học sinh
                </label>
                <label
                  className={`choice ${f.role === "teacher" ? "picked" : ""}`}
                >
                  <input
                    type="radio"
                    checked={f.role === "teacher"}
                    onChange={() => setF({ ...f, role: "teacher" })}
                  />
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
                    <option value="" disabled>
                      {classes.length ? "Chọn lớp" : "Chưa có lớp nào"}
                    </option>
                    {classes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {classes.length === 0 && (
                    <span className="muted small">
                      Hãy liên hệ quản trị viên để thêm lớp.
                    </span>
                  )}
                </label>
              )}
              {f.role === "teacher" && (
                <label>
                  Mã giáo viên
                  <input
                    required
                    value={f.teacherCode}
                    onChange={(e) =>
                      setF({ ...f, teacherCode: e.target.value })
                    }
                  />
                </label>
              )}
              <label>
                Tên tài khoản
                <input
                  required
                  minLength={3}
                  maxLength={20}
                  pattern="[a-z0-9._]{3,20}"
                  title="3 đến 20 ký tự: chữ thường không dấu, số, dấu chấm hoặc gạch dưới"
                  autoComplete="username"
                  placeholder="Ví dụ: nguyenvanan"
                  value={f.username}
                  onChange={(e) =>
                    setF({ ...f, username: cleanName(e.target.value) })
                  }
                />
                <span className="muted small">
                  Chữ thường không dấu, số, dấu chấm hoặc gạch dưới (3 đến 20 ký
                  tự).
                </span>
              </label>
              <label>
                Mật khẩu
                <PasswordInput
                  autoComplete="new-password"
                  value={f.password}
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                  show={showPw}
                  onToggle={() => setShowPw(!showPw)}
                />
                <span className="muted small">
                  Tối thiểu 6 ký tự. Hãy ghi lại để không quên.
                </span>
              </label>
              {isRegister && error && <p className="error">{error}</p>}
              <button type="submit" className="neon-btn" disabled={busy}>
                {busy ? "Đang xử lý..." : "Đăng ký"}
              </button>
              <p className="auth-switch">
                Đã có tài khoản?{" "}
                <button
                  type="button"
                  className="linkbtn"
                  onClick={() => flip(false)}
                >
                  Đăng nhập
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
