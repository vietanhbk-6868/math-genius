import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useAuth } from "../AuthContext";

export default function ChangePassword() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (pw.length < 6) return setError("Mật khẩu cần tối thiểu 6 ký tự.");
    if (pw !== pw2) return setError("Hai mật khẩu chưa giống nhau.");
    setBusy(true);
    setError("");
    const { error: e1 } = await supabase.auth.updateUser({ password: pw });
    if (e1) {
      setBusy(false);
      return setError(
        e1.message.includes("different from the old")
          ? "Mật khẩu mới phải khác mật khẩu hiện tại."
          : e1.message
      );
    }
    await supabase.rpc("clear_must_change_password");
    await refreshProfile();
    setBusy(false);
    navigate("/app");
  }

  return (
    <div className="page" style={{ maxWidth: 460 }}>
      <h1>Đổi mật khẩu</h1>
      {profile?.must_change_password && (
        <p className="notice">
          Đây là lần đăng nhập đầu tiên. Hãy đặt mật khẩu riêng của bạn để người khác không đăng nhập thay được.
        </p>
      )}
      <form className="card stack" onSubmit={submit}>
        <label>
          Mật khẩu mới
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label>
          Nhập lại mật khẩu mới
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Đang lưu..." : "Lưu mật khẩu"}</button>
      </form>
    </div>
  );
}