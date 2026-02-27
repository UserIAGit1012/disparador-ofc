async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || error.details || 'Request failed');
  }
  return res.json();
}

export const api = {
  getAccounts: () => request<any[]>('/accounts'),

  getInboxes: (accountId: number) =>
    request<any[]>(`/accounts/${accountId}/inboxes`),

  getTemplates: (accountId: number, inboxId: number) =>
    request<any[]>(`/accounts/${accountId}/inboxes/${inboxId}/templates`),

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

  getDashboardStats: (accountId: number, month?: string) => {
    const params = new URLSearchParams({ account_id: accountId.toString() });
    if (month) params.set('month', month);
    return request<any>(`/dashboard/stats?${params.toString()}`);
  },
};
