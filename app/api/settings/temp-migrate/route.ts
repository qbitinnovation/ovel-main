import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SystemSettings from '@/models/SystemSettings';

export const dynamic = 'force-dynamic';

const newRules = [
  {
    id: 'rule-wd-1',
    name: '6AM-10AM',
    startTime: '06:00',
    endTime: '10:00',
    normalPricePerHour: 2420,
    regularPricePerHour: 2200,
    dayType: 'weekdays',
    isActive: true,
  },
  {
    id: 'rule-wd-2',
    name: '10AM-4PM',
    startTime: '10:00',
    endTime: '16:00',
    normalPricePerHour: 1870,
    regularPricePerHour: 1650,
    dayType: 'weekdays',
    isActive: true,
  },
  {
    id: 'rule-wd-3',
    name: '4PM-6PM',
    startTime: '16:00',
    endTime: '18:00',
    normalPricePerHour: 2420,
    regularPricePerHour: 2200,
    dayType: 'weekdays',
    isActive: true,
  },
  {
    id: 'rule-wd-4',
    name: '6PM-12AM',
    startTime: '18:00',
    endTime: '00:00',
    normalPricePerHour: 2750,
    regularPricePerHour: 2530,
    dayType: 'weekdays',
    isActive: true,
  },
];

export async function GET() {
  try {
    await dbConnect();
    const result = await SystemSettings.findOneAndUpdate(
      { key: 'turf_weekday_rules' },
      {
        $set: {
          value: newRules,
          label: 'Weekday Price Customization',
          category: 'bookings',
        },
      },
      { upsert: true, new: true }
    );
    return NextResponse.json({ success: true, data: result.value });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
