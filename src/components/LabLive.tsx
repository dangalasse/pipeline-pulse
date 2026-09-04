import { sourceToSrcDoc } from '../../shared/lab-object';

interface LabLiveProps {
  source: string;
  title: string;
  className?: string;
}

export function LabLive({ source, title, className }: LabLiveProps) {
  return (
    <iframe
      className={className ? `lab-live ${className}` : 'lab-live'}
      title={title}
      data-testid="lab-stage"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={sourceToSrcDoc(source)}
    />
  );
}
