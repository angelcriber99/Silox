"use client"
import { AssetLogo } from "@/components/ui/asset-logo"

export default function DebugLogo() {
  return (
    <div className="p-10 space-y-4">
      <h1 className="text-2xl text-white">Debug Logo</h1>
      <div className="flex gap-4">
        <AssetLogo ticker="AAPL" name="Apple" />
        <AssetLogo ticker="NVO" name="Novo" />
        <AssetLogo ticker="BTC-USD" name="Bitcoin" type="Crypto" />
      </div>
      
      <h2 className="text-xl text-white mt-10">Raw img tags</h2>
      <div className="flex gap-4">
        <img src="https://financialmodelingprep.com/image-stock/AAPL.png" width="64" />
        <img src="https://companiesmarketcap.com/img/company-logos/64/AAPL.png" width="64" />
      </div>
    </div>
  )
}
