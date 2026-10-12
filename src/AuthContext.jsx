import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { toEmail } from "./authName";
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pstate, setPstate] = useState({ uid: null, data: null });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id;

  useEffect(() => {
    if (!uid) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single()
      .then(({ data }) => setPstate({ uid, data: data ?? null }));
  }, [uid]);

  const profile = uid && pstate.uid === uid ? pstate.data : null;
  const busy = loading || (!!uid && pstate.uid !== uid);

  const value = {
    session,
    profile,
    busy,
    signIn: (identifier, password) =>
  supabase.auth.signInWithPassword({ email: toEmail(identifier), password }),
    signUp: async ({ username, password, fullName, role, teacherCode, classroom }) => {
     const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, fullName, role, teacherCode, classroom }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { error: { message: json.error || "Không đăng ký được, hãy thử lại." } };
  return supabase.auth.signInWithPassword({ email: toEmail(username), password });
},
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}