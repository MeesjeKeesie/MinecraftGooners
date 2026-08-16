import { supabaseClient } from "./supabase-client.js";

/** Haalt de ingelogde gebruiker op, of null. */
export async function getUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session?.user ?? null;
}

/** Haalt het profiel (met rol) van de ingelogde gebruiker op, of null. */
export async function getProfile() {
  const user = await getUser();
  if (!user) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error(error);
    return null;
  }
  return { ...data, email: user.email };
}

/** Nette Nederlandse naam voor een rol. */
export function roleLabel(role) {
  return {
    owner: "Eigenaar",
    starter: "Mag starten",
    none: "Geen rechten",
  }[role] ?? role;
}

/** Wat mag deze rol? Puur voor de weergave — de database bepaalt het echt. */
export function can(role, action) {
  if (role === "owner") return true;
  if (role === "starter") return action === "start";
  return false;
}
