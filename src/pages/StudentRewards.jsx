import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const dayKey = (d) => d.toLocaleDateString("sv-SE"); // dạng YYYY-MM-DD theo giờ máy
const REASON = { checkin: "Điểm danh", redeem: "Đổi quà", refund: "Hoàn xu", adjust: "Điều chỉnh" };
const STATUS = {
  pending: ["mid", "Chờ nhận quà"],
  delivered: ["high", "Đã nhận"],
  cancelled: ["low", "Đã hủy, hoàn xu"],
};
const fmtDate = (d) => new Date(d).toLocaleDateString("vi-VN");

export default function StudentRewards() {
  const [coins, setCoins] = useState(0);
  const [ledger, setLedger] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const [c, l, k, r, d] = await Promise.all([
      supabase.rpc("my_coins"),
      supabase
        .from("coin_ledger")
        .select("id, amount, reason, note, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("daily_checkins").select("day, streak, coins").order("day", { ascending: false }).limit(14),
      supabase.from("rewards").select("*").eq("active", true).order("cost"),
      supabase.from("redemptions").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    const err = c.error || l.error || k.error || r.error || d.error;
    if (err) return setError(err.message);
    setCoins(c.data ?? 0);
    setLedger(l.data);
    setCheckins(k.data);
    setRewards(r.data);
    setRedemptions(d.data);
    setLoaded(true);
  }

  useEffect(() => {
    load();
    // Tải lại sau một chút phòng khi vừa đăng nhập và điểm danh đang chạy
    const t = setTimeout(load, 1500);
    return () => clearTimeout(t);
  }, []);

  const week = useMemo(() => {
    const done = new Set(checkins.map((c) => c.day));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = dayKey(d);
      return {
        key,
        label: i === 6 ? "Hôm nay" : d.toLocaleDateString("vi-VN", { weekday: "short" }),
        done: done.has(key),
        today: i === 6,
      };
    });
  }, [checkins]);

  const streak = (() => {
    const last = checkins[0];
    if (!last) return 0;
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return last.day === dayKey(new Date()) || last.day === dayKey(y) ? last.streak : 0;
  })();

  async function redeem(r) {
    if (!window.confirm(`Đổi "${r.name}" với ${r.cost} xu?`)) return;
    setBusyId(r.id);
    setError("");
    setMsg("");
    const { error } = await supabase.rpc("redeem_reward", { p_reward: r.id });
    setBusyId(null);
    if (error) return setError(error.message);
    setMsg(`Đã đổi "${r.name}". Hãy gặp giáo viên để nhận quà.`);
    load();
  }

  if (!loaded && !error) return <p className="page muted">Đang tải...</p>;

  return (
    <div className="page wide">
      <h1>Quà và xu</h1>
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      <div className="grid2">
        <div className="card" style={{ textAlign: "center" }}>
          <p className="muted">Số xu của bạn</p>
          <div className="bigcoins">🪙 {coins}</div>
          <p className="muted small">
            Đăng nhập mỗi ngày để nhận xu. Điểm danh 7 ngày liên tiếp được thưởng thêm 20 xu.
          </p>
        </div>
        <div className="card">
          <p>
            Chuỗi điểm danh hiện tại: <b>{streak} ngày</b>
          </p>
          <div className="days">
            {week.map((d) => (
              <div key={d.key} className={`day ${d.done ? "done" : ""} ${d.today ? "today" : ""}`}>
                {d.done ? "✓" : "·"}
                <br />
                {d.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2>Cửa hàng quà</h2>
      {rewards.length === 0 && <p className="muted">Chưa có quà nào. Hãy quay lại sau nhé.</p>}
      <div className="shop">
        {rewards.map((r) => {
          const enough = coins >= r.cost;
          const soldOut = r.stock <= 0;
          return (
            <div className="card" key={r.id}>
              <b>{r.name}</b>
              {r.description && <p className="muted small">{r.description}</p>}
              <div className="row" style={{ margin: "10px 0" }}>
                <span className="coinchip">🪙 {r.cost}</span>
                <span className="tag">{soldOut ? "Hết hàng" : `Còn ${r.stock}`}</span>
              </div>
              <button onClick={() => redeem(r)} disabled={soldOut || !enough || busyId === r.id}>
                {soldOut ? "Hết hàng" : !enough ? `Thiếu ${r.cost - coins} xu` : busyId === r.id ? "Đang đổi..." : "Đổi quà"}
              </button>
            </div>
          );
        })}
      </div>

      <h2>Quà của tôi</h2>
      <div className="card tablewrap">
        <table className="tbl">
          <thead>
            <tr><th>Ngày đổi</th><th>Quà</th><th>Xu</th><th>Trạng thái</th></tr>
          </thead>
          <tbody>
            {redemptions.length === 0 && (
              <tr><td colSpan="4" className="muted">Bạn chưa đổi món quà nào.</td></tr>
            )}
            {redemptions.map((x) => (
              <tr key={x.id}>
                <td>{fmtDate(x.created_at)}</td>
                <td>{x.reward_name}</td>
                <td>{x.cost}</td>
                <td><span className={`badge ${STATUS[x.status][0]}`}>{STATUS[x.status][1]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Lịch sử xu gần đây</h2>
      <div className="card tablewrap">
        <table className="tbl">
          <thead>
            <tr><th>Ngày</th><th>Nội dung</th><th>Xu</th></tr>
          </thead>
          <tbody>
            {ledger.length === 0 && (
              <tr><td colSpan="3" className="muted">Chưa có giao dịch nào.</td></tr>
            )}
            {ledger.map((x) => (
              <tr key={x.id}>
                <td>{fmtDate(x.created_at)}</td>
                <td>{x.note || REASON[x.reason] || x.reason}</td>
                <td className={x.amount >= 0 ? "pt high" : "pt low"}>{x.amount > 0 ? `+${x.amount}` : x.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}