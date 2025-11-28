
import React, { useState } from 'react';
import type { ApiBook, Book } from '../types.ts';
import { ReadingStatus } from '../types.ts';
import { searchBooks } from '../services/geminiService.ts';
import { SearchIcon, CloudArrowUpIcon, DocumentTextIcon, CheckIcon } from './Icons.tsx';

// Separate component file or put in this file for simplicity
const AddBookModal: React.FC<{ onClose: () => void; onBookAdd: (book: Book | Book[]) => void; books: Book[] }> = ({ onClose, onBookAdd, books }) => {
    // Modes: 'search' | 'manual' | 'bulk'
    const [mode, setMode] = useState<'search' | 'manual' | 'bulk'>('search');

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

    // Bulk Upload State
    const [parsedBooks, setParsedBooks] = useState<Book[]>([]);
    const [bulkError, setBulkError] = useState('');
    const [bulkSuccessCount, setBulkSuccessCount] = useState(0);

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

    // --- BULK UPLOAD LOGIC ---

    const parseCSV = (text: string) => {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) throw new Error("CSV file is empty or missing headers");

        // Simple CSV parser handling quotes
        const parseLine = (line: string) => {
             // Split by comma only if not inside quotes
             const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/; 
             return line.split(regex).map(val => val.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        };

        const headers = parseLine(lines[0].toLowerCase());
        const booksFound: Book[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseLine(lines[i]);
            if (values.length < headers.length) continue;

            const row: any = {};
            headers.forEach((header, index) => {
                row[header] = values[index];
            });

            if (!row.title || !row.author) continue; // Minimal requirement

            const pageCountVal = parseInt(row.pagecount || row.pages || '0', 10);
            
            booksFound.push({
                id: `bulk_${Date.now()}_${i}`,
                title: row.title,
                authors: row.author ? row.author.split(',').map((a: string) => a.trim()) : (row.authors ? row.authors.split(',').map((a: string) => a.trim()) : ['Unknown']),
                publisher: row.publisher || 'Unknown Publisher',
                publishedDate: row.publisheddate || row.year || 'N/A',
                description: row.description || '',
                pageCount: isNaN(pageCountVal) ? 0 : pageCountVal,
                categories: row.categories ? row.categories.split(',').map((c: string) => c.trim()) : (row.category ? [row.category] : ['Uncategorized']),
                imageLinks: {
                    thumbnail: row.imagelink || row.thumbnail || `https://picsum.photos/seed/${row.title.replace(/\s/g, '')}/300/480`
                },
                readingStatus: Object.values(ReadingStatus).includes(row.status as ReadingStatus) ? row.status as ReadingStatus : ReadingStatus.PlanningToRead,
                currentPage: parseInt(row.currentpage || '0', 10)
            });
        }
        return booksFound;
    };

    const parseXML = (text: string) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const bookNodes = xmlDoc.getElementsByTagName("book");
        const booksFound: Book[] = [];

        const getText = (parent: Element, tag: string) => parent.getElementsByTagName(tag)[0]?.textContent || '';

        for (let i = 0; i < bookNodes.length; i++) {
            const node = bookNodes[i];
            const title = getText(node, 'title');
            const author = getText(node, 'author');
            
            if (!title) continue;

            const pageCountVal = parseInt(getText(node, 'pageCount') || getText(node, 'pages') || '0', 10);
            const statusRaw = getText(node, 'status');

            booksFound.push({
                id: `bulk_${Date.now()}_${i}`,
                title: title,
                authors: author ? author.split(',').map(a => a.trim()) : ['Unknown'],
                publisher: getText(node, 'publisher') || 'Unknown Publisher',
                publishedDate: getText(node, 'publishedDate') || 'N/A',
                description: getText(node, 'description'),
                pageCount: isNaN(pageCountVal) ? 0 : pageCountVal,
                categories: getText(node, 'categories') ? getText(node, 'categories').split(',') : ['Uncategorized'],
                imageLinks: {
                    thumbnail: getText(node, 'thumbnail') || `https://picsum.photos/seed/${title.replace(/\s/g, '')}/300/480`
                },
                readingStatus: Object.values(ReadingStatus).includes(statusRaw as ReadingStatus) ? statusRaw as ReadingStatus : ReadingStatus.PlanningToRead,
                currentPage: parseInt(getText(node, 'currentPage') || '0', 10)
            });
        }
        return booksFound;
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setBulkError('');
        setParsedBooks([]);
        setBulkSuccessCount(0);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target?.result as string;
            try {
                let foundBooks: Book[] = [];
                if (file.name.endsWith('.csv')) {
                    foundBooks = parseCSV(text);
                } else if (file.name.endsWith('.xml')) {
                    foundBooks = parseXML(text);
                } else {
                    throw new Error("Unsupported file format. Please use .csv or .xml");
                }
                
                if (foundBooks.length === 0) {
                    setBulkError("No valid books found in file.");
                } else {
                    setParsedBooks(foundBooks);
                }
            } catch (err: any) {
                setBulkError(err.message || "Failed to parse file.");
            }
        };
        reader.readAsText(file);
    };

    const handleBulkImport = () => {
        const newBooks: Book[] = [];
        parsedBooks.forEach(book => {
             // Basic duplicate check using existing books prop
             const isDuplicate = books.some(b => 
                b.title.toLowerCase() === book.title.toLowerCase() && 
                b.authors[0]?.toLowerCase() === book.authors[0]?.toLowerCase()
             );

             if (!isDuplicate) {
                 newBooks.push(book);
             }
        });

        if (newBooks.length > 0) {
            onBookAdd(newBooks);
            setBulkSuccessCount(newBooks.length);
        } else {
            // If all were duplicates or parsing failed
            setBulkSuccessCount(0);
        }
        
        // Don't close immediately so they see the result
        setTimeout(() => {
            if (newBooks.length > 0) {
                 // optionally auto close
            }
        }, 1500);
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
                    // CONFIRMATION VIEW (Existing Code)
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
                ) : mode === 'manual' ? (
                    // MANUAL ADD VIEW (Existing Code)
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
                            <button onClick={() => setMode('search')} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md">Back to Search</button>
                            <button onClick={handleAddBook} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md">Add to Library</button>
                        </div>
                    </>
                ) : mode === 'bulk' ? (
                     // BULK UPLOAD VIEW
                     <>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <CloudArrowUpIcon className="w-8 h-8 text-indigo-400" />
                            Bulk Upload
                        </h2>
                        
                        {!bulkSuccessCount ? (
                            <div className="flex-grow flex flex-col gap-4">
                                <p className="text-sm text-gray-400">
                                    Upload a .csv or .xml file to import multiple books at once. 
                                    <br/>CSV headers should include: <code>title, author, publisher, pages, status</code>.
                                </p>
                                
                                <label className="flex-1 flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700/50 hover:bg-gray-700 transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <CloudArrowUpIcon className="w-10 h-10 mb-3 text-gray-400" />
                                        <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                        <p className="text-xs text-gray-500">CSV or XML</p>
                                    </div>
                                    <input type="file" className="hidden" accept=".csv,.xml" onChange={handleFileUpload} />
                                </label>

                                {bulkError && (
                                    <div className="p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
                                        {bulkError}
                                    </div>
                                )}

                                {parsedBooks.length > 0 && (
                                    <div className="flex-grow overflow-y-auto border border-gray-700 rounded-md p-2">
                                        <h3 className="text-sm font-semibold mb-2 sticky top-0 bg-gray-800 py-1">Preview ({parsedBooks.length} books)</h3>
                                        <div className="space-y-2">
                                            {parsedBooks.map((book, idx) => (
                                                <div key={idx} className="flex items-start gap-3 p-2 bg-gray-700/50 rounded text-sm">
                                                    <DocumentTextIcon className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <div className="font-medium text-white">{book.title}</div>
                                                        <div className="text-gray-400">{book.authors.join(', ')}</div>
                                                        <div className="text-xs text-gray-500 mt-0.5">{book.publisher}, {book.pageCount} pages</div>
                                                        {books.some(b => b.title.toLowerCase() === book.title.toLowerCase()) && (
                                                            <div className="text-xs text-yellow-500 mt-1">Warning: Likely duplicate</div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-grow flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
                                    <CheckIcon className="w-10 h-10 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Import Successful!</h3>
                                <p className="text-gray-300">Successfully added {bulkSuccessCount} books to your library.</p>
                                {parsedBooks.length - bulkSuccessCount > 0 && (
                                    <p className="text-sm text-yellow-500 mt-2">{parsedBooks.length - bulkSuccessCount} duplicates were skipped.</p>
                                )}
                            </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end gap-3">
                            {bulkSuccessCount > 0 ? (
                                <button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md">
                                    Close
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => { setMode('search'); setParsedBooks([]); setBulkError(''); }} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md">
                                        Back
                                    </button>
                                    <button 
                                        onClick={handleBulkImport} 
                                        disabled={parsedBooks.length === 0}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md disabled:bg-indigo-400 disabled:cursor-not-allowed"
                                    >
                                        Import {parsedBooks.length > 0 ? `(${parsedBooks.length})` : ''}
                                    </button>
                                </>
                            )}
                        </div>
                     </>
                ) : (
                    // SEARCH VIEW (Default)
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
                                   <div className="flex gap-2 justify-center mt-4">
                                       <button onClick={() => setMode('manual')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                                           Manual Entry
                                       </button>
                                       <button onClick={() => setMode('bulk')} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center gap-2">
                                           <CloudArrowUpIcon className="w-5 h-5" />
                                           Bulk Upload
                                       </button>
                                   </div>
                               </div>
                           )}
                           {!hasSearched && (
                               <div className="flex justify-center mt-8 gap-4">
                                   <button onClick={() => setMode('manual')} className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-200 border border-purple-500/50 font-bold py-3 px-6 rounded-md transition-colors">
                                       Add Manually
                                   </button>
                                   <button onClick={() => setMode('bulk')} className="bg-gray-700/50 hover:bg-gray-700 text-gray-200 border border-gray-600 font-bold py-3 px-6 rounded-md transition-colors flex items-center gap-2">
                                       <CloudArrowUpIcon className="w-5 h-5" />
                                       Bulk Upload (CSV/XML)
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

export default AddBookModal;
