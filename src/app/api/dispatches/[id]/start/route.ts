import { NextRequest, NextResponse } from 'next/server';
import { executeDispatchById } from '@/lib/dispatch-executor';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dispatchId = params.id;

    // Fire-and-forget: start processing but don't wait for completion
    // The executeDispatchById processes as much as it can within the timeout
    const result = await executeDispatchById(dispatchId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
