import { sourceToSrcDoc } from '../../shared/lab-object';

interface LabLiveProps {
  source: string;
  title: string;
}

export function LabLive({ source, title }: LabLiveProps) {
  return (
    <iframe
      className="lab-live"
      title={title}
      data-testid="lab-stage"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={sourceToSrcDoc(source)}
    />
  );
}
