import { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, Check } from 'lucide-react';

export default function MobileInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already installed / running in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      return;
    }

    // 2. Check if previously dismissed (snooze for 3 days)
    const dismissedAt = localStorage.getItem('kvs_install_banner_dismissed');
    if (dismissedAt) {
      const daysSinceDismiss = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < 3) {
        return;
      }
    }

    // 3. Detect mobile device
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    const isAndroidOrMobile = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(userAgent);
    const isSmallScreen = window.innerWidth <= 768;

    setIsIOS(isIOSDevice);

    // 4. Capture PWA beforeinstallprompt on supported mobile browsers
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. If mobile or small screen and not already standalone, display the banner
    if (isAndroidOrMobile || isSmallScreen) {
      // Small timeout for smooth initial page render
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1200);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setTimeout(() => setShowBanner(false), 1500);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      // If browser doesn't support direct trigger, guide the user
      alert("To install, tap your browser's menu (⋮ or Share) and select 'Add to Home Screen' or 'Install App'.");
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('kvs_install_banner_dismissed', Date.now().toString());
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-3 inset-x-3 sm:bottom-5 sm:inset-x-auto sm:right-5 sm:max-w-sm z-50 animate-bounce-in no-print font-sans">
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl shadow-black/60 backdrop-blur-xl text-white">
        <div className="flex items-center gap-3">
          {/* Custom Theme App Icon */}
          <img
            src="/favicon.svg"
            alt="KVS Asset Management App"
            className="w-11 h-11 rounded-xl shadow-md border border-white/10 shrink-0 bg-slate-950 p-0.5 object-contain"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-white tracking-tight truncate">KVS Asset Manager</h4>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                App
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              Install for instant portal access
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {installed ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold px-2 py-1">
                <Check className="w-4 h-4" /> Added
              </span>
            ) : (
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-3 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/30 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close banner"
              aria-label="Close install banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* iOS Step-by-Step Helper Tooltip */}
        {showIOSInstructions && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-300 space-y-1.5 animate-fade-in">
            <p className="font-semibold text-white flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
              To install on your iPhone or iPad:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1">
              <li>
                Tap the <strong className="text-white">Share</strong> button{' '}
                <Share className="inline w-3 h-3 text-blue-400 mx-0.5" /> in Safari
              </li>
              <li>
                Scroll down and select <strong className="text-white">'Add to Home Screen'</strong>{' '}
                <PlusSquare className="inline w-3 h-3 text-blue-400 mx-0.5" />
              </li>
              <li>
                Tap <strong className="text-white">Add</strong> in the top-right corner
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
