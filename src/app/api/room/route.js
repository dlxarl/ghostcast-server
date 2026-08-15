import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('id');

  if (!roomId) {
    return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
  }

  // Example of a serverless API route. 
  // In a real scenario, you could verify against your Supabase database 
  // whether this room exists, or is active, before allowing connection.

  return NextResponse.json({ 
    message: 'Room validation successful', 
    roomId,
    serverless: true 
  });
}
