import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useBooth } from '../context/BoothContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Lock, Loader2, ArrowRight } from 'lucide-react';

const JoinEvent = () => {
  const { joinEvent, session, leaveEvent } = useBooth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [passkey, setPasskey] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const apiUrl = rawApiUrl.replace(/\/+$/, '');
        const res = await axios.get(`${apiUrl}/api/events/public/list`);
        setEvents(res.data);
      } catch (err) {
        console.error('Failed to fetch events:', err);
        setError('Failed to load events. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!passkey) {
      setError('Please enter a passkey');
      return;
    }

    try {
      setJoining(true);
      setError('');
      await joinEvent(selectedEvent._id, passkey);
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Invalid passkey. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center py-12 px-6 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

      {session.activeEvent ? (
        <div className="z-10 w-full max-w-lg mt-20">
          <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-3xl p-10 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
            
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock size={36} />
            </div>
            
            <h2 className="text-2xl font-bold mb-2">Connected to Event</h2>
            <p className="text-emerald-400 font-bold text-xl mb-8">{session.activeEvent.name}</p>

            <div className="flex flex-col gap-4">
              <button 
                onClick={() => navigate('/')}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-6 py-4 font-bold transition-all"
              >
                Back to Photobooth
              </button>
              <button 
                onClick={() => {
                  if (window.confirm("Are you sure you want to leave this event? The photobooth will revert to default settings.")) {
                    leaveEvent();
                    window.location.reload(); // Refresh to clear state properly
                  }
                }}
                className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl px-6 py-4 font-bold transition-all"
              >
                Disconnect & Leave Event
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="z-10 w-full max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Join <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">HappyPix</span> Event
            </h1>
            <p className="text-slate-400 text-lg">Select an event below to initialize the photobooth</p>
          </div>

          {error && !selectedEvent && (
            <div className="bg-rose-500/10 border border-rose-500/50 text-rose-400 px-6 py-4 rounded-2xl mb-8 text-center font-medium">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
              <p className="text-slate-400">Loading available events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-3xl p-12 text-center shadow-2xl">
              <Calendar size={64} className="mx-auto text-slate-500 mb-6" />
              <h2 className="text-2xl font-bold mb-2">No active events</h2>
              <p className="text-slate-400">There are no live or upcoming events right now. Create one in the CRM Admin panel to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {events.map((event) => (
                <div 
                  key={event._id}
                  onClick={() => { setSelectedEvent(event); setError(''); setPasskey(''); }}
                  className="group relative bg-slate-800/60 backdrop-blur-md border border-slate-700 hover:border-indigo-500/50 rounded-3xl p-6 cursor-pointer transition-all hover:shadow-[0_0_40px_-10px_rgba(99,102,241,0.3)] hover:-translate-y-1 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-slate-100 group-hover:text-white transition-colors pr-4">
                      {event.name}
                    </h3>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                      event.status === 'live' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {event.status === 'live' ? 'LIVE' : 'UPCOMING'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-indigo-400" />
                      <span>{new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-indigo-400" />
                        <span>{event.location}</span>
                      </div>
                    )}
                    {event.shortCode && (
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-700/50">
                        <Lock size={14} className="text-slate-500" />
                        <span className="font-mono text-slate-300">Code: {event.shortCode}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Passkey Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedEvent(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              ✕
            </button>
            
            <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Lock size={32} />
            </div>
            
            <h2 className="text-2xl font-bold text-center mb-2">Enter Passkey</h2>
            <p className="text-slate-400 text-center mb-8">
              To join <span className="text-white font-medium">{selectedEvent.name}</span>
            </p>

            <form onSubmit={handleJoin}>
              <input
                type="password"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="Enter event passkey..."
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-4 text-center text-xl tracking-[0.2em] mb-4 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:tracking-normal placeholder:text-base"
                autoFocus
              />
              
              {error && (
                <p className="text-rose-400 text-sm text-center mb-4 font-medium animate-pulse">
                  {error}
                </p>
              )}

              <button 
                type="submit"
                disabled={joining || !passkey}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl px-4 py-4 font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {joining ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    Join Photobooth
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

export default JoinEvent;
