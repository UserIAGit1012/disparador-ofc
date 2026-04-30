import { getSupabase } from '@/lib/supabase';

async function getAuthHeader(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (!sb) return {};
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const auth = await getAuthHeader();
  const res = await fetch(`/api${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...auth,
      ...(options?.headers || {}),
    },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || error.details || 'Request failed');
  }
  return res.json();
}

export const api = {
  getMe: () =>
    request<{
      user_id: string;
      email: string;
      is_admin: boolean;
      allowed_phone_ids: string[];
      allowed_waba_ids: string[];
    }>('/me'),

  getAccounts: () => request<any[]>('/accounts'),

  getAgents: (accountId: number) =>
    request<any[]>(`/accounts/${accountId}/agents`),

  getInboxes: (accountId: number) =>
    request<any[]>(`/accounts/${accountId}/inboxes`),

  getTemplates: (accountId: number, inboxId: number) =>
    request<any[]>(`/accounts/${accountId}/inboxes/${inboxId}/templates`),

  getWhatsAppCredentials: (accountId: number, inboxId: number) =>
    request<{
      available: boolean;
      phone_number_id?: string;
      api_key?: string;
      error?: string;
      debug?: any;
    }>(`/accounts/${accountId}/inboxes/${inboxId}/whatsapp-credentials`),

  filterConversations: (accountId: number, payload: any, page = 1) =>
    request<any>(`/accounts/${accountId}/conversations/filter?page=${page}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getLabels: (accountId: number) =>
    request<any[]>(`/accounts/${accountId}/labels`),

  getFunnels: (accountId: number) =>
    request<any[]>(`/accounts/${accountId}/funnels`),

  getFunnelStages: (accountId: number, funnelId: number) =>
    request<any[]>(`/accounts/${accountId}/funnels/${funnelId}/stages`),

  getKanbanItems: (accountId: number, params: Record<string, string>) => {
    const qs = '?' + new URLSearchParams({ ...params, all: 'true' }).toString();
    return request<{ items: any[]; total: number; pages_fetched: number }>(
      `/accounts/${accountId}/kanban-items${qs}`
    );
  },

  sendMessage: (data: { accountId: number; conversationId: number; template: any }) =>
    request<{ success: boolean; messageId?: number; error?: string }>('/send-message', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  checkBlacklist: (data: { conversation_ids: number[]; template_name: string; days: number }) =>
    request<{ blocked_ids: number[] }>('/blacklist/check', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDispatchMessages: (dispatchId: string) =>
    request<any[]>(`/dispatches/${dispatchId}/messages`),

  retryDispatch: (dispatchId: string) =>
    request<{ success: boolean; dispatch_id: string; retry_count: number }>(
      `/dispatches/${dispatchId}/retry`,
      { method: 'POST' }
    ),

  startDispatch: (dispatchId: string) =>
    request<{ success: boolean; processed: number; message: string }>(
      `/dispatches/${dispatchId}/start`,
      { method: 'POST' }
    ),

  sendNext: (dispatchId: string) =>
    request<{
      done: boolean;
      reason?: string;
      waiting?: boolean;
      sent?: boolean;
      error?: boolean;
      remaining: number;
      sent_count: number;
      error_count: number;
      total: number;
      delay_min: number;
      delay_max: number;
      message?: {
        id: string;
        dispatch_id: string;
        conversation_id: number;
        contact_name?: string;
        contact_phone?: string;
        template_name: string;
        status: string;
        error_message?: string | null;
        sent_at?: string | null;
        external_id?: string | null;
      };
    }>(`/dispatches/${dispatchId}/send-next`, { method: 'POST' }),

  getDispatchStatus: (dispatchId: string) =>
    request<{
      id: string;
      status: string;
      total_conversations: number;
      sent_count: number;
      error_count: number;
      pending_count: number;
      estimated_cost_usd: number;
      template_name: string;
      created_at: string;
      updated_at: string;
    }>(`/dispatches/${dispatchId}/status`),

  pauseDispatch: (dispatchId: string) =>
    request<{ success: boolean; status: string }>(
      `/dispatches/${dispatchId}/cancel`,
      { method: 'POST', body: JSON.stringify({ action: 'pause' }) }
    ),

  cancelDispatch: (dispatchId: string) =>
    request<{ success: boolean; status: string }>(
      `/dispatches/${dispatchId}/cancel`,
      { method: 'POST', body: JSON.stringify({ action: 'cancel' }) }
    ),

  resumeDispatch: (dispatchId: string) =>
    request<{ success: boolean; status: string }>(
      `/dispatches/${dispatchId}/cancel`,
      { method: 'POST', body: JSON.stringify({ action: 'resume' }) }
    ),

  deleteDispatch: (dispatchId: string) =>
    request<{ success: boolean; deleted: string }>(
      `/dispatches/${dispatchId}`,
      { method: 'DELETE' }
    ),

  getDashboardStats: (accountId: number, month?: string) => {
    const params = new URLSearchParams({ account_id: accountId.toString() });
    if (month) params.set('month', month);
    return request<any>(`/dashboard/stats?${params.toString()}`);
  },

  // Meta Business Accounts (multiple BMs, global)
  listMetaBusinesses: () =>
    request<
      {
        id: string;
        name: string;
        business_account_id: string;
        access_token_masked: string;
        created_at?: string;
        updated_at?: string;
      }[]
    >('/meta-businesses'),

  createMetaBusiness: (data: {
    name: string;
    business_account_id: string;
    access_token: string;
  }) =>
    request<{
      id: string;
      name: string;
      business_account_id: string;
      access_token_masked: string;
    }>('/meta-businesses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMetaBusiness: (
    id: string,
    data: { name?: string; business_account_id?: string; access_token?: string }
  ) =>
    request<any>(`/meta-businesses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteMetaBusiness: (id: string) =>
    request<{ success: boolean }>(`/meta-businesses/${id}`, {
      method: 'DELETE',
    }),

  // Aggregated across all BMs
  getAllMetaNumbers: () =>
    request<
      {
        business: { id: string; name: string; business_account_id: string };
        numbers: any[];
        error: string | null;
      }[]
    >('/meta-numbers'),

  getAllMetaTemplates: () =>
    request<
      {
        business: { id: string; name: string; business_account_id: string };
        templates: any[];
        error: string | null;
      }[]
    >('/meta-templates'),

  // Per-BM template ops
  createMetaTemplate: (
    businessId: string,
    data: {
      waba_id: string;
      name: string;
      language: string;
      category: string;
      components: any[];
    }
  ) =>
    request<{ id?: string; status?: string; category?: string }>(
      `/meta-businesses/${businessId}/templates`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  deleteMetaTemplate: (
    businessId: string,
    name: string,
    wabaId: string,
    hsmId?: string
  ) => {
    const qs = new URLSearchParams({ waba_id: wabaId });
    if (hsmId) qs.set('hsm_id', hsmId);
    return request<{ success: boolean }>(
      `/meta-businesses/${businessId}/templates/${encodeURIComponent(name)}?${qs.toString()}`,
      { method: 'DELETE' }
    );
  },

  // Admin: users
  listUsers: () =>
    request<
      {
        user_id: string;
        email: string;
        name: string | null;
        is_admin: boolean;
        allowed_phone_ids: string[];
        allowed_waba_ids: string[];
        created_at?: string;
        last_sign_in_at?: string;
      }[]
    >('/admin/users'),

  bulkCreateUsers: (emails: string[]) =>
    request<
      {
        email: string;
        user_id?: string;
        password?: string;
        error?: string;
      }[]
    >('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ emails }),
    }),

  updateUser: (
    userId: string,
    data: {
      name?: string;
      is_admin?: boolean;
      allowed_phone_ids?: string[];
      allowed_waba_ids?: string[];
    }
  ) =>
    request<{ success: boolean }>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteUser: (userId: string) =>
    request<{ success: boolean }>(`/admin/users/${userId}`, {
      method: 'DELETE',
    }),

  resetUserPassword: (userId: string) =>
    request<{ success: boolean; password: string }>(`/admin/users/${userId}`, {
      method: 'POST',
    }),
};
