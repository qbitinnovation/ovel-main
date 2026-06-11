import { NextResponse } from 'next/server';

/**
 * Standard API response helpers
 */
export function successResponse<T>(data: T, message = 'Success', status = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

export function errorResponse(message: string, status = 400, errors?: Record<string, string>) {
  return NextResponse.json({ success: false, message, errors }, { status });
}

/**
 * Format date to readable string
 */
export function formatDate(date: Date | string, locale = 'en-IN'): string {
  const d = new Date(date);
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string, locale = 'en-IN'): string {
  const d = new Date(date);
  return d.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(date: Date | string, locale = 'en-IN'): string {
  const d = new Date(date);
  return d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Relative time (e.g., "2 hours ago")
 */
export function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

/**
 * Pagination helper
 */
export interface PaginationParams {
  page: number;
  limit: number;
  total: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  skip: number;
}

export function paginate(params: PaginationParams): PaginationResult {
  const { page, limit, total } = params;
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    skip: (page - 1) * limit,
  };
}

/**
 * Parse pagination from search params
 */
export function parsePagination(searchParams: URLSearchParams): { page: number; limit: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  return { page, limit };
}

/**
 * Sanitize input string
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Generate initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format currency (Indian Rupees)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format large numbers
 */
export function formatNumber(num: number): string {
  if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract IP and device info from request headers
 */
export function getRequestMeta(headers: Headers): { ipAddress: string; deviceInfo: string } {
  const ipAddress =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown';
  const deviceInfo = headers.get('user-agent') || 'unknown';
  return { ipAddress, deviceInfo };
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Classnames helper (like clsx)
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
