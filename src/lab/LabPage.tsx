import { useEffect, useState } from 'react';
import { DEFAULT_LAB_SOURCE, type LabObject } from '../../shared/lab-object';
import { LabLive } from '../components/LabLive';

export function LabPage() {
  const [source, setSource] = useState(DEFAULT_LAB_SOURCE);

  useEffect(() => {
    document.title = 'Palco · Pipeview';
    let cancelled = false;
    fetch('/api/lab-object')
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as LabObject;
      })
      .then((data) => {
        if (!cancelled && data.source) setSource(data.source);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="lab-page">
      <LabLive source={source} title="palco" />
    </div>
  );
}
