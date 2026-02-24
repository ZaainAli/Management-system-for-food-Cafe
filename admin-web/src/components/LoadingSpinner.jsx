export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-primary-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">{message}</p>
      </div>
    </div>
  );
}
