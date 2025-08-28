'use client';

import { useState, useEffect } from 'react';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useSponsoredTransaction } from '@/hooks/useSponsoredTransaction';

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || '0x0';
const TIP_JAR_ID = process.env.NEXT_PUBLIC_TIP_JAR_ID || '0x0';

const backgroundPattern = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h60v60H0z' fill='none'/%3E%3Cpath d='M30 20a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0 40a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm-20-20a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm40 0a10 10 0 1 1 0-20 10 10 0 0 1 0 20z' fill='%239C92AC' fill-opacity='0.05'/%3E%3C/svg%3E")`,
  backgroundSize: '60px 60px'
};

interface TipJarStats {
  owner: string;
  totalTips: string;
  tipCount: string;
}

interface TipJarProps {
  refreshKey?: number;
  onTipSuccess?: () => void;
}

export function TipJar({ refreshKey = 0, onTipSuccess }: TipJarProps) {
  const [tipAmount, setTipAmount] = useState('');
  const [tipJarStats, setTipJarStats] = useState<TipJarStats | null>(null);

  const { executeSponsoredTransaction, isLoading } = useSponsoredTransaction();
  const client = useSuiClient();
  const currentAccount = useCurrentAccount();

  const backgroundPattern = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h60v60H0z' fill='none'/%3E%3Cpath d='M30 20a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0 40a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm-20-20a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm40 0a10 10 0 1 1 0-20 10 10 0 0 1 0 20z' fill='%239C92AC' fill-opacity='0.05'/%3E%3C/svg%3E")`,
    backgroundSize: '60px 60px'
  };

  // Fetch tip jar statistics
  useEffect(() => {
    const fetchTipJarStats = async () => {
      if (!TIP_JAR_ID || TIP_JAR_ID === '0x0') return;

      try {
        const tipJarObject = await client.getObject({
          id: TIP_JAR_ID,
          options: {
            showContent: true,
          },
        });

        if (tipJarObject.data?.content && 'fields' in tipJarObject.data.content) {
          const fields = tipJarObject.data.content.fields as Record<string, unknown>;
          setTipJarStats({
            owner: String(fields.owner || ''),
            totalTips: String(fields.total_tips_received || '0'),
            tipCount: String(fields.tip_count || '0'),
          });
        }
      } catch (error) {
        console.error('Error fetching tip jar stats:', error);
      }
    };

    fetchTipJarStats();
  }, [client, refreshKey]);

  const sendTip = async () => {
    if (!currentAccount || !tipAmount || !PACKAGE_ID || !TIP_JAR_ID) {
      alert('Please connect wallet, enter tip amount, and ensure contract is configured');
      return;
    }

    const tipInMist = Math.floor(parseFloat(tipAmount) * 1_000_000_000); // Convert SUI to MIST
    if (tipInMist <= 0) {
      alert('Please enter a valid tip amount');
      return;
    }

    try {
      const tx = new Transaction();
      
      // Get user's SUI coins
      const coins = await client.getCoins({
        owner: currentAccount.address,
        coinType: '0x2::sui::SUI',
      });

      if (!coins.data.length) {
        alert('No SUI coins found in wallet');
        return;
      }

      // Find a coin with sufficient balance or use the largest coin
      let selectedCoin = coins.data[0];
      for (const coin of coins.data) {
        if (parseInt(coin.balance) >= tipInMist) {
          selectedCoin = coin;
          break;
        }
        if (parseInt(coin.balance) > parseInt(selectedCoin.balance)) {
          selectedCoin = coin;
        }
      }

      if (parseInt(selectedCoin.balance) < tipInMist) {
        alert(`Insufficient balance. Need ${tipAmount} SUI but largest coin has ${(parseInt(selectedCoin.balance) / 1_000_000_000).toFixed(4)} SUI`);
        return;
      }

      // Split coin for the tip amount
      const [tipCoin] = tx.splitCoins(tx.object(selectedCoin.coinObjectId), [tipInMist]);

      // Call the send_tip function
      tx.moveCall({
        target: `${PACKAGE_ID}::tip_jar_contract::send_tip`,
        arguments: [
          tx.object(TIP_JAR_ID),
          tipCoin,
        ],
      });

      await executeSponsoredTransaction(tx, {
        onSuccess: (result) => {
          console.log('Tip sent successfully:', result);
          alert(`Tip of ${tipAmount} SUI sent successfully! (Gas-free transaction)`);
          setTipAmount('');
          onTipSuccess?.(); // Refresh stats and balance
        },
        onError: (error) => {
          console.error('Error sending tip:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          alert(`Error sending tip: ${errorMessage}`);
        },
      });
    } catch (error) {
      console.error('Error creating tip transaction:', error);
      alert('Error creating transaction. Please try again.');
    }
  };

  if (!currentAccount) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-600/10 via-purple-100 to-white rounded-3xl shadow-2xl p-8 border border-purple-100 backdrop-blur-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-purple-200/40 via-transparent to-transparent"></div>
        <div
          className="absolute inset-0"
          style={{
        backgroundImage:
          "url('data:image/svg+xml,%3Csvg width=\"100\" height=\"100\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\" fill='%239C92AC' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E')",
        backgroundSize: '100px 100px',
          }}
        ></div>
        <div className="relative">
          <div className="absolute -top-6 -left-6 w-24 h-24 bg-purple-200 rounded-full filter blur-2xl opacity-30 animate-pulse"></div>
          <h2 className="text-4xl font-bold text-purple-900 mb-4 flex items-center">
            <span className="animate-bounce mr-3 transform hover:scale-125 transition-transform">💎</span>
            Luxury Tip Jar
          </h2>
          <p className="text-purple-700 text-lg font-medium">Please connect your wallet to send tips</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-purple-600/10 via-purple-100 to-white rounded-3xl shadow-2xl p-8 border border-purple-100 backdrop-blur-sm">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-purple-200/40 via-transparent to-transparent"></div>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "url('data:image/svg+xml,%3Csvg width=\"100\" height=\"100\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\" fill='%239C92AC' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E')",
          backgroundSize: '100px 100px',
        }}
      ></div>
      <div className="relative">
        <div className="absolute -top-6 -left-6 w-24 h-24 bg-purple-200 rounded-full filter blur-2xl opacity-30 animate-pulse"></div>
        <h2 className="text-4xl font-bold text-purple-900 mb-8 flex items-center">
          <span className="animate-bounce mr-3 transform hover:scale-125 transition-transform">💎</span>
          Luxury Tip Jar
        </h2>

        {/* Tip Jar Statistics */}
        {tipJarStats && (
          <div className="bg-gradient-to-br from-purple-100/80 to-white/80 backdrop-blur-md rounded-xl p-6 mb-8 transform hover:scale-105 transition-all duration-300 border border-purple-200/50 shadow-lg group">
            <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-900 to-purple-600 mb-4">Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-white/70 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 border border-purple-100 group-hover:border-purple-300">
                <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-purple-400 animate-pulse">
                  {(parseInt(tipJarStats.totalTips) / 1_000_000_000).toFixed(3)}
                </p>
                <p className="text-sm text-purple-600 mt-2 font-medium">Total SUI Received</p>
              </div>
              <div className="text-center p-6 bg-white/70 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 border border-purple-100 group-hover:border-purple-300">
                <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-purple-400">
                  {tipJarStats.tipCount}
                </p>
                <p className="text-sm text-purple-600 mt-2 font-medium">Tips Count</p>
              </div>
              <div className="text-center p-6 bg-white/70 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 border border-purple-100 group-hover:border-purple-300">
                <p className="text-xs text-purple-500 break-all hover:text-purple-700 font-medium">
                  Owner: {tipJarStats.owner.slice(0, 8)}...{tipJarStats.owner.slice(-6)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Send Tip Section */}
        <div className="space-y-6">
          <div className="relative">
            <label htmlFor="tip-amount" className="block text-sm font-medium text-purple-700 mb-2">
              Tip Amount (SUI)
            </label>
            <input
              type="number"
              id="tip-amount"
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              className="w-full px-4 py-3 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-purple-900 placeholder-purple-300 transition-all"
              placeholder="0.1"
              step="0.001"
              min="0"
              disabled={isLoading}
            />
            <div className="absolute right-3 top-9 text-purple-400">SUI</div>
          </div>

          <div className="flex items-center justify-center space-x-2 text-sm font-medium bg-gradient-to-r from-purple-50 to-white py-3 px-4 rounded-lg border border-purple-100 shadow-md hover:shadow-lg transition-all duration-300">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-400 to-purple-300 rounded-full blur opacity-30 animate-pulse"></div>
              <svg className="relative w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-700 to-purple-500">Gas-Free Transaction via Enoki ✨</span>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-purple-400 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
            <button
              onClick={sendTip}
              disabled={isLoading || !tipAmount || parseFloat(tipAmount) <= 0}
              className="relative w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-4 px-6 rounded-lg 
                       hover:from-purple-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed 
                       transition-all transform hover:scale-105 active:scale-95 font-medium text-lg shadow-lg
                       border border-purple-400/30 backdrop-blur-sm"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-100">Sending Tip...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <span className="mr-2">Send Tip</span>
                  <span className="animate-bounce">🎁</span>
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-gradient-to-br from-purple-50/70 to-white/70 border border-purple-200/50 p-6 rounded-xl backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300">
          <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-900 to-purple-600 mb-4">
            How it works ✨
          </h3>
          <ul className="text-sm text-purple-700 space-y-3">
            <li className="flex items-center p-2 hover:bg-white/50 rounded-lg transition-colors duration-200">
              <span className="mr-3 text-lg">💫</span>
              <span className="font-medium">Enter the amount you want to tip in SUI</span>
            </li>
            <li className="flex items-center p-2 hover:bg-white/50 rounded-lg transition-colors duration-200">
              <span className="mr-3 text-lg">🎁</span>
              <span className="font-medium">Click "Send Tip" to send your tip</span>
            </li>
            <li className="flex items-center p-2 hover:bg-white/50 rounded-lg transition-colors duration-200">
              <span className="mr-3 text-lg">⚡</span>
              <span className="font-medium">All transactions are sponsored (gas-free) via Enoki</span>
            </li>
            <li className="flex items-center p-2 hover:bg-white/50 rounded-lg transition-colors duration-200">
              <span className="mr-3 text-lg">🏆</span>
              <span className="font-medium">Tips are sent directly to the tip jar owner</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}