import { useState } from 'react';
import { PREBUILT_VOICES, VoiceAudition } from '../types';
import { Play, Square, Loader2, Volume2, MessageSquare, Info, Sparkles, MapPin, Film } from 'lucide-react';

interface VoiceSelectorProps {
  selectedVoice: string;
  onSelectVoice: (voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr') => void;
  speakingStyle: string;
  onStyleChange: (style: string) => void;
  scene: string;
  onSceneChange: (scene: string) => void;
  sampleContext: string;
  onSampleContextChange: (context: string) => void;
}

export default function VoiceSelector({
  selectedVoice,
  onSelectVoice,
  speakingStyle,
  onStyleChange,
  scene,
  onSceneChange,
  sampleContext,
  onSampleContextChange,
}: VoiceSelectorProps) {
  const [isPlayingAudition, setIsPlayingAudition] = useState<string | null>(null);
  const [auditionError, setAuditionError] = useState<string | null>(null);
  const [auditionAudio, setAuditionAudio] = useState<HTMLAudioElement | null>(null);

  const playAudition = async (voice: VoiceAudition) => {
    // If already playing this audition, stop it
    if (isPlayingAudition === voice.voiceName) {
      if (auditionAudio) {
        auditionAudio.pause();
        auditionAudio.currentTime = 0;
      }
      setIsPlayingAudition(null);
      return;
    }

    // Stop current playing audio if any
    if (auditionAudio) {
      auditionAudio.pause();
    }

    setAuditionError(null);
    setIsPlayingAudition(voice.voiceName);

    try {
      const isVietnamese = true;
      const testText = `Hệ thống giọng đọc ${voice.displayName.split(' ')[0]} đang kết nối thành công.`;

      const response = await fetch('/api/ebook/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          voiceName: voice.voiceName,
          speakingStyle: speakingStyle,
          scene: scene,
          sampleContext: sampleContext,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Lỗi kết nối tts.');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      setAuditionAudio(audio);
      audio.play();
      
      audio.onended = () => {
        setIsPlayingAudition(null);
        URL.revokeObjectURL(audioUrl);
      };
    } catch (err: any) {
      console.error(err);
      setAuditionError(`Không thể nghe thử: ${err.message}`);
      setIsPlayingAudition(null);
    }
  };

  return (
    <div className="bg-white border border-[#E8E4DF] rounded-2xl p-6 shadow-sm" id="voice-selector-section">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2.5 bg-[#FAF9F7] text-[#5A5A40] rounded-xl border border-[#E8E4DF]">
          <Volume2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-serif font-semibold text-[#2D2D2D] tracking-tight">Diễn Viên Giọng Đọc</h2>
          <p className="text-xs text-[#8C8379] font-medium leading-normal">Chọn chất giọng tự nhiên tối ưu nhất cho văn bản sách</p>
        </div>
      </div>

      {auditionError && (
        <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50/50 p-3 rounded-lg border border-rose-100">
          {auditionError}
        </div>
      )}

      {/* Grid of Voices */}
      <div className="space-y-3.5 mb-6">
        {PREBUILT_VOICES.map((v) => {
          const isSelected = selectedVoice === v.voiceName;
          const isAuditioning = isPlayingAudition === v.voiceName;

          return (
            <div
              key={v.voiceName}
              id={`voice-${v.voiceName}`}
              onClick={() => onSelectVoice(v.voiceName)}
              className={`group flex items-start justify-between p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                isSelected
                  ? 'border-[#5A5A40] bg-[#FAF9F7] shadow-inner'
                  : 'border-[#E8E4DF] hover:border-[#D6CFC7] hover:bg-[#FCFBF9]'
              }`}
            >
              <div className="flex-1 pr-3">
                <div className="flex items-center space-x-2 mb-1.5 flex-wrap gap-y-1">
                  <span className={`text-sm font-semibold transition-colors duration-250 ${
                    isSelected ? 'text-[#5A5A40]' : 'text-[#3D3D3D] group-hover:text-[#5A5A40]'
                  }`}>
                    {v.displayName}
                  </span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                    v.gender === 'Female' 
                      ? 'bg-[#FDF6F0] text-[#A69076] border border-[#F0EEEB]' 
                      : 'bg-[#F0EEEB] text-[#6B665F] border border-[#E8E4DF]'
                  }`}>
                    {v.gender === 'Female' ? 'NỮ' : 'NAM'}
                  </span>
                </div>
                <p className="text-xs text-[#8C8379] mb-1 font-medium">{v.accent}</p>
                <p className="text-[11px] text-[#A69076] leading-relaxed font-normal">{v.vocalDescription}</p>
              </div>

              <button
                id={`btn-audition-${v.voiceName}`}
                onClick={(e) => {
                  e.stopPropagation();
                  playAudition(v);
                }}
                className={`flex-shrink-0 p-2.5 rounded-lg border transition-all duration-200 ${
                  isAuditioning
                    ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                    : 'bg-white hover:bg-[#FAF9F7] text-[#6B665F] border-[#E8E4DF] hover:text-[#5A5A40]'
                }`}
                title="Nghe thử giọng này"
              >
                {isAuditioning ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <Play className="h-4 w-4 fill-current text-current" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Speaking Style Prompt Selection */}
      <div className="border-t border-[#E8E4DF] pt-5 space-y-5">
        
        {/* SCENE (Bối cảnh không gian) */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#6B665F] uppercase tracking-wider flex items-center justify-between" htmlFor="scene-input">
            <span className="flex items-center space-x-1.5">
              <MapPin className="h-4 w-4 text-[#A69076]" />
              <span>Scene (Bối cảnh không gian)</span>
            </span>
            <span className="text-[10px] text-[#A69076] font-semibold">Tùy chọn không khí nền</span>
          </label>
          <textarea
            id="scene-input"
            rows={2}
            className="w-full px-3.5 py-2.5 bg-[#FCFBF9] border border-[#D6CFC7] rounded-xl text-xs text-[#3D3D3D] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:bg-white transition-all duration-200 resize-none leading-relaxed"
            placeholder="Ví dụ: A grand stone throne room with a roaring fireplace. Echoing, wide acoustics..."
            value={scene}
            onChange={(e) => onSceneChange(e.target.value)}
          />
          {/* Scene Presets */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {[
              { label: 'Phòng thu chuẩn', value: 'A pristine soundproofed studio environment. Completely dry, zero room reflections.' },
              { label: 'Thiếu nhi / Sân chơi', value: 'In a bright, sunny playful nursery room. Cheerful atmosphere with completely comforting and soft acoustics.' },
              { label: 'Phép thuật /🏰 Castle', value: 'A majestic ancient stone castle with echoing great halls, crackling torches, and mystical distant winds. Deep epic atmosphere.' },
              { label: 'Kinh điển / Thư viện đại sảnh', value: 'A prestigious 19th-century grand library. Timeless and elegant acoustic environment with the scent of old paper.' },
              { label: 'Trinh thám / Phòng làm việc đêm', value: 'A dimly lit Victorian study at midnight. Rain pattering against the foggy windowpane, the faint ticking of an old grandfather clock, and a crackling fireplace.' },
              { label: 'Tâm lý / Phòng thư giãn', value: 'A quiet, comforting professional therapy room or a peaceful personal study. Intimate, focused, and distraction-free.' },
              { label: 'Đô thị / Cafe mưa', value: 'Inside a cozy, dimly lit vintage coffee shop. Soft, steady rain pattern outside with elegant warm studio acoustics.' }
            ].map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSceneChange(p.value)}
                className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                  scene === p.value
                    ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                    : 'bg-white hover:bg-[#FAF9F7] text-[#6B665F] border-[#E8E4DF]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* SAMPLE CONTEXT (Sắc thái / Tông giọng mẫu) */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#6B665F] uppercase tracking-wider flex items-center justify-between" htmlFor="sample-context-input">
            <span className="flex items-center space-x-1.5">
              <Film className="h-4 w-4 text-[#A69076]" />
              <span>Sample Context (Sắc thái tiểu thuyết)</span>
            </span>
            <span className="text-[10px] text-[#A69076] font-semibold">Tông chính của câu chuyện</span>
          </label>
          <textarea
            id="sample-context-input"
            rows={2.5}
            className="w-full px-3.5 py-2.5 bg-[#FCFBF9] border border-[#D6CFC7] rounded-xl text-xs text-[#3D3D3D] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:bg-white transition-all duration-200 resize-none leading-relaxed"
            placeholder="Ví dụ: Epic dark fantasy. Authoritative, cinematic, and deeply narrative tone. Slow and weighted with dramatic pauses..."
            value={sampleContext}
            onChange={(e) => onSampleContextChange(e.target.value)}
          />
          {/* Context Presets */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {[
              { label: 'Sách nói tiêu chuẩn', value: 'Natural, dynamic, and clear audiobook narrating tone. Perfectly balanced pacing, expressive but not exaggerated.' },
              { label: 'Kỳ ảo / Phép thuật', value: 'A grand, epic, and highly immersive cinematic narrative style for fantasy worlds. Rich in lore, majestic, suspenseful, carrying the gravity of ancient magic, vast kingdoms, and intense battles.' },
              { label: 'Sách thiếu nhi', value: 'A very playful, sweet, animated, and friendly tone for storytelling to children. Expressive character voices, highly enthusiastic, soft and comforting.' },
              { label: 'Tâm lý học', value: 'A persuasive, empathetic, structured, and insightful psychological non-fiction reading style. Trustworthy, calm, objective yet softly encouraging and deeply knowledgeable.' },
              { label: 'Trinh thám', value: 'A highly observant, suspenseful, and analytical detective narration style. Slightly tense, intelligent, methodical, with a touch of noir mystery and dramatic reveals.' },
              { label: 'Văn học kinh điển', value: 'A sophisticated, refined, and eloquent literary reading voice. Graceful, poetic, and highly dignified, perfectly capturing the depth of classic timeless prose.' },
              { label: 'Ngôn tình / Lãng mạn', value: 'A warm, cozy, and romantic storytelling tone. Very intimate, spoken softly with gentle, affectionate sighs. Smooth, emotional, comforting, and heartfelt narration.' },
            ].map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSampleContextChange(p.value)}
                className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                  sampleContext === p.value
                    ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                    : 'bg-white hover:bg-[#FAF9F7] text-[#6B665F] border-[#E8E4DF]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* SPEAKING STYLE & SHORT EXPRESSION */}
        <div className="space-y-2 border-t border-[#E8E4DF]/60 pt-4">
          <label className="block text-xs font-bold text-[#6B665F] uppercase tracking-wider flex items-center space-x-1.5" htmlFor="speaking-style-input">
            <MessageSquare className="h-4 w-4 text-[#A69076]" />
            <span>Biểu cảm & Gợi ý nhanh (Style)</span>
          </label>
          <input
            id="speaking-style-input"
            type="text"
            className="w-full px-3.5 py-2.5 bg-white border border-[#D6CFC7] rounded-xl text-sm text-[#3D3D3D] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5A5A40] transition-all duration-200"
            placeholder="Ví dụ: calm speaking, gentle whispering, active storytelling..."
            value={speakingStyle}
            onChange={(e) => onStyleChange(e.target.value)}
          />
        </div>

        <div className="bg-[#FAF9F7] border border-[#E8E4DF] p-3.5 rounded-xl text-[11px] text-[#6B665F] leading-relaxed flex items-start space-x-2">
          <Info className="h-4 w-4 text-[#A69076] mt-0.5 flex-shrink-0" />
          <div>
            <strong className="font-semibold text-[#3D3D3D]">Mẹo chuyên nghiệp:</strong> Các chỉ dẫn bằng tiếng Anh đem lại hiệu ứng âm thanh và sắc thái biểu cảm diễn sâu nhất từ hệ thống Gemini Speech.
          </div>
        </div>

      </div>
    </div>
  );
}
