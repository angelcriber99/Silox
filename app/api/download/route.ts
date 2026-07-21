import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const os = searchParams.get('os')

  if (!os || (os !== 'mac' && os !== 'windows')) {
    return new NextResponse('Invalid OS parameter. Must be "mac" or "windows".', { status: 400 })
  }

  const token = process.env.GITHUB_PAT
  if (!token) {
    return new NextResponse('GITHUB_PAT environment variable is not configured on the server.', { status: 500 })
  }

  try {
    // 1. Fetch latest release info
    const releaseRes = await fetch('https://api.github.com/repos/angelcriber99/Silox/releases/latest', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Silox-NextJS-App'
      },
      next: { revalidate: 60 } // Cache release info for 60 seconds
    })

    if (!releaseRes.ok) {
      console.error('Failed to fetch release:', await releaseRes.text())
      return new NextResponse('Failed to fetch latest release from GitHub.', { status: releaseRes.status })
    }

    const releaseData = await releaseRes.json()
    const assets = releaseData.assets || []

    // 2. Find the correct asset
    const extension = os === 'mac' ? '.dmg' : '.msi'
    const targetAsset = assets.find((asset: any) => asset.name.endsWith(extension))

    if (!targetAsset) {
      return new NextResponse(`No installer found for ${os} in the latest release.`, { status: 404 })
    }

    // 3. Get the S3 temporary download URL
    // We must use redirect: 'manual' to prevent fetch from automatically following the redirect
    // so we can intercept the Location header and send it to the client.
    const downloadRes = await fetch(targetAsset.url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/octet-stream',
        'User-Agent': 'Silox-NextJS-App'
      }
    })

    // GitHub responds with a 302 Found and the S3 URL in the Location header
    if (downloadRes.status === 302) {
      const s3Url = downloadRes.headers.get('location')
      if (s3Url) {
        return NextResponse.redirect(s3Url)
      }
    }

    // Fallback if GitHub didn't return a 302 for some reason
    return new NextResponse('Failed to retrieve the secure download URL from GitHub.', { status: 500 })

  } catch (error) {
    console.error('Error in download route:', error)
    return new NextResponse('Internal server error.', { status: 500 })
  }
}
