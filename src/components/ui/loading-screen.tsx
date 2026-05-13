"use client"

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background text-foreground">
      <style>{`
        @keyframes logo-breathe {
          0%, 100% { 
            opacity: 1; 
            transform: scale(1); 
          }
          25% { 
            opacity: 0.85; 
            transform: scale(0.88); 
          }
          50% { 
            opacity: 1; 
            transform: scale(1.08); 
          }
          75% { 
            opacity: 0.9; 
            transform: scale(0.95); 
          }
        }
        .animate-logo-breathe {
          animation: logo-breathe 2s ease-in-out infinite;
        }
        @keyframes text-fade {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .animate-text-fade {
          animation: text-fade 2s ease-in-out infinite;
        }
      `}</style>
      <img
        src="/logo-geofal.svg"
        alt="Geofal CRM"
        className="h-36 w-auto animate-logo-breathe"
      />
      {message && (
        <p className="mt-12 text-base font-semibold text-muted-foreground animate-text-fade tracking-wide">
          {message}
        </p>
      )}
    </div>
  )
}
