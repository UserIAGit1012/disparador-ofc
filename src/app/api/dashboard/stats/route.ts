import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('account_id') || '';
    const month = searchParams.get('month') || ''; // formato YYYY-MM

    if (!accountId) {
      return NextResponse.json(
        { error: 'account_id is required' },
        { status: 400 }
      );
    }

    const sb = getSupabaseServer();

    // Calculate date range from month filter
    let dateFrom = '';
    let dateTo = '';
    if (month) {
      dateFrom = `${month}-01`;
      // Last day of the month
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      dateTo = `${month}-${String(lastDay).padStart(2, '0')}`;
    }

    // First get dispatch IDs for this account
    let dispatchQuery = sb
      .from('dispatches')
      .select('id')
      .eq('account_id', parseInt(accountId));

    const { data: dispatchRows, error: dErr } = await dispatchQuery;
    if (dErr) {
      return NextResponse.json({ error: dErr.message }, { status: 500 });
    }

    const dispatchIds = (dispatchRows || []).map((d: any) => d.id);

    if (dispatchIds.length === 0) {
      return NextResponse.json({
        totalSent: 0,
        totalErrors: 0,
        totalCostUsd: 0,
        errorRate: 0,
        sentByDay: [],
        costByMonth: [],
        topTemplates: [],
      });
    }

    // Query dispatch_messages filtered by dispatch IDs
    let msgQuery = sb
      .from('dispatch_messages')
      .select('*')
      .in('dispatch_id', dispatchIds);

    if (dateFrom) {
      msgQuery = msgQuery.gte('created_at', `${dateFrom}T00:00:00`);
    }
    if (dateTo) {
      msgQuery = msgQuery.lte('created_at', `${dateTo}T23:59:59`);
    }

    const { data: allMessages, error: mErr } = await msgQuery;
    if (mErr) {
      return NextResponse.json({ error: mErr.message }, { status: 500 });
    }

    const messages = allMessages || [];

    const sentMessages = messages.filter((m: any) => m.status === 'sent');
    const errorMessages = messages.filter((m: any) => m.status === 'error');

    // Totals
    const totalSent = sentMessages.length;
    const totalErrors = errorMessages.length;
    const totalFinished = totalSent + totalErrors;
    const errorRate = totalFinished > 0 ? (totalErrors / totalFinished) * 100 : 0;

    // Total cost
    const totalCostUsd = sentMessages.reduce(
      (sum: number, m: any) => sum + (parseFloat(m.cost_usd) || 0),
      0
    );

    // Sent by day
    const sentByDayMap: Record<string, number> = {};
    for (const m of sentMessages) {
      if (m.sent_at) {
        const day = m.sent_at.slice(0, 10);
        sentByDayMap[day] = (sentByDayMap[day] || 0) + 1;
      }
    }
    const sentByDay = Object.entries(sentByDayMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Cost by month grouped by category
    const costByMonthMap: Record<string, { marketing: number; utility: number }> = {};
    for (const m of sentMessages) {
      if (m.sent_at) {
        const mo = m.sent_at.slice(0, 7);
        if (!costByMonthMap[mo]) costByMonthMap[mo] = { marketing: 0, utility: 0 };
        const cost = parseFloat(m.cost_usd) || 0;
        const cat = (m.template_category || 'MARKETING').toUpperCase();
        if (cat === 'UTILITY') {
          costByMonthMap[mo].utility += cost;
        } else {
          costByMonthMap[mo].marketing += cost;
        }
      }
    }
    const costByMonth = Object.entries(costByMonthMap)
      .map(([mo, costs]) => ({ month: mo, ...costs }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Top templates
    const templateCountMap: Record<string, number> = {};
    for (const m of sentMessages) {
      templateCountMap[m.template_name] = (templateCountMap[m.template_name] || 0) + 1;
    }
    const topTemplates = Object.entries(templateCountMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      totalSent,
      totalErrors,
      totalCostUsd,
      errorRate,
      sentByDay,
      costByMonth,
      topTemplates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
