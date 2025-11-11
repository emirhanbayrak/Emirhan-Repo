import React, { useMemo } from 'react';
import type { Book } from '../types.ts';
import { ReadingStatus } from '../types.ts';
import ProgressBar from './ProgressBar.tsx';
import { BookOpenIcon, ChartPieIcon, TagIcon } from './Icons.tsx';

interface StatsPanelProps {
  books: Book[];
}

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | React.ReactNode }> = ({ icon, label, value }) => (
    <div className="flex items-center gap-4 bg-gray-700/50 p-3 rounded-lg">
        <div className="text-indigo-400">{icon}</div>
        <div>
            <div className="text-sm text-gray-400">{label}</div>
            <div className="text-lg font-bold text-white">{value}</div>
        </div>
    </div>
);


const StatsPanel: React.FC<StatsPanelProps> = ({ books }) => {
    const stats = useMemo(() => {
        const totalBooks = books.length;
        const booksRead = books.filter(b => b.readingStatus === ReadingStatus.Read).length;

        const relevantBooks = books.filter(b => b.readingStatus !== ReadingStatus.PlanningToRead && b.pageCount > 0);
        const totalCurrentPages = relevantBooks.reduce((acc, book) => acc + book.currentPage, 0);
        const totalPossiblePages = relevantBooks.reduce((acc, book) => acc + book.pageCount, 0);
        const overallPercentage = totalPossiblePages > 0 ? Math.round((totalCurrentPages / totalPossiblePages) * 100) : 0;

        const categoryCounts = books.reduce((acc, book) => {
            book.categories.forEach(cat => {
                if (cat && cat !== 'Uncategorized') {
                    acc[cat] = (acc[cat] || 0) + 1;
                }
            });
            return acc;
        }, {} as Record<string, number>);

        const favoriteGenre = Object.keys(categoryCounts).length > 0
            ? Object.entries(categoryCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0]
            : 'N/A';
        
        return { totalBooks, booksRead, overallPercentage, favoriteGenre };
    }, [books]);

    return (
        <div className="mb-6">
            <h2 className="text-lg font-semibold border-b border-gray-700 pb-2 mb-4">Statistics</h2>
            <div className="space-y-3">
                <StatCard 
                    icon={<BookOpenIcon className="w-6 h-6" />}
                    label="Books Read"
                    value={`${stats.booksRead} / ${stats.totalBooks}`}
                />
                <StatCard 
                    icon={<TagIcon className="w-6 h-6" />}
                    label="Favorite Genre"
                    value={stats.favoriteGenre}
                />
                 <div>
                    <div className="flex items-center gap-4 p-3 rounded-lg">
                        <div className="text-indigo-400"><ChartPieIcon className="w-6 h-6"/></div>
                        <div>
                            <div className="text-sm text-gray-400">Overall Progress</div>
                            <div className="text-lg font-bold text-white -mt-1">{stats.overallPercentage}%</div>
                        </div>
                    </div>
                    <div className="px-2">
                        <ProgressBar currentPage={stats.overallPercentage} totalPages={100} status="Reading" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsPanel;