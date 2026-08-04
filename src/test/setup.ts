import '@testing-library/jest-dom/vitest'

if (!globalThis.localStorage) {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      get length() { return values.size },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, String(value)),
    } satisfies Storage,
  })
}

const { default: i18n } = await import('../i18n')

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  writable: true,
  value: () => {},
})

Object.defineProperties(Element.prototype, {
  hasPointerCapture: {
    writable: true,
    value: () => false,
  },
  setPointerCapture: {
    writable: true,
    value: () => {},
  },
  releasePointerCapture: {
    writable: true,
    value: () => {},
  },
})

beforeEach(async () => {
  localStorage.clear()
  await i18n.changeLanguage('en-US')
})
