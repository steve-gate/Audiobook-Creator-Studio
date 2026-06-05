import { useState, useEffect } from 'react';
import { Chapter } from '../types';
import { Sparkles, Save, X, RotateCcw, CheckCircle2, ChevronRight, Loader2, Wand2 } from 'lucide-react';

interface ChapterEditorProps {
  chapter: Chapter | null;
  onSave: (id: string, updatedTitle: string, updatedContent: string) => void;
  onClose: () => void;
}

export default function ChapterEditor({
  chapter,
  onSave,
  onClose,
}: ChapterEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishStyle, setPolishStyle] = useState<'vietnamese-slang' | 'smooth-pauses' | 'literary'>('smooth-pauses');
  const [polishMessage, setPolishMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title);
      setContent(chapter.content);
      setPolishMessage(null);
      setHasChanges(false);
    }
  }, [chapter]);

  if (!chapter) return null;

  const handleSave = () => {
    onSave(chapter.id, title, content);
    setHasChanges(false);
    setPolishMessage('Đã lưu nội dung cập nhật cho chương này thành công!');
    setTimeout(() => setPolishMessage(null), 3000);
  };

  const handleAISmooth = async () => {
    setIsPolishing(true);
    setPolishMessage(null);

    try {
      const response = await fetch('/api/ebook/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          polishStyle: polishStyle,
        }),
      });

      if (!response.ok) {
        throw new Error('Không thể liên hệ trợ lý AI hiệu đính.');
      }

      const data = await response.json();
      if (data.polishedText) {
        setContent(data.polishedText);
        setHasChanges(true);
        setPolishMessage('Đã tối ưu hóa văn bản thành công để có giọng đọc truyền cảm nhất!');
      }
    } catch (err: any) {
      console.error(err);
      setPolishMessage(`Lỗi tối ưu hóa AI: ${err.message}`);
    } finally {
      setIsPolishing(false);
    }
  };

  return (
    <div className="bg-white border border-[#E8E4DF] rounded-2xl p-6 lg:p-8 flex flex-col h-full min-h-[560px]" id="chapter-editor-frame">
      <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-4 mb-6">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-[#FAF9F7] text-[#5A5A40] rounded-xl border border-[#E8E4DF]">
            <Wand2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-base font-serif font-semibold text-[#2D2D2D]">Biên Tập & Trợ lý Đọc Sách Nói</h3>
            <p className="text-xs text-[#8C8379] font-medium">Phần {chapter.id} — Chỉnh sửa văn phong và kiểm tra phát âm</p>
          </div>
        </div>
        <button
          id="btn-close-editor"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-650 p-1.5 hover:bg-[#FAF9F7] rounded-lg transition-colors border border-transparent hover:border-[#E8E4DF]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {polishMessage && (
        <div className={`mb-5 p-3.5 rounded-xl text-xs flex items-start space-x-2.5 border ${
          polishMessage.startsWith('Lỗi')
            ? 'bg-rose-50/55 text-rose-700 border-rose-100'
            : 'bg-emerald-50/60 text-emerald-800 border-emerald-100'
        }`}>
          {polishMessage.startsWith('Lỗi') ? null : <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />}
          <div className="flex-1 font-semibold">{polishMessage}</div>
        </div>
      )}

      {/* Editor Inputs */}
      <div className="flex-1 space-y-5 flex flex-col min-h-0">
        <div>
          <label className="block text-xs font-bold text-[#6B665F] uppercase tracking-wider mb-2" htmlFor="chapter-title-input">
            Tên Tiêu Đề Chương sách
          </label>
          <input
            id="chapter-title-input"
            type="text"
            className="w-full px-3.5 py-2.5 bg-white border border-[#D6CFC7] rounded-xl text-sm font-serif font-bold text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#5A5A40] transition-all duration-200"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Nhập tiêu đề chương..."
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-[#6B665F] uppercase tracking-wider" htmlFor="chapter-text-textarea">
              Nội Dung Nói Chi Tiết (Sẽ Đọc)
            </label>
            <span className="text-xs font-bold text-[#A69076]">
              {content.length.toLocaleString()} KÝ TỰ
            </span>
          </div>
          <textarea
            id="chapter-text-textarea"
            className="w-full flex-1 p-4 bg-[#FCFBF9] border border-[#D6CFC7] rounded-xl text-sm font-normal text-[#3D3D3D] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5A5A40] leading-relaxed resize-none custom-scrollbar min-h-[220px]"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Nội dung chi tiết chương sách sẽ hiển thị ở đây..."
          />
        </div>
      </div>

      {/* AI Assistant Toolkit */}
      <div className="bg-[#FAF9F7] border border-[#E8E4DF] p-4.5 rounded-xl mt-5 mb-5">
        <h4 className="text-xs font-bold text-[#5A5A40] flex items-center space-x-1.5 mb-2.5">
          <Sparkles className="h-3.5 w-3.5 text-[#A69076] fill-[#A69076]/20" />
          <span className="font-serif">Công Cụ Tối Ưu Giọng Đọc Với AI</span>
        </h4>
        
        <div className="grid grid-cols-3 gap-2.5 mb-3.5">
          <button
            id="btn-style-pauses"
            type="button"
            onClick={() => setPolishStyle('smooth-pauses')}
            className={`px-2.5 py-1.8 rounded-lg text-xs font-semibold border text-center transition-all ${
              polishStyle === 'smooth-pauses'
                ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-sm'
                : 'bg-white hover:bg-gray-50 text-[#6B665F] border-[#D6CFC7]'
            }`}
          >
            Ngắt nghỉ tự nhiên
          </button>
          <button
            id="btn-style-slang"
            type="button"
            onClick={() => setPolishStyle('vietnamese-slang')}
            className={`px-2.5 py-1.8 rounded-lg text-xs font-semibold border text-center transition-all ${
              polishStyle === 'vietnamese-slang'
                ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-sm'
                : 'bg-white hover:bg-gray-50 text-[#6B665F] border-[#D6CFC7]'
            }`}
          >
            Mượt hóa từ viết tắt
          </button>
          <button
            id="btn-style-literary"
            type="button"
            onClick={() => setPolishStyle('literary')}
            className={`px-2.5 py-1.8 rounded-lg text-xs font-semibold border text-center transition-all ${
              polishStyle === 'literary'
                ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-sm'
                : 'bg-white hover:bg-gray-50 text-[#6B665F] border-[#D6CFC7]'
            }`}
          >
            Trau chuốt văn kể
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-[#8C8379] gap-3">
          <span className="font-medium">
            {polishStyle === 'smooth-pauses' 
              ? 'Thêm các khoảng nghỉ lý tưởng, dấu câu tinh tế tránh hụt hơi.'
              : polishStyle === 'vietnamese-slang'
              ? 'Chuyển tự các thuật ngữ công nghệ viết tắt (AI, PDF, COVID, Web) phù hợp cách đọc Việt.'
              : 'Nâng cao nhịp truyền cảm, loại bỏ trùng ngữ, kiến tạo câu văn trôi chảy chất lượng cao.'
            }
          </span>
          <button
            id="btn-polish-ai-trigger"
            onClick={handleAISmooth}
            disabled={isPolishing || !content.trim()}
            className="flex-shrink-0 bg-white hover:bg-[#FAF9F7] text-[#5A5A40] border border-[#D6CFC7] hover:border-[#5A5A40] px-3.5 py-1.5 rounded-lg font-bold flex items-center space-x-1 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPolishing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5A5A40]" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-[#A69076] fill-[#A69076]/10" />
                <span>Tối Ưu Với AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Button Controls */}
      <div className="flex items-center space-x-3 justify-end border-t border-[#E8E4DF] pt-5">
        <button
          id="btn-cancel-changes"
          type="button"
          onClick={() => {
            setTitle(chapter.title);
            setContent(chapter.content);
            setHasChanges(false);
          }}
          disabled={!hasChanges}
          className="px-4 py-2 bg-white border border-[#E8E4DF] rounded-xl text-xs font-semibold text-[#6B665F] hover:bg-gray-50 hover:text-gray-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Hoàn tác</span>
        </button>

        <button
          id="btn-submit-save"
          type="button"
          onClick={handleSave}
          disabled={!hasChanges}
          className="px-5 py-2 bg-[#5A5A40] hover:opacity-90 rounded-xl text-xs font-bold text-white shadow-xs transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center space-x-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          <span>Lưu thay thế</span>
        </button>
      </div>
    </div>
  );
}
