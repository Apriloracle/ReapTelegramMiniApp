import { useAccount, useBalance, useChainId } from 'wagmi'

export const useWeb3 = () => {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: balance } = useBalance({
    address: address,
  })

  return {
    account: address,
    isConnected,
    balance: balance?.formatted,
    chainId,
  }
}
