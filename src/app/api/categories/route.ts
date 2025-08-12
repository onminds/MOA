import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    const db = await getConnection();
    
    // 활성화된 카테고리 목록 조회
    const result = await db.request()
      .query(`
        SELECT id, name, description, color, is_active, created_at
        FROM categories 
        WHERE is_active = 1 
        ORDER BY id ASC
      `);

    const categories = result.recordset.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description,
      color: category.color,
      is_active: category.is_active,
      created_at: category.created_at
    }));

    console.log('📋 카테고리 목록 조회:', categories.length, '개');

    return NextResponse.json({
      success: true,
      categories: categories
    });

  } catch (error) {
    console.error('❌ 카테고리 목록 조회 오류:', error);
    return NextResponse.json({ 
      error: '카테고리 목록을 불러올 수 없습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}
