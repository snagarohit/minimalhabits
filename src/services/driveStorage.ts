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

/**
 * Find the habits.json file in appDataFolder
 */
async function findFile(accessToken: string): Promise<DriveFile | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id, name, modifiedTime)',
    q: `name='${FILE_NAME}'`,
  })

  const response = await fetch(`${DRIVE_API_BASE}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to search files: ${response.statusText}`)
  }

  const data: DriveFilesResponse = await response.json()
  return data.files.length > 0 ? data.files[0] : null
}

/**
 * Create a new habits.json file in appDataFolder
 */
async function createFile(accessToken: string, data: HabitData): Promise<DriveFile> {
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

  const response = await fetch(`${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,modifiedTime`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Failed to create file: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Update existing habits.json file
 */
async function updateFile(accessToken: string, fileId: string, data: HabitData): Promise<DriveFile> {
  const response = await fetch(`${UPLOAD_API_BASE}/files/${fileId}?uploadType=media&fields=id,name,modifiedTime`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`Failed to update file: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Read file content
 */
async function readFile(accessToken: string, fileId: string): Promise<HabitData> {
  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to read file: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Save habit data to Google Drive
 */
export async function saveToGDrive(accessToken: string, data: HabitData): Promise<{ success: boolean; modifiedTime: string }> {
  try {
    const existingFile = await findFile(accessToken)

    let file: DriveFile
    if (existingFile) {
      file = await updateFile(accessToken, existingFile.id, data)
    } else {
      file = await createFile(accessToken, data)
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
export async function loadFromGDrive(accessToken: string): Promise<{ data: HabitData | null; modifiedTime: string | null }> {
  try {
    const file = await findFile(accessToken)

    if (!file) {
      return { data: null, modifiedTime: null }
    }

    const data = await readFile(accessToken, file.id)
    return { data, modifiedTime: file.modifiedTime }
  } catch (error) {
    console.error('Failed to load from Google Drive:', error)
    throw error
  }
}

/**
 * Get the last modified time of the habits file
 */
export async function getLastModifiedTime(accessToken: string): Promise<string | null> {
  try {
    const file = await findFile(accessToken)
    return file?.modifiedTime || null
  } catch (error) {
    console.error('Failed to get modified time:', error)
    return null
  }
}
