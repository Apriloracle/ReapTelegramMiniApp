import { useEffect, useState } from 'react'
import Web3 from 'web3'

export const useWeb3 = () => {
  const [web3, setWeb3] = useState<Web3 | null>(null)
  const [account, setAccount] = useState<string | null>(null)
  const [balance, setBalance] = useState<string>('0')

  useEffect(() => {
    const initWeb3 = async () => {
      if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
        const web3Instance = new Web3(window.ethereum)
        setWeb3(web3Instance)

        try {
          // Request account access
          await window.ethereum.request({ method: 'eth_requestAccounts' })
          const accounts = await web3Instance.eth.getAccounts()
          setAccount(accounts[0])

          // Get balance
          const balance = await web3Instance.eth.getBalance(accounts[0])
          setBalance(web3Instance.utils.fromWei(balance, 'ether'))
        } catch (error) {
          console.error('User denied account access')
        }
      } else {
        console.log('Please install MetaMask!')
      }
    }

    initWeb3()
  }, [])

  return { web3, account, balance }
}
