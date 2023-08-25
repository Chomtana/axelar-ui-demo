import { useEffect, useState } from 'react'

import fantomLogo from './assets/fantom.png'
import avalancheLogo from './assets/avalanche.png'

import { Button, Input } from 'antd'
import BridgeButton from './components/BridgeButton';

import {
  ConnectButton as SuiConnectButton, useSuiProvider, useWallet,
} from "@suiet/wallet-kit";
import '@suiet/wallet-kit/style.css';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useContractRead, useNetwork } from 'wagmi';

import ERC20ABI from "./abi/ERC20.json"
import { JsonRpcProvider, testnetConnection } from '@mysten/sui.js';
import { formatEther } from 'viem';

// const USDC_ADDRESS: {[chainId: number]: `0x${string}`} = {
//   4002: '0x75Cc4fDf1ee3E781C1A3Ee9151D5c6Ce34Cf5C61',
//   43113: '0x57F1c63497AEe0bE305B8852b354CEc793da43bB',
// }

const TOKEN_ADDRESSES: {[chainId: number]: `0x${string}`} = {
  4002: '0x27C98368f32dD546554e44771bf9F6ccE08ee450',
  43113: '0x599FA7Fd565cE93290b05B8106955d434A995124',
}

function App() {
  const [ amountStr, setAmount ] = useState("");
  const { chain } = useNetwork();
  
  const sourceChainId: number = chain?.id || 0;
  const sourceChainName = sourceChainId == 4002 ? "Fantom" : "Avalanche";
  const sourceChainLogo = sourceChainId == 4002 ? fantomLogo : avalancheLogo;

  const destChainId: number = chain?.id == 4002 ? 43113 : 4002;
  const destChainName = sourceChainId == 4002 ? "Avalanche" : "Fantom";
  const destChainLogo = sourceChainId == 4002 ? avalancheLogo : fantomLogo;

  const { address } = useAccount();

  const { data: sourceBalance, isError: isSourceBalanceError, isLoading: isSourceBalanceLoading } = useContractRead({
    address: TOKEN_ADDRESSES[sourceChainId],
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: [address],
    chainId: sourceChainId,
  })

  const { data: destBalance, isError: isDestBalanceError, isLoading: isDestBalanceLoading } = useContractRead({
    address: TOKEN_ADDRESSES[destChainId],
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: [address],
    chainId: destChainId,
  })

  return (
    <div className='p-4 max-w-2xl m-auto'>
      <div className='mb-10 mt-6'>
        <div className='text-center text-2xl mb-3'>
          Axelar GMP Bridge
        </div>

        {/* <div className='text-center'>
          <a className='underline' href='https://community.axelar.network/t/does-axelar-have-a-testnet-faucet-for-developers/2295' target='_blank'>
            Request CHOM faucet
          </a>
        </div> */}
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 relative mb-10 gap-6'>
        {/* Source Chain */}
        <div className='flex flex-col items-center'>
          <div className='text-xl mb-1'>
            From
          </div>

          <div className='text-xl mb-2'>
            { sourceChainName }
          </div>

          <div className='mb-4'>
            <img src={sourceChainLogo} className='rounded-full' style={{width: 64}}></img>
          </div>

          <div className='mb-2'>
            <Input 
              size="large" 
              placeholder="Bridge amount" 
              suffix="CHOM"
              value={amountStr}
              onChange={(e: any) => setAmount(e.target.value)}
            />
          </div>

          <div>
            Balance: {isSourceBalanceLoading || isSourceBalanceError ? '...' : formatEther(sourceBalance || 0 as any)} CHOM
          </div>
        </div>

        {/* Destination Chain */}
        <div className='flex flex-col items-center'>
          <div className='text-xl mb-1'>
            To
          </div>

          <div className='text-xl mb-2'>
            { destChainName }
          </div>

          <div className='mb-4'>
            <img src={destChainLogo} className='rounded-full' style={{width: 64}}></img>
          </div>

          <div className='text-xl mt-2 mb-3'>
            {amountStr || '...'} CHOM
          </div>

          <div>
          Balance: {isDestBalanceLoading || isDestBalanceError ? '...' : formatEther(destBalance || 0 as any)} CHOM
          </div>
        </div>
      </div>

      <div className='text-center mb-2'>
        Connect your wallet to bridge
      </div>

      <div className='flex flex-col md:flex-row items-center justify-center mb-2'>
        <div className='m-2'>
          <ConnectButton />
        </div>
      </div>

      <div className='flex justify-center mb-6'>
        <BridgeButton amount={parseFloat(amountStr)}></BridgeButton>
      </div>
    </div>
  )
}

export default App
