// So sánh tên lớp theo kiểu tự nhiên: 7A2 đứng trước 7A10
export const cmpClass = (a, b) =>
  String(a).localeCompare(String(b), "vi", { numeric: true, sensitivity: "base" });

export const sortClassNames = (names) => [...names].sort(cmpClass);
export const sortClassRows = (rows) => [...rows].sort((a, b) => cmpClass(a.name, b.name));