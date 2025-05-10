/// <reference types="react" />
/// <reference types="react-dom" />

// This file is created to help TypeScript resolve React and other module types
// It supplements the existing type declarations in node_modules/@types

declare namespace React {
  // Make sure all React types are properly recognized
  export * from 'react';
  
  // Add common event types
  export interface ChangeEvent<T = Element> {
    target: T & {
      value: string;
      name?: string;
      type?: string;
      checked?: boolean;
    };
  }
  
  export interface FormEvent<T = Element> {
    preventDefault(): void;
    target: T;
  }
  
  export interface MouseEvent<T = Element, E = NativeMouseEvent> {
    preventDefault(): void;
    stopPropagation(): void;
    target: T;
  }
}

declare module "*.svg" {
  const content: any;
  export default content;
}

// Ensure that next-auth types work correctly
declare module "next-auth/react" {
  import { Session } from "next-auth";
  
  export interface DefaultSession {
    user?: {
      id?: string;
      nome?: string;  // Note: using 'nome' instead of 'name'
      email?: string;
      image?: string;
      tipo?: string;
    };
  }
  
  export type SessionContextValue = {
    data: Session | null;
    status: "loading" | "authenticated" | "unauthenticated";
  };
  
  export function signIn(provider?: string, options?: any): Promise<any>;
  export function signOut(options?: any): Promise<any>;
  export function useSession(): SessionContextValue;
  export function getSession(options?: any): Promise<Session | null>;
}
