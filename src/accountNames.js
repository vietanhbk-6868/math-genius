export function stripDiacritics(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

// Họ tên thành tên tài khoản: không dấu, viết liền, chữ thường, tối đa 30 ký tự
export function baseUsername(fullName) {
  return stripDiacritics(fullName).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
}