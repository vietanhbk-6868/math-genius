import { Link } from "react-router-dom";
import { SCHOOL } from "../schoolInfo";

const enc = encodeURIComponent;

export default function Footer() {
  const query = SCHOOL.mapQuery || "";
  const hasMap = !!(SCHOOL.mapEmbedUrl || query);
  const embed = SCHOOL.mapEmbedUrl || `https://www.google.com/maps?q=${enc(query)}&z=16&output=embed`;
  const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${enc(query || SCHOOL.address || SCHOOL.name)}`;
  const openUrl = `https://www.google.com/maps/search/?api=1&query=${enc(query || SCHOOL.address || SCHOOL.name)}`;

  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <h4>{SCHOOL.name || "MathGenius"}</h4>
          {SCHOOL.address && <p>📍 {SCHOOL.address}</p>}
          {SCHOOL.phone && (
            <p>📞 <a href={`tel:${SCHOOL.phone.replace(/\s/g, "")}`}>{SCHOOL.phone}</a></p>
          )}
          {SCHOOL.email && (
            <p>✉️ <a href={`mailto:${SCHOOL.email}`}>{SCHOOL.email}</a></p>
          )}
          {SCHOOL.website && (
            <p>🌐 <a href={SCHOOL.website} target="_blank" rel="noreferrer">{SCHOOL.website.replace(/^https?:\/\//, "")}</a></p>
          )}
          {SCHOOL.hours && <p>🕐 {SCHOOL.hours}</p>}
        </div>

        <div>
          <h4>Liên kết nhanh</h4>
          <p><Link to="/">Trang chủ</Link></p>
          <p><Link to="/login">Đăng nhập</Link></p>
          <p><Link to="/register">Đăng ký</Link></p>
        </div>

        {hasMap && (
          <div className="footer-map">
            <h4>Đường đến trường</h4>
            <iframe
              title="Bản đồ đường đến trường"
              src={embed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <div className="row" style={{ marginTop: 10 }}>
              <a className="btn" href={dirUrl} target="_blank" rel="noreferrer">Chỉ đường</a>
              <a className="btn ghost" href={openUrl} target="_blank" rel="noreferrer">Mở bản đồ lớn</a>
            </div>
          </div>
        )}
      </div>
      <div className="footer-bottom">
        © {new Date().getFullYear()} {SCHOOL.name || "MathGenius"} · MathGenius: nền tảng học Toán THCS ứng dụng AI
      </div>
    </footer>
  );
}