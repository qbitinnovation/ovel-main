'use client';

import ComplaintsModule from '@/app/_components/ComplaintsModule';

export default function SuperadminComplaintsPage() {
  return (
    <ComplaintsModule 
      canSubmit={true} 
      canView={true} 
      canResolve={true} 
      canViewAnalytics={true} 
    />
  );
}
