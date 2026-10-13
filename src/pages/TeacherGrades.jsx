import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { fmtPoints, pointsClass } from "../score";
import { useAuth } from "../AuthContext";
import { loadMyClasses } from "../myClasses";
// Lấy hết dữ liệu dù hơn 1000 dòng
async function fetchAll(build) {
  const size = 1000;
  let from = 0;
  const out = [];
  for (;;) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < size) break;
    from += size;
  }
  return out;
}

// Sắp xếp theo tên (chữ cuối) như danh sách lớp ở Việt Nam
const givenName = (n) => (n || "").trim().split(/\s+/).slice(-1)[0] || "";

export default function TeacherGrades() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [cls, setCls] = useState("");
  const [zeroMissing, setZeroMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [c, s, a, t] = await Promise.all([
          supabase.from("classes").select("name").order("name"),
          supabase
            .from("profiles")
            .select("id, full_name, username, class_name")
            .eq("role", "student"),
          supabase
            .from("assignments")
            .select("id, title, class_names, created_at")
            .order("created_at", { ascending: true }),
          fetchAll(() =>
            supabase
              .from("attempts")
              .select(
                "id, student_id, assignment_id, score, total, points, topic, source, created_at",
              )
              .order("created_at", { ascending: true })
              .order("id"),
          ),
        ]);
        const err = c.error || s.error || a.error;
        if (err) throw err;
        const mine = await loadMyClasses(profile?.role);
        setClasses(mine);
        setCls(mine[0] || "");
        setStudents(s.data);
        setAssignments(a.data);
        setAttempts(t);
        
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sheet = useMemo(() => {
    const list = students
      .filter((s) => s.class_name === cls)
      .sort(
        (a, b) =>
          givenName(a.full_name).localeCompare(givenName(b.full_name), "vi") ||
          a.full_name.localeCompare(b.full_name, "vi"),
      );
    const asg = assignments.filter((a) => a.class_names.includes(cls));

    const best = {};
    attempts.forEach((t) => {
      if (!t.assignment_id || !t.student_id) return;
      const k = `${t.student_id}|${t.assignment_id}`;
      const p = Number(t.points);
      if (best[k] === undefined || p > best[k]) best[k] = p;
    });

    const rows = list.map((s) => {
      const cells = asg.map((a) => best[`${s.id}|${a.id}`] ?? null);
      const done = cells.filter((x) => x !== null);
      const sum = done.reduce((n, x) => n + x, 0);
      const denom = zeroMissing ? asg.length : done.length;
      return {
        ...s,
        cells,
        done: done.length,
        avg: denom ? Math.round((sum / denom) * 10) / 10 : null,
      };
    });
    return { rows, asg };
  }, [students, assignments, attempts, cls, zeroMissing]);

  async function exportExcel() {
    setExporting(true);
    try {
      const mod = await import("exceljs");
      const ExcelJS = mod.default ?? mod;
      const wb = new ExcelJS.Workbook();

      // Trang 1: bảng điểm
      const ws = wb.addWorksheet("Bảng điểm");
      ws.addRow([
        "STT",
        "Họ và tên",
        "Tên tài khoản",
        ...sheet.asg.map((a) => a.title),
        "Điểm TB",
      ]);
      sheet.rows.forEach((r, i) => {
        const row = ws.addRow([
          i + 1,
          r.full_name,
          r.username || "",
          ...r.cells.map((x) => x ?? ""),
          r.avg ?? "",
        ]);
        for (let c = 4; c <= 4 + sheet.asg.length; c++)
          row.getCell(c).numFmt = "0.0";
      });
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      ws.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E8FF" },
      };
      ws.getColumn(1).width = 6;
      ws.getColumn(2).width = 28;
      ws.getColumn(3).width = 18;
      for (let c = 4; c <= 4 + sheet.asg.length; c++)
        ws.getColumn(c).width = 16;
      ws.views = [{ state: "frozen", xSplit: 3, ySplit: 1 }];

      // Trang 2: chi tiết các lượt làm
      const ws2 = wb.addWorksheet("Chi tiết các lượt làm");
      ws2.addRow([
        "Họ và tên",
        "Lớp",
        "Bài tập / nội dung",
        "Lần làm",
        "Thời gian nộp",
        "Số câu đúng",
        "Tổng số câu",
        "Điểm",
      ]);
      const nameOf = Object.fromEntries(sheet.rows.map((r) => [r.id, r]));
      const asgTitle = Object.fromEntries(
        assignments.map((a) => [a.id, a.title]),
      );
      const counter = {};
      attempts
        .filter((t) => nameOf[t.student_id])
        .sort(
          (a, b) =>
            nameOf[a.student_id].full_name.localeCompare(
              nameOf[b.student_id].full_name,
              "vi",
            ) || (a.created_at < b.created_at ? -1 : 1),
        )
        .forEach((t) => {
          const key = `${t.student_id}|${t.assignment_id || t.topic || "luyen-tap"}`;
          counter[key] = (counter[key] || 0) + 1;
          const row = ws2.addRow([
            nameOf[t.student_id].full_name,
            cls,
            t.assignment_id
              ? asgTitle[t.assignment_id] || "(bài tập đã xóa)"
              : `Luyện tập${t.topic ? `: ${t.topic}` : ""}`,
            counter[key],
            new Date(t.created_at),
            t.score,
            t.total,
            Number(t.points),
          ]);
          row.getCell(5).numFmt = "dd/mm/yyyy hh:mm";
          row.getCell(8).numFmt = "0.0";
        });
      ws2.getRow(1).font = { bold: true };
      ws2.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E8FF" },
      };
      [28, 10, 36, 10, 20, 12, 12, 10].forEach(
        (w, i) => (ws2.getColumn(i + 1).width = w),
      );

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bang-diem-${cls}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Không xuất được file Excel: " + e.message);
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <p className="page muted">Đang tải...</p>;

  return (
    <div className="page wide">
      <div className="row between">
        <h1>Bảng điểm</h1>
        <div className="row">
          <label>
            Lớp
            <select value={cls} onChange={(e) => setCls(e.target.value)}>
              {classes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button onClick={exportExcel} disabled={exporting || !cls}>
            {exporting ? "Đang xuất..." : "Xuất Excel"}
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      <label className="cls-check" style={{ width: "fit-content" }}>
        <input
          type="checkbox"
          checked={zeroMissing}
          onChange={(e) => setZeroMissing(e.target.checked)}
        />
        Tính bài chưa làm là 0 điểm khi tính điểm TB
      </label>

      <div className="card tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>STT</th>
              <th>Họ và tên</th>
              <th>Tên tài khoản</th>
              {sheet.asg.map((a) => (
                <th key={a.id}>{a.title}</th>
              ))}
              <th>Điểm TB</th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.length === 0 && (
              <tr>
                <td colSpan={4 + sheet.asg.length} className="muted">
                  Lớp này chưa có học sinh.
                </td>
              </tr>
            )}
            {sheet.rows.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{r.full_name}</td>
                <td>{r.username || "—"}</td>
                {r.cells.map((v, j) => (
                  <td
                    key={j}
                    className={v === null ? "pt" : `pt ${pointsClass(v)}`}
                  >
                    {fmtPoints(v)}
                  </td>
                ))}
                <td
                  className={r.avg === null ? "pt" : `pt ${pointsClass(r.avg)}`}
                >
                  {fmtPoints(r.avg)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sheet.asg.length === 0 && (
        <p className="muted">Lớp này chưa được giao bài tập nào.</p>
      )}
      <p className="muted small">
        Điểm mỗi bài tập là điểm cao nhất trong các lượt làm. File Excel có thêm
        trang "Chi tiết các lượt làm" gồm cả các lần luyện tập tự do của học
        sinh.
      </p>
    </div>
  );
}
