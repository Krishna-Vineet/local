import React, { useState } from 'react';
import { useBooth } from '../context/BoothContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, ArrowRight, Settings, Radio } from 'lucide-react';

const BoothLogin = () => {
  const { loginBooth, logoutBooth, session, isRegistered } = useBooth();
  const navigate = useNavigate();
  const [orgId, setOrgId] = useState('');
  const [password, setPassword] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!orgId || !password) {
      setError('Organization ID and Password are required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await loginBooth(orgId, password, deviceName, location);
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center py-12 px-6 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

      {isRegistered ? (
        <div className="z-10 w-full max-w-lg mt-20">
          <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-3xl p-10 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
            
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <Radio size={36} className="animate-pulse" />
            </div>
            
            <h2 className="text-2xl font-bold mb-2">Device Registered</h2>
            <p className="text-slate-400 mb-8">This device is paired to your organization. It will automatically detect when an event is assigned to it via the CRM.</p>

            {session.activeEvent ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-8">
                <p className="text-sm text-emerald-400 font-bold mb-1">CURRENTLY ASSIGNED EVENT</p>
                <p className="text-xl font-medium text-white">{session.activeEvent.name}</p>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 mb-8">
                <Loader2 size={24} className="animate-spin text-indigo-500 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Waiting for event assignment...</p>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <button 
                onClick={() => navigate('/')}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-6 py-4 font-bold transition-all"
              >
                Back to Booth Display
              </button>
              <button 
                onClick={() => {
                  if (window.confirm("Are you sure you want to unregister this device? It will stop receiving events.")) {
                    logoutBooth();
                  }
                }}
                className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl px-6 py-4 font-bold transition-all"
              >
                Unregister Device
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="z-10 w-full max-w-md mt-10">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Booth Setup</span>
            </h1>
            <p className="text-slate-400 text-lg">Register this device to your organization</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Settings size={32} />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Organization ID</label>
                <input
                  type="text"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  placeholder="e.g. 64a7c1b2..."
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Org Admin Password"
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  required
                />
              </div>

              <div className="pt-4 border-t border-slate-700">
                <label className="block text-sm font-medium text-slate-400 mb-1">Device Name (Optional)</label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. iPad Booth 1"
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Location (Optional)</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Main Entrance"
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
              
              {error && (
                <p className="text-rose-400 text-sm text-center mb-4 font-medium animate-pulse mt-4">
                  {error}
                </p>
              )}

              <button 
                type="submit"
                disabled={loading || !orgId || !password}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl px-4 py-4 font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group mt-6"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    Register Device
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoothLogin;
