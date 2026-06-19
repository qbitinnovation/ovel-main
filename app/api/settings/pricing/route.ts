import { type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils';
import { getDevTurfPricingConfig, getTurfPricingConfig } from '@/lib/turf-pricing-settings';
import { calculateTurfSlotPrice, normalizeTurfPriceType } from '@/lib/turf-pricing';
import { isDevFallbackEnabled } from '@/lib/dev-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('Unauthorized', 401);

    let pricing;
    try {
      await dbConnect();
      pricing = await getTurfPricingConfig();
    } catch (error) {
      if (!isDevFallbackEnabled()) throw error;
      pricing = getDevTurfPricingConfig();
    }
    const sp = request.nextUrl.searchParams;
    const bookingDate = sp.get('bookingDate');
    const startTime = sp.get('startTime');
    const endTime = sp.get('endTime');
    const priceType = normalizeTurfPriceType(sp.get('priceType'));

    if (bookingDate && startTime && endTime) {
      const quote = calculateTurfSlotPrice({
        bookingDate,
        startTime,
        endTime,
        priceType,
        weekdayRules: pricing.weekdayRules,
        weekendRules: pricing.weekendRules,
        holidays: pricing.holidays,
        weekendDays: pricing.weekendDays,
      });
      console.log('DEBUG pricing API:', {
        bookingDate,
        startTime,
        endTime,
        priceType,
        weekdayRulesCount: pricing.weekdayRules?.length,
        weekendRulesCount: pricing.weekendRules?.length,
        quote
      });
      return successResponse({ pricing, quote });
    }

    return successResponse({ pricing });
  } catch (error) {
    console.error('GET /api/settings/pricing error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Failed to fetch pricing', 500);
  }
}
