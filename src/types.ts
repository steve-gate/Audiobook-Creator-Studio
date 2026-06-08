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
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr' | 'Achernar' | 'Achird' | 'Algenib' | 'Algieba' | 'Alnilam' | 'Aoede' | 'Autonoe' | 'Callirrhoe' | 'Despina' | 'Enceladus' | 'Erinome' | 'Gacrux' | 'Iapetus' | 'Laomedeia' | 'Leda' | 'Orus' | 'Pulcherrima' | 'Rasalgethi' | 'Sadachbia' | 'Sadaltager' | 'Schedar' | 'Sulafat' | 'Umbriel' | 'Vindemiatrix' | 'Zubenelgenubi' | 'BrowserSpeech';
  speakingStyle: string; // instruction prompt like: "narrative calmly", "energetically", etc.
}

export interface VoiceAudition {
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr' | 'Achernar' | 'Achird' | 'Algenib' | 'Algieba' | 'Alnilam' | 'Aoede' | 'Autonoe' | 'Callirrhoe' | 'Despina' | 'Enceladus' | 'Erinome' | 'Gacrux' | 'Iapetus' | 'Laomedeia' | 'Leda' | 'Orus' | 'Pulcherrima' | 'Rasalgethi' | 'Sadachbia' | 'Sadaltager' | 'Schedar' | 'Sulafat' | 'Umbriel' | 'Vindemiatrix' | 'Zubenelgenubi' | 'BrowserSpeech';
  displayName: string;
  gender: 'Female' | 'Male' | 'Unisex';
  accent: string;
  vocalDescription: string;
}

