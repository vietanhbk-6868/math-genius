import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Home() {
  const { session } = useAuth();
  return (
    <div className="page">
      <section className="hero">
        <h1>MathGenius</h1>
        <p>
          Ngân hàng câu hỏi Toán THCS phân hóa theo năng lực. AI chỉ ra lỗ hổng kiến thức của
          từng học sinh và đề xuất bài tập bổ trợ, giúp giáo viên giảm áp lực chấm bài.
        </p>
        <div className="row cta">
          {session ? (
            <Link className="btn" to="/app">Vào trang của tôi</Link>
          ) : (
            <>
              <Link className="btn" to="/register">Đăng ký</Link>
              <Link className="btn ghost" to="/login">Đăng nhập</Link>
            </>
          )}
        </div>
      </section>

      <section className="features">
        <div className="card">
          <h3>Giáo viên soạn đề nhanh</h3>
          <p className="muted">AI sinh câu hỏi theo lớp, chủ đề, mức độ. Giáo viên duyệt trước khi dùng.</p>
        </div>
        <div className="card">
          <h3>Chấm điểm tự động</h3>
          <p className="muted">Học sinh làm bài và nhận kết quả, lời giải ngay lập tức.</p>
        </div>
        <div className="card">
          <h3>Chẩn đoán lỗ hổng</h3>
          <p className="muted">Phân tích theo từng kỹ năng, gợi ý bài bổ trợ riêng cho mỗi em.</p>
        </div>
      </section>
    </div>
  );
}