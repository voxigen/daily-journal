import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="offline-page">
      <WifiOff />
      <h2>Нет соединения</h2>
      <p>Проверь интернет и попробуй снова</p>
    </div>
  );
}
