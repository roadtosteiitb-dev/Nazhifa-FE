import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import api from '@/services/apiClient';
import {
  ApiUserProfile,
  LocalImage,
  deleteProfilePhoto,
  fetchMe,
  updateProfile,
  uploadProfilePhoto,
} from '@/services/ProfileService';

const TOKEN_KEY  = '@lokatani_token';
const USER_KEY   = '@lokatani:user';

// ==============================
// 🧩 Interface Definitions  (UNCHANGED — UI components remain the same)
// ==============================
export interface LocationData {
  latitude: number;
  longitude: number;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  userType: 'owner' | 'buyer' | 'admin';
  address?: string;
  photo?: string;
  gender?: 'male' | 'female' | 'other';
  dob?: string;
  location?: LocationData;
  createdAt: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  userType: 'owner' | 'buyer';
  address?: string;
  gender?: 'male' | 'female' | 'other';
  dob?: string;
  location?: LocationData;
  photo?: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  user?: User | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  /** Local-only fields (gender, dob, address, location) — not stored on the server */
  updateUser: (userData: Partial<User>) => Promise<void>;
  /** Save name / email / phone to the server (users table) */
  saveProfile: (data: { fullName?: string; email?: string; phone?: string }) => Promise<void>;
  /** Upload a new profile photo to the server (users.photo) */
  uploadPhoto: (image: LocalImage) => Promise<void>;
  /** Remove the profile photo on the server */
  removePhoto: () => Promise<void>;
}

// ==============================
// 🧠 Context Initialization
// ==============================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load cached user session on app start
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await AsyncStorage.getItem(USER_KEY);
        if (userData) {
          const cached: User = JSON.parse(userData);
          setUser(cached);
          // Refresh name / phone / photo from the server in the background (e.g. photo changed on another device)
          fetchMe()
            .then((p) => {
              const merged = mergeProfile(cached, p);
              setUser(merged);
              AsyncStorage.setItem(USER_KEY, JSON.stringify(merged)).catch(() => {});
            })
            .catch(() => {});
        }
      } catch (error) {
        console.error('Error loading cached user:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  // REGISTER → POST /api/auth/register
  const register = async (data: RegisterData): Promise<AuthResponse> => {
    const { email, password, fullName, phone, userType } = data;
    try {
      const res = await api.post('/auth/register', {
        email, password,
        fullName,
        userType,
        phone: phone || undefined,
      });

      const { token, user: apiUser } = res.data;
      const mappedUser: User = {
        id:        apiUser.id,
        email:     apiUser.email,
        fullName:  apiUser.fullName || apiUser.full_name || fullName,
        phone:     apiUser.phone || phone || '',
        userType:  apiUser.userType || apiUser.user_type || userType,
        photo:     apiUser.photo || undefined,
        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(mappedUser));
      setUser(mappedUser);

      return { success: true, message: 'Registrasi berhasil', user: mappedUser };
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Registrasi gagal';
      return { success: false, message: msg };
    }
  };

  // LOGIN → POST /api/auth/login
  const login = async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user: apiUser } = res.data;

      const mappedUser: User = {
        id:        apiUser.id,
        email:     apiUser.email,
        fullName:  apiUser.fullName || apiUser.full_name,
        phone:     apiUser.phone || '',
        userType:  apiUser.userType || apiUser.user_type,
        photo:     apiUser.photo,
        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(mappedUser));
      setUser(mappedUser);

      return { success: true, message: 'Login berhasil', user: mappedUser };
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Email atau kata sandi salah';
      return { success: false, message: msg };
    }
  };

  // LOGOUT
  const logout = async () => {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // UPDATE USER (local cache only – no dedicated /me PUT endpoint yet)
  const updateUser = async (userData: Partial<User>) => {
    try {
      if (!user) return;
      const updatedUser = { ...user, ...userData };
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  // Apply a server profile to the current user and persist it
  const applyProfile = async (p: ApiUserProfile) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = mergeProfile(prev, p);
      AsyncStorage.setItem(USER_KEY, JSON.stringify(merged)).catch(() => {});
      return merged;
    });
  };

  const saveProfile = async (data: { fullName?: string; email?: string; phone?: string }) => {
    applyProfile(await updateProfile(data));
  };

  const uploadPhoto = async (image: LocalImage) => {
    applyProfile(await uploadProfilePhoto(image));
  };

  const removePhoto = async () => {
    applyProfile(await deleteProfilePhoto());
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateUser, saveProfile, uploadPhoto, removePhoto }}>
      {children}
    </AuthContext.Provider>
  );
};

/** Server-owned fields win; local-only extras (gender, dob, address, location) are kept */
function mergeProfile(local: User, p: ApiUserProfile): User {
  return {
    ...local,
    fullName: p.fullName ?? local.fullName,
    email: p.email ?? local.email,
    phone: p.phone ?? '',
    userType: p.userType ?? local.userType,
    photo: p.photo ?? undefined,
  };
}

// Hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
