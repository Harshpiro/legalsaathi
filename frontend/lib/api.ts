"use client";

import axios, { AxiosInstance } from "axios";
import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

/** Hook that returns an axios client which attaches the user's Clerk JWT. */
export function useApi(): AxiosInstance {
  const { getToken } = useAuth();

  return useMemo(() => {
    const client = axios.create({
      baseURL: API_URL,
      timeout: 120_000,
    });

    client.interceptors.request.use(async (config) => {
      if (!DEV_MODE) {
        const token = await getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });

    return client;
  }, [getToken]);
}

export const apiUrl = API_URL;
