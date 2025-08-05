import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    isAuthenticated: true,
    user: {
      email: 'mock@example.com',
      name: 'Mock User',
      picture: 'https://via.placeholder.com/150'
    }
  });
} 