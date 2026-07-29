import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type FormEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AppSelect } from '../components/AppSelect'

const languageOptions = [
  { value: 'en-US', label: 'English' },
  { value: 'vi-VN', label: 'Tiếng Việt' },
]

describe('AppSelect', () => {
  it('supports keyboard selection and returns focus to the trigger', async () => {
    const user = userEvent.setup()

    function Example() {
      const [locale, setLocale] = useState('en-US')
      return (
        <label htmlFor="locale">
          Preferred language
          <AppSelect
            id="locale"
            value={locale}
            onValueChange={setLocale}
            options={languageOptions}
          />
        </label>
      )
    }

    render(<Example />)
    const trigger = screen.getByRole('combobox', { name: 'Preferred language' })

    trigger.focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(trigger).toHaveTextContent('Tiếng Việt')
    expect(trigger).toHaveFocus()
  })

  it('preserves empty values and native form submission names', async () => {
    const user = userEvent.setup()
    const submit = vi.fn()

    render(
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          submit(Object.fromEntries(new FormData(event.currentTarget)))
        }}
      >
        <label htmlFor="location">
          Default location
          <AppSelect
            id="location"
            name="locationId"
            defaultValue="central"
            options={[
              { value: '', label: 'No default location' },
              { value: 'central', label: 'Central Clinic' },
            ]}
          />
        </label>
        <button type="submit">Save</button>
      </form>,
    )

    await user.click(screen.getByRole('combobox', { name: 'Default location' }))
    await user.click(screen.getByRole('option', { name: 'No default location' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(submit).toHaveBeenCalledWith({ locationId: '' })
  })
})
