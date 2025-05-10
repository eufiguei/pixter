/// <reference types="react" />
/// <reference types="next" />
/// <reference types="node" />
/// <reference types="react-dom" />

// Type declarations for modules that don't have TypeScript definitions
// This file includes declarations for modules without built-in TypeScript support

declare module 'recharts' {
  import { ComponentType, ReactNode } from 'react';
  
  export interface ResponsiveContainerProps {
    width?: string | number;
    height?: string | number;
    children?: ReactNode;
  }
  
  export interface BaseChartProps {
    data?: any[];
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    children?: ReactNode;
  }
  
  export interface LineChartProps extends BaseChartProps {}
  export interface BarChartProps extends BaseChartProps {}
  
  export interface LineProps {
    type?: string;
    dataKey?: string;
    stroke?: string;
    strokeWidth?: number;
  }
  
  export interface BarProps {
    dataKey: string;
    fill?: string;
    stackId?: string;
    barSize?: number;
    radius?: number | [number, number, number, number];
  }
  
  export interface XAxisProps {
    dataKey?: string;
    axisLine?: boolean;
    tickLine?: boolean;
    fontSize?: number;
  }
  
  export interface YAxisProps {
    axisLine?: boolean;
    tickLine?: boolean;
    tickFormatter?: (value: any) => string;
    fontSize?: number;
  }
  
  export interface CartesianGridProps {
    strokeDasharray?: string;
    vertical?: boolean;
    horizontal?: boolean;
  }
  
  export interface TooltipProps {
    formatter?: (value: any, name: string, props: any) => React.ReactNode;
    labelFormatter?: (label: any) => React.ReactNode;
  }
  
  export const ResponsiveContainer: ComponentType<ResponsiveContainerProps>;
  export const LineChart: ComponentType<LineChartProps>;
  export const BarChart: ComponentType<BarChartProps>;
  export const Line: ComponentType<LineProps>;
  export const Bar: ComponentType<BarProps>;
  export const XAxis: ComponentType<XAxisProps>;
  export const YAxis: ComponentType<YAxisProps>;
  export const CartesianGrid: ComponentType<CartesianGridProps>;
  export const Tooltip: ComponentType<TooltipProps>;
}

// This handles React hooks import issues
declare module 'react' {
  // Re-export all the React hooks and components correctly
  export * from 'react';
  export default React;
}

declare module 'qrcode' {
  export function toDataURL(text: string, options: any, callback: (error: Error | null, url: string) => void): void;
  export function toCanvas(canvas: HTMLCanvasElement | null, text: string, options: any, callback: (error: Error | null) => void): void;
}

declare module 'next/server' {
  export interface NextRequest extends Request {
    cookies: Map<string, string>;
    nextUrl: URL;
  }
  
  export class NextResponse extends Response {
    static json(body: any, init?: ResponseInit): NextResponse;
    static redirect(url: string | URL, init?: ResponseInit): NextResponse;
  }
}

declare module 'next-auth' {
  export interface Session {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      id?: string | null;
    };
    expires: string;
  }

  export interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }
}

declare module 'next-auth/react' {
  export function useSession(): {
    data: import('next-auth').Session | null;
    status: "loading" | "authenticated" | "unauthenticated";
  };
  export function signIn(provider?: string, options?: any): Promise<any>;
  export function signOut(options?: any): Promise<any>;
}

declare module 'stripe' {
  export default class Stripe {
    constructor(apiKey: string, options?: any);
    accounts: {
      retrieve(id: string, options?: any): Promise<any>;
      createLoginLink(id: string): Promise<any>;
      createExternalAccount(id: string, data: any): Promise<any>;
    };
    balance: {
      retrieve(options?: any, requestOptions?: any): Promise<any>;
    };
    balanceTransactions: {
      list(options?: any, requestOptions?: any): Promise<any>;
    };
    charges: {
      list(options?: any, requestOptions?: any): Promise<any>;
    };
    accountLinks: {
      create(options: any): Promise<any>;
    };
  }
}

declare module 'next/navigation' {
  export function useRouter(): {
    push: (url: string) => void;
    replace: (url: string) => void;
    back: () => void;
  };
  
  export function useSearchParams(): URLSearchParams;
  export function usePathname(): string;
  export function redirect(url: string): never;
  export function useParams<T extends Record<string, string | string[]>>(): T;
}

declare module 'date-fns' {
  export function format(date: Date | number, format: string, options?: any): string;
  export function parse(dateString: string, format: string, baseDate: Date, options?: any): Date;
  export function parseISO(dateString: string): Date;
  export function addDays(date: Date | number, amount: number): Date;
  export function subDays(date: Date | number, amount: number): Date;
  export function addWeeks(date: Date | number, amount: number): Date;
  export function subWeeks(date: Date | number, amount: number): Date;
  export function addMonths(date: Date | number, amount: number): Date;
  export function subMonths(date: Date | number, amount: number): Date;
  export function startOfWeek(date: Date | number, options?: { weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 }): Date;
  export function endOfWeek(date: Date | number, options?: { weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 }): Date;
  export function startOfMonth(date: Date | number): Date;
  export function endOfMonth(date: Date | number): Date;
  export function isSameDay(dateLeft: Date | number, dateRight: Date | number): boolean;
}
