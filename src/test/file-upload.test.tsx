import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  FileUpload,
  type FileUploadItem,
} from '../components/ui/motion/file-upload'

describe('FileUpload', () => {
  it('announces progress and cancels an active upload', async () => {
    const user = userEvent.setup()
    const item: FileUploadItem = {
      id: 'upload-1',
      name: 'handoff.pdf',
      size: 7 * 1024 * 1024,
      status: 'uploading',
      progress: 50,
    }
    const onRemove = vi.fn()
    const onValueChange = vi.fn()
    render(
      <FileUpload
        value={[item]}
        onValueChange={onValueChange}
        onRemove={onRemove}
        disabled
      />,
    )

    expect(screen.getByRole('progressbar')).toHaveValue(50)
    await user.click(screen.getByRole('button', {
      name: 'Cancel upload of handoff.pdf',
    }))
    expect(onRemove).toHaveBeenCalledWith(item)
    expect(onValueChange).toHaveBeenCalledWith([])
  })
})
