import type {
  Category,
  CultureEvent,
  CultureNotification,
  UserProfile,
} from '../types';

export const CATEGORIES: Category[] = [
  '전체',
  '전시',
  '공연',
  '클래스',
  '행사',
  '공간',
];

export const CULTURE_EVENTS: CultureEvent[] = [
  {
    id: 'mmca-hyundai-2024',
    title: 'MMCA 현대차 시리즈 2024',
    subtitle: '국립현대미술관 서울',
    category: '전시',
    priceTier: 'free',
    priceLabel: '무료',
    reservationRequired: true,
    thumbnail:
      'https://images.unsplash.com/photo-1545987796-200677ee1011?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1545987796-200677ee1011?auto=format&fit=crop&w=1200&q=80',
    ],
    description:
      '동시대 미술의 새로운 흐름을 조망하는 대형 기획전입니다. 회화, 설치, 영상 작품을 한 자리에서 만나며 무료 사전 예약으로 관람할 수 있습니다.',
    hashtags: ['현대미술', '무료전시', '서울전시'],
    location: {
      address: '서울 종로구 삼청로 30 국립현대미술관 서울',
      lat: 37.57862,
      lng: 126.98093,
    },
    schedule: {
      startDate: '2026-05-01',
      endDate: '2026-08-31',
      operatingHours: '10:00-18:00',
      closedDays: '매주 월요일',
    },
    rating: 4.8,
    reviewCount: 2400,
    favoriteCount: 128,
    reservationUrl: 'https://www.mmca.go.kr',
  },
  {
    id: 'seoul-library-night',
    title: '서울도서관 밤의 인문학',
    subtitle: '서울도서관',
    category: '공간',
    priceTier: 'free',
    priceLabel: '무료',
    reservationRequired: false,
    thumbnail:
      'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1200&q=80',
    ],
    description:
      '퇴근 후 들르기 좋은 무료 인문학 프로그램입니다. 낭독과 짧은 강연, 시민 대화가 이어지는 도심 속 문화 쉼표입니다.',
    hashtags: ['도서관', '인문학', '퇴근후'],
    location: {
      address: '서울 중구 세종대로 110',
      lat: 37.56632,
      lng: 126.97783,
    },
    schedule: {
      startDate: '2026-05-20',
      endDate: '2026-06-18',
      operatingHours: '19:00-21:00',
      closedDays: '공휴일',
    },
    rating: 4.6,
    reviewCount: 318,
    favoriteCount: 91,
    reservationUrl: 'https://lib.seoul.go.kr',
  },
  {
    id: 'hangang-jazz-picnic',
    title: '한강 재즈 피크닉',
    subtitle: '여의도 한강공원',
    category: '공연',
    priceTier: 'free',
    priceLabel: '무료',
    reservationRequired: false,
    thumbnail:
      'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=80',
    ],
    description:
      '잔디밭에서 즐기는 무료 야외 재즈 공연입니다. 돗자리와 간단한 간식을 챙기면 주말 저녁을 가볍게 채울 수 있습니다.',
    hashtags: ['무료공연', '한강', '재즈'],
    location: {
      address: '서울 영등포구 여의동로 330',
      lat: 37.52842,
      lng: 126.93312,
    },
    schedule: {
      startDate: '2026-05-24',
      endDate: '2026-05-24',
      operatingHours: '17:00-20:00',
      closedDays: '우천 시 취소',
    },
    rating: 4.7,
    reviewCount: 880,
    favoriteCount: 302,
  },
  {
    id: 'sema-photo-walk',
    title: '도심 사진 산책 워크숍',
    subtitle: '서울시립미술관 서소문',
    category: '클래스',
    priceTier: 'cheap',
    priceLabel: '8,000원',
    reservationRequired: true,
    thumbnail:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    ],
    description:
      '스마트폰으로 도시의 빛과 선을 기록하는 입문 워크숍입니다. 전시 관람 후 주변 골목을 함께 걸으며 촬영합니다.',
    hashtags: ['사진클래스', '만원이하', '도심산책'],
    location: {
      address: '서울 중구 덕수궁길 61',
      lat: 37.56411,
      lng: 126.97376,
    },
    schedule: {
      startDate: '2026-05-25',
      endDate: '2026-05-25',
      operatingHours: '14:00-16:00',
      closedDays: '없음',
    },
    rating: 4.5,
    reviewCount: 142,
    favoriteCount: 77,
    reservationUrl: 'https://sema.seoul.go.kr',
  },
  {
    id: 'ddp-design-market',
    title: 'DDP 디자인 마켓',
    subtitle: '동대문디자인플라자',
    category: '행사',
    priceTier: 'free',
    priceLabel: '무료',
    reservationRequired: false,
    thumbnail:
      'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80',
    ],
    description:
      '신진 디자이너의 굿즈와 공예품을 만나는 주말 마켓입니다. 무료 입장으로 전시와 팝업을 함께 둘러볼 수 있습니다.',
    hashtags: ['디자인', '마켓', '주말추천'],
    location: {
      address: '서울 중구 을지로 281',
      lat: 37.56653,
      lng: 127.00931,
    },
    schedule: {
      startDate: '2026-05-23',
      endDate: '2026-05-26',
      operatingHours: '11:00-20:00',
      closedDays: '없음',
    },
    rating: 4.4,
    reviewCount: 590,
    favoriteCount: 201,
  },
  {
    id: 'bukchon-craft-open',
    title: '북촌 공예 오픈스튜디오',
    subtitle: '북촌문화센터',
    category: '클래스',
    priceTier: 'free',
    priceLabel: '무료',
    reservationRequired: true,
    thumbnail:
      'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1200&q=80',
    ],
    description:
      '전통 공예 작가의 작업실을 둘러보고 간단한 만들기를 체험합니다. 가족 단위 방문객에게 좋은 무료 체험 프로그램입니다.',
    hashtags: ['공예', '가족체험', '북촌'],
    location: {
      address: '서울 종로구 계동길 37',
      lat: 37.57903,
      lng: 126.98642,
    },
    schedule: {
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      operatingHours: '10:00-17:00',
      closedDays: '월요일',
    },
    rating: 4.9,
    reviewCount: 88,
    favoriteCount: 64,
    reservationUrl: 'https://hanok.seoul.go.kr',
  },
  {
    id: 'nodeul-sunset-cinema',
    title: '노들섬 선셋 시네마',
    subtitle: '노들섬 라이브하우스 앞',
    category: '행사',
    priceTier: 'free',
    priceLabel: '무료',
    reservationRequired: false,
    thumbnail:
      'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80',
    ],
    description:
      '해질녘 야외에서 독립영화를 감상하는 무료 상영회입니다. 선착순 입장이라 일찍 도착하는 것을 추천합니다.',
    hashtags: ['영화', '야외상영', '노들섬'],
    location: {
      address: '서울 용산구 양녕로 445',
      lat: 37.51768,
      lng: 126.95801,
    },
    schedule: {
      startDate: '2026-05-30',
      endDate: '2026-05-30',
      operatingHours: '19:30-22:00',
      closedDays: '우천 시 취소',
    },
    rating: 4.3,
    reviewCount: 420,
    favoriteCount: 187,
  },
  {
    id: 'mapo-book-club',
    title: '마포 책방 산책 클럽',
    subtitle: '마포중앙도서관',
    category: '공간',
    priceTier: 'free',
    priceLabel: '무료',
    reservationRequired: true,
    thumbnail:
      'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1200&q=80',
    ],
    description:
      '동네 독립서점과 도서관을 연결하는 산책형 독서 모임입니다. 가볍게 참여하고 취향이 맞는 책을 발견할 수 있습니다.',
    hashtags: ['독서모임', '마포', '동네문화'],
    location: {
      address: '서울 마포구 성산로 128',
      lat: 37.56374,
      lng: 126.90848,
    },
    schedule: {
      startDate: '2026-05-28',
      endDate: '2026-07-02',
      operatingHours: '19:00-20:30',
      closedDays: '없음',
    },
    rating: 4.6,
    reviewCount: 106,
    favoriteCount: 55,
    reservationUrl: 'https://mplib.mapo.go.kr',
  },
  {
    id: 'oil-tank-media',
    title: '문화비축기지 미디어 아트',
    subtitle: '문화비축기지',
    category: '전시',
    priceTier: 'free',
    priceLabel: '무료',
    reservationRequired: false,
    thumbnail:
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80',
    ],
    description:
      '산업 유산 공간 안에서 빛과 소리로 구성된 미디어 작품을 만납니다. 산책과 전시를 한 번에 즐기기 좋습니다.',
    hashtags: ['미디어아트', '무료전시', '산책'],
    location: {
      address: '서울 마포구 증산로 87',
      lat: 37.57106,
      lng: 126.89371,
    },
    schedule: {
      startDate: '2026-05-10',
      endDate: '2026-07-15',
      operatingHours: '10:00-18:00',
      closedDays: '월요일',
    },
    rating: 4.5,
    reviewCount: 267,
    favoriteCount: 118,
  },
  {
    id: 'seoul-plaza-dance',
    title: '서울광장 모두의 댄스',
    subtitle: '서울광장',
    category: '공연',
    priceTier: 'free',
    priceLabel: '무료',
    reservationRequired: false,
    thumbnail:
      'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?auto=format&fit=crop&w=1200&q=80',
    ],
    description:
      '시민 누구나 참여할 수 있는 야외 댄스 공연과 오픈 클래스입니다. 관람만 해도 좋고 현장에서 바로 참여할 수 있습니다.',
    hashtags: ['댄스', '참여형', '서울광장'],
    location: {
      address: '서울 중구 세종대로 110',
      lat: 37.5658,
      lng: 126.9786,
    },
    schedule: {
      startDate: '2026-06-06',
      endDate: '2026-06-06',
      operatingHours: '16:00-19:00',
      closedDays: '우천 시 취소',
    },
    rating: 4.2,
    reviewCount: 340,
    favoriteCount: 132,
  },
  {
    id: 'seongsu-maker-tour',
    title: '성수 메이커 투어',
    subtitle: '성수동 일대',
    category: '클래스',
    priceTier: 'cheap',
    priceLabel: '10,000원',
    reservationRequired: true,
    thumbnail:
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80',
    ],
    description:
      '성수동의 소규모 제작 공간을 둘러보고 창작자와 대화하는 워킹 투어입니다. 적은 비용으로 로컬 문화를 깊게 만납니다.',
    hashtags: ['성수', '메이커', '만원이하'],
    location: {
      address: '서울 성동구 연무장길 1',
      lat: 37.54458,
      lng: 127.05596,
    },
    schedule: {
      startDate: '2026-06-13',
      endDate: '2026-06-13',
      operatingHours: '13:00-15:30',
      closedDays: '없음',
    },
    rating: 4.7,
    reviewCount: 72,
    favoriteCount: 49,
    reservationUrl: 'https://www.sd.go.kr',
  },
  {
    id: 'gwanghwamun-history-walk',
    title: '광화문 역사 산책',
    subtitle: '세종문화회관 앞',
    category: '행사',
    priceTier: 'free',
    priceLabel: '무료',
    reservationRequired: true,
    thumbnail:
      'https://images.unsplash.com/photo-1538485399081-7c8c854d8e33?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1538485399081-7c8c854d8e33?auto=format&fit=crop&w=1200&q=80',
    ],
    description:
      '도심의 역사적 장소를 해설사와 함께 걷는 무료 투어입니다. 짧은 시간 안에 서울의 오래된 이야기를 만납니다.',
    hashtags: ['역사산책', '해설투어', '광화문'],
    location: {
      address: '서울 종로구 세종대로 175',
      lat: 37.57291,
      lng: 126.97692,
    },
    schedule: {
      startDate: '2026-05-31',
      endDate: '2026-06-21',
      operatingHours: '10:00-12:00',
      closedDays: '월요일',
    },
    rating: 4.8,
    reviewCount: 213,
    favoriteCount: 83,
    reservationUrl: 'https://www.sejongpac.or.kr',
  },
];

