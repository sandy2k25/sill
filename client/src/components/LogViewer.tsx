import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getLogs, clearLogs } from '@/lib/api';
import { Log } from '@/lib/types';

const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [logType, setLogType] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const logsPerPage = 20;
  const { toast } = useToast();
  
  useEffect(() => {
    fetchLogs();
  }, [logType, currentPage]);
  
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * logsPerPage;
      const response = await getLogs(logsPerPage, offset, logType || undefined);
      setLogs(response.logs);
      setTotalLogs(response.total);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch logs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleClearLogs = async () => {
    if (window.confirm('Are you sure you want to clear all logs?')) {
      setIsClearing(true);
      try {
        await clearLogs();
        toast({
          title: "Success",
          description: "Logs cleared successfully",
        });
        setCurrentPage(1);
        fetchLogs();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to clear logs",
          variant: "destructive"
        });
      } finally {
        setIsClearing(false);
      }
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  const totalPages = Math.ceil(totalLogs / logsPerPage);
  const pageNumbers = [];
  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    pageNumbers.push(i);
  }
  
  const getLevelBadgeClass = (level: string) => {
    switch (level) {
      case 'INFO':
        return 'bg-green-500';
      case 'WARN':
        return 'bg-yellow-500';
      case 'ERROR':
        return 'bg-red-500';
      case 'DEBUG':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  return (
    <div className="bg-darkSecondary p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">System Logs</h2>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <select 
              className="bg-darkAccent border border-gray-600 rounded px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
              value={logType}
              onChange={(e) => {
                setLogType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Logs</option>
              <option value="ERROR">Error Logs</option>
              <option value="INFO">Info Logs</option>
              <option value="WARN">Warning Logs</option>
              <option value="DEBUG">Debug Logs</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
              <i className="fas fa-chevron-down text-xs"></i>
            </div>
          </div>
          <button 
            className="bg-red-500 hover:bg-red-600 text-white py-1.5 px-3 rounded text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            onClick={handleClearLogs}
            disabled={isClearing}
          >
            {isClearing ? 'Clearing...' : 'Clear Logs'}
          </button>
        </div>
      </div>
      
      {/* Log Entries */}
      <div className="bg-darkAccent rounded-lg p-1">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-2 text-left">Timestamp</th>
                  <th className="px-4 py-2 text-left">Level</th>
                  <th className="px-4 py-2 text-left">Source</th>
                  <th className="px-4 py-2 text-left">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      No logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-opacity-50 hover:bg-darkSecondary">
                      <td className="px-4 py-2 text-sm whitespace-nowrap">{formatDate(log.timestamp)}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 ${getLevelBadgeClass(log.level)} text-xs text-white rounded`}>
                          {log.level}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm whitespace-nowrap">{log.source}</td>
                      <td className="px-4 py-2 text-sm">{log.message}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {/* Pagination */}
      {totalPages > 0 && (
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-400">
            Showing {Math.min((currentPage - 1) * logsPerPage + 1, totalLogs)} - {Math.min(currentPage * logsPerPage, totalLogs)} of {totalLogs} entries
          </div>
          <div className="flex space-x-1">
            <button 
              className={`px-3 py-1 bg-darkAccent rounded hover:bg-opacity-80 text-sm ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            {pageNumbers.map(number => (
              <button 
                key={number}
                className={`px-3 py-1 ${currentPage === number ? 'bg-primary' : 'bg-darkAccent hover:bg-opacity-80'} rounded text-sm`}
                onClick={() => setCurrentPage(number)}
              >
                {number}
              </button>
            ))}
            <button 
              className={`px-3 py-1 bg-darkAccent rounded hover:bg-opacity-80 text-sm ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogViewer;
