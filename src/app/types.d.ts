// Type declarations for modules without built-in type definitions
declare module 'react' {
  import * as React from 'react';
  export = React;
  export as namespace React;
}

declare module 'next/navigation' {
  export function useRouter(): {
    push: (url: string) => void;
    replace: (url: string) => void;
    back: () => void;
  };
  
  export function useSearchParams(): URLSearchParams;
  export function usePathname(): string;
}

declare module 'next/link' {
  import { ComponentProps, ComponentType } from 'react';
  
  export interface LinkProps extends ComponentProps<'a'> {
    href: string;
    as?: string;
    replace?: boolean;
    scroll?: boolean;
    shallow?: boolean;
    passHref?: boolean;
    prefetch?: boolean;
  }
  
  const Link: ComponentType<LinkProps>;
  export default Link;
}

declare module 'next-auth/react' {
  export interface Session {
    user?: {
      id?: string;
      nome?: string;
      email?: string;
      image?: string;
      tipo?: string;
    };
    expires: string;
  }
  
  export function signIn(provider?: string, options?: any): Promise<any>;
  export function signOut(options?: any): Promise<any>;
  export function useSession(): {
    data: Session | null;
    status: 'loading' | 'authenticated' | 'unauthenticated';
  };
  export function getSession(options?: any): Promise<Session | null>;
}

declare module 'recharts' {
  import { ComponentType, ReactNode } from 'react';
  
  export interface ResponsiveContainerProps {
    width?: string | number;
    height?: string | number;
    children?: ReactNode;
  }
  
  export interface LineChartProps {
    data?: any[];
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    children?: ReactNode;
  }
  
  export interface LineProps {
    type?: string;
    dataKey?: string;
    stroke?: string;
    strokeWidth?: number;
  }
  
  export interface XAxisProps {
    dataKey?: string;
    axisLine?: boolean;
    tickLine?: boolean;
  }
  
  export interface YAxisProps {
    axisLine?: boolean;
    tickLine?: boolean;
    tickFormatter?: (value: any) => string;
  }
  
  export interface CartesianGridProps {
    strokeDasharray?: string;
  }
  
  export interface TooltipProps {
    formatter?: (value: any, name: string, props: any) => React.ReactNode;
    labelFormatter?: (label: any) => React.ReactNode;
  }
  
  export const ResponsiveContainer: ComponentType<ResponsiveContainerProps>;
  export const LineChart: ComponentType<LineChartProps>;
  export const Line: ComponentType<LineProps>;
  export const XAxis: ComponentType<XAxisProps>;
  export const YAxis: ComponentType<YAxisProps>;
  export const CartesianGrid: ComponentType<CartesianGridProps>;
  export const Tooltip: ComponentType<TooltipProps>;
}

declare module 'date-fns' {
  export function format(date: Date | number, format: string, options?: any): string;
  export function parse(dateString: string, format: string, baseDate: Date, options?: any): Date;
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
