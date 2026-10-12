export const EMAIL_DOMAIN = "mathgenius.app";

// Tên tài khoản thành email nội bộ. Nếu người dùng nhập sẵn email (tài khoản cũ) thì giữ nguyên.
export const toEmail = (input) => {
  const v = String(input || "").trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${EMAIL_DOMAIN}`;
};