import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const os = searchParams.get('os')

  if (!os || (os !== 'mac' && os !== 'windows')) {
    return new NextResponse('Invalid OS parameter. Must be "mac" or "windows".', { status: 400 })
  }

  try {
    // 1. Fetch latest release info
    const releaseRes = await fetch('https://api.github.com/repos/angelcriber99/Silox/releases/latest', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Silox-NextJS-App'
      },
      next: { revalidate: 60 } // Cache release info for 60 seconds
    })

    if (!releaseRes.ok) {
      console.error('Failed to fetch release:', await releaseRes.text())
      return new NextResponse('Failed to fetch latest release from GitHub.', { status: releaseRes.status })
    }

    const releaseData: unknown = await releaseRes.json()
    const assets = typeof releaseData === 'object' && releaseData !== null && 'assets' in releaseData
      && Array.isArray(releaseData.assets) ? releaseData.assets : []

    // 2. Find the correct asset
    const extension = os === 'mac' ? '.dmg' : '.msi'
    const targetAsset = assets.find((asset): asset is { name: string; browser_download_url: string } => (
      typeof asset === 'object'
      && asset !== null
      && 'name' in asset
      && typeof asset.name === 'string'
      && asset.name.endsWith(extension)
      && 'browser_download_url' in asset
      && typeof asset.browser_download_url === 'string'
    ))

    if (!targetAsset) {
      return new NextResponse(`No installer found for ${os} in the latest release.`, { status: 404 })
    }

    const downloadUrl = new URL(targetAsset.browser_download_url)
    if (downloadUrl.protocol !== 'https:' || downloadUrl.hostname !== 'github.com') {
      return new NextResponse('Invalid release download URL.', { status: 502 })
    }
    return NextResponse.redirect(downloadUrl)

  } catch (error) {
    console.error('Error in download route:', error)
    return new NextResponse('Internal server error.', { status: 500 })
  }
}
