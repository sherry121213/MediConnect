import { Stethoscope } from 'lucide-react';

export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Stethoscope className="h-8 w-8 text-primary" />
      <span className="text-xl font-bold font-headline text-foreground">
        MediAI Assist
      </span>
    </div>
  );
}
