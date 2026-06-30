import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TemplatesView from '@/components/TemplatesView';

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at');

  return <TemplatesView userId={user.id} initialTemplates={templates ?? []} />;
}
