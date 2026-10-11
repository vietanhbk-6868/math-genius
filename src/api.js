import { supabase } from "./supabase";

async function postJSON(url, body) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Lỗi máy chủ");
  return json;
}

export const generateQuestions = (body) => postJSON("/api/questions/generate", body);
export const diagnose = (stats) => postJSON("/api/diagnose", { stats });