import { useState } from 'react';
import { GANG_NAMES } from '../game/city/gen';
import { sfx } from '../game/audio';
import { bus } from '../state/bus';
import { ui, useUI } from '../state/uiStore';
import { ModalShell, useListNav } from './common';

/** Someone's on the payphone with a job. */
export function JobOffer() {
  const job = useUI((s) => s.jobOffer);
  const [index, setIndex] = useState(0);
  if (!job) return null;
  const who = job.giver === 'fixer' ? 'The Fixer' : GANG_NAMES[job.giver];
  const accept = () => {
    sfx('select');
    bus.emit('jobAccepted', { job });
    ui.closeAll();
  };
  const decline = () => {
    sfx('back');
    ui.closeAll();
  };
  const options = [
    { label: `Take it ($${job.reward})`, run: accept },
    { label: 'Hang up', run: decline },
  ];
  return <Offer who={who} brief={job.brief} options={options} index={index} setIndex={setIndex} onBack={decline} />;
}

function Offer({ who, brief, options, index, setIndex, onBack }: { who: string; brief: string; options: { label: string; run: () => void }[]; index: number; setIndex: (i: number) => void; onBack: () => void }) {
  useListNav(options.length, index, setIndex, (i) => options[i].run(), { onBack, horizontal: true });
  return (
    <ModalShell title={`☎ ${who}`} width={520} onClose={onBack}>
      <p className="mb-4 text-lg leading-snug">{brief}</p>
      <div className="flex flex-wrap gap-3">
        {options.map((o, i) => (
          <button
            key={o.label}
            type="button"
            tabIndex={-1}
            data-active={i === index ? 'true' : 'false'}
            onMouseEnter={() => setIndex(i)}
            onClick={o.run}
            className={`pixel-btn cursor-pointer px-4 py-2 text-lg ${i === 0 ? 'text-ember-hi' : ''}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </ModalShell>
  );
}
