import React from 'react';
import type { Book } from '../types';
import { ReadingStatus } from '../types';
import ProgressBar from './ProgressBar';

interface BookCardProps {
  book: Book;
  onCardClick: () => void;
}

const BookCard: React.FC<BookCardProps> = ({ book, onCardClick }) => {
  const progressPercentage = book.pageCount > 0 ? Math.round((book.currentPage / book.pageCount) * 100) : 0;
  
  return (
    <div onClick={onCardClick} className="group relative flex flex-col bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 cursor-pointer">
      <div className="aspect-[9/16] overflow-hidden">
        <img
          src={book.imageLinks?.thumbnail || 'https://picsum.photos/300/480'}
          alt={book.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
        <h3 className="font-bold text-md truncate group-hover:whitespace-normal group-hover:line-clamp-3">{book.title}</h3>
        <p className="text-xs text-gray-300 truncate">{book.authors?.join(', ')}</p>
        <div className="mt-2">
          {book.readingStatus === ReadingStatus.PlanningToRead ? (
            <div className="text-center text-xs italic bg-purple-600/50 text-white py-1 px-2 rounded-full">
              {ReadingStatus.PlanningToRead}
            </div>
          ) : (
            <>
              <ProgressBar currentPage={book.currentPage} totalPages={book.pageCount} status={book.readingStatus} />
              <div className="text-xs text-right mt-1 text-gray-400">{progressPercentage}%</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookCard;