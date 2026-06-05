export interface Chapter {
  id: string;
  title: string;
  content: string;
  audioUrl?: string; // Runtime Blob URL for frontend playback
  audioBase64?: string; // Raw base64 audio stored locally (optional, for persistent saves)
  duration?: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
  charCount: number;
}

export interface BookProject {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  chapters: Chapter[];
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  speakingStyle: string; // instruction prompt like: "narrative calmly", "energetically", etc.
}

export interface VoiceAudition {
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  displayName: string;
  gender: 'Female' | 'Male';
  accent: string;
  vocalDescription: string;
}

export const PREBUILT_VOICES: VoiceAudition[] = [
  {
    voiceName: 'Kore',
    displayName: 'Kore (Thanh tao)',
    gender: 'Female',
    accent: 'Giọng đọc nữ, sáng và thanh lịch',
    vocalDescription: 'Lấy cảm hứng từ giọng truyền cảm, lý tưởng cho sách nói nghệ thuật, tiểu thuyết và tự sự dài kì.'
  },
  {
    voiceName: 'Puck',
    displayName: 'Puck (Ấm áp)',
    gender: 'Male',
    accent: 'Giọng nam trầm, dõng dạc và truyền cảm',
    vocalDescription: 'Rất thích hợp cho tác phẩm hư cấu, truyện ngắn kì bí hoặc tài liệu lịch sử.'
  },
  {
    voiceName: 'Charon',
    displayName: 'Charon (Điềm tĩnh)',
    gender: 'Male',
    accent: 'Giọng nam trung, chậm rãi và trang thảo',
    vocalDescription: 'Phù hợp làm hồi ký, sách kinh doanh, phát triển bản thân và chia sẻ bài học cuộc đời.'
  },
  {
    voiceName: 'Fenrir',
    displayName: 'Fenrir (Mạnh mẽ)',
    gender: 'Male',
    accent: 'Giọng nam khỏe khoắn, nam tính và lôi cuốn',
    vocalDescription: 'Đặc biệt phù hợp cho sách hành trình phiêu lưu phiêu bạt hoặc sách khoa học viễn tưởng căng thẳng.'
  },
  {
    voiceName: 'Zephyr',
    displayName: 'Zephyr (Nhẹ nhàng)',
    gender: 'Female',
    accent: 'Giọng nữ êm ái, hiền dịu và ru dương',
    vocalDescription: 'Lý tưởng cho truyện thiếu nhi, các tản văn tâm sự sâu lắng, thiền và giấc ngủ ngon.'
  }
];
