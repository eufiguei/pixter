// src/app/motorista/dashboard/page.tsx
// This page now simply redirects to the overview page.

import { redirect } from 'next/navigation';

export default function DashboardRedirectPage() {
  redirect('/motorista/dashboard/overview');
  // Return null or a loading indicator if needed, but redirect should handle it.
  return null;
}

