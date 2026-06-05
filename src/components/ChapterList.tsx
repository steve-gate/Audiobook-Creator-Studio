import { useState, useMemo } from 'react';
import { Chapter } from '../types';
import { 
  AudioLines, FileText, CheckCircle2, AlertTriangle, Play,
  RefreshCw, Trash2, Edit2, Sparkles, BookOpen, Clock, Loader2,
  Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter
} from 'lucide-react';

interface ChapterListProps {
  chapters: Chapter[];
  activeChapterId: string | null;
  onSelectChapter: (id: string) => void;
  onEditChapter: (chapter: Chapter) => void;
  onGenerateAudio: (chapterId: string) => void;
  onDeleteChapter: (chapterId: string) => void;
}

export default function ChapterList({
  chapters,
  activeChapterId,
  onSelectChapter,
  onEditChapter,
  onGenerateAudio,
  onDeleteChapter,
}: ChapterListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'error'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Reset page when filter or search changes
  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handleFilterChange = (filter: typeof statusFilter) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  // Filtered and searched list
  const filteredChapters = useMemo(() => {
    return chapters.filter(ch => {
      const matchesSearch = 
        ch.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        ch.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ch.id.includes(searchTerm);

      const matchesStatus = 
        statusFilter === 'all' || 
        ch.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [chapters, searchTerm, statusFilter]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredChapters.length / itemsPerPage));
  const paginatedChapters = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredChapters.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredChapters, currentPage]);

  const getStatusIcon = (status: Chapter['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 fill-emerald-50" />;
      case 'processing':
        return <Loader2 className="h-4.5 w-4.5 text-[#5A5A40] animate-spin" />;
      case 'error':
        return <AlertTriangle className="h-4.5 w-4.5 text-rose-500" />;
      default:
        return <AudioLines className="h-4.5 w-4.5 text-[#8C8379]" />;
    }
  };

  const getStatusBadge = (status: Chapter['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-1.8 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100 space-x-1" title="Đã lưu an toàn vào đĩa cứng trình duyệt (IndexedDB). Mở lại trang vẫn tiếp tục nghe được!">
            <span>ĐÃ XONG</span>
            <span>•</span>
            <span className="text-[#5A5A40] text-[8px] font-extrabold flex items-center">💾 ĐÃ LƯU</span>
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-1.8 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#F0EEEB] text-[#5A5A40] border border-[#E8E4DF] animate-pulse">
            ĐANG CHUYỂN
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-1.8 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100">
            LỖI TTS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.8 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#FDFCFB] text-[#8C8379] border border-[#E8E4DF]">
            CHỜ AUDIO
          </span>
        );
    }
  };

  const formatChars = (count: number) => {
    return `${count.toLocaleString()} ký tự`;
  };

  const estimateDuration = (count: number) => {
    const mins = Math.ceil(count / 250);
    return `~${mins} phút nghe`;
  };

  return (
    <div className="bg-white border border-[#E8E4DF] rounded-2xl p-5 lg:p-6 shadow-sm" id="chapter-list-layout">
      {/* Header with Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#FAF9F7] text-[#5A5A40] rounded-xl border border-[#E8E4DF]">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-serif font-semibold text-[#2D2D2D] tracking-tight">Danh Mục Truyện & Tiểu Thuyết</h2>
            <p className="text-xs text-[#8C8379] font-medium leading-normal">Hỗ trợ phân rã & tối ưu lên tới 1000 chương truyện dài</p>
          </div>
        </div>
        <div className="flex items-center bg-[#FAF9F7] border border-[#E8E4DF] px-3 py-1.5 rounded-lg text-xs text-[#6B665F] font-bold uppercase tracking-wider self-start sm:self-auto">
          {chapters.length} CHƯƠNG TOÀN BỘ
        </div>
      </div>

      {chapters.length > 0 && (
        <div className="mb-4 space-y-3">
          {/* Search and Filters Bar */}
          <div className="flex flex-col md:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8C8379]" />
              <input
                id="chapter-search-input"
                type="text"
                placeholder="Tìm tiêu đề hoặc nội dung chương..."
                className="w-full pl-9 pr-4 py-2 bg-[#FCFBF9] border border-[#D6CFC7] rounded-xl text-xs text-[#3D3D3D] focus:outline-none focus:ring-2 focus:ring-[#5A5A40] transition-colors"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

            {/* Filter by status options */}
            <div className="flex items-center space-x-1 border border-[#E8E4DF] rounded-xl p-1 bg-[#FAF9F7]">
              {(['all', 'pending', 'completed', 'error'] as const).map((filter) => {
                const label = 
                  filter === 'all' ? 'Tất cả' :
                  filter === 'pending' ? 'Chưa tạo' :
                  filter === 'completed' ? 'Đã xong' : 'Lỗi';
                return (
                  <button
                    key={filter}
                    id={`filter-status-${filter}`}
                    onClick={() => handleFilterChange(filter)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      statusFilter === filter
                        ? 'bg-white text-[#5A5A40] shadow-xs border border-[#E8E4DF]'
                        : 'text-[#8C8379] hover:text-[#5A5A40]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Performance Optimization Toast Alert for 100+ chapters */}
          {chapters.length > 50 && (
            <div className="bg-[#FAF9F7] border border-[#E8E4DF] px-3 py-2.5 rounded-xl text-[11px] text-[#8C8379] flex items-center space-x-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span><strong>Mẹo thông minh:</strong> Đã kích hoạt ảo hóa danh sách ({itemsPerPage} mục/trang) giúp bảo vệ tốc độ tải, tránh treo tab trình duyệt khi mở rộng tới 1000 chương kịch bản.</span>
            </div>
          )}
        </div>
      )}

      {chapters.length === 0 ? (
        <div className="border border-dashed border-[#D6CFC7] rounded-xl py-12 px-6 text-center text-gray-400">
          <FileText className="h-10 w-10 mx-auto stroke-1 stroke-[#A69076] mb-3" />
          <p className="text-sm font-medium text-[#6B665F]">Bản thảo hiện đang trống</p>
          <p className="text-xs text-[#8C8379] mt-1">Hãy tải tệp tài liệu sách (PDF, TXT, DOCX), dán đoạn văn dài hoặc click nút "Tạo chương mới" phía trên.</p>
        </div>
      ) : filteredChapters.length === 0 ? (
        <div className="py-12 text-center text-[#8C8379]">
          <p className="text-xs font-medium">Không tìm thấy phân đoạn chương sách nào khớp với tìm kiếm</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Main Paginated Catalog */}
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1.5 custom-scrollbar">
            {paginatedChapters.map((chapter) => {
              const isActive = activeChapterId === chapter.id;
              return (
                <div
                  key={chapter.id}
                  id={`chapter-${chapter.id}`}
                  className={`group border rounded-xl p-3.5 transition-all duration-200 relative ${
                    isActive
                      ? 'border-[#5A5A40] bg-[#FAF9F7]/70 shadow-xs'
                      : 'border-[#E8E4DF] hover:border-[#D6CFC7] hover:bg-[#FCFBF9]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => onSelectChapter(chapter.id)}
                    >
                      <div className="flex items-center space-x-2.5 mb-1.5 flex-wrap gap-y-1">
                        <span className="text-[10px] font-bold text-[#5A5A40] bg-[#FAF9F7] border border-[#E8E4DF] px-1.5 py-0.5 rounded tracking-wide">
                          CHƯƠNG {chapter.id}
                        </span>
                        {getStatusBadge(chapter.status)}
                        {chapter.status === 'error' && chapter.errorMessage && (
                          <span className="text-[10px] text-rose-600 border border-rose-100 bg-rose-50 px-1.5 py-0.5 rounded max-w-xs truncate" title={chapter.errorMessage}>
                            {chapter.errorMessage}
                          </span>
                        )}
                      </div>
                      <h3 className={`text-sm font-serif font-semibold transition-colors duration-200 truncate ${
                        isActive ? 'text-[#2D2D2D]' : 'text-[#3D3D3D] group-hover:text-[#5A5A40]'
                      }`}>
                        {chapter.title}
                      </h3>
  
                      {/* Stats */}
                      <div className="flex items-center space-x-3.5 text-xs text-[#8C8379] mt-2 font-medium">
                        <span className="flex items-center space-x-1">
                          <FileText className="h-3.5 w-3.5 flex-shrink-0 text-[#A69076]" />
                          <span>{formatChars(chapter.charCount)}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Clock className="h-3.5 w-3.5 flex-shrink-0 text-[#A69076]" />
                          <span>{estimateDuration(chapter.charCount)}</span>
                        </span>
                      </div>
                    </div>
  
                    {/* Actions */}
                    <div className="flex items-center space-x-1.5 self-center">
                      <button
                        id={`btn-edit-${chapter.id}`}
                        onClick={() => onEditChapter(chapter)}
                        className="p-1.5 px-2 bg-white border border-[#E8E4DF] rounded-lg hover:border-[#D6CFC7] text-[#6B665F] hover:text-[#5A5A40] text-xs font-semibold flex items-center space-x-1 transition-all duration-150"
                        title="Sửa nội dung văn bản"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>Sửa</span>
                      </button>
                      
                      <button
                        id={`btn-generate-tts-${chapter.id}`}
                        onClick={() => onGenerateAudio(chapter.id)}
                        disabled={chapter.status === 'processing'}
                        className={`p-1.5 px-2 border rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-1 transition-all duration-200 ${
                          chapter.status === 'completed'
                            ? 'bg-[#FAF9F7] hover:bg-[#F0EEEB] text-[#5A5A40] border-[#E8E4DF]'
                            : chapter.status === 'processing'
                            ? 'bg-[#F0EEEB] text-[#8C8379] border-[#E8E4DF] cursor-not-allowed'
                            : 'bg-[#5A5A40] hover:opacity-90 text-white border-[#5A5A40]'
                        }`}
                        title="Tạo audio giọng đọc"
                      >
                        {chapter.status === 'processing' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8C8379]" />
                        ) : chapter.status === 'completed' ? (
                          <RefreshCw className="h-3.5 w-3.5" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 fill-current text-white text-current" />
                        )}
                        <span>
                          {chapter.status === 'completed' ? 'Đọc lại' : 'Tạo âm'}
                        </span>
                      </button>
  
                      <button
                        id={`btn-delete-${chapter.id}`}
                        onClick={() => onDeleteChapter(chapter.id)}
                        className="p-2 border border-transparent rounded-lg hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-all duration-150 opacity-0 group-hover:opacity-100"
                        title="Xóa phân đoạn"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-[#E8E4DF] pt-4.5 gap-3">
            <span className="text-xs font-medium text-[#8C8379]">
              Hiển thị <strong>{Math.min(filteredChapters.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredChapters.length, currentPage * itemsPerPage)}</strong> trên tổng số <strong>{filteredChapters.length}</strong> kết quả
            </span>
            
            <div className="flex items-center space-x-1">
              <button
                id="btn-page-first"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 border border-[#E8E4DF] rounded-lg text-[#6B665F] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Trang đầu"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                id="btn-page-prev"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-[#E8E4DF] rounded-lg text-[#6B665F] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Trang trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="flex items-center space-x-1.5 px-3">
                <span className="text-xs text-[#8C8379] font-medium">Trang</span>
                <input
                  id="page-input-direct"
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 1 && val <= totalPages) {
                      setCurrentPage(val);
                    }
                  }}
                  className="w-12 h-8 px-1 text-center bg-[#FCFBF9] border border-[#D6CFC7] rounded-lg text-xs font-bold text-[#3D3D3D]"
                />
                <span className="text-xs text-[#8C8379] font-medium">/ {totalPages}</span>
              </div>

              <button
                id="btn-page-next"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-[#E8E4DF] rounded-lg text-[#6B665F] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Trang tiếp"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                id="btn-page-last"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-[#E8E4DF] rounded-lg text-[#6B665F] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Trang cuối"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
