import { NextRequest, NextResponse } from 'next/server';
import { executeScheduledDispatches } from '@/lib/dispatch-executor';

// Vercel Cron or manual trigger
export async function GET(req: NextRequest) {
  try {
    // Optional: verify cron secret for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await executeScheduledDispatches();

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