export const PREBUILT_VOICES: VoiceAudition[] = [
  {
    voiceName: 'BrowserSpeech',
    displayName: 'Giọng đọc Máy (Browser/Offline)',
    gender: 'Unisex',
    accent: 'Giọng thiết bị • Không tốn Quota',
    vocalDescription: 'Sử dụng công nghệ Speech Synthesis của máy bạn. Chạy siêu tốc ngoại tuyến, hoàn toàn miễn phí, không giới hạn lượt dùng.'
  },
  {
    voiceName: 'Kore',
    displayName: 'Kore (Thanh tao)',
    gender: 'Female',
    accent: 'Nữ • Sáng và thanh lịch',
    vocalDescription: 'Lấy cảm hứng từ giọng truyền cảm, lý tưởng cho sách nói nghệ thuật, tiểu thuyết và tự sự dài kì.'
  },
  {
    voiceName: 'Puck',
    displayName: 'Puck (Ấm áp)',
    gender: 'Male',
    accent: 'Nam • Trầm ấm, dõng dạc',
    vocalDescription: 'Rất thích hợp cho tác phẩm hư cấu, truyện ngắn kì bí hoặc tài liệu lịch sử.'
  },
  {
    voiceName: 'Charon',
    displayName: 'Charon (Điềm tĩnh)',
    gender: 'Male',
    accent: 'Nam • Trung tính, chậm rãi',
    vocalDescription: 'Phù hợp làm hồi ký, sách kinh doanh, phát triển bản thân và chia sẻ bài học cuộc đời.'
  },
  {
    voiceName: 'Fenrir',
    displayName: 'Fenrir (Mạnh mẽ)',
    gender: 'Male',
    accent: 'Nam • Khỏe khoắn, lôi cuốn',
    vocalDescription: 'Đặc biệt phù hợp cho sách hành trình phiêu lưu phiêu bạt hoặc sách khoa học viễn tưởng căng thẳng.'
  },
  {
    voiceName: 'Zephyr',
    displayName: 'Zephyr (Nhẹ nhàng)',
    gender: 'Female',
    accent: 'Nữ • Êm ái, ru dương',
    vocalDescription: 'Lý tưởng cho truyện thiếu nhi, các tản văn tâm sự sâu lắng, thiền và giấc ngủ ngon.'
  },
  {
    voiceName: 'Achernar',
    displayName: 'Achernar',
    gender: 'Female',
    accent: 'Nữ • Cao và thanh mảnh',
    vocalDescription: 'Giọng nữ trẻ trung, tông cao, phù hợp cho các đoạn hội thoại nhanh nhẹn.'
  },
  {
    voiceName: 'Achird',
    displayName: 'Achird',
    gender: 'Male',
    accent: 'Nam • Trung trầm, thân thiện',
    vocalDescription: 'Tông giọng dễ gần, lý tưởng cho sách hướng dẫn hoặc kể chuyện đời thường.'
  },
  {
    voiceName: 'Algenib',
    displayName: 'Algenib',
    gender: 'Male',
    accent: 'Nam • Trầm khàn, bí ẩn',
    vocalDescription: 'Giọng nam có độ rung đặc biệt, phù hợp với truyện trinh thám hoặc kinh dị.'
  },
  {
    voiceName: 'Algieba',
    displayName: 'Algieba',
    gender: 'Male',
    accent: 'Nam • Mượt mà, trầm thấp',
    vocalDescription: 'Sự kết hợp hoàn hảo giữa độ mượt và sự trang trọng.'
  },
  {
    voiceName: 'Alnilam',
    displayName: 'Alnilam',
    gender: 'Male',
    accent: 'Nam • Vựng chãi, quyết đoán',
    vocalDescription: 'Phù hợp cho các nhân vật lãnh đạo hoặc sách quân sự, chiến lược.'
  },
  {
    voiceName: 'Aoede',
    displayName: 'Aoede',
    gender: 'Female',
    accent: 'Nữ • Phóng khoáng, tự nhiên',
    vocalDescription: 'Giọng kể chuyện tự nhiên như đang trò chuyện trực tiếp với độc giả.'
  },
  {
    voiceName: 'Autonoe',
    displayName: 'Autonoe',
    gender: 'Female',
    accent: 'Nữ • Tươi sáng, năng lượng',
    vocalDescription: 'Phù hợp cho sách giáo dục, truyền cảm hứng hoặc nội dung trẻ em.'
  },
  {
    voiceName: 'Callirrhoe',
    displayName: 'Callirrhoe',
    gender: 'Female',
    accent: 'Nữ • Thư thái, dễ chịu',
    vocalDescription: 'Giọng đọc trung tính, không gây mệt mỏi cho những cuốn sách dài.'
  },
  {
    voiceName: 'Despina',
    displayName: 'Despina',
    gender: 'Female',
    accent: 'Nữ • Mượt mà, đằm thắm',
    vocalDescription: 'Giọng nữ trưởng thành, phù hợp cho tiểu thuyết tâm lý xã hội.'
  },
  {
    voiceName: 'Enceladus',
    displayName: 'Enceladus',
    gender: 'Male',
    accent: 'Nam • Trầm bổng, biểu cảm',
    vocalDescription: 'Tông nam có sự thay đổi cảm xúc linh hoạt, thích hợp kịch bản điện ảnh.'
  },
  {
    voiceName: 'Gacrux',
    displayName: 'Gacrux',
    gender: 'Male',
    accent: 'Nam • Chín chắn, già dặn',
    vocalDescription: 'Phù hợp cho các nhân vật ông lão hoặc các tác phẩm triết học.'
  },
  {
    voiceName: 'Iapetus',
    displayName: 'Iapetus',
    gender: 'Male',
    accent: 'Nam • Trong trẻo, chính xác',
    vocalDescription: 'Độ rõ nét cực cao, phù hợp cho sách khoa học hoặc tài liệu kỹ thuật.'
  },
  {
    voiceName: 'Laomedeia',
    displayName: 'Laomedeia',
    gender: 'Female',
    accent: 'Nữ • Vui vẻ, nhịp nhàng',
    vocalDescription: 'Giọng đọc giàu năng lượng, phù hợp với truyện hài hước.'
  },
  {
    voiceName: 'Leda',
    displayName: 'Leda',
    gender: 'Female',
    accent: 'Nữ • Trẻ thơ, trong sáng',
    vocalDescription: 'Lý tưởng cho các nhân vật thiếu nhi hoặc giọng kể trẻ em.'
  },
  {
    voiceName: 'Orus',
    displayName: 'Orus',
    gender: 'Male',
    accent: 'Nam • Nghiêm túc, đĩnh đạc',
    vocalDescription: 'Giọng đọc của người dẫn chương trình chuyên nghiệp.'
  },
  {
    voiceName: 'Pulcherrima',
    displayName: 'Pulcherrima',
    gender: 'Female',
    accent: 'Nữ • Hướng nội, sâu lắng',
    vocalDescription: 'Phù hợp cho những đoạn độc thoại nội tâm hoặc thơ ca.'
  },
  {
    voiceName: 'Rasalgethi',
    displayName: 'Rasalgethi',
    gender: 'Male',
    accent: 'Nam • Thông thái, tin cậy',
    vocalDescription: 'Giọng của một người thầy, người đi trước đầy kiến thức.'
  },
  {
    voiceName: 'Sadachbia',
    displayName: 'Sadachbia',
    gender: 'Female',
    accent: 'Nữ • Hoạt bát, nhanh nhảu',
    vocalDescription: 'Sống động và đầy nhịp điệu.'
  },
  {
    voiceName: 'Sadaltager',
    displayName: 'Sadaltager',
    gender: 'Male',
    accent: 'Nam • Trí tuệ, trung hòa',
    vocalDescription: 'Sự cân bằng tuyệt vời giữa cảm xúc và lý trí.'
  },
  {
    voiceName: 'Schedar',
    displayName: 'Schedar',
    gender: 'Male',
    accent: 'Nam • Đồng đều, trung tính',
    vocalDescription: 'Giọng đọc chuẩn mực cho mọi thể loại văn bản.'
  },
  {
    voiceName: 'Sulafat',
    displayName: 'Sulafat',
    gender: 'Female',
    accent: 'Nữ • Nồng nàn, ấm áp',
    vocalDescription: 'Giọng nữ đầy hơi ấm, tạo cảm giác an tâm.'
  },
  {
    voiceName: 'Umbriel',
    displayName: 'Umbriel',
    gender: 'Male',
    accent: 'Nam • Thong thả, dễ tính',
    vocalDescription: 'Giọng nam nhẹ nhàng như lời nhắc nhở.'
  },
  {
    voiceName: 'Vindemiatrix',
    displayName: 'Vindemiatrix',
    gender: 'Female',
    accent: 'Nữ • Dịu dàng, hiền lành',
    vocalDescription: 'Giọng đọc ngọt ngào và tử tế.'
  },
  {
    voiceName: 'Zubenelgenubi',
    displayName: 'Zubenelgenubi',
    gender: 'Male',
    accent: 'Nam • Phóng khoáng, tự do',
    vocalDescription: 'Giọng nam không gò bó, mang âm hưởng lang thang phiêu lãng.'
  }
];
