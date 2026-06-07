import { useState } from 'react';
import { PREBUILT_VOICES, VoiceAudition } from '../types';
import { Play, Square, Loader2, Volume2, MessageSquare, Info, Sparkles, MapPin, Film, Edit2, X } from 'lucide-react';

interface VoiceSelectorProps {
  selectedVoice: string;
  onSelectVoice: (voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr' | 'BrowserSpeech') => void;
  speakingStyle: string;
  onStyleChange: (style: string) => void;
  scene: string;
  onSceneChange: (scene: string) => void;
  sampleContext: string;
  onSampleContextChange: (context: string) => void;
  apiUsageToday: number;
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
  apiUsageToday,
}: VoiceSelectorProps) {
  const [isPlayingAudition, setIsPlayingAudition] = useState<string | null>(null);
  const [auditionError, setAuditionError] = useState<string | null>(null);
  const [auditionAudio, setAuditionAudio] = useState<HTMLAudioElement | null>(null);

  // Custom Presets State (Now with names)
  const [customScenes, setCustomScenes] = useState<{name: string, value: string}[]>(() => {
    const saved = localStorage.getItem('custom_scenes_v2');
    return saved ? JSON.parse(saved) : [];
  });
  const [customContexts, setCustomContexts] = useState<{name: string, value: string}[]>(() => {
    const saved = localStorage.getItem('custom_contexts_v2');
    return saved ? JSON.parse(saved) : [];
  });

  // Inline Editing State
  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);
  const [editingContextIndex, setEditingContextIndex] = useState<number | null>(null);
  const [tempName, setTempName] = useState("");

  const saveCustomScene = () => {
    if (!scene || scene.trim() === '') return;
    const name = `Bối cảnh ${customScenes.length + 1}`;
    
    const newEntry = { name, value: scene };
    const newScenes = [newEntry, ...customScenes].slice(0, 10);
    setCustomScenes(newScenes);
    localStorage.setItem('custom_scenes_v2', JSON.stringify(newScenes));
  };

  const deleteCustomScene = (val: string) => {
    const newScenes = customScenes.filter(s => s.value !== val);
    setCustomScenes(newScenes);
    localStorage.setItem('custom_scenes_v2', JSON.stringify(newScenes));
  };

  const saveCustomContext = () => {
    if (!sampleContext || sampleContext.trim() === '') return;
    const name = `Sắc thái ${customContexts.length + 1}`;
    
    const newEntry = { name, value: sampleContext };
    const newContexts = [newEntry, ...customContexts].slice(0, 10);
    setCustomContexts(newContexts);
    localStorage.setItem('custom_contexts_v2', JSON.stringify(newContexts));
  };

  const commitSceneName = (index: number) => {
    if (tempName.trim() === "") {
      setEditingSceneIndex(null);
      return;
    }
    const newScenes = [...customScenes];
    newScenes[index].name = tempName;
    setCustomScenes(newScenes);
    localStorage.setItem('custom_scenes_v2', JSON.stringify(newScenes));
    setEditingSceneIndex(null);
  };

  const commitContextName = (index: number) => {
    if (tempName.trim() === "") {
      setEditingContextIndex(null);
      return;
    }
    const newContexts = [...customContexts];
    newContexts[index].name = tempName;
    setCustomContexts(newContexts);
    localStorage.setItem('custom_contexts_v2', JSON.stringify(newContexts));
    setEditingContextIndex(null);
  };

  const deleteCustomContext = (val: string) => {
    const newContexts = customContexts.filter(c => c.value !== val);
    setCustomContexts(newContexts);
    localStorage.setItem('custom_contexts_v2', JSON.stringify(newContexts));
  };

  const usagePercentage = Math.min(100, (apiUsageToday / 10) * 100);
  const isExceeded = apiUsageToday >= 10;

  const playAudition = async (voice: VoiceAudition) => {
    // If already playing this audition, stop it
    if (isPlayingAudition === voice.voiceName) {
      if (voice.voiceName === 'BrowserSpeech') {
        window.speechSynthesis.cancel();
      } else if (auditionAudio) {
        auditionAudio.pause();
        auditionAudio.currentTime = 0;
      }
      setIsPlayingAudition(null);
      return;
    }

    // Stop current playing audio or speech if any
    if (auditionAudio) {
      auditionAudio.pause();
    }
    window.speechSynthesis.cancel();

    setAuditionError(null);
    setIsPlayingAudition(voice.voiceName);

    if (voice.voiceName === 'BrowserSpeech') {
      try {
        const testText = "Xin chào! Đây là giọng đọc máy trực tiếp từ trình duyệt thiết bị của bạn, hoàn toàn miễn phí và không giới hạn!";
        const utterance = new SpeechSynthesisUtterance(testText);
        utterance.lang = 'vi-VN';
        
        // Find Vietnamese voice
        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find(v => v.lang.includes('vi') || v.lang.includes('VI'));
        if (viVoice) {
          utterance.voice = viVoice;
        }

        utterance.onend = () => {
          setIsPlayingAudition(null);
        };
        utterance.onerror = () => {
          setIsPlayingAudition(null);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err: any) {
        setAuditionError(`Không thể nghe thử giọng trình duyệt: ${err.message}`);
        setIsPlayingAudition(null);
      }
      return;
    }

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

      {/* Quota Tracker */}
      <div className="mb-6 p-4 bg-[#FAF9F7] rounded-xl border border-[#E8E4DF]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5">
            <Sparkles className={`h-4 w-4 ${isExceeded ? 'text-rose-500' : 'text-[#A69076]'}`} />
            <span className="text-[11px] font-bold text-[#5A5A40] uppercase tracking-wider">Hạn mức Gemini (10 lượt/ngày)</span>
          </div>
          <span className={`text-xs font-mono font-bold ${isExceeded ? 'text-rose-600' : 'text-[#8C8379]'}`}>
            {apiUsageToday}/10
          </span>
        </div>
        <div className="h-1.5 w-full bg-[#E8E4DF] rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${isExceeded ? 'bg-rose-500' : 'bg-[#A69076]'}`}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
        <p className="mt-2.5 text-[10px] text-[#8C8379] leading-tight font-medium">
          {isExceeded 
            ? 'Bạn đã dùng hết 10 lượt hôm nay. Hãy chuyển sang "Giọng đọc Máy (Browser)" hoặc nạp API Key riêng.' 
            : 'Mẹo: Dùng "Giọng đọc Máy (Browser)" để nghe thử nhanh không tốn lượt API.'}
        </p>
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
            <button 
              onClick={saveCustomScene}
              className="text-[10px] text-[#5A5A40] font-bold hover:underline bg-[#F0EEEB] px-2 py-0.5 rounded cursor-pointer"
            >
              + Lưu làm mẫu riêng
            </button>
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
          <div className="flex flex-wrap gap-1.5 pt-0.5" id="scene-preset-list">
            {/* Render Custom Saved Presets First */}
            {customScenes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 w-full mb-1">
                {customScenes.map((item, idx) => (
                  <div key={`custom-s-${idx}`} className="flex items-center group">
                    {editingSceneIndex === idx ? (
                      <div className="flex items-center">
                        <input
                          autoFocus
                          className="px-2 py-1 text-[10px] font-bold bg-white border border-[#5A5A40] rounded-l outline-none w-[100px]"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitSceneName(idx);
                            if (e.key === 'Escape') setEditingSceneIndex(null);
                          }}
                          onBlur={() => commitSceneName(idx)}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSceneChange(item.value)}
                        className={`px-2 py-1 rounded-l text-[10px] font-bold border-y border-l transition-all max-w-[150px] truncate ${
                          scene === item.value
                            ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                            : 'bg-amber-50 hover:bg-amber-100/50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {item.name}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSceneIndex(idx);
                        setTempName(item.name);
                      }}
                      className="px-1 py-1 text-[10px] bg-white border-y border-r border-[#E8E4DF] hover:bg-gray-50 text-gray-400 hover:text-[#5A5A40] transition-colors"
                      title="Đổi tên"
                    >
                      <Edit2 className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCustomScene(item.value)}
                      className="px-1.5 py-1 text-[10px] bg-white border border-[#E8E4DF] border-l-0 rounded-r hover:text-rose-500 transition-colors"
                      title="Xóa mẫu này"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {[
              { label: 'Phòng thu chuẩn', value: 'A pristine soundproofed studio environment. Completely dry, zero room reflections.' },
              { label: 'Thiếu nhi / Sân chơi', value: 'In a bright, sunny playful nursery room. Cheerful atmosphere with completely comforting and soft acoustics.' },
              { label: 'Phép thuật /🏰 Castle', value: 'A majestic ancient stone castle with echoing great halls, crackling torches, and mystical distant winds. Deep epic atmosphere.' },
              { label: 'Kinh điển / Thư viện đại sảnh', value: 'A prestigious 19th-century grand library. Timeless and elegant acoustic environment with the scent of old paper.' },
              { label: 'Trinh thám / Phòng làm việc đêm', value: 'A dimly lit Victorian study at midnight. Rain pattering against the foggy windowpane, the faint ticking of an old grandfather clock, and a crackling fireplace.' },
              { label: 'Tâm lý / Phòng thư giãn', value: 'A quiet, comforting professional therapy room or a peaceful personal study. Intimate, focused, and distraction-free.' },
              { label: 'Đô thị / Cafe mưa', value: 'Inside a cozy, dimly lit vintage coffee shop. Soft, steady rain pattern outside with elegant warm studio acoustics.' },
              { label: 'Viễn tưởng / Vũ trụ 🚀', value: 'Inside a high-tech spaceship bridge with quiet computing hums, soft electronic chirps, and a vast cosmic silence outline. Tech-heavy acoustics.' },
              { label: 'Kiếm hiệp / Rừng trúc 🎋', value: 'A tranquil mountain bamboo forest at dawn. Soft rustling leaves, gentle flowing stream, chirping birds, and a wide-open, serene outdoor atmosphere.' },
              { label: 'Kinh dị / Nhà hoang 🏚️', value: 'A dark, cold abandoned wooden cabin. Whispering shadows, floorboards creaking softly, and an eerie, tense atmospheric echo.' },
              { label: 'Hùng tráng / Đấu trường 🏟️', value: 'A massive open-air brick colosseum with banners fluttering in the wind. Grand reverbs, public crowd murmur in the deep background, and high gravity atmosphere.' },
              { label: 'Sóng biển / Bãi tắm 🌊', value: 'A breezy seaside beach under palm trees. Soft ocean waves rolling onto the shore, flying seagulls, and a relaxed, sunny open-air soundscape.' }
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
            <button 
              onClick={saveCustomContext}
              className="text-[10px] text-[#5A5A40] font-bold hover:underline bg-[#F0EEEB] px-2 py-0.5 rounded cursor-pointer"
            >
              + Lưu làm mẫu riêng
            </button>
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
          <div className="flex flex-wrap gap-1.5 pt-0.5" id="context-preset-list">
            {/* Render Custom Saved Presets First */}
            {customContexts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 w-full mb-1">
                {customContexts.map((item, idx) => (
                  <div key={`custom-c-${idx}`} className="flex items-center group">
                    {editingContextIndex === idx ? (
                      <div className="flex items-center">
                        <input
                          autoFocus
                          className="px-2 py-1 text-[10px] font-bold bg-white border border-[#5A5A40] rounded-l outline-none w-[100px]"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitContextName(idx);
                            if (e.key === 'Escape') setEditingContextIndex(null);
                          }}
                          onBlur={() => commitContextName(idx)}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSampleContextChange(item.value)}
                        className={`px-2 py-1 rounded-l text-[10px] font-bold border-y border-l transition-all max-w-[150px] truncate ${
                          sampleContext === item.value
                            ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                            : 'bg-indigo-50 hover:bg-indigo-100/50 text-indigo-800 border-indigo-200'
                        }`}
                      >
                         {item.name}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingContextIndex(idx);
                        setTempName(item.name);
                      }}
                      className="px-1 py-1 text-[10px] bg-white border-y border-r border-[#E8E4DF] hover:bg-gray-50 text-gray-400 hover:text-[#5A5A40] transition-colors"
                      title="Đổi tên"
                    >
                      <Edit2 className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCustomContext(item.value)}
                      className="px-1.5 py-1 text-[10px] bg-white border border-[#E8E4DF] border-l-0 rounded-r hover:text-rose-500 transition-colors"
                      title="Xóa mẫu này"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {[
              { label: 'Sách nói tiêu chuẩn', value: 'Natural, dynamic, and clear audiobook narrating tone. Perfectly balanced pacing, expressive but not exaggerated.' },
              { label: 'Kỳ ảo / Phép thuật', value: 'A grand, epic, and highly immersive cinematic narrative style for fantasy worlds. Rich in lore, majestic, suspenseful, carrying the gravity of ancient magic, vast kingdoms, and intense battles.' },
              { label: 'Sách thiếu nhi', value: 'A very playful, sweet, animated, and friendly tone for storytelling to children. Expressive character voices, highly enthusiastic, soft and comforting.' },
              { label: 'Tâm lý học', value: 'A persuasive, empathetic, structured, and insightful psychological non-fiction reading style. Trustworthy, calm, objective yet softly encouraging and deeply knowledgeable.' },
              { label: 'Trinh thám', value: 'A highly observant, suspenseful, and analytical detective narration style. Slightly tense, intelligent, methodical, with a touch of noir mystery and dramatic reveals.' },
              { label: 'Văn học kinh điển', value: 'A sophisticated, refined, and eloquent literary reading voice. Graceful, poetic, and highly dignified, perfectly capturing the depth of classic timeless prose.' },
              { label: 'Ngôn tình / Lãng mạn', value: 'A warm, cozy, and romantic storytelling tone. Very intimate, spoken softly with gentle, affectionate sighs. Smooth, emotional, comforting, and heartfelt narration.' },
              { label: 'Viễn tưởng / Tương lai', value: 'Futuristic, imaginative, and analytical sci-fi storytelling. Paced with scientific wonder, crisp articulation, describing advanced technology, far-off galaxies, and AI operations.' },
              { label: 'Kiếm hiệp / Võ thuật', value: 'An ancient martial arts storyteller format. Highly respectful, swift, rhythmic, full of righteous energy, describing fierce sword fights, qinggong, and heroic pledges with ancient Eastern flavor.' },
              { label: 'Kinh dị / Kỳ bí', value: 'A chilling, hushed, and eerie thriller reading tone. Spoken in a low volume, suspense-filled voice, highlighting sudden shadows, cold breezes, and hair-raising mysterious situations.' },
              { label: 'Hài hước / Trào phúng', value: 'A cheerful, witty, upbeat, and sarcastic narrating style. Animated inflection, humorous dramatic pauses, lighthearted storytelling full of fun and ironies.' },
              { label: 'Bài học cuộc sống / Self-Help', value: 'An inspiring, highly motivational, and warm coaching tone. Confident, charismatic, structured, encouraging, focusing on personal growth, action plans, and empowering advice.' },
              { label: 'Lịch sử / Tài liệu cổ', value: 'An authoritative, objective, and deeply respectful historical documentary voice. Clear pacing, narrative weight, carrying the historical significance of monumental eras and ancient figures.' }
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
