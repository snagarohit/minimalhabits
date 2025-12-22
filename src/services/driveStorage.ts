import type { HabitData } from '../types'

const FILE_NAME = 'habits.json'
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3'

interface DriveFile {
  id: string
  name: string
  modifiedTime: string
}

interface DriveFilesResponse {
  files: DriveFile[]
}

// Token refresh callback type
export type TokenRefreshCallback = () => Promise<string | null>

// Error class for auth failures
export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

// Wrapper for fetch with 401/403 retry
async function fetchWithAuth(
  url: string,
  accessToken: string,
  options: RequestInit = {},
  onTokenRefresh?: TokenRefreshCallback
): Promise<Response> {
  const headers = {
    ...options.headers as Record<string, string>,
    Authorization: `Bearer ${accessToken}`,
  }

  let response = await fetch(url, { ...options, headers })

  // If 401/403, try to refresh token and retry
  if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
    console.log('Token expired, attempting refresh...')
    const newToken = await onTokenRefresh()

    if (newToken) {
      // Retry with new token
      headers.Authorization = `Bearer ${newToken}`
      response = await fetch(url, { ...options, headers })
    } else {
      throw new AuthError('Token refresh failed')
    }
  }

  return response
}

/**
 * Find the habits.json file in appDataFolder
 */
async function findFile(accessToken: string, onTokenRefresh?: TokenRefreshCallback): Promise<DriveFile | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id, name, modifiedTime)',
    q: `name='${FILE_NAME}'`,
  })

  const response = await fetchWithAuth(
    `${DRIVE_API_BASE}/files?${params}`,
    accessToken,
    {},
    onTokenRefresh
  )

  if (!response.ok) {
    throw new Error(`Failed to search files: ${response.statusText}`)
  }

  const data: DriveFilesResponse = await response.json()
  return data.files.length > 0 ? data.files[0] : null
}

/**
 * Create a new habits.json file in appDataFolder
 */
async function createFile(accessToken: string, data: HabitData, onTokenRefresh?: TokenRefreshCallback): Promise<DriveFile> {
  const metadata = {
    name: FILE_NAME,
    parents: ['appDataFolder'],
  }

  const formData = new FormData()
  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  )
  formData.append(
    'file',
    new Blob([JSON.stringify(data)], { type: 'application/json' })
  )

  const response = await fetchWithAuth(
    `${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,modifiedTime`,
    accessToken,
    {
      method: 'POST',
      body: formData,
    },
    onTokenRefresh
  )

  if (!response.ok) {
    throw new Error(`Failed to create file: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Update existing habits.json file
 */
async function updateFile(accessToken: string, fileId: string, data: HabitData, onTokenRefresh?: TokenRefreshCallback): Promise<DriveFile> {
  const response = await fetchWithAuth(
    `${UPLOAD_API_BASE}/files/${fileId}?uploadType=media&fields=id,name,modifiedTime`,
    accessToken,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    },
    onTokenRefresh
  )

  if (!response.ok) {
    throw new Error(`Failed to update file: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Read file content
 */
async function readFile(accessToken: string, fileId: string, onTokenRefresh?: TokenRefreshCallback): Promise<HabitData> {
  const response = await fetchWithAuth(
    `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
    accessToken,
    {},
    onTokenRefresh
  )

  if (!response.ok) {
    throw new Error(`Failed to read file: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Save habit data to Google Drive
 */
export async function saveToGDrive(
  accessToken: string,
  data: HabitData,
  onTokenRefresh?: TokenRefreshCallback
): Promise<{ success: boolean; modifiedTime: string }> {
  try {
    const existingFile = await findFile(accessToken, onTokenRefresh)

    let file: DriveFile
    if (existingFile) {
      file = await updateFile(accessToken, existingFile.id, data, onTokenRefresh)
    } else {
      file = await createFile(accessToken, data, onTokenRefresh)
    }

    return { success: true, modifiedTime: file.modifiedTime }
  } catch (error) {
    console.error('Failed to save to Google Drive:', error)
    throw error
  }
}

/**
 * Load habit data from Google Drive
 */
export async function loadFromGDrive(
  accessToken: string,
  onTokenRefresh?: TokenRefreshCallback
): Promise<{ data: HabitData | null; modifiedTime: string | null }> {
  try {
    const file = await findFile(accessToken, onTokenRefresh)

    if (!file) {
      return { data: null, modifiedTime: null }
    }

    const data = await readFile(accessToken, file.id, onTokenRefresh)
    return { data, modifiedTime: file.modifiedTime }
  } catch (error) {
    console.error('Failed to load from Google Drive:', error)
    throw error
  }
}

/**
 * Get the last modified time of the habits file
 */
export async function getLastModifiedTime(
  accessToken: string,
  onTokenRefresh?: TokenRefreshCallback
): Promise<string | null> {
  try {
    const file = await findFile(accessToken, onTokenRefresh)
    return file?.modifiedTime || null
  } catch (error) {
    console.error('Failed to get modified time:', error)
    return null
  }
}
