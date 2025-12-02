import { Plus } from 'lucide-react';

export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-accent rounded-md p-1">
        <Plus className="h-6 w-6 text-white" />
      </div>
      <span className="text-xl font-bold font-headline text-foreground">
        Mediconnect
      </span>
    </div>
  );
}
