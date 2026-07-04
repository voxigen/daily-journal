import { requireUserId } from '@/lib/session';
import SettingsView from '@/components/SettingsView';

export default async function SettingsPage() {
  await requireUserId();
  return <SettingsView />;
}
