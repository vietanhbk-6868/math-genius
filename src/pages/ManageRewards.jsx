import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../AuthContext";

const STATUS = {
  pending: ["mid", "Chờ phát"],
  delivered: ["high", "Đã phát"],
  cancelled: ["low", "Đã hủy"],
};
const fmtDate = (d) => new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function ManageRewards() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [reds, setReds] = useState([]);
  const [students, setStudents] = useState({});
  const [rewards, setRewards] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", cost: 50, stock: 10 });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [r, p, w] = await Promise.all([
      supabase.from("redemptions").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("id, full_name, class_name").eq("role", "student"),
      isAdmin
        ? supabase.from("rewards").select("*").order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    const err = r.error || p.error || w.error;
    if (err) return setError(err.message);
    setReds(r.data);
    setStudents(Object.fromEntries(p.data.map((s) => [s.id, s])));
    setRewards(w.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  function flash(t) {
    setMsg(t);
    setError("");
    setTimeout(() => setMsg(""), 3000);
  }

  const pending = useMemo(() => reds.filter((x) => x.status === "pending"), [reds]);
  const history = useMemo(() => reds.filter((x) => x.status !== "pending"), [reds]);

  async function handle(r, status) {
    const text =
      status === "delivered"
        ? `Xác nhận đã phát "${r.reward_name}" cho học sinh?`
        : `Hủy yêu cầu và hoàn ${r.cost} xu cho học sinh?`;
    if (!window.confirm(text)) return;
    const { error } = await supabase.rpc("handle_redemption", { p_id: r.id, p_status: status });
    if (error) return setError(error.message);
    flash("Đã cập nhật.");
    load();
  }

  async function addReward(e) {
    e.preventDefault();
    const { error } = await supabase.from("rewards").insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      cost: Number(form.cost),
      stock: Number(form.stock),
    });
    if (error) return setError(error.message);
    setForm({ name: "", description: "", cost: 50, stock: 10 });
    flash("Đã thêm quà.");
    load();
  }

  async function editReward(r) {
    const c = window.prompt(`Giá (xu) của "${r.name}":`, r.cost);
    if (c === null) return;
    const s = window.prompt("Số lượng còn lại:", r.stock);
    if (s === null) return;
    const cost = Number(c), stock = Number(s);
    if (!(cost >= 1) || !(stock >= 0)) return setError("Giá phải từ 1 xu và số lượng không âm.");
    const { error } = await supabase.from("rewards").update({ cost, stock }).eq("id", r.id);
    if (error) return setError(error.message);
    flash("Đã cập nhật.");
    load();
  }

  async function toggleReward(r) {
    const { error } = await supabase.from("rewards").update({ active: !r.active }).eq("id", r.id);
    if (error) return setError(error.message);
    load();
  }

  async function removeReward(r) {
    if (!window.confirm(`Xóa quà "${r.name}"? Lịch sử đổi quà vẫn được giữ.`)) return;
    const { error } = await supabase.from("rewards").delete().eq("id", r.id);
    if (error) return setError(error.message);
    flash("Đã xóa quà.");
    load();
  }

  const who = (id) => students[id] || { full_name: "(không rõ)", class_name: "" };

  return (
    <div className="page wide">
      <h1>Quà tặng</h1>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      <h2>Yêu cầu đổi quà đang chờ ({pending.length})</h2>
      <div className="card tablewrap">
        <table className="tbl">
          <thead>
            <tr><th>Học sinh</th><th>Lớp</th><th>Quà</th><th>Xu</th><th>Ngày đổi</th><th></th></tr>
          </thead>
          <tbody>
            {pending.length === 0 && (
              <tr><td colSpan="6" className="muted">Không có yêu cầu nào đang chờ.</td></tr>
            )}
            {pending.map((r) => (
              <tr key={r.id}>
                <td>{who(r.student_id).full_name}</td>
                <td>{who(r.student_id).class_name}</td>
                <td>{r.reward_name}</td>
                <td>{r.cost}</td>
                <td>{fmtDate(r.created_at)}</td>
                <td>
                  <div className="row">
                    <button onClick={() => handle(r, "delivered")}>Đã phát</button>
                    <button className="ghost" onClick={() => handle(r, "cancelled")}>Hủy, hoàn xu</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Đã xử lý gần đây</h2>
      <div className="card tablewrap">
        <table className="tbl">
          <thead>
            <tr><th>Học sinh</th><th>Lớp</th><th>Quà</th><th>Ngày đổi</th><th>Trạng thái</th></tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr><td colSpan="5" className="muted">Chưa có.</td></tr>
            )}
            {history.map((r) => (
              <tr key={r.id}>
                <td>{who(r.student_id).full_name}</td>
                <td>{who(r.student_id).class_name}</td>
                <td>{r.reward_name}</td>
                <td>{fmtDate(r.created_at)}</td>
                <td><span className={`badge ${STATUS[r.status][0]}`}>{STATUS[r.status][1]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <>
          <h2>Danh mục quà (quản trị viên)</h2>
          <form className="card form" onSubmit={addReward}>
            <label className="grow">
              Tên quà
              <input required placeholder="Ví dụ: Bút bi xanh" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="grow">
              Mô tả
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label>
              Giá (xu)
              <input type="number" min="1" value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </label>
            <label>
              Số lượng
              <input type="number" min="0" value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </label>
            <button type="submit">Thêm quà</button>
          </form>

          <div className="card tablewrap">
            <table className="tbl">
              <thead>
                <tr><th>Quà</th><th>Giá</th><th>Còn lại</th><th>Trạng thái</th><th></th></tr>
              </thead>
              <tbody>
                {rewards.length === 0 && (
                  <tr><td colSpan="5" className="muted">Chưa có quà nào.</td></tr>
                )}
                {rewards.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.name}</b><br /><span className="muted small">{r.description}</span></td>
                    <td>{r.cost} xu</td>
                    <td>{r.stock}</td>
                    <td>{r.active ? <span className="badge high">Đang bán</span> : <span className="badge none">Đang ẩn</span>}</td>
                    <td>
                      <div className="row">
                        <button className="ghost" onClick={() => editReward(r)}>Sửa giá, số lượng</button>
                        <button className="ghost" onClick={() => toggleReward(r)}>{r.active ? "Ẩn" : "Hiện"}</button>
                        <button className="ghost" onClick={() => removeReward(r)}>Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}