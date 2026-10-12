export const toPoints = (score, total) => (total ? Math.round((score * 100) / total) / 10 : 0);

// Hiển thị kiểu Việt Nam: 7,5
export const fmtPoints = (p) =>
  p === null || p === undefined || Number.isNaN(Number(p))
    ? "—"
    : Number(p).toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Dưới 5 là yếu, từ 5 đến dưới 8 là trung bình, từ 8 là tốt
export const pointsClass = (p) => (p < 5 ? "low" : p < 8 ? "mid" : "high");