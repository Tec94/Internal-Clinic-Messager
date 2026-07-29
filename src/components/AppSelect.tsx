import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import {
  forwardRef,
  type FocusEventHandler,
  type ReactNode,
  useState,
} from 'react'

const EMPTY_VALUE = '__app-select-empty__'

export interface AppSelectOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface AppSelectProps {
  id?: string
  name?: string
  value?: string
  defaultValue?: string
  options: AppSelectOption[]
  onValueChange?: (value: string) => void
  onBlur?: FocusEventHandler<HTMLButtonElement>
  disabled?: boolean
  required?: boolean
  ariaLabel?: string
  ariaDescribedBy?: string
  ariaInvalid?: boolean
  className?: string
  placeholder?: ReactNode
}

function encodeValue(value: string) {
  return value === '' ? EMPTY_VALUE : value
}

function decodeValue(value: string) {
  return value === EMPTY_VALUE ? '' : value
}

export const AppSelect = forwardRef<HTMLButtonElement, AppSelectProps>(
  function AppSelect(
    {
      id,
      name,
      value,
      defaultValue,
      options,
      onValueChange,
      onBlur,
      disabled,
      required,
      ariaLabel,
      ariaDescribedBy,
      ariaInvalid,
      className = '',
      placeholder,
    },
    ref,
  ) {
    const initialValue = defaultValue
      ?? (value === undefined
        ? options.find((option) => !option.disabled)?.value
        : undefined)
    const [uncontrolledValue, setUncontrolledValue] = useState(initialValue)
    const selectedValue = value ?? uncontrolledValue

    return (
      <>
        <Select.Root
          value={selectedValue === undefined ? undefined : encodeValue(selectedValue)}
          onValueChange={(nextValue) => {
            const decodedValue = decodeValue(nextValue)
            if (value === undefined) setUncontrolledValue(decodedValue)
            onValueChange?.(decodedValue)
          }}
          disabled={disabled}
          required={required}
        >
          <Select.Trigger
            ref={ref}
            id={id}
            type="button"
            className={`app-select__trigger ${className}`.trim()}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid || undefined}
            onBlur={onBlur}
          >
            <Select.Value className="app-select__value" placeholder={placeholder} />
            <Select.Icon className="app-select__icon">
              <ChevronDown size={16} aria-hidden="true" />
            </Select.Icon>
          </Select.Trigger>

          <Select.Portal>
            <Select.Content
              className="app-select__content"
              position="popper"
              sideOffset={6}
              collisionPadding={12}
            >
              <Select.ScrollUpButton className="app-select__scroll-button">
                <ChevronUp size={16} aria-hidden="true" />
              </Select.ScrollUpButton>
              <Select.Viewport className="app-select__viewport">
                {options.map((option) => (
                  <Select.Item
                    key={option.value}
                    className="app-select__item"
                    value={encodeValue(option.value)}
                    disabled={option.disabled}
                  >
                    <Select.ItemIndicator className="app-select__indicator">
                      <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                    </Select.ItemIndicator>
                    <Select.ItemText className="app-select__item-text">
                      {option.label}
                    </Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
              <Select.ScrollDownButton className="app-select__scroll-button">
                <ChevronDown size={16} aria-hidden="true" />
              </Select.ScrollDownButton>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        {name ? (
          <input
            type="hidden"
            name={name}
            value={selectedValue ?? ''}
            disabled={disabled}
          />
        ) : null}
      </>
    )
  },
)
