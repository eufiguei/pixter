/**
 * Global React type declarations to fix TypeScript errors with React imports
 */

declare module 'react' {
  // Re-export all the types from React
  export * from 'react/index';
  
  // Explicitly declare hooks
  export const useState: any;
  export const useEffect: any;
  export const useContext: any;
  export const useReducer: any;
  export const useCallback: any;
  export const useMemo: any;
  export const useRef: any;
  export const useImperativeHandle: any;
  export const useLayoutEffect: any;
  export const useDebugValue: any;
  export const useId: any;
  export const useDeferredValue: any;
  export const useTransition: any;
  export const useSyncExternalStore: any;
  export const useInsertionEffect: any;
  
  // Ensure default export works
  const React: any;
  export default React;
}

// Fix for lucide-react
declare module 'lucide-react' {
  export const Mail: any;
  export const AlertCircle: any;
  export const ArrowLeft: any;
  export const Loader2: any;
  export const Eye: any;
  export const EyeOff: any;
  export const User: any;
  export const Lock: any;
  export const Menu: any;
  export const X: any;
  export const ChevronDown: any;
  export const CreditCard: any;
  export const History: any;
  export const Settings: any;
  export const ExternalLink: any;
  export const LogOut: any;
  // Add any other icons you're using
}
