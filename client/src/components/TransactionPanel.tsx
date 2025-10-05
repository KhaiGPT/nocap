import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface Transaction {
  id: number;
  item_name: string;
  amount: number;
  expense_date: string;
  category_id: number;
  recurrence: string | null;
  category: {
    name: string;
    emoji: string;
  };
}

interface GroupedTransactions {
  [date: string]: Transaction[];
}

interface TransactionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onEditTransaction: (transaction: Transaction) => void;
}

const TransactionPanel: React.FC<TransactionPanelProps> = ({ isOpen, onClose, onEditTransaction }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groupedTransactions, setGroupedTransactions] = useState<GroupedTransactions>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  // Fetch transactions when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchTransactions();
    }
  }, [isOpen]);

  // Group transactions by date whenever transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      const grouped = groupTransactionsByDate(transactions);
      setGroupedTransactions(grouped);
    } else {
      setGroupedTransactions({});
    }
  }, [transactions]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('User not authenticated');
        return;
      }

      // Fetch recent transactions with a reasonable limit; paginate later
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          id,
          item_name,
          amount,
          expense_date,
          category_id,
          recurrence,
          categories!inner(
            name,
            emoji
          )
        `)
        .eq('user_id', user.id)
        .order('expense_date', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (import.meta.env.DEV) {
        console.log('Fetched transaction data:', data?.length, 'records');
      }

      // Transform the data to match our interface. Handle array/object join shapes.
      type ExpenseJoin = typeof data extends (infer U)[] ? U : any;
      const transformedData: Transaction[] = (data ?? []).map((expense: ExpenseJoin) => {
        const joinedCategory = Array.isArray(expense.categories)
          ? expense.categories[0]
          : expense.categories;
        return {
          id: expense.id,
          item_name: expense.item_name,
          amount: expense.amount,
          expense_date: expense.expense_date,
          category_id: expense.category_id,
          recurrence: expense.recurrence,
          category: {
            name: joinedCategory?.name ?? '',
            emoji: joinedCategory?.emoji ?? ''
          }
        };
      });

      if (import.meta.env.DEV) {
        console.log('Transformed transaction data:', transformedData.length, 'records');
      }
      setTransactions(transformedData);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to group transactions by date
  const groupTransactionsByDate = (transactions: Transaction[]): GroupedTransactions => {
    const grouped: GroupedTransactions = {};
    
    transactions.forEach(transaction => {
      const dateKey = getDateLabel(transaction.expense_date);
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      
      grouped[dateKey].push(transaction);
    });

    // Sort transactions within each group by time (most recent first)
    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => 
        new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()
      );
    });

    return grouped;
  };

  // Helper function to get date label (Today, Yesterday, or formatted date)
  const getDateLabel = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Normalize dates to compare only the date part (ignore time)
    const normalizeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    
    const normalizedDate = normalizeDate(date);
    const normalizedToday = normalizeDate(today);
    const normalizedYesterday = normalizeDate(yesterday);

    if (normalizedDate.getTime() === normalizedToday.getTime()) {
      return 'Today';
    } else if (normalizedDate.getTime() === normalizedYesterday.getTime()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Get ordered date keys for rendering (Today first, then Yesterday, then chronological)
  const getOrderedDateKeys = (): string[] => {
    const keys = Object.keys(groupedTransactions);
    
    // Sort keys by priority: Today, Yesterday, then by actual date (newest first)
    return keys.sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1;
      if (b === 'Yesterday') return 1;
      
      // For other dates, sort by the actual date of the first transaction in each group
      const dateA = new Date(groupedTransactions[a][0].expense_date);
      const dateB = new Date(groupedTransactions[b][0].expense_date);
      return dateB.getTime() - dateA.getTime(); // Newest first
    });
  };

  const handleTransactionClick = (transaction: Transaction) => {
    if (import.meta.env.DEV) {
      console.log('Transaction clicked:', transaction);
    }
    // Pass the complete transaction data to the parent for editing
    onEditTransaction(transaction);
  };

  // Handle touch events for swipe down to close - IMPROVED
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only handle swipe on the panel itself, not on scrollable content
    const target = e.target as HTMLElement;
    const isScrollableContent = contentRef.current?.contains(target);
    
    if (isScrollableContent) {
      // Let the content scroll naturally
      return;
    }
    
    startY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    
    currentY.current = e.touches[0].clientY;
    const deltaY = currentY.current - startY.current;
    
    // Only allow downward swipes
    if (deltaY > 0) {
      const panel = panelRef.current;
      if (panel) {
        panel.style.transform = `translateY(${deltaY}px)`;
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    
    const deltaY = currentY.current - startY.current;
    const panel = panelRef.current;
    
    if (panel) {
      // If swiped down more than 100px, close the panel
      if (deltaY > 100) {
        onClose();
      } else {
        // Snap back to original position
        panel.style.transform = 'translateY(0)';
      }
    }
    
    isDragging.current = false;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const orderedDateKeys = getOrderedDateKeys();

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-25 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Panel - Smooth sliding animation from bottom */}
      <div 
        ref={panelRef}
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ 
          height: '85vh',
          maxHeight: '85vh',
          boxShadow: '0 -25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)' 
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="flex justify-center pt-4 pb-2 flex-shrink-0">
          <div 
            className="w-12 h-1 rounded-full"
            style={{ backgroundColor: '#D1D5DB' }}
          />
        </div>

        {/* Header - CRITICAL FIX: Made flex-shrink-0 to prevent compression */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 
            className="text-xl font-semibold"
            style={{ color: '#1C1C1E' }}
          >
            All Transactions
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-50 rounded-full transition-colors"
          >
            <X size={20} style={{ color: '#6B7280' }} />
          </button>
        </div>

        {/* Content - CRITICAL FIX: Proper flex and overflow handling */}
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto px-6 py-4"
          style={{ 
            minHeight: 0, // CRITICAL: Allows flex child to shrink below content size
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div style={{ color: '#6B7280' }}>Loading all transactions...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div style={{ color: '#DC2626' }}>{error}</div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div 
                className="text-lg font-medium mb-2"
                style={{ color: '#6B7280' }}
              >
                No transactions yet
              </div>
              <div 
                className="text-sm"
                style={{ color: '#9CA3AF' }}
              >
                Start tracking your expenses to see them here
              </div>
            </div>
          ) : (
            <div className="space-y-6 pb-6">
              {/* Render grouped transactions */}
              {orderedDateKeys.map((dateKey) => (
                <div key={dateKey} className="space-y-3">
                  {/* Date Header - CRITICAL FIX: Improved sticky positioning */}
                  <div className="sticky top-0 bg-white py-2 z-20 border-b border-gray-50">
                    <h3 
                      className="text-lg font-bold"
                      style={{ color: '#1C1C1E' }}
                    >
                      {dateKey}
                    </h3>
                    <div 
                      className="text-sm"
                      style={{ color: '#6B7280' }}
                    >
                      {groupedTransactions[dateKey].length} transaction{groupedTransactions[dateKey].length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Transactions for this date */}
                  <div className="space-y-3">
                    {groupedTransactions[dateKey].map((transaction) => (
                      <button
                        key={transaction.id}
                        onClick={() => handleTransactionClick(transaction)}
                        className="w-full bg-white rounded-2xl p-4 border border-gray-100 hover:bg-gray-50 transition-colors text-left"
                        style={{ 
                          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' 
                        }}
                      >
                        <div className="flex items-center justify-between">
                          {/* Left side - Category and Item */}
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            {/* Category Emoji */}
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                              style={{ backgroundColor: '#F3F4F6' }}
                            >
                              {transaction.category.emoji}
                            </div>
                            
                            {/* Item Details */}
                            <div className="flex-1 min-w-0">
                              <div 
                                className="font-medium truncate"
                                style={{ color: '#1C1C1E' }}
                              >
                                {transaction.item_name}
                              </div>
                              <div 
                                className="text-sm"
                                style={{ color: '#6B7280' }}
                              >
                                {transaction.category.name}
                                {transaction.recurrence && (
                                  <span> • {transaction.recurrence.charAt(0).toUpperCase() + transaction.recurrence.slice(1)}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right side - Amount */}
                          <div 
                            className="font-semibold text-lg flex-shrink-0"
                            style={{ color: '#1C1C1E' }}
                          >
                            {formatCurrency(transaction.amount)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TransactionPanel;