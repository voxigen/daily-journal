import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import HistoryView from '@/components/HistoryView';

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: entries } = await supabase
    .from('daily_entries')
    .select('date, done, notes')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(60);

  return <HistoryView entries={entries ?? []} />;
}
