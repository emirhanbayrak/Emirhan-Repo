
import React, { useState } from 'react';
import type { Book } from '../types.ts';
import { ReadingStatus } from '../types.ts';
import { searchBookCovers } from '../services/geminiService.ts';
import ProgressBar from './ProgressBar.tsx';
import { XMarkIcon, LinkIcon, CheckIcon, SearchIcon } from './Icons.tsx';

interface BookDetailModalProps {
  book: Book;
  onClose: () => void;
  onUpdateBook: (book: Book) => void;
}

const BookDetailModal: React.FC<BookDetailModalProps> = ({ book, onClose, onUpdateBook }) => {
    const [imageUrl, setImageUrl] = useState('');
    const [showUrlInput, setShowUrlInput] = useState(false);
    
    // State for updating reading status
    const [currentStatus, setCurrentStatus] = useState<ReadingStatus>(book.readingStatus);
    const [currentPageInput, setCurrentPageInput] = useState<string>(book.currentPage.toString());
    const [isSaved, setIsSaved] = useState(false);

    // New state for web search
    const [isWebSearchOpen, setIsWebSearchOpen] = useState(false);
    const [webSearchResults, setWebSearchResults] = useState<string[]>([]);
    const [isSearchingImages, setIsSearchingImages] = useState(false);
    const [selectedWebImage, setSelectedWebImage] = useState<string | null>(null);

    
    const handleUpdateCoverFromUrl = () => {
        if (imageUrl.trim()) {
            try {
                new URL(imageUrl);
                onUpdateBook({ ...book, imageLinks: { thumbnail: imageUrl } });
                setImageUrl('');
                setShowUrlInput(false);
            } catch (_) {
                alert('Please enter a valid URL.');
            }
        }
    };

    const handleStatusUpdate = () => {
        const totalPages = book.pageCount;
        let finalCurrentPage = 0;

        if (currentStatus === ReadingStatus.Read) {
            finalCurrentPage = totalPages;
        } else if (currentStatus === ReadingStatus.Unread || currentStatus === ReadingStatus.PlanningToRead) {
            finalCurrentPage = 0;
        } else { // Reading or Dropped
            const newPage = parseInt(currentPageInput, 10);
            if (isNaN(newPage) || newPage < 0) {
                finalCurrentPage = 0;
            } else if (newPage > totalPages) {
                finalCurrentPage = totalPages;
            } else {
                finalCurrentPage = newPage;
            }
        }

        const updatedBook: Book = {
            ...book,
            readingStatus: currentStatus,
            currentPage: finalCurrentPage
        };
        
        onUpdateBook(updatedBook);
        setCurrentPageInput(finalCurrentPage.toString()); // Sync input with validated value

        // Show saved confirmation
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const handleOpenWebSearch = async () => {
        setIsWebSearchOpen(true);
        setSelectedWebImage(null);
        setWebSearchResults([]);
        setIsSearchingImages(true);
        try {
            const results = await searchBookCovers(book.title);
            setWebSearchResults(results);
        } catch (error) {
            alert('Failed to search for covers. Please try again.');
            setIsWebSearchOpen(false); // Close if search fails
        } finally {
            setIsSearchingImages(false);
        }
    };

    const handleSelectWebImage = (url: string) => {
        setSelectedWebImage(url);
    };

    const handleConfirmWebImage = () => {
        if (selectedWebImage) {
            onUpdateBook({ ...book, imageLinks: { thumbnail: selectedWebImage } });
            setIsWebSearchOpen(false);
        }
    };

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        const target = e.currentTarget;
        target.src = `https://via.placeholder.com/300/450/111827/FFFFFF/?text=Image+not+found`;
        target.onerror = null; // Prevent infinite loops if the placeholder also fails
    };

    const needsCurrentPage = currentStatus === ReadingStatus.Reading || currentStatus === ReadingStatus.Dropped;

    const WebSearchModal = () => (
        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-20">
            <div className="bg-gray-800 rounded-lg shadow-2xl max-w-3xl w-full h-[80vh] flex flex-col p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Search for a Cover</h3>
                    <button onClick={() => setIsWebSearchOpen(false)} className="text-gray-400 hover:text-white">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                {isSearchingImages ? (
                    <div className="flex-grow flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <p>Searching for covers...</p>
                        </div>
                    </div>
                ) : webSearchResults.length > 0 ? (
                    <div className="flex-grow overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-4 pr-2">
                        {webSearchResults.map((url, index) => (
                            <div key={index} className="aspect-[9/14] relative" onClick={() => handleSelectWebImage(url)}>
                                <img
                                    src={url}
                                    alt={`Cover result ${index + 1}`}
                                    className="w-full h-full object-cover rounded-md cursor-pointer bg-gray-700"
                                    onError={handleImageError}
                                />
                                {selectedWebImage === url && (
                                    <div className="absolute inset-0 border-4 border-indigo-500 rounded-md flex items-center justify-center bg-black/50">
                                        <CheckIcon className="w-10 h-10 text-white" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center text-gray-500">
                        <p>No image results found for "{book.title}".</p>
                    </div>
                )}
                <div className="mt-auto pt-4 flex justify-end gap-3">
                    <button onClick={() => setIsWebSearchOpen(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md">
                        Cancel
                    </button>
                    <button onClick={handleConfirmWebImage} disabled={!selectedWebImage} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md disabled:bg-indigo-400 disabled:cursor-not-allowed">
                        Set as Cover
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div 
              className="relative bg-gray-800 text-white p-6 rounded-lg shadow-2xl max-w-4xl w-full h-[90vh] flex flex-col md:flex-row gap-6" 
              onClick={(e) => e.stopPropagation()}
            >
                {isWebSearchOpen && <WebSearchModal />}

                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10">
                    <XMarkIcon className="w-6 h-6" />
                </button>
                
                {/* Left Column: Cover and Edit Options */}
                <div className="w-full md:w-1/3 flex flex-col items-center">
                    <img
                        src={book.imageLinks?.thumbnail}
                        alt={book.title}
                        className="w-full aspect-[9/14] object-cover rounded-lg shadow-2xl"
                    />
                    <div className="w-full mt-4 p-4 bg-gray-900/50 rounded-lg space-y-2">
                        <h4 className="text-md font-semibold text-gray-300 text-center border-b border-gray-700 pb-2 mb-2">Edit Cover</h4>
                        
                        <button 
                            onClick={handleOpenWebSearch}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-colors"
                        >
                            <SearchIcon className="w-5 h-5"/>
                            <span>Search on Web</span>
                        </button>
                        <button 
                            onClick={() => setShowUrlInput(!showUrlInput)}
                            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-colors"
                        >
                            <LinkIcon className="w-5 h-5"/>
                            <span>Change from URL</span>
                        </button>
                        {showUrlInput && (
                            <div className="flex gap-2 pt-2">
                                <input 
                                    type="text"
                                    value={imageUrl}
                                    onChange={(e) => setImageUrl(e.target.value)}
                                    placeholder="Paste image URL here"
                                    className="flex-grow bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-sm"
                                />
                                <button onClick={handleUpdateCoverFromUrl} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 rounded-md text-sm">Save</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Book Info */}
                <div className="w-full md:w-2/3 flex-grow overflow-y-auto pr-2">
                    <h2 className="text-3xl font-bold mb-1">{book.title}</h2>
                    <p className="text-lg text-gray-300 mb-4">{book.authors.join(', ')}</p>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div><strong className="text-gray-400 block">Publisher</strong> {book.publisher}</div>
                        <div><strong className="text-gray-400 block">Published</strong> {book.publishedDate}</div>
                        <div><strong className="text-gray-400 block">Category</strong> {book.categories.join(', ')}</div>
                        <div><strong className="text-gray-400 block">Pages</strong> {book.pageCount}</div>
                    </div>

                    <div className="mb-4">
                        <strong className="text-gray-400 block mb-1">Progress</strong>
                        <ProgressBar currentPage={book.currentPage} totalPages={book.pageCount} status={book.readingStatus} />
                         <div className="text-xs text-right mt-1 text-gray-400">Page {book.currentPage} of {book.pageCount}</div>
                    </div>
                    
                    {/* Update Status Form */}
                    <div className="my-4 p-4 bg-gray-900/50 rounded-lg">
                        <strong className="text-gray-300 block mb-3">Update Status</strong>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="md:col-span-1">
                                <label className="text-xs text-gray-400">Status</label>
                                <select 
                                    value={currentStatus} 
                                    onChange={(e) => setCurrentStatus(e.target.value as ReadingStatus)} 
                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    {Object.values(ReadingStatus).map(status => <option key={status} value={status}>{status}</option>)}
                                </select>
                            </div>
                            {needsCurrentPage && (
                                <div className="md:col-span-1">
                                    <label className="text-xs text-gray-400">Current Page</label>
                                    <input 
                                        type="number" 
                                        value={currentPageInput} 
                                        onChange={e => setCurrentPageInput(e.target.value)} 
                                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" 
                                        max={book.pageCount}
                                        min="0"
                                    />
                                </div>
                            )}
                            <div className={`md:col-span-1 ${!needsCurrentPage ? 'md:col-start-3' : ''}`}>
                                <button 
                                    onClick={handleStatusUpdate} 
                                    disabled={isSaved}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-colors text-sm disabled:bg-green-600"
                                >
                                    {isSaved ? (
                                        <>
                                            <CheckIcon className="w-5 h-5"/>
                                            <span>Saved!</span>
                                        </>
                                    ) : (
                                        <span>Update Progress</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <h3 className="text-xl font-semibold border-b border-gray-700 pb-2 mb-2">Summary</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        {book.description || "No summary available."}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BookDetailModal;
