import { useAccount, useBalance, useNetwork } from 'wagmi'

export const useWeb3 = () => {
  const { address, isConnected } = useAccount()
  const { chain } = useNetwork()
  const { data: balance } = useBalance({
    address: address,
  })

  return {
    account: address,
    isConnected,
    balance: balance?.formatted,
    chainId: chain?.id,
  }
}
