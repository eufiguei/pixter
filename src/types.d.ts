/// <reference types="react" />
/// <reference types="next" />
/// <reference types="node" />
/// <reference types="react-dom" />

// Add type references for libraries without type declarations
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
