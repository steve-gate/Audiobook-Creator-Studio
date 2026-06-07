import { useState, useEffect, ChangeEvent, DragEvent } from 'react';
import { Chapter, BookProject, PREBUILT_VOICES } from './types';
import VoiceSelector from './components/VoiceSelector';
import ChapterList from './components/ChapterList';
import ChapterEditor from './components/ChapterEditor';
import AudiobookPlayer from './components/AudiobookPlayer';
import { saveAudioBlob, getAudioBlob, deleteAudioBlob, clearAllAudioBlobs } from './lib/audioDb';
import { mergeWavBlobs } from './lib/audioMerge';
import { 
  FileText, Sparkles, BookOpen, Volume2, Save, Download, 
  Trash2, Plus, Upload, Play, CheckCircle2, RotateCcw, HelpCircle,
  Clock, AlertCircle, FileAudio, ArrowRight, Loader2, Music
} from 'lucide-react';

export default function App() {
  // Store the active book metadata & chapters
  const [bookTitle, setBookTitle] = useState('Bản Thảo Sách Nói Mới');
  const [author, setAuthor] = useState('Tác giả Ẩn Danh');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  
  // Settings matching AI Studio's Speech Generator Scene & Sample Context
  const [selectedVoice, setSelectedVoice] = useState<'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr' | 'BrowserSpeech'>('Kore');
  const [speakingStyle, setSpeakingStyle] = useState('natural calmly');
  const [scene, setScene] = useState('');
  const [sampleContext, setSampleContext] = useState('');
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{message: string, onConfirm: () => void} | null>(null);
  const [alertDialog, setAlertDialog] = useState<string | null>(null);
  
  // UI Inputs
  const [pastedText, setPastedText] = useState('');
  const [isParsingBook, setIsParsingBook] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [apiUsageToday, setApiUsageToday] = useState(0);

  // Initialize and load usage from localStorage
  useEffect(() => {
    const today = new Date().toDateString();
    const storedDate = localStorage.getItem('api_usage_date');
    const storedCount = localStorage.getItem('api_usage_count');

    if (storedDate === today) {
      setApiUsageToday(parseInt(storedCount || '0', 10));
    } else {
      // New day, reset counter
      localStorage.setItem('api_usage_date', today);
      localStorage.setItem('api_usage_count', '0');
      setApiUsageToday(0);
    }
  }, []);

  // Update counter function
  const incrementUsage = () => {
    setApiUsageToday(prev => {
      const newVal = prev + 1;
      localStorage.setItem('api_usage_count', newVal.toString());
      return newVal;
    });
  };
  const [isExporting, setIsExporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Editor states
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);

  // Load state from local storage on mount (Lightweight metadata restore to prevent memory overload with 1000 chapters)
  useEffect(() => {
    function restoreSession() {
      try {
        const savedProject = localStorage.getItem('audiobook_project');
        if (savedProject) {
          const parsed = JSON.parse(savedProject);
          setBookTitle(parsed.bookTitle || 'Bản Thảo Sách Nói Mới');
          setAuthor(parsed.author || 'Tác giả Ẩn Danh');
          setSelectedVoice(parsed.selectedVoice || 'Kore');
          setSpeakingStyle(parsed.speakingStyle || 'natural calmly');
          setScene(parsed.scene || '');
          setSampleContext(parsed.sampleContext || '');

          const rawChapters: Chapter[] = parsed.chapters || [];
          
          // Recreate only the chapter metadata chain without loading 1000 big audio blobs in RAM at once
          const restoredChapters = rawChapters.map((ch) => ({
            ...ch,
            audioUrl: undefined // Safe lazy initialization
          }));

          setChapters(restoredChapters);
          if (restoredChapters.length > 0) {
            setActiveChapterId(restoredChapters[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to restore cached project', e);
      }
    }
    restoreSession();
  }, []);

  // Smart Lazy Audio Loader with garbage collection to handle up to 1000 chapters smoothly
  useEffect(() => {
    if (!activeChapterId) return;

    let activeChangeCancelled = false;

    async function loadActiveAudio() {
      const activeCh = chapters.find(ch => ch.id === activeChapterId);
      // Wait for 150ms debounce window to prevent rapid clicking from triggering multiple loads
      await new Promise(r => setTimeout(r, 150));
      if (activeChangeCancelled) return;

      if (activeCh && activeCh.status === 'completed' && !activeCh.audioUrl) {
        try {
          const blob = await getAudioBlob(activeChapterId);
          if (blob && !activeChangeCancelled) {
            const url = URL.createObjectURL(blob);
            setChapters(prev => prev.map(ch => {
              if (ch.id === activeChapterId) {
                return { ...ch, audioUrl: url };
              }
              // Clean up any other open object URLs to keep dynamic RAM usage minimal
              if (ch.id !== activeChapterId && ch.audioUrl) {
                URL.revokeObjectURL(ch.audioUrl);
                return { ...ch, audioUrl: undefined };
              }
              return ch;
            }));
          }
        } catch (err) {
          console.error("Lỗi nạp audio lười biếng:", err);
        }
      } else {
        // Also garbage-collect references for all inactive chapters
        setChapters(prev => prev.map(ch => {
          if (ch.id !== activeChapterId && ch.audioUrl) {
            URL.revokeObjectURL(ch.audioUrl);
            return { ...ch, audioUrl: undefined };
          }
          return ch;
        }));
      }
    }

    loadActiveAudio();

    return () => {
      activeChangeCancelled = true;
    };
  }, [activeChapterId]);

  // Save changes to local storage when state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const projectData = {
        bookTitle,
        author,
        chapters: chapters.map(ch => ({
          id: ch.id,
          title: ch.title,
          content: ch.content,
          charCount: ch.charCount,
          status: ch.status,
          errorMessage: ch.errorMessage
        })),
        selectedVoice,
        speakingStyle,
        scene,
        sampleContext
      };
      localStorage.setItem('audiobook_project', JSON.stringify(projectData));
    }, 1000);

    return () => clearTimeout(timer);
  }, [bookTitle, author, chapters, selectedVoice, speakingStyle, scene, sampleContext]);

  // Clean local state /Reset project
  const resetProject = async () => {
    setConfirmDialog({
      message: 'Bạn có chắc chắn muốn xóa toàn bộ bản thảo hiện tại để bắt đầu mới?',
      onConfirm: async () => {
        // Clean dynamic object URLs
        chapters.forEach(ch => {
          if (ch.audioUrl) {
            URL.revokeObjectURL(ch.audioUrl);
          }
        });
  
        setBookTitle('Bản Thảo Sách Nói Mới');
        setAuthor('Tác giả Bạn Đọc');
        setChapters([]);
        setActiveChapterId(null);
        setEditingChapter(null);
        setPastedText('');
        setParseError(null);
        setScene('');
        setSampleContext('');
        localStorage.removeItem('audiobook_project');
        await clearAllAudioBlobs();
        setConfirmDialog(null);
      }
    });
  };

  // Drag and drop setup
  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileParsing(e.dataTransfer.files[0]);
    }
  };

  const handleManualFile = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileParsing(e.target.files[0]);
    }
  };

  // Convert files to base64 & call AI Book Parser API
  const handleFileParsing = async (file: File) => {
    setIsParsingBook(true);
    setParseError(null);

    try {
      const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      const supportedExtensions = ['.txt', '.pdf', '.docx', '.doc', '.md', '.csv', '.json', '.html'];
      if (!supportedExtensions.includes(extension)) {
        throw new Error(`Định dạng tệp ${extension || 'không xác định'} chưa được hỗ trợ. Vui lòng sử dụng tệp chữ (TXT, PDF, DOCX, MD) hoặc tính năng dán chữ thủ công.`);
      }

      let fileType = file.type;
      
      // Fallback mime-types for desktop files
      if (!fileType) {
        if (extension === '.txt' || extension === '.md' || extension === '.csv' || extension === '.json') fileType = 'text/plain';
        if (extension === '.pdf') fileType = 'application/pdf';
        if (extension === '.docx' || extension === '.doc') fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }

      const reader = new FileReader();

      const loadPromise = new Promise<string>((resolve, reject) => {
        reader.onload = (event) => {
          if (event.target?.result) {
            resolve(event.target.result as string);
          } else {
            reject(new Error('Không thể đọc dữ liệu tệp tin.'));
          }
        };
        reader.onerror = () => reject(reader.error);
        
        // Text files are read as text or base64. Let's convert all to data url safely.
        reader.readAsDataURL(file);
      });

      const dataUrl = await loadPromise;

      const payload = {
        fileData: dataUrl,
        fileType: fileType || 'text/plain'
      };

      const response = await fetch('/api/ebook/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Protect against HTML pages returned during gateway timeout or server restart
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const textPayload = await response.text().catch(() => '');
        if (textPayload.includes('<!DOCTYPE') || textPayload.includes('<html')) {
          throw new Error('Máy chủ phản hồi trang lỗi HTML (Vượt quá dung lượng xử lý lâu của Gateway hoặc server đang khởi động lại). Vui lòng thử chia bớt sách dài ra hoặc chạy lại sau vài giây!');
        }
        throw new Error('Không nhận được chuỗi JSON chuẩn từ hệ thống.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Lỗi xử lý tài liệu từ AI Studio.');
      }

      const parsedBook = await response.json();
      
      if (parsedBook.chapters && parsedBook.chapters.length > 0) {
        setBookTitle(parsedBook.bookTitle || file.name.replace(/\.[^/.]+$/, ""));
        setAuthor(parsedBook.author || 'Không rõ tác giả');
        
        const mappedChapters: Chapter[] = parsedBook.chapters.map((ch: any) => ({
          id: ch.id ? String(ch.id) : Math.random().toString(36).substr(2, 9),
          title: ch.title || 'Tiêu Đề Trống',
          content: ch.content || '',
          charCount: (ch.content || '').length,
          status: 'pending'
        }));

        setChapters(mappedChapters);
        setActiveChapterId(mappedChapters[0].id);
        setEditingChapter(null);
      } else {
        throw new Error('Định dạng sách trả về không chứa các chương hợp lý.');
      }

    } catch (err: any) {
      console.error(err);
      setParseError(`Không thể phân tích tệp: ${err.message || 'Mất kết nối API'}`);
    } finally {
      setIsParsingBook(false);
    }
  };

  // Handle direct text compilation (pasted text)
  const handleCompilePastedText = async () => {
    if (!pastedText.trim()) return;
    setIsParsingBook(true);
    setParseError(null);

    try {
      const response = await fetch('/api/ebook/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textContent: pastedText }),
      });

      // Avoid crashing with Unexpected Token '<' if returned HTML
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const textPayload = await response.text().catch(() => '');
        if (textPayload.includes('<!DOCTYPE') || textPayload.includes('<html')) {
          throw new Error('Máy chủ phản hồi trang lỗi HTML (Vượt quá dung lượng xử lý lâu của Gateway hoặc đang khởi động lại). Hãy bớt dung lượng lại hoặc gửi lại sau vài giây!');
        }
        throw new Error('Dữ liệu không phải là chuỗi JSON hợp lệ.');
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Lỗi biên dịch văn bản từ server.');
      }

      const parsedBook = await response.json();
      
      if (parsedBook.chapters && parsedBook.chapters.length > 0) {
        setBookTitle(parsedBook.bookTitle || 'Bản Thao Sách Kể Hại');
        setAuthor(parsedBook.author || 'Ẩn Danh');
        
        const mapped: Chapter[] = parsedBook.chapters.map((ch: any) => ({
          id: String(ch.id),
          title: ch.title || 'Phần Mới',
          content: ch.content || '',
          charCount: (ch.content || '').length,
          status: 'pending'
        }));

        setChapters(mapped);
        setActiveChapterId(mapped[0].id);
        setEditingChapter(null);
        setPastedText(''); // Clear upon success
      } else {
        throw new Error('Văn bản quá ngắn hoặc không thể tự động cắt thành các chương lý tưởng.');
      }
    } catch (err: any) {
      console.error(err);
      setParseError(`Lỗi chuyển đổi văn bản: ${err.message}`);
    } finally {
      setIsParsingBook(false);
    }
  };

  // Convert individual chapter audio using TTS
  const generateChapterSpeech = async (chapterId: string): Promise<boolean> => {
    // Set status to processing
    setChapters(prev => prev.map(ch => ch.id === chapterId ? { ...ch, status: 'processing', errorMessage: undefined } : ch));

    try {
      const chapter = chapters.find(ch => ch.id === chapterId);
      if (!chapter) return false;

      if (selectedVoice === 'BrowserSpeech') {
        // Instant compilation for browser speech - no API call required
        setChapters(prev => prev.map(ch => 
          ch.id === chapterId 
            ? { ...ch, status: 'completed', audioUrl: undefined } 
            : ch
        ));
        return true;
      }

      const response = await fetch('/api/ebook/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chapter.content,
          voiceName: selectedVoice,
          speakingStyle: speakingStyle,
          scene: scene,
          sampleContext: sampleContext
        }),
      });

      if (!response.ok) {
        let errMsg = 'Lỗi phản hồi giọng đọc từ máy chủ.';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errMsg = errorData.error;
          } else if (errorData && typeof errorData === 'string') {
            errMsg = errorData;
          }
        } catch (jsonErr) {
          try {
            const rawText = await response.text();
            if (rawText && rawText.trim().length > 0 && rawText.length < 500) {
              errMsg = rawText.trim();
            }
          } catch (textErr) {}
        }
        throw new Error(errMsg);
      }

      const audioBlob = await response.blob();
      
      // Revoke past audio URL if any to clean memory
      if (chapter.audioUrl) {
        URL.revokeObjectURL(chapter.audioUrl);
      }

      const runtimeUrl = URL.createObjectURL(audioBlob);

      // Save audio to persistent IndexedDB so we can reload it tomorrow
      await saveAudioBlob(chapterId, audioBlob);

      setChapters(prev => prev.map(ch => 
        ch.id === chapterId 
          ? { ...ch, status: 'completed', audioUrl: runtimeUrl } 
          : ch
      ));
      incrementUsage();
      return true;

    } catch (err: any) {
      console.error(`TTS Error for chapter ${chapterId}:`, err);
      let errorMsg = err.message || 'Lỗi nạp audio';
      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.toLowerCase().includes('exhausted')) {
        errorMsg = "Hạn mức server Google đã hết (10 lượt/ngày). Ứng dụng đã cập nhật trạng thái. Vui lòng chuyển sang 'Giọng đọc Máy (Browser)' để tiếp tục nghe miễn phí!";
        // Sync local storage to match reality
        setApiUsageToday(10);
        localStorage.setItem('api_usage_count', '10');
      }
      setChapters(prev => prev.map(ch => 
        ch.id === chapterId 
          ? { ...ch, status: 'error', errorMessage: errorMsg } 
          : ch
      ));
      return false;
    }
  };

  // Generation for all chapters sequentially with delay to avoid rate limit spikes
  const processBatchSpeech = async () => {
    if (chapters.length === 0) return;
    setIsBatchProcessing(true);

    try {
      for (const ch of chapters) {
        if (ch.status === 'completed') {
          // Skip already completed chapters — they are persistently saved in IndexedDB!
          continue;
        }
        // Auto-select the target chapter so user visually tracks conversion and lazy loader works
        setActiveChapterId(ch.id);
        const success = await generateChapterSpeech(ch.id);
        if (!success) {
          console.warn(`Failed to process chapter ${ch.id}. Halting batch text-to-speech to prevent API errors spam.`);
          break; // Halt batch generation if one fails
        }
        // Minimal delay between chapters
        await new Promise(r => setTimeout(r, 1000));
      }
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleExportFullAudiobook = async () => {
    setIsExporting(true);
    try {
      const completedChapters = chapters.filter(ch => ch.status === 'completed');
      if (completedChapters.length === 0) {
        setAlertDialog("Chưa có chương nào được tạo thành công âm thanh. Vui lòng tạo audio trước.");
        return;
      }
      
      const blobs: Blob[] = [];
      for (const ch of completedChapters) {
        const b = await getAudioBlob(ch.id);
        if (b) blobs.push(b);
      }
      
      if (blobs.length === 0) {
        setAlertDialog("Lỗi không tìm thấy file lưu trữ. Hãy thử tạo lại audio.");
        return;
      }
      
      const mergedBlob = await mergeWavBlobs(blobs);
      const url = URL.createObjectURL(mergedBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `Audiobook_${bookTitle.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_')}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err: any) {
      setAlertDialog("Lỗi khi gộp file: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Manual Chapter Creators
  const createNewEmptyChapter = () => {
    const newId = (chapters.length > 0 ? Math.max(...chapters.map(ch => parseInt(ch.id) || 0)) + 1 : 1).toString();
    const newChapter: Chapter = {
      id: newId,
      title: `Chương ${newId}: Bản thảo mới sáng tác`,
      content: 'Bắt đầu viết hoặc dán nội dung chữ cho chương sách ở đây...',
      charCount: 48,
      status: 'pending'
    };
    
    setChapters(prev => [...prev, newChapter]);
    setActiveChapterId(newChapter.id);
    setEditingChapter(newChapter);
  };

  const handleEditSave = async (id: string, updatedTitle: string, updatedContent: string) => {
    const chapter = chapters.find(ch => ch.id === id);
    const contentChanged = chapter && chapter.content !== updatedContent;

    if (contentChanged) {
      await deleteAudioBlob(id);
    }

    setChapters(prev => prev.map(ch => 
      ch.id === id 
        ? { 
            ...ch, 
            title: updatedTitle, 
            content: updatedContent, 
            charCount: updatedContent.length,
            // reset state to pending when content drifts to keep dynamic
            status: contentChanged ? 'pending' : ch.status,
            audioUrl: contentChanged ? undefined : ch.audioUrl
          } 
        : ch
    ));
    setEditingChapter(null);
  };

  const handleDeleteChapter = async (id: string) => {
    setConfirmDialog({
      message: 'Bạn có muốn xóa vĩnh viễn chương này khỏi mục lục?',
      onConfirm: async () => {
        const filtered = chapters.filter(ch => ch.id !== id);
        setChapters(filtered);
        
        // Remove from browser IndexedDB to free space
        await deleteAudioBlob(id);
  
        if (activeChapterId === id) {
          setActiveChapterId(filtered.length > 0 ? filtered[0].id : null);
        }
        setConfirmDialog(null);
      }
    });
  };

  // Quick navigation index helpers
  const activeChapter = chapters.find(ch => ch.id === activeChapterId) || null;

  const navigatePrev = () => {
    const idx = chapters.findIndex(ch => ch.id === activeChapterId);
    if (idx > 0) {
      setActiveChapterId(chapters[idx - 1].id);
    }
  };

  const navigateNext = () => {
    const idx = chapters.findIndex(ch => ch.id === activeChapterId);
    if (idx !== -1 && idx < chapters.length - 1) {
      setActiveChapterId(chapters[idx + 1].id);
    }
  };

  // General statistics
  const totalChars = chapters.reduce((sum, ch) => sum + ch.charCount, 0);
  const totalCompleted = chapters.filter(ch => ch.status === 'completed').length;
  const progressPercent = chapters.length > 0 ? Math.round((totalCompleted / chapters.length) * 100) : 0;

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFCFB] font-sans text-[#3D3D3D] antialiased">
      {/* Visual Header */}
      <header className="h-16 border-b border-[#E8E4DF] flex items-center justify-between px-6 md:px-8 bg-white shrink-0 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-9 h-9 bg-[#5A5A40] rounded-xl flex items-center justify-center border border-[#5A5A40] text-white shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="stroke-white">
              <path d="M12 6V12L16 14M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-serif font-bold text-[#2D2D2D] tracking-tight">AudioBook Forge</h1>
              <span className="px-1.8 py-0.5 bg-[#F0EEEB] text-[#5A5A40] text-[9px] rounded font-bold uppercase tracking-wider border border-[#E8E4DF]">
                Natural Tones active
              </span>
            </div>
            <p className="text-[10px] text-[#8C8379] font-medium hidden sm:block">Giải pháp hỗ trợ lồng tiếng & đóng gói Sách nói từ Google AI Studio Speech</p>
          </div>
        </div>

        <div className="flex items-center space-x-5">
          <div className="text-right hidden md:block">
            <p className="text-[9px] font-bold text-[#A69076] uppercase tracking-wider">Tổng độ dài nội dung</p>
            <p className="text-xs font-bold text-[#3D3D3D]">{totalChars.toLocaleString()} ký tự</p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="btn-add-chapter-manual"
              onClick={createNewEmptyChapter}
              className="px-3.5 py-1.8 bg-white hover:bg-[#FAF9F7] text-[#5A5A40] border border-[#E8E4DF] rounded-xl text-xs font-bold flex items-center space-x-1 transition-all"
              title="Thêm thủ công đoạn văn mới"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Tạo chương mới</span>
            </button>

            {chapters.length > 0 && (
              <button
                id="btn-process-batch-audio"
                onClick={processBatchSpeech}
                disabled={isBatchProcessing}
                className="px-4 py-2 bg-[#5A5A40] hover:opacity-90 active:opacity-95 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {isBatchProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Đang tạo các file...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 fill-white text-white" />
                    <span>Tạo Toàn Bộ Audio ({progressPercent}%)</span>
                  </>
                )}
              </button>
            )}

            {chapters.length > 0 && progressPercent > 0 && (
              <button
                onClick={handleExportFullAudiobook}
                disabled={isExporting}
                className="px-4 py-2 bg-[#2D2D2D] hover:opacity-90 active:opacity-95 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Đang gộp file...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 text-white" />
                    <span>Tải Sách Nói ({chapters.filter(c => c.status === 'completed').length} phần)</span>
                  </>
                )}
              </button>
            )}

            <button
              id="btn-reset-master"
              onClick={resetProject}
              className="p-2 bg-white text-[#8C8379] hover:text-rose-600 border border-[#E8E4DF] rounded-xl hover:border-rose-100 transition-all"
              title="Khởi tạo lại từ đầu"
            >
              <RotateCcw className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row p-4 md:p-6 lg:p-8 gap-6 max-w-7xl mx-auto w-full">
        
        {/* Left Side: Document Uploader & Chapters Selector */}
        <section className="flex-1 flex flex-col space-y-6 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto custom-scrollbar lg:pr-1">
          
          {/* File input drag and drop area */}
          {chapters.length === 0 && (
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 relative ${
                dragActive 
                  ? 'border-[#5A5A40] bg-[#FAF9F7]/60' 
                  : 'border-[#D6CFC7] bg-white hover:border-[#A69076]'
              }`}
              id="file-dropzone-frame"
            >
              <input
                id="file-selector-input"
                type="file"
                className="hidden"
                accept=".txt,.pdf,.docx,.epub"
                onChange={handleManualFile}
              />
              <div className="max-w-md mx-auto">
                <div className="w-12 h-12 bg-[#FAF9F7] border border-[#E8E4DF] text-[#5A5A40] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
                  <Upload className="h-6 w-6 stroke-[1.8]" />
                </div>
                <h3 className="text-base font-serif font-bold text-[#2D2D2D] mb-1.5">Tải lên văn bản hoặc sách của bạn</h3>
                <p className="text-xs text-[#8C8379] leading-relaxed mb-5">
                  Chấp nhận các định dạng tệp <code className="bg-[#FAF9F7] px-1 py-0.5 rounded text-[10px]">.pdf</code>, <code className="bg-[#FAF9F7] px-1 py-0.5 rounded text-[10px]">.txt</code>, <code className="bg-[#FAF9F7] px-1 py-0.5 rounded text-[10px]">.docx</code>.<br />
                  Hệ thống sử dụng Gemini AI để dọn dẹp các ký tự thừa và phân bổ thành các chương giọng đọc tối ưu.
                </p>

                <div className="flex items-center justify-center space-x-3.5">
                  <button
                    id="btn-trigger-upload"
                    type="button"
                    onClick={() => document.getElementById('file-selector-input')?.click()}
                    className="px-4.5 py-2.5 bg-[#5A5A40] hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                  >
                    Chọn tệp tin gửi đi
                  </button>
                  <span className="text-xs text-[#8C8379] font-medium">hoặc thả tệp tại đây</span>
                </div>
              </div>
            </div>
          )}

          {/* Paste manual ebook text area */}
          {chapters.length === 0 && (
            <div className="bg-white border border-[#E8E4DF] rounded-2xl p-6 shadow-xs">
              <div className="flex items-center space-x-2 mb-4">
                <FileText className="h-4.5 w-4.5 text-[#A69076]" />
                <h3 className="text-sm font-serif font-bold text-[#2D2D2D]">Hoặc viết dán trực tiếp truyện, bài luận dài</h3>
              </div>
              <textarea
                id="raw-text-paste-area"
                rows={6}
                className="w-full p-4 border border-[#D6CFC7] rounded-xl text-xs text-[#3D3D3D] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5A5A40] leading-relaxed resize-none bg-[#FCFBF9]"
                placeholder="Dán toàn bộ bài báo, chương truyện hoặc tài liệu viết tự do của bạn vào đây. Hệ thống thu thập và tự phát hiện chương trình bày..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-[#8C8379] font-medium">
                  {pastedText.length ? `${pastedText.length.toLocaleString()} ký tự nhập vào` : 'Nạp dữ liệu không giới hạn'}
                </span>
                <button
                  id="btn-process-pasted-text"
                  type="button"
                  disabled={isParsingBook || !pastedText.trim()}
                  onClick={handleCompilePastedText}
                  className="px-4.5 py-2 bg-[#5A5A40] hover:opacity-93 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                >
                  {isParsingBook ? 'Đang xử lý dọn dẹp...' : 'Tự động bóc tách chương sách'}
                </button>
              </div>
            </div>
          )}

          {isParsingBook && (
            <div className="bg-[#FAF9F7] border border-[#E8E4DF] rounded-2xl p-8 text-center flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 text-[#5A5A40] animate-spin mb-3.5" />
              <h4 className="text-sm font-serif font-bold text-[#2D2D2D]">Trí tuệ Nhân tạo Đang Hiệu đính & Phân đoạn</h4>
              <p className="text-xs text-[#8C8379] mt-1 max-w-sm">Hệ thống đang cấu trúc lại, lọc bỏ headers, footers bẩn và tự động gom thành từng cụm chương lý tưởng để sách đọc diễn cảm mượt mà nhất.</p>
            </div>
          )}

          {parseError && (
            <div className="bg-rose-50/70 border border-rose-100/80 rounded-2xl p-4.5 text-xs text-rose-700 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block mb-0.5">Xảy ra sự cố khi phân tích sách</strong>
                <span>{parseError}</span>
              </div>
            </div>
          )}

          {/* Book Metadata Cover if chapters uploaded */}
          {chapters.length > 0 && (
            <div className="bg-[#FAF9F7] border border-[#E8E4DF] rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 bg-white border border-[#E8E4DF] rounded-xl flex flex-col items-center justify-center text-[#5A5A40] font-sans font-black shadow-xs shrink-0 select-none">
                  <span className="text-xs leading-none text-[#A69076]">GENAI</span>
                  <span className="text-base leading-none text-[#5A5A40] mt-1">3.5</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-[#A69076] uppercase tracking-widest block bg-[#F0EEEB] px-1.5 py-0.5 rounded w-max border border-[#E8E4DF] mb-1">
                    BỐ CỤC ĐANG BIÊN TẬP
                  </span>
                  <input
                    id="metadata-book-title"
                    type="text"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    className="text-base font-serif font-bold text-[#2D2D2D] bg-transparent border-b border-transparent hover:border-[#D6CFC7] focus:border-[#5A5A40] focus:outline-none w-full"
                    title="Bấm để đặt lại tên Sách"
                  />
                  <div className="flex items-center space-x-1 mt-1 text-xs text-[#8C8379]">
                    <span>Tác giả:</span>
                    <input
                      id="metadata-book-author"
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="bg-transparent border-b border-transparent hover:border-[#D6CFC7] focus:border-[#5A5A40] focus:outline-none font-semibold text-[#6B665F] text-xs py-0 w-28 md:w-44"
                      title="Bấm để cập nhật tác giả"
                    />
                  </div>
                </div>
              </div>

              {/* Progress counter */}
              <div className="text-right shrink-0">
                <p className="text-[10px] text-[#8C8379] font-bold uppercase tracking-wider">Tiến trình chuyển đổi</p>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-sm font-bold text-[#3D3D3D]">{totalCompleted}/{chapters.length} chương</span>
                  <span className="text-xs text-[#A69076] bg-[#F0EEEB] p-1 rounded font-bold">{progressPercent}%</span>
                </div>
              </div>
            </div>
          )}

          {/* List of segmented chapters */}
          {chapters.length > 0 && (
            <ChapterList
              chapters={chapters}
              activeChapterId={activeChapterId}
              onSelectChapter={(id) => {
                setActiveChapterId(id);
                setEditingChapter(null); // Return to preview mode first
              }}
              onEditChapter={(ch) => setEditingChapter(ch)}
              onGenerateAudio={(id) => generateChapterSpeech(id)}
              onDeleteChapter={handleDeleteChapter}
            />
          )}

        </section>

        {/* Right Side: Configuration Sidebar & Live Text Viewer / Editor */}
        <section className="w-full lg:w-80 shrink-0 flex flex-col space-y-6">
          
          {/* Active Voice Assistant */}
          <VoiceSelector
            selectedVoice={selectedVoice}
            onSelectVoice={(voice) => setSelectedVoice(voice)}
            speakingStyle={speakingStyle}
            onStyleChange={(style) => setSpeakingStyle(style)}
            scene={scene}
            onSceneChange={(val) => setScene(val)}
            sampleContext={sampleContext}
            onSampleContextChange={(val) => setSampleContext(val)}
            apiUsageToday={apiUsageToday}
          />

          {/* Quick instructions widget & Auto-save / Token Info */}
          <div className="bg-[#FAF9F7] border border-[#E8E4DF] rounded-2xl p-5 text-xs text-[#6B665F] leading-relaxed shadow-sm space-y-4">
            <div>
              <h4 className="font-serif font-bold text-[#2D2D2D] mb-2 flex items-center space-x-1.5">
                <HelpCircle className="h-4.5 w-4.5 text-[#A69076]" />
                <span>Hướng Dẫn Chế Tác Sách</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-[#3D3D3D]">
                <li>Nạp bản sao tài liệu (Kèo tệp hoặc dán chữ thủ công).</li>
                <li>Xem mục lục truyện tối ưu ở danh sách bên trái.</li>
                <li>Tinh chỉnh <strong className="font-semibold text-[#5A5A40]">Biểu Cảm & Giọng Đọc</strong>.</li>
                <li>Nhấp <strong className="font-semibold text-[#5A5A40]">Tạo toàn bộ audio</strong> để tổng hợp tự động.</li>
                <li>Thưởng thức và tải về định dạng <strong className="font-semibold">WAV cao cấp (24kHz)</strong>.</li>
              </ol>
            </div>

            <div className="pt-3.5 border-t border-[#E8E4DF]">
              <h5 className="font-semibold text-[#5A5A40] mb-1.5 flex items-center space-x-1">
                <span className="inline-block w-1.5 h-1.5 bg-[#A69076] rounded-full"></span>
                <span>Chế Độ Tự Cứu & Auto-Save</span>
              </h5>
              <ul className="space-y-1 text-[#5A554E] list-disc list-inside">
                <li><span className="font-semibold text-[#3D3D3D]">Mất nguồn/Tắt máy đột ngột:</span> Toàn bộ văn bản và danh sách chương đã tạo thành công được <strong className="text-[#5A5A40]">tự động tích trữ hành trình</strong> trong LocalStorage và IndexedDB. Bạn chỉ cần mở lại để chế tác tiếp, không bị mất chút công sức nào!</li>
                <li><span className="font-semibold text-[#3D3D3D]">Hết hạn ngạch / Token:</span> Trình đọc chia nhỏ các câu dưới 700 ký tự để tránh lỗi quá tải. Nếu chương nào bị lỗi, bạn chỉ cần bấm nút chế tác lại chương đó thủ công mà không tốn mã lực làm lại các chương đã qua!</li>
              </ul>
            </div>
          </div>
          
          {/* Active Chapter Viewer */}
          {chapters.length > 0 && activeChapter && (
            <div className="bg-white border border-[#E8E4DF] rounded-2xl p-5 shadow-sm flex flex-col flex-1 min-h-[300px]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-serif font-bold text-[#2D2D2D] truncate pr-2">
                  {activeChapter.title}
                </h4>
                <button 
                  onClick={() => setEditingChapter(activeChapter)} 
                  className="px-2 py-1 bg-[#FAF9F7] text-[#5A5A40] hover:bg-[#F0EEEB] rounded text-xs font-bold border border-[#E8E4DF] transition-colors shrink-0"
                >
                  Sửa
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar text-xs text-[#5A554E] leading-relaxed whitespace-pre-wrap">
                {activeChapter.content}
              </div>
            </div>
          )}
        </section>

      </main>

      {/* Chapter Workspace Editor overlay-side view */}
      {editingChapter && (
        <div className="fixed inset-0 bg-[#000000]/30 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="editor-popup-modal">
          <div className="bg-[#FDFCFB] w-full max-w-2xl h-[90vh] rounded-2xl overflow-hidden shadow-2xl border border-[#D6CFC7]">
            <ChapterEditor
              chapter={editingChapter}
              onSave={handleEditSave}
              onClose={() => setEditingChapter(null)}
            />
          </div>
        </div>
      )}

      {/* Floating Bottom Audio Playback Controller Deck */}
      {chapters.length > 0 && activeChapter && (
        <footer className="sticky bottom-0 left-0 right-0 p-4 border-t border-[#E8E4DF] bg-[#FDFCFB]/95 backdrop-blur-md z-45 shrink-0 block">
          <div className="max-w-7xl mx-auto">
            <AudiobookPlayer
              chapter={activeChapter}
              onPrevChapter={navigatePrev}
              onNextChapter={navigateNext}
              onRegenerateAudio={() => generateChapterSpeech(activeChapter.id)}
            />
          </div>
        </footer>
      )}

      {/* Global Alert Dialog */}
      {alertDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center border border-[#E8E4DF] animate-in fade-in zoom-in duration-200">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 mb-4">
              <AlertCircle className="h-6 w-6 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-[#2D2D2D] mb-2 font-serif">Thông báo</h3>
            <p className="text-sm text-[#6B665F] mb-6">{alertDialog}</p>
            <button
              onClick={() => setAlertDialog(null)}
              className="w-full bg-[#5A5A40] text-white rounded-xl py-2.5 font-bold hover:bg-[#494932] transition-colors"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* Global Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center border border-[#E8E4DF] animate-in fade-in zoom-in duration-200">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F0EEEB] mb-4">
              <HelpCircle className="h-6 w-6 text-[#5A5A40]" />
            </div>
            <h3 className="text-lg font-bold text-[#2D2D2D] mb-2 font-serif">Xác nhận</h3>
            <p className="text-sm text-[#6B665F] mb-6">{confirmDialog.message}</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 bg-white border border-[#E8E4DF] text-[#6B665F] rounded-xl py-2.5 font-bold hover:bg-[#F9F8F6] transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="flex-1 bg-rose-600 text-white rounded-xl py-2.5 font-bold hover:bg-rose-700 transition-colors"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
