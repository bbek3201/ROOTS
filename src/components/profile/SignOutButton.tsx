'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const signOut = async () => {
    setLoading(true);
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <Button variant="secondary" fullWidth loading={loading} onClick={signOut}>
      Гарах
    </Button>
  );
}
