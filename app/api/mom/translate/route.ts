import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    const { checkPermission } = await import('@/lib/permissions');
    const perm = await checkPermission(session.user.id, 'malayalam_mom', 'convert_to_malayalam');
    if (!perm.allowed) return errorResponse('Forbidden', 403);

    const body = await request.json();
    const { text } = body;
    if (!text?.trim()) return errorResponse('Text is required');

    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

    if (!apiKey || apiKey === 'placeholder') {
      // Stub: return a mock response
      console.log('📝 [STUB] Google Translate API key not configured. Returning mock translation.');
      return successResponse({
        translatedText: `[ML] ${text}`,
        isStub: true,
      }, 'Translation completed (stub — configure GOOGLE_TRANSLATE_API_KEY for real translation)');
    }

    // Real Google Cloud Translation API call
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'en',
        target: 'ml',
        format: 'text',
      }),
    });

    const data = await res.json();

    if (data.data?.translations?.[0]?.translatedText) {
      return successResponse({
        translatedText: data.data.translations[0].translatedText,
        isStub: false,
      }, 'Translation completed');
    }

    return errorResponse('Translation failed');
  } catch (error) {
    console.error('POST /api/mom/translate error:', error);
    return errorResponse('Translation service error', 500);
  }
}