export const TRENDING_SEARCHES = [
  '무료공연',
  '이번 주말',
  'MMCA',
  '아트선재센터',
  '연극',
  '클래스',
];

export const MOCK_NOTIFICATIONS: CultureNotification[] = [
  {
    id: 'noti-1',
    type: 'today_pick',
    title: '오늘의 추천이 도착했어요',
    body: '지금 무료로 볼 수 있는 전시 4개를 골라봤어요.',
    createdAt: '2026-05-08T09:00:00+09:00',
    read: false,
    eventId: 'mmca-hyundai-2024',
  },
  {
    id: 'noti-2',
    type: 'urgent',
    title: '이번 주말 마감 임박',
    body: '한강 재즈 피크닉이 이번 주말에 열려요.',
    createdAt: '2026-05-07T18:30:00+09:00',
    read: false,
    eventId: 'hangang-jazz-picnic',
  },
  {
    id: 'noti-3',
    type: 'reminder',
    title: '저장한 일정 리마인드',
    body: '북촌 공예 오픈스튜디오 예약 시간을 확인해보세요.',
    createdAt: '2026-05-06T12:00:00+09:00',
    read: true,
    eventId: 'bukchon-craft-open',
  },
];

export const MOCK_USER: UserProfile = {
  id: 'user-1',
  nickname: '고래',
  handle: '@AVIATE8',
  district: '마포구',
  interests: ['전시', '공연', '공간'],
  budgetTier: 'free',
  visitedCount: 36,
  upcomingCount: 3,
  reviewCount: 12,
};
