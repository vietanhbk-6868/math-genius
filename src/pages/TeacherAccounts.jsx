import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext";
import { loadMyClasses } from "../myClasses";
import { baseUsername, stripDiacritics } from "../accountNames";
import { createStudents } from "../api";

const norm = (s) => stripDiacritics(String(s || "")).toLowerCase().replace(/[^a-z]/g, "");

// Đọc danh sách tên từ trang tính đầu tiên
function parseNames(ws) {
  const cols = Math.max(ws.columnCount, 1);
  let fullCol = 0, hoCol = 0, tenCol = 0, headRow = 0;
  for (let r = 1; r <= Math.min(6, ws.rowCount) && !headRow; r++) {
    for (let c = 1; c <= cols; c++) {
      const t = norm(ws.getRow(r).getCell(c).text);
      if (["hoten", "hovaten", "hotenhocsinh", "tenhocsinh"].includes(t)) { fullCol = c; headRow = r; }
      else if (["ho", "hodem", "hovadem", "hotendem"].includes(t)) { hoCol = c; headRow = r; }
      else if (t === "ten") { tenCol = c; headRow = r; }
    }
  }
  if (!headRow) {
    // Không có dòng tiêu đề: lấy cột đầu tiên có chữ (bỏ qua cột STT)
    for (let c = 1; c <= cols; c++) {
      const sample = [];
      for (let r = 1; r <= Math.min(5, ws.rowCount); r++) sample.push(ws.getRow(r).getCell(c).text);
      if (sample.filter((x) => /[A-Za-zÀ-ỹ]{2}/.test(x)).length >= 2) { fullCol = c; break; }
    }
    if (!fullCol) fullCol = 1;
  }
  const out = [];
  for (let r = headRow ? headRow + 1 : 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    let name = "";
    if (fullCol) name = row.getCell(fullCol).text;
    else if (hoCol && tenCol) name = `${row.getCell(hoCol).text} ${row.getCell(tenCol).text}`;
    else name = row.getCell(tenCol || hoCol || 1).text;
    name = String(name).replace(/\s+/g, " ").trim();
    if (name) out.push(name);
  }
  return out;
}

async function loadExcelJS() {
  const mod = await import("exceljs");
  return mod.default ?? mod;
}

