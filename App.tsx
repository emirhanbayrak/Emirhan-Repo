
import React, { useState, useMemo } from 'react';
import type { Book, Filters, ApiBook } from './types.ts';
import { ReadingStatus } from './types.ts';
import { searchBooks } from './services/geminiService.ts';
import BookCard from './components/BookCard.tsx';
import BookDetailModal from './components/BookDetailModal.tsx';
import StatsPanel from './components/StatsPanel.tsx';
import Accordion from './components/Accordion.tsx';
import BookwormChat from './components/BookwormChat.tsx';
import AddBookModal from './components/AddBookModal.tsx';
import { PlusIcon, XMarkIcon, ChatBubbleLeftRightIcon } from './components/Icons.tsx';


// --- Helper Functions ---
const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
};

// --- Components defined inside App.tsx to avoid prop drilling ---

// Onboarding Modal
const OnboardingModal: React.FC<{ onNameSubmit: (name: string) => void }> = ({ onNameSubmit }) => {
    const [name, setName] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onNameSubmit(name.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 text-white p-8 rounded-lg shadow-2xl max-w-sm w-full">
                <h2 className="text-2xl font-bold mb-4">Welcome to Your Library!</h2>
                <p className="text-gray-400 mb-6">Please enter your name to get started.</p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Your Name"
                        autoFocus
                    />
                    <button type="submit" className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-300">
                        Continue
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- Main App Component ---
const App: React.FC = () => {
  const [userName, setUserName] = useLocalStorage<string | null>('library_user_name', null);
  const [books, setBooks] = useLocalStorage<Book[]>('library_books', []);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedBookDetail, setSelectedBookDetail] = useState<Book | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const initialFilters: Filters = {
    title: '',
    author: '',
    publisher: '',
    category: '',
    readingStatus: 'all',
  };
  const [filters, setFilters] = useState<Filters>(initialFilters);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  
  const clearFilters = () => {
    setFilters(initialFilters);
  };

  const addBook = (bookOrBooks: Book | Book[]) => {
    if (Array.isArray(bookOrBooks)) {
      // Bulk add logic
      const newBooks = bookOrBooks.filter(newBook => !books.some(b => b.id === newBook.id));
      if (newBooks.length > 0) {
        setBooks(prev => [...prev, ...newBooks]);
      }
    } else {
      // Single add logic
      if (books.some(b => b.id === bookOrBooks.id)) {
          alert("This book is already in your library.");
          return;
      }
      setBooks(prev => [...prev, bookOrBooks]);
    }
  };
  
  const updateBook = (updatedBook: Book) => {
    setBooks(prevBooks => 
      prevBooks.map(book => book.id === updatedBook.id ? updatedBook : book)
    );
    setSelectedBookDetail(updatedBook); // Keep modal open with updated info
  };


  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      const titleMatch = book.title.toLowerCase().includes(filters.title.toLowerCase());
      const authorMatch = book.authors.join(', ').toLowerCase().includes(filters.author.toLowerCase());
      const publisherMatch = book.publisher.toLowerCase().includes(filters.publisher.toLowerCase());
      const categoryMatch = filters.category === '' || book.categories.join(', ').toLowerCase().includes(filters.category.toLowerCase());
      const statusMatch = filters.readingStatus === 'all' || book.readingStatus === filters.readingStatus;
      return titleMatch && authorMatch && publisherMatch && categoryMatch && statusMatch;
    });
  }, [books, filters]);
  
  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    books.forEach(book => book.categories.forEach(cat => categories.add(cat)));
    return Array.from(categories).sort();
  }, [books]);

  if (!userName) {
    return <OnboardingModal onNameSubmit={setUserName} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {isAddModalOpen && <AddBookModal onClose={() => setIsAddModalOpen(false)} onBookAdd={addBook} books={books} />}
      {selectedBookDetail && <BookDetailModal book={selectedBookDetail} onClose={() => setSelectedBookDetail(null)} onUpdateBook={updateBook} />}
      
      <header className="bg-gray-800/50 backdrop-blur-sm p-4 flex justify-between items-center shadow-md sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-gray-100">
          <span className="text-indigo-400">{userName}'s</span> Library
        </h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-full flex items-center gap-2 transition-transform duration-200 hover:scale-105"
        >
          <PlusIcon className="w-5 h-5" />
          <span>Add Book</span>
        </button>
      </header>

      <div className="flex-grow flex">
        {/* Sidebar */}
        <aside className="w-1/5 min-w-[250px] bg-gray-800 p-6 flex flex-col">
          <StatsPanel books={books} />
          <div className="flex-grow overflow-y-auto -mr-4 pr-4 space-y-1">
            <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-2">
                <h2 className="text-lg font-semibold">Filters</h2>
                <button
                    onClick={clearFilters}
                    className="text-xs text-gray-400 hover:text-white flex items-center gap-1 p-1 rounded-md hover:bg-gray-700"
                    title="Clear all filters"
                >
                    <XMarkIcon className="w-4 h-4" />
                    Clear
                </button>
            </div>

            <Accordion title="Search by Text" startOpen={true}>
              <div>
                <label className="text-sm text-gray-400">Title</label>
                <input type="text" name="title" value={filters.title} onChange={handleFilterChange} className="w-full bg-gray-700 border border-gray-600 rounded-md mt-1 px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-400">Author</label>
                <input type="text" name="author" value={filters.author} onChange={handleFilterChange} className="w-full bg-gray-700 border border-gray-600 rounded-md mt-1 px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-400">Publisher</label>
                <input type="text" name="publisher" value={filters.publisher} onChange={handleFilterChange} className="w-full bg-gray-700 border border-gray-600 rounded-md mt-1 px-3 py-1.5 text-sm" />
              </div>
            </Accordion>

            <Accordion title="Filter by Selection">
               <div>
                <label className="text-sm text-gray-400">Category</label>
                <select name="category" value={filters.category} onChange={handleFilterChange} className="w-full bg-gray-700 border border-gray-600 rounded-md mt-1 px-3 py-1.5 text-sm">
                    <option value="">All Categories</option>
                    {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400">Reading Status</label>
                <select name="readingStatus" value={filters.readingStatus} onChange={handleFilterChange} className="w-full bg-gray-700 border border-gray-600 rounded-md mt-1 px-3 py-1.5 text-sm">
                  <option value="all">All Statuses</option>
                  {Object.values(ReadingStatus).map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </Accordion>
          </div>
        </aside>

        {/* Main Content */}
        <main className="w-4/5 p-8 overflow-y-auto">
          {filteredBooks.length > 0 ? (
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                {filteredBooks.map(book => <BookCard key={book.id} book={book} onCardClick={() => setSelectedBookDetail(book)} />)}
             </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <p className="text-lg">Your library is empty or no books match your filters.</p>
                <p>Click "Add Book" to start your collection!</p>
            </div>
          )}
        </main>
      </div>

      {/* Floating Action Button for Chat */}
      <button 
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-8 right-8 bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-full shadow-lg transition-transform duration-200 hover:scale-110 z-40"
        aria-label="Open Bookworm Chat"
      >
        <ChatBubbleLeftRightIcon className="w-8 h-8"/>
      </button>

      {isChatOpen && <BookwormChat books={books} onClose={() => setIsChatOpen(false)} />}
    </div>
  );
};

export default App;
