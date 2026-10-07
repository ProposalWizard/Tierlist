"use client";
/**
 * useWallet — the gem wallet for a screen (lib/star/wallet.ts).
 *
 * Asks the server once when the first screen that needs it opens, then
 * follows every change (a buy, a refresh). The answer only ever comes from
 * GET /api/star/wallet: never from the save or this browser's storage.
 */
import { useEffect, useState } from "react";
import { loadWallet, onWallet, walletNow, type WalletSnapshot } from "./wallet";

export function useWallet(): WalletSnapshot {
  const [w, setW] = useState<WalletSnapshot>(walletNow());
  useEffect(() => {
    const stop = onWallet(setW);
    loadWallet().then(setW);
    return stop;
  }, []);
  return w;
}
