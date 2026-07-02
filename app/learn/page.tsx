import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LearnView from '@/components/LearnView';

export default async function LearnPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: cards } = await supabase
    .from('vocab_cards')
    .select('id, en, ru, due, fsrs')
    .eq('user_id', user.id)
    .order('due', { ascending: true });

  return <LearnView userId={user.id} initialCards={cards ?? []} />;
}
