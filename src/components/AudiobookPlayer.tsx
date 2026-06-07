import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Chapter } from '../types';
import { 
  Play, Pause, Volume2, SkipBack, SkipForward, RotateCcw,
  Download, Loader2, RefreshCw
} from 'lucide-react';

interface AudiobookPlayerProps {
  chapter: Chapter | null;
  onPrevChapter?: () => void;
  onNextChapter?: () => void;
  onRegenerateAudio?: () => void;
}

export default function AudiobookPlayer({
  chapter,
  onPrevChapter,
  onNextChapter,
  onRegenerateAudio,
}: AudiobookPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const hasAudio = !!chapter?.audioUrl;
  const isBrowserSpeechMode = !!chapter && chapter.status === 'completed' && !hasAudio;

  // Estimate duration for local SpeechSynthesis based on text length (approx 12.5 chars per sec)
  const estimatedDuration = chapter ? Math.max(10, Math.floor(chapter.content.length / 12.5)) : 0;

  // Function to initialize and speak using SpeechSynthesis starting from specific character index
  const startSpeechSynthesisPlay = (startCharOffset: number = 0) => {
    if (!chapter) return;
    window.speechSynthesis.cancel();

    const fullText = chapter.content;
    const speakText = fullText.substring(startCharOffset).trim();
    if (!speakText) {
      setIsPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(speakText);
    utteranceRef.current = utterance;

    // Apply speed mapping
    utterance.rate = speed;
    utterance.volume = volume;
    utterance.lang = 'vi-VN';

    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find(v => v.lang.includes('vi') || v.lang.includes('VI'));
    if (viVoice) {
      utterance.voice = viVoice;
    }

    // Dynamic progression tracking using characters spoken
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const actualCharIndex = startCharOffset + event.charIndex;
        const ratio = actualCharIndex / fullText.length;
        setCurrentTime(ratio * estimatedDuration);
      }
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      utteranceRef.current = null;
      if (onNextChapter) {
        onNextChapter();
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') {
        setIsPlaying(false);
        utteranceRef.current = null;
      }
    };

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  // Synchronize audio element / speech synthesis when chapter changes
  useEffect(() => {
    // Reset all playback devices
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);

    if (chapter?.audioUrl) {
      setIsAudioLoading(true);
      const audio = new Audio(chapter.audioUrl);
      audioRef.current = audio;

      audio.oncanplaythrough = () => {
        setIsAudioLoading(false);
      };

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (onNextChapter) onNextChapter();
      };

      audio.playbackRate = speed;
      audio.volume = volume;

      // Autoplay if completed
      if (chapter.status === 'completed') {
        audio.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setIsPlaying(false);
        });
      }
    } else if (chapter?.status === 'completed') {
      // Browser Speech Mode auto-play
      setDuration(estimatedDuration);
      // Wait momentarily for voices to load in background on some browsers
      setTimeout(() => {
        startSpeechSynthesisPlay(0);
      }, 100);
    } else {
      setDuration(0);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      window.speechSynthesis.cancel();
    };
  }, [chapter?.audioUrl, chapter?.id]);

  // Handle Play/Pause
  const togglePlayPause = () => {
    if (isBrowserSpeechMode) {
      if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
      } else {
        const ratio = currentTime / estimatedDuration;
        const targetCharOffset = Math.floor(ratio * (chapter?.content.length || 0));
        startSpeechSynthesisPlay(targetCharOffset);
      }
    } else {
      if (!audioRef.current) return;

      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch((e) => {
          console.error('Audio playback failed:', e);
        });
      }
    }
  };

  // Seek bar implementation
  const handleSeekChange = (e: ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    
    if (isBrowserSpeechMode) {
      setCurrentTime(time);
      const ratio = time / estimatedDuration;
      const targetCharIdx = Math.floor(ratio * (chapter?.content.length || 0));
      
      if (isPlaying) {
        startSpeechSynthesisPlay(targetCharIdx);
      } else {
        setCurrentTime(time);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      }
    }
  };

  // Speed adjustments
  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (isBrowserSpeechMode) {
      if (isPlaying) {
        const ratio = currentTime / estimatedDuration;
        const targetCharIdx = Math.floor(ratio * (chapter?.content.length || 0));
        setTimeout(() => {
          startSpeechSynthesisPlay(targetCharIdx);
        }, 50);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.playbackRate = newSpeed;
      }
    }
  };

  // Volume adjustments
  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (isBrowserSpeechMode) {
      if (utteranceRef.current) {
        utteranceRef.current.volume = val;
      }
    } else {
      if (audioRef.current) {
        audioRef.current.volume = val;
      }
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!chapter) {
    return (
      <div className="bg-[#FAF9F7] border border-[#E8E4DF] rounded-2xl p-6 text-center text-[#8C8379] font-medium text-xs">
        Chọn một chương đã hoàn thiện để hiển thị thanh điều khiển âm thanh đại diện
      </div>
    );
  }

  const isPlayable = hasAudio || isBrowserSpeechMode;

  return (
    <div className="bg-white border border-[#E8E4DF] rounded-2xl p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all duration-300" id="audio-playback-deck">
      {/* Chapter Information */}
      <div className="flex items-center space-x-3.5 min-w-0 max-w-sm">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all ${
          isPlaying 
            ? 'bg-[#5A5A40] text-white animate-pulse border-[#5A5A40]' 
            : 'bg-[#FAF9F7] text-[#5A5A40] border-[#E8E4DF]'
        }`}>
          <Volume2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-[#A69076] uppercase tracking-wider">Đang Phát Chương Nói</p>
          <h4 className="text-sm font-serif font-bold text-[#2D2D2D] truncate leading-tight mt-0.5">
            {chapter.title}
          </h4>
          <p className="text-xs text-[#8C8379] mt-0.5">
            {hasAudio ? `Chất lượng cao • Ngắt câu tự nhiên` : isBrowserSpeechMode ? `Giọng đọc Máy • Offline Miễn phí` : `Chưa tạo tệp dữ liệu âm thanh`}
          </p>
        </div>
      </div>

      {/* Main Play Deck */}
      <div className="flex-1 max-w-xl flex flex-col items-center">
        {isPlayable ? (
          <div className="w-full space-y-2">
            {/* Seekbar and timers */}
            <div className="flex items-center space-x-3 text-xs font-bold text-[#6B665F]">
              <span>{formatTime(currentTime)}</span>
              <input
                id="audio-seek-bar"
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeekChange}
                className="flex-1 accent-[#5A5A40] h-1 bg-[#E8E4DF] hover:bg-[#D6CFC7] rounded-lg cursor-pointer transition-colors"
                style={{
                  background: `linear-gradient(to right, #5A5A40 0%, #5A5A40 ${
                    (currentTime / (duration || 1)) * 100
                  }%, #E8E4DF ${(currentTime / (duration || 1)) * 100}%, #E8E4DF 100%)`,
                }}
              />
              <span>{formatTime(duration)}</span>
            </div>

            {/* Play controls */}
            <div className="flex items-center justify-center space-x-4">
              <button
                id="btn-prev-track"
                onClick={onPrevChapter}
                disabled={!onPrevChapter}
                className="p-1.5 rounded-lg text-[#8C8379] hover:text-[#5A5A40] hover:bg-[#FAF9F7] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Chương trước"
              >
                <SkipBack className="h-4.5 w-4.5" />
              </button>

              <button
                id="btn-main-playback"
                onClick={togglePlayPause}
                disabled={isAudioLoading}
                className="w-11 h-11 rounded-full bg-[#5A5A40] text-white flex items-center justify-center hover:opacity-90 transition-opacity shadow-md"
                title={isPlaying ? "Tạm dừng" : "Phát"}
              >
                {isAudioLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-5 w-5 fill-current text-current" />
                ) : (
                  <Play className="h-5 w-5 fill-current translate-x-0.5 text-current" />
                )}
              </button>

              <button
                id="btn-next-track"
                onClick={onNextChapter}
                disabled={!onNextChapter}
                className="p-1.5 rounded-lg text-[#8C8379] hover:text-[#5A5A40] hover:bg-[#FAF9F7] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Chương tiếp theo"
              >
                <SkipForward className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-3 text-sm text-[#8C8379]">
            <span>Chương này chưa được chuyển đổi thành tệp âm thanh</span>
            <button
              id="btn-quick-tts-generate"
              onClick={onRegenerateAudio}
              className="px-3.5 py-1.5 bg-[#5A5A40] hover:opacity-95 text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-all"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Chuyển audio ngay</span>
            </button>
          </div>
        )}
      </div>

      {/* Speed, Volume & Download toolkit */}
      {isPlayable && (
        <div className="flex items-center justify-end space-x-4 min-w-max">
          {/* Speed settings */}
          <div className="flex items-center border border-[#E8E4DF] rounded-lg p-1 bg-[#FAF9F7]">
            {([1.0, 1.25, 1.5] as const).map((s) => (
              <button
                key={s}
                id={`playback-speed-${s}`}
                onClick={() => handleSpeedChange(s)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                  speed === s
                    ? 'bg-white text-[#5A5A40] shadow-sm font-extrabold'
                    : 'text-[#8C8379] hover:text-[#5A5A40]'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Volume slider */}
          <div className="hidden lg:flex items-center space-x-2">
            <Volume2 className="h-4 w-4 text-[#8C8379]" />
            <input
              id="audio-volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={volume}
              onChange={handleVolumeChange}
              className="w-16 accent-[#5A5A40] h-1 bg-[#E8E4DF] rounded-lg cursor-pointer"
            />
          </div>

          {/* Download button */}
          {hasAudio ? (
            <a
              id="btn-download-wav-master"
              href={chapter.audioUrl}
              download={`${chapter.title.replace(/\s+/g, '_')}.wav`}
              className="p-2.5 bg-[#FAF9F7] hover:bg-[#F0EEEB] text-[#5A5A40] border border-[#E8E4DF] rounded-xl transition-all shadow-xs flex items-center justify-center"
              title="Tải tệp âm thanh WAV"
            >
              <Download className="h-4.5 w-4.5" />
            </a>
          ) : (
            <button
              disabled
              className="p-2.5 bg-gray-50 text-gray-300 border border-gray-200 rounded-xl cursor-not-allowed"
              title="Không hỗ trợ tải tệp với Giọng đọc Máy (Offline)"
            >
              <Download className="h-4.5 w-4.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
