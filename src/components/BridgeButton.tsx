import { Button, Modal, Steps, message } from "antd"
import React, { useEffect, useState } from "react"

import {
  useAccountBalance,
  useWallet,
  SuiChainId,
  ErrorCode,
  formatSUI,
  addressEllipsis,
} from "@suiet/wallet-kit";
import { useAccount, useContractWrite, useNetwork, usePublicClient } from "wagmi";
import { AxelarGMPRecoveryAPI, AxelarQueryAPI, Environment, EvmChain, GMPStatus, GMPStatusResponse, GasToken } from "@axelar-network/axelarjs-sdk";
import { BCS, getSuiMoveConfig } from "@mysten/bcs";

import ERC20ABI from "../abi/ERC20.json"
import ChomTokenABI from "../abi/ChomToken.json"
import { keccak256, parseEther } from "viem";
import useMessage from "antd/es/message/useMessage";
import { useInterval } from "usehooks-ts";

const TOKEN_ADDRESSES: {[chainId: number]: `0x${string}`} = {
  4002: '0x27C98368f32dD546554e44771bf9F6ccE08ee450',
  43113: '0x599FA7Fd565cE93290b05B8106955d434A995124',
}

const GAS_LIMIT = 150000

const axelarSdk = new AxelarQueryAPI({
  environment: Environment.TESTNET,
});

const axelarRecoverySdk = new AxelarGMPRecoveryAPI({
  environment: Environment.TESTNET,
});

// initialize the serializer with default Sui Move configurations
const bcs = new BCS(getSuiMoveConfig());

bcs.registerStructType("UnlockMessage", {
  recipient: BCS.ADDRESS,
  amount: BCS.U64,
  nonce: BCS.U64,
});

export default function BridgeButton({ amount }: { amount: number }) {
  const { chain } = useNetwork();

  const BRIDGE_ADDRESS = TOKEN_ADDRESSES[chain?.id || 0];
  const TOKEN_ADDRESS = BRIDGE_ADDRESS;

  const { address } = useAccount();
  const wallet = useWallet();
  const publicClient = usePublicClient();

  const [ showBridgeModal, setShowBridgeModal ] = useState(false);
  const [ step, setStep ] = useState(0)

  const [ isApproveLoading, setIsApproveLoading ] = useState(false)
  const [ isLockLoading, setIsLockLoading ] = useState(false)
  const [ isUnlockLoading, setIsUnlockLoading ] = useState(false)

  const { writeAsync: approveExecute } = useContractWrite({
    address: TOKEN_ADDRESS,
    abi: ERC20ABI,
    functionName: 'approve',
  })

  const { writeAsync: lockExecute } = useContractWrite({
    address: BRIDGE_ADDRESS,
    abi: ChomTokenABI,
    functionName: 'bridge',
  })

  const [ nonce, setNonce ] = useState(0);
  const [ axelarTxHash, setAxelarTxHash ] = useState("");

  async function lock() {
    try {
      setIsLockLoading(true)

      const _nonce = Math.floor(Math.random() * 1000000000000000)
      setNonce(_nonce)

      // Estimate cross-chain transaction fee
      const gasFee: string = await axelarSdk.estimateGasFee(
        chain?.id == 4002 ? EvmChain.FANTOM : EvmChain.AVALANCHE,
        chain?.id == 4002 ? EvmChain.AVALANCHE : EvmChain.FANTOM,
        chain?.id == 4002 ? GasToken.FTM : GasToken.AVAX,
        GAS_LIMIT,
      ) as string

      console.log(gasFee)
  
      const tx = await lockExecute({
        args: [
          chain?.id == 4002 ? "Avalanche" : "Fantom",
          parseEther((amount || 0).toString()),
        ],
        value: BigInt(gasFee),
      });
  
      setAxelarTxHash(tx.hash)
  
      await publicClient.waitForTransactionReceipt({
        hash: tx.hash
      })
  
      setStep(2)
    } catch(err) {
      console.error(err)
      message.error("Failed... Please check if you have enough CHOM and gas on goerli and try again")
    } finally {
      setIsLockLoading(false)
    }
  }

  async function approve() {
    try {
      setIsApproveLoading(true)

      const tx = await approveExecute({
        args: [BRIDGE_ADDRESS, parseEther((amount || 0).toString())],
      });
      await publicClient.waitForTransactionReceipt({
        hash: tx.hash
      })
  
      setStep(1)
      lock();
    } catch(err) {
      console.error(err)
      message.error("Failed... Please check if you have enough gas on goerli and try again")
    } finally {
      setIsApproveLoading(false)
    }
  }

  async function trackAxelarStatus() {
    const txStatus: GMPStatusResponse = await axelarRecoverySdk.queryTransactionStatus(axelarTxHash);

    console.log(txStatus.status)

    if (txStatus.error) {
      window.alert("Axelar Error: " + txStatus.error.message)
      window.location.reload();
      return;
    }

    if (txStatus.status == GMPStatus.SRC_GATEWAY_CONFIRMED) {
      setStep(3)
    }

    if (txStatus.approved && step < 4) {
      setStep(4)
    }

    if (txStatus.executed && step < 5) {
      setStep(5)
      message.success("Bridge success!")
      setTimeout(() => window.location.reload(), 3000);
    }
  }

  useInterval(() => {
    trackAxelarStatus(); 
  }, step >= 2 ? 3000 : null)

  return (
    <div>
      <Button size="large" type="primary" disabled={!address || !wallet} onClick={() => {
        setShowBridgeModal(true)
      }}>
        Bridge
      </Button>

      <Modal title="Bridge" open={showBridgeModal} footer={null} maskClosable={false} onCancel={() => setShowBridgeModal(false)}>
        <Steps
          direction="vertical"
          current={step}
          items={[
            {
              title: 'Approve CHOM',
              description: (
                <div>
                  <div>Approve CHOM to bridge smart contract</div>
                  <div className="mt-1">
                    <Button type="primary" onClick={() => approve()} disabled={isApproveLoading || step != 0}>
                      Approve
                    </Button>
                  </div>
                </div>
              ),
            },
            {
              title: 'Lock CHOM',
              description: (
                <div>
                  <div>Lock CHOM on Ethereum Goerli Testnet</div>
                  <div className="mt-1">
                    <Button type="primary" onClick={() => lock()} disabled={isLockLoading || step != 1}>
                      Lock & Bridge
                    </Button>
                  </div>
                </div>
              ),
            },
            {
              title: 'Processing by Axelar',
              description: (
                <div>
                  <div>Axelar validators are validating the transaction</div>
                  {axelarTxHash && step == 2 &&
                    <div className="mt-1">
                      Tx Hash: <a className="underline hover:underline" href={"https://testnet.axelarscan.io/gmp/" + axelarTxHash} target="_blank">{axelarTxHash}</a>
                    </div>
                  }
                </div>
              ),
            },
            {
              title: 'Approving on Destination chain',
              description: 'Axelar relayer approve message on Destination chain',
            },
            {
              title: 'Unlocking CHOM on Destination chain',
              description: 'Axelar relayer execute message on Destination chain',
            },
          ]}
        />
      </Modal>
    </div>
  )
}