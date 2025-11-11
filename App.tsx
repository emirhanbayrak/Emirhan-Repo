import React, { useState, useMemo } from 'react';
import type { Book, Filters, ApiBook } from './types.ts';
import { ReadingStatus } from './types.ts';
import { searchBooks } from './services/geminiService.ts';
import BookCard from './components/BookCard.tsx';
import BookDetailModal from './components/BookDetailModal.tsx';
import StatsPanel from './components/StatsPanel.tsx';
import Accordion from './components/Accordion.tsx';
import BookwormChat from './components/BookwormChat.tsx';
import { PlusIcon, SearchIcon, XMarkIcon, ChatBubbleLeftRightIcon } from './components/Icons.tsx';


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

// Add Book Modal
const AddBookModal: React.FC<{ onClose: () => void; onBookAdd: (book: Book) => void }> = ({ onClose, onBookAdd }) => {
    // Search state
    const [titleQuery, setTitleQuery] = useState('');
    const [authorQuery, setAuthorQuery] = useState('');
    const [publisherQuery, setPublisherQuery] = useState('');
    const [isbnQuery, setIsbnQuery] = useState('');

    const [results, setResults] = useState<ApiBook[]>([]);
    const [selectedBook, setSelectedBook] = useState<ApiBook | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [isManualMode, setIsManualMode] = useState(false);

    // Manual form state
    const [manualTitle, setManualTitle] = useState('');
    const [manualAuthors, setManualAuthors] = useState('');
    const [manualPublisher, setManualPublisher] = useState('');
    const [manualPublishedDate, setManualPublishedDate] = useState('');
    const [manualDescription, setManualDescription] = useState('');
    const [manualCategories, setManualCategories] = useState('');
    const [manualImage, setManualImage] = useState('');

    // Shared state for reading progress
    const [pageCount, setPageCount] = useState('');
    const [currentPage, setCurrentPage] = useState('');
    const [readingStatus, setReadingStatus] = useState<ReadingStatus>(ReadingStatus.PlanningToRead);
    
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!titleQuery.trim()) return;

        let prompt = `Find books with the title "${titleQuery.trim()}".`;
        const refinements: string[] = [];
        if (authorQuery.trim()) refinements.push(`author: "${authorQuery.trim()}"`);
        if (publisherQuery.trim()) refinements.push(`publisher: "${publisherQuery.trim()}"`);
        if (isbnQuery.trim()) refinements.push(`ISBN: "${isbnQuery.trim()}"`);

        if (refinements.length > 0) {
          prompt += ` Refine the search with the following criteria: ${refinements.join(', ')}.`;
        }

        setIsLoading(true);
        setHasSearched(true);
        setError('');
        setResults([]);
        try {
            const books = await searchBooks(prompt);
            setResults(books);
        } catch (err) {
            setError('Failed to fetch books. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectBook = (book: ApiBook) => {
        setSelectedBook(book);
        setPageCount(book.volumeInfo.pageCount?.toString() || '');
        setCurrentPage('');
        setReadingStatus(ReadingStatus.PlanningToRead);
    };

    const handleAddBook = () => {
        const finalCurrentPage = (status: ReadingStatus, totalPages: number) => {
            if (status === ReadingStatus.Read) return totalPages;
            if (status === ReadingStatus.Unread || status === ReadingStatus.PlanningToRead) return 0;
            const current = parseInt(currentPage, 10) || 0;
            return Math.max(0, Math.min(current, totalPages));
        };
    
        const totalPages = parseInt(pageCount, 10);
        if (isNaN(totalPages) || totalPages <= 0) {
            alert("Please enter a valid number for total pages.");
            return;
        }
    
        let newBook: Book;
    
        if (selectedBook) {
            newBook = {
                id: selectedBook.id,
                title: selectedBook.volumeInfo.title,
                authors: selectedBook.volumeInfo.authors || ['Unknown Author'],
                publisher: selectedBook.volumeInfo.publisher || 'Unknown Publisher',
                publishedDate: selectedBook.volumeInfo.publishedDate || 'N/A',
                description: selectedBook.volumeInfo.description || 'No description available.',
                pageCount: totalPages,
                categories: selectedBook.volumeInfo.categories || ['Uncategorized'],
                imageLinks: {
                    thumbnail: selectedBook.volumeInfo.imageLinks?.thumbnail || `https://picsum.photos/seed/${selectedBook.id}/300/480`
                },
                readingStatus: readingStatus,
                currentPage: finalCurrentPage(readingStatus, totalPages)
            };
        } else { // Manual mode
            if (!manualTitle.trim() || !manualAuthors.trim()) {
                alert("Please fill in the required fields: Title and Author(s).");
                return;
            }
            newBook = {
                id: `manual_${Date.now()}`,
                title: manualTitle.trim(),
                authors: manualAuthors.split(',').map(a => a.trim()).filter(Boolean),
                publisher: manualPublisher.trim() || 'Unknown Publisher',
                publishedDate: manualPublishedDate.trim() || 'N/A',
                description: manualDescription.trim() || 'No description available.',
                pageCount: totalPages,
                categories: manualCategories ? manualCategories.split(',').map(c => c.trim()).filter(Boolean) : ['Uncategorized'],
                imageLinks: {
                    thumbnail: manualImage.trim() || `https://picsum.photos/seed/${manualTitle.replace(/\s/g, '')}/300/480`
                },
                readingStatus: readingStatus,
                currentPage: finalCurrentPage(readingStatus, totalPages)
            };
        }
        
        onBookAdd(newBook);
        onClose();
    };

    const needsCurrentPage = readingStatus === ReadingStatus.Reading || readingStatus === ReadingStatus.Dropped;

    const commonProgressFields = (
        <>
            <div>
                <label className="block text-sm font-medium text-gray-300">Reading Status</label>
                <select value={readingStatus} onChange={(e) => setReadingStatus(e.target.value as ReadingStatus)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500">
                    {Object.values(ReadingStatus).map(status => <option key={status} value={status}>{status}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300">Total Pages *</label>
                <input type="number" value={pageCount} onChange={e => setPageCount(e.target.value)} required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            {needsCurrentPage && (
                <div>
                    <label className="block text-sm font-medium text-gray-300">Current Page</label>
                    <input type="number" value={currentPage} onChange={e => setCurrentPage(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
            )}
        </>
    );

    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-800 text-white p-6 rounded-lg shadow-2xl max-w-2xl w-full h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {selectedBook ? (
                    // CONFIRMATION VIEW
                    <div className="flex-grow overflow-y-auto pr-2 flex flex-col">
                        <h2 className="text-2xl font-bold mb-4">Confirm Book Details</h2>
                        <div className="flex gap-6 items-start">
                            <img src={selectedBook.volumeInfo.imageLinks?.thumbnail || `https://picsum.photos/seed/${selectedBook.id}/200/320`} alt={selectedBook.volumeInfo.title} className="w-32 h-auto rounded-md shadow-lg" />
                            <div>
                               <h3 className="text-xl font-bold">{selectedBook.volumeInfo.title}</h3>
                               <p className="text-gray-300">{selectedBook.volumeInfo.authors?.join(', ')}</p>
                            </div>
                        </div>
                        <div className="mt-6 space-y-4">{commonProgressFields}</div>
                        <div className="mt-auto pt-4 flex justify-end gap-3">
                            <button onClick={() => setSelectedBook(null)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md">Back to Search</button>
                            <button onClick={handleAddBook} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md">Add to Library</button>
                        </div>
                    </div>
                ) : isManualMode ? (
                    // MANUAL ADD VIEW
                    <>
                        <h2 className="text-2xl font-bold mb-4">Add Book Manually</h2>
                        <div className="flex-grow overflow-y-auto pr-2 space-y-3 text-sm">
                            <div><label className="text-gray-400">Title *</label><input type="text" value={manualTitle} onChange={e => setManualTitle(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md mt-1 px-3 py-1.5" /></div>
                            <div><label className="text-gray-400">Author(s) * <span className="text-xs">(comma separated)</span></label><input type="text" value={manualAuthors} onChange={e => setManualAuthors(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md mt-1 px-3 py-1.5" /></div>
                            <div><label className="text-gray-400">Publisher</label><input type="text" value={manualPublisher} onChange={e => setManualPublisher(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md mt-1 px-3 py-1.5" /></div>
                            <div><label className="text-gray-400">Published Date</label><input type="text" value={manualPublishedDate} onChange={e => setManualPublishedDate(e.target.value)} placeholder="YYYY-MM-DD" className="w-full bg-gray-700 border border-gray-600 rounded-md mt-1 px-3 py-1.5" /></div>
                            <div><label className="text-gray-400">Cover Image URL</label><input type="text" value={manualImage} onChange={e => setManualImage(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md mt-1 px-3 py-1.5" /></div>
                            <div><label className="text-gray-400">Categories <span className="text-xs">(comma separated)</span></label><input type="text" value={manualCategories} onChange={e => setManualCategories(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md mt-1 px-3 py-1.5" /></div>
                            <div><label className="text-gray-400">Description</label><textarea value={manualDescription} onChange={e => setManualDescription(e.target.value)} rows={3} className="w-full bg-gray-700 border border-gray-600 rounded-md mt-1 px-3 py-1.5" /></div>
                            <div className="space-y-3 pt-2 border-t border-gray-700">{commonProgressFields}</div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end gap-3">
                            <button onClick={() => setIsManualMode(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md">Back to Search</button>
                            <button onClick={handleAddBook} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md">Add to Library</button>
                        </div>
                    </>
                ) : (
                    // SEARCH VIEW
                    <>
                        <h2 className="text-2xl font-bold mb-4">Add a New Book</h2>
                        <form onSubmit={handleSearch} className="mb-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300">Kitap Adı *</label>
                                    <input
                                        type="text"
                                        value={titleQuery}
                                        onChange={(e) => setTitleQuery(e.target.value)}
                                        className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300">Yazar</label>
                                    <input
                                        type="text"
                                        value={authorQuery}
                                        onChange={(e) => setAuthorQuery(e.target.value)}
                                        className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300">Yayınevi</label>
                                    <input
                                        type="text"
                                        value={publisherQuery}
                                        onChange={(e) => setPublisherQuery(e.target.value)}
                                        className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300">ISBN</label>
                                    <input
                                        type="text"
                                        value={isbnQuery}
                                        onChange={(e) => setIsbnQuery(e.target.value)}
                                        className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-md transition-colors duration-300 flex items-center gap-2 disabled:bg-indigo-400">
                                    {isLoading ? 'Aranıyor...' : <> <SearchIcon className="w-5 h-5" /> Ara </>}
                                </button>
                            </div>
                        </form>
                        <div className="flex-grow overflow-y-auto pr-2">
                           {error && <p className="text-red-400">{error}</p>}
                           {isLoading && <div className="text-center p-4">Searching for books...</div>}
                           {hasSearched && !isLoading && results.length === 0 && (
                               <div className="text-center py-10">
                                   <p className="text-gray-400">Arama kriterlerinize uygun kitap bulunamadı.</p>
                                   <button onClick={() => setIsManualMode(true)} className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                                       Kitabı Manuel Ekle
                                   </button>
                               </div>
                           )}
                           {results.map(book => (
                                <div key={book.id} onClick={() => handleSelectBook(book)} className="flex items-center gap-4 p-2 rounded-md hover:bg-gray-700 cursor-pointer transition-colors">
                                    <img src={book.volumeInfo.imageLinks?.thumbnail || `https://picsum.photos/seed/${book.id}/80/120`} alt={book.volumeInfo.title} className="w-12 h-auto rounded-sm" />
                                    <div>
                                        <p className="font-semibold">{book.volumeInfo.title}</p>
                                        <p className="text-sm text-gray-400">{book.volumeInfo.authors?.join(', ')}</p>
                                        <p className="text-xs text-gray-500">{book.volumeInfo.publisher} ({book.volumeInfo.publishedDate?.substring(0,4)})</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
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

  const addBook = (book: Book) => {
    if (books.some(b => b.id === book.id)) {
        alert("This book is already in your library.");
        return;
    }
    setBooks(prev => [...prev, book]);
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
      {isAddModalOpen && <AddBookModal onClose={() => setIsAddModalOpen(false)} onBookAdd={addBook} />}
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