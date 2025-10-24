"use server";
import { cookies } from "next/headers";
import type { UserRole } from "@/types";

export async function setAuthCookie(email: string, role: UserRole) {
  const store = await cookies();
  store.set("goodlife", JSON.stringify({ email, role }), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });
}

export async function clearAuthCookie() {
  const store = await cookies();
  store.delete("goodlife");
}


