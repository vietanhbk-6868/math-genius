import { supabase } from "./supabase";

export async function loadMyClasses(role) {
  const { data: all, error } = await supabase.from("classes").select("name").order("name");
  if (error) throw error;
  const names = all.map((c) => c.name);
  if (role === "admin") return names;
  const { data: mine, error: e2 } = await supabase.rpc("my_teaching_classes");
  if (e2) throw e2;
  return names.filter((n) => (mine || []).includes(n));
}