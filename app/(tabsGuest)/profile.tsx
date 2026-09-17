import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";

export default function ProfileGuest() {
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Hapus session user dulu
    logout();

    // Arahkan ke halaman login
    router.replace("/auth/login");
  }, []);

  // Tidak menampilkan apa pun — auto redirect
  return null;
}
