import { Link } from 'react-router-dom';
import { Badge } from './Badge';
import Button from './Button';
import { cn } from '../lib/cn';

export function NoteCard({ note, onDownload, onDelete, className }) {
  return (
    <div className={cn('rounded-2xl bg-card shadow-soft border border-white/20 dark:border-white/10 p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-lg font-semibold leading-snug truncate">{note.title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="primary">{note.subject}</Badge>
            <Badge>{`Sem ${note.semester}`}</Badge>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
          <div className="font-medium text-slate-700 dark:text-slate-200">{note.downloadCount || 0}</div>
          <div>downloads</div>
          {note.ratingCount ? (
            <div className="mt-2">
              <div className="font-medium text-slate-700 dark:text-slate-200">★ {note.ratingAvg || 0}</div>
              <div>{note.ratingCount} ratings</div>
            </div>
          ) : null}
        </div>
      </div>

      {note.description ? (
        <div className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{note.description}</div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to={`/note/${note._id}`}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-white/70 dark:bg-card/60 border border-primary/30 text-primary text-sm font-medium transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          View Details
        </Link>
        {onDelete ? (
          <Button className="w-full" variant="destructive" onClick={() => onDelete?.(note)}>
            Delete
          </Button>
        ) : (
          <Button className="w-full" onClick={() => onDownload?.(note)}>
            Download
          </Button>
        )}
      </div>
    </div>
  );
}
