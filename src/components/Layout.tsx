import React, { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plane, LogIn, LogOut, Globe } from 'lucide-react';
import { auth, loginWithGoogle, logout } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function Layout() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("Auth state changed. Current user:", currentUser?.email || "None");
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 transition-colors">
            <Plane className="w-6 h-6" />
            <span className="font-bold text-xl tracking-tight">{t('app_title')}</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
              <Globe className="w-4 h-4 text-gray-500" />
              <select
                value={i18n.language}
                onChange={(e) => changeLanguage(e.target.value)}
                className="bg-transparent text-sm font-medium text-gray-700 outline-none cursor-pointer"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="pt">Português</option>
                <option value="he">עברית</option>
              </select>
            </div>
            
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium hidden sm:block">{user.displayName}</span>
                <button 
                  onClick={logout}
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:block">{t('logout')}</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={loginWithGoogle}
                className="flex items-center gap-2 text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>{t('login')}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!user && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm flex items-center justify-center">
            {t('local_mode_notice')}
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
