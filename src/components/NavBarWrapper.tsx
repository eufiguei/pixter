// src/components/NavBarWrapper.tsx
'use client';

import { usePathname } from 'next/navigation';
import NavBar from '@/components/NavBar';

export default function NavBarWrapper() {
  const pathname = usePathname();
  
  // Updated regex to match longer phone numbers (8-15 digits)
  // This will match paths like /5511995843051
  const isPhoneNumberPage = /^\/\d{8,15}$/.test(pathname);
  
  // Don't render NavBar on phone number pages
  if (isPhoneNumberPage) {
    return null;
  }
  
  return <NavBar />;
}