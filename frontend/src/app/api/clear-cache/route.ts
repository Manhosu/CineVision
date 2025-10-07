import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Retorna instruções para limpar o cache no cliente
    return NextResponse.json({
      success: true,
      message: 'Cache clearing instructions sent',
      instructions: [
        'Unregister all service workers',
        'Clear all caches',
        'Reload page'
      ]
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to process cache clearing' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST method to clear cache',
    endpoint: '/api/clear-cache'
  });
}