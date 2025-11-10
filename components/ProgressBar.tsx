
import React from 'react';

interface ProgressBarProps {
  currentPage: number;
  totalPages: number;
  status: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentPage, totalPages, status }) => {
  if (totalPages === 0) {
    return null;
  }
  
  const percentage = Math.min(Math.floor((currentPage / totalPages) * 100), 100);

  const getBarColor = () => {
    if (status === 'Okudum' || percentage === 100) return 'bg-blue-500';
    if (status === 'Okumadım') return 'bg-gray-700';
    if (percentage > 75) return 'bg-blue-500';
    if (percentage > 50) return 'bg-green-500';
    if (percentage > 25) return 'bg-orange-500';
    if (percentage > 0) return 'bg-red-500';
    return 'bg-gray-700';
  };

  const barColor = getBarColor();

  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
      <div
        className={`${barColor} h-2.5 rounded-full transition-all duration-500`}
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  );
};

export default ProgressBar;
