export interface Account {
  id: number;
  name: string;
}

export interface Inbox {
  id: number;
  name: string;
  channel_type: string;
  phone_number?: string;
}

export interface Template {
  id: number;
  name: string;
  language: string;
  category: string;
  status: string;
  components: TemplateComponent[];
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: string;
  text?: string;
  buttons?: TemplateButton[];
  example?: {
    header_handle?: string[];
    body_text?: string[][];
  };
}

export interface TemplateButton {
  type: string;
  text: string;
  url?: string;
  phone_number?: string;
}

export interface Conversation {
  id: number;
  inbox_id: number;
  status: string;
  contact: Contact;
  labels: string[];
  selected?: boolean;
  last_activity_at?: number | string;
}

export interface Contact {
  id: number;
  name: string;
  phone_number?: string;
  email?: string;
}

export interface Label {
  id: number;
  title: string;
  description?: string;
  color?: string;
  show_on_sidebar: boolean;
}

export interface Funnel {
  id: number;
  name: string;
  account_id: number;
}

export interface FunnelStage {
  id: number;
  name: string;
  funnel_id: number;
  position: number;
}

export interface KanbanItem {
  id: number;
  name: string;
  stage_id: number;
  funnel_id: number;
  conversation_id: number;
  contact?: Contact;
}

// Dispatch tracking
export interface DispatchRecord {
  id: string;
  account_id: number;
  inbox_id: number;
  template_name: string;
  template_category?: string;
  total_conversations: number;
  sent_count: number;
  error_count: number;
  status: string;
  errors: any[];
  scheduled_at?: string;
  estimated_cost_usd?: number;
  delay_min: number;
  delay_max: number;
  conversation_data?: any;
  template_config?: any;
  created_at: string;
  updated_at: string;
}

export interface DispatchMessage {
  id: string;
  dispatch_id: string;
  conversation_id: number;
  contact_name?: string;
  contact_phone?: string;
  template_name: string;
  template_category?: string;
  status: string;
  error_message?: string;
  cost_usd?: number;
  sent_at?: string;
  external_id?: string;
  created_at: string;
}

// Template variable config per variable slot
export type TemplateVarType = 'fixed' | 'contact_name' | 'contact_phone';

export interface TemplateVarConfig {
  type: TemplateVarType;
  value?: string; // only used when type = 'fixed'
}

export interface TemplateVarsConfig {
  [key: string]: TemplateVarConfig; // key = "1", "2", etc. or "header_media_url"
}

// Dashboard stats
export interface DashboardStats {
  totalSent: number;
  totalErrors: number;
  totalCostUsd: number;
  sentByDay: { date: string; count: number }[];
  costByMonth: { month: string; marketing: number; utility: number }[];
  topTemplates: { name: string; count: number }[];
  errorRate: number;
}
