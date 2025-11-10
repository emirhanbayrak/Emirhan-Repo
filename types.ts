export enum ReadingStatus {
  Read = 'Okudum',
  Unread = 'Okumadım',
  Reading = 'Okuyorum',
  PlanningToRead = 'Okumayı Düşünüyorum',
  Dropped = 'Yarıda Bıraktım',
}

export interface Book {
  id: string;
  title: string;
  authors: string[];
  publisher: string;
  publishedDate: string;
  description: string;
  pageCount: number;
  categories: string[];
  imageLinks: {
    thumbnail: string;
  };
  // User-specific data
  readingStatus: ReadingStatus;
  currentPage: number;
}

export interface Filters {
  title: string;
  author: string;
  publisher: string;
  category: string;
  readingStatus: ReadingStatus | 'all';
}

export interface ApiBook {
  id: string;
  volumeInfo: {
    title:string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: {
      thumbnail: string;
    };
  };
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}