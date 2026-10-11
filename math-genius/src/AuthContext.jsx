import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

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
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: ({ email, password, fullName, teacherCode, classroom }) =>
  supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        teacher_code: teacherCode || null,
        class_name: classroom || null,
      },
    },
  }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}