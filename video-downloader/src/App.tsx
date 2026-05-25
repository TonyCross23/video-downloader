import React, { useState } from 'react';

interface VideoFormat {
  formatId: string;
  resolution: string;
  ext: string;
  fps: string;
}

interface VideoData {
  title: string;
  thumbnail: string;
  formats: VideoFormat[];
}

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [dlLoading, setDlLoading] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [error, setError] = useState('');

  const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000'; // Change this if your backend is hosted elsewhere

  // 1. Fetch available resolutions and video metadata from API
  const fetchResolutions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    setError('');
    setVideoData(null);

    try {
      const response = await fetch(`${API_BASE}/api/video-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Video data not found');
      setVideoData(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching details');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch binary blob from server and trigger browser download
  const downloadWithQuality = async (formatId: string, resolution: string) => {
    setDlLoading(formatId); // Set loading state for the clicked button only
    try {
      const response = await fetch(`${API_BASE}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, formatId }),
      });

      if (!response.ok) throw new Error('Server rejected the download request');

      // Capture file as a Binary Large Object (Blob)
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      // Create virtual link and trigger automatic browser click
      const a = document.createElement('a');
      a.href = downloadUrl;
      const cleanTitle = videoData?.title?.replace(/[^a-zA-Z0-9 ]/g, "") || 'video';
      a.download = `${cleanTitle}_${resolution}.mp4`; 
      document.body.appendChild(a);
      a.click();
      
      // Clean up memory
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDlLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl p-6 md:p-8">
        <h2 className="text-2xl md:text-3xl font-extrabold text-center text-gray-800 mb-2">
          Video Downloader
        </h2>
        <p className="text-sm text-center text-gray-500 mb-8">
           TikTok video downloader without watermark
        </p>
        
        {/* URL Form */}
        <form onSubmit={fetchResolutions} className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Input Wrapper - relative position for custom clear button alignment */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Paste Link Here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              // pr-10 ensures long text does not clip under the clear button
              className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 shadow-sm"
            />
            
            {/* Show Clear (X) Button only when input has content */}
            {url && (
              <button
                type="button" // type="button" is strict here to prevent accidental form submission
                onClick={() => setUrl('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Clear input"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:bg-blue-400 transition shadow-md whitespace-nowrap"
          >
            {loading ? 'Analyzing...' : 'Get Formats'}
          </button>
        </form>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl font-medium text-center mb-6 border border-red-200">
            {error}
          </div>
        )}

        {/* Video Metadata & Quality Options */}
        {videoData && (
          <div className="border border-gray-200 rounded-xl p-4 md:p-5 bg-gray-50 animate-fadeIn">
            <h3 className="font-bold text-gray-800 text-base md:text-lg mb-3 line-clamp-2 leading-snug">
              {videoData.title}
            </h3>
            
            {videoData.thumbnail && (
              <img 
                src={videoData.thumbnail} 
                alt="video preview" 
                className="w-full h-48 md:h-64 object-cover rounded-lg mb-5 shadow-sm"
              />
            )}
            
            <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 border-b border-gray-200 pb-2">
              Available Qualities:
            </h4>
            
            <div className="flex flex-col gap-3">
              {videoData.formats.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="text-gray-700">
                    Resolution: <span className="font-bold text-blue-600">{f.resolution}</span> 
                    {f.fps && <span className="text-xs text-gray-400 ml-2">({f.fps})</span>}
                  </div>
                  <button 
                    onClick={() => downloadWithQuality(f.formatId, f.resolution)}
                    disabled={dlLoading !== null}
                    className={`px-4 py-2 rounded-md font-bold text-white text-sm shadow transition-colors ${
                      dlLoading === f.formatId 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {dlLoading === f.formatId ? 'Downloading...' : 'Download'}
                  </button>
                </div>
              ))}
              
              {videoData.formats.length === 0 && (
                <p className="text-gray-500 text-center text-sm py-4">No downloadable MP4 formats found.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;