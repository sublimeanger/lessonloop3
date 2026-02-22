import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AudioPlayerProps {
  filePath: string;
  title?: string;
}

export function AudioPlayer({ filePath, title }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState(false);

  // Fetch signed URL on mount
  useEffect(() => {
    let cancelled = false;
    const fetchUrl = async () => {
      setLoading(true);
      try {
        const { data, error: err } = await supabase.storage
          .from('teaching-resources')
          .createSignedUrl(filePath, 3600);
        if (cancelled) return;
        if (err) throw err;
        setSignedUrl(data.signedUrl);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchUrl();

    // Refresh URL before expiry (55 min)
    const refreshTimer = setInterval(fetchUrl, 55 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
    };
  }, [filePath]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleEnded = () => setPlaying(false);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 mt-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading audio…</span>
      </div>
    );
  }

  if (error || !signedUrl) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 mt-2">
      <audio
        ref={audioRef}
        src={signedUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        muted={muted}
        preload="metadata"
      />

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={togglePlay}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>

      <span className="text-xs text-muted-foreground w-9 shrink-0 tabular-nums">
        {formatTime(currentTime)}
      </span>

      <Slider
        value={[currentTime]}
        max={duration || 1}
        step={0.5}
        onValueChange={handleSeek}
        className="flex-1"
      />

      <span className="text-xs text-muted-foreground w-9 shrink-0 tabular-nums">
        {formatTime(duration)}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => setMuted(!muted)}
      >
        {muted ? (
          <VolumeX className="h-3.5 w-3.5" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