function download(buf, filename) {
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TeacherAccounts() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState([]);
  const [cls, setCls] = useState("");
  const [password, setPassword] = useState("");
  const [names, setNames] = useState([]);
  const [paste, setPaste] = useState("");
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const mine = await loadMyClasses(profile?.role);
        setClasses(mine);
        setCls(mine[0] || "");
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [profile?.role]);

  const preview = useMemo(() => {
    const count = {};
    names.forEach((n) => {
      const b = baseUsername(n);
      count[b] = (count[b] || 0) + 1;
    });
    return names.map((n) => ({ name: n, user: baseUsername(n), dup: count[baseUsername(n)] > 1 }));
  }, [names]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const ExcelJS = await loadExcelJS();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("File không có trang tính nào.");
      const list = parseNames(ws);
      if (!list.length) throw new Error("Không tìm thấy tên học sinh trong file.");
      setNames(list);
      setFileName(file.name);
      setResults([]);
    } catch (err) {
      setError("Không đọc được file (chỉ hỗ trợ .xlsx): " + err.message);
    }
  }

  function usePaste() {
    const list = paste.split("\n").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
    setNames(list);
    setFileName("(danh sách dán vào)");
    setResults([]);
  }

  async function downloadTemplate() {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Danh sách");
    ws.addRow(["STT", "Họ và tên"]);
    ["Nguyễn Văn An", "Trần Thị Bình", "Lê Hoàng Cường"].forEach((n, i) => ws.addRow([i + 1, n]));
    ws.getRow(1).font = { bold: true };
    ws.getColumn(1).width = 8;
    ws.getColumn(2).width = 32;
    download(await wb.xlsx.writeBuffer(), "mau-danh-sach-hoc-sinh.xlsx");
  }

  async function run() {
    if (!cls) return setError("Hãy chọn lớp.");
    if (password.length < 6) return setError("Mật khẩu mặc định cần tối thiểu 6 ký tự.");
    if (names.length === 0) return setError("Chưa có danh sách học sinh.");
    if (!window.confirm(`Tạo ${names.length} tài khoản học sinh cho lớp ${cls}?`)) return;
    setRunning(true);
    setError("");
    setResults([]);
    const all = [];
    try {
      for (let i = 0; i < names.length; i += 20) {
        const res = await createStudents({
          className: cls,
          defaultPassword: password,
          names: names.slice(i, i + 20),
        });
        all.push(...res.results);
        setResults([...all]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  async function downloadList() {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Tài khoản ${cls}`);
    ws.addRow(["STT", "Họ và tên", "Tên tài khoản", "Mật khẩu mặc định", "Lớp"]);
    results
      .filter((r) => r.ok)
      .forEach((r, i) => ws.addRow([i + 1, r.fullName, r.username, password, cls]));
    ws.getRow(1).font = { bold: true };
    [6, 28, 26, 22, 10].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    download(await wb.xlsx.writeBuffer(), `tai-khoan-${cls}.xlsx`);
  }

  const okCount = results.filter((r) => r.ok).length;

  return (
    <div className="page wide">
      <h1>Tạo tài khoản cho cả lớp</h1>
      {error && <p className="error">{error}</p>}

      <div className="card stack">
        <div className="form">
          <label>
            Lớp
            <select value={cls} onChange={(e) => setCls(e.target.value)}>
              {classes.length === 0 && <option value="">Bạn chưa được phân công lớp nào</option>}
              {classes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="grow">
            Mật khẩu mặc định cho cả lớp
            <input
              placeholder="Ví dụ: Lop7A1@2026"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>
        <p className="muted small">
          Học sinh sẽ <b>bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên</b>. Tên tài khoản là họ tên không dấu viết liền
          (ví dụ Nguyễn Văn An thành <code>nguyenvanan</code>); nếu trùng thì hệ thống tự thêm tên lớp.
        </p>

        <div className="row">
          <label>
            File Excel danh sách (.xlsx)
            <input type="file" accept=".xlsx" onChange={onFile} />
          </label>
          <button type="button" className="ghost" onClick={downloadTemplate}>Tải file mẫu</button>
        </div>
        <label>
          Hoặc dán danh sách (mỗi dòng một tên)
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} />
        </label>
        <div>
          <button type="button" className="ghost" onClick={usePaste} disabled={!paste.trim()}>
            Dùng danh sách vừa dán
          </button>
        </div>
      </div>

      {names.length > 0 && (
        <>
          <h2>Xem trước: {names.length} học sinh ({fileName})</h2>
          <div className="card tablewrap">
            <table className="tbl">
              <thead>
                <tr><th>STT</th><th>Họ và tên</th><th>Tên tài khoản dự kiến</th><th></th></tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{p.name}</td>
                    <td><code>{p.user}</code></td>
                    <td>{p.dup && <span className="badge mid">Trùng tên, sẽ thêm tên lớp</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={run} disabled={running}>
            {running ? `Đang tạo... (${results.length}/${names.length})` : `Tạo ${names.length} tài khoản`}
          </button>
        </>
      )}

      {results.length > 0 && (
        <>
          <h2>Kết quả: đã tạo {okCount}/{results.length}</h2>
          <div className="card tablewrap">
            <table className="tbl">
              <thead>
                <tr><th>Họ và tên</th><th>Tên tài khoản</th><th>Trạng thái</th></tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.fullName}</td>
                    <td>{r.username ? <code>{r.username}</code> : "—"}</td>
                    <td>
                      {r.ok ? <span className="badge high">Đã tạo</span> : <span className="badge low">{r.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {okCount > 0 && (
            <>
              <button onClick={downloadList}>Tải danh sách tài khoản (Excel)</button>
              <p className="muted small">
                File này chứa mật khẩu mặc định, hãy in phát cho học sinh rồi xóa, đừng chia sẻ công khai.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}