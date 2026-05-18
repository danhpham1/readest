import { supabase } from '@/utils/supabase';
import { UserPlan } from '@/types/quota';
import { isWebAppPlatform } from '@/services/environment';
import { getDailyUsage } from '@/services/translators/utils';

// Personal build — always report 'pro' plan
export const getSubscriptionPlan = (_token: string): UserPlan => 'pro';
export const getUserProfilePlan = (_token: string): UserPlan => 'pro';
export const STORAGE_QUOTA_GRACE_BYTES = 0;

// Personal build — no plan-based limits. All quota functions return
// unlimited values so upstream checks never trigger.
const UNLIMITED = Number.MAX_SAFE_INTEGER;

export const getStoragePlanData = (_token: string) => ({
  plan: 'pro' as UserPlan,
  usage: 0,
  quota: UNLIMITED,
});

export const getTranslationQuota = (_plan: UserPlan): number => UNLIMITED;

export const getTranslationPlanData = (_token: string) => ({
  plan: 'pro' as UserPlan,
  usage: getDailyUsage() || 0,
  quota: UNLIMITED,
});

export const getDailyTranslationPlanData = (_token: string) => ({
  plan: 'pro' as UserPlan,
  quota: UNLIMITED,
});

export const getAccessToken = async (): Promise<string | null> => {
  // In browser context there might be two instances of supabase one in the app route
  // and the other in the pages route, and they might have different sessions
  // making the access token invalid for API calls. In that case we should use localStorage.
  if (isWebAppPlatform()) {
    return localStorage.getItem('token') ?? null;
  }
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
};

export const getUserID = async (): Promise<string | null> => {
  if (isWebAppPlatform()) {
    const user = localStorage.getItem('user') ?? '{}';
    return JSON.parse(user).id ?? null;
  }
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
};

export const validateUserAndToken = async (authHeader: string | null | undefined) => {
  if (!authHeader) return {};

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return {};
  return { user, token };
};
