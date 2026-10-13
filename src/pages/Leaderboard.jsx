import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../AuthContext";
import { loadMyClasses } from "../myClasses";
import { fmtPoints } from "../score";

const MEDAL = ["🥇", "🥈", "🥉"];

function periodStart(p) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === "week") {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString();
  }
  if (p === "month") {
    d.setDate(1);
    return d.toISOString();
  }
  return null;
}

export default function Leaderboard() {
  const { profile, session } = useAuth();
  const isStudent = profile?.role === "student";
  const me = session?.user?.id;
  const [classes, setClasses] = useState([]);
  const [cls, setCls] = useState("");
  const [period, setPeriod] = useState("week");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (isStudent) {
          const list = profile.class_name ? [profile.class_name] : [];
          setClasses(list);
          setCls(list[0] || "");
        } else {
          const mine = await loadMyClasses(profile?.role);
          setClasses(mine);
          setCls((cur) => (mine.includes(cur) ? cur : mine[0] || ""));
        }
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [isStudent, profile?.class_name, profile?.role]);

  useEffect(() => {
    if (!cls) return;
    let alive = true;
    setRows(null);
    supabase
      .rpc("class_leaderboard", { p_class: cls, p_since: periodStart(period) })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError(error.message);
        else {
          setError("");
          setRows(data);
        }
      });
    return () => {
      alive = false;
    };
  }, [cls, period]);

  // Học sinh chỉ thấy top 10 và vị trí của mình; giáo viên thấy cả lớp
  const shown = rows ? (isStudent ? rows.filter((r, i) => i < 10 || r.student_id === me) : rows) : null;
  const nobody = rows && rows.every((r) => Number(r.total_points) === 0);
  const top = rows ? rows.slice(0, 3) : [];
  const podium = [top[1], top[0], top[2]].filter(Boolean);
  const myRow = rows?.find((r) => r.student_id === me);

  return (
    <div className="page wide">
      <div className="row between">
        <h1>Bảng xếp hạng{cls ? ` lớp ${cls}` : ""}</h1>
        <div className="row">
          {!isStudent && (
            <label>
              Lớp
              <select value={cls} onChange={(e) => setCls(e.target.value)}>
                {classes.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Thời gian
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="week">Tuần này</option>
              <option value="month">Tháng này</option>
              <option value="all">Từ đầu</option>
            </select>
          </label>
        </div>
      </div>
      <p className="muted small">
        Bảng xếp hạng chỉ hiển thị cho học sinh và giáo viên của lớp này. Điểm xếp hạng là tổng điểm các bài tập
        được giao (mỗi bài lấy lần làm tốt nhất).
      </p>

      {error && <p className="error">{error}</p>}
      {!cls && (
        <p className="muted">{isStudent ? "Bạn chưa thuộc lớp nào." : "Bạn chưa được phân công lớp nào."}</p>
      )}
      {cls && !rows && !error && <p className="muted">Đang tải...</p>}
      {rows && nobody && (
        <p className="notice">Chưa có ai làm bài tập được giao trong khoảng thời gian này.</p>
      )}

      {rows && !nobody && (
        <>
          {isStudent && myRow && (
            <p className="ok">
              Hạng của bạn: <b>#{myRow.rnk}</b> ({fmtPoints(myRow.total_points)} điểm)
            </p>
          )}

          <div className="podium">
            {podium.map((r) => (
              <div className={`card ${r.rnk === 1 ? "first" : ""}`} key={r.student_id}>
                <div className="medal">{MEDAL[Math.min(r.rnk, 3) - 1]}</div>
                <b>{r.full_name}</b>
                <div className="lbpts">{fmtPoints(r.total_points)}</div>
                <span className="muted small">{r.done} bài · TB {fmtPoints(r.avg_points)}</span>
              </div>
            ))}
          </div>

          <div className="card tablewrap">
            <table className="tbl">
              <thead>
                <tr><th>Hạng</th><th>Học sinh</th><th>Tổng điểm</th><th>Điểm TB</th><th>Số bài đã làm</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.student_id} className={r.student_id === me ? "mine" : ""}>
                    <td><b>{r.rnk}</b></td>
                    <td>{r.full_name}{r.student_id === me ? " (bạn)" : ""}</td>
                    <td>{fmtPoints(r.total_points)}</td>
                    <td>{fmtPoints(r.avg_points)}</td>
                    <td>{r.done}</td>
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